import test from 'node:test';
import assert from 'node:assert/strict';
import { createNavHoverQueue } from '../src/nav-hover.js';

function fixture() {
  let time = 0, index = 0, moving = false, sequence = 0;
  const tasks = new Map(), commits = [];
  const queue = createNavHoverQueue({ current: () => index, moving: () => moving,
    commit: value => { index = value; moving = true; commits.push(value); },
    setTimeout: (fn, delay) => { tasks.set(++sequence, { fn, at: time + delay }); return sequence; },
    clearTimeout: id => tasks.delete(id) });
  return { queue, commits, tasks, advance(ms) { time += ms; for (const [id, task] of tasks) if (task.at <= time) { tasks.delete(id); task.fn(); } },
    settled() { moving = false; queue.settled(); } };
}
test('rapid hovering commits only the final stable item, including distant targets', () => {
  const f = fixture();
  for (const index of [1, 2, 4, 3, 5]) { f.queue.request(index); f.advance(50); }
  assert.deepEqual(f.commits, []);
  assert.equal(f.tasks.size, 1, 'One pending destination, independent of pointer churn');
  f.advance(110); assert.deepEqual(f.commits, [5]);
  f.queue.dispose();
});
test('an in-flight transition finishes before the latest hovered item starts', () => {
  const f = fixture(); f.queue.request(1); f.advance(110);
  for (const index of [2, 5, 3, 4]) { f.queue.request(index); f.advance(180); }
  assert.deepEqual(f.commits, [1], 'Do not redirect or spawn particles into an unfinished transition');
  f.settled(); assert.deepEqual(f.commits, [1, 4]);
  f.queue.dispose();
});
test('leaving cancels a pending hover and restores the selected destination', () => {
  const f = fixture(); f.queue.request(4); f.advance(50); f.queue.request(0); f.advance(110);
  assert.deepEqual(f.commits, [0]); f.queue.dispose();
});
test('explicit selection can commit immediately and disposal cancels pending work', () => {
  const f = fixture(); f.queue.request(4); f.queue.request(2, true);
  assert.deepEqual(f.commits, [2]); assert.equal(f.tasks.size, 0);
  f.queue.request(5); f.queue.dispose(); f.advance(1000); f.settled();
  assert.deepEqual(f.commits, [2]); assert.equal(f.tasks.size, 0);
});
