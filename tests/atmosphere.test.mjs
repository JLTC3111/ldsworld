import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../src/vendor/three.module.js';
import { EnvironmentClock } from '../src/environment-state.js';
import { createAtmosphere } from '../src/atmosphere.js';

function fixture(options = {}) {
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#e2e8dc'); scene.fog = new THREE.Fog('#e2e8dc', 130, 260);
  const sun = new THREE.DirectionalLight('#fff4da', 2.3); sun.position.set(-26, 48, 24); sun.castShadow = true;
  const hemisphere = new THREE.HemisphereLight('#fff8e8', '#94a184', 1.8);
  const fill = new THREE.DirectionalLight('#d3e3df', .6);
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), new THREE.MeshStandardMaterial({ color: '#e2e8dc' }));
  scene.add(sun, hemisphere, fill, sea);
  const renderer = { toneMappingExposure: 1.05 };
  const atmosphere = createAtmosphere({ THREE, scene, renderer, sun, hemisphere, fill, sea, ...options });
  return { atmosphere, scene, sun, hemisphere, fill, sea, renderer, cleanup() { atmosphere.dispose(); sea.geometry.dispose(); sea.material.dispose(); } };
}

test('the automatic clock begins in the morning and completes a deterministic full day', () => {
  const clock = new EnvironmentClock(); const initial = clock.getState();
  assert.ok(Math.abs(initial.hour - 8.5) < 1e-8); assert.equal(initial.timeMode, 'auto'); assert.equal(initial.weather, 'clear');
  clock.update(270); assert.ok(Math.abs(clock.getState().phase - initial.phase) < 1e-8);
  const beforePause = clock.getState().phase; clock.update(60, true); assert.equal(clock.getState().phase, beforePause);
});

test('time presets expose meaningful day, night, sunrise and sunset states and resume cycling', () => {
  const clock = new EnvironmentClock();
  const noon = clock.setTimeMode('day'); assert.equal(noon.hour, 12); assert.equal(noon.daylight, 1); assert.equal(noon.night, 0);
  const night = clock.setTimeMode('night'); assert.ok(night.night > .95); assert.equal(night.daylight, 0);
  const sunrise = clock.setTimeMode('sunrise'); assert.ok(sunrise.warmth > .5); assert.ok(sunrise.hour > 6 && sunrise.hour < 7);
  const sunset = clock.setTimeMode('sunset'); assert.ok(sunset.warmth > .5); assert.ok(sunset.hour > 17 && sunset.hour < 19);
  clock.update(50); assert.equal(clock.getState().phase, sunset.phase);
  clock.setTimeMode('auto'); clock.update(2); assert.notEqual(clock.getState().phase, sunset.phase);
  assert.throws(() => clock.setTimeMode('unknown'), /Unknown time/);
});

test('weather can be pinned or automatically cycle between clear skies, rain, and snow', () => {
  const clock = new EnvironmentClock();
  assert.equal(clock.setWeather('rain').weather, 'rain'); clock.update(500); assert.equal(clock.getState().weather, 'rain');
  clock.setWeather('auto'); assert.equal(clock.getState().weather, 'clear');
  clock.update(81); assert.equal(clock.getState().weather, 'rain'); clock.update(80); assert.equal(clock.getState().weather, 'snow');
  clock.update(80); assert.equal(clock.getState().weather, 'clear');
  clock.setWeather('auto'); clock.update(81, true); assert.equal(clock.getState().weather, 'clear');
  assert.throws(() => clock.setWeather('hail'), /Unknown weather/);
});

test('sunlight, sky colors, stars and moon respond to the chosen phase', () => {
  const f = fixture(); f.atmosphere.setTimeMode('day'); const daySky = f.scene.background.getHexString(), dayIntensity = f.sun.intensity;
  assert.equal(f.scene.getObjectByName('atmosphere-stars').visible, false);
  f.atmosphere.setTimeMode('night'); assert.notEqual(f.scene.background.getHexString(), daySky); assert.ok(f.sun.intensity < dayIntensity);
  assert.equal(f.scene.getObjectByName('atmosphere-stars').visible, true); assert.equal(f.scene.getObjectByName('atmosphere-moon').visible, true);
  f.atmosphere.setTimeMode('sunrise'); const morningX = f.sun.position.x;
  f.atmosphere.setTimeMode('sunset'); assert.ok(morningX * f.sun.position.x < 0, 'Shadows should change direction between sunrise and sunset');
  assert.ok(f.scene.fog.far > f.scene.fog.near); f.cleanup();
});

test('precipitation stays outside WebGL while weather styling and pause remain active', () => {
  const f = fixture(), stars = f.scene.getObjectByName('atmosphere-stars');
  const positions = stars.geometry.attributes.position, initial = [...positions.array], version = positions.version;
  for (const weather of ['rain', 'snow', 'clear']) {
    f.atmosphere.setWeather(weather); f.atmosphere.update(.05);
    for (const name of ['atmosphere-rain','atmosphere-snow','atmosphere-splashes']) assert.equal(f.scene.getObjectByName(name), undefined);
    const counts = f.atmosphere.getState().particleCounts; assert.equal(counts.rain, 0); assert.equal(counts.snow, 0); assert.equal(counts.splashes, 0);
  }
  const phase = f.atmosphere.getState().phase; f.atmosphere.update(.05, {paused:true});
  assert.equal(f.atmosphere.getState().phase, phase); assert.deepEqual([...positions.array], initial); assert.equal(positions.version, version);
  f.cleanup();
});

test('weather and sunlight follow distant driving positions while ground patches stay anchored',()=>{
  const f=fixture();f.atmosphere.setWeather('snow');
  const root=f.scene.getObjectByName('island-atmosphere'),patches=f.scene.getObjectByName('Weather ground patches');
  const stars=f.scene.getObjectByName('atmosphere-stars'),localStars=[...stars.geometry.attributes.position.array];
  const patch=patches.children[0],position=patch.position.clone(),relativeSun=f.sun.position.clone();
  f.atmosphere.update(0,{focus:{x:110,z:-70}});
  assert.deepEqual(root.position.toArray(),[110,0,-70]);assert.deepEqual(f.sun.target.position.toArray(),[110,0,-70]);
  assert.ok(f.sun.position.clone().sub(root.position).distanceTo(relativeSun)<1e-8);
  assert.deepEqual([...stars.geometry.attributes.position.array],localStars);
  assert.ok(patch.position.equals(position));assert.equal(patch.parent,patches);
  f.cleanup();assert.equal(patches.parent,null);
});

test('mobile and reduced motion keep seasonal lighting with no precipitation geometry', () => {
  const desktop = fixture(), mobile = fixture({coarse:true}), reduced = fixture({reducedMotion:true});
  assert.ok(mobile.atmosphere.getState().particleCounts.stars < desktop.atmosphere.getState().particleCounts.stars);
  for (const f of [desktop,mobile,reduced]) {
    f.atmosphere.setWeather('snow'); f.atmosphere.update(.05);
    const patches=f.scene.getObjectByName('Weather ground patches');
    assert.ok(patches.children.some(patch=>patch.material.opacity>.5));
    assert.equal(f.scene.getObjectByName('atmosphere-snow'),undefined); f.cleanup();
  }
});

test('rain retains overcast lighting, visibility and fixed puddles across the day', () => {
  const f=fixture(),patches=f.scene.getObjectByName('Weather ground patches');
  for (const time of ['day','night','sunrise','sunset']) {
    f.atmosphere.setTimeMode(time);f.atmosphere.setWeather('clear');
    const sky=f.scene.background.getHexString(),fog=f.scene.fog.far;
    f.atmosphere.setWeather('rain');assert.notEqual(f.scene.background.getHexString(),sky);assert.ok(f.scene.fog.far<fog);
    assert.ok(patches.children.some(patch=>patch.material.opacity===.32));
  }
  assert.equal(f.scene.getObjectByName('atmosphere-clouds'),undefined); f.cleanup();
});

test('disposing the atmosphere removes and disposes its resources and restores existing lighting', () => {
  const f = fixture(); const owned = f.scene.getObjectByName('island-atmosphere'); const geometries = new Set(), materials = new Set();
  owned.traverse(object => { if (object.geometry) geometries.add(object.geometry); if (object.material) materials.add(object.material); });
  let disposedGeometries = 0, disposedMaterials = 0;
  geometries.forEach(geometry => geometry.addEventListener('dispose', () => disposedGeometries++)); materials.forEach(material => material.addEventListener('dispose', () => disposedMaterials++));
  f.atmosphere.setTimeMode('night'); f.atmosphere.setWeather('rain'); f.atmosphere.dispose(); f.atmosphere.dispose();
  assert.equal(f.scene.getObjectByName('island-atmosphere'), undefined); assert.equal(disposedGeometries, geometries.size); assert.equal(disposedMaterials, materials.size);
  assert.equal(f.sun.intensity, 2.3); assert.equal(f.renderer.toneMappingExposure, 1.05); assert.equal(f.scene.background.getHexString(), 'e2e8dc');
  f.sea.geometry.dispose(); f.sea.material.dispose();
});
