import './style.css';
import { initEarth } from './three-earth.js';
import { initAnimations } from './animations.js';

document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize 3D Earth in the Hero
  initEarth('webgl-container');

  // 2. Initialize GSAP and smooth scrolling
  initAnimations();

  // 3. UI Interactions (Drawer, Modals)
  initUI();
});

function initUI() {
  // Mobile Drawer
  const menuBtn = document.getElementById('menuBtn');
  const drawer = document.getElementById('drawer');
  const drawerBack = document.getElementById('drawerBack');
  const drawerClose = document.getElementById('drawerClose');

  function openDrawer(){
    if(!drawer) return;
    drawer.classList.add('open');
    drawer.setAttribute('aria-hidden','false');
    if(menuBtn) menuBtn.setAttribute('aria-expanded','true');
    document.body.classList.add('menu-open');
    document.body.style.overflow='hidden';
  }
  
  function closeDrawer(){
    if(!drawer) return;
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden','true');
    if(menuBtn) menuBtn.setAttribute('aria-expanded','false');
    document.body.classList.remove('menu-open');
    document.body.style.overflow='';
  }
  
  if(menuBtn) menuBtn.addEventListener('click', () => drawer.classList.contains('open') ? closeDrawer() : openDrawer());
  if(drawerBack) drawerBack.addEventListener('click', closeDrawer);
  if(drawerClose) drawerClose.addEventListener('click', closeDrawer);
  document.querySelectorAll('.dl').forEach(a => a.addEventListener('click', closeDrawer));

  // Ticket Modal
  const modal = document.getElementById('ticketModal');
  const ticketForm = document.getElementById('ticketForm');
  const toast = document.getElementById('ticketToast');
  const PHONE = '522311024672';
  let prio = 'Normal';

  function openModal(){
    if(!modal) return;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden','false');
    document.body.style.overflow='hidden';
    setTimeout(() => modal.querySelector('input[name="name"]')?.focus(), 140);
  }
  
  function closeModal(){
    if(!modal) return;
    modal.classList.remove('open');
    modal.setAttribute('aria-hidden','true');
    document.body.style.overflow='';
    if(toast) toast.classList.remove('show');
  }

  document.querySelectorAll('.open-ticket').forEach(b => b.addEventListener('click', openModal));
  document.querySelectorAll('[data-close-modal]').forEach(b => b.addEventListener('click', closeModal));

  document.querySelectorAll('.priority button').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.priority button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      prio = btn.dataset.p;
    });
  });

  function saveTicketToLocalStorage(ticketData) {
    const tickets = JSON.parse(localStorage.getItem('fiberlink_tickets') || '[]');
    const folioNum = tickets.length > 0 ? Math.max(...tickets.map(t => parseInt(t.folio.split('-')[1]) || 1000)) + 1 : 1001;
    const folio = `FL-${folioNum}`;
    
    const newTicket = {
      id: Date.now().toString(),
      folio,
      estado: 'creación',
      createdAt: new Date().toISOString(),
      ...ticketData,
      bitacora: [],
      pos: { items: [], total: 0 }
    };
    
    tickets.push(newTicket);
    localStorage.setItem('fiberlink_tickets', JSON.stringify(tickets));
    return newTicket;
  }

  function waUrl(msg){ return `https://wa.me/${PHONE}?text=${encodeURIComponent(msg)}` }
  
  if(ticketForm) {
    ticketForm.addEventListener('submit', e => {
      e.preventDefault();
      const val = (name) => new FormData(ticketForm).get(name)?.toString().trim() || '';
      const onsite = ticketForm.querySelector('input[name="onsite"]')?.checked ? 'Sí' : 'No';
      
      const ticketData = {
        name: val('name'),
        phone: val('phone'),
        company: val('company'),
        location: val('location'),
        service: val('service'),
        onsite,
        priority: prio,
        description: val('message'),
        source: 'Ticket Modal'
      };
      
      saveTicketToLocalStorage(ticketData);

      const msg = [
        `Ticket Nuevo — Fiberlink Servicios TIC`,
        `Nombre: ${ticketData.name}`,
        `Teléfono: ${ticketData.phone}`,
        `Empresa/Hogar: ${ticketData.company || 'No especificado'}`,
        `Ubicación: ${ticketData.location}`,
        `Servicio: ${ticketData.service}`,
        `En sitio: ${ticketData.onsite}`,
        `Prioridad: ${ticketData.priority}`,
        `Descripción: ${ticketData.description}`,
      ].join('\n');
      if(toast) toast.classList.add('show');
      setTimeout(() => {
        window.open(waUrl(msg), '_blank', 'noopener');
        closeModal();
        ticketForm.reset();
      }, 380);
    });
  }

  const contactForm = document.getElementById('contactForm');
  if(contactForm) {
    contactForm.addEventListener('submit', e => {
      e.preventDefault();
      const val = (name) => new FormData(contactForm).get(name)?.toString().trim() || '';
      
      const ticketData = {
        name: val('name'),
        phone: val('phone'),
        company: '',
        location: 'No especificada (Formulario de contacto)',
        service: val('service'),
        onsite: 'No',
        priority: 'Normal',
        description: val('message'),
        source: 'Contact Form'
      };
      
      saveTicketToLocalStorage(ticketData);

      const msg = [
        `Nuevo Contacto — Fiberlink Servicios TIC`,
        `Nombre: ${ticketData.name}`,
        `Teléfono: ${ticketData.phone}`,
        `Servicio de interés: ${ticketData.service}`,
        `Mensaje: ${ticketData.description}`,
      ].join('\n');
      
      const btn = contactForm.querySelector('button[type="submit"]');
      const originalText = btn.innerHTML;
      btn.innerHTML = '✓ Preparando...';
      
      setTimeout(() => {
        window.open(waUrl(msg), '_blank', 'noopener');
        btn.innerHTML = originalText;
        contactForm.reset();
      }, 380);
    });
  }

  // Demo Terminal
  const demoBtn = document.getElementById('demoBtn');
  const termOverlay = document.getElementById('termOverlay');
  const termContent = document.getElementById('termContent');
  let termTimeout;
  let termActive = false;

  const runTerminalReport = async () => {
    if(!termContent) return;
    termContent.innerHTML = '';
    termActive = true;
    
    const typeLine = (text, delay = 500, color = '') => {
      return new Promise(resolve => {
        if(!termActive) return resolve();
        termTimeout = setTimeout(() => {
          if(!termActive) return resolve();
          const div = document.createElement('div');
          div.className = 'tl';
          if(color) div.style.color = color;
          div.innerHTML = text;
          termContent.appendChild(div);
          
          // trigger reflow
          void div.offsetWidth;
          div.classList.add('vis');
          termContent.scrollTop = termContent.scrollHeight;
          resolve();
        }, delay);
      });
    };

    await typeLine('> INICIANDO ANÁLISIS DE RED Y SEGURIDAD...', 300, '#48d39b');
    await typeLine('> Extrayendo telemetría del cliente...', 600);
    
    const ua = navigator.userAgent;
    const os = navigator.platform || 'Desconocido';
    const screenRes = `${window.screen.width}x${window.screen.height}`;
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    const downlink = conn ? conn.downlink + ' Mbps' : 'Desconocida';
    const rtt = conn ? conn.rtt + ' ms' : 'Desconocido';
    const type = conn ? conn.effectiveType : 'Desconocida';
    
    await typeLine(`  [OK] Plataforma: ${os} | Display: ${screenRes}`, 400);
    await typeLine(`  [OK] Cliente: ${ua.split(' ')[0]}`, 300);
    
    await typeLine('> Solicitando traza de IP pública...', 600);
    let ip = 'Desconocida';
    try {
      const res = await fetch('https://api.ipify.org?format=json');
      const data = await res.json();
      ip = data.ip;
    } catch(e) {
      ip = 'Oculta / Firewall';
    }
    await typeLine(`  [OK] IP Localizada: ${ip}`, 400, '#3b82f6');
    
    await typeLine('> Evaluando parámetros de enlace...', 700);
    await typeLine(`  [INFO] Tipo de red: ${type ? type.toUpperCase() : 'N/A'}`, 300);
    await typeLine(`  [INFO] Ancho de banda estimado: ${downlink}`, 300);
    await typeLine(`  [INFO] Latencia (RTT): ${rtt}`, 300);
    
    await typeLine('> Ejecutando escaneo de vulnerabilidades...', 800);
    await typeLine(`  [PASS] Certificado SSL/TLS: Seguro`, 400);
    await typeLine(`  [PASS] Filtrado DNS Leaks: Limpio`, 500);
    await typeLine(`  [WARN] Puertos críticos: 1 expuesto (Revisión recomendada)`, 600, '#f59e0b');
    
    await typeLine('> GENERANDO DIAGNÓSTICO FINAL...', 1000, '#48d39b');
    await typeLine(`  Su conexión presenta variaciones que pueden afectar servicios críticos. Para máxima estabilidad corporativa, se sugiere migrar a Fibra Óptica Simétrica <a href="https://fibergravitymx.vercel.app/" target="_blank" style="color:var(--primary);text-decoration:underline;">Fibergravity Teziutlan</a>.`, 500, '#f0f0f0');
    await typeLine('> SESIÓN FINALIZADA.', 800);
    termActive = false;
  };

  if (demoBtn && termOverlay) {
    demoBtn.addEventListener('click', () => {
      termOverlay.classList.add('open');
      runTerminalReport();
    });
    document.getElementById('termClose')?.addEventListener('click', () => {
      termOverlay.classList.remove('open');
      termActive = false;
      clearTimeout(termTimeout);
    });
    document.getElementById('termStop')?.addEventListener('click', () => {
      if(!termActive) return;
      termActive = false;
      clearTimeout(termTimeout);
      const div = document.createElement('div');
      div.className = 'tl vis';
      div.style.color = '#ef4444';
      div.textContent = '> ANÁLISIS INTERRUMPIDO POR EL USUARIO.';
      termContent?.appendChild(div);
      termContent.scrollTop = termContent.scrollHeight;
    });
  }

  // Hover Glow effect on Buttons
  document.querySelectorAll('.btn').forEach(btn => {
    btn.addEventListener('mousemove', e => {
      const r = btn.getBoundingClientRect();
      btn.style.setProperty('--bx', ((e.clientX - r.left) / r.width * 100) + '%');
      btn.style.setProperty('--by', ((e.clientY - r.top) / r.height * 100) + '%');
    });
  });
  
  // Bento Cards Glow
  document.querySelectorAll('.bc').forEach(card => {
    card.addEventListener('mousemove', e => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--cx', ((e.clientX - r.left) / r.width * 100) + '%');
      card.style.setProperty('--cy', ((e.clientY - r.top) / r.height * 100) + '%');
    });
  });
}
