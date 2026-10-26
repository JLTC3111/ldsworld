import test from 'node:test';
import assert from 'node:assert/strict';
import { createExplorationUI } from '../src/exploration-ui.js';

function fixture() {
  const classes=new Set(),bodyClasses=new Set(),timers=new Map(); let id=0,focuses=0,active={};
  const hero={inert:false,ownerDocument:{activeElement:active,body:{classList:{contains:name=>bodyClasses.has(name)}}},contains:node=>node===active,classList:{add:name=>classes.add(name),remove:name=>classes.delete(name)}};
  const badge={hidden:true};
  const ui=createExplorationUI({hero,badge,focusSurface:()=>focuses++,setTimer:(fn,delay)=>{timers.set(++id,{fn,delay});return id;},clearTimer:key=>timers.delete(key)});
  return {hero,badge,ui,classes,bodyClasses,timers,get focuses(){return focuses;}};
}
test('Enjoy the drive expires after ten seconds and status refreshes cannot restart it',()=>{
  const f=fixture();f.ui.setStatus({exploring:true,touring:false});
  assert.equal(f.badge.hidden,false);assert.equal(f.timers.size,1);
  const timer=[...f.timers.values()][0];assert.equal(timer.delay,10000);
  f.ui.setStatus({exploring:true,touring:false});assert.equal(f.timers.size,1);
  timer.fn();assert.equal(f.badge.hidden,true);
  f.ui.setStatus({exploring:true,touring:false});assert.equal(f.badge.hidden,true);
});
test('a live destination retains its stop-tour control after the generic greeting expires',()=>{
  const f=fixture();f.ui.setStatus({exploring:true,touring:true});
  [...f.timers.values()][0].fn();assert.equal(f.badge.hidden,false);
  f.ui.setStatus({exploring:true,touring:false});assert.equal(f.badge.hidden,true);
  f.ui.reset();f.ui.setStatus({exploring:true,touring:false});assert.equal(f.badge.hidden,false);
});
test('Explore hides the complete hero immediately and waits for an actual drive before restoring it',()=>{
  const f=fixture();f.ui.explore();assert.equal(f.ui.heroHidden,true);assert.equal(f.hero.inert,true);assert.equal(f.focuses,1);
  for(let i=0;i<100;i++)f.ui.updateMotion({speed:0,dt:.1});
  assert.equal(f.ui.heroHidden,true,'Idle frames after clicking Explore must not flash the introduction back');
  f.ui.updateMotion({speed:3,dt:.1});f.ui.updateMotion({speed:.2,dt:.1});
  assert.equal(f.ui.heroHidden,true);
  for(let i=0;i<4;i++)f.ui.updateMotion({speed:0,dt:.1});
  assert.equal(f.ui.heroHidden,false);assert.equal(f.hero.inert,false);
});
test('a paused panel, airborne car or jump apex cannot count as a full stop',()=>{
  const f=fixture();f.ui.explore();f.ui.updateMotion({speed:5,dt:.1});
  for(const state of [{paused:true},{airborne:true},{hop:.5}])for(let i=0;i<10;i++)f.ui.updateMotion({...state,dt:.1});
  assert.equal(f.ui.heroHidden,true);
  for(let i=0;i<4;i++)f.ui.updateMotion({speed:0,dt:.1});assert.equal(f.ui.heroHidden,false);
});
test('automatic hero restoration respects an explicitly hidden interface and disposal cancels its timer',()=>{
  const f=fixture();f.ui.setStatus({exploring:true,touring:false});f.ui.explore();f.bodyClasses.add('ui-hidden');
  f.ui.updateMotion({speed:2,dt:.1});for(let i=0;i<4;i++)f.ui.updateMotion({speed:0,dt:.1});
  assert.equal(f.ui.heroHidden,false);assert.equal(f.hero.inert,true);
  f.ui.dispose();assert.equal(f.timers.size,0);
});
