// ==========================================
// FIBERLINK TICKET SERVICE (Cloud Firestore)
// Real-time Firestore database + Atomic PII-isolated public tracking
// ==========================================

import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  where,
  writeBatch
} from 'firebase/firestore';
import {
  auth,
  db,
  handleFirestoreError,
  OperationType
} from './firebase.js';

const LOCAL_STORAGE_KEY = 'fiberlink_tickets';
const ALLOWED_ESTADOS = ['creación', 'diagnostico', 'proceso', 'resuelto'];
const ALLOWED_PRIORITIES = ['Normal', 'Alta', 'Urgente', 'Crítica'];

function toIsoDate(val) {
  if (!val) return new Date().toISOString();
  if (typeof val.toDate === 'function') return val.toDate().toISOString();
  return String(val);
}

function sanitizeSignatureDataUrl(val) {
  if (typeof val !== 'string') return '';
  const trimmed = val.trim();
  if (!trimmed) return '';
  if (trimmed.length <= 22 || trimmed.length > 80000) return '';
  return /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(trimmed) ? trimmed : '';
}

function normalizeEquipmentData(raw, fallbackName = '') {
  const eq = raw && typeof raw === 'object' ? raw : {};
  return {
    deviceType: sanitizeStr(eq.deviceType, 80, ''),
    brandModel: sanitizeStr(eq.brandModel, 140, ''),
    serialNumber: sanitizeStr(eq.serialNumber, 80, ''),
    accessories: sanitizeStr(eq.accessories, 300, ''),
    physicalCondition: sanitizeStr(eq.physicalCondition, 300, ''),
    pickupAt: sanitizeStr(eq.pickupAt, 64, ''),
    deliveredAt: sanitizeStr(eq.deliveredAt, 64, ''),
    deliveredTo: sanitizeStr(eq.deliveredTo, 140, fallbackName),
    deliveryNotes: sanitizeStr(eq.deliveryNotes, 500, ''),
    pickupSignature: sanitizeSignatureDataUrl(eq.pickupSignature),
    techPickupSignature: sanitizeSignatureDataUrl(eq.techPickupSignature),
    deliverySignature: sanitizeSignatureDataUrl(eq.deliverySignature),
    techDeliverySignature: sanitizeSignatureDataUrl(eq.techDeliverySignature)
  };
}

function normalizeDiagnosisData(raw) {
  const diag = raw && typeof raw === 'object' ? raw : {};
  return {
    verifiedFault: sanitizeStr(diag.verifiedFault, 300, ''),
    testsPerformed: sanitizeStr(diag.testsPerformed, 500, ''),
    affectedParts: sanitizeStr(diag.affectedParts, 300, ''),
    technicalFindings: sanitizeStr(diag.technicalFindings, 1500, ''),
    recommendedSolution: sanitizeStr(diag.recommendedSolution, 1000, ''),
    feasibility: sanitizeStr(diag.feasibility, 60, ''),
    estimatedCost: Math.max(0, Math.min(10000000, parseFloat(diag.estimatedCost) || 0)),
    estimatedTime: sanitizeStr(diag.estimatedTime, 80, ''),
    diagnosedBy: sanitizeStr(diag.diagnosedBy, 120, ''),
    diagnosedAt: sanitizeStr(diag.diagnosedAt, 64, '')
  };
}

function normalizeTicketDoc(id, data) {
  return {
    id: data.id || id,
    folio: data.folio || id,
    estado: ALLOWED_ESTADOS.includes(data.estado) ? data.estado : 'creación',
    name: data.name || 'Cliente sin nombre',
    phone: data.phone || '',
    email: data.email || '',
    company: data.company || '',
    address: data.address || 'Soporte Remoto',
    service: data.service || 'Soporte técnico',
    modality: data.modality || 'En Sitio / Domicilio',
    priority: ALLOWED_PRIORITIES.includes(data.priority) ? data.priority : 'Normal',
    assignedTo: data.assignedTo || 'Sin asignar',
    description: data.description || '',
    source: data.source || 'Portal Web',
    bitacora: Array.isArray(data.bitacora) ? data.bitacora : [],
    pos: data.pos && typeof data.pos === 'object'
      ? {
          items: Array.isArray(data.pos.items) ? data.pos.items : [],
          total: Number(data.pos.total) || 0,
          paid: Boolean(data.pos.paid)
        }
      : { items: [], total: 0, paid: false },
    equipment: normalizeEquipmentData(data.equipment, data.name || ''),
    diagnosis: normalizeDiagnosisData(data.diagnosis),
    createdAt: toIsoDate(data.createdAt),
    updatedAt: toIsoDate(data.updatedAt)
  };
}

function sanitizeStr(val, maxLen, fallback = '') {
  const s = String(val ?? fallback).trim();
  return s.slice(0, maxLen);
}

function sanitizePriority(p) {
  if (ALLOWED_PRIORITIES.includes(p)) return p;
  const low = String(p || '').toLowerCase();
  if (low.includes('crit')) return 'Crítica';
  if (low.includes('urg')) return 'Urgente';
  if (low.includes('alt')) return 'Alta';
  return 'Normal';
}

function sanitizeEstado(e) {
  if (e === 'creacion') return 'creación';
  return ALLOWED_ESTADOS.includes(e) ? e : 'creación';
}

function saveLocalCache(tickets) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(tickets));
  } catch (_) {}
}

function getLocalCache() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
  } catch (_) {
    return [];
  }
}

async function generateUniqueFolio(preferredFolio = '') {
  if (preferredFolio && /^FL-[0-9]{4,10}$/.test(preferredFolio)) {
    const snap = await getDoc(doc(db, 'ticket_tracking', preferredFolio)).catch(() => null);
    if (!snap || !snap.exists()) return preferredFolio;
  }

  // If staff is authenticated, check highest existing numeric folio
  if (auth.currentUser) {
    try {
      const snap = await getDocs(collection(db, 'tickets'));
      let max = 1004;
      snap.forEach((d) => {
        const m = String(d.data().folio || '').match(/^FL-(\d+)$/);
        if (m) {
          const n = parseInt(m[1], 10);
          if (n > max && n < 9000) max = n;
        }
      });
      const candidate = `FL-${max + 1}`;
      const trackSnap = await getDoc(doc(db, 'ticket_tracking', candidate)).catch(() => null);
      if (!trackSnap || !trackSnap.exists()) return candidate;
    } catch (_) {}
  }

  for (let i = 0; i < 8; i++) {
    const num = Math.floor(1050 + Math.random() * 8850);
    const candidate = `FL-${num}`;
    const snap = await getDoc(doc(db, 'ticket_tracking', candidate)).catch(() => null);
    if (!snap || !snap.exists()) return candidate;
  }
  return `FL-${Date.now().toString().slice(-6)}`;
}

async function resolveTicketDocRef(idOrFolio) {
  const clean = String(idOrFolio || '').trim();
  if (!clean) return null;

  if (/^FL-[0-9]{4,10}$/i.test(clean)) {
    const q = query(collection(db, 'tickets'), where('folio', '==', clean.toUpperCase()), limit(1));
    const snap = await getDocs(q);
    if (!snap.empty) return snap.docs[0];
  }

  const directRef = doc(db, 'tickets', clean);
  const directSnap = await getDoc(directRef);
  if (directSnap.exists()) return directSnap;

  return null;
}

const STARTER_TICKETS = [
  {
    id: '1712000000001',
    folio: 'FL-1001',
    estado: 'creación',
    name: 'Carlos Mendoza',
    phone: '2311029988',
    email: 'carlos.mendoza@email.com',
    company: 'Café La Sierra',
    address: 'Av. Juárez 45, Centro, Teziutlán',
    service: 'Punto de Venta POS',
    modality: 'En Sitio / Domicilio',
    priority: 'Alta',
    assignedTo: 'Sin asignar',
    description: 'La impresora de tickets no responde tras apagón y el sistema marca error de comunicación COM3.',
    source: 'Portal Web',
    bitacora: [
      {
        id: 'b1',
        date: '2026-10-14T01:13:29.987Z',
        author: 'Mesa Técnica',
        note: 'Solicitud ingresada desde portal web. Se agenda visita técnica para revisión en sitio.'
      }
    ],
    pos: {
      items: [{ id: 'pos-1001', concept: 'Diagnóstico en sitio de hardware POS', qty: 1, price: 250 }],
      total: 250,
      paid: false
    }
  },
  {
    id: '1712000000002',
    folio: 'FL-1002',
    estado: 'diagnostico',
    name: 'Dra. Elena Ramos',
    phone: '2311054433',
    email: 'clinica.ramos@gmail.com',
    company: 'Clínica Dental Ramos',
    address: 'Calle Hidalgo 12, Teziutlán',
    service: 'Redes / WiFi',
    modality: 'En Sitio / Domicilio',
    priority: 'Urgente',
    assignedTo: 'Ing. Roberto Méndez',
    description: 'Caída de red WiFi en consultorios 2 y 3. El switch principal muestra luces rojas parpadeando.',
    source: 'Portal Web',
    bitacora: [
      {
        id: 'b2',
        date: '2026-10-14T11:13:29.987Z',
        author: 'Ing. Redes',
        note: 'Se detecta bucle de red por cable duplicado en recepción. Se procede a aislar el puerto.'
      }
    ],
    pos: {
      items: [{ id: 'pos-1002', concept: 'Reconfiguración de red LAN y AP Ubiquiti', qty: 1, price: 450 }],
      total: 450,
      paid: false
    }
  },
  {
    id: '1712000000003',
    folio: 'FL-1003',
    estado: 'proceso',
    name: 'Miguel Ángel Torres',
    phone: '2311082211',
    email: 'm.torres@constructora.mx',
    company: 'Torres & Asociados',
    address: 'Plaza Crystal Local 8, Teziutlán',
    service: 'Videovigilancia CCTV',
    modality: 'En Sitio / Domicilio',
    priority: 'Normal',
    assignedTo: 'Ing. Alejandro Luna',
    description: 'Instalación de 4 cámaras IP Hikvision y configuración de app móvil en celulares de gerencia.',
    source: 'Mesa de Control',
    bitacora: [
      {
        id: 'b3',
        date: '2026-10-13T17:13:29.987Z',
        author: 'Técnico CCTV',
        note: 'Cableado UTP categoría 6 terminado al 100%. Falta enfocar lente en cámara de estacionamiento.'
      }
    ],
    pos: {
      items: [
        { id: 'pos-1003-1', concept: 'Mano de obra instalación 4 cámaras IP', qty: 1, price: 1200 },
        { id: 'pos-1003-2', concept: 'Bobina UTP Cat6 100m + conectores', qty: 1, price: 850 }
      ],
      total: 2050,
      paid: false
    }
  },
  {
    id: '1712000000004',
    folio: 'FL-1004',
    estado: 'resuelto',
    name: 'Lic. Patricia Vega',
    phone: '2311123344',
    email: 'patricia@notariavega.com',
    company: 'Notaría Pública No. 2',
    address: 'Allende 302, Teziutlán',
    service: 'Soporte técnico',
    modality: 'Remoto',
    priority: 'Normal',
    assignedTo: 'Téc. Daniel Ortega',
    description: 'Mantenimiento preventivo, limpieza de temporales y renovación de antivirus en 3 equipos de oficina.',
    source: 'Portal Web',
    bitacora: [
      {
        id: 'b4',
        date: '2026-10-14T03:13:29.987Z',
        author: 'Mesa Técnica',
        note: 'Mantenimiento remoto completado exitosamente. Cliente confirma óptimo rendimiento.'
      }
    ],
    pos: {
      items: [{ id: 'pos-1004', concept: 'Mantenimiento preventivo lógico x3 PCs', qty: 1, price: 600 }],
      total: 600,
      paid: true
    }
  }
];

export const ticketService = {
  // Seed initial sample tickets once if Firestore /tickets is empty (Admin only)
  async seedInitialTicketsIfEmpty() {
    if (!auth.currentUser) return;
    try {
      const checkSnap = await getDocs(query(collection(db, 'tickets'), limit(1)));
      if (!checkSnap.empty) return;

      const batch = writeBatch(db);
      STARTER_TICKETS.forEach((t) => {
        const ticketRef = doc(db, 'tickets', t.id);
        const trackRef = doc(db, 'ticket_tracking', t.folio);
        batch.set(ticketRef, {
          ...t,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
        batch.set(trackRef, {
          folio: t.folio,
          ticketId: t.id,
          estado: t.estado,
          priority: t.priority,
          service: t.service,
          assignedTo: t.assignedTo,
          updatedAt: serverTimestamp()
        });
      });
      await batch.commit();
    } catch (err) {
      console.warn('[TicketService] Seed skipped or failed:', err.message);
    }
  },

  // 1. Create Ticket (Public intake or Staff ERP)
  async createTicket(ticketData) {
    const ticketId = `t-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const folio = await generateUniqueFolio(ticketData.folio);
    const isStaffUser = Boolean(auth.currentUser);
    const priority = sanitizePriority(ticketData.priority);
    const service = sanitizeStr(ticketData.service, 100, 'Soporte técnico');
    const assignedTo = isStaffUser ? sanitizeStr(ticketData.assignedTo, 120, 'Sin asignar') : 'Sin asignar';
    const authorName = sanitizeStr(ticketData.author || (isStaffUser ? auth.currentUser?.displayName : 'Portal Web'), 120, 'Portal Web');

    const newTicketDoc = {
      id: ticketId,
      folio,
      estado: 'creación',
      name: sanitizeStr(ticketData.name, 140, 'Cliente sin nombre'),
      phone: sanitizeStr(ticketData.phone, 32, ''),
      email: sanitizeStr(ticketData.email, 180, ''),
      company: sanitizeStr(ticketData.company, 140, ''),
      address: sanitizeStr(ticketData.address, 260, 'Soporte Remoto'),
      service,
      modality: sanitizeStr(ticketData.modality, 80, 'En Sitio / Domicilio'),
      priority,
      assignedTo,
      description: sanitizeStr(ticketData.description, 2000, ''),
      source: sanitizeStr(ticketData.source, 80, isStaffUser ? 'Mesa de Control' : 'Portal Web'),
      bitacora: [
        {
          id: `b-${Date.now()}`,
          date: new Date().toISOString(),
          author: authorName,
          note: sanitizeStr(`Ticket registrado (${service}).`, 1000)
        }
      ],
      pos: {
        items: [],
        total: 0,
        paid: false
      },
      ...(ticketData.equipment ? { equipment: normalizeEquipmentData(ticketData.equipment, ticketData.name || '') } : {}),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    const trackingDoc = {
      folio,
      ticketId,
      estado: 'creación',
      priority,
      service,
      assignedTo,
      updatedAt: serverTimestamp()
    };

    try {
      const batch = writeBatch(db);
      batch.set(doc(db, 'tickets', ticketId), newTicketDoc);
      batch.set(doc(db, 'ticket_tracking', folio), trackingDoc);
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `tickets/${ticketId}`);
    }

    const returnedTicket = normalizeTicketDoc(ticketId, {
      ...newTicketDoc,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });

    const local = getLocalCache().filter((t) => t.folio !== folio);
    local.unshift(returnedTicket);
    saveLocalCache(local);

    try {
      if ('BroadcastChannel' in window) {
        const bc = new BroadcastChannel('fiberlink-tickets');
        bc.postMessage({ type: 'new-ticket', ticket: returnedTicket });
        bc.close();
      }
    } catch (_) {}

    return returnedTicket;
  },

  // 2. Get All Tickets (Authenticated Staff only)
  async getTickets(filters = {}) {
    if (!auth.currentUser) return [];

    let list = [];
    try {
      const q = query(collection(db, 'tickets'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      list = snap.docs.map((d) => normalizeTicketDoc(d.id, d.data()));
      if (!filters.estado && !filters.priority && !filters.assignedTo && !filters.q) {
        saveLocalCache(list);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.LIST, 'tickets');
    }

    if (filters.estado) list = list.filter((t) => t.estado === filters.estado);
    if (filters.priority) list = list.filter((t) => t.priority === filters.priority);
    if (filters.assignedTo) list = list.filter((t) => t.assignedTo === filters.assignedTo);
    if (filters.q) {
      const qStr = filters.q.toLowerCase();
      list = list.filter((t) =>
        (t.folio && t.folio.toLowerCase().includes(qStr)) ||
        (t.name && t.name.toLowerCase().includes(qStr)) ||
        (t.company && t.company.toLowerCase().includes(qStr)) ||
        (t.service && t.service.toLowerCase().includes(qStr)) ||
        (t.phone && t.phone.includes(qStr))
      );
    }

    return list;
  },

  // Real-time Firestore listener for Staff ERP
  subscribeTickets(onData, onError) {
    if (!auth.currentUser) return () => {};
    const q = query(collection(db, 'tickets'), orderBy('createdAt', 'desc'));
    return onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((d) => normalizeTicketDoc(d.id, d.data()));
        saveLocalCache(list);
        onData(list, snapshot.docChanges());
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, 'tickets');
        } catch (wrapped) {
          if (typeof onError === 'function') onError(wrapped);
        }
      }
    );
  },

  // 3. Get Single Ticket (Staff gets full ticket; Public gets PII-free tracking lookup by folio)
  async getTicketById(idOrFolio) {
    const clean = String(idOrFolio || '').trim();
    if (!clean) return null;

    if (auth.currentUser) {
      try {
        const snap = await resolveTicketDocRef(clean);
        if (snap && snap.exists()) {
          return normalizeTicketDoc(snap.id, snap.data());
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `tickets/${clean}`);
      }
    }

    // Public PII-isolated folio lookup
    const upperFolio = clean.toUpperCase();
    if (/^FL-[0-9]{4,10}$/.test(upperFolio)) {
      try {
        const trackSnap = await getDoc(doc(db, 'ticket_tracking', upperFolio));
        if (trackSnap.exists()) {
          const td = trackSnap.data();
          return {
            id: td.ticketId,
            folio: td.folio,
            estado: td.estado,
            priority: td.priority,
            service: td.service,
            assignedTo: td.assignedTo,
            updatedAt: toIsoDate(td.updatedAt)
          };
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `ticket_tracking/${upperFolio}`);
      }
    }

    return null;
  },

  // 4. Update Ticket (status, priority, assignedTo, details)
  async updateTicket(id, payload) {
    let existingSnap;
    try {
      existingSnap = await resolveTicketDocRef(id);
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `tickets/${id}`);
    }
    if (!existingSnap || !existingSnap.exists()) return null;

    const current = normalizeTicketDoc(existingSnap.id, existingSnap.data());
    const authorName = sanitizeStr(payload.author || auth.currentUser?.displayName || 'Técnico Fiberlink', 120);
    const updates = { updatedAt: serverTimestamp() };
    const notesToAdd = [];

    if (payload.estado) {
      const nextEstado = sanitizeEstado(payload.estado);
      if (nextEstado !== current.estado) {
        updates.estado = nextEstado;
        notesToAdd.push(`Estado cambiado de "${current.estado}" a "${nextEstado}".`);
      }
    }

    if (payload.assignedTo !== undefined && payload.assignedTo !== current.assignedTo) {
      updates.assignedTo = sanitizeStr(payload.assignedTo, 120, 'Sin asignar');
      notesToAdd.push(`Técnico asignado: ${updates.assignedTo}`);
    }

    if (payload.priority !== undefined) {
      const nextPrio = sanitizePriority(payload.priority);
      if (nextPrio !== current.priority) {
        updates.priority = nextPrio;
        notesToAdd.push(`Prioridad actualizada a: ${nextPrio}`);
      }
    }

    if (payload.description !== undefined) updates.description = sanitizeStr(payload.description, 2000);
    if (payload.address !== undefined) updates.address = sanitizeStr(payload.address, 260);
    if (payload.phone !== undefined) updates.phone = sanitizeStr(payload.phone, 32);
    if (payload.name !== undefined) updates.name = sanitizeStr(payload.name, 140);
    if (payload.company !== undefined) updates.company = sanitizeStr(payload.company, 140);
    if (payload.service !== undefined) updates.service = sanitizeStr(payload.service, 100);
    if (payload.modality !== undefined) updates.modality = sanitizeStr(payload.modality, 80);
    if (payload.equipment !== undefined) updates.equipment = normalizeEquipmentData(payload.equipment, payload.name || current.name || '');

    if (notesToAdd.length > 0) {
      const nextBitacora = [...current.bitacora];
      notesToAdd.forEach((n, idx) => {
        nextBitacora.push({
          id: `b-${Date.now()}-${idx}`,
          date: new Date().toISOString(),
          author: authorName,
          note: sanitizeStr(n, 1000)
        });
      });
      updates.bitacora = nextBitacora.slice(-50);
    }

    const ticketRef = doc(db, 'tickets', existingSnap.id);
    const trackingRef = doc(db, 'ticket_tracking', current.folio);

    try {
      const batch = writeBatch(db);
      batch.update(ticketRef, updates);
      batch.set(
        trackingRef,
        {
          folio: current.folio,
          ticketId: existingSnap.id,
          estado: updates.estado || current.estado,
          priority: updates.priority || current.priority,
          service: updates.service || current.service,
          assignedTo: updates.assignedTo !== undefined ? updates.assignedTo : current.assignedTo,
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `tickets/${existingSnap.id}`);
    }

    return normalizeTicketDoc(existingSnap.id, {
      ...existingSnap.data(),
      ...updates,
      updatedAt: new Date().toISOString()
    });
  },

  async updateStatus(id, newStatus, author) {
    return this.updateTicket(id, { estado: newStatus, author });
  },

  // 5. Add Bitacora Note
  async addBitacoraNote(id, note, author = 'Técnico Fiberlink') {
    const cleanNote = sanitizeStr(note, 1000);
    if (!cleanNote) return null;

    let existingSnap;
    try {
      existingSnap = await resolveTicketDocRef(id);
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `tickets/${id}`);
    }
    if (!existingSnap || !existingSnap.exists()) return null;

    const current = normalizeTicketDoc(existingSnap.id, existingSnap.data());
    const entry = {
      id: `b-${Date.now()}`,
      date: new Date().toISOString(),
      author: sanitizeStr(author, 120, 'Técnico Fiberlink'),
      note: cleanNote
    };
    const nextBitacora = [...current.bitacora, entry].slice(-50);

    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'tickets', existingSnap.id), {
        bitacora: nextBitacora,
        updatedAt: serverTimestamp()
      });
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `tickets/${existingSnap.id}`);
    }

    return {
      ...current,
      bitacora: nextBitacora,
      updatedAt: new Date().toISOString()
    };
  },

  async addBitacoraEntry(id, note, author) {
    return this.addBitacoraNote(id, note, author);
  },

  // 6. Save POS items array
  async savePos(id, items, total, paidOverride) {
    let existingSnap;
    try {
      existingSnap = await resolveTicketDocRef(id);
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `tickets/${id}`);
    }
    if (!existingSnap || !existingSnap.exists()) return null;

    const current = normalizeTicketDoc(existingSnap.id, existingSnap.data());
    const sanitizedItems = (Array.isArray(items) ? items : []).slice(0, 50).map((it, idx) => ({
      id: sanitizeStr(it.id || `pos-${Date.now()}-${idx}`, 64),
      productId: it.productId ? sanitizeStr(it.productId, 64) : null,
      concept: sanitizeStr(it.concept || it.name || 'Concepto', 200),
      qty: Math.max(1, Number(it.qty) || 1),
      price: Math.max(0, Math.min(10000000, parseFloat(it.price) || 0))
    }));
    const computedTotal = total !== undefined
      ? Math.max(0, Math.min(10000000, parseFloat(total) || 0))
      : sanitizedItems.reduce((sum, i) => sum + i.price * i.qty, 0);

    const nextPos = {
      items: sanitizedItems,
      total: computedTotal,
      paid: paidOverride !== undefined ? Boolean(paidOverride) : Boolean(current.pos?.paid)
    };

    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'tickets', existingSnap.id), {
        pos: nextPos,
        updatedAt: serverTimestamp()
      });
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `tickets/${existingSnap.id}`);
    }

    return {
      ...current,
      pos: nextPos,
      updatedAt: new Date().toISOString()
    };
  },

  async addPosItem(id, concept, price) {
    const ticket = await this.getTicketById(id);
    if (!ticket) return null;
    const items = Array.isArray(ticket.pos?.items) ? [...ticket.pos.items] : [];
    items.push({ id: `pos-${Date.now()}`, concept, price: parseFloat(price) || 0, qty: 1 });
    const total = items.reduce((s, i) => s + (parseFloat(i.price) || 0) * (Number(i.qty) || 1), 0);
    return this.savePos(id, items, total);
  },

  async saveEquipment(id, equipmentData) {
    let existingSnap;
    try {
      existingSnap = await resolveTicketDocRef(id);
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `tickets/${id}`);
    }
    if (!existingSnap || !existingSnap.exists()) return null;

    const current = normalizeTicketDoc(existingSnap.id, existingSnap.data());
    const nextEquipment = normalizeEquipmentData(
      { ...current.equipment, ...equipmentData },
      current.name || ''
    );

    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'tickets', existingSnap.id), {
        equipment: nextEquipment,
        updatedAt: serverTimestamp()
      });
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `tickets/${existingSnap.id}`);
    }

    return {
      ...current,
      equipment: nextEquipment,
      updatedAt: new Date().toISOString()
    };
  },

  async saveDiagnosis(id, diagnosisData, options = {}) {
    let existingSnap;
    try {
      existingSnap = await resolveTicketDocRef(id);
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `tickets/${id}`);
    }
    if (!existingSnap || !existingSnap.exists()) return null;

    const current = normalizeTicketDoc(existingSnap.id, existingSnap.data());
    const nextDiagnosis = normalizeDiagnosisData({
      ...current.diagnosis,
      ...diagnosisData,
      diagnosedAt: diagnosisData?.diagnosedAt || new Date().toISOString(),
      diagnosedBy: diagnosisData?.diagnosedBy || options?.author || current.assignedTo || auth.currentUser?.displayName || 'Técnico Fiberlink'
    });

    const updates = {
      diagnosis: nextDiagnosis,
      updatedAt: serverTimestamp()
    };

    let nextBitacora = current.bitacora;
    if (options?.logToBitacora) {
      const summaryParts = [];
      if (nextDiagnosis.feasibility) summaryParts.push(`[${nextDiagnosis.feasibility}]`);
      if (nextDiagnosis.verifiedFault) summaryParts.push(`Falla: ${nextDiagnosis.verifiedFault}`);
      if (nextDiagnosis.technicalFindings) summaryParts.push(`Diagnóstico: ${nextDiagnosis.technicalFindings}`);
      if (nextDiagnosis.recommendedSolution) summaryParts.push(`Solución: ${nextDiagnosis.recommendedSolution}`);
      if (nextDiagnosis.estimatedCost > 0) summaryParts.push(`Estimado: $${nextDiagnosis.estimatedCost.toFixed(2)}`);
      const noteText = sanitizeStr(summaryParts.join(' · '), 1000);
      if (noteText) {
        nextBitacora = [
          ...current.bitacora,
          {
            id: `b-${Date.now()}`,
            date: new Date().toISOString(),
            author: sanitizeStr(nextDiagnosis.diagnosedBy, 120, 'Técnico Fiberlink'),
            note: noteText
          }
        ].slice(-50);
        updates.bitacora = nextBitacora;
      }
    }

    try {
      const batch = writeBatch(db);
      batch.update(doc(db, 'tickets', existingSnap.id), updates);
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `tickets/${existingSnap.id}`);
    }

    return {
      ...current,
      diagnosis: nextDiagnosis,
      bitacora: nextBitacora,
      updatedAt: new Date().toISOString()
    };
  },

  async deleteTicket(id) {
    let existingSnap;
    try {
      existingSnap = await resolveTicketDocRef(id);
    } catch (err) {
      handleFirestoreError(err, OperationType.GET, `tickets/${id}`);
    }
    if (!existingSnap || !existingSnap.exists()) return true;

    const current = normalizeTicketDoc(existingSnap.id, existingSnap.data());
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'tickets', existingSnap.id));
      batch.delete(doc(db, 'ticket_tracking', current.folio));
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `tickets/${existingSnap.id}`);
    }

    const local = getLocalCache().filter((t) => t.id !== existingSnap.id && t.folio !== current.folio);
    saveLocalCache(local);
    return true;
  },

  async getStats() {
    const list = auth.currentUser ? await this.getTickets() : getLocalCache();
    return {
      total: list.length,
      creacion: list.filter((t) => t.estado === 'creación' || t.estado === 'creacion').length,
      diagnostico: list.filter((t) => t.estado === 'diagnostico').length,
      proceso: list.filter((t) => t.estado === 'proceso').length,
      resuelto: list.filter((t) => t.estado === 'resuelto').length,
      urgente: list.filter((t) => t.priority === 'Urgente' && t.estado !== 'resuelto').length
    };
  }
};
