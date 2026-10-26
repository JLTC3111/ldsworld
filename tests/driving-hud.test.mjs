import test from 'node:test';
import assert from 'node:assert/strict';
import { createDrivingHud } from '../src/driving-hud.js';

function fixture(){
  const classes=new Set(),active={};let focuses=0;
  const overlays=[{inert:false,contains:node=>node===active},{inert:false,contains:()=>false}];
  const page={activeElement:active,body:{classList:{toggle(name,value){value?classes.add(name):classes.delete(name);}}},querySelectorAll:()=>overlays,querySelector:()=>({focus(){focuses++;}})};
  return {hud:createDrivingHud({document:page}),overlays,classes,get focuses(){return focuses;}};
}
test('the interface starts visible and only an explicit toggle hides every overlay and moves focus safely',()=>{
  const f=fixture();assert.equal(f.hud.hidden,false);assert.ok(f.overlays.every(o=>!o.inert));assert.equal(f.focuses,0);
  assert.equal(f.hud.toggle(),true);assert.ok(f.hud.hidden&&f.classes.has('ui-hidden'));assert.ok(f.overlays.every(o=>o.inert));assert.equal(f.focuses,1);
  assert.equal(f.hud.toggle(),false);assert.equal(f.hud.hidden,false);assert.equal(f.classes.has('ui-hidden'),false);assert.ok(f.overlays.every(o=>!o.inert));
});
test('explicit reveal and disposal restore every control without an automatic motion-driven visibility state',()=>{
  const f=fixture();f.hud.toggle();f.hud.reveal();assert.equal(f.hud.hidden,false);assert.ok(f.overlays.every(o=>!o.inert));
  f.hud.toggle();assert.equal(f.hud.hidden,true);
  f.hud.dispose();assert.equal(f.hud.hidden,false);assert.ok(f.overlays.every(o=>!o.inert));
});
