import test from 'node:test';
import assert from 'node:assert/strict';
import {createTouchDriving} from '../src/touch-driving.js';
import {Driver,angleDifference} from '../src/driving.js';

class Button extends EventTarget {
  constructor(action){super();this.dataset={thumbAction:action};this.attributes={};this.captured=new Set();}
  setAttribute(k,v){this.attributes[k]=v;}
  closest(){return this;}
  setPointerCapture(id){this.captured.add(id);}
  hasPointerCapture(id){return this.captured.has(id);}
  releasePointerCapture(id){this.captured.delete(id);this.dispatchEvent(pointer('lostpointercapture',id));}
}
const pointer=(type,id,values={})=>Object.assign(new Event(type,{cancelable:true}),{pointerId:id,button:0,clientX:0,clientY:0,...values});
function fixture(){
  const buttons=Object.fromEntries(['forward','reverse','left','right'].map(k=>[k,new Button(k)]));
  const root={querySelectorAll:()=>Object.values(buttons),contains:button=>Object.values(buttons).includes(button)},page=new EventTarget(),surface=new EventTarget(),inputs=[];page.hidden=false;surface.screen={orientation:new EventTarget()};
  const controls=createTouchDriving({root,document:page,window:surface,onInput:input=>inputs.push(input)});
  return {buttons,root,page,surface,inputs,controls,latest:()=>inputs.at(-1),press:(key,id)=>buttons[key].dispatchEvent(pointer('pointerdown',id)),release:(key,id,type='pointerup')=>buttons[key].dispatchEvent(pointer(type,id))};
}

test('independent thumbs hold movement and steering simultaneously and release each axis independently',()=>{
  const f=fixture();f.press('forward',1);assert.equal(f.inputs.length,0);f.controls.setEnabled(true);
  f.press('forward',1);f.press('right',2);assert.deepEqual(f.latest(),{throttle:1,steer:1,smoothDrive:true});assert.equal(f.buttons.forward.attributes['aria-pressed'],'true');
  f.release('forward',1);assert.deepEqual(f.latest(),{throttle:0,steer:1,smoothDrive:true});assert.equal(f.buttons.forward.attributes['aria-pressed'],'false');
  f.release('right',2);assert.deepEqual(f.latest(),{throttle:0,steer:0,smoothDrive:true});f.controls.dispose();
});

test('a captured thumb can slide between directions without a second finger conflicting on the same pad',()=>{
  const f=fixture();f.controls.setEnabled(true);f.press('forward',1);f.press('reverse',2);assert.equal(f.latest().throttle,1);
  f.page.elementFromPoint=()=>f.buttons.reverse;f.buttons.forward.dispatchEvent(pointer('pointermove',1));assert.equal(f.latest().throttle,-1);assert.equal(f.buttons.reverse.attributes['aria-pressed'],'true');
  f.press('left',3);assert.equal(f.latest().steer,-1);f.release('forward',1);assert.equal(f.latest().throttle,0);assert.equal(f.latest().steer,-1);f.controls.dispose();
});

test('cancellation and lost capture cannot leave either control held',()=>{
  const f=fixture();f.controls.setEnabled(true);f.press('reverse',1);f.press('left',2);f.release('reverse',1,'pointercancel');assert.equal(f.latest().throttle,0);assert.equal(f.latest().steer,-1);
  f.release('left',2,'lostpointercapture');assert.equal(f.latest().steer,0);f.controls.dispose();
});

test('menus, visibility changes, rotation and interruptions clear inputs without automatically resuming a held thumb',()=>{
  const f=fixture();f.controls.setEnabled(true);
  for(const type of ['blur','resize','orientationchange']){f.press('forward',1);f.press('right',2);f.surface.dispatchEvent(new Event(type));assert.deepEqual(f.latest(),{throttle:0,steer:0,smoothDrive:true});}
  f.press('forward',1);f.surface.screen.orientation.dispatchEvent(new Event('change'));assert.equal(f.latest().throttle,0);
  f.press('forward',1);f.controls.setPaused(true);assert.equal(f.root.hidden,true);assert.equal(f.buttons.forward.disabled,true);assert.equal(f.latest().throttle,0);
  f.controls.setPaused(false);assert.equal(f.root.hidden,false);assert.equal(f.latest().throttle,0);f.press('forward',1);f.page.hidden=true;f.page.dispatchEvent(new Event('visibilitychange'));assert.equal(f.latest().throttle,0);
  f.controls.dispose();const count=f.inputs.length;f.controls.dispose();f.controls.setEnabled(true);f.press('forward',9);assert.equal(f.inputs.length,count);assert.equal(f.root.hidden,true);
});

test('touch steering works during forward and reverse travel with natural reverse steering',()=>{
  const headings=[];
  for(const throttleAxis of [1,-1]){const d=new Driver();d.heading=d.velocityHeading=0;for(let i=0;i<60;i++)d.step(1/60,{throttleAxis,steerAxis:-1,smoothDrive:true});assert.equal(Math.sign(d.speed),throttleAxis);headings.push(angleDifference(d.heading,0));}
  assert.ok(headings[0]>0);assert.ok(headings[1]<0);
});

test('changing between forward and reverse reaches a stopped step before opposite travel',()=>{
  for(const sign of [1,-1]){const d=new Driver();d.heading=d.velocityHeading=0;d.speed=sign*6;let stopped=false;
    for(let i=0;i<120;i++){d.step(1/60,{throttleAxis:-sign,smoothDrive:true});if(d.speed===0){stopped=true;break;}assert.equal(Math.sign(d.speed),sign);}
    assert.ok(stopped);d.step(1/60,{throttleAxis:-sign,smoothDrive:true});assert.equal(Math.sign(d.speed),-sign);
  }
});

test('releasing both pads coasts smoothly to a complete stop and straightens the wheels',()=>{
  const d=new Driver();d.heading=d.velocityHeading=0;for(let i=0;i<45;i++)d.step(1/60,{throttleAxis:1,steerAxis:.3,smoothDrive:true});const speed=d.speed;assert.ok(speed>2);assert.ok(Math.abs(d.steering)>.1);
  d.step(1/60,{smoothDrive:true});assert.ok(d.speed>0&&d.speed<speed);for(let i=0;i<300;i++)d.step(1/60,{smoothDrive:true});assert.equal(d.speed,0);assert.ok(Math.abs(d.steering)<1e-9);
});
