import { initShell, audio } from './shell.js';
import { createEngine, adaptiveQuality, screenToPlane } from './stage.js';
import { loadLiquidFun } from './lf.js';
const B = window.BABYLON;
initShell();
const canvas = document.getElementById('stage3d');
const engine = createEngine(canvas);
const $ = (id) => document.getElementById(id);
const hud = {
  title: (t) => $('hudTitle').textContent = t,
  sub: (t) => $('hudSub').textContent = t,
  meter: (v) => { if (v === null) { $('hudMeter').style.visibility='hidden'; return; } $('hudMeter').style.visibility='visible'; $('hudMeterFill').style.width = (Math.max(0,Math.min(1,v))*100).toFixed(1)+'%'; $('hudMeter').classList.toggle('hot', v > 0.7); },
  actions: () => {},
};
const toys = {}; let active = null; const factories = {};
function setActions(list){
  const box = $('v2Actions'); box.innerHTML = '';
  for (const a of list){ const b = document.createElement('button'); b.className = 'v2-btn'; b.type='button'; b.textContent = a.label;
    if (a.click) b.addEventListener('click', a.click);
    if (a.down){ b.addEventListener('pointerdown', (e)=>{ e.stopPropagation(); b.setPointerCapture(e.pointerId); a.down(); }); const u = ()=>a.up&&a.up(); b.addEventListener('pointerup', u); b.addEventListener('pointercancel', u); }
    box.appendChild(b); }
}
async function show(name){
  document.querySelectorAll('.dock-tab').forEach(t => { const on = t.dataset.tab === name; t.classList.toggle('active', on); t.setAttribute('aria-selected', String(on)); });
  if (active && active.leave) active.leave();
  const acts = []; hud.actions = (l) => acts.push(...l);
  if (!toys[name]){ $('v2Loading').classList.remove('done'); toys[name] = await factories[name](engine, hud); }
  else if (toys[name].enter) toys[name].enter();
  active = toys[name]; setActions(toys[name].__acts || (toys[name].__acts = acts));
  active.onTitle && active.onTitle();
  $('v2Loading').classList.add('done'); window.__active = active;
}
let L = null;
factories.balloon = async (e, h) => (await import('./balloon.js')).createBalloon(e, L, h);
factories.pour = async (e, h) => (await import('./pour.js')).createPour(e, L, h);
factories.beads = async (e, h) => (await import('./beads.js')).createBeads(e, h);
// pointer routing (multi-touch) into toy world coordinates
const ptr = (e) => { const r = canvas.getBoundingClientRect(); const s = engine.getRenderWidth()/r.width; return [(e.clientX - r.left)*s, (e.clientY - r.top)*s]; };
function world(e){ const [x,y] = ptr(e); return active.pick ? active.pick(x,y) : screenToPlane(active.scene, active.cam, x, y, 0); }
canvas.addEventListener('pointerdown', (e) => { if (!active) return; canvas.setPointerCapture(e.pointerId); const w = world(e); w && active.down(e.pointerId, w.x, w.y, w); });
canvas.addEventListener('pointermove', (e) => { if (!active) return; const w = world(e); w && active.move(e.pointerId, w.x, w.y, w); });
const up = (e) => active && active.up(e.pointerId); canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
document.querySelectorAll('.dock-tab').forEach(t => t.addEventListener('click', () => { audio.init(); audio.playCubeButton('click-mid'); show(t.dataset.tab); }));
const aq = adaptiveQuality(); let last = performance.now(); window.__fps = [];
engine.runRenderLoop(() => { const now = performance.now(); const dt = (now - last)/1000; last = now; if (!active) return;
  active.step(Math.min(dt, 0.05)); active.scene.render(); aq(); });
(async () => {
  try { L = await loadLiquidFun(); await show('balloon'); window.__ready = true; }
  catch (err) { console.error(err); $('v2Loading').textContent = 'Could not start physics: ' + err.message; }
})();
window.__show = show; window.__advance = (sec) => { for (let i=0;i<sec*60;i++) active.step(1/60); }; window.__engine = engine;
