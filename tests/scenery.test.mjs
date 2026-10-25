import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../src/vendor/three.module.js';
import { createScenery } from '../src/scenery.js';
import { bridgeHeightAt, bridges, portals } from '../src/world-layout.js';
import { roadLoop, roadNodes, Driver } from '../src/driving.js';
import { collectWorldColliders } from '../src/world-physics.js';
import { PhysicsWorld,PortalSystem,colliderActive } from '../src/physics.js';
import { collectBreakableTargets,isProtectedObject } from '../src/breakables.js';
import { createBlastDamage } from '../src/blast-damage.js';

function build(coarse = false, reducedMotion = false) {
  const scene = new THREE.Scene(), land = new THREE.Group(); scene.add(land);
  const materials = new Map(), boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  function mat(color) { if (!materials.has(color)) materials.set(color, new THREE.MeshStandardMaterial({ color })); return materials.get(color); }
  function mesh(geometry, material, parent, x = 0, y = 0, z = 0) { const object = new THREE.Mesh(geometry, typeof material === 'string' ? mat(material) : material); object.position.set(x, y, z); parent.add(object); return object; }
  function box(w, h, d, material, parent, x = 0, y = 0, z = 0) { const object = mesh(boxGeometry, material, parent, x, y, z); object.scale.set(w, h, d); return object; }
  function group(parent, x = 0, z = 0) { const object = new THREE.Group(); object.position.set(x, 0, z); parent.add(object); return object; }
  function cylinder(a, b, height, color, parent, x = 0, y = 0, z = 0, segments = 12) { return mesh(new THREE.CylinderGeometry(a, b, height, segments), color, parent, x, y, z); }
  function sphere(radius, color, parent, x, y, z, detail = 1) { return mesh(new THREE.IcosahedronGeometry(radius, detail), color, parent, x, y, z); }
  return { scenery: createScenery({ THREE, scene, land, mesh, mat, box, group, cylinder, sphere, coarse, reducedMotion }), scene };
}

test('detailed scenery constructs finite geometry, matched portal targets, and usable physical props', () => {
  const { scenery, scene } = build();
  assert.equal(scenery.portalGroups.length, portals.length);
  for (const portal of portals) {
    const object = scenery.portalGroups.find(object => object.userData.portalId === portal.id);
    assert.ok(object); assert.equal(object.position.x, portal.x); assert.equal(object.position.z, portal.z);
  }
  assert.equal(scenery.colliders.filter(collider => collider.kind === 'house').length, 4);
  assert.ok(scenery.bodies.length >= 10);
  assert.equal(new Set(scenery.bodies.map(body => body.id)).size, scenery.bodies.length);
  for (const body of scenery.bodies) {
    assert.equal(body.object.userData.propId, body.id);
    assert.equal(body.object.position.y, body.y);
    assert.ok(body.mass > 0 && body.radius > 0 && body.height > 0);
  }
  let triangles = 0, instances = 0;
  scene.traverse(object => {
    if (object.isInstancedMesh) instances++;
    if (!object.geometry) return;
    for (const value of object.geometry.attributes.position.array) assert.ok(Number.isFinite(value));
    triangles += (object.geometry.index ? object.geometry.index.count : object.geometry.attributes.position.count) / 3 * (object.isInstancedMesh ? object.count : 1);
  });
  assert.ok(instances >= 8); assert.ok(triangles < 90000, `Five-bridge scenery should stay within its 90k triangle budget, got ${triangles} triangles`);
  scenery.dispose(); assert.equal(scenery.root.parent, null);
});

test('bridge plank centers share the physical arch surface without covering the drive lane', () => {
  const { scenery } = build();
  for (const bridge of bridges) {
    const crossing = scenery.root.getObjectByName(`Arched ${bridge.id} bridge`);
    const planks = crossing.children.filter(child => child.userData.bridgeDeck === bridge.id);
    assert.ok(planks.length >= 15);
    for (const plank of planks) {
      const x = bridge.x + Math.sin(bridge.heading) * plank.position.z;
      const z = bridge.z + Math.cos(bridge.heading) * plank.position.z;
      assert.ok(Math.abs(plank.position.y + .055 - bridgeHeightAt(x, z)) < 1e-7);
      assert.ok(plank.scale.x > 3.8);
    }
  }
  scenery.dispose();
});

test('actual portal frames and details survive hard impacts and blasts and still transport the car',()=>{
  const {scenery,scene}=build(),colliders=collectWorldColliders({THREE,roots:[scene],exclude:scenery.bodies.map(b=>b.object)});
  const targets=collectBreakableTargets({THREE,colliders,existing:scenery.breakableTargets}),physics=new PhysicsWorld({bodies:scenery.bodies,colliders}),damage=createBlastDamage({THREE,scene,physics,targets});
  for(const portal of portals){
    const gate=scenery.portalGroups.find(g=>g.userData.portalId===portal.id),belongs=object=>{for(let p=object;p;p=p.parent)if(p===gate)return true;return false;};
    assert.equal(isProtectedObject(gate),true);const contacts=colliders.filter(c=>belongs(c.object));assert.ok(contacts.length>10);assert.ok(contacts.every(c=>!c.breakableId));
    const visible=[];gate.traverse(o=>visible.push([o,o.visible]));for(const c of contacts)assert.equal(damage.impact(c,999),false);damage.blast({x:portal.x,z:portal.z,radius:8});
    for(const [object,wasVisible]of visible)assert.equal(object.visible,wasVisible,object.name);assert.ok(contacts.every(c=>colliderActive(c)));assert.ok(!targets.some(t=>t.parts.some(p=>belongs(p.object))));
    const system=new PortalSystem([{...portal,active:()=>gate.visible}]),driver=new Driver();driver.teleport(portal.x,portal.z);assert.equal(system.update(1/60,driver),portal.id);assert.equal(driver.x,portal.exitX);
  }
  damage.dispose();scenery.dispose();
});

test('new fixed objects keep the original ring-road centerline clear', () => {
  const { scenery } = build();
  for (const collider of scenery.colliders) for (let i = 0; i < roadLoop.length; i++) {
    const a = roadLoop[i], b = roadLoop[(i + 1) % roadLoop.length];
    for (let sample = 0; sample <= 20; sample++) {
      const t = sample / 20, x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t;
      assert.ok(!(Math.abs(x - collider.x) < collider.width / 2 + .65 && Math.abs(z - collider.z) < collider.depth / 2 + .65), `${collider.kind} at ${collider.x},${collider.z} obstructs road ${i}`);
    }
  }
  scenery.dispose();
});

test('guided traffic turns across the east bridge junction in both directions without hitting its visible guards', () => {
  const { scenery, scene } = build();
  const colliders = collectWorldColliders({ THREE, roots: [scene], exclude: scenery.bodies.map(body => body.object) });
  for (const [start, destination] of [['r4', 'r10'], ['r10', 'r4']]) {
    const driver = new Driver(colliders, { routeColliders: scenery.colliders });
    [driver.x, driver.z] = roadNodes[start]; driver.navigate(destination, destination);
    let arrived = null;
    for (let frame = 0; frame < 2400; frame++) {
      const result = driver.step(1 / 60); if (result.arrived) { arrived = result.arrived; break; }
      if (!driver.route.length) break;
    }
    assert.equal(arrived, destination, `${start} → ${destination} stuck at ${driver.x},${driver.z}`);
  }
  scenery.dispose();
});

test('weather, lantern lighting, and portal animation preserve physics-owned prop transforms', () => {
  const { scenery } = build();
  const body = scenery.bodies[0]; body.object.position.set(9, 2, -3);
  const water = scenery.root.getObjectByName('Winding animated river');
  const before = water.geometry.attributes.position.getY(10);
  scenery.update(1, 3, { night: 1, weather: 'snow' });
  assert.deepEqual(body.object.position.toArray(), [9, 2, -3]);
  assert.notEqual(water.geometry.attributes.position.getY(10), before);
  assert.ok(scenery.lamps.some(lamp => lamp.isMaterial && lamp.emissiveIntensity > 1));
  let visibleSnow = 0; scenery.root.traverse(object => { if (object.isMesh && object.material.transparent && object.material.opacity > .1 && object.material.color?.getHex() === 0xeff2e8) visibleSnow++; });
  assert.equal(visibleSnow, 8);
  scenery.reset(); assert.deepEqual(body.object.position.toArray(), [9, 2, -3]); scenery.dispose();
});

test('reduced motion retains river and weather styling while stopping decorative movement', () => {
  const { scenery } = build(true, true);
  const water = scenery.root.getObjectByName('Winding animated river'), before = [...water.geometry.attributes.position.array];
  scenery.update(2, 20, { night: 1, weather: 'snow' });
  assert.deepEqual([...water.geometry.attributes.position.array], before);
  assert.ok(scenery.lamps.some(lamp => lamp.isMaterial && lamp.emissiveIntensity > 1)); scenery.dispose();
});
