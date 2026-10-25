// Pour: three glass tumblers (LiquidFun rigid bodies) holding real particle water. Lift a cup over another and it tips to pour.
import { createStudio, createPipeline, planeCamera, waterMaterial, glassMaterial, floorMesh, ParticleField, FluidWater, V3, C3 } from './stage.js';
import { makeWorld, staticBox, particleSystem, spawnParticle, fillBox, views } from './lf.js';
import { audio, haptic, countAction, prefs } from './shell.js';
const B = window.BABYLON;
const FLOOR = -3, PR = 0.03, MAXP = 2400, HW = 0.5, H = 1.35, T = 0.06;
export async function createPour(engine, L, hud){
  const scene = new B.Scene(engine);
  const cam = planeCamera(scene, 6.4, -0.6, 0.2);
  const { sg } = createStudio(scene, { tint:'#2a3440' });
  const pipe = createPipeline(scene, cam);
  floorMesh(scene, FLOOR, sg);
  
  const world = makeWorld(L, -10);
  const ground = staticBox(L, world, 0, FLOOR - 0.5, 40, 0.5);
  staticBox(L, world, -3.5, 3, 0.3, 10, 0, ground); staticBox(L, world, 3.5, 3, 0.3, 10, 0, ground);
  const ps = particleSystem(L, world, { radius:PR, max:MAXP, damping:0.3, viscous:0.12, pressure:0.06, surface:0.2 });
  const fw = new FluidWater(scene, cam, MAXP, { size:PR*5.5 });
  const pf = fw.ok ? null : new ParticleField(scene, waterMaterial(scene, new C3(0.55,0.82,1)), PR*2.4, MAXP, sg);
  const gm = glassMaterial(scene);
  const lineMat = new B.StandardMaterial('line', scene); lineMat.emissiveColor = new C3(2.2,1.5,0.6); lineMat.disableLighting = true;
  // lathe profile of a thick-walled tumbler: outer wall up, rounded lip, inner wall down
  const prof = [ new V3(0,-H/2,0), new V3(HW+T-0.03,-H/2,0), new V3(HW+T,-H/2+0.03,0), new V3(HW+T+0.02,H/2,0), new V3(HW+T/2,H/2+0.02,0), new V3(HW,H/2,0), new V3(HW-0.01,-H/2+T+0.05,0), new V3(HW-0.05,-H/2+T,0), new V3(0,-H/2+T,0) ];
  const cups = [];
  const fd = new L.b2FixtureDef(); fd.density = 4; fd.friction = 0.7; fd.restitution = 0.05;
  function makeCup(x, fill){
    const bd = new L.b2BodyDef(); bd.type = L.b2_dynamicBody; bd.position.Set(x, FLOOR + H/2 + 0.01); bd.angularDamping = 2; bd.linearDamping = 0.4;
    const body = world.CreateBody(bd); const s = new L.b2PolygonShape();
    s.SetAsBox(HW+T, T/2, new L.b2Vec2(0, -H/2+T/2), 0); fd.shape = s; body.CreateFixture(fd);
    s.SetAsBox(T/2, H/2, new L.b2Vec2(-HW-T/2, 0), 0); fd.shape = s; body.CreateFixture(fd);
    s.SetAsBox(T/2, H/2, new L.b2Vec2(HW+T/2, 0), 0); fd.shape = s; body.CreateFixture(fd);
    const mesh = B.MeshBuilder.CreateLathe('cup', { shape:prof, tessellation:64, sideOrientation:B.Mesh.DOUBLESIDE }, scene); mesh.material = gm; sg.addShadowCaster(mesh); mesh.isPickable = false;
    const ring = B.MeshBuilder.CreateTorus('fill', { diameter:2*HW+0.02, thickness:0.018, tessellation:64 }, scene); ring.material = lineMat; ring.parent = mesh; ring.isPickable = false;
    const c = { body, mesh, ring, line:0.5, settle:0, done:0, count:0 }; setLine(c); cups.push(c);
    if (fill) fillBox(L, ps, x, FLOOR + T + 0.05 + fill*H/2, HW-0.06, fill*H/2 - 0.02);
    return c;
  }
  function setLine(c){ c.line = 0.35 + Math.random()*0.45; c.ring.position.y = -H/2 + T + c.line*(H - T - 0.08); c.settle = 0; }
  makeCup(-1.95, 0.7); makeCup(0, 0); makeCup(1.95, 0);
  const tmp = new L.b2Vec2(0,0);
  const fingers = new Map(); let score = 0;
  function cupAt(x, y){ let best=null, bd=1.1; for (const c of cups){ const p = c.body.GetPosition(); const d = Math.hypot(p.x-x, (p.y-y)*0.8); if (d < bd){ bd=d; best=c; } } return best; }
  function down(id, x, y){ countAction();
    const grabbed = [...fingers.values()].find(f => f.cup);
    if (grabbed && !fingers.has(id)){ fingers.set(id, { twist:true, cup:null, x, y, ref: grabbed }); return; }
    const c = cupAt(x, y); if (!c) return;
    const md = new L.b2MouseJointDef(); md.bodyA = ground; md.bodyB = c.body; md.target.Set(x, y); const m = c.body.GetMass(); const w = 2*Math.PI*4.5;
    md.maxForce = 400*m; md.stiffness = m*w*w; md.damping = 2*m*0.9*w; md.collideConnected = true;
    const j = L.castObject(world.CreateJoint(md), L.b2MouseJoint); fingers.set(id, { cup:c, j, x, y }); c.held = true; haptic(8); audio.playCubeButton('click-soft');
  }
  function move(id, x, y){ const f = fingers.get(id); if (!f) return; f.x = x; f.y = y; if (f.j){ tmp.Set(x, y); f.j.SetTarget(tmp); } }
  function up(id){ const f = fingers.get(id); if (!f) return; if (f.j){ world.DestroyJoint(f.j); f.cup.held = false; } fingers.delete(id); }
  let tap = false;
  hud.actions([{ label:'Hold Tap', down:()=>{ tap = true; }, up:()=>{ tap = false; } }, { label:'Drain', click:()=>{ drainT = 1.2; audio.playDrainVortex(); haptic(20); } }]);
  hud.title('Pour'); hud.sub('Lift a glass over another to pour · fill to the gold line');
  let drainT = 0, lastGlug = 0;
  function step(dtR){
    const dt = Math.min(1/30, dtR);
    // wrist controller: held cups auto-tip toward the cup they are lifted over; a 2nd finger twists
    for (const c of cups){ const p = c.body.GetPosition(), a = c.body.GetAngle(); let target = 0;
      if (c.held){ for (const o of cups){ if (o === c) continue; const op = o.body.GetPosition(); const dx = op.x - p.x, lift = (p.y - H/2) - (op.y + H/2);
          if (lift > -0.15 && Math.abs(dx) < 1.9){ const t = Math.min(1, (1.9 - Math.abs(dx))/1.1) * Math.min(1, (lift+0.15)/0.4); const tt = -Math.sign(dx)*t*2.1; if (Math.abs(tt) > Math.abs(target)) target = tt; } } }
      for (const f of fingers.values()) if (f.twist && f.ref.cup === c){ const ang = Math.atan2(f.y - p.y, f.x - p.x); target = Math.max(-2.3, Math.min(2.3, -(ang - Math.PI/2)*-1)); }
      const I = c.body.GetMass()*0.5; const kp = c.held ? 60 : 25; c.body.ApplyTorque(I*(kp*(target - a) - 9*c.body.GetAngularVelocity()), true); }
    if (tap && ps.GetParticleCount() < MAXP - 10){ for (let k=0;k<3;k++) spawnParticle(L, ps, -2.6 + (Math.random()-0.5)*0.08, 2.6, 0.9, -1.5); }
    if (drainT > 0){ drainT -= dt; let n = ps.GetParticleCount(); for (let k=0;k<Math.min(n, 60);k++) ps.DestroyOldestParticle(0, false); }
    world.Step(dt/2, 8, 3, 3); world.Step(dt/2, 8, 3, 3);
    const v = views(L, ps);
    // count water per cup (in cup-local frame) + free-flying stream
    for (const c of cups) c.count = 0; let flying = 0;
    for (let i=0;i<v.n;i++){ const x = v.pos[i*2], y = v.pos[i*2+1]; let inside = false;
      for (const c of cups){ const p = c.body.GetPosition(), a = -c.body.GetAngle(); const dx = x-p.x, dy = y-p.y; const lx = dx*Math.cos(a) - dy*Math.sin(a), ly = dx*Math.sin(a) + dy*Math.cos(a);
        if (Math.abs(lx) < HW && ly > -H/2 && ly < H/2){ c.count++; inside = true; break; } }
      if (!inside && Math.hypot(v.vel[i*2], v.vel[i*2+1]) > 1.6) flying++; }
    const full = (HW*2-0.02)*(H-T)/((PR*1.5)**2); // particles in a brim-full cup
    const now = performance.now(); let best = 0;
    for (const c of cups){ const lvl = c.count/full; const err = Math.abs(lvl - c.line); best = Math.max(best, 1 - Math.min(1, err/0.3));
      if (err < 0.04 && !c.held && Math.abs(c.body.GetAngle()) < 0.1 && flying < 6){ c.settle += dt; c.ring.scaling.setAll(1 + Math.sin(now/80)*0.02); if (c.settle > 0.9){ score++; audio.playBreathCue('inhale'); haptic(30); setTimeout(()=>haptic(30),120); hud.sub(`Perfect pour! ${score} hit${score>1?'s':''} · new line set`); setLine(c); } }
      else { c.settle = 0; c.ring.scaling.setAll(1); }
      }
    hud.meter(best);
    if (flying > 8){ audio.updatePourStream(Math.min(1, flying/90), 0.5); if (now - lastGlug > 140 + Math.random()*160){ haptic(prefs.lowStim ? 3 : 7); lastGlug = now; } } else audio.stopPourStream();
    if (pf) pf.update(v.pos, v.n, 0.85, v.vel, 0.04); else fw.update(v.pos, v.vel, v.n, 0.85);
    for (const c of cups){ const p = c.body.GetPosition(); c.mesh.position.set(p.x, p.y, 0); c.mesh.rotation.z = c.body.GetAngle(); }
  }
  const leave = () => audio.stopPourStream();
  return { scene, cam, step, down, move, up, leave, pipe, name:'pour', debug:{ cups, world, L, fingers } };
}
