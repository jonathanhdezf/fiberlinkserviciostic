import { ticketService } from './services/ticketService.js';

document.addEventListener('DOMContentLoaded', () => {
  initLogin();
  initDashboard();
  initModal();
});

// ==========================================
// LOGIN LOGIC
// ==========================================
function initLogin() {
  const loginOverlay = document.getElementById('loginOverlay');
  const dashboard = document.getElementById('dashboard');
  const loginForm = document.getElementById('loginForm');
  const loginError = document.getElementById('loginError');
  const logoutBtn = document.getElementById('logoutBtn');

  // Check session
  if (sessionStorage.getItem('fiberlink_admin_logged_in') === 'true') {
    loginOverlay.classList.add('hidden');
    dashboard.classList.remove('hidden');
    loadTickets();
  }

  loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const user = document.getElementById('loginUser').value.trim();
    const pass = document.getElementById('loginPass').value.trim();

    // Default admin credentials
    if ((user === 'admin' && pass === 'admin123') || (user === 'fiberlink' && pass === 'teziutlan2026')) {
      sessionStorage.setItem('fiberlink_admin_logged_in', 'true');
      loginOverlay.classList.add('hidden');
      dashboard.classList.remove('hidden');
      loadTickets();
    } else {
      loginError.textContent = 'Credenciales no válidas. Prueba admin / admin123';
    }
  });

  logoutBtn.addEventListener('click', () => {
    sessionStorage.removeItem('fiberlink_admin_logged_in');
    loginOverlay.classList.remove('hidden');
    dashboard.classList.add('hidden');
    document.getElementById('loginForm').reset();
    loginError.textContent = '';
  });
}

// ==========================================
// DASHBOARD & KANBAN LOGIC
// ==========================================
let currentTicketId = null;

function initDashboard() {
  const refreshBtn = document.getElementById('refreshBtn');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', () => {
      refreshBtn.disabled = true;
      loadTickets().finally(() => {
        refreshBtn.disabled = false;
      });
    });
  }

  // Periodic background sync every 30 seconds
  setInterval(() => {
    if (sessionStorage.getItem('fiberlink_admin_logged_in') === 'true' && !document.getElementById('ticketDetailModal').classList.contains('open')) {
      loadTickets();
    }
  }, 30000);
}

async function loadTickets() {
  try {
    const tickets = await ticketService.getTickets();
    
    // Clear columns
    const states = ['creación', 'diagnostico', 'proceso', 'resuelto'];
    states.forEach(state => {
      const col = document.getElementById(`col-${state}`);
      const countEl = document.getElementById(`count-${state}`);
      if (col) col.innerHTML = '';
      if (countEl) countEl.textContent = '0';
    });

    // Render tickets
    tickets.forEach(ticket => {
      const stateKey = ticket.estado || 'creación';
      const col = document.getElementById(`col-${stateKey}`);
      if (col) {
        col.appendChild(createTicketCard(ticket));
      }
    });

    // Update counts
    states.forEach(state => {
      const col = document.getElementById(`col-${state}`);
      const countEl = document.getElementById(`count-${state}`);
      if (col && countEl) {
        countEl.textContent = col.children.length;
      }
    });
  } catch (err) {
    console.error('[Admin] Error cargando tickets:', err);
  }
}

function createTicketCard(ticket) {
  const div = document.createElement('div');
  div.className = 'ticket-card';
  div.onclick = () => openTicketModal(ticket.id);
  
  const dateStr = ticket.createdAt 
    ? new Date(ticket.createdAt).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) 
    : 'Reciente';

  let prioClass = 'prio-normal';
  if (ticket.priority === 'Alta') prioClass = 'prio-alta';
  if (ticket.priority === 'Urgente') prioClass = 'prio-urgente';

  const companyBadge = ticket.company ? `<span style="opacity:0.8;font-size:0.75rem;"> [${ticket.company}]</span>` : '';

  div.innerHTML = `
    <div class="tc-head">
      <span class="tc-folio">${ticket.folio || 'FL-NEW'}</span>
      <span class="tc-date">${dateStr}</span>
    </div>
    <div class="tc-title">${ticket.name || 'Sin nombre'}${companyBadge}</div>
    <div class="tc-desc">${ticket.description || 'Sin descripción detallada'}</div>
    <div class="tc-foot">
      <span class="tc-priority ${prioClass}">${ticket.priority || 'Normal'}</span>
      <span class="tc-source">${ticket.service || 'Soporte'}</span>
    </div>
  `;
  return div;
}

// ==========================================
// MODAL & TABS LOGIC
// ==========================================
function initModal() {
  const modal = document.getElementById('ticketDetailModal');
  const closeBtns = [
    document.getElementById('ticketDetailCloseBtn'), 
    document.getElementById('ticketDetailCloseBack')
  ];
  
  closeBtns.forEach(btn => {
    if (btn) {
      btn.addEventListener('click', () => {
        modal.classList.remove('open');
        currentTicketId = null;
      });
    }
  });

  // Tabs navigation
  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      const tabId = btn.getAttribute('data-tab');
      const targetPane = document.getElementById(`tab-${tabId}`);
      if (targetPane) targetPane.classList.add('active');
    });
  });

  // Status Change
  const estadoSelect = document.getElementById('tdEstado');
  if (estadoSelect) {
    estadoSelect.addEventListener('change', async (e) => {
      if (!currentTicketId) return;
      const newStatus = e.target.value;
      try {
        await ticketService.updateStatus(currentTicketId, newStatus);
        await loadTickets(); // Refresh Kanban board
      } catch (err) {
        console.error('[Admin] Error actualizando estado:', err);
      }
    });
  }

  // Bitácora Form
  const bitacoraForm = document.getElementById('bitacoraForm');
  if (bitacoraForm) {
    bitacoraForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!currentTicketId) return;
      
      const noteInput = document.getElementById('bitacoraNote');
      const noteText = noteInput?.value.trim();
      if (!noteText) return;
      
      try {
        const updated = await ticketService.addBitacoraEntry(currentTicketId, noteText, 'Técnico (Admin)');
        if (updated && updated.bitacora) {
          renderBitacora(updated.bitacora);
        } else {
          // Re-fetch
          const fresh = await ticketService.getTicketById(currentTicketId);
          renderBitacora(fresh?.bitacora || []);
        }
        bitacoraForm.reset();
      } catch (err) {
        console.error('[Admin] Error agregando bitácora:', err);
      }
    });
  }

  // POS Form
  const posForm = document.getElementById('posForm');
  if (posForm) {
    posForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!currentTicketId) return;

      const concept = document.getElementById('posConcept').value.trim();
      const price = parseFloat(document.getElementById('posPrice').value);
      if (!concept || isNaN(price)) return;
      
      try {
        const ticket = await ticketService.getTicketById(currentTicketId);
        if (ticket) {
          const currentPos = ticket.pos || { items: [], total: 0 };
          const items = Array.isArray(currentPos.items) ? [...currentPos.items] : [];
          
          const newItem = {
            id: Date.now().toString(),
            concept,
            price
          };
          items.push(newItem);
          const total = items.reduce((acc, it) => acc + (parseFloat(it.price) || 0), 0);

          await ticketService.savePos(currentTicketId, items, total);
          renderPOS({ items, total });
          posForm.reset();
        }
      } catch (err) {
        console.error('[Admin] Error en POS:', err);
      }
    });
  }

  // Print POS Receipt
  const posPrintBtn = document.getElementById('posPrintBtn');
  if (posPrintBtn) {
    posPrintBtn.addEventListener('click', () => {
      window.print();
    });
  }
}

async function openTicketModal(ticketId) {
  currentTicketId = ticketId;
  const ticket = await ticketService.getTicketById(ticketId);
  if (!ticket) return;

  // Reset tab to Info
  const firstTab = document.querySelector('.tab-btn[data-tab="info"]');
  if (firstTab) firstTab.click();

  // Populate Info
  const companyInfo = ticket.company ? ` — ${ticket.company}` : '';
  const emailInfo = ticket.email ? ` <span style="font-size:0.8rem;color:var(--text-muted);">(${ticket.email})</span>` : '';

  const tdFolio = document.getElementById('tdFolio');
  const tdName = document.getElementById('tdName');
  const tdPhone = document.getElementById('tdPhone');
  const tdService = document.getElementById('tdService');
  const tdPriority = document.getElementById('tdPriority');
  const tdOnsite = document.getElementById('tdOnsite');
  const tdLocation = document.getElementById('tdLocation');
  const tdDescription = document.getElementById('tdDescription');
  const tdDate = document.getElementById('tdDate');
  const tdEstado = document.getElementById('tdEstado');

  if (tdFolio) tdFolio.textContent = ticket.folio || 'FL-0000';
  if (tdName) tdName.innerHTML = `${ticket.name || 'Sin nombre'}${companyInfo}${emailInfo}`;
  if (tdPhone) tdPhone.textContent = ticket.phone || '-';
  if (tdService) tdService.textContent = ticket.service || '-';
  if (tdPriority) tdPriority.textContent = ticket.priority || 'Normal';
  if (tdOnsite) tdOnsite.textContent = ticket.modality || ticket.onsite || 'En Sitio / Domicilio';
  if (tdLocation) tdLocation.textContent = ticket.address || ticket.location || 'Teziutlán, Pue.';
  if (tdDescription) tdDescription.textContent = ticket.description || 'Sin notas.';
  
  if (tdDate) {
    const d = ticket.createdAt ? new Date(ticket.createdAt) : new Date();
    tdDate.textContent = d.toLocaleString('es-MX');
  }

  if (tdEstado) {
    tdEstado.value = ticket.estado || 'creación';
  }

  // Populate Bitacora
  renderBitacora(ticket.bitacora || []);

  // Populate POS
  renderPOS(ticket.pos || { items: [], total: 0 });

  // Show modal
  const modal = document.getElementById('ticketDetailModal');
  if (modal) modal.classList.add('open');
}

function renderBitacora(notes) {
  const container = document.getElementById('bitacoraList');
  if (!container) return;
  container.innerHTML = '';
  
  if (!Array.isArray(notes) || notes.length === 0) {
    container.innerHTML = '<p style="color:var(--text-muted);font-size:0.9rem;">No hay notas registradas.</p>';
    return;
  }

  notes.slice().reverse().forEach(note => {
    const d = note.date ? new Date(note.date) : new Date();
    const div = document.createElement('div');
    div.className = 'b-note';
    div.innerHTML = `
      <div class="b-note-head">
        <span>${note.author || 'Técnico (Admin)'}</span>
        <span>${d.toLocaleString('es-MX')}</span>
      </div>
      <div class="b-note-body">${note.text || note.note || ''}</div>
    `;
    container.appendChild(div);
  });
}

function renderPOS(posData) {
  const list = document.getElementById('posList');
  const totalEl = document.getElementById('posTotal');
  if (!list || !totalEl) return;
  
  list.innerHTML = '';
  const items = Array.isArray(posData.items) ? posData.items : [];

  if (items.length === 0) {
    list.innerHTML = '<tr><td colspan="3" style="text-align:center; color:var(--text-muted); padding:12px;">No hay conceptos agregados</td></tr>';
    totalEl.textContent = '$0.00';
    return;
  }

  items.forEach(item => {
    const tr = document.createElement('tr');
    const priceNum = parseFloat(item.price) || 0;
    tr.innerHTML = `
      <td>${item.concept}</td>
      <td style="text-align: right; font-family: var(--font-mono);">$${priceNum.toFixed(2)}</td>
      <td style="text-align: right;">
        <button class="del-item-btn" data-id="${item.id}" aria-label="Eliminar concepto">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
      </td>
    `;
    list.appendChild(tr);
  });

  const totalNum = parseFloat(posData.total) || items.reduce((a, b) => a + (parseFloat(b.price) || 0), 0);
  totalEl.textContent = `$${totalNum.toFixed(2)}`;

  // Delete item logic
  list.querySelectorAll('.del-item-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const idToRemove = e.currentTarget.getAttribute('data-id');
      await removePOSItem(idToRemove);
    });
  });
}

async function removePOSItem(itemId) {
  if (!currentTicketId) return;
  try {
    const ticket = await ticketService.getTicketById(currentTicketId);
    if (ticket && ticket.pos && Array.isArray(ticket.pos.items)) {
      const items = ticket.pos.items.filter(i => i.id !== itemId);
      const total = items.reduce((acc, it) => acc + (parseFloat(it.price) || 0), 0);
      await ticketService.savePos(currentTicketId, items, total);
      renderPOS({ items, total });
    }
  } catch (err) {
    console.error('[Admin] Error al remover ítem de POS:', err);
  }
}
