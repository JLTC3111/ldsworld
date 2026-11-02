import test from 'node:test';
import assert from 'node:assert/strict';
import { deviceBudget,pixelRatioFor,createAdaptiveBudget,createRenderLoop } from '../src/render-budget.js';

test('known constrained hardware and data saver use smaller rendering budgets; unknown devices stay balanced',()=>{
  assert.equal(deviceBudget().lowPower,false);
  for(const hints of [{hardwareConcurrency:4},{deviceMemory:2},{saveData:true}]){
    const budget=deviceBudget(hints);assert.equal(budget.lowPower,true);assert.equal(budget.maxFps,30);assert.equal(budget.shadowSize,512);
  }
  const budget=deviceBudget({hardwareConcurrency:8,deviceMemory:8,coarse:true});
  assert.equal(budget.lowPower,false);assert.equal(budget.maxFps,60);
  for(const [width,height,dpr] of [[390,844,3],[1920,1080,2],[3840,2160,2]]){
    const ratio=pixelRatioFor(width,height,dpr,budget);
    assert.ok(width*height*ratio*ratio<=budget.maxPixels+1);
    assert.ok(ratio<=budget.maxPixelRatio&&ratio<=dpr);
  }
});

test('quality adapts after sustained slow frames, ignores isolated spikes, and remains bounded',()=>{
  const quality=createAdaptiveBudget(deviceBudget());
  for(let i=0;i<300;i++)assert.equal(quality.sample(i%100===0?240:16.7),false);
  quality.reset();const original=quality.current;
  let changes=0;
  for(let i=0;i<80;i++)changes+=quality.sample(40);
  assert.equal(changes,1);assert.ok(quality.current.maxPixels<original.maxPixels);
  quality.reset();for(let i=0;i<30;i++)assert.equal(quality.sample(40),false);
  quality.reset();assert.equal(quality.sample(10000),false);
  for(let i=0;i<500;i++)changes+=quality.sample(60);
  assert.equal(changes,2);assert.equal(quality.current.maxFps,30);
  const stalled=createAdaptiveBudget(deviceBudget());let degraded=false;
  for(let i=0;i<30;i++)degraded=stalled.sample(500)||degraded;
  assert.equal(degraded,true,'sustained frames over 250ms also reduce quality');
});

test('render loop caps high refresh, sleeps while paused/hidden and resumes without elapsed hidden time',()=>{
  let time=0,sequence=0;const pending=new Map(),frames=[];
  const loop=createRenderLoop({frame:(...args)=>frames.push(args),now:()=>time,request:callback=>{pending.set(++sequence,callback);return sequence;},cancel:id=>pending.delete(id)});
  function tick(delta){time+=delta;const callbacks=[...pending.values()];pending.clear();callbacks.forEach(callback=>callback(time));}
  loop.invalidate();loop.invalidate();assert.equal(pending.size,1);
  for(let i=0;i<120;i++)tick(1000/120);
  assert.ok(frames.length>=59&&frames.length<=61);
  loop.setPaused(true);tick(17);assert.equal(frames.at(-1)[1],0);assert.equal(pending.size,0);
  loop.invalidate();tick(17);assert.equal(pending.size,0);
  const count=frames.length;loop.setVisible(false);loop.invalidate();tick(60000);assert.equal(frames.length,count);
  loop.setVisible(true);tick(17);assert.equal(frames.at(-1)[1],0);assert.equal(pending.size,0);
  loop.setPaused(false);tick(17);assert.ok(frames.at(-1)[1]<.02);assert.equal(pending.size,1);
  loop.dispose();assert.equal(pending.size,0);loop.invalidate();assert.equal(pending.size,0);
});

test('30fps budget leaves simulation elapsed time intact between rendered frames',()=>{
  let time=0,pending;const elapsed=[];
  const loop=createRenderLoop({frame:(_,dt)=>elapsed.push(dt),maxFps:()=>30,now:()=>time,request:cb=>{pending=cb;return 1;},cancel:()=>{pending=null;}});
  loop.invalidate();for(let i=0;i<60;i++){time+=1000/60;const cb=pending;pending=null;cb?.(time);}
  assert.ok(elapsed.length>=29&&elapsed.length<=31);assert.ok(elapsed.reduce((a,b)=>a+b,0)>.96);loop.dispose();
});
