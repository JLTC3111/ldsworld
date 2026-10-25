import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../src/vendor/three.module.js';
import { createBlastDamage,treeBlastTargets,BLAST_BURN_SECONDS } from '../src/blast-damage.js';
import { PhysicsWorld,colliderActive } from '../src/physics.js';
import { collectWorldColliders,syncPhysicsBodies } from '../src/world-physics.js';
import {collectBreakableTargets,isProtectedObject} from '../src/breakables.js';

function fixture(){
  const scene=new THREE.Scene(),trunks=new THREE.InstancedMesh(new THREE.CylinderGeometry(.2,.3,3,8),new THREE.MeshStandardMaterial(),2),matrix=new THREE.Matrix4();scene.add(trunks);
  trunks.setMatrixAt(0,matrix.makeTranslation(2,1.5,2));trunks.setMatrixAt(1,matrix.makeTranslation(40,1.5,2));
  const trees=[{x:2,z:2},{x:40,z:2}],targets=treeBlastTargets({THREE,trees,objects:[trunks]}),colliders=collectWorldColliders({THREE,roots:[trunks]});
  const building=new THREE.Mesh(new THREE.BoxGeometry(5,5,5),new THREE.MeshStandardMaterial());building.position.set(3,2.5,3);scene.add(building);
  targets.push({id:'protected-building',kind:'building',x:3,z:3,parts:[{object:building}]});
  const prop=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial());prop.position.set(-2,.62,2);scene.add(prop);
  const rocks=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial(),1);rocks.setMatrixAt(0,matrix.makeTranslation(-2,.6,-2));scene.add(rocks);
  const physics=new PhysicsWorld({bodies:[{id:'crate',kind:'crate',object:prop,x:-2,z:2,y:.62,radius:.5,height:1},{id:'rock',kind:'rock',x:-2,z:-2,y:.62,radius:.5,height:1,instance:{object:rocks,index:0,quaternion:new THREE.Quaternion(),scale:new THREE.Vector3(1,1,1)}}],colliders});
  const damage=createBlastDamage({THREE,scene,physics,targets});return {scene,trunks,building,prop,rocks,physics,damage,colliders};
}
test('blasts remove nearby trees and props from rendering and physics while preserving buildings and distant trees',()=>{
  const f=fixture(),before=new THREE.Matrix4();f.trunks.getMatrixAt(1,before);
  assert.equal(f.damage.blast({x:0,z:0,radius:9}),3);syncPhysicsBodies(THREE,f.physics.bodies);
  assert.equal(f.building.visible,true);assert.equal(f.prop.visible,false);assert.equal(colliderActive(f.colliders[0]),false);assert.equal(colliderActive(f.colliders[1]),true);
  const hidden=new THREE.Matrix4(),distant=new THREE.Matrix4();f.trunks.getMatrixAt(0,hidden);assert.equal(hidden.determinant(),0);f.trunks.getMatrixAt(1,distant);assert.deepEqual(distant.elements,before.elements);
  f.rocks.getMatrixAt(0,hidden);assert.equal(hidden.determinant(),0);assert.equal(f.physics.kick('crate'),false);const crate=f.physics.bodies[0],position=[crate.x,crate.y,crate.z];f.physics.update(.1);syncPhysicsBodies(THREE,f.physics.bodies);assert.deepEqual([crate.x,crate.y,crate.z],position);assert.equal(f.prop.visible,false);
  f.damage.dispose();
});
test('residual fires burn for several seconds, freeze on pause, and leave charred debris after fading',()=>{
  const f=fixture();f.damage.blast({x:0,z:0});const site=f.damage.sites.find(s=>s.used&&s.burn);assert.ok(site);const before=site.age;
  f.damage.update(.1,{paused:true});assert.equal(site.age,before);
  for(let i=0;i<BLAST_BURN_SECONDS*10-15;i++)f.damage.update(.1);
  const flames=f.damage.root.getObjectByName('Residual orange flames'),matrix=new THREE.Matrix4();flames.getMatrixAt(0,matrix);assert.ok(matrix.determinant()>0);
  for(let i=0;i<30;i++)f.damage.update(.1);flames.getMatrixAt(0,matrix);assert.equal(matrix.determinant(),0);f.damage.root.getObjectByName('Charred blast fragments').getMatrixAt(0,matrix);assert.ok(Math.abs(matrix.determinant())>0);f.damage.dispose();
});
test('reset restores exact tree instances and contacts, revives props, and releases effect resources once',()=>{
  const f=fixture(),original=new THREE.Matrix4();f.trunks.getMatrixAt(0,original);f.damage.blast({x:0,z:0});f.damage.reset();f.physics.reset();syncPhysicsBodies(THREE,f.physics.bodies);
  const restored=new THREE.Matrix4();f.trunks.getMatrixAt(0,restored);assert.deepEqual(restored.elements,original.elements);assert.equal(colliderActive(f.colliders[0]),true);assert.equal(f.prop.visible,true);assert.equal(f.physics.kick('crate'),true);assert.equal(f.damage.destroyed.size,0);
  const owned=new Set();f.damage.root.traverse(o=>{if(o.geometry)owned.add(o.geometry);if(o.material)owned.add(o.material);});let releases=0;owned.forEach(r=>r.addEventListener('dispose',()=>releases++));f.damage.dispose();f.damage.dispose();assert.equal(releases,owned.size);
});

test('a strong impact breaks scenery, respects buildings, and restores original instances after their individual delay',()=>{
  const f=fixture();f.damage.dispose();const targets=collectBreakableTargets({THREE,colliders:f.colliders,existing:[{id:'tree',kind:'tree',x:2,z:2,parts:[{object:f.trunks,index:0}]}]});const damage=createBlastDamage({THREE,scene:f.scene,physics:f.physics,targets});
  assert.equal(damage.impact(f.colliders[0],4),false);assert.equal(damage.impact(f.colliders[0],20),true);assert.equal(colliderActive(f.colliders[0]),false);assert.equal(f.building.visible,true);
  for(let i=0;i<1100;i++)damage.update(.1,{focus:{x:2,z:2}});assert.ok(damage.destroyed.has('tree'),'Respawning waits until the car leaves the original tree position');
  damage.update(.1,{focus:{x:100,z:100}});assert.equal(damage.destroyed.has('tree'),false);assert.equal(colliderActive(f.colliders[0]),true);damage.dispose();
});

test('small props respawn sooner than trees and fallen pins are reset without reviving destroyed objects early',()=>{
  const f=fixture();f.physics.bodies[0].impactSpeed=10;f.damage.processImpacts();assert.equal(f.physics.bodies[0].destroyed,true);syncPhysicsBodies(THREE,f.physics.bodies);assert.equal(f.prop.visible,false);
  for(let i=0;i<180;i++)f.damage.update(.1,{focus:{x:100,z:100}});assert.equal(f.prop.visible,false);
  for(let i=0;i<30;i++)f.damage.update(.1,{focus:{x:100,z:100}});syncPhysicsBodies(THREE,f.physics.bodies);assert.equal(f.prop.visible,true);assert.equal(f.physics.bodies[0].x,-2);assert.equal(f.physics.bodies[0].sleeping,true);assert.equal(f.damage.respawns.size,0);f.damage.dispose();
});

test('stalls, bridges, portals and their details stay visible and collidable under impacts and explosions',()=>{
  const scene=new THREE.Scene(),protectedTargets=[];
  for(const [i,kind]of ['bridge','stall','portal'].entries()){
    const object=new THREE.Group();object.userData.blastProtected=true;object.userData.breakableKind=kind;object.position.set(i*3,0,0);scene.add(object);
    const part=new THREE.Mesh(new THREE.BoxGeometry(2,2,2),new THREE.MeshStandardMaterial());part.position.y=1;object.add(part);
    assert.equal(isProtectedObject(part),true);protectedTargets.push({id:kind,kind,x:i*3,z:0,parts:[{object}]});
  }
  const colliders=collectWorldColliders({THREE,roots:[scene]}),registered=collectBreakableTargets({THREE,colliders,existing:protectedTargets});
  assert.equal(registered.length,0);assert.ok(colliders.every(c=>!c.breakableId&&colliderActive(c)));
  const physics=new PhysicsWorld({bodies:[]}),damage=createBlastDamage({THREE,scene,physics,targets:protectedTargets});
  for(const target of protectedTargets)assert.equal(damage.impact(target.id,999),false);
  assert.equal(damage.blast({x:0,z:0,radius:20}),0);assert.equal(damage.destroyed.size,0);assert.ok(protectedTargets.every(t=>t.parts[0].object.visible));assert.ok(colliders.every(c=>colliderActive(c)));damage.dispose();
});

test('fallen pins occupying each other’s starting spots respawn together instead of waiting forever',()=>{
  const scene=new THREE.Scene(),physics=new PhysicsWorld({bodies:[0,3].map((x,i)=>({id:'pin-'+i,kind:'bowling-pin',x,z:0,y:1.175,radius:.4,height:2.11,initialSleeping:true}))}),damage=createBlastDamage({THREE,scene,physics});
  physics.bodies.forEach((b,i)=>{b.x=i?0:3;b.tipAngle=1.5;b.radius=1.1;b.height=.8;b.y=.52;});damage.processImpacts();assert.equal(damage.respawns.size,2);
  for(let i=0;i<200;i++)damage.update(.1,{focus:{x:100,z:100}});
  assert.equal(damage.respawns.size,0);assert.deepEqual(physics.bodies.map(b=>b.x),[0,3]);assert.ok(physics.bodies.every(b=>!b.tipAngle&&b.sleeping));damage.dispose();
});

test('a group waits safely when the car blocks one return position, then restores every dependent prop',()=>{
  const scene=new THREE.Scene(),physics=new PhysicsWorld({bodies:[0,3].map((x,i)=>({id:'crate-'+i,kind:'crate',x,z:0,y:.62,radius:.5,height:1,initialSleeping:true}))}),damage=createBlastDamage({THREE,scene,physics});
  physics.bodies[0].x=3;physics.bodies[1].x=0;damage.processImpacts();assert.equal(damage.respawns.size,2,'Displaced props also return');
  for(let i=0;i<250;i++)damage.update(.1,{focus:{x:3,z:0}});
  assert.equal(damage.respawns.size,2);assert.deepEqual(physics.bodies.map(b=>b.x),[3,0],'Neither object is restored into the car or a waiting prop');
  damage.update(.1,{focus:{x:100,z:100}});assert.equal(damage.respawns.size,0);assert.deepEqual(physics.bodies.map(b=>b.x),[0,3]);damage.dispose();
});

test('bowling pins topple and reset intact under hard hits and blasts, without destruction or fragments',()=>{
  const scene=new THREE.Scene(),object=new THREE.Group();scene.add(object);const physics=new PhysicsWorld({bodies:[{id:'pin',kind:'bowling-pin',object,x:20,z:20,y:2.44,radius:.9,height:4.64}]});
  const damage=createBlastDamage({THREE,scene,physics});const pin=physics.bodies[0];pin.impactSpeed=40;pin.tipAngle=1.5;damage.processImpacts();
  assert.equal(pin.destroyed,undefined);assert.equal(object.visible,true);assert.equal(damage.destroyed.size,0);assert.equal(damage.respawns.size,1);
  assert.equal(damage.blast({x:20,z:20,radius:8,sourceId:'pin'}),0);assert.equal(pin.destroyed,undefined);assert.equal(object.visible,true);assert.ok(damage.sites.every(s=>!s.used));
  for(let i=0;i<200;i++)damage.update(.1,{focus:{x:100,z:100}});assert.equal(damage.respawns.size,0);assert.ok(!physics.bodies[0].tipAngle);assert.equal(object.visible,true);damage.dispose();
});
