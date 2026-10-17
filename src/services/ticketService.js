// ==========================================
// FIBERLINK TICKET SERVICE
// Dual Mode: REST API + LocalStorage Resilient Fallback
// ==========================================

const API_BASE = '/api';
const LOCAL_STORAGE_KEY = 'fiberlink_tickets';

function getAuthHeaders() {
  const token = sessionStorage.getItem('fiberlink_token') || '';
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

function getLocalTickets() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
  } catch (e) {
    return [];
  }
}

function saveLocalTickets(tickets) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(tickets));
  } catch (e) {
    console.warn('[TicketService] LocalStorage error:', e);
  }
}

function generateLocalFolio() {
  const tickets = getLocalTickets();
  let max = 1000;
  tickets.forEach(t => {
    if (t.folio) {
      const match = t.folio.match(/FL-(\d+)/);
      if (match) {
        const n = parseInt(match[1], 10);
        if (n > max) max = n;
      }
    }
  });
  return `FL-${max + 1}`;
}

export const ticketService = {
  // 1. Create Ticket
  async createTicket(ticketData) {
    try {
      const response = await fetch(`${API_BASE}/tickets`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(ticketData)
      });

      if (response.ok) {
        const result = await response.json();
        if (result && result.ticket) {
          const local = getLocalTickets();
          const filtered = local.filter(t => t.folio !== result.ticket.folio);
          filtered.unshift(result.ticket);
          saveLocalTickets(filtered);
          return result.ticket;
        }
      }
    } catch (err) {
      console.info('[TicketService] Servidor API no disponible, usando fallback local:', err.message);
    }

    const local = getLocalTickets();
    const newTicket = {
      id: Date.now().toString(),
      folio: generateLocalFolio(),
      estado: 'creación',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      name: ticketData.name || 'Cliente sin nombre',
      phone: ticketData.phone || '',
      email: ticketData.email || '',
      company: ticketData.company || '',
      address: ticketData.address || 'Soporte Remoto',
      service: ticketData.service || 'Soporte técnico',
      modality: ticketData.modality || 'En Sitio / Domicilio',
      priority: ticketData.priority || 'Normal',
      assignedTo: ticketData.assignedTo || 'Sin asignar',
      description: ticketData.description || '',
      source: ticketData.source || 'Portal Web',
      bitacora: [
        {
          id: `b-${Date.now()}`,
          date: new Date().toISOString(),
          author: 'Sistema',
          note: 'Solicitud registrada mediante el asistente técnico interactivo.'
        }
      ],
      pos: {
        items: [],
        total: 0,
        paid: false
      }
    };

    local.unshift(newTicket);
    saveLocalTickets(local);
    return newTicket;
  },

  // 2. Get All Tickets
  async getTickets(filters = {}) {
    try {
      const queryParams = new URLSearchParams();
      if (filters.estado) queryParams.set('estado', filters.estado);
      if (filters.priority) queryParams.set('priority', filters.priority);
      if (filters.assignedTo) queryParams.set('assignedTo', filters.assignedTo);
      if (filters.q) queryParams.set('q', filters.q);

      const url = `${API_BASE}/tickets${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && !filters.estado && !filters.priority && !filters.q) {
          saveLocalTickets(data);
        }
        return data;
      }
    } catch (e) {}

    let list = getLocalTickets();
    if (filters.estado) list = list.filter(t => t.estado === filters.estado);
    if (filters.priority) list = list.filter(t => t.priority === filters.priority);
    if (filters.assignedTo) list = list.filter(t => t.assignedTo === filters.assignedTo);
    if (filters.q) {
      const q = filters.q.toLowerCase();
      list = list.filter(t =>
        (t.folio && t.folio.toLowerCase().includes(q)) ||
        (t.name && t.name.toLowerCase().includes(q)) ||
        (t.company && t.company.toLowerCase().includes(q)) ||
        (t.service && t.service.toLowerCase().includes(q)) ||
        (t.phone && t.phone.includes(q))
      );
    }
    return list;
  },

  // 3. Get Single Ticket
  async getTicketById(id) {
    try {
      const res = await fetch(`${API_BASE}/tickets/${id}`, { headers: getAuthHeaders() });
      if (res.ok) return await res.json();
    } catch (e) {}

    const local = getLocalTickets();
    return local.find(t => t.id === id || t.folio === id) || null;
  },

  // 4. Update Ticket (status, priority, assignedTo, fields)
  async updateTicket(id, payload) {
    try {
      const res = await fetch(`${API_BASE}/tickets/${id}`, {
        method: 'PATCH',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const data = await res.json();
        return data.ticket;
      }
    } catch (e) {}

    const local = getLocalTickets();
    const idx = local.findIndex(t => t.id === id || t.folio === id);
    if (idx !== -1) {
      local[idx] = { ...local[idx], ...payload, updatedAt: new Date().toISOString() };
      saveLocalTickets(local);
      return local[idx];
    }
    return null;
  },

  async updateStatus(id, newStatus, author) {
    return this.updateTicket(id, { estado: newStatus, author });
  },

  // 5. Add Bitacora Note
  async addBitacoraNote(id, note, author = 'Técnico Fiberlink') {
    try {
      const res = await fetch(`${API_BASE}/tickets/${id}/bitacora`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ note, author })
      });
      if (res.ok) {
        const data = await res.json();
        return data.ticket;
      }
    } catch (e) {}

    const local = getLocalTickets();
    const idx = local.findIndex(t => t.id === id || t.folio === id);
    if (idx !== -1) {
      const entry = {
        id: `b-${Date.now()}`,
        date: new Date().toISOString(),
        author,
        note: note.trim()
      };
      if (!local[idx].bitacora) local[idx].bitacora = [];
      local[idx].bitacora.push(entry);
      local[idx].updatedAt = new Date().toISOString();
      saveLocalTickets(local);
      return local[idx];
    }
    return null;
  },

  async addBitacoraEntry(id, note, author) {
    return this.addBitacoraNote(id, note, author);
  },

  // 6. Save POS items array
  async savePos(id, items, total) {
    try {
      const res = await fetch(`${API_BASE}/tickets/${id}/pos`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ items, total })
      });
      if (res.ok) {
        const data = await res.json();
        return data.ticket;
      }
    } catch (e) {}

    const local = getLocalTickets();
    const idx = local.findIndex(t => t.id === id || t.folio === id);
    if (idx !== -1) {
      local[idx].pos = { items, total };
      local[idx].updatedAt = new Date().toISOString();
      saveLocalTickets(local);
      return local[idx];
    }
    return null;
  },

  async addPosItem(id, concept, price) {
    const ticket = await this.getTicketById(id);
    if (!ticket) return null;
    const items = Array.isArray(ticket.pos?.items) ? [...ticket.pos.items] : [];
    items.push({ id: `pos-${Date.now()}`, concept, price: parseFloat(price) || 0, qty: 1 });
    const total = items.reduce((s, i) => s + (parseFloat(i.price) || 0) * (Number(i.qty) || 1), 0);
    return this.savePos(id, items, total);
  },

  async deleteTicket(id) {
    try {
      const res = await fetch(`${API_BASE}/tickets/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      if (res.ok) return true;
    } catch (e) {}
    const local = getLocalTickets().filter(t => t.id !== id && t.folio !== id);
    saveLocalTickets(local);
    return true;
  },

  async getStats() {
    try {
      const res = await fetch(`${API_BASE}/tickets/stats`, { headers: getAuthHeaders() });
      if (res.ok) return await res.json();
    } catch (e) {}

    const list = getLocalTickets();
    return {
      total: list.length,
      creacion: list.filter(t => t.estado === 'creación' || t.estado === 'creacion').length,
      diagnostico: list.filter(t => t.estado === 'diagnostico').length,
      proceso: list.filter(t => t.estado === 'proceso').length,
      resuelto: list.filter(t => t.estado === 'resuelto').length,
      urgente: list.filter(t => t.priority === 'Urgente' && t.estado !== 'resuelto').length
    };
  }
};
