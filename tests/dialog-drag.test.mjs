import test from 'node:test';
import assert from 'node:assert/strict';
import {createDialogDrag} from '../src/dialog-drag.js';

class Element extends EventTarget{
  open=true;style={};classes=new Set();classList={add:value=>this.classes.add(value),remove:value=>this.classes.delete(value)};
  closest(){return null;}
  setPointerCapture(id){this.capture=id;}
  hasPointerCapture(id){return this.capture===id;}
  releasePointerCapture(){this.capture=null;}
}
const emit=(target,type,values={})=>{const event=new Event(type,{cancelable:true});for(const[key,value]of Object.entries({button:0,pointerId:1,clientX:0,clientY:0,...values}))Object.defineProperty(event,key,{value});target.dispatchEvent(event);return event;};
function fixture(){
  const dialog=new Element(),handle=new Element(),keyboardHandle=new Element(),viewport=new Element();viewport.innerWidth=1000;viewport.innerHeight=800;
  dialog.getBoundingClientRect=()=>{const[x,y]=(dialog.style.translate||'0px 0px').split(' ').map(parseFloat);return{left:200+x,top:100+y,width:600,height:500};};
  const drag=createDialogDrag({dialog,handle,keyboardHandle,viewport});return{dialog,handle,keyboardHandle,viewport,drag};
}

test('dragging the header moves the complete modal, preserves a reachable header and finishes on release',()=>{
  const f=fixture();assert.equal(emit(f.handle,'pointerdown',{clientX:250,clientY:120}).defaultPrevented,true);assert.equal(f.dialog.classes.has('is-dragging'),true);assert.equal(f.handle.capture,1);
  emit(f.handle,'pointermove',{clientX:300,clientY:160});assert.equal(f.dialog.style.translate,'50px 40px');
  emit(f.handle,'pointermove',{clientX:9999,clientY:9999});assert.equal(f.dialog.style.translate,'192px 192px');
  emit(f.handle,'pointerup');assert.equal(f.dialog.classes.has('is-dragging'),false);assert.equal(f.handle.capture,null);
  emit(f.handle,'pointermove',{clientX:0,clientY:0});assert.equal(f.dialog.style.translate,'192px 192px');
  f.dialog.open=false;emit(f.dialog,'close');assert.equal(f.dialog.style.translate,'');f.drag.dispose();
});

test('header buttons, scrollable content, and other pointers never turn into modal drags',()=>{
  const f=fixture(),button=new Element();button.closest=()=>button;
  assert.equal(emit(f.handle,'pointerdown',{target:button}).defaultPrevented,false);assert.equal(f.dialog.style.translate,undefined);
  emit(f.handle,'pointerdown');emit(f.handle,'pointermove',{pointerId:2,clientX:40});assert.equal(f.dialog.style.translate,undefined);
  emit(f.handle,'pointercancel');assert.equal(f.dialog.classes.has('is-dragging'),false);f.drag.dispose();
});

test('the focused move handle supports keyboard movement, reset and cleanup without stealing reader arrow keys',()=>{
  const f=fixture();assert.equal(emit(f.keyboardHandle,'keydown',{key:'ArrowRight'}).defaultPrevented,true);assert.equal(f.dialog.style.translate,'12px 0px');
  emit(f.keyboardHandle,'keydown',{key:'ArrowDown',shiftKey:true});assert.equal(f.dialog.style.translate,'12px 40px');
  emit(f.keyboardHandle,'keydown',{key:'Home'});assert.equal(f.dialog.style.translate,'');
  assert.equal(emit(f.keyboardHandle,'keydown',{key:'ArrowDown',target:new Element()}).defaultPrevented,false);
  f.drag.dispose();assert.equal(emit(f.handle,'pointerdown').defaultPrevented,false);
});
