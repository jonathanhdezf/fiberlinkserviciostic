// ==========================================================
// FIBERLINK TIC — CRACKED SCREEN EASTER EGG (PANTALLA ESTRELLADA)
// Multi-tap trigger with realistic procedural glass fractures
// ==========================================================

import './crackedScreen.css';

let overlayEl = null;
let canvasEl = null;
let ctx = null;
let cardEl = null;
let scanlineEl = null;
let isCracked = false;
let crackPoints = [];

// Tap tracking
const TAP_THRESHOLD = 4; // 4 rapid taps to trigger
const TAP_WINDOW_MS = 1200; // within 1.2 seconds
const TAP_MAX_DISTANCE = 160; // taps must be relatively close together
let recentTaps = [];

/**
 * Procedural Glass Shatter Sound (Web Audio API)
 */
function playGlassShatterSound() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const actx = new AudioCtx();
    if (actx.state === 'suspended') actx.resume();

    const now = actx.currentTime;

    // 1. White noise burst for initial crunch
    const noiseDuration = 0.22;
    const bufferSize = Math.floor(actx.sampleRate * noiseDuration);
    const noiseBuffer = actx.createBuffer(1, bufferSize, actx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (actx.sampleRate * 0.04));
    }

    const whiteNoise = actx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;

    // High resonant bandpass filter (glass crunch)
    const filter = actx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(3600, now);
    filter.Q.setValueAtTime(5, now);

    const noiseGain = actx.createGain();
    noiseGain.gain.setValueAtTime(0.85, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, now + noiseDuration);

    whiteNoise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(actx.destination);
    whiteNoise.start(now);

    // 2. High-pitched crystalline ping/resonance
    const osc = actx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(5200, now);
    osc.frequency.exponentialRampToValueAtTime(1600, now + 0.16);

    const oscGain = actx.createGain();
    oscGain.gain.setValueAtTime(0.4, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);

    osc.connect(oscGain);
    oscGain.connect(actx.destination);
    osc.start(now);
    osc.stop(now + 0.16);
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
    const frequencies = [440, 554.37, 659.25, 880, 1108.73]; // High tech chord arpeggio

    frequencies.forEach((freq, idx) => {
      const osc = actx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.06);

      const gain = actx.createGain();
      gain.gain.setValueAtTime(0.18, now + idx * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.22);

      osc.connect(gain);
      gain.connect(actx.destination);
      osc.start(now + idx * 0.06);
      osc.stop(now + idx * 0.06 + 0.22);
    });
  } catch (err) {
    // AudioContext blocked
  }
}

/**
 * Generate a single jagged crack ray
 */
function generateCrackRay(originX, originY, baseAngle, maxRadius) {
  const points = [{ x: originX, y: originY }];
  let currentX = originX;
  let currentY = originY;
  let currentAngle = baseAngle;
  let dist = 0;

  while (dist < maxRadius) {
    const step = 16 + Math.random() * 26;
    dist += step;
    currentAngle += (Math.random() - 0.5) * 0.45; // slight jagged deviation
    currentX += Math.cos(currentAngle) * step;
    currentY += Math.sin(currentAngle) * step;

    points.push({ x: currentX, y: currentY });

    // 25% chance to create a side branch
    if (Math.random() < 0.25 && dist < maxRadius * 0.75) {
      const branchAngle = currentAngle + (Math.random() < 0.5 ? 0.7 : -0.7) + (Math.random() - 0.5) * 0.3;
      const branchLength = 30 + Math.random() * 80;
      let bx = currentX;
      let by = currentY;
      let bAngle = branchAngle;
      const branchPoints = [{ x: bx, y: by }];

      for (let b = 0; b < branchLength; b += 18) {
        bAngle += (Math.random() - 0.5) * 0.4;
        bx += Math.cos(bAngle) * 18;
        by += Math.sin(bAngle) * 18;
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
  const numRays = 12 + Math.floor(Math.random() * 7); // 12 to 18 rays
  const maxDim = Math.max(window.innerWidth, window.innerHeight);
  const rays = [];
  const angleStep = (Math.PI * 2) / numRays;

  for (let i = 0; i < numRays; i++) {
    const angle = i * angleStep + (Math.random() - 0.5) * (angleStep * 0.65);
    const radius = 180 + Math.random() * (maxDim * 0.8);
    rays.push(generateCrackRay(centerX, centerY, angle, radius));
  }

  // Concentric spiderweb rings
  const ringDistances = [22, 50, 90, 145, 220, 310, 420];
  const rings = ringDistances.map(r => {
    const ringRadius = r * (0.8 + Math.random() * 0.4);
    const polygon = [];
    const segments = 16;
    for (let s = 0; s < segments; s++) {
      const theta = (s / segments) * Math.PI * 2;
      const rad = ringRadius * (0.85 + Math.random() * 0.3);
      polygon.push({
        x: centerX + Math.cos(theta) * rad,
        y: centerY + Math.sin(theta) * rad
      });
    }
    return polygon;
  });

  // Random detached shard highlights
  const shards = [];
  for (let s = 0; s < 4; s++) {
    const theta1 = Math.random() * Math.PI * 2;
    const theta2 = theta1 + 0.3 + Math.random() * 0.4;
    const r1 = 30 + Math.random() * 90;
    const r2 = r1 + 35 + Math.random() * 60;
    shards.push([
      { x: centerX + Math.cos(theta1) * r1, y: centerY + Math.sin(theta1) * r1 },
      { x: centerX + Math.cos(theta2) * r1, y: centerY + Math.sin(theta2) * r1 },
      { x: centerX + Math.cos(theta2) * r2, y: centerY + Math.sin(theta2) * r2 },
      { x: centerX + Math.cos(theta1) * r2, y: centerY + Math.sin(theta1) * r2 }
    ]);
  }

  return { centerX, centerY, rays, rings, shards };
}

/**
 * Render all fracture data onto Canvas
 */
function renderCracks() {
  if (!ctx || !canvasEl) return;
  const w = canvasEl.width;
  const h = canvasEl.height;
  ctx.clearRect(0, 0, w, h);

  crackPoints.forEach(fracture => {
    const { centerX, centerY, rays, rings, shards } = fracture;

    // 1. Shard facet fills (subtle reflective glass distortion)
    shards.forEach(poly => {
      ctx.beginPath();
      ctx.moveTo(poly[0].x, poly[0].y);
      for (let i = 1; i < poly.length; i++) {
        ctx.lineTo(poly[i].x, poly[i].y);
      }
      ctx.closePath();
      ctx.fillStyle = 'rgba(255, 255, 255, 0.055)';
      ctx.fill();
    });

    // 2. Draw rings (dark base then white specular highlight)
    rings.forEach(ring => {
      // Dark crack shadow
      ctx.beginPath();
      ctx.moveTo(ring[0].x, ring[0].y);
      for (let i = 1; i < ring.length; i++) {
        ctx.lineTo(ring[i].x, ring[i].y);
      }
      ctx.closePath();
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.75)';
      ctx.lineWidth = 2.2;
      ctx.stroke();

      // Bright specular reflection
      ctx.beginPath();
      ctx.moveTo(ring[0].x - 0.7, ring[0].y - 0.7);
      for (let i = 1; i < ring.length; i++) {
        ctx.lineTo(ring[i].x - 0.7, ring[i].y - 0.7);
      }
      ctx.closePath();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.88)';
      ctx.lineWidth = 1.1;
      ctx.stroke();
    });

    // 3. Draw radial fracture rays & branches
    rays.forEach(ray => {
      // Shadow pass
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
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.8)';
      ctx.lineWidth = 2.5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();

      // Specular highlight pass
      ctx.beginPath();
      ctx.moveTo(ray[0].x - 0.8, ray[0].y - 0.8);
      for (let i = 1; i < ray.length; i++) {
        const p = ray[i];
        if (p.isBranch) {
          ctx.moveTo(p.branchPoints[0].x - 0.8, p.branchPoints[0].y - 0.8);
          for (let b = 1; b < p.branchPoints.length; b++) {
            ctx.lineTo(p.branchPoints[b].x - 0.8, p.branchPoints[b].y - 0.8);
          }
          ctx.moveTo(ray[i - 1].x - 0.8, ray[i - 1].y - 0.8);
        } else {
          ctx.lineTo(p.x - 0.8, p.y - 0.8);
        }
      }
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.lineWidth = 1.2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();

      // Faint chromatic aberration pass (cyan/emerald touch)
      ctx.beginPath();
      ctx.moveTo(ray[0].x + 0.6, ray[0].y + 0.6);
      for (let i = 1; i < Math.min(ray.length, 6); i++) {
        const p = ray[i];
        if (!p.isBranch) ctx.lineTo(p.x + 0.6, p.y + 0.6);
      }
      ctx.strokeStyle = 'rgba(0, 255, 200, 0.4)';
      ctx.lineWidth = 0.8;
      ctx.stroke();
    });

    // 4. Crushed glass impact epicenter (opaque milky white crater)
    const grad = ctx.createRadialGradient(centerX, centerY, 2, centerX, centerY, 24);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.96)');
    grad.addColorStop(0.3, 'rgba(255, 255, 255, 0.7)');
    grad.addColorStop(0.7, 'rgba(200, 220, 230, 0.35)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');

    ctx.beginPath();
    ctx.arc(centerX, centerY, 24, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.fill();

    // Dense tiny radial impact spikes
    for (let k = 0; k < 20; k++) {
      const spikeAngle = (k / 20) * Math.PI * 2 + Math.random() * 0.2;
      const spikeLen = 8 + Math.random() * 20;
      ctx.beginPath();
      ctx.moveTo(centerX, centerY);
      ctx.lineTo(
        centerX + Math.cos(spikeAngle) * spikeLen,
        centerY + Math.sin(spikeAngle) * spikeLen
      );
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.lineWidth = 1.5;
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

  // Add impact point
  crackPoints.push(createFractureData(relX, relY));

  // Audio & Haptic feedback
  playGlassShatterSound();
  if (navigator.vibrate) {
    navigator.vibrate([40, 25, 75]);
  }

  // Screen shake animation
  document.body.classList.remove('screen-shatter-active');
  void document.body.offsetWidth; // trigger reflow
  document.body.classList.add('screen-shatter-active');
  setTimeout(() => {
    document.body.classList.remove('screen-shatter-active');
  }, 320);

  // Resize canvas to viewport
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

  // Fade out canvas cracks
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
  }, 40);

  setTimeout(() => {
    if (overlayEl) overlayEl.style.opacity = '';
  }, 500);
}

/**
 * Handle taps / clicks on document
 */
function handlePointerDown(e) {
  // If clicking directly on repair buttons, ignore tap-to-crack
  if (e.target && e.target.closest('.cracked-repair-card')) {
    return;
  }

  // If already cracked, tapping anywhere adds another crack!
  if (isCracked) {
    if (crackPoints.length < 6) {
      crackScreen(e.clientX, e.clientY);
    }
    return;
  }

  // Ignore typing inside inputs/textareas
  if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA')) {
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
 * Resize Canvas properly for high-DPI displays
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
 * Create DOM Elements
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

  // Laser scanline for repair
  scanlineEl = document.createElement('div');
  scanlineEl.className = 'repair-scanline';
  overlayEl.appendChild(scanlineEl);

  // Notification repair card
  cardEl = document.createElement('div');
  cardEl.className = 'cracked-repair-card';
  cardEl.innerHTML = `
    <div class="cracked-repair-header">
      <div class="cracked-repair-icon" aria-hidden="true">
        <span class="material-symbols-outlined text-[24px]">broken_image</span>
      </div>
      <div class="min-w-0">
        <div class="cracked-repair-title">¡Pantalla fracturada simulada! ⚡</div>
        <div class="cracked-repair-desc">¿Accidente en tu equipo? En Fiberlink reparamos pantallas, computadoras y redes en Teziutlán.</div>
      </div>
    </div>
    <div class="cracked-repair-actions">
      <button type="button" id="btnRepairScreen" class="cracked-btn-repair">
        <span class="material-symbols-outlined text-[17px]">build</span>
        <span>Reparar pantalla</span>
      </button>
      <a href="#asistencia-expres" id="btnCrackedHelp" class="cracked-btn-support">
        <span>Soporte Técnico</span>
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
    btnHelp.addEventListener('click', (e) => {
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

  // Expose on window for testing or manual trigger
  window.fiberlinkEasterEgg = {
    crack: (x, y) => crackScreen(x, y),
    repair: () => repairScreen()
  };
}
