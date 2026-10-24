import test from 'node:test';
import assert from 'node:assert/strict';
import { EnvironmentClock } from '../src/environment-state.js';
import { getScenePresentation } from '../src/scene-presentation.js';

function luminance(hex) {
  const rgb=hex.slice(1).match(/../g).map(value=>parseInt(value,16)/255).map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4);
  return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;
}
function contrast(a,b) { const x=luminance(a), y=luminance(b); return (Math.max(x,y)+.05)/(Math.min(x,y)+.05); }

test('world-facing title and supporting text remain readable through the full day and every weather',()=>{
  for(let hour=0;hour<24;hour+=.1)for(const weather of ['clear','rain','snow']) {
    const clock=new EnvironmentClock({phase:hour/24});clock.setWeather(weather);
    const style=getScenePresentation(clock.getState());
    assert.ok(contrast(style.ink,style.wash)>=4.5,`Title at ${hour}/${weather}`);
    assert.ok(contrast(style.muted,style.wash)>=4.5,`Supporting text at ${hour}/${weather}`);
  }
});

test('sunrise, sunset, rain, and night follow the world clock rather than a saved interface theme',()=>{
  const clock=new EnvironmentClock(), snapshots={};
  for(const phase of ['sunrise','day','sunset','night'])snapshots[phase]=getScenePresentation(clock.setTimeMode(phase));
  assert.notEqual(snapshots.sunrise.wash,snapshots.day.wash);
  assert.notEqual(snapshots.sunset.wash,snapshots.day.wash);
  assert.notEqual(snapshots.night.ink,snapshots.day.ink);
  clock.setTimeMode('day');const rain=getScenePresentation(clock.setWeather('rain'));
  assert.notEqual(rain.wash,snapshots.day.wash);
  const before=clock.getState();
  assert.deepEqual(getScenePresentation({...before,interfaceTheme:'light'}),getScenePresentation({...before,interfaceTheme:'dark'}));
});
