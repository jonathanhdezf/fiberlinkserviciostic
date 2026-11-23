// ==========================================================
// FIBERLINK TIC — CRACKED SCREEN EASTER EGG (PANTALLA ESTRELLADA)
// Ultra-realistic hairline glass fractures & procedural audio
// ==========================================================

import './crackedScreen.css';
import {
  DEFAULT_GLASS_PRESETS,
  getCachedActiveSound,
  playCrackedSound,
  soundLibraryService
} from './services/soundLibraryService.js';

let overlayEl = null;
let canvasEl = null;
let ctx = null;
let glitchCanvasEl = null;
let glitchCtx = null;
let vignetteEl = null;
let cardEl = null;
let scanlineEl = null;
let lcdLineVEl = null;
let lcdLineHEl = null;
let isCracked = false;
let crackPoints = [];
let flickerRafId = null;
let lastGlitchDraw = 0;
let activeCrackSound = getCachedActiveSound() || DEFAULT_GLASS_PRESETS[0];
let activeSoundUnsub = null;

// Multi-tap trigger configuration
const TAP_THRESHOLD = 4; // 4 rapid taps to trigger
const TAP_WINDOW_MS = 1200; // within 1.2 seconds
const TAP_MAX_DISTANCE = 160; // taps must be relatively close together
let recentTaps = [];

/**
 * Play Active Shatter Sound (Synced from Firestore Admin Sound Library)
 */
function playGlassShatterSound() {
  try {
    playCrackedSound(activeCrackSound);
  } catch (_) {
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

  // 4. Detached glass shard facets (mix of darkened dead OLED shards & subtle refractive glass)
  const shards = [];
  for (let s = 0; s < 9; s++) {
    const theta1 = Math.random() * Math.PI * 2;
    const theta2 = theta1 + 0.18 + Math.random() * 0.34;
    const r1 = 10 + Math.random() * 68;
    const r2 = r1 + 22 + Math.random() * 64;
    shards.push({
      isDeadShard: s < 4,
      points: [
        { x: centerX + Math.cos(theta1) * r1, y: centerY + Math.sin(theta1) * r1 },
        { x: centerX + Math.cos(theta2) * r1, y: centerY + Math.sin(theta2) * r1 },
        { x: centerX + Math.cos(theta2) * r2, y: centerY + Math.sin(theta2) * r2 },
        { x: centerX + Math.cos(theta1) * r2, y: centerY + Math.sin(theta1) * r2 }
      ]
    });
  }

  // 5. Organic OLED/LCD dead liquid-crystal ink-bleed blotches ("manchas negras")
  const inkBlots = [];
  // Primary epicenter ink bleed (irregular overlapping dark lobes)
  const mainLobes = 5 + Math.floor(Math.random() * 4);
  for (let b = 0; b < mainLobes; b++) {
    const ang = (b / mainLobes) * Math.PI * 2 + (Math.random() - 0.5) * 0.6;
    const dist = 6 + Math.random() * 24;
    inkBlots.push({
      x: centerX + Math.cos(ang) * dist,
      y: centerY + Math.sin(ang) * dist,
      rx: 12 + Math.random() * 24,
      ry: 8 + Math.random() * 18,
      rot: ang,
      halo: Math.random() < 0.65 ? 'rgba(92, 34, 180, 0.34)' : 'rgba(0, 175, 220, 0.25)'
    });
  }
  // Secondary dark ink pockets seeping along fracture rays
  for (let s = 0; s < 3; s++) {
    const ang = Math.random() * Math.PI * 2;
    const dist = 42 + Math.random() * 88;
    inkBlots.push({
      x: centerX + Math.cos(ang) * dist,
      y: centerY + Math.sin(ang) * dist,
      rx: 7 + Math.random() * 14,
      ry: 4 + Math.random() * 9,
      rot: ang + 0.3,
      halo: 'rgba(65, 25, 130, 0.28)'
    });
  }

  // 6. Crushed crater micro-needles (precomputed so resize preserves exact pattern)
  const needles = [];
  for (let k = 0; k < 36; k++) {
    const spikeAngle = (k / 36) * Math.PI * 2 + (Math.random() - 0.5) * 0.16;
    const spikeLen = 6 + Math.random() * 20;
    needles.push({
      x1: centerX + Math.cos(spikeAngle) * 3,
      y1: centerY + Math.sin(spikeAngle) * 3,
      x2: centerX + Math.cos(spikeAngle) * spikeLen,
      y2: centerY + Math.sin(spikeAngle) * spikeLen,
      alpha: 0.45 + Math.random() * 0.42
    });
  }

  return { centerX, centerY, rays, microRays, rings, shards, inkBlots, needles };
}

/**
 * Render realistic dark glass fractures & dead liquid-crystal ink onto Canvas
 */
function renderCracks() {
  if (!ctx || !canvasEl) return;
  const width = window.innerWidth;
  const height = window.innerHeight;
  ctx.clearRect(0, 0, width, height);

  crackPoints.forEach(fracture => {
    const { centerX, centerY, rays, microRays, rings, shards, inkBlots, needles } = fracture;

    // A. Dead liquid-crystal shards & subtle refractive glass facets
    shards.forEach((shard, idx) => {
      const poly = shard.points;
      ctx.beginPath();
      ctx.moveTo(poly[0].x, poly[0].y);
      for (let i = 1; i < poly.length; i++) {
        ctx.lineTo(poly[i].x, poly[i].y);
      }
      ctx.closePath();
      if (shard.isDeadShard) {
        ctx.fillStyle = idx % 2 === 0 ? 'rgba(2, 4, 7, 0.84)' : 'rgba(6, 9, 14, 0.68)';
      } else {
        ctx.fillStyle = idx % 2 === 0 ? 'rgba(255, 255, 255, 0.035)' : 'rgba(0, 210, 255, 0.028)';
      }
      ctx.fill();
    });

    // B. Organic OLED ink-bleed blotches (bruised violet/cyan rim + dead black core)
    inkBlots.forEach(blot => {
      ctx.save();
      ctx.translate(blot.x, blot.y);
      ctx.rotate(blot.rot);

      const haloGrad = ctx.createRadialGradient(0, 0, blot.rx * 0.3, 0, 0, blot.rx * 1.25);
      haloGrad.addColorStop(0, 'rgba(2, 3, 5, 0.96)');
      haloGrad.addColorStop(0.58, 'rgba(5, 7, 11, 0.88)');
      haloGrad.addColorStop(0.8, blot.halo);
      haloGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

      ctx.beginPath();
      ctx.ellipse(0, 0, blot.rx * 1.25, blot.ry * 1.25, 0, 0, Math.PI * 2);
      ctx.fillStyle = haloGrad;
      ctx.fill();
      ctx.restore();
    });

    // C. Spiderweb Concentric Rings (deep dark fissures + delicate glass glint)
    rings.forEach((ring, rIdx) => {
      const ringAlpha = Math.max(0.28, 0.85 - rIdx * 0.065);

      // 1. Deep crack shadow (obsidian sub-surface trench)
      ctx.beginPath();
      ctx.moveTo(ring[0].x, ring[0].y);
      for (let i = 1; i < ring.length; i++) {
        ctx.lineTo(ring[i].x, ring[i].y);
      }
      ctx.closePath();
      ctx.strokeStyle = `rgba(0, 0, 0, ${Math.min(0.95, ringAlpha + 0.12)})`;
      ctx.lineWidth = rIdx < 3 ? 2.1 : 1.5;
      ctx.stroke();

      // 2. Selective specular glass edge (subtle natural glint, not harsh white)
      ctx.beginPath();
      ctx.moveTo(ring[0].x - 0.5, ring[0].y - 0.5);
      for (let i = 1; i < ring.length; i++) {
        ctx.lineTo(ring[i].x - 0.5, ring[i].y - 0.5);
      }
      ctx.closePath();
      ctx.strokeStyle = `rgba(225, 240, 255, ${(ringAlpha * 0.62).toFixed(2)})`;
      ctx.lineWidth = 0.65;
      ctx.stroke();
    });

    // D. Radial Primary Rays & Micro-branches (distance-attenuated highlights)
    const allRays = [...rays, ...microRays];

    allRays.forEach((ray, rayIdx) => {
      // 1. Deep dark fracture shadow pass
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
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.94)';
      ctx.lineWidth = rayIdx % 3 === 0 ? 2.2 : 1.65;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();

      // 2. Natural specular glint gradient (strong near impact, dimmer toward outer glass edge)
      const tip = ray.slice().reverse().find(p => !p.isBranch) || ray[0];
      const highlightGrad = ctx.createLinearGradient(centerX, centerY, tip.x, tip.y);
      highlightGrad.addColorStop(0, 'rgba(235, 246, 255, 0.84)');
      highlightGrad.addColorStop(0.35, 'rgba(215, 232, 245, 0.52)');
      highlightGrad.addColorStop(1, 'rgba(185, 205, 220, 0.22)');

      ctx.beginPath();
      ctx.moveTo(ray[0].x - 0.55, ray[0].y - 0.55);
      for (let i = 1; i < ray.length; i++) {
        const p = ray[i];
        if (p.isBranch) {
          ctx.moveTo(p.branchPoints[0].x - 0.55, p.branchPoints[0].y - 0.55);
          for (let b = 1; b < p.branchPoints.length; b++) {
            ctx.lineTo(p.branchPoints[b].x - 0.55, p.branchPoints[b].y - 0.55);
          }
          ctx.moveTo(ray[i - 1].x - 0.55, ray[i - 1].y - 0.55);
        } else {
          ctx.lineTo(p.x - 0.55, p.y - 0.55);
        }
      }
      ctx.strokeStyle = highlightGrad;
      ctx.lineWidth = 0.7;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();

      // 3. Subtle chromatic dispersion near center impact
      ctx.beginPath();
      ctx.moveTo(ray[0].x + 0.5, ray[0].y + 0.5);
      for (let i = 1; i < Math.min(ray.length, 8); i++) {
        const p = ray[i];
        if (!p.isBranch) ctx.lineTo(p.x + 0.5, p.y + 0.5);
      }
      ctx.strokeStyle = 'rgba(0, 230, 255, 0.26)';
      ctx.lineWidth = 0.55;
      ctx.stroke();
    });

    // E. Dark crushed-glass & dead OLED cavity at impact core (realistic black pit + fine silvery splinters)
    const craterGrad = ctx.createRadialGradient(centerX, centerY, 1, centerX, centerY, 22);
    craterGrad.addColorStop(0, 'rgba(2, 3, 5, 0.99)');
    craterGrad.addColorStop(0.32, 'rgba(8, 11, 16, 0.94)');
    craterGrad.addColorStop(0.55, 'rgba(180, 205, 225, 0.42)');
    craterGrad.addColorStop(0.8, 'rgba(40, 22, 70, 0.24)');
    craterGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');

    ctx.beginPath();
    ctx.arc(centerX, centerY, 22, 0, Math.PI * 2);
    ctx.fillStyle = craterGrad;
    ctx.fill();

    // Fine crushed glass splinters around the dark core
    needles.forEach(n => {
      ctx.beginPath();
      ctx.moveTo(n.x1, n.y1);
      ctx.lineTo(n.x2, n.y2);
      ctx.strokeStyle = `rgba(220, 236, 250, ${n.alpha.toFixed(2)})`;
      ctx.lineWidth = 0.75;
      ctx.stroke();
    });
  });
}

/**
 * Draw intermittent dark OLED/LCD dead-strip & subpixel flicker frame
 */
function drawGlitchFrame() {
  if (!glitchCtx || !glitchCanvasEl || !isCracked) return;
  const w = window.innerWidth;
  const h = window.innerHeight;
  glitchCtx.clearRect(0, 0, w, h);

  if (!crackPoints.length) return;

  // Occasional subtle dark panel brownout across a wide section band
  if (Math.random() < 0.28) {
    const bandY = Math.random() * (h * 0.75);
    const bandH = 30 + Math.random() * 140;
    glitchCtx.fillStyle = `rgba(2, 4, 7, ${(0.12 + Math.random() * 0.22).toFixed(2)})`;
    glitchCtx.fillRect(0, bandY, w, bandH);
  }

  crackPoints.forEach(fracture => {
    const { centerX, centerY } = fracture;

    // 1. Flickering dark vertical dead columns aligned to impact X
    const colCount = 3;
    for (let c = 0; c < colCount; c++) {
      if (Math.random() < 0.22) continue; // blink out briefly
      const offsetX = centerX + (c - 1) * (3 + Math.random() * 6);
      const segStart = Math.max(0, centerY - 120 - Math.random() * 260);
      const segH = h - segStart;

      // Dark dead column core
      glitchCtx.fillStyle = `rgba(2, 4, 7, ${(0.65 + Math.random() * 0.3).toFixed(2)})`;
      glitchCtx.fillRect(offsetX - 1, 0, 2 + Math.random() * 2, h);

      // Flickering subpixel green/cyan/magenta trace inside the column
      const lineColors = ['rgba(0, 255, 136, 0.72)', 'rgba(0, 230, 255, 0.55)', 'rgba(255, 45, 120, 0.48)'];
      glitchCtx.fillStyle = lineColors[c % lineColors.length];
      glitchCtx.fillRect(offsetX, segStart, 1, segH * (0.45 + Math.random() * 0.55));
    }

    // 2. Flickering horizontal blacked-out display strips & glitch tears near impact Y
    const barCount = 4 + Math.floor(Math.random() * 5);
    for (let b = 0; b < barCount; b++) {
      if (Math.random() < 0.35) continue;
      const spreadY = (Math.random() - 0.5) * 280;
      const y = Math.max(0, Math.min(h - 4, centerY + spreadY));
      const barH = Math.random() < 0.35 ? 10 + Math.random() * 22 : 2 + Math.random() * 6;
      const barW = Math.random() < 0.45 ? w : 110 + Math.random() * (w * 0.6);
      const barX = Math.random() < 0.45 ? 0 : Math.max(0, centerX - barW * 0.5 + (Math.random() - 0.5) * 140);

      glitchCtx.fillStyle = `rgba(2, 4, 7, ${(0.72 + Math.random() * 0.25).toFixed(2)})`;
      glitchCtx.fillRect(barX, y, barW, barH);

      // Crisp 1px corrupted RGB tear along top/bottom of dark bar
      if (Math.random() < 0.65) {
        glitchCtx.fillStyle = Math.random() < 0.5 ? 'rgba(0, 255, 160, 0.42)' : 'rgba(255, 52, 96, 0.42)';
        glitchCtx.fillRect(barX, y + (Math.random() < 0.5 ? 0 : barH), barW * (0.35 + Math.random() * 0.65), 1);
      }
    }
  });
}

function startGlitchLoop() {
  stopGlitchLoop();
  const prefersReduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  drawGlitchFrame();
  if (prefersReduced) return;

  const tick = (ts) => {
    if (!isCracked) return;
    // Authentic ~15fps hardware display malfunction cadence (65ms-110ms jitter)
    if (ts - lastGlitchDraw > 68) {
      lastGlitchDraw = ts;
      drawGlitchFrame();
    }
    flickerRafId = window.requestAnimationFrame(tick);
  };
  flickerRafId = window.requestAnimationFrame(tick);
}

function stopGlitchLoop() {
  if (flickerRafId !== null) {
    window.cancelAnimationFrame(flickerRafId);
    flickerRafId = null;
  }
  if (glitchCtx && glitchCanvasEl) {
    glitchCtx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  }
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

  // Audio & Haptic feedback (sin mover el body para mantener la pantalla fija y realista)
  playGlassShatterSound();
  if (navigator.vibrate) {
    navigator.vibrate([45, 25, 80]);
  }

  // Resize canvas to viewport and render
  resizeCanvas();
  renderCracks();

  // Show overlay and repair card
  overlayEl.classList.add('active');
  cardEl.classList.add('visible');
  isCracked = true;
  startGlitchLoop();
}

/**
 * Repair Screen (Laser scan restore effect)
 */
function repairScreen() {
  if (!isCracked) return;

  playRepairSound();
  stopGlitchLoop();

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
      if (ctx) ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
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
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  if (glitchCanvasEl) {
    glitchCanvasEl.width = width * dpr;
    glitchCanvasEl.height = height * dpr;
    glitchCanvasEl.style.width = `${width}px`;
    glitchCanvasEl.style.height = `${height}px`;
    if (glitchCtx) {
      glitchCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
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

  // Canvas (glass fracture & dark ink bleed)
  canvasEl = document.createElement('canvas');
  canvasEl.className = 'cracked-screen-canvas';
  ctx = canvasEl.getContext('2d');
  overlayEl.appendChild(canvasEl);

  // Dark damaged OLED vignette/subpixel flicker veil
  vignetteEl = document.createElement('div');
  vignetteEl.className = 'cracked-vignette-flicker';
  overlayEl.appendChild(vignetteEl);

  // Dynamic glitch & dark scan-strip canvas
  glitchCanvasEl = document.createElement('canvas');
  glitchCanvasEl.className = 'cracked-glitch-canvas';
  glitchCtx = glitchCanvasEl.getContext('2d');
  overlayEl.appendChild(glitchCanvasEl);

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
          <span>¿Problemas con tu pantalla?</span>
          <span class="cracked-repair-badge">Simulación</span>
        </div>
        <div class="cracked-repair-desc">
          Reparación de pantallas, sistema de carga, software, liberaciones en Teziutlán.
        </div>
        <div class="cracked-tags-list">
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

  if (!activeSoundUnsub) {
    activeSoundUnsub = soundLibraryService.subscribeActiveCrackedSound(
      (soundCfg) => {
        if (soundCfg) activeCrackSound = soundCfg;
      },
      () => {
        // Fallback already applied from cache/defaults
      }
    );
  }

  // Expose on window for easy developer testing
  window.fiberlinkEasterEgg = {
    crack: (x, y) => crackScreen(x, y),
    repair: () => repairScreen(),
    getActiveSound: () => activeCrackSound
  };
}
