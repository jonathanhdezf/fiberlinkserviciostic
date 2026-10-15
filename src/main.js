import './style.css';
import gsap from 'gsap';
import { initEarth } from './three-earth.js';
import { initAnimations } from './animations.js';
import { ticketService } from './services/ticketService.js';

document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize Cyber Background canvas (floating matrix particles)
  initCyberBg();

  // 2. Initialize 3D Earth in the Hero
  initEarth('webgl-container');

  // 3. Initialize GSAP and smooth scrolling
  initAnimations();

  // 4. UI Interactions (Drawer, Modals)
  initUI();

  // 5. Matrix Glitch Scramble & Button Animations
  setupMatrixScramble();
  initHeroTicketAnimation();

  // 6. Premium cursor (desktop only)
  initCursor();

  // 7. Progressive Web App (PWA) Registration
  initPWA();

  // 8. Cyber-Carousels (Soluciones & Catálogo)
  initCyberCarousels();

  // 9. Social Share & Copy Link button
  initSocialShare();

  // 10. Scroll-driven reveal for Fiberlink Labs
  initLabsScrollReveal();
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

  // ==========================================
  // STEPPER TICKET MODAL & BACKEND INTEGRATION
  // ==========================================
  const modal = document.getElementById('ticketModal');
  const ticketForm = document.getElementById('ticketForm');
  const toast = document.getElementById('ticketToast');
  const PHONE = '522311024672';
  function waUrl(msg){ return `https://wa.me/${PHONE}?text=${encodeURIComponent(msg)}` }

  let currentStep = 1;
  const stepperProgressBar = document.getElementById('stepperProgressBar');
  const stepSubHeading = document.getElementById('stepSubHeading');
  const stepPrevBtn = document.getElementById('stepPrevBtn');
  const stepNextBtn = document.getElementById('stepNextBtn');
  const stepperControls = document.getElementById('stepperControls');
  const stepBadges = document.querySelectorAll('.step-badge');
  const formSteps = document.querySelectorAll('.form-step');

  const subHeadings = {
    1: 'Selecciona el tipo de servicio y modalidad que requieres.',
    2: 'Describe la situación técnica e indica la prioridad del caso.',
    3: 'Ingresa tus datos de contacto para coordinar la atención técnica.',
    4: '¡Solicitud registrada con éxito! Folio generado.'
  };

  function goToStep(step) {
    currentStep = Math.max(1, Math.min(4, step));

    // Reset scroll position immediately so title and step header are always at top
    const panel = modal ? modal.querySelector('.modal-panel') : null;
    if (panel) {
      panel.scrollTop = 0;
    }

    // Update active form panes
    formSteps.forEach(pane => {
      const pStep = parseInt(pane.getAttribute('data-step'));
      if (pStep === currentStep) {
        pane.classList.add('active');
      } else {
        pane.classList.remove('active');
      }
    });

    // Update step badges
    stepBadges.forEach(badge => {
      const target = parseInt(badge.getAttribute('data-step-target'));
      badge.classList.remove('active', 'completed');
      if (target === currentStep) {
        badge.classList.add('active');
      } else if (target < currentStep) {
        badge.classList.add('completed');
      }
    });

    // Update Progress Bar
    const progressMap = { 1: '25%', 2: '50%', 3: '75%', 4: '100%' };
    if (stepperProgressBar) {
      stepperProgressBar.style.width = progressMap[currentStep] || '25%';
    }

    // Update Subheading
    if (stepSubHeading) {
      stepSubHeading.textContent = subHeadings[currentStep] || '';
    }

    // Update Controls visibility
    if (stepperControls) {
      if (currentStep === 4) {
        stepperControls.style.display = 'none';
      } else {
        stepperControls.style.display = 'flex';
      }
    }

    if (stepPrevBtn) {
      stepPrevBtn.style.display = (currentStep > 1 && currentStep < 4) ? 'inline-flex' : 'none';
    }

    if (stepNextBtn) {
      if (currentStep === 3) {
        stepNextBtn.innerHTML = '<span>⚡ Generar Ticket</span>';
      } else {
        stepNextBtn.innerHTML = '<span>Continuar &rarr;</span>';
      }
    }

    // Focus without scrolling the panel down
    if (currentStep === 2) {
      setTimeout(() => {
        document.getElementById('ticketMessage')?.focus({ preventScroll: true });
      }, 50);
    } else if (currentStep === 3) {
      setTimeout(() => {
        document.getElementById('ticketName')?.focus({ preventScroll: true });
      }, 50);
    }
  }

  function openModal(){
    if(!modal) return;
    modal.classList.add('open');
    modal.setAttribute('aria-hidden','false');
    document.body.style.overflow='hidden';
    const panel = modal.querySelector('.modal-panel');
    if (panel) {
      panel.scrollTop = 0;
    }
    if (currentStep === 4) {
      resetStepperForm();
    }
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

  // Allow clicking back to completed steps via badges
  stepBadges.forEach(badge => {
    badge.addEventListener('click', () => {
      const target = parseInt(badge.getAttribute('data-step-target'));
      if (target < currentStep) {
        goToStep(target);
      }
    });
  });

  // Step 1: Service Tiles & Modality Pills
  const serviceTiles = document.querySelectorAll('.service-tile');
  serviceTiles.forEach(tile => {
    tile.addEventListener('click', () => {
      serviceTiles.forEach(t => t.classList.remove('active'));
      tile.classList.add('active');
      const radio = tile.querySelector('input[type="radio"]');
      if (radio) radio.checked = true;
    });
  });

  const modPills = document.querySelectorAll('.mod-pill');
  const addressInput = document.getElementById('ticketAddress');
  modPills.forEach(pill => {
    pill.addEventListener('click', () => {
      modPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      const radio = pill.querySelector('input[type="radio"]');
      if (radio) {
        radio.checked = true;
        if (addressInput) {
          if (radio.value === 'Remoto') {
            addressInput.removeAttribute('required');
            addressInput.placeholder = 'Opcional (Atención remota vía AnyDesk / TeamViewer)';
          } else {
            addressInput.setAttribute('required', '');
            addressInput.placeholder = 'Calle, número, colonia, local o referencias claras';
          }
        }
      }
    });
  });

  // Step 2: Priority Tiles & Character Counter
  const prioTiles = document.querySelectorAll('.prio-tile');
  prioTiles.forEach(pt => {
    pt.addEventListener('click', () => {
      prioTiles.forEach(p => p.classList.remove('active'));
      pt.classList.add('active');
      const radio = pt.querySelector('input[type="radio"]');
      if (radio) radio.checked = true;
    });
  });

  const ticketMsg = document.getElementById('ticketMessage');
  const ticketCharCount = document.getElementById('ticketCharCount');
  if (ticketMsg && ticketCharCount) {
    ticketMsg.addEventListener('input', () => {
      ticketCharCount.textContent = `${ticketMsg.value.length} / 400`;
      ticketMsg.style.borderColor = '';
    });
  }

  // Stepper Back Button
  if (stepPrevBtn) {
    stepPrevBtn.addEventListener('click', () => {
      if (currentStep > 1) goToStep(currentStep - 1);
    });
  }

  // Stepper Next / Submit Button
  if (stepNextBtn) {
    stepNextBtn.addEventListener('click', async () => {
      // Validate Step 1
      if (currentStep === 1) {
        goToStep(2);
        return;
      }

      // Validate Step 2
      if (currentStep === 2) {
        const desc = ticketMsg?.value.trim() || '';
        if (desc.length < 6) {
          if (ticketMsg) {
            ticketMsg.style.borderColor = '#ef4444';
            ticketMsg.focus();
          }
          return;
        }
        ticketMsg.style.borderColor = '';
        goToStep(3);
        return;
      }

      // Validate & Submit Step 3
      if (currentStep === 3) {
        const nameEl = document.getElementById('ticketName');
        const phoneEl = document.getElementById('ticketPhone');
        const emailEl = document.getElementById('ticketEmail');
        const companyEl = document.getElementById('ticketCompany');
        const addressEl = document.getElementById('ticketAddress');

        const nameVal = nameEl?.value.trim() || '';
        const phoneVal = phoneEl?.value.trim() || '';
        const emailVal = emailEl?.value.trim() || '';
        const compVal = companyEl?.value.trim() || '';
        const addrVal = addressEl?.value.trim() || '';

        const activeModality = document.querySelector('input[name="modality"]:checked')?.value || 'En Sitio / Domicilio';
        const activeService = document.querySelector('input[name="service"]:checked')?.value || 'Soporte técnico';
        const activePriority = document.querySelector('input[name="priority"]:checked')?.value || 'Normal';
        const descVal = ticketMsg?.value.trim() || '';

        let hasError = false;

        if (nameVal.length < 3) {
          if (nameEl) nameEl.style.borderColor = '#ef4444';
          nameEl?.focus();
          hasError = true;
        } else if (nameEl) {
          nameEl.style.borderColor = '';
        }

        if (phoneVal.length < 7) {
          if (phoneEl) phoneEl.style.borderColor = '#ef4444';
          if (!hasError) phoneEl?.focus();
          hasError = true;
        } else if (phoneEl) {
          phoneEl.style.borderColor = '';
        }

        if (activeModality !== 'Remoto' && addrVal.length < 3) {
          if (addressEl) addressEl.style.borderColor = '#ef4444';
          if (!hasError) addressEl?.focus();
          hasError = true;
        } else if (addressEl) {
          addressEl.style.borderColor = '';
        }

        if (hasError) return;

        // Visual loading state
        stepNextBtn.disabled = true;
        const originalBtnHtml = stepNextBtn.innerHTML;
        stepNextBtn.innerHTML = '<span>⚡ Generando Folio...</span>';

        try {
          const ticketData = {
            name: nameVal,
            phone: phoneVal,
            email: emailVal,
            company: compVal,
            address: addrVal || (activeModality === 'Remoto' ? 'Soporte Remoto' : 'Teziutlán, Pue.'),
            service: activeService,
            modality: activeModality,
            priority: activePriority,
            description: descVal,
            source: 'Portal Web (Asistente en Pasos)'
          };

          // Save to backend REST API (with resilient localStorage sync)
          const newTicket = await ticketService.createTicket(ticketData);

          // Populate Confirmation Screen (Step 4)
          const confFolio = document.getElementById('confFolio');
          const confState = document.getElementById('confState');
          const confClient = document.getElementById('confClient');
          const confPhone = document.getElementById('confPhone');
          const confService = document.getElementById('confService');
          const confPriority = document.getElementById('confPriority');
          const confWaBtn = document.getElementById('confWaBtn');

          if (confFolio) confFolio.textContent = newTicket.folio;
          if (confState) confState.textContent = '[ REGISTRADO // MESA TÉCNICA ]';
          if (confClient) confClient.textContent = newTicket.name;
          if (confPhone) confPhone.textContent = newTicket.phone;
          if (confService) confService.textContent = `${newTicket.service} (${newTicket.modality})`;
          if (confPriority) {
            confPriority.textContent = newTicket.priority;
            if (newTicket.priority === 'Alta') confPriority.style.color = '#f59e0b';
            else if (newTicket.priority === 'Urgente') confPriority.style.color = '#ef4444';
            else confPriority.style.color = 'var(--verde)';
          }

          // Setup WhatsApp trigger button
          if (confWaBtn) {
            const waMsg = [
              `*Nuevo Ticket Técnico — Fiberlink*`,
              `*Folio:* ${newTicket.folio}`,
              `*Cliente:* ${newTicket.name}`,
              `*Teléfono:* ${newTicket.phone}`,
              newTicket.company ? `*Empresa:* ${newTicket.company}` : '',
              `*Servicio:* ${newTicket.service}`,
              `*Modalidad:* ${newTicket.modality}`,
              `*Prioridad:* ${newTicket.priority}`,
              `*Domicilio:* ${newTicket.address}`,
              `*Descripción:* ${newTicket.description}`
            ].filter(Boolean).join('\n');

            confWaBtn.onclick = () => {
              window.open(waUrl(waMsg), '_blank', 'noopener');
            };
          }

          // Advance to Step 4
          goToStep(4);

        } catch (err) {
          console.error('[TicketModal] Error al crear ticket:', err);
          alert('Hubo un inconveniente al generar el ticket. Por favor intenta de nuevo.');
        } finally {
          stepNextBtn.disabled = false;
          stepNextBtn.innerHTML = originalBtnHtml;
        }
      }
    });
  }

  function resetStepperForm() {
    if (ticketForm) ticketForm.reset();
    if (ticketCharCount) ticketCharCount.textContent = '0 / 400';
    
    // Reset service tiles to first
    serviceTiles.forEach((t, i) => {
      if (i === 0) {
        t.classList.add('active');
        const r = t.querySelector('input[type="radio"]');
        if (r) r.checked = true;
      } else {
        t.classList.remove('active');
      }
    });

    // Reset modality
    modPills.forEach((p, i) => {
      if (i === 0) {
        p.classList.add('active');
        const r = p.querySelector('input[type="radio"]');
        if (r) r.checked = true;
      } else {
        p.classList.remove('active');
      }
    });

    // Reset priority
    prioTiles.forEach((p, i) => {
      if (i === 0) {
        p.classList.add('active');
        const r = p.querySelector('input[type="radio"]');
        if (r) r.checked = true;
      } else {
        p.classList.remove('active');
      }
    });

    // Clear border colors
    document.querySelectorAll('#ticketModal input, #ticketModal textarea').forEach(el => {
      el.style.borderColor = '';
    });

    goToStep(1);
  }

  // "Crear Otro Ticket" button
  const confNewBtn = document.getElementById('confNewBtn');
  if (confNewBtn) {
    confNewBtn.addEventListener('click', resetStepperForm);
  }

  // Contact Form in Footer (also connected to backend)
  const contactForm = document.getElementById('contactForm');
  if(contactForm) {
    contactForm.addEventListener('submit', async e => {
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
        source: 'Formulario de Contacto'
      };
      
      const btn = contactForm.querySelector('button[type="submit"]');
      const originalText = btn ? btn.innerHTML : '';
      if (btn) btn.innerHTML = '✓ Registrando...';
      
      try {
        const saved = await ticketService.createTicket(ticketData);
        const msg = [
          `*Nuevo Contacto — Fiberlink Servicios TIC*`,
          `*Folio:* ${saved.folio}`,
          `*Nombre:* ${ticketData.name}`,
          `*Teléfono:* ${ticketData.phone}`,
          `*Servicio:* ${ticketData.service}`,
          `*Modalidad:* ${ticketData.modality}`,
          `*Domicilio:* ${ticketData.address}`,
          `*Mensaje:* ${ticketData.description}`,
        ].join('\n');
        
        setTimeout(() => {
          window.open(waUrl(msg), '_blank', 'noopener');
          if (btn) btn.innerHTML = originalText;
          contactForm.reset();
        }, 300);
      } catch (err) {
        console.error('[ContactForm] Error:', err);
        if (btn) btn.innerHTML = originalText;
      }
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
    { id: 'soluciones', selector: '#soluciones' },
    { id: 'catalogo', selector: '#catalogo' },
    { id: 'proceso', selector: '#proceso' },
    { id: 'testimonios', selector: '#testimonios' },
    { id: 'compartir', selector: '#compartir' },
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
    '.nav-desktop a[href^="#"], .drawer-nav a[href^="#"], .dropdown-card[href^="#"], .hero-actions a[href^="#"], a.brand[href^="#"], .scroll-hint[href^="#"]'
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
// DYNAMIC BUTTON GLITCH & RADAR TRIGGER (SILENT)
// ============================
export function triggerButtonGlitch(buttonEl) {
  if (!buttonEl) return;

  // 1. Restart cyber shockwave animation
  buttonEl.classList.remove('btn-cyber-pulse');
  void buttonEl.offsetWidth; // Force reflow
  buttonEl.classList.add('btn-cyber-pulse');

  // 2. Matrix text scramble decode
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

// ============================
// PWA SERVICE WORKER REGISTRATION & STATUS
// ============================
function initPWA() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          reg.addEventListener('updatefound', () => {
            const newWorker = reg.installing;
            if (newWorker) {
              newWorker.addEventListener('statechange', () => {
                if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  console.log('[PWA] Nueva versión disponible');
                }
              });
            }
          });
        })
        .catch((err) => {
          console.warn('[PWA] Service worker registration error:', err);
        });
    });
  }
}

// ============================
// CYBER-CAROUSEL CONTROLLER (SOLUCIONES & CATÁLOGO)
// ============================
function initCyberCarousels() {
  const carousels = document.querySelectorAll('.cyber-carousel');
  if (!carousels.length) return;

  carousels.forEach(carousel => {
    const track = carousel.querySelector('.carousel-track');
    const prevBtn = carousel.querySelector('.carousel-btn.prev');
    const nextBtn = carousel.querySelector('.carousel-btn.next');
    const dotsContainer = carousel.querySelector('.carousel-dots');
    if (!track) return;

    const cards = Array.from(track.children);
    if (!cards.length) return;

    // Dynamically generate navigation dots
    if (dotsContainer) {
      dotsContainer.innerHTML = '';
      cards.forEach((_, idx) => {
        const dot = document.createElement('button');
        dot.type = 'button';
        dot.className = `carousel-dot ${idx === 0 ? 'active' : ''}`;
        dot.setAttribute('aria-label', `Ir al elemento ${idx + 1}`);
        dot.addEventListener('click', () => {
          const cardLeft = cards[idx].offsetLeft - track.offsetLeft;
          track.scrollTo({ left: cardLeft, behavior: 'smooth' });
        });
        dotsContainer.appendChild(dot);
      });
    }

    const dots = dotsContainer ? dotsContainer.querySelectorAll('.carousel-dot') : [];

    // Helper to calculate scroll step
    function getScrollStep() {
      const firstCard = cards[0];
      return firstCard ? firstCard.offsetWidth + 22 : 320;
    }

    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        track.scrollBy({ left: -getScrollStep(), behavior: 'smooth' });
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        track.scrollBy({ left: getScrollStep(), behavior: 'smooth' });
      });
    }

    // Scroll listener to update active dot and button states
    let scrollDebounce;
    track.addEventListener('scroll', () => {
      clearTimeout(scrollDebounce);
      scrollDebounce = setTimeout(() => {
        const scrollLeft = track.scrollLeft;
        let activeIdx = 0;
        let minDiff = Infinity;

        cards.forEach((card, idx) => {
          const cardLeft = card.offsetLeft - track.offsetLeft;
          const diff = Math.abs(cardLeft - scrollLeft);
          if (diff < minDiff) {
            minDiff = diff;
            activeIdx = idx;
          }
        });

        dots.forEach((dot, idx) => {
          dot.classList.toggle('active', idx === activeIdx);
        });

        if (prevBtn) {
          prevBtn.disabled = track.scrollLeft <= 5;
        }
        if (nextBtn) {
          const maxScroll = track.scrollWidth - track.clientWidth;
          nextBtn.disabled = track.scrollLeft >= maxScroll - 5;
        }
      }, 50);
    }, { passive: true });

    // Initial arrow state
    if (prevBtn) prevBtn.disabled = track.scrollLeft <= 5;

    // Desktop Mouse Drag to scroll
    let isDown = false;
    let startX = 0;
    let scrollLeftStart = 0;

    track.addEventListener('mousedown', (e) => {
      // Ignore if clicking on interactive elements inside card
      if (e.target.closest('a, button, input, select, textarea')) return;
      isDown = true;
      track.classList.add('is-dragging');
      startX = e.pageX - track.offsetLeft;
      scrollLeftStart = track.scrollLeft;
    });

    window.addEventListener('mouseup', () => {
      if (!isDown) return;
      isDown = false;
      track.classList.remove('is-dragging');
    });

    track.addEventListener('mousemove', (e) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - track.offsetLeft;
      const walk = (x - startX) * 1.4;
      track.scrollLeft = scrollLeftStart - walk;
    });
  });
}

// ============================
// SOCIAL SHARE & COPY LINK
// ============================
function initSocialShare() {
  const copyBtn = document.getElementById('copyShareLinkBtn');
  const copyText = document.getElementById('copyShareBtnText');
  if (!copyBtn) return;

  copyBtn.addEventListener('click', async () => {
    const url = window.location.origin || 'https://fiberlinkserviciostic.vercel.app';
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const textArea = document.createElement('textarea');
        textArea.value = url;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
      }

      copyBtn.classList.add('copied');
      if (copyText) copyText.textContent = '¡Enlace Copiado! ✓';
      setTimeout(() => {
        copyBtn.classList.remove('copied');
        if (copyText) copyText.textContent = 'Copiar Enlace';
      }, 2500);
    } catch (err) {
      console.warn('[Share] Error al copiar enlace:', err);
    }
  });
}

// ==========================================
// SCROLL-DRIVEN STICKY TEXT REVEAL (LABS)
// Inspired by Jhey Tompkins CodePen EaavNVr
// ==========================================
const LABS_STEPS_DATA = [
  {
    badge: '// MODULE 01: ARCHITECTURE',
    lines: [
      "<span class='c-kw'>const</span> <span class='c-var'>stack</span> = {",
      "<span class='c-prop'>framework</span>: <span class='c-str'>'Next.js + Astro'</span>,",
      "<span class='c-prop'>speed</span>: <span class='c-num'>'0.3s'</span>, <span class='c-prop'>seo</span>: <span class='c-bool'>true</span>",
      "};"
    ],
    tags: ['React 19', 'Next.js', 'Vercel Edge', 'Lighthouse 100']
  },
  {
    badge: '// MODULE 02: RESPONSIVE UX',
    lines: [
      "<span class='c-kw'>const</span> <span class='c-var'>viewport</span> = {",
      "<span class='c-prop'>mobileFirst</span>: <span class='c-bool'>true</span>,",
      "<span class='c-prop'>touchResponse</span>: <span class='c-num'>'120fps'</span>, <span class='c-prop'>pwa</span>: <span class='c-bool'>true</span>",
      "};"
    ],
    tags: ['Mobile First', 'Gesture UI', 'WhatsApp CTA', 'PWA Ready']
  },
  {
    badge: '// MODULE 03: BRAND IDENTITY',
    lines: [
      "<span class='c-kw'>const</span> <span class='c-var'>branding</span> = {",
      "<span class='c-prop'>visualImpact</span>: <span class='c-str'>'Cyber HUD UI'</span>,",
      "<span class='c-prop'>credibility</span>: <span class='c-num'>'100%'</span>, <span class='c-prop'>customTheme</span>: <span class='c-bool'>true</span>",
      "};"
    ],
    tags: ['Diseño a Medida', 'Dark & Light', 'Micro-animaciones', 'Alta Conversión']
  },
  {
    badge: '// MODULE 04: SEO & CONVERSION',
    lines: [
      "<span class='c-kw'>const</span> <span class='c-var'>growth</span> = {",
      "<span class='c-prop'>googleRank</span>: <span class='c-str'>'Top 3 Local'</span>,",
      "<span class='c-prop'>conversions</span>: <span class='c-num'>'x3.4'</span>, <span class='c-prop'>analytics</span>: <span class='c-str'>'GA4'</span>",
      "};"
    ],
    tags: ['Google Search', 'Schema Org', 'Teziutlán SEO', 'Meta Tags']
  },
  {
    badge: '// MODULE 05: FULL SECURITY',
    lines: [
      "<span class='c-kw'>const</span> <span class='c-var'>shield</span> = {",
      "<span class='c-prop'>sslCert</span>: <span class='c-str'>'TLS 1.3 Active'</span>,",
      "<span class='c-prop'>uptime</span>: <span class='c-num'>'99.99%'</span>, <span class='c-prop'>ddosShield</span>: <span class='c-bool'>true</span>",
      "};"
    ],
    tags: ['SSL Gratuito', 'Backup 24/7', 'Cloudflare CDN', 'Soporte Continuo']
  }
];

function initLabsScrollReveal() {
  const section = document.getElementById('fiberlink-labs');
  if (!section) return;

  const viewportEl = section.querySelector('.labs-sticky-viewport');
  const statements = section.querySelectorAll('.reveal-statement');
  if (!statements.length) return;

  const stepNumEl = document.getElementById('labsActiveStepNum');
  const progressBarEl = document.getElementById('labsRevealProgressBar');
  const badgeEl = document.getElementById('labsScreenBadge');
  const codeBlockEl = document.getElementById('labsCodeBlock');
  const tagsRowEl = document.getElementById('labsTagsRow');

  let currentActiveIndex = -1;
  let ticking = false;

  function update() {
    const isMobile = window.innerWidth <= 900;
    const topStickyOffset = isMobile ? 64 : 76;
    const rect = section.getBoundingClientRect();
    const vHeight = (viewportEl && viewportEl.offsetHeight) ? viewportEl.offsetHeight : (window.innerHeight - topStickyOffset);
    const maxStickyScroll = Math.max(1, section.offsetHeight - vHeight);

    // Distance scrolled past sticky onset
    const scrolled = topStickyOffset - rect.top;
    const progress = Math.max(0, Math.min(1, scrolled / maxStickyScroll));

    // Determine active index [0 .. totalSteps - 1]
    const totalSteps = statements.length;
    let activeIndex = Math.floor(progress * totalSteps);
    if (activeIndex >= totalSteps) activeIndex = totalSteps - 1;
    if (activeIndex < 0) activeIndex = 0;

    // Update statements classes
    statements.forEach((stmt, idx) => {
      if (idx < activeIndex) {
        stmt.classList.remove('active');
        stmt.classList.add('prev');
      } else if (idx === activeIndex) {
        stmt.classList.remove('prev');
        stmt.classList.add('active');
      } else {
        stmt.classList.remove('active', 'prev');
      }
    });

    // Update Step Indicator (01 / 05)
    if (stepNumEl) {
      stepNumEl.textContent = String(activeIndex + 1).padStart(2, '0');
    }

    // Update Progress Bar
    if (progressBarEl) {
      const pct = Math.max(10, Math.min(100, Math.round(progress * 100)));
      progressBarEl.style.height = `${pct}%`;
    }

    // Update Mockup Data only when step changes
    if (activeIndex !== currentActiveIndex) {
      currentActiveIndex = activeIndex;
      const data = LABS_STEPS_DATA[activeIndex];
      if (data) {
        if (badgeEl) badgeEl.textContent = data.badge;
        if (codeBlockEl && data.lines) {
          codeBlockEl.innerHTML = data.lines.map((line, lIdx) => 
            `<div class="screen-code-line ${lIdx === 1 || lIdx === 2 ? 'indent' : ''}">${line}</div>`
          ).join('');
        }
        if (tagsRowEl && data.tags) {
          tagsRowEl.innerHTML = data.tags.map(t => `<span class="stag">${t}</span>`).join('');
        }
      }
    }

    ticking = false;
  }

  function requestUpdate() {
    if (!ticking) {
      requestAnimationFrame(update);
      ticking = true;
    }
  }

  window.addEventListener('scroll', requestUpdate, { passive: true });
  window.addEventListener('resize', requestUpdate, { passive: true });
  if (window.lenis) {
    window.lenis.on('scroll', requestUpdate);
  }

  // Initial call
  update();
}



