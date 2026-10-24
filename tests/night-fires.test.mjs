import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../src/vendor/three.module.js';
import { createNightFires,nightFirePower,fireLocations } from '../src/night-fires.js';
import { EnvironmentClock } from '../src/environment-state.js';
import { createDynamicBody } from '../src/world-physics.js';

test('fires light at night and are fully extinguished at sunrise and during daylight',()=>{
  const scene=new THREE.Scene(),fires=createNightFires({THREE,scene}),clock=new EnvironmentClock();
  for(const mode of ['day','sunrise','night','day','night']){
    const state=clock.setTimeMode(mode);fires.update(.05,state,fireLocations[0]);
    const lit=mode==='night';assert.equal(nightFirePower(state)>0,lit);
    assert.ok(fires.cans.every(can=>can.flames.visible===lit));
    assert.ok(fires.cans.filter(can=>can.light.visible).length<=2);
    if(!lit)assert.ok(fires.cans.every(can=>can.light.intensity===0));
    else assert.ok(fires.cans[0].light.intensity>5);
  }
  clock.setTimeMode('auto');for(let i=0;i<400;i++)clock.update(.1);
  fires.update(.05,clock.getState(),fireLocations[0]);assert.equal(fires.cans[0].flames.visible,nightFirePower(clock.getState())>.005);
  fires.dispose();assert.equal(fires.root.parent,null);
});

test('flames follow a movable can while the physical body excludes flame and light effects',()=>{
  const scene=new THREE.Scene(),fires=createNightFires({THREE,scene}),can=fires.cans[0];
  const body=createDynamicBody({THREE,object:can.object,parent:scene,id:'fire-test',mass:2.4,kind:'trash-can'});
  assert.ok(body.height>.8&&body.height<1.1);assert.ok(body.radius<.55);
  body.object.position.x+=6;body.object.updateMatrixWorld(true);
  const actual=can.object.getWorldPosition(new THREE.Vector3());fires.update(.05,{night:1},{x:actual.x,z:actual.z});
  assert.equal(can.flames.visible,true);assert.equal(can.light.visible,true);assert.ok(can.position.distanceTo(actual)<1e-8);
  const resources=new Set();for(const can of fires.cans)can.object.traverse(o=>{if(o.geometry)resources.add(o.geometry);if(o.material)resources.add(o.material);});
  const releases=new Map();resources.forEach(resource=>resource.addEventListener('dispose',()=>releases.set(resource,(releases.get(resource)||0)+1)));
  fires.dispose();fires.dispose();assert.ok([...resources].every(resource=>releases.get(resource)===1));assert.equal(can.object.parent,null);
});
