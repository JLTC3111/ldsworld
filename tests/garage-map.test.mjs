import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../src/vendor/three.module.js';
import { createVehicle } from '../src/vehicle.js';
import { VEHICLE_MODELS,vehicleModel } from '../src/vehicle-models.js';
import { Driver,drivingSurfaceAt } from '../src/driving.js';
import { mapLocations } from '../src/locations.js';
import { ROAD_WIDTHS,RIVER_HALF_WIDTH,MAP_BOUNDS,bridges } from '../src/world-layout.js';
import { powertrainState } from '../src/powertrain.js';

function withCanvas(fn){const previous=Object.getOwnPropertyDescriptor(globalThis,'document');Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement:()=>({getContext:()=>({fillRect(){},fillText(){}})})}});try{fn();}finally{if(previous)Object.defineProperty(globalThis,'document',previous);else delete globalThis.document;}}
test('all four garage models have complete moving suspension, lamps, finite geometry, and owned resources',()=>withCanvas(()=>{
  assert.equal(vehicleModel('missing').id,'8-ball');assert.equal(new Set(VEHICLE_MODELS.map(m=>m.id)).size,4);
  for(const model of VEHICLE_MODELS){
    const scene=new THREE.Scene(),car=createVehicle({THREE,scene,model:model.id,reducedMotion:true}),driver=new Driver();driver.setVehicleProfile(car.profile);
    assert.equal(car.modelId,model.id);assert.equal(car.hydraulicRams.length,4);assert.equal(car.headLights.length,2);
    car.update(1/60,{driver,night:1,headlights:'on'});const lengths=car.hydraulicRams.map(r=>r.piston.scale.y);
    driver.attitude.takeoff(driver.heading);driver.attitude.rotation.setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI);driver.attitude.updateAxes();driver.hop=5;driver.hydraulicOffset=.48;
    car.update(1/60,{driver,night:1,headlights:'on'});assert.ok(car.root.quaternion.angleTo(driver.attitude.rotation)<1e-8);assert.ok(car.hydraulicRams.every((r,i)=>r.piston.scale.y>lengths[i]+.4));
    const owned=new Set();let meshes=0;
    car.root.traverse(o=>{if(o.isMesh){meshes++;for(const v of o.geometry.attributes.position.array)assert.ok(Number.isFinite(v));if(o.isInstancedMesh)for(const v of o.instanceMatrix.array)assert.ok(Number.isFinite(v));}if(o.geometry)owned.add(o.geometry);for(const m of o.material?Array.isArray(o.material)?o.material:[o.material]:[]){owned.add(m);if(m.map)owned.add(m.map);}});
    assert.ok(meshes>60&&meshes<350,model.id);assert.ok(car.headLights.every(l=>l.intensity>20));
    let releases=0;owned.forEach(r=>r.addEventListener('dispose',()=>releases++));car.dispose();car.dispose();assert.equal(releases,owned.size);assert.equal(scene.children.length,0);
  }
}));

test('the map has unique bilingual destinations inside its top-down frustum and safe land arrivals',()=>{
  const en=mapLocations('en'),vi=mapLocations('vi');assert.equal(en.length,29);assert.deepEqual(en.map(l=>l.id),vi.map(l=>l.id));assert.equal(new Set(en.map(l=>l.id)).size,en.length);
  assert.ok(en.filter(l=>l.projectId).length===6);assert.ok(vi.some(l=>l.name.includes('thị trấn')));
  for(const location of en){assert.ok(Math.abs(location.x)<MAP_BOUNDS.x&&Math.abs(location.z)<MAP_BOUNDS.z);assert.ok(location.spawn.every(Number.isFinite));assert.notEqual(drivingSurfaceAt(...location.spawn),'water',location.id);}
});

test('the widened road, stream, and bridge dimensions stay coherent with surface audio classification',()=>{
  assert.equal(ROAD_WIDTHS.ring,4.9*2.5);assert.equal(ROAD_WIDTHS.spine,4.2*2.5);assert.ok(Math.abs(RIVER_HALF_WIDTH-1.05*3)<1e-8);
  assert.equal(drivingSurfaceAt(0,13),'road');assert.equal(drivingSurfaceAt(55,-80),'grass');
  for(const bridge of bridges){assert.ok(bridge.width>ROAD_WIDTHS.ring);assert.equal(drivingSurfaceAt(bridge.x,bridge.z),'bridge');}
});

test('six virtual gears make rising revs, shift drops, reverse, and airborne free revs audible',()=>{
  assert.equal(powertrainState(0).gear,0);assert.equal(powertrainState(-5).gear,-1);assert.equal(powertrainState(90).gear,6);
  for(const boundary of [7,13,20,29,40]){const before=powertrainState(boundary-.01,{throttle:1}),after=powertrainState(boundary+.01,{throttle:1});assert.equal(after.gear,before.gear+1);assert.ok(after.rpm<before.rpm-2500);}
  assert.ok(powertrainState(3,{airborne:true,throttle:1}).rpm>powertrainState(3,{throttle:1}).rpm);
  assert.equal(powertrainState(NaN).rpm,950);
});
