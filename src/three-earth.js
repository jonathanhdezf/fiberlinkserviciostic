import * as THREE from 'three';

function createWebGLRendererSafe(isMobile) {
  try {
    const glCanvas = document.createElement('canvas');
    const ctxAttrs = {
      alpha: true,
      antialias: false,
      depth: true,
      stencil: false,
      powerPreference: 'default',
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
      antialias: !isMobile && !isSoftwareGl,
      alpha: true,
      powerPreference: isSoftwareGl ? 'default' : 'high-performance',
    });

    return { renderer, isSoftwareGl };
  } catch {
    return { renderer: null, isSoftwareGl: false };
  }
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
  let isLight = document.documentElement.classList.contains('light');

  function resize() {
    w = window.innerWidth;
    h = window.innerHeight;
    // 1x pixel ratio on 2D ambient globe keeps frame time < 1ms on mobile
    canvas.width = Math.max(1, w);
    canvas.height = Math.max(1, h);
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
  const nodeCount = isMobile ? 150 : 240;
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
  const starCount = isMobile ? 32 : 64;
  const stars = [];
  for (let i = 0; i < starCount; i++) {
    stars.push({
      x: (Math.random() - 0.5) * 2.4,
      y: (Math.random() - 0.5) * 2.0,
      r: 1.1 + Math.random() * 1.4,
      p: Math.random() * Math.PI * 2,
    });
  }

  let rotY = 0;
  let rotX = 0.24;
  let rotZ = 0;
  let t = 0;
  let lastFrameTime = 0;

  function project(x, y, z, radius, cy, cosY, sinY, cosX, sinX, cosZ, sinZ) {
    const x1 = x * cosY - z * sinY;
    const z1 = x * sinY + z * cosY;

    const y2 = y * cosX - z1 * sinX;
    const z2 = y * sinX + z1 * cosX;

    const x3 = x1 * cosZ - y2 * sinZ;
    const y3 = x1 * sinZ + y2 * cosZ;

    const perspective = 3.2 / (3.2 - z2 * 0.82);
    return {
      sx: w * 0.5 + x3 * radius * perspective,
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
    lastFrameTime = now;

    ctx.clearRect(0, 0, w, h);

    t += 0.032;
    rotY += 0.005;
    rotX = 0.24;
    rotZ = 0;

    const cosY = Math.cos(rotY);
    const sinY = Math.sin(rotY);
    const cosX = Math.cos(rotX);
    const sinX = Math.sin(rotX);
    const cosZ = Math.cos(rotZ);
    const sinZ = Math.sin(rotZ);

    const radius = Math.min(w, h) * (w < 480 ? 0.30 : w < 768 ? 0.33 : 0.34);
    const floatY = reducedMotion ? 0 : Math.sin(t * 0.9) * 9;
    const cy = h * 0.48 + floatY;

    // Volumetric core + atmosphere halo
    const halo = ctx.createRadialGradient(w * 0.5, cy, radius * 0.25, w * 0.5, cy, radius * 1.32);
    if (isLight) {
      halo.addColorStop(0, 'rgba(156, 195, 46, 0.20)');
      halo.addColorStop(0.65, 'rgba(108, 148, 18, 0.10)');
      halo.addColorStop(1, 'rgba(77, 115, 6, 0)');
    } else {
      halo.addColorStop(0, 'rgba(156, 195, 46, 0.16)');
      halo.addColorStop(0.68, 'rgba(156, 195, 46, 0.05)');
      halo.addColorStop(1, 'rgba(156, 195, 46, 0)');
    }
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(w * 0.5, cy, radius * 1.32, 0, Math.PI * 2);
    ctx.fill();

    // Subtle outer sphere silhouette rim
    ctx.lineWidth = 1.1;
    ctx.strokeStyle = isLight ? 'rgba(63, 98, 4, 0.24)' : 'rgba(156, 195, 46, 0.20)';
    ctx.beginPath();
    ctx.arc(w * 0.5, cy, radius * 1.01, 0, Math.PI * 2);
    ctx.stroke();

    // Wireframe meridians & parallels
    ctx.lineWidth = 1;
    ctx.strokeStyle = isLight ? 'rgba(58, 94, 4, 0.34)' : 'rgba(156, 195, 46, 0.24)';

    const meridians = 9;
    const steps = 28;
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

    const parallels = [-0.65, -0.35, 0, 0.35, 0.65];
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

    // Batch front & back sphere particle nodes for high speed (2 draw calls instead of 240)
    ctx.fillStyle = isLight ? 'rgba(42, 70, 2, 0.34)' : 'rgba(156, 195, 46, 0.32)';
    ctx.beginPath();
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      const pt = project(n.x, n.y, n.z, radius * 1.02, cy, cosY, sinY, cosX, sinX, cosZ, sinZ);
      if (pt.depth <= 0) {
        ctx.moveTo(pt.sx + 1.3, pt.sy);
        ctx.arc(pt.sx, pt.sy, 1.3 * pt.scale, 0, Math.PI * 2);
      }
    }
    ctx.fill();

    ctx.fillStyle = isLight ? 'rgba(42, 70, 2, 0.88)' : 'rgba(184, 220, 62, 0.88)';
    ctx.beginPath();
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      const pt = project(n.x, n.y, n.z, radius * 1.02, cy, cosY, sinY, cosX, sinX, cosZ, sinZ);
      if (pt.depth > 0) {
        const r = 2.05 * pt.scale;
        ctx.moveTo(pt.sx + r, pt.sy);
        ctx.arc(pt.sx, pt.sy, r, 0, Math.PI * 2);
      }
    }
    ctx.fill();

    // Ambient orbital star particles
    ctx.fillStyle = isLight ? 'rgba(68, 104, 4, 0.45)' : 'rgba(156, 195, 46, 0.48)';
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
  const { renderer, isSoftwareGl } = createWebGLRendererSafe(isMobile);

  if (!renderer) {
    return initEarth2DFallback(container);
  }

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.z = isMobile ? 17 : 15;
  camera.position.y = isMobile ? 1.2 : 2;
  camera.lookAt(0, 0, 0);

  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(isMobile || isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 1.5));
  container.appendChild(renderer.domElement);

  const earthGroup = new THREE.Group();
  scene.add(earthGroup);

  function adjustScale() {
    const width = window.innerWidth;
    if (width < 480) {
      earthGroup.scale.set(0.55, 0.55, 0.55);
      camera.position.z = 17;
      camera.position.y = 1.2;
    } else if (width < 768) {
      earthGroup.scale.set(0.75, 0.75, 0.75);
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

  // 1. Core Sphere
  const coreSegments = isMobile ? 20 : 48;
  const coreGeometry = new THREE.SphereGeometry(4.8, coreSegments, coreSegments);
  const coreMaterial = new THREE.MeshPhongMaterial({
    color: 0x070803,
    emissive: 0x050603,
    specular: 0x1a220a,
    shininess: 12,
    transparent: true,
    opacity: 0.95,
  });
  const core = new THREE.Mesh(coreGeometry, coreMaterial);
  earthGroup.add(core);

  // 2. Wireframe / Tech Grid
  const wireGeometry = new THREE.SphereGeometry(5, isMobile ? 18 : 28, isMobile ? 18 : 28);
  const wireMaterial = new THREE.MeshBasicMaterial({
    color: 0x9cc32e,
    wireframe: true,
    transparent: true,
    opacity: 0.24,
  });
  const wireframe = new THREE.Mesh(wireGeometry, wireMaterial);
  earthGroup.add(wireframe);

  // 3. Particles / Data nodes
  const particlesGeometry = new THREE.BufferGeometry();
  const particleCount = isMobile ? 500 : 1400;
  const posArray = new Float32Array(particleCount * 3);

  for (let i = 0; i < particleCount * 3; i += 3) {
    const r = 5.05;
    const theta = 2 * Math.PI * Math.random();
    const phi = Math.acos(2 * Math.random() - 1);

    posArray[i] = r * Math.sin(phi) * Math.cos(theta);
    posArray[i + 1] = r * Math.sin(phi) * Math.sin(theta);
    posArray[i + 2] = r * Math.cos(phi);
  }

  particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
  const particleMaterial = new THREE.PointsMaterial({
    size: isMobile ? 0.06 : 0.052,
    color: 0xb8dc3e,
    transparent: true,
    opacity: 0.95,
    blending: THREE.AdditiveBlending,
  });

  const particlesMesh = new THREE.Points(particlesGeometry, particleMaterial);
  earthGroup.add(particlesMesh);

  // 4. Atmosphere Glow
  const atmosGeometry = new THREE.SphereGeometry(5.2, coreSegments, coreSegments);
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

  // Floating Particles Background
  const bgParticlesGeo = new THREE.BufferGeometry();
  const bgCount = isMobile ? 180 : 650;
  const bgPos = new Float32Array(bgCount * 3);
  for (let i = 0; i < bgCount * 3; i += 3) {
    bgPos[i] = (Math.random() - 0.5) * 50;
    bgPos[i + 1] = (Math.random() - 0.5) * 50;
    bgPos[i + 2] = (Math.random() - 0.5) * 30 - 10;
  }
  bgParticlesGeo.setAttribute('position', new THREE.BufferAttribute(bgPos, 3));
  const bgParticleMat = new THREE.PointsMaterial({
    size: 0.06,
    color: 0x9cc32e,
    transparent: true,
    opacity: 0.48,
  });
  const bgParticles = new THREE.Points(bgParticlesGeo, bgParticleMat);
  scene.add(bgParticles);

  function applyThemeColors(isLight) {
    if (isLight) {
      coreMaterial.color.setHex(0xdce8cf);
      coreMaterial.emissive.setHex(0xcde0ba);
      coreMaterial.specular.setHex(0x6c9412);
      coreMaterial.opacity = 0.40;

      wireMaterial.color.setHex(0x3b6004);
      wireMaterial.opacity = 0.42;

      particleMaterial.color.setHex(0x2a4602);
      particleMaterial.size = isMobile ? 0.088 : 0.075;
      particleMaterial.opacity = 0.94;
      particleMaterial.blending = THREE.NormalBlending;
      particleMaterial.needsUpdate = true;

      atmosMaterial.color.setHex(0x7cb016);
      atmosMaterial.opacity = 0.22;
      atmosMaterial.blending = THREE.NormalBlending;
      atmosMaterial.needsUpdate = true;

      ambientLight.intensity = 0.85;
      pointLight.color.setHex(0x557d08);
      pointLight.intensity = 1.8;

      bgParticleMat.color.setHex(0x3f6204);
      bgParticleMat.opacity = 0.55;
      bgParticleMat.size = 0.08;
    } else {
      coreMaterial.color.setHex(0x070803);
      coreMaterial.emissive.setHex(0x050603);
      coreMaterial.specular.setHex(0x1a220a);
      coreMaterial.opacity = 0.95;

      wireMaterial.color.setHex(0x9cc32e);
      wireMaterial.opacity = 0.24;

      particleMaterial.color.setHex(0xb8dc3e);
      particleMaterial.size = isMobile ? 0.058 : 0.052;
      particleMaterial.opacity = 0.95;
      particleMaterial.blending = THREE.AdditiveBlending;
      particleMaterial.needsUpdate = true;

      atmosMaterial.color.setHex(0x9cc32e);
      atmosMaterial.opacity = 0.16;
      atmosMaterial.blending = THREE.AdditiveBlending;
      atmosMaterial.needsUpdate = true;

      ambientLight.intensity = 0.32;
      pointLight.color.setHex(0x9cc32e);
      pointLight.intensity = 2.8;

      bgParticleMat.color.setHex(0x9cc32e);
      bgParticleMat.opacity = 0.48;
      bgParticleMat.size = 0.06;
    }
  }

  applyThemeColors(document.documentElement.classList.contains('light'));
  window.addEventListener('themechange', (e) => {
    applyThemeColors(Boolean(e.detail?.isLight));
  });

  // Animation Loop (smooth autonomous rotation, zero mousemove listeners)
  const clock = new THREE.Clock();
  const reducedMotion =
    window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let lastRenderTime = 0;

  function animate(now = 0) {
    if (!reducedMotion) {
      requestAnimationFrame(animate);
    }
    if (document.hidden) return;
    // Pace WebGL at ~30fps on both desktop and mobile so UI scrolling stays instant
    if (now && now - lastRenderTime < 32) return;
    lastRenderTime = now;

    const elapsedTime = clock.getElapsedTime();

    earthGroup.rotation.y += 0.003;
    earthGroup.rotation.x = 0.18;
    earthGroup.position.y = Math.sin(elapsedTime * 0.5) * 0.5;
    bgParticles.rotation.y = elapsedTime * 0.02;

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
    renderer.setSize(window.innerWidth, window.innerHeight);
    adjustScale();
  });

  return { scene, camera, renderer, earthGroup };
}
