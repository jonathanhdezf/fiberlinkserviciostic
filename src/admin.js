import { ticketService } from './services/ticketService.js';
import { erpService } from './services/erpService.js';

// ==========================================
// GLOBAL ERP STATE
// ==========================================
let currentUser = null;
let currentView = 'overview';
let allTickets = [];
let allProducts = [];
let allInventoryMovements = [];
let allWorkshop = [];
let allSales = [];
let allUsers = [];
let allClients = [];
let allShifts = [];
let allCashCuts = [];
let systemSettings = null;
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
let cliDirectoryFilter = 'all';
let cliCreditFilter = 'all';
let currentStatementClientId = null;
let currentStatementFilter = 'all';
let invMovFilter = 'all';
let cutsHistoryFilter = 'all';
let currentDetailCutId = null;
let currentProductPhotos = [];
let currentLightboxProduct = null;

// Command Palette state
let cmdItems = [];
let cmdSelectedIndex = 0;

const VIEW_META = {
  overview: { title: 'Resumen General', bc: 'Resumen' },
  tickets: { title: 'Mesa de Control de Tickets', bc: 'Tickets Soporte' },
  workshop: { title: 'Laboratorio y Taller Técnico', bc: 'Taller & Lab' },
  pos: { title: 'Terminal Punto de Venta (POS)', bc: 'Punto de Venta' },
  store: { title: 'Manejo de Inventario, Reportes & Kardex', bc: 'Inventario & Kardex' },
  clients: { title: 'Control de Clientes, Facturación & Créditos', bc: 'Clientes & Créditos' },
  shifts: { title: 'Organización de Turnos, Arqueo y Cortes de Caja', bc: 'Cortes y Turnos' },
  reports: { title: 'Analítica Financiera y Reportes Ejecutivos', bc: 'Reportes & Analítica' },
  users: { title: 'Usuarios, Roles y Seguridad RBAC', bc: 'Usuarios & Roles' },
  settings: { title: 'Módulo de Configuración General del Sistema', bc: 'Configuración' }
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
  initClientsModule();
  initShiftsModule();
  initReportsModule();
  initUsersModule();
  initSettingsModule();
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

function animateCountUpElement(el, durationMs = 960, delayMs = 0) {
  if (!el) return;
  const target = parseFloat(el.dataset.countup);
  if (Number.isNaN(target)) return;
  const fmt = el.dataset.format || 'int';
  const prefix = el.dataset.prefix || '';
  const suffix = el.dataset.suffix || '';

  if (el._countRaf) cancelAnimationFrame(el._countRaf);
  if (el._countTimer) clearTimeout(el._countTimer);

  const renderVal = (v) => {
    if (fmt === 'money') {
      return `${prefix}${formatMoney(v)}${suffix}`;
    }
    return `${prefix}${Math.round(v).toLocaleString('es-MX')}${suffix}`;
  };

  el.textContent = renderVal(0);

  el._countTimer = setTimeout(() => {
    const start = performance.now();
    const step = (now) => {
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / durationMs);
      // Smooth easeOutQuart curve
      const eased = 1 - Math.pow(1 - progress, 4);
      const current = target * eased;
      el.textContent = renderVal(progress >= 1 ? target : current);
      if (progress < 1) {
        el._countRaf = requestAnimationFrame(step);
      }
    };
    el._countRaf = requestAnimationFrame(step);
  }, delayMs);
}

function animateSectionStatsAndBars(rootSelector = '#view-overview') {
  const root = typeof rootSelector === 'string' ? document.querySelector(rootSelector) : rootSelector;
  if (!root) return;

  // 1. Re-trigger staggered KPI card entrance animation
  root.querySelectorAll('.kpi-card').forEach((card, idx) => {
    card.style.setProperty('--stagger', idx);
    card.classList.remove('kpi-anim-enter');
    void card.offsetWidth;
    card.classList.add('kpi-anim-enter');
  });

  // 2. Animate all [data-countup] numbers smoothly from 0 to target
  root.querySelectorAll('[data-countup]').forEach((el, idx) => {
    animateCountUpElement(el, 980, Math.min(idx * 45, 320));
  });

  // 3. Animate all .sbar-fill bars from 0% to their target percentage
  root.querySelectorAll('.sbar-row').forEach((row, idx) => {
    row.style.setProperty('--bar-idx', idx);
    row.classList.remove('sbar-anim-enter');
    void row.offsetWidth;
    row.classList.add('sbar-anim-enter');
  });

  const fills = root.querySelectorAll('.sbar-fill[data-target-width]');
  fills.forEach((fill, idx) => {
    fill.style.transition = 'none';
    fill.style.width = '0%';
    void fill.offsetWidth;
    fill.style.transition = `width 0.95s cubic-bezier(0.22, 1, 0.36, 1) ${Math.min(idx * 65 + 90, 420)}ms`;
    requestAnimationFrame(() => {
      fill.style.width = `${fill.dataset.targetWidth}%`;
    });
  });
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

  const allowedModules = ['overview', 'tickets', 'workshop', 'pos', 'store', 'clients', 'shifts', 'reports', 'users', 'settings'];
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

  // Control Panel Notification Bell & Popover
  const notifBtn = document.getElementById('topbarNotifBtn');
  const notifPop = document.getElementById('notifPopover');
  const notifWrap = document.getElementById('topbarNotifWrap');

  notifBtn?.addEventListener('click', (e) => {
    e.stopPropagation();
    notifPop?.classList.toggle('hidden');
  });

  document.getElementById('btnNotifClosePopover')?.addEventListener('click', () => {
    notifPop?.classList.add('hidden');
  });

  document.getElementById('btnNotifGoSettings')?.addEventListener('click', () => {
    notifPop?.classList.add('hidden');
    switchView('settings');
    switchSettingsSubTab('notifications');
  });

  document.addEventListener('click', (e) => {
    if (notifWrap && !notifWrap.contains(e.target)) {
      notifPop?.classList.add('hidden');
    }
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

  if (viewName === 'overview') {
    renderOverviewRevenueChart();
    animateSectionStatsAndBars('#view-overview');
  } else if (viewName === 'reports') {
    animateSectionStatsAndBars('#view-reports');
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
    { group: 'Acciones Rápidas', title: 'Registrar Nuevo Cliente (Crédito / CFDI)', sub: 'Clientes', run: () => { closeModal('cmdPaletteModal'); openClientModalForCreate(); } },
    { group: 'Acciones Rápidas', title: 'Registrar Abono o Liquidación de Crédito', sub: 'Créditos', run: () => { closeModal('cmdPaletteModal'); openCreditMovementModal(); } },
    { group: 'Acciones Rápidas', title: 'Exportar Padrón de Clientes a CSV', sub: 'Clientes', run: () => { closeModal('cmdPaletteModal'); exportClientsToCSV(); } },
    { group: 'Acciones Rápidas', title: 'Realizar Corte del Turno (Arqueo X/Z)', sub: 'Cortes y Turnos', run: () => { closeModal('cmdPaletteModal'); switchView('shifts'); switchShiftsSubTab('turn_cut'); } },
    { group: 'Acciones Rápidas', title: 'Enviar Corte de Caja por WhatsApp', sub: 'Cortes y Turnos', run: () => { closeModal('cmdPaletteModal'); switchView('shifts'); switchShiftsSubTab('whatsapp_cut'); } },
    { group: 'Acciones Rápidas', title: 'Abrir Nuevo Turno de Trabajo', sub: 'Cortes y Turnos', run: () => { closeModal('cmdPaletteModal'); openNewShiftModal(); } },
    { group: 'Acciones Rápidas', title: 'Descargar Respaldo Completo de Base de Datos (.JSON)', sub: 'Configuración', run: () => { closeModal('cmdPaletteModal'); downloadFullSystemBackup(); } },
    { group: 'Navegación', title: 'Ir a Resumen', sub: 'Vista', run: () => { closeModal('cmdPaletteModal'); switchView('overview'); } },
    { group: 'Navegación', title: 'Ir a Tablero de Tickets', sub: 'Vista', run: () => { closeModal('cmdPaletteModal'); switchView('tickets'); } },
    { group: 'Navegación', title: 'Ir a Taller Técnico', sub: 'Vista', run: () => { closeModal('cmdPaletteModal'); switchView('workshop'); } },
    { group: 'Navegación', title: 'Ir a Clientes y Administración de Créditos', sub: 'Vista', run: () => { closeModal('cmdPaletteModal'); switchView('clients'); } },
    { group: 'Navegación', title: 'Ir a Tienda e Inventario', sub: 'Vista', run: () => { closeModal('cmdPaletteModal'); switchView('store'); } },
    { group: 'Navegación', title: 'Ir a Cortes y Turnos (Turno, Día, WhatsApp)', sub: 'Vista', run: () => { closeModal('cmdPaletteModal'); switchView('shifts'); } },
    { group: 'Navegación', title: 'Ir a Módulo de Configuración General', sub: 'Vista', run: () => { closeModal('cmdPaletteModal'); switchView('settings'); } },
    { group: 'Navegación', title: 'Ir a Reportes y Analítica', sub: 'Vista', run: () => { closeModal('cmdPaletteModal'); switchView('reports'); } }
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

  const clientMatches = allClients.map(c => ({
    group: 'Clientes & Créditos',
    title: `[${c.code}] ${c.name}`,
    sub: `${c.hasCredit ? 'Saldo: ' + formatMoney(c.currentBalance) + ' / Lím: ' + formatMoney(c.creditLimit) : 'Contado'} · ${c.rfc || 'S/RFC'}`,
    run: () => {
      closeModal('cmdPaletteModal');
      openClientStatementModal(c.id);
    }
  }));

  const allCandidates = [...baseActions, ...clientMatches, ...ticketMatches, ...wsMatches, ...prodMatches];
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
    const [tickets, products, movements, workshop, sales, users, clients, shifts, cashCuts, settings, reports] = await Promise.all([
      ticketService.getTickets(),
      erpService.getProducts().catch(() => []),
      erpService.getInventoryMovements().catch(() => []),
      erpService.getWorkshopOrders().catch(() => []),
      erpService.getSales().catch(() => []),
      erpService.getUsers().catch(() => []),
      erpService.getClients().catch(() => []),
      erpService.getShifts().catch(() => []),
      erpService.getCashCuts().catch(() => []),
      erpService.getSettings().catch(() => null),
      erpService.getReportsSummary().catch(() => null)
    ]);

    allTickets = Array.isArray(tickets) ? tickets : [];
    allProducts = Array.isArray(products) ? products : [];
    allInventoryMovements = Array.isArray(movements) ? movements : [];
    allWorkshop = Array.isArray(workshop) ? workshop : [];
    allSales = Array.isArray(sales) ? sales : [];
    allUsers = Array.isArray(users) ? users : [];
    allClients = Array.isArray(clients) ? clients : [];
    allShifts = Array.isArray(shifts) ? shifts : [];
    allCashCuts = Array.isArray(cashCuts) ? cashCuts : [];
    if (settings) systemSettings = settings;
    reportsData = reports;

    applySystemSettingsBranding();
    updateNavBadges();
    populateTechnicianSelects();
    populateCatalogPickers();
    populatePosClientSelector();
    renderOverview();
    renderTicketsKanban();
    renderWorkshopGrid();
    renderPosCatalog();
    renderPosFolioOptions();
    renderPosSalesHistory();
    renderInventoryModule();
    renderClientsModule();
    renderShiftsModule();
    renderReportsView();
    renderUsersTable();
    renderSettingsModule();
  } catch (err) {
    console.error('[ERP Sync Error]:', err);
  }
}

function updateNavBadges() {
  const activeTickets = allTickets.filter(t => t.estado !== 'resuelto').length;
  const urgentTicketsCount = allTickets.filter(t => t.priority === 'Urgente' && t.estado !== 'resuelto').length;
  const activeWorkshop = allWorkshop.filter(w => w.estado !== 'entregado').length;
  const lowStockCount = allProducts.filter(p => !p.isService && Number(p.stock) <= Number(p.minStock || 3)).length;
  const clientsWithBalance = allClients.filter(c => (Number(c.currentBalance) || 0) > 0).length;
  const activeShift = allShifts.find(s => s.status === 'abierto');

  const navTicketsEl = document.getElementById('navBadgeTickets');
  if (navTicketsEl) {
    navTicketsEl.textContent = activeTickets;
    navTicketsEl.classList.toggle('warn', urgentTicketsCount > 0);
  }
  document.getElementById('navBadgeWorkshop').textContent = activeWorkshop;
  const lowBadge = document.getElementById('navBadgeLowStock');
  if (lowBadge) {
    lowBadge.style.display = lowStockCount > 0 ? 'inline-block' : 'none';
    lowBadge.textContent = lowStockCount;
  }
  const cliBadge = document.getElementById('navBadgeClients');
  if (cliBadge) {
    cliBadge.style.display = allClients.length > 0 ? 'inline-block' : 'none';
    cliBadge.textContent = clientsWithBalance > 0 ? `${clientsWithBalance}` : `${allClients.length}`;
  }
  const shiftBadge = document.getElementById('navBadgeShiftStatus');
  if (shiftBadge) {
    shiftBadge.textContent = activeShift ? 'ON' : 'OFF';
    shiftBadge.classList.toggle('warn', !activeShift);
  }

  renderControlPanelNotifications();
}

function renderControlPanelNotifications() {
  const notifConf = systemSettings?.notifications || {};
  const showUrgent = notifConf.urgentTicketsAlert !== false;
  const showLowStock = notifConf.lowStockAlert !== false;
  const showCredit = notifConf.overdueCreditAlert !== false;

  const urgentTickets = showUrgent
    ? allTickets.filter(t => t.priority === 'Urgente' && t.estado !== 'resuelto')
    : [];
  const lowStockItems = showLowStock
    ? allProducts.filter(p => !p.isService && Number(p.stock) <= Number(p.minStock || 3))
    : [];
  const creditClients = showCredit
    ? allClients.filter(c => (Number(c.currentBalance) || 0) > 0)
    : [];

  const totalAlerts = urgentTickets.length + lowStockItems.length + creditClients.length;
  const criticalCount = urgentTickets.length + lowStockItems.length;

  const bellBtn = document.getElementById('topbarNotifBtn');
  const countBadge = document.getElementById('topbarNotifBadge');
  const summaryBadge = document.getElementById('notifPopoverSummaryBadge');
  const bodyEl = document.getElementById('notifPopoverBody');

  if (bellBtn) {
    bellBtn.classList.toggle('has-alerts', totalAlerts > 0);
  }
  if (countBadge) {
    countBadge.style.display = totalAlerts > 0 ? 'inline-flex' : 'none';
    countBadge.textContent = totalAlerts;
  }
  if (summaryBadge) {
    summaryBadge.textContent = criticalCount > 0 ? `${criticalCount} crítica(s)` : `${totalAlerts} activa(s)`;
    summaryBadge.className = criticalCount > 0 ? 'badge badge-red badge-low-stock-pulse' : 'badge badge-green';
  }

  if (!bodyEl) return;

  const items = [];

  urgentTickets.forEach(t => {
    items.push({
      severity: 'critical',
      badgeHtml: `<span class="badge badge-red badge-urgent-pulse"><span class="status-dot dot-red"></span>URGENTE</span>`,
      title: `🚨 Ticket ${t.folio} — ${t.name}`,
      sub: `${t.service || 'Soporte Técnico'} · Asignado: ${t.assignedTo || 'Sin asignar'}`,
      onClick: () => {
        document.getElementById('notifPopover')?.classList.add('hidden');
        openTicketDetail(t.id);
      }
    });
  });

  lowStockItems.forEach(p => {
    items.push({
      severity: 'critical',
      badgeHtml: `<span class="badge badge-red badge-low-stock-pulse"><span class="status-dot dot-red"></span>${p.stock} ${p.unit || 'pza'}</span>`,
      title: `📦 Stock Bajo: ${p.name}`,
      sub: `SKU: ${p.sku} · Mínimo requerido: ${p.minStock || 3} ${p.unit || 'pza'}`,
      onClick: () => {
        document.getElementById('notifPopover')?.classList.add('hidden');
        switchView('store');
        openAddInventoryModal(p.id);
      }
    });
  });

  creditClients.slice(0, 3).forEach(c => {
    items.push({
      severity: 'warning',
      badgeHtml: `<span class="badge badge-amber"><span class="status-dot dot-amber"></span>${formatMoney(c.currentBalance)}</span>`,
      title: `💳 Saldo Crédito: ${c.name}`,
      sub: `[${c.code}] Límite autorizado: ${formatMoney(c.creditLimit)}`,
      onClick: () => {
        document.getElementById('notifPopover')?.classList.add('hidden');
        openClientStatementModal(c.id);
      }
    });
  });

  if (items.length === 0) {
    bodyEl.innerHTML = `<div style="padding:18px 12px; text-align:center; font-size:0.8rem; color:var(--text-muted);">✓ Sin alertas críticas pendientes en el sistema.</div>`;
    return;
  }

  bodyEl.innerHTML = items.map((it, idx) => `
    <div class="notif-card-item ${it.severity}" data-nidx="${idx}" style="--notif-idx:${idx};">
      <div style="min-width:0; flex:1;">
        <div style="font-size:0.8rem; font-weight:600; color:var(--text-main); margin-bottom:2px;">${it.title}</div>
        <div style="font-size:0.72rem; color:var(--text-muted);">${it.sub}</div>
      </div>
      <div style="flex-shrink:0;">${it.badgeHtml}</div>
    </div>
  `).join('');

  bodyEl.querySelectorAll('.notif-card-item').forEach(el => {
    el.addEventListener('click', () => {
      const item = items[Number(el.dataset.nidx)];
      if (item?.onClick) item.onClick();
    });
  });
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
  const resolvedTickets = allTickets.filter(t => t.estado === 'resuelto').length;
  const activeWs = allWorkshop.filter(w => w.estado !== 'entregado').length;
  const readyWs = allWorkshop.filter(w => w.estado === 'listo_entrega').length;
  const lowStock = allProducts.filter(p => !p.isService && Number(p.stock) <= Number(p.minStock || 3));
  const marginPct = fin.grossRevenue > 0 ? Math.round((fin.estimatedProfit / fin.grossRevenue) * 100) : 48;

  const kpiContainer = document.getElementById('overviewKpis');
  if (kpiContainer) {
    kpiContainer.innerHTML = `
      <div class="kpi-card kpi-anim-enter" style="--stagger:0;">
        <div class="kpi-top">
          <span class="kpi-label">INGRESOS LIQUIDADOS (POS)</span>
          <div class="kpi-icon-box">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><line x1="12" x2="12" y1="2" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          </div>
        </div>
        <div class="kpi-mid">
          <div class="kpi-value accent tabular" data-countup="${fin.grossRevenue}" data-format="money">${formatMoney(fin.grossRevenue)}</div>
          <span class="kpi-delta up" data-countup="${marginPct}" data-format="int" data-prefix="+" data-suffix="% margen">+${marginPct}% margen</span>
        </div>
        <div class="kpi-foot">
          <span data-countup="${fin.totalSalesCount}" data-format="int" data-suffix=" ventas cerradas">${fin.totalSalesCount} ventas cerradas</span>
          <span class="mono" data-countup="${fin.estimatedProfit}" data-format="money" data-prefix="Utilidad: ">Utilidad: ${formatMoney(fin.estimatedProfit)}</span>
        </div>
      </div>

      <div class="kpi-card kpi-anim-enter" style="--stagger:1;">
        <div class="kpi-top">
          <span class="kpi-label">CUENTAS POR COBRAR</span>
          <div class="kpi-icon-box" style="color:var(--secondary);">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
          </div>
        </div>
        <div class="kpi-mid">
          <div class="kpi-value cyan tabular" data-countup="${fin.pendingReceivables}" data-format="money">${formatMoney(fin.pendingReceivables)}</div>
          <span class="kpi-delta neutral">En cartera</span>
        </div>
        <div class="kpi-foot">
          <span>Tickets + Laboratorio</span>
          <span class="mono">Por liquidar</span>
        </div>
      </div>

      <div class="kpi-card kpi-anim-enter ${urgentTickets > 0 ? 'kpi-urgent-active' : ''}" style="--stagger:2;">
        <div class="kpi-top">
          <span class="kpi-label">TICKETS DE SOPORTE</span>
          <div class="kpi-icon-box" ${urgentTickets > 0 ? 'style="color:#f87171; border-color:rgba(239,68,68,0.45);"' : ''}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Z"/></svg>
          </div>
        </div>
        <div class="kpi-mid">
          <div class="kpi-value tabular ${urgentTickets > 0 ? 'warn' : ''}" data-countup="${activeTickets}" data-format="int">${activeTickets}</div>
          <span class="kpi-delta ${urgentTickets > 0 ? 'alert' : 'up'}" ${urgentTickets > 0 ? `data-countup="${urgentTickets}" data-format="int" data-prefix="🚨 " data-suffix=" Urgente(s)"` : ''}>${urgentTickets > 0 ? '🚨 ' + urgentTickets + ' Urgente(s)' : 'SLA 98.4%'}</span>
        </div>
        <div class="kpi-foot">
          <span data-countup="${resolvedTickets}" data-format="int" data-suffix=" resueltos">${resolvedTickets} resueltos</span>
          <span class="mono" data-countup="${allTickets.length}" data-format="int" data-suffix=" totales">${allTickets.length} totales</span>
        </div>
      </div>

      <div class="kpi-card kpi-anim-enter ${lowStock.length > 0 ? 'kpi-urgent-active' : ''}" style="--stagger:3;">
        <div class="kpi-top">
          <span class="kpi-label">ÓRDENES EN LABORATORIO</span>
          <div class="kpi-icon-box">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></svg>
          </div>
        </div>
        <div class="kpi-mid">
          <div class="kpi-value tabular" data-countup="${activeWs}" data-format="int">${activeWs}</div>
          <span class="kpi-delta up" data-countup="${readyWs}" data-format="int" data-suffix=" listo(s)">${readyWs} listo(s)</span>
        </div>
        <div class="kpi-foot">
          <span>Equipos en taller</span>
          <span class="badge ${lowStock.length > 0 ? 'badge-red badge-low-stock-pulse' : 'badge-green'} mono" ${lowStock.length > 0 ? 'style="cursor:pointer;" id="kpiLowStockBadgeBtn"' : ''}>
            ${lowStock.length > 0 ? `<span class="status-dot dot-red"></span>` : ''}
            <span data-countup="${lowStock.length}" data-format="int" data-suffix=" alertas stock">${lowStock.length} alertas stock</span>
          </span>
        </div>
      </div>
    `;

    document.getElementById('kpiLowStockBadgeBtn')?.addEventListener('click', () => {
      switchView('store');
      switchInventorySubTab('low_stock');
    });
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
    tSummary.innerHTML = rows.map((r, idx) => {
      const pct = Math.round((r.count / totalT) * 100);
      return `
        <div class="sbar-row sbar-anim-enter" style="--bar-idx:${idx};">
          <div class="sbar-top"><span>${r.label}</span><strong class="mono tabular" data-countup="${r.count}" data-format="int">${r.count}</strong></div>
          <div class="sbar-track"><div class="sbar-fill" data-target-width="${pct}" style="width:0%; background:${r.color}; --bar-idx:${idx};"></div></div>
        </div>
      `;
    }).join('');
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
    wSummary.innerHTML = rows.map((r, idx) => {
      const pct = Math.round((r.count / totalW) * 100);
      return `
        <div class="sbar-row sbar-anim-enter" style="--bar-idx:${idx + 4};">
          <div class="sbar-top"><span>${r.label}</span><strong class="mono tabular" data-countup="${r.count}" data-format="int">${r.count}</strong></div>
          <div class="sbar-track"><div class="sbar-fill" data-target-width="${pct}" style="width:0%; background:${r.color}; --bar-idx:${idx + 4};"></div></div>
        </div>
      `;
    }).join('');
  }

  // Low stock in red with pulse & click-to-restock
  const lowEl = document.getElementById('overviewLowStockList');
  if (lowEl) {
    if (lowStock.length === 0) {
      lowEl.innerHTML = `<div style="font-size:0.79rem; color:var(--text-muted); padding:6px 0;">✓ Inventario físico en niveles óptimos.</div>`;
    } else {
      lowEl.innerHTML = `<div class="table-responsive"><table class="erp-table">
        <thead><tr><th>SKU</th><th>Artículo</th><th style="text-align:right;">Stock Crítico</th></tr></thead>
        <tbody>
          ${lowStock.slice(0, 5).map(p => `
            <tr class="low-stock-row-alert overview-lowstock-row" data-id="${p.id}" style="cursor:pointer;" title="Clic para surtir este artículo en almacén">
              <td data-label="SKU" class="mono"><strong>${p.sku}</strong></td>
              <td data-label="Artículo">${p.name}</td>
              <td data-label="Stock" style="text-align:right;">
                <span class="badge badge-red badge-low-stock-pulse">
                  <span class="status-dot dot-red"></span>${p.stock} ${p.unit || 'pza'}
                </span>
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table></div>`;

      lowEl.querySelectorAll('.overview-lowstock-row').forEach(tr => {
        tr.addEventListener('click', () => {
          openAddInventoryModal(tr.dataset.id);
        });
      });
    }
  }

  // Recent Activity & Notifications Feed
  const actEl = document.getElementById('overviewActivityList');
  if (actEl) {
    const logs = reportsData?.recentActivity || [];
    if (logs.length === 0) {
      actEl.innerHTML = `<p style="color:var(--text-muted); font-size:0.8rem;">Sin actividad registrada.</p>`;
    } else {
      actEl.innerHTML = logs.slice(0, 8).map((a, idx) => {
        const t = a.date ? new Date(a.date).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
        const isCrit = /urgente|bajo|cancel|faltante|elimin/i.test(a.action || '');
        return `
          <div class="act-item ${isCrit ? 'act-urgent' : ''}" style="--act-idx:${idx};">
            <div style="display:flex; align-items:center; gap:7px;">
              <span class="status-dot ${isCrit ? 'dot-red' : 'dot-lime'}"></span>
              <div><strong>${a.user}:</strong> ${a.action}</div>
            </div>
            <span class="act-time tabular">${t}</span>
          </div>
        `;
      }).join('');
    }
  }

  animateSectionStatsAndBars('#view-overview');
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
        <path class="chart-line-proj" d="${pathProj}" fill="none" stroke="#7ce7ff" stroke-width="1.75" stroke-dasharray="4 4" stroke-opacity="0.65"/>

        <!-- Revenue Area & Primary Line -->
        <path class="chart-area-rev" d="${areaRev}" fill="url(#limeAreaGrad)"/>
        <path class="chart-line-rev" d="${pathRev}" fill="none" stroke="#9cc32e" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>

        <!-- Data Nodes & Labels -->
        ${ptsRev.map((p, idx) => `
          <g>
            <circle class="chart-node-dot" style="animation-delay:${180 + idx * 85}ms;" cx="${p.x}" cy="${p.y}" r="4.2" fill="#090b07" stroke="#9cc32e" stroke-width="2.2"/>
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
      <span class="mono tabular">Total Activo: <strong style="color:var(--primary);" data-countup="${gross + receivables}" data-format="money">${formatMoney(gross + receivables)}</strong></span>
    </div>
  `;

  const totalEl = container.querySelector('[data-countup]');
  if (totalEl) animateCountUpElement(totalEl, 920, 60);
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
      <td data-label="Monto" style="text-align:right;" class="mono tabular"><strong data-countup="${r.amount}" data-format="money">${formatMoney(r.amount)}</strong></td>
    </tr>
  `).join('');

  tbody.querySelectorAll('.tx-clickable-row').forEach(tr => {
    tr.addEventListener('click', () => {
      const item = filtered[Number(tr.dataset.idx)];
      if (item?.onClick) item.onClick();
    });
  });

  tbody.querySelectorAll('[data-countup]').forEach((el, idx) => {
    animateCountUpElement(el, 850, idx * 40);
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
        const isUrgent = t.priority === 'Urgente' && normalizeTicketStateDomId(t.estado) !== 'resuelto';
        const prioBadge = t.priority === 'Urgente' ? `badge-red ${isUrgent ? 'badge-urgent-pulse' : ''}` : t.priority === 'Alta' ? 'badge-amber' : 'badge-blue';
        return `
          <tr class="ticket-row-item ${isUrgent ? 'ticket-row-urgent' : ''}" data-id="${t.id}" style="cursor:pointer;">
            <td data-label="Folio" class="mono"><strong>${t.folio}</strong></td>
            <td data-label="Cliente / Empresa">
              <div><strong>${t.name}</strong><div style="font-size:0.74rem; color:var(--text-muted);">${t.company || t.phone || ''}</div></div>
            </td>
            <td data-label="Servicio">
              <div><div>${t.service}</div><div style="font-size:0.72rem; color:var(--text-muted);">${t.modality || ''}</div></div>
            </td>
            <td data-label="Prioridad"><span class="badge ${prioBadge}">${t.priority === 'Urgente' ? '<span class="status-dot dot-red"></span>' : ''}${t.priority}</span></td>
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
  const isUrgentActive = ticket.priority === 'Urgente' && normalizeTicketStateDomId(ticket.estado) !== 'resuelto';
  div.className = `ticket-card${isUrgentActive ? ' ticket-urgent-card' : ''}`;
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
      <span class="tc-priority ${prioClass}">${ticket.priority === 'Urgente' ? '<span class="status-dot dot-red" style="margin-right:4px;"></span>' : ''}${ticket.priority || 'Normal'}</span>
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

  // Client Selector in POS Checkout
  document.getElementById('posClientSelect')?.addEventListener('change', (e) => {
    const clientId = e.target.value;
    const nameInput = document.getElementById('posClientName');
    const infoBox = document.getElementById('posClientCreditInfo');
    const client = allClients.find(c => c.id === clientId);

    if (!client) {
      if (nameInput) nameInput.value = 'Mostrador / Público en General';
      if (infoBox) {
        infoBox.classList.add('hidden');
        infoBox.innerHTML = '';
      }
      return;
    }

    if (nameInput) nameInput.value = client.name;
    if (infoBox) {
      infoBox.classList.remove('hidden');
      const avail = Math.max(0, (parseFloat(client.creditLimit) || 0) - (parseFloat(client.currentBalance) || 0));
      infoBox.innerHTML = client.hasCredit
        ? `<span>💳 <strong>Crédito Autorizado:</strong> Límite ${formatMoney(client.creditLimit)} (${client.creditDays || 30} días)</span>
           <span>Saldo: <strong style="color:var(--amber);">${formatMoney(client.currentBalance)}</strong> · Disponible: <strong style="color:var(--secondary);">${formatMoney(avail)}</strong></span>`
        : `<span>⚠️ Cliente de contado (Sin línea de crédito autorizada) · ${client.hasBilling ? 'CFDI: ' + client.rfc : 'Sin datos CFDI'}</span>`;
    }
  });

  document.getElementById('posQuickNewClientBtn')?.addEventListener('click', () => {
    openClientModalForCreate();
  });

  // Payment Method Pills
  document.querySelectorAll('#posPayMethodPills .pay-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#posPayMethodPills .pay-pill').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const method = btn.dataset.method || 'Efectivo';
      const sel = document.getElementById('posPaymentMethod');
      if (sel) sel.value = method;
      const isCash = method === 'Efectivo';
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
    const cliSel = document.getElementById('posClientSelect');
    if (cliSel) cliSel.value = '';
    document.getElementById('posClientCreditInfo')?.classList.add('hidden');
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
    const selectedClientId = document.getElementById('posClientSelect')?.value || null;

    if (paymentMethod === 'Efectivo' && amountReceived < total) {
      showToast('El efectivo recibido es menor al total a liquidar');
      return;
    }

    if (paymentMethod === 'Crédito') {
      if (!selectedClientId) {
        showToast('Selecciona un cliente registrado para procesar una venta a Crédito');
        return;
      }
      const cli = allClients.find(c => c.id === selectedClientId);
      if (!cli || !cli.hasCredit) {
        showToast('El cliente seleccionado no tiene línea de crédito autorizada');
        return;
      }
      const avail = Math.max(0, (parseFloat(cli.creditLimit) || 0) - (parseFloat(cli.currentBalance) || 0));
      if ((parseFloat(cli.creditLimit) || 0) > 0 && total > avail) {
        showToast(`Crédito insuficiente. Disponible: ${formatMoney(avail)}`);
        return;
      }
    }

    try {
      const res = await erpService.createSale({
        clientId: selectedClientId,
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
      showToast(`Venta ${res.sale.folio} procesada con éxito (${paymentMethod})`);

      const autoPrint = systemSettings?.enabledOptions?.autoPrintTicketOnSale !== false;
      const digitalEnabled = systemSettings?.ticketConfig?.enableDigitalTicket !== false;
      if (digitalEnabled) {
        openDigitalTicketModal(res.sale);
      } else if (autoPrint) {
        printPosReceipt(res.sale);
      }
    } catch (err) {
      showToast(err.message);
    }
  });
}

function populatePosClientSelector() {
  const select = document.getElementById('posClientSelect');
  if (!select) return;
  const currentVal = select.value;
  select.innerHTML = `<option value="">-- Mostrador / Público en General --</option>` +
    allClients.map(c => {
      const avail = Math.max(0, (parseFloat(c.creditLimit) || 0) - (parseFloat(c.currentBalance) || 0));
      const creditTag = c.hasCredit ? ` [Crédito Disp: ${formatMoney(avail)}]` : ' [Contado]';
      return `<option value="${c.id}">[${c.code}] ${c.name}${creditTag}</option>`;
    }).join('');
  if (currentVal && allClients.some(c => c.id === currentVal)) {
    select.value = currentVal;
  }
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
    const photos = Array.isArray(p.images) && p.images.length > 0 ? p.images : (p.imageUrl ? [p.imageUrl] : []);
    const coverPhoto = photos[0] || '';

    return `
      <div class="pos-prod-item ${qtyInCart > 0 ? 'in-cart' : ''}" data-id="${p.id}">
        ${coverPhoto ? `
          <div class="pos-prod-thumb-box">
            <img src="${coverPhoto}" alt="${p.name}" onerror="this.style.display='none'">
          </div>
        ` : ''}
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
          <div style="display:inline-flex; gap:6px; justify-content:flex-end; flex-wrap:wrap;">
            <button class="btn btn-primary btn-sm btn-digital-ticket-sale" data-id="${s.id}" title="Enviar enlace de Ticket Digital por WhatsApp">📲 Ticket Digital</button>
            <button class="btn btn-ghost btn-sm btn-print-sale" data-id="${s.id}" title="Imprimir Ticket Físico">🖨️ Impreso</button>
            ${!isCancelled && currentUser?.permissions?.canDelete ? `<button class="btn btn-danger btn-sm btn-cancel-sale" data-id="${s.id}">Cancelar</button>` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('.btn-digital-ticket-sale').forEach(btn => {
    btn.addEventListener('click', () => {
      const sale = allSales.find(x => x.id === btn.dataset.id);
      if (sale) openDigitalTicketModal(sale);
    });
  });

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
// 10. VIEW 5: MÓDULO DE INVENTARIO, MOVIMIENTOS Y KARDEX
// ==========================================
function switchInventorySubTab(tabName) {
  const paneMap = {
    manage: 'invSubTabManage',
    lowstock: 'invSubTabLowStock',
    report: 'invSubTabReport',
    movements: 'invSubTabMovements',
    kardex: 'invSubTabKardex'
  };

  document.querySelectorAll('#invModuleTabs .pill-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.invtab === tabName);
  });

  Object.entries(paneMap).forEach(([key, domId]) => {
    const el = document.getElementById(domId);
    if (el) el.classList.toggle('active', key === tabName);
  });
}

function initStoreModule() {
  // 5-Tab Switcher
  document.querySelectorAll('#invModuleTabs .pill-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      switchInventorySubTab(btn.dataset.invtab || 'manage');
    });
  });

  // Tab 1: Manejo de Inventario Search & Category Pills
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

  // Top Buttons: Agregar Inventario, Ajustes de Inventario, Nuevo Producto
  document.getElementById('btnOpenAddInventoryModal')?.addEventListener('click', () => {
    openAddInventoryModal();
  });
  document.getElementById('btnOpenAdjustInventoryModal')?.addEventListener('click', () => {
    openAdjustInventoryModal();
  });

  // --- FOTOGRAFÍAS DEL PRODUCTO (Upload, Compresión y Galería) ---
  const fileInput = document.getElementById('prodPhotosFileInput');
  const addUrlBtn = document.getElementById('btnAddProdPhotoUrl');
  const urlInput = document.getElementById('prodPhotoUrlInput');

  const compressImageFile = (file) => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const maxDim = 900;
          let w = img.width;
          let h = img.height;
          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            } else {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.82));
        };
        img.onerror = () => resolve(e.target.result);
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  };

  const renderProductPhotosPreview = () => {
    const container = document.getElementById('prodPhotosGalleryPreview');
    const badge = document.getElementById('prodPhotosCountBadge');
    if (badge) badge.textContent = `${currentProductPhotos.length} / 6 fotos`;
    if (!container) return;

    if (currentProductPhotos.length === 0) {
      container.innerHTML = `
        <div style="grid-column:1/-1; padding:12px; text-align:center; color:var(--text-muted); font-size:0.75rem; border:1px dashed var(--border-subtle); border-radius:8px;">
          Sin fotografías agregadas. Haz clic en "Subir / Tomar Fotografías" o pega un enlace de imagen.
        </div>
      `;
      return;
    }

    container.innerHTML = currentProductPhotos.map((photoUrl, idx) => `
      <div class="prod-photo-item ${idx === 0 ? 'is-cover' : ''}" data-idx="${idx}">
        <img src="${photoUrl}" alt="Foto ${idx + 1}" onerror="this.src='/logo.gif'">
        ${idx === 0 ? '<span class="prod-photo-cover-tag">Principal</span>' : ''}
        <div class="prod-photo-controls">
          ${idx > 0 ? `<button type="button" class="prod-photo-btn btn-make-cover" data-idx="${idx}" title="Fijar como foto principal">⭐</button>` : '<span></span>'}
          <button type="button" class="prod-photo-btn btn-del btn-del-photo" data-idx="${idx}" title="Eliminar fotografía">✕</button>
        </div>
      </div>
    `).join('');

    container.querySelectorAll('.btn-make-cover').forEach(btn => {
      btn.addEventListener('click', () => {
        const i = Number(btn.dataset.idx);
        const [target] = currentProductPhotos.splice(i, 1);
        currentProductPhotos.unshift(target);
        renderProductPhotosPreview();
      });
    });

    container.querySelectorAll('.btn-del-photo').forEach(btn => {
      btn.addEventListener('click', () => {
        const i = Number(btn.dataset.idx);
        currentProductPhotos.splice(i, 1);
        renderProductPhotosPreview();
      });
    });
  };

  fileInput?.addEventListener('change', async (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    for (const f of files) {
      if (currentProductPhotos.length >= 6) {
        showToast('Límite de 6 fotografías por producto alcanzado');
        break;
      }
      try {
        const compressed = await compressImageFile(f);
        currentProductPhotos.push(compressed);
      } catch (err) {
        console.error('Error procesando imagen', err);
      }
    }
    fileInput.value = '';
    renderProductPhotosPreview();
  });

  addUrlBtn?.addEventListener('click', () => {
    const url = (urlInput?.value || '').trim();
    if (!url) return;
    if (currentProductPhotos.length >= 6) {
      showToast('Límite de 6 fotografías por producto alcanzado');
      return;
    }
    currentProductPhotos.push(url);
    if (urlInput) urlInput.value = '';
    renderProductPhotosPreview();
  });

  document.getElementById('btnOpenNewProductModal')?.addEventListener('click', () => {
    document.getElementById('productForm').reset();
    document.getElementById('prodId').value = '';
    currentProductPhotos = [];
    renderProductPhotosPreview();
    const bcEl = document.getElementById('prodBarcode');
    if (bcEl) bcEl.value = '';
    const titleEl = document.getElementById('productModalTitle') || document.getElementById('prodModalTitle');
    if (titleEl) titleEl.textContent = 'Registrar Nuevo Producto / Servicio';
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
      isService: document.getElementById('prodIsService').checked,
      images: currentProductPhotos,
      imageUrl: currentProductPhotos[0] || ''
    };

    try {
      if (id) {
        await erpService.updateProduct(id, payload);
        showToast('Producto actualizado');
      } else {
        await erpService.createProduct(payload);
        showToast('Producto agregado al catálogo e inventario');
      }
      closeModal('productModal');
      await syncAllData();
    } catch (err) {
      showToast(err.message);
    }
  });

  // Lightbox Modal: Abrir edición desde visor
  document.getElementById('btnLightboxEditPhotos')?.addEventListener('click', () => {
    if (!currentLightboxProduct) return;
    closeModal('productPhotoLightboxModal');
    openEditProductModal(currentLightboxProduct.id);
  });

  // Modal: Agregar Inventario (Entrada de Almacén)
  const addProdSel = document.getElementById('addInvProductSelect');
  const addQtyIn = document.getElementById('addInvQty');
  const addCostIn = document.getElementById('addInvUnitCost');

  const updateAddInventoryPreview = () => {
    const prod = allProducts.find(p => p.id === addProdSel?.value);
    const curStock = Number(prod?.stock) || 0;
    const minStock = Number(prod?.minStock) || 0;
    const addQty = Math.max(0, parseInt(addQtyIn?.value, 10) || 0);
    const unitCost = Math.max(0, parseFloat(addCostIn?.value) || 0);

    const curEl = document.getElementById('addInvCurrentStock');
    const minEl = document.getElementById('addInvMinStock');
    const projEl = document.getElementById('addInvProjectedStock');
    const totEl = document.getElementById('addInvTotalCost');

    if (curEl) curEl.textContent = `${curStock} ${prod?.unit || 'pza'}`;
    if (minEl) minEl.textContent = `${minStock} ${prod?.unit || 'pza'}`;
    if (projEl) projEl.textContent = `${curStock + addQty} ${prod?.unit || 'pza'}`;
    if (totEl) totEl.value = formatMoney(addQty * unitCost);
  };

  addProdSel?.addEventListener('change', () => {
    const prod = allProducts.find(p => p.id === addProdSel.value);
    if (prod && addCostIn) {
      addCostIn.value = (parseFloat(prod.cost) || 0).toFixed(2);
    }
    updateAddInventoryPreview();
  });
  addQtyIn?.addEventListener('input', updateAddInventoryPreview);
  addCostIn?.addEventListener('input', updateAddInventoryPreview);

  document.getElementById('addInventoryForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const prodId = addProdSel?.value;
    const qty = Math.max(1, parseInt(addQtyIn?.value, 10) || 1);
    const unitCost = Math.max(0, parseFloat(addCostIn?.value) || 0);
    const reference = document.getElementById('addInvReference')?.value.trim() || 'ENTRADA-ALMACEN';
    const reason = document.getElementById('addInvReason')?.value.trim() || 'Compra / Entrada de inventario';

    if (!prodId) return;
    try {
      await erpService.adjustStock(prodId, {
        delta: qty,
        type: 'entrada',
        unitCost,
        reference,
        reason
      });
      closeModal('addInventoryModal');
      await syncAllData();
      showToast(`Entrada de +${qty} unidades registrada en el Kardex`);
    } catch (err) {
      showToast(err.message);
    }
  });

  // Modal: Ajustes de Inventario (Conteo físico, Merma, Uso en taller)
  const adjProdSel = document.getElementById('adjInvProductSelect');
  const adjModeSel = document.getElementById('adjInvMode');
  const adjValIn = document.getElementById('adjInvValue');

  const updateAdjustInventoryPreview = () => {
    const prod = allProducts.find(p => p.id === adjProdSel?.value);
    const sysStock = Number(prod?.stock) || 0;
    const mode = adjModeSel?.value || 'set';
    const val = Math.max(0, parseInt(adjValIn?.value, 10) || 0);

    let finalStock = sysStock;
    if (mode === 'set') {
      finalStock = val;
    } else if (mode === 'sub') {
      finalStock = Math.max(0, sysStock - val);
    } else {
      finalStock = sysStock + val;
    }
    const delta = finalStock - sysStock;

    const sysEl = document.getElementById('adjInvSystemStock');
    const delEl = document.getElementById('adjInvDeltaDisplay');
    const finEl = document.getElementById('adjInvFinalStock');
    if (sysEl) sysEl.textContent = `${sysStock} ${prod?.unit || 'pza'}`;
    if (delEl) {
      delEl.textContent = `${delta >= 0 ? '+' : ''}${delta}`;
      delEl.style.color = delta < 0 ? 'var(--amber)' : delta > 0 ? 'var(--secondary)' : 'var(--text-muted)';
    }
    if (finEl) finEl.textContent = `${finalStock} ${prod?.unit || 'pza'}`;
  };

  adjProdSel?.addEventListener('change', () => {
    const prod = allProducts.find(p => p.id === adjProdSel.value);
    if (prod && adjModeSel?.value === 'set' && adjValIn) {
      adjValIn.value = prod.stock || 0;
    }
    updateAdjustInventoryPreview();
  });
  adjModeSel?.addEventListener('change', () => {
    const prod = allProducts.find(p => p.id === adjProdSel?.value);
    if (adjValIn) {
      adjValIn.value = adjModeSel.value === 'set' ? (prod?.stock || 0) : 1;
    }
    updateAdjustInventoryPreview();
  });
  adjValIn?.addEventListener('input', updateAdjustInventoryPreview);

  document.getElementById('adjustInventoryForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const prodId = adjProdSel?.value;
    const prod = allProducts.find(p => p.id === prodId);
    if (!prod) return;

    const sysStock = Number(prod.stock) || 0;
    const mode = adjModeSel?.value || 'set';
    const val = Math.max(0, parseInt(adjValIn?.value, 10) || 0);
    const finalStock = mode === 'set' ? val : mode === 'sub' ? Math.max(0, sysStock - val) : sysStock + val;

    const type = document.getElementById('adjInvTypeSelect')?.value || 'ajuste_conteo';
    const reference = document.getElementById('adjInvReference')?.value.trim() || 'AJUSTE-FISICO';
    const reason = document.getElementById('adjInvReason')?.value.trim() || 'Ajuste de inventario en almacén';

    try {
      await erpService.adjustStock(prodId, {
        newStock: finalStock,
        type,
        reference,
        reason
      });
      closeModal('adjustInventoryModal');
      await syncAllData();
      showToast(`Ajuste de inventario aplicado (${prod.sku}: ${sysStock} ➔ ${finalStock})`);
    } catch (err) {
      showToast(err.message);
    }
  });

  // Tab 2, 3, 4, 5 Controls & Exports
  document.getElementById('btnExportLowStockCsv')?.addEventListener('click', exportLowStockToCSV);
  document.getElementById('btnPrintLowStockReport')?.addEventListener('click', printLowStockReport);
  document.getElementById('btnExportInventoryReportCsv')?.addEventListener('click', exportInventoryReportToCSV);
  document.getElementById('btnPrintInventoryReport')?.addEventListener('click', printInventoryReport);

  document.getElementById('invMovSearchInput')?.addEventListener('input', renderInventoryMovementsTable);
  document.querySelectorAll('#invMovTypePills .pill-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#invMovTypePills .pill-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      invMovFilter = btn.dataset.movtype || 'all';
      renderInventoryMovementsTable();
    });
  });
  document.getElementById('btnExportMovementsCsv')?.addEventListener('click', exportMovementsToCSV);
  document.getElementById('btnPrintMovementsReport')?.addEventListener('click', printMovementsReport);

  // Tab 5: Kardex Product Selector & Quick Buttons
  document.getElementById('kardexProductSelect')?.addEventListener('change', renderKardexTab);
  document.getElementById('btnKardexQuickAdd')?.addEventListener('click', () => {
    const pid = document.getElementById('kardexProductSelect')?.value;
    openAddInventoryModal(pid);
  });
  document.getElementById('btnKardexQuickAdjust')?.addEventListener('click', () => {
    const pid = document.getElementById('kardexProductSelect')?.value;
    openAdjustInventoryModal(pid);
  });
  document.getElementById('btnPrintProductKardex')?.addEventListener('click', printProductKardex);
}

function openAddInventoryModal(preselectedProductId = null) {
  const physicalProducts = allProducts.filter(p => !p.isService);
  const sel = document.getElementById('addInvProductSelect');
  if (!sel || physicalProducts.length === 0) return;

  sel.innerHTML = physicalProducts.map(p =>
    `<option value="${p.id}">[${p.sku}] ${p.name} (Stock actual: ${p.stock} ${p.unit || 'pza'})</option>`
  ).join('');

  if (preselectedProductId && physicalProducts.some(p => p.id === preselectedProductId)) {
    sel.value = preselectedProductId;
  }
  document.getElementById('addInvQty').value = '5';
  document.getElementById('addInvReference').value = '';
  document.getElementById('addInvReason').value = 'Compra a proveedor / Entrada de almacén';
  sel.dispatchEvent(new Event('change'));
  openModal('addInventoryModal');
}

function openAdjustInventoryModal(preselectedProductId = null) {
  const physicalProducts = allProducts.filter(p => !p.isService);
  const sel = document.getElementById('adjInvProductSelect');
  if (!sel || physicalProducts.length === 0) return;

  sel.innerHTML = physicalProducts.map(p =>
    `<option value="${p.id}">[${p.sku}] ${p.name} (Stock sistema: ${p.stock} ${p.unit || 'pza'})</option>`
  ).join('');

  if (preselectedProductId && physicalProducts.some(p => p.id === preselectedProductId)) {
    sel.value = preselectedProductId;
  }
  document.getElementById('adjInvMode').value = 'set';
  document.getElementById('adjInvReference').value = '';
  document.getElementById('adjInvReason').value = 'Ajuste derivado de conteo físico en almacén';
  sel.dispatchEvent(new Event('change'));
  openModal('adjustInventoryModal');
}

function openProductKardexView(productId) {
  switchInventorySubTab('kardex');
  const sel = document.getElementById('kardexProductSelect');
  if (sel && productId) {
    sel.value = productId;
    renderKardexTab();
  }
}

function renderInventoryModule() {
  const physical = allProducts.filter(p => !p.isService);
  const totalUnits = physical.reduce((s, p) => s + (Number(p.stock) || 0), 0);
  const lowStockItems = physical.filter(p => Number(p.stock) <= Number(p.minStock || 3));
  const outStockItems = physical.filter(p => Number(p.stock) <= 0);
  const totalCostVal = physical.reduce((s, p) => s + (Number(p.stock) || 0) * (parseFloat(p.cost) || 0), 0);
  const totalRetailVal = physical.reduce((s, p) => s + (Number(p.stock) || 0) * (parseFloat(p.price) || 0), 0);

  const elUnits = document.getElementById('invKpiTotalUnits');
  const elSkus = document.getElementById('invKpiSkuCount');
  const elLow = document.getElementById('invKpiLowStockCount');
  const elOut = document.getElementById('invKpiOutStockBadge');
  const elCost = document.getElementById('invKpiCostValue');
  const elRetail = document.getElementById('invKpiRetailValue');
  const elMovs = document.getElementById('invKpiMovementsBadge');
  const elTabLow = document.getElementById('invTabLowCount');

  if (elUnits) elUnits.textContent = totalUnits.toLocaleString('es-MX');
  if (elSkus) elSkus.textContent = `${physical.length} SKUs físicos`;
  if (elLow) {
    elLow.textContent = lowStockItems.length;
    elLow.closest('.kpi-card')?.classList.toggle('kpi-urgent-active', lowStockItems.length > 0);
  }
  if (elOut) {
    elOut.innerHTML = `<span class="status-dot dot-red"></span>${outStockItems.length} agotados`;
    elOut.classList.toggle('badge-low-stock-pulse', outStockItems.length > 0 || lowStockItems.length > 0);
  }
  if (elCost) elCost.textContent = formatMoney(totalCostVal);
  if (elRetail) elRetail.textContent = formatMoney(totalRetailVal);
  if (elMovs) elMovs.textContent = `${allInventoryMovements.length} mov. Kardex`;
  if (elTabLow) {
    elTabLow.textContent = lowStockItems.length;
    elTabLow.classList.toggle('badge-low-stock-pulse', lowStockItems.length > 0);
  }

  // Populate Kardex Product Selector preserving selection
  const kdxSel = document.getElementById('kardexProductSelect');
  if (kdxSel) {
    const prev = kdxSel.value;
    kdxSel.innerHTML = physical.map(p =>
      `<option value="${p.id}">[${p.sku}] ${p.name} — Stock: ${p.stock} ${p.unit || 'pza'}</option>`
    ).join('');
    if (prev && physical.some(p => p.id === prev)) {
      kdxSel.value = prev;
    }
  }

  renderStoreTable();
  renderLowStockTable();
  renderInventoryValuationReport();
  renderInventoryMovementsTable();
  renderKardexTab();
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
    const photos = Array.isArray(p.images) && p.images.length > 0 ? p.images : (p.imageUrl ? [p.imageUrl] : []);
    const coverPhoto = photos[0] || '';
    const photoCount = photos.length;

    return `
      <tr class="${isLow ? 'low-stock-row-alert' : ''}">
        <td data-label="SKU / Barras" class="mono">
          <div><strong>${p.sku}</strong><div style="font-size:0.68rem; color:var(--text-muted);">|||| ${p.barcode || '-'}</div></div>
        </td>
        <td data-label="Producto / Servicio">
          <div class="prod-cell-wrap">
            <div class="prod-table-thumb btn-view-prod-photo" data-id="${p.id}" title="${photoCount > 0 ? 'Ver galería de fotos (' + photoCount + ')' : 'Agregar fotografía'}">
              ${coverPhoto ? `<img src="${coverPhoto}" alt="${p.name}" onerror="this.src='/logo.gif'">` : `<div class="prod-table-thumb-placeholder"><span>📷</span><span style="font-size:0.58rem; margin-top:2px;">+ Foto</span></div>`}
              ${photoCount > 1 ? `<span class="prod-table-thumb-count">+${photoCount}</span>` : ''}
            </div>
            <div style="min-width:0;">
              <strong>${p.name}</strong>
              <div style="font-size:0.74rem; color:var(--text-muted);">${p.description || ''}</div>
            </div>
          </div>
        </td>
        <td data-label="Categoría"><span class="kbd-tag">${CATEGORY_LABELS[p.category] || p.category}</span></td>
        <td data-label="Costo" style="text-align:right;" class="mono tabular">${formatMoney(p.cost)}</td>
        <td data-label="Precio Púb." style="text-align:right;" class="mono tabular"><strong>${formatMoney(p.price)}</strong></td>
        <td data-label="Margen" style="text-align:right;" class="mono tabular"><span style="color:var(--primary); font-weight:600;">+${margin}%</span></td>
        <td data-label="Existencia / Mín." style="text-align:center;">
          ${p.isService
            ? '<span class="badge badge-purple">Servicio</span>'
            : `<div>
                 <span class="badge ${isLow ? 'badge-red badge-low-stock-pulse' : 'badge-green'}"><span class="status-dot ${isLow ? 'dot-red' : 'dot-lime'}"></span>${p.stock} ${p.unit || 'pza'}</span>
                 <div class="mono tabular" style="font-size:0.68rem; color:var(--text-muted); margin-top:2px;">Mín: ${p.minStock || 0}</div>
               </div>`
          }
        </td>
        <td data-label="Catálogo Web" style="text-align:center;">
          <span class="badge ${p.publicVisible !== false ? 'badge-green' : 'badge-amber'}">${p.publicVisible !== false ? 'Público' : 'Oculto'}</span>
        </td>
        <td data-label="Manejo de Inventario" style="text-align:right; white-space:nowrap;">
          <div style="display:inline-flex; gap:5px; justify-content:flex-end; flex-wrap:wrap;">
            <button class="btn btn-secondary btn-sm btn-manage-prod-photos" data-id="${p.id}" title="Administrar fotografías del producto">📷 ${photoCount > 0 ? photoCount : '+ Foto'}</button>
            ${!p.isService ? `
              <button class="btn btn-primary btn-sm btn-inv-add" data-id="${p.id}" title="Agregar Inventario (Entrada)">+ Stock</button>
              <button class="btn btn-secondary btn-sm btn-inv-adj" data-id="${p.id}" title="Ajuste de Inventario / Conteo">Ajustar</button>
              <button class="btn btn-secondary btn-sm btn-inv-kardex" data-id="${p.id}" title="Ver Tarjeta Kardex del Producto">Kardex</button>
            ` : ''}
            <button class="btn btn-ghost btn-sm btn-edit-prod" data-id="${p.id}">Editar</button>
            ${currentUser?.permissions?.canDelete ? `<button class="btn btn-danger btn-sm btn-del-prod" data-id="${p.id}">✕</button>` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('.btn-view-prod-photo').forEach(thumb => {
    thumb.addEventListener('click', () => {
      const p = allProducts.find(x => x.id === thumb.dataset.id);
      if (!p) return;
      const photos = Array.isArray(p.images) && p.images.length > 0 ? p.images : (p.imageUrl ? [p.imageUrl] : []);
      if (photos.length > 0) {
        openProductPhotoLightbox(p);
      } else {
        openEditProductModal(p.id);
      }
    });
  });

  tbody.querySelectorAll('.btn-manage-prod-photos').forEach(btn => {
    btn.addEventListener('click', () => openEditProductModal(btn.dataset.id));
  });

  tbody.querySelectorAll('.btn-inv-add').forEach(btn => {
    btn.addEventListener('click', () => openAddInventoryModal(btn.dataset.id));
  });
  tbody.querySelectorAll('.btn-inv-adj').forEach(btn => {
    btn.addEventListener('click', () => openAdjustInventoryModal(btn.dataset.id));
  });
  tbody.querySelectorAll('.btn-inv-kardex').forEach(btn => {
    btn.addEventListener('click', () => openProductKardexView(btn.dataset.id));
  });

  tbody.querySelectorAll('.btn-edit-prod').forEach(btn => {
    btn.addEventListener('click', () => openEditProductModal(btn.dataset.id));
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

function openEditProductModal(productId) {
  const p = allProducts.find(x => x.id === productId);
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

  // Load photos into editor
  currentProductPhotos = Array.isArray(p.images) && p.images.length > 0
    ? [...p.images]
    : (p.imageUrl ? [p.imageUrl] : []);

  const galleryEl = document.getElementById('prodPhotosGalleryPreview');
  const countBadge = document.getElementById('prodPhotosCountBadge');
  if (countBadge) countBadge.textContent = `${currentProductPhotos.length} / 6 fotos`;
  if (galleryEl) {
    if (currentProductPhotos.length === 0) {
      galleryEl.innerHTML = `
        <div style="grid-column:1/-1; padding:12px; text-align:center; color:var(--text-muted); font-size:0.75rem; border:1px dashed var(--border-subtle); border-radius:8px;">
          Sin fotografías agregadas. Haz clic en "Subir / Tomar Fotografías" o pega un enlace de imagen.
        </div>
      `;
    } else {
      galleryEl.innerHTML = currentProductPhotos.map((photoUrl, idx) => `
        <div class="prod-photo-item ${idx === 0 ? 'is-cover' : ''}" data-idx="${idx}">
          <img src="${photoUrl}" alt="Foto ${idx + 1}" onerror="this.src='/logo.gif'">
          ${idx === 0 ? '<span class="prod-photo-cover-tag">Principal</span>' : ''}
          <div class="prod-photo-controls">
            ${idx > 0 ? `<button type="button" class="prod-photo-btn btn-make-cover" data-idx="${idx}" title="Fijar como foto principal">⭐</button>` : '<span></span>'}
            <button type="button" class="prod-photo-btn btn-del btn-del-photo" data-idx="${idx}" title="Eliminar fotografía">✕</button>
          </div>
        </div>
      `).join('');

      galleryEl.querySelectorAll('.btn-make-cover').forEach(btn => {
        btn.addEventListener('click', () => {
          const i = Number(btn.dataset.idx);
          const [target] = currentProductPhotos.splice(i, 1);
          currentProductPhotos.unshift(target);
          openEditProductModal(p.id);
        });
      });

      galleryEl.querySelectorAll('.btn-del-photo').forEach(btn => {
        btn.addEventListener('click', () => {
          const i = Number(btn.dataset.idx);
          currentProductPhotos.splice(i, 1);
          openEditProductModal(p.id);
        });
      });
    }
  }

  const titleEl = document.getElementById('productModalTitle') || document.getElementById('prodModalTitle');
  if (titleEl) titleEl.textContent = `Editar: ${p.name}`;
  openModal('productModal');
}

function openProductPhotoLightbox(product) {
  currentLightboxProduct = product;
  const photos = Array.isArray(product.images) && product.images.length > 0
    ? product.images
    : (product.imageUrl ? [product.imageUrl] : []);

  const skuEl = document.getElementById('photoLightboxSku');
  const titleEl = document.getElementById('photoLightboxTitle');
  const mainImg = document.getElementById('photoLightboxMainImg');
  const thumbsContainer = document.getElementById('photoLightboxThumbs');

  if (skuEl) skuEl.textContent = `[${product.sku}] ${product.category?.toUpperCase() || ''}`;
  if (titleEl) titleEl.textContent = product.name;
  if (mainImg) {
    mainImg.src = photos[0] || '/logo.gif';
    mainImg.alt = product.name;
  }

  if (thumbsContainer) {
    thumbsContainer.innerHTML = photos.map((url, i) => `
      <div class="photo-lightbox-thumb ${i === 0 ? 'active' : ''}" data-src="${url}">
        <img src="${url}" alt="Miniatura ${i + 1}" onerror="this.src='/logo.gif'">
      </div>
    `).join('');

    thumbsContainer.querySelectorAll('.photo-lightbox-thumb').forEach(th => {
      th.addEventListener('click', () => {
        thumbsContainer.querySelectorAll('.photo-lightbox-thumb').forEach(t => t.classList.remove('active'));
        th.classList.add('active');
        if (mainImg) mainImg.src = th.dataset.src;
      });
    });
  }

  openModal('productPhotoLightboxModal');
}

function renderLowStockTable() {
  const tbody = document.getElementById('invLowStockTableBody');
  if (!tbody) return;

  const lowList = allProducts
    .filter(p => !p.isService && Number(p.stock) <= Number(p.minStock || 3))
    .sort((a, b) => Number(a.stock) - Number(b.stock));

  if (lowList.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8">${renderEmptyState('¡Almacén al 100%!', 'No hay productos bajos en inventario. Todos los artículos superan su stock mínimo.')}</td></tr>`;
    return;
  }

  tbody.innerHTML = lowList.map(p => {
    const stock = Number(p.stock) || 0;
    const min = Number(p.minStock) || 3;
    const suggested = Math.max(5, (min * 2) - stock);
    const estCost = suggested * (parseFloat(p.cost) || 0);
    return `
      <tr class="low-stock-row-alert">
        <td data-label="SKU / Código" class="mono"><strong>${p.sku}</strong></td>
        <td data-label="Producto"><strong>${p.name}</strong></td>
        <td data-label="Categoría"><span class="kbd-tag">${CATEGORY_LABELS[p.category] || p.category}</span></td>
        <td data-label="Existencia Actual" style="text-align:center;">
          <span class="badge badge-red badge-low-stock-pulse"><span class="status-dot dot-red"></span>${stock} ${p.unit || 'pza'}</span>
        </td>
        <td data-label="Stock Mínimo" style="text-align:center;" class="mono tabular">${min} ${p.unit || 'pza'}</td>
        <td data-label="Sugerido a Pedir" style="text-align:center;" class="mono tabular">
          <strong style="color:var(--amber);">+${suggested} ${p.unit || 'pza'}</strong>
        </td>
        <td data-label="Costo Reposición Est." style="text-align:right;" class="mono tabular"><strong>${formatMoney(estCost)}</strong></td>
        <td data-label="Acción Rápida" style="text-align:right;">
          <button type="button" class="btn btn-primary btn-sm btn-lowstock-restock" data-id="${p.id}">+ Surtir Ahora</button>
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('.btn-lowstock-restock').forEach(btn => {
    btn.addEventListener('click', () => openAddInventoryModal(btn.dataset.id));
  });
}

function renderInventoryValuationReport() {
  const catTbody = document.getElementById('invCategoryValuationTableBody');
  const detTbody = document.getElementById('invValuationDetailTableBody');
  const physical = allProducts.filter(p => !p.isService);

  if (catTbody) {
    const groups = {};
    physical.forEach(p => {
      const cat = p.category || 'pos';
      if (!groups[cat]) {
        groups[cat] = { skus: 0, units: 0, costVal: 0, retailVal: 0 };
      }
      const st = Number(p.stock) || 0;
      groups[cat].skus += 1;
      groups[cat].units += st;
      groups[cat].costVal += st * (parseFloat(p.cost) || 0);
      groups[cat].retailVal += st * (parseFloat(p.price) || 0);
    });

    catTbody.innerHTML = Object.entries(groups).map(([cat, g]) => {
      const profit = g.retailVal - g.costVal;
      return `
        <tr>
          <td data-label="Categoría de Almacén"><strong>${CATEGORY_LABELS[cat] || cat.toUpperCase()}</strong></td>
          <td data-label="SKUs Físicos" style="text-align:center;" class="mono tabular">${g.skus}</td>
          <td data-label="Unidades Totales" style="text-align:center;" class="mono tabular"><strong>${g.units}</strong></td>
          <td data-label="Valor al Costo" style="text-align:right;" class="mono tabular">${formatMoney(g.costVal)}</td>
          <td data-label="Valor Precio Público" style="text-align:right;" class="mono tabular"><strong>${formatMoney(g.retailVal)}</strong></td>
          <td data-label="Utilidad Potencial" style="text-align:right;" class="mono tabular"><strong style="color:var(--secondary);">+${formatMoney(profit)}</strong></td>
        </tr>
      `;
    }).join('');
  }

  if (detTbody) {
    detTbody.innerHTML = physical.map(p => {
      const st = Number(p.stock) || 0;
      const costTotal = st * (parseFloat(p.cost) || 0);
      const retailTotal = st * (parseFloat(p.price) || 0);
      return `
        <tr>
          <td data-label="SKU" class="mono"><strong>${p.sku}</strong></td>
          <td data-label="Producto">${p.name}</td>
          <td data-label="Categoría"><span class="kbd-tag">${CATEGORY_LABELS[p.category] || p.category}</span></td>
          <td data-label="Existencia" style="text-align:center;" class="mono tabular"><strong>${st} ${p.unit || 'pza'}</strong></td>
          <td data-label="Costo Unit." style="text-align:right;" class="mono tabular">${formatMoney(p.cost)}</td>
          <td data-label="Valor Costo Total" style="text-align:right;" class="mono tabular"><strong>${formatMoney(costTotal)}</strong></td>
          <td data-label="Precio Venta" style="text-align:right;" class="mono tabular">${formatMoney(p.price)}</td>
          <td data-label="Valor Comercial" style="text-align:right;" class="mono tabular"><strong style="color:var(--primary);">${formatMoney(retailTotal)}</strong></td>
        </tr>
      `;
    }).join('');
  }
}

function getMovementBadgeHtml(type, delta) {
  if (type === 'entrada') {
    return `<span class="badge badge-green"><span class="status-dot dot-lime"></span>Entrada / Compra</span>`;
  }
  if (type === 'entrada_devolucion') {
    return `<span class="badge badge-blue"><span class="status-dot dot-blue"></span>Devolución (+)</span>`;
  }
  if (type === 'salida_venta') {
    return `<span class="badge badge-purple"><span class="status-dot dot-purple"></span>Salida Venta POS</span>`;
  }
  if (type === 'merma') {
    return `<span class="badge badge-red"><span class="status-dot dot-red"></span>Baja por Merma</span>`;
  }
  if (type === 'ajuste_conteo') {
    return `<span class="badge badge-amber"><span class="status-dot dot-amber"></span>Ajuste Conteo (${delta >= 0 ? '+' : '-'})</span>`;
  }
  return `<span class="badge ${delta >= 0 ? 'badge-green' : 'badge-amber'}">${delta >= 0 ? 'Entrada (+)' : 'Ajuste Salida (-)'}</span>`;
}

function renderInventoryMovementsTable() {
  const tbody = document.getElementById('invMovementsTableBody');
  if (!tbody) return;

  const q = (document.getElementById('invMovSearchInput')?.value || '').toLowerCase().trim();

  const filtered = allInventoryMovements.filter(m => {
    const delta = Number(m.delta) || 0;
    if (invMovFilter === 'entradas' && delta <= 0) return false;
    if (invMovFilter === 'salidas' && delta >= 0) return false;
    if (invMovFilter !== 'all' && invMovFilter !== 'entradas' && invMovFilter !== 'salidas' && m.type !== invMovFilter) return false;
    if (q) {
      const hay = `${m.folio} ${m.sku} ${m.productName} ${m.reason} ${m.reference} ${m.user}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10">${renderEmptyState('Sin movimientos para este filtro', 'Intenta con otra búsqueda o registra una entrada/ajuste de inventario.')}</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(m => {
    const delta = Number(m.delta) || 0;
    const d = m.date ? new Date(m.date).toLocaleString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-';
    return `
      <tr>
        <td data-label="Folio" class="mono"><strong>${m.folio}</strong></td>
        <td data-label="Fecha / Hora" class="tabular">${d}</td>
        <td data-label="SKU / Producto">
          <div><strong class="mono" style="color:var(--primary);">${m.sku}</strong> · <strong>${m.productName}</strong></div>
        </td>
        <td data-label="Tipo de Movimiento">${getMovementBadgeHtml(m.type, delta)}</td>
        <td data-label="Motivo & Referencia">
          <div>${m.reason || '-'}</div>
          <div class="mono" style="font-size:0.71rem; color:var(--text-muted);">Ref: ${m.reference || '-'}</div>
        </td>
        <td data-label="Stock Ant." style="text-align:center;" class="mono tabular">${m.stockBefore}</td>
        <td data-label="Mov." style="text-align:center;" class="mono tabular">
          <strong style="color:${delta >= 0 ? 'var(--secondary)' : 'var(--amber)'};">${delta >= 0 ? '+' + delta : delta}</strong>
        </td>
        <td data-label="Stock Final" style="text-align:center;" class="mono tabular"><strong>${m.stockAfter}</strong></td>
        <td data-label="Valor Mov." style="text-align:right;" class="mono tabular">${formatMoney(m.totalCost || (Math.abs(delta) * (m.unitCost || 0)))}</td>
        <td data-label="Responsable">${m.user || 'Sistema'}</td>
      </tr>
    `;
  }).join('');
}

function renderKardexTab() {
  const sel = document.getElementById('kardexProductSelect');
  const tbody = document.getElementById('kardexMovementsTableBody');
  if (!sel || !tbody) return;

  const prod = allProducts.find(p => p.id === sel.value) || allProducts.find(p => !p.isService);
  if (!prod) return;

  const movs = allInventoryMovements
    .filter(m => m.productId === prod.id || m.sku === prod.sku)
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  const entries = movs.filter(m => Number(m.delta) > 0).reduce((s, m) => s + Math.abs(Number(m.delta) || 0), 0);
  const exits = movs.filter(m => Number(m.delta) < 0).reduce((s, m) => s + Math.abs(Number(m.delta) || 0), 0);
  const valCost = (Number(prod.stock) || 0) * (parseFloat(prod.cost) || 0);

  document.getElementById('kdxSummarySku').textContent = `${prod.sku} · |||| ${prod.barcode || '-'}`;
  document.getElementById('kdxSummaryStock').textContent = `${prod.stock} ${prod.unit || 'pza'} (Mín: ${prod.minStock || 0})`;
  document.getElementById('kdxSummaryEntries').textContent = `+${entries} ${prod.unit || 'pza'}`;
  document.getElementById('kdxSummaryExits').textContent = `-${exits} ${prod.unit || 'pza'}`;
  document.getElementById('kdxSummaryValuation').textContent = `${formatMoney(prod.cost)} c/u · Total: ${formatMoney(valCost)}`;
  document.getElementById('kardexProductTitle').textContent = `Kardex: [${prod.sku}] ${prod.name}`;

  if (movs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10">${renderEmptyState('Sin movimientos en Kardex', 'Registra una entrada o ajuste para iniciar la trazabilidad de este artículo.')}</td></tr>`;
    return;
  }

  tbody.innerHTML = movs.map(m => {
    const delta = Number(m.delta) || 0;
    const d = m.date ? new Date(m.date).toLocaleString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';
    return `
      <tr>
        <td data-label="Folio Kardex" class="mono"><strong>${m.folio}</strong></td>
        <td data-label="Fecha / Hora" class="tabular">${d}</td>
        <td data-label="Tipo Operación">${getMovementBadgeHtml(m.type, delta)}</td>
        <td data-label="Concepto / Documento Referencia">
          <div><strong>${m.reason || '-'}</strong></div>
          <div class="mono" style="font-size:0.71rem; color:var(--text-muted);">Doc/Ref: ${m.reference || '-'}</div>
        </td>
        <td data-label="Existencia Anterior" style="text-align:center;" class="mono tabular">${m.stockBefore}</td>
        <td data-label="Entrada / Salida" style="text-align:center;" class="mono tabular">
          <strong style="color:${delta >= 0 ? 'var(--secondary)' : 'var(--amber)'}; font-size:0.95rem;">
            ${delta >= 0 ? '+' + delta : delta}
          </strong>
        </td>
        <td data-label="Existencia Final (Saldo)" style="text-align:center;" class="mono tabular"><strong>${m.stockAfter}</strong></td>
        <td data-label="Costo Unit." style="text-align:right;" class="mono tabular">${formatMoney(m.unitCost)}</td>
        <td data-label="Importe Total" style="text-align:right;" class="mono tabular"><strong>${formatMoney(m.totalCost || (Math.abs(delta) * (m.unitCost || 0)))}</strong></td>
        <td data-label="Responsable">${m.user || 'Sistema'}</td>
      </tr>
    `;
  }).join('');
}

function exportLowStockToCSV() {
  const headers = ['SKU', 'CodigoBarras', 'Producto', 'Categoria', 'ExistenciaActual', 'StockMinimo', 'SugeridoPedir', 'CostoUnitario', 'CostoReposicionEstimado'];
  const lowList = allProducts.filter(p => !p.isService && Number(p.stock) <= Number(p.minStock || 3));
  const rows = lowList.map(p => {
    const st = Number(p.stock) || 0;
    const min = Number(p.minStock) || 3;
    const sug = Math.max(5, (min * 2) - st);
    return [
      p.sku,
      p.barcode || '',
      `"${(p.name || '').replace(/"/g, '""')}"`,
      p.category,
      st,
      min,
      sug,
      (parseFloat(p.cost) || 0).toFixed(2),
      (sug * (parseFloat(p.cost) || 0)).toFixed(2)
    ];
  });
  const csv = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `fiberlink-productos-bajos-inventario-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  showToast('Reporte de productos bajos en inventario exportado a CSV');
}

function exportInventoryReportToCSV() {
  const headers = ['SKU', 'CodigoBarras', 'Producto', 'Categoria', 'Existencia', 'StockMinimo', 'CostoUnitario', 'ValorCostoTotal', 'PrecioPublico', 'ValorComercialTotal'];
  const physical = allProducts.filter(p => !p.isService);
  const rows = physical.map(p => {
    const st = Number(p.stock) || 0;
    const cost = parseFloat(p.cost) || 0;
    const price = parseFloat(p.price) || 0;
    return [
      p.sku,
      p.barcode || '',
      `"${(p.name || '').replace(/"/g, '""')}"`,
      p.category,
      st,
      p.minStock || 0,
      cost.toFixed(2),
      (st * cost).toFixed(2),
      price.toFixed(2),
      (st * price).toFixed(2)
    ];
  });
  const csv = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `fiberlink-reporte-valorizado-inventario-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  showToast('Reporte general de inventario exportado a CSV');
}

function exportMovementsToCSV() {
  const headers = ['Folio', 'Fecha', 'SKU', 'Producto', 'Tipo', 'Motivo', 'Referencia', 'StockAnterior', 'Movimiento', 'StockFinal', 'CostoUnitario', 'CostoTotal', 'Responsable'];
  const rows = allInventoryMovements.map(m => [
    m.folio,
    m.date,
    m.sku,
    `"${(m.productName || '').replace(/"/g, '""')}"`,
    m.type,
    `"${(m.reason || '').replace(/"/g, '""')}"`,
    `"${(m.reference || '').replace(/"/g, '""')}"`,
    m.stockBefore,
    m.delta,
    m.stockAfter,
    (parseFloat(m.unitCost) || 0).toFixed(2),
    (parseFloat(m.totalCost) || 0).toFixed(2),
    `"${(m.user || '').replace(/"/g, '""')}"`
  ]);
  const csv = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `fiberlink-reporte-movimientos-kardex-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  showToast('Reporte de movimientos de inventario exportado a CSV');
}

function printLowStockReport() {
  const area = document.getElementById('printArea');
  if (!area) return;
  const lowList = allProducts.filter(p => !p.isService && Number(p.stock) <= Number(p.minStock || 3));
  area.innerHTML = `
    <div style="max-width:750px; margin:0 auto; font-family:Arial,sans-serif; color:#000;">
      <h2>FIBERLINK SERVICIOS TIC — ORDEN DE REABASTECIMIENTO (PRODUCTOS BAJOS EN INVENTARIO)</h2>
      <p style="font-size:12px;">Generado el: ${new Date().toLocaleString('es-MX')} · Responsable: ${currentUser?.name || 'Almacén'}</p>
      <hr style="margin:10px 0;">
      <table style="width:100%; border-collapse:collapse; font-size:12px;" border="1" cellpadding="6">
        <thead>
          <tr style="background:#f0f0f0;">
            <th align="left">SKU</th>
            <th align="left">Producto</th>
            <th align="center">Stock Actual</th>
            <th align="center">Mínimo</th>
            <th align="center">Sugerido a Pedir</th>
            <th align="right">Costo Est.</th>
          </tr>
        </thead>
        <tbody>
          ${lowList.map(p => {
            const st = Number(p.stock) || 0;
            const min = Number(p.minStock) || 3;
            const sug = Math.max(5, (min * 2) - st);
            return `
              <tr>
                <td>${p.sku}</td>
                <td>${p.name}</td>
                <td align="center"><strong>${st}</strong></td>
                <td align="center">${min}</td>
                <td align="center">+${sug}</td>
                <td align="right">${formatMoney(sug * (parseFloat(p.cost) || 0))}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
  window.print();
}

function printInventoryReport() {
  const area = document.getElementById('printArea');
  if (!area) return;
  const physical = allProducts.filter(p => !p.isService);
  const totalCost = physical.reduce((s, p) => s + (Number(p.stock) || 0) * (parseFloat(p.cost) || 0), 0);
  const totalRetail = physical.reduce((s, p) => s + (Number(p.stock) || 0) * (parseFloat(p.price) || 0), 0);

  area.innerHTML = `
    <div style="max-width:760px; margin:0 auto; font-family:Arial,sans-serif; color:#000;">
      <h2>FIBERLINK SERVICIOS TIC — REPORTE GENERAL VALORIZADO DE INVENTARIO</h2>
      <p style="font-size:12px;">Fecha: ${new Date().toLocaleString('es-MX')} · Capital al Costo: <strong>${formatMoney(totalCost)}</strong> · Valor Comercial: <strong>${formatMoney(totalRetail)}</strong></p>
      <hr style="margin:10px 0;">
      <table style="width:100%; border-collapse:collapse; font-size:12px;" border="1" cellpadding="5">
        <thead>
          <tr style="background:#f0f0f0;">
            <th align="left">SKU</th>
            <th align="left">Producto</th>
            <th align="center">Existencia</th>
            <th align="right">Costo Unit.</th>
            <th align="right">Total Costo</th>
            <th align="right">Precio Púb.</th>
            <th align="right">Total Comercial</th>
          </tr>
        </thead>
        <tbody>
          ${physical.map(p => {
            const st = Number(p.stock) || 0;
            return `
              <tr>
                <td>${p.sku}</td>
                <td>${p.name}</td>
                <td align="center"><strong>${st}</strong></td>
                <td align="right">${formatMoney(p.cost)}</td>
                <td align="right">${formatMoney(st * (parseFloat(p.cost) || 0))}</td>
                <td align="right">${formatMoney(p.price)}</td>
                <td align="right"><strong>${formatMoney(st * (parseFloat(p.price) || 0))}</strong></td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
  window.print();
}

function printMovementsReport() {
  const area = document.getElementById('printArea');
  if (!area) return;
  area.innerHTML = `
    <div style="max-width:760px; margin:0 auto; font-family:Arial,sans-serif; color:#000;">
      <h2>FIBERLINK SERVICIOS TIC — REPORTE DE MOVIMIENTOS DE INVENTARIO</h2>
      <p style="font-size:12px;">Generado el: ${new Date().toLocaleString('es-MX')}</p>
      <hr style="margin:10px 0;">
      <table style="width:100%; border-collapse:collapse; font-size:11px;" border="1" cellpadding="5">
        <thead>
          <tr style="background:#f0f0f0;">
            <th align="left">Folio</th>
            <th align="left">Fecha</th>
            <th align="left">SKU / Producto</th>
            <th align="left">Motivo / Ref</th>
            <th align="center">Ant.</th>
            <th align="center">Mov.</th>
            <th align="center">Final</th>
            <th align="left">Usuario</th>
          </tr>
        </thead>
        <tbody>
          ${allInventoryMovements.map(m => `
            <tr>
              <td>${m.folio}</td>
              <td>${new Date(m.date).toLocaleDateString('es-MX')}</td>
              <td>[${m.sku}] ${m.productName}</td>
              <td>${m.reason} (${m.reference || '-'})</td>
              <td align="center">${m.stockBefore}</td>
              <td align="center"><strong>${m.delta >= 0 ? '+' + m.delta : m.delta}</strong></td>
              <td align="center"><strong>${m.stockAfter}</strong></td>
              <td>${m.user}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
  window.print();
}

function printProductKardex() {
  const sel = document.getElementById('kardexProductSelect');
  const prod = allProducts.find(p => p.id === sel?.value);
  const area = document.getElementById('printArea');
  if (!area || !prod) return;

  const movs = allInventoryMovements.filter(m => m.productId === prod.id || m.sku === prod.sku);
  area.innerHTML = `
    <div style="max-width:760px; margin:0 auto; font-family:Arial,sans-serif; color:#000;">
      <h2>FIBERLINK SERVICIOS TIC — TARJETA KARDEX DE INVENTARIO</h2>
      <p style="font-size:13px;">
        <strong>Artículo:</strong> [${prod.sku}] ${prod.name} &nbsp;|&nbsp;
        <strong>Código de Barras:</strong> ${prod.barcode || '-'} &nbsp;|&nbsp;
        <strong>Existencia Actual:</strong> ${prod.stock} ${prod.unit || 'pza'}
      </p>
      <hr style="margin:10px 0;">
      <table style="width:100%; border-collapse:collapse; font-size:12px;" border="1" cellpadding="5">
        <thead>
          <tr style="background:#f0f0f0;">
            <th align="left">Folio</th>
            <th align="left">Fecha</th>
            <th align="left">Tipo</th>
            <th align="left">Concepto / Referencia</th>
            <th align="center">Stock Ant.</th>
            <th align="center">Mov.</th>
            <th align="center">Saldo Final</th>
            <th align="right">Costo Unit.</th>
            <th align="left">Responsable</th>
          </tr>
        </thead>
        <tbody>
          ${movs.map(m => `
            <tr>
              <td>${m.folio}</td>
              <td>${new Date(m.date).toLocaleString('es-MX')}</td>
              <td>${m.type.toUpperCase()}</td>
              <td>${m.reason} (${m.reference || '-'})</td>
              <td align="center">${m.stockBefore}</td>
              <td align="center"><strong>${m.delta >= 0 ? '+' + m.delta : m.delta}</strong></td>
              <td align="center"><strong>${m.stockAfter}</strong></td>
              <td align="right">${formatMoney(m.unitCost)}</td>
              <td>${m.user}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
  window.print();
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
      <div class="kpi-card kpi-anim-enter" style="--stagger:0;">
        <div class="kpi-top"><span class="kpi-label">VENTAS BRUTAS TOTALES</span></div>
        <div class="kpi-mid">
          <div class="kpi-value accent tabular" data-countup="${fin.grossRevenue}" data-format="money">${formatMoney(fin.grossRevenue)}</div>
          <span class="kpi-delta up">+100%</span>
        </div>
        <div class="kpi-foot"><span>Ticket Promedio:</span><strong class="mono tabular" data-countup="${fin.avgTicketSale}" data-format="money">${formatMoney(fin.avgTicketSale)}</strong></div>
      </div>
      <div class="kpi-card kpi-anim-enter" style="--stagger:1;">
        <div class="kpi-top"><span class="kpi-label">UTILIDAD BRUTA ESTIMADA</span></div>
        <div class="kpi-mid">
          <div class="kpi-value tabular" data-countup="${fin.estimatedProfit}" data-format="money">${formatMoney(fin.estimatedProfit)}</div>
          <span class="kpi-delta up">Rentable</span>
        </div>
        <div class="kpi-foot"><span>Costo de venta:</span><strong class="mono tabular" data-countup="${fin.estimatedCost}" data-format="money">${formatMoney(fin.estimatedCost)}</strong></div>
      </div>
      <div class="kpi-card kpi-anim-enter" style="--stagger:2;">
        <div class="kpi-top"><span class="kpi-label">CUENTAS POR COBRAR</span></div>
        <div class="kpi-mid">
          <div class="kpi-value cyan tabular" data-countup="${fin.pendingReceivables}" data-format="money">${formatMoney(fin.pendingReceivables)}</div>
        </div>
        <div class="kpi-foot"><span>Tickets: ${formatMoney(fin.pendingTicketsBalance)}</span><span>Taller: ${formatMoney(fin.pendingWorkshopBalance)}</span></div>
      </div>
      <div class="kpi-card kpi-anim-enter" style="--stagger:3;">
        <div class="kpi-top"><span class="kpi-label">VALOR COMERCIAL ALMACÉN</span></div>
        <div class="kpi-mid">
          <div class="kpi-value tabular" data-countup="${inv.inventoryRetailValue}" data-format="money">${formatMoney(inv.inventoryRetailValue)}</div>
        </div>
        <div class="kpi-foot"><span>Costo en stock:</span><strong class="mono tabular" data-countup="${inv.inventoryCostValue}" data-format="money">${formatMoney(inv.inventoryCostValue)}</strong></div>
      </div>
    `;
  }

  const payEl = document.getElementById('reportsPaymentBreakdown');
  if (payEl) {
    const totalRev = Math.max(1, fin.grossRevenue);
    const methods = Object.entries(fin.byPaymentMethod || {});
    payEl.innerHTML = methods.map(([m, val], idx) => {
      const pct = Math.round((val / totalRev) * 100);
      return `
        <div class="sbar-row sbar-anim-enter" style="--bar-idx:${idx};">
          <div class="sbar-top"><span>${m}</span><strong class="mono tabular" data-countup="${val}" data-format="money">${formatMoney(val)}</strong></div>
          <div class="sbar-track"><div class="sbar-fill" data-target-width="${pct}" style="width:0%; --bar-idx:${idx};"></div></div>
        </div>
      `;
    }).join('');
  }

  const topBody = document.getElementById('reportsTopProductsBody');
  if (topBody) {
    const top = reportsData.topProducts || [];
    topBody.innerHTML = top.map(item => `
      <tr>
        <td data-label="SKU" class="mono">${item.sku}</td>
        <td data-label="Concepto">${item.name}</td>
        <td data-label="Unidades" style="text-align:center;" class="mono tabular">${item.qty}</td>
        <td data-label="Ingreso Generado" style="text-align:right;" class="mono tabular"><strong data-countup="${item.revenue}" data-format="money">${formatMoney(item.revenue)}</strong></td>
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
      <div class="sbar-row"><div class="sbar-top"><span>Artículos en Catálogo</span><strong class="mono tabular" data-countup="${inv.totalCatalogItems}" data-format="int">${inv.totalCatalogItems}</strong></div></div>
      <div class="sbar-row"><div class="sbar-top"><span>Productos Físicos</span><strong class="mono tabular" data-countup="${inv.physicalItemsCount}" data-format="int">${inv.physicalItemsCount}</strong></div></div>
      <div class="sbar-row"><div class="sbar-top"><span>Alertas de Stock Bajo</span><strong class="mono tabular" style="color:var(--danger);" data-countup="${inv.lowStockCount}" data-format="int">${inv.lowStockCount}</strong></div></div>
      <div class="sbar-row"><div class="sbar-top"><span>Capital al Costo</span><strong class="mono tabular" data-countup="${inv.inventoryCostValue}" data-format="money">${formatMoney(inv.inventoryCostValue)}</strong></div></div>
      <div class="sbar-row"><div class="sbar-top"><span>Utilidad Potencial en Stock</span><strong class="mono tabular" style="color:var(--primary);" data-countup="${potentialProfit}" data-format="money">${formatMoney(potentialProfit)}</strong></div></div>
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

// ==========================================
// 14. VIEW 8: CLIENTES, FACTURACIÓN & ADMINISTRACIÓN DE CRÉDITOS
// ==========================================
function switchClientsSubTab(tabName) {
  const dirBtn = document.getElementById('btnCliTabDirectory');
  const credBtn = document.getElementById('btnCliTabCredits');
  const dirPane = document.getElementById('cliSubTabDirectory');
  const credPane = document.getElementById('cliSubTabCredits');

  const isDir = tabName !== 'credits';
  if (dirBtn) {
    dirBtn.classList.toggle('active', isDir);
    dirBtn.setAttribute('aria-selected', isDir ? 'true' : 'false');
  }
  if (credBtn) {
    credBtn.classList.toggle('active', !isDir);
    credBtn.setAttribute('aria-selected', !isDir ? 'true' : 'false');
  }
  if (dirPane) dirPane.classList.toggle('active', isDir);
  if (credPane) credPane.classList.toggle('active', !isDir);
}

function initClientsModule() {
  // Sub-Tab Switcher
  document.getElementById('btnCliTabDirectory')?.addEventListener('click', () => switchClientsSubTab('directory'));
  document.getElementById('btnCliTabCredits')?.addEventListener('click', () => switchClientsSubTab('credits'));

  // Directory Search & Filter Pills
  document.getElementById('cliSearchInput')?.addEventListener('input', renderClientsDirectoryTable);
  document.querySelectorAll('#cliFilterPills .pill-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#cliFilterPills .pill-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      cliDirectoryFilter = btn.dataset.clifilter || 'all';
      renderClientsDirectoryTable();
    });
  });

  // Credit Search & Filter Pills
  document.getElementById('creditSearchInput')?.addEventListener('input', renderClientsCreditBalancesTable);
  document.querySelectorAll('#creditFilterPills .pill-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#creditFilterPills .pill-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      cliCreditFilter = btn.dataset.credfilter || 'all';
      renderClientsCreditBalancesTable();
    });
  });

  // Buttons: New Client, Export Clients, Export Balances, Print Balances, Credit Movement
  document.getElementById('btnOpenNewClientModal')?.addEventListener('click', () => {
    openClientModalForCreate();
  });
  document.getElementById('btnExportClientsCsv')?.addEventListener('click', exportClientsToCSV);
  document.getElementById('btnExportCreditBalancesCsv')?.addEventListener('click', exportCreditBalancesToCSV);
  document.getElementById('btnPrintBalancesReport')?.addEventListener('click', printCreditBalancesReport);
  document.getElementById('btnOpenCreditMovementModal')?.addEventListener('click', () => {
    openCreditMovementModal();
  });

  // Toggle Credit & Billing sections inside #clientModal
  const hasCreditCheck = document.getElementById('cliHasCredit');
  const creditWrap = document.getElementById('cliCreditFieldsWrap');
  hasCreditCheck?.addEventListener('change', () => {
    creditWrap?.classList.toggle('hidden', !hasCreditCheck.checked);
  });

  const hasBillingCheck = document.getElementById('cliHasBilling');
  const billingWrap = document.getElementById('cliBillingFieldsWrap');
  hasBillingCheck?.addEventListener('change', () => {
    billingWrap?.classList.toggle('hidden', !hasBillingCheck.checked);
  });

  // Submit Create / Update Client
  const clientForm = document.getElementById('clientForm');
  clientForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('cliId').value;
    const hasCredit = document.getElementById('cliHasCredit').checked;
    const hasBilling = document.getElementById('cliHasBilling').checked;

    const payload = {
      name: document.getElementById('cliName').value.trim(),
      contactName: document.getElementById('cliContactName').value.trim(),
      phone: document.getElementById('cliPhone').value.trim(),
      email: document.getElementById('cliEmail').value.trim(),
      status: document.getElementById('cliStatus').value,
      address: document.getElementById('cliAddress').value.trim(),
      notes: document.getElementById('cliNotes').value.trim(),
      hasCredit,
      creditLimit: hasCredit ? parseFloat(document.getElementById('cliCreditLimit').value) || 0 : 0,
      creditDays: hasCredit ? parseInt(document.getElementById('cliCreditDays').value, 10) || 30 : 0,
      hasBilling,
      rfc: hasBilling ? document.getElementById('cliRfc').value.trim().toUpperCase() : '',
      cpFiscal: hasBilling ? document.getElementById('cliCpFiscal').value.trim() : '',
      razonSocial: hasBilling ? document.getElementById('cliRazonSocial').value.trim().toUpperCase() : '',
      regimenFiscal: hasBilling ? document.getElementById('cliRegimenFiscal').value : '',
      usoCfdi: hasBilling ? document.getElementById('cliUsoCfdi').value : '',
      billingEmail: hasBilling ? document.getElementById('cliBillingEmail').value.trim() : ''
    };

    if (!id && hasCredit) {
      payload.currentBalance = Math.max(0, parseFloat(document.getElementById('cliInitialBalance')?.value) || 0);
    }

    try {
      if (id) {
        await erpService.updateClient(id, payload);
        showToast('Expediente del cliente actualizado');
      } else {
        await erpService.createClient(payload);
        showToast('Nuevo cliente registrado exitosamente');
      }
      closeModal('clientModal');
      await syncAllData();
    } catch (err) {
      showToast(err.message);
    }
  });

  // Delete Client from Modal
  document.getElementById('cliDeleteBtn')?.addEventListener('click', async () => {
    const id = document.getElementById('cliId').value;
    if (!id) return;
    const cli = allClients.find(c => c.id === id);
    if (!confirm(`¿Eliminar permanentemente al cliente "${cli?.name || id}"?`)) return;
    try {
      await erpService.deleteClient(id);
      closeModal('clientModal');
      await syncAllData();
      showToast('Cliente eliminado del padrón');
    } catch (err) {
      showToast(err.message);
    }
  });

  // Credit Movement Modal Live Calculations (Abonos, Liquidaciones, Cargos)
  const movClientSel = document.getElementById('credMovClientSelect');
  const movTypeSel = document.getElementById('credMovType');
  const movAmountIn = document.getElementById('credMovAmount');

  const updateCreditMovementPreview = () => {
    const cli = allClients.find(c => c.id === movClientSel?.value);
    const limit = parseFloat(cli?.creditLimit) || 0;
    const bal = parseFloat(cli?.currentBalance) || 0;
    const avail = Math.max(0, limit - bal);

    const limEl = document.getElementById('credMovLimitDisplay');
    const balEl = document.getElementById('credMovBalanceDisplay');
    const avEl = document.getElementById('credMovAvailableDisplay');
    const projEl = document.getElementById('credMovProjectedBalance');
    const conceptIn = document.getElementById('credMovConcept');

    if (limEl) limEl.textContent = formatMoney(limit);
    if (balEl) balEl.textContent = formatMoney(bal);
    if (avEl) avEl.textContent = formatMoney(avail);

    const type = movTypeSel?.value || 'abono';
    if (type === 'liquidacion') {
      if (movAmountIn) {
        movAmountIn.value = bal.toFixed(2);
        movAmountIn.readOnly = true;
      }
      if (conceptIn && !conceptIn.value) {
        conceptIn.value = 'Liquidación total de saldo deudor';
      }
    } else {
      if (movAmountIn) movAmountIn.readOnly = false;
    }

    const amt = Math.max(0, parseFloat(movAmountIn?.value) || 0);
    let projected = bal;
    if (type === 'cargo') {
      projected = bal + amt;
    } else if (type === 'liquidacion') {
      projected = 0;
    } else {
      projected = Math.max(0, bal - amt);
    }
    if (projEl) projEl.value = formatMoney(projected);
  };

  movClientSel?.addEventListener('change', () => {
    const cli = allClients.find(c => c.id === movClientSel.value);
    const bal = parseFloat(cli?.currentBalance) || 0;
    if (movTypeSel?.value === 'liquidacion' && movAmountIn) {
      movAmountIn.value = bal.toFixed(2);
    }
    updateCreditMovementPreview();
  });
  movTypeSel?.addEventListener('change', () => {
    const cli = allClients.find(c => c.id === movClientSel?.value);
    const bal = parseFloat(cli?.currentBalance) || 0;
    if (movTypeSel.value === 'liquidacion' && movAmountIn) {
      movAmountIn.value = bal.toFixed(2);
    } else if (movTypeSel.value === 'abono' && movAmountIn && (!movAmountIn.value || parseFloat(movAmountIn.value) === bal)) {
      movAmountIn.value = Math.min(bal, Math.round(bal / 2)).toFixed(2);
    }
    updateCreditMovementPreview();
  });
  movAmountIn?.addEventListener('input', updateCreditMovementPreview);

  const creditMovementForm = document.getElementById('creditMovementForm');
  creditMovementForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const clientId = movClientSel?.value;
    if (!clientId) {
      showToast('Selecciona un cliente');
      return;
    }
    const payload = {
      type: movTypeSel?.value || 'abono',
      amount: parseFloat(movAmountIn?.value) || 0,
      paymentMethod: document.getElementById('credMovPaymentMethod')?.value || 'Transferencia',
      reference: document.getElementById('credMovReference')?.value.trim() || '',
      concept: document.getElementById('credMovConcept')?.value.trim() || ''
    };

    try {
      const res = await erpService.registerClientCreditMovement(clientId, payload);
      closeModal('creditMovementModal');
      await syncAllData();
      if (currentStatementClientId === clientId && document.getElementById('clientStatementModal')?.classList.contains('open')) {
        openClientStatementModal(clientId, currentStatementFilter);
      }
      showToast(`Movimiento ${res.movement.folio} registrado. Nuevo saldo: ${formatMoney(res.client.currentBalance)}`);
      printCreditMovementReceipt(res.client, res.movement);
    } catch (err) {
      showToast(err.message);
    }
  });

  // Statement Modal Filters (Historial Completo vs Crédito Vigente vs Consultar Crédito Anterior)
  document.querySelectorAll('#stmtFilterPills .pill-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#stmtFilterPills .pill-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentStatementFilter = btn.dataset.stmtfilter || 'all';
      renderClientStatementLedger();
    });
  });

  document.getElementById('stmtNewAbonoBtn')?.addEventListener('click', () => {
    if (!currentStatementClientId) return;
    openCreditMovementModal(currentStatementClientId, 'abono');
  });

  document.getElementById('stmtPrintBtn')?.addEventListener('click', () => {
    const cli = allClients.find(c => c.id === currentStatementClientId);
    if (cli) printClientStatement(cli, currentStatementFilter);
  });
}

function renderClientsModule() {
  const totalClients = allClients.length;
  const billingClients = allClients.filter(c => c.hasBilling).length;
  const creditClients = allClients.filter(c => c.hasCredit);
  const debtors = allClients.filter(c => (parseFloat(c.currentBalance) || 0) > 0);

  const totalLimit = creditClients.reduce((s, c) => s + (parseFloat(c.creditLimit) || 0), 0);
  const totalBalance = allClients.reduce((s, c) => s + (parseFloat(c.currentBalance) || 0), 0);
  const totalAvailable = Math.max(0, totalLimit - totalBalance);

  const elTotal = document.getElementById('cliKpiTotal');
  const elBilling = document.getElementById('cliKpiBillingBadge');
  const elCreditCount = document.getElementById('cliKpiCreditCount');
  const elTotalLimit = document.getElementById('cliKpiTotalLimit');
  const elTotalBalance = document.getElementById('cliKpiTotalBalance');
  const elDebtorsCount = document.getElementById('cliKpiDebtorsCount');
  const elAvail = document.getElementById('cliKpiAvailableCredit');
  const elTabCount = document.getElementById('cliTabActiveCreditsCount');

  if (elTotal) elTotal.textContent = totalClients;
  if (elBilling) elBilling.textContent = `${billingClients} con CFDI 4.0`;
  if (elCreditCount) elCreditCount.textContent = creditClients.length;
  if (elTotalLimit) elTotalLimit.textContent = `Línea: ${formatMoney(totalLimit)}`;
  if (elTotalBalance) elTotalBalance.textContent = formatMoney(totalBalance);
  if (elDebtorsCount) elDebtorsCount.textContent = `${debtors.length} con saldo`;
  if (elAvail) elAvail.textContent = formatMoney(totalAvailable);
  if (elTabCount) elTabCount.textContent = debtors.length;

  renderClientsDirectoryTable();
  renderClientsCreditBalancesTable();
}

function renderClientsDirectoryTable() {
  const tbody = document.getElementById('clientsDirectoryTableBody');
  if (!tbody) return;

  const q = (document.getElementById('cliSearchInput')?.value || '').toLowerCase().trim();

  const filtered = allClients.filter(c => {
    if (cliDirectoryFilter === 'credit' && !c.hasCredit) return false;
    if (cliDirectoryFilter === 'billing' && !c.hasBilling) return false;
    if (cliDirectoryFilter === 'balance' && (parseFloat(c.currentBalance) || 0) <= 0) return false;
    if (q) {
      const hay = `${c.code} ${c.name} ${c.contactName || ''} ${c.phone || ''} ${c.email || ''} ${c.rfc || ''} ${c.razonSocial || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7">${renderEmptyState('Sin clientes para este filtro', 'Intenta con otra búsqueda o registra un nuevo cliente.')}</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(c => {
    const limit = parseFloat(c.creditLimit) || 0;
    const bal = parseFloat(c.currentBalance) || 0;
    const avail = Math.max(0, limit - bal);

    return `
      <tr>
        <td data-label="Código" class="mono">
          <strong>${c.code}</strong>
          <div style="font-size:0.68rem; color:var(--text-muted);">${c.status === 'suspendido' ? '🔴 Suspendido' : '🟢 Activo'}</div>
        </td>
        <td data-label="Cliente / Contacto">
          <div>
            <strong>${c.name}</strong>
            <div style="font-size:0.74rem; color:var(--text-muted);">${c.contactName || 'Contacto directo'} · ${c.address || 'Sin dirección'}</div>
          </div>
        </td>
        <td data-label="Teléfono & Correo">
          <div class="tabular">${c.phone || '-'}</div>
          <div style="font-size:0.73rem; color:var(--text-muted);">${c.email || '-'}</div>
        </td>
        <td data-label="Facturación Electrónica">
          ${c.hasBilling
            ? `<div>
                 <span class="badge badge-blue"><span class="status-dot dot-blue"></span>CFDI 4.0 · ${c.rfc || 'RFC'}</span>
                 <div style="font-size:0.71rem; color:var(--text-muted); margin-top:3px;">${c.usoCfdi || 'G03'} · C.P. ${c.cpFiscal || '-'}</div>
               </div>`
            : `<span class="badge badge-amber">Sin Facturación</span>`
          }
        </td>
        <td data-label="Crédito Autorizado">
          ${c.hasCredit
            ? `<div>
                 <span class="badge badge-green"><span class="status-dot dot-lime"></span>Autorizado (${c.creditDays || 30}d)</span>
                 <div class="mono tabular" style="font-size:0.73rem; color:var(--text-secondary); margin-top:3px;">Límite: ${formatMoney(limit)}</div>
               </div>`
            : `<span class="kbd-tag">CONTADO</span>`
          }
        </td>
        <td data-label="Saldo / Disponible" style="text-align:right;" class="mono tabular">
          ${c.hasCredit
            ? `<div>
                 <strong style="color:${bal > 0 ? 'var(--amber)' : 'var(--text-main)'};">Saldo: ${formatMoney(bal)}</strong>
                 <div style="font-size:0.72rem; color:var(--secondary);">Disp: ${formatMoney(avail)}</div>
               </div>`
            : `<span style="color:var(--text-muted);">$0.00</span>`
          }
        </td>
        <td data-label="Acciones" style="text-align:right; white-space:nowrap;">
          <div style="display:inline-flex; gap:6px; justify-content:flex-end; flex-wrap:wrap;">
            <button type="button" class="btn btn-secondary btn-sm btn-cli-stmt" data-id="${c.id}" title="Ver Estado de Cuenta y Créditos Anteriores">Estado de Cuenta</button>
            ${c.hasCredit ? `<button type="button" class="btn btn-primary btn-sm btn-cli-abono" data-id="${c.id}" title="Registrar Abono o Liquidación">Abonar</button>` : ''}
            <button type="button" class="btn btn-ghost btn-sm btn-cli-edit" data-id="${c.id}" title="Modificar Cliente">Modificar</button>
            <button type="button" class="btn btn-danger btn-sm btn-cli-del" data-id="${c.id}" title="Eliminar Cliente">✕</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('.btn-cli-stmt').forEach(btn => {
    btn.addEventListener('click', () => openClientStatementModal(btn.dataset.id, 'all'));
  });
  tbody.querySelectorAll('.btn-cli-abono').forEach(btn => {
    btn.addEventListener('click', () => openCreditMovementModal(btn.dataset.id, 'abono'));
  });
  tbody.querySelectorAll('.btn-cli-edit').forEach(btn => {
    btn.addEventListener('click', () => {
      const cli = allClients.find(x => x.id === btn.dataset.id);
      if (cli) openClientModalForEdit(cli);
    });
  });
  tbody.querySelectorAll('.btn-cli-del').forEach(btn => {
    btn.addEventListener('click', async () => {
      const cli = allClients.find(x => x.id === btn.dataset.id);
      if (!cli) return;
      if (!confirm(`¿Eliminar al cliente "${cli.name}" (${cli.code})?`)) return;
      try {
        await erpService.deleteClient(cli.id);
        await syncAllData();
        showToast('Cliente eliminado');
      } catch (err) {
        showToast(err.message);
      }
    });
  });
}

function renderClientsCreditBalancesTable() {
  const tbody = document.getElementById('clientsCreditBalancesTableBody');
  if (!tbody) return;

  const q = (document.getElementById('creditSearchInput')?.value || '').toLowerCase().trim();

  // Show clients with credit authorized or any ledger history
  const creditPool = allClients.filter(c => c.hasCredit || (Array.isArray(c.ledger) && c.ledger.length > 0));

  const filtered = creditPool.filter(c => {
    const bal = parseFloat(c.currentBalance) || 0;
    const hasPrevLiquidated = Array.isArray(c.ledger) && c.ledger.some(m => m.status === 'liquidado');
    if (cliCreditFilter === 'debtors' && bal <= 0) return false;
    if (cliCreditFilter === 'settled' && bal > 0) return false;
    if (cliCreditFilter === 'previous' && !hasPrevLiquidated) return false;
    if (q) {
      const hay = `${c.code} ${c.name} ${c.contactName || ''} ${c.rfc || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7">${renderEmptyState('Sin cuentas de crédito en este filtro', 'Cambia el filtro de cartera o autoriza crédito a un cliente.')}</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(c => {
    const limit = parseFloat(c.creditLimit) || 0;
    const bal = parseFloat(c.currentBalance) || 0;
    const avail = Math.max(0, limit - bal);
    const pct = limit > 0 ? Math.min(100, Math.round((bal / limit) * 100)) : 0;
    const barColor = pct >= 80 ? 'var(--danger)' : pct >= 50 ? 'var(--amber)' : 'var(--primary)';

    const ledger = Array.isArray(c.ledger) ? c.ledger : [];
    const activeCount = ledger.filter(m => m.status === 'vigente').length;
    const prevCount = ledger.filter(m => m.status === 'liquidado').length;

    return `
      <tr>
        <td data-label="Código / Cliente">
          <div>
            <strong class="mono" style="color:var(--primary);">${c.code}</strong> · <strong>${c.name}</strong>
            <div style="font-size:0.73rem; color:var(--text-muted);">${c.contactName || ''} · Tel: ${c.phone || '-'}</div>
          </div>
        </td>
        <td data-label="Límite Autorizado" style="text-align:right;" class="mono tabular">
          <strong>${formatMoney(limit)}</strong>
        </td>
        <td data-label="Saldo Deudor Actual" style="text-align:right;" class="mono tabular">
          <strong style="color:${bal > 0 ? 'var(--amber)' : 'var(--text-muted)'}; font-size:0.95rem;">${formatMoney(bal)}</strong>
        </td>
        <td data-label="Crédito Disponible" style="text-align:right;" class="mono tabular">
          <strong style="color:var(--secondary);">${formatMoney(avail)}</strong>
        </td>
        <td data-label="Uso de Línea / Plazo">
          <div style="display:flex; justify-content:space-between; font-size:0.73rem;" class="mono tabular">
            <span>${pct}% utilizado</span>
            <span>Plazo: ${c.creditDays || 30} días</span>
          </div>
          <div class="credit-line-meter">
            <div class="credit-line-fill" style="width:${pct}%; background:${barColor};"></div>
          </div>
        </td>
        <td data-label="Historial de Créditos">
          <div style="display:flex; gap:5px; flex-wrap:wrap;">
            <span class="badge ${bal > 0 ? 'badge-amber' : 'badge-green'}">${bal > 0 ? `${activeCount} mov. vigentes` : 'Al corriente'}</span>
            ${prevCount > 0 ? `<button type="button" class="kbd-tag btn-view-prev-credit" data-id="${c.id}" style="cursor:pointer;" title="Consultar créditos anteriores liquidados">↺ ${prevCount} anteriores</button>` : ''}
          </div>
        </td>
        <td data-label="Administración de Crédito" style="text-align:right; white-space:nowrap;">
          <div style="display:inline-flex; gap:6px; justify-content:flex-end; flex-wrap:wrap;">
            <button type="button" class="btn btn-secondary btn-sm btn-cred-stmt" data-id="${c.id}">Estado de Cuenta</button>
            ${bal > 0 ? `
              <button type="button" class="btn btn-primary btn-sm btn-cred-abono" data-id="${c.id}">Abonar</button>
              <button type="button" class="btn btn-ghost btn-sm btn-cred-liquidar" data-id="${c.id}" title="Liquidar el 100% del saldo deudor">Liquidar</button>
            ` : `
              <button type="button" class="btn btn-ghost btn-sm btn-cred-cargo" data-id="${c.id}">+ Cargo</button>
            `}
            <button type="button" class="btn btn-ghost btn-sm btn-cred-prev" data-id="${c.id}" title="Consultar crédito anterior">Crédito Anterior</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('.btn-cred-stmt').forEach(btn => {
    btn.addEventListener('click', () => openClientStatementModal(btn.dataset.id, 'all'));
  });
  tbody.querySelectorAll('.btn-cred-prev, .btn-view-prev-credit').forEach(btn => {
    btn.addEventListener('click', () => openClientStatementModal(btn.dataset.id, 'liquidado'));
  });
  tbody.querySelectorAll('.btn-cred-abono').forEach(btn => {
    btn.addEventListener('click', () => openCreditMovementModal(btn.dataset.id, 'abono'));
  });
  tbody.querySelectorAll('.btn-cred-liquidar').forEach(btn => {
    btn.addEventListener('click', () => openCreditMovementModal(btn.dataset.id, 'liquidacion'));
  });
  tbody.querySelectorAll('.btn-cred-cargo').forEach(btn => {
    btn.addEventListener('click', () => openCreditMovementModal(btn.dataset.id, 'cargo'));
  });
}

function openClientModalForCreate() {
  const form = document.getElementById('clientForm');
  form?.reset();
  document.getElementById('cliId').value = '';
  document.getElementById('clientModalCode').textContent = 'NUEVO EXPEDIENTE DE CLIENTE';
  document.getElementById('clientModalTitle').textContent = 'Nuevo Cliente';
  document.getElementById('cliHasCredit').checked = true;
  document.getElementById('cliCreditFieldsWrap')?.classList.remove('hidden');
  document.getElementById('cliInitialBalanceWrap')?.classList.remove('hidden');
  document.getElementById('cliCreditLimit').value = '15000';
  document.getElementById('cliCreditDays').value = '30';
  document.getElementById('cliInitialBalance').value = '0';

  document.getElementById('cliHasBilling').checked = false;
  document.getElementById('cliBillingFieldsWrap')?.classList.add('hidden');
  document.getElementById('cliDeleteBtn')?.classList.add('hidden');
  openModal('clientModal');
}

function openClientModalForEdit(client) {
  if (!client) return;
  document.getElementById('cliId').value = client.id;
  document.getElementById('clientModalCode').textContent = `${client.code} · MODIFICAR CLIENTE`;
  document.getElementById('clientModalTitle').textContent = client.name;
  document.getElementById('cliName').value = client.name || '';
  document.getElementById('cliContactName').value = client.contactName || '';
  document.getElementById('cliPhone').value = client.phone || '';
  document.getElementById('cliEmail').value = client.email || '';
  document.getElementById('cliStatus').value = client.status || 'activo';
  document.getElementById('cliAddress').value = client.address || '';
  document.getElementById('cliNotes').value = client.notes || '';

  const hasCredit = Boolean(client.hasCredit);
  document.getElementById('cliHasCredit').checked = hasCredit;
  document.getElementById('cliCreditFieldsWrap')?.classList.toggle('hidden', !hasCredit);
  document.getElementById('cliInitialBalanceWrap')?.classList.add('hidden');
  document.getElementById('cliCreditLimit').value = client.creditLimit || 0;
  document.getElementById('cliCreditDays').value = String(client.creditDays || 30);

  const hasBilling = Boolean(client.hasBilling);
  document.getElementById('cliHasBilling').checked = hasBilling;
  document.getElementById('cliBillingFieldsWrap')?.classList.toggle('hidden', !hasBilling);
  document.getElementById('cliRfc').value = client.rfc || '';
  document.getElementById('cliCpFiscal').value = client.cpFiscal || '';
  document.getElementById('cliRazonSocial').value = client.razonSocial || '';
  if (client.regimenFiscal) document.getElementById('cliRegimenFiscal').value = client.regimenFiscal;
  if (client.usoCfdi) document.getElementById('cliUsoCfdi').value = client.usoCfdi;
  document.getElementById('cliBillingEmail').value = client.billingEmail || '';

  document.getElementById('cliDeleteBtn')?.classList.remove('hidden');
  openModal('clientModal');
}

function openCreditMovementModal(preselectedClientId = null, defaultType = 'abono') {
  const select = document.getElementById('credMovClientSelect');
  const creditClients = allClients.filter(c => c.hasCredit);
  if (!select) return;

  if (creditClients.length === 0) {
    showToast('Primero autoriza crédito a un cliente en Control de Clientes');
    return;
  }

  select.innerHTML = creditClients.map(c => {
    const bal = parseFloat(c.currentBalance) || 0;
    return `<option value="${c.id}">[${c.code}] ${c.name} — Saldo: ${formatMoney(bal)}</option>`;
  }).join('');

  if (preselectedClientId && creditClients.some(c => c.id === preselectedClientId)) {
    select.value = preselectedClientId;
  }

  const cli = allClients.find(c => c.id === select.value) || creditClients[0];
  const bal = parseFloat(cli?.currentBalance) || 0;
  const typeSel = document.getElementById('credMovType');
  const amtIn = document.getElementById('credMovAmount');
  const refIn = document.getElementById('credMovReference');
  const conceptIn = document.getElementById('credMovConcept');

  if (typeSel) typeSel.value = defaultType;
  if (refIn) refIn.value = '';

  if (defaultType === 'liquidacion') {
    if (amtIn) {
      amtIn.value = bal.toFixed(2);
      amtIn.readOnly = true;
    }
    if (conceptIn) conceptIn.value = 'Liquidación total de saldo deudor';
  } else if (defaultType === 'cargo') {
    if (amtIn) {
      amtIn.value = '';
      amtIn.readOnly = false;
    }
    if (conceptIn) conceptIn.value = 'Cargo a cuenta de crédito por equipamiento / póliza';
  } else {
    if (amtIn) {
      amtIn.value = bal > 0 ? bal.toFixed(2) : '';
      amtIn.readOnly = false;
    }
    if (conceptIn) conceptIn.value = 'Abono a cuenta de crédito';
  }

  select.dispatchEvent(new Event('change'));
  openModal('creditMovementModal');
}

function openClientStatementModal(clientId, initialFilter = 'all') {
  const cli = allClients.find(c => c.id === clientId);
  if (!cli) return;

  currentStatementClientId = cli.id;
  currentStatementFilter = initialFilter;

  document.querySelectorAll('#stmtFilterPills .pill-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.stmtfilter === initialFilter);
  });

  const limit = parseFloat(cli.creditLimit) || 0;
  const bal = parseFloat(cli.currentBalance) || 0;
  const avail = Math.max(0, limit - bal);

  document.getElementById('stmtClientCode').textContent = `${cli.code} · ESTADO DE CUENTA E HISTORIAL DE CRÉDITOS`;
  document.getElementById('stmtClientName').textContent = cli.name;
  document.getElementById('stmtLimit').textContent = formatMoney(limit);
  document.getElementById('stmtBalance').textContent = formatMoney(bal);
  document.getElementById('stmtAvailable').textContent = formatMoney(avail);
  document.getElementById('stmtMeta').textContent = `${cli.creditDays || 30} días · ${cli.hasBilling && cli.rfc ? cli.rfc : 'Sin RFC'}`;

  renderClientStatementLedger();
  openModal('clientStatementModal');
}

function renderClientStatementLedger() {
  const tbody = document.getElementById('stmtLedgerTableBody');
  const countEl = document.getElementById('stmtMovementsCount');
  const cli = allClients.find(c => c.id === currentStatementClientId);
  if (!tbody || !cli) return;

  const ledger = Array.isArray(cli.ledger) ? cli.ledger : [];
  const filtered = ledger.filter(m => {
    if (currentStatementFilter === 'vigente') return m.status === 'vigente';
    if (currentStatementFilter === 'liquidado') return m.status === 'liquidado';
    return true;
  });

  if (countEl) countEl.textContent = `${filtered.length} movimiento(s)`;

  if (filtered.length === 0) {
    const emptyMsg = currentStatementFilter === 'liquidado'
      ? 'Este cliente aún no registra ciclos de crédito anteriores liquidados.'
      : currentStatementFilter === 'vigente'
      ? 'El cliente se encuentra al corriente ($0.00) sin cargos vigentes.'
      : 'No existen movimientos registrados en el estado de cuenta de este cliente.';
    tbody.innerHTML = `<tr><td colspan="8">${renderEmptyState('Sin movimientos en este filtro', emptyMsg)}</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(m => {
    const isCargo = m.type === 'cargo';
    const isLiq = m.type === 'liquidacion';
    const d = m.date ? new Date(m.date).toLocaleString('es-MX', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '-';
    const typeBadge = isCargo
      ? `<span class="badge badge-amber"><span class="status-dot dot-amber"></span>Cargo (+)</span>`
      : isLiq
      ? `<span class="badge badge-green"><span class="status-dot dot-lime"></span>Liquidación (-)</span>`
      : `<span class="badge badge-blue"><span class="status-dot dot-blue"></span>Abono (-)</span>`;

    const cycleBadge = m.status === 'liquidado'
      ? `<span class="kbd-tag" title="Ciclo de crédito anterior ya liquidado">CRÉDITO ANTERIOR (LIQUIDADO)</span>`
      : `<span class="badge badge-purple">CRÉDITO VIGENTE</span>`;

    return `
      <tr>
        <td data-label="Folio" class="mono"><strong>${m.folio || '-'}</strong></td>
        <td data-label="Fecha" class="tabular">${d}</td>
        <td data-label="Tipo">${typeBadge}</td>
        <td data-label="Concepto & Referencia">
          <div>
            <strong>${m.concept || '-'}</strong>
            <div style="font-size:0.72rem; color:var(--text-muted);">Ref: ${m.reference || '-'} · Por: ${m.author || 'Sistema'}</div>
          </div>
        </td>
        <td data-label="Saldo Anterior" style="text-align:right;" class="mono tabular">${formatMoney(m.balanceBefore)}</td>
        <td data-label="Importe" style="text-align:right;" class="mono tabular">
          <strong style="color:${isCargo ? 'var(--amber)' : 'var(--secondary)'};">
            ${isCargo ? '+' : '-'}${formatMoney(m.amount)}
          </strong>
        </td>
        <td data-label="Nuevo Saldo" style="text-align:right;" class="mono tabular"><strong>${formatMoney(m.balanceAfter)}</strong></td>
        <td data-label="Ciclo de Crédito">${cycleBadge}</td>
      </tr>
    `;
  }).join('');
}

function exportClientsToCSV() {
  const headers = [
    'Codigo',
    'NombreComercial',
    'Contacto',
    'Telefono',
    'Correo',
    'Estatus',
    'TieneCreditoAutorizado',
    'LimiteCredito',
    'PlazoDias',
    'SaldoDeudorActual',
    'CreditoDisponible',
    'TieneFacturacionCFDI',
    'RFC',
    'RazonSocialFiscal',
    'RegimenFiscal',
    'UsoCFDI',
    'CPFiscal',
    'CorreoFacturacion'
  ];

  const rows = allClients.map(c => {
    const limit = parseFloat(c.creditLimit) || 0;
    const bal = parseFloat(c.currentBalance) || 0;
    const avail = Math.max(0, limit - bal);
    return [
      c.code,
      `"${(c.name || '').replace(/"/g, '""')}"`,
      `"${(c.contactName || '').replace(/"/g, '""')}"`,
      `"${(c.phone || '').replace(/"/g, '""')}"`,
      `"${(c.email || '').replace(/"/g, '""')}"`,
      c.status || 'activo',
      c.hasCredit ? 'SI' : 'NO',
      limit.toFixed(2),
      c.creditDays || 0,
      bal.toFixed(2),
      avail.toFixed(2),
      c.hasBilling ? 'SI' : 'NO',
      c.rfc || '',
      `"${(c.razonSocial || '').replace(/"/g, '""')}"`,
      `"${(c.regimenFiscal || '').replace(/"/g, '""')}"`,
      `"${(c.usoCfdi || '').replace(/"/g, '""')}"`,
      c.cpFiscal || '',
      c.billingEmail || ''
    ];
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `fiberlink-padron-clientes-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Padrón de clientes exportado a CSV exitosamente');
}

function exportCreditBalancesToCSV() {
  const headers = ['Codigo', 'Cliente', 'Contacto', 'Telefono', 'RFC', 'LimiteAutorizado', 'PlazoDias', 'SaldoDeudor', 'CreditoDisponible', 'PorcentajeUso'];
  const creditClients = allClients.filter(c => c.hasCredit || (parseFloat(c.currentBalance) || 0) > 0);
  const rows = creditClients.map(c => {
    const limit = parseFloat(c.creditLimit) || 0;
    const bal = parseFloat(c.currentBalance) || 0;
    const avail = Math.max(0, limit - bal);
    const pct = limit > 0 ? Math.round((bal / limit) * 100) : 0;
    return [
      c.code,
      `"${(c.name || '').replace(/"/g, '""')}"`,
      `"${(c.contactName || '').replace(/"/g, '""')}"`,
      `"${(c.phone || '').replace(/"/g, '""')}"`,
      c.rfc || 'S/RFC',
      limit.toFixed(2),
      c.creditDays || 30,
      bal.toFixed(2),
      avail.toFixed(2),
      `${pct}%`
    ];
  });

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `fiberlink-reporte-saldos-credito-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Reporte de Saldos exportado a CSV');
}

function printCreditBalancesReport() {
  const area = document.getElementById('printArea');
  if (!area) return;
  const creditClients = allClients.filter(c => c.hasCredit || (parseFloat(c.currentBalance) || 0) > 0);
  const totalLimit = creditClients.reduce((s, c) => s + (parseFloat(c.creditLimit) || 0), 0);
  const totalBal = creditClients.reduce((s, c) => s + (parseFloat(c.currentBalance) || 0), 0);
  const totalAvail = Math.max(0, totalLimit - totalBal);

  area.innerHTML = `
    <div style="max-width:760px; margin:0 auto; font-family:Arial,sans-serif; color:#000;">
      <h2>FIBERLINK SERVICIOS TIC — REPORTE DE SALDOS DE CLIENTES (CARTERA DE CRÉDITO)</h2>
      <p style="font-size:12px;">Fecha de Corte: ${new Date().toLocaleString('es-MX')} · Emitido por: ${currentUser?.name || 'Administración'}</p>
      <hr style="margin:10px 0;">
      <p style="font-size:13px;">
        <strong>Línea Total Otorgada:</strong> ${formatMoney(totalLimit)} &nbsp;|&nbsp;
        <strong>Saldo Total por Cobrar:</strong> ${formatMoney(totalBal)} &nbsp;|&nbsp;
        <strong>Crédito Disponible:</strong> ${formatMoney(totalAvail)}
      </p>
      <table style="width:100%; border-collapse:collapse; font-size:12px; margin-top:12px;" border="1" cellpadding="6">
        <thead>
          <tr style="background:#f0f0f0;">
            <th align="left">Código</th>
            <th align="left">Cliente / Razón Social</th>
            <th align="left">Teléfono</th>
            <th align="right">Límite Crédito</th>
            <th align="right">Saldo Deudor</th>
            <th align="right">Disponible</th>
          </tr>
        </thead>
        <tbody>
          ${creditClients.map(c => {
            const lim = parseFloat(c.creditLimit) || 0;
            const bal = parseFloat(c.currentBalance) || 0;
            return `
              <tr>
                <td>${c.code}</td>
                <td>${c.name}</td>
                <td>${c.phone || '-'}</td>
                <td align="right">${formatMoney(lim)}</td>
                <td align="right"><strong>${formatMoney(bal)}</strong></td>
                <td align="right">${formatMoney(Math.max(0, lim - bal))}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
  window.print();
}

function printClientStatement(client, filterMode = 'all') {
  const area = document.getElementById('printArea');
  if (!area || !client) return;
  const ledger = (client.ledger || []).filter(m => {
    if (filterMode === 'vigente') return m.status === 'vigente';
    if (filterMode === 'liquidado') return m.status === 'liquidado';
    return true;
  });

  const lim = parseFloat(client.creditLimit) || 0;
  const bal = parseFloat(client.currentBalance) || 0;

  area.innerHTML = `
    <div style="max-width:760px; margin:0 auto; font-family:Arial,sans-serif; color:#000;">
      <div style="display:flex; justify-content:space-between; border-bottom:2px solid #000; padding-bottom:8px;">
        <div>
          <h2 style="margin:0;">FIBERLINK SERVICIOS TIC — ESTADO DE CUENTA DE CLIENTE</h2>
          <p style="font-size:12px; margin:4px 0;">Teziutlán, Puebla · Administración de Crédito y Cobranza</p>
        </div>
        <div style="text-align:right; font-size:12px;">
          <strong>Código: ${client.code}</strong><br>
          Fecha: ${new Date().toLocaleString('es-MX')}
        </div>
      </div>
      <div style="margin:12px 0; font-size:13px;">
        <p><strong>Cliente:</strong> ${client.name} &nbsp;|&nbsp; <strong>RFC:</strong> ${client.rfc || 'S/RFC'} &nbsp;|&nbsp; <strong>Tel:</strong> ${client.phone || '-'}</p>
        <p>
          <strong>Límite Autorizado:</strong> ${formatMoney(lim)} (${client.creditDays || 30} días) &nbsp;|&nbsp;
          <strong>Saldo Deudor Actual:</strong> ${formatMoney(bal)} &nbsp;|&nbsp;
          <strong>Crédito Disponible:</strong> ${formatMoney(Math.max(0, lim - bal))}
        </p>
      </div>
      <table style="width:100%; border-collapse:collapse; font-size:12px;" border="1" cellpadding="5">
        <thead>
          <tr style="background:#f0f0f0;">
            <th align="left">Folio</th>
            <th align="left">Fecha</th>
            <th align="left">Tipo</th>
            <th align="left">Concepto / Referencia</th>
            <th align="right">Saldo Ant.</th>
            <th align="right">Importe</th>
            <th align="right">Nuevo Saldo</th>
            <th align="left">Ciclo</th>
          </tr>
        </thead>
        <tbody>
          ${ledger.map(m => `
            <tr>
              <td>${m.folio}</td>
              <td>${new Date(m.date).toLocaleDateString('es-MX')}</td>
              <td>${m.type.toUpperCase()}</td>
              <td>${m.concept} (${m.reference || '-'})</td>
              <td align="right">${formatMoney(m.balanceBefore)}</td>
              <td align="right">${m.type === 'cargo' ? '+' : '-'}${formatMoney(m.amount)}</td>
              <td align="right"><strong>${formatMoney(m.balanceAfter)}</strong></td>
              <td>${m.status === 'liquidado' ? 'Crédito Anterior' : 'Vigente'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
  window.print();
}

function printCreditMovementReceipt(client, movement) {
  const area = document.getElementById('printArea');
  if (!area || !client || !movement) return;
  area.innerHTML = `
    <div style="max-width:340px; margin:0 auto; font-family:monospace; color:#000;">
      <h2 style="text-align:center; margin-bottom:4px;">FIBERLINK SERVICIOS TIC</h2>
      <p style="text-align:center; font-size:12px; margin-bottom:8px;">COMPROBANTE DE ${movement.type.toUpperCase()} DE CRÉDITO</p>
      <hr>
      <p style="font-size:12px; margin:6px 0;">
        <strong>Folio Operación:</strong> ${movement.folio}<br>
        <strong>Fecha:</strong> ${new Date(movement.date).toLocaleString('es-MX')}<br>
        <strong>Cliente:</strong> [${client.code}] ${client.name}<br>
        <strong>Concepto:</strong> ${movement.concept}<br>
        <strong>Método / Ref:</strong> ${movement.paymentMethod || '-'} (${movement.reference || '-'})<br>
        <strong>Atendió:</strong> ${movement.author}
      </p>
      <hr>
      <p style="text-align:right; font-size:13px; margin:6px 0;">
        Saldo Anterior: ${formatMoney(movement.balanceBefore)}<br>
        <strong>IMPORTE ${movement.type.toUpperCase()}: ${formatMoney(movement.amount)}</strong><br>
        <strong>NUEVO SALDO DEUDOR: ${formatMoney(movement.balanceAfter)}</strong>
      </p>
      <hr>
      <p style="text-align:center; font-size:11px; margin-top:14px;">Conserve este comprobante para cualquier aclaración en su Estado de Cuenta.</p>
    </div>
  `;
  window.print();
}

// ==========================================
// 15. VIEW 9: MÓDULO DE CORTES Y TURNOS (TURNO, DÍA, MANEJO, HISTORIAL Y WHATSAPP)
// ==========================================
const SHIFTS_TABS_META = [
  { key: 'turn_cut', title: '1. Corte del Turno (Arqueo de Caja)', paneId: 'shiftsSubTabTurnCut' },
  { key: 'day_cut', title: '2. Corte del Día (Consolidado General)', paneId: 'shiftsSubTabDayCut' },
  { key: 'manage_shifts', title: '3. Manejo de Turnos y Movimientos de Caja', paneId: 'shiftsSubTabManage' },
  { key: 'cuts_history', title: '4. Historial de Cortes (Bitácora X / Z)', paneId: 'shiftsSubTabHistory' },
  { key: 'whatsapp_cut', title: '5. Corte por WhatsApp (Reporte a Dirección)', paneId: 'shiftsSubTabWhatsapp' }
];

let currentShiftsTabKey = 'turn_cut';

function switchShiftsSubTab(tabName) {
  const foundIdx = SHIFTS_TABS_META.findIndex(t => t.key === tabName);
  const idx = foundIdx !== -1 ? foundIdx : 0;
  const activeMeta = SHIFTS_TABS_META[idx];
  currentShiftsTabKey = activeMeta.key;

  document.querySelectorAll('#shiftsModuleTabs .settings-tab-btn').forEach(btn => {
    const isAct = btn.dataset.shifttab === currentShiftsTabKey;
    btn.classList.toggle('active', isAct);
    btn.setAttribute('aria-selected', String(isAct));
  });

  SHIFTS_TABS_META.forEach(meta => {
    const el = document.getElementById(meta.paneId);
    if (el) el.classList.toggle('active', meta.key === currentShiftsTabKey);
  });

  const footInfoEl = document.getElementById('shiftsFooterTabInfo');
  if (footInfoEl) {
    footInfoEl.innerHTML = `<strong style="color:var(--primary);">${activeMeta.title}</strong>`;
  }

  if (currentShiftsTabKey === 'whatsapp_cut') {
    updateWhatsappCutPreview();
  }
}

function initShiftsModule() {
  // Restore saved WhatsApp recipient phone
  const savedWaPhone = localStorage.getItem('fiberlink_wa_cut_phone');
  const waPhoneEl = document.getElementById('waCutPhoneInput');
  if (savedWaPhone && waPhoneEl) {
    waPhoneEl.value = savedWaPhone;
  }

  // 5-Tab Switcher
  document.querySelectorAll('#shiftsModuleTabs .settings-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      switchShiftsSubTab(btn.dataset.shifttab || 'turn_cut');
    });
  });

  const goPrevShiftsTab = () => {
    const curIdx = SHIFTS_TABS_META.findIndex(t => t.key === currentShiftsTabKey);
    const prevIdx = (curIdx - 1 + SHIFTS_TABS_META.length) % SHIFTS_TABS_META.length;
    switchShiftsSubTab(SHIFTS_TABS_META[prevIdx].key);
  };

  const goNextShiftsTab = () => {
    const curIdx = SHIFTS_TABS_META.findIndex(t => t.key === currentShiftsTabKey);
    const nextIdx = (curIdx + 1) % SHIFTS_TABS_META.length;
    switchShiftsSubTab(SHIFTS_TABS_META[nextIdx].key);
  };

  document.getElementById('btnShiftsPrevTab')?.addEventListener('click', goPrevShiftsTab);
  document.getElementById('btnShiftsNextTab')?.addEventListener('click', goNextShiftsTab);
  document.getElementById('btnShiftsFooterPrev')?.addEventListener('click', goPrevShiftsTab);
  document.getElementById('btnShiftsFooterNext')?.addEventListener('click', goNextShiftsTab);

  // Keyboard navigation (ArrowLeft / ArrowRight when viewing Cortes y Turnos and not typing in an input)
  window.addEventListener('keydown', (e) => {
    const shiftsView = document.getElementById('view-shifts');
    if (!shiftsView || !shiftsView.classList.contains('active')) return;
    const tag = (document.activeElement?.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      goPrevShiftsTab();
    } else if (e.key === 'ArrowRight') {
      e.preventDefault();
      goNextShiftsTab();
    }
  });

  // Top Header Quick Action Buttons
  document.getElementById('btnOpenNewShiftModal')?.addEventListener('click', openNewShiftModal);
  document.getElementById('btnManageOpenNewShift')?.addEventListener('click', openNewShiftModal);
  document.getElementById('btnOpenCashMovementModal')?.addEventListener('click', openCashMovementModal);
  document.getElementById('btnTurnQuickAddCashMov')?.addEventListener('click', openCashMovementModal);
  document.getElementById('btnManageAddCashMov')?.addEventListener('click', openCashMovementModal);
  document.getElementById('btnQuickWhatsappCut')?.addEventListener('click', () => {
    switchShiftsSubTab('whatsapp_cut');
  });

  // Sub-Tab 1: Corte del Turno (Selector, Denominaciones y Arqueo)
  document.getElementById('turnCutSelectShift')?.addEventListener('change', () => {
    renderTurnCutTab(true);
  });

  document.querySelectorAll('.denom-input').forEach(inp => {
    inp.addEventListener('input', recalculateDenominationsTotal);
  });

  document.getElementById('arqueoCountedInput')?.addEventListener('input', updateArqueoDifferenceDisplay);

  document.getElementById('btnTurnMatchExpected')?.addEventListener('click', () => {
    const metrics = computeSelectedShiftMetrics();
    const countedIn = document.getElementById('arqueoCountedInput');
    if (countedIn) {
      countedIn.value = metrics.expectedCashInDrawer.toFixed(2);
      updateArqueoDifferenceDisplay();
      showToast('Arqueo ajustado al efectivo esperado exacto');
    }
  });

  document.getElementById('btnSavePartialTurnCut')?.addEventListener('click', () => {
    submitTurnCut(false);
  });

  document.getElementById('btnCloseShiftAndCut')?.addEventListener('click', () => {
    submitTurnCut(true);
  });

  document.getElementById('btnSendTurnCutWhatsapp')?.addEventListener('click', () => {
    const sel = document.getElementById('waCutSourceSelect');
    if (sel) sel.value = 'live_turn';
    switchShiftsSubTab('whatsapp_cut');
    sendCurrentWhatsappCut();
  });

  document.getElementById('btnPrintTurnCutPreview')?.addEventListener('click', () => {
    const metrics = computeSelectedShiftMetrics();
    printCashCutTicket(metrics);
  });

  // Sub-Tab 2: Corte del Día
  document.getElementById('dayCutScopeSelect')?.addEventListener('change', renderDayCutTab);
  document.getElementById('btnExportDayCutCsv')?.addEventListener('click', exportSalesToCSV);
  document.getElementById('btnPrintDayCutReport')?.addEventListener('click', () => {
    const metrics = computeDayCutMetrics();
    printCashCutTicket(metrics);
  });
  document.getElementById('btnDayCutWhatsapp')?.addEventListener('click', () => {
    const sel = document.getElementById('waCutSourceSelect');
    if (sel) sel.value = 'live_day';
    switchShiftsSubTab('whatsapp_cut');
    sendCurrentWhatsappCut();
  });
  document.getElementById('btnSaveOfficialDayCut')?.addEventListener('click', submitOfficialDayCut);

  // Sub-Tab 4: Historial de Cortes
  document.getElementById('cutsHistorySearchInput')?.addEventListener('input', renderCutsHistoryTable);
  document.querySelectorAll('#cutsHistoryFilterPills .pill-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#cutsHistoryFilterPills .pill-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      cutsHistoryFilter = btn.dataset.cutfilter || 'all';
      renderCutsHistoryTable();
    });
  });
  document.getElementById('btnExportCutsHistoryCsv')?.addEventListener('click', exportCutsHistoryToCSV);

  // Sub-Tab 5: Corte por WhatsApp
  ['waCutSourceSelect', 'waCutPhoneInput', 'waCutRecipientName', 'waIncMethods', 'waIncArqueo', 'waIncMovements', 'waIncOperations', 'waCutCustomNote'].forEach(id => {
    const el = document.getElementById(id);
    el?.addEventListener('input', updateWhatsappCutPreview);
    el?.addEventListener('change', updateWhatsappCutPreview);
  });

  document.getElementById('btnLaunchWhatsappCut')?.addEventListener('click', sendCurrentWhatsappCut);
  document.getElementById('btnCopyWhatsappCutText')?.addEventListener('click', async () => {
    const text = buildWhatsappCutMessage();
    try {
      await navigator.clipboard.writeText(text);
      showToast('Texto del corte copiado al portapapeles');
    } catch (e) {
      showToast('No se pudo copiar automáticamente');
    }
  });

  // Modal 11: Abrir Nuevo Turno
  document.getElementById('openShiftForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = {
      shiftName: document.getElementById('openShiftNameSelect')?.value,
      registerName: document.getElementById('openShiftRegisterSelect')?.value,
      cashier: document.getElementById('openShiftCashierSelect')?.value,
      openingCash: parseFloat(document.getElementById('openShiftOpeningCash')?.value) || 0,
      notes: document.getElementById('openShiftNotes')?.value.trim() || ''
    };
    try {
      const res = await erpService.openShift(payload);
      closeModal('openShiftModal');
      await syncAllData();
      showToast(`Turno ${res.shift?.folio || ''} iniciado exitosamente`);
    } catch (err) {
      showToast(err.message);
    }
  });

  // Modal 12: Entrada / Salida de Efectivo en Caja
  document.getElementById('cashMovementForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const activeShift = getActiveOrLatestShift();
    if (!activeShift) {
      showToast('Primero abre un turno para registrar movimientos de caja');
      return;
    }
    const payload = {
      type: document.getElementById('cashMovType')?.value || 'salida_gasto',
      amount: parseFloat(document.getElementById('cashMovAmount')?.value) || 0,
      author: document.getElementById('cashMovAuthor')?.value.trim() || currentUser?.name || activeShift.cashier,
      concept: document.getElementById('cashMovConcept')?.value.trim() || 'Movimiento en cajón'
    };
    try {
      await erpService.addShiftCashMovement(activeShift.id, payload);
      closeModal('cashMovementModal');
      await syncAllData();
      showToast('Movimiento de efectivo registrado en el turno actual');
    } catch (err) {
      showToast(err.message);
    }
  });

  // Modal 13: Reimprimir o Enviar Corte desde Detalle
  document.getElementById('btnModalPrintCut')?.addEventListener('click', () => {
    const cut = allCashCuts.find(c => c.id === currentDetailCutId);
    if (cut) printCashCutTicket(cut);
  });
  document.getElementById('btnModalWhatsappCut')?.addEventListener('click', () => {
    const cut = allCashCuts.find(c => c.id === currentDetailCutId);
    if (!cut) return;
    closeModal('cutDetailModal');
    const sel = document.getElementById('waCutSourceSelect');
    if (sel) {
      sel.value = `cut:${cut.id}`;
    }
    switchShiftsSubTab('whatsapp_cut');
    sendCurrentWhatsappCut();
  });
}

function getActiveOrLatestShift() {
  return allShifts.find(s => s.status === 'abierto') || allShifts[0] || null;
}

function openNewShiftModal() {
  const cashierSel = document.getElementById('openShiftCashierSelect');
  if (cashierSel) {
    const names = allUsers.length > 0
      ? allUsers.map(u => u.name)
      : ['Lic. Sofía Navarro', 'Ing. Roberto Méndez', 'Mariana Salazar'];
    cashierSel.innerHTML = names.map(n => `<option value="${n}">${n}</option>`).join('');
    if (currentUser?.name && names.includes(currentUser.name)) {
      cashierSel.value = currentUser.name;
    }
  }
  const openCashEl = document.getElementById('openShiftOpeningCash');
  if (openCashEl) openCashEl.value = '1500';
  const notesEl = document.getElementById('openShiftNotes');
  if (notesEl) notesEl.value = '';
  openModal('openShiftModal');
}

function openCashMovementModal() {
  const authorEl = document.getElementById('cashMovAuthor');
  if (authorEl) authorEl.value = currentUser?.name || 'Ing. Roberto Méndez';
  const amtEl = document.getElementById('cashMovAmount');
  if (amtEl) amtEl.value = '';
  const conceptEl = document.getElementById('cashMovConcept');
  if (conceptEl) conceptEl.value = '';
  openModal('cashMovementModal');
}

function computeSelectedShiftMetrics() {
  const shiftSel = document.getElementById('turnCutSelectShift');
  const selectedId = shiftSel?.value;
  const shift = allShifts.find(s => s.id === selectedId) || getActiveOrLatestShift();

  const validSales = allSales.filter(s => s.status !== 'cancelada');
  const cancelledSales = allSales.filter(s => s.status === 'cancelada');

  // Filter sales belonging to this shift window (or all active sales if demo shift is active)
  let shiftSales = validSales;
  if (shift && shift.status === 'cerrado' && shift.openedAt && shift.closedAt) {
    const tStart = new Date(shift.openedAt).getTime();
    const tEnd = new Date(shift.closedAt).getTime();
    const inWindow = validSales.filter(s => {
      const t = new Date(s.date).getTime();
      return t >= tStart && t <= tEnd;
    });
    if (inWindow.length > 0) shiftSales = inWindow;
  }

  const openingCash = parseFloat(shift?.openingCash) || 0;
  const cashSales = shiftSales.filter(s => s.paymentMethod === 'Efectivo').reduce((acc, s) => acc + (parseFloat(s.total) || 0), 0);
  const cardSales = shiftSales.filter(s => s.paymentMethod === 'Tarjeta').reduce((acc, s) => acc + (parseFloat(s.total) || 0), 0);
  const transferSales = shiftSales.filter(s => s.paymentMethod === 'Transferencia').reduce((acc, s) => acc + (parseFloat(s.total) || 0), 0);
  const creditSales = shiftSales.filter(s => s.paymentMethod === 'Crédito').reduce((acc, s) => acc + (parseFloat(s.total) || 0), 0);

  // Credit abonos in cash vs other
  let creditPaymentsCash = 0;
  let creditPaymentsOther = 0;
  allClients.forEach(c => {
    (c.ledger || []).forEach(m => {
      if (m.type === 'abono' || m.type === 'liquidacion') {
        if (m.paymentMethod === 'Efectivo') {
          creditPaymentsCash += parseFloat(m.amount) || 0;
        } else {
          creditPaymentsOther += parseFloat(m.amount) || 0;
        }
      }
    });
  });

  const movs = Array.isArray(shift?.cashMovements) ? shift.cashMovements : [];
  const cashInTotal = movs.filter(m => m.type === 'entrada_efectivo').reduce((acc, m) => acc + (parseFloat(m.amount) || 0), 0);
  const cashOutTotal = movs.filter(m => m.type !== 'entrada_efectivo').reduce((acc, m) => acc + (parseFloat(m.amount) || 0), 0);

  const totalGrossSales = cashSales + cardSales + transferSales + creditSales;
  const totalCollectedRevenue = cashSales + cardSales + transferSales + creditPaymentsCash + creditPaymentsOther;
  const expectedCashInDrawer = openingCash + cashSales + creditPaymentsCash + cashInTotal - cashOutTotal;

  const countedInputEl = document.getElementById('arqueoCountedInput');
  const countedCashInDrawer = countedInputEl ? (parseFloat(countedInputEl.value) || 0) : expectedCashInDrawer;
  const difference = countedCashInDrawer - expectedCashInDrawer;

  return {
    folio: shift?.cutFolio || 'EN-VIVO',
    cutType: 'turno',
    shiftId: shift?.id || null,
    shiftFolio: shift?.folio || 'TRN-ACTUAL',
    shiftName: shift?.shiftName || 'Turno Operativo',
    registerName: shift?.registerName || 'Caja Principal #1',
    cashier: shift?.cashier || currentUser?.name || 'Cajero en Turno',
    status: shift?.status || 'abierto',
    openedAt: shift?.openedAt || new Date().toISOString(),
    closedAt: shift?.closedAt || null,
    date: new Date().toISOString(),
    salesCount: shiftSales.length,
    cancelledCount: cancelledSales.length,
    openingCash,
    cashSales,
    cardSales,
    transferSales,
    creditSales,
    creditPaymentsCash,
    creditPaymentsOther,
    cashInTotal,
    cashOutTotal,
    totalGrossSales,
    totalCollectedRevenue,
    expectedCashInDrawer,
    countedCashInDrawer,
    difference,
    cashMovements: movs
  };
}

function computeDayCutMetrics() {
  const scope = document.getElementById('dayCutScopeSelect')?.value || 'all_active';
  const now = Date.now();
  const validSales = allSales.filter(s => {
    if (s.status === 'cancelada') return false;
    if (scope === 'today') {
      return (now - new Date(s.date).getTime()) <= 86400000;
    }
    return true;
  });

  const openingCash = allShifts.reduce((acc, sh) => acc + (parseFloat(sh.openingCash) || 0), 0);
  const cashSales = validSales.filter(s => s.paymentMethod === 'Efectivo').reduce((acc, s) => acc + (parseFloat(s.total) || 0), 0);
  const cardSales = validSales.filter(s => s.paymentMethod === 'Tarjeta').reduce((acc, s) => acc + (parseFloat(s.total) || 0), 0);
  const transferSales = validSales.filter(s => s.paymentMethod === 'Transferencia').reduce((acc, s) => acc + (parseFloat(s.total) || 0), 0);
  const creditSales = validSales.filter(s => s.paymentMethod === 'Crédito').reduce((acc, s) => acc + (parseFloat(s.total) || 0), 0);

  let estimatedCost = 0;
  validSales.forEach(s => {
    (s.items || []).forEach(it => {
      estimatedCost += (parseFloat(it.cost) || 0) * (Number(it.qty) || 1);
    });
  });

  let creditPaymentsCash = 0;
  let creditPaymentsOther = 0;
  allClients.forEach(c => {
    (c.ledger || []).forEach(m => {
      if (m.type === 'abono' || m.type === 'liquidacion') {
        if (m.paymentMethod === 'Efectivo') creditPaymentsCash += parseFloat(m.amount) || 0;
        else creditPaymentsOther += parseFloat(m.amount) || 0;
      }
    });
  });

  let cashInTotal = 0;
  let cashOutTotal = 0;
  allShifts.forEach(sh => {
    (sh.cashMovements || []).forEach(m => {
      if (m.type === 'entrada_efectivo') cashInTotal += parseFloat(m.amount) || 0;
      else cashOutTotal += parseFloat(m.amount) || 0;
    });
  });

  const totalGrossSales = cashSales + cardSales + transferSales + creditSales;
  const totalCollectedRevenue = cashSales + cardSales + transferSales + creditPaymentsCash + creditPaymentsOther;
  const expectedCashInDrawer = openingCash + cashSales + creditPaymentsCash + cashInTotal - cashOutTotal;
  const estimatedProfit = Math.max(0, totalGrossSales - estimatedCost);

  return {
    folio: 'CORTE-DIA',
    cutType: 'dia',
    shiftId: 'ALL',
    shiftFolio: 'CONSOLIDADO-DIA',
    shiftName: 'Corte General del Día (Consolidado)',
    registerName: 'Todas las Cajas — Sucursal Teziutlán',
    cashier: currentUser?.name || 'Ing. Roberto Méndez',
    date: new Date().toISOString(),
    salesCount: validSales.length,
    cancelledCount: allSales.filter(s => s.status === 'cancelada').length,
    openingCash,
    cashSales,
    cardSales,
    transferSales,
    creditSales,
    creditPaymentsCash,
    creditPaymentsOther,
    cashInTotal,
    cashOutTotal,
    totalGrossSales,
    totalCollectedRevenue,
    expectedCashInDrawer,
    countedCashInDrawer: expectedCashInDrawer,
    difference: 0,
    estimatedProfit,
    salesList: validSales
  };
}

function renderShiftsModule() {
  const activeShift = getActiveOrLatestShift();
  const shiftSel = document.getElementById('turnCutSelectShift');
  if (shiftSel) {
    const prev = shiftSel.value;
    shiftSel.innerHTML = allShifts.map(s =>
      `<option value="${s.id}">[${s.folio}] ${s.shiftName} — ${s.cashier} (${s.status.toUpperCase()})</option>`
    ).join('');
    if (prev && allShifts.some(s => s.id === prev)) {
      shiftSel.value = prev;
    } else if (activeShift) {
      shiftSel.value = activeShift.id;
    }
  }

  // Populate WhatsApp Cut Source Picker with Live options + Historical Cuts
  const waSourceSel = document.getElementById('waCutSourceSelect');
  if (waSourceSel) {
    const prevWa = waSourceSel.value;
    waSourceSel.innerHTML = `
      <option value="live_turn">⚡ Corte del Turno Actual en Curso (En Vivo)</option>
      <option value="live_day">📅 Corte General del Día (Consolidado En Vivo)</option>
      ${allCashCuts.map(c => `<option value="cut:${c.id}">🗂️ [${c.folio}] ${c.cutType === 'dia' ? 'Corte del Día' : 'Corte de Turno'} (${c.shiftFolio}) — ${formatMoney(c.totalGrossSales)}</option>`).join('')}
    `;
    if (prevWa && Array.from(waSourceSel.options).some(o => o.value === prevWa)) {
      waSourceSel.value = prevWa;
    }
  }

  renderTurnCutTab(false);
  renderDayCutTab();
  renderManageShiftsTable();
  renderCutsHistoryTable();
  updateWhatsappCutPreview();

  // Update Top 4 KPI Cards
  const turnMetrics = computeSelectedShiftMetrics();
  const dayMetrics = computeDayCutMetrics();

  const kpiFolio = document.getElementById('shiftKpiCurrentFolio');
  const kpiStatus = document.getElementById('shiftKpiCurrentStatus');
  const kpiMeta = document.getElementById('shiftKpiCurrentMeta');
  const kpiExpCash = document.getElementById('shiftKpiExpectedCash');
  const kpiOpenBadge = document.getElementById('shiftKpiOpeningCashBadge');
  const kpiDaySales = document.getElementById('shiftKpiDaySales');
  const kpiDayCount = document.getElementById('shiftKpiDayCount');
  const kpiTotalCuts = document.getElementById('shiftKpiTotalCuts');
  const kpiLastCut = document.getElementById('shiftKpiLastCutBadge');
  const tabHistCount = document.getElementById('shiftsTabHistoryCount');

  if (kpiFolio) kpiFolio.textContent = activeShift ? activeShift.folio : 'SIN TURNO';
  if (kpiStatus) {
    const isOpen = activeShift?.status === 'abierto';
    kpiStatus.textContent = isOpen ? 'EN CURSO' : 'CERRADO';
    kpiStatus.className = `kpi-trend ${isOpen ? 'trend-up' : 'trend-warn'}`;
  }
  if (kpiMeta) kpiMeta.textContent = activeShift ? `${activeShift.cashier} · ${activeShift.registerName}` : 'Abre un nuevo turno para operar';
  if (kpiExpCash) kpiExpCash.textContent = formatMoney(turnMetrics.expectedCashInDrawer);
  if (kpiOpenBadge) kpiOpenBadge.textContent = `Fondo: ${formatMoney(turnMetrics.openingCash)}`;
  if (kpiDaySales) kpiDaySales.textContent = formatMoney(dayMetrics.totalGrossSales);
  if (kpiDayCount) kpiDayCount.textContent = `${dayMetrics.salesCount} ventas`;
  if (kpiTotalCuts) kpiTotalCuts.textContent = allCashCuts.length;
  if (kpiLastCut) kpiLastCut.textContent = allCashCuts[0]?.folio || 'COR-1000';
  if (tabHistCount) tabHistCount.textContent = allCashCuts.length;
}

function renderTurnCutTab(resetCountedInput = false) {
  const m = computeSelectedShiftMetrics();

  const eyeEl = document.getElementById('turnCutShiftEyebrow');
  const titleEl = document.getElementById('turnCutShiftTitle');
  const cashEl = document.getElementById('turnCutCashier');
  const regEl = document.getElementById('turnCutRegister');
  const openAtEl = document.getElementById('turnCutOpenedAt');
  const statusEl = document.getElementById('turnCutStatusBadge');

  if (eyeEl) eyeEl.textContent = `TURNO SELECCIONADO · ${m.shiftFolio}`;
  if (titleEl) titleEl.textContent = `Corte del Turno — ${m.shiftName}`;
  if (cashEl) cashEl.textContent = m.cashier;
  if (regEl) regEl.textContent = m.registerName;
  if (openAtEl) openAtEl.textContent = new Date(m.openedAt).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' });
  if (statusEl) {
    statusEl.innerHTML = m.status === 'abierto'
      ? `<span class="badge badge-green"><span class="status-dot dot-lime"></span>Abierto (En Curso)</span>`
      : `<span class="badge badge-amber"><span class="status-dot dot-amber"></span>Cerrado</span>`;
  }

  const setTxt = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  setTxt('turnCutOpeningCash', formatMoney(m.openingCash));
  setTxt('turnCutCashSales', formatMoney(m.cashSales));
  setTxt('turnCutCreditCash', formatMoney(m.creditPaymentsCash));
  setTxt('turnCutCashIn', formatMoney(m.cashInTotal));
  setTxt('turnCutCashOut', `-${formatMoney(m.cashOutTotal)}`);
  setTxt('turnCutExpectedCash', formatMoney(m.expectedCashInDrawer));

  setTxt('turnCutMethodCash', formatMoney(m.cashSales));
  setTxt('turnCutMethodCard', formatMoney(m.cardSales));
  setTxt('turnCutMethodTransfer', formatMoney(m.transferSales));
  setTxt('turnCutMethodCredit', formatMoney(m.creditSales));
  setTxt('turnCutSalesCount', `${m.salesCount} completadas`);
  setTxt('turnCutGrossSales', formatMoney(m.totalGrossSales));
  setTxt('arqueoExpectedDisplay', formatMoney(m.expectedCashInDrawer));

  const countedInput = document.getElementById('arqueoCountedInput');
  if (countedInput && (resetCountedInput || !countedInput.dataset.initialized)) {
    countedInput.value = m.expectedCashInDrawer.toFixed(2);
    countedInput.dataset.initialized = 'true';
  }
  updateArqueoDifferenceDisplay();

  // Render Cash Movements Table for this shift
  const tbody = document.getElementById('turnCutCashMovementsBody');
  if (tbody) {
    if (!m.cashMovements || m.cashMovements.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted); padding:14px;">Sin entradas o salidas adicionales de efectivo en este turno.</td></tr>`;
    } else {
      tbody.innerHTML = m.cashMovements.map(cm => {
        const isIn = cm.type === 'entrada_efectivo';
        const badge = isIn
          ? `<span class="badge badge-green">➕ Entrada</span>`
          : cm.type === 'retiro_parcial'
          ? `<span class="badge badge-purple">🔒 Retiro Bóveda</span>`
          : `<span class="badge badge-amber">➖ Gasto / Salida</span>`;
        return `
          <tr>
            <td data-label="Folio" class="mono"><strong>${cm.folio}</strong></td>
            <td data-label="Hora" class="mono tabular">${new Date(cm.date).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</td>
            <td data-label="Tipo">${badge}</td>
            <td data-label="Concepto">${cm.concept}</td>
            <td data-label="Importe" style="text-align:right; color:${isIn ? 'var(--secondary)' : 'var(--danger)'};" class="mono tabular"><strong>${isIn ? '+' : '-'}${formatMoney(cm.amount)}</strong></td>
            <td data-label="Autorizó">${cm.author || '-'}</td>
          </tr>
        `;
      }).join('');
    }
  }
}

function recalculateDenominationsTotal() {
  let sum = 0;
  document.querySelectorAll('.denom-input').forEach(inp => {
    const mult = parseFloat(inp.dataset.val) || 1;
    const qty = Math.max(0, parseFloat(inp.value) || 0);
    sum += mult * qty;
  });
  const countedInput = document.getElementById('arqueoCountedInput');
  if (countedInput) {
    countedInput.value = sum.toFixed(2);
  }
  updateArqueoDifferenceDisplay();
}

function updateArqueoDifferenceDisplay() {
  const m = computeSelectedShiftMetrics();
  const counted = parseFloat(document.getElementById('arqueoCountedInput')?.value) || 0;
  const diff = Number((counted - m.expectedCashInDrawer).toFixed(2));
  const diffEl = document.getElementById('arqueoDiffDisplay');
  if (!diffEl) return;

  if (Math.abs(diff) < 0.01) {
    diffEl.textContent = '$0.00 (Cuadre Exacto)';
    diffEl.style.color = 'var(--secondary)';
  } else if (diff > 0) {
    diffEl.textContent = `+${formatMoney(diff)} (Sobrante)`;
    diffEl.style.color = 'var(--primary)';
  } else {
    diffEl.textContent = `${formatMoney(diff)} (Faltante)`;
    diffEl.style.color = 'var(--danger)';
  }
}

async function submitTurnCut(closeShift = false) {
  const m = computeSelectedShiftMetrics();
  const counted = parseFloat(document.getElementById('arqueoCountedInput')?.value) || 0;
  const notes = document.getElementById('turnCutNotesInput')?.value.trim() || (closeShift ? 'Cierre de turno (Corte Z)' : 'Corte parcial de turno (Corte X)');
  const waPhone = document.getElementById('waCutPhoneInput')?.value.trim() || '2311024672';

  const denominations = {
    b1000: parseInt(document.getElementById('denom1000')?.value, 10) || 0,
    b500: parseInt(document.getElementById('denom500')?.value, 10) || 0,
    b200: parseInt(document.getElementById('denom200')?.value, 10) || 0,
    b100: parseInt(document.getElementById('denom100')?.value, 10) || 0,
    b50: parseInt(document.getElementById('denom50')?.value, 10) || 0,
    b20: parseInt(document.getElementById('denom20')?.value, 10) || 0,
    coins: parseFloat(document.getElementById('denomCoins')?.value) || 0
  };

  try {
    const res = await erpService.createCashCut({
      ...m,
      cutType: 'turno',
      countedCashInDrawer: counted,
      denominations,
      whatsappPhone: waPhone,
      notes,
      closeShift
    });
    await syncAllData();
    showToast(closeShift
      ? `Corte Z (${res.cut?.folio}) guardado y turno ${m.shiftFolio} cerrado exitosamente`
      : `Corte del turno (${res.cut?.folio}) registrado en el historial`);
  } catch (err) {
    showToast(err.message);
  }
}

async function submitOfficialDayCut() {
  const m = computeDayCutMetrics();
  const waPhone = document.getElementById('waCutPhoneInput')?.value.trim() || '2311024672';
  try {
    const res = await erpService.createCashCut({
      ...m,
      cutType: 'dia',
      countedCashInDrawer: m.expectedCashInDrawer,
      whatsappPhone: waPhone,
      notes: 'Corte General del Día (Consolidado Z Diario)',
      closeShift: false
    });
    await syncAllData();
    showToast(`Corte General del Día (${res.cut?.folio}) guardado en el historial`);
  } catch (err) {
    showToast(err.message);
  }
}

function renderDayCutTab() {
  const m = computeDayCutMetrics();

  const setTxt = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };

  setTxt('dayCutTotalSales', formatMoney(m.totalGrossSales));
  setTxt('dayCutTotalCash', formatMoney(m.cashSales + m.creditPaymentsCash));
  setTxt('dayCutTotalElectronic', formatMoney(m.cardSales + m.transferSales + m.creditPaymentsOther));
  setTxt('dayCutTotalCredit', formatMoney(m.creditSales));
  setTxt('dayCutEstimatedProfit', formatMoney(m.estimatedProfit));

  const breakdownEl = document.getElementById('dayCutMethodsBreakdown');
  if (breakdownEl) {
    const totalBase = Math.max(1, m.totalGrossSales);
    const rows = [
      { label: '💵 Ventas en Efectivo', val: m.cashSales },
      { label: '💳 Ventas con Tarjeta', val: m.cardSales },
      { label: '🏦 Transferencia SPEI', val: m.transferSales },
      { label: '📋 Ventas a Crédito Cliente', val: m.creditSales },
      { label: '➕ Abonos de Crédito Recibidos', val: m.creditPaymentsCash + m.creditPaymentsOther },
      { label: '🏦 Efectivo Esperado Total en Cajas', val: m.expectedCashInDrawer }
    ];
    breakdownEl.innerHTML = rows.map(r => `
      <div class="sbar-row">
        <div class="sbar-top"><span>${r.label}</span><strong class="mono tabular">${formatMoney(r.val)}</strong></div>
        <div class="sbar-track"><div class="sbar-fill" style="width:${Math.min(100, Math.round((r.val / totalBase) * 100))}%;"></div></div>
      </div>
    `).join('');
  }

  const shiftsBody = document.getElementById('dayCutShiftsTableBody');
  if (shiftsBody) {
    shiftsBody.innerHTML = allShifts.map(s => `
      <tr>
        <td data-label="Folio Turno" class="mono"><strong>${s.folio}</strong></td>
        <td data-label="Horario / Caja">
          <div><strong>${s.shiftName}</strong><div style="font-size:0.72rem; color:var(--text-muted);">${s.registerName}</div></div>
        </td>
        <td data-label="Cajero">${s.cashier}</td>
        <td data-label="Fondo Inicial" style="text-align:right;" class="mono tabular">${formatMoney(s.openingCash)}</td>
        <td data-label="Estado">
          <span class="badge ${s.status === 'abierto' ? 'badge-green' : 'badge-amber'}">
            ${s.status === 'abierto' ? 'Abierto' : 'Cerrado'}
          </span>
        </td>
      </tr>
    `).join('');
  }

  const salesBody = document.getElementById('dayCutSalesTableBody');
  if (salesBody) {
    if (m.salesList.length === 0) {
      salesBody.innerHTML = `<tr><td colspan="9">${renderEmptyState('Sin ventas en el periodo', 'Registra ventas en la terminal POS para ver el desglose del día.')}</td></tr>`;
    } else {
      salesBody.innerHTML = m.salesList.map(s => `
        <tr>
          <td data-label="Folio Venta" class="mono"><strong>${s.folio}</strong></td>
          <td data-label="Fecha / Hora" class="mono tabular">${new Date(s.date).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}</td>
          <td data-label="Cliente">${s.clientName}</td>
          <td data-label="Cajero">${s.cashier}</td>
          <td data-label="Método Pago"><span class="badge badge-blue">${s.paymentMethod}</span></td>
          <td data-label="Subtotal" style="text-align:right;" class="mono tabular">${formatMoney(s.subtotal)}</td>
          <td data-label="Descuento" style="text-align:right;" class="mono tabular">${formatMoney(s.discount)}</td>
          <td data-label="Total" style="text-align:right;" class="mono tabular"><strong>${formatMoney(s.total)}</strong></td>
          <td data-label="Estado"><span class="badge badge-green">Completada</span></td>
        </tr>
      `).join('');
    }
  }
}

function renderManageShiftsTable() {
  const tbody = document.getElementById('manageShiftsTableBody');
  if (!tbody) return;

  if (allShifts.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10">${renderEmptyState('Sin turnos registrados', 'Abre un nuevo turno de trabajo para iniciar el control de caja.')}</td></tr>`;
    return;
  }

  tbody.innerHTML = allShifts.map(s => {
    const movs = Array.isArray(s.cashMovements) ? s.cashMovements : [];
    const netMovs = movs.reduce((acc, m) => acc + (m.type === 'entrada_efectivo' ? (parseFloat(m.amount) || 0) : -(parseFloat(m.amount) || 0)), 0);
    const isOpen = s.status === 'abierto';

    return `
      <tr>
        <td data-label="Folio Turno" class="mono"><strong>${s.folio}</strong></td>
        <td data-label="Turno / Caja">
          <div><strong>${s.shiftName}</strong><div style="font-size:0.72rem; color:var(--text-muted);">${s.registerName}</div></div>
        </td>
        <td data-label="Cajero"><strong>${s.cashier}</strong></td>
        <td data-label="Apertura" class="mono tabular" style="font-size:0.76rem;">${new Date(s.openedAt).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}</td>
        <td data-label="Cierre" class="mono tabular" style="font-size:0.76rem;">${s.closedAt ? new Date(s.closedAt).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' }) : '<span style="color:var(--secondary);">En curso</span>'}</td>
        <td data-label="Fondo Inicial" style="text-align:right;" class="mono tabular">${formatMoney(s.openingCash)}</td>
        <td data-label="Mov. Caja (Neto)" style="text-align:right; color:${netMovs >= 0 ? 'var(--secondary)' : 'var(--amber)'};" class="mono tabular">${netMovs >= 0 ? '+' : ''}${formatMoney(netMovs)} (${movs.length})</td>
        <td data-label="Efectivo Contado" style="text-align:right;" class="mono tabular"><strong>${s.closingCashCounted !== null && s.closingCashCounted !== undefined ? formatMoney(s.closingCashCounted) : '—'}</strong></td>
        <td data-label="Estado / Corte">
          <span class="badge ${isOpen ? 'badge-green' : 'badge-blue'}">
            <span class="status-dot ${isOpen ? 'dot-lime' : 'dot-blue'}"></span>
            ${isOpen ? 'Abierto' : `Cerrado (${s.cutFolio || 'S/C'})`}
          </span>
        </td>
        <td data-label="Acciones" style="text-align:right;">
          <div style="display:inline-flex; gap:6px; flex-wrap:wrap; justify-content:flex-end;">
            <button type="button" class="btn btn-secondary btn-sm btn-shift-audit" data-id="${s.id}">✂️ Arqueo / Corte</button>
            <button type="button" class="btn btn-ghost btn-sm btn-shift-wa" data-id="${s.id}">📲 WhatsApp</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('.btn-shift-audit').forEach(btn => {
    btn.addEventListener('click', () => {
      const sel = document.getElementById('turnCutSelectShift');
      if (sel) sel.value = btn.dataset.id;
      switchShiftsSubTab('turn_cut');
      renderTurnCutTab(true);
    });
  });

  tbody.querySelectorAll('.btn-shift-wa').forEach(btn => {
    btn.addEventListener('click', () => {
      const sel = document.getElementById('turnCutSelectShift');
      if (sel) sel.value = btn.dataset.id;
      renderTurnCutTab(true);
      const waSel = document.getElementById('waCutSourceSelect');
      if (waSel) waSel.value = 'live_turn';
      switchShiftsSubTab('whatsapp_cut');
    });
  });
}

function renderCutsHistoryTable() {
  const tbody = document.getElementById('cutsHistoryTableBody');
  if (!tbody) return;

  const q = (document.getElementById('cutsHistorySearchInput')?.value || '').toLowerCase().trim();
  const filtered = allCashCuts.filter(c => {
    if (cutsHistoryFilter === 'turno' && c.cutType !== 'turno') return false;
    if (cutsHistoryFilter === 'dia' && c.cutType !== 'dia') return false;
    if (cutsHistoryFilter === 'exact' && Math.abs(parseFloat(c.difference) || 0) >= 0.01) return false;
    if (cutsHistoryFilter === 'diff' && Math.abs(parseFloat(c.difference) || 0) < 0.01) return false;
    if (q) {
      const hay = `${c.folio} ${c.shiftFolio} ${c.shiftName} ${c.cashier} ${c.notes || ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10">${renderEmptyState('Sin cortes en el historial', 'Realiza un Corte del Turno o Corte del Día para registrarlo en la bitácora.')}</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(c => {
    const diff = parseFloat(c.difference) || 0;
    const diffBadge = Math.abs(diff) < 0.01
      ? `<span class="badge badge-green">Exacto ($0.00)</span>`
      : diff > 0
      ? `<span class="badge badge-blue">Sobrante +${formatMoney(diff)}</span>`
      : `<span class="badge badge-red">Faltante ${formatMoney(diff)}</span>`;

    return `
      <tr>
        <td data-label="Folio Corte" class="mono"><strong>${c.folio}</strong></td>
        <td data-label="Tipo de Corte">
          <span class="badge ${c.cutType === 'dia' ? 'badge-purple' : 'badge-blue'}">
            ${c.cutType === 'dia' ? '📅 Corte del Día' : '✂️ Corte de Turno'}
          </span>
        </td>
        <td data-label="Turno / Caja">
          <div><strong class="mono">${c.shiftFolio}</strong><div style="font-size:0.72rem; color:var(--text-muted);">${c.shiftName}</div></div>
        </td>
        <td data-label="Fecha y Hora" class="mono tabular" style="font-size:0.76rem;">${new Date(c.date).toLocaleString('es-MX', { dateStyle: 'short', timeStyle: 'short' })}</td>
        <td data-label="Responsable">${c.cashier}</td>
        <td data-label="Ventas Totales" style="text-align:right;" class="mono tabular"><strong>${formatMoney(c.totalGrossSales)}</strong></td>
        <td data-label="Efectivo Esperado" style="text-align:right;" class="mono tabular">${formatMoney(c.expectedCashInDrawer)}</td>
        <td data-label="Efectivo Contado" style="text-align:right;" class="mono tabular"><strong>${formatMoney(c.countedCashInDrawer)}</strong></td>
        <td data-label="Diferencia" style="text-align:right;">${diffBadge}</td>
        <td data-label="Acciones" style="text-align:right;">
          <div style="display:inline-flex; gap:6px; flex-wrap:wrap; justify-content:flex-end;">
            <button type="button" class="btn btn-secondary btn-sm btn-view-cut" data-id="${c.id}">👁️ Detalle</button>
            <button type="button" class="btn btn-ghost btn-sm btn-print-cut" data-id="${c.id}">🖨️</button>
            <button type="button" class="btn btn-primary btn-sm btn-wa-cut" data-id="${c.id}" title="Enviar este corte por WhatsApp">📲 WhatsApp</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  tbody.querySelectorAll('.btn-view-cut').forEach(btn => {
    btn.addEventListener('click', () => openCutDetailModal(btn.dataset.id));
  });
  tbody.querySelectorAll('.btn-print-cut').forEach(btn => {
    btn.addEventListener('click', () => {
      const cut = allCashCuts.find(x => x.id === btn.dataset.id);
      if (cut) printCashCutTicket(cut);
    });
  });
  tbody.querySelectorAll('.btn-wa-cut').forEach(btn => {
    btn.addEventListener('click', () => {
      const cut = allCashCuts.find(x => x.id === btn.dataset.id);
      if (!cut) return;
      const sel = document.getElementById('waCutSourceSelect');
      if (sel) sel.value = `cut:${cut.id}`;
      switchShiftsSubTab('whatsapp_cut');
      sendCurrentWhatsappCut();
    });
  });
}

function openCutDetailModal(cutId) {
  const cut = allCashCuts.find(c => c.id === cutId);
  if (!cut) return;
  currentDetailCutId = cut.id;

  const folioEl = document.getElementById('cutDetailFolio');
  const titleEl = document.getElementById('cutDetailTitle');
  const bodyEl = document.getElementById('cutDetailBody');

  if (folioEl) folioEl.textContent = `${cut.folio} · ${cut.cutType === 'dia' ? 'CORTE GENERAL DEL DÍA' : 'CORTE DE TURNO'}`;
  if (titleEl) titleEl.textContent = `${cut.shiftName} (${cut.shiftFolio})`;

  const diff = parseFloat(cut.difference) || 0;
  if (bodyEl) {
    bodyEl.innerHTML = `
      <div class="credit-live-summary" style="margin-bottom:14px;">
        <div class="cls-item">
          <span>Fecha y Hora</span>
          <strong class="mono tabular" style="font-size:0.84rem;">${new Date(cut.date).toLocaleString('es-MX')}</strong>
        </div>
        <div class="cls-item">
          <span>Cajero / Responsable</span>
          <strong>${cut.cashier}</strong>
        </div>
        <div class="cls-item">
          <span>Ventas Brutas</span>
          <strong class="mono tabular" style="color:var(--primary);">${formatMoney(cut.totalGrossSales)}</strong>
        </div>
        <div class="cls-item">
          <span>Diferencia Arqueo</span>
          <strong class="mono tabular" style="color:${Math.abs(diff) < 0.01 ? 'var(--secondary)' : diff > 0 ? 'var(--primary)' : 'var(--danger)'};">
            ${diff > 0 ? '+' : ''}${formatMoney(diff)}
          </strong>
        </div>
      </div>

      <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(240px, 1fr)); gap:12px;">
        <div class="surface-card" style="padding:14px; border-radius:10px; border:1px solid var(--border-subtle);">
          <div class="panel-eyebrow" style="margin-bottom:8px;">DESGLOSE DE VENTAS</div>
          <div class="pos-row"><span>💵 Efectivo:</span><strong class="mono tabular">${formatMoney(cut.cashSales)}</strong></div>
          <div class="pos-row"><span>💳 Tarjeta:</span><strong class="mono tabular">${formatMoney(cut.cardSales)}</strong></div>
          <div class="pos-row"><span>🏦 Transferencia SPEI:</span><strong class="mono tabular">${formatMoney(cut.transferSales)}</strong></div>
          <div class="pos-row"><span>📋 Crédito Otorgado:</span><strong class="mono tabular">${formatMoney(cut.creditSales)}</strong></div>
          <div class="pos-row"><span>🧾 Operaciones:</span><strong class="mono tabular">${cut.salesCount} ventas</strong></div>
        </div>

        <div class="surface-card" style="padding:14px; border-radius:10px; border:1px solid var(--border-subtle);">
          <div class="panel-eyebrow" style="margin-bottom:8px;">ARQUEO DE EFECTIVO EN CAJÓN</div>
          <div class="pos-row"><span>(+) Fondo Inicial:</span><strong class="mono tabular">${formatMoney(cut.openingCash)}</strong></div>
          <div class="pos-row"><span>(+) Ventas Efectivo + Abonos:</span><strong class="mono tabular">${formatMoney((cut.cashSales || 0) + (cut.creditPaymentsCash || 0))}</strong></div>
          <div class="pos-row"><span>(+) Entradas / (-) Salidas:</span><strong class="mono tabular">+${formatMoney(cut.cashInTotal)} / -${formatMoney(cut.cashOutTotal)}</strong></div>
          <div class="pos-row"><span>(=) Efectivo Esperado:</span><strong class="mono tabular">${formatMoney(cut.expectedCashInDrawer)}</strong></div>
          <div class="pos-row"><span>(=) Efectivo Físico Contado:</span><strong class="mono tabular" style="color:var(--primary);">${formatMoney(cut.countedCashInDrawer)}</strong></div>
        </div>
      </div>

      <p style="margin-top:12px; font-size:0.82rem; color:var(--text-secondary);">
        <strong>Observaciones de Auditoría:</strong> ${cut.notes || 'Sin observaciones adicionales.'}
      </p>
    `;
  }

  openModal('cutDetailModal');
}

function getSelectedWhatsappCutData() {
  const sourceVal = document.getElementById('waCutSourceSelect')?.value || 'live_turn';
  if (sourceVal === 'live_day') {
    return computeDayCutMetrics();
  }
  if (sourceVal.startsWith('cut:')) {
    const cutId = sourceVal.replace('cut:', '');
    const found = allCashCuts.find(c => c.id === cutId);
    if (found) return found;
  }
  return computeSelectedShiftMetrics();
}

function buildWhatsappCutMessage() {
  const data = getSelectedWhatsappCutData();
  const recipient = (document.getElementById('waCutRecipientName')?.value || 'Dirección General').trim();
  const incMethods = document.getElementById('waIncMethods')?.checked !== false;
  const incArqueo = document.getElementById('waIncArqueo')?.checked !== false;
  const incMovs = document.getElementById('waIncMovements')?.checked !== false;
  const incOps = document.getElementById('waIncOperations')?.checked !== false;
  const customNote = (document.getElementById('waCutCustomNote')?.value || '').trim();

  const isDay = data.cutType === 'dia';
  const headerTitle = isDay
    ? '📅 *REPORTE DE CORTE GENERAL DEL DÍA*'
    : `✂️ *REPORTE DE CORTE DE TURNO (${data.shiftFolio || 'TRN'})*`;

  const diff = (parseFloat(data.countedCashInDrawer) || 0) - (parseFloat(data.expectedCashInDrawer) || 0);
  const diffLabel = Math.abs(diff) < 0.01
    ? '✅ $0.00 (Cuadre Exacto)'
    : diff > 0
    ? `➕ +${formatMoney(diff)} (Sobrante)`
    : `⚠️ ${formatMoney(diff)} (Faltante)`;

  const lines = [
    `🏢 *FIBERLINK SERVICIOS TIC — ERP*`,
    headerTitle,
    `━━━━━━━━━━━━━━━━━━━━`,
    `👤 *Para:* ${recipient}`,
    `🧑‍💼 *Responsable:* ${data.cashier}`,
    `🖥️ *Caja / Turno:* ${data.shiftName} (${data.registerName || 'Mostrador'})`,
    `🕒 *Fecha/Hora:* ${new Date(data.date || Date.now()).toLocaleString('es-MX')}`,
    `🧾 *Folio Corte:* ${data.folio || 'EN-VIVO'}`
  ];

  if (incMethods) {
    lines.push(
      `━━━━━━━━━━━━━━━━━━━━`,
      `💰 *RESUMEN DE VENTAS (${data.salesCount || 0} oper.)*`,
      `• 💵 Efectivo: *${formatMoney(data.cashSales)}*`,
      `• 💳 Tarjeta: *${formatMoney(data.cardSales)}*`,
      `• 🏦 Transferencia SPEI: *${formatMoney(data.transferSales)}*`,
      `• 📋 Crédito Otorgado: *${formatMoney(data.creditSales)}*`,
      `• 🤝 Abonos Crédito Recibidos: *${formatMoney((data.creditPaymentsCash || 0) + (data.creditPaymentsOther || 0))}*`,
      `📈 *VENTA BRUTA TOTAL: ${formatMoney(data.totalGrossSales)}*`
    );
  }

  if (incArqueo) {
    lines.push(
      `━━━━━━━━━━━━━━━━━━━━`,
      `🗄️ *ARQUEO DE EFECTIVO EN CAJÓN*`,
      `• (+) Fondo Inicial: ${formatMoney(data.openingCash)}`,
      `• (+) Ventas Efectivo: ${formatMoney(data.cashSales)}`,
      `• (+) Abonos Crédito (Efec.): ${formatMoney(data.creditPaymentsCash)}`,
      `• (+) Entradas Caja: +${formatMoney(data.cashInTotal)}`,
      `• (-) Salidas / Gastos: -${formatMoney(data.cashOutTotal)}`,
      `• (=) *Efectivo Esperado:* *${formatMoney(data.expectedCashInDrawer)}*`,
      `• (=) *Efectivo Físico Contado:* *${formatMoney(data.countedCashInDrawer)}*`,
      `• ⚖️ *Diferencia:* ${diffLabel}`
    );
  }

  if (incMovs && Array.isArray(data.cashMovements) && data.cashMovements.length > 0) {
    lines.push(
      `━━━━━━━━━━━━━━━━━━━━`,
      `💸 *DETALLE ENTRADAS / SALIDAS DE CAJA*`
    );
    data.cashMovements.slice(0, 5).forEach(cm => {
      const sign = cm.type === 'entrada_efectivo' ? '+' : '-';
      lines.push(`• [${cm.folio}] ${sign}${formatMoney(cm.amount)} — ${cm.concept}`);
    });
  }

  if (incOps) {
    const activeTickets = allTickets.filter(t => t.estado !== 'resuelto').length;
    const resolvedTickets = allTickets.filter(t => t.estado === 'resuelto').length;
    const readyWorkshop = allWorkshop.filter(w => w.estado === 'listo_entrega' || w.estado === 'entregado').length;
    lines.push(
      `━━━━━━━━━━━━━━━━━━━━`,
      `🛠️ *PULSO OPERATIVO SUCURSAL*`,
      `• 🎫 Tickets Soporte: ${resolvedTickets} resueltos / ${activeTickets} activos`,
      `• 🔬 Laboratorio / Taller: ${readyWorkshop} listos o entregados`
    );
  }

  if (customNote || data.notes) {
    lines.push(
      `━━━━━━━━━━━━━━━━━━━━`,
      `📝 *Observaciones:* ${customNote || data.notes}`
    );
  }

  lines.push(`━━━━━━━━━━━━━━━━━━━━`, `_Generado desde Fiberlink Enterprise OS_`);
  return lines.join('\n');
}

function updateWhatsappCutPreview() {
  const previewEl = document.getElementById('waCutMessagePreview');
  if (!previewEl) return;
  previewEl.textContent = buildWhatsappCutMessage();
}

function sendCurrentWhatsappCut() {
  const rawPhone = (document.getElementById('waCutPhoneInput')?.value || '2311024672').replace(/\D/g, '');
  if (!rawPhone) {
    showToast('Ingresa un número de WhatsApp válido');
    return;
  }
  localStorage.setItem('fiberlink_wa_cut_phone', rawPhone);

  const normalizedPhone = rawPhone.length === 10 ? `52${rawPhone}` : rawPhone;
  const message = buildWhatsappCutMessage();
  const waUrl = `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
  window.open(waUrl, '_blank', 'noopener,noreferrer');
  showToast(`Abriendo WhatsApp para enviar el corte al ${rawPhone}...`);
}

function exportCutsHistoryToCSV() {
  const headers = ['FolioCorte', 'Tipo', 'FolioTurno', 'NombreTurno', 'Caja', 'Fecha', 'Responsable', 'FondoInicial', 'VentasEfectivo', 'VentasTarjeta', 'VentasSPEI', 'VentasCredito', 'TotalVentas', 'EfectivoEsperado', 'EfectivoContado', 'Diferencia', 'Notas'];
  const rows = allCashCuts.map(c => [
    c.folio,
    c.cutType,
    c.shiftFolio,
    `"${(c.shiftName || '').replace(/"/g, '""')}"`,
    `"${(c.registerName || '').replace(/"/g, '""')}"`,
    c.date,
    `"${(c.cashier || '').replace(/"/g, '""')}"`,
    c.openingCash,
    c.cashSales,
    c.cardSales,
    c.transferSales,
    c.creditSales,
    c.totalGrossSales,
    c.expectedCashInDrawer,
    c.countedCashInDrawer,
    c.difference,
    `"${(c.notes || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `fiberlink-historial-cortes-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Historial de cortes exportado a CSV');
}

function printCashCutTicket(cut) {
  const area = document.getElementById('printArea');
  if (!area || !cut) return;
  const diff = (parseFloat(cut.countedCashInDrawer) || 0) - (parseFloat(cut.expectedCashInDrawer) || 0);

  area.innerHTML = `
    <div style="max-width:340px; margin:0 auto; font-family:monospace; color:#000;">
      <h2 style="text-align:center; margin-bottom:4px;">FIBERLINK SERVICIOS TIC</h2>
      <p style="text-align:center; font-size:12px; margin-bottom:8px;">
        ${cut.cutType === 'dia' ? 'CORTE GENERAL DEL DÍA (Z)' : 'CORTE DE TURNO Y ARQUEO DE CAJA'}<br>
        Teziutlán, Puebla · Tel: 231 102 4672
      </p>
      <hr>
      <p style="font-size:12px; margin:6px 0;">
        <strong>Folio Corte:</strong> ${cut.folio || 'EN-VIVO'}<br>
        <strong>Turno:</strong> [${cut.shiftFolio || 'TRN'}] ${cut.shiftName || ''}<br>
        <strong>Caja:</strong> ${cut.registerName || 'Caja Principal #1'}<br>
        <strong>Cajero:</strong> ${cut.cashier || ''}<br>
        <strong>Fecha:</strong> ${new Date(cut.date || Date.now()).toLocaleString('es-MX')}
      </p>
      <hr>
      <p style="font-size:12px; margin:6px 0;">
        <strong>DESGLOSE DE VENTAS (${cut.salesCount || 0} oper.)</strong><br>
        Efectivo: ${formatMoney(cut.cashSales)}<br>
        Tarjeta: ${formatMoney(cut.cardSales)}<br>
        Transferencia SPEI: ${formatMoney(cut.transferSales)}<br>
        Crédito Clientes: ${formatMoney(cut.creditSales)}<br>
        <strong>VENTA BRUTA TOTAL: ${formatMoney(cut.totalGrossSales)}</strong>
      </p>
      <hr>
      <p style="font-size:12px; margin:6px 0;">
        <strong>ARQUEO DE EFECTIVO EN CAJÓN</strong><br>
        (+) Fondo Inicial: ${formatMoney(cut.openingCash)}<br>
        (+) Ventas Efectivo: ${formatMoney(cut.cashSales)}<br>
        (+) Abonos Crédito (Efec.): ${formatMoney(cut.creditPaymentsCash)}<br>
        (+) Entradas Caja: +${formatMoney(cut.cashInTotal)}<br>
        (-) Salidas / Gastos: -${formatMoney(cut.cashOutTotal)}<br>
        <strong>(=) EFECTIVO ESPERADO: ${formatMoney(cut.expectedCashInDrawer)}</strong><br>
        <strong>(=) EFECTIVO CONTADO: ${formatMoney(cut.countedCashInDrawer)}</strong><br>
        <strong>DIFERENCIA: ${diff >= 0 ? '+' : ''}${formatMoney(diff)}</strong>
      </p>
      <hr>
      <p style="font-size:11px; margin:8px 0;">Notas: ${cut.notes || 'Sin observaciones'}</p>
      <div style="margin-top:28px; text-align:center; font-size:11px;">
        ___________________________<br>
        Firma Cajero / Auditoría (${cut.cashier})
      </div>
    </div>
  `;
  window.print();
}

// ==========================================
// 16. VIEW 10: MÓDULO DE CONFIGURACIÓN DEL SISTEMA (12 PESTAÑAS + TICKET DIGITAL WHATSAPP)
// ==========================================
const SETTINGS_TABS_META = [
  { key: 'options', title: '1. Opciones habilitadas', paneId: 'cfgTabPane-options' },
  { key: 'cashiers', title: '2. Cajeros', paneId: 'cfgTabPane-cashiers' },
  { key: 'folios', title: '3. Modificar folios', paneId: 'cfgTabPane-folios' },
  { key: 'registers', title: '4. Administrar cajas', paneId: 'cfgTabPane-registers' },
  { key: 'logo', title: '5. Logotipo del programa', paneId: 'cfgTabPane-logo' },
  { key: 'ticket', title: '6. Ticket (Físico y Digital por WhatsApp)', paneId: 'cfgTabPane-ticket' },
  { key: 'payments', title: '7. Formas de pago', paneId: 'cfgTabPane-payments' },
  { key: 'taxes', title: '8. Impuestos', paneId: 'cfgTabPane-taxes' },
  { key: 'cut', title: '9. Corte', paneId: 'cfgTabPane-cut' },
  { key: 'units', title: '10. Unidades de medida', paneId: 'cfgTabPane-units' },
  { key: 'notifications', title: '11. Notificaciones', paneId: 'cfgTabPane-notifications' },
  { key: 'backup', title: '12. Respaldo', paneId: 'cfgTabPane-backup' }
];

let currentSettingsTabKey = 'options';
let currentTicketPreviewMode = 'digital'; // 'digital' | 'thermal'
let activeDigitalTicketSale = null;

function switchSettingsSubTab(tabKey) {
  const foundIdx = SETTINGS_TABS_META.findIndex(t => t.key === tabKey);
  const idx = foundIdx !== -1 ? foundIdx : 0;
  const activeMeta = SETTINGS_TABS_META[idx];
  currentSettingsTabKey = activeMeta.key;

  document.querySelectorAll('#settingsModuleTabs .settings-tab-btn').forEach(btn => {
    const isAct = btn.dataset.cfgtab === currentSettingsTabKey;
    btn.classList.toggle('active', isAct);
    btn.setAttribute('aria-selected', String(isAct));
  });

  SETTINGS_TABS_META.forEach(meta => {
    const pane = document.getElementById(meta.paneId);
    if (pane) pane.classList.toggle('active', meta.key === currentSettingsTabKey);
  });

  const badgeEl = document.getElementById('cfgActiveTabBadge');
  const titleEl = document.getElementById('cfgActiveTabTitle');
  const progEl = document.getElementById('cfgProgressBar');
  const footInfoEl = document.getElementById('cfgFooterTabInfo');

  if (badgeEl) badgeEl.textContent = `Pestaña ${idx + 1} de ${SETTINGS_TABS_META.length}`;
  if (titleEl) titleEl.textContent = activeMeta.title;
  if (progEl) progEl.style.width = `${(((idx + 1) / SETTINGS_TABS_META.length) * 100).toFixed(2)}%`;
  if (footInfoEl) {
    footInfoEl.innerHTML = `Viendo <strong style="color:var(--primary);">Pestaña ${idx + 1} de ${SETTINGS_TABS_META.length}</strong> · ${activeMeta.title}`;
  }

  if (currentSettingsTabKey === 'ticket' || currentSettingsTabKey === 'logo') {
    renderLiveTicketPreview();
  }
}

function applySystemSettingsBranding() {
  if (!systemSettings) return;
  const comp = systemSettings.company || {};
  const logoUrl = comp.logoUrl || '/logo.gif';

  // Update sidebar and login logos dynamically
  document.querySelectorAll('.sidebar-logo, .login-logo, #cfgLogoPreviewImg').forEach(img => {
    img.src = logoUrl;
  });

  // Update openShiftModal register selector with configured registers
  const regSel = document.getElementById('openShiftRegisterSelect');
  const activeRegs = (systemSettings.registers || []).filter(r => r.active !== false);
  if (regSel && activeRegs.length > 0) {
    const prev = regSel.value;
    regSel.innerHTML = activeRegs.map(r =>
      `<option value="${r.name}">${r.name} (Fondo: ${formatMoney(r.defaultOpeningCash)})</option>`
    ).join('');
    if (prev && activeRegs.some(r => r.name === prev)) {
      regSel.value = prev;
    }
  }
}

function initSettingsModule() {
  // 12-Tab Switcher
  document.querySelectorAll('#settingsModuleTabs .settings-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      switchSettingsSubTab(btn.dataset.cfgtab || 'options');
    });
  });

  const goPrevSettingsTab = () => {
    const curIdx = SETTINGS_TABS_META.findIndex(t => t.key === currentSettingsTabKey);
    const prevIdx = (curIdx - 1 + SETTINGS_TABS_META.length) % SETTINGS_TABS_META.length;
    switchSettingsSubTab(SETTINGS_TABS_META[prevIdx].key);
  };

  const goNextSettingsTab = () => {
    const curIdx = SETTINGS_TABS_META.findIndex(t => t.key === currentSettingsTabKey);
    const nextIdx = (curIdx + 1) % SETTINGS_TABS_META.length;
    switchSettingsSubTab(SETTINGS_TABS_META[nextIdx].key);
  };

  document.getElementById('btnCfgPrevTab')?.addEventListener('click', goPrevSettingsTab);
  document.getElementById('btnCfgNextTab')?.addEventListener('click', goNextSettingsTab);
  document.getElementById('btnCfgFooterPrev')?.addEventListener('click', goPrevSettingsTab);
  document.getElementById('btnCfgFooterNext')?.addEventListener('click', goNextSettingsTab);

  // Keyboard Arrow Navigation on Settings Tabs Bar
  document.getElementById('settingsModuleTabs')?.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      goNextSettingsTab();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      goPrevSettingsTab();
    }
  });

  // Top & Bottom Header Save & Backup Buttons
  document.getElementById('btnSaveAllSettingsTop')?.addEventListener('click', () => {
    saveAllSettingsSections('Configuración General Completa');
  });
  document.getElementById('btnCfgFooterSave')?.addEventListener('click', () => {
    const meta = SETTINGS_TABS_META.find(t => t.key === currentSettingsTabKey);
    saveAllSettingsSections(meta ? meta.title : 'Configuración General');
  });
  document.getElementById('btnQuickDownloadBackup')?.addEventListener('click', downloadFullSystemBackup);
  document.getElementById('btnDownloadFullBackup')?.addEventListener('click', downloadFullSystemBackup);

  // Pestaña 1 (Opciones habilitadas) & Pestaña 9 (Corte)
  document.getElementById('btnSaveOptionsAndCutCfg')?.addEventListener('click', () => {
    saveAllSettingsSections('Opciones Habilitadas');
  });
  document.getElementById('btnSaveCutOnlyCfg')?.addEventListener('click', () => {
    saveAllSettingsSections('Reglas de Corte y Arqueo');
  });

  // Pestaña 4: Administrar Cajas & Pestaña 2: Cajeros
  document.getElementById('btnCfgRegReset')?.addEventListener('click', () => {
    document.getElementById('cfgRegisterForm')?.reset();
    document.getElementById('cfgRegId').value = '';
  });

  document.getElementById('cfgRegisterForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!systemSettings) return;
    const id = document.getElementById('cfgRegId')?.value;
    const code = (document.getElementById('cfgRegCode')?.value || '').trim().toUpperCase();
    const name = (document.getElementById('cfgRegName')?.value || '').trim();
    const branch = (document.getElementById('cfgRegBranch')?.value || 'Matriz Centro Teziutlán').trim();
    const printerName = (document.getElementById('cfgRegPrinter')?.value || 'Impresora Térmica 80mm').trim();
    const defaultOpeningCash = parseFloat(document.getElementById('cfgRegFund')?.value) || 1500;

    if (!code || !name) return;
    const list = Array.isArray(systemSettings.registers) ? [...systemSettings.registers] : [];
    if (id) {
      const idx = list.findIndex(r => r.id === id);
      if (idx !== -1) {
        list[idx] = { ...list[idx], code, name, branch, printerName, defaultOpeningCash };
      }
    } else {
      list.push({
        id: `reg-${Date.now()}`,
        code,
        name,
        branch,
        printerName,
        defaultOpeningCash,
        folioSeries: 'VTA',
        active: true
      });
    }

    systemSettings.registers = list;
    await persistSettings({ registers: list, sectionLabel: 'Administrar Cajas Registradoras' });
    document.getElementById('cfgRegisterForm')?.reset();
    document.getElementById('cfgRegId').value = '';
    showToast('Caja registradora guardada exitosamente');
  });

  document.getElementById('btnCfgNewCashier')?.addEventListener('click', () => {
    document.getElementById('userForm')?.reset();
    document.getElementById('usrId').value = '';
    document.getElementById('usrUsername').disabled = false;
    document.getElementById('usrRole').value = 'ventas';
    document.getElementById('usrSpecialty').value = 'Cajero Mostrador / POS';
    document.getElementById('userModalTitle').textContent = 'Registrar Nuevo Cajero / Operador';
    openModal('userModal');
  });

  // Pestaña 3: Modificar Folios & Pestaña 10: Unidades de Medida
  document.getElementById('btnSaveFoliosConfig')?.addEventListener('click', async () => {
    if (!systemSettings) return;
    const folios = { ...(systemSettings.folios || {}) };
    document.querySelectorAll('#cfgFoliosTableBody tr[data-foliokey]').forEach(tr => {
      const key = tr.dataset.foliokey;
      const prefix = (tr.querySelector('.cfg-folio-prefix')?.value || '').trim().toUpperCase();
      const nextNumber = Math.max(1, parseInt(tr.querySelector('.cfg-folio-next')?.value, 10) || 1001);
      if (folios[key]) {
        folios[key] = { ...folios[key], prefix: prefix || folios[key].prefix, nextNumber };
      }
    });
    systemSettings.folios = folios;
    await persistSettings({ folios, sectionLabel: 'Modificar Folios y Series' });
    showToast('Series y consecutivos de folios actualizados');
  });

  document.getElementById('cfgUnitForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!systemSettings) return;
    const key = (document.getElementById('cfgUnitKey')?.value || '').trim().toLowerCase();
    const satKey = (document.getElementById('cfgUnitSat')?.value || 'H87').trim().toUpperCase();
    const name = (document.getElementById('cfgUnitName')?.value || '').trim();
    const allowDecimals = Boolean(document.getElementById('cfgUnitDecimals')?.checked);

    if (!key || !name) return;
    const units = Array.isArray(systemSettings.unitsOfMeasure) ? [...systemSettings.unitsOfMeasure] : [];
    const existingIdx = units.findIndex(u => u.key.toLowerCase() === key);
    if (existingIdx !== -1) {
      units[existingIdx] = { ...units[existingIdx], key, name, satKey, allowDecimals };
    } else {
      units.push({ id: `u-${Date.now()}`, key, name, satKey, allowDecimals });
    }
    systemSettings.unitsOfMeasure = units;
    await persistSettings({ unitsOfMeasure: units, sectionLabel: 'Unidades de Medida' });
    document.getElementById('cfgUnitForm')?.reset();
    showToast(`Unidad de medida "${key}" agregada al catálogo`);
  });

  // Pestaña 5: Logotipo del Programa & Pestaña 6: Ticket (Físico y Digital)
  const logoFileInput = document.getElementById('cfgLogoFileInput');
  logoFileInput?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const dataUrl = ev.target?.result;
      if (typeof dataUrl === 'string' && systemSettings) {
        systemSettings.company = { ...(systemSettings.company || {}), logoUrl: dataUrl };
        applySystemSettingsBranding();
        renderLiveTicketPreview();
        await persistSettings({ company: systemSettings.company, sectionLabel: 'Logotipo del Programa' });
        showToast('Logotipo actualizado en el programa y formato de tickets');
      }
    };
    reader.readAsDataURL(file);
  });

  document.getElementById('btnRestoreDefaultLogo')?.addEventListener('click', async () => {
    if (!systemSettings) return;
    systemSettings.company = { ...(systemSettings.company || {}), logoUrl: '/logo.gif' };
    applySystemSettingsBranding();
    renderLiveTicketPreview();
    await persistSettings({ company: systemSettings.company, sectionLabel: 'Restaurar Logotipo Original' });
    showToast('Logotipo original restaurado');
  });

  [
    'cfgCompCommercialName', 'cfgCompProgramName', 'cfgCompRfc', 'cfgCompPhone', 'cfgCompAddress',
    'cfgTicketPaperWidth', 'cfgTicketFontSize', 'cfgTicketHeaderLine1', 'cfgTicketFooterMsg',
    'cfgTicketWarranty', 'cfgTicketShowLogo', 'cfgTicketShowTax', 'cfgTicketShowCashier', 'cfgTicketShowSku',
    'cfgDigitalTicketEnabled', 'cfgDigitalTicketShowQr', 'cfgDigitalTicketShowSupportBtn', 'cfgDigitalTicketWhatsappTpl'
  ].forEach(id => {
    const el = document.getElementById(id);
    el?.addEventListener('input', renderLiveTicketPreview);
    el?.addEventListener('change', renderLiveTicketPreview);
  });

  // Switch between Digital Ticket Web Preview and Thermal Print Preview
  document.querySelectorAll('#cfgTicketPreviewModePills .pill-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#cfgTicketPreviewModePills .pill-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentTicketPreviewMode = btn.dataset.tktmode === 'thermal' ? 'thermal' : 'digital';
      const digBox = document.getElementById('cfgLiveDigitalTicketPreviewBox');
      const thmBox = document.getElementById('cfgLiveTicketPreviewBox');
      if (digBox) digBox.style.display = currentTicketPreviewMode === 'digital' ? 'block' : 'none';
      if (thmBox) thmBox.style.display = currentTicketPreviewMode === 'thermal' ? 'block' : 'none';
      renderLiveTicketPreview();
    });
  });

  document.getElementById('btnOpenSampleDigitalTicket')?.addEventListener('click', () => {
    const sampleSale = getSampleOrLatestSaleForPreview();
    const url = buildDigitalTicketUrl(sampleSale, true);
    window.open(url, '_blank', 'noopener');
  });

  document.getElementById('btnTestWhatsappDigitalTicket')?.addEventListener('click', () => {
    const sampleSale = getSampleOrLatestSaleForPreview();
    openDigitalTicketModal(sampleSale);
  });

  document.getElementById('btnSaveLogoOnlyCfg')?.addEventListener('click', () => {
    saveAllSettingsSections('Logotipo del Programa y Datos Fiscales');
  });

  document.getElementById('btnSaveLogoAndTicketCfg')?.addEventListener('click', () => {
    saveAllSettingsSections('Diseño de Ticket Físico y Ticket Digital por WhatsApp');
  });

  document.getElementById('btnPrintTestTicket')?.addEventListener('click', () => {
    renderLiveTicketPreview();
    const area = document.getElementById('printArea');
    const preview = document.getElementById('cfgLiveTicketPreviewBox');
    if (area && preview) {
      area.innerHTML = `<div style="max-width:320px; margin:0 auto; font-family:monospace; color:#000;">${preview.innerHTML}</div>`;
      window.print();
    }
  });

  // Pestaña 7: Formas de Pago & Pestaña 8: Impuestos
  document.getElementById('btnSavePaymentMethodsCfg')?.addEventListener('click', async () => {
    if (!systemSettings) return;
    const methods = collectPaymentMethodsFromTable();
    systemSettings.paymentMethods = methods;
    await persistSettings({ paymentMethods: methods, sectionLabel: 'Formas de Pago' });
    showToast('Formas de pago actualizadas');
  });

  document.getElementById('btnSaveTaxesCfg')?.addEventListener('click', () => {
    saveAllSettingsSections('Impuestos y Moneda');
  });

  // Pestaña 11: Notificaciones & Pestaña 12: Respaldo
  document.getElementById('btnSaveNotificationsCfg')?.addEventListener('click', () => {
    saveAllSettingsSections('Notificaciones y Alertas');
  });

  document.getElementById('btnTestNotificationNow')?.addEventListener('click', () => {
    playErpNotificationBeep();
    showToast('🔔 Alerta de prueba activa: Notificaciones visuales y sonoras funcionando correctamente');
  });

  const restoreFileInput = document.getElementById('cfgRestoreBackupFileInput');
  restoreFileInput?.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const parsed = JSON.parse(String(ev.target?.result || '{}'));
        if (!confirm('¿Deseas restaurar la base de datos con este archivo de respaldo? Esto actualizará los registros actuales.')) {
          restoreFileInput.value = '';
          return;
        }
        const res = await erpService.restoreBackup(parsed);
        restoreFileInput.value = '';
        await syncAllData();
        showToast(`Respaldo restaurado exitosamente (${res.restoredCollections || 10} módulos sincronizados)`);
      } catch (err) {
        showToast('Error al leer el archivo JSON de respaldo: ' + err.message);
      }
    };
    reader.readAsText(file);
  });

  // Wire Digital Ticket Modal (#digitalTicketModal) Events
  document.getElementById('btnDtCopyLink')?.addEventListener('click', async () => {
    const linkIn = document.getElementById('dtModalLinkInput');
    if (!linkIn || !linkIn.value) return;
    try {
      await navigator.clipboard.writeText(linkIn.value);
      showToast('📋 Enlace del Ticket Digital copiado al portapapeles');
    } catch (e) {
      linkIn.select();
      document.execCommand('copy');
      showToast('📋 Enlace copiado');
    }
  });

  document.getElementById('btnDtOpenLink')?.addEventListener('click', () => {
    const linkIn = document.getElementById('dtModalLinkInput');
    if (linkIn?.value) {
      window.open(linkIn.value, '_blank', 'noopener');
    }
  });

  document.getElementById('btnDtPrintThermal')?.addEventListener('click', () => {
    if (activeDigitalTicketSale) {
      printPosReceipt(activeDigitalTicketSale);
    }
  });

  document.getElementById('btnDtSendWhatsappNow')?.addEventListener('click', () => {
    const rawPhone = (document.getElementById('dtModalPhoneInput')?.value || '').replace(/\D/g, '');
    const msg = (document.getElementById('dtModalMessagePreview')?.value || '').trim();
    if (!msg) return;
    let cleanPhone = rawPhone;
    if (cleanPhone.length === 10) {
      cleanPhone = `52${cleanPhone}`;
    }
    const waUrl = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`
      : `https://wa.me/?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank', 'noopener');
    showToast('📲 Abriendo WhatsApp con el enlace del Ticket Digital...');
  });
}

function getSampleOrLatestSaleForPreview() {
  if (allSales.length > 0) {
    return allSales[0];
  }
  return {
    id: 'sale-sample',
    folio: 'VTA-1005',
    date: new Date().toISOString(),
    clientName: 'Mostrador / Público en General',
    cashier: currentUser?.name || 'Lic. Sofía Navarro',
    paymentMethod: 'Efectivo',
    subtotal: 3040,
    discount: 0,
    total: 3040,
    items: [
      { sku: 'POS-IMP-80', name: 'Impresora Térmica 80mm Autocorte', qty: 1, price: 1890 },
      { sku: 'POS-CAJ-01', name: 'Cajón de Dinero Automático RJ11', qty: 1, price: 1150 }
    ]
  };
}

function encodeBase64Unicode(obj) {
  try {
    const json = JSON.stringify(obj);
    return btoa(encodeURIComponent(json).replace(/%([0-9A-F]{2})/g, (_, p1) => String.fromCharCode('0x' + p1)));
  } catch (e) {
    return '';
  }
}

function buildDigitalTicketUrl(sale, useLiveFormValues = false) {
  const s = sale || getSampleOrLatestSaleForPreview();
  const comp = systemSettings?.company || {};
  const tkt = systemSettings?.ticketConfig || {};
  const tax = systemSettings?.taxes || {};

  // Avoid embedding huge data:image base64 strings inside URL query params
  const rawLogo = comp.logoUrl || '/logo.gif';
  const safeLogoUrl = rawLogo.startsWith('data:') ? '/logo.gif' : rawLogo;

  const snapshot = {
    sale: {
      folio: s.folio || 'VTA-1001',
      date: s.date || new Date().toISOString(),
      clientName: s.clientName || 'Mostrador / Público en General',
      cashier: s.cashier || 'Cajero POS',
      paymentMethod: s.paymentMethod || 'Efectivo',
      linkedRef: s.linkedRef || '',
      subtotal: Number(s.subtotal ?? s.total) || 0,
      discount: Number(s.discount) || 0,
      total: Number(s.total) || 0,
      status: s.status || 'completada',
      items: (s.items || []).map(it => ({
        sku: it.sku || '',
        name: it.name || 'Artículo',
        qty: Number(it.qty) || 1,
        price: Number(it.price) || 0
      }))
    },
    settings: {
      company: {
        commercialName: useLiveFormValues
          ? (document.getElementById('cfgCompCommercialName')?.value || comp.commercialName || 'FIBERLINK SERVICIOS TIC')
          : (comp.commercialName || 'FIBERLINK SERVICIOS TIC'),
        rfc: useLiveFormValues
          ? (document.getElementById('cfgCompRfc')?.value || comp.rfc || 'FST2109148H2')
          : (comp.rfc || 'FST2109148H2'),
        address: useLiveFormValues
          ? (document.getElementById('cfgCompAddress')?.value || comp.address || 'Teziutlán, Puebla')
          : (comp.address || 'Teziutlán, Puebla'),
        phone: useLiveFormValues
          ? (document.getElementById('cfgCompPhone')?.value || comp.phone || '231 102 4672')
          : (comp.phone || '231 102 4672'),
        whatsapp: comp.whatsapp || '2311024672',
        logoUrl: safeLogoUrl
      },
      ticketConfig: {
        headerLine1: useLiveFormValues
          ? (document.getElementById('cfgTicketHeaderLine1')?.value ?? tkt.headerLine1 ?? '')
          : (tkt.headerLine1 || ''),
        footerMessage: useLiveFormValues
          ? (document.getElementById('cfgTicketFooterMsg')?.value ?? tkt.footerMessage ?? '')
          : (tkt.footerMessage || ''),
        warrantyPolicy: useLiveFormValues
          ? (document.getElementById('cfgTicketWarranty')?.value ?? tkt.warrantyPolicy ?? '')
          : (tkt.warrantyPolicy || ''),
        showLogo: useLiveFormValues
          ? (document.getElementById('cfgTicketShowLogo')?.checked !== false)
          : (tkt.showLogo !== false),
        showTaxBreakdown: useLiveFormValues
          ? (document.getElementById('cfgTicketShowTax')?.checked !== false)
          : (tkt.showTaxBreakdown !== false),
        showCashierAndShift: useLiveFormValues
          ? (document.getElementById('cfgTicketShowCashier')?.checked !== false)
          : (tkt.showCashierAndShift !== false),
        showSkuOnItems: useLiveFormValues
          ? (document.getElementById('cfgTicketShowSku')?.checked !== false)
          : (tkt.showSkuOnItems !== false)
      },
      taxes: {
        taxName: tax.taxName || 'IVA',
        vatRate: Number(tax.vatRate ?? 16),
        pricesIncludeTax: tax.pricesIncludeTax !== false,
        currencyCode: tax.currencyCode || 'MXN'
      }
    }
  };

  const encoded = encodeBase64Unicode(snapshot);
  const origin = window.location.origin;
  return `${origin}/ticket.html?folio=${encodeURIComponent(s.folio || 'VTA-1001')}&d=${encodeURIComponent(encoded)}`;
}

function buildDigitalTicketWhatsappMessage(sale, ticketUrl) {
  const s = sale || getSampleOrLatestSaleForPreview();
  const compName = systemSettings?.company?.commercialName || 'FIBERLINK SERVICIOS TIC';
  const rawTpl = document.getElementById('cfgDigitalTicketWhatsappTpl')?.value
    || systemSettings?.ticketConfig?.digitalTicketWhatsappTemplate
    || 'Hola *{cliente}*, gracias por tu compra en *{empresa}*. Aquí puedes consultar y descargar tu Ticket Digital *{folio}* por *{total}*:\n{enlace}';

  return rawTpl
    .replace(/\{cliente\}/g, s.clientName || 'Cliente')
    .replace(/\{empresa\}/g, compName)
    .replace(/\{folio\}/g, s.folio || 'VTA-1001')
    .replace(/\{total\}/g, `${formatMoney(s.total)} MXN`)
    .replace(/\{enlace\}/g, ticketUrl);
}

function openDigitalTicketModal(sale) {
  const s = sale || getSampleOrLatestSaleForPreview();
  activeDigitalTicketSale = s;

  const url = buildDigitalTicketUrl(s, false);
  const msg = buildDigitalTicketWhatsappMessage(s, url);

  // Try to prefill client's phone if client is registered in allClients
  let clientPhone = '';
  if (s.clientId) {
    const c = allClients.find(x => x.id === s.clientId);
    if (c?.phone) clientPhone = c.phone;
  } else if (s.clientName) {
    const c = allClients.find(x => x.name.toLowerCase() === s.clientName.toLowerCase());
    if (c?.phone) clientPhone = c.phone;
  }

  const badgeEl = document.getElementById('dtModalFolioBadge');
  const folioEl = document.getElementById('dtModalFolio');
  const clientEl = document.getElementById('dtModalClient');
  const totalEl = document.getElementById('dtModalTotal');
  const phoneIn = document.getElementById('dtModalPhoneInput');
  const linkIn = document.getElementById('dtModalLinkInput');
  const msgIn = document.getElementById('dtModalMessagePreview');

  if (badgeEl) badgeEl.textContent = `TICKET DIGITAL VERIFICADO · ${s.folio}`;
  if (folioEl) folioEl.textContent = s.folio;
  if (clientEl) clientEl.textContent = s.clientName || 'Mostrador';
  if (totalEl) totalEl.textContent = formatMoney(s.total);
  if (phoneIn) phoneIn.value = clientPhone;
  if (linkIn) linkIn.value = url;
  if (msgIn) msgIn.value = msg;

  openModal('digitalTicketModal');
}

function playErpNotificationBeep() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.22);
  } catch (e) {
    // Ignore audio context restriction
  }
}

async function persistSettings(partialPayload) {
  try {
    const res = await erpService.updateSettings(partialPayload);
    if (res?.settings) {
      systemSettings = res.settings;
    }
    await syncAllData();
  } catch (err) {
    showToast(err.message);
  }
}

function collectPaymentMethodsFromTable() {
  if (!systemSettings) return [];
  const current = Array.isArray(systemSettings.paymentMethods) ? [...systemSettings.paymentMethods] : [];
  document.querySelectorAll('#cfgPaymentMethodsTableBody tr[data-pmid]').forEach(tr => {
    const id = tr.dataset.pmid;
    const idx = current.findIndex(m => m.id === id);
    if (idx !== -1) {
      current[idx] = {
        ...current[idx],
        enabled: Boolean(tr.querySelector('.cfg-pm-enabled')?.checked),
        feePercent: Math.max(0, parseFloat(tr.querySelector('.cfg-pm-fee')?.value) || 0),
        requiresReference: Boolean(tr.querySelector('.cfg-pm-ref')?.checked),
        bankInfo: (tr.querySelector('.cfg-pm-bank')?.value || '').trim()
      };
    }
  });
  return current;
}

async function saveAllSettingsSections(sectionLabel = 'Configuración General') {
  if (!systemSettings) return;

  const enabledOptions = {
    allowSellWithoutStock: Boolean(document.getElementById('optAllowSellWithoutStock')?.checked),
    requireClientForCredit: Boolean(document.getElementById('optRequireClientForCredit')?.checked),
    openCashDrawerOnCashSale: Boolean(document.getElementById('optOpenCashDrawer')?.checked),
    autoPrintTicketOnSale: Boolean(document.getElementById('optAutoPrintTicket')?.checked),
    showBarcodeInPos: Boolean(document.getElementById('optShowBarcodeInPos')?.checked),
    roundCashCents: Boolean(document.getElementById('optRoundCashCents')?.checked),
    requireAdminForCancel: Boolean(document.getElementById('optRequireAdminForCancel')?.checked),
    enableWhatsappReceipts: Boolean(document.getElementById('optEnableWhatsappReceipts')?.checked)
  };

  const cutRules = {
    blindCutMode: Boolean(document.getElementById('cfgCutBlindMode')?.checked),
    defaultOpeningFund: parseFloat(document.getElementById('cfgCutDefaultFund')?.value) || 1500,
    maxCashInDrawerAlert: parseFloat(document.getElementById('cfgCutMaxCashAlert')?.value) || 15000,
    allowedDiscrepancyTolerance: parseFloat(document.getElementById('cfgCutTolerance')?.value) || 20,
    defaultCutWhatsappPhone: (document.getElementById('cfgCutDefaultWhatsapp')?.value || '2311024672').trim(),
    requireCountDenominations: Boolean(document.getElementById('cfgCutRequireDenominations')?.checked),
    autoSendWhatsappOnCloseShift: Boolean(document.getElementById('cfgCutAutoWhatsapp')?.checked)
  };

  const company = {
    ...(systemSettings.company || {}),
    commercialName: (document.getElementById('cfgCompCommercialName')?.value || 'FIBERLINK SERVICIOS TIC').trim(),
    programName: (document.getElementById('cfgCompProgramName')?.value || 'Fiberlink Enterprise OS').trim(),
    rfc: (document.getElementById('cfgCompRfc')?.value || 'FST2109148H2').trim().toUpperCase(),
    phone: (document.getElementById('cfgCompPhone')?.value || '231 102 4672').trim(),
    address: (document.getElementById('cfgCompAddress')?.value || '').trim()
  };

  const ticketConfig = {
    paperWidth: document.getElementById('cfgTicketPaperWidth')?.value || '80mm',
    fontSize: document.getElementById('cfgTicketFontSize')?.value || '12px',
    headerLine1: (document.getElementById('cfgTicketHeaderLine1')?.value || '').trim(),
    footerMessage: (document.getElementById('cfgTicketFooterMsg')?.value || '').trim(),
    warrantyPolicy: (document.getElementById('cfgTicketWarranty')?.value || '').trim(),
    showLogo: Boolean(document.getElementById('cfgTicketShowLogo')?.checked),
    showTaxBreakdown: Boolean(document.getElementById('cfgTicketShowTax')?.checked),
    showCashierAndShift: Boolean(document.getElementById('cfgTicketShowCashier')?.checked),
    showSkuOnItems: Boolean(document.getElementById('cfgTicketShowSku')?.checked),
    enableDigitalTicket: Boolean(document.getElementById('cfgDigitalTicketEnabled')?.checked),
    digitalTicketShowQr: Boolean(document.getElementById('cfgDigitalTicketShowQr')?.checked),
    digitalTicketShowSupportBtn: Boolean(document.getElementById('cfgDigitalTicketShowSupportBtn')?.checked),
    digitalTicketWhatsappTemplate: (document.getElementById('cfgDigitalTicketWhatsappTpl')?.value || '').trim()
  };

  const taxes = {
    taxName: (document.getElementById('cfgTaxName')?.value || 'IVA').trim(),
    vatRate: parseFloat(document.getElementById('cfgTaxRate')?.value) || 0,
    pricesIncludeTax: document.getElementById('cfgTaxIncludeMode')?.value !== 'false',
    applyRetentionIsr: Boolean(document.getElementById('cfgTaxRetentionIsr')?.checked),
    retentionIsrRate: 1.25,
    currencyCode: (document.getElementById('cfgCurrencyCode')?.value || 'MXN').trim().toUpperCase(),
    currencySymbol: '$',
    exchangeRateUsd: parseFloat(document.getElementById('cfgExchangeRateUsd')?.value) || 19.85
  };

  const notifications = {
    lowStockAlerts: Boolean(document.getElementById('notifLowStock')?.checked),
    overdueCreditAlerts: Boolean(document.getElementById('notifOverdueCredit')?.checked),
    urgentTicketAlerts: Boolean(document.getElementById('notifUrgentTickets')?.checked),
    soundEffects: Boolean(document.getElementById('notifSoundEffects')?.checked),
    adminWhatsappNumber: (document.getElementById('notifAdminWhatsapp')?.value || '2311024672').trim(),
    adminEmailAlert: (document.getElementById('notifAdminEmail')?.value || 'admin@fiberlink.mx').trim()
  };

  const paymentMethods = collectPaymentMethodsFromTable();

  await persistSettings({
    company,
    enabledOptions,
    cutRules,
    ticketConfig,
    taxes,
    notifications,
    paymentMethods,
    sectionLabel
  });
  showToast(`Configuración guardada: ${sectionLabel}`);
}

function renderSettingsModule() {
  if (!systemSettings) return;

  const comp = systemSettings.company || {};
  const opts = systemSettings.enabledOptions || {};
  const cut = systemSettings.cutRules || {};
  const tkt = systemSettings.ticketConfig || {};
  const tax = systemSettings.taxes || {};
  const notif = systemSettings.notifications || {};
  const regs = Array.isArray(systemSettings.registers) ? systemSettings.registers : [];
  const pms = Array.isArray(systemSettings.paymentMethods) ? systemSettings.paymentMethods : [];
  const units = Array.isArray(systemSettings.unitsOfMeasure) ? systemSettings.unitsOfMeasure : [];

  // Update Top 4 KPIs
  const setTxt = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  };
  setTxt('cfgKpiCompanyName', comp.commercialName || 'FIBERLINK TIC');
  setTxt('cfgKpiRfcBadge', comp.rfc || 'FST2109148H2');
  setTxt('cfgKpiPaperWidthFoot', `Térmica ${tkt.paperWidth || '80mm'} + ${tkt.enableDigitalTicket !== false ? 'Ticket Digital WhatsApp' : 'Impreso'}`);
  setTxt('cfgKpiRegistersCount', `${regs.filter(r => r.active !== false).length} Cajas`);
  setTxt('cfgKpiCashiersCount', `${allUsers.length} operadores`);
  setTxt('cfgKpiTaxRate', `${tax.taxName || 'IVA'} ${tax.vatRate ?? 16}%`);
  setTxt('cfgKpiPayMethodsCount', `${pms.filter(p => p.enabled).length} formas activas`);
  setTxt('cfgKpiTaxModeFoot', `${tax.pricesIncludeTax !== false ? 'Precios con impuesto incluido' : 'Más impuestos'} · ${tax.currencyCode || 'MXN'}`);
  setTxt('cfgKpiUnitsCount', `${units.length} Unidades`);

  const setChk = (id, val) => {
    const el = document.getElementById(id);
    if (el) el.checked = Boolean(val);
  };
  const setVal = (id, val) => {
    const el = document.getElementById(id);
    if (el && val !== undefined && val !== null) el.value = val;
  };

  // Pestaña 1: Opciones Habilitadas & Pestaña 9: Corte
  setChk('optAllowSellWithoutStock', opts.allowSellWithoutStock);
  setChk('optRequireClientForCredit', opts.requireClientForCredit !== false);
  setChk('optOpenCashDrawer', opts.openCashDrawerOnCashSale !== false);
  setChk('optAutoPrintTicket', opts.autoPrintTicketOnSale !== false);
  setChk('optShowBarcodeInPos', opts.showBarcodeInPos !== false);
  setChk('optRoundCashCents', opts.roundCashCents);
  setChk('optRequireAdminForCancel', opts.requireAdminForCancel !== false);
  setChk('optEnableWhatsappReceipts', opts.enableWhatsappReceipts !== false);

  setChk('cfgCutBlindMode', cut.blindCutMode);
  setVal('cfgCutDefaultFund', cut.defaultOpeningFund ?? 1500);
  setVal('cfgCutMaxCashAlert', cut.maxCashInDrawerAlert ?? 15000);
  setVal('cfgCutTolerance', cut.allowedDiscrepancyTolerance ?? 20);
  setVal('cfgCutDefaultWhatsapp', cut.defaultCutWhatsappPhone || '2311024672');
  setChk('cfgCutRequireDenominations', cut.requireCountDenominations);
  setChk('cfgCutAutoWhatsapp', cut.autoSendWhatsappOnCloseShift);

  // Pestaña 2 & 4: Administrar Cajas & Cajeros
  renderSettingsRegistersTable();
  renderSettingsCashiersTable();

  // Pestaña 3 & 10: Modificar Folios & Unidades de Medida
  renderSettingsFoliosTable();
  renderSettingsUnitsTable();

  // Pestaña 5 & 6: Logotipo & Ticket (Físico y Digital)
  const logoImg = document.getElementById('cfgLogoPreviewImg');
  if (logoImg) logoImg.src = comp.logoUrl || '/logo.gif';
  setVal('cfgCompCommercialName', comp.commercialName || 'FIBERLINK SERVICIOS TIC');
  setVal('cfgCompProgramName', comp.programName || 'Fiberlink Enterprise OS');
  setVal('cfgCompRfc', comp.rfc || 'FST2109148H2');
  setVal('cfgCompPhone', comp.phone || '231 102 4672');
  setVal('cfgCompAddress', comp.address || '');

  setVal('cfgTicketPaperWidth', tkt.paperWidth || '80mm');
  setVal('cfgTicketFontSize', tkt.fontSize || '12px');
  setVal('cfgTicketHeaderLine1', tkt.headerLine1 || '');
  setVal('cfgTicketFooterMsg', tkt.footerMessage || '');
  setVal('cfgTicketWarranty', tkt.warrantyPolicy || '');
  setChk('cfgTicketShowLogo', tkt.showLogo !== false);
  setChk('cfgTicketShowTax', tkt.showTaxBreakdown !== false);
  setChk('cfgTicketShowCashier', tkt.showCashierAndShift !== false);
  setChk('cfgTicketShowSku', tkt.showSkuOnItems !== false);

  setChk('cfgDigitalTicketEnabled', tkt.enableDigitalTicket !== false);
  setChk('cfgDigitalTicketShowQr', tkt.digitalTicketShowQr !== false);
  setChk('cfgDigitalTicketShowSupportBtn', tkt.digitalTicketShowSupportBtn !== false);
  setVal(
    'cfgDigitalTicketWhatsappTpl',
    tkt.digitalTicketWhatsappTemplate ||
      'Hola *{cliente}*, gracias por tu compra en *{empresa}*. Aquí puedes consultar y descargar tu Ticket Digital *{folio}* por *{total}*:\n{enlace}'
  );

  renderLiveTicketPreview();

  // Pestaña 7 & 8: Formas de Pago & Impuestos
  renderSettingsPaymentMethodsTable();
  setVal('cfgTaxName', tax.taxName || 'IVA');
  setVal('cfgTaxRate', String(tax.vatRate ?? 16));
  setVal('cfgTaxIncludeMode', String(tax.pricesIncludeTax !== false));
  setChk('cfgTaxRetentionIsr', tax.applyRetentionIsr);
  setVal('cfgCurrencyCode', tax.currencyCode || 'MXN');
  setVal('cfgExchangeRateUsd', tax.exchangeRateUsd ?? 19.85);

  // Pestaña 11 & 12: Notificaciones & Respaldo
  setChk('notifLowStock', notif.lowStockAlerts !== false);
  setChk('notifOverdueCredit', notif.overdueCreditAlerts !== false);
  setChk('notifUrgentTickets', notif.urgentTicketAlerts !== false);
  setChk('notifSoundEffects', notif.soundEffects !== false);
  setVal('notifAdminWhatsapp', notif.adminWhatsappNumber || '2311024672');
  setVal('notifAdminEmail', notif.adminEmailAlert || 'admin@fiberlink.mx');
  renderSettingsBackupStats();
}

function renderSettingsRegistersTable() {
  const tbody = document.getElementById('cfgRegistersTableBody');
  if (!tbody || !systemSettings) return;
  const regs = Array.isArray(systemSettings.registers) ? systemSettings.registers : [];

  tbody.innerHTML = regs.map(r => `
    <tr>
      <td data-label="Código" class="mono"><strong>${r.code}</strong></td>
      <td data-label="Caja / Impresora">
        <div><strong>${r.name}</strong><div style="font-size:0.72rem; color:var(--text-muted);">${r.branch} · ${r.printerName}</div></div>
      </td>
      <td data-label="Fondo Sugerido" style="text-align:right;" class="mono tabular">${formatMoney(r.defaultOpeningCash)}</td>
      <td data-label="Estado">
        <span class="badge ${r.active !== false ? 'badge-green' : 'badge-amber'}">
          ${r.active !== false ? 'Activa' : 'Inactiva'}
        </span>
      </td>
      <td data-label="Acciones" style="text-align:right;">
        <div style="display:inline-flex; gap:6px;">
          <button type="button" class="btn btn-ghost btn-sm btn-edit-reg" data-id="${r.id}">Editar</button>
          <button type="button" class="btn btn-secondary btn-sm btn-toggle-reg" data-id="${r.id}">${r.active !== false ? 'Pausar' : 'Activar'}</button>
        </div>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('.btn-edit-reg').forEach(btn => {
    btn.addEventListener('click', () => {
      const reg = regs.find(x => x.id === btn.dataset.id);
      if (!reg) return;
      document.getElementById('cfgRegId').value = reg.id;
      document.getElementById('cfgRegCode').value = reg.code;
      document.getElementById('cfgRegName').value = reg.name;
      document.getElementById('cfgRegBranch').value = reg.branch || '';
      document.getElementById('cfgRegPrinter').value = reg.printerName || '';
      document.getElementById('cfgRegFund').value = reg.defaultOpeningCash || 1500;
    });
  });

  tbody.querySelectorAll('.btn-toggle-reg').forEach(btn => {
    btn.addEventListener('click', async () => {
      const idx = regs.findIndex(x => x.id === btn.dataset.id);
      if (idx === -1) return;
      regs[idx].active = regs[idx].active === false;
      await persistSettings({ registers: regs, sectionLabel: 'Estado de Caja Registradora' });
      showToast(`Estado de ${regs[idx].code} actualizado`);
    });
  });
}

function renderSettingsCashiersTable() {
  const tbody = document.getElementById('cfgCashiersTableBody');
  if (!tbody) return;

  tbody.innerHTML = allUsers.map(u => `
    <tr>
      <td data-label="Cajero / Operador">
        <div><strong>${u.name}</strong><div style="font-size:0.72rem; color:var(--text-muted);">${u.specialty || 'Operador ERP'}</div></div>
      </td>
      <td data-label="Login" class="mono">@${u.username}</td>
      <td data-label="Rol / Permiso"><span class="badge badge-purple">${u.permissions?.label || u.role}</span></td>
      <td data-label="Teléfono" class="mono tabular">${u.phone || '-'}</td>
      <td data-label="Estado"><span class="badge badge-green">Autorizado</span></td>
      <td data-label="Acciones" style="text-align:right;">
        <button type="button" class="btn btn-secondary btn-sm btn-cfg-edit-cashier" data-id="${u.id}">Editar Cajero</button>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('.btn-cfg-edit-cashier').forEach(btn => {
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
      document.getElementById('userModalTitle').textContent = `Configurar Cajero: ${u.name}`;
      openModal('userModal');
    });
  });
}

function renderSettingsFoliosTable() {
  const tbody = document.getElementById('cfgFoliosTableBody');
  if (!tbody || !systemSettings) return;
  const folios = systemSettings.folios || {};
  const entries = Object.entries(folios);

  tbody.innerHTML = entries.map(([key, cfg]) => `
    <tr data-foliokey="${key}">
      <td data-label="Módulo / Documento">
        <div><strong>${cfg.description || key}</strong><div class="mono" style="font-size:0.7rem; color:var(--text-muted);">Colección: ${key}</div></div>
      </td>
      <td data-label="Prefijo (Serie)">
        <input type="text" class="cfg-folio-prefix mono" value="${cfg.prefix || ''}" maxlength="8" style="width:95px; text-transform:uppercase;">
      </td>
      <td data-label="Siguiente Folio #">
        <input type="number" class="cfg-folio-next mono tabular" value="${cfg.nextNumber || 1001}" min="1" step="1" style="width:110px;">
      </td>
      <td data-label="Vista Previa">
        <span class="badge badge-blue mono tabular cfg-folio-preview">${cfg.prefix}-${cfg.nextNumber}</span>
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('tr[data-foliokey]').forEach(tr => {
    const prefIn = tr.querySelector('.cfg-folio-prefix');
    const nextIn = tr.querySelector('.cfg-folio-next');
    const prevSpan = tr.querySelector('.cfg-folio-preview');
    const updatePrev = () => {
      if (prevSpan) {
        prevSpan.textContent = `${(prefIn?.value || 'FOL').toUpperCase()}-${nextIn?.value || 1001}`;
      }
    };
    prefIn?.addEventListener('input', updatePrev);
    nextIn?.addEventListener('input', updatePrev);
  });
}

function renderSettingsUnitsTable() {
  const tbody = document.getElementById('cfgUnitsTableBody');
  if (!tbody || !systemSettings) return;
  const units = Array.isArray(systemSettings.unitsOfMeasure) ? systemSettings.unitsOfMeasure : [];

  tbody.innerHTML = units.map(u => `
    <tr>
      <td data-label="Clave" class="mono"><strong>${u.key}</strong></td>
      <td data-label="Unidad / SAT">
        <div><strong>${u.name}</strong><div class="mono" style="font-size:0.7rem; color:var(--text-muted);">Clave SAT: ${u.satKey || 'H87'}</div></div>
      </td>
      <td data-label="Decimales">
        <span class="badge ${u.allowDecimals ? 'badge-blue' : 'badge-purple'}">${u.allowDecimals ? 'Sí (0.00)' : 'Enteros'}</span>
      </td>
      <td data-label="Acción" style="text-align:right;">
        ${units.length > 1 ? `<button type="button" class="btn btn-danger btn-sm btn-del-unit" data-key="${u.key}">✕</button>` : ''}
      </td>
    </tr>
  `).join('');

  tbody.querySelectorAll('.btn-del-unit').forEach(btn => {
    btn.addEventListener('click', async () => {
      const next = units.filter(u => u.key !== btn.dataset.key);
      systemSettings.unitsOfMeasure = next;
      await persistSettings({ unitsOfMeasure: next, sectionLabel: 'Eliminar Unidad de Medida' });
      showToast('Unidad eliminada');
    });
  });
}

function renderLiveTicketPreview() {
  const box = document.getElementById('cfgLiveTicketPreviewBox');
  const digBox = document.getElementById('cfgLiveDigitalTicketPreviewBox');

  const commName = document.getElementById('cfgCompCommercialName')?.value || 'FIBERLINK SERVICIOS TIC';
  const rfc = document.getElementById('cfgCompRfc')?.value || 'FST2109148H2';
  const address = document.getElementById('cfgCompAddress')?.value || 'Teziutlán, Puebla';
  const phone = document.getElementById('cfgCompPhone')?.value || '231 102 4672';
  const header1 = document.getElementById('cfgTicketHeaderLine1')?.value || '';
  const footerMsg = document.getElementById('cfgTicketFooterMsg')?.value || '';
  const warranty = document.getElementById('cfgTicketWarranty')?.value || '';
  const fontSize = document.getElementById('cfgTicketFontSize')?.value || '12px';
  const showLogo = document.getElementById('cfgTicketShowLogo')?.checked !== false;
  const showTax = document.getElementById('cfgTicketShowTax')?.checked !== false;
  const showCashier = document.getElementById('cfgTicketShowCashier')?.checked !== false;
  const showSku = document.getElementById('cfgTicketShowSku')?.checked !== false;
  const showQr = document.getElementById('cfgDigitalTicketShowQr')?.checked !== false;
  const showSupportBtn = document.getElementById('cfgDigitalTicketShowSupportBtn')?.checked !== false;
  const logoSrc = systemSettings?.company?.logoUrl || '/logo.gif';

  if (box) {
    box.style.fontSize = fontSize;
    box.innerHTML = `
      <div style="text-align:center;">
        ${showLogo ? `<img src="${logoSrc}" alt="Logo" style="max-height:48px; margin:0 auto 6px; display:block;">` : ''}
        <strong style="font-size:1.1em; display:block;">${commName}</strong>
        <div>RFC: ${rfc}</div>
        <div style="font-size:0.9em;">${address}</div>
        <div style="font-size:0.9em;">Tel/WhatsApp: ${phone}</div>
        ${header1 ? `<div style="font-size:0.88em; margin-top:3px;">${header1}</div>` : ''}
      </div>
      <hr style="border:none; border-top:1px dashed #000; margin:8px 0;">
      <div>
        <div><strong>Folio Venta:</strong> VTA-1005</div>
        <div><strong>Fecha:</strong> ${new Date().toLocaleString('es-MX')}</div>
        <div><strong>Cliente:</strong> Mostrador / Público en General</div>
        ${showCashier ? `<div><strong>Cajero:</strong> Lic. Sofía Navarro (TRN-1003)</div>` : ''}
      </div>
      <hr style="border:none; border-top:1px dashed #000; margin:8px 0;">
      <table style="width:100%; border-collapse:collapse; font-size:inherit;">
        <thead>
          <tr style="border-bottom:1px solid #000;">
            <th align="left">Cant. Descripción</th>
            <th align="right">Importe</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="padding:4px 0;">1x ${showSku ? '[POS-IMP-80] ' : ''}Impresora Térmica 80mm</td>
            <td align="right">$1,890.00</td>
          </tr>
          <tr>
            <td style="padding:4px 0;">1x ${showSku ? '[POS-CAJ-01] ' : ''}Cajón de Dinero RJ11</td>
            <td align="right">$1,150.00</td>
          </tr>
        </tbody>
      </table>
      <hr style="border:none; border-top:1px dashed #000; margin:8px 0;">
      <div style="text-align:right;">
        ${showTax ? `<div>Subtotal (Sin IVA): $2,620.69</div><div>IVA (16%): $419.31</div>` : ''}
        <strong style="font-size:1.12em;">TOTAL: $3,040.00 MXN</strong>
        <div>Método de Pago: Efectivo</div>
      </div>
      <hr style="border:none; border-top:1px dashed #000; margin:8px 0;">
      <div style="text-align:center; font-size:0.9em;">
        <div><strong>${footerMsg}</strong></div>
        ${warranty ? `<div style="margin-top:4px; font-size:0.85em; color:#333;">${warranty}</div>` : ''}
      </div>
    `;
  }

  if (digBox) {
    const sampleUrl = `${window.location.origin}/ticket.html?folio=VTA-1005`;
    const qrApi = `https://api.qrserver.com/v1/create-qr-code/?size=95x95&data=${encodeURIComponent(sampleUrl)}`;
    digBox.innerHTML = `
      <div style="text-align:center; border-bottom:1px dashed rgba(148,163,184,0.25); padding-bottom:12px; margin-bottom:12px;">
        <div style="display:inline-flex; align-items:center; gap:5px; padding:3px 10px; border-radius:999px; background:rgba(16,185,129,0.16); color:#10b981; font-size:0.68rem; font-weight:700; margin-bottom:8px;">
          ✓ TICKET DIGITAL VERIFICADO
        </div>
        ${showLogo ? `<img src="${logoSrc}" alt="Logo" style="max-height:44px; margin:0 auto 6px; display:block; border-radius:8px;">` : ''}
        <strong style="font-size:1rem; display:block; color:#fff;">${commName}</strong>
        <div style="font-size:0.74rem; color:#94a3b8;">RFC: ${rfc} · Tel: ${phone}</div>
        <div style="font-size:0.72rem; color:#94a3b8;">${address}</div>
      </div>

      <div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; background:rgba(2,6,23,0.55); padding:10px; border-radius:10px; font-size:0.75rem; margin-bottom:12px;">
        <div><span style="color:#94a3b8; display:block; font-size:0.66rem;">FOLIO</span><strong class="mono" style="color:#38bdf8;">VTA-1005</strong></div>
        <div><span style="color:#94a3b8; display:block; font-size:0.66rem;">MÉTODO</span><strong>Efectivo</strong></div>
        <div><span style="color:#94a3b8; display:block; font-size:0.66rem;">CLIENTE</span><strong>Mostrador</strong></div>
        ${showCashier ? `<div><span style="color:#94a3b8; display:block; font-size:0.66rem;">CAJERO</span><strong>Sofía N.</strong></div>` : ''}
      </div>

      <div style="font-size:0.78rem; margin-bottom:10px;">
        <div style="display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid rgba(148,163,184,0.12);">
          <span>1x ${showSku ? '<small class="mono" style="color:#38bdf8;">[POS-IMP-80]</small> ' : ''}Impresora Térmica 80mm</span>
          <strong class="mono">$1,890.00</strong>
        </div>
        <div style="display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid rgba(148,163,184,0.12);">
          <span>1x ${showSku ? '<small class="mono" style="color:#38bdf8;">[POS-CAJ-01]</small> ' : ''}Cajón de Dinero RJ11</span>
          <strong class="mono">$1,150.00</strong>
        </div>
      </div>

      <div style="background:rgba(56,189,248,0.1); border:1px solid rgba(56,189,248,0.28); border-radius:10px; padding:10px 12px; margin-bottom:12px;">
        ${showTax ? `<div style="display:flex; justify-content:space-between; font-size:0.73rem; color:#94a3b8;"><span>Subtotal + IVA (16%):</span><span class="mono">$2,620.69 + $419.31</span></div>` : ''}
        <div style="display:flex; justify-content:space-between; align-items:center; margin-top:4px;">
          <strong style="font-size:0.82rem;">TOTAL PAGADO</strong>
          <strong class="mono" style="font-size:1.08rem; color:#38bdf8;">$3,040.00 MXN</strong>
        </div>
      </div>

      ${showQr ? `
        <div style="display:flex; align-items:center; gap:10px; background:rgba(2,6,23,0.45); padding:8px 10px; border-radius:10px; margin-bottom:10px;">
          <img src="${qrApi}" alt="QR" style="width:52px; height:52px; border-radius:6px; background:#fff; padding:3px;">
          <div style="font-size:0.7rem; color:#94a3b8;">
            <strong style="color:#e2e8f0; display:block;">Enlace Web Verificado</strong>
            El cliente abre este enlace desde su WhatsApp y puede descargar su PDF.
          </div>
        </div>
      ` : ''}

      <div style="text-align:center; font-size:0.72rem; color:#94a3b8;">
        <strong style="color:#e2e8f0; display:block;">${footerMsg}</strong>
        ${showSupportBtn ? `<div style="margin-top:8px; padding:6px 10px; border-radius:8px; background:#10b981; color:#042f2e; font-weight:700;">💬 Botón de Soporte por WhatsApp Activo</div>` : ''}
      </div>
    `;
  }
}

function renderSettingsPaymentMethodsTable() {
  const tbody = document.getElementById('cfgPaymentMethodsTableBody');
  if (!tbody || !systemSettings) return;
  const pms = Array.isArray(systemSettings.paymentMethods) ? systemSettings.paymentMethods : [];

  tbody.innerHTML = pms.map(pm => `
    <tr data-pmid="${pm.id}">
      <td data-label="Habilitado" style="text-align:center;">
        <input type="checkbox" class="cfg-pm-enabled" ${pm.enabled ? 'checked' : ''}>
      </td>
      <td data-label="Forma de Pago">
        <strong>${pm.label || pm.key}</strong>
      </td>
      <td data-label="Comisión (%)">
        <input type="number" class="cfg-pm-fee mono tabular" value="${pm.feePercent || 0}" min="0" max="20" step="0.1" style="width:80px;">
      </td>
      <td data-label="Pide Referencia" style="text-align:center;">
        <input type="checkbox" class="cfg-pm-ref" ${pm.requiresReference ? 'checked' : ''}>
      </td>
      <td data-label="Cuenta / Instrucción">
        <input type="text" class="cfg-pm-bank" value="${pm.bankInfo || ''}" placeholder="Cuenta CLABE, terminal o nota...">
      </td>
    </tr>
  `).join('');
}

function renderSettingsBackupStats() {
  const grid = document.getElementById('cfgBackupStatsGrid');
  if (!grid) return;

  grid.innerHTML = `
    <div class="cls-item">
      <span>Productos & SKUs</span>
      <strong class="mono tabular">${allProducts.length}</strong>
    </div>
    <div class="cls-item">
      <span>Clientes & Créditos</span>
      <strong class="mono tabular">${allClients.length}</strong>
    </div>
    <div class="cls-item">
      <span>Ventas & Kardex</span>
      <strong class="mono tabular">${allSales.length + allInventoryMovements.length}</strong>
    </div>
    <div class="cls-item">
      <span>Turnos & Cortes</span>
      <strong class="mono tabular">${allShifts.length + allCashCuts.length}</strong>
    </div>
    <div class="cls-item">
      <span>Tickets & Taller</span>
      <strong class="mono tabular">${allTickets.length + allWorkshop.length}</strong>
    </div>
  `;
}

async function downloadFullSystemBackup() {
  try {
    const backupData = await erpService.exportBackup();
    const jsonStr = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fiberlink-erp-respaldo-completo-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Respaldo completo (.JSON) descargado exitosamente');
  } catch (err) {
    showToast('Error al generar respaldo: ' + err.message);
  }
}




