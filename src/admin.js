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

// UI State
let chartPeriod = '7d';
let overviewTxFilter = 'all';
let ticketsViewMode = 'kanban'; // 'kanban' | 'table'
let currentTicketId = null;
let currentWorkshopOrder = null;
let currentWorkshopParts = [];
let posCart = [];
let posLinkedFolio = '';

// Command Palette state
let cmdItems = [];
let cmdSelectedIndex = 0;

const VIEW_META = {
  overview: { title: 'Resumen Ejecutivo & Bento', bc: 'Resumen Bento' },
  tickets: { title: 'Mesa de Control de Tickets', bc: 'Tickets Soporte' },
  workshop: { title: 'Laboratorio y Taller Técnico', bc: 'Taller & Lab' },
  pos: { title: 'Terminal Punto de Venta (POS)', bc: 'Punto de Venta' },
  store: { title: 'Catálogo, Tienda e Inventario', bc: 'Tienda & Stock' },
  reports: { title: 'Analítica Financiera y Corte', bc: 'Reportes & Caja' },
  users: { title: 'Usuarios, Roles y Seguridad RBAC', bc: 'Usuarios & Roles' }
};

const WORKSHOP_STATE_LABELS = {
  recepcion: { label: 'Recepción', badge: 'badge-purple', dot: 'dot-purple' },
  diagnostico: { label: 'Diagnóstico', badge: 'badge-amber', dot: 'dot-amber' },
  esperando_refaccion: { label: 'Esp. Refacción', badge: 'badge-red', dot: 'dot-red' },
  en_reparacion: { label: 'En Reparación', badge: 'badge-blue', dot: 'dot-blue' },
  listo_entrega: { label: 'Listo Entrega', badge: 'badge-green', dot: 'dot-lime' },
  entregado: { label: 'Entregado', badge: 'badge-green', dot: 'dot-lime' },
  garantia: { label: 'Garantía', badge: 'badge-red', dot: 'dot-red' }
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
  initTheme();
  initModalsClose();
  initAuth();
  initNavigationAndShell();
  initCommandPalette();
  initOverviewControls();
  initTicketsModule();
  initWorkshopModule();
  initPosModule();
  initStoreModule();
  initReportsModule();
  initUsersModule();
});

// ==========================================
// UTILITIES & EMPTY STATE GENERATOR
// ==========================================
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

function renderEmptyState(title, subtitle) {
  return `
    <div class="empty-state-box">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <rect width="18" height="18" x="3" y="3" rx="2"/>
        <path d="M3 9h18"/>
        <path d="M9 21V9"/>
      </svg>
      <h4>${title}</h4>
      <p>${subtitle}</p>
    </div>
  `;
}

// ==========================================
// 1. THEME ENGINE (DARK / LIGHT)
// ==========================================
function initTheme() {
  const saved = localStorage.getItem('fiberlink_erp_theme') || 'dark';
  applyTheme(saved);

  document.getElementById('themeToggleBtn')?.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = current === 'dark' ? 'light' : 'dark';
    applyTheme(next);
    showToast(`Tema cambiado a modo ${next === 'dark' ? 'Oscuro Premium' : 'Claro Limpio'}`);
  });
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('fiberlink_erp_theme', theme);
}

// ==========================================
// 2. AUTHENTICATION & ROLES (RBAC)
// ==========================================
function initAuth() {
  const loginOverlay = document.getElementById('loginOverlay');
  const dashboard = document.getElementById('dashboard');
  const loginForm = document.getElementById('loginForm');
  const loginError = document.getElementById('loginError');
  const logoutBtn = document.getElementById('logoutBtn');

  document.querySelectorAll('.qr-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('loginUser').value = btn.dataset.user;
      document.getElementById('loginPass').value = btn.dataset.pass;
      loginForm.requestSubmit();
    });
  });

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
      showToast(`Sesión iniciada: ${currentUser.name} (${currentUser.permissions?.label || currentUser.role})`);
    } catch (err) {
      loginError.textContent = err.message || 'Credenciales no válidas.';
    }
  });

  logoutBtn?.addEventListener('click', () => {
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

  const initials = (currentUser?.name || 'FL')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join('');

  document.getElementById('ucAvatar').textContent = initials;
  document.getElementById('ucName').textContent = currentUser?.name || 'Usuario';
  document.getElementById('ucRole').textContent = currentUser?.permissions?.label || currentUser?.role || 'Personal';

  const allowedModules = ['overview', 'tickets', 'workshop', 'pos', 'store', 'reports', 'users'];
  document.querySelectorAll('#sidebarNav .nav-btn').forEach(btn => {
    btn.style.display = 'flex';
  });

  document.querySelectorAll('#mobileBottomBar .mnav-item[data-view]').forEach(btn => {
    btn.style.display = 'flex';
  });

  await syncAllData();
  if (!allowedModules.includes(currentView)) {
    switchView('overview');
  } else {
    switchView(currentView);
  }
}

// ==========================================
// 3. HYBRID NAVIGATION, SIDEBAR & DRAWER
// ==========================================
function initNavigationAndShell() {
  const sidebar = document.getElementById('appSidebar');
  const backdrop = document.getElementById('sidebarBackdrop');

  // Restore desktop collapsed preference
  if (localStorage.getItem('fiberlink_sidebar_collapsed') === 'true') {
    sidebar?.classList.add('collapsed');
  }

  document.getElementById('sidebarCollapseBtn')?.addEventListener('click', () => {
    sidebar?.classList.toggle('collapsed');
    localStorage.setItem('fiberlink_sidebar_collapsed', sidebar?.classList.contains('collapsed') ? 'true' : 'false');
  });

  const openMobileDrawer = () => {
    sidebar?.classList.add('mobile-open');
    backdrop?.classList.add('open');
  };
  const closeMobileDrawer = () => {
    sidebar?.classList.remove('mobile-open');
    backdrop?.classList.remove('open');
  };

  document.getElementById('mobileMenuBtn')?.addEventListener('click', openMobileDrawer);
  document.getElementById('mobileMoreMenuBtn')?.addEventListener('click', openMobileDrawer);
  document.getElementById('sidebarMobileCloseBtn')?.addEventListener('click', closeMobileDrawer);
  backdrop?.addEventListener('click', closeMobileDrawer);

  document.querySelectorAll('#sidebarNav .nav-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      switchView(btn.dataset.view);
      closeMobileDrawer();
    });
  });

  document.querySelectorAll('#mobileBottomBar .mnav-item[data-view]').forEach(btn => {
    btn.addEventListener('click', () => {
      switchView(btn.dataset.view);
      closeMobileDrawer();
    });
  });

  document.querySelectorAll('[data-goto]').forEach(btn => {
    btn.addEventListener('click', () => {
      switchView(btn.dataset.goto);
    });
  });

  document.getElementById('refreshBtn')?.addEventListener('click', async () => {
    await syncAllData();
    showToast('Datos sincronizados en tiempo real');
  });

  document.getElementById('quickNewTicketBtn')?.addEventListener('click', () => {
    openModal('newTicketModal');
  });

  document.getElementById('quickNewWorkshopBtn')?.addEventListener('click', () => {
    openWorkshopModalForCreate();
  });
}

function switchView(viewName) {
  const prevView = currentView;
  currentView = viewName;
  document.querySelectorAll('#sidebarNav .nav-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.view === viewName);
  });
  document.querySelectorAll('#mobileBottomBar .mnav-item[data-view]').forEach(b => {
    b.classList.toggle('active', b.dataset.view === viewName);
  });
  document.querySelectorAll('.erp-view').forEach(sec => {
    sec.classList.toggle('active', sec.id === `view-${viewName}`);
  });

  const meta = VIEW_META[viewName] || VIEW_META.overview;
  document.getElementById('topbarTitle').textContent = meta.title;
  const bcEl = document.getElementById('bcCurrent');
  if (bcEl) bcEl.textContent = meta.bc;

  if (prevView === 'pos' && viewName !== 'pos') {
    stopPosCameraScanner();
  }
}

// ==========================================
// 4. COMMAND PALETTE (⌘K / Ctrl+K)
// ==========================================
function initCommandPalette() {
  const openCmd = () => {
    openModal('cmdPaletteModal');
    const input = document.getElementById('cmdSearchInput');
    if (input) {
      input.value = '';
      renderCommandResults('');
      setTimeout(() => input.focus(), 40);
    }
  };

  document.getElementById('sidebarCmdBtn')?.addEventListener('click', openCmd);
  document.getElementById('topbarCmdBtn')?.addEventListener('click', openCmd);

  window.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      const modal = document.getElementById('cmdPaletteModal');
      if (modal?.classList.contains('open')) {
        closeModal('cmdPaletteModal');
      } else {
        openCmd();
      }
    } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
      e.preventDefault();
      document.getElementById('sidebarCollapseBtn')?.click();
    } else if (e.key === 'Escape') {
      document.querySelectorAll('.modal.open').forEach(m => m.classList.remove('open'));
    }
  });

  const cmdInput = document.getElementById('cmdSearchInput');
  cmdInput?.addEventListener('input', (e) => {
    cmdSelectedIndex = 0;
    renderCommandResults(e.target.value);
  });

  cmdInput?.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      cmdSelectedIndex = (cmdSelectedIndex + 1) % Math.max(1, cmdItems.length);
      highlightCmdSelection();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      cmdSelectedIndex = (cmdSelectedIndex - 1 + Math.max(1, cmdItems.length)) % Math.max(1, cmdItems.length);
      highlightCmdSelection();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (cmdItems[cmdSelectedIndex]) {
        cmdItems[cmdSelectedIndex].run();
      }
    }
  });
}

function renderCommandResults(query) {
  const q = (query || '').toLowerCase().trim();
  const listEl = document.getElementById('cmdResultsList');
  if (!listEl) return;

  const baseActions = [
    { group: 'Acciones Rápidas', title: 'Crear Nuevo Ticket de Soporte', sub: 'Acción', run: () => { closeModal('cmdPaletteModal'); openModal('newTicketModal'); } },
    { group: 'Acciones Rápidas', title: 'Ingresar Equipo a Laboratorio / Taller', sub: 'Acción', run: () => { closeModal('cmdPaletteModal'); openWorkshopModalForCreate(); } },
    { group: 'Acciones Rápidas', title: 'Abrir Terminal Punto de Venta (POS)', sub: 'Módulo', run: () => { closeModal('cmdPaletteModal'); switchView('pos'); } },
    { group: 'Acciones Rápidas', title: 'Registrar Producto en Tienda / Almacén', sub: 'Acción', run: () => { closeModal('cmdPaletteModal'); document.getElementById('btnOpenNewProductModal')?.click(); } },
    { group: 'Acciones Rápidas', title: 'Alternar Tema Oscuro / Claro', sub: 'Preferencia', run: () => { closeModal('cmdPaletteModal'); document.getElementById('themeToggleBtn')?.click(); } },
    { group: 'Acciones Rápidas', title: 'Exportar Reporte de Ventas a CSV', sub: 'Reporte', run: () => { closeModal('cmdPaletteModal'); exportSalesToCSV(); } },
    { group: 'Navegación', title: 'Ir a Resumen Ejecutivo Bento', sub: 'Vista', run: () => { closeModal('cmdPaletteModal'); switchView('overview'); } },
    { group: 'Navegación', title: 'Ir a Tablero de Tickets', sub: 'Vista', run: () => { closeModal('cmdPaletteModal'); switchView('tickets'); } },
    { group: 'Navegación', title: 'Ir a Taller Técnico', sub: 'Vista', run: () => { closeModal('cmdPaletteModal'); switchView('workshop'); } },
    { group: 'Navegación', title: 'Ir a Tienda e Inventario', sub: 'Vista', run: () => { closeModal('cmdPaletteModal'); switchView('store'); } },
    { group: 'Navegación', title: 'Ir a Reportes y Corte de Caja', sub: 'Vista', run: () => { closeModal('cmdPaletteModal'); switchView('reports'); } }
  ];

  const ticketMatches = allTickets.map(t => ({
    group: 'Tickets de Soporte',
    title: `${t.folio} — ${t.name}${t.company ? ' (' + t.company + ')' : ''}`,
    sub: `${t.service} · ${t.estado.toUpperCase()}`,
    run: () => { closeModal('cmdPaletteModal'); openTicketDetail(t.id); }
  }));

  const wsMatches = allWorkshop.map(w => ({
    group: 'Órdenes de Taller',
    title: `${w.folio} — ${w.deviceType} ${w.brand} (${w.clientName})`,
    sub: `${w.serialNumber} · ${formatMoney(w.total)}`,
    run: () => { closeModal('cmdPaletteModal'); openWorkshopModalForEdit(w); }
  }));

  const prodMatches = allProducts.map(p => ({
    group: 'Catálogo & Almacén',
    title: `[${p.sku}] ${p.name}`,
    sub: `${formatMoney(p.price)} · Stock: ${p.isService ? 'Servicio' : p.stock}`,
    run: () => {
      closeModal('cmdPaletteModal');
      switchView('store');
      const input = document.getElementById('storeSearchInput');
      if (input) { input.value = p.sku; renderStoreTable(); }
    }
  }));

  const allCandidates = [...baseActions, ...ticketMatches, ...wsMatches, ...prodMatches];
  cmdItems = allCandidates.filter(item => {
    if (!q) return item.group === 'Acciones Rápidas' || item.group === 'Navegación';
    return `${item.title} ${item.sub} ${item.group}`.toLowerCase().includes(q);
  }).slice(0, 14);

  if (cmdItems.length === 0) {
    listEl.innerHTML = renderEmptyState('Sin coincidencias', 'Prueba buscando otro folio (FL-, OS-), cliente o comando.');
    return;
  }

  let html = '';
  let lastGroup = '';
  cmdItems.forEach((item, idx) => {
    if (item.group !== lastGroup) {
      lastGroup = item.group;
      html += `<div class="cmd-group-title">${lastGroup}</div>`;
    }
    html += `
      <button type="button" class="cmd-item ${idx === cmdSelectedIndex ? 'selected' : ''}" data-idx="${idx}">
        <div class="cmd-item-left">
          <span>${item.title}</span>
        </div>
        <span class="cmd-item-sub">${item.sub}</span>
      </button>
    `;
  });

  listEl.innerHTML = html;

  listEl.querySelectorAll('.cmd-item').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.idx);
      if (cmdItems[idx]) cmdItems[idx].run();
    });
  });
}

function highlightCmdSelection() {
  document.querySelectorAll('#cmdResultsList .cmd-item').forEach((el, idx) => {
    el.classList.toggle('selected', idx === cmdSelectedIndex);
    if (idx === cmdSelectedIndex) el.scrollIntoView({ block: 'nearest' });
  });
}

// ==========================================
// 5. GLOBAL DATA SYNC
// ==========================================
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
// 6. VIEW 1: BENTO OVERVIEW & INTERACTIVE CHART
// ==========================================
function initOverviewControls() {
  document.querySelectorAll('#chartPeriodPills .pill-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#chartPeriodPills .pill-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      chartPeriod = btn.dataset.period;
      renderOverviewRevenueChart();
    });
  });

  document.querySelectorAll('#overviewTxFilterPills .pill-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#overviewTxFilterPills .pill-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      overviewTxFilter = btn.dataset.txfilter;
      renderOverviewUnifiedTransactions();
    });
  });
}

function renderOverview() {
  const fin = reportsData?.financials || { grossRevenue: 0, estimatedProfit: 0, pendingReceivables: 0, totalSalesCount: 0 };
  const activeTickets = allTickets.filter(t => t.estado !== 'resuelto').length;
  const urgentTickets = allTickets.filter(t => t.priority === 'Urgente' && t.estado !== 'resuelto').length;
  const activeWs = allWorkshop.filter(w => w.estado !== 'entregado').length;
  const readyWs = allWorkshop.filter(w => w.estado === 'listo_entrega').length;
  const lowStock = allProducts.filter(p => !p.isService && Number(p.stock) <= Number(p.minStock || 3));
  const marginPct = fin.grossRevenue > 0 ? Math.round((fin.estimatedProfit / fin.grossRevenue) * 100) : 48;

  const kpiContainer = document.getElementById('overviewKpis');
  if (kpiContainer) {
    kpiContainer.innerHTML = `
      <div class="kpi-card">
        <div class="kpi-top">
          <span class="kpi-label">INGRESOS LIQUIDADOS (POS)</span>
          <div class="kpi-icon-box">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>
        </div>
        <div class="kpi-mid">
          <div class="kpi-value accent tabular">${formatMoney(fin.grossRevenue)}</div>
          <span class="kpi-delta up">+${marginPct}% margen</span>
        </div>
        <div class="kpi-foot">
          <span>${fin.totalSalesCount} ventas cerradas</span>
          <span class="mono">Utilidad: ${formatMoney(fin.estimatedProfit)}</span>
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-top">
          <span class="kpi-label">CUENTAS POR COBRAR</span>
          <div class="kpi-icon-box" style="color:var(--secondary);">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
          </div>
        </div>
        <div class="kpi-mid">
          <div class="kpi-value cyan tabular">${formatMoney(fin.pendingReceivables)}</div>
          <span class="kpi-delta neutral">En cartera</span>
        </div>
        <div class="kpi-foot">
          <span>Tickets + Laboratorio</span>
          <span class="mono">Por liquidar</span>
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-top">
          <span class="kpi-label">TICKETS DE SOPORTE</span>
          <div class="kpi-icon-box">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/></svg>
          </div>
        </div>
        <div class="kpi-mid">
          <div class="kpi-value tabular ${urgentTickets > 0 ? 'warn' : ''}">${activeTickets}</div>
          <span class="kpi-delta ${urgentTickets > 0 ? 'alert' : 'up'}">${urgentTickets > 0 ? urgentTickets + ' Urgente(s)' : 'SLA 98.4%'}</span>
        </div>
        <div class="kpi-foot">
          <span>${allTickets.filter(t => t.estado === 'resuelto').length} resueltos</span>
          <span class="mono">${allTickets.length} totales</span>
        </div>
      </div>

      <div class="kpi-card">
        <div class="kpi-top">
          <span class="kpi-label">ÓRDENES EN LABORATORIO</span>
          <div class="kpi-icon-box">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
          </div>
        </div>
        <div class="kpi-mid">
          <div class="kpi-value tabular">${activeWs}</div>
          <span class="kpi-delta up">${readyWs} listo(s)</span>
        </div>
        <div class="kpi-foot">
          <span>Equipos en taller</span>
          <span class="mono">${lowStock.length} alertas stock</span>
        </div>
      </div>
    `;
  }

  renderOverviewRevenueChart();
  renderOverviewUnifiedTransactions();

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
        <div class="sbar-top"><span>${r.label}</span><strong class="mono tabular">${r.count}</strong></div>
        <div class="sbar-track"><div class="sbar-fill" style="width:${Math.round((r.count / totalT) * 100)}%; background:${r.color};"></div></div>
      </div>
    `).join('');
  }

  // Workshop bars
  const totalW = Math.max(1, allWorkshop.length);
  const wSummary = document.getElementById('overviewWorkshopSummary');
  if (wSummary) {
    const rows = [
      { label: 'Recepción & Diagnóstico', count: allWorkshop.filter(w => w.estado === 'recepcion' || w.estado === 'diagnostico').length, color: '#f59e0b' },
      { label: 'En Reparación', count: allWorkshop.filter(w => w.estado === 'en_reparacion' || w.estado === 'esperando_refaccion').length, color: '#3b82f6' },
      { label: 'Listos para Entrega', count: allWorkshop.filter(w => w.estado === 'listo_entrega').length, color: '#9cc32e' }
    ];
    wSummary.innerHTML = rows.map(r => `
      <div class="sbar-row">
        <div class="sbar-top"><span>${r.label}</span><strong class="mono tabular">${r.count}</strong></div>
        <div class="sbar-track"><div class="sbar-fill" style="width:${Math.round((r.count / totalW) * 100)}%; background:${r.color};"></div></div>
      </div>
    `).join('');
  }

  // Low stock
  const lowEl = document.getElementById('overviewLowStockList');
  if (lowEl) {
    if (lowStock.length === 0) {
      lowEl.innerHTML = `<div style="font-size:0.79rem; color:var(--text-muted); padding:6px 0;">✓ Inventario físico en niveles óptimos.</div>`;
    } else {
      lowEl.innerHTML = `<div class="table-responsive"><table class="erp-table">
        <thead><tr><th>SKU</th><th>Artículo</th><th style="text-align:right;">Stock</th></tr></thead>
        <tbody>
          ${lowStock.slice(0, 4).map(p => `
            <tr>
              <td data-label="SKU" class="mono">${p.sku}</td>
              <td data-label="Artículo">${p.name}</td>
              <td data-label="Stock" style="text-align:right;"><span class="badge badge-red"><span class="status-dot dot-red"></span>${p.stock} ${p.unit || 'pza'}</span></td>
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
      actEl.innerHTML = `<p style="color:var(--text-muted); font-size:0.8rem;">Sin actividad registrada.</p>`;
    } else {
      actEl.innerHTML = logs.slice(0, 8).map(a => {
        const t = a.date ? new Date(a.date).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
        return `
          <div class="act-item">
            <div><strong>${a.user}:</strong> ${a.action}</div>
            <span class="act-time tabular">${t}</span>
          </div>
        `;
      }).join('');
    }
  }
}

function renderOverviewRevenueChart() {
  const container = document.getElementById('overviewRevenueChart');
  if (!container) return;

  const gross = reportsData?.financials?.grossRevenue || 4200;
  const receivables = reportsData?.financials?.pendingReceivables || 3860;

  const seriesMap = {
    '7d': [
      { label: 'Lun', rev: 1450, proj: 1800 },
      { label: 'Mar', rev: 2100, proj: 2400 },
      { label: 'Mié', rev: 1890, proj: 2200 },
      { label: 'Jue', rev: 2950, proj: 3100 },
      { label: 'Vie', rev: 3420, proj: 3800 },
      { label: 'Sáb', rev: 4100, proj: 4400 },
      { label: 'Hoy', rev: Math.max(2600, gross), proj: Math.max(3200, gross + receivables * 0.5) }
    ],
    '30d': [
      { label: 'Sem 1', rev: 6800, proj: 7500 },
      { label: 'Sem 2', rev: 9200, proj: 10400 },
      { label: 'Sem 3', rev: 11400, proj: 12800 },
      { label: 'Sem 4', rev: 14200 + gross, proj: 16500 + gross }
    ],
    'all': [
      { label: 'Jun', rev: 24500, proj: 26000 },
      { label: 'Jul', rev: 31200, proj: 33000 },
      { label: 'Ago', rev: 28900, proj: 31500 },
      { label: 'Sep', rev: 36400, proj: 39000 },
      { label: 'Oct', rev: 38900 + gross, proj: 44000 + gross }
    ]
  };

  const data = seriesMap[chartPeriod] || seriesMap['7d'];
  const maxVal = Math.max(...data.map(d => Math.max(d.rev, d.proj)), 1000) * 1.12;
  const w = 680;
  const h = 180;
  const padX = 36;
  const padY = 18;
  const stepX = (w - padX * 2) / Math.max(1, data.length - 1);

  const ptsRev = data.map((d, i) => ({
    x: Math.round(padX + i * stepX),
    y: Math.round(h - padY - (d.rev / maxVal) * (h - padY * 2)),
    val: d.rev,
    label: d.label
  }));

  const ptsProj = data.map((d, i) => ({
    x: Math.round(padX + i * stepX),
    y: Math.round(h - padY - (d.proj / maxVal) * (h - padY * 2))
  }));

  const pathRev = ptsRev.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');
  const areaRev = `${pathRev} L${ptsRev[ptsRev.length - 1].x},${h - padY} L${ptsRev[0].x},${h - padY} Z`;
  const pathProj = ptsProj.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ');

  container.innerHTML = `
    <div class="chart-svg-container">
      <svg viewBox="0 0 ${w} ${h}" width="100%" height="100%" preserveAspectRatio="none">
        <defs>
          <linearGradient id="limeAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stop-color="#9cc32e" stop-opacity="0.34"/>
            <stop offset="100%" stop-color="#9cc32e" stop-opacity="0.0"/>
          </linearGradient>
        </defs>
        <!-- Horizontal Grid Lines -->
        <line x1="${padX}" y1="${padY}" x2="${w - padX}" y2="${padY}" stroke="currentColor" stroke-opacity="0.07" stroke-dasharray="3 3"/>
        <line x1="${padX}" y1="${Math.round(h / 2)}" x2="${w - padX}" y2="${Math.round(h / 2)}" stroke="currentColor" stroke-opacity="0.07" stroke-dasharray="3 3"/>
        <line x1="${padX}" y1="${h - padY}" x2="${w - padX}" y2="${h - padY}" stroke="currentColor" stroke-opacity="0.12"/>

        <!-- Projected Cyan Dashed Line -->
        <path d="${pathProj}" fill="none" stroke="#7ce7ff" stroke-width="1.75" stroke-dasharray="4 4" stroke-opacity="0.65"/>

        <!-- Revenue Area & Primary Line -->
        <path d="${areaRev}" fill="url(#limeAreaGrad)"/>
        <path d="${pathRev}" fill="none" stroke="#9cc32e" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>

        <!-- Data Nodes & Labels -->
        ${ptsRev.map(p => `
          <g>
            <circle cx="${p.x}" cy="${p.y}" r="4" fill="#090b07" stroke="#9cc32e" stroke-width="2.2"/>
            <text x="${p.x}" y="${h - 3}" text-anchor="middle" fill="currentColor" opacity="0.55" font-size="10" font-family="JetBrains Mono">${p.label}</text>
          </g>
        `).join('')}
      </svg>
    </div>
    <div class="chart-legend-row">
      <div style="display:flex; align-items:center; gap:16px;">
        <span style="display:inline-flex; align-items:center; gap:6px;"><span class="status-dot dot-lime"></span> Ingresos Liquidados POS</span>
        <span style="display:inline-flex; align-items:center; gap:6px;"><span class="status-dot dot-blue" style="background:#7ce7ff;"></span> Proyección + Cartera Activa</span>
      </div>
      <span class="mono tabular">Total Activo: <strong style="color:var(--primary);">${formatMoney(gross + receivables)}</strong></span>
    </div>
  `;
}

function renderOverviewUnifiedTransactions() {
  const tbody = document.getElementById('overviewUnifiedTxBody');
  if (!tbody) return;

  const rows = [];

  allSales.forEach(s => {
    rows.push({
      type: 'pos',
      folio: s.folio,
      moduleLabel: 'Venta POS',
      client: s.clientName,
      concept: (s.items || []).map(i => `${i.qty}x ${i.name}`).join(', ') || 'Venta de mostrador',
      owner: s.cashier,
      statusLabel: s.status === 'cancelada' ? 'Cancelada' : 'Liquidado',
      badge: s.status === 'cancelada' ? 'badge-red' : 'badge-green',
      dot: s.status === 'cancelada' ? 'dot-red' : 'dot-lime',
      amount: s.total,
      date: s.date,
      onClick: () => switchView('pos')
    });
  });

  allTickets.forEach(t => {
    rows.push({
      type: 'ticket',
      folio: t.folio,
      moduleLabel: 'Ticket Soporte',
      client: `${t.name}${t.company ? ' (' + t.company + ')' : ''}`,
      concept: t.service,
      owner: t.assignedTo || 'Sin asignar',
      statusLabel: t.estado.toUpperCase(),
      badge: t.estado === 'resuelto' ? 'badge-green' : t.priority === 'Urgente' ? 'badge-red' : 'badge-blue',
      dot: t.estado === 'resuelto' ? 'dot-lime' : t.priority === 'Urgente' ? 'dot-red' : 'dot-blue',
      amount: t.pos?.total || 0,
      date: t.createdAt,
      onClick: () => openTicketDetail(t.id)
    });
  });

  allWorkshop.forEach(w => {
    const st = WORKSHOP_STATE_LABELS[w.estado] || { label: w.estado, badge: 'badge-blue', dot: 'dot-blue' };
    rows.push({
      type: 'workshop',
      folio: w.folio,
      moduleLabel: 'Laboratorio',
      client: w.clientName,
      concept: `${w.deviceType} ${w.brand} ${w.model}`,
      owner: w.assignedTech || 'Sin asignar',
      statusLabel: st.label,
      badge: st.badge,
      dot: st.dot,
      amount: w.total || 0,
      date: w.createdAt,
      onClick: () => openWorkshopModalForEdit(w)
    });
  });

  const filtered = rows
    .filter(r => overviewTxFilter === 'all' || r.type === overviewTxFilter)
    .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0))
    .slice(0, 8);

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6">${renderEmptyState('Sin registros', 'No hay transacciones para este filtro.')}</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map((r, idx) => `
    <tr class="tx-clickable-row" data-idx="${idx}" style="cursor:pointer;">
      <td data-label="Folio" class="mono"><strong>${r.folio}</strong></td>
      <td data-label="Módulo"><span class="kbd-tag">${r.moduleLabel}</span></td>
      <td data-label="Cliente / Concepto">
        <div><strong>${r.client}</strong><div style="font-size:0.74rem; color:var(--text-muted);">${r.concept}</div></div>
      </td>
      <td data-label="Responsable">${r.owner}</td>
      <td data-label="Estado"><span class="badge ${r.badge}"><span class="status-dot ${r.dot}"></span>${r.statusLabel}</span></td>
      <td data-label="Monto" style="text-align:right;" class="mono tabular"><strong>${formatMoney(r.amount)}</strong></td>
    </tr>
  `).join('');

  tbody.querySelectorAll('.tx-clickable-row').forEach(tr => {
    tr.addEventListener('click', () => {
      const item = filtered[Number(tr.dataset.idx)];
      if (item?.onClick) item.onClick();
    });
  });
}

// ==========================================
// 7. VIEW 2: TICKETS MODULE (KANBAN + TABLE)
// ==========================================
function initTicketsModule() {
  document.getElementById('ticketSearchInput')?.addEventListener('input', renderTicketsKanban);
  document.getElementById('ticketPriorityFilter')?.addEventListener('change', renderTicketsKanban);
  document.getElementById('ticketTechFilter')?.addEventListener('change', renderTicketsKanban);

  // Priority Filter Pills
  document.querySelectorAll('#ticketPriorityPills .pill-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#ticketPriorityPills .pill-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const sel = document.getElementById('ticketPriorityFilter');
      if (sel) sel.value = btn.dataset.prio || '';
      renderTicketsKanban();
    });
  });

  // Kanban vs Table Switcher
  const kanbanBtn = document.getElementById('btnTicketsKanbanView');
  const tableBtn = document.getElementById('btnTicketsTableView');
  kanbanBtn?.addEventListener('click', () => {
    ticketsViewMode = 'kanban';
    kanbanBtn.classList.add('active');
    tableBtn?.classList.remove('active');
    document.getElementById('ticketsKanbanBoard')?.classList.remove('hidden');
    document.getElementById('ticketsTableContainer')?.classList.add('hidden');
  });
  tableBtn?.addEventListener('click', () => {
    ticketsViewMode = 'table';
    tableBtn.classList.add('active');
    kanbanBtn?.classList.remove('active');
    document.getElementById('ticketsKanbanBoard')?.classList.add('hidden');
    document.getElementById('ticketsTableContainer')?.classList.remove('hidden');
  });

  document.getElementById('btnOpenNewTicketModal')?.addEventListener('click', () => {
    openModal('newTicketModal');
  });

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

  document.querySelectorAll('#ticketDetailModal .tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#ticketDetailModal .tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('#ticketDetailModal .tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`)?.classList.add('active');
    });
  });

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

  document.getElementById('tdSendToPosBtn')?.addEventListener('click', async () => {
    const ticket = allTickets.find(t => t.id === currentTicketId);
    if (!ticket) return;
    closeModal('ticketDetailModal');
    switchView('pos');
    loadFolioIntoPosCart(ticket.folio);
  });

  document.getElementById('tdDeleteTicketBtn')?.addEventListener('click', async () => {
    if (!currentTicketId) return;
    if (!confirm('¿Estás seguro de eliminar este ticket permanentemente?')) return;
    await ticketService.deleteTicket(currentTicketId);
    closeModal('ticketDetailModal');
    await syncAllData();
    showToast('Ticket eliminado');
  });

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
    if (col && countEl) {
      countEl.textContent = col.children.length;
      if (col.children.length === 0) {
        col.innerHTML = `<div style="padding:22px 10px; text-align:center; font-size:0.75rem; color:var(--text-muted); border:1px dashed var(--border-subtle); border-radius:8px;">Sin tickets en esta etapa</div>`;
      }
    }
  });

  // Also render Table Mode
  const tbody = document.getElementById('ticketsTableBody');
  if (tbody) {
    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8">${renderEmptyState('Sin tickets encontrados', 'Modifica los filtros de búsqueda o registra un nuevo ticket.')}</td></tr>`;
    } else {
      tbody.innerHTML = filtered.map(t => {
        const total = parseFloat(t.pos?.total) || 0;
        const prioBadge = t.priority === 'Urgente' ? 'badge-red' : t.priority === 'Alta' ? 'badge-amber' : 'badge-blue';
        return `
          <tr class="ticket-row-item" data-id="${t.id}" style="cursor:pointer;">
            <td data-label="Folio" class="mono"><strong>${t.folio}</strong></td>
            <td data-label="Cliente / Empresa">
              <div><strong>${t.name}</strong><div style="font-size:0.74rem; color:var(--text-muted);">${t.company || t.phone || ''}</div></div>
            </td>
            <td data-label="Servicio">
              <div><div>${t.service}</div><div style="font-size:0.72rem; color:var(--text-muted);">${t.modality || ''}</div></div>
            </td>
            <td data-label="Prioridad"><span class="badge ${prioBadge}">${t.priority}</span></td>
            <td data-label="Técnico">${t.assignedTo || 'Sin asignar'}</td>
            <td data-label="Estado"><span class="kbd-tag">${t.estado.toUpperCase()}</span></td>
            <td data-label="Cargos POS" style="text-align:right;" class="mono tabular">${formatMoney(total)}</td>
            <td data-label="Acción" style="text-align:right;">
              <button type="button" class="btn btn-ghost btn-sm">Abrir →</button>
            </td>
          </tr>
        `;
      }).join('');

      tbody.querySelectorAll('.ticket-row-item').forEach(tr => {
        tr.addEventListener('click', () => openTicketDetail(tr.dataset.id));
      });
    }
  }
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

  const companyBadge = ticket.company ? ` <span style="opacity:0.75;font-size:0.75rem;">· ${ticket.company}</span>` : '';
  const totalAmount = parseFloat(ticket.pos?.total) || 0;
  const posTag = totalAmount > 0
    ? `<span class="mono tabular" style="color:${ticket.pos?.paid ? 'var(--primary)' : 'var(--secondary)'}; font-weight:600;">${formatMoney(totalAmount)}${ticket.pos?.paid ? ' ✓' : ''}</span>`
    : '';

  div.innerHTML = `
    <div class="tc-head">
      <span class="tc-folio">${ticket.folio || 'FL-NEW'}</span>
      <span class="tc-date tabular">${dateStr}</span>
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
    container.innerHTML = renderEmptyState('Bitácora vacía', 'Aún no se han registrado notas técnicas en este ticket.');
    return;
  }
  container.innerHTML = notes.slice().reverse().map(n => `
    <div class="b-note">
      <div class="b-note-head">
        <strong>${n.author || 'Técnico'}</strong>
        <span class="tabular">${n.date ? new Date(n.date).toLocaleString('es-MX') : ''}</span>
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
      <td data-label="Concepto">${item.concept}</td>
      <td data-label="Importe" style="text-align:right;" class="mono tabular">${formatMoney(item.price)}</td>
      <td data-label="Acción" style="text-align:right;">
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
// 8. VIEW 3: WORKSHOP MODULE (TALLER TÉCNICO)
// ==========================================
function initWorkshopModule() {
  document.getElementById('wsSearchInput')?.addEventListener('input', renderWorkshopGrid);
  document.getElementById('wsStateFilter')?.addEventListener('change', renderWorkshopGrid);

  document.querySelectorAll('#wsStatePills .pill-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#wsStatePills .pill-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const sel = document.getElementById('wsStateFilter');
      if (sel) sel.value = btn.dataset.wsstate || 'all';
      renderWorkshopGrid();
    });
  });

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
    container.innerHTML = `<div style="grid-column: 1 / -1;">${renderEmptyState('Sin órdenes de taller', 'No hay equipos en laboratorio que coincidan con el filtro actual.')}</div>`;
    return;
  }

  container.innerHTML = filtered.map(o => {
    const st = WORKSHOP_STATE_LABELS[o.estado] || { label: o.estado, badge: 'badge-blue', dot: 'dot-blue' };
    const balance = Math.max(0, (parseFloat(o.total) || 0) - (parseFloat(o.advancePayment) || 0));
    return `
      <div class="ws-card" data-id="${o.id}">
        <div class="ws-card-top">
          <span class="tc-folio">${o.folio}</span>
          <span class="badge ${st.badge}"><span class="status-dot ${st.dot}"></span>${st.label}</span>
        </div>
        <div>
          <div class="ws-device-badge">${o.deviceType} · ${o.brand} ${o.model}</div>
          <strong style="font-size:0.95rem;">${o.clientName}</strong>
          <div class="tabular" style="font-size:0.75rem; color:var(--text-muted);">Tel: ${o.clientPhone || '-'} · S/N: ${o.serialNumber || 'S/N'}</div>
        </div>
        <div class="ws-fault"><strong>Falla:</strong> ${o.reportedFault || 'Sin descripción'}</div>
        <div style="font-size:0.78rem; color:var(--text-muted);">
          <strong>Diagnóstico:</strong> ${o.technicalDiagnosis || 'Pendiente'}
        </div>
        <div class="ws-card-foot">
          <span>Ing: <strong>${o.assignedTech || 'Sin asignar'}</strong></span>
          <span class="mono tabular" style="color:${o.paid ? 'var(--primary)' : 'var(--secondary)'}; font-weight:600;">
            ${o.paid ? 'LIQUIDADO ' + formatMoney(o.total) : 'Saldo: ' + formatMoney(balance)}
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
    listEl.innerHTML = `<div style="font-size:0.78rem; color:var(--text-muted);">Sin refacciones adicionales cargadas.</div>`;
    return;
  }

  listEl.innerHTML = currentWorkshopParts.map(p => `
    <div style="display:flex; justify-content:space-between; align-items:center; padding:6px 10px; background:var(--bg-surface-2); border:1px solid var(--border-subtle); border-radius:6px; margin-bottom:4px; font-size:0.82rem;">
      <span>${p.concept} (x${p.qty || 1})</span>
      <div style="display:flex; align-items:center; gap:10px;">
        <strong class="mono tabular">${formatMoney(p.price)}</strong>
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
// 9. VIEW 4: POINT OF SALE (2-TAB WORKSPACE + MOBILE CAMERA BARCODE SCANNER)
// ==========================================
let posActiveSubTab = 'catalog'; // 'catalog' | 'cart'
let posCameraActive = false;
let posHtml5QrCode = null;
let posFacingMode = 'environment';
let posTorchOn = false;
let lastScannedCode = '';
let lastScannedTime = 0;

function playScannerBeep(success = true) {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = success ? 'sine' : 'sawtooth';
    osc.frequency.setValueAtTime(success ? 1480 : 320, ctx.currentTime);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (success ? 0.11 : 0.22));
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + (success ? 0.12 : 0.24));
  } catch (e) {
    // Ignore audio context restriction
  }
  try {
    if (navigator.vibrate) navigator.vibrate(success ? 55 : [80, 40, 80]);
  } catch (e) {}
}

function switchPosSubTab(tabName) {
  posActiveSubTab = tabName === 'cart' ? 'cart' : 'catalog';

  const btnCatalog = document.getElementById('btnPosTabCatalog');
  const btnCart = document.getElementById('btnPosTabCart');
  const paneCatalog = document.getElementById('posSubTabCatalog');
  const paneCart = document.getElementById('posSubTabCart');

  if (btnCatalog) {
    btnCatalog.classList.toggle('active', posActiveSubTab === 'catalog');
    btnCatalog.setAttribute('aria-selected', String(posActiveSubTab === 'catalog'));
  }
  if (btnCart) {
    btnCart.classList.toggle('active', posActiveSubTab === 'cart');
    btnCart.setAttribute('aria-selected', String(posActiveSubTab === 'cart'));
  }
  if (paneCatalog) paneCatalog.classList.toggle('active', posActiveSubTab === 'catalog');
  if (paneCart) paneCart.classList.toggle('active', posActiveSubTab === 'cart');

  if (posActiveSubTab === 'cart') {
    stopPosCameraScanner();
  }
}

async function startPosCameraScanner() {
  const panel = document.getElementById('posCameraScannerPanel');
  const statusEl = document.getElementById('posScannerStatusText');
  const camBtn = document.getElementById('btnToggleCameraScanner');
  const camBtnLabel = document.getElementById('posCameraBtnLabel');
  if (!panel) return;

  panel.classList.remove('hidden');
  renderPosDemoBarcodeChips();

  if (posCameraActive && posHtml5QrCode) return;

  if (statusEl) statusEl.textContent = 'Iniciando cámara lectora de códigos...';
  if (camBtn) camBtn.classList.add('camera-active');
  if (camBtnLabel) camBtnLabel.textContent = 'Detener Cámara';

  try {
    const mod = await import('html5-qrcode');
    const Html5Qrcode = mod.Html5Qrcode;
    if (!posHtml5QrCode) {
      posHtml5QrCode = new Html5Qrcode('posBarcodeReader');
    }

    await posHtml5QrCode.start(
      { facingMode: posFacingMode },
      {
        fps: 12,
        qrbox: { width: 250, height: 125 },
        aspectRatio: 1.777
      },
      (decodedText) => {
        const now = Date.now();
        if (decodedText === lastScannedCode && now - lastScannedTime < 1500) return;
        lastScannedCode = decodedText;
        lastScannedTime = now;
        handleBarcodeDetected(decodedText, 'Cámara Móvil');
      },
      () => {
        // Ignore frame scan misses
      }
    );

    posCameraActive = true;
    if (statusEl) {
      statusEl.textContent = 'Cámara activa — Apunta al código de barras (EAN / Code128 / QR)';
    }

    // Check if torch is supported
    try {
      const caps = posHtml5QrCode.getRunningTrackCameraCapabilities?.();
      const torchBtn = document.getElementById('btnToggleTorch');
      if (torchBtn && caps?.torchFeature?.()?.isSupported?.()) {
        torchBtn.classList.remove('hidden');
      }
    } catch (e) {}
  } catch (err) {
    posCameraActive = false;
    if (statusEl) {
      statusEl.textContent = 'Permiso de cámara no disponible — Usa el buscador o los códigos de prueba abajo';
    }
  }
}

async function stopPosCameraScanner() {
  const panel = document.getElementById('posCameraScannerPanel');
  const camBtn = document.getElementById('btnToggleCameraScanner');
  const camBtnLabel = document.getElementById('posCameraBtnLabel');

  if (posHtml5QrCode && posCameraActive) {
    try {
      await posHtml5QrCode.stop();
      posHtml5QrCode.clear();
    } catch (e) {}
  }
  posCameraActive = false;
  posTorchOn = false;
  if (panel) panel.classList.add('hidden');
  if (camBtn) camBtn.classList.remove('camera-active');
  if (camBtnLabel) camBtnLabel.textContent = 'Escanear con Cámara';
}

function renderPosDemoBarcodeChips() {
  const bar = document.getElementById('posDemoBarcodesBar');
  if (!bar) return;
  const sample = allProducts.slice(0, 4);
  bar.innerHTML = sample.map(p => `
    <button type="button" class="pos-demo-chip" data-code="${p.barcode || p.sku}">
      |||| ${p.barcode || p.sku} · ${p.sku}
    </button>
  `).join('');

  bar.querySelectorAll('.pos-demo-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      handleBarcodeDetected(chip.dataset.code, 'Simulador Lector');
    });
  });
}

function handleBarcodeDetected(rawCode, sourceLabel = 'Escáner') {
  const code = String(rawCode || '').trim();
  if (!code) return;

  const qLower = code.toLowerCase();
  const matched = allProducts.find(p =>
    (p.barcode && String(p.barcode).toLowerCase() === qLower) ||
    (p.sku && p.sku.toLowerCase() === qLower) ||
    (p.id && p.id.toLowerCase() === qLower)
  ) || allProducts.find(p =>
    (p.barcode && String(p.barcode).toLowerCase().includes(qLower)) ||
    (p.sku && p.sku.toLowerCase().includes(qLower))
  );

  const searchInput = document.getElementById('posCatalogSearch');
  const autoAdd = document.getElementById('posAutoAddToggle')?.checked !== false;
  const banner = document.getElementById('posLastScannedBanner');

  if (!matched) {
    playScannerBeep(false);
    if (searchInput) {
      searchInput.value = code;
      renderPosCatalog();
    }
    if (banner) {
      banner.classList.remove('hidden');
      banner.innerHTML = `
        <div>
          <strong style="color:var(--danger);">Código no registrado: <span class="mono">${code}</span></strong>
          <div style="font-size:0.74rem; color:var(--text-muted);">No se encontró coincidencia exacta en el almacén.</div>
        </div>
      `;
    }
    showToast(`Código [${code}] no encontrado en catálogo`);
    return;
  }

  playScannerBeep(true);

  if (autoAdd) {
    addProductToPosCart(matched);
  } else if (searchInput) {
    searchInput.value = matched.sku;
    renderPosCatalog();
  }

  const inCartItem = posCart.find(i => i.productId === matched.id);
  const qtyInCart = inCartItem ? inCartItem.qty : 0;

  if (banner) {
    banner.classList.remove('hidden');
    banner.innerHTML = `
      <div>
        <div style="font-size:0.7rem; color:var(--primary); font-family:var(--font-mono); font-weight:700;">
          ✓ ESCANEADO (${sourceLabel}) · ${matched.barcode || matched.sku}
        </div>
        <strong>${matched.name}</strong> — <span class="mono tabular" style="color:var(--primary);">${formatMoney(matched.price)}</span>
        <span class="pos-in-cart-pill" style="margin-left:6px;">En carrito: ${qtyInCart}</span>
      </div>
      <button type="button" class="btn btn-primary btn-sm" id="btnBannerGoCart">Cobrar →</button>
    `;
    document.getElementById('btnBannerGoCart')?.addEventListener('click', () => {
      switchPosSubTab('cart');
    });
  }
}

function addProductToPosCart(prod) {
  if (!prod) return false;
  if (!prod.isService && prod.stock <= 0) {
    playScannerBeep(false);
    showToast('Artículo sin existencias en almacén');
    return false;
  }
  const existing = posCart.find(i => i.productId === prod.id);
  if (existing) {
    if (!prod.isService && existing.qty + 1 > prod.stock) {
      showToast(`Stock máximo alcanzado (${prod.stock} disponibles)`);
      return false;
    }
    existing.qty += 1;
  } else {
    posCart.push({
      productId: prod.id,
      sku: prod.sku,
      barcode: prod.barcode || prod.sku,
      name: prod.name,
      price: prod.price,
      cost: prod.cost,
      qty: 1
    });
  }
  renderPosCart();
  renderPosCatalog();
  showToast(`+1 ${prod.name} agregado al carrito`);
  return true;
}

function initPosModule() {
  // Two-Tab Switcher
  document.getElementById('btnPosTabCatalog')?.addEventListener('click', () => switchPosSubTab('catalog'));
  document.getElementById('btnPosTabCart')?.addEventListener('click', () => switchPosSubTab('cart'));
  document.getElementById('btnPosGoToCart')?.addEventListener('click', () => switchPosSubTab('cart'));
  document.getElementById('btnPosBackToCatalog')?.addEventListener('click', () => switchPosSubTab('catalog'));

  // Search & Default Barcode Scanner Input
  const searchInput = document.getElementById('posCatalogSearch');
  const clearSearchBtn = document.getElementById('btnClearPosSearch');

  searchInput?.addEventListener('input', () => {
    if (clearSearchBtn) {
      clearSearchBtn.classList.toggle('hidden', !searchInput.value);
    }
    renderPosCatalog();
  });

  // Pressing Enter in search input acts like a hardware/camera barcode trigger
  searchInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = searchInput.value.trim();
      if (!val) return;
      handleBarcodeDetected(val, 'Buscador / Lector');
      searchInput.select();
    }
  });

  clearSearchBtn?.addEventListener('click', () => {
    if (searchInput) {
      searchInput.value = '';
      clearSearchBtn.classList.add('hidden');
      renderPosCatalog();
      searchInput.focus();
    }
  });

  // Camera Scanner Controls
  document.getElementById('btnToggleCameraScanner')?.addEventListener('click', () => {
    if (posCameraActive) {
      stopPosCameraScanner();
    } else {
      startPosCameraScanner();
    }
  });

  document.getElementById('btnCloseCameraScanner')?.addEventListener('click', () => {
    stopPosCameraScanner();
  });

  document.getElementById('btnSwitchCamera')?.addEventListener('click', async () => {
    posFacingMode = posFacingMode === 'environment' ? 'user' : 'environment';
    await stopPosCameraScanner();
    await startPosCameraScanner();
  });

  document.getElementById('btnToggleTorch')?.addEventListener('click', async () => {
    try {
      const caps = posHtml5QrCode?.getRunningTrackCameraCapabilities?.();
      if (caps?.torchFeature?.()?.isSupported?.()) {
        posTorchOn = !posTorchOn;
        await caps.torchFeature().apply(posTorchOn);
      }
    } catch (e) {}
  });

  // Category Pills
  document.querySelectorAll('#posCategoryPills .pill-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#posCategoryPills .pill-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const sel = document.getElementById('posCategoryFilter');
      if (sel) sel.value = btn.dataset.poscat || 'all';
      renderPosCatalog();
    });
  });

  document.getElementById('posCategoryFilter')?.addEventListener('change', renderPosCatalog);

  // Payment Method Pills
  document.querySelectorAll('#posPayMethodPills .pay-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#posPayMethodPills .pay-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const sel = document.getElementById('posPaymentMethod');
      if (sel) sel.value = btn.dataset.method || 'Efectivo';
      const isCash = (btn.dataset.method || 'Efectivo') === 'Efectivo';
      const cashRow = document.getElementById('posCashRow');
      const changeRow = document.getElementById('posChangeRow');
      if (cashRow) cashRow.style.display = isCash ? 'flex' : 'none';
      if (changeRow) changeRow.style.display = isCash ? 'flex' : 'none';
      updatePosTotals();
    });
  });

  // Quick Cash Denomination Buttons
  document.querySelectorAll('#posQuickCashBtns .quick-cash-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const subtotal = posCart.reduce((s, i) => s + i.price * i.qty, 0);
      const discount = Math.max(0, parseFloat(document.getElementById('posDiscountInput')?.value) || 0);
      const total = Math.max(0, subtotal - discount);
      const recInput = document.getElementById('posAmountReceived');
      if (!recInput) return;
      if (btn.dataset.cash === 'exact') {
        recInput.value = total.toFixed(2);
      } else {
        recInput.value = btn.dataset.cash;
      }
      updatePosTotals();
    });
  });

  document.getElementById('posClearCartBtn')?.addEventListener('click', () => {
    posCart = [];
    posLinkedFolio = '';
    document.getElementById('posImportFolioSelect').value = '';
    document.getElementById('posClientName').value = 'Mostrador / Público en General';
    document.getElementById('posDiscountInput').value = '0';
    renderPosCart();
    renderPosCatalog();
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
      showToast('El efectivo recibido es menor al total a liquidar');
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
      renderPosCatalog();
      await syncAllData();
      showToast(`Venta ${res.sale.folio} procesada con éxito`);
      printPosReceipt(res.sale);
    } catch (err) {
      showToast(err.message);
    }
  });
}

function renderPosCatalog() {
  const grid = document.getElementById('posCatalogGrid');
  if (!grid) return;

  renderPosDemoBarcodeChips();

  const q = (document.getElementById('posCatalogSearch')?.value || '').toLowerCase().trim();
  const cat = document.getElementById('posCategoryFilter')?.value || 'all';

  const list = allProducts.filter(p => {
    if (cat !== 'all' && p.category !== cat) return false;
    if (q) {
      const hay = `${p.sku} ${p.barcode || ''} ${p.name} ${p.category} ${p.description}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  if (list.length === 0) {
    grid.innerHTML = `<div style="grid-column:1/-1;">${renderEmptyState('Sin coincidencias de código o nombre', 'Intenta escanear otro código de barras o cambia el filtro de categoría.')}</div>`;
    return;
  }

  grid.innerHTML = list.map(p => {
    const inCart = posCart.find(i => i.productId === p.id);
    const qtyInCart = inCart ? inCart.qty : 0;
    const bc = p.barcode || p.sku;
    return `
      <div class="pos-prod-item ${qtyInCart > 0 ? 'in-cart' : ''}" data-id="${p.id}">
        <div style="min-width:0;">
          <div class="pos-prod-top-meta">
            <span class="pos-prod-sku">${p.sku}</span>
            <span class="pos-prod-barcode" title="Código de Barras">|||| ${bc}</span>
          </div>
          <div class="pos-prod-name">${p.name}</div>
        </div>
        <div class="pos-prod-bottom">
          <div style="min-width:0;">
            <div class="pos-prod-price tabular">${formatMoney(p.price)}</div>
            <div class="pos-prod-stock tabular">${p.isService ? 'Servicio' : 'Stock: ' + p.stock}</div>
          </div>
          <span class="pos-card-action-tag ${qtyInCart > 0 ? 'active' : ''}">
            ${qtyInCart > 0 ? `✓ ${qtyInCart} en carrito` : '+ Agregar'}
          </span>
        </div>
      </div>
    `;
  }).join('');

  grid.querySelectorAll('.pos-prod-item').forEach(card => {
    card.addEventListener('click', () => {
      const prod = allProducts.find(p => p.id === card.dataset.id);
      if (prod) {
        playScannerBeep(true);
        addProductToPosCart(prod);
      }
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
  renderPosCatalog();
  switchPosSubTab('cart');
  showToast(`Cargos del folio ${folio} cargados en el carrito`);
}

function renderPosCart() {
  const container = document.getElementById('posCartList');
  if (!container) return;

  if (posCart.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; color:var(--text-muted); padding:34px 12px; font-size:0.82rem;">
        <div style="margin-bottom:8px;">El carrito está vacío.</div>
        <button type="button" class="btn btn-secondary btn-sm" id="btnEmptyCartGoCatalog">Ir al Catálogo / Escáner de Código de Barras</button>
      </div>
    `;
    document.getElementById('btnEmptyCartGoCatalog')?.addEventListener('click', () => switchPosSubTab('catalog'));
    updatePosTotals();
    return;
  }

  container.innerHTML = posCart.map((item, idx) => `
    <div class="cart-line">
      <div style="flex:1; min-width:0;">
        <div style="font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${item.name}</div>
        <div class="mono tabular" style="font-size:0.72rem; color:var(--text-muted);">${item.sku || ''} · ${formatMoney(item.price)} c/u</div>
      </div>
      <div class="cart-qty-controls">
        <button type="button" class="qty-btn" data-idx="${idx}" data-delta="-1">-</button>
        <span class="mono tabular" style="min-width:22px; text-align:center; font-weight:700;">${item.qty}</span>
        <button type="button" class="qty-btn" data-idx="${idx}" data-delta="1">+</button>
      </div>
      <strong class="mono tabular" style="min-width:78px; text-align:right; color:var(--primary);">${formatMoney(item.price * item.qty)}</strong>
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
      renderPosCatalog();
    });
  });

  container.querySelectorAll('.del-item-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      posCart.splice(Number(btn.dataset.idx), 1);
      renderPosCart();
      renderPosCatalog();
    });
  });

  updatePosTotals();
}

function updatePosTotals() {
  const subtotal = posCart.reduce((s, i) => s + i.price * i.qty, 0);
  const totalCount = posCart.reduce((s, i) => s + Number(i.qty || 1), 0);
  const discount = Math.max(0, parseFloat(document.getElementById('posDiscountInput')?.value) || 0);
  const total = Math.max(0, subtotal - discount);
  const received = parseFloat(document.getElementById('posAmountReceived')?.value) || 0;
  const change = Math.max(0, received - total);

  document.getElementById('posSummarySubtotal').textContent = formatMoney(subtotal);
  document.getElementById('posSummaryTotal').textContent = formatMoney(total);
  document.getElementById('posChangeDisplay').textContent = formatMoney(change);

  // Sync Two-Tab Header Counters
  const tabCountEl = document.getElementById('posTabCartCount');
  const tabTotalEl = document.getElementById('posTabCartTotal');
  if (tabCountEl) tabCountEl.textContent = totalCount;
  if (tabTotalEl) tabTotalEl.textContent = `${formatMoney(total)} por liquidar`;

  // Sync Floating Mini-Cart Bar in Catalog Tab
  const floatBar = document.getElementById('posFloatingCartBar');
  const floatCount = document.getElementById('posFloatingCount');
  const floatTotal = document.getElementById('posFloatingTotal');
  if (floatBar) floatBar.classList.toggle('hidden', totalCount === 0);
  if (floatCount) floatCount.textContent = `${totalCount} art.`;
  if (floatTotal) floatTotal.textContent = formatMoney(total);
}

function renderPosSalesHistory() {
  const tbody = document.getElementById('posSalesHistoryBody');
  if (!tbody) return;

  if (allSales.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9">${renderEmptyState('Sin ventas registradas', 'Las transacciones procesadas en la terminal POS aparecerán aquí.')}</td></tr>`;
    return;
  }

  tbody.innerHTML = allSales.map(s => {
    const d = s.date ? new Date(s.date).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-';
    const isCancelled = s.status === 'cancelada';
    return `
      <tr style="${isCancelled ? 'opacity:0.5;' : ''}">
        <td data-label="Folio" class="mono"><strong>${s.folio}</strong></td>
        <td data-label="Fecha" class="tabular">${d}</td>
        <td data-label="Cliente">${s.clientName}</td>
        <td data-label="Ref." class="mono">${s.linkedRef || '-'}</td>
        <td data-label="Cajero">${s.cashier}</td>
        <td data-label="Método"><span class="badge badge-blue">${s.paymentMethod}</span></td>
        <td data-label="Total" style="text-align:right;" class="mono tabular"><strong>${formatMoney(s.total)}</strong></td>
        <td data-label="Estado"><span class="badge ${isCancelled ? 'badge-red' : 'badge-green'}"><span class="status-dot ${isCancelled ? 'dot-red' : 'dot-lime'}"></span>${s.status}</span></td>
        <td data-label="Acciones" style="text-align:right;">
          <div style="display:inline-flex; gap:6px; justify-content:flex-end;">
            <button class="btn btn-ghost btn-sm btn-print-sale" data-id="${s.id}">Ticket</button>
            ${!isCancelled && currentUser?.permissions?.canDelete ? `<button class="btn btn-danger btn-sm btn-cancel-sale" data-id="${s.id}">Cancelar</button>` : ''}
          </div>
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
// 10. VIEW 5: STORE & INVENTORY MODULE (TIENDA)
// ==========================================
function initStoreModule() {
  document.getElementById('storeSearchInput')?.addEventListener('input', renderStoreTable);
  document.getElementById('storeCategoryFilter')?.addEventListener('change', renderStoreTable);

  document.querySelectorAll('#storeCategoryPills .pill-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#storeCategoryPills .pill-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const sel = document.getElementById('storeCategoryFilter');
      if (sel) sel.value = btn.dataset.cat || 'all';
      renderStoreTable();
    });
  });

  document.getElementById('btnOpenNewProductModal')?.addEventListener('click', () => {
    document.getElementById('productForm').reset();
    document.getElementById('prodId').value = '';
    const bcEl = document.getElementById('prodBarcode');
    if (bcEl) bcEl.value = '';
    document.getElementById('prodModalTitle').textContent = 'Registrar Nuevo Producto / Servicio';
    openModal('productModal');
  });

  const prodForm = document.getElementById('productForm');
  prodForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('prodId').value;
    const payload = {
      sku: document.getElementById('prodSku').value.trim(),
      barcode: document.getElementById('prodBarcode')?.value.trim() || '',
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
      const hay = `${p.sku} ${p.barcode || ''} ${p.name} ${p.category} ${p.description}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9">${renderEmptyState('Sin artículos en catálogo', 'Prueba con otra categoría o agrega un nuevo producto.')}</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(p => {
    const isLow = !p.isService && Number(p.stock) <= Number(p.minStock || 3);
    const margin = p.price > 0 ? Math.round(((p.price - (p.cost || 0)) / p.price) * 100) : 0;
    return `
      <tr>
        <td data-label="SKU / Barras" class="mono">
          <div><strong>${p.sku}</strong><div style="font-size:0.68rem; color:var(--text-muted);">|||| ${p.barcode || '-'}</div></div>
        </td>
        <td data-label="Producto / Servicio">
          <div><strong>${p.name}</strong><div style="font-size:0.74rem; color:var(--text-muted);">${p.description || ''}</div></div>
        </td>
        <td data-label="Categoría"><span class="kbd-tag">${CATEGORY_LABELS[p.category] || p.category}</span></td>
        <td data-label="Costo" style="text-align:right;" class="mono tabular">${formatMoney(p.cost)}</td>
        <td data-label="Precio Púb." style="text-align:right;" class="mono tabular"><strong>${formatMoney(p.price)}</strong></td>
        <td data-label="Margen" style="text-align:right;" class="mono tabular"><span style="color:var(--primary); font-weight:600;">+${margin}%</span></td>
        <td data-label="Existencia" style="text-align:center;">
          ${p.isService
            ? '<span class="badge badge-purple">Intangible</span>'
            : `<span class="badge ${isLow ? 'badge-red' : 'badge-green'}"><span class="status-dot ${isLow ? 'dot-red' : 'dot-lime'}"></span>${p.stock} ${p.unit || 'pza'}</span>`
          }
        </td>
        <td data-label="Catálogo Web" style="text-align:center;">
          <span class="badge ${p.publicVisible !== false ? 'badge-green' : 'badge-amber'}">${p.publicVisible !== false ? 'Público' : 'Oculto'}</span>
        </td>
        <td data-label="Acciones" style="text-align:right; white-space:nowrap;">
          <div style="display:inline-flex; gap:6px; justify-content:flex-end; flex-wrap:wrap;">
            ${!p.isService ? `
              <button class="btn btn-secondary btn-sm btn-stock-adj" data-id="${p.id}" data-delta="1" title="Entrada rápida +1">+1</button>
              <button class="btn btn-secondary btn-sm btn-stock-adj" data-id="${p.id}" data-delta="-1" title="Salida rápida -1">-1</button>
            ` : ''}
            <button class="btn btn-ghost btn-sm btn-edit-prod" data-id="${p.id}">Editar</button>
            ${currentUser?.permissions?.canDelete ? `<button class="btn btn-danger btn-sm btn-del-prod" data-id="${p.id}">✕</button>` : ''}
          </div>
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
      const bcEl = document.getElementById('prodBarcode');
      if (bcEl) bcEl.value = p.barcode || '';
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
// 11. VIEW 6: REPORTS & ANALYTICS MODULE
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
        <div class="kpi-top"><span class="kpi-label">VENTAS BRUTAS TOTALES</span></div>
        <div class="kpi-mid">
          <div class="kpi-value accent tabular">${formatMoney(fin.grossRevenue)}</div>
          <span class="kpi-delta up">+100%</span>
        </div>
        <div class="kpi-foot"><span>Ticket Promedio:</span><strong class="mono tabular">${formatMoney(fin.avgTicketSale)}</strong></div>
      </div>
      <div class="kpi-card">
        <div class="kpi-top"><span class="kpi-label">UTILIDAD BRUTA ESTIMADA</span></div>
        <div class="kpi-mid">
          <div class="kpi-value tabular">${formatMoney(fin.estimatedProfit)}</div>
          <span class="kpi-delta up">Rentable</span>
        </div>
        <div class="kpi-foot"><span>Costo de venta:</span><strong class="mono tabular">${formatMoney(fin.estimatedCost)}</strong></div>
      </div>
      <div class="kpi-card">
        <div class="kpi-top"><span class="kpi-label">CUENTAS POR COBRAR</span></div>
        <div class="kpi-mid">
          <div class="kpi-value cyan tabular">${formatMoney(fin.pendingReceivables)}</div>
        </div>
        <div class="kpi-foot"><span>Tickets: ${formatMoney(fin.pendingTicketsBalance)}</span><span>Taller: ${formatMoney(fin.pendingWorkshopBalance)}</span></div>
      </div>
      <div class="kpi-card">
        <div class="kpi-top"><span class="kpi-label">VALOR COMERCIAL ALMACÉN</span></div>
        <div class="kpi-mid">
          <div class="kpi-value tabular">${formatMoney(inv.inventoryRetailValue)}</div>
        </div>
        <div class="kpi-foot"><span>Costo en stock:</span><strong class="mono tabular">${formatMoney(inv.inventoryCostValue)}</strong></div>
      </div>
    `;
  }

  const payEl = document.getElementById('reportsPaymentBreakdown');
  if (payEl) {
    const totalRev = Math.max(1, fin.grossRevenue);
    const methods = Object.entries(fin.byPaymentMethod || {});
    payEl.innerHTML = methods.map(([m, val]) => `
      <div class="sbar-row">
        <div class="sbar-top"><span>${m}</span><strong class="mono tabular">${formatMoney(val)}</strong></div>
        <div class="sbar-track"><div class="sbar-fill" style="width:${Math.round((val / totalRev) * 100)}%;"></div></div>
      </div>
    `).join('');
  }

  const topBody = document.getElementById('reportsTopProductsBody');
  if (topBody) {
    const top = reportsData.topProducts || [];
    topBody.innerHTML = top.map(item => `
      <tr>
        <td data-label="SKU" class="mono">${item.sku}</td>
        <td data-label="Concepto">${item.name}</td>
        <td data-label="Unidades" style="text-align:center;" class="mono tabular">${item.qty}</td>
        <td data-label="Ingreso Generado" style="text-align:right;" class="mono tabular"><strong>${formatMoney(item.revenue)}</strong></td>
      </tr>
    `).join('');
  }

  const techBody = document.getElementById('reportsTechPerformanceBody');
  if (techBody) {
    const techs = reportsData.technicians || [];
    techBody.innerHTML = techs.map(t => `
      <tr>
        <td data-label="Ingeniero / Técnico"><strong>${t.name}</strong></td>
        <td data-label="Tickets Activos" style="text-align:center;" class="mono tabular">${t.ticketsActive}</td>
        <td data-label="Tickets Resueltos" style="text-align:center;" class="mono tabular"><span class="badge badge-green">${t.ticketsResolved}</span></td>
        <td data-label="Taller Activos" style="text-align:center;" class="mono tabular">${t.workshopActive}</td>
        <td data-label="Taller Listos" style="text-align:center;" class="mono tabular"><span class="badge badge-blue">${t.workshopReady}</span></td>
      </tr>
    `).join('');
  }

  const invEl = document.getElementById('reportsInventoryValuation');
  if (invEl) {
    const potentialProfit = inv.inventoryRetailValue - inv.inventoryCostValue;
    invEl.innerHTML = `
      <div class="sbar-row"><div class="sbar-top"><span>Artículos en Catálogo</span><strong class="mono tabular">${inv.totalCatalogItems}</strong></div></div>
      <div class="sbar-row"><div class="sbar-top"><span>Productos Físicos</span><strong class="mono tabular">${inv.physicalItemsCount}</strong></div></div>
      <div class="sbar-row"><div class="sbar-top"><span>Alertas de Stock Bajo</span><strong class="mono tabular" style="color:var(--danger);">${inv.lowStockCount}</strong></div></div>
      <div class="sbar-row"><div class="sbar-top"><span>Capital al Costo</span><strong class="mono tabular">${formatMoney(inv.inventoryCostValue)}</strong></div></div>
      <div class="sbar-row"><div class="sbar-top"><span>Utilidad Potencial en Stock</span><strong class="mono tabular" style="color:var(--primary);">${formatMoney(potentialProfit)}</strong></div></div>
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
  showToast('Reporte CSV exportado exitosamente');
}

// ==========================================
// 12. VIEW 7: USERS & ROLES MODULE
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
        showToast('Perfil de usuario actualizado');
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
      <td data-label="Nombre"><strong>${u.name}</strong></td>
      <td data-label="Usuario" class="mono">@${u.username}</td>
      <td data-label="Rol"><span class="badge badge-purple">${u.permissions?.label || u.role}</span></td>
      <td data-label="Especialidad">${u.specialty || '-'}</td>
      <td data-label="Contacto" class="tabular">${u.phone || u.email || '-'}</td>
      <td data-label="Estado"><span class="badge ${u.active !== false ? 'badge-green' : 'badge-red'}"><span class="status-dot ${u.active !== false ? 'dot-lime' : 'dot-red'}"></span>${u.active !== false ? 'Activo' : 'Inactivo'}</span></td>
      <td data-label="Acciones" style="text-align:right;">
        <div style="display:inline-flex; gap:6px; justify-content:flex-end;">
          <button class="btn btn-ghost btn-sm btn-edit-usr" data-id="${u.id}">Editar</button>
          ${u.username !== 'admin' ? `<button class="btn btn-danger btn-sm btn-del-usr" data-id="${u.id}">✕</button>` : ''}
        </div>
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
// 13. DEDICATED PRINT GENERATORS
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
