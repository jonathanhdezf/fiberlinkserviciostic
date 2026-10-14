import './style.css';
import gsap from 'gsap';
import { initEarth } from './three-earth.js';
import { initAnimations } from './animations.js';

document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize Cyber Background canvas (floating matrix particles)
  initCyberBg();

  // 2. Initialize 3D Earth in the Hero
  initEarth('webgl-container');

  // 3. Initialize GSAP and smooth scrolling
  initAnimations();

  // 4. UI Interactions (Drawer, Modals)
  initUI();

  // 5. Gamer HUD Audio Synthesizer, Matrix Glitch Scramble & Button Animations
  initCyberAudio();
  setupMatrixScramble();
  initHeroTicketAnimation();

  // 6. Premium cursor (desktop only)
  initCursor();
});

function initUI() {
  // Desktop Navigation & Sliding Indicator
  initDesktopNav();

  // ScrollSpy for Active Section Highlighting
  initScrollSpy();

  // Smooth Navigation & Card Highlights
  initSmoothNav();

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
    document.documentElement.classList.add('menu-open');
    document.body.style.overflow='hidden';
    document.documentElement.style.overflow='hidden';

    // Trigger gamer glitch animation on the "crear ticket" button in drawer
    const drawerTicketBtn = document.getElementById('drawerTicketBtn');
    if (drawerTicketBtn) {
      setTimeout(() => {
        triggerButtonGlitch(drawerTicketBtn);
      }, 260);
    }
  }
  
  function closeDrawer(){
    if(!drawer) return;
    drawer.classList.remove('open');
    drawer.setAttribute('aria-hidden','true');
    if(menuBtn) menuBtn.setAttribute('aria-expanded','false');
    document.body.classList.remove('menu-open');
    document.documentElement.classList.remove('menu-open');
    document.body.style.overflow='';
    document.documentElement.style.overflow='';
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
      
      const ticketData = {
        name: val('name'),
        phone: val('phone'),
        company: val('company'),
        address: val('address') || 'Soporte Remoto (No requiere domicilio)',
        service: val('service'),
        modality: val('modality'),
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
        `Domicilio: ${ticketData.address}`,
        `Servicio: ${ticketData.service}`,
        `Modalidad: ${ticketData.modality}`,
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
        address: val('address') || 'Soporte Remoto (No requiere domicilio)',
        service: val('service'),
        modality: val('modality'),
        priority: 'Normal',
        description: val('message'),
        source: 'Contact Form'
      };
      
      saveTicketToLocalStorage(ticketData);

      const msg = [
        `Nuevo Contacto — Fiberlink Servicios TIC`,
        `Nombre: ${ticketData.name}`,
        `Teléfono: ${ticketData.phone}`,
        `Servicio: ${ticketData.service}`,
        `Modalidad: ${ticketData.modality}`,
        `Domicilio: ${ticketData.address}`,
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

  // Dynamic validation: make address optional when modality is Remote
  const modalitySelects = document.querySelectorAll('select[name="modality"]');
  modalitySelects.forEach(select => {
    select.addEventListener('change', () => {
      const form = select.closest('form');
      const addressInput = form.querySelector('input[name="address"]');
      if (addressInput) {
        if (select.value === 'Remoto') {
          addressInput.removeAttribute('required');
          addressInput.placeholder = 'Opcional para soporte remoto';
        } else {
          addressInput.setAttribute('required', '');
          addressInput.placeholder = 'Calle, número, colonia o referencias';
        }
      }
    });
  });

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

    await typeLine('> INICIANDO ANÁLISIS DE RED Y SEGURIDAD...', 300, '#9cc32e');
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
    await typeLine(`  [OK] IP Localizada: ${ip}`, 400, '#7ce7ff');
    
    await typeLine('> Evaluando parámetros de enlace...', 700);
    await typeLine(`  [INFO] Tipo de red: ${type ? type.toUpperCase() : 'N/A'}`, 300);
    await typeLine(`  [INFO] Ancho de banda estimado: ${downlink}`, 300);
    await typeLine(`  [INFO] Latencia (RTT): ${rtt}`, 300);
    
    await typeLine('> Ejecutando escaneo de vulnerabilidades...', 800);
    await typeLine(`  [PASS] Certificado SSL/TLS: Seguro`, 400);
    await typeLine(`  [PASS] Filtrado DNS Leaks: Limpio`, 500);
    await typeLine(`  [WARN] Puertos críticos: 1 expuesto (Revisión recomendada)`, 600, '#f59e0b');
    
    await typeLine('> GENERANDO DIAGNÓSTICO FINAL...', 1000, '#9cc32e');
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

  // Hover Glow and 3D Tilt effects (Only on desktop/non-touch devices for maximum performance)
  const isTouch = window.matchMedia('(pointer: coarse)').matches;
  if (!isTouch) {
    // Hover Glow effect on Buttons
    document.querySelectorAll('.btn').forEach(btn => {
      btn.addEventListener('mousemove', e => {
        const r = btn.getBoundingClientRect();
        btn.style.setProperty('--bx', ((e.clientX - r.left) / r.width * 100) + '%');
        btn.style.setProperty('--by', ((e.clientY - r.top) / r.height * 100) + '%');
      });
    });
    
    // Bento Cards Glow + 3D Tilt
    document.querySelectorAll('.bc').forEach(card => {
      card.addEventListener('mousemove', e => {
        const r = card.getBoundingClientRect();
        const cx = (e.clientX - r.left) / r.width;
        const cy = (e.clientY - r.top) / r.height;
        card.style.setProperty('--cx', (cx * 100) + '%');
        card.style.setProperty('--cy', (cy * 100) + '%');
        // 3D tilt
        gsap.to(card, {
          rotateY: (cx - 0.5) * 9,
          rotateX: (cy - 0.5) * -7,
          transformPerspective: 800,
          duration: 0.38,
          ease: 'power2.out',
          overwrite: 'auto'
        });
      });
      card.addEventListener('mouseleave', () => {
        gsap.to(card, {
          rotateY: 0, rotateX: 0,
          duration: 0.9,
          ease: 'elastic.out(1, 0.38)',
          overwrite: 'auto'
        });
      });
    });
  }
}

// ============================
// DESKTOP NAVIGATION & SLIDING PILL INDICATOR
// ============================
function initDesktopNav() {
  const navDesktop = document.getElementById('navDesktop');
  const indicator = document.getElementById('navIndicator');
  if (!navDesktop || !indicator) return;

  const navLinks = navDesktop.querySelectorAll('.nav-link');
  const dropdownItem = navDesktop.querySelector('.has-dropdown');

  function moveIndicatorTo(el) {
    if (!el) {
      indicator.style.opacity = '0';
      return;
    }
    const navRect = navDesktop.getBoundingClientRect();
    const linkRect = el.getBoundingClientRect();
    const left = linkRect.left - navRect.left;
    const width = linkRect.width;

    indicator.style.width = `${width}px`;
    indicator.style.transform = `translateX(${left}px)`;
    indicator.style.opacity = '1';
  }

  function resetIndicator() {
    const activeLink = navDesktop.querySelector('.nav-link.nav-active');
    if (activeLink) {
      moveIndicatorTo(activeLink);
    } else {
      indicator.style.opacity = '0';
    }
  }

  navLinks.forEach(link => {
    link.addEventListener('mouseenter', () => moveIndicatorTo(link));
    link.addEventListener('focus', () => moveIndicatorTo(link));
  });

  navDesktop.addEventListener('mouseleave', () => resetIndicator());

  // Dropdown keyboard & click outside
  if (dropdownItem) {
    const trigger = dropdownItem.querySelector('.nav-link');
    if (trigger) {
      trigger.addEventListener('click', () => {
        if (window.innerWidth >= 1024) {
          dropdownItem.classList.toggle('open');
        }
      });
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        dropdownItem.classList.remove('open');
      }
    });

    document.addEventListener('click', (e) => {
      if (!dropdownItem.contains(e.target)) {
        dropdownItem.classList.remove('open');
      }
    });
  }

  setTimeout(resetIndicator, 300);
}

// ============================
// SCROLLSPY (ACTIVE SECTION INDICATOR)
// ============================
function initScrollSpy() {
  const sections = [
    { id: 'inicio', selector: '#inicio' },
    { id: 'servicios', selector: '#servicios' },
    { id: 'herramientas', selector: '#herramientas' },
    { id: 'proceso', selector: '#proceso' },
    { id: 'fiberlink-labs', selector: '#fiberlink-labs' },
    { id: 'contacto', selector: '#contacto' }
  ];

  const desktopLinks = document.querySelectorAll('.nav-desktop .nav-link');
  const drawerLinks = document.querySelectorAll('.drawer-nav .dl');
  const indicator = document.getElementById('navIndicator');

  const onScroll = () => {
    const scrollPos = window.scrollY + 180;
    let currentId = 'inicio';

    for (let i = sections.length - 1; i >= 0; i--) {
      const sec = document.querySelector(sections[i].selector);
      if (sec && sec.offsetTop <= scrollPos) {
        currentId = sections[i].id;
        break;
      }
    }

    desktopLinks.forEach(link => {
      const href = link.getAttribute('href');
      if (href === `#${currentId}`) {
        link.classList.add('nav-active');
        const navDesktop = document.getElementById('navDesktop');
        if (navDesktop && !navDesktop.matches(':hover') && indicator) {
          const navRect = navDesktop.getBoundingClientRect();
          const linkRect = link.getBoundingClientRect();
          indicator.style.width = `${linkRect.width}px`;
          indicator.style.transform = `translateX(${linkRect.left - navRect.left}px)`;
          indicator.style.opacity = '1';
        }
      } else {
        link.classList.remove('nav-active');
      }
    });

    drawerLinks.forEach(link => {
      const href = link.getAttribute('href');
      if (href === `#${currentId}`) {
        link.classList.add('nav-active');
      } else {
        link.classList.remove('nav-active');
      }
    });
  };

  window.addEventListener('scroll', onScroll, { passive: true });
}

// ============================
// SMOOTH NAVIGATION & INTERACTIVE CARD HIGHLIGHTS
// ============================
function initSmoothNav() {
  const allNavAnchors = document.querySelectorAll(
    '.nav-desktop a[href^="#"], .drawer-nav a[href^="#"], .dropdown-card[href^="#"], .hero-actions a[href^="#"], a.brand[href^="#"]'
  );

  allNavAnchors.forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const href = anchor.getAttribute('href');
      if (!href || href === '#') return;

      const targetEl = document.querySelector(href);
      if (!targetEl) return;

      e.preventDefault();

      // Close mobile drawer if open
      const drawer = document.getElementById('drawer');
      const menuBtn = document.getElementById('menuBtn');
      if (drawer && drawer.classList.contains('open')) {
        drawer.classList.remove('open');
        drawer.setAttribute('aria-hidden', 'true');
        if (menuBtn) menuBtn.setAttribute('aria-expanded', 'false');
        document.body.classList.remove('menu-open');
        document.documentElement.classList.remove('menu-open');
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
      }

      // Close dropdown if open
      const dropdownItem = document.querySelector('.has-dropdown');
      if (dropdownItem) {
        dropdownItem.classList.remove('open');
      }

      // Smooth scroll via Lenis or native
      if (window.lenis) {
        window.lenis.scrollTo(targetEl, { offset: -70, duration: 1.1 });
      } else {
        const top = targetEl.getBoundingClientRect().top + window.pageYOffset - 70;
        window.scrollTo({ top, behavior: 'smooth' });
      }

      // If clicking a dropdown card with data-target, trigger pulse highlight on bento card
      const targetCardId = anchor.getAttribute('data-target');
      if (targetCardId) {
        setTimeout(() => {
          const card = document.getElementById(targetCardId);
          if (card) {
            card.classList.remove('card-highlighted');
            void card.offsetWidth; // trigger reflow
            card.classList.add('card-highlighted');
            setTimeout(() => card.classList.remove('card-highlighted'), 2000);
          }
        }, 300);
      }
    });
  });

  // Global Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const drawer = document.getElementById('drawer');
      const menuBtn = document.getElementById('menuBtn');
      if (drawer && drawer.classList.contains('open')) {
        drawer.classList.remove('open');
        drawer.setAttribute('aria-hidden', 'true');
        if (menuBtn) menuBtn.setAttribute('aria-expanded', 'false');
        document.body.classList.remove('menu-open');
        document.documentElement.classList.remove('menu-open');
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
      }
    }
  });
}

// ============================
// CUSTOM CURSOR
// ============================
function initCursor() {
  if (window.matchMedia('(pointer: coarse)').matches) return;
  const dot = document.getElementById('cursorDot');
  const ring = document.getElementById('cursorRing');
  if (!dot || !ring) return;

  document.documentElement.setAttribute('data-cursor', 'active');
  gsap.set([dot, ring], { xPercent: -50, yPercent: -50 });

  const mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  const pos   = { x: mouse.x, y: mouse.y };
  const xSet  = gsap.quickSetter(ring, 'x', 'px');
  const ySet  = gsap.quickSetter(ring, 'y', 'px');

  window.addEventListener('mousemove', e => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    gsap.set(dot, { x: mouse.x, y: mouse.y });
  });

  gsap.ticker.add(() => {
    pos.x += (mouse.x - pos.x) * 0.11;
    pos.y += (mouse.y - pos.y) * 0.11;
    xSet(pos.x);
    ySet(pos.y);
  });

  const selectors = 'a,button,.bc,.partner-item,.tool-pill,input,select,textarea,.soc,.step,.citem,label';
  document.querySelectorAll(selectors).forEach(el => {
    el.addEventListener('mouseenter', () => document.body.classList.add('cursor-hover'));
    el.addEventListener('mouseleave', () => document.body.classList.remove('cursor-hover'));
  });

  document.addEventListener('mousedown', () => {
    gsap.to(dot,  { scale: 1.6, duration: 0.12, ease: 'power2.out', overwrite: true });
    gsap.to(ring, { scale: 0.8, duration: 0.12, ease: 'power2.out', overwrite: true });
  });
  document.addEventListener('mouseup', () => {
    gsap.to([dot, ring], { scale: 1, duration: 0.55, ease: 'elastic.out(1.2, 0.4)', overwrite: true });
  });
  document.addEventListener('mouseleave', () => gsap.to([dot, ring], { opacity: 0, duration: 0.3 }));
  document.addEventListener('mouseenter', () => gsap.to([dot, ring], { opacity: 1, duration: 0.3 }));
}

// ============================
// CYBER BACKGROUND CANVAS (AI-DAY)
// ============================
function initCyberBg() {
  const canvas = document.getElementById('bgCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let raf = null;
  let w = 0, h = 0;
  let digits = [];
  const S = 18;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = w * dpr;
    canvas.height = h * dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);

    const cols = Math.ceil(w / S) + 1;
    const rows = Math.ceil(h / S) + 1;
    digits = [];
    for (let x = 0; x < cols; x++) {
      for (let y = 0; y < rows; y++) {
        if (Math.random() > 0.48) continue;
        digits.push({
          x: x * S,
          y: y * S + 12,
          c: Math.random() > 0.5 ? '0' : '7',
          p: Math.random() * Math.PI * 2,
          s: 0.01 + Math.random() * 0.028,
          lime: Math.random() > 0.93,
          vy: (Math.random() > 0.5 ? 1 : -1) * (0.06 + Math.random() * 0.22),
          dx: Math.random() * Math.PI * 2,
          flip: 0.002 + Math.random() * 0.004
        });
      }
    }
  }

  resize();
  window.addEventListener('resize', () => {
    if (Math.abs(window.innerWidth - w) > 10) {
      resize();
    }
  });

  function loop() {
    ctx.clearRect(0, 0, w, h);
    ctx.font = '13px "Share Tech Mono", monospace';
    for (let i = 0; i < digits.length; i++) {
      const d = digits[i];
      d.p += d.s;
      d.dx += 0.012;
      d.y += d.vy;
      if (d.y > h + 14) d.y = -2;
      else if (d.y < -14) d.y = h + 2;
      if (Math.random() < d.flip) d.c = d.c === '0' ? '7' : '0';
      const a = (Math.sin(d.p) + 1) / 2;
      ctx.fillStyle = d.lime
        ? 'rgba(156,195,46,' + (0.14 + a * 0.40).toFixed(3) + ')'
        : 'rgba(242,244,239,' + (0.025 + a * 0.08).toFixed(3) + ')';
      ctx.fillText(d.c, d.x + Math.sin(d.dx) * 1.6, d.y);
    }
    raf = requestAnimationFrame(loop);
  }
  loop();
}

// ============================
// CYBER AUDIO SYNTHESIZER (WEB AUDIO API)
// ============================
let audioCtx = null;
let sfxEnabled = localStorage.getItem('fiberlink_sfx') !== 'false';

function getAudioCtx() {
  if (!audioCtx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (AudioContext) {
      audioCtx = new AudioContext();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export function playCyberHoverTone() {
  if (!sfxEnabled) return;
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    const now = ctx.currentTime;
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1100, now);
    osc.frequency.exponentialRampToValueAtTime(1700, now + 0.035);

    gain.gain.setValueAtTime(0.02, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.04);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.042);
  } catch (e) {}
}

export function playCyberClickTone() {
  if (!sfxEnabled) return;
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    const now = ctx.currentTime;
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(880, now);
    osc.frequency.exponentialRampToValueAtTime(440, now + 0.055);

    gain.gain.setValueAtTime(0.03, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    osc.stop(now + 0.065);
  } catch (e) {}
}

function initCyberAudio() {
  const sfxToggle = document.getElementById('sfxToggle');

  function updateSfxButtonUI() {
    if (!sfxToggle) return;
    if (sfxEnabled) {
      sfxToggle.classList.remove('sfx-muted');
      sfxToggle.setAttribute('title', 'Efectos de sonido: ACTIVADOS (clic para silenciar)');
      const label = sfxToggle.querySelector('.sfx-label');
      if (label) label.textContent = 'SFX';
    } else {
      sfxToggle.classList.add('sfx-muted');
      sfxToggle.setAttribute('title', 'Efectos de sonido: SILENCIADOS (clic para activar)');
      const label = sfxToggle.querySelector('.sfx-label');
      if (label) label.textContent = 'MUTE';
    }
  }

  updateSfxButtonUI();

  if (sfxToggle) {
    sfxToggle.addEventListener('click', () => {
      sfxEnabled = !sfxEnabled;
      localStorage.setItem('fiberlink_sfx', sfxEnabled ? 'true' : 'false');
      updateSfxButtonUI();
      if (sfxEnabled) {
        getAudioCtx();
        playCyberClickTone();
      }
    });
  }

  const resumeOnInteraction = () => {
    getAudioCtx();
    window.removeEventListener('pointerdown', resumeOnInteraction);
    window.removeEventListener('keydown', resumeOnInteraction);
  };
  window.addEventListener('pointerdown', resumeOnInteraction, { once: true });
  window.addEventListener('keydown', resumeOnInteraction, { once: true });

  // Add click tones to interactive buttons
  document.querySelectorAll('.btn, .nav-cta, .hud-link, .dropdown-card, .menu-btn, .close-btn').forEach(btn => {
    btn.addEventListener('click', () => playCyberClickTone());
  });
}

// ============================
// MATRIX TEXT DECRYPTION SCRAMBLER (GAMER DISTORTION)
// ============================
function setupMatrixScramble() {
  const GLYPHS = '010101<>/\\_X[]#%$&⚡*+=~';
  const glitchElements = document.querySelectorAll('[data-glitch]');

  glitchElements.forEach(el => {
    const targetText = el.getAttribute('data-glitch');
    const displaySpan = el.querySelector('.glitch-txt') || el;
    let frameId = null;
    let running = false;

    const runScramble = () => {
      if (running) return;
      running = true;
      playCyberHoverTone();
      el.classList.add('is-glitching');

      let iteration = 0;
      const totalFrames = 10;
      const len = targetText.length;

      clearInterval(frameId);
      frameId = setInterval(() => {
        displaySpan.innerText = targetText
          .split('')
          .map((char, index) => {
            if (char === ' ') return ' ';
            if (index < (iteration / totalFrames) * len) {
              return targetText[index];
            }
            return GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
          })
          .join('');

        iteration++;
        if (iteration > totalFrames) {
          clearInterval(frameId);
          displaySpan.innerText = targetText;
          el.classList.remove('is-glitching');
          running = false;
        }
      }, 24);
    };

    el.addEventListener('mouseenter', runScramble);
    el.addEventListener('focus', runScramble);
  });
}

// ============================
// DYNAMIC BUTTON GLITCH & RADAR TRIGGER
// ============================
export function triggerButtonGlitch(buttonEl) {
  if (!buttonEl) return;

  // 1. Play subtle cyber tone
  playCyberClickTone();

  // 2. Restart cyber shockwave animation
  buttonEl.classList.remove('btn-cyber-pulse');
  void buttonEl.offsetWidth; // Force reflow
  buttonEl.classList.add('btn-cyber-pulse');

  // 3. Matrix text scramble decode
  const targetText = buttonEl.getAttribute('data-glitch') || buttonEl.innerText.trim();
  const displaySpan = buttonEl.querySelector('.glitch-txt') || buttonEl;
  const GLYPHS = '010101<>/\\_X[]#%$&⚡*+=~';

  buttonEl.classList.add('is-glitching');
  let iteration = 0;
  const totalFrames = 12;
  const len = targetText.length;

  if (buttonEl._glitchInterval) {
    clearInterval(buttonEl._glitchInterval);
  }

  buttonEl._glitchInterval = setInterval(() => {
    displaySpan.innerText = targetText
      .split('')
      .map((char, index) => {
        if (char === ' ') return ' ';
        if (index < (iteration / totalFrames) * len) {
          return targetText[index];
        }
        return GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
      })
      .join('');

    iteration++;
    if (iteration > totalFrames) {
      clearInterval(buttonEl._glitchInterval);
      buttonEl._glitchInterval = null;
      displaySpan.innerText = targetText;
      buttonEl.classList.remove('is-glitching');
    }
  }, 24);

  setTimeout(() => {
    buttonEl.classList.remove('btn-cyber-pulse');
  }, 950);
}

// ============================
// HERO TICKET BUTTON GLITCH SYNCHRONIZATION
// ============================
function initHeroTicketAnimation() {
  const heroBtn = document.getElementById('heroTicketBtn');
  if (!heroBtn) return;

  // Initial trigger once page animations settle
  setTimeout(() => {
    triggerButtonGlitch(heroBtn);
  }, 1300);

  // Periodic ambient pulse every 7 seconds when in viewport
  setInterval(() => {
    const rect = heroBtn.getBoundingClientRect();
    if (rect.top < window.innerHeight && rect.bottom > 0) {
      triggerButtonGlitch(heroBtn);
    }
  }, 7000);

  // Interaction triggers (mouse & touch)
  heroBtn.addEventListener('mouseenter', () => triggerButtonGlitch(heroBtn));
  heroBtn.addEventListener('touchstart', () => triggerButtonGlitch(heroBtn), { passive: true });
}

