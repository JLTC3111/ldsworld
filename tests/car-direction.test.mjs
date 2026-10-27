import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../src/vendor/three.module.js';
import {CAR_ASSET_IDS,registerCarAsset} from '../src/car-assets.js';
import {createVehicle} from '../src/vehicle.js';
import {Driver} from '../src/driving.js';

test('every supplied car has a forward hood chevron and distinct top-visible front/rear lighting and rear silhouette',async()=>{
  for(const id of CAR_ASSET_IDS){
    const b=await readFile(new URL(`../src/assets/cars/${id}.glb`,import.meta.url));await registerCarAsset(id,b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength));
    const scene=new THREE.Scene(),car=createVehicle({THREE,scene,model:id}),driver=new Driver();driver.setVehicleProfile(car.profile);car.update(1/60,{driver,headlights:'on',night:1});
    const arrow=car.root.getObjectByName('Front hood direction chevron'),rear=car.root.getObjectByName('Raised rear red light bar'),front=car.root.getObjectByName('Top-facing front running light'),tail=car.root.getObjectByName('Top-facing red tail marker');assert.ok(arrow&&rear&&front&&tail);assert.equal(arrow.userData.direction,'front');assert.equal(rear.userData.direction,'rear');
    const center=new THREE.Box3().setFromBufferAttribute(arrow.geometry.attributes.position).getCenter(new THREE.Vector3());assert.ok(center.z>0);assert.ok(front.position.z>0);assert.ok(tail.position.z<0);assert.ok(rear.position.z<0);assert.equal(arrow.material.color.getHexString(),'fff2cf');assert.equal(front.material.color.getHexString(),'fff5df');assert.equal(tail.material.color.getHexString(),'b71920');assert.equal(rear.material,tail.material);
    assert.ok(car.root.getObjectByName(id==='8-ball'?'Rear spoiler':'Rear utility gate'));
    const dim=tail.material.emissiveIntensity;car.update(1/60,{driver,night:1,braking:true});assert.ok(tail.material.emissiveIntensity>dim);car.dispose();car.dispose();assert.equal(scene.children.length,0);
  }
});
