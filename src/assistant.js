// ==========================================
// FIBI — ASISTENTE TÉCNICO VIRTUAL IA (GEMINI)
// Captura la solicitud de servicio desde el chat o desde el botón
// "Levantar ticket", emite notificación push en el navegador y cierra
// con un botón de WhatsApp para el cliente.
// ==========================================
import './assistant.css';
import { ticketService } from './services/ticketService.js';

const WA_PHONE = '522311024672';
const STORAGE_KEY = 'fiberlink_assistant_session_v1';
const BROADCAST = 'fiberlink-tickets';

const SERVICES = ['Soporte técnico', 'Redes / WiFi', 'Videovigilancia CCTV', 'Punto de Venta POS', 'Presencia Web / Nube', 'Otro servicio TIC'];
const MODALITIES = ['Remoto', 'En Sitio / Domicilio', 'En Taller'];
const PRIORITIES = ['Normal', 'Alta', 'Urgente'];

const FIELD_LABELS = {
  description: 'Problema',
  service: 'Servicio',
  modality: 'Modalidad',
  name: 'Nombre',
  phone: 'WhatsApp'
};

const ICONS = {
  spark: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2c.4 3.9 1.6 6.4 3.4 8.1 1.8 1.7 4.2 2.6 6.6 2.9-2.4.3-4.8 1.2-6.6 2.9C13.6 17.6 12.4 20.1 12 24c-.4-3.9-1.6-6.4-3.4-8.1C6.8 14.2 4.4 13.3 2 13c2.4-.3 4.8-1.2 6.6-2.9C10.4 8.4 11.6 5.9 12 2z"/></svg>',
  send: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4 20-7z"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  ticket: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v3a2 2 0 0 0 0 4v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-3a2 2 0 0 0 0-4z"/><path d="M13 5v2M13 17v2M13 11v2"/></svg>',
  reset: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/></svg>',
  wa: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M.057 24l1.687-6.163A11.867 11.867 0 0 1 .157 11.89C.16 5.335 5.495 0 12.05 0a11.82 11.82 0 0 1 8.413 3.488 11.82 11.82 0 0 1 3.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 0 1-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981z"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>',
  bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>',
  expand: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>',
  compress: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 14h6v6M20 10h-6V4M14 10l7-7M10 14l-7 7"/></svg>',
  minimize: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="13" height="13" x="9" y="9" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>'
};

// ------------------------------------------
// Estado
// ------------------------------------------
const state = {
  open: false,
  busy: false,
  expanded: localStorage.getItem('fiberlink_assistant_expanded') === 'true',
  messages: [],      // { role: 'user' | 'model', text }
  draft: {},
  diagnosis: '',
  action: 'collect',
  quickReplies: [],
  ticket: null,      // ticket creado
  engine: ''
};

function loadSession() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null');
    if (saved && typeof saved === 'object') {
      const exp = state.expanded;
      Object.assign(state, saved, { open: false, busy: false, expanded: exp });
    }
  } catch (_) { /* sesión corrupta: ignorar */ }
}

function saveSession() {
  try {
    const { open, busy, expanded, ...persist } = state;
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(persist));
  } catch (_) { /* almacenamiento lleno */ }
}

function escapeHtml(str = '') {
  return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function formatText(str = '') {
  return escapeHtml(str).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
}

function getMissing(d = state.draft) {
  const m = [];
  if (!d.description) m.push('description');
  if (!d.service) m.push('service');
  if (!d.modality) m.push('modality');
  if (!d.name) m.push('name');
  if (!d.phone || String(d.phone).replace(/\D/g, '').length !== 10) m.push('phone');
  if (d.modality === 'En Sitio / Domicilio' && !d.address) m.push('address');
  return m;
}

// ------------------------------------------
// DOM
// ------------------------------------------
let els = {};

function buildDom() {
  const launcher = document.createElement('button');
  launcher.type = 'button';
  launcher.className = 'fa-launcher';
  launcher.id = 'faLauncher';
  launcher.setAttribute('aria-label', 'Abrir asistente técnico virtual con IA');
  launcher.innerHTML = `
    <span class="fa-launcher-ring" aria-hidden="true"></span>
    <span class="fa-launcher-core">${ICONS.spark}</span>
    <span class="fa-launcher-badge" aria-hidden="true">IA</span>
    <span class="fa-launcher-tip">
      <span class="fa-launcher-tip-badge">SOPORTE EN VIVO</span>
      ¿Problemas con tu equipo o red? <strong>Te ayudo a levantar tu ticket</strong>
    </span>
  `;

  const panel = document.createElement('section');
  panel.className = `fa-panel${state.expanded ? ' expanded' : ''}`;
  panel.id = 'faPanel';
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-modal', 'false');
  panel.setAttribute('aria-labelledby', 'faTitle');
  panel.setAttribute('aria-hidden', 'true');
  panel.innerHTML = `
    <header class="fa-head">
      <div class="fa-avatar" aria-hidden="true">${ICONS.spark}<span class="fa-online" title="Sistema en línea"></span></div>
      <div class="fa-head-txt">
        <div class="fa-head-title-row">
          <h3 id="faTitle">Fibi</h3>
          <span class="fa-chip-ai">Asistente IA</span>
          <span class="fa-badge-sla">SLA &lt; 15 min</span>
        </div>
        <p><span class="fa-dot"></span><span id="faStatus">En línea · Diagnóstico asistido por Gemini</span></p>
      </div>
      <div class="fa-head-actions">
        <button type="button" class="fa-icon-btn fa-desktop-only" id="faExpand" title="Cambiar tamaño / Expandir" aria-label="Expandir asistente">${state.expanded ? ICONS.compress : ICONS.expand}</button>
        <button type="button" class="fa-icon-btn" id="faReset" title="Nueva conversación" aria-label="Reiniciar conversación">${ICONS.reset}</button>
        <button type="button" class="fa-icon-btn" id="faMinimize" title="Minimizar" aria-label="Minimizar asistente">${ICONS.minimize}</button>
        <button type="button" class="fa-icon-btn fa-mobile-close" id="faClose" title="Cerrar" aria-label="Cerrar asistente">${ICONS.close}</button>
      </div>
    </header>

    <div class="fa-progress" id="faProgress" aria-label="Datos capturados para tu ticket"></div>

    <div class="fa-body" id="faBody" aria-live="polite"></div>

    <div class="fa-quick" id="faQuick"></div>

    <footer class="fa-foot">
      <div class="fa-foot-bar">
        <button type="button" class="fa-ticket-btn" id="faTicketBtn" title="Levantar ticket con formulario rápido">
          ${ICONS.ticket}<span>Levantar ticket directo</span>
        </button>
        <div class="fa-shortcuts fa-desktop-only">
          <span class="fa-kbd"><kbd>Enter</kbd> Enviar</span>
          <span class="fa-kbd"><kbd>Shift</kbd>+<kbd>Enter</kbd> Salto</span>
          <span class="fa-kbd"><kbd>Esc</kbd> Minimizar</span>
        </div>
      </div>
      <form class="fa-input" id="faForm" autocomplete="off">
        <textarea id="faInput" rows="1" maxlength="600" placeholder="Escribe tu mensaje o falla técnica…" aria-label="Mensaje para el asistente"></textarea>
        <button type="submit" class="fa-send" id="faSend" aria-label="Enviar mensaje" title="Enviar (Enter)">${ICONS.send}</button>
      </form>
      <div class="fa-legal-row">
        <span class="fa-legal-shield">${ICONS.shield} Atención oficial Fiberlink Teziutlán</span>
        <span class="fa-legal-sep">·</span>
        <span class="fa-legal-meta">Delegación técnica en tiempo real</span>
      </div>
    </footer>
  `;

  document.body.append(launcher, panel);

  els = {
    launcher, panel,
    body: panel.querySelector('#faBody'),
    quick: panel.querySelector('#faQuick'),
    progress: panel.querySelector('#faProgress'),
    form: panel.querySelector('#faForm'),
    input: panel.querySelector('#faInput'),
    send: panel.querySelector('#faSend'),
    status: panel.querySelector('#faStatus'),
    ticketBtn: panel.querySelector('#faTicketBtn'),
    expandBtn: panel.querySelector('#faExpand')
  };
}

// ------------------------------------------
// Render
// ------------------------------------------
function renderProgress() {
  const d = state.draft;
  const chips = Object.entries(FIELD_LABELS).map(([key, label]) => {
    const done = key === 'phone' ? String(d.phone || '').length === 10 : !!d[key];
    return `<span class="fa-step ${done ? 'done' : ''}">${done ? ICONS.check : ''}${label}</span>`;
  }).join('');
  const total = Object.keys(FIELD_LABELS).length;
  const doneCount = Object.keys(FIELD_LABELS).filter(k => (k === 'phone' ? String(d.phone || '').length === 10 : !!d[k])).length;
  els.progress.innerHTML = `
    <div class="fa-progress-bar"><span style="width:${state.ticket ? 100 : Math.round((doneCount / total) * 100)}%"></span></div>
    <div class="fa-steps">${chips}</div>
  `;
}

function messageHtml(m) {
  if (m.role === 'card') return m.html;
  const who = m.role === 'user' ? 'user' : 'bot';
  return `
    <div class="fa-msg fa-${who}">
      ${who === 'bot' ? `<span class="fa-msg-avatar" aria-hidden="true">${ICONS.spark}</span>` : ''}
      <div class="fa-bubble">${formatText(m.text)}</div>
    </div>`;
}

function diagnosisHtml() {
  if (!state.diagnosis || state.ticket) return '';
  return `
    <div class="fa-diag">
      <span class="fa-diag-lbl">${ICONS.spark} Pre-diagnóstico IA</span>
      <p>${escapeHtml(state.diagnosis)}</p>
      <small>Un técnico confirmará la causa real y aplicará la solución.</small>
    </div>`;
}

function summaryHtml() {
  const d = state.draft;
  const rows = [
    ['Problema', d.description],
    ['Servicio', d.service],
    ['Modalidad', d.modality],
    ['Prioridad', d.priority || 'Normal'],
    ['Nombre', d.name],
    ['WhatsApp', d.phone],
    d.modality === 'En Sitio / Domicilio' ? ['Dirección', d.address] : null
  ].filter(Boolean);
  return `
    <div class="fa-card fa-summary">
      <div class="fa-card-head">${ICONS.ticket}<span>Resumen de tu solicitud</span>
        <em class="fa-prio fa-prio-${(d.priority || 'Normal').toLowerCase()}">${escapeHtml(d.priority || 'Normal')}</em></div>
      <dl>${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${escapeHtml(v || '—')}</dd></div>`).join('')}</dl>
      <div class="fa-card-actions">
        <button type="button" class="fa-btn-primary" data-fa="confirm">${ICONS.check}<span>Confirmar y levantar ticket</span></button>
        <button type="button" class="fa-btn-ghost" data-fa="edit">Corregir datos</button>
      </div>
    </div>`;
}

function successHtml(t) {
  return `
    <div class="fa-card fa-success">
      <div class="fa-success-burst" aria-hidden="true">${ICONS.check}</div>
      <h4>¡Ticket levantado con éxito!</h4>
      <div class="fa-folio-box">
        <span class="fa-folio-tag">FOLIO OFICIAL</span>
        <p class="fa-folio">${escapeHtml(t.folio)}</p>
        <button type="button" class="fa-folio-copy-btn" data-fa="copy-folio" title="Copiar folio al portapapeles">
          ${ICONS.copy}<span>Copiar</span>
        </button>
      </div>
      <p class="fa-success-txt">Tu solicitud ya ingresó a la mesa técnica. Un especialista te contactará de inmediato por WhatsApp al <strong>${escapeHtml(t.phone)}</strong>.</p>
      <ul class="fa-success-meta">
        <li><span>Servicio</span>${escapeHtml(t.service)}</li>
        <li><span>Modalidad</span>${escapeHtml(t.modality)}</li>
        <li><span>Prioridad</span><strong class="fa-prio-tag-${(t.priority || 'Normal').toLowerCase()}">${escapeHtml(t.priority)}</strong></li>
      </ul>
      <button type="button" class="fa-btn-wa" data-fa="whatsapp">${ICONS.wa}<span>Finalizar y enviar por WhatsApp</span></button>
      <button type="button" class="fa-btn-ghost fa-btn-sm" data-fa="new">Levantar otro ticket</button>
    </div>`;
}

function quickFormHtml() {
  const d = state.draft;
  const opt = (list, val) => list.map(v => `<option ${v === val ? 'selected' : ''}>${v}</option>`).join('');
  return `
    <form class="fa-card fa-qform" id="faQuickForm" novalidate>
      <div class="fa-card-head">${ICONS.ticket}<span>Levantar ticket rápido</span></div>
      <label>¿Qué está pasando?<textarea name="description" rows="2" required placeholder="Ej. La caja no imprime tickets">${escapeHtml(d.description || '')}</textarea></label>
      <div class="fa-qrow">
        <label>Servicio<select name="service">${opt(SERVICES, d.service || SERVICES[0])}</select></label>
        <label>Modalidad<select name="modality">${opt(MODALITIES, d.modality || MODALITIES[0])}</select></label>
      </div>
      <div class="fa-qrow">
        <label>Nombre<input name="name" required value="${escapeHtml(d.name || '')}" placeholder="Tu nombre"></label>
        <label>WhatsApp<input name="phone" required inputmode="numeric" maxlength="10" value="${escapeHtml(d.phone || '')}" placeholder="10 dígitos"></label>
      </div>
      <label class="fa-qaddr">Dirección (si es visita)<input name="address" value="${escapeHtml(d.address || '')}" placeholder="Calle, colonia, ciudad"></label>
      <label>Prioridad<select name="priority">${opt(PRIORITIES, d.priority || 'Normal')}</select></label>
      <p class="fa-qerr" id="faQErr" role="alert"></p>
      <div class="fa-card-actions">
        <button type="submit" class="fa-btn-primary">${ICONS.check}<span>Levantar ticket</span></button>
        <button type="button" class="fa-btn-ghost" data-fa="cancel-form">Seguir en el chat</button>
      </div>
    </form>`;
}

function render({ scroll = true } = {}) {
  renderProgress();
  let html = state.messages.map(messageHtml).join('');
  html += diagnosisHtml();
  if (state.ticket) html += successHtml(state.ticket);
  else if (state.action === 'confirm' && !getMissing().length) html += summaryHtml();
  if (state.showQuickForm && !state.ticket) html += quickFormHtml();
  if (state.busy) {
    html += `<div class="fa-msg fa-bot"><span class="fa-msg-avatar" aria-hidden="true">${ICONS.spark}</span><div class="fa-bubble fa-typing"><i></i><i></i><i></i></div></div>`;
  }
  els.body.innerHTML = html;

  const replies = state.ticket || state.showQuickForm ? [] : state.quickReplies;
  els.quick.innerHTML = (replies || []).map(r => `<button type="button" class="fa-qr" data-reply="${escapeHtml(r)}">${escapeHtml(r)}</button>`).join('');

  els.input.disabled = state.busy || !!state.ticket;
  els.send.disabled = state.busy || !!state.ticket;
  els.ticketBtn.style.display = state.ticket ? 'none' : '';
  els.input.placeholder = state.ticket ? 'Ticket enviado ✔' : (getMissing()[0] === 'phone' ? 'Tu WhatsApp a 10 dígitos…' : 'Escribe tu mensaje…');

  if (scroll) requestAnimationFrame(() => { els.body.scrollTop = els.body.scrollHeight; });
  bindFormEvents();
}

// ------------------------------------------
// Conversación con Gemini
// ------------------------------------------
async function askAssistant() {
  state.busy = true;
  render();
  try {
    const res = await fetch('/api/assistant/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: state.messages.filter(m => m.role !== 'card'), draft: state.draft })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    state.draft = data.draft || state.draft;
    state.diagnosis = data.diagnosis || state.diagnosis;
    state.action = data.action || 'collect';
    state.quickReplies = data.quickReplies || [];
    state.engine = data.engine || '';
    state.messages.push({ role: 'model', text: data.reply || 'Cuéntame un poco más, por favor.' });
    els.status.textContent = state.engine === 'gemini' ? 'En línea · Impulsado por Gemini' : 'En línea · Asistente técnico';
  } catch (err) {
    console.warn('[Asistente IA] Sin conexión con el servidor:', err.message);
    state.messages.push({ role: 'model', text: 'Tuve un problema de conexión 😕. Puedes usar el botón **Levantar ticket** o escribirnos por WhatsApp y un técnico te atiende de inmediato.' });
    state.quickReplies = [];
  } finally {
    state.busy = false;
    saveSession();
    render();
  }

  if (state.action === 'submit' && !getMissing().length && !state.ticket) {
    await submitTicket();
  }
}

async function sendUserMessage(text) {
  const clean = String(text || '').trim();
  if (!clean || state.busy || state.ticket) return;
  primeNotificationPermission();
  state.messages.push({ role: 'user', text: clean });
  state.quickReplies = [];
  state.showQuickForm = false;
  saveSession();
  await askAssistant();
}

// ------------------------------------------
// Envío del ticket + notificación push
// ------------------------------------------
function primeNotificationPermission() {
  // Se solicita dentro de un gesto del usuario (clic / envío) como exigen los navegadores
  if ('Notification' in window && Notification.permission === 'default') {
    try { Notification.requestPermission(); } catch (_) { /* Safari antiguo */ }
  }
}

async function showPush(title, options) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return false;
  const opts = {
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-maskable-192.png',
    vibrate: [120, 60, 120],
    ...options
  };
  try {
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null;
    if (reg && reg.showNotification) {
      await reg.showNotification(title, opts);
      return true;
    }
    new Notification(title, opts);
    return true;
  } catch (err) {
    console.warn('[Asistente IA] No se pudo mostrar la notificación:', err.message);
    return false;
  }
}

async function submitTicket() {
  if (state.busy || state.ticket) return;
  const d = state.draft;
  const missing = getMissing(d);
  if (missing.length) {
    state.messages.push({ role: 'model', text: `Me falta un dato: **${FIELD_LABELS[missing[0]] || 'Dirección'}**. ¿Me lo compartes?` });
    render();
    return;
  }

  state.busy = true;
  els.status.textContent = 'Levantando tu ticket…';
  render();

  const description = [
    d.description,
    state.diagnosis ? `\n[Pre-diagnóstico IA]: ${state.diagnosis}` : '',
    '\n[Canal]: Asistente técnico virtual Fibi (IA Gemini)'
  ].join('');

  try {
    const ticket = await ticketService.createTicket({
      name: d.name,
      phone: d.phone,
      service: d.service,
      modality: d.modality,
      priority: d.priority || 'Normal',
      address: d.modality === 'En Sitio / Domicilio' ? d.address : (d.modality === 'Remoto' ? 'Soporte Remoto' : 'Recepción en Taller'),
      description,
      source: 'Asistente IA'
    });
    state.ticket = {
      folio: ticket?.folio || 'FL-PENDIENTE',
      id: ticket?.id,
      name: d.name,
      phone: d.phone,
      service: d.service,
      modality: d.modality,
      priority: d.priority || 'Normal',
      address: d.address || '',
      description: d.description,
      diagnosis: state.diagnosis
    };
    state.messages.push({ role: 'model', text: `¡Listo, ${String(d.name).split(' ')[0]}! Tu ticket **${state.ticket.folio}** quedó registrado y el equipo técnico ya fue notificado. Toca el botón verde para enviarnos el resumen por WhatsApp y agilizar tu atención. 💚` });

    // Notificación push al navegador del cliente (confirmación)
    showPush(`Ticket ${state.ticket.folio} registrado ✔`, {
      body: `${state.ticket.service} · ${state.ticket.modality} · Prioridad ${state.ticket.priority}. Un técnico te contactará por WhatsApp.`,
      tag: `fl-ticket-${state.ticket.folio}`,
      data: { url: '/' }
    });

    // Aviso inmediato a la mesa de control abierta en este navegador (panel admin)
    try {
      const bc = new BroadcastChannel(BROADCAST);
      bc.postMessage({ type: 'new-ticket', ticket: { ...ticket, folio: state.ticket.folio } });
      bc.close();
    } catch (_) { /* BroadcastChannel no soportado */ }
  } catch (err) {
    console.error('[Asistente IA] Error al crear ticket:', err);
    state.messages.push({ role: 'model', text: 'No pude registrar el ticket en este momento. Puedes enviarnos tu solicitud por WhatsApp y la capturamos por ti.' });
  } finally {
    state.busy = false;
    state.showQuickForm = false;
    els.status.textContent = state.engine === 'gemini' ? 'En línea · Impulsado por Gemini' : 'En línea · Asistente técnico';
    saveSession();
    render();
  }
}

function buildWhatsAppUrl() {
  const t = state.ticket || {};
  const lines = [
    `Hola Fiberlink 👋 Acabo de levantar el ticket *${t.folio}* con el asistente virtual.`,
    '',
    `👤 *Nombre:* ${t.name}`,
    `📱 *WhatsApp:* ${t.phone}`,
    `🛠️ *Servicio:* ${t.service}`,
    `📍 *Modalidad:* ${t.modality}${t.address && t.modality === 'En Sitio / Domicilio' ? ` — ${t.address}` : ''}`,
    `⚡ *Prioridad:* ${t.priority}`,
    `📝 *Problema:* ${t.description}`
  ];
  if (t.diagnosis) lines.push(`🤖 *Pre-diagnóstico IA:* ${t.diagnosis}`);
  lines.push('', 'Quedo atento(a) a su contacto. ¡Gracias!');
  return `https://wa.me/${WA_PHONE}?text=${encodeURIComponent(lines.join('\n'))}`;
}

// ------------------------------------------
// Eventos
// ------------------------------------------
function resetConversation() {
  Object.assign(state, { messages: [], draft: {}, diagnosis: '', action: 'collect', quickReplies: [], ticket: null, showQuickForm: false });
  sessionStorage.removeItem(STORAGE_KEY);
  greet();
}

function greet() {
  state.messages.push({ role: 'model', text: '¡Hola! Soy **Fibi**, tu asistente técnico virtual de Fiberlink. 👋\nCuéntame qué está fallando y en un par de minutos levanto tu ticket para que un técnico te atienda.' });
  state.quickReplies = ['Mi computadora está lenta', 'No puedo cobrar en caja', 'Se cae el internet'];
  saveSession();
  render();
}

function openPanel() {
  if (state.open) return;
  state.open = true;
  els.panel.classList.add('open');
  els.panel.setAttribute('aria-hidden', 'false');
  els.launcher.classList.add('hidden');
  document.documentElement.classList.add('fa-open');
  if (!state.messages.length) greet(); else render();
  setTimeout(() => { if (!state.ticket) els.input.focus({ preventScroll: true }); }, 280);
}

function closePanel() {
  state.open = false;
  els.panel.classList.remove('open');
  els.panel.setAttribute('aria-hidden', 'true');
  els.launcher.classList.remove('hidden');
  document.documentElement.classList.remove('fa-open');
}

function bindFormEvents() {
  const qf = document.getElementById('faQuickForm');
  if (!qf || qf.dataset.bound) return;
  qf.dataset.bound = '1';
  const phoneInput = qf.querySelector('[name="phone"]');
  phoneInput?.addEventListener('input', e => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10); });
  qf.querySelector('[name="description"]')?.focus({ preventScroll: true });

  qf.addEventListener('submit', async e => {
    e.preventDefault();
    primeNotificationPermission();
    const fd = new FormData(qf);
    const draft = Object.fromEntries([...fd.entries()].map(([k, v]) => [k, String(v).trim()]));
    const err = qf.querySelector('#faQErr');
    if (!draft.description || draft.description.length < 4) return (err.textContent = 'Describe brevemente el problema.');
    if (!draft.name || draft.name.length < 2) return (err.textContent = 'Indica tu nombre.');
    if (draft.phone.length !== 10) return (err.textContent = 'El WhatsApp debe tener 10 dígitos.');
    if (draft.modality === 'En Sitio / Domicilio' && draft.address.length < 5) return (err.textContent = 'Para visitas necesitamos la dirección.');
    state.draft = { ...state.draft, ...draft };
    state.messages.push({ role: 'user', text: `Levantar ticket: ${draft.description}` });
    await submitTicket();
  });
}

function bindEvents() {
  els.launcher.addEventListener('click', openPanel);
  els.panel.querySelector('#faClose').addEventListener('click', closePanel);
  els.panel.querySelector('#faReset').addEventListener('click', resetConversation);

  els.form.addEventListener('submit', e => {
    e.preventDefault();
    const text = els.input.value;
    els.input.value = '';
    els.input.style.height = '';
    sendUserMessage(text);
  });

  els.input.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      els.form.requestSubmit();
    }
  });
  els.input.addEventListener('input', () => {
    els.input.style.height = 'auto';
    els.input.style.height = Math.min(els.input.scrollHeight, 110) + 'px';
  });

  els.ticketBtn.addEventListener('click', () => {
    primeNotificationPermission();
    state.showQuickForm = !state.showQuickForm;
    render();
  });

  els.quick.addEventListener('click', e => {
    const btn = e.target.closest('[data-reply]');
    if (btn) sendUserMessage(btn.dataset.reply);
  });

  els.panel.querySelector('#faMinimize')?.addEventListener('click', closePanel);

  els.panel.querySelector('#faExpand')?.addEventListener('click', () => {
    state.expanded = !state.expanded;
    els.panel.classList.toggle('expanded', state.expanded);
    localStorage.setItem('fiberlink_assistant_expanded', state.expanded ? 'true' : 'false');
    const expBtn = els.panel.querySelector('#faExpand');
    if (expBtn) {
      expBtn.innerHTML = state.expanded ? ICONS.compress : ICONS.expand;
      expBtn.title = state.expanded ? 'Restaurar tamaño' : 'Expandir ventana';
    }
  });

  els.body.addEventListener('click', e => {
    const btn = e.target.closest('[data-fa]');
    if (!btn) return;
    const act = btn.dataset.fa;
    if (act === 'confirm') { primeNotificationPermission(); submitTicket(); }
    if (act === 'edit') { state.action = 'collect'; state.showQuickForm = true; render(); }
    if (act === 'cancel-form') { state.showQuickForm = false; render(); }
    if (act === 'whatsapp') window.open(buildWhatsAppUrl(), '_blank', 'noopener,noreferrer');
    if (act === 'new') resetConversation();
    if (act === 'copy-folio') {
      const folio = state.ticket?.folio || '';
      if (folio && navigator.clipboard) {
        navigator.clipboard.writeText(folio).then(() => {
          btn.classList.add('copied');
          btn.innerHTML = `${ICONS.check}<span>¡Copiado!</span>`;
          setTimeout(() => {
            btn.classList.remove('copied');
            btn.innerHTML = `${ICONS.copy}<span>Copiar</span>`;
          }, 2000);
        }).catch(() => {});
      }
    }
  });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && state.open) closePanel();
  });

  // Cualquier elemento con [data-open-assistant] abre el asistente
  document.addEventListener('click', e => {
    const trigger = e.target.closest('[data-open-assistant]');
    if (!trigger) return;
    e.preventDefault();
    openPanel();
    const preset = trigger.getAttribute('data-assistant-message');
    if (preset) sendUserMessage(preset);
  });
}

export function initAssistant() {
  if (document.getElementById('faLauncher') || location.pathname.includes('admin')) return;
  loadSession();
  buildDom();
  bindEvents();
  renderProgress();

  // Invitación sutil tras unos segundos (una vez por sesión)
  if (!sessionStorage.getItem('fiberlink_assistant_tip')) {
    setTimeout(() => {
      if (!state.open) {
        els.launcher.classList.add('tip-visible');
        sessionStorage.setItem('fiberlink_assistant_tip', '1');
        setTimeout(() => els.launcher.classList.remove('tip-visible'), 6500);
      }
    }, 4500);
  }

  window.FiberlinkAssistant = { open: openPanel, close: closePanel, reset: resetConversation, send: sendUserMessage };
}
