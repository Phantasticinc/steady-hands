import { TactileAudioEngine } from './audio.js';
import { StudioShaderPipeline } from './shaders.js';
import { Studio3DEngine } from './studio3d.js';

const STORAGE_KEY = 'steadyhands_fidget_state_v4';
const audio = new TactileAudioEngine();
const shaderPipe = new StudioShaderPipeline();
const studio3D = new Studio3DEngine();

const state = {
  activeTab: 'balloon',
  theme: 'obsidian',
  lowStim: false,
  uniformPitch: false,
  sound: true,
  haptics: true,
  ambient: 'off',

  totalInteractions: 0,
  urgesSurfed: 0,

  urgeActive: false,
  urgeRemainingSec: 180,
  urgeInterval: null,

  focusDurationSec: 0,
  focusRemainingSec: 0,
  focusInterval: null,

  // 1. Balloon Alchemy ('water' | 'chrome' | 'biolume')
  balloonAlchemy: 'water',

  // 2. Pour Sandbox ('water' | 'elixir' | 'zerog')
  pourMode: 'water',
  drainOpen: false,
  drainTimer: 0,

  // 3. Beads ('track' | 'gel' | 'orbit')
  beadsMode: 'track',

  // 4. Flux ('ferro' | 'pop3d')
  fluxMode: 'ferro',
  poppedMap: new Array(25).fill(false),

  // 5. Switch Mechatronic Module
  sliderPos: 0.25,
  sliderVel: 0,
  sliderDetent: 1,
  dialAngle: 35,
  dialVelocity: 0,
  dialLastDetent: 2,

  // 6. Breathe Core
  breathPattern: 'deepdraw',
  breathHoldOverride: false,
  breathHoldStart: 0,
  lastBreathPhase: ''
};

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (saved.theme) state.theme = saved.theme;
    if (typeof saved.lowStim === 'boolean') state.lowStim = saved.lowStim;
    if (typeof saved.uniformPitch === 'boolean') state.uniformPitch = saved.uniformPitch;
    if (typeof saved.sound === 'boolean') state.sound = saved.sound;
    if (typeof saved.haptics === 'boolean') state.haptics = saved.haptics;
    if (typeof saved.totalInteractions === 'number') state.totalInteractions = saved.totalInteractions;
    if (typeof saved.urgesSurfed === 'number') state.urgesSurfed = saved.urgesSurfed;
  } catch (_) {}
}

function saveState() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        theme: state.theme,
        lowStim: state.lowStim,
        uniformPitch: state.uniformPitch,
        sound: state.sound,
        haptics: state.haptics,
        totalInteractions: state.totalInteractions,
        urgesSurfed: state.urgesSurfed
      })
    );
  } catch (_) {}
}

function recordInteraction(count = 1) {
  state.totalInteractions += count;
  const el = document.getElementById('totalInteractionsCount');
  if (el) el.textContent = state.totalInteractions.toLocaleString();
  saveState();
}

function formatMMSS(sec) {
  const s = Math.max(0, Math.ceil(sec));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${rem < 10 ? '0' : ''}${rem}`;
}

function toCanvasPos(canvas, clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / Math.max(1, rect.width);
  const scaleY = canvas.height / Math.max(1, rect.height);
  return {
    x: (clientX - rect.left) * scaleX,
    y: (clientY - rect.top) * scaleY
  };
}

function applyPreferencesUI() {
  document.body.dataset.theme = state.theme;
  document.body.classList.toggle('low-stim', state.lowStim);

  audio.setSoundEnabled(state.sound);
  audio.setHapticsEnabled(state.haptics);
  audio.setLowStimEnabled(state.lowStim);
  audio.setUniformPitch(state.uniformPitch);

  const lowStimBtn = document.getElementById('lowStimBtn');
  if (lowStimBtn) {
    lowStimBtn.classList.toggle('active', state.lowStim);
    lowStimBtn.setAttribute('aria-pressed', String(state.lowStim));
  }

  const pitchModeBtn = document.getElementById('pitchModeBtn');
  if (pitchModeBtn) {
    pitchModeBtn.classList.toggle('active', state.uniformPitch);
    pitchModeBtn.setAttribute('aria-pressed', String(state.uniformPitch));
  }

  const soundToggleBtn = document.getElementById('soundToggleBtn');
  const soundStatusText = document.getElementById('soundStatusText');
  if (soundToggleBtn) {
    soundToggleBtn.classList.toggle('active', state.sound);
    soundToggleBtn.setAttribute('aria-pressed', String(state.sound));
  }
  if (soundStatusText) {
    soundStatusText.textContent = state.sound ? 'On (Synthesized)' : 'Muted';
  }

  const hapticToggleBtn = document.getElementById('hapticToggleBtn');
  const hapticStatusText = document.getElementById('hapticStatusText');
  if (hapticToggleBtn) {
    hapticToggleBtn.classList.toggle('active', state.haptics);
    hapticToggleBtn.setAttribute('aria-pressed', String(state.haptics));
  }
  if (hapticStatusText) {
    hapticStatusText.textContent = state.haptics ? 'On (Device vibrate)' : 'Off';
  }

  document.querySelectorAll('#themeGroup .seg-choice').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.themeChoice === state.theme);
  });

  const urgesEl = document.getElementById('urgesSurfedCount');
  if (urgesEl) urgesEl.textContent = String(state.urgesSurfed);

  const totalEl = document.getElementById('totalInteractionsCount');
  if (totalEl) totalEl.textContent = state.totalInteractions.toLocaleString();
}

function initTopBarAndSheet() {
  const urgeBtn = document.getElementById('urgeTimerBtn');
  const urgeFill = document.getElementById('urgeProgressFill');
  const urgeText = document.getElementById('urgeTimerText');
  const brandLed = document.getElementById('brandLed');

  function updateUrgeUI() {
    if (!urgeBtn || !urgeFill || !urgeText) return;
    urgeBtn.classList.toggle('running', state.urgeActive);
    urgeBtn.setAttribute('aria-pressed', String(state.urgeActive));
    urgeText.textContent = formatMMSS(state.urgeRemainingSec);
    const pct = state.urgeActive ? ((180 - state.urgeRemainingSec) / 180) * 100 : 0;
    urgeFill.style.width = `${Math.min(100, Math.max(0, pct)).toFixed(1)}%`;
    if (brandLed) {
      brandLed.style.background = state.urgeActive ? 'var(--accent-warm)' : 'var(--accent-calm)';
      brandLed.style.boxShadow = state.urgeActive
        ? '0 0 12px var(--accent-warm)'
        : '0 0 10px var(--accent-calm)';
    }
  }

  if (urgeBtn) {
    urgeBtn.addEventListener('click', () => {
      audio.init();
      audio.playCubeButton('clicky');
      if (state.urgeActive) {
        state.urgeActive = false;
        clearInterval(state.urgeInterval);
        state.urgeInterval = null;
        state.urgeRemainingSec = 180;
      } else {
        state.urgeActive = true;
        state.urgeRemainingSec = 180;
        clearInterval(state.urgeInterval);
        state.urgeInterval = setInterval(() => {
          state.urgeRemainingSec -= 1;
          if (state.urgeRemainingSec <= 0) {
            clearInterval(state.urgeInterval);
            state.urgeInterval = null;
            state.urgeActive = false;
            state.urgeRemainingSec = 180;
            state.urgesSurfed += 1;
            audio.playBreathCue('inhale');
            applyPreferencesUI();
            saveState();
          }
          updateUrgeUI();
        }, 1000);
      }
      updateUrgeUI();
    });
  }

  const sheet = document.getElementById('settingsSheet');
  const drawerBtn = document.getElementById('drawerBtn');
  const closeSheetBtn = document.getElementById('closeSheetBtn');

  if (drawerBtn && sheet) {
    drawerBtn.addEventListener('click', () => {
      audio.init();
      sheet.hidden = false;
    });
  }
  if (closeSheetBtn && sheet) {
    closeSheetBtn.addEventListener('click', () => {
      sheet.hidden = true;
    });
  }
  if (sheet) {
    sheet.addEventListener('click', (e) => {
      if (e.target === sheet) sheet.hidden = true;
    });
  }

  document.getElementById('lowStimBtn')?.addEventListener('click', () => {
    state.lowStim = !state.lowStim;
    applyPreferencesUI();
    saveState();
  });

  document.getElementById('pitchModeBtn')?.addEventListener('click', () => {
    state.uniformPitch = !state.uniformPitch;
    applyPreferencesUI();
    saveState();
  });

  document.getElementById('soundToggleBtn')?.addEventListener('click', () => {
    state.sound = !state.sound;
    applyPreferencesUI();
    saveState();
  });

  document.getElementById('hapticToggleBtn')?.addEventListener('click', () => {
    state.haptics = !state.haptics;
    applyPreferencesUI();
    saveState();
  });

  const ambientBadge = document.getElementById('ambientBadge');
  document.querySelectorAll('#ambientGroup .seg-choice').forEach((btn) => {
    btn.addEventListener('click', () => {
      audio.init();
      const mode = btn.dataset.ambient || 'off';
      state.ambient = mode;
      document.querySelectorAll('#ambientGroup .seg-choice').forEach((b) =>
        b.classList.toggle('active', b === btn)
      );
      audio.setAmbientMode(mode);
      if (ambientBadge) {
        if (mode === 'off') {
          ambientBadge.hidden = true;
        } else {
          ambientBadge.hidden = false;
          ambientBadge.textContent =
            mode === 'brown' ? 'Brown' : mode === 'rain' ? 'Rain' : '40Hz';
        }
      }
    });
  });

  const focusRemainingText = document.getElementById('focusRemainingText');
  document.querySelectorAll('#focusGroup .seg-choice').forEach((btn) => {
    btn.addEventListener('click', () => {
      const sec = parseInt(btn.dataset.focus || '0', 10);
      document.querySelectorAll('#focusGroup .seg-choice').forEach((b) =>
        b.classList.toggle('active', b === btn)
      );
      clearInterval(state.focusInterval);
      state.focusDurationSec = sec;
      state.focusRemainingSec = sec;
      if (sec <= 0) {
        if (focusRemainingText) focusRemainingText.textContent = 'Off';
        return;
      }
      if (focusRemainingText) focusRemainingText.textContent = formatMMSS(sec);
      state.focusInterval = setInterval(() => {
        state.focusRemainingSec -= 1;
        if (state.focusRemainingSec <= 0) {
          clearInterval(state.focusInterval);
          if (focusRemainingText) focusRemainingText.textContent = 'Done';
          audio.playBreathCue('inhale');
        } else if (focusRemainingText) {
          focusRemainingText.textContent = formatMMSS(state.focusRemainingSec);
        }
      }, 1000);
    });
  });

  document.querySelectorAll('#themeGroup .seg-choice').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.theme = btn.dataset.themeChoice || 'obsidian';
      applyPreferencesUI();
      saveState();
    });
  });

  document.getElementById('logUrgeSurfedBtn')?.addEventListener('click', () => {
    state.urgesSurfed += 1;
    audio.playBreathCue('inhale');
    applyPreferencesUI();
    saveState();
  });

  document.getElementById('resetDataBtn')?.addEventListener('click', () => {
    state.urgesSurfed = 0;
    state.totalInteractions = 0;
    applyPreferencesUI();
    saveState();
  });
}

function initDockNavigation() {
  const tabs = document.querySelectorAll('.dock-tab');
  const panels = {
    balloon: document.getElementById('panel-balloon'),
    pour: document.getElementById('panel-pour'),
    beads: document.getElementById('panel-beads'),
    flux: document.getElementById('panel-flux'),
    cube: document.getElementById('panel-cube'),
    breathe: document.getElementById('panel-breathe')
  };

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab || 'balloon';
      state.activeTab = target;
      tabs.forEach((t) => {
        const active = t === tab;
        t.classList.toggle('active', active);
        t.setAttribute('aria-selected', String(active));
      });
      Object.entries(panels).forEach(([key, panel]) => {
        if (!panel) return;
        const show = key === target;
        panel.hidden = !show;
        panel.classList.toggle('active', show);
      });
      audio.stopBalloonStrain();
      audio.stopPourStream();
      audio.stopWorryHum();
      audio.vibrate(6);
    });
  });
}

/* ==========================================================================
   1. BALLOON: 3D DEFORMABLE PBR LATEX MESH + MULTI-TOUCH GRAB/PINCH/TWIST
   ========================================================================== */

const balloonSim = {
  cx: 360,
  cy: 410,
  baseR: 185,
  pressure: 0, // 0..1
  squeezing: false,
  pointerX: 360,
  pointerY: 410,
  pointers: new Map(), // pointerId -> { startX, startY, x, y }
  activeFingers: [],
  offsetX: 0,
  offsetY: 0,
  velOffsetX: 0,
  velOffsetY: 0,
  stretchX: 0,
  stretchY: 0,
  velStretchX: 0,
  velStretchY: 0,
  pinchSqueeze: 0,
  twistAngle: 0,
  velTwist: 0,
  jellyEnergy: 0.15,
  bursting: false,
  respawnScale: 1,
  particles: [],
  screenDrops: [],
  shockwaves: []
};

function resetBalloonFresh() {
  balloonSim.bursting = false;
  balloonSim.respawnScale = 0.25;
  balloonSim.pressure = 0;
  balloonSim.stretchX = 0;
  balloonSim.stretchY = 0;
  balloonSim.pinchSqueeze = 0;
  balloonSim.twistAngle = 0;
  balloonSim.jellyEnergy = 0.55;
  balloonSim.particles.length = 0;
  balloonSim.screenDrops.length = 0;
  audio.vibrate(10);
}

function initBalloonStage() {
  const canvas = document.getElementById('balloonCanvas');
  if (!canvas) return;

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    audio.init();
    const pt = toCanvasPos(canvas, e.clientX, e.clientY);
    balloonSim.pointers.set(e.pointerId, {
      startX: pt.x,
      startY: pt.y,
      x: pt.x,
      y: pt.y
    });
    balloonSim.pointerX = pt.x;
    balloonSim.pointerY = pt.y;

    if (balloonSim.bursting && balloonSim.respawnScale > 0.35) {
      balloonSim.bursting = false;
      balloonSim.pressure = 0;
    }
    balloonSim.squeezing = true;
    balloonSim.jellyEnergy = Math.min(1.0, balloonSim.jellyEnergy + 0.35);
    audio.playBalloonStretch(Math.max(0.2, balloonSim.pressure), state.balloonAlchemy);
    recordInteraction(1);
  });

  canvas.addEventListener('pointermove', (e) => {
    const rec = balloonSim.pointers.get(e.pointerId);
    if (!rec) return;
    const pt = toCanvasPos(canvas, e.clientX, e.clientY);
    rec.x = pt.x;
    rec.y = pt.y;
    balloonSim.pointerX = pt.x;
    balloonSim.pointerY = pt.y;
  });

  const endPointer = (e) => {
    balloonSim.pointers.delete(e.pointerId);
    if (balloonSim.pointers.size === 0) {
      if (balloonSim.squeezing && !balloonSim.bursting) {
        balloonSim.jellyEnergy = Math.min(1.2, 0.45 + balloonSim.pressure * 0.75);
      }
      balloonSim.squeezing = false;
      audio.stopBalloonStrain();
    }
  };

  canvas.addEventListener('pointerup', endPointer);
  canvas.addEventListener('pointercancel', endPointer);

  document.querySelectorAll('#panel-balloon .quiet-pill').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#panel-balloon .quiet-pill').forEach((b) =>
        b.classList.remove('active')
      );
      btn.classList.add('active');
      state.balloonAlchemy = btn.dataset.alchemy || 'water';
      balloonSim.jellyEnergy = 0.45;
      audio.vibrate(7);
    });
  });

  document.getElementById('inflateBalloonBtn')?.addEventListener('click', () => {
    audio.init();
    resetBalloonFresh();
  });
}

function triggerBalloonBurst() {
  balloonSim.bursting = true;
  balloonSim.squeezing = false;
  balloonSim.pointers.clear();
  balloonSim.respawnScale = 0.01;
  balloonSim.pressure = 0;
  balloonSim.jellyEnergy = 1.1;
  audio.stopBalloonStrain();
  audio.playBalloonBurst(state.balloonAlchemy);
  recordInteraction(2);

  const cx = balloonSim.cx + balloonSim.offsetX * 95;
  const cy = balloonSim.cy + balloonSim.offsetY * 95;

  balloonSim.shockwaves.push({ x: cx, y: cy, r: 45, alpha: 0.98 });
  balloonSim.shockwaves.push({ x: cx, y: cy, r: 16, alpha: 0.8 });

  // Spawn 95 metaball burst droplets
  for (let i = 0; i < 95; i++) {
    const a = (i / 95) * Math.PI * 2 + (Math.random() - 0.5) * 0.25;
    const spd = 120 + Math.random() * 580;
    balloonSim.particles.push({
      x: cx + Math.cos(a) * (18 + Math.random() * 75),
      y: cy + Math.sin(a) * (18 + Math.random() * 75),
      vx: Math.cos(a) * spd,
      vy: Math.sin(a) * spd - 110,
      r: 18 + Math.random() * 24,
      life: 1.0,
      hueShift: i / 95
    });
  }

  // Spawn 18 screen-lens splatter droplets that stick to the glass & drip slowly
  for (let i = 0; i < 18; i++) {
    balloonSim.screenDrops.push({
      x: 110 + Math.random() * 500,
      y: 140 + Math.random() * 480,
      r: 14 + Math.random() * 22,
      vy: 18 + Math.random() * 45,
      life: 1.0,
      hueShift: Math.random()
    });
  }
}

function renderBalloonFrame(dt, nowMs) {
  if (state.activeTab !== 'balloon') return;
  const canvas = document.getElementById('balloonCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const timeSec = nowMs * 0.001;

  // Compute multi-touch manipulation forces from active pointers
  const ptrs = Array.from(balloonSim.pointers.values());
  balloonSim.activeFingers = ptrs.map((p) => ({
    wx: ((p.x - balloonSim.cx) / 175) * 1.15,
    wy: (-(p.y - balloonSim.cy) / 175) * 1.15,
    pullX: Math.max(-1.3, Math.min(1.3, (p.x - p.startX) / 130)),
    pullY: Math.max(-1.3, Math.min(1.3, -(p.y - p.startY) / 130))
  }));

  let targetOffsetX = 0;
  let targetOffsetY = 0;
  let targetStretchX = 0;
  let targetStretchY = 0;
  let targetPinch = 0;
  let targetTwist = 0;

  if (ptrs.length === 1 && !balloonSim.bursting) {
    const p0 = ptrs[0];
    const dx = (p0.x - p0.startX) / 160;
    const dy = (p0.y - p0.startY) / 160;
    const dragDist = Math.hypot(dx, dy);
    targetOffsetX = Math.max(-0.85, Math.min(0.85, dx * 0.75));
    targetOffsetY = Math.max(-0.85, Math.min(0.85, dy * 0.75));
    // Pulling stretches the balloon along the drag axis while squeezing the perpendicular axis
    targetStretchX = Math.max(-0.28, Math.min(0.48, Math.abs(dx) * 0.52 - Math.abs(dy) * 0.18));
    targetStretchY = Math.max(-0.28, Math.min(0.48, Math.abs(dy) * 0.52 - Math.abs(dx) * 0.18));
    targetTwist = Math.max(-0.6, Math.min(0.6, dx * 0.45));
    balloonSim.pressure = Math.min(1, balloonSim.pressure + dt * (0.42 + dragDist * 0.45));
  } else if (ptrs.length >= 2 && !balloonSim.bursting) {
    const p0 = ptrs[0];
    const p1 = ptrs[1];
    const startDist = Math.max(40, Math.hypot(p1.startX - p0.startX, p1.startY - p0.startY));
    const curDist = Math.hypot(p1.x - p0.x, p1.y - p0.y);
    const startAng = Math.atan2(p1.startY - p0.startY, p1.startX - p0.startX);
    const curAng = Math.atan2(p1.y - p0.y, p1.x - p0.x);

    const ratio = (curDist - startDist) / 180;
    if (ratio < 0) {
      // Pinching 2 fingers together squeezes the waist and spikes pressure!
      targetPinch = Math.min(0.95, -ratio * 1.4);
      balloonSim.pressure = Math.min(1, balloonSim.pressure + dt * (0.65 + targetPinch * 0.9));
    } else {
      // Pulling 2 fingers apart stretches the balloon like taffy!
      targetStretchX = Math.min(0.62, ratio * 0.75);
      targetStretchY = -targetStretchX * 0.35;
      balloonSim.pressure = Math.min(1, balloonSim.pressure + dt * (0.45 + ratio * 0.6));
    }
    targetTwist = Math.max(-0.9, Math.min(0.9, curAng - startAng));
  } else if (!balloonSim.bursting && balloonSim.squeezing) {
    // Programmatic or single-hold squeeze
    balloonSim.pressure = Math.min(1, balloonSim.pressure + dt * 0.56);
    targetPinch = balloonSim.pressure * 0.45;
  } else if (!balloonSim.bursting) {
    balloonSim.pressure = Math.max(0, balloonSim.pressure - dt * 1.15);
  }

  if (balloonSim.squeezing && !balloonSim.bursting) {
    audio.updateBalloonStrain(balloonSim.pressure, state.balloonAlchemy);
    if (Math.random() < 0.35) audio.vibrate(6);
    if (balloonSim.pressure >= 0.995) {
      triggerBalloonBurst();
    }
  }

  // Spring-damper integration for elastic recovery & jelly oscillation
  balloonSim.velOffsetX += (targetOffsetX - balloonSim.offsetX) * 28 * dt;
  balloonSim.velOffsetY += (targetOffsetY - balloonSim.offsetY) * 28 * dt;
  balloonSim.velOffsetX *= Math.pow(0.06, dt);
  balloonSim.velOffsetY *= Math.pow(0.06, dt);
  balloonSim.offsetX += balloonSim.velOffsetX * dt;
  balloonSim.offsetY += balloonSim.velOffsetY * dt;

  balloonSim.velStretchX += (targetStretchX - balloonSim.stretchX) * 32 * dt;
  balloonSim.velStretchY += (targetStretchY - balloonSim.stretchY) * 32 * dt;
  balloonSim.velStretchX *= Math.pow(0.05, dt);
  balloonSim.velStretchY *= Math.pow(0.05, dt);
  balloonSim.stretchX += balloonSim.velStretchX * dt;
  balloonSim.stretchY += balloonSim.velStretchY * dt;

  balloonSim.pinchSqueeze += (targetPinch - balloonSim.pinchSqueeze) * Math.min(1, dt * 10);
  balloonSim.twistAngle += (targetTwist - balloonSim.twistAngle) * Math.min(1, dt * 10);
  balloonSim.jellyEnergy *= Math.pow(0.22, dt);

  if (balloonSim.bursting) {
    balloonSim.respawnScale += dt * 0.62;
    if (balloonSim.respawnScale >= 1) {
      balloonSim.respawnScale = 1;
      balloonSim.bursting = false;
      balloonSim.jellyEnergy = 0.55;
    }
  }

  // Update splashing metaball droplets & screen drips
  const activeMetaballs = [];
  for (let i = balloonSim.particles.length - 1; i >= 0; i--) {
    const p = balloonSim.particles[i];
    p.vy += 680 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt * 0.62;
    if (p.x < 36 || p.x > w - 36) p.vx *= -0.7;
    if (p.y > h - 36) {
      p.y = h - 36;
      p.vy *= -0.52;
      p.vx *= 0.85;
    }
    if (p.life <= 0) {
      balloonSim.particles.splice(i, 1);
    } else {
      activeMetaballs.push({
        x: p.x,
        y: p.y,
        r: p.r * Math.min(1, p.life * 1.25),
        hueShift: p.hueShift
      });
    }
  }

  for (let i = balloonSim.screenDrops.length - 1; i >= 0; i--) {
    const d = balloonSim.screenDrops[i];
    d.y += d.vy * dt;
    d.life -= dt * 0.38;
    if (d.life <= 0 || d.y > h + 30) {
      balloonSim.screenDrops.splice(i, 1);
    } else {
      activeMetaballs.push({
        x: d.x,
        y: d.y,
        r: d.r * Math.min(1, d.life * 1.15),
        hueShift: d.hueShift
      });
    }
  }

  // 1. Render background + any burst metaball liquid splatter via WebGL2 Shader
  const shaderMode =
    state.balloonAlchemy === 'chrome' ? 3 : state.balloonAlchemy === 'biolume' ? 2 : 0;
  shaderPipe.renderFluid(ctx, w, h, timeSec, shaderMode, activeMetaballs, []);

  // 2. Composite the Three.js 3D Deformable PBR Balloon on top
  studio3D.renderBalloon3D(ctx, w, h, timeSec, balloonSim, state.balloonAlchemy);

  // 3. Expanding shockwave rings on burst
  for (let i = balloonSim.shockwaves.length - 1; i >= 0; i--) {
    const sw = balloonSim.shockwaves[i];
    sw.r += 720 * dt;
    sw.alpha -= dt * 1.55;
    if (sw.alpha <= 0) {
      balloonSim.shockwaves.splice(i, 1);
      continue;
    }
    ctx.save();
    ctx.beginPath();
    ctx.arc(sw.x, sw.y, sw.r, 0, Math.PI * 2);
    ctx.strokeStyle =
      state.balloonAlchemy === 'biolume'
        ? '#5eead4'
        : state.balloonAlchemy === 'chrome'
        ? '#f8fafc'
        : '#7dd3fc';
    ctx.globalAlpha = sw.alpha;
    ctx.lineWidth = 4.5;
    ctx.stroke();
    ctx.restore();
  }

  // 4. Subtle hydrostatic pressure arc & tactile manipulation hint
  if (balloonSim.pressure > 0.03) {
    const cx = balloonSim.cx + balloonSim.offsetX * 75;
    const cy = balloonSim.cy + balloonSim.offsetY * 75;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, 224, -Math.PI / 2, -Math.PI / 2 + balloonSim.pressure * Math.PI * 2);
    ctx.strokeStyle = balloonSim.pressure > 0.74 ? '#fb7185' : 'rgba(125, 211, 252, 0.82)';
    ctx.lineWidth = 4.5;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.restore();
  }
}

/* ==========================================================================
   2. POUR: WEBGL2 METABALL REFRACTIVE FLUID + GRAB-AND-TILT GLASS VESSELS
   ========================================================================== */

const pourSim = {
  particles: [],
  maxParticles: 155,
  pouring: false,
  spoutX: 360,
  spoutAngle: 0,
  pointerX: 360,
  pointerY: 140,
  tiltX: 0,
  pointers: new Map(), // pointerId -> { type: 'vessel'|'spout'|'zerog', vesselIdx, lastX, lastY, x, y }
  vessels: [
    { x: 360, y: 295, homeX: 360, homeY: 295, w: 220, h: 112, angle: 0, vAngle: 0 }, // Top chalice
    { x: 205, y: 535, homeX: 205, homeY: 535, w: 182, h: 126, angle: 0, vAngle: 0 }, // Left tumbler
    { x: 515, y: 535, homeX: 515, homeY: 535, w: 182, h: 126, angle: 0, vAngle: 0 }  // Right tumbler
  ]
};

function spawnPourParticle(x, y, vx = 0, vy = 160, hueOverride = null) {
  if (pourSim.particles.length >= pourSim.maxParticles) {
    pourSim.particles.shift();
  }
  const isSecondTone =
    hueOverride !== null ? hueOverride : state.pourMode === 'elixir' ? (pourSim.particles.length % 2) : 0;
  pourSim.particles.push({
    x,
    y,
    vx: vx + (Math.random() - 0.5) * 36,
    vy: vy + Math.random() * 35,
    r: state.pourMode === 'zerog' ? 24 + Math.random() * 7 : 20.5,
    hueShift: isSecondTone
  });
}

function initPourStage() {
  const canvas = document.getElementById('pourCanvas');
  if (!canvas) return;

  // Seed initial cohesive liquid pool in the vessels so it looks rich immediately
  for (let i = 0; i < 48; i++) {
    spawnPourParticle(285 + (i % 12) * 13, 305 + Math.floor(i / 12) * 11, 0, 0, i % 2);
  }
  for (let i = 0; i < 28; i++) {
    spawnPourParticle(145 + (i % 7) * 17, 555 + Math.floor(i / 7) * 11, 0, 0, 0);
    spawnPourParticle(455 + (i % 7) * 17, 555 + Math.floor(i / 7) * 11, 0, 0, 1);
  }

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    audio.init();
    const pt = toCanvasPos(canvas, e.clientX, e.clientY);
    pourSim.pointerX = pt.x;
    pourSim.pointerY = pt.y;

    // Check if user grabbed one of the 3 glass vessels directly (when not in Zero-G)
    let grabbedVessel = -1;
    if (state.pourMode !== 'zerog') {
      for (let i = 0; i < pourSim.vessels.length; i++) {
        const v = pourSim.vessels[i];
        if (Math.abs(pt.x - v.x) < v.w * 0.56 && Math.abs(pt.y - v.y) < v.h * 0.62) {
          grabbedVessel = i;
          break;
        }
      }
    }

    if (grabbedVessel >= 0) {
      pourSim.pointers.set(e.pointerId, {
        type: 'vessel',
        vesselIdx: grabbedVessel,
        startX: pt.x,
        startY: pt.y,
        lastX: pt.x,
        lastY: pt.y,
        x: pt.x,
        y: pt.y
      });
      audio.vibrate(8);
    } else if (state.pourMode === 'zerog') {
      pourSim.pointers.set(e.pointerId, {
        type: 'zerog',
        lastX: pt.x,
        lastY: pt.y,
        x: pt.x,
        y: pt.y
      });
      pourSim.pouring = true;
    } else {
      pourSim.pointers.set(e.pointerId, {
        type: 'spout',
        lastX: pt.x,
        lastY: pt.y,
        x: pt.x,
        y: pt.y
      });
      pourSim.pouring = true;
      pourSim.spoutX = Math.max(95, Math.min(canvas.width - 95, pt.x));
    }
    recordInteraction(1);
  });

  canvas.addEventListener('pointermove', (e) => {
    const rec = pourSim.pointers.get(e.pointerId);
    if (!rec) return;
    const pt = toCanvasPos(canvas, e.clientX, e.clientY);
    const dx = pt.x - rec.lastX;
    const dy = pt.y - rec.lastY;
    rec.lastX = rec.x;
    rec.lastY = rec.y;
    rec.x = pt.x;
    rec.y = pt.y;
    pourSim.pointerX = pt.x;
    pourSim.pointerY = pt.y;

    if (rec.type === 'vessel') {
      const v = pourSim.vessels[rec.vesselIdx];
      // Move vessel slightly and tilt it generously so user can pour from cup to cup!
      v.x = v.homeX + Math.max(-110, Math.min(110, (pt.x - rec.startX) * 0.65));
      v.y = v.homeY + Math.max(-85, Math.min(85, (pt.y - rec.startY) * 0.55));
      const targetAngle = Math.max(-1.85, Math.min(1.85, (pt.x - rec.startX) * 0.011));
      v.angle = targetAngle;

      // Impart slosh + pour impulse to particles inside this vessel
      pourSim.particles.forEach((p) => {
        if (Math.hypot(p.x - v.x, p.y - v.y) < v.w * 0.65) {
          p.vx += dx * 4.2 + Math.sin(v.angle) * 25;
          p.vy += dy * 2.8 - Math.abs(Math.sin(v.angle)) * 14;
        }
      });
    } else if (rec.type === 'spout') {
      pourSim.spoutX = Math.max(95, Math.min(canvas.width - 95, pt.x));
      pourSim.spoutAngle = Math.max(-0.55, Math.min(0.55, dx * 0.025));
      pourSim.tiltX = Math.max(-180, Math.min(180, dx * 6.5));
    } else if (rec.type === 'zerog') {
      // Grab, stretch, or slice floating zero-G liquid blobs
      pourSim.particles.forEach((p) => {
        const d = Math.hypot(p.x - pt.x, p.y - pt.y);
        if (d < 135) {
          p.vx += dx * 9.5;
          p.vy += dy * 9.5;
        }
      });
    }
  });

  const stopPour = (e) => {
    pourSim.pointers.delete(e.pointerId);
    let anySpout = false;
    for (const r of pourSim.pointers.values()) {
      if (r.type === 'spout' || r.type === 'zerog') anySpout = true;
    }
    if (!anySpout) {
      pourSim.pouring = false;
      audio.stopPourStream();
    }
  };
  canvas.addEventListener('pointerup', stopPour);
  canvas.addEventListener('pointercancel', stopPour);

  document.querySelectorAll('#panel-pour .quiet-pill').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#panel-pour .quiet-pill').forEach((b) =>
        b.classList.remove('active')
      );
      btn.classList.add('active');
      state.pourMode = btn.dataset.pour || 'water';
      audio.vibrate(7);
    });
  });

  document.getElementById('drainFluidBtn')?.addEventListener('click', () => {
    audio.init();
    state.drainOpen = true;
    state.drainTimer = 2.4;
    audio.playDrainVortex();
    recordInteraction(1);
  });
}

function renderPourFrame(dt, nowMs) {
  if (state.activeTab !== 'pour') return;
  const canvas = document.getElementById('pourCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const timeSec = nowMs * 0.001;

  // Spring ungrabbed vessels smoothly back to their home mounts
  const grabbedSet = new Set();
  for (const r of pourSim.pointers.values()) {
    if (r.type === 'vessel') grabbedSet.add(r.vesselIdx);
  }
  pourSim.vessels.forEach((v, idx) => {
    if (!grabbedSet.has(idx)) {
      v.x += (v.homeX - v.x) * Math.min(1, dt * 8);
      v.y += (v.homeY - v.y) * Math.min(1, dt * 8);
      v.angle += (0 - v.angle) * Math.min(1, dt * 7);
    }
  });

  // Spawn active pouring stream when holding spout
  if (pourSim.pouring) {
    const streamSpeed = 240;
    const vx = Math.sin(pourSim.spoutAngle) * streamSpeed;
    const vy = Math.cos(pourSim.spoutAngle) * streamSpeed;
    for (let k = 0; k < 2; k++) {
      spawnPourParticle(
        pourSim.spoutX + (Math.random() - 0.5) * 10,
        state.pourMode === 'zerog' ? pourSim.pointerY : 78,
        vx,
        state.pourMode === 'zerog' ? (Math.random() - 0.5) * 90 : vy
      );
    }
    const fillNorm = Math.min(1, pourSim.particles.length / pourSim.maxParticles);
    audio.updatePourStream(0.85, fillNorm);
  }

  if (state.drainOpen) {
    state.drainTimer -= dt;
    if (state.drainTimer <= 0) state.drainOpen = false;
  }

  pourSim.tiltX *= Math.pow(0.08, dt);
  pourSim.spoutAngle *= Math.pow(0.1, dt);

  const P = pourSim.particles;
  const isZeroG = state.pourMode === 'zerog';
  const activeVessels = isZeroG ? [] : pourSim.vessels;

  // Integrate SPH / Metaball particle dynamics + tilted vessel wall collisions
  for (let i = P.length - 1; i >= 0; i--) {
    const p = P[i];
    if (isZeroG) {
      // Zero-G surface tension attraction toward nearby globes
      p.vx += (w * 0.5 - p.x) * 0.14 * dt;
      p.vy += (h * 0.5 - p.y) * 0.14 * dt;
      p.vx *= 0.992;
      p.vy *= 0.992;
    } else {
      p.vy += 690 * dt;
      p.vx += pourSim.tiltX * dt;
      p.vx *= 0.99;
      p.vy *= 0.99;
    }

    if (state.drainOpen) {
      const dx = w * 0.5 - p.x;
      const dy = h - 24 - p.y;
      const dist = Math.hypot(dx, dy) + 1;
      p.vx += (dx / dist) * 1050 * dt - (dy / dist) * 320 * dt;
      p.vy += (dy / dist) * 1250 * dt;
      if (p.y > h - 52 && Math.abs(p.x - w * 0.5) < 95) {
        P.splice(i, 1);
        continue;
      }
    }

    p.x += p.vx * dt;
    p.y += p.vy * dt;

    // Collide with tilted borosilicate glass vessels (transform into vessel local coords!)
    if (!isZeroG) {
      for (let vIdx = 0; vIdx < activeVessels.length; vIdx++) {
        const v = activeVessels[vIdx];
        const dx = p.x - v.x;
        const dy = p.y - v.y;
        const c = Math.cos(-v.angle);
        const s = Math.sin(-v.angle);
        let lx = c * dx - s * dy;
        let ly = s * dx + c * dy;

        const hw = v.w * 0.5 - 10;
        const hh = v.h * 0.5 - 10;

        if (Math.abs(lx) < hw + 12 && Math.abs(ly) < hh + 12) {
          // Floor of the cup
          if (ly > hh - 10 && ly < hh + 14 && Math.abs(lx) < hw) {
            ly = hh - 10;
            // Convert local normal impulse back to world velocity
            p.vy *= -0.25;
            p.vx += Math.sin(v.angle) * 240 * dt;
          }
          // Left and right glass walls (open at top ly < -hh + 8 so tilted cups pour out!)
          if (ly > -hh + 8 && ly < hh) {
            if (lx < -hw + 10 && lx > -hw - 12) {
              lx = -hw + 10;
              p.vx *= -0.4;
            } else if (lx > hw - 10 && lx < hw + 12) {
              lx = hw - 10;
              p.vx *= -0.4;
            }
          }
          const wc = Math.cos(v.angle);
          const ws = Math.sin(v.angle);
          p.x = v.x + (wc * lx - ws * ly);
          p.y = v.y + (ws * lx + wc * ly);
        }
      }
    }

    // Chamber boundaries
    if (p.x < 34) {
      p.x = 34;
      p.vx = Math.abs(p.vx) * 0.55;
    } else if (p.x > w - 34) {
      p.x = w - 34;
      p.vx = -Math.abs(p.vx) * 0.55;
    }
    if (p.y < 34) {
      p.y = 34;
      p.vy = Math.abs(p.vy) * 0.55;
    } else if (p.y > h - 38) {
      p.y = h - 38;
      p.vy *= -0.32;
      p.vx *= 0.92;
    }
  }

  // Pairwise SPH pressure repulsion + Zero-G surface tension cohesion
  const targetSpacing = isZeroG ? 24 : 21;
  for (let i = 0; i < P.length; i++) {
    const a = P[i];
    for (let j = i + 1; j < P.length; j++) {
      const b = P[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      if (Math.abs(dx) > 42 || Math.abs(dy) > 42) continue;
      const d = Math.hypot(dx, dy) || 0.01;
      if (d < targetSpacing) {
        const overlap = (targetSpacing - d) * 0.38;
        const nx = dx / d;
        const ny = dy / d;
        a.x -= nx * overlap;
        a.y -= ny * overlap;
        b.x += nx * overlap;
        b.y += ny * overlap;
        const avgVx = (a.vx + b.vx) * 0.5;
        const avgVy = (a.vy + b.vy) * 0.5;
        a.vx = a.vx * 0.82 + avgVx * 0.18;
        a.vy = a.vy * 0.82 + avgVy * 0.18;
        b.vx = b.vx * 0.82 + avgVx * 0.18;
        b.vy = b.vy * 0.82 + avgVy * 0.18;
      } else if (isZeroG && d < 42) {
        // Surface tension pull so Zero-G blobs coalesce into smooth spheres
        const pull = (42 - d) * 0.35 * dt;
        a.vx += (dx / d) * pull * 18;
        a.vy += (dy / d) * pull * 18;
        b.vx -= (dx / d) * pull * 18;
        b.vy -= (dy / d) * pull * 18;
      }
    }
  }

  // Render smooth refractive Metaball liquid + tilted borosilicate glass vessels via WebGL2 shader!
  const modeInt = state.pourMode === 'elixir' ? 1 : state.pourMode === 'zerog' ? 2 : 0;
  shaderPipe.renderFluid(ctx, w, h, timeSec, modeInt, P, activeVessels);

  // Draw top machined pouring nozzle / spout
  if (!isZeroG) {
    ctx.save();
    ctx.translate(pourSim.spoutX, 44);
    ctx.rotate(pourSim.spoutAngle);
    const spoutGrad = ctx.createLinearGradient(-28, -20, 28, 20);
    spoutGrad.addColorStop(0, '#334155');
    spoutGrad.addColorStop(0.5, '#94a3b8');
    spoutGrad.addColorStop(1, '#1e293b');
    ctx.fillStyle = spoutGrad;
    ctx.beginPath();
    ctx.roundRect(-26, -24, 52, 42, 12);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }

  // Highlight rim & tilt handle on any grabbed glass vessel
  for (const r of pourSim.pointers.values()) {
    if (r.type === 'vessel') {
      const v = pourSim.vessels[r.vesselIdx];
      ctx.save();
      ctx.translate(v.x, v.y);
      ctx.rotate(v.angle);
      ctx.strokeStyle = 'rgba(125, 211, 252, 0.75)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(-v.w * 0.5, -v.h * 0.5, v.w, v.h, 18);
      ctx.stroke();
      ctx.restore();
    }
  }

  // Bottom vortex drain indicator when open
  if (state.drainOpen) {
    ctx.save();
    const dg = ctx.createRadialGradient(w * 0.5, h - 22, 4, w * 0.5, h - 22, 95);
    dg.addColorStop(0, 'rgba(56, 189, 248, 0.9)');
    dg.addColorStop(1, 'rgba(56, 189, 248, 0)');
    ctx.fillStyle = dg;
    ctx.beginPath();
    ctx.arc(w * 0.5, h - 22, 95, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

/* ==========================================================================
   3. BEADS: PHOTOREALISTIC 3D SPHERES + MULTI-FINGER GRAB, SQUISH & ORBIT
   ========================================================================== */

const beadsSim = {
  pointers: new Map(), // pointerId -> { x, y, lastX, lastY, grabbedBead, railIdx }
  pointerActive: false,
  pointerX: 360,
  pointerY: 410,
  lastVx: 0,
  lastVy: 0,
  railTilt: 0,
  rails: [],
  gelBeads: [],
  gelDrops: [],
  orbitNodes: [],
  lastClackMs: 0,
  sphereSprites: {}
};

// Pre-render ultra-crisp raytraced-look 3D PBR sphere textures for instant 60fps shading
function buildBeadSprites() {
  const specs = [
    { key: '#38bdf8', core: '#38bdf8', deep: '#0369a1', rim: '#bae6fd', metal: false },
    { key: '#f8fafc', core: '#e2e8f0', deep: '#334155', rim: '#ffffff', metal: true },
    { key: '#f59e0b', core: '#f59e0b', deep: '#78350f', rim: '#fde68a', metal: true },
    { key: '#34d399', core: '#10b981', deep: '#064e3b', rim: '#a7f3d0', metal: false },
    { key: '#a855f7', core: '#9333ea', deep: '#3b0764', rim: '#e9d5ff', metal: false }
  ];

  specs.forEach((sp) => {
    const sz = 128;
    const c = document.createElement('canvas');
    c.width = sz;
    c.height = sz;
    const gctx = c.getContext('2d');
    const cx = sz / 2;
    const cy = sz / 2;
    const r = 56;

    // 1. Base 3D PBR body gradient
    const body = gctx.createRadialGradient(cx - 18, cy - 22, 4, cx, cy, r);
    body.addColorStop(0, sp.rim);
    body.addColorStop(0.32, sp.core);
    body.addColorStop(0.78, sp.deep);
    body.addColorStop(1, '#04070d');
    gctx.beginPath();
    gctx.arc(cx, cy, r, 0, Math.PI * 2);
    gctx.fillStyle = body;
    gctx.fill();

    // 2. Internal subsurface caustic focal glow on bottom-right hemisphere
    const caustic = gctx.createRadialGradient(cx + 18, cy + 20, 2, cx + 14, cy + 16, 26);
    caustic.addColorStop(0, sp.rim);
    caustic.addColorStop(1, 'rgba(255,255,255,0)');
    gctx.globalAlpha = sp.metal ? 0.35 : 0.55;
    gctx.beginPath();
    gctx.arc(cx, cy, r, 0, Math.PI * 2);
    gctx.fillStyle = caustic;
    gctx.fill();
    gctx.globalAlpha = 1;

    // 3. Crisp studio softbox reflection window on upper-left
    gctx.save();
    gctx.translate(cx - 19, cy - 21);
    gctx.rotate(-0.62);
    const specGrad = gctx.createLinearGradient(0, -12, 0, 12);
    specGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
    specGrad.addColorStop(1, 'rgba(255, 255, 255, 0.08)');
    gctx.fillStyle = specGrad;
    gctx.beginPath();
    gctx.ellipse(0, 0, 18, 9.5, 0, 0, Math.PI * 2);
    gctx.fill();
    gctx.restore();

    // 4. Fresnel outer rim sheen
    gctx.strokeStyle = sp.rim;
    gctx.globalAlpha = 0.42;
    gctx.lineWidth = 2.2;
    gctx.beginPath();
    gctx.arc(cx, cy, r - 1.2, 0, Math.PI * 2);
    gctx.stroke();

    beadsSim.sphereSprites[sp.key] = c;
  });
}

function initBeadsStage() {
  const canvas = document.getElementById('beadsCanvas');
  if (!canvas) return;

  buildBeadSprites();

  // 1. Abacus Track: 4 sculpted chrome rails with 6 beads per rail
  const railYs = [185, 335, 485, 635];
  const railColors = ['#38bdf8', '#f8fafc', '#f59e0b', '#34d399'];
  beadsSim.rails = railYs.map((ry, rIdx) => {
    const beads = [];
    for (let i = 0; i < 6; i++) {
      beads.push({
        x: 135 + i * 76 + (rIdx % 2) * 28,
        vx: 0,
        r: 30,
        color: railColors[(rIdx + i) % railColors.length],
        id: rIdx * 6 + i
      });
    }
    return { y: ry, beads };
  });

  // 2. Squishy Translucent Gel Bead Pit (96 Orbeez spheres)
  const gelPalette = ['#38bdf8', '#34d399', '#a855f7', '#f59e0b'];
  for (let i = 0; i < 96; i++) {
    beadsSim.gelBeads.push({
      x: 90 + (i % 10) * 58 + (Math.random() - 0.5) * 14,
      y: 170 + Math.floor(i / 10) * 58 + (Math.random() - 0.5) * 14,
      vx: 0,
      vy: 0,
      r: 25 + (i % 3) * 3.5,
      squish: 0,
      squishAngle: 0,
      color: gelPalette[i % gelPalette.length],
      id: i
    });
  }

  // 3. Magnetic Orbit Loom (18 magnetic spheres around a central core)
  for (let i = 0; i < 18; i++) {
    const ang = (i / 18) * Math.PI * 2;
    const rad = i % 2 === 0 ? 145 : 240;
    const ax = 360 + Math.cos(ang) * rad;
    const ay = 410 + Math.sin(ang) * rad;
    beadsSim.orbitNodes.push({
      x: ax,
      y: ay,
      anchorX: ax,
      anchorY: ay,
      vx: 0,
      vy: 0,
      r: i % 2 === 0 ? 22 : 18,
      color: railColors[i % railColors.length],
      id: i
    });
  }

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    audio.init();
    const pt = toCanvasPos(canvas, e.clientX, e.clientY);
    beadsSim.pointerActive = true;
    beadsSim.pointerX = pt.x;
    beadsSim.pointerY = pt.y;

    const pRec = {
      x: pt.x,
      y: pt.y,
      lastX: pt.x,
      lastY: pt.y,
      grabbedBead: null,
      grabbedOrbit: null
    };

    if (state.beadsMode === 'track') {
      // Find nearest bead on any rail to grab directly
      let bestDist = 56;
      beadsSim.rails.forEach((rail) => {
        rail.beads.forEach((b) => {
          const d = Math.hypot(pt.x - b.x, pt.y - rail.y);
          if (d < bestDist) {
            bestDist = d;
            pRec.grabbedBead = b;
          }
        });
      });
    } else if (state.beadsMode === 'gel') {
      // If user pinches with 2nd finger or double-presses directly on a gel bead, squish/pop it!
      if (beadsSim.pointers.size >= 1) {
        for (let i = 0; i < beadsSim.gelBeads.length; i++) {
          const gb = beadsSim.gelBeads[i];
          if (Math.hypot(pt.x - gb.x, pt.y - gb.y) < gb.r * 1.35) {
            gb.squish = 0.55;
            audio.playBeadCollision(0.9, 'gel', gb.id);
            for (let k = 0; k < 8; k++) {
              const a = (k / 8) * Math.PI * 2;
              beadsSim.gelDrops.push({
                x: gb.x,
                y: gb.y,
                vx: Math.cos(a) * 220,
                vy: Math.sin(a) * 220,
                r: 7,
                color: gb.color,
                life: 1.0
              });
            }
            break;
          }
        }
      }
    } else if (state.beadsMode === 'orbit') {
      let bestDist = 52;
      beadsSim.orbitNodes.forEach((n) => {
        const d = Math.hypot(pt.x - n.x, pt.y - n.y);
        if (d < bestDist) {
          bestDist = d;
          pRec.grabbedOrbit = n;
        }
      });
    }

    beadsSim.pointers.set(e.pointerId, pRec);
    recordInteraction(1);
  });

  canvas.addEventListener('pointermove', (e) => {
    const rec = beadsSim.pointers.get(e.pointerId);
    if (!rec) return;
    const pt = toCanvasPos(canvas, e.clientX, e.clientY);
    const dx = pt.x - rec.lastX;
    const dy = pt.y - rec.lastY;
    rec.lastX = rec.x;
    rec.lastY = rec.y;
    rec.x = pt.x;
    rec.y = pt.y;
    beadsSim.pointerX = pt.x;
    beadsSim.pointerY = pt.y;
    beadsSim.lastVx = dx * 32;
    beadsSim.lastVy = dy * 32;

    if (rec.grabbedBead) {
      rec.grabbedBead.vx = (pt.x - rec.grabbedBead.x) * 28;
      rec.grabbedBead.x = Math.max(85, Math.min(canvas.width - 85, pt.x));
    } else if (state.beadsMode === 'track') {
      beadsSim.railTilt = Math.max(-0.35, Math.min(0.35, (pt.x - 360) / 700));
    }

    if (rec.grabbedOrbit) {
      rec.grabbedOrbit.x = pt.x;
      rec.grabbedOrbit.y = pt.y;
      rec.grabbedOrbit.vx = dx * 28;
      rec.grabbedOrbit.vy = dy * 28;
    }
  });

  const endBeadsPointer = (e) => {
    beadsSim.pointers.delete(e.pointerId);
    if (beadsSim.pointers.size === 0) {
      beadsSim.pointerActive = false;
    }
  };
  canvas.addEventListener('pointerup', endBeadsPointer);
  canvas.addEventListener('pointercancel', endBeadsPointer);

  document.querySelectorAll('#panel-beads .quiet-pill').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#panel-beads .quiet-pill').forEach((b) =>
        b.classList.remove('active')
      );
      btn.classList.add('active');
      state.beadsMode = btn.dataset.beads || 'track';
      audio.vibrate(7);
    });
  });

  document.getElementById('shuffleBeadsBtn')?.addEventListener('click', () => {
    audio.init();
    if (state.beadsMode === 'track') {
      beadsSim.rails.forEach((r, idx) => {
        const target = r.beads[idx % 2 === 0 ? 0 : r.beads.length - 1];
        target.vx += idx % 2 === 0 ? 780 : -780;
      });
      audio.playBeadCollision(0.95, 'track', 2);
    } else if (state.beadsMode === 'gel') {
      beadsSim.gelBeads.forEach((b) => {
        b.vy -= 260 + Math.random() * 280;
        b.vx += (Math.random() - 0.5) * 340;
        b.squish = 0.28;
      });
      audio.playBeadCollision(0.85, 'gel', 4);
    } else {
      beadsSim.orbitNodes.forEach((n, i) => {
        const ang = (i / beadsSim.orbitNodes.length) * Math.PI * 2 + 0.5;
        n.vx += Math.cos(ang) * 460;
        n.vy += Math.sin(ang) * 460;
      });
      audio.playBeadCollision(0.9, 'orbit', 6);
    }
    recordInteraction(1);
  });
}

function renderBeadsFrame(dt, nowMs) {
  if (state.activeTab !== 'beads') return;
  const canvas = document.getElementById('beadsCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;

  ctx.clearRect(0, 0, w, h);

  // Studio dark anodized slate backdrop
  const bg = ctx.createRadialGradient(w * 0.5, h * 0.3, 40, w * 0.5, h * 0.5, 520);
  bg.addColorStop(0, '#162032');
  bg.addColorStop(1, '#070b12');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  const ptrList = Array.from(beadsSim.pointers.values());
  if (beadsSim.pointerActive && ptrList.length === 0) {
    ptrList.push({ x: beadsSim.pointerX, y: beadsSim.pointerY });
  }

  if (state.beadsMode === 'track') {
    beadsSim.railTilt *= Math.pow(0.15, dt);

    beadsSim.rails.forEach((rail) => {
      // 3D Cylindrical Chrome Rod with studio highlight & drop shadow
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.85)';
      ctx.shadowBlur = 16;
      ctx.shadowOffsetY = 10;
      const rodGrad = ctx.createLinearGradient(0, rail.y - 8, 0, rail.y + 8);
      rodGrad.addColorStop(0, '#475569');
      rodGrad.addColorStop(0.35, '#f8fafc');
      rodGrad.addColorStop(0.7, '#1e293b');
      rodGrad.addColorStop(1, '#0f172a');
      ctx.fillStyle = rodGrad;
      ctx.beginPath();
      ctx.roundRect(56, rail.y - 7, w - 112, 14, 7);
      ctx.fill();
      ctx.restore();

      const B = rail.beads;
      for (let i = 0; i < B.length; i++) {
        const b = B[i];
        b.vx += beadsSim.railTilt * 920 * dt;

        for (let pIdx = 0; pIdx < ptrList.length; pIdx++) {
          const ptr = ptrList[pIdx];
          if (ptr.grabbedBead === b) continue;
          const d = Math.hypot(b.x - ptr.x, rail.y - ptr.y);
          if (d < b.r + 36) {
            const push = (b.x >= ptr.x ? 1 : -1) * 620 + beadsSim.lastVx * 0.65;
            b.vx += push * dt * 10;
          }
        }

        b.vx *= Math.pow(0.24, dt);
        b.x += b.vx * dt;

        const minX = 64 + b.r;
        const maxX = w - 64 - b.r;
        if (b.x < minX) {
          b.x = minX;
          if (Math.abs(b.vx) > 45) audio.playBeadCollision(Math.min(1, Math.abs(b.vx) / 550), 'track', b.id);
          b.vx = Math.abs(b.vx) * 0.84;
        } else if (b.x > maxX) {
          b.x = maxX;
          if (Math.abs(b.vx) > 45) audio.playBeadCollision(Math.min(1, Math.abs(b.vx) / 550), 'track', b.id);
          b.vx = -Math.abs(b.vx) * 0.84;
        }
      }

      // Elastic Newton's cradle pairwise collisions
      for (let iter = 0; iter < 4; iter++) {
        for (let i = 0; i < B.length - 1; i++) {
          const b1 = B[i];
          const b2 = B[i + 1];
          const minDist = b1.r + b2.r + 2;
          if (b2.x - b1.x < minDist) {
            const overlap = minDist - (b2.x - b1.x);
            b1.x -= overlap * 0.5;
            b2.x += overlap * 0.5;
            const relV = Math.abs(b1.vx - b2.vx);
            if (relV > 38 && nowMs - beadsSim.lastClackMs > 28) {
              beadsSim.lastClackMs = nowMs;
              audio.playBeadCollision(Math.min(1, relV / 480), 'track', b1.id);
            }
            const tmp = b1.vx;
            b1.vx = b2.vx * 0.94;
            b2.vx = tmp * 0.94;
          }
        }
      }

      // Render photorealistic 3D sphere sprites + central machined bore ring
      B.forEach((b) => {
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.78)';
        ctx.shadowBlur = 18;
        ctx.shadowOffsetY = 9;
        const spr = beadsSim.sphereSprites[b.color];
        if (spr) {
          const drawSz = b.r * 2.28;
          ctx.drawImage(spr, b.x - drawSz * 0.5, rail.y - drawSz * 0.5, drawSz, drawSz);
        }
        ctx.restore();
      });
    });
  } else if (state.beadsMode === 'gel') {
    const G = beadsSim.gelBeads;
    for (let i = 0; i < G.length; i++) {
      const b = G[i];
      b.vy += 190 * dt;
      b.squish *= Math.pow(0.06, dt);

      for (let pIdx = 0; pIdx < ptrList.length; pIdx++) {
        const ptr = ptrList[pIdx];
        const dx = b.x - ptr.x;
        const dy = b.y - ptr.y;
        const d = Math.hypot(dx, dy) || 1;
        if (d < 130) {
          const push = (1 - d / 130) * 1120;
          b.vx += (dx / d) * push * dt;
          b.vy += (dy / d) * push * dt;
          b.squish = Math.max(b.squish, (1 - d / 130) * 0.36);
          b.squishAngle = Math.atan2(dy, dx);
          if (nowMs - beadsSim.lastClackMs > 60) {
            beadsSim.lastClackMs = nowMs;
            audio.playBeadCollision(0.58, 'gel', b.id);
          }
        }
      }

      b.vx *= Math.pow(0.14, dt);
      b.vy *= Math.pow(0.14, dt);
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      if (b.x < 48 + b.r) { b.x = 48 + b.r; b.vx *= -0.5; }
      if (b.x > w - 48 - b.r) { b.x = w - 48 - b.r; b.vx *= -0.5; }
      if (b.y < 58 + b.r) { b.y = 58 + b.r; b.vy *= -0.5; }
      if (b.y > h - 58 - b.r) { b.y = h - 58 - b.r; b.vy *= -0.45; }
    }

    // Soft-body hydrogel bead collisions
    for (let i = 0; i < G.length; i++) {
      const a = G[i];
      for (let j = i + 1; j < G.length; j++) {
        const b = G[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const minDist = a.r + b.r - 1.5;
        if (Math.abs(dx) > minDist || Math.abs(dy) > minDist) continue;
        const d = Math.hypot(dx, dy) || 0.01;
        if (d < minDist) {
          const overlap = (minDist - d) * 0.44;
          const nx = dx / d;
          const ny = dy / d;
          a.x -= nx * overlap;
          a.y -= ny * overlap;
          b.x += nx * overlap;
          b.y += ny * overlap;
          const sq = Math.min(0.26, overlap * 0.045);
          a.squish = Math.max(a.squish, sq);
          b.squish = Math.max(b.squish, sq);
        }
      }
    }

    G.forEach((b) => {
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.rotate(b.squishAngle || 0);
      ctx.scale(1 + b.squish, 1 - b.squish * 0.72);
      const spr = beadsSim.sphereSprites[b.color];
      if (spr) {
        const drawSz = b.r * 2.28;
        ctx.globalAlpha = 0.92;
        ctx.drawImage(spr, -drawSz * 0.5, -drawSz * 0.5, drawSz, drawSz);
      }
      ctx.restore();
    });

    // Render any popped gel micro-droplets
    for (let i = beadsSim.gelDrops.length - 1; i >= 0; i--) {
      const d = beadsSim.gelDrops[i];
      d.x += d.vx * dt;
      d.y += d.vy * dt;
      d.life -= dt * 1.4;
      if (d.life <= 0) {
        beadsSim.gelDrops.splice(i, 1);
        continue;
      }
      ctx.save();
      ctx.globalAlpha = d.life;
      ctx.fillStyle = d.color;
      ctx.beginPath();
      ctx.arc(d.x, d.y, d.r * d.life, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  } else {
    // 3. Magnetic Orbit Loom
    const O = beadsSim.orbitNodes;

    // Central heavy magnetic core
    ctx.save();
    const coreGlow = ctx.createRadialGradient(360, 410, 8, 360, 410, 95);
    coreGlow.addColorStop(0, 'rgba(56, 189, 248, 0.55)');
    coreGlow.addColorStop(1, 'rgba(56, 189, 248, 0)');
    ctx.fillStyle = coreGlow;
    ctx.beginPath();
    ctx.arc(360, 410, 95, 0, Math.PI * 2);
    ctx.fill();
    const coreSpr = beadsSim.sphereSprites['#f8fafc'];
    if (coreSpr) ctx.drawImage(coreSpr, 360 - 44, 410 - 44, 88, 88);
    ctx.restore();

    for (let i = 0; i < O.length; i++) {
      const n = O[i];
      let isGrabbed = false;
      for (const ptr of ptrList) {
        if (ptr.grabbedOrbit === n) isGrabbed = true;
      }

      if (!isGrabbed) {
        n.vx += (n.anchorX - n.x) * 26 * dt;
        n.vy += (n.anchorY - n.y) * 26 * dt;

        for (const ptr of ptrList) {
          const dx = n.x - ptr.x;
          const dy = n.y - ptr.y;
          const d = Math.hypot(dx, dy) || 1;
          if (d < 165) {
            const f = (1 - d / 165) * 980;
            n.vx -= (dx / d) * f * dt;
            n.vy -= (dy / d) * f * dt;
            if (nowMs - beadsSim.lastClackMs > 75) {
              beadsSim.lastClackMs = nowMs;
              audio.playBeadCollision(0.7, 'orbit', n.id);
            }
          }
        }

        n.vx *= Math.pow(0.08, dt);
        n.vy *= Math.pow(0.08, dt);
        n.x += n.vx * dt;
        n.y += n.vy * dt;
      }
    }

    // Glowing plasma tension filaments
    ctx.save();
    for (let i = 0; i < O.length; i++) {
      for (let j = i + 1; j < O.length; j++) {
        const d = Math.hypot(O[i].x - O[j].x, O[i].y - O[j].y);
        if (d < 230) {
          const alpha = (1 - d / 230) * 0.65;
          ctx.strokeStyle = `rgba(56, 189, 248, ${alpha.toFixed(3)})`;
          ctx.lineWidth = 1.6 + alpha * 2.8;
          ctx.beginPath();
          ctx.moveTo(O[i].x, O[i].y);
          ctx.lineTo(O[j].x, O[j].y);
          ctx.stroke();
        }
      }
    }
    ctx.restore();

    O.forEach((n) => {
      const spr = beadsSim.sphereSprites[n.color];
      if (spr) {
        const sz = n.r * 2.35;
        ctx.drawImage(spr, n.x - sz * 0.5, n.y - sz * 0.5, sz, sz);
      }
    });
  }
}

/* ==========================================================================
   4. FLUX: 3D NORMAL-MAPPED FERROFLUID SHADER & 3D SILICONE POP TRAY
   ========================================================================== */

const fluxSim = {
  pointers: new Map(), // pointerId -> { x, y, lastX, lastY, strength }
  magnetActive: false,
  magX: 360,
  magY: 410,
  targetMagX: 360,
  targetMagY: 410,
  magStrength: 0,
  satellites: [], // torn-off satellite droplets from fast finger swipes
  popIndent: new Array(25).fill(0),
  flipAngle: 0,
  flipping: false,
  tiltX: 0.24,
  tiltY: 0,
  targetTiltX: 0.24,
  targetTiltY: 0
};

function getPopDomeCoords(idx, w, h) {
  const row = Math.floor(idx / 5);
  const col = idx % 5;
  const boardSize = 540;
  const startX = (w - boardSize) / 2 + 54;
  const startY = (h - boardSize) / 2 + 54;
  const step = (boardSize - 108) / 4;
  return { x: startX + col * step, y: startY + row * step, r: 46 };
}

function initFluxStage() {
  const canvas = document.getElementById('fluxCanvas');
  if (!canvas) return;

  function testPopDomeAt(x, y) {
    for (let i = 0; i < 25; i++) {
      const d = getPopDomeCoords(i, canvas.width, canvas.height);
      if (Math.hypot(x - d.x, y - d.y) <= d.r * 1.08) {
        if (!state.poppedMap[i]) {
          state.poppedMap[i] = true;
          fluxSim.popIndent[i] = 1.0;
          audio.playPop(Math.floor(i / 5), i % 5, false);
          recordInteraction(1);
        }
        return i;
      }
    }
    return -1;
  }

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    audio.init();
    const pt = toCanvasPos(canvas, e.clientX, e.clientY);

    fluxSim.pointers.set(e.pointerId, {
      x: pt.x,
      y: pt.y,
      lastX: pt.x,
      lastY: pt.y,
      strength: 1.0
    });

    if (state.fluxMode === 'ferro') {
      fluxSim.magnetActive = true;
      fluxSim.targetMagX = pt.x;
      fluxSim.targetMagY = pt.y;
      audio.updateWorryHum(0.35);
      recordInteraction(1);
    } else {
      testPopDomeAt(pt.x, pt.y);
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    const rec = fluxSim.pointers.get(e.pointerId);
    if (!rec) return;
    const pt = toCanvasPos(canvas, e.clientX, e.clientY);
    const dx = pt.x - rec.lastX;
    const dy = pt.y - rec.lastY;
    rec.lastX = rec.x;
    rec.lastY = rec.y;
    rec.x = pt.x;
    rec.y = pt.y;

    if (state.fluxMode === 'ferro') {
      fluxSim.targetMagX = pt.x;
      fluxSim.targetMagY = pt.y;
      const spd = Math.hypot(dx, dy);
      const normDist = Math.min(1, Math.hypot(pt.x - 360, pt.y - 410) / 300);
      audio.updateWorryHum(Math.min(1, spd / 35));

      // Fast swipe tears off a satellite ferrofluid droplet that orbits back!
      if (spd > 28 && fluxSim.satellites.length < 4) {
        fluxSim.satellites.push({
          x: pt.x,
          y: pt.y,
          vx: dx * 12,
          vy: dy * 12,
          strength: 0.72,
          life: 1.0
        });
      }
    } else {
      testPopDomeAt(pt.x, pt.y);
      // Dragging also tilts the 3D Pop Tray perspective in real time!
      fluxSim.targetTiltY = Math.max(-0.42, Math.min(0.42, (pt.x - 360) / 520));
      fluxSim.targetTiltX = Math.max(-0.15, Math.min(0.55, 0.24 + (pt.y - 410) / 620));
    }
  });

  const endFlux = (e) => {
    fluxSim.pointers.delete(e.pointerId);
    if (fluxSim.pointers.size === 0) {
      fluxSim.magnetActive = false;
      fluxSim.targetTiltX = 0.24;
      fluxSim.targetTiltY = 0;
      audio.stopWorryHum();
    }
  };
  canvas.addEventListener('pointerup', endFlux);
  canvas.addEventListener('pointercancel', endFlux);

  const resetBtn = document.getElementById('resetFluxBtn');
  document.querySelectorAll('#panel-flux .quiet-pill').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#panel-flux .quiet-pill').forEach((b) =>
        b.classList.remove('active')
      );
      btn.classList.add('active');
      state.fluxMode = btn.dataset.flux || 'ferro';
      if (resetBtn) resetBtn.hidden = state.fluxMode !== 'pop3d';
      audio.stopWorryHum();
      audio.vibrate(7);
    });
  });

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      audio.init();
      fluxSim.flipping = true;
      fluxSim.flipAngle = 0;
      state.poppedMap.fill(false);
      fluxSim.popIndent.fill(0);
      audio.playBoardFlip();
      recordInteraction(1);
    });
  }
}

function renderFluxFrame(dt, nowMs) {
  if (state.activeTab !== 'flux') return;
  const canvas = document.getElementById('fluxCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const timeSec = nowMs * 0.001;

  if (state.fluxMode === 'ferro') {
    fluxSim.magX += (fluxSim.targetMagX - fluxSim.magX) * Math.min(1, dt * 14);
    fluxSim.magY += (fluxSim.targetMagY - fluxSim.magY) * Math.min(1, dt * 14);
    const targetStr = fluxSim.magnetActive || fluxSim.pointers.size > 0 ? 1 : 0;
    fluxSim.magStrength += (targetStr - fluxSim.magStrength) * Math.min(1, dt * 9);

    // Build active magnetic poles from multi-touch fingers + primary magnetic core + satellites
    const poles = [];
    for (const p of fluxSim.pointers.values()) {
      poles.push({ x: p.x, y: p.y, strength: 1.25, radius: 185 });
    }
    // Always maintain the primary ferrofluid reservoir pool so spikes & bridges gleam vividly
    poles.push({
      x: fluxSim.magX + Math.cos(timeSec * 1.1) * 18,
      y: fluxSim.magY + Math.sin(timeSec * 1.3) * 18,
      strength: poles.length > 0 ? 1.05 : 1.18,
      radius: 195
    });

    for (let i = fluxSim.satellites.length - 1; i >= 0; i--) {
      const sat = fluxSim.satellites[i];
      const dx = w * 0.5 - sat.x;
      const dy = h * 0.5 - sat.y;
      sat.vx += dx * 4.5 * dt;
      sat.vy += dy * 4.5 * dt;
      sat.vx *= 0.94;
      sat.vy *= 0.94;
      sat.x += sat.vx * dt;
      sat.y += sat.vy * dt;
      sat.life -= dt * 0.65;
      if (sat.life <= 0) {
        fluxSim.satellites.splice(i, 1);
      } else {
        poles.push({ x: sat.x, y: sat.y, strength: sat.strength * sat.life, radius: 120 });
      }
    }

    const accentRGB =
      state.theme === 'biolum'
        ? [0.2, 0.88, 0.65]
        : state.theme === 'titanium'
        ? [0.65, 0.78, 0.95]
        : [0.22, 0.74, 0.98];

    shaderPipe.renderFerrofluid(ctx, w, h, timeSec, poles, accentRGB);
  } else {
    // 3D Silicone Pop Tray rendered via Three.js PBR Studio3DEngine
    fluxSim.tiltX += (fluxSim.targetTiltX - fluxSim.tiltX) * Math.min(1, dt * 10);
    fluxSim.tiltY += (fluxSim.targetTiltY - fluxSim.tiltY) * Math.min(1, dt * 10);

    if (fluxSim.flipping) {
      fluxSim.flipAngle += dt * Math.PI * 3.2;
      if (fluxSim.flipAngle >= Math.PI) {
        fluxSim.flipAngle = 0;
        fluxSim.flipping = false;
      }
    }

    for (let i = 0; i < 25; i++) {
      const target = state.poppedMap[i] ? 1.0 : 0.0;
      fluxSim.popIndent[i] += (target - fluxSim.popIndent[i]) * Math.min(1, dt * 16);
    }

    ctx.clearRect(0, 0, w, h);
    const bg = ctx.createRadialGradient(w * 0.5, h * 0.3, 40, w * 0.5, h * 0.5, 520);
    bg.addColorStop(0, '#162032');
    bg.addColorStop(1, '#070b12');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);

    studio3D.renderPopTray3D(ctx, w, h, fluxSim, state.poppedMap);
  }
}

/* ==========================================================================
   5. SWITCH: PHOTOREALISTIC MACHINED METAL + SLINGSHOT & FLYWHEEL BRAKE
   ========================================================================== */

const orbitDishSim = {
  ballX: 260,
  ballY: 92,
  vx: 240,
  vy: 0,
  mode: 'bowl', // 'bowl' | 'slingshot' | 'bumper'
  pointerDown: false,
  px: 260,
  py: 92,
  slingDragging: false,
  slingX: 260,
  slingY: 92,
  trail: [],
  lastTickMs: 0
};

const dialSim = {
  dragging: false,
  braking: false,
  lastPointerAngle: 0,
  pointers: new Map()
};

function initSwitchStage() {
  // 5A. Magnetic Detent Slider with Spring Physics & Flick Momentum
  const sliderCanvas = document.getElementById('sliderCanvas');
  if (sliderCanvas) {
    let draggingSlider = false;
    let lastX = 0;
    const setSliderFromEvent = (e) => {
      const pt = toCanvasPos(sliderCanvas, e.clientX, e.clientY);
      const pad = 42;
      const trackW = sliderCanvas.width - pad * 2;
      const norm = Math.max(0, Math.min(1, (pt.x - pad) / trackW));
      state.sliderVel = (norm - state.sliderPos) * 18;
      state.sliderPos = norm;
      const detent = Math.round(norm * 4);
      if (detent !== state.sliderDetent) {
        state.sliderDetent = detent;
        audio.playDetentTick(detent / 4);
        recordInteraction(1);
      }
    };

    sliderCanvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      sliderCanvas.setPointerCapture(e.pointerId);
      audio.init();
      draggingSlider = true;
      lastX = e.clientX;
      setSliderFromEvent(e);
    });
    sliderCanvas.addEventListener('pointermove', (e) => {
      if (!draggingSlider) return;
      lastX = e.clientX;
      setSliderFromEvent(e);
    });
    const releaseSlider = () => {
      draggingSlider = false;
    };
    sliderCanvas.addEventListener('pointerup', releaseSlider);
    sliderCanvas.addEventListener('pointercancel', releaseSlider);
  }

  // 5B. High-Inertia Flywheel Dial with Single-Finger Spin, 2-Finger Twist & Outer-Rim Brake
  const dialCanvas = document.getElementById('dialCanvas');
  if (dialCanvas) {
    const getAngle = (e) => {
      const pt = toCanvasPos(dialCanvas, e.clientX, e.clientY);
      return Math.atan2(pt.y - dialCanvas.height / 2, pt.x - dialCanvas.width / 2) * (180 / Math.PI);
    };

    dialCanvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      dialCanvas.setPointerCapture(e.pointerId);
      audio.init();
      const pt = toCanvasPos(dialCanvas, e.clientX, e.clientY);
      const dist = Math.hypot(pt.x - dialCanvas.width / 2, pt.y - dialCanvas.height / 2);

      // Pressing on the outer caliper pad zone applies friction brake!
      if (dist > 78 && Math.abs(state.dialVelocity) > 120) {
        dialSim.braking = true;
        audio.vibrate(10);
      } else {
        dialSim.dragging = true;
        dialSim.lastPointerAngle = getAngle(e);
        state.dialVelocity = 0;
      }
    });

    dialCanvas.addEventListener('pointermove', (e) => {
      if (dialSim.braking) return;
      if (!dialSim.dragging) return;
      const cur = getAngle(e);
      let delta = cur - dialSim.lastPointerAngle;
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;
      state.dialAngle = (state.dialAngle + delta + 360) % 360;
      state.dialVelocity = delta * 52;
      dialSim.lastPointerAngle = cur;

      const detentIdx = Math.floor(state.dialAngle / 15);
      if (detentIdx !== state.dialLastDetent) {
        state.dialLastDetent = detentIdx;
        audio.playDetentTick(Math.min(1, Math.abs(state.dialVelocity) / 400));
        recordInteraction(1);
      }
    });

    const endDial = () => {
      dialSim.dragging = false;
      dialSim.braking = false;
    };
    dialCanvas.addEventListener('pointerup', endDial);
    dialCanvas.addEventListener('pointercancel', endDial);
  }

  // 5C. 4 Sculpted Mechanical Keycaps
  document.querySelectorAll('#keyGrid .mech-key').forEach((keyBtn) => {
    const profile = keyBtn.dataset.switch || 'clicky';
    keyBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      keyBtn.setPointerCapture(e.pointerId);
      audio.init();
      keyBtn.classList.add('pressed');
      audio.playKeySwitch(profile, 0, false);
      recordInteraction(1);
    });
    const releaseKey = () => {
      if (!keyBtn.classList.contains('pressed')) return;
      keyBtn.classList.remove('pressed');
      audio.playKeySwitch(profile, 0, true);
    };
    keyBtn.addEventListener('pointerup', releaseKey);
    keyBtn.addEventListener('pointercancel', releaseKey);
  });

  // 5D. Parabolic Obsidian Gravity Dish + Slingshot Ball Grab & Bumper Post
  const dishCanvas = document.getElementById('orbitDishCanvas');
  if (dishCanvas) {
    dishCanvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      dishCanvas.setPointerCapture(e.pointerId);
      audio.init();
      const pt = toCanvasPos(dishCanvas, e.clientX, e.clientY);
      orbitDishSim.pointerDown = true;
      orbitDishSim.px = pt.x;
      orbitDishSim.py = pt.y;

      // If user touches near the chrome sphere, grab it in Slingshot mode!
      if (Math.hypot(pt.x - orbitDishSim.ballX, pt.y - orbitDishSim.ballY) < 48) {
        orbitDishSim.slingDragging = true;
        orbitDishSim.slingX = pt.x;
        orbitDishSim.slingY = pt.y;
        orbitDishSim.vx = 0;
        orbitDishSim.vy = 0;
      } else {
        orbitDishSim.vx += (pt.x - orbitDishSim.ballX) * 2.2;
        orbitDishSim.vy += (pt.y - orbitDishSim.ballY) * 2.2;
      }
      recordInteraction(1);
    });
    dishCanvas.addEventListener('pointermove', (e) => {
      if (!orbitDishSim.pointerDown) return;
      const pt = toCanvasPos(dishCanvas, e.clientX, e.clientY);
      orbitDishSim.px = pt.x;
      orbitDishSim.py = pt.y;
      if (orbitDishSim.slingDragging) {
        orbitDishSim.slingX = pt.x;
        orbitDishSim.slingY = pt.y;
      }
    });
    const endDish = () => {
      if (orbitDishSim.slingDragging) {
        // Launch slingshot!
        orbitDishSim.vx = (orbitDishSim.ballX - orbitDishSim.slingX) * 9.5;
        orbitDishSim.vy = (orbitDishSim.ballY - orbitDishSim.slingY) * 9.5;
        audio.playBeadCollision(0.95, 'track', 1);
      }
      orbitDishSim.slingDragging = false;
      orbitDishSim.pointerDown = false;
    };
    dishCanvas.addEventListener('pointerup', endDish);
    dishCanvas.addEventListener('pointercancel', endDish);
  }
}

function renderSwitchFrame(dt, nowMs) {
  if (state.activeTab !== 'cube') return;

  // 1. Render Magnetic Detent Slider
  const sliderCanvas = document.getElementById('sliderCanvas');
  if (sliderCanvas) {
    const ctx = sliderCanvas.getContext('2d');
    const w = sliderCanvas.width;
    const h = sliderCanvas.height;
    ctx.clearRect(0, 0, w, h);

    const targetPos = state.sliderDetent / 4;
    state.sliderPos += (targetPos - state.sliderPos) * Math.min(1, dt * 14);

    const pad = 42;
    const trackW = w - pad * 2;
    const cy = h / 2;

    // CNC recessed dark anodized channel
    const chGrad = ctx.createLinearGradient(0, cy - 18, 0, cy + 18);
    chGrad.addColorStop(0, '#05080f');
    chGrad.addColorStop(1, '#1e293b');
    ctx.fillStyle = chGrad;
    ctx.beginPath();
    ctx.roundRect(pad - 18, cy - 18, trackW + 36, 36, 18);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 5 Magnetic Detent Wells with LED indicators
    for (let i = 0; i < 5; i++) {
      const dx = pad + (i / 4) * trackW;
      const active = i === state.sliderDetent;
      ctx.beginPath();
      ctx.arc(dx, cy, active ? 8 : 5.5, 0, Math.PI * 2);
      ctx.fillStyle = active ? '#38bdf8' : 'rgba(148, 163, 184, 0.32)';
      ctx.fill();
    }

    // Machined Titanium Thumb Carriage with knurled grooves & specular highlight
    const thumbX = pad + state.sliderPos * trackW;
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.8)';
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 6;
    const knobGrad = ctx.createLinearGradient(thumbX - 28, cy - 28, thumbX + 28, cy + 28);
    knobGrad.addColorStop(0, '#f8fafc');
    knobGrad.addColorStop(0.45, '#64748b');
    knobGrad.addColorStop(1, '#1e293b');
    ctx.fillStyle = knobGrad;
    ctx.beginPath();
    ctx.roundRect(thumbX - 28, cy - 26, 56, 52, 15);
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = 'rgba(15, 23, 42, 0.65)';
    ctx.lineWidth = 2;
    for (let k = -10; k <= 10; k += 5) {
      ctx.beginPath();
      ctx.moveTo(thumbX + k, cy - 14);
      ctx.lineTo(thumbX + k, cy + 14);
      ctx.stroke();
    }
  }

  // 2. Render High-Inertia Flywheel Dial
  const dialCanvas = document.getElementById('dialCanvas');
  if (dialCanvas) {
    if (!dialSim.dragging) {
      const damp = dialSim.braking ? 0.015 : 0.36;
      state.dialVelocity *= Math.pow(damp, dt);
      if (Math.abs(state.dialVelocity) > 1.5) {
        state.dialAngle = (state.dialAngle + state.dialVelocity * dt + 360) % 360;
        const detentIdx = Math.floor(state.dialAngle / 15);
        if (detentIdx !== state.dialLastDetent) {
          state.dialLastDetent = detentIdx;
          audio.playDetentTick(Math.min(1, Math.abs(state.dialVelocity) / 400));
        }
      }
    }

    const ctx = dialCanvas.getContext('2d');
    const w = dialCanvas.width;
    const h = dialCanvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const r = 82;
    ctx.clearRect(0, 0, w, h);

    // Outer degree ticks
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * (r + 7), cy + Math.sin(a) * (r + 7));
      ctx.lineTo(cx + Math.cos(a) * (r + 14), cy + Math.sin(a) * (r + 14));
      ctx.strokeStyle =
        i === state.dialLastDetent % 24 ? '#38bdf8' : 'rgba(148, 163, 184, 0.28)';
      ctx.lineWidth = i % 6 === 0 ? 2.5 : 1.5;
      ctx.stroke();
    }

    // CNC Brushed Metal Rotor with conic sheen
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.85)';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetY = 8;
    const dialGrad = ctx.createRadialGradient(cx - 22, cy - 24, 6, cx, cy, r);
    dialGrad.addColorStop(0, '#94a3b8');
    dialGrad.addColorStop(0.55, '#334155');
    dialGrad.addColorStop(1, '#0f172a');
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = dialGrad;
    ctx.fill();
    ctx.restore();

    // High-RPM motion blur streak ring
    const rpmNorm = Math.min(1, Math.abs(state.dialVelocity) / 900);
    if (rpmNorm > 0.08) {
      ctx.save();
      ctx.strokeStyle = dialSim.braking
        ? `rgba(251, 113, 133, ${rpmNorm * 0.85})`
        : `rgba(56, 189, 248, ${rpmNorm * 0.7})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(cx, cy, r - 12, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // Finger dimple indicator
    const rad = (state.dialAngle * Math.PI) / 180;
    const ix = cx + Math.cos(rad) * (r - 24);
    const iy = cy + Math.sin(rad) * (r - 24);
    ctx.beginPath();
    ctx.arc(ix, iy, 12, 0, Math.PI * 2);
    ctx.fillStyle = '#090d16';
    ctx.fill();
    ctx.strokeStyle = dialSim.braking ? '#fb7185' : '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.stroke();
  }

  // 3. Render Parabolic Obsidian Gravity Dish + Slingshot Ball
  const dishCanvas = document.getElementById('orbitDishCanvas');
  if (dishCanvas) {
    const ctx = dishCanvas.getContext('2d');
    const w = dishCanvas.width;
    const h = dishCanvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const rx = w * 0.45;
    const ry = h * 0.41;

    if (!orbitDishSim.slingDragging) {
      // Parabolic bowl restoring force + optional finger bumper/attractor
      const tx = orbitDishSim.pointerDown ? orbitDishSim.px : cx;
      const ty = orbitDishSim.pointerDown ? orbitDishSim.py : cy;
      orbitDishSim.vx += (tx - orbitDishSim.ballX) * (orbitDishSim.pointerDown ? 13 : 5.2) * dt;
      orbitDishSim.vy += (ty - orbitDishSim.ballY) * (orbitDishSim.pointerDown ? 13 : 5.2) * dt;

      orbitDishSim.vx *= Math.pow(0.74, dt);
      orbitDishSim.vy *= Math.pow(0.74, dt);
      orbitDishSim.ballX += orbitDishSim.vx * dt;
      orbitDishSim.ballY += orbitDishSim.vy * dt;

      // Elliptical dish boundary collision
      const nx = (orbitDishSim.ballX - cx) / (rx - 20);
      const ny = (orbitDishSim.ballY - cy) / (ry - 20);
      const normSq = nx * nx + ny * ny;
      if (normSq > 1) {
        const len = Math.sqrt(normSq);
        orbitDishSim.ballX = cx + (nx / len) * (rx - 20);
        orbitDishSim.ballY = cy + (ny / len) * (ry - 20);
        orbitDishSim.vx *= -0.78;
        orbitDishSim.vy *= -0.78;
        if (nowMs - orbitDishSim.lastTickMs > 60) {
          orbitDishSim.lastTickMs = nowMs;
          audio.playBeadCollision(0.65, 'track', 3);
        }
      }
    }

    orbitDishSim.trail.push({ x: orbitDishSim.ballX, y: orbitDishSim.ballY });
    if (orbitDishSim.trail.length > 22) orbitDishSim.trail.shift();

    ctx.clearRect(0, 0, w, h);

    // Concave polished obsidian dish
    const dishGrad = ctx.createRadialGradient(cx, cy, 12, cx, cy, rx);
    dishGrad.addColorStop(0, '#04070d');
    dishGrad.addColorStop(0.72, '#0f172a');
    dishGrad.addColorStop(1, '#334155');
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = dishGrad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Glowing velocity ribbon
    for (let i = 1; i < orbitDishSim.trail.length; i++) {
      const p0 = orbitDishSim.trail[i - 1];
      const p1 = orbitDishSim.trail[i];
      const a = (i / orbitDishSim.trail.length) * 0.55;
      ctx.beginPath();
      ctx.moveTo(p0.x, p0.y);
      ctx.lineTo(p1.x, p1.y);
      ctx.strokeStyle = `rgba(56, 189, 248, ${a.toFixed(3)})`;
      ctx.lineWidth = (i / orbitDishSim.trail.length) * 12;
      ctx.lineCap = 'round';
      ctx.stroke();
    }

    // Slingshot tension cord if user is pulling back the ball
    if (orbitDishSim.slingDragging) {
      ctx.save();
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 3;
      ctx.setLineDash([6, 5]);
      ctx.beginPath();
      ctx.moveTo(orbitDishSim.ballX, orbitDishSim.ballY);
      ctx.lineTo(orbitDishSim.slingX, orbitDishSim.slingY);
      ctx.stroke();
      ctx.restore();
    }

    // Heavy Chrome Sphere
    const spr = beadsSim.sphereSprites['#f8fafc'];
    if (spr) {
      ctx.drawImage(spr, orbitDishSim.ballX - 24, orbitDishSim.ballY - 24, 48, 48);
    }
  }
}

/* ==========================================================================
   6. BREATHE: 3D VOLUMETRIC GLASS ORB + DIRECT 3D GALAXY ROTATION
   ========================================================================== */

const BREATH_PATTERNS = {
  deepdraw: {
    phases: [
      { name: 'DEEP DRAW', sec: 5, scaleStart: 0.35, scaleEnd: 1.0, cue: 'inhale' },
      { name: 'HOLD FULL', sec: 2, scaleStart: 1.0, scaleEnd: 1.0, cue: 'hold' },
      { name: 'SLOW RELEASE', sec: 6, scaleStart: 1.0, scaleEnd: 0.35, cue: 'exhale' }
    ]
  },
  sigh: {
    phases: [
      { name: 'INHALE', sec: 2.5, scaleStart: 0.35, scaleEnd: 0.82, cue: 'inhale' },
      { name: 'TOP-OFF SIP', sec: 1.5, scaleStart: 0.82, scaleEnd: 1.0, cue: 'inhale' },
      { name: 'LONG SIGH', sec: 6, scaleStart: 1.0, scaleEnd: 0.35, cue: 'exhale' }
    ]
  },
  coherent: {
    phases: [
      { name: 'INHALE', sec: 5.5, scaleStart: 0.35, scaleEnd: 1.0, cue: 'inhale' },
      { name: 'EXHALE', sec: 5.5, scaleStart: 1.0, scaleEnd: 0.35, cue: 'exhale' }
    ]
  }
};

const breatheSim = {
  rotX: 0.25,
  rotY: 0.0,
  velRotX: 0,
  velRotY: 0,
  dragging: false,
  lastX: 0,
  lastY: 0
};

function initBreatheStage() {
  document.querySelectorAll('#panel-breathe .quiet-pill').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#panel-breathe .quiet-pill').forEach((b) =>
        b.classList.remove('active')
      );
      btn.classList.add('active');
      state.breathPattern = btn.dataset.pattern || 'deepdraw';
      state.lastBreathPhase = '';
    });
  });

  const canvas = document.getElementById('breatheCanvas');
  if (!canvas) return;

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    audio.init();
    const pt = toCanvasPos(canvas, e.clientX, e.clientY);
    breatheSim.dragging = true;
    breatheSim.lastX = pt.x;
    breatheSim.lastY = pt.y;
    state.breathHoldOverride = true;
    state.breathHoldStart = performance.now();
    audio.playBreathCue('inhale');
    recordInteraction(1);
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!breatheSim.dragging) return;
    const pt = toCanvasPos(canvas, e.clientX, e.clientY);
    const dx = pt.x - breatheSim.lastX;
    const dy = pt.y - breatheSim.lastY;
    breatheSim.lastX = pt.x;
    breatheSim.lastY = pt.y;
    breatheSim.velRotY = dx * 0.012;
    breatheSim.velRotX = dy * 0.012;
    breatheSim.rotY += breatheSim.velRotY;
    breatheSim.rotX = Math.max(-1.2, Math.min(1.2, breatheSim.rotX + breatheSim.velRotX));
  });

  const releaseHold = () => {
    breatheSim.dragging = false;
    if (state.breathHoldOverride) {
      state.breathHoldOverride = false;
      audio.playBreathCue('exhale');
    }
  };
  canvas.addEventListener('pointerup', releaseHold);
  canvas.addEventListener('pointercancel', releaseHold);
}

function renderBreatheFrame(dt, nowMs) {
  if (state.activeTab !== 'breathe') return;
  const canvas = document.getElementById('breatheCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const timeSec = nowMs * 0.001;

  if (!breatheSim.dragging) {
    breatheSim.rotY += breatheSim.velRotY;
    breatheSim.rotX = Math.max(-1.2, Math.min(1.2, breatheSim.rotX + breatheSim.velRotX));
    breatheSim.velRotX *= Math.pow(0.15, dt);
    breatheSim.velRotY *= Math.pow(0.15, dt);
  }

  let phaseName = 'DEEP DRAW';
  let scaleFactor = 0.65;
  let countdownText = '5.0s';

  if (state.breathHoldOverride) {
    const heldSec = (nowMs - state.breathHoldStart) / 1000;
    phaseName = heldSec < 5 ? 'DRAWING IN' : 'FULL CAPACITY';
    scaleFactor = Math.min(1.08, 0.38 + (heldSec / 5) * 0.7);
    countdownText = `${heldSec.toFixed(1)}s`;
  } else {
    const pat = BREATH_PATTERNS[state.breathPattern] || BREATH_PATTERNS.deepdraw;
    const totalSec = pat.phases.reduce((acc, p) => acc + p.sec, 0);
    const t = (nowMs / 1000) % totalSec;

    let acc = 0;
    let activePhase = pat.phases[0];
    let localT = 0;
    for (const p of pat.phases) {
      if (t >= acc && t < acc + p.sec) {
        activePhase = p;
        localT = (t - acc) / p.sec;
        countdownText = `${Math.ceil(p.sec - (t - acc))}s`;
        break;
      }
      acc += p.sec;
    }

    phaseName = activePhase.name;
    const smoothT = 0.5 - 0.5 * Math.cos(localT * Math.PI);
    scaleFactor =
      activePhase.scaleStart + (activePhase.scaleEnd - activePhase.scaleStart) * smoothT;

    if (state.lastBreathPhase !== activePhase.name) {
      state.lastBreathPhase = activePhase.name;
      audio.playBreathCue(activePhase.cue);
    }
  }

  ctx.clearRect(0, 0, w, h);
  const bg = ctx.createRadialGradient(w * 0.5, h * 0.5, 20, w * 0.5, h * 0.5, 420);
  bg.addColorStop(0, '#132036');
  bg.addColorStop(1, '#060a11');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);

  // Render 3D Volumetric Glass Sphere & 320-Particle Galaxy via Three.js PBR Studio3DEngine
  studio3D.renderBreathe3D(
    ctx,
    w,
    h,
    dt,
    timeSec,
    scaleFactor,
    phaseName,
    breatheSim.rotX,
    breatheSim.rotY
  );

  // Crisp center typography overlay
  ctx.save();
  ctx.fillStyle = '#f8fafc';
  ctx.font = '700 26px -apple-system, BlinkMacSystemFont, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(phaseName, w * 0.5, h * 0.5 - 6);

  ctx.fillStyle = 'rgba(226, 232, 240, 0.78)';
  ctx.font = '600 18px "SF Mono", Menlo, monospace';
  ctx.fillText(countdownText, w * 0.5, h * 0.5 + 26);
  ctx.restore();
}

/* ==========================================================================
   MASTER 60FPS STUDIO RENDER LOOP & INITIALIZATION
   ========================================================================== */

let lastFrameMs = performance.now();

function masterLoop(nowMs) {
  const dt = Math.min(0.05, Math.max(0.001, (nowMs - lastFrameMs) / 1000));
  lastFrameMs = nowMs;

  renderBalloonFrame(dt, nowMs);
  renderPourFrame(dt, nowMs);
  renderBeadsFrame(dt, nowMs);
  renderFluxFrame(dt, nowMs);
  renderSwitchFrame(dt, nowMs);
  renderBreatheFrame(dt, nowMs);

  requestAnimationFrame(masterLoop);
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch(() => {});
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadState();
  applyPreferencesUI();
  initTopBarAndSheet();
  initDockNavigation();
  initBalloonStage();
  initPourStage();
  initBeadsStage();
  initFluxStage();
  initSwitchStage();
  initBreatheStage();
  registerServiceWorker();
  requestAnimationFrame(masterLoop);
});
