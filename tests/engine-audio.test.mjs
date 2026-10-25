import test from 'node:test';
import assert from 'node:assert/strict';
import { EngineAudio } from '../src/engine-audio.js';

class Parameter {
  constructor(value = 0) { this.value = value; this.events = []; }
  setValueAtTime(value, time) { this.value = value; this.events.push({ type: 'set', value, time }); }
  linearRampToValueAtTime(value, time) { this.value = value; this.events.push({ type: 'ramp', value, time }); }
  setTargetAtTime(value, time, constant) { this.value = value; this.events.push({ type: 'target', value, time, constant }); }
  cancelScheduledValues(time) { this.events.push({ type: 'cancel', time }); }
  cancelAndHoldAtTime(time) { this.events.push({ type: 'hold', time }); }
}
class Node {
  connections = [];
  connect(destination) { this.connections.push(destination); return destination; }
  disconnect() { this.connections.length = 0; this.disconnected = true; }
}
function mockAudioContext() {
  return class Context {
    static constructions = 0;
    constructor() {
      Context.constructions++; this.currentTime = 0; this.sampleRate = 8000; this.state = 'suspended'; this.destination = new Node();
      this.oscillators = []; this.sources = []; this.gains = []; this.closeCalls = 0;
    }
    async resume() { this.state = 'running'; }
    async close() { this.closeCalls++; this.state = 'closed'; }
    createGain() { const node = new Node(); node.gain = new Parameter(); this.gains.push(node); return node; }
    createBiquadFilter() { const node = new Node(); node.frequency = new Parameter(); node.Q = new Parameter(); return node; }
    createDynamicsCompressor() { const node = new Node(); for (const key of ['threshold', 'knee', 'ratio', 'attack', 'release']) node[key] = new Parameter(); return node; }
    createOscillator() {
      const node = new Node(); node.frequency = new Parameter(); node.starts = []; node.stops = [];
      node.start = (time = 0) => node.starts.push(time); node.stop = time => node.stops.push(time);
      this.oscillators.push(node); return node;
    }
    createBuffer(channels, length, rate) { return { channels, length, rate, samples: new Float32Array(length), getChannelData() { return this.samples; } }; }
    createBufferSource() { const node = new Node(); node.starts = []; node.stops = []; node.start = (time = 0) => node.starts.push(time); node.stop = time => node.stops.push(time); this.sources.push(node); return node; }
  };
}

test('TNT sound is gesture-gated, distance-attenuated, throttled, and muted with every other sound',async()=>{
  const audio=new EngineAudio(mockAudioContext());assert.equal(audio.blast(2),false);await audio.resume();assert.equal(audio.blast(60),false);assert.equal(audio.blast(2),true);assert.equal(audio.blast(2),false);
  const blast=[...audio.horns][0];assert.ok(blast.filter&&blast.oscillators.length===2);assert.ok(blast.gain.gain.events.some(e=>e.type==='ramp'&&e.value>.5));
  audio.setEnabled(false);assert.equal(audio.blast(),false);assert.ok(blast.oscillators.every(o=>o.stops.length>=2));audio.setEnabled(true);audio.context.currentTime=1;audio.update({paused:true});assert.equal(audio.blast(),false);await audio.dispose();assert.ok(blast.filter.disconnected);
});

test('engine audio never creates a context or sources before the explicit resume gesture', async () => {
  const Context = mockAudioContext(), audio = new EngineAudio(Context);
  audio.update({ speed: 8, rpm: 3500 }); audio.setEnabled(true); audio.suspend(false);
  assert.equal(Context.constructions, 0); assert.equal(audio.honk(), false);
  assert.equal(await audio.resume(), true); assert.equal(Context.constructions, 1);
  assert.equal(audio.context.oscillators.length, 4); assert.equal(audio.context.sources.length, 4);
  assert.ok(audio.context.oscillators.every(source => source.starts.length === 1));
  await audio.resume(); assert.equal(Context.constructions, 1);
  await audio.dispose();
});

test('a resolved but suspended context is not reported as audible and later resumes without duplicate sources',async()=>{
  const Context=mockAudioContext();class Interrupted extends Context{allowed=false;async resume(){if(this.allowed)this.state='running';}}
  const audio=new EngineAudio(Interrupted);assert.equal(await audio.resume(),false);assert.equal(audio.unlocked,false);assert.equal(audio.audible(),false);
  audio.context.allowed=true;assert.equal(await audio.resume(),true);audio.update({speed:10,rpm:4200,throttle:1});assert.ok(audio.engineGain.gain.value>0);assert.equal(audio.context.oscillators.length,4);
  audio.context.state='interrupted';audio.update(audio.motion);assert.equal(audio.masterGain.gain.value,0);assert.equal(await audio.resume(),true);assert.ok(audio.masterGain.gain.value>0);assert.equal(audio.context.oscillators.length,4);await audio.dispose();
});

test('engine and tire layers reach exact zero at rest and do not perpetually reschedule a decay', async () => {
  const audio = new EngineAudio(mockAudioContext()); await audio.resume();
  assert.equal(audio.engineGain.gain.value, 0); assert.equal(audio.roadGain.gain.value, 0);
  audio.update({ speed: 6, rpm: 3000, acceleration: 8 });
  assert.ok(audio.engineGain.gain.value > 0); assert.ok(audio.roadGain.gain.value > 0);
  audio.context.currentTime = 1; audio.update({ speed: 0, rpm: 4500, acceleration: 20 });
  const stopping = audio.engineGain.gain.events.filter(event => event.type === 'ramp').at(-1);
  assert.equal(stopping.value, 0); assert.ok(stopping.time <= 1.03); assert.equal(audio.roadGain.gain.value, 0);
  const count = audio.engineGain.gain.events.length;
  for (let i = 0; i < 120; i++) { audio.context.currentTime += 1 / 60; audio.update({ speed: 0, rpm: 650 }); }
  assert.equal(audio.engineGain.gain.events.length, count); assert.equal(audio.engineGain.gain.value, 0);
  await audio.dispose();
});

test('RPM, acceleration and speed change harmonic pitch, engine load and filtered tire noise', async () => {
  const audio = new EngineAudio(mockAudioContext()); await audio.resume();
  audio.update({ speed: 2, rpm: 1200, acceleration: 2 });
  const lowPitch = audio.oscillators[0].oscillator.frequency.value, lowRoad = audio.roadGain.gain.value, lowFilter = audio.engineFilter.frequency.value;
  audio.context.currentTime = .4; audio.update({ speed: 10, rpm: 4200, acceleration: 12, slip: .7 });
  const shiftPitch = audio.oscillators[0].oscillator.frequency.value;
  assert.ok(shiftPitch > lowPitch); assert.ok(audio.engineFilter.frequency.value > lowFilter); assert.ok(audio.roadGain.gain.value > lowRoad);
  assert.ok(audio.oscillators.every(({ oscillator }) => oscillator.frequency.events.some(event => event.type === 'target' && event.constant >= .2)));
  audio.context.currentTime = .8; audio.update({ speed: 10, rpm: 4200, acceleration: 12, slip: .7 });
  assert.ok(audio.oscillators[0].oscillator.frequency.value > shiftPitch, 'An upshift briefly drops pitch and then recovers smoothly');
  await audio.dispose();
});

test('mute, paused views and hidden tabs silence every layer and prevent horn playback', async () => {
  const audio = new EngineAudio(mockAudioContext()); await audio.resume(); audio.update({ speed: 7, rpm: 3000 });
  audio.setEnabled(false);
  assert.equal(audio.masterGain.gain.value, 0); assert.equal(audio.engineGain.gain.value, 0); assert.equal(audio.roadGain.gain.value, 0); assert.equal(audio.honk(), false);
  audio.setEnabled(true); assert.ok(audio.engineGain.gain.value > 0);
  audio.suspend(true); assert.equal(audio.masterGain.gain.value, 0); assert.equal(audio.engineGain.gain.value, 0); assert.equal(audio.honk(), false);
  audio.suspend(false); assert.ok(audio.engineGain.gain.value > 0);
  audio.update({ speed: 7, rpm: 3000, paused: true }); assert.equal(audio.masterGain.gain.value, 0); assert.equal(audio.engineGain.gain.value, 0); assert.equal(audio.honk(), false);
  audio.update({ speed: 0, paused: false }); assert.equal(audio.engineGain.gain.value, 0);
  await audio.dispose();
});

test('an explicit horn is short, rate-limited, and cut off by mute even while parked', async () => {
  const audio = new EngineAudio(mockAudioContext()); await audio.resume();
  assert.equal(audio.honk(), true); assert.equal(audio.context.oscillators.length, 6); assert.equal(audio.honk(), false);
  const horn = [...audio.horns][0];
  assert.equal(horn.gain.gain.events.filter(event => event.type === 'ramp').at(-1).value, 0);
  assert.ok(horn.oscillators.every(source => source.stops[0] <= .32));
  audio.context.currentTime = .1; audio.setEnabled(false);
  assert.equal(horn.gain.gain.value, 0); assert.ok(horn.oscillators.every(source => source.stops.at(-1) <= .14)); assert.equal(audio.honk(), false);
  await audio.dispose();
});

test('missing audio support, denied resume and invalid frame values fail silently', async () => {
  const absent = new EngineAudio(null); assert.equal(await absent.resume(), false); absent.update({ speed: 5 }); absent.setEnabled(true); absent.suspend(false); assert.equal(absent.honk(), false); await absent.dispose();
  const Context = mockAudioContext();
  class Denied extends Context { async resume() { throw new Error('NotAllowedError'); } }
  const denied = new EngineAudio(Denied); assert.equal(await denied.resume(), false); assert.equal(denied.masterGain.gain.value, 0); assert.equal(denied.honk(), false); await denied.dispose();
  const audio = new EngineAudio(mockAudioContext()); await audio.resume(); audio.update({ speed: NaN, rpm: Infinity, acceleration: undefined, slip: NaN });
  assert.equal(audio.engineGain.gain.value, 0); assert.equal(audio.roadGain.gain.value, 0); await audio.dispose();
});

test('disposal is idempotent, closes the context, and cannot restart the engine', async () => {
  const audio = new EngineAudio(mockAudioContext()); await audio.resume(); audio.update({ speed: 4, rpm: 2400 });
  const context = audio.context, first = audio.dispose(); assert.equal(audio.dispose(), first);
  await first;
  assert.equal(context.closeCalls, 1); assert.equal(context.state, 'closed'); assert.equal(await audio.resume(), false); assert.equal(audio.honk(), false);
  assert.ok(context.oscillators.every(source => source.stops.length > 0)); assert.ok(context.sources.every(source => source.stops.length > 0));
});

test('engines use a quiet low hum, distinct gentle voices and silent throttle release',async()=>{
  const audio=new EngineAudio(mockAudioContext());await audio.resume();
  audio.update({speed:25,rpm:8000,gear:4,throttle:1,model:'8-ball'});
  const sportsPitch=audio.oscillators[0].oscillator.frequency.value,level=audio.masterGain.gain.value*audio.engineGain.gain.value;
  assert.ok(level>.01&&level<.075,'The engine stays audible at a much lower level');assert.ok(audio.intakeGain.gain.value<.02);assert.equal(audio.oscillators[0].oscillator.type,'sine');assert.ok(audio.oscillators[2].gain.gain.value<.03);assert.ok(audio.engineFilter.frequency.value<900);
  audio.context.currentTime=.5;audio.update({speed:25,rpm:8000,gear:4,throttle:1,model:'monster-truck'});
  assert.ok(audio.oscillators[0].oscillator.frequency.value<sportsPitch*.6,'The monster truck has a deeper firing note');
  audio.context.currentTime=1;audio.update({speed:24,rpm:7600,gear:4,throttle:0,model:'monster-truck'});assert.equal(audio.soundTimes.has('overrun'),false);
  const pops=audio.horns.size;audio.context.currentTime=1.02;audio.update({speed:24,rpm:7600,gear:4,throttle:0,model:'monster-truck'});assert.equal(audio.horns.size,pops,'Coasting stays free of exhaust pops');
  audio.setEnabled(false);assert.equal(audio.intakeGain.gain.value,0);assert.equal(audio.boostGain.gain.value,0);assert.equal(audio.waterGain.gain.value,0);assert.equal(audio.impact('overrun',4),false);await audio.dispose();
});

test('every car stays within the gentle engine mix at high revs, shifts and boost without automatic transients',async()=>{
  const audio=new EngineAudio(mockAudioContext());await audio.resume();
  for(const model of ['8-ball','monster-truck','toy-story','explorer']){
    audio.context.currentTime+=1;audio.update({speed:48,rpm:9000,gear:4,throttle:1,boosting:true,model});
    assert.ok(audio.engineGain.gain.value*audio.masterGain.gain.value<.075,model);assert.ok(audio.oscillators[0].oscillator.frequency.value<180);assert.ok(audio.intakeGain.gain.value<.02);assert.ok(audio.boostGain.gain.value<.015);
    audio.context.currentTime+=.5;audio.update({speed:48,rpm:6000,gear:5,throttle:0,model});assert.equal(audio.soundTimes.has('shift'),false);assert.equal(audio.soundTimes.has('overrun'),false);assert.equal(audio.horns.size,0);
  }
  await audio.dispose();
});

test('water crossings, bridge boards, tire surfaces, and impacts have distinct gated sounds',async()=>{
  const audio=new EngineAudio(mockAudioContext());await audio.resume();audio.update({speed:15,surface:'road'});const road=audio.roadGain.gain.value;
  audio.context.currentTime=1;audio.update({speed:15,surface:'water'});assert.equal(audio.roadGain.gain.value,0);assert.ok(audio.waterGain.gain.value>0);assert.equal(audio.soundTimes.get('splash'),1);
  audio.context.currentTime=2;audio.update({speed:15,surface:'grass'});assert.ok(audio.roadGain.gain.value<road);assert.equal(audio.waterGain.gain.value,0);
  audio.context.currentTime=3;audio.update({speed:15,surface:'bridge',elapsed:.05});for(let i=0;i<4;i++)audio.update({speed:15,surface:'bridge',elapsed:.05});assert.equal(audio.soundTimes.get('wood'),3);
  assert.equal(audio.impact('pin',5,60),false);assert.equal(audio.impact('pin',5,2),true);audio.suspend(true);assert.equal(audio.masterGain.gain.value,0);assert.equal(audio.impact('splash',5),false);await audio.dispose();
});
