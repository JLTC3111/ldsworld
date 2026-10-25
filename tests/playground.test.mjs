import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../src/vendor/three.module.js';
import { createPlayground,reservesPlaygroundSpace,PIN_SCALE } from '../src/playground.js';
import { PhysicsWorld } from '../src/physics.js';
import { Driver } from '../src/driving.js';
import { syncPhysicsBodies } from '../src/world-physics.js';

function fixture(options={}){
  const previous=Object.getOwnPropertyDescriptor(globalThis,'document');Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement:()=>({getContext:()=>({fillRect(){},fillText(){}})})}});
  try{const scene=new THREE.Scene(),events=[],play=createPlayground({THREE,scene,onExplosion:e=>events.push(e),...options}),physics=new PhysicsWorld({bodies:play.bodies}),driver=new Driver();return {scene,play,physics,driver,events};}
  finally{if(previous)Object.defineProperty(globalThis,'document',previous);else delete globalThis.document;}
}
function step(f,count,input={}){for(let i=0;i<count;i++){f.driver.step(1/60,input);f.physics.update(1/60,f.driver);f.play.update(1/60,f.physics,f.driver);syncPhysicsBodies(THREE,f.physics.bodies);}}

test('the clearings contain ten large profiled pins, five labeled TNT crates, and an open drive-through lane',()=>{
  const f=fixture();assert.equal(f.play.bodies.filter(b=>b.kind==='bowling-pin').length,10);assert.equal(f.play.bodies.filter(b=>b.kind==='tnt').length,5);
  assert.ok(f.play.bodies.filter(b=>b.kind==='bowling-pin').every(b=>b.height>4.5&&b.object.scale.x===PIN_SCALE&&b.object.children.length===3));
  assert.ok(reservesPlaygroundSpace(39,42));assert.ok(reservesPlaygroundSpace(-47,23));assert.equal(reservesPlaygroundSpace(0,-30),false);
  f.play.root.traverse(o=>{if(o.isMesh)for(const p of o.geometry.attributes.position.array)assert.ok(Number.isFinite(p));});f.play.dispose();
});

test('the car knocks down pins, which retain their fallen orientation and settle at the correct lower height',()=>{
  const f=fixture();f.driver.x=39;f.driver.z=39;f.driver.heading=f.driver.velocityHeading=0;f.driver.speed=15;step(f,90,{forward:true});step(f,600);
  const fallen=f.physics.bodies.filter(b=>b.kind==='bowling-pin'&&b.tipAngle>1.4);assert.ok(fallen.length>=3,`Only ${fallen.length} pins fell`);
  for(const pin of fallen){assert.ok(pin.height<2);assert.ok(pin.radius>2);assert.ok(pin.y<1.2);assert.ok(new THREE.Vector3(0,1,0).applyQuaternion(pin.object.quaternion).y<.2);assert.ok(Math.abs(pin.object.quaternion.length()-1)<1e-8);}
  f.physics.reset();syncPhysicsBodies(THREE,f.physics.bodies);assert.ok(f.physics.bodies.filter(b=>b.kind==='bowling-pin').every(b=>b.height>2&&!b.tipAngle));f.play.dispose();
});

test('gentle contact leaves TNT intact; a driving impact detonates it, chains to nearby crates, and launches the car',()=>{
  const f=fixture();f.driver.x=-44;f.driver.z=20.1;f.driver.heading=f.driver.velocityHeading=0;f.driver.speed=.6;step(f,20);assert.equal(f.play.detonated.size,0);
  f.driver.x=-44;f.driver.z=18;f.driver.speed=14;let peak=0;
  for(let i=0;i<180;i++){step(f,1,i<30?{forward:true}:{});peak=Math.max(peak,f.driver.hop);}
  assert.equal(f.play.detonated.size,5);assert.equal(f.events.length,5);assert.ok(peak>.1&&peak<1.5);assert.ok(f.physics.bodies.filter(b=>b.kind==='tnt').every(b=>!b.object.visible));
  f.play.reset();f.physics.reset();syncPhysicsBodies(THREE,f.physics.bodies);assert.equal(f.play.detonated.size,0);assert.ok(f.physics.bodies.every(b=>b.object.visible));f.play.dispose();
});

test('blast impulses affect props and pins; pausing freezes fuses/effects and disposal releases owned resources once',()=>{
  const f=fixture({reducedMotion:true});f.physics.bodies.find(b=>b.id==='bowling-pin-1').x=-42;f.physics.bodies.find(b=>b.id==='bowling-pin-1').z=22;
  assert.equal(f.play.detonate('tnt-1',f.physics,f.driver),true);assert.equal(f.play.detonate('tnt-1',f.physics,f.driver),false);const pin=f.physics.bodies.find(b=>b.id==='bowling-pin-1');assert.ok(Math.hypot(pin.vx,pin.vz)>2&&pin.tipVelocity>0);
  f.play.update(1,f.physics,f.driver,{paused:true});assert.equal(f.play.detonated.size,1);
  const owned={geometry:new Set(),material:new Set(),texture:new Set()},counts={geometry:0,material:0,texture:0};f.play.root.traverse(o=>{if(o.geometry)owned.geometry.add(o.geometry);for(const m of o.material?[o.material]:[]){owned.material.add(m);if(m.map)owned.texture.add(m.map);}});
  for(const key of Object.keys(owned))for(const resource of owned[key])resource.addEventListener('dispose',()=>counts[key]++);
  f.play.dispose();f.play.dispose();for(const key of Object.keys(owned))assert.equal(counts[key],owned[key].size);assert.ok(!f.scene.children.includes(f.play.root));
});

test('TNT keeps readable labels and gives the car a small backward shove with a brief time effect',()=>{
  const f=fixture();f.driver.x=-44;f.driver.z=19;f.driver.heading=f.driver.velocityHeading=0;f.driver.speed=15;
  const crate=f.play.bodies.find(b=>b.id==='tnt-1');assert.equal(crate.object.children.filter(o=>o.name==='TNT warning label').length,4);assert.ok(crate.object.getObjectByName('TNT roof label'));assert.ok(crate.object.children.filter(o=>o.name==='TNT warning label').every(o=>o.scale.x>1));
  f.play.detonate(crate.id,f.physics,f.driver);assert.ok(f.driver.vz<0&&f.driver.vz>=-8);assert.ok(f.driver.hopVelocity<=4);assert.equal(f.play.timeScale(),.75);
  const paused=f.play.timeScale();f.play.update(.05,f.physics,f.driver,{paused:true});assert.equal(f.play.timeScale(),paused);
  let peak=0,inverted=false,maxDistance=0;
  for(let i=0;i<360;i++){
    const dt=1/60*f.play.timeScale();f.driver.step(dt);f.physics.update(dt,f.driver);f.play.update(dt,f.physics,f.driver,{realElapsed:1/60});peak=Math.max(peak,f.driver.hop);inverted ||= f.driver.attitude.up.y<0;maxDistance=Math.max(maxDistance,Math.hypot(f.driver.x+44,f.driver.z-19));
  }
  assert.ok(peak>.1&&peak<1.5,`Small hop: ${peak}`);assert.equal(inverted,false);assert.ok(maxDistance>1&&maxDistance<10,`Nearby knockback: ${maxDistance}`);assert.equal(f.play.detonated.size,5);assert.equal(f.play.timeScale(),1);assert.equal(f.driver.airborne,false);
  f.play.reset();assert.equal(f.play.timeScale(),1);f.play.dispose();
});

test('reduced motion keeps the physical blast but suppresses the slow-motion camera effect and flash',()=>{
  const f=fixture({reducedMotion:true});f.driver.x=-44;f.driver.z=19;f.play.detonate('tnt-1',f.physics,f.driver);assert.equal(f.driver.airborne,true);assert.equal(f.play.timeScale(),1);f.play.update(1/60,f.physics,f.driver);const lights=[];f.play.root.traverse(o=>{if(o.isPointLight)lights.push(o);});assert.ok(lights.every(l=>l.intensity===0));f.play.dispose();
});

test('a neighboring chain blast cannot stack launch momentum or extend the small hop',()=>{
  const driver=new Driver();driver.x=0;driver.z=0;driver.heading=0;driver.speed=25;
  assert.equal(driver.launchFromBlast({x:0,z:3,strength:34}),true);assert.equal(driver.vz,-8);
  const before={vx:driver.vx,vz:driver.vz,up:driver.hopVelocity,flight:driver.blastFlightTime};
  assert.equal(driver.launchFromBlast({x:-6,z:1,strength:25}),false);assert.deepEqual({vx:driver.vx,vz:driver.vz,up:driver.hopVelocity,flight:driver.blastFlightTime},before);
  driver.teleport(0,13);assert.equal(driver.blastFlightTime,0);assert.equal(driver.hop,0);assert.equal(driver.airborne,false);
});
