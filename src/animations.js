import gsap from 'gsap';
import ScrollTrigger from 'gsap/ScrollTrigger';
import Lenis from 'lenis';

gsap.registerPlugin(ScrollTrigger);

export function initAnimations() {
  // 1. Lenis Smooth Scroll
  const lenis = new Lenis({
    duration: 1.2,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
    orientation: 'vertical',
    gestureOrientation: 'vertical',
    smoothWheel: true,
    wheelMultiplier: 1,
    touchMultiplier: 2,
  });

  lenis.on('scroll', ScrollTrigger.update);

  gsap.ticker.add((time) => {
    lenis.raf(time * 1000);
  });
  gsap.ticker.lagSmoothing(0);

  // 2. Reveal Animations (Staggered fade up)
  const revealElements = document.querySelectorAll('.reveal');
  revealElements.forEach((el) => {
    let xOffset = 0;
    let scaleOffset = 1;
    
    if(el.classList.contains('from-left')) xOffset = -50;
    if(el.classList.contains('from-right')) xOffset = 50;
    if(el.classList.contains('from-scale')) scaleOffset = 0.9;

    gsap.fromTo(el, 
      { 
        y: 40, 
        x: xOffset,
        scale: scaleOffset,
        opacity: 0 
      },
      {
        y: 0,
        x: 0,
        scale: 1,
        opacity: 1,
        duration: 1,
        ease: "power3.out",
        scrollTrigger: {
          trigger: el,
          start: "top 85%",
          toggleActions: "play none none none"
        }
      }
    );
  });

  // 3. Parallax elements
  const parallaxEls = document.querySelectorAll('[data-parallax]');
  parallaxEls.forEach(el => {
    const speed = el.getAttribute('data-parallax') || 1;
    gsap.to(el, {
      y: () => -100 * speed,
      ease: "none",
      scrollTrigger: {
        trigger: el,
        start: "top bottom",
        end: "bottom top",
        scrub: true
      }
    });
  });

  // 4. Header blur effect on scroll
  const header = document.querySelector('.site-header');
  if (header) {
    ScrollTrigger.create({
      start: 'top -50',
      onUpdate: (self) => {
        if (self.direction === 1) {
          header.classList.add('scrolled');
        } else if (self.progress === 0) {
          header.classList.remove('scrolled');
        }
      }
    });
  }

  // 5. Scroll Progress Bar
  gsap.to('#sp-fill', {
    width: "100%",
    ease: "none",
    scrollTrigger: {
      trigger: document.body,
      start: "top top",
      end: "bottom bottom",
      scrub: 0.3
    }
  });

  // 6. Magnetic Buttons
  const magneticEls = document.querySelectorAll('.magnetic');
  magneticEls.forEach(btn => {
    btn.addEventListener('mousemove', (e) => {
      const rect = btn.getBoundingClientRect();
      const h = rect.width / 2;
      const x = e.clientX - rect.left - h;
      const y = e.clientY - rect.top - (rect.height / 2);
      
      gsap.to(btn, {
        x: x * 0.3,
        y: y * 0.3,
        duration: 0.4,
        ease: "power2.out"
      });
    });

    btn.addEventListener('mouseleave', () => {
      gsap.to(btn, {
        x: 0,
        y: 0,
        duration: 0.7,
        ease: "elastic.out(1, 0.3)"
      });
    });
  });

  // 7. Hero stat counter animation ("4" animates from 0)
  const numStat = document.querySelector('.hstat-num[style*="color:var(--c)"]');
  if (numStat && !isNaN(parseInt(numStat.textContent))) {
    const target = parseInt(numStat.textContent);
    ScrollTrigger.create({
      trigger: '.hero-stats',
      start: 'top 88%',
      once: true,
      onEnter: () => {
        let frame = 0;
        const total = 60;
        const tick = () => {
          frame++;
          const t = frame / total;
          const eased = 1 - Math.pow(1 - t, 3);
          numStat.textContent = Math.round(target * eased);
          if (frame < total) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      }
    });
  }

  // 8. Hero orbs multilayer parallax
  gsap.to('.hero-orb-1', {
    y: -70, ease: 'none',
    scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 1 }
  });
  gsap.to('.hero-orb-2', {
    y: -45, x: 25, ease: 'none',
    scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 1.4 }
  });
  gsap.to('.hero-orb-3', {
    y: -30, ease: 'none',
    scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: 1.8 }
  });

  // 9. Active section detector for drawer nav
  const drawerLinks = document.querySelectorAll('.drawer-nav .dl');
  const sectionIds = ['inicio', 'servicios', 'herramientas', 'proceso', 'fiberlink-labs', 'contacto'];
  if (drawerLinks.length && 'IntersectionObserver' in window) {
    const sectionObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          drawerLinks.forEach(link => {
            const href = link.getAttribute('href')?.replace('#', '');
            link.classList.toggle('nav-active', href === id);
          });
        }
      });
    }, { rootMargin: '-25% 0px -65% 0px' });

    sectionIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) sectionObserver.observe(el);
    });
  }
}
