// ==========================================
// TICKETS CONTROLLER (Soporte & Servicios)
// ==========================================

import { readCollection, writeCollection, generateNextFolio, logActivity } from '../db/jsonStore.js';
import { TICKET_STATES } from '../config/constants.js';

export function handleTicketStats() {
  const tickets = readCollection('tickets');
  const stats = {
    total: tickets.length,
    creacion: tickets.filter(t => t.estado === 'creación' || t.estado === 'creacion').length,
    diagnostico: tickets.filter(t => t.estado === 'diagnostico').length,
    proceso: tickets.filter(t => t.estado === 'proceso').length,
    resuelto: tickets.filter(t => t.estado === 'resuelto').length,
    urgente: tickets.filter(t => t.priority === 'Urgente' && t.estado !== 'resuelto').length
  };
  return { status: 200, data: stats };
}

export function handleListTickets(searchParams) {
  let tickets = readCollection('tickets');

  const estado = searchParams.get('estado');
  const priority = searchParams.get('priority');
  const assignedTo = searchParams.get('assignedTo');
  const q = searchParams.get('q');

  if (estado) {
    tickets = tickets.filter(t => t.estado === estado);
  }
  if (priority) {
    tickets = tickets.filter(t => t.priority === priority);
  }
  if (assignedTo) {
    tickets = tickets.filter(t => (t.assignedTo || '') === assignedTo);
  }
  if (q) {
    const query = q.toLowerCase();
    tickets = tickets.filter(t =>
      (t.folio && t.folio.toLowerCase().includes(query)) ||
      (t.name && t.name.toLowerCase().includes(query)) ||
      (t.company && t.company.toLowerCase().includes(query)) ||
      (t.service && t.service.toLowerCase().includes(query)) ||
      (t.phone && t.phone.includes(query)) ||
      (t.description && t.description.toLowerCase().includes(query))
    );
  }

  tickets.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return { status: 200, data: tickets };
}

export function handleGetTicket(id) {
  const tickets = readCollection('tickets');
  const ticket = tickets.find(t => t.id === id || t.folio === id);
  if (!ticket) {
    return { status: 404, data: { error: 'Ticket no encontrado' } };
  }
  return { status: 200, data: ticket };
}

export function handleCreateTicket(body, currentUser) {
  const tickets = readCollection('tickets');
  const newFolio = generateNextFolio('tickets', 'FL', 1000);

  const authorName = currentUser?.name || body.author || 'Portal Web';
  const newTicket = {
    id: Date.now().toString(),
    folio: newFolio,
    estado: 'creación',
    name: body.name || 'Cliente sin nombre',
    phone: body.phone || '',
    email: body.email || '',
    company: body.company || '',
    address: body.address || 'Soporte Remoto',
    service: body.service || 'Soporte técnico',
    modality: body.modality || 'En Sitio / Domicilio',
    priority: body.priority || 'Normal',
    assignedTo: body.assignedTo || 'Sin asignar',
    description: body.description || '',
    source: body.source || (currentUser ? 'Mesa de Control' : 'Portal Web'),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    bitacora: [
      {
        id: `b-${Date.now()}`,
        date: new Date().toISOString(),
        author: authorName,
        note: `Ticket registrado (${body.service || 'Soporte técnico'}).`
      }
    ],
    pos: {
      items: [],
      total: 0,
      paid: false
    }
  };

  tickets.unshift(newTicket);
  writeCollection('tickets', tickets);

  logActivity({
    user: authorName,
    role: currentUser?.role || 'public',
    module: 'tickets',
    action: `Creó ticket ${newFolio} para ${newTicket.name} (${newTicket.service})`
  });

  return {
    status: 201,
    data: {
      success: true,
      message: 'Ticket creado exitosamente',
      ticket: newTicket
    }
  };
}

export function handleUpdateTicket(id, body, currentUser) {
  const tickets = readCollection('tickets');
  const index = tickets.findIndex(t => t.id === id || t.folio === id);
  if (index === -1) {
    return { status: 404, data: { error: 'Ticket no encontrado' } };
  }

  const authorName = currentUser?.name || body.author || 'Técnico (Admin)';
  const notesToAdd = [];

  if (body.estado && TICKET_STATES.includes(body.estado) && body.estado !== tickets[index].estado) {
    const prevStatus = tickets[index].estado;
    tickets[index].estado = body.estado;
    notesToAdd.push(`Estado cambiado de "${prevStatus}" a "${body.estado}".`);
  }

  if (body.assignedTo !== undefined && body.assignedTo !== tickets[index].assignedTo) {
    tickets[index].assignedTo = body.assignedTo;
    notesToAdd.push(`Técnico asignado: ${body.assignedTo}`);
  }

  if (body.priority && body.priority !== tickets[index].priority) {
    tickets[index].priority = body.priority;
    notesToAdd.push(`Prioridad actualizada a: ${body.priority}`);
  }

  if (body.description !== undefined) tickets[index].description = body.description;
  if (body.address !== undefined) tickets[index].address = body.address;
  if (body.phone !== undefined) tickets[index].phone = body.phone;
  if (body.name !== undefined) tickets[index].name = body.name;
  if (body.company !== undefined) tickets[index].company = body.company;
  if (body.service !== undefined) tickets[index].service = body.service;
  if (body.modality !== undefined) tickets[index].modality = body.modality;

  tickets[index].bitacora = tickets[index].bitacora || [];
  notesToAdd.forEach((n, idx) => {
    tickets[index].bitacora.push({
      id: `b-${Date.now()}-${idx}`,
      date: new Date().toISOString(),
      author: authorName,
      note: n
    });
  });

  tickets[index].updatedAt = new Date().toISOString();
  writeCollection('tickets', tickets);

  if (notesToAdd.length > 0) {
    logActivity({
      user: authorName,
      role: currentUser?.role || 'admin',
      module: 'tickets',
      action: `Ticket ${tickets[index].folio}: ${notesToAdd.join(' ')}`
    });
  }

  return {
    status: 200,
    data: {
      success: true,
      message: 'Ticket actualizado',
      ticket: tickets[index]
    }
  };
}

export function handleAddTicketBitacora(id, body, currentUser) {
  const tickets = readCollection('tickets');
  const index = tickets.findIndex(t => t.id === id || t.folio === id);
  if (index === -1) {
    return { status: 404, data: { error: 'Ticket no encontrado' } };
  }

  const text = (body.note || body.text || '').trim();
  if (!text) {
    return { status: 400, data: { error: 'La nota no puede estar vacía' } };
  }

  const author = currentUser?.name || body.author || 'Técnico (Admin)';
  const newNote = {
    id: `b-${Date.now()}`,
    date: new Date().toISOString(),
    author,
    note: text
  };

  tickets[index].bitacora = tickets[index].bitacora || [];
  tickets[index].bitacora.push(newNote);
  tickets[index].updatedAt = new Date().toISOString();
  writeCollection('tickets', tickets);

  return {
    status: 201,
    data: {
      success: true,
      bitacora: tickets[index].bitacora,
      note: newNote,
      ticket: tickets[index]
    }
  };
}

export function handleUpdateTicketPos(id, body, currentUser) {
  const tickets = readCollection('tickets');
  const index = tickets.findIndex(t => t.id === id || t.folio === id);
  if (index === -1) {
    return { status: 404, data: { error: 'Ticket no encontrado' } };
  }

  const currentPos = tickets[index].pos || { items: [], total: 0, paid: false };

  // Support both full items array replacement AND single { concept, price } addition
  let items = Array.isArray(currentPos.items) ? [...currentPos.items] : [];
  if (Array.isArray(body.items)) {
    items = body.items.map((it, idx) => ({
      id: it.id || `pos-${Date.now()}-${idx}`,
      productId: it.productId || null,
      concept: it.concept || it.name || 'Concepto',
      qty: Number(it.qty) || 1,
      price: parseFloat(it.price) || 0
    }));
  } else if (body.concept) {
    items.push({
      id: `pos-${Date.now()}`,
      productId: body.productId || null,
      concept: body.concept.trim(),
      qty: Number(body.qty) || 1,
      price: parseFloat(body.price) || 0
    });
  }

  const total = items.reduce((sum, it) => sum + (parseFloat(it.price) || 0) * (Number(it.qty) || 1), 0);

  tickets[index].pos = {
    items,
    total,
    paid: body.paid !== undefined ? Boolean(body.paid) : Boolean(currentPos.paid)
  };
  tickets[index].updatedAt = new Date().toISOString();
  writeCollection('tickets', tickets);

  return {
    status: 200,
    data: {
      success: true,
      pos: tickets[index].pos,
      ticket: tickets[index]
    }
  };
}

export function handleDeleteTicket(id, currentUser) {
  let tickets = readCollection('tickets');
  const target = tickets.find(t => t.id === id || t.folio === id);
  if (!target) {
    return { status: 404, data: { error: 'Ticket no encontrado' } };
  }

  tickets = tickets.filter(t => t.id !== id && t.folio !== id);
  writeCollection('tickets', tickets);

  logActivity({
    user: currentUser?.name || 'Admin',
    role: currentUser?.role || 'admin',
    module: 'tickets',
    action: `Eliminó ticket ${target.folio} (${target.name})`
  });

  return { status: 200, data: { success: true, message: 'Ticket eliminado' } };
}
