import test from 'node:test';
import assert from 'node:assert/strict';
import { createCarouselClock } from '../src/carousel-clock.js';

function fixture() {
  let time = 10000, id = 0, advances = 0, active = false;
  const tasks = new Map(), changes = [];
  const autoplay = { play() { active = true; }, stop() { active = false; } };
  const clock = createCarouselClock({ autoplay, advance: () => { advances++; clock.restart(); },
    onChange: state => changes.push(state), now: () => time,
    setTimeout: (fn, delay) => { tasks.set(++id, { fn, at: time + delay }); return id; },
    clearTimeout: id => tasks.delete(id) });
  return { clock, changes, tasks, get active() { return active; }, get advances() { return advances; },
    advance(ms) { time += ms; for (const [id, task] of tasks) if (task.at <= time) { tasks.delete(id); task.fn(); } } };
}
test('full cycles use Embla Autoplay and playing a video preserves the remaining countdown', () => {
  const f = fixture(); f.clock.start(); assert.equal(f.active, true); assert.equal(f.tasks.size, 0);
  f.advance(2400); f.clock.hold('video'); assert.equal(f.clock.getState().remaining, 4600); assert.equal(f.active, false);
  f.advance(60000); assert.equal(f.clock.getState().remaining, 4600);
  f.clock.hold('video', false); assert.equal(f.clock.getState().running, true); assert.equal(f.tasks.size, 1);
  f.advance(4599); assert.equal(f.advances, 0); f.advance(1); assert.equal(f.advances, 1);
  assert.equal(f.active, true, 'Normal cycles return to the official plugin after the saved remainder');
  f.clock.destroy(); assert.equal(f.tasks.size, 0);
});
test('visibility, dragging and user pause are independent holds and can pause a resumed remainder', () => {
  const f = fixture(); f.clock.start(); f.advance(1000); f.clock.hold('video');
  f.clock.hold('hidden'); f.clock.hold('video', false); assert.equal(f.clock.getState().running, false);
  f.clock.hold('hidden', false); f.advance(2000); f.clock.hold('drag'); assert.equal(f.clock.getState().remaining, 4000);
  f.clock.hold('user'); f.clock.hold('drag', false); assert.equal(f.tasks.size, 0);
  f.clock.hold('user', false); assert.equal(f.tasks.size, 1); f.advance(4000); assert.equal(f.advances, 1); f.clock.destroy();
});
test('manual selection starts a fresh cycle and destroy prevents queued advances', () => {
  const f = fixture(); f.clock.start(); f.advance(3000); f.clock.hold('video'); f.clock.hold('video', false);
  assert.equal(f.tasks.size, 1); f.clock.restart(); assert.equal(f.tasks.size, 0); assert.equal(f.clock.getState().remaining, 7000);
  f.advance(2000); f.clock.hold('video'); f.clock.hold('video', false); f.clock.destroy(); f.clock.destroy();
  f.advance(10000); assert.equal(f.advances, 0); assert.equal(f.active, false); assert.equal(f.tasks.size, 0);
});
