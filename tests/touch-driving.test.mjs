import test from 'node:test';
import assert from 'node:assert/strict';
import {createTouchDriving} from '../src/touch-driving.js';
import {Driver,angleDifference} from '../src/driving.js';

class Button extends EventTarget {
  constructor(action){super();this.dataset={thumbAction:action};this.attributes={};this.captured=new Set();}
  setAttribute(k,v){this.attributes[k]=v;}
  closest(){return this;}
  getBoundingClientRect(){return {left:0,top:0,width:44,height:44};}
  setPointerCapture(id){this.captured.add(id);}
  hasPointerCapture(id){return this.captured.has(id);}
  releasePointerCapture(id){this.captured.delete(id);this.dispatchEvent(pointer('lostpointercapture',id));}
}
const pointer=(type,id,values={})=>Object.assign(new Event(type,{cancelable:true}),{pointerId:id,button:0,clientX:0,clientY:0,...values});
function fixture(){
  const buttons=Object.fromEntries(['forward','reverse','left','right'].map(k=>[k,new Button(k)]));
  const steeringPad=new Button();steeringPad.getBoundingClientRect=()=>({left:200,top:200,width:112,height:112});steeringPad.contains=button=>[buttons.left,buttons.right].includes(button);steeringPad.style={setProperty:(k,v)=>steeringPad.attributes[k]=v};steeringPad.toggleAttribute=(k,v)=>steeringPad.attributes[k]=v;
  const movementPad=new Button();movementPad.getBoundingClientRect=()=>({left:0,top:200,width:112,height:112});movementPad.contains=button=>[buttons.forward,buttons.reverse].includes(button);
  const root={querySelector:selector=>selector==='[data-steering-pad]'?steeringPad:selector==='[data-movement-pad]'?movementPad:null,querySelectorAll:()=>Object.values(buttons),contains:button=>Object.values(buttons).includes(button)},page=new EventTarget(),surface=new EventTarget(),inputs=[];page.hidden=false;surface.screen={orientation:new EventTarget()};
  const controls=createTouchDriving({root,document:page,window:surface,onInput:input=>inputs.push(input)});
  return {buttons,steeringPad,movementPad,root,page,surface,inputs,controls,latest:()=>inputs.at(-1),press:(key,id)=>['left','right'].includes(key)?steeringPad.dispatchEvent(pointer('pointerdown',id,{clientX:256+(key==='left'?-34:34),clientY:256})):movementPad.dispatchEvent(pointer('pointerdown',id,{clientX:56,clientY:256+(key==='forward'?-28:28)})),release:(key,id,type='pointerup')=>(['left','right'].includes(key)?steeringPad:movementPad).dispatchEvent(pointer(type,id)),move:(x,y,id=2)=>steeringPad.dispatchEvent(pointer('pointermove',id,{clientX:256+x,clientY:256+y})),moveMovement:(x,y,id=1)=>movementPad.dispatchEvent(pointer('pointermove',id,{clientX:56+x,clientY:256+y}))};
}

test('independent thumbs hold movement and steering simultaneously and release each axis independently',()=>{
  const f=fixture();f.press('forward',1);assert.equal(f.inputs.length,0);f.controls.setEnabled(true);
  f.press('forward',1);f.press('right',2);assert.deepEqual(f.latest(),{throttle:1,steer:1,smoothDrive:true});assert.equal(f.buttons.forward.attributes['aria-pressed'],'true');
  f.release('forward',1);assert.deepEqual(f.latest(),{throttle:0,steer:1,smoothDrive:true});assert.equal(f.buttons.forward.attributes['aria-pressed'],'false');
  f.release('right',2);assert.deepEqual(f.latest(),{throttle:0,steer:0,smoothDrive:true});f.controls.dispose();
});

test('a captured thumb can slide between directions without a second finger conflicting on the same pad',()=>{
  const f=fixture();f.controls.setEnabled(true);f.press('forward',1);f.press('reverse',2);assert.equal(f.latest().throttle,1);
  f.moveMovement(0,28);assert.equal(f.latest().throttle,-1);assert.equal(f.buttons.reverse.attributes['aria-pressed'],'true');
  f.press('left',3);assert.equal(f.latest().steer,-1);f.release('forward',1);assert.equal(f.latest().throttle,0);assert.equal(f.latest().steer,-1);f.controls.dispose();
});

test('blank movement-pad edges capture input and cross through neutral without releasing steering',()=>{
  const f=fixture();f.controls.setEnabled(true);f.press('right',2);f.move(17,0);const steer=f.latest().steer;
  const press=pointer('pointerdown',1,{clientX:1,clientY:201});f.movementPad.dispatchEvent(press);
  assert.equal(press.defaultPrevented,true);assert.equal(f.movementPad.hasPointerCapture(1),true);
  assert.deepEqual(f.latest(),{throttle:1,steer,smoothDrive:true});assert.equal(f.buttons.forward.attributes['aria-pressed'],'true');
  for(const offset of [-4,0,4]){
    f.moveMovement(-55,offset);assert.deepEqual(f.latest(),{throttle:0,steer,smoothDrive:true});
    assert.equal(f.buttons.forward.attributes['aria-pressed'],'false');assert.equal(f.buttons.reverse.attributes['aria-pressed'],'false');
    assert.equal(f.movementPad.hasPointerCapture(1),true,'a neutral gap retains ownership');
  }
  f.moveMovement(55,55);assert.deepEqual(f.latest(),{throttle:-1,steer,smoothDrive:true});assert.equal(f.buttons.reverse.attributes['aria-pressed'],'true');
  f.release('reverse',1);assert.deepEqual(f.latest(),{throttle:0,steer,smoothDrive:true});assert.equal(f.movementPad.hasPointerCapture(1),false);f.controls.dispose();
});

test('a press in the movement-pad center is captured as neutral and can slide into either direction',()=>{
  const f=fixture();f.controls.setEnabled(true);f.press('left',2);
  const press=pointer('pointerdown',1,{clientX:56,clientY:256});f.movementPad.dispatchEvent(press);
  assert.equal(press.defaultPrevented,true);assert.equal(f.movementPad.hasPointerCapture(1),true);assert.deepEqual(f.latest(),{throttle:0,steer:-1,smoothDrive:true});
  f.press('forward',3);f.moveMovement(0,-28,3);assert.equal(f.latest().throttle,0,'a competing thumb cannot take over a neutral held pad');
  f.moveMovement(0,-5);assert.equal(f.latest().throttle,1);assert.equal(f.latest().steer,-1);
  f.moveMovement(0,0);assert.equal(f.latest().throttle,0);f.moveMovement(0,5);assert.equal(f.latest().throttle,-1);
  f.release('forward',3);assert.equal(f.latest().throttle,-1);f.release('reverse',1,'pointercancel');assert.deepEqual(f.latest(),{throttle:0,steer:-1,smoothDrive:true});assert.equal(f.movementPad.hasPointerCapture(1),false);f.controls.dispose();
});

test('cancellation and lost capture cannot leave either control held',()=>{
  const f=fixture();f.controls.setEnabled(true);f.press('reverse',1);f.press('left',2);f.release('reverse',1,'pointercancel');assert.equal(f.latest().throttle,0);assert.equal(f.latest().steer,-1);
  f.release('left',2,'lostpointercapture');assert.equal(f.latest().steer,0);f.controls.dispose();
});

test('circular steering preserves every angle and clamps diagonals radially with either movement direction',()=>{
  const f=fixture();f.controls.setEnabled(true);
  for(const movement of ['forward','reverse']){
    f.press(movement,1);f.press('right',2);assert.equal(f.steeringPad.hasPointerCapture(2),true);
    for(let degrees=0;degrees<=720;degrees+=5){
      const angle=degrees*Math.PI/180;f.move(34*Math.cos(angle),34*Math.sin(angle));
      assert.ok(Math.abs(f.latest().steer-Math.cos(angle))<1e-12,`${movement} at ${degrees}°`);
      assert.equal(f.latest().throttle,movement==='forward'?1:-1);
    }
    f.move(340,340);assert.ok(Math.abs(f.latest().steer-Math.SQRT1_2)<1e-12);
    assert.ok(Math.abs(parseFloat(f.steeringPad.attributes['--steer-x'])-34*Math.SQRT1_2)<1e-12);
    f.release('right',2);f.release(movement,1);
  }
  f.controls.dispose();
});

test('small steering motions produce gentle turns and the center is neutral without a release',()=>{
  const f=fixture();f.controls.setEnabled(true);f.press('forward',1);f.press('right',2);
  f.move(17,0);assert.ok(f.latest().steer>.45&&f.latest().steer<.5);
  f.move(-8.5,0);assert.ok(f.latest().steer<-.2&&f.latest().steer>-.21);
  for(const [x,y] of [[0,0],[1,1],[-1,-1],[0,34],[0,-34]]){f.move(x,y);assert.equal(f.latest().steer,0);assert.equal(f.latest().throttle,1);}
  f.release('right',2);assert.equal(f.steeringPad.attributes['--steer-x'],'0px');assert.equal(f.steeringPad.attributes['--steer-y'],'0px');assert.equal(f.steeringPad.attributes['data-active'],false);
  f.controls.dispose();
});

test('one captured steering thumb crosses between directions and ignores a competing finger',()=>{
  const f=fixture();f.controls.setEnabled(true);f.press('left',2);f.press('right',3);f.move(34,0,3);assert.equal(f.latest().steer,-1);
  f.move(0,-34);assert.equal(f.latest().steer,0);f.move(34,0);assert.equal(f.latest().steer,1);assert.equal(f.buttons.left.attributes['aria-pressed'],'false');assert.equal(f.buttons.right.attributes['aria-pressed'],'true');
  f.release('right',3);assert.equal(f.latest().steer,1);f.release('left',2);assert.equal(f.latest().steer,0);assert.equal(f.steeringPad.hasPointerCapture(2),false);f.controls.dispose();
});

test('steering arrow keyboard support remains independent of a held movement thumb',()=>{
  const f=fixture();f.controls.setEnabled(true);f.press('reverse',1);
  const key=type=>Object.assign(new Event(type,{cancelable:true}),{key:' ',repeat:false});
  f.buttons.left.dispatchEvent(key('keydown'));assert.deepEqual(f.latest(),{throttle:-1,steer:-1,smoothDrive:true});
  f.buttons.left.dispatchEvent(key('keyup'));assert.equal(f.latest().steer,0);assert.equal(f.latest().throttle,-1);
  f.buttons.right.dispatchEvent(key('keydown'));assert.equal(f.latest().steer,1);f.buttons.right.dispatchEvent(new Event('blur'));assert.equal(f.latest().steer,0);f.controls.dispose();
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
