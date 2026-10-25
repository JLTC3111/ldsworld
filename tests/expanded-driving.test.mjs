import test from 'node:test';
import assert from 'node:assert/strict';
import { Driver, roadNodes } from '../src/driving.js';
import { PhysicsWorld } from '../src/physics.js';
import { WORLD_SCALE, ISLAND_BOUNDS, islandRadius } from '../src/world-layout.js';

test('the expanded terrain accepts car and prop travel beyond the original town and retains a real shoreline',()=>{
  assert.equal(WORLD_SCALE,20);assert.deepEqual(ISLAND_BOUNDS,{x:560,z:420});
  const car=new Driver();car.x=40;car.z=-30;car.driveTo(110,-30);
  for(let i=0;i<2400&&car.route.length;i++)assert.equal(car.step(1/60).cancelled,false);
  assert.ok(Math.hypot(car.x-110,car.z+30)<1.3);
  car.heading=car.velocityHeading=Math.PI/2;
  for(let i=0;i<1500;i++)car.step(1/60,{forward:true,boost:true});
  assert.ok(islandRadius(car.x,car.z)<=1);assert.ok(car.x>ISLAND_BOUNDS.x*.8);
  const physics=new PhysicsWorld({bodies:[{id:'far-prop',x:100,z:-30,radius:.4}]});
  for(let i=0;i<120;i++)physics.update(1/60);
  assert.equal(physics.bodies[0].x,100);assert.equal(physics.bodies[0].z,-30);
});

test('long routes reach the outer roads and return through the bridge network without the old timeout',()=>{
  const car=new Driver();
  for(const destination of ['o2','o6','o8','r1']){
    car.navigate(destination,destination);let arrived=false;
    for(let i=0;i<15000;i++){
      const result=car.step(1/60);assert.equal(result.cancelled,false,`Route to ${destination} timed out at ${car.x},${car.z}`);
      if(result.arrived===destination){arrived=true;break;}
    }
    assert.ok(arrived,`Unreachable outer-road stop ${destination}`);
    assert.ok(Math.hypot(car.x-roadNodes[destination][0],car.z-roadNodes[destination][1])<1.3);
  }
});

test('hydraulics compress before takeoff, support a higher jump, and rebound into a stable landing',()=>{
  const car=new Driver();assert.equal(car.jump(),true);
  for(let i=0;i<6;i++)car.step(1/60);
  assert.equal(car.hop,0);assert.ok(car.hydraulicOffset<-.07);assert.equal(car.jump(),false);
  let peak=0,landed=false,rebound=false;
  for(let i=0;i<240;i++){
    car.step(1/60);peak=Math.max(peak,car.hop);

    if(peak>1&&car.hop===0){landed=true;if(car.hydraulicOffset<-.01)rebound=true;}
    assert.ok(Number.isFinite(car.hydraulicOffset)&&car.hydraulicOffset>=-.29&&car.hydraulicOffset<=.52);
  }
  assert.ok(peak>3&&peak<3.5);assert.ok(landed&&rebound);
  assert.equal(car.hydraulicPhase,'idle');assert.equal(car.hydraulicOffset,0);
  assert.equal(car.jump(),true);car.step(1/60);car.reset();
  assert.equal(car.jumpPending,false);assert.equal(car.hydraulicOffset,0);assert.equal(car.hop,0);
});
