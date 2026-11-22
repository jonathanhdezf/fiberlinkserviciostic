// ==========================================
// FIBERLINK VISITOR REGISTRY SERVICE (Cloud Firestore)
// Subtle, PII-free session-deduplicated visitor counter in /site_stats/visitors
// ==========================================

import {
  doc,
  getDoc,
  getDocFromCache,
  runTransaction,
  serverTimestamp
} from 'firebase/firestore';
import {
  db,
  handleFirestoreError,
  OperationType
} from './firebase.js';

const STATS_DOC_PATH = 'site_stats/visitors';
const SESSION_KEY = 'fiberlink_visit_session_v1';
const CACHE_KEY = 'fiberlink_visitor_stats_cache_v1';

function getLocalDateKey() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getSafeRoutePath() {
  const raw = (typeof window !== 'undefined' && window.location?.pathname) ? window.location.pathname : '/';
  const cleaned = String(raw).trim() || '/';
  return cleaned.slice(0, 80);
}

function isOfflineOrNetworkError(err) {
  const code = String(err?.code || '').toLowerCase();
  const msg = String(err?.message || err || '').toLowerCase();
  return (
    code === 'unavailable' ||
    code === 'deadline-exceeded' ||
    msg.includes('offline') ||
    msg.includes('network') ||
    msg.includes('could not reach cloud firestore')
  );
}

function readLocalStatsCache(todayKey) {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && Number.isFinite(parsed.totalVisits)) {
      return {
        totalVisits: Number(parsed.totalVisits),
        todayVisits: parsed.todayKey === todayKey ? (Number(parsed.todayVisits) || 1) : 1,
        todayKey: parsed.todayKey || todayKey
      };
    }
  } catch (_) {}
  return null;
}

function writeLocalStatsCache(stats) {
  try {
    if (stats && Number.isFinite(stats.totalVisits)) {
      localStorage.setItem(CACHE_KEY, JSON.stringify(stats));
    }
  } catch (_) {}
}

export async function recordAndFetchVisitorStats() {
  const docRef = doc(db, 'site_stats', 'visitors');
  const todayKey = getLocalDateKey();
  const lastPage = getSafeRoutePath();

  let alreadyCountedToday = false;
  try {
    alreadyCountedToday = sessionStorage.getItem(SESSION_KEY) === todayKey;
  } catch (_) {}

  if (alreadyCountedToday) {
    try {
      const snap = await getDoc(docRef);
      if (snap.exists()) {
        const data = snap.data();
        const stats = {
          totalVisits: Number(data.totalVisits) || 1,
          todayVisits: Number(data.todayVisits) || 1,
          todayKey: data.todayKey || todayKey
        };
        writeLocalStatsCache(stats);
        return stats;
      }
    } catch (err) {
      if (isOfflineOrNetworkError(err)) {
        try {
          const cachedSnap = await getDocFromCache(docRef);
          if (cachedSnap.exists()) {
            const data = cachedSnap.data();
            return {
              totalVisits: Number(data.totalVisits) || 1,
              todayVisits: Number(data.todayVisits) || 1,
              todayKey: data.todayKey || todayKey
            };
          }
        } catch (_) {}
        return readLocalStatsCache(todayKey);
      }
      handleFirestoreError(err, OperationType.GET, STATS_DOC_PATH);
    }
  }

  try {
    const result = await runTransaction(db, async (tx) => {
      const snap = await tx.get(docRef);
      if (!snap.exists()) {
        tx.set(docRef, {
          id: 'visitors',
          totalVisits: 1,
          todayKey,
          todayVisits: 1,
          lastPage,
          updatedAt: serverTimestamp()
        });
        return { totalVisits: 1, todayVisits: 1, todayKey };
      }

      const prev = snap.data();
      const prevTotal = Number.isInteger(prev.totalVisits) && prev.totalVisits >= 1 ? prev.totalVisits : 1;
      const prevToday = Number.isInteger(prev.todayVisits) && prev.todayVisits >= 1 ? prev.todayVisits : 1;
      const nextTotal = prevTotal + 1;
      const nextToday = prev.todayKey === todayKey ? prevToday + 1 : 1;

      tx.update(docRef, {
        totalVisits: nextTotal,
        todayKey,
        todayVisits: nextToday,
        lastPage,
        updatedAt: serverTimestamp()
      });

      return { totalVisits: nextTotal, todayVisits: nextToday, todayKey };
    });

    try {
      sessionStorage.setItem(SESSION_KEY, todayKey);
    } catch (_) {}
    writeLocalStatsCache(result);

    return result;
  } catch (err) {
    if (isOfflineOrNetworkError(err)) {
      return readLocalStatsCache(todayKey);
    }
    handleFirestoreError(err, OperationType.WRITE, STATS_DOC_PATH);
  }
}
