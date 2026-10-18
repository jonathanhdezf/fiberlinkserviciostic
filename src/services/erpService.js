// ==========================================
// FIBERLINK ERP SERVICE (Admin Unified Client)
// Connects to /api/* endpoints for Auth, Roles, Store, POS, Workshop, Reports
// ==========================================

const API_BASE = '/api';

function getAuthHeaders() {
  const token = sessionStorage.getItem('fiberlink_token') || '';
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return headers;
}

async function apiRequest(path, options = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...(options.headers || {})
    }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Error HTTP ${res.status}`);
  }
  return data;
}

export const erpService = {
  // ---- AUTH & USERS ----
  async login(username, password) {
    return apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username, password })
    });
  },
  async getMe() {
    return apiRequest('/auth/me');
  },
  async getUsers() {
    return apiRequest('/users');
  },
  async createUser(payload) {
    return apiRequest('/users', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },
  async updateUser(id, payload) {
    return apiRequest(`/users/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
  },
  async deleteUser(id) {
    return apiRequest(`/users/${id}`, {
      method: 'DELETE'
    });
  },

  // ---- STORE & INVENTORY ----
  async getProducts(params = {}) {
    const q = new URLSearchParams();
    if (params.category) q.set('category', params.category);
    if (params.q) q.set('q', params.q);
    if (params.lowStock) q.set('lowStock', 'true');
    if (params.public) q.set('public', 'true');
    return apiRequest(`/products${q.toString() ? '?' + q.toString() : ''}`);
  },
  async createProduct(payload) {
    return apiRequest('/products', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },
  async updateProduct(id, payload) {
    return apiRequest(`/products/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
  },
  async adjustStock(id, deltaOrPayload, reason) {
    const body = typeof deltaOrPayload === 'object' && deltaOrPayload !== null
      ? deltaOrPayload
      : { delta: deltaOrPayload, reason };
    return apiRequest(`/products/${id}/stock`, {
      method: 'POST',
      body: JSON.stringify(body)
    });
  },
  async getInventoryMovements(params = {}) {
    const q = new URLSearchParams();
    if (params.productId) q.set('productId', params.productId);
    if (params.sku) q.set('sku', params.sku);
    if (params.type) q.set('type', params.type);
    if (params.q) q.set('q', params.q);
    return apiRequest(`/inventory/movements${q.toString() ? '?' + q.toString() : ''}`);
  },
  async getProductKardex(id) {
    return apiRequest(`/inventory/kardex/${id}`);
  },
  async deleteProduct(id) {
    return apiRequest(`/products/${id}`, {
      method: 'DELETE'
    });
  },

  // ---- POINT OF SALE (POS) ----
  async getSales(params = {}) {
    const q = new URLSearchParams();
    if (params.paymentMethod) q.set('paymentMethod', params.paymentMethod);
    if (params.status) q.set('status', params.status);
    if (params.q) q.set('q', params.q);
    return apiRequest(`/sales${q.toString() ? '?' + q.toString() : ''}`);
  },
  async createSale(payload) {
    return apiRequest('/sales', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },
  async cancelSale(id) {
    return apiRequest(`/sales/${id}/cancel`, {
      method: 'POST'
    });
  },

  // ---- WORKSHOP (TALLER) ----
  async getWorkshopOrders(params = {}) {
    const q = new URLSearchParams();
    if (params.estado) q.set('estado', params.estado);
    if (params.assignedTech) q.set('assignedTech', params.assignedTech);
    if (params.q) q.set('q', params.q);
    return apiRequest(`/workshop${q.toString() ? '?' + q.toString() : ''}`);
  },
  async getWorkshopOrder(id) {
    return apiRequest(`/workshop/${id}`);
  },
  async createWorkshopOrder(payload) {
    return apiRequest('/workshop', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },
  async updateWorkshopOrder(id, payload) {
    return apiRequest(`/workshop/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
  },
  async addWorkshopBitacora(id, note, author) {
    return apiRequest(`/workshop/${id}/bitacora`, {
      method: 'POST',
      body: JSON.stringify({ note, author })
    });
  },
  async updateWorkshopParts(id, payload) {
    return apiRequest(`/workshop/${id}/parts`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },
  async deleteWorkshopOrder(id) {
    return apiRequest(`/workshop/${id}`, {
      method: 'DELETE'
    });
  },

  // ---- CLIENTS & CREDIT MANAGEMENT ----
  async getClients(params = {}) {
    const q = new URLSearchParams();
    if (params.q) q.set('q', params.q);
    if (params.hasCredit !== undefined) q.set('hasCredit', String(params.hasCredit));
    if (params.hasBilling !== undefined) q.set('hasBilling', String(params.hasBilling));
    if (params.withBalance !== undefined) q.set('withBalance', String(params.withBalance));
    return apiRequest(`/clients${q.toString() ? '?' + q.toString() : ''}`);
  },
  async getClient(id) {
    return apiRequest(`/clients/${id}`);
  },
  async createClient(payload) {
    return apiRequest('/clients', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },
  async updateClient(id, payload) {
    return apiRequest(`/clients/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
  },
  async deleteClient(id) {
    return apiRequest(`/clients/${id}`, {
      method: 'DELETE'
    });
  },
  async registerClientCreditMovement(id, payload) {
    return apiRequest(`/clients/${id}/credit`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  // ---- SHIFTS & CASH CUTS (CORTES Y TURNOS) ----
  async getShifts() {
    return apiRequest('/shifts');
  },
  async openShift(payload) {
    return apiRequest('/shifts', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },
  async addShiftCashMovement(shiftId, payload) {
    return apiRequest(`/shifts/${shiftId}/movements`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },
  async getCashCuts(params = {}) {
    const q = new URLSearchParams();
    if (params.cutType) q.set('cutType', params.cutType);
    return apiRequest(`/cash-cuts${q.toString() ? '?' + q.toString() : ''}`);
  },
  async createCashCut(payload) {
    return apiRequest('/cash-cuts', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  // ---- SYSTEM SETTINGS & BACKUP (MÓDULO DE CONFIGURACIÓN) ----
  async getSettings() {
    return apiRequest('/settings');
  },
  async updateSettings(payload) {
    return apiRequest('/settings', {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
  },
  async exportBackup() {
    return apiRequest('/settings/backup');
  },
  async restoreBackup(payload) {
    return apiRequest('/settings/restore', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  // ---- REPORTS & ACTIVITY ----
  async getReportsSummary() {
    return apiRequest('/reports/summary');
  },
  async getActivityLogs() {
    return apiRequest('/activity');
  },

  // ---- CHAT WEB & WHATSAPP LEADS ----
  async getChatLeads(params = {}) {
    const q = new URLSearchParams();
    if (params.status) q.set('status', params.status);
    if (params.q) q.set('q', params.q);
    return apiRequest(`/chat-leads${q.toString() ? '?' + q.toString() : ''}`);
  },
  async createChatLead(payload) {
    return apiRequest('/chat-leads', {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },
  async updateChatLead(id, payload) {
    return apiRequest(`/chat-leads/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload)
    });
  },
  async deleteChatLead(id) {
    return apiRequest(`/chat-leads/${id}`, {
      method: 'DELETE'
    });
  }
};
