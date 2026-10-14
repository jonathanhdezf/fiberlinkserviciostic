// ==========================================
// FIBERLINK TICKET SERVICE
// Dual Mode: REST API + LocalStorage Resilient Fallback
// ==========================================

const API_BASE = '/api';
const LOCAL_STORAGE_KEY = 'fiberlink_tickets';

// Helper: Read local cache
function getLocalTickets() {
  try {
    return JSON.parse(localStorage.getItem(LOCAL_STORAGE_KEY) || '[]');
  } catch (e) {
    return [];
  }
}

// Helper: Save local cache
function saveLocalTickets(tickets) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(tickets));
  } catch (e) {
    console.warn('[TicketService] LocalStorage error:', e);
  }
}

// Helper: Next local folio FL-XXXX
function generateLocalFolio() {
  const tickets = getLocalTickets();
  let max = 1000;
  tickets.forEach(t => {
    if (t.folio) {
      const match = t.folio.match(/FL-(\d+)/);
      if (match) {
        const n = parseInt(match[1]);
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ticketData)
      });

      if (response.ok) {
        const result = await response.json();
        if (result && result.ticket) {
          console.log('[TicketService] ✓ Ticket creado en backend con éxito:', result.ticket.folio);
          // Sync into local cache as well
          const local = getLocalTickets();
          // Avoid duplicate folio in local
          const filtered = local.filter(t => t.folio !== result.ticket.folio);
          filtered.unshift(result.ticket);
          saveLocalTickets(filtered);
          return result.ticket;
        }
      } else {
        console.warn('[TicketService] Respuesta no exitosa del backend:', response.status);
      }
    } catch (err) {
      console.info('[TicketService] Servidor API no disponible, usando fallback local persistente:', err.message);
    }

    // Fallback: LocalStorage
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
        total: 0
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
      if (filters.q) queryParams.set('q', filters.q);

      const url = `${API_BASE}/tickets${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        // Update local cache
        if (Array.isArray(data) && data.length > 0) {
          saveLocalTickets(data);
        }
        return data;
      }
    } catch (e) {
      // Fallback below
    }

    // Fallback filter locally
    let list = getLocalTickets();
    if (filters.estado) list = list.filter(t => t.estado === filters.estado);
    if (filters.priority) list = list.filter(t => t.priority === filters.priority);
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
      const res = await fetch(`${API_BASE}/tickets/${id}`);
      if (res.ok) return await res.json();
    } catch (e) {}

    const local = getLocalTickets();
    return local.find(t => t.id === id || t.folio === id) || null;
  },

  // 4. Update Status
  async updateStatus(id, newStatus) {
    try {
      const res = await fetch(`${API_BASE}/tickets/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estado: newStatus })
      });
      if (res.ok) {
        const data = await res.json();
        return data.ticket;
      }
    } catch (e) {}

    // Fallback
    const local = getLocalTickets();
    const idx = local.findIndex(t => t.id === id || t.folio === id);
    if (idx !== -1) {
      const prev = local[idx].estado;
      local[idx].estado = newStatus;
      local[idx].updatedAt = new Date().toISOString();
      if (!local[idx].bitacora) local[idx].bitacora = [];
      local[idx].bitacora.push({
        id: `b-${Date.now()}`,
        date: new Date().toISOString(),
        author: 'Mesa de Control',
        note: `Estado modificado: "${prev}" ➔ "${newStatus}"`
      });
      saveLocalTickets(local);
      return local[idx];
    }
    return null;
  },

  // 5. Add Bitacora Note
  async addBitacoraNote(id, note, author = 'Técnico Fiberlink') {
    try {
      const res = await fetch(`${API_BASE}/tickets/${id}/bitacora`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ note, author })
      });
      if (res.ok) {
        const data = await res.json();
        return data.ticket;
      }
    } catch (e) {}

    // Fallback
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

  // 6. Add POS item
  async addPosItem(id, concept, price) {
    try {
      const res = await fetch(`${API_BASE}/tickets/${id}/pos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ concept, price })
      });
      if (res.ok) {
        const data = await res.json();
        return data.ticket;
      }
    } catch (e) {}

    // Fallback
    const local = getLocalTickets();
    const idx = local.findIndex(t => t.id === id || t.folio === id);
    if (idx !== -1) {
      if (!local[idx].pos) local[idx].pos = { items: [], total: 0 };
      const numPrice = parseFloat(price) || 0;
      local[idx].pos.items.push({
        id: `pos-${Date.now()}`,
        concept: concept.trim(),
        price: numPrice
      });
      local[idx].pos.total = local[idx].pos.items.reduce((s, i) => s + i.price, 0);
      local[idx].updatedAt = new Date().toISOString();
      saveLocalTickets(local);
      return local[idx];
    }
    return null;
  },

  // 7. Stats
  async getStats() {
    try {
      const res = await fetch(`${API_BASE}/tickets/stats`);
      if (res.ok) return await res.json();
    } catch (e) {}

    const list = getLocalTickets();
    return {
      total: list.length,
      creacion: list.filter(t => t.estado === 'creación').length,
      diagnostico: list.filter(t => t.estado === 'diagnostico').length,
      proceso: list.filter(t => t.estado === 'proceso').length,
      resuelto: list.filter(t => t.estado === 'resuelto').length,
      urgente: list.filter(t => t.priority === 'Urgente' && t.estado !== 'resuelto').length
    };
  }
};
