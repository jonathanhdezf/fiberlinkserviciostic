// ==========================================================
// FIBERLINK SOUND LIBRARY SERVICE (Cloud Firestore + WebAudio)
// Syncs custom & procedural cracked-screen shatter sounds in real time
// ==========================================================

import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc
} from 'firebase/firestore';
import {
  auth,
  db,
  handleFirestoreError,
  OperationType
} from './firebase.js';

const ACTIVE_CONFIG_PATH = 'site_config/cracked_screen';
const SOUND_LIB_PATH = 'sound_library';
const LOCAL_CACHE_KEY = 'fiberlink_active_crack_sound_v1';
const MAX_AUDIO_FILE_BYTES = 255 * 1024; // ~340KB base64, safely < 360,000 rules bound
const MAX_AUDIO_DATA_CHARS = 360000;
const MAX_AUDIO_URL_CHARS = 500;

export const SOUND_CATEGORIES = {
  cristal: 'Cristal & Vidrio',
  oled: 'OLED & Eléctrico',
  impacto: 'Impacto Seco',
  glitch: 'Glitch Digital',
  personalizado: 'Audio Subido / URL'
};

export const DEFAULT_SYNTH_CONFIG = {
  impactFreq: 1400,
  impactGain: 0.7,
  noiseFreq: 4200,
  noiseQ: 4.5,
  noiseDecayMs: 280,
  shimmerFreq: 4800,
  glitchBuzzHz: 0,
  durationMs: 300
};

export const DEFAULT_GLASS_PRESETS = [
  {
    id: 'preset-cristal-clasico',
    presetKey: 'cristal_clasico',
    name: 'Cristal Templado Clásico',
    description: 'Impacto nítido de mica templada con crujido cristalino equilibrado.',
    category: 'cristal',
    sourceType: 'preset',
    audioData: '',
    audioUrl: '',
    volume: 0.85,
    isBuiltIn: true,
    synthConfig: { ...DEFAULT_SYNTH_CONFIG }
  },
  {
    id: 'preset-gorilla-seco',
    presetKey: 'gorilla_seco',
    name: 'Gorilla Glass Impacto Seco',
    description: 'Golpe grave y compacto de vidrio grueso sin reverberación excesiva.',
    category: 'impacto',
    sourceType: 'preset',
    audioData: '',
    audioUrl: '',
    volume: 0.9,
    isBuiltIn: true,
    synthConfig: {
      impactFreq: 680,
      impactGain: 0.9,
      noiseFreq: 2900,
      noiseQ: 3.1,
      noiseDecayMs: 220,
      shimmerFreq: 3800,
      glitchBuzzHz: 0,
      durationMs: 290
    }
  },
  {
    id: 'preset-oled-glitch',
    presetKey: 'oled_glitch',
    name: 'Estallido OLED + Interferencia',
    description: 'Fractura de pantalla AMOLED acompañada de zumbido eléctrico de subpíxeles.',
    category: 'oled',
    sourceType: 'preset',
    audioData: '',
    audioUrl: '',
    volume: 0.85,
    isBuiltIn: true,
    synthConfig: {
      impactFreq: 1180,
      impactGain: 0.75,
      noiseFreq: 3900,
      noiseQ: 4.2,
      noiseDecayMs: 310,
      shimmerFreq: 5200,
      glitchBuzzHz: 240,
      durationMs: 390
    }
  },
  {
    id: 'preset-vidrio-fino',
    presetKey: 'vidrio_fino',
    name: 'Vidrio Ultra Fino (Tinkle Agudo)',
    description: 'Crujido brillante de esquirlas delgadas con armónicos cristalinos altos.',
    category: 'cristal',
    sourceType: 'preset',
    audioData: '',
    audioUrl: '',
    volume: 0.82,
    isBuiltIn: true,
    synthConfig: {
      impactFreq: 2200,
      impactGain: 0.55,
      noiseFreq: 5800,
      noiseQ: 6.0,
      noiseDecayMs: 340,
      shimmerFreq: 7200,
      glitchBuzzHz: 0,
      durationMs: 360
    }
  },
  {
    id: 'preset-retro-glitch',
    presetKey: 'retro_glitch',
    name: 'Fractura Digital Glitch',
    description: 'Chasquido seco con corte digital tipo fallo de controlador gráfico.',
    category: 'glitch',
    sourceType: 'preset',
    audioData: '',
    audioUrl: '',
    volume: 0.85,
    isBuiltIn: true,
    synthConfig: {
      impactFreq: 1950,
      impactGain: 0.8,
      noiseFreq: 4600,
      noiseQ: 5.5,
      noiseDecayMs: 240,
      shimmerFreq: 6100,
      glitchBuzzHz: 520,
      durationMs: 350
    }
  }
];

function clampNum(val, min, max, fallback) {
  const num = Number(val);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

function sanitizeId(rawId, fallbackPrefix = 'snd') {
  const cleaned = String(rawId || '')
    .trim()
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .slice(0, 128);
  return cleaned || `${fallbackPrefix}_${Date.now()}`;
}

export function normalizeSynthConfig(cfg = {}) {
  return {
    impactFreq: Math.round(clampNum(cfg.impactFreq, 60, 5000, DEFAULT_SYNTH_CONFIG.impactFreq)),
    impactGain: Number(clampNum(cfg.impactGain, 0, 1, DEFAULT_SYNTH_CONFIG.impactGain).toFixed(2)),
    noiseFreq: Math.round(clampNum(cfg.noiseFreq, 400, 12000, DEFAULT_SYNTH_CONFIG.noiseFreq)),
    noiseQ: Number(clampNum(cfg.noiseQ, 0.5, 15, DEFAULT_SYNTH_CONFIG.noiseQ).toFixed(2)),
    noiseDecayMs: Math.round(clampNum(cfg.noiseDecayMs, 40, 1200, DEFAULT_SYNTH_CONFIG.noiseDecayMs)),
    shimmerFreq: Math.round(clampNum(cfg.shimmerFreq, 1000, 12000, DEFAULT_SYNTH_CONFIG.shimmerFreq)),
    glitchBuzzHz: Math.round(clampNum(cfg.glitchBuzzHz, 0, 2000, DEFAULT_SYNTH_CONFIG.glitchBuzzHz)),
    durationMs: Math.round(clampNum(cfg.durationMs, 80, 2000, DEFAULT_SYNTH_CONFIG.durationMs))
  };
}

function sanitizeCategory(cat) {
  return ['cristal', 'oled', 'impacto', 'glitch', 'personalizado'].includes(cat) ? cat : 'personalizado';
}

function sanitizeSourceType(st) {
  return ['preset', 'synth', 'audio_file', 'audio_url'].includes(st) ? st : 'preset';
}

function sanitizeAudioData(dataStr) {
  const str = String(dataStr || '').trim();
  if (!str) return '';
  if (str.length > MAX_AUDIO_DATA_CHARS) {
    throw new Error('El audio codificado excede el límite seguro de 360,000 caracteres para Firestore.');
  }
  const match = /^data:(audio\/[a-zA-Z0-9.+_-]+)(?:;[^;,=]+=[^;,]+)*;base64,([A-Za-z0-9+/=]+)$/.exec(str);
  if (!match) {
    throw new Error('Formato de audio base64 inválido. Sube un archivo MP3, WAV, OGG o M4A válido.');
  }
  return `data:${match[1]};base64,${match[2]}`;
}

function sanitizeAudioUrl(urlStr) {
  const str = String(urlStr || '').trim();
  if (!str) return '';
  if (str.length > MAX_AUDIO_URL_CHARS) {
    throw new Error('La URL del audio supera los 500 caracteres permitidos.');
  }
  if (!/^https:\/\/.+/.test(str)) {
    throw new Error('La URL externa del audio debe iniciar con https://');
  }
  return str;
}

function toIsoDate(val) {
  if (!val) return null;
  if (typeof val.toDate === 'function') return val.toDate().toISOString();
  return String(val);
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

export function getCachedActiveSound() {
  try {
    const raw = localStorage.getItem(LOCAL_CACHE_KEY);
    if (!raw) return { ...DEFAULT_GLASS_PRESETS[0] };
    const parsed = JSON.parse(raw);
    if (parsed && parsed.name && parsed.sourceType) {
      return {
        ...DEFAULT_GLASS_PRESETS[0],
        ...parsed,
        synthConfig: normalizeSynthConfig(parsed.synthConfig),
        volume: clampNum(parsed.volume, 0, 1, 0.85)
      };
    }
  } catch (_) {}
  return { ...DEFAULT_GLASS_PRESETS[0] };
}

function writeCachedActiveSound(cfg) {
  try {
    if (cfg) {
      localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(cfg));
    }
  } catch (_) {
    try {
      localStorage.removeItem(LOCAL_CACHE_KEY);
      if (cfg) localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(cfg));
    } catch (_) {}
  }
}

// Track active playback & shared WebAudio context so multi-tap / iframe playback never gets blocked
let currentAudioEl = null;
let sharedAudioCtx = null;
let activeStopCallbacks = [];
const decodedBufferCache = new Map(); // cacheKey -> Promise<AudioBuffer|null> | AudioBuffer
const resolvedBufferMap = new Map(); // cacheKey -> AudioBuffer
const preloadedHtmlAudioMap = new Map(); // cacheKey -> HTMLAudioElement

export function getSharedAudioContext() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedAudioCtx || sharedAudioCtx.state === 'closed') {
    sharedAudioCtx = new AudioCtx();
  }
  return sharedAudioCtx;
}

function getSoundCacheKey(cfg) {
  if (!cfg) return '';
  if (cfg.sourceType === 'audio_file' && cfg.audioData) {
    return `file:${cfg.activeSoundId || cfg.id || ''}:${cfg.audioData.length}:${cfg.audioData.slice(0, 48)}:${cfg.audioData.slice(-24)}`;
  }
  if (cfg.sourceType === 'audio_url' && cfg.audioUrl) {
    return `url:${cfg.activeSoundId || cfg.id || ''}:${cfg.audioUrl}`;
  }
  return '';
}

function dataUrlToArrayBuffer(dataUrl) {
  const idx = dataUrl.indexOf('base64,');
  if (idx === -1) return null;
  const b64 = dataUrl.slice(idx + 7);
  const binStr = window.atob(b64);
  const len = binStr.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binStr.charCodeAt(i);
  }
  return bytes.buffer;
}

async function decodeSoundToBuffer(cfg) {
  const key = getSoundCacheKey(cfg);
  if (!key) return null;
  if (resolvedBufferMap.has(key)) {
    return resolvedBufferMap.get(key);
  }
  if (decodedBufferCache.has(key)) {
    return decodedBufferCache.get(key);
  }

  const actx = getSharedAudioContext();
  if (!actx) return null;

  const decodePromise = (async () => {
    try {
      let rawBuffer = null;
      if (cfg.sourceType === 'audio_file' && cfg.audioData) {
        rawBuffer = dataUrlToArrayBuffer(cfg.audioData);
      } else if (cfg.sourceType === 'audio_url' && cfg.audioUrl) {
        const resp = await fetch(cfg.audioUrl, { mode: 'cors' });
        if (resp.ok) {
          rawBuffer = await resp.arrayBuffer();
        }
      }
      if (!rawBuffer) return null;
      const decoded = await actx.decodeAudioData(rawBuffer.slice(0));
      if (decoded) {
        if (resolvedBufferMap.size > 8) {
          const oldestKey = resolvedBufferMap.keys().next().value;
          resolvedBufferMap.delete(oldestKey);
        }
        resolvedBufferMap.set(key, decoded);
      }
      return decoded;
    } catch (_) {
      return null;
    } finally {
      decodedBufferCache.delete(key);
    }
  })();

  decodedBufferCache.set(key, decodePromise);
  return decodePromise;
}

export function preloadCrackedSound(soundConfig) {
  const cfg = soundConfig;
  if (!cfg) return;
  const key = getSoundCacheKey(cfg);
  if (!key) return;

  // 1. Decode into WebAudio AudioBuffer for zero-latency, gesture-safe playback
  decodeSoundToBuffer(cfg);

  // 2. Also warm an HTMLAudioElement backup
  const src =
    cfg.sourceType === 'audio_file' && cfg.audioData
      ? cfg.audioData
      : (cfg.sourceType === 'audio_url' && cfg.audioUrl ? cfg.audioUrl : '');
  if (src && !preloadedHtmlAudioMap.has(key)) {
    try {
      if (preloadedHtmlAudioMap.size > 6) {
        const oldestKey = preloadedHtmlAudioMap.keys().next().value;
        preloadedHtmlAudioMap.delete(oldestKey);
      }
      const el = new Audio(src);
      el.preload = 'auto';
      el.load();
      preloadedHtmlAudioMap.set(key, el);
    } catch (_) {}
  }
}

export function unlockCrackedAudioEngine(soundConfig) {
  try {
    const actx = getSharedAudioContext();
    if (actx && actx.state === 'suspended') {
      actx.resume().catch(() => {});
    }
    if (soundConfig) {
      preloadCrackedSound(soundConfig);
    }
  } catch (_) {}
}

export function stopActivePreviewSound() {
  if (currentAudioEl) {
    try {
      currentAudioEl.pause();
      currentAudioEl.currentTime = 0;
    } catch (_) {}
    currentAudioEl = null;
  }
  if (activeStopCallbacks.length > 0) {
    activeStopCallbacks.forEach((fn) => {
      try {
        fn();
      } catch (_) {}
    });
    activeStopCallbacks = [];
  }
}

async function ensureRunningAudioContext() {
  const actx = getSharedAudioContext();
  if (!actx) return null;
  if (actx.state === 'suspended') {
    try {
      await actx.resume();
    } catch (_) {}
  }
  return actx;
}

function playDecodedBuffer(actx, audioBuffer, vol, onEnded) {
  stopActivePreviewSound();
  const source = actx.createBufferSource();
  source.buffer = audioBuffer;

  const gainNode = actx.createGain();
  const now = actx.currentTime;
  gainNode.gain.setValueAtTime(vol, now);

  source.connect(gainNode);
  gainNode.connect(actx.destination);

  let finished = false;
  const cleanup = () => {
    if (finished) return;
    finished = true;
    try {
      source.disconnect();
      gainNode.disconnect();
    } catch (_) {}
  };

  const stopFn = () => {
    try {
      source.stop();
    } catch (_) {}
    cleanup();
  };
  activeStopCallbacks.push(stopFn);

  source.onended = () => {
    activeStopCallbacks = activeStopCallbacks.filter((fn) => fn !== stopFn);
    cleanup();
    if (onEnded) onEnded();
  };

  source.start(0);
}

async function playSynthGlassSound(soundCfg, onEnded) {
  try {
    const actx = await ensureRunningAudioContext();
    if (!actx) {
      if (onEnded) onEnded();
      return;
    }

    stopActivePreviewSound();

    const now = actx.currentTime + 0.008;
    const vol = clampNum(soundCfg?.volume, 0, 1, 0.85);
    const cfg = normalizeSynthConfig(soundCfg?.synthConfig);

    const masterGain = actx.createGain();
    masterGain.gain.setValueAtTime(vol, now);
    masterGain.connect(actx.destination);

    const synthNodes = [];

    // 1. Initial mechanical impact snap
    const clickOsc = actx.createOscillator();
    clickOsc.type = 'square';
    clickOsc.frequency.setValueAtTime(cfg.impactFreq, now);
    clickOsc.frequency.exponentialRampToValueAtTime(Math.max(45, cfg.impactFreq * 0.09), now + 0.042);

    const clickGain = actx.createGain();
    clickGain.gain.setValueAtTime(Math.max(0.05, cfg.impactGain), now);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.042);

    clickOsc.connect(clickGain);
    clickGain.connect(masterGain);
    clickOsc.start(now);
    clickOsc.stop(now + 0.045);
    synthNodes.push(clickOsc);

    // 2. High-frequency glass crunch (filtered noise burst)
    const noiseDuration = Math.max(0.06, cfg.noiseDecayMs / 1000);
    const bufferSize = Math.floor(actx.sampleRate * noiseDuration);
    const noiseBuffer = actx.createBuffer(1, bufferSize, actx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    const decayConst = Math.max(0.012, noiseDuration * 0.22);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (actx.sampleRate * decayConst));
    }

    const whiteNoise = actx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;

    const bandpass = actx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.setValueAtTime(cfg.noiseFreq, now);
    bandpass.Q.setValueAtTime(cfg.noiseQ, now);

    const highpass = actx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.setValueAtTime(Math.max(500, cfg.noiseFreq * 0.55), now);

    const noiseGain = actx.createGain();
    noiseGain.gain.setValueAtTime(0.92, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + noiseDuration);

    whiteNoise.connect(bandpass);
    bandpass.connect(highpass);
    highpass.connect(noiseGain);
    noiseGain.connect(masterGain);
    whiteNoise.start(now);
    synthNodes.push(whiteNoise);

    // 3. Crystalline glass shimmer harmonics
    const baseShimmer = cfg.shimmerFreq;
    [baseShimmer, Math.min(13000, baseShimmer * 1.48), Math.min(15000, baseShimmer * 1.92)].forEach((freq, idx) => {
      const osc = actx.createOscillator();
      osc.type = 'triangle';
      const startAt = now + idx * 0.014;
      const stopAt = startAt + 0.18;
      osc.frequency.setValueAtTime(freq, startAt);
      osc.frequency.exponentialRampToValueAtTime(Math.max(300, freq * 0.38), stopAt);

      const oscGain = actx.createGain();
      oscGain.gain.setValueAtTime(0.32 / (idx + 1), startAt);
      oscGain.gain.exponentialRampToValueAtTime(0.001, stopAt);

      osc.connect(oscGain);
      oscGain.connect(masterGain);
      osc.start(startAt);
      osc.stop(stopAt);
      synthNodes.push(osc);
    });

    // 4. Optional OLED electrical / digital glitch buzz
    if (cfg.glitchBuzzHz > 0) {
      const buzzOsc = actx.createOscillator();
      buzzOsc.type = 'sawtooth';
      const buzzDur = Math.min(0.65, Math.max(0.12, cfg.durationMs / 1000));
      buzzOsc.frequency.setValueAtTime(cfg.glitchBuzzHz, now + 0.02);
      buzzOsc.frequency.linearRampToValueAtTime(cfg.glitchBuzzHz * 0.72, now + buzzDur);

      const buzzFilter = actx.createBiquadFilter();
      buzzFilter.type = 'bandpass';
      buzzFilter.frequency.setValueAtTime(1600, now);
      buzzFilter.Q.setValueAtTime(2.0, now);

      const buzzGain = actx.createGain();
      buzzGain.gain.setValueAtTime(0.18, now + 0.02);
      buzzGain.gain.exponentialRampToValueAtTime(0.001, now + buzzDur);

      buzzOsc.connect(buzzFilter);
      buzzFilter.connect(buzzGain);
      buzzGain.connect(masterGain);
      buzzOsc.start(now + 0.02);
      buzzOsc.stop(now + buzzDur);
      synthNodes.push(buzzOsc);
    }

    const totalMs = Math.max(220, cfg.durationMs + 80);
    let endTimer = null;
    const stopSynth = () => {
      if (endTimer) {
        clearTimeout(endTimer);
        endTimer = null;
      }
      synthNodes.forEach((n) => {
        try {
          n.stop();
        } catch (_) {}
      });
      try {
        masterGain.disconnect();
      } catch (_) {}
    };
    activeStopCallbacks.push(stopSynth);

    endTimer = setTimeout(() => {
      activeStopCallbacks = activeStopCallbacks.filter((fn) => fn !== stopSynth);
      try {
        masterGain.disconnect();
      } catch (_) {}
      if (onEnded) onEnded();
    }, totalMs);
  } catch (_) {
    if (onEnded) onEnded();
  }
}

export async function playCrackedSound(soundConfig, { onEnded } = {}) {
  const cfg = soundConfig || getCachedActiveSound();
  const vol = clampNum(cfg.volume, 0, 1, 0.85);
  const src =
    cfg.sourceType === 'audio_file' && cfg.audioData
      ? cfg.audioData
      : (cfg.sourceType === 'audio_url' && cfg.audioUrl ? cfg.audioUrl : '');

  if (src) {
    // 1. Prefer WebAudio AudioBuffer playback (reliable inside pointerdown, touch, and iframes)
    const key = getSoundCacheKey(cfg);
    try {
      const fastCtx = getSharedAudioContext();
      const fastBuffer = resolvedBufferMap.get(key);
      if (fastBuffer && fastCtx && fastCtx.state === 'running') {
        playDecodedBuffer(fastCtx, fastBuffer, vol, onEnded);
        return;
      }
      const actx = await ensureRunningAudioContext();
      if (actx) {
        let buffer = resolvedBufferMap.get(key) || null;
        if (!buffer) {
          buffer = await decodeSoundToBuffer(cfg);
        }
        if (buffer) {
          playDecodedBuffer(actx, buffer, vol, onEnded);
          return;
        }
      }
    } catch (err) {
      console.warn('[SoundLibrary] WebAudio decode failed, trying HTMLAudio:', err);
    }

    // 2. Fallback to preloaded/live HTMLAudioElement (e.g. non-CORS external audio URL)
    try {
      stopActivePreviewSound();
      const cachedEl = preloadedHtmlAudioMap.get(key);
      const audio = cachedEl || new Audio(src);
      audio.volume = vol;
      audio.currentTime = 0;
      currentAudioEl = audio;

      const handleEnded = () => {
        audio.removeEventListener('ended', handleEnded);
        audio.removeEventListener('error', handleError);
        if (currentAudioEl === audio) currentAudioEl = null;
        if (onEnded) onEnded();
      };
      const handleError = () => {
        audio.removeEventListener('ended', handleEnded);
        audio.removeEventListener('error', handleError);
        if (currentAudioEl === audio) currentAudioEl = null;
        console.warn('[SoundLibrary] HTMLAudio error, falling back to synth sound.');
        playSynthGlassSound(cfg, onEnded);
      };

      audio.addEventListener('ended', handleEnded);
      audio.addEventListener('error', handleError);
      await audio.play();
      return;
    } catch (err) {
      currentAudioEl = null;
      console.warn('[SoundLibrary] HTMLAudio play blocked/failed, falling back to synth sound:', err);
      await playSynthGlassSound(cfg, onEnded);
      return;
    }
  }

  await playSynthGlassSound(cfg, onEnded);
}

export function prepareAudioFilePayload(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('No se seleccionó ningún archivo de audio.'));
      return;
    }

    const fileName = String(file.name || '').toLowerCase();
    const validExt = /\.(mp3|wav|ogg|m4a|aac|webm)$/i.test(fileName);
    const validMime = String(file.type || '').startsWith('audio/');
    if (!validExt && !validMime) {
      reject(new Error('Formato no soportado. Usa MP3, WAV, OGG, M4A o WebM de audio.'));
      return;
    }

    if (file.size > MAX_AUDIO_FILE_BYTES) {
      reject(new Error(`El archivo pesa ${Math.round(file.size / 1024)} KB. El máximo permitido para sincronizar en Firestore es 255 KB (usa clips cortos de 0.3s a 3s).`));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer el archivo de audio seleccionado.'));
    reader.onload = () => {
      try {
        let dataUrl = String(reader.result || '');
        const b64Index = dataUrl.indexOf('base64,');
        if (b64Index === -1) {
          reject(new Error('No se pudo codificar el archivo de audio a base64.'));
          return;
        }

        const base64Body = dataUrl.slice(b64Index + 7).replace(/\s+/g, '');
        let mime = 'audio/mpeg';
        if (fileName.endsWith('.wav') || dataUrl.includes('audio/wav') || dataUrl.includes('audio/x-wav')) {
          mime = 'audio/wav';
        } else if (fileName.endsWith('.ogg') || dataUrl.includes('audio/ogg')) {
          mime = 'audio/ogg';
        } else if (fileName.endsWith('.webm') || dataUrl.includes('audio/webm')) {
          mime = 'audio/webm';
        } else if (fileName.endsWith('.m4a') || fileName.endsWith('.aac') || dataUrl.includes('audio/mp4')) {
          mime = 'audio/mp4';
        }

        const normalized = `data:${mime};base64,${base64Body}`;
        if (normalized.length > MAX_AUDIO_DATA_CHARS) {
          reject(new Error('El archivo codificado supera el límite permitido para documentos de Firestore.'));
          return;
        }

        // Verify audio can be parsed by browser
        const probe = new Audio(normalized);
        let settled = false;
        const finishValid = (durationSec) => {
          if (settled) return;
          settled = true;
          resolve({
            audioData: normalized,
            fileSizeKb: Math.max(1, Math.round(file.size / 1024)),
            durationSec: Number.isFinite(durationSec) ? Number(durationSec.toFixed(2)) : null
          });
        };

        probe.addEventListener('loadedmetadata', () => finishValid(probe.duration));
        probe.addEventListener('error', () => {
          if (settled) return;
          settled = true;
          reject(new Error('El archivo no contiene una pista de audio reproducible válida.'));
        });
        // Fallback timeout if metadata loads silently or slow
        setTimeout(() => finishValid(null), 1200);
      } catch (err) {
        reject(err);
      }
    };
    reader.readAsDataURL(file);
  });
}

function normalizeActiveConfigDoc(data) {
  if (!data) return getCachedActiveSound();
  return {
    id: data.activeSoundId || 'preset-cristal-clasico',
    activeSoundId: data.activeSoundId || 'preset-cristal-clasico',
    name: data.name || 'Cristal Templado Clásico',
    category: sanitizeCategory(data.category),
    sourceType: sanitizeSourceType(data.sourceType),
    presetKey: data.presetKey || '',
    audioData: data.audioData || '',
    audioUrl: data.audioUrl || '',
    volume: clampNum(data.volume, 0, 1, 0.85),
    synthConfig: normalizeSynthConfig(data.synthConfig),
    updatedByName: data.updatedByName || 'Administrador',
    updatedAt: toIsoDate(data.updatedAt)
  };
}

function normalizeLibraryDoc(id, data) {
  return {
    id: data.id || id,
    name: data.name || 'Sonido Personalizado',
    description: data.description || '',
    category: sanitizeCategory(data.category),
    sourceType: sanitizeSourceType(data.sourceType),
    presetKey: data.presetKey || '',
    audioData: data.audioData || '',
    audioUrl: data.audioUrl || '',
    volume: clampNum(data.volume, 0, 1, 0.85),
    synthConfig: normalizeSynthConfig(data.synthConfig),
    createdBy: data.createdBy || '',
    createdByName: data.createdByName || 'Administrador',
    createdAt: toIsoDate(data.createdAt),
    updatedAt: toIsoDate(data.updatedAt),
    isBuiltIn: false
  };
}

export const soundLibraryService = {
  subscribeActiveCrackedSound(onChange, onError) {
    let active = true;
    const emitSound = (cfg) => {
      if (!active || !cfg) return;
      preloadCrackedSound(cfg);
      onChange(cfg);
    };

    // Emit cached sound immediately for zero-latency playback
    emitSound(getCachedActiveSound());

    const ref = doc(db, 'site_config', 'cracked_screen');

    const applySnapshot = (snap, allowMissingFallback) => {
      if (!active) return;
      if (!snap.exists()) {
        if (allowMissingFallback) {
          const fallback = { ...DEFAULT_GLASS_PRESETS[0], activeSoundId: DEFAULT_GLASS_PRESETS[0].id };
          writeCachedActiveSound(fallback);
          emitSound(fallback);
        }
        return;
      }
      const normalized = normalizeActiveConfigDoc(snap.data());
      writeCachedActiveSound(normalized);
      emitSound(normalized);
    };

    // Fetch authoritative latest document from Firestore server immediately
    const syncFromServer = () => {
      getDocFromServer(ref)
        .then((snap) => applySnapshot(snap, true))
        .catch(() => {});
    };
    syncFromServer();

    const unsubSnapshot = onSnapshot(
      ref,
      (snap) => {
        applySnapshot(snap, !snap.metadata?.fromCache);
      },
      (err) => {
        if (isOfflineOrNetworkError(err)) {
          console.warn('[SoundLibrary] Firestore offline; usando caché local para sonido de pantalla rota.');
          emitSound(getCachedActiveSound());
          return;
        }
        if (onError) {
          onError(err);
        } else {
          handleFirestoreError(err, OperationType.GET, ACTIVE_CONFIG_PATH);
        }
      }
    );

    const handleStorage = (e) => {
      if (e.key === LOCAL_CACHE_KEY && e.newValue) {
        emitSound(getCachedActiveSound());
      }
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        syncFromServer();
      }
    };

    window.addEventListener('storage', handleStorage);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      active = false;
      unsubSnapshot();
      window.removeEventListener('storage', handleStorage);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  },

  subscribeSoundLibrary(onChange, onError) {
    const q = query(collection(db, SOUND_LIB_PATH), orderBy('updatedAt', 'desc'));
    return onSnapshot(
      q,
      (snap) => {
        const list = snap.docs.map((d) => normalizeLibraryDoc(d.id, d.data()));
        onChange(list);
      },
      (err) => {
        if (isOfflineOrNetworkError(err)) {
          console.warn('[SoundLibrary] Biblioteca de sonidos sin conexión temporal.');
          onChange([]);
          return;
        }
        if (onError) {
          onError(err);
        } else {
          handleFirestoreError(err, OperationType.LIST, SOUND_LIB_PATH);
        }
      }
    );
  },

  async activateCrackedSound(soundItem, volumeOverride) {
    if (!auth.currentUser) {
      throw new Error('Debes iniciar sesión como Administrador para sincronizar sonidos con Firestore.');
    }

    const activeSoundId = sanitizeId(soundItem.activeSoundId || soundItem.id, 'preset');
    const sourceType = sanitizeSourceType(soundItem.sourceType);
    const audioData = sourceType === 'audio_file' ? sanitizeAudioData(soundItem.audioData) : '';
    const audioUrl = sourceType === 'audio_url' ? sanitizeAudioUrl(soundItem.audioUrl) : '';

    if (sourceType === 'audio_file' && !audioData) {
      throw new Error('El sonido seleccionado no contiene datos de audio válidos.');
    }
    if (sourceType === 'audio_url' && !audioUrl) {
      throw new Error('La URL del audio externo no es válida.');
    }

    const volume = clampNum(volumeOverride !== undefined ? volumeOverride : soundItem.volume, 0, 1, 0.85);
    const payload = {
      id: 'cracked_screen',
      activeSoundId,
      name: String(soundItem.name || 'Sonido Pantalla Rota').trim().slice(0, 120),
      category: sanitizeCategory(soundItem.category),
      sourceType,
      presetKey: String(soundItem.presetKey || '').trim().slice(0, 64),
      audioData,
      audioUrl,
      volume,
      synthConfig: normalizeSynthConfig(soundItem.synthConfig),
      updatedByName: String(auth.currentUser.displayName || auth.currentUser.email || 'Administrador').trim().slice(0, 120),
      updatedAt: serverTimestamp()
    };

    const ref = doc(db, 'site_config', 'cracked_screen');
    try {
      const existingSnap = await getDoc(ref);
      if (!existingSnap.exists()) {
        await setDoc(ref, payload);
      } else {
        const { id: _ignoreId, ...updateFields } = payload;
        await updateDoc(ref, updateFields);
      }
      const cached = normalizeActiveConfigDoc({ ...payload, updatedAt: new Date().toISOString() });
      writeCachedActiveSound(cached);
      return cached;
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, ACTIVE_CONFIG_PATH);
    }
  },

  async saveCustomSoundToLibrary(soundInput) {
    if (!auth.currentUser) {
      throw new Error('Debes iniciar sesión como Administrador para guardar sonidos.');
    }

    const soundId = sanitizeId(soundInput.id || `snd_${Date.now()}`, 'snd');
    const sourceType = sanitizeSourceType(soundInput.sourceType || 'synth');
    const audioData = sourceType === 'audio_file' ? sanitizeAudioData(soundInput.audioData) : '';
    const audioUrl = sourceType === 'audio_url' ? sanitizeAudioUrl(soundInput.audioUrl) : '';

    if (sourceType === 'audio_file' && !audioData) {
      throw new Error('Selecciona un archivo MP3, WAV, OGG o M4A antes de guardar.');
    }
    if (sourceType === 'audio_url' && !audioUrl) {
      throw new Error('Ingresa una URL https:// válida para el archivo de audio.');
    }

    const name = String(soundInput.name || '').trim().slice(0, 120);
    if (!name) {
      throw new Error('Escribe un nombre identificador para el sonido.');
    }

    const ref = doc(db, SOUND_LIB_PATH, soundId);
    try {
      const existingSnap = await getDoc(ref);
      if (!existingSnap.exists()) {
        const createPayload = {
          id: soundId,
          name,
          description: String(soundInput.description || '').trim().slice(0, 300),
          category: sanitizeCategory(soundInput.category || 'personalizado'),
          sourceType,
          presetKey: String(soundInput.presetKey || '').trim().slice(0, 64),
          audioData,
          audioUrl,
          volume: clampNum(soundInput.volume, 0, 1, 0.85),
          synthConfig: normalizeSynthConfig(soundInput.synthConfig),
          createdBy: auth.currentUser.uid,
          createdByName: String(auth.currentUser.displayName || auth.currentUser.email || 'Administrador').trim().slice(0, 120),
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        };
        await setDoc(ref, createPayload);
        return normalizeLibraryDoc(soundId, { ...createPayload, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
      }

      const updatePayload = {
        name,
        description: String(soundInput.description || '').trim().slice(0, 300),
        category: sanitizeCategory(soundInput.category || 'personalizado'),
        sourceType,
        presetKey: String(soundInput.presetKey || '').trim().slice(0, 64),
        audioData,
        audioUrl,
        volume: clampNum(soundInput.volume, 0, 1, 0.85),
        synthConfig: normalizeSynthConfig(soundInput.synthConfig),
        updatedAt: serverTimestamp()
      };
      await updateDoc(ref, updatePayload);
      return normalizeLibraryDoc(soundId, { ...existingSnap.data(), ...updatePayload, updatedAt: new Date().toISOString() });
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `${SOUND_LIB_PATH}/${soundId}`);
    }
  },

  async deleteCustomSound(soundId) {
    if (!auth.currentUser) {
      throw new Error('Debes iniciar sesión como Administrador.');
    }
    const cleanId = sanitizeId(soundId);
    try {
      await deleteDoc(doc(db, SOUND_LIB_PATH, cleanId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `${SOUND_LIB_PATH}/${cleanId}`);
    }
  }
};
