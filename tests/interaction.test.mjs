import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { bindNavigation, drivingKey, wheelGesture } from '../src/controls.js';
import { autoplayMutedDemo } from '../src/media.js';
import { preferredLanguage } from '../src/preferences.js';
import { Driver } from '../src/driving.js';
import { projects } from '../src/data.js';

class Surface extends EventTarget {
  clientHeight = 800;
  classes = new Set();
  classList = { add: value => this.classes.add(value), remove: value => this.classes.delete(value) };
  setPointerCapture() {}
  hasPointerCapture() { return false; }
}
function emit(target, type, values = {}) {
  const event = new Event(type, { cancelable: true });
  for (const [key, value] of Object.entries({ button: 0, pointerId: 1, clientX: 0, clientY: 0, deltaX: 0, deltaY: 0, ...values })) Object.defineProperty(event, key, { value });
  target.dispatchEvent(event); return event;
}

test('physical WASD keys survive Vietnamese input and uppercase, without claiming browser shortcuts', () => {
  assert.equal(drivingKey({ code: 'KeyW', key: 'ư' }), 'w');
  assert.equal(drivingKey({ code: 'KeyD', key: 'D' }), 'd');
  assert.equal(drivingKey({ key: 'ArrowLeft' }), 'ArrowLeft');
  const surface = new Surface(), keyboard = new Surface(), calls = [];
  const input = bindNavigation({ surface, keyboard, onKey: (...args) => calls.push(args), onClear: () => calls.push(['clear']) });
  assert.equal(emit(keyboard, 'keydown', { code: 'KeyW', key: 'ư' }).defaultPrevented, true);
  assert.equal(emit(keyboard, 'keydown', { code: 'KeyW', key: 'w', metaKey: true }).defaultPrevented, false);
  emit(keyboard, 'keyup', { code: 'KeyW', key: 'w' }); emit(keyboard, 'blur');
  assert.deepEqual(calls, [['w', true], ['w', false], ['clear']]);
  input.dispose(); emit(keyboard, 'keydown', { code: 'KeyW', key: 'w' }); assert.equal(calls.at(-1)[0], 'clear');
});

test('air-roll keys and hydraulic toggles use physical keys, while a held Space never spends a second jump',()=>{
  assert.equal(drivingKey({code:'KeyQ',key:'Q'}),'q');assert.equal(drivingKey({code:'KeyE',key:'ê'}),'e');assert.equal(drivingKey({code:'KeyC',key:'C'}),'c');
  const surface=new Surface(),keyboard=new Surface();let jumps=0,lifts=0;const input=bindNavigation({surface,keyboard,onJump:()=>jumps++,onHydraulics:()=>lifts++});
  emit(keyboard,'keydown',{code:'Space',key:' '});emit(keyboard,'keydown',{code:'Space',key:' ',repeat:true});assert.equal(jumps,1);
  emit(keyboard,'keyup',{code:'Space',key:' '});emit(keyboard,'keydown',{code:'Space',key:' '});assert.equal(jumps,2);
  emit(keyboard,'keydown',{code:'KeyC',key:'c'});emit(keyboard,'keydown',{code:'KeyC',key:'c',repeat:true});assert.equal(lifts,1);input.dispose();
});

test('a scene click travels, while a drag or cancelled gesture never starts an accidental drive', () => {
  const surface = new Surface(), keyboard = new Surface(), clicks = [], rotations = [];
  const input = bindNavigation({ surface, keyboard, onClick: (...point) => clicks.push(point), onOrbit: (...delta) => rotations.push(delta) });
  emit(surface, 'pointerdown', { clientX: 10, clientY: 20 }); emit(surface, 'pointerup', { clientX: 11, clientY: 21 });
  emit(surface, 'pointerdown', { clientX: 10, clientY: 20 }); emit(surface, 'pointermove', { clientX: 45, clientY: 30 }); emit(surface, 'pointerup', { clientX: 45, clientY: 30 });
  emit(surface, 'pointerdown'); emit(surface, 'pointercancel');
  assert.deepEqual(clicks, [[11, 21]]); assert.deepEqual(rotations, [[35, 10]]); assert.equal(surface.classes.size, 0); input.dispose();
});

test('mouse wheel and trackpad pinch zoom, Shift-scroll pans, and paused panels retain native scrolling', () => {
  assert.equal(wheelGesture({ deltaX: 0, deltaY: 3, deltaMode: 1 }).amount, .12);
  const surface = new Surface(), keyboard = new Surface(), zooms = [], pans = []; let paused = false;
  const input = bindNavigation({ surface, keyboard, isPaused: () => paused, onZoom: value => zooms.push(value), onPan: (...delta) => pans.push(delta) });
  emit(surface, 'wheel', { deltaY: 80 }); emit(surface, 'wheel', { deltaY: -10, ctrlKey: true }); emit(surface, 'wheel', { deltaX: 15, deltaY: 20, shiftKey: true });
  paused = true; assert.equal(emit(surface, 'wheel', { deltaY: 80 }).defaultPrevented, false);
  assert.deepEqual(zooms, [.2, -.08]); assert.deepEqual(pans, [[-15, -20]]); input.dispose();
});

test('two-finger gestures pan and pinch without turning the final finger release into a click', () => {
  const surface = new Surface(), keyboard = new Surface(), pans = [], zooms = [], clicks = [];
  const input = bindNavigation({ surface, keyboard, onPan: (...delta) => pans.push(delta), onZoom: value => zooms.push(value), onClick: point => clicks.push(point) });
  emit(surface, 'pointerdown', { pointerId: 1, clientX: 0 }); emit(surface, 'pointerdown', { pointerId: 2, clientX: 100 });
  emit(surface, 'pointermove', { pointerId: 2, clientX: 140, clientY: 20 });
  emit(surface, 'pointerup', { pointerId: 2, clientX: 140, clientY: 20 }); emit(surface, 'pointerup', { pointerId: 1 });
  assert.ok(pans[0][0] > 0); assert.ok(zooms[0] < 0); assert.equal(clicks.length, 0); input.dispose();
});

test('demo playback is muted before play starts, loops inline, and handles denied autoplay', async () => {
  const video = { play() { assert.equal(this.muted, true); assert.equal(this.defaultMuted, true); return Promise.resolve(); } };
  assert.equal(await autoplayMutedDemo(video), true); assert.equal(video.autoplay, true); assert.equal(video.loop, true); assert.equal(video.playsInline, true);
  assert.equal(await autoplayMutedDemo({ play: () => Promise.reject(new Error('NotAllowedError')) }), false);
});

test('Vietnamese can be selected by URL, remembered preference, or browser locale', () => {
  assert.equal(preferredLanguage({ search: '?lang=vi', saved: 'en' }), 'vi');
  assert.equal(preferredLanguage({ saved: 'vi', languages: ['en-US'] }), 'vi');
  assert.equal(preferredLanguage({ languages: ['vi-VN', 'en-US'] }), 'vi');
  assert.equal(preferredLanguage({ search: '?lang=invalid', saved: 'bogus', languages: ['fr-FR'] }), 'en');
});

test('click navigation finds its way around buildings and arrives near the requested spot', () => {
  const colliders = projects.map(p => ({ x: p.position[0], z: p.position[1], width: p.footprint[0], depth: p.footprint[1] }));
  for (const target of [[-16, -7], [9, -10], [-16, 3], [16, 3]]) {
    const driver = new Driver(colliders); driver.driveTo(...target);
    assert.ok(driver.route.length > 0);
    let cancelled = false;
    for (let i = 0; i < 2100 && driver.route.length; i++) if (driver.step(1 / 60).cancelled) cancelled = true;
    assert.equal(cancelled, false, `Route to ${target} should not time out`);
    assert.ok(Math.hypot(driver.x - target[0], driver.z - target[1]) < 1.3, `Route to ${target} should arrive, got ${driver.x}, ${driver.z}`);
  }
});

test('click navigation can leave a building wall after a manual collision', () => {
  const colliders = projects.map(p => ({ x: p.position[0], z: p.position[1], width: p.footprint[0], depth: p.footprint[1] }));
  const driver = new Driver(colliders), wall = colliders[0];
  driver.x = wall.x + wall.width / 2 + .66; driver.z = wall.z;
  driver.driveTo(-20, -7); assert.ok(driver.route.length > 0);
  for (let i = 0; i < Math.ceil(driver.routeDurationLimit*60)+120 && driver.route.length; i++) assert.equal(driver.step(1 / 60).cancelled, false);
  assert.ok(Math.hypot(driver.x + 20, driver.z + 7) < 1.3);
});

function luminance(hex) {
  const rgb = hex.slice(1, 7).match(/../g).map(value => parseInt(value, 16) / 255).map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4);
  return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722;
}
function contrast(a, b) { const values = [luminance(a), luminance(b)].sort((a, b) => b - a); return (values[0] + .05) / (values[1] + .05); }
test('light and dark UI text palettes meet 4.5:1 contrast on panel and control surfaces', async () => {
  const css = await readFile(new URL('../src/styles.css', import.meta.url), 'utf8');
  for (const selector of [':root', 'body.evening']) {
    const block = css.slice(css.indexOf(selector)).split('}')[0];
    const values = Object.fromEntries([...block.matchAll(/(--[\w-]+):\s*(#[\da-f]+)/g)].map(match => [match[1], match[2]]));
    for (const foreground of ['--ink', '--muted', '--faint']) for (const background of ['--ground', '--paper', '--surface', '--surface-soft', '--chrome', '--hover-bg']) {
      const ratio = contrast(values[foreground], values[background]); assert.ok(ratio >= 4.5, `${selector}: ${foreground} on ${background} must reach 4.5:1, got ${ratio.toFixed(2)}`);
    }
    for (const [foreground, background] of [['--button-ink', '--yellow'], ['--button-ink', '--yellow-hover'], ['--active-ink', '--active-bg'], ['--marker-ink', '--marker-bg'], ['--badge-ink', '--badge-bg']]) assert.ok(contrast(values[foreground], values[background]) >= 4.5, `${selector}: ${foreground} on ${background}`);
  }
});
