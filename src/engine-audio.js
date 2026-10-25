import { ENGINE_VOICES, powertrainState } from './powertrain.js';

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
    this.surfaceSources=[];this.soundTimes=new Map();this.bridgeDistance=0;
    this.targets = new WeakMap();
    this.lastGear = 0;
    this.lastHonk = -Infinity;
    this.lastBlast=-Infinity;
    this.shiftStart = -Infinity;
    this.downshiftStart = -Infinity;
    this.lastOverrun = -Infinity;
    this.voiceId = null;
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
    this.intakeGain = gain(0);
    this.engineFilter = context.createBiquadFilter();
    this.engineFilter.type = 'lowpass'; this.engineFilter.frequency.value = 400; this.engineFilter.Q.value = .65;
    this.roadFilter = context.createBiquadFilter();
    this.roadFilter.type = 'bandpass'; this.roadFilter.frequency.value = 1000; this.roadFilter.Q.value = .55;
    this.nodes.push(this.engineFilter, this.roadFilter);
    this.engineGain.connect(this.engineFilter); this.engineFilter.connect(this.masterGain);
    this.roadGain.connect(this.roadFilter); this.roadFilter.connect(this.masterGain);
    if (context.createDynamicsCompressor) {
      const limiter = context.createDynamicsCompressor();
      limiter.threshold.value = -12; limiter.knee.value = 12; limiter.ratio.value = 5; limiter.attack.value = .003; limiter.release.value = .12;
      this.masterGain.connect(limiter); limiter.connect(context.destination); this.nodes.push(limiter);
    } else this.masterGain.connect(context.destination);

    // Exhaust body, low combustion pulses, and two raspier upper harmonics.
    // The fundamental's wavetable rounds the sawtooth into an exhaust pulse.
    for (const [type, multiple, amplitude] of [['sawtooth', 1, .5], ['sine', .5, .34], ['triangle', 2, .2], ['sine', 3, .11]]) {
      const oscillator = context.createOscillator(), partialGain = gain(amplitude);
      oscillator.type = type; oscillator.frequency.value = 28 * multiple;
      oscillator.connect(partialGain); partialGain.connect(this.engineGain);
      this.oscillators.push({ oscillator, multiple, gain: partialGain }); oscillator.start();
    }
    if(context.createPeriodicWave&&this.oscillators[0].oscillator.setPeriodicWave){
      const real=new Float32Array(24),imag=new Float32Array(24);
      for(let i=1;i<imag.length;i++)imag[i]=(i%2?1:.72)*Math.exp(-i/15)/Math.pow(i,1.15);
      this.oscillators[0].oscillator.setPeriodicWave(context.createPeriodicWave(real,imag));
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
    this.waterGain=gain(0);this.boostGain=gain(0);
    this.waterFilter=context.createBiquadFilter();this.waterFilter.type='lowpass';this.waterFilter.frequency.value=900;this.waterFilter.Q.value=.7;this.nodes.push(this.waterFilter);
    const boostFilter=context.createBiquadFilter();boostFilter.type='bandpass';boostFilter.frequency.value=1600;boostFilter.Q.value=.45;this.nodes.push(boostFilter);
    this.intakeFilter=context.createBiquadFilter();this.intakeFilter.type='bandpass';this.intakeFilter.frequency.value=500;this.intakeFilter.Q.value=.5;this.nodes.push(this.intakeFilter);
    for(const [target,filter] of [[this.waterGain,this.waterFilter],[this.boostGain,boostFilter],[this.intakeGain,this.intakeFilter]]){const source=context.createBufferSource();source.buffer=buffer;source.loop=true;source.connect(filter);filter.connect(target);target.connect(this.masterGain);source.start();this.surfaceSources.push(source);}
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

  update({ speed = 0, rpm = 950, acceleration = 0, paused = false, slip = 0,surface='road',airborne=false,boosting=false,elapsed=1/60,model='8-ball',gear,throttle } = {}) {
    const previous=this.motion,previousSurface=previous.surface;
    const load=clamp(number(throttle,Math.max(0,number(acceleration))/12),0,1);
    this.motion = { speed: number(speed), rpm: clamp(number(rpm, 950), 650, 9000), acceleration: clamp(number(acceleration), -40, 40), paused: !!paused, slip: clamp(Math.abs(number(slip)), 0, 1),surface,airborne:!!airborne,boosting:!!boosting,elapsed,model:ENGINE_VOICES[model]?model:'8-ball',gear:number(gear,powertrainState(speed).gear),throttle:load };
    if (!this.context || this.disposed) return;
    const audible = this.audible(), moving = Math.abs(this.motion.speed) > .12;
    this.ramp(this.masterGain?.gain, audible ? .28 : 0, .025);
    if (!audible || !moving&&!boosting) {
      // Linear ramps finish at exact zero; repeated resting updates do not keep
      // rescheduling a decay that would otherwise never quite become silent.
      this.ramp(this.engineGain?.gain, 0, .025); this.ramp(this.roadGain?.gain, 0, .025);
      this.ramp(this.waterGain?.gain,0,.025);this.ramp(this.boostGain?.gain,0,.025);
      this.ramp(this.intakeGain?.gain,0,.025);
      if (this.motion.paused) this.stopHorns();
      this.lastGear = 0;
      return;
    }
    const now = this.context.currentTime, speedRatio = clamp(Math.abs(this.motion.speed) / 30, 0, 1);
    const movingGate = boosting?1:clamp((Math.abs(this.motion.speed) - .12) / .65, 0, 1);
    const torque = Math.max(load,boosting?1:0),voice=ENGINE_VOICES[this.motion.model];
    if(this.voiceId!==this.motion.model){
      this.voiceId=this.motion.model;this.lastGear=0;this.shiftStart=this.downshiftStart=-Infinity;
      [voice.body,voice.sub,voice.edge,voice.top].forEach((value,i)=>this.ramp(this.oscillators[i].gain.gain,value,.12));
    }
    if(this.motion.gear>this.lastGear&&this.lastGear>0){this.shiftStart=now;this.impact('shift',2.5);}
    if(this.motion.gear>0&&this.motion.gear<this.lastGear)this.downshiftStart=now;
    this.lastGear=this.motion.gear;
    const shiftProgress=clamp((now-this.shiftStart)/.16,0,1),shiftPitch=(.72+.28*shiftProgress)*(1+.12*(1-clamp((now-this.downshiftStart)/.14,0,1)));
    const revFraction=clamp((this.motion.rpm-950)/8050,0,1),voiceRpm=950+revFraction*(voice.redline-950);
    const firingFrequency=clamp(voiceRpm*voice.firing,24,480)*shiftPitch;
    for (const { oscillator, multiple } of this.oscillators) oscillator.frequency.setTargetAtTime(firingFrequency * multiple, now, .035);
    this.engineFilter.frequency.setTargetAtTime((650+revFraction*2700+torque*1000)*voice.filter,now,.055);
    this.roadFilter.frequency.setTargetAtTime((surface==='grass'?350:750)+speedRatio*1000+this.motion.slip*500,now,.1);
    this.ramp(this.engineGain.gain,movingGate*(.33+Math.sqrt(speedRatio)*.23+torque*.17)*voice.gain*(.55+.45*shiftProgress),.04);
    this.intakeFilter.frequency.setTargetAtTime(400+revFraction*1600+torque*500,now,.06);
    this.ramp(this.intakeGain.gain,movingGate*(.012+torque*.09+revFraction*.025),.045);
    this.ramp(this.roadGain.gain, movingGate * (.008 + speedRatio * .04 + this.motion.slip * .065)*(airborne||surface==='water'?0:surface==='grass'?.55:1.2), .07);
    this.waterFilter.frequency.setTargetAtTime(450+speedRatio*1250,now,.08);
    this.ramp(this.waterGain.gain,!airborne&&surface==='water'?movingGate*(.035+Math.sqrt(speedRatio)*.12):0,.06);
    this.ramp(this.boostGain.gain,boosting?.055:0,.04);
    if(previous.throttle>.6&&torque<.2&&this.motion.rpm>3300&&now-this.lastOverrun>.35&&!previous.paused){this.lastOverrun=now;this.impact('overrun',4);}
    if(surface==='water'&&previousSurface!=='water'&&!airborne)this.impact('splash',Math.min(8,Math.abs(speed)/3));
    if(surface==='bridge'&&!airborne){this.bridgeDistance+=Math.abs(speed)*Math.min(.05,Math.max(0,elapsed));if(this.bridgeDistance>2.2){this.bridgeDistance=0;this.impact('wood',.8);}}else this.bridgeDistance=0;
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

  blast(distance=0){
    if(!this.context||!this.audible()||distance>55)return false;
    const context=this.context,now=context.currentTime;if(now-this.lastBlast<.08)return false;this.lastBlast=now;
    const gain=context.createGain(),filter=context.createBiquadFilter();filter.type='lowpass';filter.frequency.value=260;filter.Q.value=.5;
    gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(.72*Math.max(.08,1-distance/55),now+.012);gain.gain.linearRampToValueAtTime(0,now+.48);
    const source=context.createBufferSource(),bass=context.createOscillator();source.buffer=this.roadSource.buffer;source.connect(filter);bass.type='triangle';bass.frequency.setValueAtTime(85,now);bass.frequency.linearRampToValueAtTime(26,now+.4);bass.connect(filter);filter.connect(gain);gain.connect(this.masterGain);
    const transient={gain,filter,oscillators:[source,bass]};this.horns.add(transient);let ended=0;
    for(const node of transient.oscillators){node.onended=()=>{node.disconnect();if(++ended===2){filter.disconnect();gain.disconnect();this.horns.delete(transient);}};node.start(now);node.stop(now+.5);}
    return true;
  }

  impact(kind='wood',strength=2,distance=0){
    if(!this.context||!this.audible()||distance>55||strength<.2)return false;
    const context=this.context,now=context.currentTime;if(now-(this.soundTimes.get(kind)??-Infinity)<.065)return false;this.soundTimes.set(kind,now);
    const voices={pin:[710,1050,2300,.2],wood:[210,360,1100,.18],metal:[920,1490,3200,.28],stone:[120,195,550,.2],landing:[63,95,550,.24],hydraulic:[190,260,900,.2],aerial:[430,710,1600,.17],teleport:[610,960,2000,.38],splash:[80,125,1700,.36],snow:[100,160,700,.16],overrun:[94,147,1800,.115],shift:[73,125,1200,.065]},voice=voices[kind]||voices.wood;
    const gain=context.createGain(),filter=context.createBiquadFilter();filter.type='lowpass';filter.frequency.value=voice[2];filter.Q.value=.7;
    const volume=(kind==='pin'?.38:.3)*clamp(strength/7,.1,1)*Math.max(.04,1-distance/55);gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(volume,now+.006);gain.gain.linearRampToValueAtTime(0,now+voice[3]);filter.connect(gain);gain.connect(this.masterGain);
    const sources=[];for(const frequency of voice.slice(0,2)){const oscillator=context.createOscillator();oscillator.type=['pin','wood'].includes(kind)?'triangle':'sine';oscillator.frequency.setValueAtTime(frequency,now);oscillator.frequency.linearRampToValueAtTime(frequency*(kind==='teleport'?1.6:.65),now+voice[3]);oscillator.connect(filter);sources.push(oscillator);}
    const noise=context.createBufferSource();noise.buffer=this.roadSource.buffer;noise.connect(filter);sources.push(noise);
    const transient={gain,filter,oscillators:sources};this.horns.add(transient);let ended=0;for(const source of sources){source.onended=()=>{source.disconnect();if(++ended===sources.length){filter.disconnect();gain.disconnect();this.horns.delete(transient);}};source.start(now);source.stop(now+voice[3]+.02);}return true;
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
    this.ramp(this.waterGain?.gain,0,.025);this.ramp(this.boostGain?.gain,0,.025);
    this.ramp(this.intakeGain?.gain,0,.025);
  }

  dispose() {
    if (this.disposePromise) return this.disposePromise;
    this.disposed = true; this.silence();
    if (!this.context) return Promise.resolve();
    const context = this.context;
    for (const { oscillator } of this.oscillators) { try { oscillator.stop(context.currentTime + .03); } catch { /* Already stopped. */ } }
    try { this.roadSource?.stop(context.currentTime + .03); } catch { /* Already stopped. */ }
    for(const source of this.surfaceSources){try{source.stop(context.currentTime+.03);}catch{}}
    this.disposePromise = new Promise(resolve => setTimeout(() => {
      for (const node of this.nodes) { try { node.disconnect(); } catch { /* Already disconnected. */ } }
      for (const { oscillator } of this.oscillators) { try { oscillator.disconnect(); } catch { /* Already disconnected. */ } }
      try { this.roadSource?.disconnect(); } catch { /* Already disconnected. */ }
      this.surfaceSources.forEach(source=>source.disconnect());
      for (const horn of this.horns) {
        try { horn.gain.disconnect(); } catch { /* Already disconnected. */ }
        try { horn.filter?.disconnect(); } catch { /* Already disconnected. */ }
        for (const oscillator of horn.oscillators) { try { oscillator.disconnect(); } catch { /* Already disconnected. */ } }
      }
      this.horns.clear();
      try { Promise.resolve(context.close()).catch(() => {}).finally(resolve); } catch { resolve(); }
    }, 35));
    return this.disposePromise;
  }
}
