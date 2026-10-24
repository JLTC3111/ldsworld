const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const number = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;

// Entirely synthesized: no media downloads, autoplay, or audio context until resume().
export class EngineAudio {
  constructor(AudioContextClass = globalThis.AudioContext || globalThis.webkitAudioContext) {
    this.AudioContextClass = AudioContextClass;
    this.context = null;
    this.enabled = true;
    this.hidden = false;
    this.unlocked = false;
    this.disposed = false;
    this.motion = { speed: 0, rpm: 650, acceleration: 0, paused: false, slip: 0 };
    this.oscillators = [];
    this.horns = new Set();
    this.nodes = [];
    this.targets = new WeakMap();
    this.lastGear = 0;
    this.lastHonk = -Infinity;
    this.shiftStart = -Infinity;
    this.disposePromise = null;
  }

  async resume() {
    if (this.disposed || !this.AudioContextClass) return false;
    try {
      if (!this.context) {
        this.context = new this.AudioContextClass();
        this.buildGraph();
      }
      await this.context.resume();
      if (this.disposed || this.context.state === 'closed') return false;
      this.unlocked = true;
      this.update(this.motion);
      return true;
    } catch {
      this.unlocked = false;
      this.silence();
      return false;
    }
  }

  buildGraph() {
    const context = this.context;
    const gain = value => {
      const node = context.createGain();
      node.gain.value = value; this.targets.set(node.gain, value); this.nodes.push(node);
      return node;
    };
    this.masterGain = gain(0);
    this.engineGain = gain(0);
    this.roadGain = gain(0);
    this.engineFilter = context.createBiquadFilter();
    this.engineFilter.type = 'lowpass'; this.engineFilter.frequency.value = 400; this.engineFilter.Q.value = .65;
    this.roadFilter = context.createBiquadFilter();
    this.roadFilter.type = 'bandpass'; this.roadFilter.frequency.value = 1000; this.roadFilter.Q.value = .55;
    this.nodes.push(this.engineFilter, this.roadFilter);
    this.engineGain.connect(this.engineFilter); this.engineFilter.connect(this.masterGain);
    this.roadGain.connect(this.roadFilter); this.roadFilter.connect(this.masterGain);
    if (context.createDynamicsCompressor) {
      const limiter = context.createDynamicsCompressor();
      limiter.threshold.value = -16; limiter.knee.value = 18; limiter.ratio.value = 3; limiter.attack.value = .005; limiter.release.value = .12;
      this.masterGain.connect(limiter); limiter.connect(context.destination); this.nodes.push(limiter);
    } else this.masterGain.connect(context.destination);

    // A four-cylinder firing note, a subharmonic, and softer combustion harmonics.
    for (const [type, multiple, amplitude] of [['triangle', 1, .62], ['triangle', .5, .28], ['sawtooth', 2, .12], ['sine', 3, .05]]) {
      const oscillator = context.createOscillator(), partialGain = gain(amplitude);
      oscillator.type = type; oscillator.frequency.value = 28 * multiple;
      oscillator.connect(partialGain); partialGain.connect(this.engineGain);
      this.oscillators.push({ oscillator, multiple }); oscillator.start();
    }
    const sampleRate = number(context.sampleRate, 44100);
    const buffer = context.createBuffer(1, Math.max(4096, Math.round(sampleRate)), sampleRate);
    const samples = buffer.getChannelData(0);
    let seed = 0x51d311, rumble = 0;
    for (let i = 0; i < samples.length; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const white = seed / 2147483648 - 1;
      rumble = .96 * rumble + .04 * white;
      samples[i] = white * .3 + rumble * .7;
    }
    this.roadSource = context.createBufferSource(); this.roadSource.buffer = buffer; this.roadSource.loop = true;
    this.roadSource.connect(this.roadGain); this.roadSource.start();
  }

  ramp(parameter, value, seconds = .035) {
    if (!parameter || !this.context || this.targets.get(parameter) === value) return;
    const now = this.context.currentTime;
    if (parameter.cancelAndHoldAtTime) parameter.cancelAndHoldAtTime(now);
    else { parameter.cancelScheduledValues(now); parameter.setValueAtTime(parameter.value, now); }
    parameter.linearRampToValueAtTime(value, now + seconds);
    this.targets.set(parameter, value);
  }

  audible() { return this.unlocked && this.enabled && !this.hidden && !this.disposed && !this.motion.paused; }

  setEnabled(enabled) {
    this.enabled = !!enabled;
    if (!this.enabled) this.stopHorns();
    this.update(this.motion);
  }

  suspend(hidden) {
    this.hidden = !!hidden;
    if (this.hidden) this.stopHorns();
    this.update(this.motion);
  }

  update({ speed = 0, rpm = 650, acceleration = 0, paused = false, slip = 0 } = {}) {
    this.motion = { speed: number(speed), rpm: clamp(number(rpm, 650), 650, 6500), acceleration: clamp(number(acceleration), -40, 30), paused: !!paused, slip: clamp(Math.abs(number(slip)), 0, 1) };
    if (!this.context || this.disposed) return;
    const audible = this.audible(), moving = Math.abs(this.motion.speed) > .12;
    this.ramp(this.masterGain?.gain, audible ? .18 : 0, .025);
    if (!audible || !moving) {
      // Linear ramps finish at exact zero; repeated resting updates do not keep
      // rescheduling a decay that would otherwise never quite become silent.
      this.ramp(this.engineGain?.gain, 0, .025); this.ramp(this.roadGain?.gain, 0, .025);
      if (this.motion.paused) this.stopHorns();
      this.lastGear = 0;
      return;
    }
    const now = this.context.currentTime, speedRatio = clamp(Math.abs(this.motion.speed) / 12, 0, 1);
    const movingGate = clamp((Math.abs(this.motion.speed) - .12) / .65, 0, 1);
    const torque = clamp(Math.max(0, this.motion.acceleration) / 12, 0, 1);
    const gear = this.motion.speed < 0 ? -1 : Math.min(4, Math.floor(Math.abs(this.motion.speed) / 3) + 1);
    if (gear > this.lastGear && this.lastGear > 0) this.shiftStart = now;
    this.lastGear = gear;
    const shiftProgress = clamp((now - this.shiftStart) / .18, 0, 1), shiftPitch = .84 + .16 * shiftProgress;
    const firingFrequency = clamp(this.motion.rpm / 30, 28, 215) * shiftPitch;
    for (const { oscillator, multiple } of this.oscillators) oscillator.frequency.setTargetAtTime(firingFrequency * multiple, now, .065);
    this.engineFilter.frequency.setTargetAtTime(250 + speedRatio * 1000 + torque * 220, now, .08);
    this.roadFilter.frequency.setTargetAtTime(750 + speedRatio * 1000 + this.motion.slip * 500, now, .1);
    this.ramp(this.engineGain.gain, movingGate * (.14 + Math.sqrt(speedRatio) * .15 + torque * .04) * (.72 + .28 * shiftProgress), .05);
    this.ramp(this.roadGain.gain, movingGate * (.008 + speedRatio * .04 + this.motion.slip * .065), .07);
  }

  honk() {
    if (!this.context || !this.audible()) return false;
    const context = this.context, now = context.currentTime;
    if (now - this.lastHonk < .12) return false;
    this.lastHonk = now;
    const gain = context.createGain(); gain.gain.value = 0; gain.connect(this.masterGain);
    gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(.28, now + .018); gain.gain.linearRampToValueAtTime(0, now + .28);
    const horn = { gain, oscillators: [] }; this.horns.add(horn);
    let ended = 0;
    for (const frequency of [311.13, 392]) {
      const oscillator = context.createOscillator(); oscillator.type = 'sine'; oscillator.frequency.value = frequency; oscillator.connect(gain);
      oscillator.onended = () => {
        oscillator.disconnect();
        if (++ended === 2) { gain.disconnect(); this.horns.delete(horn); }
      };
      horn.oscillators.push(oscillator); oscillator.start(now); oscillator.stop(now + .31);
    }
    return true;
  }

  stopHorns() {
    if (!this.context) return;
    for (const horn of this.horns) {
      this.ramp(horn.gain.gain, 0, .025);
      for (const oscillator of horn.oscillators) { try { oscillator.stop(this.context.currentTime + .03); } catch { /* Already ended. */ } }
    }
  }

  silence() {
    this.ramp(this.masterGain?.gain, 0, .025); this.ramp(this.engineGain?.gain, 0, .025); this.ramp(this.roadGain?.gain, 0, .025); this.stopHorns();
  }

  dispose() {
    if (this.disposePromise) return this.disposePromise;
    this.disposed = true; this.silence();
    if (!this.context) return Promise.resolve();
    const context = this.context;
    for (const { oscillator } of this.oscillators) { try { oscillator.stop(context.currentTime + .03); } catch { /* Already stopped. */ } }
    try { this.roadSource?.stop(context.currentTime + .03); } catch { /* Already stopped. */ }
    this.disposePromise = new Promise(resolve => setTimeout(() => {
      for (const node of this.nodes) { try { node.disconnect(); } catch { /* Already disconnected. */ } }
      for (const { oscillator } of this.oscillators) { try { oscillator.disconnect(); } catch { /* Already disconnected. */ } }
      try { this.roadSource?.disconnect(); } catch { /* Already disconnected. */ }
      for (const horn of this.horns) {
        try { horn.gain.disconnect(); } catch { /* Already disconnected. */ }
        for (const oscillator of horn.oscillators) { try { oscillator.disconnect(); } catch { /* Already disconnected. */ } }
      }
      this.horns.clear();
      try { Promise.resolve(context.close()).catch(() => {}).finally(resolve); } catch { resolve(); }
    }, 35));
    return this.disposePromise;
  }
}
