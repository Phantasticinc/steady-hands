// Babylon.js engine + premium studio look shared by all toys.
const B = window.BABYLON;
export const V3 = B.Vector3, C3 = B.Color3, C4 = B.Color4;
export let engine;
export function createEngine(canvas){
  engine = new B.Engine(canvas, true, { stencil:true, preserveDrawingBuffer:false, powerPreference:'high-performance', adaptToDeviceRatio:false }, false);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  engine.setHardwareScalingLevel(1/dpr);
  engine.__baseScale = 1/dpr;
  window.addEventListener('resize', () => engine.resize());
  return engine;
}
// Adaptive quality: if fps sags, drop resolution in steps (never below dpr 1).
export function adaptiveQuality(){
  let acc=0, n=0, t0=performance.now();
  return () => { acc += engine.getFps(); n++; if (performance.now()-t0 > 2000) { const f = acc/n; acc=0; n=0; t0=performance.now();
    const cur = engine.getHardwareScalingLevel();
    if (f < 40 && cur < 1) engine.setHardwareScalingLevel(Math.min(1, cur*1.25));
    else if (f > 57 && cur > engine.__baseScale) engine.setHardwareScalingLevel(Math.max(engine.__baseScale, cur/1.15)); } };
}
function gradientTex(scene, top, mid, bot){
  const t = new B.DynamicTexture('grad', { width:16, height:512 }, scene, false);
  const ctx = t.getContext(); const g = ctx.createLinearGradient(0,0,0,512);
  g.addColorStop(0, top); g.addColorStop(0.55, mid); g.addColorStop(1, bot);
  ctx.fillStyle = g; ctx.fillRect(0,0,16,512); t.update(); return t;
}
// Studio: dark gradient cyclorama + softboxes, captured by a reflection probe as the IBL environment.
export function createStudio(scene, opts = {}){
  const { tint = '#1a2230', key = new C3(1,0.97,0.92), keyPos = new V3(-3,8,-6) } = opts;
  scene.clearColor = new C4(0.02,0.025,0.035,1);
  scene.fogMode = B.Scene.FOGMODE_EXP2; scene.fogDensity = opts.fog ?? 0.045; scene.fogColor = C3.FromHexString(tint).toLinearSpace().scale(1.0);
  scene.imageProcessingConfiguration.toneMappingEnabled = true;
  scene.imageProcessingConfiguration.toneMappingType = B.ImageProcessingConfiguration.TONEMAPPING_ACES;
  scene.imageProcessingConfiguration.exposure = 1.45; scene.imageProcessingConfiguration.contrast = 1.25;
  const dome = B.MeshBuilder.CreateSphere('dome', { diameter:80, segments:24, sideOrientation:B.Mesh.BACKSIDE }, scene);
  const dm = new B.StandardMaterial('domeM', scene); dm.disableLighting = true;
  dm.emissiveTexture = gradientTex(scene, '#4a5468', tint, tint); dm.backFaceCulling = false; dm.fogEnabled = false; dome.material = dm; dome.applyFog = false; dome.isPickable = false;
  const env = [dome];
  const box = (name, pos, w, h, I) => { const p = B.MeshBuilder.CreatePlane(name, { width:w, height:h }, scene);
    p.position = pos; p.lookAt(V3.Zero()); p.rotate(B.Axis.Y, Math.PI, B.Space.LOCAL);
    const m = new B.StandardMaterial(name+'M', scene); m.disableLighting = true; m.emissiveColor = new C3(I,I,I*0.97); m.backFaceCulling=false; p.material = m; p.isPickable=false; p.layerMask = 0x10000000; env.push(p); return p; };
  box('softTop', new V3(0,22,-2), 26, 12, 3.2);
  box('softLeft', new V3(-24,8,-10), 10, 16, 1.6);
  box('softRight', new V3(22,6,-14), 6, 20, 0.9);
  box('rim', new V3(4,10,26), 30, 5, 2.2);
  const probe = new B.ReflectionProbe('studioProbe', 256, scene, true, true);
  env.forEach(m => probe.renderList.push(m));
  probe.refreshRate = 1; let pf = 0; const po = scene.onAfterRenderObservable.add(() => { if (++pf > 12){ probe.refreshRate = B.RenderTargetTexture.REFRESHRATE_RENDER_ONCE; scene.onAfterRenderObservable.remove(po); } });
  scene.environmentTexture = probe.cubeTexture; scene.environmentIntensity = 1.0;
  const hemi = new B.HemisphericLight('hemi', new V3(0,1,-0.3), scene); hemi.intensity = 0.35; hemi.groundColor = new C3(0.05,0.05,0.06);
  const sun = new B.DirectionalLight('key', keyPos.scale(-1).normalize(), scene); sun.position = keyPos; sun.intensity = 3.2; sun.diffuse = key;
  const sg = new B.ShadowGenerator(1024, sun); sg.usePercentageCloserFiltering = true; sg.filteringQuality = B.ShadowGenerator.QUALITY_MEDIUM; sg.bias = 0.003; sg.normalBias = 0.03; sg.darkness = 0.15;
  return { sun, sg, probe, hemi };
}
export function createPipeline(scene, camera, { dof = false, ssao = false } = {}){
  const p = new B.DefaultRenderingPipeline('pp', true, scene, [camera]);
  p.samples = 1; p.fxaaEnabled = true;
  p.bloomEnabled = true; p.bloomThreshold = 0.75; p.bloomWeight = 0.45; p.bloomKernel = 48; p.bloomScale = 0.5;
  p.imageProcessingEnabled = true; p.imageProcessing.toneMappingEnabled = true; p.imageProcessing.toneMappingType = B.ImageProcessingConfiguration.TONEMAPPING_ACES;
  p.imageProcessing.vignetteEnabled = true; p.imageProcessing.vignetteWeight = 2.2; p.imageProcessing.vignetteColor = new C4(0,0,0,0);
  p.chromaticAberrationEnabled = true; p.chromaticAberration.aberrationAmount = 6;
  p.grainEnabled = true; p.grain.intensity = 4; p.grain.animated = true;
  if (dof) { p.depthOfFieldEnabled = true; p.depthOfFieldBlurLevel = B.DepthOfFieldEffectBlurLevel.Low; p.depthOfField.fStop = 2.0; p.depthOfField.focalLength = 60; }
  if (ssao) { try { const s = new B.SSAO2RenderingPipeline('ssao', scene, { ssaoRatio:0.5, blurRatio:0.5 }, [camera]); s.radius = 0.6; s.totalStrength = 1.1; s.samples = 8; s.expensiveBlur = false; } catch(e){} }
  return p;
}
// Camera looking at the z=0 physics plane with a fixed horizontal span (world units).
export function planeCamera(scene, span = 6, cy = 0, tilt = 0.06){
  const fov = 0.62; const d = (span/2)/Math.tan(fov/2);
  const cam = new B.FreeCamera('cam', new V3(0, cy + d*tilt, -d), scene);
  cam.setTarget(new V3(0, cy, 0)); cam.fov = fov; cam.fovMode = B.Camera.FOVMODE_HORIZONTAL_FIXED; cam.minZ = 0.1; cam.maxZ = 200;
  return cam;
}
// Screen point -> intersection with plane z = zPlane.
export function screenToPlane(scene, cam, x, y, zPlane = 0){
  const ray = scene.createPickingRay(x, y, B.Matrix.Identity(), cam);
  const t = (zPlane - ray.origin.z) / ray.direction.z; return ray.origin.add(ray.direction.scale(t));
}
export function visibleHalfHeight(cam){ const e = cam.getEngine(); const asp = e.getRenderWidth()/e.getRenderHeight(); const d = Math.abs(cam.position.z); return d*Math.tan(cam.fov/2)/asp; }
export function waterMaterial(scene, color = new C3(0.55,0.8,1.0)){
  const m = new B.PBRMaterial('water', scene);
  m.albedoColor = color.scale(0.45); m.metallic = 0; m.roughness = 0.06; m.alpha = 0.82; m.environmentIntensity = 1.1;
  m.emissiveColor = color.scale(0.09); m.useRadianceOverAlpha = true; m.useSpecularOverAlpha = true;
  m.subSurface.isTranslucencyEnabled = true; m.subSurface.translucencyIntensity = 1; m.subSurface.tintColor = color;
  return m;
}
export function glassMaterial(scene){
  const m = new B.PBRMaterial('glass', scene);
  m.albedoColor = new C3(0.05,0.06,0.07); m.metallic = 0; m.roughness = 0.03; m.alpha = 0.1; m.transparencyMode = B.PBRMaterial.PBRMATERIAL_ALPHABLEND;
  m.indexOfRefraction = 1.5; m.environmentIntensity = 1.6; m.backFaceCulling = false; m.twoSidedLighting = true;
  m.subSurface.isRefractionEnabled = false; m.useRadianceOverAlpha = true; m.useSpecularOverAlpha = true;
  return m;
}
export function floorMesh(scene, y, sg, w = 160, color = new C3(0.09,0.09,0.1)){
  const g = B.MeshBuilder.CreateGround('floor', { width:w, height:w }, scene);
  const spot = new B.SpotLight('pool', new V3(0, y+9, -1), new V3(0,-1,0.08), 0.9, 6, scene); spot.intensity = 60; spot.diffuse = new C3(1,0.96,0.9); spot.includedOnlyMeshes = [g]; g.position.y = y;
  const m = new B.PBRMaterial('floorM', scene); m.albedoColor = color; m.metallic = 0; m.roughness = 0.35; m.environmentIntensity = 0.6;
  g.material = m; g.receiveShadows = true; g.isPickable = false;
  try { const mr = new B.MirrorTexture('floorMirror', 512, scene, true); mr.mirrorPlane = new B.Plane(0,-1,0,y); mr.level = 0.25; mr.adaptiveBlurKernel = 24; mr.renderListPredicate = (m) => m !== g && m.name !== 'dome' && !m.name.startsWith('soft') && m.name !== 'rim'; m.reflectionTexture = mr; g.__mirror = mr; } catch(e){}
  return g;
}
// Thin-instanced particle renderer; positions from a Float32Array of xy pairs (z jitter for volume).
export class ParticleField {
  constructor(scene, mat, radius, max, sg){
    this.mesh = B.MeshBuilder.CreateIcoSphere('pf', { radius, subdivisions:2 }, scene); this.mesh.material = mat; this.mesh.isPickable = false;
    this.max = max; this.buf = new Float32Array(max*16); this.mesh.thinInstanceSetBuffer('matrix', this.buf, 16, false);
    this.mesh.thinInstanceCount = 0; this.mesh.alwaysSelectAsActiveMesh = true; this.zj = new Float32Array(max); for (let i=0;i<max;i++) this.zj[i] = (Math.random()-0.5);
    if (sg) sg.addShadowCaster(this.mesh); this.mesh.receiveShadows = true;
  }
  update(xy, n, depth = 0.25, vel = null, stretch = 0){
    n = Math.min(n, this.max); const b = this.buf;
    for (let i=0;i<n;i++){ const o=i*16; let sx=1, sy=1;
      if (vel && stretch){ const vx=vel[i*2], vy=vel[i*2+1]; const s = Math.min(1.8, 1+Math.hypot(vx,vy)*stretch); sy = s; sx = 1/Math.sqrt(s);
        const a = Math.atan2(vx, vy); const c=Math.cos(a), si=Math.sin(a);
        b[o]=c*sx; b[o+1]=-si*sx; b[o+2]=0; b[o+3]=0; b[o+4]=si*sy; b[o+5]=c*sy; b[o+6]=0; b[o+7]=0; }
      else { b[o]=1;b[o+1]=0;b[o+2]=0;b[o+3]=0;b[o+4]=0;b[o+5]=1;b[o+6]=0;b[o+7]=0; }
      b[o+8]=0;b[o+9]=0;b[o+10]=1;b[o+11]=0; b[o+12]=xy[i*2]; b[o+13]=xy[i*2+1]; b[o+14]=this.zj[i]*depth; b[o+15]=1; }
    this.mesh.thinInstanceCount = n; this.mesh.thinInstanceBufferUpdated('matrix');
  }
}
// Screen-space fluid surface (Babylon FluidRenderer): depth/thickness splats blurred into a smooth refractive liquid.
export class FluidWater {
  constructor(scene, cam, max, { size = 0.12, color = new C3(0.75,0.9,1), density = 1.4, refraction = 0.08 } = {}){
    this.max = max; this.pos = new Float32Array(max*3); this.vel = new Float32Array(max*3);
    this.zj = new Float32Array(max); for (let i=0;i<max;i++) this.zj[i] = Math.random()-0.5;
    const fr = location.search.includes('fluid') ? scene.enableFluidRenderer() : null; this.ok = !!fr;
    if (!fr) return;
    this.obj = fr.addCustomParticles({ position:this.pos, velocity:this.vel }, 0, false, undefined, cam);
    const t = this.obj.targetRenderer; this.obj.object.particleSize = size; this.obj.object.particleThicknessAlpha = 0.07;
    t.fluidColor = color; t.density = density; t.refractionStrength = refraction; t.specularPower = 220; t.fresnelClamp = 0.06; t.minimumThickness = 0;
    t.blurDepthFilterSize = 14; t.blurDepthNumIterations = 3; t.blurDepthDepthScale = 12; t.blurThicknessFilterSize = 12; t.blurThicknessNumIterations = 2;
    t.depthMapSize = 1024; t.thicknessMapSize = 512; t.environmentMap = scene.environmentTexture; t.dirLight = new V3(-1,-2,1).normalize();
    t.useVelocity = false; this.t = t;
  }
  update(xy, v, n, depth = 0.4){
    if (!this.ok) return; n = Math.min(n, this.max);
    for (let i=0;i<n;i++){ this.pos[i*3] = xy[i*2]; this.pos[i*3+1] = xy[i*2+1]; this.pos[i*3+2] = this.zj[i]*depth; this.vel[i*3]=v[i*2]; this.vel[i*3+1]=v[i*2+1]; }
    this.obj.object.vertexBuffers.position.updateDirectly(this.pos, 0); this.obj.object.setNumParticles(n);
  }
}
