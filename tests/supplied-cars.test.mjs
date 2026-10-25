import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../src/vendor/three.module.js';
import { registerCarAsset,CAR_ASSET_IDS } from '../src/car-assets.js';
import { createVehicle } from '../src/vehicle.js';
import { Driver } from '../src/driving.js';

test('the three supplied GLBs have correctly oriented, independently animated wheels, hydraulics, and owned resources',async()=>{
  for(const id of CAR_ASSET_IDS){
    const bytes=await readFile(new URL(`../src/assets/cars/${id}.glb`,import.meta.url));await registerCarAsset(id,bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
    const scene=new THREE.Scene(),vehicle=createVehicle({THREE,scene,model:id}),driver=new Driver();driver.setVehicleProfile(vehicle.profile);driver.heading=driver.velocityHeading=0;vehicle.update(1/60,{driver,headlights:'on'});vehicle.root.updateMatrixWorld(true);
    assert.equal(vehicle.sourceAsset,true);assert.equal(vehicle.wheelPivots.length,4);assert.equal(vehicle.hydraulicRams.length,4);assert.ok(vehicle.headLights.every(l=>l.intensity>30));
    for(const wheel of vehicle.wheelPivots){assert.ok(Math.abs(wheel.x)>.4);assert.ok(wheel.front?wheel.z>.5:wheel.z<-.5);assert.ok(wheel.roller.children.length>=3);}
    const shape=new THREE.Box3().setFromObject(vehicle.body),size=shape.getSize(new THREE.Vector3());assert.ok(size.z>size.x*.8);assert.ok(size.x<vehicle.profile.halfWidth*2+.2);assert.ok(size.z<vehicle.profile.halfLength*2+.2);
    driver.speed=15;driver.steering=.5;vehicle.update(1/60,{driver});assert.ok(vehicle.wheelPivots.filter(w=>w.front).every(w=>w.pivot.rotation.y>0));assert.ok(vehicle.wheelPivots.every(w=>w.roller.rotation.x>0));
    const rest=vehicle.hydraulicRams.map(r=>r.piston.scale.y);driver.attitude.takeoff(0);driver.hop=5;driver.hydraulicOffset=.48;driver.attitude.rotation.setFromAxisAngle(new THREE.Vector3(1,0,0),Math.PI);driver.attitude.updateAxes();vehicle.update(1/60,{driver});assert.ok(vehicle.root.quaternion.angleTo(driver.attitude.rotation)<1e-8);assert.ok(vehicle.hydraulicRams.every((r,i)=>r.piston.scale.y>rest[i]+.4));
    let triangles=0;const owned=new Set();vehicle.root.traverse(o=>{if(o.geometry){owned.add(o.geometry);triangles+=(o.geometry.index?.count||o.geometry.attributes.position.count)/3;for(const n of o.geometry.attributes.position.array)assert.ok(Number.isFinite(n));}if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material])owned.add(m);});assert.ok(triangles>40000&&triangles<130000,id+' retains supplied detail within a bounded budget');
    let releases=0;owned.forEach(r=>r.addEventListener('dispose',()=>releases++));vehicle.dispose();vehicle.dispose();assert.equal(releases,owned.size);assert.equal(scene.children.length,0);
  }
});
