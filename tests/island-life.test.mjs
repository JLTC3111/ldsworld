import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../src/vendor/three.module.js';
import {createIslandLife,islandLifeLayout,reservesIslandLifeSpace} from '../src/island-life.js';
import {createTreeDetails} from '../src/tree-details.js';
import {bridges,ROAD_WIDTHS,bridgeHeightAt} from '../src/world-layout.js';
import {roadLoop,Driver,CAR_HALF_WIDTH} from '../src/driving.js';

test('snowmen appear only in snow while two vendors and stalls stay available in every season',()=>{
  const scene=new THREE.Scene(),life=createIslandLife({THREE,scene});
  assert.equal(life.snowmen.children.length,3);assert.equal(life.vendors.length,2);
  for(const weather of ['snow','clear','rain','snow']){life.update(.1,{weather,night:.9});assert.equal(life.snowmen.visible,weather==='snow');assert.ok(life.vendors.every(v=>v.parent.visible&&v.position.z<0),'Vendors stand behind the front counters');}
  scene.traverse(o=>{if(o.geometry)for(const value of o.geometry.attributes.position.array)assert.ok(Number.isFinite(value));});
  const poses=life.vendors.map(v=>v.rotation.y);life.update(.5,{weather:'snow',paused:true});assert.deepEqual(life.vendors.map(v=>v.rotation.y),poses);
  life.dispose();assert.equal(scene.children.length,0);
});

test('new market colliders stay clear of the widened ring and reserve space against random trees',()=>{
  const scene=new THREE.Scene(),life=createIslandLife({THREE,scene});
  const distance=(x,z,a,b)=>{const dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz)));return Math.hypot(x-a[0]-t*dx,z-a[1]-t*dz);};
  for(const stall of life.colliders){
    for(let ix=-1;ix<=1;ix++)for(let iz=-1;iz<=1;iz++){
      const x=stall.x+ix*stall.width/2,z=stall.z+iz*stall.depth/2;
      assert.ok(Math.min(...roadLoop.map((p,i)=>distance(x,z,p,roadLoop[(i+1)%roadLoop.length])))>ROAD_WIDTHS.ring/2);
    }
  }
  for(const object of islandLifeLayout)assert.ok(reservesIslandLifeSpace(object.x,object.z));life.dispose();
});

test('layered foliage is instanced, snow follows its actual leaf tips, and owned resources dispose once',()=>{
  for(const coarse of [false,true]){
    const scene=new THREE.Scene(),trees=[{x:2,z:4,scale:1,round:true},{x:-3,z:5,scale:.7,round:true}];
    const detail=createTreeDetails({THREE,scene,trees,coarse});
    const leaves=scene.getObjectByName('Individual canopy leaf clusters'),frost=scene.getObjectByName('Frosted canopy tips');assert.ok(leaves.isInstancedMesh&&leaves.count>100);
    for(const object of [leaves,frost])for(const v of object.instanceMatrix.array)assert.ok(Number.isFinite(v));
    detail.updateSnow(.7);assert.equal(frost.visible,true);detail.updateSnow(0);assert.equal(frost.visible,false);
    const gs=new Set(),ms=new Set();detail.root.traverse(o=>{if(o.geometry)gs.add(o.geometry);if(o.material)ms.add(o.material);});let disposed=0;[...gs,...ms].forEach(o=>o.addEventListener('dispose',()=>disposed++));detail.dispose();detail.dispose();assert.equal(disposed,gs.size+ms.size);
  }
});

test('widened bridges support driving near either deck edge rather than only along their old centers',()=>{
  assert.ok(ROAD_WIDTHS.ring>=4.8&&ROAD_WIDTHS.spine>=4);
  for(const bridge of bridges)for(const side of [-1,1]){
    const offset=side*(bridge.width/2-CAR_HALF_WIDTH-.25),driver=new Driver();
    driver.x=bridge.x+Math.cos(bridge.heading)*offset-Math.sin(bridge.heading)*2.7;driver.z=bridge.z-Math.sin(bridge.heading)*offset-Math.cos(bridge.heading)*2.7;driver.heading=bridge.heading;
    assert.ok(bridgeHeightAt(driver.x,driver.z)>0);
    for(let i=0;i<120;i++)driver.step(1/60,{forward:true});
    const along=(driver.x-bridge.x)*Math.sin(bridge.heading)+(driver.z-bridge.z)*Math.cos(bridge.heading);assert.ok(along>2.7,`${bridge.id}/${side}: wide bridge lane must cross (${along})`);
  }
});
