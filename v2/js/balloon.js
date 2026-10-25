// Water Balloon: LiquidFun pressure soft body (skin ring + distance joints) filled with real particle water.
import { createStudio, createPipeline, planeCamera, waterMaterial, floorMesh, ParticleField, FluidWater, V3, C3 } from './stage.js';
import { makeWorld, staticBox, particleSystem, fillCircle, views } from './lf.js';
import { audio, haptic, countAction, prefs } from './shell.js';
const B = window.BABYLON;
const N = 48, R = 1.15, NODE_R = 0.085, PR = 0.034, FLOOR = -3.0, MAXP = 2600;
const COLORS = [new C3(0.9,0.12,0.18), new C3(0.1,0.45,0.95), new C3(0.95,0.55,0.1), new C3(0.55,0.2,0.85), new C3(0.1,0.75,0.5)];

export async function createBalloon(engine, L, hud){
  const scene = new B.Scene(engine);
  const cam = planeCamera(scene, 6.2, -0.2, 0.22);
  const { sg } = createStudio(scene, { tint:'#3a2c38' });
  const pipe = createPipeline(scene, cam, { dof:false });
  const floor = floorMesh(scene, FLOOR - 0.0, sg, 40, new C3(0.05,0.05,0.06));
  const world = makeWorld(L, -10);
  const ground = staticBox(L, world, 0, FLOOR - 0.5, 40, 0.5);
  staticBox(L, world, -3.6, 4, 0.3, 12, 0, ground); staticBox(L, world, 3.6, 4, 0.3, 12, 0, ground);
  const ps = particleSystem(L, world, { radius:PR, max:MAXP, damping:0.4, viscous:0.25, pressure:0.08, surface:0.25 });
  const fw = new FluidWater(scene, cam, MAXP, { size:PR*5.2, color:new C3(0.72,0.88,1) });
  const pf = fw.ok ? null : new ParticleField(scene, waterMaterial(scene, new C3(0.6,0.85,1)), PR*2.3, MAXP, sg);
  // balloon render mesh: sphere whose silhouette follows the physics ring
  const mesh = B.MeshBuilder.CreateSphere('balloon', { diameter:2, segments:48, updatable:true }, scene);
  const base = mesh.getVerticesData(B.VertexBuffer.PositionKind).slice(); const pos = new Float32Array(base.length);
  const idx = mesh.getIndices(); const nrm = new Float32Array(base.length);
  const BINS = 360; const vb = new Int16Array(base.length/3); const prof = new Float32Array(BINS);
  for (let i=0;i<vb.length;i++){ let a = Math.atan2(base[i*3+1], base[i*3]); vb[i] = ((Math.round((a+Math.PI)/(2*Math.PI)*BINS))%BINS); }
  const latex = new B.PBRMaterial('latex', scene);
  latex.metallic = 0; latex.roughness = 0.32; latex.alpha = 0.62; latex.transparencyMode = B.PBRMaterial.PBRMATERIAL_ALPHABLEND;
  latex.clearCoat.isEnabled = true; latex.clearCoat.intensity = 0.9; latex.clearCoat.roughness = 0.08;
  latex.sheen.isEnabled = true; latex.sheen.intensity = 0.4; latex.subSurface.isTranslucencyEnabled = true; latex.subSurface.translucencyIntensity = 0.8;
  latex.useRadianceOverAlpha = true; latex.useSpecularOverAlpha = true; latex.backFaceCulling = true; latex.environmentIntensity = 1.2;
  mesh.material = latex; sg.addShadowCaster(mesh); mesh.isPickable = false;
  const knot = B.MeshBuilder.CreateCylinder('knot', { diameterTop:0.05, diameterBottom:0.2, height:0.2, tessellation:20 }, scene); knot.material = latex; knot.isPickable=false;
  const shreds = B.MeshBuilder.CreateBox('shred', { width:0.16, height:0.04, depth:0.12 }, scene); shreds.material = latex; shreds.isPickable=false; shreds.setEnabled(false);
  const shredInst = []; for (let i=0;i<N;i++){ const s = shreds.createInstance('s'+i); s.setEnabled(false); shredInst.push(s); }

  const st = { nodes:[], joints:[], A0:0, alive:false, burstT:0, slow:1, fingers:new Map(), color:0, popped:0, fill:1, best:0, nextAt:0, knotI:0 };
  const sfd = new L.b2FixtureDef(); const sc = new L.b2CircleShape(); sc.m_radius = NODE_R; sfd.shape = sc; sfd.density = 2.2; sfd.friction = 0.6; sfd.restitution = 0.05;
  sfd.filter.groupIndex = -1;
  function spawn(){
    st.color = (st.color + 1) % COLORS.length; const col = COLORS[st.color];
    latex.albedoColor = col; latex.subSurface.tintColor = col; latex.sheen.color = col.scale(1.4);
    const cy = -0.6, cx = (Math.random()-0.5)*0.4;
    st.nodes = []; st.joints = [];
    for (let i=0;i<N;i++){ const a = i/N*Math.PI*2; const bd = new L.b2BodyDef(); bd.type = L.b2_dynamicBody; bd.position.Set(cx + Math.cos(a)*R, cy + Math.sin(a)*R); bd.linearDamping = 0.15;
      const b = world.CreateBody(bd); b.CreateFixture(sfd); st.nodes.push(b); }
    const link = (i, j, k, z) => { const d = new L.b2DistanceJointDef(); d.Initialize(st.nodes[i], st.nodes[j], st.nodes[i].GetPosition(), st.nodes[j].GetPosition());
      const m = st.nodes[i].GetMass(), w = 2*Math.PI*k; d.stiffness = m*w*w; d.damping = 2*m*z*w; d.collideConnected = false;
      const jt = L.castObject(world.CreateJoint(d), L.b2DistanceJoint); jt.rest = d.length; st.joints.push(jt); };
    for (let i=0;i<N;i++){ link(i,(i+1)%N, 18, 0.3); link(i,(i+2)%N, 7, 0.5); }
    st.A0 = Math.PI*R*R; st.fill = 1; st.alive = true; st.knotI = Math.round(N*0.75);
    fillCircle(L, ps, cx, cy - 0.15, R*0.72, L.b2_waterParticle);
    mesh.setEnabled(true); knot.setEnabled(true); shredInst.forEach(s=>s.setEnabled(false));
    hud.title('Water Balloon'); hud.sub('Squeeze with two fingers · hold Fill to stretch');
  }
  function area(){ let a=0; for (let i=0;i<N;i++){ const p=st.nodes[i].GetPosition(), q=st.nodes[(i+1)%N].GetPosition(); a += p.x*q.y - q.x*p.y; } return a/2; }
  function centroid(){ let x=0,y=0; for (const n of st.nodes){ const p=n.GetPosition(); x+=p.x; y+=p.y; } return [x/N, y/N]; }
  const tmp = new L.b2Vec2(0,0);
  function burst(){
    st.alive = false; st.burstT = performance.now(); st.slow = prefs.lowStim ? 0.6 : 0.18; st.popped++;
    for (const f of st.fingers.values()) if (f.j) world.DestroyJoint(f.j); st.fingers.forEach(f=>f.j=null);
    for (const j of st.joints) world.DestroyJoint(j); st.joints = [];
    const [cx, cy] = centroid(); const P = pressure();
    for (const n of st.nodes){ const p=n.GetPosition(); const dx=p.x-cx, dy=p.y-cy, l=Math.hypot(dx,dy)||1; tmp.Set(dx/l*0.9*(1+Math.random()), dy/l*0.9*(1+Math.random())+0.3); n.ApplyLinearImpulse(tmp, p, true); n.SetAngularVelocity((Math.random()-0.5)*30); }
    const v = views(L, ps); for (let i=0;i<v.n;i++){ const dx=v.pos[i*2]-cx, dy=v.pos[i*2+1]-cy, l=Math.hypot(dx,dy); if (l < R*2){ const s = (3.5 + 5*P)*(0.6+Math.random()*0.6); v.vel[i*2] += dx/(l||1)*s; v.vel[i*2+1] += dy/(l||1)*s + 2; } }
    mesh.setEnabled(false); knot.setEnabled(false); shredInst.forEach(s=>s.setEnabled(true));
    audio.stopBalloonStrain(); audio.playBalloonBurst('water'); haptic(prefs.lowStim ? 10 : 60); setTimeout(()=>haptic(20), 90);
    hud.meter(0); hud.sub(`Popped ${st.popped} · best pressure ${Math.round(st.best*100)}%`);
    st.nextAt = performance.now() + 3600;
  }
  function pressure(){ const A = Math.max(0.2, area()); return Math.max(0, (st.A0*st.fill/A) - 1); }
  // ---- input: each finger grabs the nearest skin node through a mouse (spring) joint
  function down(id, x, y){ countAction(); if (!st.alive) return; let best=-1, bd=0.9;
    st.nodes.forEach((n,i)=>{ const p=n.GetPosition(); const d=Math.hypot(p.x-x,p.y-y); if (d<bd){bd=d;best=i;} });
    const [cx,cy] = centroid(); const inside = Math.hypot(x-cx,y-cy) < R*1.1;
    if (best<0 && !inside) return; if (best<0){ let a=Math.atan2(y-cy,x-cx); best = ((Math.round((a<0?a+2*Math.PI:a)/(2*Math.PI)*N))%N); }
    const md = new L.b2MouseJointDef(); md.bodyA = ground; md.bodyB = st.nodes[best]; md.target.Set(x, y);
    const m = st.nodes[best].GetMass(); md.maxForce = 900*m; const w = 2*Math.PI*6; md.stiffness = m*w*w; md.damping = 2*m*0.7*w;
    const j = L.castObject(world.CreateJoint(md), L.b2MouseJoint); st.fingers.set(id, { j, node:best }); haptic(6);
  }
  function move(id, x, y){ const f = st.fingers.get(id); if (f && f.j){ tmp.Set(x, y); f.j.SetTarget(tmp); } }
  function up(id){ const f = st.fingers.get(id); if (f){ if (f.j) world.DestroyJoint(f.j); st.fingers.delete(id); } }
  let filling = false;
  hud.actions([{ label:'Hold to Fill', down:()=>{filling=true;}, up:()=>{filling=false;} }, { label:'New', click:()=>{ if (st.alive) burst(); } }]);
  // ---- simulation + render sync
  let lastBuzz = 0, lastTick = 0;
  function step(dtReal){
    const now = performance.now();
    if (!st.alive && st.burstT){ const t = (now - st.burstT)/1000; st.slow = Math.min(1, st.slow + dtReal*(t > 0.7 ? 1.5 : 0.08)); }
    const dt = Math.min(1/30, dtReal) * st.slow;
    if (st.alive){
      if (filling){ st.fill = Math.min(1.9, st.fill + dtReal*0.22); for (const j of st.joints) j.SetLength(j.rest*Math.sqrt(st.fill)*0.98); }
      const P = pressure(); const A = area(); const [cx,cy] = centroid();
      // gas pressure: outward force along each edge normal (P = k * (V0/V - 1) + skin pretension)
      const k = 95*(st.A0*st.fill/Math.max(0.2,A)) ;
      for (let i=0;i<N;i++){ const a = st.nodes[(i+N-1)%N].GetPosition(), b = st.nodes[(i+1)%N].GetPosition();
        const nx = (b.y - a.y), ny = -(b.x - a.x); tmp.Set(nx*k*0.5*dt, ny*k*0.5*dt); const n = st.nodes[i]; n.ApplyLinearImpulse(tmp, n.GetWorldCenter(), true); }
      const strain = Math.min(1, (st.fill-1)/0.9*0.55 + P*1.6);
      st.best = Math.max(st.best, strain); hud.meter(strain);
      if (strain > 0.06) audio.updateBalloonStrain(strain, 'water'); else audio.stopBalloonStrain();
      if (strain > 0.5 && now - lastBuzz > 260 - strain*200){ haptic(Math.round(4 + strain*12)); lastBuzz = now; }
      if (strain >= 1) burst();
    } else if (st.nextAt && now > st.nextAt){
      st.nextAt = 0; for (const n of st.nodes) world.DestroyBody(n); st.nodes = []; st.burstT = 0; st.slow = 1;
      while (ps.GetParticleCount() > MAXP - 1100) ps.DestroyOldestParticle(0, false);
      spawn();
    }
    const sub = 2; for (let s=0;s<sub;s++) world.Step(dt/sub, 8, 3, 3);
    // render: water particles
    const v = views(L, ps); if (pf) pf.update(v.pos, v.n, st.alive ? 0.9 : 0.5, v.vel, 0.05); else fw.update(v.pos, v.vel, v.n, st.alive ? 1.2 : 0.5);
    // floor impacts -> soft drip ticks
    if (!st.alive && now - lastTick > 70){ let hits=0; for (let i=0;i<v.n;i+=7){ if (v.pos[i*2+1] < FLOOR+0.12 && v.vel[i*2+1] < -3) hits++; } if (hits){ audio.playBeadCollision(Math.min(1, hits/12)*0.5, 'gel', hits%5); lastTick = now; } }
    if (st.alive){
      const [cx, cy] = centroid(); prof.fill(0); const P = pressure();
      // rasterize ring radius into angle bins
      for (let i=0;i<N;i++){ const p = st.nodes[i].GetPosition(), q = st.nodes[(i+1)%N].GetPosition();
        let a1 = Math.atan2(p.y-cy, p.x-cx), a2 = Math.atan2(q.y-cy, q.x-cx); const r1 = Math.hypot(p.x-cx,p.y-cy)+NODE_R*0.6, r2 = Math.hypot(q.x-cx,q.y-cy)+NODE_R*0.6;
        if (a2 < a1 - Math.PI) a2 += 2*Math.PI; if (a2 > a1 + Math.PI) a2 -= 2*Math.PI;
        const b1 = (a1+Math.PI)/(2*Math.PI)*BINS, b2 = (a2+Math.PI)/(2*Math.PI)*BINS; const lo = Math.min(b1,b2), hi = Math.max(b1,b2);
        for (let b=Math.floor(lo); b<=Math.ceil(hi); b++){ const t = hi>lo ? (b-b1)/(b2-b1) : 0; const r = r1 + (r2-r1)*Math.min(1,Math.max(0,t)); prof[((b%BINS)+BINS)%BINS] = Math.max(prof[((b%BINS)+BINS)%BINS], r); } }
      for (let b=0;b<BINS;b++) if (!prof[b]) prof[b] = prof[(b+BINS-1)%BINS];
      let avg = 0; for (let b=0;b<BINS;b++) avg += prof[b]; avg /= BINS;
      for (let i=0;i<vb.length;i++){ const r = prof[vb[i]]; pos[i*3] = cx + base[i*3]*r; pos[i*3+1] = cy + base[i*3+1]*r; pos[i*3+2] = base[i*3+2]*avg*0.92; }
      B.VertexData.ComputeNormals(pos, idx, nrm); mesh.updateVerticesData(B.VertexBuffer.PositionKind, pos); mesh.updateVerticesData(B.VertexBuffer.NormalKind, nrm);
      mesh.refreshBoundingInfo();
      latex.alpha = Math.max(0.35, 0.66 - (st.fill-1)*0.3 - P*0.4);
      const kp = st.nodes[st.knotI].GetPosition(); const ka = Math.atan2(kp.y-cy, kp.x-cx);
      knot.position.set(kp.x + Math.cos(ka)*0.12, kp.y + Math.sin(ka)*0.12, 0); knot.rotation.z = ka + Math.PI/2;
    } else {
      st.nodes.forEach((n,i)=>{ const p=n.GetPosition(); const s=shredInst[i]; s.position.set(p.x,p.y,(i%5-2)*0.1); s.rotation.z = n.GetAngle(); s.rotation.x = i*0.7 + p.y; });
    }
  }
  spawn();
  return { scene, cam, step, down, move, up, pipe, name:'balloon', debug:{ st, burst, pressure, setFill:(f)=>{ st.fill=f; for (const j of st.joints) j.SetLength(j.rest*Math.sqrt(f)*0.98); } } };
}
