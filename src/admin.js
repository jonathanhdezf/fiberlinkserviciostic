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
    const user = document.getElementById('loginUser').value;
    const pass = document.getElementById('loginPass').value;

    // Simple mock auth for demo
    if (user === 'admin' && pass === 'admin123') { // Example credentials
      sessionStorage.setItem('fiberlink_admin_logged_in', 'true');
      loginOverlay.classList.add('hidden');
      dashboard.classList.remove('hidden');
      loadTickets();
    } else {
      loginError.textContent = 'Credenciales incorrectas';
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

function getTickets() {
  return JSON.parse(localStorage.getItem('fiberlink_tickets') || '[]');
}

function saveTickets(tickets) {
  localStorage.setItem('fiberlink_tickets', JSON.stringify(tickets));
}

function initDashboard() {
  const refreshBtn = document.getElementById('refreshBtn');
  refreshBtn.addEventListener('click', loadTickets);
}

function loadTickets() {
  const tickets = getTickets();
  
  // Clear columns
  const states = ['creación', 'diagnostico', 'proceso', 'resuelto'];
  states.forEach(state => {
    document.getElementById(`col-${state}`).innerHTML = '';
    document.getElementById(`count-${state}`).textContent = '0';
  });

  // Render tickets
  tickets.forEach(ticket => {
    const col = document.getElementById(`col-${ticket.estado}`);
    if (col) {
      col.appendChild(createTicketCard(ticket));
    }
  });

  // Update counts
  states.forEach(state => {
    const count = document.getElementById(`col-${state}`).children.length;
    document.getElementById(`count-${state}`).textContent = count;
  });
}

function createTicketCard(ticket) {
  const div = document.createElement('div');
  div.className = 'ticket-card';
  div.onclick = () => openTicketModal(ticket.id);
  
  const dateStr = new Date(ticket.createdAt).toLocaleDateString('es-MX', { day: '2-digit', month: 'short' });
  let prioClass = 'prio-normal';
  if(ticket.priority === 'Alta') prioClass = 'prio-alta';
  if(ticket.priority === 'Urgente') prioClass = 'prio-urgente';

  div.innerHTML = `
    <div class="tc-head">
      <span class="tc-folio">${ticket.folio}</span>
      <span class="tc-date">${dateStr}</span>
    </div>
    <div class="tc-title">${ticket.name}</div>
    <div class="tc-desc">${ticket.description}</div>
    <div class="tc-foot">
      <span class="tc-priority ${prioClass}">${ticket.priority}</span>
      <span class="tc-source">${ticket.service}</span>
    </div>
  `;
  return div;
}

// ==========================================
// MODAL & TABS LOGIC
// ==========================================
function initModal() {
  const modal = document.getElementById('ticketDetailModal');
  const closeBtns = [document.getElementById('ticketDetailCloseBtn'), document.getElementById('ticketDetailCloseBack')];
  
  closeBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      modal.classList.remove('open');
      currentTicketId = null;
    });
  });

  // Tabs
  const tabBtns = document.querySelectorAll('.tab-btn');
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      // remove active from all
      tabBtns.forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      // add active to clicked
      btn.classList.add('active');
      const tabId = btn.getAttribute('data-tab');
      document.getElementById(`tab-${tabId}`).classList.add('active');
    });
  });

  // Status change
  document.getElementById('tdEstado').addEventListener('change', (e) => {
    if(!currentTicketId) return;
    const tickets = getTickets();
    const tIndex = tickets.findIndex(t => t.id === currentTicketId);
    if(tIndex > -1) {
      tickets[tIndex].estado = e.target.value;
      saveTickets(tickets);
      loadTickets(); // Refresh background board
    }
  });

  // Bitacora form
  document.getElementById('bitacoraForm').addEventListener('submit', (e) => {
    e.preventDefault();
    if(!currentTicketId) return;
    
    const noteText = document.getElementById('bitacoraNote').value;
    const tickets = getTickets();
    const tIndex = tickets.findIndex(t => t.id === currentTicketId);
    
    if(tIndex > -1) {
      const newNote = {
        id: Date.now().toString(),
        text: noteText,
        date: new Date().toISOString()
      };
      tickets[tIndex].bitacora = tickets[tIndex].bitacora || [];
      tickets[tIndex].bitacora.push(newNote);
      saveTickets(tickets);
      
      renderBitacora(tickets[tIndex].bitacora);
      document.getElementById('bitacoraForm').reset();
    }
  });

  // POS Form
  document.getElementById('posForm').addEventListener('submit', (e) => {
    e.preventDefault();
    if(!currentTicketId) return;

    const concept = document.getElementById('posConcept').value;
    const price = parseFloat(document.getElementById('posPrice').value);
    
    const tickets = getTickets();
    const tIndex = tickets.findIndex(t => t.id === currentTicketId);
    
    if(tIndex > -1) {
      const newItem = {
        id: Date.now().toString(),
        concept,
        price
      };
      
      tickets[tIndex].pos = tickets[tIndex].pos || { items: [], total: 0 };
      tickets[tIndex].pos.items.push(newItem);
      tickets[tIndex].pos.total += price;
      
      saveTickets(tickets);
      renderPOS(tickets[tIndex].pos);
      document.getElementById('posForm').reset();
    }
  });

  // Print POS
  document.getElementById('posPrintBtn').addEventListener('click', () => {
    window.print();
  });
}

function openTicketModal(ticketId) {
  currentTicketId = ticketId;
  const tickets = getTickets();
  const ticket = tickets.find(t => t.id === ticketId);
  if(!ticket) return;

  // Reset tabs to Info
  document.querySelector('.tab-btn[data-tab="info"]').click();

  // Populate Info
  document.getElementById('tdFolio').textContent = ticket.folio;
  document.getElementById('tdName').textContent = ticket.name || 'Sin nombre';
  document.getElementById('tdPhone').textContent = ticket.phone || '-';
  document.getElementById('tdService').textContent = ticket.service || '-';
  document.getElementById('tdPriority').textContent = ticket.priority || '-';
  document.getElementById('tdOnsite').textContent = ticket.onsite || '-';
  document.getElementById('tdLocation').textContent = ticket.location || '-';
  document.getElementById('tdDescription').textContent = ticket.description || '-';
  
  const d = new Date(ticket.createdAt);
  document.getElementById('tdDate').textContent = d.toLocaleString('es-MX');

  document.getElementById('tdEstado').value = ticket.estado;

  // Populate Bitacora
  renderBitacora(ticket.bitacora || []);

  // Populate POS
  renderPOS(ticket.pos || {items: [], total: 0});

  // Show modal
  document.getElementById('ticketDetailModal').classList.add('open');
}

function renderBitacora(notes) {
  const container = document.getElementById('bitacoraList');
  container.innerHTML = '';
  
  if (notes.length === 0) {
    container.innerHTML = '<p style="color:var(--text-muted);font-size:0.9rem;">No hay notas registradas.</p>';
    return;
  }

  notes.slice().reverse().forEach(note => {
    const d = new Date(note.date);
    const div = document.createElement('div');
    div.className = 'b-note';
    div.innerHTML = `
      <div class="b-note-head">
        <span>Técnico (Admin)</span>
        <span>${d.toLocaleString('es-MX')}</span>
      </div>
      <div class="b-note-body">${note.text}</div>
    `;
    container.appendChild(div);
  });
}

function renderPOS(posData) {
  const list = document.getElementById('posList');
  const totalEl = document.getElementById('posTotal');
  
  list.innerHTML = '';
  
  if (!posData.items || posData.items.length === 0) {
    list.innerHTML = '<tr><td colspan="3" style="text-align:center; color:var(--text-muted);">No hay conceptos agregados</td></tr>';
    totalEl.textContent = '$0.00';
    return;
  }

  posData.items.forEach(item => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${item.concept}</td>
      <td style="text-align: right; font-family: var(--font-mono);">$${item.price.toFixed(2)}</td>
      <td style="text-align: right;">
        <button class="del-item-btn" data-id="${item.id}" aria-label="Eliminar">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
        </button>
      </td>
    `;
    list.appendChild(tr);
  });

  totalEl.textContent = `$${(posData.total || 0).toFixed(2)}`;

  // Delete item logic
  list.querySelectorAll('.del-item-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const idToRemove = e.currentTarget.getAttribute('data-id');
      removePOSItem(idToRemove);
    });
  });
}

function removePOSItem(itemId) {
  if(!currentTicketId) return;
  const tickets = getTickets();
  const tIndex = tickets.findIndex(t => t.id === currentTicketId);
  if(tIndex > -1) {
    const itemIndex = tickets[tIndex].pos.items.findIndex(i => i.id === itemId);
    if(itemIndex > -1) {
      const price = tickets[tIndex].pos.items[itemIndex].price;
      tickets[tIndex].pos.items.splice(itemIndex, 1);
      tickets[tIndex].pos.total -= price;
      saveTickets(tickets);
      renderPOS(tickets[tIndex].pos);
    }
  }
}
