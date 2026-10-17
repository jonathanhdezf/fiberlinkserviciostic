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
  async adjustStock(id, delta, reason) {
    return apiRequest(`/products/${id}/stock`, {
      method: 'POST',
      body: JSON.stringify({ delta, reason })
    });
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

  // ---- REPORTS & ACTIVITY ----
  async getReportsSummary() {
    return apiRequest('/reports/summary');
  },
  async getActivityLogs() {
    return apiRequest('/activity');
  }
};
