import test from 'node:test';
import assert from 'node:assert/strict';
import { createDrivingHud } from '../src/driving-hud.js';

function fixture(){
  const classes=new Set(),active={};let focuses=0;
  const overlays=[{inert:false,contains:node=>node===active},{inert:false,contains:()=>false}];
  const page={activeElement:active,body:{classList:{toggle(name,value){value?classes.add(name):classes.delete(name);}}},querySelectorAll:()=>overlays,querySelector:()=>({focus(){focuses++;}})};
  return {hud:createDrivingHud({document:page}),overlays,classes,get focuses(){return focuses;}};
}
test('movement hides every overlay, transfers focus to the car, and restores controls after settling',()=>{
  const f=fixture();f.hud.update({speed:2});assert.ok(f.hud.hidden&&f.classes.has('is-driving'));assert.ok(f.overlays.every(o=>o.inert));assert.equal(f.focuses,1);
  f.hud.update({speed:0,elapsed:.05});assert.ok(f.hud.hidden,'A collision or momentary pause should not flash all overlays');
  for(let i=0;i<8;i++)f.hud.update({speed:0,elapsed:.1});
  assert.equal(f.hud.hidden,false);assert.ok(f.overlays.every(o=>!o.inert));
});
test('a dialog, Escape reveal, or disposal always makes controls available again',()=>{
  const f=fixture();f.hud.update({speed:4});f.hud.update({speed:4,panelOpen:true});assert.equal(f.hud.hidden,false);
  f.hud.update({speed:4});f.hud.reveal();f.hud.update({speed:4});assert.equal(f.hud.hidden,false);
  f.hud.engage();f.hud.update({speed:4});assert.equal(f.hud.hidden,true,'A fresh driving input hides overlays again immediately after Escape');
  for(let i=0;i<8;i++)f.hud.update({speed:0,elapsed:.1});
  f.hud.update({speed:4});assert.equal(f.hud.hidden,true);
  f.hud.dispose();assert.equal(f.hud.hidden,false);assert.ok(f.overlays.every(o=>!o.inert));
});
