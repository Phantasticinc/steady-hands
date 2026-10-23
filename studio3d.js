import * as THREE from './vendor/three.module.js';

/**
 * SteadyHands — Three.js 3D PBR Studio Engine
 * Renders:
 * 1. 3D Deformable PBR Balloon (Subsurface Latex, Liquid Chrome, Biolume Gel)
 *    with real-time vertex deformation, normal recalculation, internal 3D bubbles,
 *    and multi-touch grab/stretch/pinch/twist physics.
 * 2. 3D Perspective-Tilted Bistable Silicone Pop Tray (5x5 3D domes + 180° flip).
 * 3. 3D Volumetric Refractive Glass Breathe Core with interactive 3D galaxy rotation.
 */
export class Studio3DEngine {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.canvas.width = 720;
    this.canvas.height = 820;

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      alpha: true,
      antialias: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true
    });
    this.renderer.setSize(720, 820, false);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.22;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.envMap = this.createStudioEnvMap();
    this.initBalloonScene();
    this.initPop3DScene();
    this.initBreatheScene();
  }

  createStudioEnvMap() {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 256;
    const ctx = c.getContext('2d');

    // Deep studio background gradient
    const bg = ctx.createLinearGradient(0, 0, 0, 256);
    bg.addColorStop(0, '#1e293b');
    bg.addColorStop(0.45, '#0f172a');
    bg.addColorStop(0.55, '#090d16');
    bg.addColorStop(1, '#020617');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, 512, 256);

    // Overhead key studio softbox
    const sb1 = ctx.createRadialGradient(256, 42, 8, 256, 42, 140);
    sb1.addColorStop(0, 'rgba(255, 255, 255, 1.0)');
    sb1.addColorStop(0.45, 'rgba(226, 232, 240, 0.75)');
    sb1.addColorStop(1, 'rgba(30, 41, 59, 0.0)');
    ctx.fillStyle = sb1;
    ctx.fillRect(0, 0, 512, 180);

    // Cyan left rim strip
    const sb2 = ctx.createRadialGradient(95, 110, 5, 95, 110, 95);
    sb2.addColorStop(0, 'rgba(56, 189, 248, 0.95)');
    sb2.addColorStop(1, 'rgba(56, 189, 248, 0.0)');
    ctx.fillStyle = sb2;
    ctx.fillRect(0, 20, 220, 180);

    // Warm amber right rim strip
    const sb3 = ctx.createRadialGradient(415, 115, 5, 415, 115, 95);
    sb3.addColorStop(0, 'rgba(251, 191, 36, 0.9)');
    sb3.addColorStop(1, 'rgba(251, 191, 36, 0.0)');
    ctx.fillStyle = sb3;
    ctx.fillRect(300, 20, 212, 180);

    const tex = new THREE.CanvasTexture(c);
    tex.mapping = THREE.EquirectangularReflectionMapping;
    tex.colorSpace = THREE.SRGBColorSpace;

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    pmrem.compileEquirectangularShader();
    const env = pmrem.fromEquirectangular(tex).texture;
    pmrem.dispose();
    tex.dispose();
    return env;
  }

  /* ========================================================================
     1. 3D DEFORMABLE PBR BALLOON SCENE
     ======================================================================== */
  initBalloonScene() {
    this.balloonScene = new THREE.Scene();
    this.balloonScene.environment = this.envMap;

    this.balloonCamera = new THREE.PerspectiveCamera(38, 720 / 820, 0.1, 50);
    this.balloonCamera.position.set(0, 0.05, 5.8);

    const keyLight = new THREE.DirectionalLight(0xffffff, 2.6);
    keyLight.position.set(-2.6, 3.8, 4.2);
    this.balloonScene.add(keyLight);

    const rimCyan = new THREE.PointLight(0x38bdf8, 4.5, 12);
    rimCyan.position.set(-3.2, -1.8, 2.2);
    this.balloonScene.add(rimCyan);

    const rimWarm = new THREE.PointLight(0xf59e0b, 3.4, 12);
    rimWarm.position.set(3.2, 1.5, 2.0);
    this.balloonScene.add(rimWarm);

    this.balloonGroup = new THREE.Group();
    this.balloonScene.add(this.balloonGroup);

    // High-resolution 64x48 subdivided sphere for smooth 3D finger indentation & stretching
    this.balloonGeo = new THREE.SphereGeometry(1.48, 64, 48);
    const posAttr = this.balloonGeo.attributes.position;
    this.basePositions = new Float32Array(posAttr.count * 3);

    // Sculpt base teardrop shape
    for (let i = 0; i < posAttr.count; i++) {
      let x = posAttr.getX(i);
      let y = posAttr.getY(i);
      let z = posAttr.getZ(i);
      const ny = y / 1.48;
      // Taper slightly toward top neck, fuller rounded bottom
      const profile = 1.0 - 0.11 * ny + 0.05 * (1.0 - ny * ny);
      x *= profile;
      z *= profile;
      y *= 1.08;
      this.basePositions[i * 3] = x;
      this.basePositions[i * 3 + 1] = y;
      this.basePositions[i * 3 + 2] = z;
      posAttr.setXYZ(i, x, y, z);
    }
    this.balloonGeo.computeVertexNormals();

    this.balloonMat = new THREE.MeshPhysicalMaterial({
      color: new THREE.Color(0x0ea5e9),
      emissive: new THREE.Color(0x032842),
      emissiveIntensity: 0.35,
      roughness: 0.09,
      metalness: 0.05,
      transmission: 0.58,
      thickness: 2.2,
      ior: 1.38,
      reflectivity: 0.95,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      iridescence: 0.38,
      iridescenceIOR: 1.3,
      envMapIntensity: 1.85
    });

    this.balloonMesh = new THREE.Mesh(this.balloonGeo, this.balloonMat);
    this.balloonGroup.add(this.balloonMesh);

    // Sculpted 3D tied rubber knot + rolled inflation lip at top of balloon
    const knotGroup = new THREE.Group();
    const neckGeo = new THREE.CylinderGeometry(0.18, 0.11, 0.24, 28);
    const lipGeo = new THREE.TorusGeometry(0.2, 0.065, 20, 36);
    lipGeo.rotateX(Math.PI / 2);
    lipGeo.translate(0, 0.12, 0);
    this.knotMesh1 = new THREE.Mesh(neckGeo, this.balloonMat);
    this.knotMesh2 = new THREE.Mesh(lipGeo, this.balloonMat);
    knotGroup.add(this.knotMesh1, this.knotMesh2);
    knotGroup.position.set(0, 1.66, 0);
    this.knotGroup = knotGroup;
    this.balloonGroup.add(knotGroup);

    // Internal 3D floating air bubbles / bioluminescent spores
    this.innerBubblesGroup = new THREE.Group();
    const bubGeo = new THREE.SphereGeometry(0.085, 16, 16);
    this.innerBubbleMat = new THREE.MeshPhysicalMaterial({
      color: 0xe0f2fe,
      emissive: 0x38bdf8,
      emissiveIntensity: 0.45,
      roughness: 0.05,
      metalness: 0.1,
      transmission: 0.85,
      ior: 1.15
    });
    this.innerBubbles = [];
    for (let i = 0; i < 22; i++) {
      const m = new THREE.Mesh(bubGeo, this.innerBubbleMat);
      const r = 0.25 + Math.random() * 0.82;
      const theta = Math.random() * Math.PI * 2;
      const phi = (Math.random() - 0.5) * Math.PI * 0.8;
      const bx = r * Math.cos(phi) * Math.cos(theta);
      const by = r * Math.sin(phi);
      const bz = r * Math.cos(phi) * Math.sin(theta);
      const sc = 0.45 + Math.random() * 1.15;
      m.scale.setScalar(sc);
      m.position.set(bx, by, bz);
      this.innerBubblesGroup.add(m);
      this.innerBubbles.push({ mesh: m, bx, by, bz, phase: Math.random() * 6.28, speed: 0.8 + Math.random() });
    }
    this.balloonGroup.add(this.innerBubblesGroup);
  }

  updateBalloonMaterial(alchemy, pressure) {
    const m = this.balloonMat;
    if (alchemy === 'chrome') {
      m.color.setHex(0xe2e8f0);
      m.emissive.setHex(0x0f172a);
      m.emissiveIntensity = 0.15 + pressure * 0.25;
      m.metalness = 0.96;
      m.roughness = 0.04;
      m.transmission = 0.0;
      m.iridescence = 0.25;
      m.envMapIntensity = 2.4;
      this.innerBubblesGroup.visible = false;
    } else if (alchemy === 'biolume') {
      m.color.setHex(0x10b981);
      m.emissive.setHex(0x059669);
      m.emissiveIntensity = 0.55 + pressure * 0.75;
      m.metalness = 0.08;
      m.roughness = 0.1;
      m.transmission = 0.54;
      m.iridescence = 0.65;
      m.envMapIntensity = 1.9;
      this.innerBubblesGroup.visible = true;
      this.innerBubbleMat.color.setHex(0xa7f3d0);
      this.innerBubbleMat.emissive.setHex(0x34d399);
      this.innerBubbleMat.emissiveIntensity = 1.2;
    } else {
      // Water
      m.color.setHex(0x0ea5e9);
      m.emissive.setHex(0x0369a1);
      m.emissiveIntensity = 0.32 + pressure * 0.45;
      m.metalness = 0.04;
      m.roughness = 0.07;
      m.transmission = 0.64;
      m.iridescence = 0.38;
      m.envMapIntensity = 1.95;
      this.innerBubblesGroup.visible = true;
      this.innerBubbleMat.color.setHex(0xe0f2fe);
      this.innerBubbleMat.emissive.setHex(0x38bdf8);
      this.innerBubbleMat.emissiveIntensity = 0.45;
    }
    // Redline warning tint when pressure approaches burst threshold
    if (pressure > 0.72) {
      const warn = (pressure - 0.72) / 0.28;
      m.emissive.lerp(new THREE.Color(0xf43f5e), warn * 0.65);
    }
  }

  renderBalloon3D(targetCtx, width, height, timeSec, sim, alchemy) {
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.renderer.setSize(width, height, false);
      this.balloonCamera.aspect = width / height;
      this.balloonCamera.updateProjectionMatrix();
    }

    this.updateBalloonMaterial(alchemy, sim.pressure);

    const scale = sim.bursting ? Math.max(0.01, sim.respawnScale) : 1.0;
    this.balloonGroup.scale.setScalar(scale);

    // Subtle floating + rotational tilt from finger pull
    this.balloonGroup.position.x = sim.offsetX * 0.42;
    this.balloonGroup.position.y = Math.sin(timeSec * 2.1) * 0.05 - sim.offsetY * 0.42;
    this.balloonGroup.rotation.z = sim.twistAngle * 0.45 - sim.offsetX * 0.18;
    this.balloonGroup.rotation.x = sim.offsetY * 0.18;

    // Animate internal 3D bubbles
    for (let i = 0; i < this.innerBubbles.length; i++) {
      const b = this.innerBubbles[i];
      b.mesh.position.set(
        b.bx * (1 + sim.stretchX * 0.35) + Math.sin(timeSec * b.speed + b.phase) * 0.08,
        b.by * (1 + sim.stretchY * 0.35) + Math.cos(timeSec * b.speed + b.phase) * 0.08,
        b.bz
      );
    }

    // Real-time 3D vertex deformation:
    // - Multi-touch grab & stretch vectors
    // - Two-finger pinch waist-squeeze & taffy pull
    // - Spherical harmonic elastic jelly waves
    const posAttr = this.balloonGeo.attributes.position;
    const base = this.basePositions;
    const p = sim.pressure;
    const jellyAmp = sim.jellyEnergy;

    // Convert active finger pointers from canvas space (0..width, 0..height) to balloon local 3D space (-2..2)
    const fingers = sim.activeFingers || [];

    for (let i = 0; i < posAttr.count; i++) {
      const idx = i * 3;
      let vx = base[idx];
      let vy = base[idx + 1];
      let vz = base[idx + 2];

      const len = Math.hypot(vx, vy, vz) || 1;
      const nx = vx / len;
      const ny = vy / len;
      const nz = vz / len;

      // 1. Hydrostatic inflation + two-finger taffy stretch / waist pinch
      let sx = 1.0 + p * 0.16 + sim.stretchX;
      let sy = 1.0 + p * 0.12 + sim.stretchY;
      let sz = 1.0 + p * 0.16 - (sim.stretchX + sim.stretchY) * 0.32;

      // Waist squeeze when pinching with 2 fingers (bulges top and bottom lobes!)
      if (sim.pinchSqueeze > 0.01) {
        const waist = Math.exp(-vy * vy * 1.4);
        const lobeBulge = 1.0 - waist;
        sx *= 1.0 - sim.pinchSqueeze * waist * 0.42 + sim.pinchSqueeze * lobeBulge * 0.26;
        sy *= 1.0 + sim.pinchSqueeze * 0.22;
        sz *= 1.0 + sim.pinchSqueeze * 0.18;
      }

      vx *= sx;
      vy *= sy;
      vz *= sz;

      // 2. Direct per-finger 3D rubber grab-and-stretch + thumb indentation
      for (let f = 0; f < fingers.length; f++) {
        const fg = fingers[f];
        // fg.wx, fg.wy are in [-1.8, 1.8]
        const dx = vx - fg.wx;
        const dy = vy - fg.wy;
        const d2 = dx * dx + dy * dy;

        if (vz > -0.2) {
          // Gaussian influence zone under each finger
          const w = Math.exp(-d2 / 0.62);
          // Dragging stretches the rubber outward along the finger's pull vector (fg.pullX, fg.pullY)!
          vx += fg.pullX * w * 0.85;
          vy += fg.pullY * w * 0.85;
          // Pressing indents the front Z surface while bulging the surrounding rim
          const rimRing = Math.exp(-Math.pow(Math.sqrt(d2) - 0.72, 2) / 0.18);
          vz -= w * (0.42 + p * 0.35) * Math.max(0.2, nz);
          vz += rimRing * (0.18 + p * 0.22);
          vx += nx * rimRing * 0.14;
          vy += ny * rimRing * 0.14;
        }
      }

      // 3. Elastic jelly harmonic ripples + high-pressure tremor
      if (jellyAmp > 0.005 || p > 0.45) {
        const wave =
          Math.sin(vy * 4.5 + timeSec * 16.0) *
          Math.cos(vx * 4.2 - timeSec * 14.0) *
          (jellyAmp * 0.18 + Math.max(0, p - 0.45) * 0.09);
        vx += nx * wave;
        vy += ny * wave;
        vz += nz * wave;
      }

      // 4. Torsional twist around Y axis
      if (Math.abs(sim.twistAngle) > 0.005) {
        const ang = sim.twistAngle * vy * 0.55;
        const ca = Math.cos(ang);
        const sa = Math.sin(ang);
        const rx = vx * ca - vz * sa;
        const rz = vx * sa + vz * ca;
        vx = rx;
        vz = rz;
      }

      posAttr.setXYZ(i, vx, vy, vz);
    }

    posAttr.needsUpdate = true;
    this.balloonGeo.computeVertexNormals();

    this.knotGroup.position.set(
      sim.offsetX * 0.15,
      1.64 * (1.0 + p * 0.11 + sim.stretchY * 0.85),
      0
    );

    this.renderer.render(this.balloonScene, this.balloonCamera);
    targetCtx.drawImage(this.canvas, 0, 0, width, height);
  }

  /* ========================================================================
     2. 3D PERSPECTIVE SILICONE POP TRAY SCENE
     ======================================================================== */
  initPop3DScene() {
    this.popScene = new THREE.Scene();
    this.popScene.environment = this.envMap;

    this.popCamera = new THREE.PerspectiveCamera(36, 1.0, 0.1, 50);
    this.popCamera.position.set(0, 0, 7.2);

    const key = new THREE.DirectionalLight(0xffffff, 2.4);
    key.position.set(-2.5, 4.0, 5.0);
    this.popScene.add(key);

    const fill = new THREE.PointLight(0x38bdf8, 3.0, 14);
    fill.position.set(3.2, -2.5, 3.5);
    this.popScene.add(fill);

    this.popGroup = new THREE.Group();
    this.popScene.add(this.popGroup);

    // Sculpted 3D anodized tray base
    const trayGeo = new THREE.BoxGeometry(4.3, 4.3, 0.28);
    const trayMat = new THREE.MeshPhysicalMaterial({
      color: 0x1e293b,
      roughness: 0.24,
      metalness: 0.78,
      clearcoat: 0.65,
      envMapIntensity: 1.5
    });
    this.popTrayMesh = new THREE.Mesh(trayGeo, trayMat);
    this.popTrayMesh.position.z = -0.08;
    this.popGroup.add(this.popTrayMesh);

    this.popDomes = [];
    const domeGeo = new THREE.SphereGeometry(0.33, 28, 20, 0, Math.PI * 2, 0, Math.PI * 0.58);
    const palette = [0x38bdf8, 0x34d399, 0xa855f7, 0xf59e0b, 0xfb7185];

    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        const mat = new THREE.MeshPhysicalMaterial({
          color: palette[r],
          roughness: 0.18,
          metalness: 0.05,
          transmission: 0.32,
          thickness: 0.8,
          clearcoat: 0.9,
          clearcoatRoughness: 0.12,
          envMapIntensity: 1.6
        });
        const mesh = new THREE.Mesh(domeGeo, mat);
        const x = (c - 2) * 0.78;
        const y = (2 - r) * 0.78;
        mesh.position.set(x, y, 0.05);
        this.popGroup.add(mesh);
        this.popDomes.push({ mesh, mat, baseColor: palette[r], x, y });
      }
    }
  }

  renderPopTray3D(targetCtx, width, height, fluxSim, poppedMap) {
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.renderer.setSize(width, height, false);
      this.popCamera.aspect = width / height;
      this.popCamera.updateProjectionMatrix();
    }

    this.popGroup.rotation.x = fluxSim.tiltX;
    this.popGroup.rotation.y = fluxSim.tiltY + fluxSim.flipAngle;

    for (let i = 0; i < 25; i++) {
      const d = this.popDomes[i];
      const depth = (fluxSim.popIndent && typeof fluxSim.popIndent[i] === 'number') ? fluxSim.popIndent[i] : (poppedMap[i] ? 1 : 0);
      // Map depth (0..1) to 3D Z inversion scale (+1 = popped out toward camera, -0.75 = snapped inward)
      const zScale = 1.0 - depth * 1.72;
      d.mesh.scale.set(1.0 + Math.sin(depth * Math.PI) * 0.08, 1.0 + Math.sin(depth * Math.PI) * 0.08, zScale);
      d.mesh.position.z = 0.06 - depth * 0.12;
      d.mat.emissive.setHex(d.baseColor);
      d.mat.emissiveIntensity = poppedMap[i] ? 0.12 : 0.32;
    }

    this.renderer.render(this.popScene, this.popCamera);
    targetCtx.drawImage(this.canvas, 0, 0, width, height);
  }

  /* ========================================================================
     3. 3D VOLUMETRIC REFRACTIVE GLASS BREATHE CORE SCENE
     ======================================================================== */
  initBreatheScene() {
    this.breatheScene = new THREE.Scene();
    this.breatheScene.environment = this.envMap;

    this.breatheCamera = new THREE.PerspectiveCamera(38, 1.0, 0.1, 50);
    this.breatheCamera.position.set(0, 0, 6.2);

    const l1 = new THREE.DirectionalLight(0xffffff, 2.5);
    l1.position.set(-3, 4, 4);
    this.breatheScene.add(l1);

    this.breatheGroup = new THREE.Group();
    this.breatheScene.add(this.breatheGroup);

    // Outer 3D Refractive Glass Containment Sphere
    const glassGeo = new THREE.SphereGeometry(1.45, 56, 42);
    this.breatheGlassMat = new THREE.MeshPhysicalMaterial({
      color: 0x38bdf8,
      emissive: 0x0c4a6e,
      emissiveIntensity: 0.35,
      roughness: 0.05,
      metalness: 0.08,
      transmission: 0.78,
      thickness: 1.9,
      ior: 1.45,
      clearcoat: 1.0,
      clearcoatRoughness: 0.04,
      iridescence: 0.55,
      transparent: true,
      opacity: 0.88,
      envMapIntensity: 2.2
    });
    this.breatheGlassMesh = new THREE.Mesh(glassGeo, this.breatheGlassMat);
    this.breatheGroup.add(this.breatheGlassMesh);

    // Inner Glowing Singularity Core
    const coreGeo = new THREE.SphereGeometry(0.62, 36, 28);
    this.breatheCoreMat = new THREE.MeshStandardMaterial({
      color: 0x5eead4,
      emissive: 0x14b8a6,
      emissiveIntensity: 1.6,
      roughness: 0.2
    });
    this.breatheCoreMesh = new THREE.Mesh(coreGeo, this.breatheCoreMat);
    this.breatheGroup.add(this.breatheCoreMesh);

    // Dual 3D Machined Gyroscope Orbital Rings
    const ringGeo1 = new THREE.TorusGeometry(1.78, 0.022, 16, 96);
    const ringGeo2 = new THREE.TorusGeometry(2.02, 0.016, 16, 96);
    this.ringMat = new THREE.MeshPhysicalMaterial({
      color: 0x7dd3fc,
      emissive: 0x0284c7,
      emissiveIntensity: 0.6,
      metalness: 0.85,
      roughness: 0.15
    });
    this.gyroRing1 = new THREE.Mesh(ringGeo1, this.ringMat);
    this.gyroRing2 = new THREE.Mesh(ringGeo2, this.ringMat);
    this.gyroRing1.rotation.x = 0.65;
    this.gyroRing2.rotation.y = 0.85;
    this.breatheGroup.add(this.gyroRing1, this.gyroRing2);

    // 320 3D Volumetric Vortex Particles
    this.particleCount = 320;
    const pGeo = new THREE.BufferGeometry();
    this.pPositions = new Float32Array(this.particleCount * 3);
    this.pMeta = [];
    for (let i = 0; i < this.particleCount; i++) {
      const r = 0.8 + Math.random() * 1.65;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      this.pMeta.push({ r, baseR: r, theta, phi, speed: 0.4 + Math.random() * 0.9 });
      this.pPositions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      this.pPositions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      this.pPositions[i * 3 + 2] = r * Math.cos(phi);
    }
    pGeo.setAttribute('position', new THREE.BufferAttribute(this.pPositions, 3));

    const pMat = new THREE.PointsMaterial({
      color: 0xa5f3fc,
      size: 0.075,
      transparent: true,
      opacity: 0.88,
      blending: THREE.AdditiveBlending
    });
    this.breathePoints = new THREE.Points(pGeo, pMat);
    this.breatheGroup.add(this.breathePoints);
  }

  renderBreathe3D(targetCtx, width, height, dt, timeSec, scaleFactor, phase, rotX, rotY) {
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.renderer.setSize(width, height, false);
      this.breatheCamera.aspect = width / height;
      this.breatheCamera.updateProjectionMatrix();
    }

    const orbScale = 0.68 + scaleFactor * 0.44;
    this.breatheGlassMesh.scale.setScalar(orbScale);
    this.breatheCoreMesh.scale.setScalar(0.55 + scaleFactor * 0.65);

    if (phase === 'inhale') {
      this.breatheGlassMat.color.setHex(0x2dd4bf);
      this.breatheCoreMat.emissive.setHex(0x14b8a6);
    } else if (phase === 'hold') {
      this.breatheGlassMat.color.setHex(0x818cf8);
      this.breatheCoreMat.emissive.setHex(0x6366f1);
    } else {
      this.breatheGlassMat.color.setHex(0x38bdf8);
      this.breatheCoreMat.emissive.setHex(0x0284c7);
    }

    this.breatheGroup.rotation.x = rotX;
    this.breatheGroup.rotation.y = rotY;

    this.gyroRing1.rotation.z = timeSec * 0.45;
    this.gyroRing1.rotation.x = 0.65 + Math.sin(timeSec * 0.7) * 0.25;
    this.gyroRing2.rotation.z = -timeSec * 0.35;
    this.gyroRing2.rotation.y = 0.85 + Math.cos(timeSec * 0.6) * 0.25;

    const attr = this.breathePoints.geometry.attributes.position;
    for (let i = 0; i < this.particleCount; i++) {
      const m = this.pMeta[i];
      m.theta += dt * m.speed * (phase === 'hold' ? 0.35 : 1.15);
      const targetR =
        phase === 'inhale'
          ? 0.55 + (1.0 - scaleFactor) * 1.45
          : phase === 'hold'
          ? 0.72 + Math.sin(timeSec * 3.0 + i) * 0.08
          : 0.75 + (1.0 - scaleFactor) * 1.55;
      m.r += (targetR * (0.65 + (i % 7) * 0.09) - m.r) * Math.min(1, dt * 3.2);

      attr.setXYZ(
        i,
        m.r * Math.sin(m.phi) * Math.cos(m.theta),
        m.r * Math.sin(m.phi) * Math.sin(m.theta),
        m.r * Math.cos(m.phi)
      );
    }
    attr.needsUpdate = true;

    this.renderer.render(this.breatheScene, this.breatheCamera);
    targetCtx.drawImage(this.canvas, 0, 0, width, height);
  }
}
