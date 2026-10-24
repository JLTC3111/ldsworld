import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../src/vendor/three.module.js';
import { createFlyover } from '../src/flyover.js';
import { islandFrame } from '../src/camera-framing.js';

function fixture(options = {}) {
  const scene = new THREE.Scene();
  const flyover = createFlyover({ THREE, scene, ...options });
  return { scene, flyover, plane: scene.getObjectByName('Long D. Air') };
}
function advance(flyover, seconds, environment) {
  for (let index = 0; index < Math.round(seconds * 20); index++) flyover.update(.05, environment);
}

test('the flyover builds a detailed, bounded original aircraft without audio or external assets', () => {
  for (const coarse of [false, true]) {
    const f = fixture({ coarse }); let meshes = 0, triangles = 0;
    assert.equal(f.flyover.root.name, 'island-flyover');
    f.flyover.root.traverse(object => {
      if (!object.isMesh) return;
      meshes++;
      for (const value of object.geometry.attributes.position.array) assert.ok(Number.isFinite(value));
      triangles += (object.geometry.index?.count || object.geometry.attributes.position.count) / 3;
      assert.equal(object.material.map, null);
    });
    assert.ok(meshes > 25 && meshes < 65); assert.ok(triangles < 12000);
    const size = new THREE.Box3().setFromObject(f.plane).getSize(new THREE.Vector3());
    assert.ok(size.x > 4 && size.x < 7); assert.ok(size.y > 1 && size.y < 2.5); assert.ok(size.z > 3 && size.z < 6);
    f.flyover.dispose();
  }
});

test('the aircraft crosses the visible center of landscape and portrait island cameras', () => {
  const f = fixture(); assert.equal(f.flyover.getState().visible, false);
  advance(f.flyover, 10.5); assert.equal(f.flyover.getState().visible, true);
  const yaw = Math.atan2(48, 62), pitch = Math.atan2(58, Math.hypot(48, 62));
  for (const [width, height] of [[1440, 900], [1024, 768], [393, 852]]) {
    const frame = islandFrame(width / height, yaw, pitch);
    const camera = new THREE.OrthographicCamera(-frame.width / 2, frame.width / 2, frame.height / 2, -frame.height / 2, .1, 350);
    camera.position.set(48, 58, 62); camera.lookAt(0, 0, 0); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
    const point = f.plane.position.clone().project(camera);
    assert.ok(Math.abs(point.x) < .7 && point.y > -.7 && point.y < .82, `${width}×${height}: aircraft is visible below the header at the center crossing (${point.toArray()})`);
    assert.ok(point.z > -1 && point.z < 1);
  }
  f.flyover.dispose();
});

test('flights depart, recur in the opposite direction, and face their smooth bounded path', () => {
  const f = fixture(); advance(f.flyover, 3); assert.equal(f.flyover.getState().visible, true);
  let previous = f.plane.position.clone(); let sawIdle = false, sawReturn = false;
  for (let index = 0; index < 1300; index++) {
    const state = f.flyover.update(.05), position = new THREE.Vector3(...state.position);
    assert.ok(Math.abs(position.x) <= 38.001 && position.y >= 8.99 && position.y <= 10.26 && Math.abs(position.z) <= 7.01);
    if (!state.visible) sawIdle = true;
    if (state.visible && state.elapsed > 54) { sawReturn = true; assert.ok(Math.sin(state.heading) < 0); }
    if (state.visible && previous.distanceTo(position) > .001 && previous.distanceTo(position) < 1) {
      const forward = new THREE.Vector3(0, 0, 1).applyEuler(f.plane.rotation);
      assert.ok(forward.dot(position.clone().sub(previous).normalize()) > .995);
    }
    previous.copy(position);
  }
  assert.ok(sawIdle && sawReturn); f.flyover.dispose();
});

test('pausing freezes the flight and reduced motion omits the decorative animation', () => {
  const f = fixture(); advance(f.flyover, 7);
  const before = f.flyover.getState(), matrix = [...f.plane.matrixWorld.elements];
  const lamps = []; f.flyover.root.traverse(object => { if (object.material?.emissive?.getHex()) lamps.push(object.material); });
  const daylight = lamps[0].emissiveIntensity;
  advance(f.flyover, 5, { paused: true, night: 1 });
  assert.deepEqual(f.flyover.getState(), before); assert.deepEqual([...f.plane.matrixWorld.elements], matrix);
  assert.ok(lamps[0].emissiveIntensity > daylight);
  const reduced = fixture({ reducedMotion: true }); advance(reduced.flyover, 15);
  assert.equal(reduced.flyover.getState().visible, false); assert.equal(reduced.flyover.getState().elapsed, 0);
  f.flyover.dispose(); reduced.flyover.dispose();
});

test('disposing the flyover removes and releases every owned resource exactly once', () => {
  const f = fixture(); const geometries = new Set(), materials = new Set();
  f.flyover.root.traverse(object => { if (object.geometry) geometries.add(object.geometry); if (object.material) materials.add(object.material); });
  let geometryDisposals = 0, materialDisposals = 0;
  geometries.forEach(value => value.addEventListener('dispose', () => geometryDisposals++));
  materials.forEach(value => value.addEventListener('dispose', () => materialDisposals++));
  f.flyover.dispose(); f.flyover.dispose(); const state = f.flyover.getState(); f.flyover.update(.1);
  assert.deepEqual(f.flyover.getState(), state);
  assert.equal(f.scene.getObjectByName('island-flyover'), undefined);
  assert.equal(geometryDisposals, geometries.size); assert.equal(materialDisposals, materials.size);
});
