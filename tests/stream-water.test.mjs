import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../src/vendor/three.module.js';
import { createStreamWater } from '../src/stream-water.js';
import { riverCenter } from '../src/world-layout.js';

test('the shallow stream has a visible bed, animated surface, reflection uniforms and car wakes',()=>{
  const scene=new THREE.Scene();scene.background=new THREE.Color('#dce8e3');const stream=createStreamWater({THREE,parent:scene,scene});
  const water=stream.surface,bed=stream.root.getObjectByName('Visible shallow stream bed'),before=water.geometry.attributes.position.getY(10);
  assert.ok(bed);assert.equal(water.material.transparent,true);assert.equal(water.material.depthWrite,false);
  stream.update(.1,{driver:{x:8,z:riverCenter(8),speed:4,hop:0},daylight:1,sunHeight:.8});
  assert.notEqual(water.geometry.attributes.position.getY(10),before);assert.ok(water.material.uniforms.uRipples.value.some(r=>r.w>.5));
  assert.ok(water.material.uniforms.uSky.value.equals(scene.background));
  for(const value of water.geometry.attributes.position.array)assert.ok(Number.isFinite(value));
  stream.reset();assert.ok(water.material.uniforms.uRipples.value.every(r=>r.w===0));stream.dispose();assert.equal(stream.root.parent,null);
});

test('reduced motion keeps water and reflections without animated waves or wakes',()=>{
  const scene=new THREE.Scene(),stream=createStreamWater({THREE,parent:scene,scene,reducedMotion:true});
  const before=[...stream.surface.geometry.attributes.position.array];
  stream.update(.1,{driver:{x:8,z:riverCenter(8),speed:5},night:1,daylight:0});
  assert.deepEqual([...stream.surface.geometry.attributes.position.array],before);assert.equal(stream.surface.material.uniforms.uDaylight.value,0);
  assert.ok(stream.surface.material.uniforms.uRipples.value.every(r=>r.w===0));stream.dispose();
});
