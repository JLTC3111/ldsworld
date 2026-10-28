import { ISLAND_BOUNDS } from '../src/world-layout.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { projects, localizeProject, copy } from '../src/data.js';
import { Driver, planRoute, roadNodes, angleDifference } from '../src/driving.js';
import { serveStatic } from '../scripts/static-handler.mjs';
import { fileURLToPath } from 'node:url';

const colliders = projects.map(p => ({ x: p.position[0], z: p.position[1], width: p.footprint[0], depth: p.footprint[1] }));
function finishRoute(driver, id) {
  for (let step = 0; step < Math.ceil(driver.routeDurationLimit*60)+120; step++) {
    const result = driver.step(1 / 60);
    if (result.arrived === id) return step / 60;
    if (result.cancelled) return Infinity;
  }
  return Infinity;
}

test('six verified projects have unique stops, original links, and usable local media', async () => {
  assert.equal(projects.length, 6);
  assert.equal(new Set(projects.map(p => p.id)).size, 6);
  for (const [index, project] of projects.entries()) {
    assert.equal(project.number, String(index + 1).padStart(2, '0'));
    assert.ok(roadNodes[project.stop]);
    assert.match(project.github, /^https:\/\/github.com\/JLTC3111\//);
    if (project.live) assert.equal(new URL(project.live).protocol, 'https:');
    for (const [folder, extension] of [['demos', 'mp4'], ['posters', 'jpg']]) {
      const file = new URL(`../src/assets/${folder}/${project.id}.${extension}`, import.meta.url);
      assert.ok((await stat(file)).size > 1000, `${file.pathname} must contain actual media`);
    }
    assert.ok(localizeProject(project, 'vi').description.length > 50);
  }
});

test('English and Vietnamese contain the same interface keys', () => {
  assert.deepEqual(Object.keys(copy.vi).sort(), Object.keys(copy.en).sort());
});

test('the guided tour reaches every stop in order without a reset', () => {
  const driver = new Driver(colliders);
  for (const project of projects) {
    driver.navigate(project.stop, project.id);
    const duration = finishRoute(driver, project.id);
    assert.ok(duration < driver.routeDurationLimit, `${project.id} must be reachable; got ${duration}s at ${driver.x}, ${driver.z}`);
  }
});

test('every project can be reached from every other project', () => {
  for (const source of projects) for (const destination of projects) {
    const driver = new Driver(colliders);
    [driver.x, driver.z] = roadNodes[source.stop];
    driver.heading = Math.PI;
    driver.navigate(destination.stop, destination.id);
    assert.ok(Number.isFinite(finishRoute(driver, destination.id)), `${source.id} → ${destination.id} should arrive`);
  }
});

test('manual input cancels autopilot and stopping input lets the car coast to rest', () => {
  const driver = new Driver(); driver.navigate('r2', 'crypto');
  assert.equal(driver.step(1 / 60, { forward: true }).cancelled, true);
  assert.equal(driver.destinationId, null); assert.equal(driver.route.length, 0);
  for (let i = 0; i < 30; i++) driver.step(1 / 60, { forward: true });
  assert.ok(driver.speed > 0);
  for (let i = 0; i < 300; i++) driver.step(1 / 60);
  assert.equal(driver.speed, 0);
});

test('boost is bounded, reverse works, and the car stays inside the shoreline', () => {
  const driver = new Driver();
  let maxSpeed = 0;
  for (let i = 0; i < 600; i++) { driver.step(1 / 60, { forward: true, boost: true }); maxSpeed = Math.max(maxSpeed, driver.speed); }
  assert.ok(maxSpeed > 30 && maxSpeed <= 48);
  assert.ok(Math.hypot(driver.x / ISLAND_BOUNDS.x, driver.z / ISLAND_BOUNDS.z) <= 1);
  driver.reset();
  for (let i = 0; i < 60; i++) driver.step(1 / 60, { reverse: true });
  assert.ok(driver.speed < 0 && driver.speed >= -7);
  assert.ok(driver.x < 0);
});

test('buildings stop the car and jumping returns it to the ground', () => {
  const driver = new Driver([{ x: 0, z: 9, width: 4, depth: 2 }]);
  driver.heading = Math.PI;
  for (let i = 0; i < 180; i++) driver.step(1 / 60, { forward: true });
  assert.ok(driver.z >= 10.64, `Car should not enter the building: ${driver.z}`);
  driver.jump(); let peak = 0;
  for (let i = 0; i < 120; i++) { driver.step(1 / 60); peak = Math.max(peak, driver.hop); }
  assert.ok(peak > .5); assert.equal(driver.hop, 0);
});

test('road routing validates destinations and angle wrapping takes the short turn', () => {
  assert.throws(() => planRoute([0, 0], 'missing'), /Unknown/);
  assert.deepEqual(planRoute([0, 13], 'r8'), [[0, 13]]);
  assert.ok(Math.abs(angleDifference(-Math.PI + .1, Math.PI - .1) - .2) < .001);
});

test('HTML offers accessible project navigation and a JavaScript-free fallback', async () => {
  const html = await readFile(new URL('../src/index.html', import.meta.url), 'utf8');
  assert.match(html, /<html lang="en" translate="no" class="notranslate">/);
  assert.match(html, /<meta name="google" content="notranslate">/);
  assert.match(html, /<body translate="no" class="notranslate">/);
  assert.match(html, /<dialog id="panel" aria-labelledby="panel-title">/);
  assert.match(html, /class="skip-link"/);
  assert.match(html, /<noscript>/);
  assert.match(html, /name="viewport"/);
  assert.ok(!html.includes('cdn.jsdelivr.net') && !html.includes('fonts.googleapis.com'));
});

test('the static server serves the homepage and modules even when its root has a trailing slash', async () => {
  async function request(url, range) {
    const response = { status: 0, headers: {}, body: null, writeHead(status, headers = {}) { this.status = status; this.headers = headers; }, end(body) { this.body = body; } };
    await serveStatic({ url, headers: range ? { range } : {} }, response, fileURLToPath(new URL('../src/', import.meta.url)), true);
    return response;
  }
  const homepage = await request('/'); assert.equal(homepage.status, 200); assert.match(homepage.body.toString(), /Long D\./);
  const script = await request('/world.js'); assert.equal(script.status, 200); assert.equal(script.headers['Content-Type'], 'text/javascript; charset=utf-8');
  const video = await request('/assets/demos/hr.mp4', 'bytes=0-1023'); assert.equal(video.status, 206); assert.equal(video.body.length, 1024); assert.match(video.headers['Content-Range'], /^bytes 0-1023\//);
  const invalidRange = await request('/assets/demos/hr.mp4', 'bytes=999999999-'); assert.equal(invalidRange.status, 416);
  const missing = await request('/missing'); assert.equal(missing.status, 404);
  const escape = await request('/%2e%2e%2fpackage.json'); assert.equal(escape.status, 403);
});
