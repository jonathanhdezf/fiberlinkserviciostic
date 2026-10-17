import { ticketService } from './services/ticketService.js';
import { erpService } from './services/erpService.js';

// ==========================================
// GLOBAL ERP STATE
// ==========================================
let currentUser = null;
let currentView = 'overview';
let allTickets = [];
let allProducts = [];
let allWorkshop = [];
let allSales = [];
let allUsers = [];
let reportsData = null;

// Active modal selections
let currentTicketId = null;
let currentWorkshopOrder = null;
let currentWorkshopParts = [];
let posCart = [];
let posLinkedFolio = '';

const VIEW_META = {
  overview: { title: 'Resumen General', sub: 'Panel operativo y financiero en tiempo real · Fiberlink Teziutlán' },
  tickets: { title: 'Gestión de Tickets de Soporte', sub: 'Tablero Kanban de servicios en sitio, redes, CCTV y remoto' },
  workshop: { title: 'Taller y Laboratorio Técnico', sub: 'Órdenes de servicio (OS-), diagnóstico, refacciones y garantías' },
  pos: { title: 'Punto de Venta (Caja POS)', sub: 'Cobro de mostrador, liquidación de tickets/taller y control de inventario' },
  store: { title: 'Tienda, Catálogo e Inventario', sub: 'Administración de productos, precios, márgenes y existencias' },
  reports: { title: 'Reportes Ejecutivos y Corte de Caja', sub: 'Analítica financiera, rendimiento técnico y valoración de almacén' },
  users: { title: 'Usuarios, Roles y Permisos', sub: 'Control de acceso basado en roles (RBAC) para el personal' }
};

const WORKSHOP_STATE_LABELS = {
  recepcion: { label: 'Recepción', badge: 'badge-purple' },
  diagnostico: { label: 'Diagnóstico', badge: 'badge-amber' },
  esperando_refaccion: { label: 'Esp. Refacción', badge: 'badge-red' },
  en_reparacion: { label: 'En Reparación', badge: 'badge-blue' },
  listo_entrega: { label: 'Listo Entrega', badge: 'badge-green' },
  entregado: { label: 'Entregado', badge: 'badge-green' },
  garantia: { label: 'Garantía', badge: 'badge-red' }
};

const CATEGORY_LABELS = {
  pos: 'Punto de Venta',
  cctv: 'Cámaras & CCTV',
  redes: 'Redes & Fibra',
  software: 'Software & Lic.',
  refacciones: 'Refacciones',
  servicios: 'Servicio Técnico'
};

document.addEventListener('DOMContentLoaded', () => {
  initModalsClose();
  initAuth();
  initNavigation();
  initTicketsModule();
  initWorkshopModule();
  initPosModule();
  initStoreModule();
  initReportsModule();
  initUsersModule();
});

function showToast(msg) {
  const el = document.getElementById('erpToast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._timer);
  el._timer = setTimeout(() => el.classList.remove('show'), 3200);
}

function formatMoney(n) {
  const num = parseFloat(n) || 0;
  return '$' + num.toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function normalizeTicketStateDomId(state) {
  if (!state || state === 'creación' || state === 'creacion') return 'creacion';
  return state;
}

// ==========================================
// 1. AUTHENTICATION & ROLES (RBAC)
// ==========================================
function initAuth() {
  const loginOverlay = document.getElementById('loginOverlay');
  const dashboard = document.getElementById('dashboard');
  const loginForm = document.getElementById('loginForm');
  const loginError = document.getElementById('loginError');
  const logoutBtn = document.getElementById('logoutBtn');

  // Demo quick role buttons
  document.querySelectorAll('.qr-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('loginUser').value = btn.dataset.user;
      document.getElementById('loginPass').value = btn.dataset.pass;
      loginForm.requestSubmit();
    });
  });

  // Restore existing session
  const savedUser = sessionStorage.getItem('fiberlink_user');
  if (savedUser && sessionStorage.getItem('fiberlink_admin_logged_in') === 'true') {
    try {
      currentUser = JSON.parse(savedUser);
      enterDashboard();
    } catch (e) {
      sessionStorage.clear();
    }
  }

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    loginError.textContent = '';
    const username = document.getElementById('loginUser').value.trim();
    const password = document.getElementById('loginPass').value.trim();

    try {
      const res = await erpService.login(username, password);
      currentUser = res.user;
      sessionStorage.setItem('fiberlink_token', res.token);
      sessionStorage.setItem('fiberlink_user', JSON.stringify(res.user));
      sessionStorage.setItem('fiberlink_admin_logged_in', 'true');
      enterDashboard();
      showToast(`Bienvenido, ${currentUser.name} (${currentUser.permissions?.label || currentUser.role})`);
    } catch (err) {
      loginError.textContent = err.message || 'Credenciales incorrectas.';
    }
  });

  logoutBtn.addEventListener('click', () => {
    sessionStorage.clear();
    currentUser = null;
    loginOverlay.classList.remove('hidden');
    dashboard.classList.add('hidden');
    loginForm.reset();
  });
}

async function enterDashboard() {
  document.getElementById('loginOverlay').classList.add('hidden');
  document.getElementById('dashboard').classList.remove('hidden');

  // Render user profile & apply role permissions
  const initials = (currentUser?.name || 'FL')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('');

  document.getElementById('ucAvatar').textContent = initials;
  document.getElementById('ucName').textContent = currentUser?.name || 'Usuario';
  document.getElementById('ucRole').textContent = currentUser?.permissions?.label || currentUser?.role || 'Personal';

  const allowedModules = currentUser?.permissions?.modules || ['overview', 'tickets', 'workshop', 'pos', 'store'];
  document.querySelectorAll('#sidebarNav .nav-btn').forEach(btn => {
    const view = btn.dataset.view;
    btn.style.display = allowedModules.includes(view) ? 'flex' : 'none';
  });

  await syncAllData();
  if (!allowedModules.includes(currentView)) {
    switchView(allowedModules[0] || 'overview');
  } else {
    switchView(currentView);
  }
}

// ==========================================
// 2. NAVIGATION & GLOBAL SYNC
// ==========================================
function initNavigation() {
  document.querySelectorAll('#sidebarNav .nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      switchView(btn.dataset.view);
    });
  });

  document.querySelectorAll('[data-goto]').forEach(btn => {
    btn.addEventListener('click', () => {
      switchView(btn.dataset.goto);
    });
  });

  document.getElementById('refreshBtn')?.addEventListener('click', async () => {
    await syncAllData();
    showToast('Datos sincronizados con el servidor');
  });

  document.getElementById('quickNewTicketBtn')?.addEventListener('click', () => {
    openModal('newTicketModal');
  });

  document.getElementById('quickNewWorkshopBtn')?.addEventListener('click', () => {
    openWorkshopModalForCreate();
  });
}

function switchView(viewName) {
  currentView = viewName;
  document.querySelectorAll('#sidebarNav .nav-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.view === viewName);
  });
  document.querySelectorAll('.erp-view').forEach(sec => {
    sec.classList.toggle('active', sec.id === `view-${viewName}`);
  });

  const meta = VIEW_META[viewName] || VIEW_META.overview;
  document.getElementById('topbarTitle').textContent = meta.title;
  document.getElementById('topbarSub').textContent = meta.sub;
}

async function syncAllData() {
  try {
    const [tickets, products, workshop, sales, users, reports] = await Promise.all([
      ticketService.getTickets(),
      erpService.getProducts().catch(() => []),
      erpService.getWorkshopOrders().catch(() => []),
      erpService.getSales().catch(() => []),
      erpService.getUsers().catch(() => []),
      erpService.getReportsSummary().catch(() => null)
    ]);

    allTickets = Array.isArray(tickets) ? tickets : [];
    allProducts = Array.isArray(products) ? products : [];
    allWorkshop = Array.isArray(workshop) ? workshop : [];
    allSales = Array.isArray(sales) ? sales : [];
    allUsers = Array.isArray(users) ? users : [];
    reportsData = reports;

    updateNavBadges();
    populateTechnicianSelects();
    populateCatalogPickers();
    renderOverview();
    renderTicketsKanban();
    renderWorkshopGrid();
    renderPosCatalog();
    renderPosFolioOptions();
    renderPosSalesHistory();
    renderStoreTable();
    renderReportsView();
    renderUsersTable();
  } catch (err) {
    console.error('[ERP Sync Error]:', err);
  }
}

function updateNavBadges() {
  const activeTickets = allTickets.filter(t => t.estado !== 'resuelto').length;
  const activeWorkshop = allWorkshop.filter(w => w.estado !== 'entregado').length;
  const lowStockCount = allProducts.filter(p => !p.isService && Number(p.stock) <= Number(p.minStock || 3)).length;

  document.getElementById('navBadgeTickets').textContent = activeTickets;
  document.getElementById('navBadgeWorkshop').textContent = activeWorkshop;
  const lowBadge = document.getElementById('navBadgeLowStock');
  if (lowBadge) {
    lowBadge.style.display = lowStockCount > 0 ? 'inline-block' : 'none';
    lowBadge.textContent = lowStockCount;
  }
}

function populateTechnicianSelects() {
  const techs = allUsers.filter(u => u.role === 'tecnico' || u.role === 'admin');
  const names = techs.length > 0 ? techs.map(t => t.name) : ['Ing. Alejandro Luna', 'Téc. Daniel Ortega', 'Ing. Roberto Méndez'];

  const filterSelect = document.getElementById('ticketTechFilter');
  if (filterSelect) {
    const current = filterSelect.value;
    filterSelect.innerHTML = `<option value="">Todos los técnicos</option>` +
      names.map(n => `<option value="${n}">${n}</option>`).join('');
    filterSelect.value = current;
  }

  ['tdAssignedSelect', 'newTicketTechSelect', 'wsAssignedTech'].forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      const val = el.value;
      el.innerHTML = `<option value="Sin asignar">Sin asignar</option>` +
        names.map(n => `<option value="${n}">${n}</option>`).join('');
      if (val) el.value = val;
    }
  });
}

function populateCatalogPickers() {
  const optionsHtml = `<option value="">— Seleccionar producto o servicio del catálogo —</option>` +
    allProducts.map(p => `<option value="${p.id}">[${p.sku}] ${p.name} — ${formatMoney(p.price)}</option>`).join('');

  const tdPicker = document.getElementById('tdCatalogPicker');
  if (tdPicker) tdPicker.innerHTML = optionsHtml;

  const wsPicker = document.getElementById('wsPartPicker');
  if (wsPicker) wsPicker.innerHTML = optionsHtml;
}

// ==========================================
// 3. MODALS HELPER
// ==========================================
function initModalsClose() {
  document.querySelectorAll('[data-close]').forEach(btn => {
    btn.addEventListener('click', () => {
      closeModal(btn.dataset.close);
    });
  });
}

function openModal(id) {
  document.getElementById(id)?.classList.add('open');
}

function closeModal(id) {
  document.getElementById(id)?.classList.remove('open');
}

// ==========================================
// 4. VIEW 1: OVERVIEW (RESUMEN GENERAL)
// ==========================================
function renderOverview() {
  const fin = reportsData?.financials || { grossRevenue: 0, estimatedProfit: 0, pendingReceivables: 0, totalSalesCount: 0 };
  const activeTickets = allTickets.filter(t => t.estado !== 'resuelto').length;
  const urgentTickets = allTickets.filter(t => t.priority === 'Urgente' && t.estado !== 'resuelto').length;
  const activeWs = allWorkshop.filter(w => w.estado !== 'entregado').length;
  const readyWs = allWorkshop.filter(w => w.estado === 'listo_entrega').length;
  const lowStock = allProducts.filter(p => !p.isService && Number(p.stock) <= Number(p.minStock || 3));

  const kpiContainer = document.getElementById('overviewKpis');
  if (kpiContainer) {
    kpiContainer.innerHTML = `
      <div class="kpi-card">
        <span class="kpi-label">Ingresos Cobrados (POS)</span>
        <div class="kpi-value accent">${formatMoney(fin.grossRevenue)}</div>
        <span class="kpi-sub">${fin.totalSalesCount} ventas completadas · Utilidad est. ${formatMoney(fin.estimatedProfit)}</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">Por Cobrar (Tickets y Taller)</span>
        <div class="kpi-value cyan">${formatMoney(fin.pendingReceivables)}</div>
        <span class="kpi-sub">Saldo en servicios y órdenes abiertas</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">Tickets de Soporte Activos</span>
        <div class="kpi-value ${urgentTickets > 0 ? 'warn' : ''}">${activeTickets}</div>
        <span class="kpi-sub">${urgentTickets} urgentes · ${allTickets.length} registrados en total</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">Equipos en Taller</span>
        <div class="kpi-value">${activeWs}</div>
        <span class="kpi-sub">${readyWs} listos para entrega al cliente</span>
      </div>
    `;
  }

  // Tickets bars
  const totalT = Math.max(1, allTickets.length);
  const tSummary = document.getElementById('overviewTicketsSummary');
  if (tSummary) {
    const rows = [
      { label: 'Creación / Nuevos', count: allTickets.filter(t => normalizeTicketStateDomId(t.estado) === 'creacion').length, color: '#a855f7' },
      { label: 'En Diagnóstico', count: allTickets.filter(t => t.estado === 'diagnostico').length, color: '#f59e0b' },
      { label: 'En Proceso', count: allTickets.filter(t => t.estado === 'proceso').length, color: '#3b82f6' },
      { label: 'Resueltos', count: allTickets.filter(t => t.estado === 'resuelto').length, color: '#9cc32e' }
    ];
    tSummary.innerHTML = rows.map(r => `
      <div class="sbar-row">
        <div class="sbar-top"><span>${r.label}</span><strong class="mono">${r.count}</strong></div>
        <div class="sbar-track"><div class="sbar-fill" style="width:${Math.round((r.count / totalT) * 100)}%; background:${r.color};"></div></div>
      </div>
    `).join('');
  }

  // Workshop bars
  const totalW = Math.max(1, allWorkshop.length);
  const wSummary = document.getElementById('overviewWorkshopSummary');
  if (wSummary) {
    const rows = [
      { label: 'Recepción / Diagnóstico', count: allWorkshop.filter(w => w.estado === 'recepcion' || w.estado === 'diagnostico').length, color: '#f59e0b' },
      { label: 'En Reparación / Refacción', count: allWorkshop.filter(w => w.estado === 'en_reparacion' || w.estado === 'esperando_refaccion').length, color: '#3b82f6' },
      { label: 'Listos para Entrega', count: allWorkshop.filter(w => w.estado === 'listo_entrega').length, color: '#9cc32e' },
      { label: 'Entregados', count: allWorkshop.filter(w => w.estado === 'entregado').length, color: '#22c55e' }
    ];
    wSummary.innerHTML = rows.map(r => `
      <div class="sbar-row">
        <div class="sbar-top"><span>${r.label}</span><strong class="mono">${r.count}</strong></div>
        <div class="sbar-track"><div class="sbar-fill" style="width:${Math.round((r.count / totalW) * 100)}%; background:${r.color};"></div></div>
      </div>
    `).join('');
  }

  // Low stock
  const lowEl = document.getElementById('overviewLowStockList');
  if (lowEl) {
    if (lowStock.length === 0) {
      lowEl.innerHTML = `<p style="color:var(--text-muted); font-size:0.85rem;">Todo el inventario físico está por encima del stock mínimo.</p>`;
    } else {
      lowEl.innerHTML = `<div class="table-responsive"><table class="erp-table">
        <thead><tr><th>SKU</th><th>Producto</th><th>Stock</th><th>Mín.</th></tr></thead>
        <tbody>
          ${lowStock.map(p => `
            <tr>
              <td class="mono">${p.sku}</td>
              <td>${p.name}</td>
              <td><span class="badge badge-red">${p.stock} ${p.unit || 'pza'}</span></td>
              <td class="mono">${p.minStock}</td>
            </tr>
          `).join('')}
        </tbody>
      </table></div>`;
    }
  }

  // Recent Activity
  const actEl = document.getElementById('overviewActivityList');
  if (actEl) {
    const logs = reportsData?.recentActivity || [];
    if (logs.length === 0) {
      actEl.innerHTML = `<p style="color:var(--text-muted); font-size:0.85rem;">Sin actividad reciente.</p>`;
    } else {
      actEl.innerHTML = logs.slice(0, 10).map(a => {
        const t = a.date ? new Date(a.date).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
        return `
          <div class="act-item">
            <div><strong>${a.user}:</strong> ${a.action}</div>
            <span class="act-time">${t}</span>
          </div>
        `;
      }).join('');
    }
  }
}

// ==========================================
// 5. VIEW 2: TICKETS MODULE
// ==========================================
function initTicketsModule() {
  document.getElementById('ticketSearchInput')?.addEventListener('input', renderTicketsKanban);
  document.getElementById('ticketPriorityFilter')?.addEventListener('change', renderTicketsKanban);
  document.getElementById('ticketTechFilter')?.addEventListener('change', renderTicketsKanban);

  document.getElementById('btnOpenNewTicketModal')?.addEventListener('click', () => {
    openModal('newTicketModal');
  });

  // New Ticket Submit
  const newTicketForm = document.getElementById('newTicketForm');
  newTicketForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(newTicketForm);
    const payload = Object.fromEntries(fd.entries());
    payload.author = currentUser?.name || 'Recepción';
    payload.source = 'Mesa de Control';

    await ticketService.createTicket(payload);
    newTicketForm.reset();
    closeModal('newTicketModal');
    await syncAllData();
    showToast('Ticket registrado exitosamente');
  });

  // Ticket Tabs inside Detail Modal
  document.querySelectorAll('#ticketDetailModal .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#ticketDetailModal .tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('#ticketDetailModal .tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`)?.classList.add('active');
    });
  });

  // Update Ticket Status / Priority / Assigned Tech
  document.getElementById('tdEstado')?.addEventListener('change', async (e) => {
    if (!currentTicketId) return;
    await ticketService.updateTicket(currentTicketId, { estado: e.target.value, author: currentUser?.name });
    await syncAllData();
    showToast('Estado del ticket actualizado');
  });

  document.getElementById('tdPrioritySelect')?.addEventListener('change', async (e) => {
    if (!currentTicketId) return;
    await ticketService.updateTicket(currentTicketId, { priority: e.target.value, author: currentUser?.name });
    await syncAllData();
    showToast('Prioridad actualizada');
  });

  document.getElementById('tdAssignedSelect')?.addEventListener('change', async (e) => {
    if (!currentTicketId) return;
    await ticketService.updateTicket(currentTicketId, { assignedTo: e.target.value, author: currentUser?.name });
    await syncAllData();
    showToast(`Ticket asignado a ${e.target.value}`);
  });

  // Bitacora Form
  const bitacoraForm = document.getElementById('bitacoraForm');
  bitacoraForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentTicketId) return;
    const note = document.getElementById('bitacoraNote').value.trim();
    if (!note) return;

    const updated = await ticketService.addBitacoraNote(currentTicketId, note, currentUser?.name || 'Técnico');
    bitacoraForm.reset();
    if (updated) renderTicketBitacora(updated.bitacora || []);
    await syncAllData();
    showToast('Nota agregada a la bitácora');
  });

  // Add item from Store Catalog to Ticket POS
  document.getElementById('tdAddCatalogItemBtn')?.addEventListener('click', async () => {
    if (!currentTicketId) return;
    const prodId = document.getElementById('tdCatalogPicker').value;
    const prod = allProducts.find(p => p.id === prodId);
    if (!prod) return;

    const ticket = await ticketService.getTicketById(currentTicketId);
    const items = Array.isArray(ticket?.pos?.items) ? [...ticket.pos.items] : [];
    items.push({
      id: `pos-${Date.now()}`,
      productId: prod.id,
      concept: prod.name,
      qty: 1,
      price: prod.price
    });
    const total = items.reduce((s, i) => s + (parseFloat(i.price) || 0) * (Number(i.qty) || 1), 0);
    await ticketService.savePos(currentTicketId, items, total);
    renderTicketPOS({ items, total });
    await syncAllData();
    showToast(`Agregado: ${prod.name}`);
  });

  // Manual POS Concept in Ticket
  const posForm = document.getElementById('posForm');
  posForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentTicketId) return;
    const concept = document.getElementById('posConcept').value.trim();
    const price = parseFloat(document.getElementById('posPrice').value);
    if (!concept || isNaN(price)) return;

    const ticket = await ticketService.getTicketById(currentTicketId);
    const items = Array.isArray(ticket?.pos?.items) ? [...ticket.pos.items] : [];
    items.push({ id: `pos-${Date.now()}`, concept, qty: 1, price });
    const total = items.reduce((s, i) => s + (parseFloat(i.price) || 0) * (Number(i.qty) || 1), 0);
    await ticketService.savePos(currentTicketId, items, total);
    renderTicketPOS({ items, total });
    posForm.reset();
    await syncAllData();
  });

  // Send Ticket to POS Terminal for Checkout
  document.getElementById('tdSendToPosBtn')?.addEventListener('click', async () => {
    const ticket = allTickets.find(t => t.id === currentTicketId);
    if (!ticket) return;
    closeModal('ticketDetailModal');
    switchView('pos');
    loadFolioIntoPosCart(ticket.folio);
  });

  // Delete Ticket
  document.getElementById('tdDeleteTicketBtn')?.addEventListener('click', async () => {
    if (!currentTicketId) return;
    if (!confirm('¿Estás seguro de eliminar este ticket permanentemente?')) return;
    await ticketService.deleteTicket(currentTicketId);
    closeModal('ticketDetailModal');
    await syncAllData();
    showToast('Ticket eliminado');
  });

  // Print Ticket Order
  document.getElementById('tdPrintOrderBtn')?.addEventListener('click', () => {
    const ticket = allTickets.find(t => t.id === currentTicketId);
    if (ticket) printTicketDocument(ticket);
  });
  document.getElementById('posPrintBtn')?.addEventListener('click', () => {
    const ticket = allTickets.find(t => t.id === currentTicketId);
    if (ticket) printTicketDocument(ticket);
  });
}

function renderTicketsKanban() {
  const q = (document.getElementById('ticketSearchInput')?.value || '').toLowerCase().trim();
  const prio = document.getElementById('ticketPriorityFilter')?.value || '';
  const tech = document.getElementById('ticketTechFilter')?.value || '';

  const filtered = allTickets.filter(t => {
    if (prio && t.priority !== prio) return false;
    if (tech && (t.assignedTo || '') !== tech) return false;
    if (q) {
      const hay = `${t.folio} ${t.name} ${t.company} ${t.phone} ${t.service} ${t.description}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const domStates = ['creacion', 'diagnostico', 'proceso', 'resuelto'];
  domStates.forEach(s => {
    const col = document.getElementById(`col-${s}`);
    const countEl = document.getElementById(`count-${s}`);
    if (col) col.innerHTML = '';
    if (countEl) countEl.textContent = '0';
  });

  filtered.forEach(ticket => {
    const domKey = normalizeTicketStateDomId(ticket.estado);
    const col = document.getElementById(`col-${domKey}`);
    if (col) col.appendChild(createTicketCard(ticket));
  });

  domStates.forEach(s => {
    const col = document.getElementById(`col-${s}`);
    const countEl = document.getElementById(`count-${s}`);
    if (col && countEl) countEl.textContent = col.children.length;
  });
}

function createTicketCard(ticket) {
  const div = document.createElement('div');
  div.className = 'ticket-card';
  div.onclick = () => openTicketDetail(ticket.id);

  const dateStr = ticket.createdAt
    ? new Date(ticket.createdAt).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
    : 'Reciente';

  let prioClass = 'prio-normal';
  if (ticket.priority === 'Alta') prioClass = 'prio-alta';
  if (ticket.priority === 'Urgente') prioClass = 'prio-urgente';

  const companyBadge = ticket.company ? ` <span style="opacity:0.75;font-size:0.76rem;">[${ticket.company}]</span>` : '';
  const totalAmount = parseFloat(ticket.pos?.total) || 0;
  const posTag = totalAmount > 0
    ? `<span class="mono" style="color:${ticket.pos?.paid ? 'var(--primary)' : 'var(--secondary)'};">${formatMoney(totalAmount)} ${ticket.pos?.paid ? '✓' : ''}</span>`
    : '';

  div.innerHTML = `
    <div class="tc-head">
      <span class="tc-folio">${ticket.folio || 'FL-NEW'}</span>
      <span class="tc-date">${dateStr}</span>
    </div>
    <div class="tc-title">${ticket.name || 'Sin nombre'}${companyBadge}</div>
    <div class="tc-desc">${ticket.description || 'Sin descripción'}</div>
    <div class="tc-foot">
      <span class="tc-priority ${prioClass}">${ticket.priority || 'Normal'}</span>
      <span class="tc-source">${ticket.assignedTo || ticket.service || 'Soporte'}</span>
      ${posTag}
    </div>
  `;
  return div;
}

async function openTicketDetail(ticketId) {
  currentTicketId = ticketId;
  const ticket = await ticketService.getTicketById(ticketId);
  if (!ticket) return;

  document.querySelector('#ticketDetailModal .tab-btn[data-tab="info"]')?.click();

  document.getElementById('tdFolio').textContent = ticket.folio || 'FL-0000';
  document.getElementById('tdName').textContent = `${ticket.name || 'Cliente'}${ticket.company ? ' — ' + ticket.company : ''}`;
  document.getElementById('tdPhone').textContent = ticket.phone || '-';
  document.getElementById('tdService').textContent = ticket.service || '-';
  document.getElementById('tdOnsite').textContent = ticket.modality || 'En Sitio';
  document.getElementById('tdLocation').textContent = ticket.address || 'Teziutlán, Pue.';
  document.getElementById('tdDescription').textContent = ticket.description || 'Sin descripción.';
  document.getElementById('tdDate').textContent = ticket.createdAt ? new Date(ticket.createdAt).toLocaleString('es-MX') : '-';

  document.getElementById('tdEstado').value = ticket.estado || 'creación';
  document.getElementById('tdPrioritySelect').value = ticket.priority || 'Normal';
  document.getElementById('tdAssignedSelect').value = ticket.assignedTo || 'Sin asignar';

  // Role check for delete button
  const delBtn = document.getElementById('tdDeleteTicketBtn');
  if (delBtn) delBtn.style.display = currentUser?.permissions?.canDelete ? 'inline-flex' : 'none';

  renderTicketBitacora(ticket.bitacora || []);
  renderTicketPOS(ticket.pos || { items: [], total: 0 });
  openModal('ticketDetailModal');
}

function renderTicketBitacora(notes) {
  const container = document.getElementById('bitacoraList');
  if (!container) return;
  if (!Array.isArray(notes) || notes.length === 0) {
    container.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;">Sin notas en bitácora.</p>';
    return;
  }
  container.innerHTML = notes.slice().reverse().map(n => `
    <div class="b-note">
      <div class="b-note-head">
        <strong>${n.author || 'Técnico'}</strong>
        <span>${n.date ? new Date(n.date).toLocaleString('es-MX') : ''}</span>
      </div>
      <div class="b-note-body">${n.note || n.text || ''}</div>
    </div>
  `).join('');
}

function renderTicketPOS(posData) {
  const list = document.getElementById('posList');
  const totalEl = document.getElementById('posTotal');
  if (!list || !totalEl) return;

  const items = Array.isArray(posData.items) ? posData.items : [];
  if (items.length === 0) {
    list.innerHTML = '<tr><td colspan="3" style="text-align:center;color:var(--text-muted);">Sin cargos registrados</td></tr>';
    totalEl.textContent = '$0.00';
    return;
  }

  list.innerHTML = items.map(item => `
    <tr>
      <td>${item.concept}</td>
      <td style="text-align:right;" class="mono">${formatMoney(item.price)}</td>
      <td style="text-align:right;">
        <button type="button" class="del-item-btn" data-id="${item.id}">✕</button>
      </td>
    </tr>
  `).join('');

  const total = items.reduce((s, i) => s + (parseFloat(i.price) || 0) * (Number(i.qty) || 1), 0);
  totalEl.textContent = formatMoney(total);

  list.querySelectorAll('.del-item-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const nextItems = items.filter(i => i.id !== btn.dataset.id);
      const nextTotal = nextItems.reduce((s, i) => s + (parseFloat(i.price) || 0) * (Number(i.qty) || 1), 0);
      await ticketService.savePos(currentTicketId, nextItems, nextTotal);
      renderTicketPOS({ items: nextItems, total: nextTotal });
      await syncAllData();
    });
  });
}

// ==========================================
// 6. VIEW 3: WORKSHOP MODULE (TALLER TÉCNICO)
// ==========================================
function initWorkshopModule() {
  document.getElementById('wsSearchInput')?.addEventListener('input', renderWorkshopGrid);
  document.getElementById('wsStateFilter')?.addEventListener('change', renderWorkshopGrid);

  document.getElementById('btnOpenNewWorkshopModal')?.addEventListener('click', () => {
    openWorkshopModalForCreate();
  });

  document.getElementById('wsAddPartBtn')?.addEventListener('click', () => {
    const prodId = document.getElementById('wsPartPicker').value;
    const prod = allProducts.find(p => p.id === prodId);
    if (!prod) return;
    currentWorkshopParts.push({
      id: `wp-${Date.now()}`,
      productId: prod.id,
      concept: prod.name,
      qty: 1,
      price: prod.price
    });
    renderWorkshopPartsInModal();
  });

  document.getElementById('wsLaborCost')?.addEventListener('input', renderWorkshopPartsInModal);
  document.getElementById('wsAdvancePayment')?.addEventListener('input', renderWorkshopPartsInModal);

  const wsForm = document.getElementById('workshopForm');
  wsForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('wsOrderId').value;
    const payload = {
      clientName: document.getElementById('wsClientName').value.trim(),
      clientPhone: document.getElementById('wsClientPhone').value.trim(),
      deviceType: document.getElementById('wsDeviceType').value,
      brand: document.getElementById('wsBrand').value.trim(),
      model: document.getElementById('wsModel').value.trim(),
      serialNumber: document.getElementById('wsSerial').value.trim(),
      estado: document.getElementById('wsEstado').value,
      assignedTech: document.getElementById('wsAssignedTech').value,
      accessories: document.getElementById('wsAccessories').value.trim(),
      reportedFault: document.getElementById('wsReportedFault').value.trim(),
      technicalDiagnosis: document.getElementById('wsDiagnosis').value.trim(),
      laborCost: parseFloat(document.getElementById('wsLaborCost').value) || 0,
      advancePayment: parseFloat(document.getElementById('wsAdvancePayment').value) || 0,
      parts: currentWorkshopParts
    };

    try {
      if (id) {
        await erpService.updateWorkshopOrder(id, payload);
        showToast('Orden de taller actualizada');
      } else {
        const created = await erpService.createWorkshopOrder(payload);
        if (currentWorkshopParts.length > 0 && created?.order?.id) {
          await erpService.updateWorkshopParts(created.order.id, {
            parts: currentWorkshopParts,
            laborCost: payload.laborCost,
            advancePayment: payload.advancePayment
          });
        }
        showToast(`Orden ${created.order.folio} registrada en taller`);
      }
      closeModal('workshopModal');
      await syncAllData();
    } catch (err) {
      showToast(err.message);
    }
  });

  document.getElementById('wsDeleteBtn')?.addEventListener('click', async () => {
    const id = document.getElementById('wsOrderId').value;
    if (!id || !confirm('¿Eliminar esta orden de taller?')) return;
    await erpService.deleteWorkshopOrder(id);
    closeModal('workshopModal');
    await syncAllData();
    showToast('Orden de taller eliminada');
  });

  document.getElementById('wsSendToPosBtn')?.addEventListener('click', () => {
    if (!currentWorkshopOrder) return;
    closeModal('workshopModal');
    switchView('pos');
    loadFolioIntoPosCart(currentWorkshopOrder.folio);
  });

  document.getElementById('wsPrintOrderBtn')?.addEventListener('click', () => {
    if (currentWorkshopOrder) printWorkshopDocument(currentWorkshopOrder);
  });
}

function renderWorkshopGrid() {
  const container = document.getElementById('workshopCardsContainer');
  if (!container) return;

  const q = (document.getElementById('wsSearchInput')?.value || '').toLowerCase().trim();
  const state = document.getElementById('wsStateFilter')?.value || 'all';

  const filtered = allWorkshop.filter(o => {
    if (state !== 'all' && o.estado !== state) return false;
    if (q) {
      const hay = `${o.folio} ${o.clientName} ${o.clientPhone} ${o.deviceType} ${o.brand} ${o.model} ${o.serialNumber}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    container.innerHTML = `<p style="color:var(--text-muted);">No se encontraron órdenes de taller con los filtros seleccionados.</p>`;
    return;
  }

  container.innerHTML = filtered.map(o => {
    const st = WORKSHOP_STATE_LABELS[o.estado] || { label: o.estado, badge: 'badge-blue' };
    const balance = Math.max(0, (parseFloat(o.total) || 0) - (parseFloat(o.advancePayment) || 0));
    return `
      <div class="ws-card" data-id="${o.id}">
        <div class="ws-card-top">
          <span class="tc-folio">${o.folio}</span>
          <span class="badge ${st.badge}">${st.label}</span>
        </div>
        <div>
          <div class="ws-device-badge">${o.deviceType} · ${o.brand} ${o.model}</div>
          <strong style="font-size:0.96rem;">${o.clientName}</strong>
          <div style="font-size:0.78rem; color:var(--text-muted);">Tel: ${o.clientPhone || '-'} · S/N: ${o.serialNumber || 'S/N'}</div>
        </div>
        <div class="ws-fault"><strong>Falla:</strong> ${o.reportedFault || 'Sin descripción'}</div>
        <div style="font-size:0.8rem; color:var(--text-muted);">
          <strong>Diagnóstico:</strong> ${o.technicalDiagnosis || 'Pendiente'}
        </div>
        <div class="ws-card-foot">
          <span>Téc: <strong>${o.assignedTech || 'Sin asignar'}</strong></span>
          <span class="mono" style="color:${o.paid ? 'var(--primary)' : 'var(--secondary)'};">
            ${o.paid ? 'PAGADO ' + formatMoney(o.total) : 'Saldo: ' + formatMoney(balance)}
          </span>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('.ws-card').forEach(card => {
    card.addEventListener('click', () => {
      const order = allWorkshop.find(w => w.id === card.dataset.id);
      if (order) openWorkshopModalForEdit(order);
    });
  });
}

function openWorkshopModalForCreate() {
  currentWorkshopOrder = null;
  currentWorkshopParts = [];
  document.getElementById('workshopForm').reset();
  document.getElementById('wsOrderId').value = '';
  document.getElementById('wsModalFolio').textContent = 'NUEVA ORDEN DE LABORATORIO';
  document.getElementById('wsModalTitle').textContent = 'Ingreso de Equipo a Taller';
  document.getElementById('wsDeleteBtn').style.display = 'none';
  document.getElementById('wsSendToPosBtn').style.display = 'none';
  document.getElementById('wsPrintOrderBtn').style.display = 'none';
  renderWorkshopPartsInModal();
  openModal('workshopModal');
}

function openWorkshopModalForEdit(order) {
  currentWorkshopOrder = order;
  currentWorkshopParts = Array.isArray(order.parts) ? [...order.parts] : [];

  document.getElementById('wsOrderId').value = order.id;
  document.getElementById('wsModalFolio').textContent = order.folio;
  document.getElementById('wsModalTitle').textContent = `${order.deviceType} ${order.brand} ${order.model}`;
  document.getElementById('wsClientName').value = order.clientName || '';
  document.getElementById('wsClientPhone').value = order.clientPhone || '';
  document.getElementById('wsDeviceType').value = order.deviceType || 'Laptop';
  document.getElementById('wsBrand').value = order.brand || '';
  document.getElementById('wsModel').value = order.model || '';
  document.getElementById('wsSerial').value = order.serialNumber || '';
  document.getElementById('wsEstado').value = order.estado || 'recepcion';
  document.getElementById('wsAssignedTech').value = order.assignedTech || 'Sin asignar';
  document.getElementById('wsAccessories').value = order.accessories || '';
  document.getElementById('wsReportedFault').value = order.reportedFault || '';
  document.getElementById('wsDiagnosis').value = order.technicalDiagnosis || '';
  document.getElementById('wsLaborCost').value = order.laborCost || 0;
  document.getElementById('wsAdvancePayment').value = order.advancePayment || 0;

  document.getElementById('wsDeleteBtn').style.display = currentUser?.permissions?.canDelete ? 'inline-flex' : 'none';
  document.getElementById('wsSendToPosBtn').style.display = 'inline-flex';
  document.getElementById('wsPrintOrderBtn').style.display = 'inline-flex';

  renderWorkshopPartsInModal();
  openModal('workshopModal');
}

function renderWorkshopPartsInModal() {
  const listEl = document.getElementById('wsPartsList');
  const labor = parseFloat(document.getElementById('wsLaborCost')?.value) || 0;
  const advance = parseFloat(document.getElementById('wsAdvancePayment')?.value) || 0;

  const partsSum = currentWorkshopParts.reduce((s, p) => s + (parseFloat(p.price) || 0) * (Number(p.qty) || 1), 0);
  const total = partsSum + labor;
  const balance = Math.max(0, total - advance);

  document.getElementById('wsTotalLabel').textContent = formatMoney(total);
  document.getElementById('wsBalanceLabel').textContent = formatMoney(balance);

  if (!listEl) return;
  if (currentWorkshopParts.length === 0) {
    listEl.innerHTML = `<div style="font-size:0.8rem; color:var(--text-muted);">Sin refacciones adicionales cargadas.</div>`;
    return;
  }

  listEl.innerHTML = currentWorkshopParts.map(p => `
    <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 10px; background:rgba(0,0,0,0.3); border-radius:6px; margin-bottom:4px; font-size:0.84rem;">
      <span>${p.concept} (x${p.qty || 1})</span>
      <div style="display:flex; align-items:center; gap:10px;">
        <strong class="mono">${formatMoney(p.price)}</strong>
        <button type="button" class="del-item-btn" data-id="${p.id}">✕</button>
      </div>
    </div>
  `).join('');

  listEl.querySelectorAll('.del-item-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentWorkshopParts = currentWorkshopParts.filter(p => p.id !== btn.dataset.id);
      renderWorkshopPartsInModal();
    });
  });
}

// ==========================================
// 7. VIEW 4: POINT OF SALE (TERMINAL POS)
// ==========================================
function initPosModule() {
  document.getElementById('posCatalogSearch')?.addEventListener('input', renderPosCatalog);
  document.getElementById('posCategoryFilter')?.addEventListener('change', renderPosCatalog);

  document.getElementById('posClearCartBtn')?.addEventListener('click', () => {
    posCart = [];
    posLinkedFolio = '';
    document.getElementById('posImportFolioSelect').value = '';
    document.getElementById('posClientName').value = 'Mostrador / Público en General';
    document.getElementById('posDiscountInput').value = '0';
    renderPosCart();
  });

  document.getElementById('posLoadFolioBtn')?.addEventListener('click', () => {
    const folio = document.getElementById('posImportFolioSelect').value;
    if (folio) loadFolioIntoPosCart(folio);
  });

  document.getElementById('posDiscountInput')?.addEventListener('input', updatePosTotals);
  document.getElementById('posAmountReceived')?.addEventListener('input', updatePosTotals);
  document.getElementById('posPaymentMethod')?.addEventListener('change', updatePosTotals);

  document.getElementById('posCompleteSaleBtn')?.addEventListener('click', async () => {
    if (posCart.length === 0) {
      showToast('Agrega al menos un producto o servicio al carrito');
      return;
    }

    const subtotal = posCart.reduce((s, i) => s + i.price * i.qty, 0);
    const discount = Math.max(0, parseFloat(document.getElementById('posDiscountInput').value) || 0);
    const total = Math.max(0, subtotal - discount);
    const paymentMethod = document.getElementById('posPaymentMethod').value;
    const amountReceived = parseFloat(document.getElementById('posAmountReceived').value) || total;

    if (paymentMethod === 'Efectivo' && amountReceived < total) {
      showToast('El efectivo recibido es menor al total a cobrar');
      return;
    }

    try {
      const res = await erpService.createSale({
        clientName: document.getElementById('posClientName').value.trim(),
        paymentMethod,
        linkedRef: posLinkedFolio,
        discount,
        amountReceived,
        cashier: currentUser?.name || 'Cajero POS',
        items: posCart
      });

      posCart = [];
      posLinkedFolio = '';
      document.getElementById('posDiscountInput').value = '0';
      document.getElementById('posAmountReceived').value = '';
      renderPosCart();
      await syncAllData();
      showToast(`Venta ${res.sale.folio} registrada con éxito`);
      printPosReceipt(res.sale);
    } catch (err) {
      showToast(err.message);
    }
  });
}

function renderPosCatalog() {
  const grid = document.getElementById('posCatalogGrid');
  if (!grid) return;

  const q = (document.getElementById('posCatalogSearch')?.value || '').toLowerCase().trim();
  const cat = document.getElementById('posCategoryFilter')?.value || 'all';

  const list = allProducts.filter(p => {
    if (cat !== 'all' && p.category !== cat) return false;
    if (q) {
      const hay = `${p.sku} ${p.name} ${p.category} ${p.description}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  grid.innerHTML = list.map(p => `
    <div class="pos-prod-item" data-id="${p.id}">
      <div>
        <div class="pos-prod-sku">${p.sku}</div>
        <div class="pos-prod-name">${p.name}</div>
      </div>
      <div class="pos-prod-bottom">
        <span class="pos-prod-price">${formatMoney(p.price)}</span>
        <span class="pos-prod-stock">${p.isService ? 'Servicio' : 'Stock: ' + p.stock}</span>
      </div>
    </div>
  `).join('');

  grid.querySelectorAll('.pos-prod-item').forEach(card => {
    card.addEventListener('click', () => {
      const prod = allProducts.find(p => p.id === card.dataset.id);
      if (!prod) return;
      if (!prod.isService && prod.stock <= 0) {
        showToast('Producto sin existencias en almacén');
        return;
      }
      const existing = posCart.find(i => i.productId === prod.id);
      if (existing) {
        existing.qty += 1;
      } else {
        posCart.push({
          productId: prod.id,
          sku: prod.sku,
          name: prod.name,
          price: prod.price,
          cost: prod.cost,
          qty: 1
        });
      }
      renderPosCart();
    });
  });
}

function renderPosFolioOptions() {
  const select = document.getElementById('posImportFolioSelect');
  if (!select) return;

  const unpaidTickets = allTickets.filter(t => !t.pos?.paid && (parseFloat(t.pos?.total) || 0) > 0);
  const unpaidWs = allWorkshop.filter(w => !w.paid && (parseFloat(w.total) || 0) > 0);

  select.innerHTML = `<option value="">— Venta directa de mostrador —</option>` +
    unpaidTickets.map(t => `<option value="${t.folio}">[Ticket ${t.folio}] ${t.name} (${formatMoney(t.pos.total)})</option>`).join('') +
    unpaidWs.map(w => {
      const bal = Math.max(0, (parseFloat(w.total) || 0) - (parseFloat(w.advancePayment) || 0));
      return `<option value="${w.folio}">[Taller ${w.folio}] ${w.clientName} (Saldo: ${formatMoney(bal)})</option>`;
    }).join('');
}

function loadFolioIntoPosCart(folio) {
  posLinkedFolio = folio;
  const sel = document.getElementById('posImportFolioSelect');
  if (sel) sel.value = folio;

  if (folio.startsWith('FL-')) {
    const t = allTickets.find(x => x.folio === folio);
    if (!t) return;
    document.getElementById('posClientName').value = `${t.name}${t.company ? ' (' + t.company + ')' : ''}`;
    posCart = (t.pos?.items || []).map(it => ({
      productId: it.productId || null,
      sku: folio,
      name: `${it.concept} [${folio}]`,
      price: parseFloat(it.price) || 0,
      cost: 0,
      qty: Number(it.qty) || 1
    }));
  } else if (folio.startsWith('OS-')) {
    const w = allWorkshop.find(x => x.folio === folio);
    if (!w) return;
    document.getElementById('posClientName').value = w.clientName;
    posCart = (w.parts || []).map(p => ({
      productId: p.productId || null,
      sku: folio,
      name: `${p.concept} [${folio}]`,
      price: parseFloat(p.price) || 0,
      cost: 0,
      qty: Number(p.qty) || 1
    }));
    if ((parseFloat(w.laborCost) || 0) > 0) {
      posCart.push({
        productId: null,
        sku: folio,
        name: `Mano de Obra Laboratorio [${folio}]`,
        price: parseFloat(w.laborCost),
        cost: 0,
        qty: 1
      });
    }
    if ((parseFloat(w.advancePayment) || 0) > 0) {
      document.getElementById('posDiscountInput').value = w.advancePayment;
    }
  }

  renderPosCart();
  showToast(`Cargos de ${folio} importados a la caja`);
}

function renderPosCart() {
  const container = document.getElementById('posCartList');
  if (!container) return;

  if (posCart.length === 0) {
    container.innerHTML = `<div style="text-align:center; color:var(--text-muted); padding:35px 10px; font-size:0.84rem;">Selecciona productos de la izquierda o importa un folio para cobrar.</div>`;
    updatePosTotals();
    return;
  }

  container.innerHTML = posCart.map((item, idx) => `
    <div class="cart-line">
      <div style="flex:1; min-width:0;">
        <div style="font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${item.name}</div>
        <div class="mono" style="font-size:0.75rem; color:var(--text-muted);">${formatMoney(item.price)} c/u</div>
      </div>
      <div class="cart-qty-controls">
        <button type="button" class="qty-btn" data-idx="${idx}" data-delta="-1">-</button>
        <span class="mono" style="min-width:20px; text-align:center;">${item.qty}</span>
        <button type="button" class="qty-btn" data-idx="${idx}" data-delta="1">+</button>
      </div>
      <strong class="mono" style="min-width:75px; text-align:right;">${formatMoney(item.price * item.qty)}</strong>
      <button type="button" class="del-item-btn" data-idx="${idx}">✕</button>
    </div>
  `).join('');

  container.querySelectorAll('.qty-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.idx);
      const delta = Number(btn.dataset.delta);
      posCart[idx].qty += delta;
      if (posCart[idx].qty <= 0) posCart.splice(idx, 1);
      renderPosCart();
    });
  });

  container.querySelectorAll('.del-item-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      posCart.splice(Number(btn.dataset.idx), 1);
      renderPosCart();
    });
  });

  updatePosTotals();
}

function updatePosTotals() {
  const subtotal = posCart.reduce((s, i) => s + i.price * i.qty, 0);
  const discount = Math.max(0, parseFloat(document.getElementById('posDiscountInput')?.value) || 0);
  const total = Math.max(0, subtotal - discount);
  const received = parseFloat(document.getElementById('posAmountReceived')?.value) || 0;
  const change = Math.max(0, received - total);

  document.getElementById('posSummarySubtotal').textContent = formatMoney(subtotal);
  document.getElementById('posSummaryTotal').textContent = formatMoney(total);
  document.getElementById('posChangeDisplay').textContent = formatMoney(change);
}

function renderPosSalesHistory() {
  const tbody = document.getElementById('posSalesHistoryBody');
  if (!tbody) return;

  tbody.innerHTML = allSales.map(s => {
    const d = s.date ? new Date(s.date).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-';
    const isCancelled = s.status === 'cancelada';
    return `
      <tr style="${isCancelled ? 'opacity:0.5;' : ''}">
        <td class="mono"><strong>${s.folio}</strong></td>
        <td>${d}</td>
        <td>${s.clientName}</td>
        <td class="mono">${s.linkedRef || '-'}</td>
        <td>${s.cashier}</td>
        <td><span class="badge badge-blue">${s.paymentMethod}</span></td>
        <td style="text-align:right;" class="mono"><strong>${formatMoney(s.total)}</strong></td>
        <td><span class="badge ${isCancelled ? 'badge-red' : 'badge-green'}">${s.status}</span></td>
        <td style="text-align:right;">
          <button class="btn btn-ghost btn-sm btn-print-sale" data-id="${s.id}">Ticket</button>
          ${!isCancelled && currentUser?.permissions?.canDelete ? `<button class="btn btn-danger btn-sm btn-cancel-sale" data-id="${s.id}">Cancelar</button>` : ''}
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('.btn-print-sale').forEach(btn => {
    btn.addEventListener('click', () => {
      const sale = allSales.find(x => x.id === btn.dataset.id);
      if (sale) printPosReceipt(sale);
    });
  });

  tbody.querySelectorAll('.btn-cancel-sale').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('¿Cancelar esta venta y devolver los productos al inventario?')) return;
      await erpService.cancelSale(btn.dataset.id);
      await syncAllData();
      showToast('Venta cancelada y stock restaurado');
    });
  });
}

// ==========================================
// 8. VIEW 5: STORE & INVENTORY MODULE (TIENDA)
// ==========================================
function initStoreModule() {
  document.getElementById('storeSearchInput')?.addEventListener('input', renderStoreTable);
  document.getElementById('storeCategoryFilter')?.addEventListener('change', renderStoreTable);

  document.getElementById('btnOpenNewProductModal')?.addEventListener('click', () => {
    document.getElementById('productForm').reset();
    document.getElementById('prodId').value = '';
    document.getElementById('prodModalTitle').textContent = 'Registrar Nuevo Producto / Servicio';
    openModal('productModal');
  });

  const prodForm = document.getElementById('productForm');
  prodForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('prodId').value;
    const payload = {
      sku: document.getElementById('prodSku').value.trim(),
      category: document.getElementById('prodCategory').value,
      name: document.getElementById('prodName').value.trim(),
      cost: parseFloat(document.getElementById('prodCost').value) || 0,
      price: parseFloat(document.getElementById('prodPrice').value) || 0,
      stock: parseInt(document.getElementById('prodStock').value, 10) || 0,
      minStock: parseInt(document.getElementById('prodMinStock').value, 10) || 0,
      description: document.getElementById('prodDescription').value.trim(),
      specs: document.getElementById('prodSpecs').value,
      publicVisible: document.getElementById('prodPublicVisible').checked,
      isService: document.getElementById('prodIsService').checked
    };

    try {
      if (id) {
        await erpService.updateProduct(id, payload);
        showToast('Producto actualizado');
      } else {
        await erpService.createProduct(payload);
        showToast('Producto agregado al catálogo');
      }
      closeModal('productModal');
      await syncAllData();
    } catch (err) {
      showToast(err.message);
    }
  });
}

function renderStoreTable() {
  const tbody = document.getElementById('storeProductsTableBody');
  if (!tbody) return;

  const q = (document.getElementById('storeSearchInput')?.value || '').toLowerCase().trim();
  const cat = document.getElementById('storeCategoryFilter')?.value || 'all';

  const filtered = allProducts.filter(p => {
    if (cat !== 'all' && p.category !== cat) return false;
    if (q) {
      const hay = `${p.sku} ${p.name} ${p.category} ${p.description}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  tbody.innerHTML = filtered.map(p => {
    const isLow = !p.isService && Number(p.stock) <= Number(p.minStock || 3);
    return `
      <tr>
        <td class="mono"><strong>${p.sku}</strong></td>
        <td>
          <strong>${p.name}</strong>
          <div style="font-size:0.76rem; color:var(--text-muted);">${p.description || ''}</div>
        </td>
        <td><span class="badge badge-blue">${CATEGORY_LABELS[p.category] || p.category}</span></td>
        <td style="text-align:right;" class="mono">${formatMoney(p.cost)}</td>
        <td style="text-align:right;" class="mono"><strong>${formatMoney(p.price)}</strong></td>
        <td style="text-align:center;">
          ${p.isService
            ? '<span class="badge badge-purple">Servicio</span>'
            : `<span class="badge ${isLow ? 'badge-red' : 'badge-green'}">${p.stock} ${p.unit || 'pza'}</span>`
          }
        </td>
        <td style="text-align:center;">
          <span class="badge ${p.publicVisible !== false ? 'badge-green' : 'badge-amber'}">${p.publicVisible !== false ? 'Visible' : 'Oculto'}</span>
        </td>
        <td style="text-align:right; white-space:nowrap;">
          ${!p.isService ? `
            <button class="btn btn-secondary btn-sm btn-stock-adj" data-id="${p.id}" data-delta="1" title="Entrada rápida +1">+1</button>
            <button class="btn btn-secondary btn-sm btn-stock-adj" data-id="${p.id}" data-delta="-1" title="Salida rápida -1">-1</button>
          ` : ''}
          <button class="btn btn-ghost btn-sm btn-edit-prod" data-id="${p.id}">Editar</button>
          ${currentUser?.permissions?.canDelete ? `<button class="btn btn-danger btn-sm btn-del-prod" data-id="${p.id}">✕</button>` : ''}
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('.btn-stock-adj').forEach(btn => {
    btn.addEventListener('click', async () => {
      await erpService.adjustStock(btn.dataset.id, Number(btn.dataset.delta), 'Ajuste rápido en tabla');
      await syncAllData();
      showToast('Existencia actualizada');
    });
  });

  tbody.querySelectorAll('.btn-edit-prod').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = allProducts.find(x => x.id === btn.dataset.id);
      if (!p) return;
      document.getElementById('prodId').value = p.id;
      document.getElementById('prodSku').value = p.sku;
      document.getElementById('prodCategory').value = p.category;
      document.getElementById('prodName').value = p.name;
      document.getElementById('prodCost').value = p.cost || 0;
      document.getElementById('prodPrice').value = p.price || 0;
      document.getElementById('prodStock').value = p.stock || 0;
      document.getElementById('prodMinStock').value = p.minStock || 0;
      document.getElementById('prodDescription').value = p.description || '';
      document.getElementById('prodSpecs').value = Array.isArray(p.specs) ? p.specs.join(', ') : '';
      document.getElementById('prodPublicVisible').checked = p.publicVisible !== false;
      document.getElementById('prodIsService').checked = Boolean(p.isService);
      document.getElementById('prodModalTitle').textContent = `Editar: ${p.name}`;
      openModal('productModal');
    });
  });

  tbody.querySelectorAll('.btn-del-prod').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('¿Eliminar este producto del catálogo?')) return;
      await erpService.deleteProduct(btn.dataset.id);
      await syncAllData();
      showToast('Producto eliminado');
    });
  });
}

// ==========================================
// 9. VIEW 6: REPORTS & ANALYTICS MODULE
// ==========================================
function initReportsModule() {
  document.getElementById('btnExportSalesCsv')?.addEventListener('click', exportSalesToCSV);
  document.getElementById('btnPrintExecutiveReport')?.addEventListener('click', printExecutiveReport);
}

function renderReportsView() {
  if (!reportsData) return;
  const fin = reportsData.financials;
  const inv = reportsData.inventory;

  const kpiEl = document.getElementById('reportsFinancialKpis');
  if (kpiEl) {
    kpiEl.innerHTML = `
      <div class="kpi-card">
        <span class="kpi-label">Ventas Brutas Totales</span>
        <div class="kpi-value accent">${formatMoney(fin.grossRevenue)}</div>
        <span class="kpi-sub">Ticket Promedio: ${formatMoney(fin.avgTicketSale)}</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">Utilidad Bruta Estimada</span>
        <div class="kpi-value">${formatMoney(fin.estimatedProfit)}</div>
        <span class="kpi-sub">Costo de lo vendido: ${formatMoney(fin.estimatedCost)}</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">Cuentas por Cobrar</span>
        <div class="kpi-value cyan">${formatMoney(fin.pendingReceivables)}</div>
        <span class="kpi-sub">Tickets: ${formatMoney(fin.pendingTicketsBalance)} · Taller: ${formatMoney(fin.pendingWorkshopBalance)}</span>
      </div>
      <div class="kpi-card">
        <span class="kpi-label">Valor Comercial Almacén</span>
        <div class="kpi-value">${formatMoney(inv.inventoryRetailValue)}</div>
        <span class="kpi-sub">Costo en stock: ${formatMoney(inv.inventoryCostValue)}</span>
      </div>
    `;
  }

  // Payment breakdown
  const payEl = document.getElementById('reportsPaymentBreakdown');
  if (payEl) {
    const totalRev = Math.max(1, fin.grossRevenue);
    const methods = Object.entries(fin.byPaymentMethod || {});
    payEl.innerHTML = methods.map(([m, val]) => `
      <div class="sbar-row">
        <div class="sbar-top"><span>${m}</span><strong class="mono">${formatMoney(val)}</strong></div>
        <div class="sbar-track"><div class="sbar-fill" style="width:${Math.round((val / totalRev) * 100)}%;"></div></div>
      </div>
    `).join('');
  }

  // Top products
  const topBody = document.getElementById('reportsTopProductsBody');
  if (topBody) {
    const top = reportsData.topProducts || [];
    topBody.innerHTML = top.map(item => `
      <tr>
        <td class="mono">${item.sku}</td>
        <td>${item.name}</td>
        <td style="text-align:center;" class="mono">${item.qty}</td>
        <td style="text-align:right;" class="mono"><strong>${formatMoney(item.revenue)}</strong></td>
      </tr>
    `).join('');
  }

  // Technician performance
  const techBody = document.getElementById('reportsTechPerformanceBody');
  if (techBody) {
    const techs = reportsData.technicians || [];
    techBody.innerHTML = techs.map(t => `
      <tr>
        <td><strong>${t.name}</strong></td>
        <td style="text-align:center;" class="mono">${t.ticketsActive}</td>
        <td style="text-align:center;" class="mono"><span class="badge badge-green">${t.ticketsResolved}</span></td>
        <td style="text-align:center;" class="mono">${t.workshopActive}</td>
        <td style="text-align:center;" class="mono"><span class="badge badge-blue">${t.workshopReady}</span></td>
      </tr>
    `).join('');
  }

  // Inventory valuation summary
  const invEl = document.getElementById('reportsInventoryValuation');
  if (invEl) {
    const potentialProfit = inv.inventoryRetailValue - inv.inventoryCostValue;
    invEl.innerHTML = `
      <div class="sbar-row"><div class="sbar-top"><span>Total de Productos / Servicios en Catálogo</span><strong class="mono">${inv.totalCatalogItems}</strong></div></div>
      <div class="sbar-row"><div class="sbar-top"><span>Artículos Físicos Inventariables</span><strong class="mono">${inv.physicalItemsCount}</strong></div></div>
      <div class="sbar-row"><div class="sbar-top"><span>Artículos con Alerta de Stock Bajo</span><strong class="mono" style="color:var(--danger);">${inv.lowStockCount}</strong></div></div>
      <div class="sbar-row"><div class="sbar-top"><span>Valor de Almacén al Costo</span><strong class="mono">${formatMoney(inv.inventoryCostValue)}</strong></div></div>
      <div class="sbar-row"><div class="sbar-top"><span>Utilidad Potencial en Inventario</span><strong class="mono" style="color:var(--primary);">${formatMoney(potentialProfit)}</strong></div></div>
    `;
  }
}

function exportSalesToCSV() {
  const headers = ['Folio', 'Fecha', 'Cliente', 'Referencia', 'Cajero', 'MetodoPago', 'Subtotal', 'Descuento', 'Total', 'Estado'];
  const rows = allSales.map(s => [
    s.folio,
    s.date,
    `"${(s.clientName || '').replace(/"/g, '""')}"`,
    s.linkedRef || '',
    `"${(s.cashier || '').replace(/"/g, '""')}"`,
    s.paymentMethod,
    s.subtotal,
    s.discount,
    s.total,
    s.status
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `fiberlink-reporte-ventas-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Archivo CSV descargado');
}

// ==========================================
// 10. VIEW 7: USERS & ROLES MODULE
// ==========================================
function initUsersModule() {
  document.getElementById('btnOpenNewUserModal')?.addEventListener('click', () => {
    document.getElementById('userForm').reset();
    document.getElementById('usrId').value = '';
    document.getElementById('usrUsername').disabled = false;
    document.getElementById('userModalTitle').textContent = 'Registrar Nuevo Usuario';
    openModal('userModal');
  });

  const userForm = document.getElementById('userForm');
  userForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('usrId').value;
    const payload = {
      name: document.getElementById('usrName').value.trim(),
      username: document.getElementById('usrUsername').value.trim(),
      password: document.getElementById('usrPassword').value.trim(),
      role: document.getElementById('usrRole').value,
      phone: document.getElementById('usrPhone').value.trim(),
      specialty: document.getElementById('usrSpecialty').value.trim()
    };

    try {
      if (id) {
        await erpService.updateUser(id, payload);
        showToast('Usuario actualizado');
      } else {
        await erpService.createUser(payload);
        showToast('Usuario creado exitosamente');
      }
      closeModal('userModal');
      await syncAllData();
    } catch (err) {
      showToast(err.message);
    }
  });
}

function renderUsersTable() {
  const tbody = document.getElementById('usersTableBody');
  if (!tbody) return;

  tbody.innerHTML = allUsers.map(u => `
    <tr>
      <td><strong>${u.name}</strong></td>
      <td class="mono">@${u.username}</td>
      <td><span class="badge badge-purple">${u.permissions?.label || u.role}</span></td>
      <td>${u.specialty || '-'}</td>
      <td>${u.phone || u.email || '-'}</td>
      <td><span class="badge ${u.active !== false ? 'badge-green' : 'badge-red'}">${u.active !== false ? 'Activo' : 'Inactivo'}</span></td>
      <td style="text-align:right;">
        <button class="btn btn-ghost btn-sm btn-edit-usr" data-id="${u.id}">Editar</button>
        ${u.username !== 'admin' ? `<button class="btn btn-danger btn-sm btn-del-usr" data-id="${u.id}">✕</button>` : ''}
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('.btn-edit-usr').forEach(btn => {
    btn.addEventListener('click', () => {
      const u = allUsers.find(x => x.id === btn.dataset.id);
      if (!u) return;
      document.getElementById('usrId').value = u.id;
      document.getElementById('usrName').value = u.name;
      document.getElementById('usrUsername').value = u.username;
      document.getElementById('usrUsername').disabled = true;
      document.getElementById('usrPassword').value = '';
      document.getElementById('usrRole').value = u.role;
      document.getElementById('usrPhone').value = u.phone || '';
      document.getElementById('usrSpecialty').value = u.specialty || '';
      document.getElementById('userModalTitle').textContent = `Editar Usuario: ${u.name}`;
      openModal('userModal');
    });
  });

  tbody.querySelectorAll('.btn-del-usr').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('¿Eliminar esta cuenta de usuario?')) return;
      await erpService.deleteUser(btn.dataset.id);
      await syncAllData();
      showToast('Usuario eliminado');
    });
  });
}

// ==========================================
// 11. DEDICATED PRINT GENERATORS
// ==========================================
function printPosReceipt(sale) {
  const area = document.getElementById('printArea');
  if (!area) return;
  area.innerHTML = `
    <div style="max-width:320px; margin:0 auto; font-family:monospace; color:#000;">
      <h2 style="text-align:center; margin-bottom:4px;">FIBERLINK SERVICIOS TIC</h2>
      <p style="text-align:center; font-size:12px; margin-bottom:10px;">Teziutlán, Puebla · Tel: 231 102 4672<br>Soporte, Redes, CCTV y Punto de Venta</p>
      <hr>
      <p style="font-size:12px; margin:6px 0;">
        <strong>Folio Venta:</strong> ${sale.folio}<br>
        <strong>Fecha:</strong> ${new Date(sale.date).toLocaleString('es-MX')}<br>
        <strong>Cliente:</strong> ${sale.clientName}<br>
        <strong>Cajero:</strong> ${sale.cashier}<br>
        ${sale.linkedRef ? `<strong>Ref. Servicio:</strong> ${sale.linkedRef}<br>` : ''}
      </p>
      <hr>
      <table style="width:100%; font-size:12px; border-collapse:collapse; margin:6px 0;">
        <thead>
          <tr><th align="left">Cant. Concepto</th><th align="right">Importe</th></tr>
        </thead>
        <tbody>
          ${(sale.items || []).map(i => `
            <tr>
              <td>${i.qty}x ${i.name}</td>
              <td align="right">${formatMoney(i.subtotal || i.price * i.qty)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
      <hr>
      <p style="text-align:right; font-size:13px; margin:6px 0;">
        Subtotal: ${formatMoney(sale.subtotal)}<br>
        ${sale.discount > 0 ? `Descuento: -${formatMoney(sale.discount)}<br>` : ''}
        <strong>TOTAL: ${formatMoney(sale.total)}</strong><br>
        Método: ${sale.paymentMethod}<br>
        Recibido: ${formatMoney(sale.amountReceived)} · Cambio: ${formatMoney(sale.change)}
      </p>
      <hr>
      <p style="text-align:center; font-size:11px; margin-top:10px;">¡Gracias por su preferencia!<br>Garantía y soporte local en Teziutlán</p>
    </div>
  `;
  window.print();
}

function printWorkshopDocument(order) {
  const area = document.getElementById('printArea');
  if (!area) return;
  const balance = Math.max(0, (parseFloat(order.total) || 0) - (parseFloat(order.advancePayment) || 0));
  area.innerHTML = `
    <div style="max-width:700px; margin:0 auto; font-family:Arial,sans-serif; color:#000;">
      <div style="display:flex; justify-content:space-between; border-bottom:2px solid #000; padding-bottom:10px;">
        <div>
          <h2>FIBERLINK SERVICIOS TIC — LABORATORIO TÉCNICO</h2>
          <p style="font-size:12px;">Teziutlán, Puebla · Tel/WhatsApp: 231 102 4672</p>
        </div>
        <div style="text-align:right;">
          <h3 style="margin:0;">ORDEN: ${order.folio}</h3>
          <p style="font-size:12px;">Ingreso: ${new Date(order.createdAt).toLocaleString('es-MX')}</p>
        </div>
      </div>
      <div style="margin:15px 0; font-size:13px;">
        <p><strong>Cliente:</strong> ${order.clientName} &nbsp;&nbsp;|&nbsp;&nbsp; <strong>Teléfono:</strong> ${order.clientPhone}</p>
        <p><strong>Equipo:</strong> ${order.deviceType} ${order.brand} ${order.model} &nbsp;&nbsp;|&nbsp;&nbsp; <strong>N/S:</strong> ${order.serialNumber}</p>
        <p><strong>Accesorios recibidos:</strong> ${order.accessories}</p>
        <p><strong>Falla reportada:</strong> ${order.reportedFault}</p>
        <p><strong>Diagnóstico técnico:</strong> ${order.technicalDiagnosis}</p>
      </div>
      <hr>
      <p style="text-align:right; font-size:14px; margin:12px 0;">
        Total Presupuesto: <strong>${formatMoney(order.total)}</strong> &nbsp;|&nbsp;
        Anticipo: <strong>${formatMoney(order.advancePayment)}</strong> &nbsp;|&nbsp;
        Saldo Pendiente: <strong>${formatMoney(balance)}</strong>
      </p>
      <div style="margin-top:50px; display:flex; justify-content:space-around; text-align:center; font-size:12px;">
        <div>___________________________<br>Firma de Conformidad Cliente</div>
        <div>___________________________<br>Recibió en Taller (${order.assignedTech})</div>
      </div>
    </div>
  `;
  window.print();
}

function printTicketDocument(ticket) {
  const area = document.getElementById('printArea');
  if (!area) return;
  area.innerHTML = `
    <div style="max-width:700px; margin:0 auto; font-family:Arial,sans-serif; color:#000;">
      <h2>FIBERLINK SERVICIOS TIC — ORDEN DE SERVICIO ${ticket.folio}</h2>
      <p style="font-size:12px;">Fecha: ${new Date(ticket.createdAt).toLocaleString('es-MX')} · Estado: ${ticket.estado.toUpperCase()}</p>
      <hr style="margin:10px 0;">
      <p><strong>Cliente:</strong> ${ticket.name} ${ticket.company ? '(' + ticket.company + ')' : ''}</p>
      <p><strong>Teléfono:</strong> ${ticket.phone} · <strong>Ubicación:</strong> ${ticket.address}</p>
      <p><strong>Servicio:</strong> ${ticket.service} (${ticket.modality}) · <strong>Técnico:</strong> ${ticket.assignedTo || 'Por asignar'}</p>
      <p style="margin:10px 0;"><strong>Descripción:</strong> ${ticket.description}</p>
      <hr style="margin:10px 0;">
      <h4>Conceptos / Cotización</h4>
      <table style="width:100%; border-collapse:collapse; margin-top:8px; font-size:13px;">
        ${(ticket.pos?.items || []).map(i => `<tr><td>${i.concept}</td><td align="right">${formatMoney(i.price)}</td></tr>`).join('')}
        <tr><td><strong>TOTAL</strong></td><td align="right"><strong>${formatMoney(ticket.pos?.total || 0)}</strong></td></tr>
      </table>
    </div>
  `;
  window.print();
}

function printExecutiveReport() {
  if (!reportsData) return;
  const fin = reportsData.financials;
  const area = document.getElementById('printArea');
  if (!area) return;
  area.innerHTML = `
    <div style="max-width:750px; margin:0 auto; font-family:Arial,sans-serif; color:#000;">
      <h2>FIBERLINK SERVICIOS TIC — REPORTE EJECUTIVO DE OPERACIONES</h2>
      <p style="font-size:12px;">Generado el: ${new Date().toLocaleString('es-MX')} por ${currentUser?.name || 'Admin'}</p>
      <hr style="margin:12px 0;">
      <h3>1. Resumen Financiero</h3>
      <p>Ingresos Brutos (POS): <strong>${formatMoney(fin.grossRevenue)}</strong> (${fin.totalSalesCount} ventas)</p>
      <p>Utilidad Estimada: <strong>${formatMoney(fin.estimatedProfit)}</strong></p>
      <p>Cuentas por Cobrar (Tickets + Taller): <strong>${formatMoney(fin.pendingReceivables)}</strong></p>
      <hr style="margin:12px 0;">
      <h3>2. Desglose por Método de Pago</h3>
      <ul>
        ${Object.entries(fin.byPaymentMethod || {}).map(([m, v]) => `<li>${m}: ${formatMoney(v)}</li>`).join('')}
      </ul>
    </div>
  `;
  window.print();
}
