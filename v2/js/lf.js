// LiquidFun (Box2D + particles, wasm) loader and helpers.
let modP = null;
export function loadLiquidFun(){
  if (!modP) modP = window.Box2D({ locateFile: (f) => new URL('../vendor/' + f, import.meta.url).href });
  return modP;
}
export function makeWorld(L, g = -10){ return new L.b2World(new L.b2Vec2(0, g)); }
export function staticBox(L, world, x, y, hw, hh, angle = 0, body = null){
  if (!body){ const bd = new L.b2BodyDef(); body = world.CreateBody(bd); }
  const s = new L.b2PolygonShape(); s.SetAsBox(hw, hh, new L.b2Vec2(x, y), angle);
  body.CreateFixture(s, 0); return body;
}
export function particleSystem(L, world, { radius = 0.05, max = 2000, damping = 0.2, viscous = 0.05, pressure = 0.05, surface = 0.2 } = {}){
  const d = new L.b2ParticleSystemDef(); d.radius = radius; d.maxCount = max; d.dampingStrength = damping;
  d.viscousStrength = viscous; d.pressureStrength = pressure; d.surfaceTensionNormalStrength = surface; d.surfaceTensionPressureStrength = surface;
  const ps = world.CreateParticleSystem(d); ps.SetMaxParticleCount(max); return ps;
}
export function spawnParticle(L, ps, x, y, vx = 0, vy = 0, flags = 0){
  const pd = spawnParticle._pd || (spawnParticle._pd = new L.b2ParticleDef());
  pd.flags = flags || L.b2_waterParticle; pd.position.Set(x, y); pd.velocity.Set(vx, vy); return ps.CreateParticle(pd);
}
export function fillCircle(L, ps, x, y, r, flags){
  const s = new L.b2CircleShape(); s.m_radius = r;
  const gd = new L.b2ParticleGroupDef(); gd.shape = s; gd.flags = flags || L.b2_waterParticle; gd.position.Set(x, y);
  return ps.CreateParticleGroup(gd);
}
export function fillBox(L, ps, x, y, hw, hh, angle = 0){
  const s = new L.b2PolygonShape(); s.SetAsBox(hw, hh, new L.b2Vec2(0,0), 0);
  const gd = new L.b2ParticleGroupDef(); gd.shape = s; gd.flags = L.b2_waterParticle; gd.position.Set(x, y); gd.angle = angle;
  return ps.CreateParticleGroup(gd);
}
export function views(L, ps){
  const n = ps.GetParticleCount();
  const pp = L.getPointer(ps.GetPositionBuffer()), vp = L.getPointer(ps.GetVelocityBuffer());
  return { n, pos: L.HEAPF32.subarray(pp>>2, (pp>>2) + n*2), vel: L.HEAPF32.subarray(vp>>2, (vp>>2) + n*2) };
}
