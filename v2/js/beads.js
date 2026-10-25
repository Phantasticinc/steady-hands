// Beads: Havok rigid bodies. Three abacus channels (cradle chains) + a sorting tray with three bins.
import { createStudio, createPipeline, floorMesh, V3, C3 } from './stage.js';
import { audio, haptic, countAction, prefs } from './shell.js';
const B = window.BABYLON;
const R = 0.27, Y0 = 0;          // bead radius; tray floor top at y=0
let hkP = null;
export async function createBeads(engine, hud){
  if (!hkP) hkP = window.HavokPhysics({ locateFile: () => 'vendor/HavokPhysics.wasm' });
  const hk = await hkP;
  const scene = new B.Scene(engine);
  const fov = 0.62, cam = new B.FreeCamera('cam', new V3(0, 11.2, -6.2), scene);
  cam.setTarget(new V3(0, 0, -0.5)); cam.fov = fov; cam.fovMode = B.Camera.FOVMODE_HORIZONTAL_FIXED; cam.minZ = 0.1; cam.maxZ = 200;
  const { sg } = createStudio(scene, { tint:'#2e2a24' });
  const pipe = createPipeline(scene, cam);
  const plugin = new B.HavokPlugin(true, hk);
  scene.enablePhysics(new V3(0, -9.81, 0), plugin);
  // --- materials
  const wood = new B.PBRMaterial('wood', scene); wood.albedoColor = new C3(0.16,0.09,0.05); wood.roughness = 0.42; wood.metallic = 0; wood.clearCoat.isEnabled = true; wood.clearCoat.intensity = 0.6;
  const felt = new B.PBRMaterial('felt', scene); felt.albedoColor = new C3(0.06,0.24,0.18); felt.roughness = 0.95; felt.metallic = 0;
  const rod = new B.PBRMaterial('rod', scene); rod.albedoColor = new C3(0.9,0.9,0.92); rod.metallic = 1; rod.roughness = 0.18;
  const mats = [
    (()=>{ const m = new B.PBRMaterial('glass', scene); m.albedoColor = new C3(0.15,0.4,0.85); m.metallic = 0; m.roughness = 0.04; m.alpha = 0.55; m.clearCoat.isEnabled = true; m.emissiveColor = new C3(0.02,0.06,0.14); return m; })(),
    (()=>{ const m = new B.PBRMaterial('brass', scene); m.albedoColor = new C3(1,0.74,0.34); m.metallic = 0.85; m.roughness = 0.3; m.emissiveColor = new C3(0.09,0.055,0.015); return m; })(),
    (()=>{ const m = new B.PBRMaterial('jade', scene); m.albedoColor = new C3(0.12,0.55,0.36); m.metallic = 0; m.roughness = 0.12; m.clearCoat.isEnabled = true; return m; })(),
  ];
  const kinds = ['glass','brass','jade'];
  floorMesh(scene, -0.6, sg);
  // --- static geometry helper
  function box(name, x, y, z, w, h, d, mat, opts = {}){
    const m = B.MeshBuilder.CreateBox(name, { width:w, height:h, depth:d }, scene); m.position.set(x, y, z); m.material = mat; m.receiveShadows = true; m.isPickable = false;
    if (opts.cast) sg.addShadowCaster(m);
    const a = new B.PhysicsAggregate(m, B.PhysicsShapeType.BOX, { mass:0, friction: opts.friction ?? 0.5, restitution: opts.rest ?? 0.3 }, scene);
    if (opts.invisible) m.isVisible = false; return a;
  }
  // frame / base
  const W = 6.2, ZT = 3.0, ZB = -4.0;
  box('base', 0, -0.3, (ZT+ZB)/2, W+0.6, 0.6, ZT-ZB+0.6, wood);
  box('feltTop', 0, -0.005, -1.2, W-0.1, 0.01, 5.4, felt, { friction:0.9, rest:0.1 });
  for (const s of [-1,1]) box('side', s*(W/2+0.15), 0.35, (ZT+ZB)/2, 0.3, 0.7, ZT-ZB+0.6, wood, { cast:true, rest:0.5 });
  box('back', 0, 0.35, ZT+0.15, W+0.6, 0.7, 0.3, wood, { cast:true }); box('front', 0, 0.35, ZB-0.15, W+0.6, 0.7, 0.3, wood, { cast:true });
  // abacus channels: rails separated by low walls, beads roll along x
  const rails = [2.45, 1.75, 1.05];
  box('railDiv', 0, 0.2, 0.62, W, 0.4, 0.14, wood, { cast:true });
  for (const z of [2.1, 1.4]) box('lane', 0, 0.16, z, W, 0.32, 0.07, wood, { cast:true, rest:0.3 });
  for (const z of rails){ const r = B.MeshBuilder.CreateCylinder('rod', { diameter:0.05, height:W }, scene); r.rotation.z = Math.PI/2; r.position.set(0, 0.58, z); r.material = rod; r.isPickable = false; sg.addShadowCaster(r); }
  // bins along the front: three dividers + colored lip
  const binX = [-W/3, 0, W/3];
  for (const x of [-W/6, W/6]) box('div', x, 0.18, -3.35, 0.08, 0.36, 1.3, wood, { cast:true });
  box('binLip', 0, 0.09, -2.7, W, 0.18, 0.08, wood, { cast:true });
  const binCol = [new C3(0.3,0.6,1), new C3(1,0.75,0.3), new C3(0.3,1,0.6)];
  binX.forEach((x, i) => { const s = B.MeshBuilder.CreateGround('binGlow', { width:W/3-0.2, height:1.1 }, scene); s.position.set(x, 0.012, -3.4);
    const m = new B.StandardMaterial('bg', scene); m.emissiveColor = binCol[i].scale(0.35); m.disableLighting = true; m.alpha = 0.55; s.material = m; s.isPickable = false; });
  // --- beads
  const beads = [];
  function bead(kind, x, z, onRail){
    const m = B.MeshBuilder.CreateSphere('bead', { diameter:2*R, segments:24 }, scene); m.material = mats[kind]; m.position.set(x, R+0.01, z); sg.addShadowCaster(m); m.receiveShadows = true; m.isPickable = false;
    const ag = new B.PhysicsAggregate(m, B.PhysicsShapeType.SPHERE, { mass: kind===1 ? 0.12 : 0.06, friction: onRail?0.08:0.35, restitution: onRail?0.92:0.55 }, scene);
    ag.body.setLinearDamping(onRail?0.06:0.25); ag.body.setAngularDamping(0.3); ag.body.setCollisionCallbackEnabled(true);
    const b = { m, body:ag.body, kind, onRail }; ag.body.__bead = b; beads.push(b); return b;
  }
  rails.forEach((z, ri) => { for (let i = 0; i < 7; i++) bead((ri+i)%3===0?1:(ri===1?2:0), -2.8 + i*(2*R+0.002), z, true); });
  const trayBeads = [];
  function scatter(){ for (const b of trayBeads){ b.body.disablePreStep = false; b.m.position.set(-2.6 + Math.random()*5.2, R+0.05, -2.3 + Math.random()*2.6); b.body.setLinearVelocity(V3.Zero()); b.body.setAngularVelocity(V3.Zero()); }
    requestAnimationFrame(()=>trayBeads.forEach(b=>b.body.disablePreStep = true)); celebrated = false; }
  for (let i = 0; i < 15; i++) trayBeads.push(bead(i%3, 0, 0, false));
  let celebrated = false; scatter();
  // --- finger pushers (kinematic spheres; their motion carries flick velocity into beads)
  const pushMat = new B.PBRMaterial('push', scene); pushMat.albedoColor = new C3(1,1,1); pushMat.alpha = 0.12; pushMat.emissiveColor = new C3(0.25,0.25,0.3);
  const fingers = new Map(), q = B.Quaternion.Identity();
  function pick(x, y){ const ray = scene.createPickingRay(x, y, B.Matrix.Identity(), cam); const t = (R - ray.origin.y)/ray.direction.y; return ray.origin.add(ray.direction.scale(t)); }
  function clampP(p){ p.x = Math.max(-W/2+0.35, Math.min(W/2-0.35, p.x)); p.z = Math.max(ZB+0.3, Math.min(ZT-0.3, p.z)); p.y = R; return p; }
  function down(id, x, y, w){ countAction(); const p = clampP(w.clone());
    const m = B.MeshBuilder.CreateSphere('finger', { diameter:0.62, segments:16 }, scene); m.material = pushMat; m.position.copyFrom(p); m.isPickable = false;
    const ag = new B.PhysicsAggregate(m, B.PhysicsShapeType.SPHERE, { mass:0, friction:0.4, restitution:0.4 }, scene);
    ag.body.setMotionType(B.PhysicsMotionType.ANIMATED); ag.body.disablePreStep = false;
    fingers.set(id, { m, ag, p, fresh:2 }); haptic(6);
  }
  function move(id, x, y, w){ const f = fingers.get(id); if (f) f.p = clampP(w.clone()); }
  function up(id){ const f = fingers.get(id); if (!f) return; f.ag.dispose(); f.m.dispose(); fingers.delete(id); }
  // --- collisions -> clack sound + haptics scaled by impulse
  let lastClack = 0, chain = 0, tNow = 0;
  plugin.onCollisionObservable.add(ev => {
    const a = ev.collider?.__bead, b = ev.collidedAgainst?.__bead; if (!a && !b) return;
    const imp = Math.abs(ev.impulse || 0); const bb = a || b; const v = imp / (bb.body.getMassProperties().mass || 0.06);
    if (v < 0.6 || tNow - lastClack < 0.028) return; lastClack = tNow;
    const both = a && b; chain = both ? chain + 1 : 0;
    audio.playBeadCollision(Math.min(1, v/7), both ? 'track' : 'gel', (bb.kind*5 + chain) % 12);
    if (v > 3) haptic(Math.min(18, 4 + v*1.5));
  });
  hud.title('Beads'); hud.sub('Flick the abacus rows · sort the tray beads into matching bins');
  hud.actions([{ label:'Shuffle', click:()=>{ scatter(); audio.playBoardFlip(); haptic(15); } }]);
  const pe = scene.getPhysicsEngine(); scene._advancePhysicsEngineStep = () => {};
  let sortT = 0;
  function step(dtR){
    const dt = Math.min(1/30, dtR); tNow += dt;
    for (const f of fingers.values()){
      if (f.fresh > 0){ f.m.position.copyFrom(f.p); if (--f.fresh === 0) f.ag.body.disablePreStep = true; }
      else f.ag.body.setTargetTransform(f.p, q);
    }
    pe._step(dt);
    sortT += dt; if (sortT > 0.25){ sortT = 0; let n = 0;
      for (const b of trayBeads){ const p = b.m.position; if (p.z < -2.78 && Math.abs(p.x - binX[b.kind]) < W/6) n++; if (p.y < -2) { b.body.disablePreStep=false; p.set(0, 1, -1); requestAnimationFrame(()=>b.body.disablePreStep=true); } }
      hud.meter(n/15);
      if (n === 15 && !celebrated){ celebrated = true; hud.sub('Sorted! Every bead home · Shuffle to play again'); audio.playCubeButton('click-mid'); haptic(30); }
    }
  }
  return { scene, cam, step, down, move, up, pick, pipe, debug:{ beads, flick:(ri, v)=>{ const r = beads.filter(b=>b.onRail && Math.abs(b.m.position.z-rails[ri])<0.2); r.sort((a,b)=>a.m.position.x-b.m.position.x); r[0].body.setLinearVelocity(new V3(v,0,0)); } } };
}
