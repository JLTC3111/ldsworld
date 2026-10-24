import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../src/vendor/three.module.js';
import { createVehicle } from '../src/vehicle.js';
import { Driver } from '../src/driving.js';
import { MIN_ZOOM, MAX_ZOOM, clampZoom, islandFrame, constrainIslandFocus, keepVehicleVisible } from '../src/camera-framing.js';
import { portals, ISLAND_BOUNDS } from '../src/world-layout.js';
import { CAR_PIVOT_HEIGHT } from '../src/aerial-dynamics.js';

const driverState = overrides => ({ x: 0, z: 0, heading: 0, speed: 0, distance: 0, steering: 0, groundHeight: 0, hop: 0, pitch: 0, roll: 0, ...overrides });

test('four visible hydraulic rams retract for charging and extend during the physical jump',()=>{
  const {vehicle}=fixture(),driver=new Driver();
  const pistons=vehicle.root.children.filter(object=>object.name==='hydraulic-piston');
  const cylinders=vehicle.root.children.filter(object=>object.name==='hydraulic-cylinder');
  assert.equal(pistons.length,4);assert.equal(cylinders.length,4);
  vehicle.update(1/60,{driver});const resting=pistons.map(p=>p.scale.y);
  driver.jump();for(let i=0;i<6;i++){driver.step(1/60);vehicle.update(1/60,{driver});}
  assert.ok(vehicle.body.position.y<driver.rideHeight-.07);assert.ok(pistons.every((p,i)=>p.scale.y<resting[i]));
  for(let i=0;i<25;i++){driver.step(1/60);vehicle.update(1/60,{driver});}
  assert.ok(driver.hop>1);assert.ok(pistons.every((p,i)=>p.scale.y>resting[i]));
  for(let i=0;i<180;i++){driver.step(1/60);vehicle.update(1/60,{driver});}
  assert.equal(vehicle.root.position.y,0);assert.equal(vehicle.body.position.y,driver.rideHeight);
  assert.ok(pistons.every((p,i)=>Math.abs(p.scale.y-resting[i])<1e-8));vehicle.dispose();
});
function fixture(options = {}) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'document');
  Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement(type) {
    assert.equal(type, 'canvas');
    return { width: 0, height: 0, getContext(kind) { assert.equal(kind, '2d'); return { fillRect() {}, fillText() {} }; } };
  } } });
  try { const scene = new THREE.Scene(); return { scene, vehicle: createVehicle({ THREE, scene, ...options }) }; }
  finally { if (descriptor) Object.defineProperty(globalThis, 'document', descriptor); else delete globalThis.document; }
}
const wheels = vehicle => vehicle.root.children.filter(object => object.isGroup && object !== vehicle.body && object.children.some(child => child.isGroup));
function resources(root) {
  const geometry = new Set(), material = new Set(), texture = new Set();
  root.traverse(object => {
    if (object.geometry) geometry.add(object.geometry);
    for (const item of Array.isArray(object.material) ? object.material : object.material ? [object.material] : []) {
      material.add(item); if (item.map) texture.add(item.map);
    }
  });
  return { geometry, material, texture };
}

test('the complete vehicle rolls around its centre, its suspension extends clearly, and boost has visible exhaust',()=>{
  const {vehicle}=fixture({reducedMotion:true}),driver=new Driver();vehicle.update(1/60,{driver});const rest=vehicle.hydraulicRams.map(r=>r.piston.scale.y);
  driver.attitude.takeoff(driver.heading);driver.attitude.rotation.setFromAxisAngle(new THREE.Vector3(0,0,1),Math.PI*.7);driver.attitude.updateAxes();driver.hop=3;driver.hydraulicOffset=.48;driver.boosting=true;vehicle.update(1/60,{driver});vehicle.root.updateMatrixWorld(true);
  assert.ok(vehicle.root.quaternion.angleTo(driver.attitude.rotation)<1e-8);const centre=new THREE.Vector3(0,CAR_PIVOT_HEIGHT,0).applyMatrix4(vehicle.root.matrixWorld);assert.ok(centre.distanceTo(new THREE.Vector3(driver.x,3+CAR_PIVOT_HEIGHT,driver.z))<1e-8);
  assert.ok(vehicle.hydraulicRams.every((r,i)=>r.piston.scale.y>rest[i]+.4));assert.equal(vehicle.root.children.filter(o=>o.name==='Rocket boost exhaust'&&o.visible).length,2);
  vehicle.dispose();
});

test('an inverted landing supports the raised cabin above the ground before recovering onto its wheels',()=>{
  const {vehicle}=fixture(),driver=new Driver();driver.attitude.takeoff(driver.heading);driver.attitude.rotation.setFromAxisAngle(new THREE.Vector3(0,0,1),Math.PI);driver.attitude.updateAxes();driver.hop=.02;driver.hopVelocity=-2;driver.step(1/60);vehicle.update(1/60,{driver});vehicle.root.updateMatrixWorld(true);
  assert.equal(driver.hop,0);assert.ok(driver.attitude.recovering);assert.ok(driver.attitude.supportLift>.1);assert.ok(new THREE.Box3().setFromObject(vehicle.body).min.y>-.04);
  for(let i=0;i<180;i++){driver.step(1/60);vehicle.update(1/60,{driver});}assert.equal(driver.attitude.recovering,false);assert.ok(driver.attitude.up.y>.999);vehicle.dispose();
});

test('the detailed car has finite geometry, four grounded wheels, and two forward headlights', () => {
  const { scene, vehicle } = fixture(); let meshes = 0;
  const kinds = new Set();
  vehicle.root.traverse(object => {
    if (!object.isMesh) return; meshes++; kinds.add(object.geometry.type);
    for (const value of object.geometry.attributes.position.array) assert.ok(Number.isFinite(value), 'Geometry positions must stay finite');
    if (object.isInstancedMesh) for (const value of object.instanceMatrix.array) assert.ok(Number.isFinite(value), 'Instanced tire treads must stay finite');
  });
  assert.ok(meshes > 120 && meshes < 350, `Expected a detailed but bounded model; got ${meshes} meshes`);
  assert.ok(kinds.size >= 6); assert.ok(scene.children.includes(vehicle.root));
  const pivots = wheels(vehicle); assert.equal(pivots.length, 4);
  assert.equal(pivots.filter(pivot => pivot.position.x < 0).length, 2); assert.equal(pivots.filter(pivot => pivot.position.z > 0).length, 2);
  for (const pivot of pivots) assert.ok(pivot.position.y >= .3 && pivot.position.y <= .6);
  assert.equal(vehicle.headLights.length, 2);
  const [left, right] = vehicle.headLights;
  assert.ok(left.position.x < 0 && right.position.x > 0);
  for (const light of vehicle.headLights) {
    assert.ok(light.isSpotLight); assert.ok(light.position.z > 1); assert.ok(light.target.position.z > light.position.z + 5);
    assert.ok(light.target.position.y < light.position.y, 'Headlights should shine onto the road');
    assert.ok(light.angle > 0 && light.angle < Math.PI / 3);
  }
  const bounds = new THREE.Box3().setFromObject(vehicle.body).getSize(new THREE.Vector3());
  assert.ok(bounds.x > 1.5 && bounds.x < 2.5); assert.ok(bounds.y > 1.8 && bounds.y < 3); assert.ok(bounds.z > 2.4 && bounds.z < 3.5);
  vehicle.dispose();
});

test('headlight modes work by day and night and brake lamps react to explicit braking and deceleration', () => {
  const { vehicle } = fixture(); const driver = driverState({ speed: 2 });
  vehicle.update(.1, { driver, night: 0, headlights: 'auto' }); const daytime = vehicle.headLights[0].intensity;
  vehicle.update(.1, { driver, night: 1, headlights: 'auto' }); assert.ok(vehicle.headLights.every(light => light.intensity > daytime));
  const beams = vehicle.root.children.filter(object => object.name === 'headlight-beam'); assert.equal(beams.length, 2); assert.ok(beams.every(beam => beam.material.opacity > 0));
  vehicle.update(.1, { driver, night: 1, headlights: 'off' }); assert.ok(vehicle.headLights.every(light => light.intensity === 0)); assert.ok(beams.every(beam => beam.material.opacity === 0));
  vehicle.update(.1, { driver, night: 0, headlights: 'on' }); assert.ok(vehicle.headLights.every(light => light.intensity > daytime));
  const lamps = [...resources(vehicle.root).material].filter(mat => mat.emissive?.getHexString() === 'ff3423'); assert.ok(lamps.length > 0);
  vehicle.update(.1, { driver, night: 0, braking: false }); const idle = lamps[0].emissiveIntensity;
  vehicle.update(.1, { driver, night: 0, braking: true }); assert.ok(lamps[0].emissiveIntensity > idle);
  vehicle.update(.1, { driver, night: 0, braking: false }); vehicle.update(.1, { driver: driverState({ speed: 0 }), night: 0 }); assert.ok(lamps[0].emissiveIntensity > idle);
  vehicle.dispose();
});

test('bridge elevation, suspension, steering, and reverse wheel motion remain coherent', () => {
  const { vehicle } = fixture(); const driver = driverState({ x: 3, z: -4, heading: 1.2, groundHeight: .62, hop: .4, steering: .65, speed: 3, distance: 2, pitch: .06, roll: -.04 });
  vehicle.update(.1, { driver, time: 1 });
  assert.equal(vehicle.root.position.x, 3); assert.equal(vehicle.root.position.z, -4); assert.ok(Math.abs(vehicle.root.position.y - 1.02) < 1e-8); assert.equal(vehicle.root.rotation.y, 1.2);
  const pivots = wheels(vehicle);
  for (const pivot of pivots) { assert.ok(Number.isFinite(pivot.position.y)); if (pivot.position.z > 0) assert.ok(pivot.rotation.y > 0); else assert.equal(pivot.rotation.y, 0); }
  assert.ok(Math.abs(vehicle.body.rotation.x) > 0 || Math.abs(vehicle.body.rotation.z) > 0);
  const roller = pivots[0].children[0], beforeReverse = roller.rotation.x;
  vehicle.update(.1, { driver: { ...driver, speed: -2, distance: 2.2 }, time: 1.1 });
  assert.ok(roller.rotation.x < beforeReverse, 'Reverse travel must spin the wheel in reverse rather than using unsigned total distance');
  vehicle.dispose();
});

test('collision and reset speed discontinuities cannot flip the chassis, including very short frames', () => {
  const { vehicle } = fixture();
  for (const speed of [12, -3, 0, 7, 0]) {
    vehicle.update(.016, { driver: driverState({ speed, steering: 1, pitch: .08, roll: -.05 }) });
    assert.ok(Math.abs(vehicle.body.rotation.x) <= .3, `Pitch must stay bounded after speed ${speed}: ${vehicle.body.rotation.x}`);
    assert.ok(Math.abs(vehicle.body.rotation.z) <= .3);
  }
  vehicle.update(0, { driver: driverState({ speed: 0 }) });
  vehicle.root.traverse(object => { for (const value of [...object.position, object.rotation.x, object.rotation.y, object.rotation.z, ...object.scale]) assert.ok(Number.isFinite(value)); });
  vehicle.dispose();
  const reduced = fixture({ reducedMotion: true }).vehicle;
  reduced.update(.1, { driver: driverState({ speed: 10, steering: 1, pitch: .1, roll: .1 }), time: 2 });
  assert.equal(reduced.body.rotation.x, 0); assert.equal(reduced.body.rotation.z, 0); reduced.dispose();
});

test('disposing the car releases every geometry, material, and number-plate texture exactly once', () => {
  const { scene, vehicle } = fixture(); const owned = resources(vehicle.root), disposed = { geometry: 0, material: 0, texture: 0 };
  for (const key of Object.keys(owned)) for (const resource of owned[key]) resource.addEventListener('dispose', () => disposed[key]++);
  vehicle.dispose(); vehicle.dispose();
  assert.ok(!scene.children.includes(vehicle.root));
  for (const key of Object.keys(owned)) assert.equal(disposed[key], owned[key].size, `Every ${key} should be disposed exactly once`);
});

test('shallow zoom bounds always keep the island footprint at least as large as the viewport', () => {
  assert.equal(MIN_ZOOM, .88); assert.equal(MAX_ZOOM, 1.04); assert.equal(clampZoom(.1), MIN_ZOOM); assert.equal(clampZoom(9), MAX_ZOOM);
  const point = new THREE.Vector3();
  for (const aspect of [320 / 932, 390 / 844, .75, 1, 1.6, 2.4, 3.3]) for (const yaw of [0, .5, Math.PI / 2, Math.PI, -Math.PI / 2, 11 * Math.PI]) for (const pitch of [.4, .7, 1.12]) for (const zoom of [.1, .88, 1, 1.04, 9]) {
    const frame = islandFrame(aspect, yaw, pitch, zoom);
    assert.ok(frame.width > 0 && frame.height > 0 && Number.isFinite(frame.width));
    const camera = new THREE.OrthographicCamera(-frame.width / 2, frame.width / 2, frame.height / 2, -frame.height / 2, .1, 350);
    camera.position.set(Math.sin(yaw) * Math.cos(pitch) * 100, Math.sin(pitch) * 100, Math.cos(yaw) * Math.cos(pitch) * 100); camera.lookAt(0, 0, 0); camera.updateMatrixWorld();
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (let i = 0; i < 160; i++) {
      const angle = i / 160 * Math.PI * 2; point.set(Math.cos(angle) * ISLAND_BOUNDS.x, 0, Math.sin(angle) * ISLAND_BOUNDS.z).project(camera);
      minX = Math.min(minX, point.x); maxX = Math.max(maxX, point.x); minY = Math.min(minY, point.y); maxY = Math.max(maxY, point.y);
    }
    assert.ok(maxX - minX >= 2 && maxY - minY >= 2, `Island must cover viewport bounds at aspect=${aspect}, yaw=${yaw}, pitch=${pitch}, zoom=${zoom}`);
  }
});

test('camera panning remains within spare projected land so it cannot expose empty margins', () => {
  for (const aspect of [.4, 1, 1.6, 3]) for (const yaw of [0, .7, Math.PI / 2, -2.3]) for (const pitch of [.4, .8, 1.12]) {
    const frame = islandFrame(aspect, yaw, pitch, 1.04);
    const landWidth = 2 * Math.hypot(ISLAND_BOUNDS.x * Math.cos(yaw), ISLAND_BOUNDS.z * Math.sin(yaw));
    const landHeight = 2 * Math.sin(pitch) * Math.hypot(ISLAND_BOUNDS.x * Math.sin(yaw), ISLAND_BOUNDS.z * Math.cos(yaw));
    for (const [x, z] of [[0, 0], [999, -999], [-999, 999], [400, 600]]) {
      const focus = constrainIslandFocus(x, z, frame);
      assert.ok(Number.isFinite(focus.x) && Number.isFinite(focus.z));
      const right = focus.x * Math.cos(yaw) - focus.z * Math.sin(yaw);
      const up = -focus.x * Math.sin(yaw) * Math.sin(pitch) - focus.z * Math.cos(yaw) * Math.sin(pitch);
      assert.ok(Math.abs(right) <= frame.horizontalLimit + 1e-8); assert.ok(Math.abs(up) <= frame.verticalLimit + 1e-8);
      assert.ok(Math.abs(right) + frame.width / 2 <= landWidth / 2 + 1e-7, 'Panning must leave the horizontal viewport inside projected land bounds');
      assert.ok(Math.abs(up) + frame.height / 2 <= landHeight / 2 + 1e-7, 'Panning must leave the vertical viewport inside projected land bounds');
    }
  }
});

test('both portal exits keep the detailed vehicle clear of the header and bottom HUD on portrait and desktop', () => {
  const defaultYaw = Math.atan2(48, 62), defaultPitch = Math.atan2(58, Math.hypot(48, 62));
  for (const [width, height] of [[390, 844], [1440, 900]]) for (const zoom of [MIN_ZOOM, 1, MAX_ZOOM]) for (const portal of portals) {
    const frame = islandFrame(width / height, defaultYaw, defaultPitch, zoom);
    const position = { x: portal.exitX, z: portal.exitZ, y: 0 };
    const initial = constrainIslandFocus(position.x, position.z, frame);
    const focus = keepVehicleVisible(initial, frame, position, height);
    assert.ok(Number.isFinite(focus.x) && Number.isFinite(focus.z));
    const camera = new THREE.OrthographicCamera(-frame.width / 2, frame.width / 2, frame.height / 2, -frame.height / 2, .1, 350);
    const offset = new THREE.Vector3(Math.sin(defaultYaw) * Math.cos(defaultPitch), Math.sin(defaultPitch), Math.cos(defaultYaw) * Math.cos(defaultPitch)).multiplyScalar(100);
    camera.position.set(focus.x, 0, focus.z).add(offset); camera.lookAt(focus.x, 0, focus.z); camera.updateMatrixWorld();
    const roof = new THREE.Vector3(position.x, 2.35, position.z).project(camera), feet = new THREE.Vector3(position.x, .1, position.z).project(camera);
    const roofPixel = (.5 - roof.y * .5) * height, feetPixel = (.5 - feet.y * .5) * height;
    assert.ok(roofPixel >= 70, `${portal.id} at ${width}×${height}, zoom ${zoom}: roof ${roofPixel.toFixed(1)}px should clear the header`);
    assert.ok(feetPixel <= height - 50, `${portal.id} at ${width}×${height}, zoom ${zoom}: feet ${feetPixel.toFixed(1)}px should clear bottom controls`);
    assert.ok(roof.x >= -.99 && roof.x <= .99, 'Portal arrivals should also keep the vehicle horizontally visible');
    assert.ok(feet.x >= -.99 && feet.x <= .99);
  }
});
