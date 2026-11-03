import test from 'node:test';
import assert from 'node:assert/strict';
import {createMobileDrivingSession} from '../src/mobile-driving-session.js';

function fixture(){
  let stops=0;
  const session=createMobileDrivingSession({onStop:()=>stops++});
  const idle=(frames=4,values={})=>{for(let i=0;i<frames;i++)session.updateMotion({speed:0,dt:.1,...values});};
  return {session,idle,get stops(){return stops;}};
}

test('entering Explore leaves the pads available until actual motion has occurred',()=>{
  const f=fixture();f.session.updateMotion({speed:5,dt:.1});f.idle(10);assert.equal(f.stops,0);
  f.session.setActive(true);f.idle(30);assert.equal(f.stops,0);
  f.session.updateMotion({speed:.035,dt:.1});f.idle(10);assert.equal(f.stops,0,'startup jitter does not arm automatic exit');
  f.session.updateMotion({speed:.036,dt:.1});f.idle(3);assert.equal(f.stops,0);
  f.session.updateMotion({speed:0,dt:.05});assert.equal(f.stops,1);
});

test('forward, reverse and airborne movement arm one exit after a 350ms full stop',()=>{
  for(const motion of [{speed:3},{speed:-2},{airborne:true},{hop:.2}]){
    const f=fixture();f.session.setActive(true);f.session.updateMotion({...motion,dt:.1});
    f.idle(3);assert.equal(f.stops,0);
    f.session.updateMotion({speed:0,dt:.049});assert.equal(f.stops,0);
    f.session.updateMotion({speed:0,dt:.0011});assert.equal(f.stops,1);
    f.idle(30);f.session.updateMotion({speed:4});f.idle(10);assert.equal(f.stops,1,'notification is once per entered session');
  }
});

test('held input, including a neutral owner, prevents exit and restarts the stop delay',()=>{
  const f=fixture();f.session.setActive(true);f.session.setHeld(true);f.session.updateMotion({speed:4,dt:.1});
  f.idle(30);assert.equal(f.stops,0,'a held neutral or steering thumb keeps a stopped session active');
  f.session.setHeld(false);f.idle(3);assert.equal(f.stops,0);
  f.session.setHeld(true);f.idle(10);assert.equal(f.stops,0);
  f.session.setHeld(false);f.idle(3);assert.equal(f.stops,0,'a fresh uninterrupted stop delay follows the last release');
  f.session.updateMotion({speed:0,dt:.05});assert.equal(f.stops,1);
});

test('braking through zero to reverse never exits while the direction control remains held',()=>{
  for(const travel of [1,-1]){
    const f=fixture();f.session.setActive(true);f.session.setHeld(true);
    for(const speed of [travel*5,travel*2,travel*.02,0,0,-travel*.02,-travel*2])f.session.updateMotion({speed,dt:.1});
    f.idle(10);assert.equal(f.stops,0);
    f.session.setHeld(false);f.idle(3);assert.equal(f.stops,0);f.session.updateMotion({speed:0,dt:.05});assert.equal(f.stops,1);
  }
});

test('coasting above the stop threshold and renewed movement reset the settled-stop delay',()=>{
  const f=fixture();f.session.setActive(true);f.session.updateMotion({speed:3});f.idle(3);
  f.idle(10,{speed:.02});assert.equal(f.stops,0,'a slow coast is still movement');
  f.idle(3);assert.equal(f.stops,0);
  f.session.updateMotion({speed:-.1,dt:.1});f.idle(3);assert.equal(f.stops,0);
  f.session.updateMotion({speed:.015,dt:.05});assert.equal(f.stops,1);
});

test('menus and hidden pages can pause the timer without ending the session',()=>{
  const f=fixture();f.session.setActive(true);f.session.updateMotion({speed:2});f.idle(2);
  f.idle(50,{paused:true});assert.equal(f.stops,0);
  f.session.updateMotion({speed:0,dt:.1});assert.equal(f.stops,0);
  f.session.updateMotion({speed:0,dt:.05});assert.equal(f.stops,1);
});

test('explicit exit and reentry reset motion history, held state and the pending stop delay',()=>{
  const f=fixture();f.session.setActive(true);f.session.updateMotion({speed:4});f.idle(3);f.session.setHeld(true);f.session.setActive(false);
  f.idle(10);assert.equal(f.stops,0);f.session.setActive(true);f.idle(10);assert.equal(f.stops,0);
  f.session.updateMotion({speed:-4});f.idle(4);assert.equal(f.stops,1,'the old held owner cannot block a new session');
  f.session.setActive(false);f.session.setActive(true);f.session.updateMotion({speed:4});f.idle(4);assert.equal(f.stops,2);
});

test('repeated active synchronization preserves motion history and long or invalid frame durations cannot force exit',()=>{
  const f=fixture();f.session.setActive(true);f.session.updateMotion({speed:4});f.session.setActive(true);
  for(const dt of [0,-1,NaN])f.session.updateMotion({speed:0,dt});assert.equal(f.stops,0);
  f.session.updateMotion({speed:0,dt:10});assert.equal(f.stops,0,'one delayed frame counts for at most 100ms');
  f.idle(2);assert.equal(f.stops,0);f.session.updateMotion({speed:0,dt:.05});assert.equal(f.stops,1);
});

test('the stop callback can synchronously exit without producing a duplicate notification',()=>{
  let stops=0;
  const session=createMobileDrivingSession({onStop(){stops++;session.updateMotion({dt:.1});session.setActive(false);}});
  session.setActive(true);session.updateMotion({speed:3});for(let i=0;i<20;i++)session.updateMotion({dt:.1});assert.equal(stops,1);
});

test('disposal cancels a pending stop and permanently ignores later session updates',()=>{
  const f=fixture();f.session.setActive(true);f.session.updateMotion({speed:4});f.idle(3);
  f.session.dispose();f.session.dispose();f.idle(10);assert.equal(f.stops,0);
  f.session.setActive(true);f.session.setHeld(false);f.session.updateMotion({speed:4});f.idle(10);assert.equal(f.stops,0);
});
