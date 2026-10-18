// ==========================================
// CHAT LEADS & PROSPECTS CONTROLLER
// Gestión de leads generados desde el chat web y WhatsApp
// ==========================================

import { readCollection, writeCollection, logActivity } from '../db/jsonStore.js';

export function handleListChatLeads(searchParams = new URLSearchParams()) {
  try {
    let leads = readCollection('chatLeads');
    if (!Array.isArray(leads)) leads = [];

    const status = searchParams.get('status');
    const q = searchParams.get('q');

    if (status) {
      leads = leads.filter(l => l.status === status);
    }

    if (q) {
      const query = q.toLowerCase();
      leads = leads.filter(l =>
        (l.name && l.name.toLowerCase().includes(query)) ||
        (l.phone && l.phone.includes(query)) ||
        (l.message && l.message.toLowerCase().includes(query))
      );
    }

    leads.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));

    return {
      status: 200,
      data: leads
    };
  } catch (err) {
    console.error('[chatController] Error listando leads:', err.message);
    return { status: 500, data: { error: 'Error al listar prospectos de chat' } };
  }
}

export function handleCreateChatLead(body = {}) {
  try {
    const name = (body.name || '').trim();
    const rawPhone = (body.phone || '').toString();
    const cleanPhone = rawPhone.replace(/\D/g, '');
    const message = (body.message || '').trim();

    if (!name || name.length < 2) {
      return { status: 400, data: { error: 'El nombre es obligatorio y debe tener al menos 2 caracteres.' } };
    }

    if (!cleanPhone || cleanPhone.length < 10) {
      return { status: 400, data: { error: 'Por favor ingresa un número de WhatsApp válido (10 dígitos).' } };
    }

    let leads = readCollection('chatLeads');
    if (!Array.isArray(leads)) leads = [];

    const now = new Date().toISOString();
    const newLead = {
      id: `lead-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name,
      phone: cleanPhone.slice(-10),
      message: message || 'Solicitud de contacto e información general',
      status: 'nuevo',
      createdAt: now,
      updatedAt: now,
      notes: [
        {
          id: `n-${Date.now()}`,
          text: 'Prospecto recibido desde el botón "Chatea con nosotros" del portal web.',
          createdAt: now,
          user: 'Portal Web'
        }
      ]
    };

    leads.unshift(newLead);
    writeCollection('chatLeads', leads);

    logActivity({
      user: name,
      role: 'prospecto',
      module: 'chat',
      action: `Nuevo prospecto de chat web: ${name} (${newLead.phone})`
    });

    return { status: 201, data: newLead };
  } catch (err) {
    console.error('[chatController] Error creando lead:', err.message);
    return { status: 500, data: { error: 'Error al registrar prospecto' } };
  }
}

export function handleUpdateChatLead(id, body = {}, currentUser = null) {
  try {
    let leads = readCollection('chatLeads');
    if (!Array.isArray(leads)) leads = [];

    const idx = leads.findIndex(l => l.id === id);
    if (idx === -1) {
      return { status: 404, data: { error: 'Prospecto de chat no encontrado' } };
    }

    const lead = leads[idx];
    const prevStatus = lead.status;
    const now = new Date().toISOString();

    if (body.status && ['nuevo', 'en_seguimiento', 'atendido', 'convertido_ticket'].includes(body.status)) {
      lead.status = body.status;
    }

    if (body.name) lead.name = body.name.trim();
    if (body.phone) {
      const clean = body.phone.toString().replace(/\D/g, '');
      if (clean.length >= 10) lead.phone = clean.slice(-10);
    }
    if (body.message !== undefined) lead.message = body.message.trim();

    if (body.newNote && typeof body.newNote === 'string' && body.newNote.trim()) {
      if (!Array.isArray(lead.notes)) lead.notes = [];
      lead.notes.push({
        id: `n-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        text: body.newNote.trim(),
        createdAt: now,
        user: currentUser?.name || 'Administrador'
      });
    }

    if (body.ticketFolio) {
      lead.ticketFolio = body.ticketFolio;
      lead.status = 'convertido_ticket';
    }

    lead.updatedAt = now;
    leads[idx] = lead;
    writeCollection('chatLeads', leads);

    if (prevStatus !== lead.status) {
      logActivity({
        user: currentUser?.name || 'Sistema',
        role: currentUser?.role || 'admin',
        module: 'chat',
        action: `Prospecto ${lead.name} cambió de estado a "${lead.status}"`
      });
    }

    return { status: 200, data: lead };
  } catch (err) {
    console.error('[chatController] Error actualizando lead:', err.message);
    return { status: 500, data: { error: 'Error al actualizar prospecto' } };
  }
}

export function handleDeleteChatLead(id, currentUser = null) {
  try {
    let leads = readCollection('chatLeads');
    if (!Array.isArray(leads)) leads = [];

    const lead = leads.find(l => l.id === id);
    if (!lead) {
      return { status: 404, data: { error: 'Prospecto no encontrado' } };
    }

    leads = leads.filter(l => l.id !== id);
    writeCollection('chatLeads', leads);

    logActivity({
      user: currentUser?.name || 'Sistema',
      role: currentUser?.role || 'admin',
      module: 'chat',
      action: `Prospecto de chat eliminado: ${lead.name} (${lead.phone})`
    });

    return { status: 200, data: { success: true } };
  } catch (err) {
    console.error('[chatController] Error eliminando lead:', err.message);
    return { status: 500, data: { error: 'Error al eliminar prospecto' } };
  }
}
