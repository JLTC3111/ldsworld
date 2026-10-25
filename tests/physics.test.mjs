import test from 'node:test';
import assert from 'node:assert/strict';
import { Driver, planGroundRoute, angleDifference } from '../src/driving.js';
import { PhysicsWorld, PortalSystem } from '../src/physics.js';
import { bridges, bridgeHeightAt, crossesWater, isWater, portals, riverCenter } from '../src/world-layout.js';

test('shallow streams accept direct routes and a driver can ford them without a bridge',()=>{
  const start=[-8,0],goal=[-8,8],route=planGroundRoute(start,goal);
  assert.deepEqual(route,[goal]);assert.equal(crossesWater(start,goal),true);
  const driver=new Driver();[driver.x,driver.z]=start;driver.driveTo(...goal);let waded=false,lowest=0;
  for(let i=0;i<900&&driver.route.length;i++){assert.equal(driver.step(1/60).cancelled,false);waded||=driver.inWater;lowest=Math.min(lowest,driver.groundHeight);}
  assert.ok(waded&&lowest<-.04);assert.ok(Math.hypot(driver.x-goal[0],driver.z-goal[1])<1.3);
});

test('manual driving crosses the stream with water drag instead of an invisible bank collision',()=>{
  const driver=new Driver();driver.x=8;driver.z=0;driver.heading=driver.velocityHeading=0;
  let waded=false,impact=0,lowest=0,lowestWheel=0;
  for(let i=0;i<120;i++){driver.step(1/60,{forward:true});waded||=driver.inWater;impact=Math.max(impact,driver.collisionImpact);lowest=Math.min(lowest,driver.groundHeight);lowestWheel=Math.min(lowestWheel,...Object.values(driver.wheelHeights));}
  assert.ok(waded&&lowest<-.01&&lowestWheel<=-.089);assert.ok(driver.z>riverCenter(8)+2);assert.equal(impact,0);assert.ok(Math.abs(driver.groundHeight)<.001);
});

test('the full front bumper stops before a wall rather than letting the hood pass through', () => {
  const driver = new Driver([{ x: 0, z: 9, width: 8, depth: 2 }]);
  driver.heading = Math.PI; driver.velocityHeading = Math.PI;
  for (let i = 0; i < 240; i++) { driver.step(1 / 60, { forward: true }); assert.ok(driver.z - 1.33 >= 10 - .001); }
  assert.ok(driver.z >= 11.33);
});

test('side panels and the rotated front corner resolve against fixed scenery', () => {
  const side = new Driver([{ x: 2, z: -8, width: 1, depth: 8 }]);
  side.x = .9; side.z = -8; side.heading = 0; side.velocityHeading = 0; side.step(1 / 60);
  assert.ok(side.x + .84 <= 1.5 + .001);
  const diagonal = new Driver([{ x: 5, z: -6, width: 1, depth: 30 }]);
  diagonal.x = 0; diagonal.z = -8; diagonal.heading = Math.PI / 4; diagonal.velocityHeading = diagonal.heading;
  const extent = (.84 + 1.33) / Math.sqrt(2);
  for (let i = 0; i < 120; i++) { diagonal.step(1 / 60, { forward: true }); assert.ok(diagonal.x + extent <= 4.5 + .001); }
});

test('bridge ramps raise the car on a damped suspension and tilt it with the deck', () => {
  const bridge = bridges.find(bridge => bridge.id === 'village');
  assert.ok(bridgeHeightAt(bridge.x, bridge.z) > .5);
  const driver = new Driver(); driver.x = 0; driver.z = 0; driver.heading = 0; driver.velocityHeading = 0;
  let height = 0, pitch = 0;
  for (let i = 0; i < 180; i++) { driver.step(1 / 60, { forward: true }); height = Math.max(height, driver.groundHeight); pitch = Math.max(pitch, Math.abs(driver.pitch)); }
  assert.ok(height > .3 && height < .8); assert.ok(pitch > .05); assert.ok(driver.z > bridge.z + bridge.length / 2);
  assert.ok(driver.rpm > 650 && Number.isFinite(driver.acceleration)); assert.ok(driver.gear > 0);
  assert.equal(Object.values(driver.wheelHeights).length, 4);
});

test('snow reduces tire grip and lets a released car coast farther than dry pavement', () => {
  const dry = new Driver(), snow = new Driver(); snow.setWeather('snow');
  for (let i = 0; i < 30; i++) { dry.step(1 / 60, { forward: true }); snow.step(1 / 60, { forward: true }); }
  for (let i = 0; i < 30; i++) { dry.step(1 / 60, { forward: true, left: true }); snow.step(1 / 60, { forward: true, left: true }); }
  assert.ok(Math.abs(angleDifference(snow.heading, snow.velocityHeading)) > Math.abs(angleDifference(dry.heading, dry.velocityHeading)) + .03);
  dry.reset(); snow.reset(); snow.setWeather('snow'); dry.speed = 5; snow.speed = 5;
  for (let i = 0; i < 30; i++) { dry.step(1 / 60); snow.step(1 / 60); }
  assert.ok(snow.speed > dry.speed + 1);
});

test('props fall under gravity, bounce, settle at their centre height, and reset', () => {
  const world = new PhysicsWorld({ bodies: [{ id: 'crate', x: 0, z: -8, y: 4, radius: .3, height: .6, mass: 1 }] });
  const array = world.bodies; let bounce = false;
  for (let i = 0; i < 300; i++) { world.update(1 / 60); if (world.bodies[0].vy > .3) bounce = true; }
  assert.ok(bounce); assert.ok(Math.abs(world.bodies[0].y - .42) < .001); assert.equal(world.bodies[0].vy, 0);
  world.reset(); assert.equal(world.bodies, array); assert.equal(world.bodies[0].y, 4); assert.equal(world.bodies[0].vx, 0);
});

test('car impacts transfer momentum, and a heavier crate accelerates less', () => {
  const impact = mass => {
    const world = new PhysicsWorld({ bodies: [{ id: 'crate', x: .9, z: -5, radius: .4, height: .8, mass }] });
    const driver = new Driver(); driver.x = 0; driver.z = -5; driver.speed = 5; driver.vx = 5;
    world.update(1 / 60, driver);
    assert.ok(driver.collisionImpact > 0); assert.ok(driver.speed < 5 && driver.speed > 0); assert.ok(world.bodies[0].tiltZ < 0);
    return world.bodies[0].vx;
  };
  const light = impact(.5), heavy = impact(5);
  assert.ok(light > heavy && heavy > 0);
});

test('moving props collide with each other instead of overlapping', () => {
  const world = new PhysicsWorld({ bodies: [{ id: 'a', x: 0, z: -8, radius: .5, mass: 1 }, { id: 'b', x: .9, z: -8, radius: .5, mass: 1 }] });
  world.bodies[0].vx = 4; world.update(1 / 60);
  assert.ok(world.bodies[1].vx > 0); assert.ok(world.bodies[1].x - world.bodies[0].x >= .999);
  assert.ok(world.bodies.every(body => Number.isFinite(body.x + body.y + body.z + body.rotation)));
});

test('solid scenery reflects a moving prop before it crosses the wall', () => {
  const world = new PhysicsWorld({ bodies: [{ x: .4, z: -10, radius: .4, mass: 1 }], colliders: [{ x: 2, z: -10, width: 1, depth: 4 }] });
  world.bodies[0].vx = 5; let reflected = false;
  for (let i = 0; i < 120; i++) { world.update(1 / 60); assert.ok(world.bodies[0].x <= 1.101); if (world.bodies[0].vx < 0) reflected = true; }
  assert.ok(reflected);
});

test('stacked props support a falling crate rather than falling through each other', () => {
  const world = new PhysicsWorld({ bodies: [{ id: 'base', x: -8, z: -8, radius: .5, height: 1, mass: 3 }, { id: 'top', x: -8, z: -8, y: 3, radius: .5, height: .6, mass: 1 }] });
  for (let i = 0; i < 240; i++) world.update(1 / 60);
  const [base, top] = world.bodies;
  assert.ok(Math.abs(base.y - .62) < .001); assert.ok(Math.abs(top.y - 1.42) < .02);
});

test('portal travel resets motion, cancels a route, and cannot immediately loop', () => {
  const driver = new Driver(), system = new PortalSystem();
  driver.x = portals[0].x; driver.z = portals[0].z; driver.speed = 6; driver.route = [[1, 2]];
  assert.equal(system.update(1 / 60, driver), portals[0].id);
  assert.equal(driver.x, portals[0].exitX); assert.equal(driver.z, portals[0].exitZ); assert.equal(driver.speed, 0); assert.equal(driver.route.length, 0);
  driver.x = portals[1].x; driver.z = portals[1].z; assert.equal(system.update(.1, driver), null);
  driver.x = 0; driver.z = 13; for (let i = 0; i < 25; i++) system.update(.1, driver);
  driver.x = portals[1].x; driver.z = portals[1].z; assert.equal(system.update(1 / 60, driver), portals[1].id);
  assert.equal(driver.x, portals[1].exitX); assert.equal(driver.heading, portals[1].heading);
});

test('portal contact uses the larger car footprint so its bumper can enter before the centre reaches the arch',()=>{
  const portal={id:'gate',x:0,z:0,exitX:20,exitZ:20},driver=new Driver(),system=new PortalSystem([portal]);driver.x=0;driver.z=-3;driver.heading=0;driver.profile={...driver.profile,halfWidth:1.4,halfLength:2.2};
  assert.equal(system.update(1/60,driver),'gate');assert.equal(driver.x,20);
  const distant=new Driver();distant.x=0;distant.z=-5;distant.heading=0;system.reset();assert.equal(system.update(1/60,distant),null);
});
