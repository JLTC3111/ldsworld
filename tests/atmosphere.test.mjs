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

test('rain and snow have real bounded particle geometry and pause without falling', () => {
  const f = fixture(); const rain = f.scene.getObjectByName('atmosphere-rain'), snow = f.scene.getObjectByName('atmosphere-snow');
  f.atmosphere.setWeather('rain'); assert.equal(rain.visible, true); assert.equal(snow.visible, false);
  const rainY = rain.geometry.attributes.position.array[1]; f.atmosphere.update(.05); assert.notEqual(rain.geometry.attributes.position.array[1], rainY);
  const pausedRain = [...rain.geometry.attributes.position.array]; const pausedPhase = f.atmosphere.getState().phase;
  f.atmosphere.update(.05, { paused: true }); assert.deepEqual([...rain.geometry.attributes.position.array], pausedRain); assert.equal(f.atmosphere.getState().phase, pausedPhase);
  f.atmosphere.setWeather('snow'); assert.equal(snow.visible, true); assert.equal(rain.visible, false);
  const snowY = snow.geometry.attributes.position.array[1]; f.atmosphere.update(.05); assert.notEqual(snow.geometry.attributes.position.array[1], snowY);
  for (const object of [rain, snow]) for (const value of object.geometry.attributes.position.array) assert.ok(Number.isFinite(value));
  const stats = f.atmosphere.getState().particleCounts; assert.equal(rain.geometry.attributes.position.count, stats.rain * 2); assert.equal(snow.geometry.attributes.position.count, stats.snow);
  f.cleanup();
});

test('coarse and reduced-motion configurations keep weather recognizable with fewer particles', () => {
  const desktop = fixture(), mobile = fixture({ coarse: true }), reduced = fixture({ reducedMotion: true });
  assert.ok(mobile.atmosphere.getState().particleCounts.rain < desktop.atmosphere.getState().particleCounts.rain);
  assert.ok(reduced.atmosphere.getState().particleCounts.snow < mobile.atmosphere.getState().particleCounts.snow);
  reduced.atmosphere.setWeather('snow'); assert.equal(reduced.scene.getObjectByName('atmosphere-snow').visible, true);
  reduced.atmosphere.update(.05); assert.equal(reduced.scene.getObjectByName('atmosphere-clouds'),undefined);
  desktop.cleanup(); mobile.cleanup(); reduced.cleanup();
});

test('rain strokes stay distinct from the actual day and night sky without cloud geometry', () => {
  const f = fixture(); const rain = f.scene.getObjectByName('atmosphere-rain');
  const luminance = color => color.r * .2126 + color.g * .7152 + color.b * .0722;
  for (const time of ['day', 'night', 'sunrise', 'sunset']) {
    f.atmosphere.setTimeMode(time); f.atmosphere.setWeather('rain');
    const visibleStroke = rain.material.color.clone().lerp(f.scene.background, 1 - rain.material.opacity);
    const a = luminance(visibleStroke), b = luminance(f.scene.background);
    assert.ok((Math.max(a, b) + .05) / (Math.min(a, b) + .05) > 1.65, `${time}: rain remains distinct from sky after transparent blending`);
    const positions = rain.geometry.attributes.position.array;
    assert.ok(positions[4] - positions[1] > 1.7, 'Overview-scale rain has long falling streaks');
    assert.ok(Math.abs(positions[3] - positions[0]) > .1, 'Rain slants with the wind');
  }
  assert.equal(f.scene.getObjectByName('atmosphere-clouds'),undefined);
  assert.ok(f.scene.getObjectByName('atmosphere-splashes').material.opacity > .4);
  f.cleanup();
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
