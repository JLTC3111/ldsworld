import test from 'node:test';
import assert from 'node:assert/strict';
import { createMobileDrivingVisibility } from '../src/mobile-driving-visibility.js';

function fixture() {
  const classList = () => {
    const classes = new Set();
    return { contains: name => classes.has(name), add: name => classes.add(name), remove: name => classes.delete(name), toggle(name, value) { if (value) classes.add(name); else classes.delete(name); } };
  };
  const page = { hidden: false, activeElement: null, body: { classList: classList() } };
  const hero = { inert: false, classList: classList(), contains: node => node === hero }, dock = { inert: false, classList: classList(), contains: node => node === dock };
  let focuses = 0;
  const controller = createMobileDrivingVisibility({ hero, dock, document: page, focusSurface() {
    assert.equal(page.body.classList.contains('mobile-driving'), false, 'Focus moves before CSS hides the controls');
    assert.equal(dock.inert, false); page.activeElement = null; focuses++;
  } });
  return { page, hero, dock, controller, get focuses() { return focuses; }, moving: () => page.body.classList.contains('mobile-driving') };
}

test('mobile hero and dock remain visible until actual forward, reverse or airborne movement begins', () => {
  for (const motion of [{ speed: 3 }, { speed: -2 }, { airborne: true }, { hop: .2 }]) {
    const f = fixture(); f.controller.setMobile(true);
    for (let i = 0; i < 30; i++) f.controller.updateMotion({ speed: 0, dt: .1 });
    assert.equal(f.moving(), false); assert.equal(f.hero.inert, false); assert.equal(f.dock.inert, false);
    f.page.activeElement = f.dock; f.controller.updateMotion({ ...motion, dt: 1 / 60 });
    assert.equal(f.moving(), true); assert.equal(f.controller.hidden, true); assert.equal(f.hero.inert, true); assert.equal(f.dock.inert, true); assert.equal(f.focuses, 1);
    for (let i = 0; i < 10; i++) f.controller.updateMotion({ ...motion, dt: .1 });
    assert.equal(f.focuses, 1); f.controller.dispose();
  }
});

test('a 350ms stop restores both controls, with hysteresis preventing coasting flicker', () => {
  const f = fixture(); f.controller.updateMotion({ mobile: true, speed: .02, dt: .1 }); assert.equal(f.moving(), false);
  f.controller.updateMotion({ speed: .04, dt: .1 }); assert.equal(f.moving(), true);
  for (let i = 0; i < 10; i++) f.controller.updateMotion({ speed: .02, dt: .1 }); assert.equal(f.moving(), true);
  for (let i = 0; i < 3; i++) f.controller.updateMotion({ speed: 0, dt: .1 }); assert.equal(f.moving(), true);
  f.controller.updateMotion({ speed: 0, dt: .05 }); assert.equal(f.moving(), false); assert.equal(f.hero.inert, false); assert.equal(f.dock.inert, false);
});

test('pause and hidden documents freeze the stop delay, including a stopped frame under a panel', () => {
  const f = fixture(); f.controller.updateMotion({ mobile: true, speed: 5 });
  f.controller.updateMotion({ speed: 0, dt: .1 });
  for (let i = 0; i < 20; i++) f.controller.updateMotion({ paused: true, speed: 0, dt: .1 });
  assert.equal(f.moving(), true);
  f.page.hidden = true; for (let i = 0; i < 20; i++) f.controller.updateMotion({ speed: 0, dt: .1 }); assert.equal(f.moving(), true);
  f.page.hidden = false; f.controller.updateMotion({ speed: 0, dt: .1 }); f.controller.updateMotion({ speed: 0, dt: .1 }); assert.equal(f.moving(), true);
  f.controller.updateMotion({ speed: 0, dt: .05 }); assert.equal(f.moving(), false);
});

test('desktop motion is unchanged and mobile-to-desktop transitions immediately release only the owned visibility', () => {
  const f = fixture(); f.controller.updateMotion({ mobile: false, speed: 10, airborne: true }); assert.equal(f.moving(), false); assert.equal(f.hero.inert, false); assert.equal(f.dock.inert, false);
  f.hero.classList.add('hero-driving'); f.hero.inert = true;
  f.controller.updateMotion({ mobile: true, speed: 4 }); f.controller.setMobile(false);
  assert.equal(f.moving(), false); assert.equal(f.hero.inert, true, 'The desktop exploration lock remains owned by its existing controller'); assert.equal(f.dock.inert, false);
  f.controller.dispose();
});

test('reset and disposal restore controls safely without overriding explicitly hidden UI or preexisting inert state', () => {
  const f = fixture(); f.dock.inert = true; f.controller.updateMotion({ mobile: true, speed: 4 });
  f.page.body.classList.add('ui-hidden'); f.controller.reset();
  assert.equal(f.moving(), false); assert.equal(f.hero.inert, true); assert.equal(f.dock.inert, true);
  f.page.body.classList.remove('ui-hidden'); f.hero.inert = false;
  f.controller.updateMotion({ speed: 5 });
  // Existing UI controllers can rewrite inert on Escape; sync reapplies the
  // mobile lock until motion stops instead of reopening hidden Dock buttons.
  f.hero.inert = false; f.dock.inert = false; f.controller.sync(); assert.equal(f.hero.inert, true); assert.equal(f.dock.inert, true);
  f.controller.dispose(); f.controller.dispose(); assert.equal(f.moving(), false); assert.equal(f.hero.inert, false); assert.equal(f.dock.inert, true);
  f.controller.updateMotion({ mobile: true, speed: 5 }); f.controller.setMobile(true); f.controller.sync(); assert.equal(f.moving(), false);
});
