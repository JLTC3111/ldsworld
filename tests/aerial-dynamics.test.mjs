import test from 'node:test';
import assert from 'node:assert/strict';
import { Driver } from '../src/driving.js';
import { DRIVE_TUNING } from '../src/aerial-dynamics.js';
import { Vector3 } from '../src/vendor/three.module.js';

const advance=(car,seconds,input={},fps=60)=>{for(let i=0;i<Math.round(seconds*fps);i++)car.step(1/fps,input);};
const carAt=()=>{const car=new Driver();car.x=0;car.z=-32;car.heading=car.velocityHeading=0;return car;};
const takeoff=car=>{assert.equal(car.jump(),true);advance(car,.25);assert.equal(car.attitude.flying,true);};

test('ordinary driving is twice as fast, boost accelerates from rest, and braking remains effective',()=>{
  const car=carAt();advance(car,1,{forward:true});assert.equal(car.speed,DRIVE_TUNING.speed);assert.equal(car.speed,30);
  car.reset();car.z=-32;advance(car,2,{boost:true});assert.equal(car.speed,48);
  advance(car,.6,{brake:true});assert.ok(car.speed<1);
});

test('air steering rotates the chassis while retaining travel momentum',()=>{
  const car=carAt();car.speed=10;takeoff(car);const before=car.attitude.rotation.clone(),momentum=car.vz;
  advance(car,.35,{left:true});assert.ok(before.angleTo(car.attitude.rotation)>.5);
  assert.ok(Math.abs(car.vx)<.01);assert.ok(car.vz>momentum*.97);assert.ok(Math.abs(car.heading)>.5);
});

test('Space performs one ground jump and cannot trigger a second jump or flip while airborne',()=>{
  const car=carAt();takeoff(car);const height=car.hop,velocity=car.hopVelocity,rotation=car.attitude.rotation.clone();
  for(const input of [{},{forward:true},{left:true},{rollLeft:true}])assert.equal(car.jump(input),false);
  assert.equal(car.hop,height);assert.equal(car.hopVelocity,velocity);assert.equal(car.attitude.rotation.angleTo(rotation),0);
  advance(car,3);assert.equal(car.hop,0);assert.equal(car.attitude.recovering,false);assert.ok(car.attitude.up.y>.999);assert.equal(car.jump(),true);
});

test('removed air-roll inputs have no effect on the jump trajectory or chassis orientation',()=>{
  const a=carAt(),b=carAt();takeoff(a);takeoff(b);
  advance(a,.8);advance(b,.8,{rollLeft:true,rollRight:true});
  assert.equal(a.hop,b.hop);assert.equal(a.hopVelocity,b.hopVelocity);assert.ok(a.attitude.rotation.angleTo(b.attitude.rotation)<1e-7);
});

test('air boost follows the nose, can lift the car, and remains within the playable flight ceiling',()=>{
  const car=carAt();takeoff(car);car.attitude.rotation.setFromAxisAngle(new Vector3(1,0,0),-Math.PI/2);car.attitude.updateAxes();
  advance(car,1,{boost:true});assert.ok(car.hop>9);assert.ok(Math.abs(car.vz)<.01);assert.ok(car.hopVelocity>8);
  advance(car,5,{boost:true});assert.ok(car.hop<=DRIVE_TUNING.ceiling+.1);advance(car,4);assert.equal(car.hop,0);
});

test('substeps preserve aerial trajectories at 30 and 60 FPS and zero-duration updates stay finite',()=>{
  const a=carAt(),b=carAt();a.jump();b.jump();advance(a,.5,{forward:true},60);advance(b,.5,{forward:true},30);
  advance(a,.5,{right:true,boost:true},60);advance(b,.5,{right:true,boost:true},30);
  for(const key of ['x','z','hop','vx','vz','hopVelocity'])assert.ok(Math.abs(a[key]-b[key])<1e-8,key);
  assert.ok(a.attitude.rotation.angleTo(b.attitude.rotation)<1e-7);a.step(0);for(const key of ['x','z','hop','vx','vz'])assert.ok(Number.isFinite(a[key]));
});

test('a rotating airborne car collides with tall walls and reset clears every stunt state',()=>{
  const car=new Driver([{x:6,z:-32,width:.1,depth:30,minY:0,maxY:40}]);car.x=0;car.z=-32;car.heading=car.velocityHeading=Math.PI/2;car.speed=20;takeoff(car);car.jump({left:true});
  let impact=0;for(let i=0;i<120;i++){car.step(1/60,{boost:true});impact=Math.max(impact,car.collisionImpact);assert.ok(car.x<6);}
  assert.ok(impact>1);car.reset();assert.equal(car.hop,0);assert.equal(car.attitude.flying,false);assert.equal(car.attitude.recovering,false);assert.equal(car.attitude.angularVelocity.length(),0);assert.equal(car.boosting,false);
});

test('hydraulic ride height can lower for driving and returns to its raised stance',()=>{
  const car=carAt(),raised=car.rideHeight;car.toggleHydraulics();advance(car,1);assert.ok(car.rideHeight<raised*.3);car.toggleHydraulics();advance(car,2);assert.ok(Math.abs(car.rideHeight-raised)<.001);
});
