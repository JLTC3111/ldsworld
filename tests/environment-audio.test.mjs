import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import { createEnvironmentAudio } from '../src/environment-audio.js';

const flush=async()=>{await Promise.resolve();await Promise.resolve();};
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return{promise,resolve,reject};};
class Target {
  listeners=new Map();hidden=false;
  addEventListener(type,listener){if(!this.listeners.has(type))this.listeners.set(type,new Set());this.listeners.get(type).add(listener);}
  removeEventListener(type,listener){this.listeners.get(type)?.delete(listener);if(!this.listeners.get(type)?.size)this.listeners.delete(type);}
  fire(type,event={isTrusted:true}){for(const listener of [...(this.listeners.get(type)||[])])listener(event);}
}
class Clock {
  time=0;next=1;timers=new Map();
  setTimeout(callback,delay){const id=this.next++;this.timers.set(id,{callback,at:this.time+delay/1000});return id;}
  clearTimeout(id){this.timers.delete(id);}
  async advance(seconds){const end=this.time+seconds;let count=0;while(true){const next=[...this.timers].sort((a,b)=>a[1].at-b[1].at)[0];if(!next||next[1].at>end)break;assert.ok(++count<10000,'Timers must remain bounded');this.time=next[1].at;this.timers.delete(next[0]);next[1].callback();await flush();}this.time=end;await flush();}
}
class Recording extends Target {
  paused=true;plays=0;pauses=0;loads=0;currentTime=0;pending=[];playVolumes=[];volumeWrites=0;_volume=0;denied=false;failure=null;
  set volume(value){assert.ok(Number.isFinite(value)&&value>=0&&value<=1);this._volume=value;this.volumeWrites++;}
  get volume(){return this._volume;}
  play(){this.plays++;this.playVolumes.push(this.volume);if(this.denied)return Promise.reject(Object.assign(new Error('Autoplay blocked'),{name:'NotAllowedError'}));if(this.failure)return Promise.reject(this.failure);this.paused=false;return this.pending.shift()?.promise||Promise.resolve();}
  pause(){this.paused=true;this.pauses++;}
  finish(){this.paused=true;this.fire('ended');}
  removeAttribute(name){assert.equal(name,'src');this.source='';}
  load(){this.loads++;}
}
function fixture({enabled=true,denied=false}={}){
  const events=new Target(),document=new Target(),clock=new Clock(),audio={};
  const controller=createEnvironmentAudio({enabled,eventTarget:events,documentTarget:document,now:()=>clock.time,scheduler:clock,audioFactory:source=>{const id=/\/([^/]+)\.mp3$/u.exec(source)[1];assert.ok(['wind','water','rooster','birds'].includes(id));const recording=new Recording();recording.source=source;recording.denied=denied;audio[id]=recording;return recording;}});
  return{events,document,clock,audio,controller};
}

test('real recordings are allocated once and blocked autoplay unlocks synchronously on a trusted gesture',async()=>{
  const {events,clock,audio,controller}=fixture({denied:true});assert.equal(Object.keys(audio).length,4);assert.ok(Object.values(audio).every(track=>track.plays===0));
  assert.equal(await controller.start(),false);assert.equal(controller.getState().blocked,true);assert.equal(audio.rooster.plays,1);assert.equal(audio.birds.plays,0);
  assert.ok(audio.wind.playVolumes[0]>0&&audio.water.playVolumes[0]>0,'The first request uses the actual audible gain');
  events.fire('pointerdown',{isTrusted:false});events.fire('keydown',{isTrusted:true,metaKey:true});assert.equal(audio.wind.plays,1);
  Object.values(audio).forEach(track=>track.denied=false);events.fire('pointerdown');assert.equal(audio.wind.plays,2,'Playback runs inside the gesture handler');assert.equal(audio.rooster.plays,2,'Denied playback did not consume the morning call cooldown');
  await flush();assert.equal(controller.getState().blocked,false);assert.deepEqual(controller.getState().active,['wind','water','rooster']);
  for(let frame=0;frame<1000;frame++)controller.update({hour:8.5,riverDistance:12});await clock.advance(1);
  assert.equal(audio.wind.plays,2);assert.equal(audio.water.plays,2);assert.equal(audio.rooster.plays,2);assert.equal(clock.timers.size,1);controller.dispose();
});

test('morning calls use real elapsed cooldowns, do not overlap, and never catch up with a burst',async()=>{
  const {clock,audio,controller}=fixture();controller.update({hour:5.49});await controller.start();assert.equal(audio.rooster.plays,0);
  controller.update({hour:5.5});await flush();assert.equal(audio.rooster.plays,1);assert.equal(audio.rooster.loop,false);audio.rooster.finish();
  await clock.advance(31.9);assert.equal(audio.rooster.plays,1);await clock.advance(.3);assert.equal(audio.rooster.plays,2);
  await clock.advance(100);assert.equal(audio.rooster.plays,2,'An unfinished one-shot is never overlapped');audio.rooster.finish();await clock.advance(.3);assert.equal(audio.rooster.plays,3,'A long idle period produces one new call');
  controller.update({hour:9.5});assert.equal(audio.rooster.paused,true);controller.update({hour:9.49});await flush();assert.equal(audio.rooster.plays,3,'Rapid re-entry preserves the last successful call cooldown');controller.dispose();
});

test('sunset birds loop quietly only in their phase and rapid time presets cannot spam playback',async()=>{
  const {clock,audio,controller}=fixture();controller.update({hour:16.99});await controller.start();assert.equal(audio.birds.plays,0);
  controller.update({hour:17});await flush();assert.equal(audio.birds.plays,1);assert.equal(audio.birds.loop,true);assert.ok(audio.birds.volume>0&&audio.birds.volume<.12);
  for(let index=0;index<100;index++){controller.update({hour:22});controller.update({hour:17.9});}await flush();assert.equal(audio.birds.plays,1);
  await clock.advance(16.2);assert.equal(audio.birds.plays,2);await clock.advance(60);assert.equal(audio.birds.plays,2,'Native looping does not create repeated play requests');
  controller.update({hour:19});assert.equal(audio.birds.paused,true);assert.ok(!controller.getState().active.includes('birds'));controller.dispose();
});

test('water follows river proximity and later weather and distance updates fade without per-frame volume writes',async()=>{
  const {clock,audio,controller}=fixture();controller.update({hour:12,riverDistance:60});await controller.start();const far=audio.water.volume,clear=audio.wind.volume;
  audio.wind.currentTime=11;audio.water.currentTime=9;const writes=audio.water.volumeWrites;
  for(let index=0;index<1000;index++)controller.update({hour:12,riverDistance:0,weather:'rain'});
  assert.equal(audio.water.volumeWrites,writes,'Frame updates set targets without touching the audio element');
  await clock.advance(2);assert.ok(audio.water.volume>far*2);assert.ok(audio.wind.volume>clear);assert.ok(audio.water.volume<.3&&audio.wind.volume<.2);
  assert.ok(audio.water.volumeWrites-writes<20);assert.equal(audio.water.currentTime,9);assert.equal(audio.wind.currentTime,11);assert.equal(audio.wind.plays,1);controller.dispose();
});

test('global mute and hidden tabs stop every sound; disabled preferences survive gestures and visibility',async()=>{
  const {events,document,clock,audio,controller}=fixture({enabled:false});assert.equal(await controller.start(),false);controller.update({hour:17.9});events.fire('pointerdown');assert.ok(Object.values(audio).every(track=>track.plays===0));
  controller.setEnabled(true);await flush();audio.water.currentTime=7;assert.ok(controller.getState().active.includes('birds'));
  document.hidden=true;document.fire('visibilitychange');assert.ok(Object.values(audio).every(track=>track.paused));assert.equal(clock.timers.size,0);
  await clock.advance(40);events.fire('pointerdown');assert.equal(audio.birds.plays,1);document.hidden=false;document.fire('visibilitychange');await flush();assert.equal(audio.wind.plays,2);assert.equal(audio.water.currentTime,7);assert.equal(audio.birds.plays,2);
  controller.setEnabled(false);const plays=Object.values(audio).reduce((sum,track)=>sum+track.plays,0);for(let index=0;index<1000;index++)controller.update({hour:8.5});events.fire('keydown');document.hidden=true;document.fire('visibilitychange');document.hidden=false;document.fire('visibilitychange');await clock.advance(100);
  assert.equal(Object.values(audio).reduce((sum,track)=>sum+track.plays,0),plays);assert.ok(Object.values(audio).every(track=>track.paused&&track.volume===0));assert.equal(audio.water.currentTime,7);controller.dispose();
});

test('late promises cannot revive an old animal phase, muted sound, or a disposed controller',async()=>{
  const {events,document,clock,audio,controller}=fixture();const rooster=deferred();audio.rooster.pending.push(rooster);const starting=controller.start();
  controller.update({hour:22});rooster.resolve();await starting;assert.equal(audio.rooster.paused,true);assert.ok(!controller.getState().active.includes('rooster'));
  controller.setEnabled(false);const wind=deferred();audio.wind.pending.push(wind);controller.setEnabled(true);controller.dispose();wind.resolve();await flush();
  assert.ok(Object.values(audio).every(track=>track.paused&&track.source===''));assert.equal(clock.timers.size,0);assert.equal(events.listeners.size,0);assert.equal(document.listeners.size,0);assert.ok(Object.values(audio).every(track=>track.listeners.size===0&&track.loads===1));
  const before=audio.wind.plays;await controller.resume();events.fire('pointerdown');controller.update({hour:8.5});controller.setEnabled(true);await clock.advance(100);assert.equal(audio.wind.plays,before);controller.dispose();
});

test('unsupported audio stays silent and network failures retry at bounded intervals rather than every frame',async()=>{
  const events=new Target(),document=new Target(),clock=new Clock();const missing=createEnvironmentAudio({eventTarget:events,documentTarget:document,scheduler:clock,now:()=>clock.time,audioFactory(){throw new Error('Audio unavailable');}});
  assert.equal(await missing.start(),false);missing.update({hour:8.5});assert.equal(clock.timers.size,0);assert.equal(missing.getState().playing,false);missing.dispose();
  const {audio,controller,clock:retryClock}=fixture();Object.values(audio).forEach(track=>track.failure=Object.assign(new Error('Cannot decode'),{name:'NotSupportedError'}));await controller.start();
  for(let index=0;index<1000;index++)controller.update({hour:8.5});await retryClock.advance(31);assert.equal(audio.wind.plays,1);assert.equal(audio.rooster.plays,1);await retryClock.advance(2);assert.equal(audio.wind.plays,2);assert.equal(audio.rooster.plays,2);controller.dispose();
});


test('all four selected natural sound files ship locally as distinct MP3 recordings',async()=>{
  const contents=[];
  for(const kind of ['wind','water','rooster','birds']){
    const data=await readFile(new URL('../src/assets/audio/ambience/'+kind+'.mp3',import.meta.url));
    assert.ok(data.length>10000,kind+' must contain a real recording');
    assert.ok(data.toString('ascii',0,3)==='ID3'||data[0]===255,kind+' has an MP3 header');contents.push(data);
  }
  for(let a=0;a<contents.length;a++)for(let b=a+1;b<contents.length;b++)assert.equal(contents[a].equals(contents[b]),false,'Sound labels must not mask duplicate recordings');
});
