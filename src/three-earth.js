import * as THREE from 'three';

export function initEarth(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const scene = new THREE.Scene();

  const isMobile = window.innerWidth < 768;

  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.z = isMobile ? 17 : 15;
  camera.position.y = isMobile ? 1.2 : 2;
  camera.lookAt(0, 0, 0);

  // Disable antialias on mobile to double rendering speed
  const renderer = new THREE.WebGLRenderer({ antialias: !isMobile, alpha: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(isMobile ? 1 : Math.min(window.devicePixelRatio, 1.5));
  container.appendChild(renderer.domElement);

  // Group to hold the earth components
  const earthGroup = new THREE.Group();
  scene.add(earthGroup);

  // Dynamically adjust scale depending on screen width
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

  // 1. Core Sphere (Dark) - lower segments on mobile
  const coreSegments = isMobile ? 24 : 64;
  const coreGeometry = new THREE.SphereGeometry(4.8, coreSegments, coreSegments);
  const coreMaterial = new THREE.MeshPhongMaterial({
    color: 0x050a15,
    emissive: 0x020510,
    specular: 0x111111,
    shininess: 10,
    transparent: true,
    opacity: 0.95,
  });
  const core = new THREE.Mesh(coreGeometry, coreMaterial);
  earthGroup.add(core);

  // 2. Wireframe / Tech Grid
  const wireGeometry = new THREE.SphereGeometry(5, isMobile ? 20 : 32, isMobile ? 20 : 32);
  const wireMaterial = new THREE.MeshBasicMaterial({
    color: 0x48d39b,
    wireframe: true,
    transparent: true,
    opacity: 0.08,
  });
  const wireframe = new THREE.Mesh(wireGeometry, wireMaterial);
  earthGroup.add(wireframe);

  // 3. Particles / Data nodes (Vertices of the sphere) - lower count on mobile
  const particlesGeometry = new THREE.BufferGeometry();
  const particleCount = isMobile ? 600 : 2000;
  const posArray = new Float32Array(particleCount * 3);

  for(let i = 0; i < particleCount * 3; i+=3) {
    // Distribute points on sphere
    const r = 5.05;
    const theta = 2 * Math.PI * Math.random();
    const phi = Math.acos(2 * Math.random() - 1);
    
    posArray[i] = r * Math.sin(phi) * Math.cos(theta);
    posArray[i+1] = r * Math.sin(phi) * Math.sin(theta);
    posArray[i+2] = r * Math.cos(phi);
  }

  particlesGeometry.setAttribute('position', new THREE.BufferAttribute(posArray, 3));
  const particleMaterial = new THREE.PointsMaterial({
    size: isMobile ? 0.05 : 0.04,
    color: 0x3ecf8e,
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending
  });
  
  const particlesMesh = new THREE.Points(particlesGeometry, particleMaterial);
  earthGroup.add(particlesMesh);

  // 4. Atmosphere Glow
  const atmosGeometry = new THREE.SphereGeometry(5.2, coreSegments, coreSegments);
  const atmosMaterial = new THREE.MeshPhongMaterial({
    color: 0x3b82f6,
    transparent: true,
    opacity: 0.12,
    side: THREE.BackSide,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });
  const atmosphere = new THREE.Mesh(atmosGeometry, atmosMaterial);
  earthGroup.add(atmosphere);

  // Lights
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
  scene.add(ambientLight);

  const pointLight = new THREE.PointLight(0x48d39b, 2, 50);
  pointLight.position.set(10, 10, 10);
  scene.add(pointLight);

  const pointLight2 = new THREE.PointLight(0x8b5cf6, 2, 50);
  pointLight2.position.set(-10, -10, 10);
  scene.add(pointLight2);

  // Floating Particles Background - lower count on mobile
  const bgParticlesGeo = new THREE.BufferGeometry();
  const bgCount = isMobile ? 250 : 1000;
  const bgPos = new Float32Array(bgCount * 3);
  for(let i=0; i<bgCount*3; i+=3) {
    bgPos[i] = (Math.random() - 0.5) * 50;
    bgPos[i+1] = (Math.random() - 0.5) * 50;
    bgPos[i+2] = (Math.random() - 0.5) * 30 - 10;
  }
  bgParticlesGeo.setAttribute('position', new THREE.BufferAttribute(bgPos, 3));
  const bgParticleMat = new THREE.PointsMaterial({
    size: 0.05,
    color: 0x7ce7ff,
    transparent: true,
    opacity: 0.4
  });
  const bgParticles = new THREE.Points(bgParticlesGeo, bgParticleMat);
  scene.add(bgParticles);

  // Animation Loop
  let mouseX = 0;
  let mouseY = 0;
  let targetX = 0;
  let targetY = 0;
  const windowHalfX = window.innerWidth / 2;
  const windowHalfY = window.innerHeight / 2;

  document.addEventListener('mousemove', (event) => {
    mouseX = (event.clientX - windowHalfX) * 0.001;
    mouseY = (event.clientY - windowHalfY) * 0.001;
  });

  const clock = new THREE.Clock();

  // Performance optimization: only render when the hero section is visible
  let isVisible = true;
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        isVisible = entry.isIntersecting;
      });
    }, { threshold: 0.01 });

    const heroSection = document.querySelector('.hero');
    if (heroSection) {
      observer.observe(heroSection);
    } else {
      observer.observe(container);
    }
  }

  function animate() {
    requestAnimationFrame(animate);
    if (!isVisible) return; // Skip heavy rendering calculations when hidden

    const elapsedTime = clock.getElapsedTime();

    targetX = mouseX * 0.5;
    targetY = mouseY * 0.5;

    // Smooth rotation based on mouse
    earthGroup.rotation.y += 0.002;
    earthGroup.rotation.x += 0.05 * (targetY - earthGroup.rotation.x);
    earthGroup.rotation.z += 0.05 * (targetX - earthGroup.rotation.z);

    // Float effect
    earthGroup.position.y = Math.sin(elapsedTime * 0.5) * 0.5;

    // Background particles slow drift
    bgParticles.rotation.y = elapsedTime * 0.02;

    renderer.render(scene, camera);
  }

  animate();

  let lastWidth = window.innerWidth;

  // Resize handler (ignore height-only changes caused by mobile address bars)
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
