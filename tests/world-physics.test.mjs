import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../src/vendor/three.module.js';
import { Driver } from '../src/driving.js';
import { PhysicsWorld, ColliderIndex } from '../src/physics.js';
import { collectWorldColliders, createDynamicBody, createInstancedBodies, syncPhysicsBodies } from '../src/world-physics.js';
import { bridges, bridgeHeightAt } from '../src/world-layout.js';

const material = new THREE.MeshStandardMaterial();
const cube = (parent, x, y, z, w = 1, h = 1, d = 1) => {
  const object = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material); object.position.set(x, y, z); parent.add(object); return object;
};

test('physical contacts use real transformed and instanced geometry, without paving or overhead walls', () => {
  const scene = new THREE.Scene(), group = new THREE.Group(); scene.add(group); group.position.set(8, 0, -8); group.scale.setScalar(.85);
  cube(group, 0, 1, 0, 4, 2, 3);
  cube(scene, 0, .1, 0, 30, .12, 30);
  const deck = cube(scene, 0, .4, 3.4, 5, .11, 6.2); deck.userData.bridgeDeck = 'village';
  cube(scene, 0, 3.2, 3.4, 6, .12, .12);
  const movable = cube(scene, 2, .6, -8); movable.userData.propId = 'crate';
  const trees = new THREE.InstancedMesh(new THREE.CylinderGeometry(.15, .2, 1.5, 6), material, 2); scene.add(trees);
  trees.setMatrixAt(0, new THREE.Matrix4().makeTranslation(5, .85, -4)); trees.setMatrixAt(1, new THREE.Matrix4().makeTranslation(-5, .85, -4));
  const contacts = collectWorldColliders({ THREE, roots: [scene], exclude: [movable] });
  assert.equal(contacts.length, 3);
  const house = contacts.find(c => c.object.parent === group);
  assert.ok(Math.abs(house.width - 3.4) < .0001); assert.ok(Math.abs(house.depth - 2.55) < .0001); assert.equal(house.x, 8);
  assert.deepEqual(contacts.filter(c => c.object === trees).map(c => c.x).sort((a, b) => a - b), [-5, 5]);
});

test('a recentered complete prop keeps its appearance and collider follows the simulated body', () => {
  const scene = new THREE.Scene(), building = new THREE.Group(); scene.add(building); building.position.set(5, 0, -8); building.scale.setScalar(.85);
  const bench = new THREE.Group(); bench.position.set(3, 0, 0); building.add(bench); const seat = cube(bench, 0, .6, 0, 2, .2, .7);
  scene.updateMatrixWorld(true); const before = new THREE.Box3().setFromObject(bench);
  const body = createDynamicBody({ THREE, object: bench, parent: scene, id: 'bench', mass: 3 });
  scene.updateMatrixWorld(true); assert.ok(new THREE.Box3().setFromObject(bench).min.distanceTo(before.min) < .000001);
  assert.equal(body.object.userData.propId, 'bench'); assert.equal(bench.parent, body.object); assert.equal(seat.parent, bench);
  const world = new PhysicsWorld({ bodies: [body] }); world.kick('bench', { x: 0, z: -8 }); world.update(.1); syncPhysicsBodies(THREE, world.bodies);
  assert.ok(body.object.position.x > body.x); assert.equal(body.object.position.x, world.bodies[0].x);
  world.reset(); syncPhysicsBodies(THREE, world.bodies); assert.ok(body.object.position.distanceTo(new THREE.Vector3(body.x, body.y, body.z)) < .000001);
});

test('instanced shoreline rocks retain their authored depth, scale and shoreline positions until pushed', () => {
  const scene = new THREE.Scene(), rocks = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), material, 1); scene.add(rocks);
  const original = new THREE.Matrix4().compose(new THREE.Vector3(27.4, -.25, 4), new THREE.Quaternion().setFromEuler(new THREE.Euler(.3, .8, .5)), new THREE.Vector3(.8, .4, .5)); rocks.setMatrixAt(0, original);
  const definitions = createInstancedBodies({ THREE, object: rocks }); const world = new PhysicsWorld({ bodies: definitions });
  for (let i = 0; i < 180; i++) world.update(1 / 60);
  syncPhysicsBodies(THREE, world.bodies); const rendered = new THREE.Matrix4(); rocks.getMatrixAt(0, rendered);
  assert.ok(rendered.elements.every((value, index) => Math.abs(value - original.elements[index]) < .000001));
  assert.equal(world.bodies[0].sleeping, true);
  assert.equal(world.kick('rock-1', { x: 24, z: 4 }), true); world.update(.1); syncPhysicsBodies(THREE, world.bodies);
  assert.ok(Math.abs(world.bodies[0].vx) > .1); assert.equal(world.bodies[0].sleeping, false);
  world.reset(); syncPhysicsBodies(THREE, world.bodies); rocks.getMatrixAt(0, rendered); assert.ok(rendered.elements.every((value, index) => Math.abs(value - original.elements[index]) < .000001));
});

test('snow-only objects neither move nor collide when hidden and wake for visible interactions', () => {
  let snow = false;
  const world = new PhysicsWorld({ bodies: [{ id: 'snowman', x: .8, z: -8, radius: .6, height: 2.2, mass: 2, active: () => snow }] });
  const driver = new Driver(); driver.x = 0; driver.z = -8; driver.vx = 5; driver.speed = 5;
  world.update(.1, driver); assert.equal(world.bodies[0].x, .8); assert.equal(world.kick('snowman'), false);
  snow = true; world.update(1 / 60, driver); assert.ok(world.bodies[0].x > .8); assert.equal(world.kick('snowman', { x: 0, z: -8 }), true);
  const obstacle = { x: 0, z: -5, width: 2, depth: 1, minY: .1, maxY: 2, active: () => snow };
  const car = new Driver([obstacle]); car.x = 0; car.z = -8; car.heading = 0; car.velocityHeading = 0;
  for (let i = 0; i < 60; i++) car.step(1 / 60, { forward: true }); assert.ok(car.z < -6.8);
  snow = false;
  for (let i = 0; i < 90; i++) car.step(1 / 60, { forward: true }); assert.ok(car.z > -4);
});

test('real bridge rails stay solid while the centre deck remains driveable', () => {
  for (const bridge of bridges) {
    const scene = new THREE.Scene(), crossing = new THREE.Group(); scene.add(crossing); crossing.position.set(bridge.x, 0, bridge.z); crossing.rotation.y = bridge.heading;
    for (const side of [-1, 1]) cube(crossing, side * (bridge.width / 2 - .14), .9, 0, .14, 1, bridge.length);
    const deck = cube(crossing, 0, .3, 0, bridge.width - .25, .11, bridge.length); deck.userData.bridgeDeck = bridge.id;
    const colliders = collectWorldColliders({ THREE, roots: [scene] }); assert.equal(colliders.length, 2);
    const car = new Driver(colliders, { routeColliders: [] }); car.x = bridge.x - Math.sin(bridge.heading) * 3; car.z = bridge.z - Math.cos(bridge.heading) * 3; car.heading = bridge.heading; car.velocityHeading = bridge.heading;
    let height = 0;
    for (let i = 0; i < 100; i++) { car.step(1 / 60, { forward: true }); height = Math.max(height, car.groundHeight); }
    assert.ok(height > .3); assert.ok(car.z > bridge.z + 3); assert.ok(bridgeHeightAt(bridge.x, bridge.z) > .5);
  }
});

test('detailed contacts stay out of the route graph and spatial queries stay local', () => {
  const contacts = Array.from({ length: 2000 }, (_, i) => ({ x: i % 50 * 3 - 75, z: Math.floor(i / 50) * 3 - 60, width: .2, depth: .2, minY: .1, maxY: 2 }));
  const grid = new ColliderIndex(contacts); assert.ok(grid.near(0, -8, 1.6).size < 20);
  const car = new Driver(contacts, { routeColliders: [] }); car.x = 0; car.z = -8; car.driveTo(2, -8); assert.deepEqual(car.route, [[2, -8]]);
});

test('portal arch contacts follow the rim and leave the passage open', () => {
  const scene = new THREE.Scene(), arch = new THREE.Mesh(new THREE.TorusGeometry(1.48, .17, 7, 32), material); arch.position.set(0, 1.65, -8); scene.add(arch);
  const colliders = collectWorldColliders({ THREE, roots: [scene] }); assert.ok(colliders.length > 12);
  const car = new Driver(colliders, { routeColliders: [] }); car.x = 0; car.z = -12; car.heading = 0; car.velocityHeading = 0;
  for (let i = 0; i < 100; i++) car.step(1 / 60, { forward: true });
  assert.ok(car.z > -7, `portal passage blocked at ${car.x},${car.z}`);
  const side = new Driver(colliders); side.x = 1.5; side.z = -12; side.heading = 0; side.velocityHeading = 0;
  for (let i = 0; i < 100; i++) side.step(1 / 60, { forward: true });
  assert.ok(side.z < -9.5); assert.ok(side.collisionImpact > 0);
});
