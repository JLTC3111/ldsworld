import test from 'node:test';
import assert from 'node:assert/strict';
import {Driver,angleDifference} from '../src/driving.js';

const carAt=()=>{const car=new Driver();car.x=0;car.z=-32;car.heading=car.velocityHeading=0;return car;};
const advance=(car,frames,input)=>{for(let i=0;i<frames;i++)car.step(1/120,{smoothDrive:true,...input});};

test('fractional left and right steering produce progressively stronger turns in forward and reverse',()=>{
  for(const travel of [1,-1])for(const side of [1,-1]){
    const turns=[];
    for(const strength of [.2,.45,.7,1]){
      const car=carAt();advance(car,36,{throttleAxis:travel*.75,steerAxis:side*strength});
      const turn=angleDifference(car.heading,0);
      assert.equal(Math.sign(car.speed),travel);
      assert.equal(Math.sign(turn),-travel*side,'reverse travel reverses the turn while preserving the selected wheel direction');
      assert.ok(Math.abs(car.steering)>0&&Math.abs(car.steering)<=strength);
      turns.push(Math.abs(turn));
    }
    for(let i=1;i<turns.length;i++)assert.ok(turns[i]>turns[i-1],'intermediate input strengths remain distinct');
    assert.ok(turns[0]<turns.at(-1)*.25,'a gentle correction turns substantially less than full lock');
  }
});

test('a continuous steering sweep stays responsive while braking through zero into opposite travel',()=>{
  for(const initialTravel of [1,-1]){
    const car=carAt();car.speed=initialTravel*6;let stopped=false,reversed=false,previousTurn=null;
    for(let frame=0;frame<120;frame++){
      const steerAxis=.65*Math.cos(frame*Math.PI/119),heading=car.heading;
      car.step(1/120,{throttleAxis:-initialTravel,steerAxis,smoothDrive:true});
      const turn=angleDifference(car.heading,heading);
      assert.ok(Number.isFinite(car.x)&&Number.isFinite(car.z)&&Number.isFinite(turn));
      assert.ok(Math.abs(turn)<.03,'changing steering direction cannot introduce a heading jump');
      if(previousTurn!==null)assert.ok(Math.abs(turn-previousTurn)<.003,'successive turn increments remain continuous');
      previousTurn=turn;
      if(car.speed===0){stopped=true;assert.equal(turn,0,'wheels can change direction without spinning a stationary car');}
      else {
        assert.equal(Math.sign(turn),-Math.sign(steerAxis)*Math.sign(car.speed));
        if(Math.sign(car.speed)===-initialTravel){assert.ok(stopped,'opposite travel follows a stopped step');reversed=true;}
      }
    }
    assert.ok(stopped&&reversed);
  }
});

test('releasing analog movement and steering coasts to rest without further heading changes',()=>{
  for(const travel of [1,-1]){
    const car=carAt();advance(car,60,{throttleAxis:travel*.6,steerAxis:.4});
    const heading=car.heading,speed=Math.abs(car.speed),wheelAngle=Math.abs(car.steering);
    car.step(1/120,{throttleAxis:0,steerAxis:0,smoothDrive:true});
    assert.ok(Math.abs(car.speed)>0&&Math.abs(car.speed)<speed);
    assert.ok(Math.abs(car.steering)<wheelAngle);
    advance(car,480,{throttleAxis:0,steerAxis:0});
    assert.equal(car.speed,0);
    assert.ok(Math.abs(car.steering)<1e-9);
    assert.equal(angleDifference(car.heading,heading),0);
  }
});
