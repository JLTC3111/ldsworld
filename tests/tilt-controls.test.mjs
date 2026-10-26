import test from 'node:test';
import assert from 'node:assert/strict';
import { createTiltControls, screenTilt } from '../src/tilt-controls.js';
import { Driver } from '../src/driving.js';

function fixture(permission='granted'){
  const surface=new EventTarget(),page=new EventTarget(),inputs=[],statuses=[],timers=new Map();let serial=0,requests=0;
  page.hidden=false;surface.isSecureContext=true;surface.DeviceOrientationEvent={requestPermission(){requests++;return Promise.resolve(permission);}};surface.screen={orientation:Object.assign(new EventTarget(),{angle:0})};
  const controller=createTiltControls({window:surface,document:page,onInput:input=>inputs.push(input),onStatus:status=>statuses.push(status),setTimer:(fn,delay)=>{timers.set(++serial,{fn,delay});return serial;},clearTimer:id=>timers.delete(id)});
  return {surface,page,inputs,statuses,timers,controller,get requests(){return requests;},sample(beta,gamma){const event=new Event('deviceorientation');Object.assign(event,{beta,gamma});surface.dispatchEvent(event);}};
}
test('motion permission is requested synchronously from the initiating gesture and denied access stays inactive',async()=>{
  const granted=fixture(),promise=granted.controller.request();assert.equal(granted.requests,1);assert.equal(await promise,true);granted.controller.dispose();
  const denied=fixture('denied');assert.equal(await denied.controller.request(),false);denied.sample(10,30);assert.equal(denied.inputs.length,0);assert.equal(denied.statuses.at(-1),'denied');denied.controller.dispose();
});
test('the first valid reading calibrates, small movements stay neutral, and larger tilt is bounded and smooth',async()=>{
  const f=fixture();await f.controller.request();f.sample(null,null);assert.equal(f.statuses.at(-1),'calibrating');f.sample(40,0);assert.deepEqual(f.inputs.at(-1),{throttle:0,steer:0});
  f.sample(39,2);assert.deepEqual(f.inputs.at(-1),{throttle:0,steer:0});
  f.sample(20,18);assert.ok(f.inputs.at(-1).throttle>0&&f.inputs.at(-1).throttle<1);assert.ok(f.inputs.at(-1).steer>0);
  for(let i=0;i<30;i++)f.sample(-90,90);assert.ok(f.inputs.at(-1).throttle<=1&&f.inputs.at(-1).steer<=1);f.controller.dispose();
});
test('portrait and both landscape orientations produce the same screen-relative driving direction',async()=>{
  const samples=[[0,40,0,20,12],[90,0,-40,12,-20],[270,0,40,-12,20]];
  for(const [angle,beta,gamma,nextBeta,nextGamma]of samples){const f=fixture();f.surface.screen.orientation.angle=angle;await f.controller.request();f.sample(beta,gamma);for(let i=0;i<12;i++)f.sample(nextBeta,nextGamma);assert.ok(f.inputs.at(-1).throttle>.8);assert.ok(f.inputs.at(-1).steer>.4);f.controller.dispose();}
  assert.deepEqual(screenTilt(40,0,0),{pitch:40,roll:0});
});
test('panels, hidden tabs, orientation changes and lost sensor updates clear movement and recalibrate safely',async()=>{
  const f=fixture();await f.controller.request();f.sample(40,0);f.sample(20,12);const timeout=[...f.timers.values()][0];assert.equal(timeout.delay,700);timeout.fn();assert.deepEqual(f.inputs.at(-1),{throttle:0,steer:0});
  f.controller.setPaused(true);f.sample(0,50);assert.deepEqual(f.inputs.at(-1),{throttle:0,steer:0});f.controller.setPaused(false);f.sample(20,12);assert.deepEqual(f.inputs.at(-1),{throttle:0,steer:0});
  f.sample(0,25);f.surface.dispatchEvent(new Event('orientationchange'));assert.deepEqual(f.inputs.at(-1),{throttle:0,steer:0});
  f.sample(20,0);f.sample(0,20);f.page.hidden=true;f.page.dispatchEvent(new Event('visibilitychange'));assert.deepEqual(f.inputs.at(-1),{throttle:0,steer:0});f.controller.dispose();assert.equal(f.timers.size,0);
});
test('unsupported or insecure devices retain tap-to-drive without attempting sensor access',async()=>{
  for(const missing of [true,false]){const f=fixture();if(missing)delete f.surface.DeviceOrientationEvent;else f.surface.isSecureContext=false;assert.equal(await f.controller.request(),false);assert.equal(f.requests,0);assert.equal(f.statuses.at(-1),'unavailable');f.controller.dispose();}
});
test('analog tilt produces proportional acceleration, reversible movement and takeover without cancelling a neutral route',()=>{
  const gentle=new Driver([]),full=new Driver([]);for(let i=0;i<12;i++){gentle.step(1/60,{throttleAxis:.25});full.step(1/60,{forward:true});}assert.ok(gentle.speed>0&&gentle.speed<full.speed*.4);
  const reverse=new Driver([]);for(let i=0;i<12;i++)reverse.step(1/60,{throttleAxis:-.5});assert.ok(reverse.speed<0);
  const route=new Driver([]);route.driveTo(20,4);assert.ok(route.route.length);assert.equal(route.step(1/60,{throttleAxis:0,steerAxis:0}).cancelled,false);assert.equal(route.step(1/60,{throttleAxis:.5,steerAxis:.5}).cancelled,true);
});
