// ==========================================
// WORKSHOP CONTROLLER (Taller y Laboratorio Técnico)
// ==========================================

import { readCollection, writeCollection, generateNextFolio, logActivity } from '../db/jsonStore.js';
import { WORKSHOP_STATES } from '../config/constants.js';

export function handleListWorkshop(searchParams) {
  let orders = readCollection('workshop');

  const estado = searchParams.get('estado');
  const assignedTech = searchParams.get('assignedTech');
  const q = searchParams.get('q');

  if (estado && estado !== 'all') {
    orders = orders.filter(o => o.estado === estado);
  }
  if (assignedTech && assignedTech !== 'all') {
    orders = orders.filter(o => (o.assignedTech || '') === assignedTech);
  }
  if (q) {
    const query = q.toLowerCase();
    orders = orders.filter(o =>
      (o.folio && o.folio.toLowerCase().includes(query)) ||
      (o.clientName && o.clientName.toLowerCase().includes(query)) ||
      (o.clientPhone && o.clientPhone.includes(query)) ||
      (o.deviceType && o.deviceType.toLowerCase().includes(query)) ||
      (o.brand && o.brand.toLowerCase().includes(query)) ||
      (o.model && o.model.toLowerCase().includes(query)) ||
      (o.serialNumber && o.serialNumber.toLowerCase().includes(query))
    );
  }

  orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return { status: 200, data: orders };
}

export function handleGetWorkshopOrder(id) {
  const orders = readCollection('workshop');
  const order = orders.find(o => o.id === id || o.folio === id);
  if (!order) {
    return { status: 404, data: { error: 'Orden de taller no encontrada' } };
  }
  return { status: 200, data: order };
}

export function handleCreateWorkshopOrder(body, currentUser) {
  const orders = readCollection('workshop');
  const newFolio = generateNextFolio('workshop', 'OS', 1000);
  const author = currentUser?.name || body.author || 'Recepción Taller';

  const advancePayment = parseFloat(body.advancePayment) || 0;
  const laborCost = parseFloat(body.laborCost) || 0;

  const newOrder = {
    id: `ws-${Date.now()}`,
    folio: newFolio,
    estado: body.estado || 'recepcion',
    clientName: (body.clientName || 'Cliente General').trim(),
    clientPhone: (body.clientPhone || '').trim(),
    clientEmail: (body.clientEmail || '').trim(),
    deviceType: body.deviceType || 'Laptop',
    brand: (body.brand || '').trim(),
    model: (body.model || '').trim(),
    serialNumber: (body.serialNumber || 'S/N').trim(),
    accessories: (body.accessories || 'Sin accesorios').trim(),
    reportedFault: (body.reportedFault || '').trim(),
    technicalDiagnosis: (body.technicalDiagnosis || 'Pendiente de revisión en laboratorio').trim(),
    assignedTech: body.assignedTech || 'Ing. Alejandro Luna',
    priority: body.priority || 'Normal',
    parts: [],
    laborCost,
    advancePayment,
    total: laborCost,
    paid: false,
    promisedDate: body.promisedDate || new Date(Date.now() + 3600000 * 48).toISOString(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    bitacora: [
      {
        id: `wb-${Date.now()}`,
        date: new Date().toISOString(),
        author,
        note: `Ingreso de equipo a taller: ${body.deviceType || 'Equipo'} ${body.brand || ''} ${body.model || ''}.${advancePayment > 0 ? ' Anticipo recibido: $' + advancePayment.toFixed(2) : ''}`
      }
    ]
  };

  orders.unshift(newOrder);
  writeCollection('workshop', orders);

  logActivity({
    user: author,
    role: currentUser?.role || 'recepcion',
    module: 'workshop',
    action: `Registró orden de taller ${newFolio} (${newOrder.deviceType} ${newOrder.brand} - ${newOrder.clientName})`
  });

  return {
    status: 201,
    data: {
      success: true,
      order: newOrder
    }
  };
}

function recalculateOrderTotal(order) {
  const partsTotal = (order.parts || []).reduce(
    (sum, p) => sum + (parseFloat(p.price) || 0) * (Number(p.qty) || 1),
    0
  );
  const labor = parseFloat(order.laborCost) || 0;
  order.total = partsTotal + labor;
}

export function handleUpdateWorkshopOrder(id, body, currentUser) {
  const orders = readCollection('workshop');
  const idx = orders.findIndex(o => o.id === id || o.folio === id);
  if (idx === -1) {
    return { status: 404, data: { error: 'Orden de taller no encontrada' } };
  }

  const author = currentUser?.name || body.author || 'Técnico Taller';
  const order = orders[idx];
  const logNotes = [];

  if (body.estado && WORKSHOP_STATES.includes(body.estado) && body.estado !== order.estado) {
    const prev = order.estado;
    order.estado = body.estado;
    logNotes.push(`Estado de taller actualizado: "${prev}" ➔ "${body.estado}".`);
    if (body.estado === 'entregado') {
      order.deliveredAt = new Date().toISOString();
    }
  }

  if (body.assignedTech !== undefined && body.assignedTech !== order.assignedTech) {
    order.assignedTech = body.assignedTech;
    logNotes.push(`Técnico asignado: ${body.assignedTech}.`);
  }

  if (body.technicalDiagnosis !== undefined && body.technicalDiagnosis !== order.technicalDiagnosis) {
    order.technicalDiagnosis = body.technicalDiagnosis.trim();
    logNotes.push(`Diagnóstico técnico actualizado.`);
  }

  if (body.reportedFault !== undefined) order.reportedFault = body.reportedFault.trim();
  if (body.accessories !== undefined) order.accessories = body.accessories.trim();
  if (body.priority !== undefined) order.priority = body.priority;
  if (body.clientName !== undefined) order.clientName = body.clientName.trim();
  if (body.clientPhone !== undefined) order.clientPhone = body.clientPhone.trim();
  if (body.laborCost !== undefined) order.laborCost = parseFloat(body.laborCost) || 0;
  if (body.advancePayment !== undefined) order.advancePayment = parseFloat(body.advancePayment) || 0;
  if (body.paid !== undefined) order.paid = Boolean(body.paid);
  if (Array.isArray(body.parts)) {
    order.parts = body.parts;
  }

  recalculateOrderTotal(order);

  order.bitacora = order.bitacora || [];
  logNotes.forEach((n, i) => {
    order.bitacora.push({
      id: `wb-${Date.now()}-${i}`,
      date: new Date().toISOString(),
      author,
      note: n
    });
  });

  order.updatedAt = new Date().toISOString();
  writeCollection('workshop', orders);

  if (logNotes.length > 0) {
    logActivity({
      user: author,
      role: currentUser?.role || 'tecnico',
      module: 'workshop',
      action: `Orden ${order.folio}: ${logNotes.join(' ')}`
    });
  }

  return { status: 200, data: { success: true, order } };
}

export function handleAddWorkshopBitacora(id, body, currentUser) {
  const orders = readCollection('workshop');
  const idx = orders.findIndex(o => o.id === id || o.folio === id);
  if (idx === -1) {
    return { status: 404, data: { error: 'Orden de taller no encontrada' } };
  }

  const noteText = (body.note || '').trim();
  if (!noteText) {
    return { status: 400, data: { error: 'La nota de taller no puede estar vacía' } };
  }

  const author = currentUser?.name || body.author || 'Técnico de Taller';
  const entry = {
    id: `wb-${Date.now()}`,
    date: new Date().toISOString(),
    author,
    note: noteText
  };

  orders[idx].bitacora = orders[idx].bitacora || [];
  orders[idx].bitacora.push(entry);
  orders[idx].updatedAt = new Date().toISOString();
  writeCollection('workshop', orders);

  return { status: 201, data: { success: true, order: orders[idx], note: entry } };
}

export function handleUpdateWorkshopParts(id, body, currentUser) {
  const orders = readCollection('workshop');
  const idx = orders.findIndex(o => o.id === id || o.folio === id);
  if (idx === -1) {
    return { status: 404, data: { error: 'Orden de taller no encontrada' } };
  }

  const order = orders[idx];
  order.parts = order.parts || [];

  if (Array.isArray(body.parts)) {
    order.parts = body.parts;
  } else if (body.concept) {
    order.parts.push({
      id: `wp-${Date.now()}`,
      productId: body.productId || null,
      concept: body.concept.trim(),
      qty: Math.max(1, Number(body.qty) || 1),
      price: parseFloat(body.price) || 0
    });
  }

  if (body.laborCost !== undefined) {
    order.laborCost = parseFloat(body.laborCost) || 0;
  }
  if (body.advancePayment !== undefined) {
    order.advancePayment = parseFloat(body.advancePayment) || 0;
  }

  recalculateOrderTotal(order);
  order.updatedAt = new Date().toISOString();
  writeCollection('workshop', orders);

  return { status: 200, data: { success: true, order } };
}

export function handleDeleteWorkshopOrder(id, currentUser) {
  let orders = readCollection('workshop');
  const target = orders.find(o => o.id === id || o.folio === id);
  if (!target) {
    return { status: 404, data: { error: 'Orden de taller no encontrada' } };
  }

  orders = orders.filter(o => o.id !== id && o.folio !== id);
  writeCollection('workshop', orders);

  logActivity({
    user: currentUser?.name || 'Admin',
    role: currentUser?.role || 'admin',
    module: 'workshop',
    action: `Eliminó orden de taller ${target.folio} (${target.clientName})`
  });

  return { status: 200, data: { success: true } };
}
