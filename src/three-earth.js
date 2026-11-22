import * as THREE from 'three';

const GLOBE_POINTER_SLOTS = 3;

function createSurfacePulseSlots() {
  return Array.from({ length: GLOBE_POINTER_SLOTS }, () => ({
    dir: new THREE.Vector3(0, 0, 1),
    strength: 0,
    age: 0,
  }));
}

function createCircleSpriteTexture() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const center = size / 2;
    const grad = ctx.createRadialGradient(center, center, 0, center, center, center);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.38, 'rgba(255, 255, 255, 0.92)');
    grad.addColorStop(0.72, 'rgba(255, 255, 255, 0.28)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

function createWebGLRendererSafe() {
  try {
    const glCanvas = document.createElement('canvas');
    const ctxAttrs = {
      alpha: true,
      antialias: true,
      depth: true,
      stencil: false,
      powerPreference: 'high-performance',
    };

    const gl =
      glCanvas.getContext('webgl2', ctxAttrs) ||
      glCanvas.getContext('webgl', ctxAttrs) ||
      glCanvas.getContext('experimental-webgl', ctxAttrs);

    if (!gl) {
      return { renderer: null, isSoftwareGl: false };
    }

    let isSoftwareGl = false;
    try {
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param) || '');
      isSoftwareGl = /SwiftShader|llvmpipe|softpipe|Software|Basic Render|Disabled/i.test(gpu);
    } catch {
      isSoftwareGl = false;
    }

    // Reuse the verified canvas & context directly (never call loseContext() before real init)
    const renderer = new THREE.WebGLRenderer({
      canvas: glCanvas,
      context: gl,
      antialias: !isSoftwareGl,
      alpha: true,
      powerPreference: isSoftwareGl ? 'default' : 'high-performance',
    });

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;

    return { renderer, isSoftwareGl };
  } catch {
    return { renderer: null, isSoftwareGl: false };
  }
}

function createNetworkArcData() {
  // 12 key digital hub coordinates (latDeg, lonDeg) distributed across hemispheres
  const hubCoords = [
    [19.8, -97.3],   // Teziutlán / Puebla node
    [37.7, -122.4],  // North America West
    [40.7, -74.0],   // North America East
    [-23.5, -46.6],  // South America
    [51.5, -0.1],    // Europe West
    [50.1, 14.4],    // Europe Central
    [35.6, 139.7],   // East Asia
    [1.35, 103.8],   // Southeast Asia
    [-33.8, 151.2],  // Oceania
    [25.2, 55.3],    // Middle East
    [-1.29, 36.8],   // East Africa
    [60.1, 24.9],    // Nordic
  ];

  const hubs = hubCoords.map(([latDeg, lonDeg]) => {
    const lat = (latDeg * Math.PI) / 180;
    const lon = (lonDeg * Math.PI) / 180;
    const cosLat = Math.cos(lat);
    return {
      x: cosLat * Math.cos(lon),
      y: Math.sin(lat),
      z: cosLat * Math.sin(lon),
    };
  });

  const pairs = [
    [0, 1], [0, 2], [0, 3], [0, 4],
    [1, 6], [2, 4], [2, 5], [3, 4],
    [4, 5], [4, 11], [5, 9], [9, 7],
    [7, 6], [7, 8], [9, 10], [10, 4],
  ];

  const ARC_STEPS = 24;
  const arcs = pairs.map(([aIdx, bIdx], idx) => {
    const a = hubs[aIdx];
    const b = hubs[bIdx];
    const dot = Math.max(-0.999, Math.min(0.999, a.x * b.x + a.y * b.y + a.z * b.z));
    const omega = Math.acos(dot);
    const sinOmega = Math.sin(omega) || 1;
    const points = [];
    for (let s = 0; s <= ARC_STEPS; s++) {
      const u = s / ARC_STEPS;
      const k1 = Math.sin((1 - u) * omega) / sinOmega;
      const k2 = Math.sin(u * omega) / sinOmega;
      const px = a.x * k1 + b.x * k2;
      const py = a.y * k1 + b.y * k2;
      const pz = a.z * k1 + b.z * k2;
      const invLen = 1 / (Math.hypot(px, py, pz) || 1);
      const lift = 1.015 + Math.sin(Math.PI * u) * (0.11 + (omega / Math.PI) * 0.14);
      points.push({
        x: px * invLen * lift,
        y: py * invLen * lift,
        z: pz * invLen * lift,
      });
    }
    return {
      points,
      speed: 0.24 + (idx % 5) * 0.045,
      phase: (idx * 0.37) % 1,
    };
  });

  // Two staggered packets per arc for continuous living traffic
  const packets = [];
  for (let i = 0; i < arcs.length; i++) {
    packets.push({ arcIdx: i, offset: 0 });
    packets.push({ arcIdx: i, offset: 0.5 });
  }

  return { hubs, arcs, packets, arcSteps: ARC_STEPS };
}

function initEarth2DFallback(container) {
  const canvas = document.createElement('canvas');
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.display = 'block';
  canvas.setAttribute('aria-hidden', 'true');
  container.appendChild(canvas);

  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  let w = 0;
  let h = 0;
  let dpr = 1;
  let isLight = document.documentElement.classList.contains('light');

  function resize() {
    w = window.innerWidth;
    h = window.innerHeight;
    // Scale canvas buffer to native DPR (up to 2x) so curves & nodes stay crisp on mobile Retina displays
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();

  let lastWidth = window.innerWidth;
  window.addEventListener('resize', () => {
    if (window.innerWidth === lastWidth) return;
    lastWidth = window.innerWidth;
    resize();
  });

  window.addEventListener('themechange', (e) => {
    isLight = Boolean(e.detail?.isLight);
  });

  // Fibonacci sphere nodes
  const isMobile = w < 768;
  const nodeCount = isMobile ? 160 : 240;
  const nodes = [];
  const goldenRatio = (1 + Math.sqrt(5)) / 2;
  for (let i = 0; i < nodeCount; i++) {
    const theta = (2 * Math.PI * i) / goldenRatio;
    const phi = Math.acos(1 - (2 * (i + 0.5)) / nodeCount);
    nodes.push({
      x: Math.sin(phi) * Math.cos(theta),
      y: Math.cos(phi),
      z: Math.sin(phi) * Math.sin(theta),
    });
  }

  // Ambient drifting stars around the globe
  const starCount = isMobile ? 36 : 64;
  const stars = [];
  for (let i = 0; i < starCount; i++) {
    stars.push({
      x: (Math.random() - 0.5) * 2.4,
      y: (Math.random() - 0.5) * 2.0,
      r: 1.0 + Math.random() * 1.2,
      p: Math.random() * Math.PI * 2,
    });
  }

  let rotY = 0;
  const rotX = 0.24;
  const rotZ = 0;
  let t = 0;
  let lastFrameTime = 0;
  const network = createNetworkArcData();

  // Touch & pointer localized illumination (no gyroscope)
  const fallbackSpots = [
    { x: 0, y: 0, z: 1, strength: 0, age: 0 },
    { x: 0, y: 0, z: 1, strength: 0, age: 0 },
    { x: 0, y: 0, z: 1, strength: 0, age: 0 },
  ];
  let fallbackSlotIdx = 0;
  const hoverSpot = { x: 0, y: 0, z: 1, strength: 0, target: 0 };
  let lastMoveTime = 0;

  function screenToLocalSphereDir(clientX, clientY) {
    const radius = Math.min(w, h) * (w < 480 ? 0.33 : w < 768 ? 0.34 : 0.34);
    const cx = w * 0.5;
    const cy = h * 0.48;
    let nx = (clientX - cx) / Math.max(1, radius);
    let ny = (clientY - cy) / Math.max(1, radius);
    const r2 = nx * nx + ny * ny;
    let nz;
    if (r2 <= 1) {
      nz = Math.sqrt(1 - r2);
    } else {
      const inv = 1 / Math.sqrt(r2);
      nx *= inv * 0.88;
      ny *= inv * 0.88;
      nz = Math.sqrt(Math.max(0.05, 1 - nx * nx - ny * ny));
    }

    // Inverse rotations (Z -> X -> Y) to pin spot onto rotating sphere coordinates
    const cosZ = Math.cos(-rotZ);
    const sinZ = Math.sin(-rotZ);
    const x1 = nx * cosZ - ny * sinZ;
    const y1 = nx * sinZ + ny * cosZ;
    const z1 = nz;

    const cosX = Math.cos(-rotX);
    const sinX = Math.sin(-rotX);
    const y2 = y1 * cosX - z1 * sinX;
    const z2 = y1 * sinX + z1 * cosX;
    const x2 = x1;

    const cosY = Math.cos(-rotY);
    const sinY = Math.sin(-rotY);
    const lx = x2 * cosY - z2 * sinY;
    const lz = x2 * sinY + z2 * cosY;
    const ly = y2;
    const invLen = 1 / (Math.hypot(lx, ly, lz) || 1);
    return { x: lx * invLen, y: ly * invLen, z: lz * invLen };
  }

  function triggerFallbackPulse(clientX, clientY, boost = 1) {
    const dir = screenToLocalSphereDir(clientX, clientY);
    const slot = fallbackSpots[fallbackSlotIdx];
    fallbackSlotIdx = (fallbackSlotIdx + 1) % fallbackSpots.length;
    slot.x = dir.x;
    slot.y = dir.y;
    slot.z = dir.z;
    slot.strength = boost;
    slot.age = 0;
  }

  window.addEventListener(
    'pointerdown',
    (ev) => {
      triggerFallbackPulse(ev.clientX, ev.clientY, 1);
    },
    { passive: true }
  );

  window.addEventListener(
    'pointermove',
    (ev) => {
      const now = performance.now();
      if (now - lastMoveTime < 36) return;
      lastMoveTime = now;
      const dir = screenToLocalSphereDir(ev.clientX, ev.clientY);
      hoverSpot.x = dir.x;
      hoverSpot.y = dir.y;
      hoverSpot.z = dir.z;
      hoverSpot.target = ev.pointerType === 'touch' ? 0.8 : 0.55;
      if (ev.buttons > 0 || ev.pointerType === 'touch') {
        triggerFallbackPulse(ev.clientX, ev.clientY, 0.72);
      }
    },
    { passive: true }
  );

  window.addEventListener('blur', () => {
    hoverSpot.target = 0;
  });

  function project(x, y, z, radius, cx, cy, cosY, sinY, cosX, sinX, cosZ, sinZ) {
    const x1 = x * cosY - z * sinY;
    const z1 = x * sinY + z * cosY;

    const y2 = y * cosX - z1 * sinX;
    const z2 = y * sinX + z1 * cosX;

    const x3 = x1 * cosZ - y2 * sinZ;
    const y3 = x1 * sinZ + y2 * cosZ;

    const perspective = 3.2 / (3.2 - z2 * 0.82);
    return {
      sx: cx + x3 * radius * perspective,
      sy: cy + y3 * radius * perspective,
      depth: z2,
      scale: perspective,
    };
  }

  const reducedMotion =
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function drawFrame(now = 0) {
    if (!reducedMotion) {
      requestAnimationFrame(drawFrame);
    }
    if (document.hidden) return;
    if (now && now - lastFrameTime < 32) return; // Smooth ~30fps cap for battery & UI responsiveness
    const dt = lastFrameTime ? Math.min(0.1, (now - lastFrameTime) / 1000) : 0.033;
    lastFrameTime = now;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    t += 0.032;
    rotY += 0.0045;

    for (let s = 0; s < fallbackSpots.length; s++) {
      if (fallbackSpots[s].strength > 0.004) {
        fallbackSpots[s].age += dt;
        fallbackSpots[s].strength *= Math.exp(-1.55 * dt);
      } else {
        fallbackSpots[s].strength = 0;
      }
    }
    hoverSpot.strength += (hoverSpot.target - hoverSpot.strength) * (1 - Math.exp(-6 * dt));
    hoverSpot.target *= Math.exp(-1.2 * dt);

    const cosY = Math.cos(rotY);
    const sinY = Math.sin(rotY);
    const cosX = Math.cos(rotX);
    const sinX = Math.sin(rotX);
    const cosZ = Math.cos(rotZ);
    const sinZ = Math.sin(rotZ);

    const radius = Math.min(w, h) * (w < 480 ? 0.33 : w < 768 ? 0.34 : 0.34);
    const floatY = reducedMotion ? 0 : Math.sin(t * 0.85) * 8;
    const cx = w * 0.5;
    const cy = h * 0.48 + floatY;

    // Volumetric core + atmosphere halo
    const halo = ctx.createRadialGradient(cx, cy, radius * 0.22, cx, cy, radius * 1.34);
    if (isLight) {
      halo.addColorStop(0, 'rgba(156, 195, 46, 0.22)');
      halo.addColorStop(0.65, 'rgba(108, 148, 18, 0.09)');
      halo.addColorStop(1, 'rgba(77, 115, 6, 0)');
    } else {
      halo.addColorStop(0, 'rgba(156, 195, 46, 0.16)');
      halo.addColorStop(0.68, 'rgba(156, 195, 46, 0.05)');
      halo.addColorStop(1, 'rgba(156, 195, 46, 0)');
    }
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 1.34, 0, Math.PI * 2);
    ctx.fill();

    // Crisp outer silhouette & subtle tilted orbital ring
    ctx.lineWidth = 0.9;
    ctx.strokeStyle = isLight ? 'rgba(63, 98, 4, 0.22)' : 'rgba(156, 195, 46, 0.18)';
    ctx.beginPath();
    ctx.arc(cx, cy, radius * 1.01, 0, Math.PI * 2);
    ctx.stroke();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-0.34);
    ctx.lineWidth = 0.85;
    ctx.strokeStyle = isLight ? 'rgba(63, 98, 4, 0.20)' : 'rgba(184, 220, 62, 0.20)';
    ctx.beginPath();
    ctx.ellipse(0, 0, radius * 1.24, radius * 0.34, 0, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();

    // High-resolution wireframe meridians & parallels (56 steps = silky curves on mobile)
    ctx.lineWidth = 0.85;
    ctx.strokeStyle = isLight ? 'rgba(58, 94, 4, 0.28)' : 'rgba(156, 195, 46, 0.21)';

    const meridians = 10;
    const steps = 56;
    for (let m = 0; m < meridians; m++) {
      const lon = (m / meridians) * Math.PI;
      const cosLon = Math.cos(lon);
      const sinLon = Math.sin(lon);
      ctx.beginPath();
      for (let s = 0; s <= steps; s++) {
        const lat = (s / steps) * Math.PI * 2;
        const cosLat = Math.cos(lat);
        const pt = project(
          cosLat * cosLon,
          Math.sin(lat),
          cosLat * sinLon,
          radius,
          cx,
          cy,
          cosY,
          sinY,
          cosX,
          sinX,
          cosZ,
          sinZ
        );
        if (s === 0) ctx.moveTo(pt.sx, pt.sy);
        else ctx.lineTo(pt.sx, pt.sy);
      }
      ctx.stroke();
    }

    const parallels = [-0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75];
    for (let p = 0; p < parallels.length; p++) {
      const py = parallels[p];
      const rRing = Math.sqrt(Math.max(0, 1 - py * py));
      ctx.beginPath();
      for (let s = 0; s <= steps; s++) {
        const ang = (s / steps) * Math.PI * 2;
        const pt = project(
          Math.cos(ang) * rRing,
          py,
          Math.sin(ang) * rRing,
          radius,
          cx,
          cy,
          cosY,
          sinY,
          cosX,
          sinX,
          cosZ,
          sinZ
        );
        if (s === 0) ctx.moveTo(pt.sx, pt.sy);
        else ctx.lineTo(pt.sx, pt.sy);
      }
      ctx.stroke();
    }

    // Batch front & back sphere particle nodes for high speed
    ctx.fillStyle = isLight ? 'rgba(42, 70, 2, 0.28)' : 'rgba(156, 195, 46, 0.26)';
    ctx.beginPath();
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      const pt = project(n.x, n.y, n.z, radius * 1.018, cx, cy, cosY, sinY, cosX, sinX, cosZ, sinZ);
      if (pt.depth <= 0) {
        const r = 1.15 * pt.scale;
        ctx.moveTo(pt.sx + r, pt.sy);
        ctx.arc(pt.sx, pt.sy, r, 0, Math.PI * 2);
      }
    }
    ctx.fill();

    ctx.fillStyle = isLight ? 'rgba(42, 70, 2, 0.85)' : 'rgba(184, 220, 62, 0.88)';
    ctx.beginPath();
    const litFallbackNodes = [];
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      const pt = project(n.x, n.y, n.z, radius * 1.018, cx, cy, cosY, sinY, cosX, sinX, cosZ, sinZ);
      if (pt.depth > 0) {
        let boost = 0;
        if (hoverSpot.strength > 0.03) {
          const hd = n.x * hoverSpot.x + n.y * hoverSpot.y + n.z * hoverSpot.z;
          if (hd > 0.52) boost = Math.max(boost, ((hd - 0.52) / 0.48) * hoverSpot.strength * 0.72);
        }
        for (let s = 0; s < fallbackSpots.length; s++) {
          const sp = fallbackSpots[s];
          if (sp.strength <= 0.02) continue;
          const sd = n.x * sp.x + n.y * sp.y + n.z * sp.z;
          if (sd > 0.45) {
            boost = Math.max(boost, ((sd - 0.45) / 0.55) * sp.strength);
          }
        }
        if (boost > 0.15) {
          litFallbackNodes.push({ sx: pt.sx, sy: pt.sy, scale: pt.scale, boost });
        } else {
          const r = 1.75 * pt.scale;
          ctx.moveTo(pt.sx + r, pt.sy);
          ctx.arc(pt.sx, pt.sy, r, 0, Math.PI * 2);
        }
      }
    }
    ctx.fill();

    if (litFallbackNodes.length > 0) {
      for (let i = 0; i < litFallbackNodes.length; i++) {
        const ln = litFallbackNodes[i];
        const r = (1.9 + ln.boost * 2.1) * ln.scale;
        ctx.fillStyle = isLight
          ? `rgba(63, 108, 4, ${Math.min(1, 0.65 + ln.boost * 0.35)})`
          : `rgba(220, 255, 118, ${Math.min(1, 0.7 + ln.boost * 0.3)})`;
        ctx.beginPath();
        ctx.arc(ln.sx, ln.sy, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Touch spotlight glow & expanding ring on 2D globe surface
    for (let s = 0; s < fallbackSpots.length; s++) {
      const sp = fallbackSpots[s];
      if (sp.strength <= 0.02) continue;
      const pt = project(sp.x, sp.y, sp.z, radius * 1.02, cx, cy, cosY, sinY, cosX, sinX, cosZ, sinZ);
      if (pt.depth > -0.15) {
        const gRad = radius * 0.48;
        const grad = ctx.createRadialGradient(pt.sx, pt.sy, 0, pt.sx, pt.sy, gRad);
        if (isLight) {
          grad.addColorStop(0, `rgba(101, 163, 13, ${sp.strength * 0.38})`);
          grad.addColorStop(0.5, `rgba(2, 132, 199, ${sp.strength * 0.16})`);
          grad.addColorStop(1, 'rgba(101, 163, 13, 0)');
        } else {
          grad.addColorStop(0, `rgba(200, 255, 92, ${sp.strength * 0.42})`);
          grad.addColorStop(0.45, `rgba(124, 231, 255, ${sp.strength * 0.2})`);
          grad.addColorStop(1, 'rgba(156, 195, 46, 0)');
        }
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(pt.sx, pt.sy, gRad, 0, Math.PI * 2);
        ctx.fill();

        const ringR = (6 + sp.age * radius * 0.55) * pt.scale;
        ctx.lineWidth = 1.4;
        ctx.strokeStyle = isLight
          ? `rgba(2, 132, 199, ${sp.strength * 0.55})`
          : `rgba(130, 240, 255, ${sp.strength * 0.65})`;
        ctx.beginPath();
        ctx.arc(pt.sx, pt.sy, ringR, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Living digital network: curved great-circle fiber arcs (front hemisphere emphasized)
    ctx.lineWidth = 1.05;
    ctx.strokeStyle = isLight ? 'rgba(2, 132, 199, 0.34)' : 'rgba(124, 231, 255, 0.28)';
    ctx.beginPath();
    for (let a = 0; a < network.arcs.length; a++) {
      const pts = network.arcs[a].points;
      let started = false;
      for (let s = 0; s < pts.length; s++) {
        const p = pts[s];
        const pt = project(p.x, p.y, p.z, radius, cx, cy, cosY, sinY, cosX, sinX, cosZ, sinZ);
        if (pt.depth > -0.15) {
          if (!started) {
            ctx.moveTo(pt.sx, pt.sy);
            started = true;
          } else {
            ctx.lineTo(pt.sx, pt.sy);
          }
        } else {
          started = false;
        }
      }
    }
    ctx.stroke();

    // Active hub beacons + pulsing concentric ripples
    ctx.fillStyle = isLight ? 'rgba(42, 70, 2, 0.92)' : 'rgba(216, 252, 108, 0.95)';
    ctx.beginPath();
    for (let i = 0; i < network.hubs.length; i++) {
      const hNode = network.hubs[i];
      const pt = project(hNode.x, hNode.y, hNode.z, radius * 1.022, cx, cy, cosY, sinY, cosX, sinX, cosZ, sinZ);
      if (pt.depth > 0.05) {
        const pulseR = (2.6 + Math.sin(t * 2.5 + i) * 0.6) * pt.scale;
        ctx.moveTo(pt.sx + pulseR, pt.sy);
        ctx.arc(pt.sx, pt.sy, pulseR, 0, Math.PI * 2);
      }
    }
    ctx.fill();

    for (let i = 0; i < 6; i++) {
      const hNode = network.hubs[i * 2];
      const pt = project(hNode.x, hNode.y, hNode.z, radius * 1.024, cx, cy, cosY, sinY, cosX, sinX, cosZ, sinZ);
      if (pt.depth > 0.15) {
        const wave = (t * 0.48 + i * 0.21) % 1;
        ctx.lineWidth = 1.0;
        ctx.strokeStyle = isLight
          ? `rgba(68, 104, 4, ${(1 - wave) * 0.45})`
          : `rgba(184, 220, 62, ${(1 - wave) * 0.52})`;
        ctx.beginPath();
        ctx.arc(pt.sx, pt.sy, (3 + wave * 11) * pt.scale, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    // Traveling glowing data packets along fiber arcs
    ctx.fillStyle = isLight ? 'rgba(2, 132, 199, 0.94)' : 'rgba(130, 240, 255, 0.96)';
    ctx.beginPath();
    for (let p = 0; p < network.packets.length; p++) {
      const pkt = network.packets[p];
      const arc = network.arcs[pkt.arcIdx];
      const u = (t * arc.speed * 0.45 + arc.phase + pkt.offset) % 1;
      const fIdx = u * network.arcSteps;
      const i0 = Math.floor(fIdx);
      const i1 = Math.min(network.arcSteps, i0 + 1);
      const frac = fIdx - i0;
      const p0 = arc.points[i0];
      const p1 = arc.points[i1];
      const px = p0.x + (p1.x - p0.x) * frac;
      const py = p0.y + (p1.y - p0.y) * frac;
      const pz = p0.z + (p1.z - p0.z) * frac;
      const pt = project(px, py, pz, radius, cx, cy, cosY, sinY, cosX, sinX, cosZ, sinZ);
      if (pt.depth > 0) {
        const pr = 2.4 * pt.scale;
        ctx.moveTo(pt.sx + pr, pt.sy);
        ctx.arc(pt.sx, pt.sy, pr, 0, Math.PI * 2);
      }
    }
    ctx.fill();

    // Ambient orbital star particles (no gyro offset)
    ctx.fillStyle = isLight ? 'rgba(68, 104, 4, 0.42)' : 'rgba(156, 195, 46, 0.45)';
    ctx.beginPath();
    for (let i = 0; i < stars.length; i++) {
      const st = stars[i];
      const sx = w * 0.5 + (st.x * Math.cos(t * 0.12) - st.y * Math.sin(t * 0.12)) * w * 0.42;
      const sy = cy + st.y * h * 0.42 + Math.sin(t + st.p) * 6;
      ctx.moveTo(sx + st.r, sy);
      ctx.arc(sx, sy, st.r, 0, Math.PI * 2);
    }
    ctx.fill();
  }

  requestAnimationFrame(drawFrame);
  return { mode: '2d-fallback', canvas };
}

export function initEarth(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return null;

  const isMobile = window.innerWidth < 768;
  const { renderer, isSoftwareGl } = createWebGLRendererSafe();

  if (!renderer) {
    return initEarth2DFallback(container);
  }

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.z = isMobile ? 17 : 15;
  camera.position.y = isMobile ? 1.2 : 2;
  camera.lookAt(0, 0, 0);

  const getTargetDpr = () => (isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
  renderer.setPixelRatio(getTargetDpr());
  renderer.setSize(window.innerWidth, window.innerHeight);
  container.appendChild(renderer.domElement);

  const earthGroup = new THREE.Group();
  scene.add(earthGroup);

  function adjustScale() {
    const width = window.innerWidth;
    if (width < 480) {
      earthGroup.scale.set(0.58, 0.58, 0.58);
      camera.position.z = 17;
      camera.position.y = 1.2;
    } else if (width < 768) {
      earthGroup.scale.set(0.76, 0.76, 0.76);
      camera.position.z = 15;
      camera.position.y = 1.5;
    } else {
      earthGroup.scale.set(1, 1, 1);
      camera.position.z = 15;
      camera.position.y = 2;
    }
    camera.lookAt(0, 0, 0);
  }
  adjustScale();

  // Soft circular sprite texture prevents square pixel blocks on PointsMaterial
  const circleSprite = createCircleSpriteTexture();

  // 1. Core Sphere (high segment smoothness on mobile too)
  const coreSegments = isMobile ? 36 : 48;
  const coreGeometry = new THREE.SphereGeometry(4.8, coreSegments, coreSegments);
  const coreMaterial = new THREE.MeshPhongMaterial({
    color: 0x070803,
    emissive: 0x050603,
    specular: 0x1a220a,
    shininess: 14,
    transparent: true,
    opacity: 0.95,
  });
  const core = new THREE.Mesh(coreGeometry, coreMaterial);
  earthGroup.add(core);

  // 2. Wireframe / Tech Grid (smoother segments to eliminate mobile faceting)
  const wireSegments = isMobile ? 28 : 34;
  const wireGeometry = new THREE.SphereGeometry(5, wireSegments, wireSegments);
  const wireMaterial = new THREE.MeshBasicMaterial({
    color: 0x9cc32e,
    wireframe: true,
    transparent: true,
    opacity: 0.22,
  });
  const wireframe = new THREE.Mesh(wireGeometry, wireMaterial);
  earthGroup.add(wireframe);

  // 2b. Refined Equatorial Orbital Ring
  const orbitGeometry = new THREE.TorusGeometry(6.05, 0.015, 12, 96);
  const orbitMaterial = new THREE.MeshBasicMaterial({
    color: 0xb8dc3e,
    transparent: true,
    opacity: 0.28,
  });
  const orbitRing = new THREE.Mesh(orbitGeometry, orbitMaterial);
  orbitRing.rotation.set(Math.PI * 0.41, 0.25, 0);
  earthGroup.add(orbitRing);

  // 3. Touch-Reactive Particles / Data Nodes (ShaderMaterial with circular sprite)
  const particlesGeometry = new THREE.BufferGeometry();
  const particleCount = isMobile ? 540 : 1400;
  const posArray = new Float32Array(particleCount * 3);

  for (let i = 0; i < particleCount * 3; i += 3) {
    const r = 5.06;
    const theta = 2 * Math.PI * Math.random();
    const phi = Math.acos(2 * Math.random() - 1);

    posArray[i] = r * Math.sin(phi) * Math.cos(theta);
    posArray[i + 1] = r * Math.sin(phi) * Math.sin(theta);
    posArray[i + 2] = r * Math.cos(phi);
  }

  particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));

  const getPerspectiveScale = () =>
    (window.innerHeight * getTargetDpr()) / (2 * Math.tan((45 * Math.PI) / 360));

  const surfaceSpots = createSurfacePulseSlots();
  let nextSpotSlot = 0;
  const hoverDirLocal = new THREE.Vector3(0, 0, 1);
  let hoverStrength = 0;
  let hoverTargetStrength = 0;

  const particleMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uSprite: { value: circleSprite },
      uBaseColor: { value: new THREE.Color(0xb8dc3e) },
      uHotColor: { value: new THREE.Color(0x82f0ff) },
      uBaseSize: { value: isMobile ? 0.145 : 0.13 },
      uOpacity: { value: 0.96 },
      uPerspectiveScale: { value: getPerspectiveScale() },
      uSpot0: { value: surfaceSpots[0].dir },
      uSpot1: { value: surfaceSpots[1].dir },
      uSpot2: { value: surfaceSpots[2].dir },
      uMeta0: { value: new THREE.Vector2(0, 0) },
      uMeta1: { value: new THREE.Vector2(0, 0) },
      uMeta2: { value: new THREE.Vector2(0, 0) },
      uHoverDir: { value: hoverDirLocal },
      uHoverStrength: { value: 0 },
    },
    vertexShader: `
      uniform float uBaseSize;
      uniform float uPerspectiveScale;
      uniform vec3 uSpot0;
      uniform vec3 uSpot1;
      uniform vec3 uSpot2;
      uniform vec2 uMeta0;
      uniform vec2 uMeta1;
      uniform vec2 uMeta2;
      uniform vec3 uHoverDir;
      uniform float uHoverStrength;
      varying float vBoost;

      float spotNodeBoost(vec3 nPos, vec3 spotDir, vec2 meta) {
        if (meta.x <= 0.005) return 0.0;
        float d = clamp(dot(nPos, normalize(spotDir)), -1.0, 1.0);
        float angle = acos(d);
        float coreGlow = exp(-angle * angle * 8.5) * meta.x;
        float ring = exp(-pow((angle - meta.y * 1.15) * 11.0, 2.0)) * smoothstep(2.0, 0.0, meta.y) * meta.x * 0.75;
        return max(coreGlow, ring);
      }

      void main() {
        vec3 nPos = normalize(position);
        float b = 0.0;
        b = max(b, spotNodeBoost(nPos, uSpot0, uMeta0));
        b = max(b, spotNodeBoost(nPos, uSpot1, uMeta1));
        b = max(b, spotNodeBoost(nPos, uSpot2, uMeta2));
        if (uHoverStrength > 0.005) {
          float hd = clamp(dot(nPos, normalize(uHoverDir)), -1.0, 1.0);
          float hAng = acos(hd);
          b = max(b, exp(-hAng * hAng * 9.5) * uHoverStrength * 0.65);
        }
        vBoost = clamp(b, 0.0, 1.0);

        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = uBaseSize * (1.0 + vBoost * 1.25) * (uPerspectiveScale / max(1.0, -mvPosition.z));
        gl_Position = projectionMatrix * mvPosition;
      }
    `,
    fragmentShader: `
      uniform sampler2D uSprite;
      uniform vec3 uBaseColor;
      uniform vec3 uHotColor;
      uniform float uOpacity;
      varying float vBoost;

      void main() {
        vec4 tex = texture2D(uSprite, gl_PointCoord);
        if (tex.a < 0.02) discard;
        vec3 finalCol = mix(uBaseColor, uHotColor, vBoost * 0.85);
        float alpha = tex.a * mix(uOpacity, 1.0, vBoost);
        gl_FragColor = vec4(finalCol, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const particlesMesh = new THREE.Points(particlesGeometry, particleMaterial);
  earthGroup.add(particlesMesh);

  // 3a. Touch-Reactive Surface Glow Shell (wraps sphere mesh softly where touched)
  const touchShellGeo = new THREE.SphereGeometry(5.035, coreSegments, coreSegments);
  const touchShellMat = new THREE.ShaderMaterial({
    uniforms: {
      uGlowColor: { value: new THREE.Color(0xc2f04d) },
      uRingColor: { value: new THREE.Color(0x7ce7ff) },
      uSpot0: { value: surfaceSpots[0].dir },
      uSpot1: { value: surfaceSpots[1].dir },
      uSpot2: { value: surfaceSpots[2].dir },
      uMeta0: { value: new THREE.Vector2(0, 0) },
      uMeta1: { value: new THREE.Vector2(0, 0) },
      uMeta2: { value: new THREE.Vector2(0, 0) },
      uHoverDir: { value: hoverDirLocal },
      uHoverStrength: { value: 0 },
      uLightMode: { value: 0 },
    },
    vertexShader: `
      varying vec3 vLocalDir;
      varying vec3 vViewNormal;
      varying vec3 vViewPos;
      void main() {
        vLocalDir = normalize(position);
        vViewNormal = normalize(normalMatrix * normal);
        vec4 mvPos = modelViewMatrix * vec4(position, 1.0);
        vViewPos = -mvPos.xyz;
        gl_Position = projectionMatrix * mvPos;
      }
    `,
    fragmentShader: `
      uniform vec3 uGlowColor;
      uniform vec3 uRingColor;
      uniform vec3 uSpot0;
      uniform vec3 uSpot1;
      uniform vec3 uSpot2;
      uniform vec2 uMeta0;
      uniform vec2 uMeta1;
      uniform vec2 uMeta2;
      uniform vec3 uHoverDir;
      uniform float uHoverStrength;
      uniform float uLightMode;
      varying vec3 vLocalDir;
      varying vec3 vViewNormal;
      varying vec3 vViewPos;

      vec2 evalSpot(vec3 nPos, vec3 spotDir, vec2 meta) {
        if (meta.x <= 0.005) return vec2(0.0);
        float d = clamp(dot(nPos, normalize(spotDir)), -1.0, 1.0);
        float angle = acos(d);
        float glow = exp(-angle * angle * 7.5) * meta.x;
        float ring = exp(-pow((angle - meta.y * 1.15) * 12.5, 2.0)) * smoothstep(2.1, 0.0, meta.y) * meta.x;
        return vec2(glow, ring);
      }

      void main() {
        vec3 nPos = normalize(vLocalDir);
        vec2 s0 = evalSpot(nPos, uSpot0, uMeta0);
        vec2 s1 = evalSpot(nPos, uSpot1, uMeta1);
        vec2 s2 = evalSpot(nPos, uSpot2, uMeta2);

        float glow = min(1.2, s0.x + s1.x + s2.x);
        float ring = min(1.0, s0.y + s1.y + s2.y);

        if (uHoverStrength > 0.005) {
          float hd = clamp(dot(nPos, normalize(uHoverDir)), -1.0, 1.0);
          float hAng = acos(hd);
          glow += exp(-hAng * hAng * 9.0) * uHoverStrength * 0.42;
        }

        if (glow + ring < 0.004) discard;

        vec3 viewDir = normalize(vViewPos);
        float rim = 1.0 - max(0.0, dot(viewDir, normalize(vViewNormal)));
        float fresnelBoost = 0.72 + pow(rim, 2.0) * 0.55;

        vec3 col = mix(uGlowColor, uRingColor, clamp(ring * 0.9, 0.0, 1.0));
        float baseAlpha = uLightMode > 0.5 ? 0.38 : 0.56;
        float alpha = clamp((glow * baseAlpha + ring * 0.62) * fresnelBoost, 0.0, 0.85);
        gl_FragColor = vec4(col, alpha);
      }
    `,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const touchShell = new THREE.Mesh(touchShellGeo, touchShellMat);
  earthGroup.add(touchShell);

  // 3b. Living Digital Network: Fiber Arcs + Active Hubs + Surface Pulse Rings + Streaming Packets
  const network = createNetworkArcData();
  const GLOBE_RADIUS = 5.0;

  // Merged LineSegments for all great-circle interconnection arcs (1 draw call)
  const arcVertices = [];
  for (let a = 0; a < network.arcs.length; a++) {
    const pts = network.arcs[a].points;
    for (let s = 0; s < pts.length - 1; s++) {
      const p0 = pts[s];
      const p1 = pts[s + 1];
      arcVertices.push(
        p0.x * GLOBE_RADIUS, p0.y * GLOBE_RADIUS, p0.z * GLOBE_RADIUS,
        p1.x * GLOBE_RADIUS, p1.y * GLOBE_RADIUS, p1.z * GLOBE_RADIUS
      );
    }
  }
  const arcGeo = new THREE.BufferGeometry();
  arcGeo.setAttribute('position', new THREE.Float32BufferAttribute(arcVertices, 3));
  const arcMat = new THREE.LineBasicMaterial({
    color: 0x7ce7ff,
    transparent: true,
    opacity: 0.34,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const arcLines = new THREE.LineSegments(arcGeo, arcMat);
  earthGroup.add(arcLines);

  // Glowing Hub Beacons (1 draw call)
  const hubGeo = new THREE.BufferGeometry();
  const hubPosArr = new Float32Array(network.hubs.length * 3);
  for (let i = 0; i < network.hubs.length; i++) {
    const hNode = network.hubs[i];
    hubPosArr[i * 3] = hNode.x * 5.08;
    hubPosArr[i * 3 + 1] = hNode.y * 5.08;
    hubPosArr[i * 3 + 2] = hNode.z * 5.08;
  }
  hubGeo.setAttribute('position', new THREE.BufferAttribute(hubPosArr, 3));
  const hubMat = new THREE.PointsMaterial({
    size: isMobile ? 0.36 : 0.32,
    map: circleSprite,
    color: 0xd8fc6c,
    transparent: true,
    opacity: 0.96,
    alphaTest: 0.01,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const hubBeacons = new THREE.Points(hubGeo, hubMat);
  earthGroup.add(hubBeacons);

  // Expanding concentric pulse rings tangent to 6 major hubs
  const rippleGeo = new THREE.RingGeometry(0.11, 0.16, 24);
  const rippleItems = [];
  const _rippleTarget = new THREE.Vector3();
  for (let i = 0; i < 6; i++) {
    const hNode = network.hubs[i * 2];
    const rMat = new THREE.MeshBasicMaterial({
      color: 0xb8dc3e,
      transparent: true,
      opacity: 0.65,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const rMesh = new THREE.Mesh(rippleGeo, rMat);
    rMesh.position.set(hNode.x * 5.09, hNode.y * 5.09, hNode.z * 5.09);
    _rippleTarget.set(hNode.x * 8, hNode.y * 8, hNode.z * 8);
    rMesh.lookAt(_rippleTarget);
    earthGroup.add(rMesh);
    rippleItems.push({ mesh: rMesh, mat: rMat, phaseOffset: i * 0.17 });
  }

  // Streaming Data Packets along the great-circle fiber arcs (zero-GC preallocated buffer)
  const packetGeo = new THREE.BufferGeometry();
  const packetPosArr = new Float32Array(network.packets.length * 3);
  packetGeo.setAttribute('position', new THREE.BufferAttribute(packetPosArr, 3));
  const packetMat = new THREE.PointsMaterial({
    size: isMobile ? 0.28 : 0.25,
    map: circleSprite,
    color: 0x82f0ff,
    transparent: true,
    opacity: 0.98,
    alphaTest: 0.01,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const packetPoints = new THREE.Points(packetGeo, packetMat);
  earthGroup.add(packetPoints);

  // 4. Atmosphere Glow
  const atmosGeometry = new THREE.SphereGeometry(5.22, coreSegments, coreSegments);
  const atmosMaterial = new THREE.MeshPhongMaterial({
    color: 0x9cc32e,
    transparent: true,
    opacity: 0.16,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const atmosphere = new THREE.Mesh(atmosGeometry, atmosMaterial);
  earthGroup.add(atmosphere);

  // Lights
  const ambientLight = new THREE.AmbientLight(0xf2f4ef, 0.32);
  scene.add(ambientLight);

  const pointLight = new THREE.PointLight(0x9cc32e, 2.8, 50);
  pointLight.position.set(10, 10, 10);
  scene.add(pointLight);

  const pointLight2 = new THREE.PointLight(0xb8dc3e, 1.5, 50);
  pointLight2.position.set(-10, -10, 10);
  scene.add(pointLight2);

  // Subtle interactive touch spotlight catching specular sheen on globe core
  const touchLight = new THREE.PointLight(0x9ee8ff, 0, 26);
  touchLight.position.set(0, 2, 8);
  scene.add(touchLight);

  // Floating Particles Background (also crisp circular sprites)
  const bgParticlesGeo = new THREE.BufferGeometry();
  const bgCount = isMobile ? 200 : 650;
  const bgPos = new Float32Array(bgCount * 3);
  for (let i = 0; i < bgCount * 3; i += 3) {
    bgPos[i] = (Math.random() - 0.5) * 50;
    bgPos[i + 1] = (Math.random() - 0.5) * 50;
    bgPos[i + 2] = (Math.random() - 0.5) * 30 - 10;
  }
  bgParticlesGeo.setAttribute('position', new THREE.BufferAttribute(bgPos, 3));
  const bgParticleMat = new THREE.PointsMaterial({
    size: isMobile ? 0.15 : 0.13,
    map: circleSprite,
    color: 0x9cc32e,
    transparent: true,
    opacity: 0.55,
    alphaTest: 0.01,
    depthWrite: false,
  });
  const bgParticles = new THREE.Points(bgParticlesGeo, bgParticleMat);
  scene.add(bgParticles);

  let isLightTheme = document.documentElement.classList.contains('light');

  function applyThemeColors(isLight) {
    isLightTheme = isLight;
    if (isLight) {
      coreMaterial.color.setHex(0xdce8cf);
      coreMaterial.emissive.setHex(0xcde0ba);
      coreMaterial.specular.setHex(0x6c9412);
      coreMaterial.opacity = 0.40;

      wireMaterial.color.setHex(0x3b6004);
      wireMaterial.opacity = 0.36;

      orbitMaterial.color.setHex(0x3f6204);
      orbitMaterial.opacity = 0.28;

      particleMaterial.uniforms.uBaseColor.value.setHex(0x2a4602);
      particleMaterial.uniforms.uHotColor.value.setHex(0x0284c7);
      particleMaterial.uniforms.uBaseSize.value = isMobile ? 0.175 : 0.15;
      particleMaterial.uniforms.uOpacity.value = 0.94;
      particleMaterial.blending = THREE.NormalBlending;
      particleMaterial.needsUpdate = true;

      touchShellMat.uniforms.uGlowColor.value.setHex(0x65a30d);
      touchShellMat.uniforms.uRingColor.value.setHex(0x0284c7);
      touchShellMat.uniforms.uLightMode.value = 1.0;
      touchShellMat.blending = THREE.NormalBlending;
      touchShellMat.needsUpdate = true;

      atmosMaterial.color.setHex(0x7cb016);
      atmosMaterial.opacity = 0.22;
      atmosMaterial.blending = THREE.NormalBlending;
      atmosMaterial.needsUpdate = true;

      ambientLight.intensity = 0.85;
      pointLight.color.setHex(0x557d08);
      pointLight.intensity = 1.8;
      touchLight.color.setHex(0x0284c7);

      bgParticleMat.color.setHex(0x3f6204);
      bgParticleMat.opacity = 0.58;
      bgParticleMat.size = isMobile ? 0.17 : 0.15;

      arcMat.color.setHex(0x0284c7);
      arcMat.opacity = 0.36;
      arcMat.blending = THREE.NormalBlending;
      arcMat.needsUpdate = true;

      hubMat.color.setHex(0x2a4602);
      hubMat.blending = THREE.NormalBlending;
      hubMat.needsUpdate = true;

      packetMat.color.setHex(0x0284c7);
      packetMat.blending = THREE.NormalBlending;
      packetMat.needsUpdate = true;

      for (let i = 0; i < rippleItems.length; i++) {
        rippleItems[i].mat.color.setHex(0x3f6204);
        rippleItems[i].mat.blending = THREE.NormalBlending;
        rippleItems[i].mat.needsUpdate = true;
      }
    } else {
      coreMaterial.color.setHex(0x070803);
      coreMaterial.emissive.setHex(0x050603);
      coreMaterial.specular.setHex(0x1a220a);
      coreMaterial.opacity = 0.95;

      wireMaterial.color.setHex(0x9cc32e);
      wireMaterial.opacity = 0.22;

      orbitMaterial.color.setHex(0xb8dc3e);
      orbitMaterial.opacity = 0.28;

      particleMaterial.uniforms.uBaseColor.value.setHex(0xb8dc3e);
      particleMaterial.uniforms.uHotColor.value.setHex(0x82f0ff);
      particleMaterial.uniforms.uBaseSize.value = isMobile ? 0.145 : 0.13;
      particleMaterial.uniforms.uOpacity.value = 0.96;
      particleMaterial.blending = THREE.AdditiveBlending;
      particleMaterial.needsUpdate = true;

      touchShellMat.uniforms.uGlowColor.value.setHex(0xc2f04d);
      touchShellMat.uniforms.uRingColor.value.setHex(0x7ce7ff);
      touchShellMat.uniforms.uLightMode.value = 0.0;
      touchShellMat.blending = THREE.AdditiveBlending;
      touchShellMat.needsUpdate = true;

      atmosMaterial.color.setHex(0x9cc32e);
      atmosMaterial.opacity = 0.16;
      atmosMaterial.blending = THREE.AdditiveBlending;
      atmosMaterial.needsUpdate = true;

      ambientLight.intensity = 0.32;
      pointLight.color.setHex(0x9cc32e);
      pointLight.intensity = 2.8;
      touchLight.color.setHex(0x9ee8ff);

      bgParticleMat.color.setHex(0x9cc32e);
      bgParticleMat.opacity = 0.55;
      bgParticleMat.size = isMobile ? 0.15 : 0.13;

      arcMat.color.setHex(0x7ce7ff);
      arcMat.opacity = 0.34;
      arcMat.blending = THREE.AdditiveBlending;
      arcMat.needsUpdate = true;

      hubMat.color.setHex(0xd8fc6c);
      hubMat.blending = THREE.AdditiveBlending;
      hubMat.needsUpdate = true;

      packetMat.color.setHex(0x82f0ff);
      packetMat.blending = THREE.AdditiveBlending;
      packetMat.needsUpdate = true;

      for (let i = 0; i < rippleItems.length; i++) {
        rippleItems[i].mat.color.setHex(0xb8dc3e);
        rippleItems[i].mat.blending = THREE.AdditiveBlending;
        rippleItems[i].mat.needsUpdate = true;
      }
    }
  }

  applyThemeColors(isLightTheme);
  window.addEventListener('themechange', (e) => {
    applyThemeColors(Boolean(e.detail?.isLight));
  });

  // Zero-GC Pointer / Touch Raycasting onto the 3D Globe
  const _raycaster = new THREE.Raycaster();
  const _ndc = new THREE.Vector2();
  const _hitWorld = new THREE.Vector3();
  const _hitLocal = new THREE.Vector3();
  const _planeNormal = new THREE.Vector3();
  const _hitPlane = new THREE.Plane();
  const _rayHitList = [];
  const _lightTargetWorld = new THREE.Vector3(0, 2, 8);
  let lastPointerMoveMs = 0;

  function resolveGlobeLocalDirection(clientX, clientY, outVec) {
    const w = window.innerWidth || 1;
    const h = window.innerHeight || 1;
    _ndc.set((clientX / w) * 2 - 1, -(clientY / h) * 2 + 1);
    _raycaster.setFromCamera(_ndc, camera);

    _rayHitList.length = 0;
    _raycaster.intersectObject(core, false, _rayHitList);
    if (_rayHitList.length > 0) {
      _hitWorld.copy(_rayHitList[0].point);
    } else {
      // If tap is outside globe silhouette, gently illuminate the nearest facing edge
      _planeNormal.subVectors(camera.position, earthGroup.position).normalize();
      _hitPlane.setFromNormalAndCoplanarPoint(_planeNormal, earthGroup.position);
      if (!_raycaster.ray.intersectPlane(_hitPlane, _hitWorld)) {
        _hitWorld.copy(camera.position);
      }
      _hitWorld.sub(earthGroup.position).normalize().multiplyScalar(4.8);
      _hitWorld.addScaledVector(_planeNormal, 1.9);
      _hitWorld.add(earthGroup.position);
    }

    _hitLocal.copy(_hitWorld);
    earthGroup.worldToLocal(_hitLocal);
    if (_hitLocal.lengthSq() < 0.0001) {
      _hitLocal.set(0, 0, 1);
    } else {
      _hitLocal.normalize();
    }
    outVec.copy(_hitLocal);
    _lightTargetWorld.copy(_hitWorld);
  }

  function triggerGlobeTouchPulse(clientX, clientY, intensity = 1) {
    const slot = surfaceSpots[nextSpotSlot];
    nextSpotSlot = (nextSpotSlot + 1) % surfaceSpots.length;
    resolveGlobeLocalDirection(clientX, clientY, slot.dir);
    slot.strength = intensity;
    slot.age = 0;
  }

  window.addEventListener(
    'pointerdown',
    (ev) => {
      triggerGlobeTouchPulse(ev.clientX, ev.clientY, 1.0);
    },
    { passive: true }
  );

  window.addEventListener(
    'pointermove',
    (ev) => {
      const now = performance.now();
      if (now - lastPointerMoveMs < 35) return;
      lastPointerMoveMs = now;
      resolveGlobeLocalDirection(ev.clientX, ev.clientY, hoverDirLocal);
      hoverTargetStrength = ev.pointerType === 'touch' ? 0.78 : 0.56;
      if (ev.buttons > 0 || ev.pointerType === 'touch') {
        triggerGlobeTouchPulse(ev.clientX, ev.clientY, 0.72);
      }
    },
    { passive: true }
  );

  window.addEventListener('blur', () => {
    hoverTargetStrength = 0;
  });

  // Animation Loop (smooth autonomous rotation + interactive touch energy + living data arcs)
  const clock = new THREE.Clock();
  const reducedMotion =
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let lastRenderTime = 0;
  const packetPosAttr = packetGeo.getAttribute('position');

  function updateLivingNetwork(elapsedTime) {
    // 1. Pulse expanding hub ripples
    for (let i = 0; i < rippleItems.length; i++) {
      const item = rippleItems[i];
      const wave = (elapsedTime * 0.45 + item.phaseOffset) % 1;
      const scale = 1 + wave * 2.5;
      item.mesh.scale.set(scale, scale, 1);
      item.mat.opacity = (1 - wave) * 0.7;
    }

    // 2. Stream data packets along great-circle arcs (zero GC allocations)
    for (let p = 0; p < network.packets.length; p++) {
      const pkt = network.packets[p];
      const arc = network.arcs[pkt.arcIdx];
      const u = (elapsedTime * arc.speed + arc.phase + pkt.offset) % 1;
      const fIdx = u * network.arcSteps;
      const i0 = Math.floor(fIdx);
      const i1 = Math.min(network.arcSteps, i0 + 1);
      const frac = fIdx - i0;
      const p0 = arc.points[i0];
      const p1 = arc.points[i1];
      packetPosArr[p * 3] = (p0.x + (p1.x - p0.x) * frac) * GLOBE_RADIUS;
      packetPosArr[p * 3 + 1] = (p0.y + (p1.y - p0.y) * frac) * GLOBE_RADIUS;
      packetPosArr[p * 3 + 2] = (p0.z + (p1.z - p0.z) * frac) * GLOBE_RADIUS;
    }
    packetPosAttr.needsUpdate = true;
  }

  // Initialize packet positions immediately for reduced-motion / first frame
  updateLivingNetwork(0.25);

  function animate(now = 0) {
    if (!reducedMotion) {
      requestAnimationFrame(animate);
    }
    if (document.hidden) return;
    // Pace WebGL at ~30fps on both desktop and mobile so UI scrolling stays instant
    if (now && now - lastRenderTime < 32) return;
    const dt = lastRenderTime ? Math.min(0.1, (now - lastRenderTime) / 1000) : 0.033;
    lastRenderTime = now;

    const elapsedTime = clock.getElapsedTime();

    // Update interactive surface hotspots & damped hover glow
    let peakEnergy = 0;
    for (let i = 0; i < surfaceSpots.length; i++) {
      const sp = surfaceSpots[i];
      if (sp.strength > 0.004) {
        sp.age += dt;
        sp.strength *= Math.exp(-1.55 * dt);
        if (sp.strength > peakEnergy) peakEnergy = sp.strength;
      } else {
        sp.strength = 0;
      }
    }
    hoverStrength += (hoverTargetStrength - hoverStrength) * (1 - Math.exp(-6.5 * dt));
    hoverTargetStrength *= Math.exp(-1.1 * dt);
    peakEnergy = Math.max(peakEnergy, hoverStrength * 0.55);

    particleMaterial.uniforms.uMeta0.value.set(surfaceSpots[0].strength, surfaceSpots[0].age);
    particleMaterial.uniforms.uMeta1.value.set(surfaceSpots[1].strength, surfaceSpots[1].age);
    particleMaterial.uniforms.uMeta2.value.set(surfaceSpots[2].strength, surfaceSpots[2].age);
    particleMaterial.uniforms.uHoverStrength.value = hoverStrength;

    touchShellMat.uniforms.uMeta0.value.set(surfaceSpots[0].strength, surfaceSpots[0].age);
    touchShellMat.uniforms.uMeta1.value.set(surfaceSpots[1].strength, surfaceSpots[1].age);
    touchShellMat.uniforms.uMeta2.value.set(surfaceSpots[2].strength, surfaceSpots[2].age);
    touchShellMat.uniforms.uHoverStrength.value = hoverStrength;

    // Gentle point light boost facing touched spot + subtle wire excitement
    touchLight.position.lerp(_lightTargetWorld, 1 - Math.exp(-8 * dt));
    const maxTouchLight = isLightTheme ? 2.4 : 3.8;
    touchLight.intensity += (peakEnergy * maxTouchLight - touchLight.intensity) * (1 - Math.exp(-7 * dt));
    wireMaterial.opacity = (isLightTheme ? 0.36 : 0.22) + peakEnergy * 0.14;

    // Clean autonomous rotation without gyroscope drift
    earthGroup.rotation.y += 0.003 + peakEnergy * 0.0012;
    earthGroup.rotation.x = 0.18;
    earthGroup.rotation.z = 0;
    earthGroup.position.x = 0;
    earthGroup.position.y = Math.sin(elapsedTime * 0.5) * 0.5;
    orbitRing.rotation.z = elapsedTime * 0.08;
    bgParticles.rotation.y = elapsedTime * 0.02;
    bgParticles.rotation.x = 0;

    if (!reducedMotion) {
      updateLivingNetwork(elapsedTime);
    }

    renderer.render(scene, camera);
  }

  animate();

  let lastWidth = window.innerWidth;
  window.addEventListener('resize', () => {
    const width = window.innerWidth;
    if (width === lastWidth) return;
    lastWidth = width;

    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(getTargetDpr());
    renderer.setSize(window.innerWidth, window.innerHeight);
    particleMaterial.uniforms.uPerspectiveScale.value = getPerspectiveScale();
    adjustScale();
  });

  return { scene, camera, renderer, earthGroup };
}
