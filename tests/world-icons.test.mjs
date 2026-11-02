import test from 'node:test';
import assert from 'node:assert/strict';
import {worldOptionIcon,weatherMorphPathData,mountWorldIcons} from '../src/world-icons.js';
import {lucideWorldPaths,weatherMorphPaths} from '../src/vendor/lucide-world-paths.js';

test('sunrise and sunset retain exact local Lucide paths and a stationary horizon',()=>{
  for(const mode of ['sunrise','sunset']){
    const html=worldOptionIcon(mode);
    assert.match(html,/aria-hidden="true"/);assert.match(html,/focusable="false"/);assert.match(html,/viewBox="0 0 24 24"/);
    for(const path of lucideWorldPaths[mode])assert.ok(html.includes(`d="${path}"`));
    assert.ok(html.indexOf('d="M22 22H2"')<html.indexOf('<g class="world-icon-sun">'));
    assert.match(html,/<animateTransform attributeName="transform" type="translate"/);
    assert.ok(html.includes(mode==='sunrise'?'values="0 2.8;0 0;0 -2.8':'values="0 -2.8;0 0;0 2.8'));
  }
  assert.match(worldOptionIcon('day'),/<circle cx="12" cy="12" r="4"\/>/);assert.match(worldOptionIcon('day'),/fill="none"/);
  for(const path of lucideWorldPaths.sun)assert.ok(worldOptionIcon('day').includes(`d="${path}"`));
  for(const path of lucideWorldPaths.cloudSun)assert.ok(worldOptionIcon('clear','weather').includes(`d="${path}"`));
  assert.equal(worldOptionIcon('rain','weather'),'');
  assert.match(worldOptionIcon('auto','weather'),/data-weather-morph/);
});

test('changing weather interpolates compatible geometry and holds exact Lucide endpoint drawings',()=>{
  const first=weatherMorphPathData(0).filter(Boolean),last=weatherMorphPathData(1);
  assert.deepEqual([...first].sort(),[...lucideWorldPaths.cloudMoonRain].sort());
  assert.deepEqual(last,lucideWorldPaths.sunSnow);
  const middle=weatherMorphPathData(.5),nearby=weatherMorphPathData(.5001);
  assert.equal(middle.length,11);
  for(const [i,[from,to]]of weatherMorphPaths.entries()){
    assert.equal(from.length,to.length);assert.equal((from.length-2)%6,0);
    assert.ok(from.every(Number.isFinite)&&to.every(Number.isFinite));
    assert.match(middle[i],/^M[\d.-]+ [\d.-]+ C/);
    assert.ok(!middle[i].includes('NaN'));assert.ok(!nearby[i].includes('NaN'));
    const numbers=value=>value.match(/-?\d+(?:\.\d+)?/g).map(Number);
    assert.equal(numbers(middle[i]).length,numbers(nearby[i]).length);
    assert.ok(numbers(middle[i]).every((value,index)=>Math.abs(value-numbers(nearby[i])[index])<.01),'small progress changes cause small geometry changes');
  }
  assert.deepEqual(weatherMorphPathData(-1),weatherMorphPathData(0));assert.deepEqual(weatherMorphPathData(2),last);
});

function fixture({reduced=false}={}){
  class Icon {
    classes=new Set();classList={toggle:(name,on)=>on?this.classes.add(name):this.classes.delete(name),remove:name=>this.classes.delete(name)};
    constructor(weather=false){this.weather=weather;this.paths=Array.from({length:11},()=>({d:'',writes:0,setAttribute(name,value){this[name]=value;if(name==='d')this.writes++;}}));this.animations=weather?[]:Array.from({length:2},()=>({begins:0,ends:0,beginElement(){this.begins++;},endElement(){this.ends++;}}));this.svg={paused:true,pauseAnimations(){this.paused=true;},unpauseAnimations(){this.paused=false;}};}
    hasAttribute(){return this.weather;}querySelectorAll(selector){return selector.includes('animate')?this.animations:this.paths;}querySelector(){return this.svg;}
  }
  const sun=new Icon(),weather=new Icon(true),icons=[sun,weather],root={isConnected:true,querySelectorAll:()=>icons};
  const documentTarget=new EventTarget(),motionMedia=new EventTarget();documentTarget.hidden=false;motionMedia.matches=reduced;
  let clock=0,serial=0,observedCallback,disconnected=false;const timers=new Map(),frames=new Map();
  const controller=mountWorldIcons(root,{documentTarget,motionMedia,
    Observer:class {constructor(callback){observedCallback=callback;}observe(){}disconnect(){disconnected=true;}},
    scheduler:{setTimeout:callback=>{timers.set(++serial,callback);return serial;},clearTimeout:id=>timers.delete(id)},
    request:callback=>{frames.set(++serial,callback);return serial;},cancel:id=>frames.delete(id),now:()=>clock
  });
  return {controller,documentTarget,motionMedia,sun,weather,timers,frames,
    get disconnected(){return disconnected;},
    fireTimer(){const callbacks=[...timers.values()];timers.clear();for(const callback of callbacks)callback();},
    tick(time){clock=time;const callbacks=[...frames.values()];frames.clear();for(const callback of callbacks)callback(clock);},
    visibility(hidden){documentTarget.hidden=hidden;documentTarget.dispatchEvent(new Event('visibilitychange'));},
    intersection(visible){observedCallback(icons.map(target=>({target,isIntersecting:visible})));}
  };
}

test('weather starts moving immediately, holds endpoints without RAF, and suspends offscreen/hidden icons',()=>{
  const f=fixture();assert.equal(f.timers.size,0);assert.equal(f.frames.size,1);assert.ok(f.sun.classes.has('world-icon-running'));
  assert.ok(f.sun.animations.every(animation=>animation.begins===1));assert.equal(f.sun.svg.paused,false);
  f.tick(0);const writes=f.weather.paths[0].writes;
  assert.equal(f.weather.paths[1].opacity,'0','new branches do not pop in as round line-cap dots');
  f.tick(16);assert.equal(f.weather.paths[0].writes,writes);f.tick(34);assert.equal(f.weather.paths[0].writes,writes+1);
  f.tick(900);assert.notDeepEqual(f.weather.paths.map(path=>path.d),weatherMorphPathData(0));assert.notDeepEqual(f.weather.paths.map(path=>path.d),weatherMorphPathData(1),'intermediate frames visibly change the SVG geometry');
  f.tick(1800);assert.equal(f.frames.size,0);assert.equal(f.timers.size,1);assert.deepEqual(f.weather.paths.map(path=>path.d),lucideWorldPaths.sunSnow);
  f.visibility(true);assert.equal(f.timers.size,0);assert.equal(f.frames.size,0);assert.ok(!f.sun.classes.has('world-icon-running'));
  assert.equal(f.sun.svg.paused,true);
  f.visibility(false);assert.equal(f.frames.size,1);assert.equal(f.sun.svg.paused,false);assert.ok(f.sun.animations.every(animation=>animation.begins===1),'visibility resumes native motion without resetting it');
  f.intersection(false);assert.equal(f.frames.size,0);assert.equal(f.sun.svg.paused,true);
  f.intersection(true);f.tick(2100);assert.equal(f.frames.size,1);
  f.controller.dispose();assert.equal(f.frames.size,0);assert.equal(f.timers.size,0);assert.equal(f.disconnected,true);
  f.visibility(false);assert.equal(f.timers.size,0);f.controller.dispose();
});

test('reduced motion keeps static official artwork and preference changes cleanly stop pending animation',()=>{
  const f=fixture({reduced:true});assert.equal(f.frames.size,0);assert.equal(f.timers.size,0);
  assert.deepEqual(f.weather.paths.map(path=>path.d),weatherMorphPathData(0));assert.ok(!f.sun.classes.has('world-icon-running'));
  assert.ok(f.sun.animations.every(animation=>animation.begins===0));
  f.motionMedia.matches=false;f.motionMedia.dispatchEvent(new Event('change'));assert.equal(f.frames.size,1);assert.ok(f.sun.animations.every(animation=>animation.begins===1));
  f.tick(500);f.motionMedia.matches=true;f.motionMedia.dispatchEvent(new Event('change'));
  assert.equal(f.frames.size,0);assert.equal(f.timers.size,0);assert.deepEqual(f.weather.paths.map(path=>path.d),weatherMorphPathData(0));
  f.controller.dispose();
});
