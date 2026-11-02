import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../src/vendor/three.module.js';
import { createStreamWater } from '../src/stream-water.js';
import { riverCenter } from '../src/world-layout.js';

test('the shallow stream has a visible bed, animated surface, reflection uniforms and car wakes',()=>{
  const scene=new THREE.Scene();scene.background=new THREE.Color('#dce8e3');const stream=createStreamWater({THREE,parent:scene,scene});
  const water=stream.surface,bed=stream.root.getObjectByName('Visible shallow stream bed'),before=water.material.uniforms.uTime.value;
  assert.ok(bed);assert.equal(water.material.transparent,true);assert.equal(water.material.depthWrite,false);
  stream.update(.1,{driver:{x:8,z:riverCenter(8),speed:4,hop:0},daylight:1,sunHeight:.8});
  assert.ok(water.material.uniforms.uTime.value>before);assert.ok(water.material.uniforms.uRipples.value.some(r=>r.w>.5));
  assert.ok(water.material.uniforms.uSky.value.equals(scene.background));
  for(const value of water.geometry.attributes.position.array)assert.ok(Number.isFinite(value));
  stream.reset();assert.equal(water.material.uniforms.uTime.value,0);assert.ok(water.material.uniforms.uRipples.value.every(r=>r.w===0));stream.dispose();assert.equal(stream.root.parent,null);
});

test('GPU waves retain static buffers and conservative bounds across updates and paused frames',()=>{
  const scene=new THREE.Scene(),stream=createStreamWater({THREE,parent:scene,scene}),water=stream.surface;
  const position=water.geometry.attributes.position,before=position.array.slice(),version=position.version;
  const box=water.geometry.boundingBox.clone(),sphere=water.geometry.boundingSphere.clone();
  assert.equal(water.material.uniforms.uWaveAmount.value,1);
  assert.match(water.material.vertexShader,/displaced\.y\+=uWaveAmount/);
  assert.match(water.material.vertexShader,/modelMatrix\*vec4\(displaced,1\.0\)/);
  for(let frame=0;frame<120;frame++)stream.update(1/60,{weather:'rain',daylight:.4});
  assert.deepEqual(position.array,before);assert.equal(position.version,version);
  assert.equal(water.material.uniforms.uRain.value,1);assert.equal(water.material.uniforms.uDaylight.value,.4);
  const time=water.material.uniforms.uTime.value;stream.update(0);assert.equal(water.material.uniforms.uTime.value,time);
  assert.ok(water.geometry.boundingBox.equals(box));assert.ok(water.geometry.boundingSphere.equals(sphere));
  // Sample the same two waves used in the shader across the authored river.
  const point=new THREE.Vector3();
  for(let i=0;i<position.count;i++)for(const t of [0,.5,2,10]){
    point.fromBufferAttribute(position,i);
    point.y+=Math.sin(point.x*1.8-t*1.6+point.z*2)*.009+Math.sin(point.x*5.4+t*.7)*.003;
    assert.ok(box.containsPoint(point));assert.ok(sphere.containsPoint(point));
  }
  stream.dispose();
});

test('reduced motion keeps water and reflections without animated waves or wakes',()=>{
  const scene=new THREE.Scene(),stream=createStreamWater({THREE,parent:scene,scene,reducedMotion:true});
  const before=[...stream.surface.geometry.attributes.position.array];
  stream.update(.1,{driver:{x:8,z:riverCenter(8),speed:5},night:1,daylight:0});
  assert.deepEqual([...stream.surface.geometry.attributes.position.array],before);assert.equal(stream.surface.material.uniforms.uDaylight.value,0);
  assert.equal(stream.surface.material.uniforms.uWaveAmount.value,0);assert.equal(stream.surface.material.uniforms.uTime.value,0);
  assert.ok(stream.surface.material.uniforms.uRipples.value.every(r=>r.w===0));stream.dispose();
});
