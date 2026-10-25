import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../src/vendor/three.module.js';
import { createIslandBoundary,boundaryPoint } from '../src/island-boundary.js';
import { collectWorldColliders } from '../src/world-physics.js';
import { Driver } from '../src/driving.js';
import { PhysicsWorld } from '../src/physics.js';
import { islandRadius } from '../src/world-layout.js';

test('a striped continuous perimeter stays inside the shoreline and stops a boosted car at every compass direction',()=>{
  const scene=new THREE.Scene(),boundary=createIslandBoundary({THREE,scene});scene.updateMatrixWorld(true);const contacts=collectWorldColliders({THREE,roots:[boundary.root]});assert.ok(contacts.length>=1000);
  const matrix=new THREE.Matrix4(),position=new THREE.Vector3();for(let i=0;i<boundary.curb.count;i++){boundary.curb.getMatrixAt(i,matrix);position.setFromMatrixPosition(matrix);assert.ok(islandRadius(position.x,position.z)<1);}
  for(let i=0;i<12;i++){
    const angle=i*Math.PI/6,point=boundaryPoint(angle),car=new Driver(contacts);car.x=point.x*.94;car.z=point.z*.94;car.heading=car.velocityHeading=Math.atan2(Math.cos(angle),Math.sin(angle));car.speed=48;let impact=0;
    for(let frame=0;frame<120;frame++){car.step(1/60,{forward:true,boost:true});impact=Math.max(impact,car.collisionImpact);assert.ok(islandRadius(car.x,car.z)<1);}
    assert.ok(impact>3,`No physical boundary collision at ${angle}`);assert.ok(islandRadius(car.x,car.z)<.995);
  }
  boundary.dispose();
});

test('the visible curb reflects loose props, night reflectors stay readable, and resources release once',()=>{
  const scene=new THREE.Scene(),boundary=createIslandBoundary({THREE,scene});scene.updateMatrixWorld(true);const contacts=collectWorldColliders({THREE,roots:[boundary.root]});
  const physics=new PhysicsWorld({bodies:[{id:'edge-prop',x:boundaryPoint(0).x-5,z:0,radius:.4,height:.8,mass:1}],colliders:contacts});physics.bodies[0].vx=25;let maxX=0,reflected=false;
  for(let frame=0;frame<120;frame++){physics.update(1/60);maxX=Math.max(maxX,physics.bodies[0].x);reflected ||= physics.bodies[0].vx<0;}
  assert.ok(reflected&&maxX<boundaryPoint(0).x-.25);boundary.update({night:0});const day=boundary.rail.material.emissiveIntensity;boundary.update({night:1});assert.ok(boundary.rail.material.emissiveIntensity>day);assert.ok(boundary.reflectors.material.isMeshBasicMaterial);
  const geometry=new Set(),material=new Set();boundary.root.traverse(o=>{if(o.geometry)geometry.add(o.geometry);if(o.material)material.add(o.material);});let released=0;for(const resource of [...geometry,...material])resource.addEventListener('dispose',()=>released++);
  boundary.dispose();boundary.dispose();assert.equal(released,geometry.size+material.size);assert.ok(!scene.children.includes(boundary.root));
});
