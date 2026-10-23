import { TactileAudioEngine } from './audio.js';

const STORAGE_KEY = 'steadyhands_fidget_state_v3';
const audio = new TactileAudioEngine();

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
  sliderPos: 0.25, // 0..1
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
    if (Array.isArray(saved.poppedMap) && saved.poppedMap.length === 25) {
      state.poppedMap = saved.poppedMap;
    }
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
        urgesSurfed: state.urgesSurfed,
        poppedMap: state.poppedMap
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
  const r = s % 60;
  return `${m}:${r < 10 ? '0' : ''}${r}`;
}

function toCanvasPos(canvas, clientX, clientY) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((clientX - rect.left) / Math.max(1, rect.width)) * canvas.width,
    y: ((clientY - rect.top) / Math.max(1, rect.height)) * canvas.height
  };
}

/* ==========================================================================
   TOP BAR, SETTINGS SHEET & DOCK NAVIGATION
   ========================================================================== */

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

  const pitchBtn = document.getElementById('pitchModeBtn');
  if (pitchBtn) {
    pitchBtn.classList.toggle('active', state.uniformPitch);
    pitchBtn.setAttribute('aria-pressed', String(state.uniformPitch));
  }

  const soundBtn = document.getElementById('soundToggleBtn');
  const soundStatus = document.getElementById('soundStatusText');
  if (soundBtn && soundStatus) {
    soundBtn.classList.toggle('active', state.sound);
    soundBtn.setAttribute('aria-pressed', String(state.sound));
    soundStatus.textContent = state.sound ? 'On (Synthesized)' : 'Muted';
  }

  const hapticBtn = document.getElementById('hapticToggleBtn');
  const hapticStatus = document.getElementById('hapticStatusText');
  if (hapticBtn && hapticStatus) {
    hapticBtn.classList.toggle('active', state.haptics);
    hapticBtn.setAttribute('aria-pressed', String(state.haptics));
    hapticStatus.textContent = state.haptics ? 'On (Device vibrate)' : 'Off';
  }

  document.querySelectorAll('[data-theme-choice]').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.themeChoice === state.theme);
  });

  const badge = document.getElementById('ambientBadge');
  if (badge) {
    const labels = { off: '', brown: 'Brown', rain: 'Rain', hum40: '40Hz' };
    if (state.ambient !== 'off') {
      badge.textContent = labels[state.ambient] || 'Calm';
      badge.hidden = false;
    } else if (state.focusRemainingSec > 0) {
      badge.textContent = formatMMSS(state.focusRemainingSec);
      badge.hidden = false;
    } else {
      badge.hidden = true;
    }
  }

  const urgesEl = document.getElementById('urgesSurfedCount');
  if (urgesEl) urgesEl.textContent = String(state.urgesSurfed);
  const totalEl = document.getElementById('totalInteractionsCount');
  if (totalEl) totalEl.textContent = state.totalInteractions.toLocaleString();
}

function initTopBarAndSheet() {
  const urgeBtn = document.getElementById('urgeTimerBtn');
  const urgeText = document.getElementById('urgeTimerText');
  const urgeFill = document.getElementById('urgeProgressFill');

  function updateUrgeUI() {
    if (!state.urgeActive) {
      urgeBtn.classList.remove('running');
      urgeBtn.setAttribute('aria-pressed', 'false');
      urgeText.textContent = '3:00';
      urgeFill.style.width = '0%';
      return;
    }
    urgeBtn.classList.add('running');
    urgeBtn.setAttribute('aria-pressed', 'true');
    urgeText.textContent = formatMMSS(state.urgeRemainingSec);
    const pct = ((180 - state.urgeRemainingSec) / 180) * 100;
    urgeFill.style.width = `${Math.min(100, Math.max(0, pct)).toFixed(1)}%`;
  }

  urgeBtn.addEventListener('click', () => {
    audio.init();
    if (state.urgeActive) {
      clearInterval(state.urgeInterval);
      state.urgeActive = false;
      state.urgeRemainingSec = 180;
      audio.playCubeButton('silent-1');
      updateUrgeUI();
    } else {
      state.urgeActive = true;
      state.urgeRemainingSec = 180;
      audio.playBreathCue('inhale');
      updateUrgeUI();
      state.urgeInterval = setInterval(() => {
        state.urgeRemainingSec -= 1;
        if (state.urgeRemainingSec <= 0) {
          clearInterval(state.urgeInterval);
          state.urgeActive = false;
          state.urgeRemainingSec = 180;
          state.urgesSurfed += 1;
          saveState();
          audio.playBreathCue('inhale');
          applyPreferencesUI();
        }
        updateUrgeUI();
      }, 1000);
    }
  });

  const sheet = document.getElementById('settingsSheet');
  document.getElementById('drawerBtn').addEventListener('click', () => {
    sheet.hidden = false;
  });
  document.getElementById('closeSheetBtn').addEventListener('click', () => {
    sheet.hidden = true;
  });
  sheet.addEventListener('click', (e) => {
    if (e.target === sheet) sheet.hidden = true;
  });

  document.getElementById('lowStimBtn').addEventListener('click', () => {
    state.lowStim = !state.lowStim;
    applyPreferencesUI();
    saveState();
  });

  document.getElementById('pitchModeBtn').addEventListener('click', () => {
    state.uniformPitch = !state.uniformPitch;
    applyPreferencesUI();
    audio.playPop(2, 2, false);
    saveState();
  });

  document.getElementById('soundToggleBtn').addEventListener('click', () => {
    state.sound = !state.sound;
    applyPreferencesUI();
    saveState();
  });

  document.getElementById('hapticToggleBtn').addEventListener('click', () => {
    state.haptics = !state.haptics;
    applyPreferencesUI();
    if (state.haptics) audio.vibrate(12);
    saveState();
  });

  document.querySelectorAll('#ambientGroup .seg-choice').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#ambientGroup .seg-choice').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      state.ambient = btn.dataset.ambient || 'off';
      audio.setAmbientMode(state.ambient);
      applyPreferencesUI();
    });
  });

  const focusRemainingText = document.getElementById('focusRemainingText');
  document.querySelectorAll('#focusGroup .seg-choice').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#focusGroup .seg-choice').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      const sec = parseInt(btn.dataset.focus || '0', 10);
      clearInterval(state.focusInterval);
      state.focusDurationSec = sec;
      state.focusRemainingSec = sec;

      if (sec > 0) {
        focusRemainingText.textContent = formatMMSS(sec);
        state.focusInterval = setInterval(() => {
          state.focusRemainingSec -= 1;
          if (state.focusRemainingSec <= 0) {
            clearInterval(state.focusInterval);
            state.focusRemainingSec = 0;
            focusRemainingText.textContent = 'Complete';
            audio.playBreathCue('inhale');
          } else {
            focusRemainingText.textContent = formatMMSS(state.focusRemainingSec);
          }
          applyPreferencesUI();
        }, 1000);
      } else {
        focusRemainingText.textContent = 'Off';
      }
      applyPreferencesUI();
    });
  });

  document.querySelectorAll('#themeGroup .seg-choice').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.theme = btn.dataset.themeChoice || 'obsidian';
      applyPreferencesUI();
      saveState();
    });
  });

  document.getElementById('logUrgeSurfedBtn').addEventListener('click', () => {
    state.urgesSurfed += 1;
    audio.playBreathCue('inhale');
    applyPreferencesUI();
    saveState();
  });

  document.getElementById('resetDataBtn').addEventListener('click', () => {
    state.totalInteractions = 0;
    state.urgesSurfed = 0;
    state.poppedMap.fill(false);
    applyPreferencesUI();
    saveState();
  });
}

function initDockNavigation() {
  const tabs = document.querySelectorAll('.dock-tab');
  const stages = {
    balloon: document.getElementById('panel-balloon'),
    pour: document.getElementById('panel-pour'),
    beads: document.getElementById('panel-beads'),
    flux: document.getElementById('panel-flux'),
    cube: document.getElementById('panel-cube'),
    breathe: document.getElementById('panel-breathe')
  };

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const target = tab.dataset.tab;
      if (!target || !stages[target]) return;
      state.activeTab = target;

      tabs.forEach((t) => {
        const active = t.dataset.tab === target;
        t.classList.toggle('active', active);
        t.setAttribute('aria-selected', String(active));
      });

      Object.entries(stages).forEach(([key, el]) => {
        if (!el) return;
        if (key === target) {
          el.hidden = false;
          el.classList.add('active');
        } else {
          el.hidden = true;
          el.classList.remove('active');
        }
      });

      audio.stopWorryHum();
      audio.stopBalloonStrain();
      audio.stopPourStream();
      audio.vibrate(6);
    });
  });
}

/* ==========================================================================
   1. BALLOON: SOFT-BODY PRESSURIZED MEMBRANE & BURST ALCHEMY
   ========================================================================== */

const balloonSim = {
  nodes: [],
  numNodes: 32,
  cx: 360,
  cy: 430,
  baseR: 185,
  pressure: 0, // 0..1
  squeezing: false,
  pointerX: 360,
  pointerY: 430,
  bursting: false,
  respawnScale: 1,
  particles: [],
  shockwaves: [],
  internalBubbles: []
};

function initBalloonStage() {
  const canvas = document.getElementById('balloonCanvas');
  if (!canvas) return;

  for (let i = 0; i < balloonSim.numNodes; i++) {
    const a = (i / balloonSim.numNodes) * Math.PI * 2;
    balloonSim.nodes.push({ angle: a, r: balloonSim.baseR, vr: 0 });
  }
  for (let i = 0; i < 26; i++) {
    balloonSim.internalBubbles.push({
      ox: (Math.random() - 0.5) * 210,
      oy: (Math.random() - 0.5) * 240,
      r: 5 + Math.random() * 14,
      phase: Math.random() * Math.PI * 2,
      speed: 0.8 + Math.random() * 1.4
    });
  }

  function onPointer(e) {
    const pt = toCanvasPos(canvas, e.clientX, e.clientY);
    balloonSim.pointerX = pt.x;
    balloonSim.pointerY = pt.y;
  }

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    onPointer(e);
    if (balloonSim.bursting && balloonSim.respawnScale > 0.4) {
      balloonSim.bursting = false;
      balloonSim.pressure = 0;
    }
    balloonSim.squeezing = true;
    recordInteraction(1);
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!balloonSim.squeezing) return;
    onPointer(e);
  });

  const endSqueeze = () => {
    if (!balloonSim.squeezing) return;
    balloonSim.squeezing = false;
    audio.stopBalloonStrain();
  };
  canvas.addEventListener('pointerup', endSqueeze);
  canvas.addEventListener('pointercancel', endSqueeze);

  document.querySelectorAll('[data-alchemy]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-alchemy]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      state.balloonAlchemy = btn.dataset.alchemy || 'water';
      audio.vibrate(7);
    });
  });
}

function triggerBalloonBurst() {
  balloonSim.bursting = true;
  balloonSim.squeezing = false;
  balloonSim.respawnScale = 0.01;
  balloonSim.pressure = 0;
  audio.playBalloonBurst(state.balloonAlchemy);
  recordInteraction(2);

  balloonSim.shockwaves.push({ x: balloonSim.cx, y: balloonSim.cy, r: 40, alpha: 0.95 });
  balloonSim.shockwaves.push({ x: balloonSim.cx, y: balloonSim.cy, r: 15, alpha: 0.75 });

  for (let i = 0; i < 95; i++) {
    const a = Math.random() * Math.PI * 2;
    const spd = 160 + Math.random() * 540;
    balloonSim.particles.push({
      x: balloonSim.cx + Math.cos(a) * (20 + Math.random() * 90),
      y: balloonSim.cy + Math.sin(a) * (20 + Math.random() * 90),
      vx: Math.cos(a) * spd,
      vy: Math.sin(a) * spd - 90,
      r: 5 + Math.random() * 13,
      life: 1.0,
      mode: state.balloonAlchemy,
      hueShift: Math.random() * 45
    });
  }
}

function renderBalloonFrame(dt, nowMs) {
  const canvas = document.getElementById('balloonCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const palMap = {
    water: { core: '#38bdf8', deep: '#0369a1', glow: 'rgba(56, 189, 248, 0.42)', rim: '#bae6fd' },
    chrome: { core: '#e2e8f0', deep: '#334155', glow: 'rgba(148, 163, 184, 0.45)', rim: '#ffffff' },
    biolume: { core: '#a855f7', deep: '#0f766e', glow: 'rgba(45, 212, 191, 0.48)', rim: '#5eead4' }
  };
  const pal = palMap[state.balloonAlchemy] || palMap.water;

  // Update & draw burst splash particles
  for (let i = balloonSim.particles.length - 1; i >= 0; i--) {
    const p = balloonSim.particles[i];
    const grav = p.mode === 'biolume' ? 120 : 880;
    p.vy += grav * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    if (p.x < p.r + 18) { p.x = p.r + 18; p.vx *= -0.65; }
    if (p.x > w - p.r - 18) { p.x = w - p.r - 18; p.vx *= -0.65; }
    if (p.y > h - p.r - 22) {
      p.y = h - p.r - 22;
      p.vy *= p.mode === 'chrome' ? -0.72 : -0.42;
      p.vx *= 0.88;
    }

    p.life -= dt * 0.48;
    if (p.life <= 0) {
      balloonSim.particles.splice(i, 1);
      continue;
    }

    ctx.save();
    ctx.globalAlpha = Math.min(1, p.life * 1.3);
    const g = ctx.createRadialGradient(p.x - p.r * 0.3, p.y - p.r * 0.3, 1, p.x, p.y, p.r);
    if (p.mode === 'chrome') {
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.55, '#94a3b8');
      g.addColorStop(1, '#1e293b');
    } else if (p.mode === 'biolume') {
      g.addColorStop(0, '#ccfbf1');
      g.addColorStop(0.5, '#2dd4bf');
      g.addColorStop(1, 'rgba(168, 85, 247, 0)');
    } else {
      g.addColorStop(0, '#e0f2fe');
      g.addColorStop(0.6, '#38bdf8');
      g.addColorStop(1, '#0284c7');
    }
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.restore();
  }

  // Shockwave rings
  for (let i = balloonSim.shockwaves.length - 1; i >= 0; i--) {
    const sw = balloonSim.shockwaves[i];
    sw.r += 620 * dt;
    sw.alpha *= Math.pow(0.08, dt);
    if (sw.alpha < 0.02) {
      balloonSim.shockwaves.splice(i, 1);
      continue;
    }
    ctx.beginPath();
    ctx.arc(sw.x, sw.y, sw.r, 0, Math.PI * 2);
    ctx.strokeStyle = pal.rim;
    ctx.globalAlpha = sw.alpha;
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // Respawn inflation after burst
  if (balloonSim.bursting) {
    balloonSim.respawnScale += dt * 0.68;
    if (balloonSim.respawnScale >= 1) {
      balloonSim.respawnScale = 1;
      balloonSim.bursting = false;
      balloonSim.nodes.forEach((n) => {
        n.r = balloonSim.baseR;
        n.vr = 0;
      });
    }
  }

  // Squeeze pressure & soft-body membrane physics
  if (!balloonSim.bursting && balloonSim.squeezing) {
    balloonSim.pressure = Math.min(1, balloonSim.pressure + dt * 0.58);
    audio.updateBalloonStrain(balloonSim.pressure, state.balloonAlchemy);
    if (Math.random() < 0.35) audio.vibrate(6);
    if (balloonSim.pressure >= 0.995) {
      triggerBalloonBurst();
      return;
    }
  } else if (!balloonSim.bursting) {
    balloonSim.pressure = Math.max(0, balloonSim.pressure - dt * 1.35);
  }

  const scale = balloonSim.bursting ? Math.max(0.08, balloonSim.respawnScale) : 1;
  const cx = balloonSim.cx;
  const cy = balloonSim.cy + Math.sin(nowMs * 0.0025) * 6;

  // Update membrane nodes with conservation-of-volume bulge + finger indentation
  const N = balloonSim.nodes.length;
  for (let i = 0; i < N; i++) {
    const node = balloonSim.nodes[i];
    const a = node.angle;
    const tearDrop = 1 + 0.12 * Math.sin(a) - 0.06 * Math.cos(2 * a);
    let targetR = balloonSim.baseR * tearDrop * (1 + balloonSim.pressure * 0.14);

    if (balloonSim.squeezing && !balloonSim.bursting) {
      const nx = cx + Math.cos(a) * node.r;
      const ny = cy + Math.sin(a) * node.r;
      const dFinger = Math.hypot(nx - balloonSim.pointerX, ny - balloonSim.pointerY);
      if (dFinger < 175) {
        const indent = (1 - dFinger / 175) * (68 + balloonSim.pressure * 45);
        targetR -= indent;
      } else {
        targetR += balloonSim.pressure * 34;
      }
      // High-pressure membrane tremor
      if (balloonSim.pressure > 0.55) {
        targetR += Math.sin(nowMs * 0.045 + i * 1.7) * (balloonSim.pressure - 0.55) * 18;
      }
    }

    const prev = balloonSim.nodes[(i - 1 + N) % N];
    const next = balloonSim.nodes[(i + 1) % N];
    const neighborForce = (prev.r + next.r - 2 * node.r) * 18;
    const springForce = (targetR - node.r) * 32;
    node.vr += (springForce + neighborForce) * dt;
    node.vr *= Math.pow(0.08, dt);
    node.r += node.vr * dt;
  }

  // Draw top machined inflation nozzle / tie knot
  ctx.save();
  ctx.fillStyle = pal.deep;
  ctx.beginPath();
  ctx.roundRect(cx - 22 * scale, cy - balloonSim.baseR * 1.05 * scale - 24, 44 * scale, 28 * scale, 10);
  ctx.fill();
  ctx.restore();

  // Smooth closed Bezier membrane path
  const pts = balloonSim.nodes.map((n) => ({
    x: cx + Math.cos(n.angle) * n.r * scale,
    y: cy + Math.sin(n.angle) * n.r * scale
  }));

  ctx.save();
  ctx.shadowColor = pal.glow;
  ctx.shadowBlur = 36 + balloonSim.pressure * 32;
  ctx.beginPath();
  for (let i = 0; i < N; i++) {
    const p0 = pts[i];
    const p1 = pts[(i + 1) % N];
    const mx = (p0.x + p1.x) / 2;
    const my = (p0.y + p1.y) / 2;
    if (i === 0) ctx.moveTo(mx, my);
    else ctx.quadraticCurveTo(p0.x, p0.y, mx, my);
  }
  ctx.closePath();

  const bodyGrad = ctx.createRadialGradient(
    cx - 55 * scale,
    cy - 70 * scale,
    18 * scale,
    cx,
    cy,
    balloonSim.baseR * 1.25 * scale
  );
  bodyGrad.addColorStop(0, pal.rim);
  bodyGrad.addColorStop(0.38, pal.core);
  bodyGrad.addColorStop(0.88, pal.deep);
  bodyGrad.addColorStop(1, '#090d14');
  ctx.fillStyle = bodyGrad;
  ctx.fill();

  // Clip internal suspended bubbles / biolume spores inside membrane
  ctx.clip();
  balloonSim.internalBubbles.forEach((b) => {
    const bx = cx + (b.ox + Math.sin(nowMs * 0.0018 * b.speed + b.phase) * 28) * scale;
    const by = cy + (b.oy + Math.cos(nowMs * 0.0015 * b.speed + b.phase) * 28) * scale;
    ctx.beginPath();
    ctx.arc(bx, by, b.r * scale, 0, Math.PI * 2);
    ctx.fillStyle =
      state.balloonAlchemy === 'biolume'
        ? 'rgba(94, 234, 212, 0.36)'
        : state.balloonAlchemy === 'chrome'
        ? 'rgba(255, 255, 255, 0.28)'
        : 'rgba(224, 242, 254, 0.25)';
    ctx.fill();
  });

  // Glossy curved specular window highlight
  ctx.beginPath();
  ctx.ellipse(cx - 58 * scale, cy - 64 * scale, 46 * scale, 22 * scale, -0.55, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.42)';
  ctx.fill();
  ctx.restore();

  // Rim tension ring when squeezing
  if (balloonSim.pressure > 0.04) {
    ctx.beginPath();
    ctx.arc(
      cx,
      cy,
      balloonSim.baseR * 1.18,
      -Math.PI / 2,
      -Math.PI / 2 + balloonSim.pressure * Math.PI * 2
    );
    ctx.strokeStyle = balloonSim.pressure > 0.75 ? '#fb7185' : pal.rim;
    ctx.lineWidth = 4.5;
    ctx.lineCap = 'round';
    ctx.stroke();
  }
}

/* ==========================================================================
   2. POUR: REAL-TIME FLUID VESSEL CASCADE, ELIXIR MIX & ZERO-G GLOBES
   ========================================================================== */

const pourSim = {
  particles: [],
  maxParticles: 240,
  pouring: false,
  spoutX: 360,
  pointerX: 360,
  pointerY: 160,
  tiltX: 0,
  vessels: [
    { x: 360, y: 290, w: 210, h: 105 }, // Top chalice
    { x: 205, y: 515, w: 175, h: 120 }, // Left tumbler
    { x: 515, y: 515, w: 175, h: 120 }  // Right tumbler
  ]
};

function spawnPourParticle(x, y, vx = 0, vy = 160) {
  if (pourSim.particles.length >= pourSim.maxParticles) {
    pourSim.particles.shift();
  }
  const isElixirB = state.pourMode === 'elixir' && Math.random() > 0.5;
  pourSim.particles.push({
    x: x + (Math.random() - 0.5) * 14,
    y,
    vx: vx + (Math.random() - 0.5) * 45,
    vy: vy + Math.random() * 50,
    r: state.pourMode === 'zerog' ? 14 + Math.random() * 10 : 9 + Math.random() * 4,
    tone: isElixirB ? 'amber' : 'cyan'
  });
}

function initPourStage() {
  const canvas = document.getElementById('pourCanvas');
  if (!canvas) return;

  // Initial pre-filled cascade so vessels look alive immediately
  for (let i = 0; i < 85; i++) {
    const v = pourSim.vessels[i % 3];
    spawnPourParticle(
      v.x + (Math.random() - 0.5) * (v.w - 36),
      v.y - Math.random() * 65,
      (Math.random() - 0.5) * 20,
      0
    );
  }

  function updatePointer(e) {
    const pt = toCanvasPos(canvas, e.clientX, e.clientY);
    pourSim.pointerX = pt.x;
    pourSim.pointerY = pt.y;
    pourSim.spoutX = Math.max(110, Math.min(canvas.width - 110, pt.x));
    pourSim.tiltX = ((pt.x - canvas.width / 2) / (canvas.width / 2)) * 95;
  }

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    pourSim.pouring = true;
    updatePointer(e);
    recordInteraction(1);
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!pourSim.pouring) return;
    updatePointer(e);
  });

  const stopPour = () => {
    pourSim.pouring = false;
    pourSim.tiltX = 0;
    audio.stopPourStream();
  };
  canvas.addEventListener('pointerup', stopPour);
  canvas.addEventListener('pointercancel', stopPour);

  document.querySelectorAll('[data-pour]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-pour]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      state.pourMode = btn.dataset.pour || 'water';
      audio.vibrate(7);
    });
  });

  const drainBtn = document.getElementById('drainFluidBtn');
  if (drainBtn) {
    drainBtn.addEventListener('click', () => {
      state.drainOpen = true;
      state.drainTimer = 2.4;
      audio.playDrainVortex();
      recordInteraction(1);
    });
  }
}

function renderPourFrame(dt, nowMs) {
  const canvas = document.getElementById('pourCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  if (state.drainOpen) {
    state.drainTimer -= dt;
    if (state.drainTimer <= 0 || pourSim.particles.length === 0) {
      state.drainOpen = false;
    }
  }

  if (pourSim.pouring && state.activeTab === 'pour') {
    for (let k = 0; k < 3; k++) {
      spawnPourParticle(pourSim.spoutX, 68, (Math.random() - 0.5) * 35, 220);
    }
    const fillNorm = Math.min(1, pourSim.particles.length / pourSim.maxParticles);
    audio.updatePourStream(0.8, fillNorm);
  }

  // Draw top machined pouring nozzle + active stream ribbon
  ctx.save();
  ctx.fillStyle = '#334155';
  ctx.beginPath();
  ctx.roundRect(pourSim.spoutX - 28, 18, 56, 36, 12);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
  ctx.lineWidth = 2;
  ctx.stroke();

  if (pourSim.pouring) {
    const streamGrad = ctx.createLinearGradient(pourSim.spoutX, 54, pourSim.spoutX, 280);
    streamGrad.addColorStop(0, state.pourMode === 'elixir' ? '#f43f5e' : '#7dd3fc');
    streamGrad.addColorStop(1, 'rgba(56, 189, 248, 0.08)');
    ctx.fillStyle = streamGrad;
    ctx.beginPath();
    ctx.roundRect(pourSim.spoutX - 9, 52, 18, 220, 9);
    ctx.fill();
  }
  ctx.restore();

  // Physics step for fluid particles
  const N = pourSim.particles.length;
  const zeroG = state.pourMode === 'zerog';

  for (let i = N - 1; i >= 0; i--) {
    const p = pourSim.particles[i];
    if (zeroG) {
      p.vx += Math.sin(nowMs * 0.002 + i) * 18 * dt;
      p.vy += Math.cos(nowMs * 0.002 + i * 1.3) * 18 * dt;
      if (pourSim.pouring) {
        const dx = p.x - pourSim.pointerX;
        const dy = p.y - pourSim.pointerY;
        const d = Math.hypot(dx, dy) || 1;
        if (d < 160) {
          p.vx += (dx / d) * 320 * dt;
          p.vy += (dy / d) * 320 * dt;
        }
      }
      p.vx *= 0.992;
      p.vy *= 0.992;
    } else {
      p.vy += 690 * dt;
      p.vx += pourSim.tiltX * dt;
      p.vx *= 0.985;
      p.vy *= 0.985;
    }

    // Drain vortex pull
    if (state.drainOpen) {
      const dx = 360 - p.x;
      const dy = 785 - p.y;
      p.vx += dx * 4.5 * dt;
      p.vy += (dy * 5.2 + 260) * dt;
      if (p.y > 760 && Math.abs(p.x - 360) < 68) {
        pourSim.particles.splice(i, 1);
        continue;
      }
    }

    p.x += p.vx * dt;
    p.y += p.vy * dt;

    // Pairwise soft repulsion so liquid fills cups volumetrically
    for (let j = Math.max(0, i - 18); j < i; j++) {
      const q = pourSim.particles[j];
      if (!q) continue;
      const dx = p.x - q.x;
      const dy = p.y - q.y;
      const minD = (p.r + q.r) * 0.92;
      const d2 = dx * dx + dy * dy;
      if (d2 > 0.01 && d2 < minD * minD) {
        const d = Math.sqrt(d2);
        const overlap = (minD - d) * 0.48;
        const nx = dx / d;
        const ny = dy / d;
        p.x += nx * overlap;
        p.y += ny * overlap;
        q.x -= nx * overlap;
        q.y -= ny * overlap;
        const vAvgX = (p.vx + q.vx) * 0.5;
        const vAvgY = (p.vy + q.vy) * 0.5;
        p.vx = p.vx * 0.7 + vAvgX * 0.3;
        p.vy = p.vy * 0.7 + vAvgY * 0.3;
      }
    }

    // Collide with the 3 sculpted glass vessels (unless Zero-G or draining)
    if (!zeroG && !state.drainOpen) {
      for (const v of pourSim.vessels) {
        const left = v.x - v.w / 2;
        const right = v.x + v.w / 2;
        const top = v.y - v.h;
        const bot = v.y;

        if (p.y + p.r > top && p.y - p.r < bot + 14) {
          // Floor of cup
          if (p.x > left + 8 && p.x < right - 8 && p.y + p.r > bot - 8 && p.y < bot + 14 && p.vy > 0) {
            p.y = bot - 8 - p.r;
            p.vy *= -0.25;
            p.vx += (Math.random() - 0.5) * 18;
          }
          // Left wall
          if (Math.abs(p.x - left) < p.r + 6 && p.y > top + 6) {
            p.x = p.x < left ? left - p.r - 6 : left + p.r + 6;
            p.vx *= -0.45;
          }
          // Right wall
          if (Math.abs(p.x - right) < p.r + 6 && p.y > top + 6) {
            p.x = p.x < right ? right - p.r - 6 : right + p.r + 6;
            p.vx *= -0.45;
          }
        }
      }
    }

    // Chamber outer walls & floor basin
    if (p.x < p.r + 22) { p.x = p.r + 22; p.vx *= -0.55; }
    if (p.x > w - p.r - 22) { p.x = w - p.r - 22; p.vx *= -0.55; }
    if (p.y < p.r + 50) { p.y = p.r + 50; p.vy *= -0.55; }
    if (p.y > h - p.r - 26) {
      p.y = h - p.r - 26;
      p.vy *= -0.3;
    }
  }

  // Render glowing fluid metaball particles
  pourSim.particles.forEach((p) => {
    const g = ctx.createRadialGradient(p.x - p.r * 0.25, p.y - p.r * 0.25, 1, p.x, p.y, p.r * 1.45);
    if (state.pourMode === 'elixir' && p.tone === 'amber') {
      g.addColorStop(0, '#fde68a');
      g.addColorStop(0.55, '#f43f5e');
      g.addColorStop(1, 'rgba(244, 63, 94, 0)');
    } else if (state.pourMode === 'zerog') {
      g.addColorStop(0, '#ccfbf1');
      g.addColorStop(0.55, '#2dd4bf');
      g.addColorStop(1, 'rgba(45, 212, 191, 0)');
    } else {
      g.addColorStop(0, '#e0f2fe');
      g.addColorStop(0.55, '#38bdf8');
      g.addColorStop(1, 'rgba(2, 132, 199, 0)');
    }
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * 1.42, 0, Math.PI * 2);
    ctx.fillStyle = g;
    ctx.fill();
  });

  // Render refractive glass chalices & tumblers over fluid
  if (!zeroG) {
    pourSim.vessels.forEach((v) => {
      const left = v.x - v.w / 2;
      const right = v.x + v.w / 2;
      const top = v.y - v.h;
      const bot = v.y;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(left, top);
      ctx.lineTo(left + 10, bot - 16);
      ctx.quadraticCurveTo(left + 12, bot, left + 28, bot);
      ctx.lineTo(right - 28, bot);
      ctx.quadraticCurveTo(right - 12, bot, right - 10, bot - 16);
      ctx.lineTo(right, top);
      ctx.strokeStyle = 'rgba(226, 232, 240, 0.42)';
      ctx.lineWidth = 4.5;
      ctx.lineCap = 'round';
      ctx.stroke();

      // Subtle glass specular streak
      ctx.beginPath();
      ctx.moveTo(left + 14, top + 12);
      ctx.lineTo(left + 21, bot - 18);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.restore();
    });
  }

  // Vortex drain indicator at bottom center
  if (state.drainOpen) {
    ctx.save();
    ctx.translate(360, 775);
    ctx.rotate(nowMs * 0.014);
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3;
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      ctx.arc(0, 0, 18 + k * 14, k, k + Math.PI * 1.25);
      ctx.stroke();
    }
    ctx.restore();
  }
}

/* ==========================================================================
   3. BEADS: ABACUS RAILS, SQUISHY GEL PIT & MAGNETIC ORBIT LOOM
   ========================================================================== */

const beadsSim = {
  rails: [],
  gelBeads: [],
  orbitNodes: [],
  draggingRailBead: null,
  pointerActive: false,
  pointerX: 360,
  pointerY: 410,
  lastPointerX: 360,
  lastPointerY: 410,
  lastClackMs: 0
};

function initBeadsStage() {
  const canvas = document.getElementById('beadsCanvas');
  if (!canvas) return;

  // 1. 4 Abacus Rails with 6 heavy beads each
  const railYs = [175, 330, 485, 640];
  const finishes = ['#38bdf8', '#f59e0b', '#34d399', '#e2e8f0'];
  railYs.forEach((ry, rIdx) => {
    const beads = [];
    for (let i = 0; i < 6; i++) {
      beads.push({
        x: 115 + i * 64 + (i >= 3 ? 115 : 0),
        vx: 0,
        r: 27,
        color: finishes[(rIdx + i) % finishes.length],
        id: rIdx * 6 + i
      });
    }
    beadsSim.rails.push({ y: ry, beads });
  });

  // 2. 84 Squishy Hydrogel Orbeez Beads
  const gelColors = ['#38bdf8', '#2dd4bf', '#818cf8', '#f472b6', '#fbbf24'];
  for (let i = 0; i < 84; i++) {
    beadsSim.gelBeads.push({
      x: 80 + (i % 9) * 68 + (Math.random() - 0.5) * 15,
      y: 140 + Math.floor(i / 9) * 66,
      vx: 0,
      vy: 0,
      r: 26 + (i % 3) * 3,
      squish: 0,
      color: gelColors[i % gelColors.length],
      id: i
    });
  }

  // 3. 18 Magnetic Orbit Constellation Nodes
  for (let i = 0; i < 18; i++) {
    const ring = i < 6 ? 1 : 2;
    const countInRing = i < 6 ? 6 : 12;
    const idxInRing = i < 6 ? i : i - 6;
    const a = (idxInRing / countInRing) * Math.PI * 2;
    const rad = ring === 1 ? 130 : 250;
    const ax = 360 + Math.cos(a) * rad;
    const ay = 410 + Math.sin(a) * rad;
    beadsSim.orbitNodes.push({
      ax,
      ay,
      x: ax,
      y: ay,
      vx: 0,
      vy: 0,
      r: ring === 1 ? 18 : 14,
      id: i
    });
  }

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    const pt = toCanvasPos(canvas, e.clientX, e.clientY);
    beadsSim.pointerActive = true;
    beadsSim.pointerX = pt.x;
    beadsSim.pointerY = pt.y;
    beadsSim.lastPointerX = pt.x;
    beadsSim.lastPointerY = pt.y;

    if (state.beadsMode === 'track') {
      let best = null;
      let bestDist = 65;
      beadsSim.rails.forEach((rail) => {
        rail.beads.forEach((b) => {
          const d = Math.hypot(pt.x - b.x, pt.y - rail.y);
          if (d < bestDist) {
            bestDist = d;
            best = b;
          }
        });
      });
      beadsSim.draggingRailBead = best;
    }
    recordInteraction(1);
  });

  canvas.addEventListener('pointermove', (e) => {
    if (!beadsSim.pointerActive) return;
    const pt = toCanvasPos(canvas, e.clientX, e.clientY);
    const dx = pt.x - beadsSim.lastPointerX;
    beadsSim.pointerX = pt.x;
    beadsSim.pointerY = pt.y;

    if (state.beadsMode === 'track' && beadsSim.draggingRailBead) {
      beadsSim.draggingRailBead.vx = dx * 26;
      beadsSim.draggingRailBead.x = Math.max(76, Math.min(canvas.width - 76, pt.x));
    }
    beadsSim.lastPointerX = pt.x;
    beadsSim.lastPointerY = pt.y;
  });

  const endBeadTouch = () => {
    beadsSim.pointerActive = false;
    beadsSim.draggingRailBead = null;
  };
  canvas.addEventListener('pointerup', endBeadTouch);
  canvas.addEventListener('pointercancel', endBeadTouch);

  document.querySelectorAll('[data-beads]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-beads]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      state.beadsMode = btn.dataset.beads || 'track';
      audio.vibrate(7);
    });
  });
}

function renderBeadsFrame(dt, nowMs) {
  const canvas = document.getElementById('beadsCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  if (state.beadsMode === 'track') {
    const minX = 76;
    const maxX = w - 76;

    beadsSim.rails.forEach((rail) => {
      // Brushed metallic rod
      const rodGrad = ctx.createLinearGradient(0, rail.y - 6, 0, rail.y + 6);
      rodGrad.addColorStop(0, '#94a3b8');
      rodGrad.addColorStop(0.5, '#334155');
      rodGrad.addColorStop(1, '#0f172a');
      ctx.fillStyle = rodGrad;
      ctx.beginPath();
      ctx.roundRect(48, rail.y - 6, w - 96, 12, 6);
      ctx.fill();

      // Update bead positions & elastic 1D collisions
      const B = rail.beads;
      for (let i = 0; i < B.length; i++) {
        const b = B[i];
        if (b !== beadsSim.draggingRailBead) {
          b.x += b.vx * dt;
          b.vx *= Math.pow(0.18, dt);
        }
        if (b.x < minX) {
          b.x = minX;
          if (Math.abs(b.vx) > 45 && nowMs - beadsSim.lastClackMs > 35) {
            beadsSim.lastClackMs = nowMs;
            audio.playBeadCollision(Math.min(1, Math.abs(b.vx) / 480), 'track', b.id);
          }
          b.vx *= -0.75;
        }
        if (b.x > maxX) {
          b.x = maxX;
          if (Math.abs(b.vx) > 45 && nowMs - beadsSim.lastClackMs > 35) {
            beadsSim.lastClackMs = nowMs;
            audio.playBeadCollision(Math.min(1, Math.abs(b.vx) / 480), 'track', b.id);
          }
          b.vx *= -0.75;
        }
      }

      // Newton's cradle pairwise momentum transfer along rail
      for (let iter = 0; iter < 3; iter++) {
        for (let i = 0; i < B.length - 1; i++) {
          const b1 = B[i];
          const b2 = B[i + 1];
          const minDist = b1.r + b2.r + 2;
          if (b2.x - b1.x < minDist) {
            const overlap = minDist - (b2.x - b1.x);
            b1.x -= overlap * 0.5;
            b2.x += overlap * 0.5;
            const relV = Math.abs(b1.vx - b2.vx);
            if (relV > 40 && nowMs - beadsSim.lastClackMs > 32) {
              beadsSim.lastClackMs = nowMs;
              audio.playBeadCollision(Math.min(1, relV / 500), 'track', b1.id);
            }
            const tmp = b1.vx;
            b1.vx = b2.vx * 0.92;
            b2.vx = tmp * 0.92;
          }
        }
      }

      // Render sculpted glass/brass torus beads
      B.forEach((b) => {
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
        ctx.shadowBlur = 14;
        ctx.shadowOffsetY = 6;
        const g = ctx.createRadialGradient(b.x - 9, rail.y - 11, 3, b.x, rail.y, b.r);
        g.addColorStop(0, '#ffffff');
        g.addColorStop(0.35, b.color);
        g.addColorStop(1, '#0f172a');
        ctx.beginPath();
        ctx.arc(b.x, rail.y, b.r, 0, Math.PI * 2);
        ctx.fillStyle = g;
        ctx.fill();
        ctx.restore();
      });
    });
  } else if (state.beadsMode === 'gel') {
    const G = beadsSim.gelBeads;
    for (let i = 0; i < G.length; i++) {
      const b = G[i];
      b.vy += 210 * dt;
      b.squish *= Math.pow(0.05, dt);

      if (beadsSim.pointerActive) {
        const dx = b.x - beadsSim.pointerX;
        const dy = b.y - beadsSim.pointerY;
        const d = Math.hypot(dx, dy) || 1;
        if (d < 120) {
          const push = (1 - d / 120) * 950;
          b.vx += (dx / d) * push * dt;
          b.vy += (dy / d) * push * dt;
          b.squish = Math.min(0.32, (1 - d / 120) * 0.3);
          if (nowMs - beadsSim.lastClackMs > 65) {
            beadsSim.lastClackMs = nowMs;
            audio.playBeadCollision(0.55, 'gel', b.id);
          }
        }
      }

      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.vx *= 0.92;
      b.vy *= 0.92;

      if (b.x < b.r + 24) { b.x = b.r + 24; b.vx *= -0.6; }
      if (b.x > w - b.r - 24) { b.x = w - b.r - 24; b.vx *= -0.6; }
      if (b.y < b.r + 24) { b.y = b.r + 24; b.vy *= -0.6; }
      if (b.y > h - b.r - 24) { b.y = h - b.r - 24; b.vy *= -0.5; }
    }

    // Soft-body hydrogel pairwise repulsion
    for (let i = 0; i < G.length; i++) {
      for (let j = i + 1; j < G.length; j++) {
        const a = G[i];
        const b = G[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const minD = a.r + b.r;
        const d2 = dx * dx + dy * dy;
        if (d2 > 0.01 && d2 < minD * minD) {
          const d = Math.sqrt(d2);
          const pen = (minD - d) * 0.45;
          const nx = dx / d;
          const ny = dy / d;
          a.x -= nx * pen;
          a.y -= ny * pen;
          b.x += nx * pen;
          b.y += ny * pen;
        }
      }
    }

    G.forEach((b) => {
      ctx.save();
      ctx.translate(b.x, b.y);
      ctx.scale(1 + b.squish, 1 - b.squish * 0.7);
      const g = ctx.createRadialGradient(-b.r * 0.3, -b.r * 0.3, 2, 0, 0, b.r);
      g.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
      g.addColorStop(0.45, b.color);
      g.addColorStop(1, 'rgba(15, 23, 42, 0.75)');
      ctx.beginPath();
      ctx.arc(0, 0, b.r, 0, Math.PI * 2);
      ctx.fillStyle = g;
      ctx.fill();
      ctx.restore();
    });
  } else {
    // Magnetic Orbit Loom
    const nodes = beadsSim.orbitNodes;
    nodes.forEach((n) => {
      if (beadsSim.pointerActive) {
        const dx = n.x - beadsSim.pointerX;
        const dy = n.y - beadsSim.pointerY;
        const d = Math.hypot(dx, dy) || 1;
        if (d < 165) {
          const force = (1 - d / 165) * 820;
          n.vx += (dx / d) * force * dt;
          n.vy += (dy / d) * force * dt;
          if (nowMs - beadsSim.lastClackMs > 90) {
            beadsSim.lastClackMs = nowMs;
            audio.playBeadCollision(0.65, 'orbit', n.id);
          }
        }
      }
      n.vx += (n.ax - n.x) * 28 * dt;
      n.vy += (n.ay - n.y) * 28 * dt;
      n.vx *= Math.pow(0.08, dt);
      n.vy *= Math.pow(0.08, dt);
      n.x += n.vx * dt;
      n.y += n.vy * dt;
    });

    // Draw glowing harmonic field lines
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const b = nodes[j];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < 225) {
          const strain = Math.min(1, (Math.hypot(a.vx, a.vy) + Math.hypot(b.vx, b.vy)) / 240);
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = strain > 0.25 ? '#5eead4' : 'rgba(56, 189, 248, 0.34)';
          ctx.lineWidth = 1.6 + strain * 2.4;
          ctx.stroke();
        }
      }
    }

    nodes.forEach((n) => {
      const g = ctx.createRadialGradient(n.x - 5, n.y - 5, 2, n.x, n.y, n.r);
      g.addColorStop(0, '#ffffff');
      g.addColorStop(0.5, '#38bdf8');
      g.addColorStop(1, '#0f172a');
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fillStyle = g;
      ctx.fill();
    });
  }
}

/* ==========================================================================
   4. FLUX: LIVING MAGNETIC FERROFLUID & 3D ELASTIC POP MEMBRANE
   ========================================================================== */

const fluxSim = {
  magnetActive: false,
  magX: 360,
  magY: 360,
  blobX: 360,
  blobY: 360,
  blobVx: 0,
  blobVy: 0,
  pulseEnergy: 0,
  popDepths: new Array(25).fill(0),
  popWaves: [],
  draggingPop: false,
  dragTargetState: true
};

function initFluxStage() {
  const canvas = document.getElementById('fluxCanvas');
  if (!canvas) return;

  for (let i = 0; i < 25; i++) {
    fluxSim.popDepths[i] = state.poppedMap[i] ? 1 : 0;
  }

  function handlePopHit(pt, isFirstDown) {
    const pad = 76;
    const cell = (canvas.width - pad * 2) / 5;
    const col = Math.floor((pt.x - pad) / cell);
    const row = Math.floor((pt.y - pad) / cell);
    if (col < 0 || col >= 5 || row < 0 || row >= 5) return;
    const idx = row * 5 + col;
    const cx = pad + col * cell + cell / 2;
    const cy = pad + row * cell + cell / 2;
    if (Math.hypot(pt.x - cx, pt.y - cy) > cell * 0.44) return;

    if (isFirstDown) {
      fluxSim.dragTargetState = !state.poppedMap[idx];
    }
    if (state.poppedMap[idx] !== fluxSim.dragTargetState) {
      state.poppedMap[idx] = fluxSim.dragTargetState;
      audio.playPop(row, col, !fluxSim.dragTargetState);
      fluxSim.popWaves.push({ x: cx, y: cy, r: 22, alpha: 0.85 });
      recordInteraction(1);
    }
  }

  canvas.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    const pt = toCanvasPos(canvas, e.clientX, e.clientY);
    if (state.fluxMode === 'ferro') {
      fluxSim.magnetActive = true;
      fluxSim.magX = pt.x;
      fluxSim.magY = pt.y;
      audio.updateWorryHum(0.65);
      recordInteraction(1);
    } else {
      fluxSim.draggingPop = true;
      handlePopHit(pt, true);
    }
  });

  canvas.addEventListener('pointermove', (e) => {
    const pt = toCanvasPos(canvas, e.clientX, e.clientY);
    if (state.fluxMode === 'ferro' && fluxSim.magnetActive) {
      const dist = Math.hypot(pt.x - fluxSim.magX, pt.y - fluxSim.magY);
      fluxSim.magX = pt.x;
      fluxSim.magY = pt.y;
      audio.updateWorryHum(Math.min(1, 0.35 + dist / 35));
    } else if (state.fluxMode === 'pop3d' && fluxSim.draggingPop) {
      handlePopHit(pt, false);
    }
  });

  const endFluxPointer = () => {
    fluxSim.magnetActive = false;
    fluxSim.draggingPop = false;
    audio.stopWorryHum();
  };
  canvas.addEventListener('pointerup', endFluxPointer);
  canvas.addEventListener('pointercancel', endFluxPointer);

  document.querySelectorAll('[data-flux]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-flux]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      state.fluxMode = btn.dataset.flux || 'ferro';
      audio.stopWorryHum();
      audio.vibrate(7);
    });
  });

  const flipBtn = document.getElementById('flipFluxBtn');
  if (flipBtn) {
    flipBtn.addEventListener('click', () => {
      const frame = document.getElementById('fluxFrame');
      audio.playBoardFlip();
      if (state.fluxMode === 'ferro') {
        fluxSim.pulseEnergy = 1.0;
      } else if (frame) {
        frame.classList.add('flipping');
        setTimeout(() => {
          state.poppedMap.fill(false);
          saveState();
        }, 180);
        setTimeout(() => {
          frame.classList.remove('flipping');
        }, 400);
      }
      recordInteraction(1);
    });
  }
}

function renderFluxFrame(dt, nowMs) {
  const canvas = document.getElementById('fluxCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  if (state.fluxMode === 'ferro') {
    const targetX = fluxSim.magnetActive ? fluxSim.magX : w / 2;
    const targetY = fluxSim.magnetActive ? fluxSim.magY : h / 2;
    fluxSim.blobVx += (targetX - fluxSim.blobX) * 18 * dt;
    fluxSim.blobVy += (targetY - fluxSim.blobY) * 18 * dt;
    fluxSim.blobVx *= Math.pow(0.06, dt);
    fluxSim.blobVy *= Math.pow(0.06, dt);
    fluxSim.blobX += fluxSim.blobVx * dt;
    fluxSim.blobY += fluxSim.blobVy * dt;
    fluxSim.pulseEnergy *= Math.pow(0.08, dt);

    const cx = fluxSim.blobX;
    const cy = fluxSim.blobY;

    // Backlit magnetic field rings
    for (let k = 1; k <= 3; k++) {
      ctx.beginPath();
      ctx.arc(cx, cy, 130 + k * 46 + fluxSim.pulseEnergy * 45, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(56, 189, 248, ${(0.18 / k).toFixed(3)})`;
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Rosensweig spiky ferrofluid crown
    const spikes = 36;
    const baseR = 138;
    const magBoost = fluxSim.magnetActive ? 54 : 26;
    ctx.save();
    ctx.shadowColor = 'rgba(56, 189, 248, 0.45)';
    ctx.shadowBlur = 28;
    ctx.beginPath();
    for (let i = 0; i <= spikes * 2; i++) {
      const a = (i / (spikes * 2)) * Math.PI * 2;
      const isTip = i % 2 === 0;
      const wave = Math.sin(nowMs * 0.006 + i * 0.9) * 12;
      const r =
        baseR +
        (isTip ? magBoost + wave + fluxSim.pulseEnergy * 65 : -16 - wave * 0.4);
      const px = cx + Math.cos(a) * r;
      const py = cy + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();

    const ferroGrad = ctx.createRadialGradient(cx - 38, cy - 42, 12, cx, cy, baseR + 75);
    ferroGrad.addColorStop(0, '#f8fafc');
    ferroGrad.addColorStop(0.22, '#475569');
    ferroGrad.addColorStop(0.55, '#0f172a');
    ferroGrad.addColorStop(0.88, '#020617');
    ferroGrad.addColorStop(1, '#38bdf8');
    ctx.fillStyle = ferroGrad;
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = 'rgba(125, 211, 252, 0.65)';
    ctx.stroke();
    ctx.restore();

    // Inner 3D Rosensweig sub-spikes
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + nowMs * 0.0008;
      const d = 58 + Math.sin(nowMs * 0.004 + i) * 14;
      const sx = cx + Math.cos(a) * d;
      const sy = cy + Math.sin(a) * d;
      const sr = 18 + (fluxSim.magnetActive ? 7 : 0);
      const sg = ctx.createRadialGradient(sx - 5, sy - 5, 1, sx, sy, sr);
      sg.addColorStop(0, '#e2e8f0');
      sg.addColorStop(0.5, '#1e293b');
      sg.addColorStop(1, '#020617');
      ctx.beginPath();
      ctx.arc(sx, sy, sr, 0, Math.PI * 2);
      ctx.fillStyle = sg;
      ctx.fill();
    }
  } else {
    // 5x5 3D Elastic Bistable Silicone Pop Tray
    const pad = 76;
    const cell = (w - pad * 2) / 5;

    // Neighbor membrane tension lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.lineWidth = 3;
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        const idx = r * 5 + c;
        const target = state.poppedMap[idx] ? 1 : 0;
        fluxSim.popDepths[idx] += (target - fluxSim.popDepths[idx]) * Math.min(1, dt * 18);
      }
    }

    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        const idx = r * 5 + c;
        const dep = fluxSim.popDepths[idx];
        const cx = pad + c * cell + cell / 2;
        const cy = pad + r * cell + cell / 2;
        const rad = cell * 0.39;

        // Outer recessed silicone socket
        ctx.beginPath();
        ctx.arc(cx, cy, rad + 5, 0, Math.PI * 2);
        ctx.fillStyle = '#090d14';
        ctx.fill();

        // 3D Silicone Dome shading flips with bistable depression depth
        const lightOffset = (1 - dep * 2) * (rad * 0.32);
        const domeGrad = ctx.createRadialGradient(
          cx - lightOffset,
          cy - lightOffset,
          rad * 0.1,
          cx,
          cy,
          rad
        );
        if (dep < 0.5) {
          domeGrad.addColorStop(0, '#7dd3fc');
          domeGrad.addColorStop(0.55, '#0284c7');
          domeGrad.addColorStop(1, '#0c4a6e');
        } else {
          domeGrad.addColorStop(0, '#0f172a');
          domeGrad.addColorStop(0.65, '#1e293b');
          domeGrad.addColorStop(1, '#38bdf8');
        }
        ctx.beginPath();
        ctx.arc(cx, cy, rad * (1 - dep * 0.08), 0, Math.PI * 2);
        ctx.fillStyle = domeGrad;
        ctx.fill();
      }
    }

    // Pop shockwaves
    for (let i = fluxSim.popWaves.length - 1; i >= 0; i--) {
      const pw = fluxSim.popWaves[i];
      pw.r += 240 * dt;
      pw.alpha *= Math.pow(0.05, dt);
      if (pw.alpha < 0.02) {
        fluxSim.popWaves.splice(i, 1);
        continue;
      }
      ctx.beginPath();
      ctx.arc(pw.x, pw.y, pw.r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(125, 211, 252, ${pw.alpha.toFixed(3)})`;
      ctx.lineWidth = 3;
      ctx.stroke();
    }
  }
}

/* ==========================================================================
   5. SWITCH: MECHATRONIC POCKET DECK (SLIDER, FLYWHEEL DIAL, KEYS, ORBIT DISH)
   ========================================================================== */

const switchSim = {
  sliderDragging: false,
  dialDragging: false,
  lastDialAngle: 0,
  lastDialMs: 0,
  sphereX: 300,
  sphereY: 105,
  sphereVx: 240,
  sphereVy: 95,
  dishDragging: false,
  dishPointerX: 300,
  dishPointerY: 105
};

function initSwitchStage() {
  // 1. Magnetic Haptic Track Slider (#sliderCanvas)
  const sliderCanvas = document.getElementById('sliderCanvas');
  if (sliderCanvas) {
    const updateSliderFromEvent = (e) => {
      const pt = toCanvasPos(sliderCanvas, e.clientX, e.clientY);
      const norm = Math.max(0, Math.min(1, (pt.y - 45) / (sliderCanvas.height - 90)));
      state.sliderVel = (norm - state.sliderPos) * 14;
      state.sliderPos = norm;
      const det = Math.round(norm * 4);
      if (det !== state.sliderDetent) {
        state.sliderDetent = det;
        audio.playRockerSwitch(det % 2 === 0);
        recordInteraction(1);
      }
    };

    sliderCanvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      switchSim.sliderDragging = true;
      sliderCanvas.setPointerCapture(e.pointerId);
      updateSliderFromEvent(e);
    });
    sliderCanvas.addEventListener('pointermove', (e) => {
      if (switchSim.sliderDragging) updateSliderFromEvent(e);
    });
    const endSlider = () => {
      switchSim.sliderDragging = false;
    };
    sliderCanvas.addEventListener('pointerup', endSlider);
    sliderCanvas.addEventListener('pointercancel', endSlider);
  }

  // 2. Inertia Flywheel Rotary Dial (#dialWheel / #dialCanvas)
  const dialMount = document.getElementById('dialWheel');
  if (dialMount) {
    const getPointerDeg = (e) => {
      const rect = dialMount.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      return (Math.atan2(e.clientY - cy, e.clientX - cx) * 180) / Math.PI;
    };

    dialMount.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      switchSim.dialDragging = true;
      dialMount.setPointerCapture(e.pointerId);
      switchSim.lastDialAngle = getPointerDeg(e);
      switchSim.lastDialMs = performance.now();
      state.dialVelocity = 0;
    });

    dialMount.addEventListener('pointermove', (e) => {
      if (!switchSim.dialDragging) return;
      const now = performance.now();
      const cur = getPointerDeg(e);
      let delta = cur - switchSim.lastDialAngle;
      if (delta > 180) delta -= 360;
      if (delta < -180) delta += 360;
      const dt = Math.max(0.008, (now - switchSim.lastDialMs) / 1000);
      state.dialAngle = (state.dialAngle + delta + 360) % 360;
      state.dialVelocity = delta / dt;
      switchSim.lastDialAngle = cur;
      switchSim.lastDialMs = now;
    });

    const endDial = () => {
      switchSim.dialDragging = false;
    };
    dialMount.addEventListener('pointerup', endDial);
    dialMount.addEventListener('pointercancel', endDial);
  }

  // 3. 4 Sculpted Mechanical Keycaps
  const keys = document.querySelectorAll('.sculpted-key');
  keys.forEach((keyBtn) => {
    const profile = keyBtn.dataset.profile || 'thock';
    const idx = parseInt(keyBtn.dataset.idx || '0', 10);

    keyBtn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      keyBtn.classList.add('pressed');
      audio.playKeySwitch(profile, idx, false);
      recordInteraction(1);
    });

    const releaseKey = () => {
      if (keyBtn.classList.contains('pressed')) {
        keyBtn.classList.remove('pressed');
        audio.playKeySwitch(profile, idx, true);
      }
    };
    keyBtn.addEventListener('pointerup', releaseKey);
    keyBtn.addEventListener('pointerleave', releaseKey);
    keyBtn.addEventListener('pointercancel', releaseKey);
  });

  // 4. Carved Obsidian Gravity Dish + Rolling Chrome Sphere (#orbitDishCanvas)
  const dishCanvas = document.getElementById('orbitDishCanvas');
  if (dishCanvas) {
    dishCanvas.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      dishCanvas.setPointerCapture(e.pointerId);
      const pt = toCanvasPos(dishCanvas, e.clientX, e.clientY);
      switchSim.dishDragging = true;
      switchSim.dishPointerX = pt.x;
      switchSim.dishPointerY = pt.y;
      recordInteraction(1);
    });
    dishCanvas.addEventListener('pointermove', (e) => {
      if (!switchSim.dishDragging) return;
      const pt = toCanvasPos(dishCanvas, e.clientX, e.clientY);
      switchSim.dishPointerX = pt.x;
      switchSim.dishPointerY = pt.y;
    });
    const endDish = () => {
      switchSim.dishDragging = false;
      audio.stopWorryHum();
    };
    dishCanvas.addEventListener('pointerup', endDish);
    dishCanvas.addEventListener('pointercancel', endDish);
  }
}

function renderSwitchFrame(dt) {
  // 1. Magnetic Slider
  const sCanvas = document.getElementById('sliderCanvas');
  if (sCanvas) {
    const ctx = sCanvas.getContext('2d');
    const w = sCanvas.width;
    const h = sCanvas.height;
    ctx.clearRect(0, 0, w, h);

    if (!switchSim.sliderDragging) {
      const targetDetentPos = Math.round(state.sliderPos * 4) / 4;
      state.sliderVel += (targetDetentPos - state.sliderPos) * 35 * dt;
      state.sliderVel *= Math.pow(0.05, dt);
      state.sliderPos = Math.max(0, Math.min(1, state.sliderPos + state.sliderVel * dt));
    }

    // Track groove
    ctx.fillStyle = '#070a0f';
    ctx.beginPath();
    ctx.roundRect(w / 2 - 18, 32, 36, h - 64, 18);
    ctx.fill();

    // 5 Magnetic Detent LEDs
    for (let i = 0; i < 5; i++) {
      const dy = 45 + (i / 4) * (h - 90);
      const active = i === Math.round(state.sliderPos * 4);
      ctx.beginPath();
      ctx.arc(w / 2 - 44, dy, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = active ? '#38bdf8' : 'rgba(148, 163, 184, 0.25)';
      ctx.fill();
    }

    // Knurled Titanium Shuttle Knob
    const ky = 45 + state.sliderPos * (h - 90);
    const knobGrad = ctx.createLinearGradient(0, ky - 28, 0, ky + 28);
    knobGrad.addColorStop(0, '#64748b');
    knobGrad.addColorStop(0.5, '#334155');
    knobGrad.addColorStop(1, '#1e293b');
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 5;
    ctx.beginPath();
    ctx.roundRect(w / 2 - 54, ky - 26, 108, 52, 14);
    ctx.fillStyle = knobGrad;
    ctx.fill();
    ctx.restore();

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(w / 2 - 24, ky);
    ctx.lineTo(w / 2 + 24, ky);
    ctx.stroke();
  }

  // 2. Flywheel Rotary Dial
  const dCanvas = document.getElementById('dialCanvas');
  if (dCanvas) {
    if (!switchSim.dialDragging && Math.abs(state.dialVelocity) > 0.5) {
      state.dialAngle = (state.dialAngle + state.dialVelocity * dt + 360) % 360;
      state.dialVelocity *= Math.pow(0.22, dt);
    }
    const detent = Math.floor(state.dialAngle / 15);
    if (detent !== state.dialLastDetent) {
      state.dialLastDetent = detent;
      if (state.activeTab === 'cube') {
        audio.playDetentTick(Math.min(1, Math.abs(state.dialVelocity) / 400 + 0.35));
      }
    }

    const ctx = dCanvas.getContext('2d');
    const w = dCanvas.width;
    const h = dCanvas.height;
    const cx = w / 2;
    const cy = h / 2;
    const radius = w * 0.42;
    ctx.clearRect(0, 0, w, h);

    const radAngle = (state.dialAngle * Math.PI) / 180;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(radAngle);
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * (radius - 2), Math.sin(a) * (radius - 2));
      ctx.lineTo(Math.cos(a) * (radius + 5), Math.sin(a) * (radius + 5));
      ctx.lineWidth = 2.2;
      ctx.strokeStyle = i % 2 === 0 ? '#64748b' : '#1e293b';
      ctx.stroke();
    }
    ctx.restore();

    const faceGrad = ctx.createRadialGradient(cx - 25, cy - 25, 6, cx, cy, radius);
    faceGrad.addColorStop(0, '#475569');
    faceGrad.addColorStop(0.7, '#1e293b');
    faceGrad.addColorStop(1, '#0f172a');
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = faceGrad;
    ctx.fill();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(radAngle);
    ctx.beginPath();
    ctx.arc(radius * 0.56, 0, 14, 0, Math.PI * 2);
    ctx.fillStyle = '#090d14';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(radius * 0.56, 0, 6, 0, Math.PI * 2);
    ctx.fillStyle = '#38bdf8';
    ctx.fill();
    ctx.restore();
  }

  // 3. Carved Obsidian Gravity Dish & Rolling Chrome Sphere
  const oCanvas = document.getElementById('orbitDishCanvas');
  if (oCanvas) {
    const ctx = oCanvas.getContext('2d');
    const w = oCanvas.width;
    const h = oCanvas.height;
    ctx.clearRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2;
    if (switchSim.dishDragging) {
      switchSim.sphereVx += (switchSim.dishPointerX - switchSim.sphereX) * 28 * dt;
      switchSim.sphereVy += (switchSim.dishPointerY - switchSim.sphereY) * 28 * dt;
      const spd = Math.hypot(switchSim.sphereVx, switchSim.sphereVy);
      if (state.activeTab === 'cube') audio.updateWorryHum(Math.min(1, spd / 450));
    } else {
      // Dish parabolic gravity bowl pull toward center
      switchSim.sphereVx += (cx - switchSim.sphereX) * 6.5 * dt;
      switchSim.sphereVy += (cy - switchSim.sphereY) * 9.5 * dt;
    }

    switchSim.sphereVx *= Math.pow(0.55, dt);
    switchSim.sphereVy *= Math.pow(0.55, dt);
    switchSim.sphereX += switchSim.sphereVx * dt;
    switchSim.sphereY += switchSim.sphereVy * dt;

    // Elliptical rim boundary collision
    const rx = w * 0.43;
    const ry = h * 0.36;
    const nx = (switchSim.sphereX - cx) / rx;
    const ny = (switchSim.sphereY - cy) / ry;
    const normDist = Math.hypot(nx, ny);
    if (normDist > 1) {
      switchSim.sphereX = cx + (nx / normDist) * rx;
      switchSim.sphereY = cy + (ny / normDist) * ry;
      const spd = Math.hypot(switchSim.sphereVx, switchSim.sphereVy);
      if (spd > 65 && state.activeTab === 'cube') {
        audio.playRollingBounce(Math.min(1, spd / 500));
      }
      switchSim.sphereVx *= -0.72;
      switchSim.sphereVy *= -0.72;
    }

    // Draw carved obsidian contour rings
    [0.92, 0.68, 0.42].forEach((s) => {
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx * s, ry * s, 0, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.1)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    });

    // Draw rolling chrome sphere
    const sr = 24;
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
    ctx.shadowBlur = 16;
    ctx.shadowOffsetY = 6;
    const sg = ctx.createRadialGradient(
      switchSim.sphereX - 8,
      switchSim.sphereY - 8,
      2,
      switchSim.sphereX,
      switchSim.sphereY,
      sr
    );
    sg.addColorStop(0, '#ffffff');
    sg.addColorStop(0.45, '#94a3b8');
    sg.addColorStop(1, '#0f172a');
    ctx.beginPath();
    ctx.arc(switchSim.sphereX, switchSim.sphereY, sr, 0, Math.PI * 2);
    ctx.fillStyle = sg;
    ctx.fill();
    ctx.restore();
  }
}

/* ==========================================================================
   6. BREATHE: 3D REFRACTIVE GLASS & GRAVITATIONAL PARTICLE CORE
   ========================================================================== */

const BREATH_PATTERNS = {
  deepdraw: { inhale: 4, hold: 2, exhale: 6 },
  box: { inhale: 4, hold: 4, exhale: 4, holdOut: 4 },
  calm478: { inhale: 4, hold: 7, exhale: 8 }
};

const breatheParticles = [];

function initBreatheStage() {
  for (let i = 0; i < 140; i++) {
    breatheParticles.push({
      angle: Math.random() * Math.PI * 2,
      dist: 60 + Math.random() * 240,
      speed: 0.35 + Math.random() * 0.85,
      size: 1.8 + Math.random() * 3.2
    });
  }

  const orbWrap = document.getElementById('breatheOrbTrigger');
  if (orbWrap) {
    orbWrap.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      state.breathHoldOverride = true;
      state.breathHoldStart = performance.now();
      audio.playBreathCue('inhale');
      recordInteraction(1);
    });
  }

  const releaseHold = () => {
    if (!state.breathHoldOverride) return;
    state.breathHoldOverride = false;
    audio.playBreathCue('exhale');
  };
  window.addEventListener('pointerup', releaseHold);
  window.addEventListener('pointercancel', releaseHold);

  document.querySelectorAll('[data-pattern]').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('[data-pattern]').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      state.breathPattern = btn.dataset.pattern || 'deepdraw';
      state.lastBreathPhase = '';
      audio.vibrate(8);
    });
  });
}

function renderBreatheFrame(dt, nowMs) {
  const canvas = document.getElementById('breatheCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  const cx = w / 2;
  const cy = h / 2;
  ctx.clearRect(0, 0, w, h);

  const p = BREATH_PATTERNS[state.breathPattern] || BREATH_PATTERNS.deepdraw;
  const holdOut = p.holdOut || 0;
  const totalCycle = p.inhale + p.hold + p.exhale + holdOut;

  let phaseLabel = 'Deep Draw';
  let phaseProgress = 0;
  let scaleNorm = 0.5;
  let remainingSec = 0;
  let phaseKey = 'inhale';

  if (state.breathHoldOverride) {
    const heldSec = (nowMs - state.breathHoldStart) / 1000;
    phaseLabel = 'Drawing In';
    phaseProgress = Math.min(1, heldSec / 5);
    scaleNorm = 0.35 + 0.65 * (1 - Math.exp(-heldSec * 0.55));
    remainingSec = heldSec;
  } else {
    const t = (nowMs / 1000) % totalCycle;
    if (t < p.inhale) {
      phaseKey = 'inhale';
      phaseLabel = state.breathPattern === 'deepdraw' ? 'Deep Draw' : 'Breathe In';
      phaseProgress = t / p.inhale;
      scaleNorm = 0.5 - 0.5 * Math.cos(phaseProgress * Math.PI);
      remainingSec = p.inhale - t;
    } else if (t < p.inhale + p.hold) {
      phaseKey = 'hold';
      phaseLabel = 'Hold';
      const elapsed = t - p.inhale;
      phaseProgress = elapsed / p.hold;
      scaleNorm = 1.0;
      remainingSec = p.hold - elapsed;
    } else if (t < p.inhale + p.hold + p.exhale) {
      phaseKey = 'exhale';
      phaseLabel = 'Slow Exhale';
      const elapsed = t - p.inhale - p.hold;
      phaseProgress = elapsed / p.exhale;
      scaleNorm = 0.5 + 0.5 * Math.cos(phaseProgress * Math.PI);
      remainingSec = p.exhale - elapsed;
    } else {
      phaseKey = 'holdOut';
      phaseLabel = 'Rest';
      const elapsed = t - p.inhale - p.hold - p.exhale;
      phaseProgress = elapsed / holdOut;
      scaleNorm = 0.0;
      remainingSec = holdOut - elapsed;
    }

    if (state.activeTab === 'breathe' && phaseKey !== state.lastBreathPhase) {
      state.lastBreathPhase = phaseKey;
      audio.playBreathCue(phaseKey === 'inhale' ? 'inhale' : phaseKey === 'hold' ? 'hold' : 'exhale');
    }
  }

  const orbR = w * (0.21 + 0.16 * scaleNorm);

  // Gravitational vortex particles
  breatheParticles.forEach((pt) => {
    pt.angle += pt.speed * dt;
    const radialVel = phaseKey === 'inhale' || state.breathHoldOverride ? -68 : phaseKey === 'exhale' ? 62 : 0;
    pt.dist += radialVel * dt;
    if (pt.dist < 42) pt.dist = 290;
    if (pt.dist > 300) pt.dist = 55;

    const px = cx + Math.cos(pt.angle) * pt.dist;
    const py = cy + Math.sin(pt.angle) * pt.dist;
    ctx.beginPath();
    ctx.arc(px, py, pt.size, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(94, 234, 212, 0.58)';
    ctx.fill();
  });

  // Luminous Optical Glass Sphere
  const glowGrad = ctx.createRadialGradient(
    cx - orbR * 0.28,
    cy - orbR * 0.32,
    orbR * 0.08,
    cx,
    cy,
    orbR * 1.15
  );
  glowGrad.addColorStop(0, 'rgba(167, 243, 208, 0.58)');
  glowGrad.addColorStop(0.45, 'rgba(56, 189, 248, 0.32)');
  glowGrad.addColorStop(0.82, 'rgba(20, 45, 76, 0.72)');
  glowGrad.addColorStop(1, 'rgba(12, 20, 32, 0.0)');

  ctx.beginPath();
  ctx.arc(cx, cy, orbR * 1.12, 0, Math.PI * 2);
  ctx.fillStyle = glowGrad;
  ctx.fill();

  ctx.beginPath();
  ctx.arc(cx, cy, orbR, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(cx, cy, orbR + 8, -Math.PI / 2, -Math.PI / 2 + phaseProgress * Math.PI * 2);
  ctx.strokeStyle = '#5eead4';
  ctx.lineWidth = 3.5;
  ctx.lineCap = 'round';
  ctx.stroke();

  ctx.fillStyle = '#f8fafc';
  ctx.font = '600 32px -apple-system, BlinkMacSystemFont, "Inter", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(phaseLabel, cx, cy - 12);

  ctx.fillStyle = 'rgba(241, 245, 249, 0.75)';
  ctx.font = '500 22px -apple-system, BlinkMacSystemFont, "Inter", sans-serif';
  ctx.fillText(`${remainingSec.toFixed(1)}s`, cx, cy + 26);
}

/* ==========================================================================
   PWA INSTALL, SERVICE WORKER & 60FPS STUDIO LOOP
   ========================================================================== */

function initPWA() {
  let deferredPrompt = null;
  const installBtn = document.getElementById('installTopBtn');
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;

  if (!isStandalone) {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      if (installBtn) installBtn.hidden = false;
    });
  }

  if (installBtn) {
    installBtn.addEventListener('click', async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      await deferredPrompt.userChoice;
      deferredPrompt = null;
      installBtn.hidden = true;
    });
  }

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    if (installBtn) installBtn.hidden = true;
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .register('./sw.js')
      .then((reg) => {
        if (reg.waiting) showUpdateBanner(reg.waiting);
        reg.addEventListener('updatefound', () => {
          const nw = reg.installing;
          if (!nw) return;
          nw.addEventListener('statechange', () => {
            if (nw.state === 'installed' && navigator.serviceWorker.controller) {
              showUpdateBanner(nw);
            }
          });
        });
      })
      .catch(() => {});
  }
}

function showUpdateBanner(worker) {
  const banner = document.getElementById('updateBanner');
  const btn = document.getElementById('reloadSwBtn');
  if (!banner || !btn) return;
  banner.hidden = false;
  btn.onclick = () => worker.postMessage({ type: 'SKIP_WAITING' });
}

let lastFrameMs = performance.now();

function studioFrame(nowMs) {
  const dt = Math.min(0.04, Math.max(0.004, (nowMs - lastFrameMs) / 1000));
  lastFrameMs = nowMs;

  renderBalloonFrame(dt, nowMs);
  renderPourFrame(dt, nowMs);
  renderBeadsFrame(dt, nowMs);
  renderFluxFrame(dt, nowMs);
  renderSwitchFrame(dt);
  renderBreatheFrame(dt, nowMs);

  requestAnimationFrame(studioFrame);
}

window.__steadyHandsDebug = {
  state,
  balloonSim,
  pourSim,
  beadsSim,
  fluxSim,
  switchSim,
  triggerBalloonBurst
};

window.addEventListener('DOMContentLoaded', () => {
  loadState();
  initTopBarAndSheet();
  initDockNavigation();
  initBalloonStage();
  initPourStage();
  initBeadsStage();
  initFluxStage();
  initSwitchStage();
  initBreatheStage();
  applyPreferencesUI();
  initPWA();
  requestAnimationFrame(studioFrame);
});
