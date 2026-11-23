// ==========================================================
// FIBERLINK TIC — CRACKED SCREEN EASTER EGG (PANTALLA ESTRELLADA)
// Ultra-realistic hairline glass fractures & procedural audio
// ==========================================================

import './crackedScreen.css';

let overlayEl = null;
let canvasEl = null;
let ctx = null;
let cardEl = null;
let scanlineEl = null;
let lcdLineVEl = null;
let lcdLineHEl = null;
let isCracked = false;
let crackPoints = [];

// Multi-tap trigger configuration
const TAP_THRESHOLD = 4; // 4 rapid taps to trigger
const TAP_WINDOW_MS = 1200; // within 1.2 seconds
const TAP_MAX_DISTANCE = 160; // taps must be relatively close together
let recentTaps = [];

/**
 * Procedural Glass Shatter Sound (Layered Web Audio API)
 */
function playGlassShatterSound() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const actx = new AudioCtx();
    if (actx.state === 'suspended') actx.resume();

    const now = actx.currentTime;

    // 1. Initial mechanical impact snap
    const clickOsc = actx.createOscillator();
    clickOsc.type = 'square';
    clickOsc.frequency.setValueAtTime(1400, now);
    clickOsc.frequency.exponentialRampToValueAtTime(120, now + 0.035);

    const clickGain = actx.createGain();
    clickGain.gain.setValueAtTime(0.7, now);
    clickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);

    clickOsc.connect(clickGain);
    clickGain.connect(actx.destination);
    clickOsc.start(now);
    clickOsc.stop(now + 0.035);

    // 2. High-frequency glass crunch (filtered noise)
    const noiseDuration = 0.28;
    const bufferSize = Math.floor(actx.sampleRate * noiseDuration);
    const noiseBuffer = actx.createBuffer(1, bufferSize, actx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (actx.sampleRate * 0.05));
    }

    const whiteNoise = actx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;

    const bandpass = actx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.setValueAtTime(4200, now);
    bandpass.Q.setValueAtTime(4.5, now);

    const highpass = actx.createBiquadFilter();
    highpass.type = 'highpass';
    highpass.frequency.setValueAtTime(2400, now);

    const noiseGain = actx.createGain();
    noiseGain.gain.setValueAtTime(0.9, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + noiseDuration);

    whiteNoise.connect(bandpass);
    bandpass.connect(highpass);
    highpass.connect(noiseGain);
    noiseGain.connect(actx.destination);
    whiteNoise.start(now);

    // 3. Shimmering crystalline glass resonant harmonics (tinkle)
    [4800, 7200, 9400].forEach((freq, idx) => {
      const osc = actx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.015);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.4, now + 0.18);

      const oscGain = actx.createGain();
      oscGain.gain.setValueAtTime(0.35 / (idx + 1), now + idx * 0.015);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);

      osc.connect(oscGain);
      oscGain.connect(actx.destination);
      osc.start(now + idx * 0.015);
      osc.stop(now + 0.18);
    });
  } catch (err) {
    // AudioContext blocked or not supported
  }
}

/**
 * Procedural Futuristic Repair Sound
 */
function playRepairSound() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const actx = new AudioCtx();
    if (actx.state === 'suspended') actx.resume();

    const now = actx.currentTime;
    const chords = [523.25, 659.25, 783.99, 1046.5, 1318.51]; // C major crystalline arpeggio

    chords.forEach((freq, idx) => {
      const osc = actx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.05);

      const gain = actx.createGain();
      gain.gain.setValueAtTime(0.2, now + idx * 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.05 + 0.25);

      osc.connect(gain);
      gain.connect(actx.destination);
      osc.start(now + idx * 0.05);
      osc.stop(now + idx * 0.05 + 0.25);
    });
  } catch (err) {
    // AudioContext blocked
  }
}

/**
 * Generate fine, realistic hairline crack ray with micro-branches
 */
function generateFineCrackRay(originX, originY, baseAngle, maxRadius) {
  const points = [{ x: originX, y: originY }];
  let currentX = originX;
  let currentY = originY;
  let currentAngle = baseAngle;
  let dist = 0;

  while (dist < maxRadius) {
    // Finer micro-steps (8px to 22px) for authentic jagged glass fracture
    const step = 8 + Math.random() * 14;
    dist += step;

    // Small angular wobble with occasional sharp micro-kinks
    const sharpKink = Math.random() < 0.15 ? (Math.random() < 0.5 ? 0.6 : -0.6) : 0;
    currentAngle += (Math.random() - 0.5) * 0.35 + sharpKink;
    currentX += Math.cos(currentAngle) * step;
    currentY += Math.sin(currentAngle) * step;

    points.push({ x: currentX, y: currentY });

    // Secondary micro-branch (30% chance)
    if (Math.random() < 0.3 && dist < maxRadius * 0.8) {
      const branchAngle = currentAngle + (Math.random() < 0.5 ? 0.75 : -0.75) + (Math.random() - 0.5) * 0.25;
      const branchLength = 18 + Math.random() * 65;
      let bx = currentX;
      let by = currentY;
      let bAngle = branchAngle;
      const branchPoints = [{ x: bx, y: by }];

      for (let b = 0; b < branchLength; b += 10) {
        bAngle += (Math.random() - 0.5) * 0.4;
        bx += Math.cos(bAngle) * 10;
        by += Math.sin(bAngle) * 10;
        branchPoints.push({ x: bx, y: by });
      }
      points.push({ isBranch: true, branchPoints });
    }
  }

  return points;
}

/**
 * Generate full fracture structure for an impact point
 */
function createFractureData(centerX, centerY) {
  const maxDim = Math.max(window.innerWidth, window.innerHeight);

  // 1. Primary long fractures (14 to 20 radial lines)
  const numRays = 16 + Math.floor(Math.random() * 6);
  const rays = [];
  const angleStep = (Math.PI * 2) / numRays;

  for (let i = 0; i < numRays; i++) {
    const angle = i * angleStep + (Math.random() - 0.5) * (angleStep * 0.7);
    const radius = 160 + Math.random() * (maxDim * 0.85);
    rays.push(generateFineCrackRay(centerX, centerY, angle, radius));
  }

  // 2. Short micro-splinters (tightly radiating near impact zone: 25px - 70px)
  const microRays = [];
  for (let m = 0; m < 24; m++) {
    const mAngle = (m / 24) * Math.PI * 2 + (Math.random() - 0.5) * 0.2;
    const mLen = 20 + Math.random() * 55;
    microRays.push(generateFineCrackRay(centerX, centerY, mAngle, mLen));
  }

  // 3. Concentric spiderweb fracture rings (irregular shattered polygons)
  const ringDistances = [14, 28, 48, 78, 120, 180, 260, 360, 480];
  const rings = ringDistances.map(r => {
    const ringRadius = r * (0.85 + Math.random() * 0.3);
    const polygon = [];
    const segments = 20;
    for (let s = 0; s < segments; s++) {
      const theta = (s / segments) * Math.PI * 2;
      const rad = ringRadius * (0.88 + Math.random() * 0.25);
      polygon.push({
        x: centerX + Math.cos(theta) * rad,
        y: centerY + Math.sin(theta) * rad
      });
    }
    return polygon;
  });

  // 4. Detached glass shard facets with subtle refractive distortion
  const shards = [];
  for (let s = 0; s < 6; s++) {
    const theta1 = Math.random() * Math.PI * 2;
    const theta2 = theta1 + 0.22 + Math.random() * 0.35;
    const r1 = 18 + Math.random() * 70;
    const r2 = r1 + 25 + Math.random() * 50;
    shards.push([
      { x: centerX + Math.cos(theta1) * r1, y: centerY + Math.sin(theta1) * r1 },
      { x: centerX + Math.cos(theta2) * r1, y: centerY + Math.sin(theta2) * r1 },
      { x: centerX + Math.cos(theta2) * r2, y: centerY + Math.sin(theta2) * r2 },
      { x: centerX + Math.cos(theta1) * r2, y: centerY + Math.sin(theta1) * r2 }
    ]);
  }

  return { centerX, centerY, rays, microRays, rings, shards };
}

/**
 * Render fine, ultra-realistic glass fractures onto Canvas
 */
function renderCracks() {
  if (!ctx || !canvasEl) return;
  const w = canvasEl.width;
  const h = canvasEl.height;
  ctx.clearRect(0, 0, w, h);

  crackPoints.forEach(fracture => {
    const { centerX, centerY, rays, microRays, rings, shards } = fracture;

    // A. Shard facet fills (semi-translucent reflective glass plates)
    shards.forEach((poly, idx) => {
      ctx.beginPath();
      ctx.moveTo(poly[0].x, poly[0].y);
      for (let i = 1; i < poly.length; i++) {
        ctx.lineTo(poly[i].x, poly[i].y);
      }
      ctx.closePath();
      // Slight alternating refractive glass sheen
      ctx.fillStyle = idx % 2 === 0 ? 'rgba(255, 255, 255, 0.055)' : 'rgba(0, 240, 255, 0.035)';
      ctx.fill();
    });

    // B. Spiderweb Concentric Rings
    rings.forEach(ring => {
      // 1. Deep crack shadow (sub-surface absorption)
      ctx.beginPath();
      ctx.moveTo(ring[0].x, ring[0].y);
      for (let i = 1; i < ring.length; i++) {
        ctx.lineTo(ring[i].x, ring[i].y);
      }
      ctx.closePath();
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.lineWidth = 1.6;
      ctx.stroke();

      // 2. Razor-sharp specular highlight on edge
      ctx.beginPath();
      ctx.moveTo(ring[0].x - 0.5, ring[0].y - 0.5);
      for (let i = 1; i < ring.length; i++) {
        ctx.lineTo(ring[i].x - 0.5, ring[i].y - 0.5);
      }
      ctx.closePath();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.lineWidth = 0.75;
      ctx.stroke();
    });

    // C. Radial Primary Rays & Micro-branches
    const allRays = [...rays, ...microRays];

    allRays.forEach(ray => {
      // 1. Dark hairline shadow pass
      ctx.beginPath();
      ctx.moveTo(ray[0].x, ray[0].y);
      for (let i = 1; i < ray.length; i++) {
        const p = ray[i];
        if (p.isBranch) {
          ctx.moveTo(p.branchPoints[0].x, p.branchPoints[0].y);
          for (let b = 1; b < p.branchPoints.length; b++) {
            ctx.lineTo(p.branchPoints[b].x, p.branchPoints[b].y);
          }
          ctx.moveTo(ray[i - 1].x, ray[i - 1].y);
        } else {
          ctx.lineTo(p.x, p.y);
        }
      }
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.88)';
      ctx.lineWidth = 1.8;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();

      // 2. Razor-sharp specular glass edge (white reflection)
      ctx.beginPath();
      ctx.moveTo(ray[0].x - 0.6, ray[0].y - 0.6);
      for (let i = 1; i < ray.length; i++) {
        const p = ray[i];
        if (p.isBranch) {
          ctx.moveTo(p.branchPoints[0].x - 0.6, p.branchPoints[0].y - 0.6);
          for (let b = 1; b < p.branchPoints.length; b++) {
            ctx.lineTo(p.branchPoints[b].x - 0.6, p.branchPoints[b].y - 0.6);
          }
          ctx.moveTo(ray[i - 1].x - 0.6, ray[i - 1].y - 0.6);
        } else {
          ctx.lineTo(p.x - 0.6, p.y - 0.6);
        }
      }
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.98)';
      ctx.lineWidth = 0.85;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();

      // 3. Chromatic dispersion fringe (delicate cyan / magenta optical dispersion)
      ctx.beginPath();
      ctx.moveTo(ray[0].x + 0.5, ray[0].y + 0.5);
      for (let i = 1; i < Math.min(ray.length, 10); i++) {
        const p = ray[i];
        if (!p.isBranch) ctx.lineTo(p.x + 0.5, p.y + 0.5);
      }
      ctx.strokeStyle = 'rgba(0, 240, 255, 0.35)';
      ctx.lineWidth = 0.6;
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(ray[0].x - 0.5, ray[0].y + 0.5);
      for (let i = 1; i < Math.min(ray.length, 7); i++) {
        const p = ray[i];
        if (!p.isBranch) ctx.lineTo(p.x - 0.5, p.y + 0.5);
      }
      ctx.strokeStyle = 'rgba(255, 60, 180, 0.25)';
      ctx.lineWidth = 0.5;
      ctx.stroke();
    });

    // D. Crushed glass impact epicenter (opaque milky white crater + micro-needles)
    const craterGrad = ctx.createRadialGradient(centerX, centerY, 1, centerX, centerY, 20);
    craterGrad.addColorStop(0, 'rgba(255, 255, 255, 0.98)');
    craterGrad.addColorStop(0.25, 'rgba(255, 255, 255, 0.82)');
    craterGrad.addColorStop(0.65, 'rgba(215, 230, 240, 0.38)');
    craterGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.beginPath();
    ctx.arc(centerX, centerY, 20, 0, Math.PI * 2);
    ctx.fillStyle = craterGrad;
    ctx.fill();

    // 40 Dense micro-needles radiating from the crushed core
    for (let k = 0; k < 40; k++) {
      const spikeAngle = (k / 40) * Math.PI * 2 + (Math.random() - 0.5) * 0.15;
      const spikeLen = 6 + Math.random() * 22;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(
        centerX + Math.cos(spikeAngle) * spikeLen,
        centerY + Math.sin(spikeAngle) * spikeLen
      );
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.lineWidth = 0.9;
      ctx.stroke();
    }
  });
}

/**
 * Handle Screen Shatter trigger
 */
function crackScreen(x, y) {
  if (!overlayEl) setupDOM();

  const rect = overlayEl.getBoundingClientRect();
  const relX = x || rect.width / 2;
  const relY = y || rect.height / 2;

  // Add fine impact point
  crackPoints.push(createFractureData(relX, relY));

  // Align AMOLED/LCD glitch line with latest impact
  if (lcdLineVEl) lcdLineVEl.style.left = `${relX}px`;
  if (lcdLineHEl) lcdLineHEl.style.top = `${relY}px`;

  // Audio & Haptic feedback
  playGlassShatterSound();
  if (navigator.vibrate) {
    navigator.vibrate([45, 25, 80]);
  }

  // Screen shake animation
  document.body.classList.remove('screen-shatter-active');
  void document.body.offsetWidth; // trigger reflow
  document.body.classList.add('screen-shatter-active');
  setTimeout(() => {
    document.body.classList.remove('screen-shatter-active');
  }, 340);

  // Resize canvas to viewport and render
  resizeCanvas();
  renderCracks();

  // Show overlay and repair card
  overlayEl.classList.add('active');
  cardEl.classList.add('visible');
  isCracked = true;
}

/**
 * Repair Screen (Laser scan restore effect)
 */
function repairScreen() {
  if (!isCracked) return;

  playRepairSound();

  // Trigger laser scan animation
  scanlineEl.classList.remove('scanning');
  void scanlineEl.offsetWidth;
  scanlineEl.classList.add('scanning');

  // Fade out repair card
  cardEl.classList.remove('visible');

  // Smooth fade out of canvas cracks
  let opacity = 1;
  const fadeInterval = setInterval(() => {
    opacity -= 0.12;
    if (opacity <= 0) {
      clearInterval(fadeInterval);
      crackPoints = [];
      if (ctx) ctx.clearRect(0, 0, canvasEl.width, canvasEl.height);
      overlayEl.classList.remove('active');
      scanlineEl.classList.remove('scanning');
      isCracked = false;
    } else {
      if (overlayEl) overlayEl.style.opacity = opacity;
    }
  }, 35);

  setTimeout(() => {
    if (overlayEl) overlayEl.style.opacity = '';
  }, 500);
}

/**
 * Handle taps / clicks on document
 */
function handlePointerDown(e) {
  // If clicking directly inside the repair card, ignore tap-to-crack
  if (e.target && e.target.closest('.cracked-repair-card')) {
    return;
  }

  // If already cracked, tapping anywhere adds another fine crack!
  if (isCracked) {
    if (crackPoints.length < 6) {
      crackScreen(e.clientX, e.clientY);
    }
    return;
  }

  // Ignore typing inside form inputs/textareas
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable)) {
    return;
  }

  const now = Date.now();
  const tap = { x: e.clientX, y: e.clientY, time: now };

  // Filter recent taps within the time window
  recentTaps = recentTaps.filter(t => now - t.time <= TAP_WINDOW_MS);

  // Check if tap is close enough to previous taps
  if (recentTaps.length > 0) {
    const lastTap = recentTaps[recentTaps.length - 1];
    const dist = Math.hypot(tap.x - lastTap.x, tap.y - lastTap.y);
    if (dist > TAP_MAX_DISTANCE) {
      recentTaps = []; // reset if tapped too far away
    }
  }

  recentTaps.push(tap);

  // Check if threshold reached
  if (recentTaps.length >= TAP_THRESHOLD) {
    const avgX = recentTaps.reduce((sum, t) => sum + t.x, 0) / recentTaps.length;
    const avgY = recentTaps.reduce((sum, t) => sum + t.y, 0) / recentTaps.length;
    recentTaps = [];
    crackScreen(avgX, avgY);
  }
}

/**
 * Resize Canvas properly for high-DPI (Retina) displays
 */
function resizeCanvas() {
  if (!canvasEl) return;
  const dpr = window.devicePixelRatio || 1;
  const width = window.innerWidth;
  const height = window.innerHeight;

  canvasEl.width = width * dpr;
  canvasEl.height = height * dpr;
  canvasEl.style.width = `${width}px`;
  canvasEl.style.height = `${height}px`;

  if (ctx) {
    ctx.scale(dpr, dpr);
  }
}

/**
 * Create DOM Elements with customized Fiberlink repair messaging
 */
function setupDOM() {
  if (overlayEl) return;

  // Overlay wrapper
  overlayEl = document.createElement('div');
  overlayEl.id = 'crackedScreenOverlay';
  overlayEl.className = 'cracked-screen-overlay';

  // Canvas
  canvasEl = document.createElement('canvas');
  canvasEl.className = 'cracked-screen-canvas';
  ctx = canvasEl.getContext('2d');
  overlayEl.appendChild(canvasEl);

  // AMOLED / LCD dead-pixel lines passing through impact
  lcdLineVEl = document.createElement('div');
  lcdLineVEl.className = 'cracked-lcd-line-v';
  overlayEl.appendChild(lcdLineVEl);

  lcdLineHEl = document.createElement('div');
  lcdLineHEl.className = 'cracked-lcd-line-h';
  overlayEl.appendChild(lcdLineHEl);

  // Laser scanline for repair
  scanlineEl = document.createElement('div');
  scanlineEl.className = 'repair-scanline';
  overlayEl.appendChild(scanlineEl);

  // Notification repair card with exact requested message:
  // "Reparación de pantallas, sistema de carga, software, liberaciones en Teziutlán."
  cardEl = document.createElement('div');
  cardEl.className = 'cracked-repair-card';
  cardEl.innerHTML = `
    <div class="cracked-repair-header">
      <div class="cracked-repair-icon" aria-hidden="true">
        <span class="material-symbols-outlined text-[24px]">screen_lock_portrait</span>
      </div>
      <div class="min-w-0 flex-1">
        <div class="cracked-repair-title">
          <span>¡Pantalla fracturada simulada!</span>
          <span class="cracked-repair-badge">Simulación</span>
        </div>
        <div class="cracked-repair-desc">
          Reparación de pantallas, sistema de carga, software, liberaciones en Teziutlán.
        </div>
        <div class="cracked-tags-list">
          <span class="cracked-tag-item"><span class="material-symbols-outlined text-[12px]">smartphone</span>Pantallas</span>
          <span class="cracked-tag-item"><span class="material-symbols-outlined text-[12px]">battery_charging_full</span>Sistema de Carga</span>
          <span class="cracked-tag-item"><span class="material-symbols-outlined text-[12px]">terminal</span>Software</span>
          <span class="cracked-tag-item"><span class="material-symbols-outlined text-[12px]">lock_open</span>Liberaciones</span>
        </div>
      </div>
    </div>
    <div class="cracked-repair-actions">
      <button type="button" id="btnRepairScreen" class="cracked-btn-repair">
        <span class="material-symbols-outlined text-[17px]">build</span>
        <span>Reparar pantalla</span>
      </button>
      <a href="https://wa.me/522311024672?text=Hola%20Fiberlink%2C%20necesito%20reparacion%20de%20pantalla%2C%20sistema%20de%20carga%2C%20software%20o%20liberacion%20en%20Teziutlan." target="_blank" rel="noopener noreferrer" id="btnCrackedHelp" class="cracked-btn-support">
        <span class="material-symbols-outlined text-[16px] text-neon-emerald">chat</span>
        <span>Cotizar Servicio</span>
      </a>
    </div>
  `;
  document.body.appendChild(overlayEl);
  document.body.appendChild(cardEl);

  // Bind buttons
  const btnRepair = cardEl.querySelector('#btnRepairScreen');
  if (btnRepair) {
    btnRepair.addEventListener('click', (e) => {
      e.stopPropagation();
      repairScreen();
    });
  }

  const btnHelp = cardEl.querySelector('#btnCrackedHelp');
  if (btnHelp) {
    btnHelp.addEventListener('click', () => {
      repairScreen();
    });
  }

  // ESC key repairs screen
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && isCracked) {
      repairScreen();
    }
  });

  // Handle window resize
  window.addEventListener('resize', () => {
    if (isCracked) {
      resizeCanvas();
      renderCracks();
    }
  });
}

/**
 * Public Initialization
 */
export function initCrackedScreen() {
  setupDOM();
  document.addEventListener('pointerdown', handlePointerDown, { passive: true });

  // Expose on window for easy developer testing
  window.fiberlinkEasterEgg = {
    crack: (x, y) => crackScreen(x, y),
    repair: () => repairScreen()
  };
}
