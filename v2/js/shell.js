import { TactileAudioEngine } from '../audio.js';
export const audio = new TactileAudioEngine();
const KEY = 'steadyhands-v2';
export const prefs = Object.assign({ lowStim:false, uniformPitch:false, sound:true, haptics:true, theme:'obsidian', urges:0, actions:0 }, JSON.parse(localStorage.getItem(KEY) || '{}'));
const save = () => localStorage.setItem(KEY, JSON.stringify(prefs));
const $ = (id) => document.getElementById(id);
const mmss = (s) => `${Math.floor(s/60)}:${String(s%60).padStart(2,'0')}`;
export function haptic(ms){ if (prefs.haptics && navigator.vibrate) try{ navigator.vibrate(prefs.lowStim ? Math.min(ms,8) : ms); }catch(e){} }
export function countAction(){ prefs.actions++; if (prefs.actions % 20 === 0) save(); }
function apply(){
  document.body.dataset.theme = prefs.theme;
  document.body.classList.toggle('low-stim', prefs.lowStim);
  audio.setSoundEnabled(prefs.sound); audio.setHapticsEnabled(false); audio.setLowStimEnabled(prefs.lowStim); audio.setUniformPitch(prefs.uniformPitch);
  for (const [id,on] of [['lowStimBtn',prefs.lowStim],['pitchModeBtn',prefs.uniformPitch],['soundToggleBtn',prefs.sound],['hapticToggleBtn',prefs.haptics]]) { const b=$(id); if(b){b.classList.toggle('active',on); b.setAttribute('aria-pressed',String(on));} }
  document.querySelectorAll('#themeGroup .seg-choice').forEach(b=>b.classList.toggle('active', b.dataset.themeChoice===prefs.theme));
  $('urgesSurfedCount').textContent = prefs.urges; $('totalInteractionsCount').textContent = prefs.actions.toLocaleString();
  window.dispatchEvent(new CustomEvent('prefs'));
}
export function initShell(){
  const unlock = () => audio.init();
  window.addEventListener('pointerdown', unlock, { once:false, passive:true });
  // craving timer
  let left = 180, iv = null; const btn = $('urgeTimerBtn');
  const ui = () => { btn.classList.toggle('running', !!iv); $('urgeTimerText').textContent = mmss(left); $('urgeProgressFill').style.width = (iv ? (180-left)/1.8 : 0) + '%'; };
  btn.addEventListener('click', () => { audio.init(); audio.playCubeButton('clicky');
    if (iv) { clearInterval(iv); iv=null; left=180; } else { left=180; iv=setInterval(()=>{ if(--left<=0){ clearInterval(iv); iv=null; left=180; prefs.urges++; audio.playBreathCue('inhale'); haptic(40); save(); apply(); } ui(); },1000); } ui(); });
  // sheet
  const sheet = $('settingsSheet');
  $('drawerBtn').onclick = () => { audio.init(); $('totalInteractionsCount').textContent = prefs.actions.toLocaleString(); sheet.hidden = false; };
  $('closeSheetBtn').onclick = () => sheet.hidden = true;
  sheet.addEventListener('click', e => { if (e.target === sheet) sheet.hidden = true; });
  const tog = (id,k) => $(id)?.addEventListener('click', () => { prefs[k] = !prefs[k]; save(); apply(); });
  tog('lowStimBtn','lowStim'); tog('pitchModeBtn','uniformPitch'); tog('soundToggleBtn','sound'); tog('hapticToggleBtn','haptics');
  document.querySelectorAll('#ambientGroup .seg-choice').forEach(b => b.onclick = () => { audio.init(); audio.setAmbientMode(b.dataset.ambient); document.querySelectorAll('#ambientGroup .seg-choice').forEach(x=>x.classList.toggle('active',x===b)); });
  let fiv=null; document.querySelectorAll('#focusGroup .seg-choice').forEach(b => b.onclick = () => { document.querySelectorAll('#focusGroup .seg-choice').forEach(x=>x.classList.toggle('active',x===b)); clearInterval(fiv); let s=+b.dataset.focus; const t=$('focusRemainingText'); t.textContent = s? mmss(s):'Off'; if(s) fiv=setInterval(()=>{ if(--s<=0){clearInterval(fiv); t.textContent='Done'; audio.playBreathCue('inhale');} else t.textContent=mmss(s); },1000); });
  document.querySelectorAll('#themeGroup .seg-choice').forEach(b => b.onclick = () => { prefs.theme = b.dataset.themeChoice; save(); apply(); });
  $('logUrgeSurfedBtn').onclick = () => { prefs.urges++; save(); apply(); };
  $('resetDataBtn').onclick = () => { prefs.urges=0; prefs.actions=0; save(); apply(); };
  // install
  let deferred=null; const ib=$('installTopBtn');
  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred=e; if(!standalone) ib.hidden=false; });
  window.addEventListener('appinstalled', () => { ib.hidden=true; deferred=null; });
  ib.onclick = async () => { if(!deferred) return; deferred.prompt(); const r = await deferred.userChoice; if (r.outcome==='accepted') ib.hidden=true; deferred=null; };
  const ub=$('updateBanner'); if (ub) ub.hidden = true;
  apply();
}
