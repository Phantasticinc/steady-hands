/**
 * SteadyHands Next-Gen Tactile Audio & Haptics Engine
 * 100% Procedural Web Audio API + Navigator Vibration API
 * Sensory-safe design: soft dynamics limiter, zero sudden spikes, and optional 820Hz Low-Stim warm filter.
 */

export class TactileAudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.lowStimFilter = null;
    this.compressor = null;

    this.soundEnabled = true;
    this.hapticsEnabled = true;
    this.lowStimEnabled = false;
    this.uniformPitch = false;

    // Continuous sound nodes
    this.worryNodes = null;
    this.balloonNodes = null;
    this.pourNodes = null;

    // Ambient soundscape state ('off' | 'brown' | 'rain' | 'hum40')
    this.ambientMode = 'off';
    this.ambientNodes = null;

    this.noiseBuffer = null;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return;
    }
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    this.ctx = new AudioCtx();

    // Soft dynamics compressor so overlapping physics events never clip or startle
    this.compressor = this.ctx.createDynamicsCompressor();
    this.compressor.threshold.value = -14;
    this.compressor.knee.value = 18;
    this.compressor.ratio.value = 6;
    this.compressor.attack.value = 0.002;
    this.compressor.release.value = 0.12;

    // Low-Stim warm lowpass filter (16000Hz normally, warm 820Hz in Low-Stim mode)
    this.lowStimFilter = this.ctx.createBiquadFilter();
    this.lowStimFilter.type = 'lowpass';
    this.lowStimFilter.frequency.value = this.lowStimEnabled ? 820 : 16000;
    this.lowStimFilter.Q.value = 0.7;

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.soundEnabled ? (this.lowStimEnabled ? 0.55 : 0.8) : 0.0001;

    this.lowStimFilter.connect(this.compressor);
    this.compressor.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);

    this._createNoiseBuffer();

    if (this.ambientMode !== 'off') {
      this._startAmbientNodes(this.ambientMode);
    }
  }

  _createNoiseBuffer() {
    if (!this.ctx) return;
    const length = this.ctx.sampleRate * 2;
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let lastOut = 0.0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      data[i] = (lastOut + 0.08 * white) / 1.08;
      lastOut = data[i];
    }
    this.noiseBuffer = buffer;
  }

  setSoundEnabled(enabled) {
    this.soundEnabled = !!enabled;
    if (this.ctx && this.masterGain) {
      const target = this.soundEnabled ? (this.lowStimEnabled ? 0.55 : 0.8) : 0.0001;
      this.masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.02);
    }
    if (!this.soundEnabled) {
      this.stopWorryHum();
      this.stopBalloonStrain();
      this.stopPourStream();
    }
  }

  setHapticsEnabled(enabled) {
    this.hapticsEnabled = !!enabled;
  }

  setLowStimEnabled(enabled) {
    this.lowStimEnabled = !!enabled;
    if (this.ctx && this.lowStimFilter && this.masterGain) {
      const freq = this.lowStimEnabled ? 820 : 16000;
      const gain = this.soundEnabled ? (this.lowStimEnabled ? 0.55 : 0.8) : 0.0001;
      this.lowStimFilter.frequency.setTargetAtTime(freq, this.ctx.currentTime, 0.04);
      this.masterGain.gain.setTargetAtTime(gain, this.ctx.currentTime, 0.04);
    }
  }

  setUniformPitch(enabled) {
    this.uniformPitch = !!enabled;
  }

  vibrate(pattern) {
    if (!this.hapticsEnabled) return;
    try {
      if (navigator.vibrate) {
        navigator.vibrate(pattern);
      }
    } catch (_) {}
  }

  /**
   * 1. BALLOON SQUEEZE STRAIN & BURST ALCHEMY
   */
  playBalloonStretch(pressureNorm = 0.3, alchemy = 'water') {
    this.updateBalloonStrain(pressureNorm, alchemy);
  }

  updateBalloonStrain(pressureNorm = 0.3, alchemy = 'water') {
    if (!this.soundEnabled) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const p = Math.max(0, Math.min(1, pressureNorm));

    if (!this.balloonNodes) {
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc1.type = alchemy === 'chrome' ? 'sawtooth' : 'sine';
      osc2.type = 'triangle';
      osc1.frequency.value = 115;
      osc2.frequency.value = 172;

      filter.type = 'bandpass';
      filter.frequency.value = 260;
      filter.Q.value = 2.4;

      gain.gain.setValueAtTime(0.001, now);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(this.lowStimFilter);

      osc1.start(now);
      osc2.start(now);
      this.balloonNodes = { osc1, osc2, filter, gain };
    }

    const baseF = alchemy === 'biolume' ? 148 : alchemy === 'chrome' ? 130 : 110;
    this.balloonNodes.osc1.frequency.setTargetAtTime(baseF + p * 190, now, 0.04);
    this.balloonNodes.osc2.frequency.setTargetAtTime((baseF + p * 190) * 1.498, now, 0.04);
    this.balloonNodes.filter.frequency.setTargetAtTime(220 + p * 540, now, 0.04);
    this.balloonNodes.gain.gain.setTargetAtTime(0.04 + p * 0.14, now, 0.04);
  }

  stopBalloonStrain() {
    if (!this.balloonNodes || !this.ctx) return;
    const nodes = this.balloonNodes;
    this.balloonNodes = null;
    try {
      nodes.gain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.06);
      setTimeout(() => {
        try {
          nodes.osc1.stop();
          nodes.osc2.stop();
          nodes.gain.disconnect();
        } catch (_) {}
      }, 180);
    } catch (_) {}
  }

  playBalloonBurst(alchemy = 'water') {
    this.stopBalloonStrain();
    this.vibrate([22, 30, 16, 25, 10]);
    if (!this.soundEnabled) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;

    // 1. Membrane rupture snap + low hydrostatic thump
    const sub = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(220, now);
    sub.frequency.exponentialRampToValueAtTime(48, now + 0.22);
    subGain.gain.setValueAtTime(0.42, now);
    subGain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);
    sub.connect(subGain);
    subGain.connect(this.lowStimFilter);
    sub.start(now);
    sub.stop(now + 0.26);

    // 2. Alchemy-specific scatter cascade
    if (alchemy === 'water' && this.noiseBuffer) {
      // Wet hydro splash + 5 droplet plops
      const splash = this.ctx.createBufferSource();
      splash.buffer = this.noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1100, now);
      filter.frequency.exponentialRampToValueAtTime(380, now + 0.35);
      filter.Q.value = 1.4;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.34, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.38);

      splash.connect(filter);
      filter.connect(gain);
      gain.connect(this.lowStimFilter);
      splash.start(now, 0, 0.4);

      [0.05, 0.11, 0.16, 0.23, 0.3].forEach((delay, idx) => {
        const drop = this.ctx.createOscillator();
        const dGain = this.ctx.createGain();
        const f = 380 + idx * 95;
        drop.type = 'sine';
        drop.frequency.setValueAtTime(f * 0.7, now + delay);
        drop.frequency.exponentialRampToValueAtTime(f * 1.45, now + delay + 0.045);
        dGain.gain.setValueAtTime(0.12, now + delay);
        dGain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.055);
        drop.connect(dGain);
        dGain.connect(this.lowStimFilter);
        drop.start(now + delay);
        drop.stop(now + delay + 0.06);
      });
    } else if (alchemy === 'chrome') {
      // Shimmering liquid-mercury metallic chimes
      [523.25, 659.25, 783.99, 1046.5].forEach((f, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(f, now + idx * 0.04);
        osc.frequency.exponentialRampToValueAtTime(f * 0.98, now + idx * 0.04 + 0.35);
        gain.gain.setValueAtTime(0.15, now + idx * 0.04);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.04 + 0.38);
        osc.connect(gain);
        gain.connect(this.lowStimFilter);
        osc.start(now + idx * 0.04);
        osc.stop(now + idx * 0.04 + 0.4);
      });
    } else {
      // Biolume harmonic aurora bloom
      [220, 277.18, 329.63, 440].forEach((f, idx) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(f, now + idx * 0.03);
        gain.gain.setValueAtTime(0.001, now + idx * 0.03);
        gain.gain.linearRampToValueAtTime(0.14, now + idx * 0.03 + 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.03 + 0.55);
        osc.connect(gain);
        gain.connect(this.lowStimFilter);
        osc.start(now + idx * 0.03);
        osc.stop(now + idx * 0.03 + 0.58);
      });
    }
  }

  /**
   * 2. POURING FLUID STREAM & DRAIN VORTEX
   * Uses Helmholtz vessel-filling resonance: pitch rises naturally as cup fills!
   */
  updatePourStream(flowRateNorm = 0.7, fillLevelNorm = 0.3) {
    if (!this.soundEnabled) return;
    this.init();
    if (!this.ctx || !this.noiseBuffer) return;

    const now = this.ctx.currentTime;
    const fill = Math.max(0, Math.min(1, fillLevelNorm));

    if (!this.pourNodes) {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      src.loop = true;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.value = 480;
      filter.Q.value = 3.2;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.001, now);

      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.lowStimFilter);
      src.start(now);

      this.pourNodes = { src, filter, gain, lastBubbleMs: 0 };
    }

    const resonantFreq = this.uniformPitch ? 520 : (360 + fill * 580);
    this.pourNodes.filter.frequency.setTargetAtTime(resonantFreq, now, 0.05);
    this.pourNodes.gain.gain.setTargetAtTime(0.08 + flowRateNorm * 0.12, now, 0.04);

    // Occasional water-droplet bubble plop whose pitch rises with vessel fill level
    const nowMs = performance.now();
    if (nowMs - this.pourNodes.lastBubbleMs > 95) {
      this.pourNodes.lastBubbleMs = nowMs;
      const drop = this.ctx.createOscillator();
      const dGain = this.ctx.createGain();
      const baseF = this.uniformPitch ? 440 : (290 + fill * 460 + (Math.random() - 0.5) * 60);
      drop.type = 'sine';
      drop.frequency.setValueAtTime(baseF * 0.78, now);
      drop.frequency.exponentialRampToValueAtTime(baseF * 1.38, now + 0.038);
      dGain.gain.setValueAtTime(0.065, now);
      dGain.gain.exponentialRampToValueAtTime(0.0008, now + 0.042);
      drop.connect(dGain);
      dGain.connect(this.lowStimFilter);
      drop.start(now);
      drop.stop(now + 0.045);
    }
  }

  stopPourStream() {
    if (!this.pourNodes || !this.ctx) return;
    const nodes = this.pourNodes;
    this.pourNodes = null;
    try {
      nodes.gain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.06);
      setTimeout(() => {
        try {
          nodes.src.stop();
          nodes.gain.disconnect();
        } catch (_) {}
      }, 150);
    } catch (_) {}
  }

  playDrainVortex() {
    this.vibrate([12, 30, 12, 30, 16]);
    if (!this.soundEnabled) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    [0, 0.09, 0.19, 0.3].forEach((offset, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const f = 320 - idx * 45;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f * 1.25, now + offset);
      osc.frequency.exponentialRampToValueAtTime(f * 0.55, now + offset + 0.075);
      gain.gain.setValueAtTime(0.18, now + offset);
      gain.gain.exponentialRampToValueAtTime(0.001, now + offset + 0.085);
      osc.connect(gain);
      gain.connect(this.lowStimFilter);
      osc.start(now + offset);
      osc.stop(now + offset + 0.09);
    });
  }

  /**
   * 3. BEAD COLLISION & MAGNETIC LOOM PLUCK
   */
  playBeadCollision(intensity = 0.6, mode = 'track', index = 0) {
    const v = Math.max(0.1, Math.min(1, intensity));
    if (v > 0.35) this.vibrate(Math.round(4 + v * 6));
    if (!this.soundEnabled) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    if (mode === 'track') {
      // Blown-glass & brass abacus bead clack
      const f = this.uniformPitch ? 1120 : (880 + (index % 7) * 95);
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, now);
      osc.frequency.exponentialRampToValueAtTime(f * 0.36, now + 0.024);
      gain.gain.setValueAtTime(0.24 * v, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.028);
    } else if (mode === 'gel') {
      // Wet squishy Orbeez hydrogel pop
      const f = this.uniformPitch ? 360 : (280 + (index % 8) * 38);
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f * 0.68, now);
      osc.frequency.exponentialRampToValueAtTime(f * 1.45, now + 0.036);
      gain.gain.setValueAtTime(0.18 * v, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.042);
    } else {
      // Magnetic orbit harp harmonic pluck
      const pentatonic = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33];
      const f = this.uniformPitch ? 392.0 : pentatonic[index % pentatonic.length];
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now);
      gain.gain.setValueAtTime(0.15 * v, now);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.24);
      osc.connect(gain);
      gain.connect(this.lowStimFilter);
      osc.start(now);
      osc.stop(now + 0.26);
      return;
    }

    osc.connect(gain);
    gain.connect(this.lowStimFilter);
    osc.start(now);
    osc.stop(now + 0.045);
  }

  /**
   * 4. POP IT SILICONE BUBBLE POP & BOARD FLIP
   */
  playPop(row = 0, col = 0, isReverse = false) {
    this.vibrate(isReverse ? 8 : 13);
    if (!this.soundEnabled) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const subOsc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    const filter = this.ctx.createBiquadFilter();

    let baseFreq = 260;
    if (!this.uniformPitch) {
      const scaleOffsets = [0, 2, 4, 7, 9, 12];
      const semitones = scaleOffsets[col % 6] + (5 - (row % 6)) * 1.5;
      baseFreq = 220 * Math.pow(2, semitones / 12);
    }

    osc.type = 'sine';
    subOsc.type = 'triangle';

    if (isReverse) {
      osc.frequency.setValueAtTime(baseFreq * 1.35, now);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.65, now + 0.075);
      subOsc.frequency.setValueAtTime(baseFreq * 0.7, now);
      subOsc.frequency.exponentialRampToValueAtTime(baseFreq * 0.4, now + 0.075);
    } else {
      osc.frequency.setValueAtTime(baseFreq * 0.58, now);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.65, now + 0.032);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.15, now + 0.085);

      subOsc.frequency.setValueAtTime(baseFreq * 0.42, now);
      subOsc.frequency.exponentialRampToValueAtTime(baseFreq * 0.85, now + 0.045);
    }

    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(baseFreq * 1.5, now);
    filter.Q.value = 1.8;

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.36, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.095);

    const subGain = this.ctx.createGain();
    subGain.gain.value = 0.22;

    osc.connect(filter);
    subOsc.connect(subGain);
    subGain.connect(filter);
    filter.connect(gain);
    gain.connect(this.lowStimFilter);

    osc.start(now);
    subOsc.start(now);
    osc.stop(now + 0.1);
    subOsc.stop(now + 0.1);
  }

  playBoardFlip() {
    this.vibrate([15, 30, 20]);
    if (!this.soundEnabled) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(95, now + 0.16);
    osc.frequency.exponentialRampToValueAtTime(190, now + 0.28);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.25, now + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

    osc.connect(gain);
    gain.connect(this.lowStimFilter);
    osc.start(now);
    osc.stop(now + 0.31);
  }

  /**
   * 5. MECHATRONIC SWITCH & ROLLING SPHERE SOUNDS
   */
  playRockerSwitch(isOn) {
    this.vibrate(isOn ? [18, 18, 10] : [14, 15, 8]);
    if (!this.soundEnabled) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    if (this.noiseBuffer) {
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const nFilter = this.ctx.createBiquadFilter();
      nFilter.type = 'bandpass';
      nFilter.frequency.value = isOn ? 2400 : 1850;
      nFilter.Q.value = 3.2;

      const nGain = this.ctx.createGain();
      nGain.gain.setValueAtTime(0.45, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.024);

      noise.connect(nFilter);
      nFilter.connect(nGain);
      nGain.connect(this.lowStimFilter);
      noise.start(now);
      noise.stop(now + 0.026);
    }

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(isOn ? 620 : 480, now);
    osc.frequency.exponentialRampToValueAtTime(isOn ? 190 : 145, now + 0.042);

    gain.gain.setValueAtTime(0.32, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.048);

    osc.connect(gain);
    gain.connect(this.lowStimFilter);
    osc.start(now);
    osc.stop(now + 0.05);
  }

  playCubeButton(type = 'click-mid') {
    const isSilent = type.startsWith('silent');
    this.vibrate(isSilent ? 7 : 12);
    if (!this.soundEnabled) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    if (isSilent) {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(112, now);
      osc.frequency.exponentialRampToValueAtTime(52, now + 0.045);
      gain.gain.setValueAtTime(0.14, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);
      osc.connect(gain);
      gain.connect(this.lowStimFilter);
      osc.start(now);
      osc.stop(now + 0.055);
    } else {
      osc.type = 'square';
      osc.frequency.setValueAtTime(920, now);
      osc.frequency.exponentialRampToValueAtTime(270, now + 0.025);
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 2600;
      gain.gain.setValueAtTime(0.22, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.028);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.lowStimFilter);
      osc.start(now);
      osc.stop(now + 0.03);
    }
  }

  playDetentTick(speedNorm = 0.5) {
    this.vibrate(5);
    if (!this.soundEnabled) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    const pitch = this.uniformPitch ? 680 : (580 + Math.min(1, speedNorm) * 360);
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(pitch, now);
    osc.frequency.exponentialRampToValueAtTime(180, now + 0.016);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.018);

    osc.connect(gain);
    gain.connect(this.lowStimFilter);
    osc.start(now);
    osc.stop(now + 0.02);
  }

  playRollingBounce(speedNorm = 0.6) {
    const v = Math.max(0.1, Math.min(1, speedNorm));
    this.vibrate(Math.round(5 + v * 7));
    if (!this.soundEnabled) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(240 + v * 190, now);
    osc.frequency.exponentialRampToValueAtTime(85, now + 0.035);
    gain.gain.setValueAtTime(0.22 * v, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    osc.connect(gain);
    gain.connect(this.lowStimFilter);
    osc.start(now);
    osc.stop(now + 0.045);
  }

  updateWorryHum(velocityNorm = 0.3) {
    if (!this.soundEnabled) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    if (!this.worryNodes) {
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'triangle';
      osc1.frequency.value = 110;
      osc2.frequency.value = 165;

      filter.type = 'lowpass';
      filter.frequency.value = 260;

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.setTargetAtTime(0.16, now, 0.06);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(gain);
      gain.connect(this.lowStimFilter);

      osc1.start(now);
      osc2.start(now);
      this.worryNodes = { osc1, osc2, filter, gain };
    }

    const v = Math.max(0.05, Math.min(1, velocityNorm));
    this.worryNodes.filter.frequency.setTargetAtTime(180 + v * 320, now, 0.05);
    this.worryNodes.gain.gain.setTargetAtTime(0.07 + v * 0.14, now, 0.05);
  }

  stopWorryHum() {
    if (!this.worryNodes || !this.ctx) return;
    const now = this.ctx.currentTime;
    const nodes = this.worryNodes;
    this.worryNodes = null;
    try {
      nodes.gain.gain.setTargetAtTime(0.0001, now, 0.08);
      setTimeout(() => {
        try {
          nodes.osc1.stop();
          nodes.osc2.stop();
          nodes.gain.disconnect();
        } catch (_) {}
      }, 240);
    } catch (_) {}
  }

  /**
   * 6. BREATHE & CRAVING RELIEF HARMONIC CHIME
   */
  playBreathCue(phase = 'inhale') {
    this.vibrate(phase === 'inhale' ? [12, 40, 12] : phase === 'hold' ? 10 : [8, 30, 8]);
    if (!this.soundEnabled) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const freqs =
      phase === 'inhale'
        ? [261.63, 329.63, 392.0]
        : phase === 'hold'
        ? [329.63, 440.0]
        : [293.66, 220.0, 196.0];

    freqs.forEach((f, idx) => {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now + idx * 0.05);

      gain.gain.setValueAtTime(0.001, now + idx * 0.05);
      gain.gain.linearRampToValueAtTime(0.09, now + idx * 0.05 + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.0008, now + idx * 0.05 + 0.65);

      osc.connect(gain);
      gain.connect(this.lowStimFilter);
      osc.start(now + idx * 0.05);
      osc.stop(now + idx * 0.05 + 0.7);
    });
  }

  /**
   * 7. MECHANICAL KEY SWITCH SYNTHESIZER
   */
  playKeySwitch(profile = 'thock', keyIndex = 0, isKeyUp = false) {
    this.vibrate(isKeyUp ? 4 : profile === 'blue' ? 14 : 10);
    if (!this.soundEnabled) return;
    this.init();
    if (!this.ctx) return;

    const now = this.ctx.currentTime;
    const detuneFactor = this.uniformPitch ? 1 : (0.94 + (keyIndex % 12) * 0.011);

    const bodyOsc = this.ctx.createOscillator();
    const bodyGain = this.ctx.createGain();

    const profileSettings = {
      blue: { f1: 1450, f2: 390, dur: 0.032, vol: 0.25, type: 'square', click: true },
      brown: { f1: 680, f2: 210, dur: 0.038, vol: 0.24, type: 'triangle', click: true },
      red: { f1: 360, f2: 135, dur: 0.034, vol: 0.16, type: 'sine', click: false },
      thock: { f1: 280, f2: 96, dur: 0.052, vol: 0.34, type: 'triangle', click: true }
    };

    const cfg = profileSettings[profile] || profileSettings.thock;
    const upMultiplier = isKeyUp ? 1.18 : 1.0;
    const volMultiplier = isKeyUp ? 0.58 : 1.0;

    bodyOsc.type = cfg.type;
    bodyOsc.frequency.setValueAtTime(cfg.f1 * detuneFactor * upMultiplier, now);
    bodyOsc.frequency.exponentialRampToValueAtTime(cfg.f2 * detuneFactor * upMultiplier, now + cfg.dur);

    const bodyFilter = this.ctx.createBiquadFilter();
    bodyFilter.type = 'lowpass';
    bodyFilter.frequency.value = profile === 'thock' ? 680 : 2400;

    bodyGain.gain.setValueAtTime(cfg.vol * volMultiplier, now);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, now + cfg.dur + 0.006);

    bodyOsc.connect(bodyFilter);
    bodyFilter.connect(bodyGain);
    bodyGain.connect(this.lowStimFilter);

    bodyOsc.start(now);
    bodyOsc.stop(now + cfg.dur + 0.01);

    if (cfg.click && this.noiseBuffer) {
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      const nFilter = this.ctx.createBiquadFilter();
      nFilter.type = 'bandpass';
      nFilter.frequency.value = profile === 'blue' ? 3200 : profile === 'thock' ? 950 : 1800;
      nFilter.Q.value = 2.6;

      const nGain = this.ctx.createGain();
      nGain.gain.setValueAtTime((profile === 'blue' ? 0.32 : 0.2) * volMultiplier, now);
      nGain.gain.exponentialRampToValueAtTime(0.001, now + 0.018);

      noise.connect(nFilter);
      nFilter.connect(nGain);
      nGain.connect(this.lowStimFilter);
      noise.start(now, 0, 0.02);
    }
  }

  /**
   * 8. AMBIENT FOCUS & CALM SOUNDSCAPE ('off' | 'brown' | 'rain' | 'hum40')
   */
  setAmbientMode(mode = 'off') {
    this.ambientMode = mode;
    this._stopAmbientNodes();
    if (mode !== 'off' && this.soundEnabled) {
      this.init();
      this._startAmbientNodes(mode);
    }
  }

  _startAmbientNodes(mode) {
    if (!this.ctx || !this.noiseBuffer) return;
    const now = this.ctx.currentTime;

    if (mode === 'brown' || mode === 'rain') {
      const src = this.ctx.createBufferSource();
      src.buffer = this.noiseBuffer;
      src.loop = true;

      const filter = this.ctx.createBiquadFilter();
      filter.type = mode === 'brown' ? 'lowpass' : 'bandpass';
      filter.frequency.value = mode === 'brown' ? 240 : 950;
      filter.Q.value = mode === 'brown' ? 0.7 : 0.9;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.setTargetAtTime(mode === 'brown' ? 0.22 : 0.14, now, 0.25);

      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.lowStimFilter);
      src.start(now);

      this.ambientNodes = { src, gain };
    } else if (mode === 'hum40') {
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'sine';
      osc1.frequency.value = 120;
      osc2.frequency.value = 160;

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.setTargetAtTime(0.075, now, 0.25);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(this.lowStimFilter);
      osc1.start(now);
      osc2.start(now);

      this.ambientNodes = { osc1, osc2, gain };
    }
  }

  _stopAmbientNodes() {
    if (!this.ambientNodes || !this.ctx) return;
    const nodes = this.ambientNodes;
    this.ambientNodes = null;
    try {
      nodes.gain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.08);
      setTimeout(() => {
        try {
          if (nodes.src) nodes.src.stop();
          if (nodes.osc1) nodes.osc1.stop();
          if (nodes.osc2) nodes.osc2.stop();
          nodes.gain.disconnect();
        } catch (_) {}
      }, 220);
    } catch (_) {}
  }
}
