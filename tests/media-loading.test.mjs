import test from 'node:test';
import assert from 'node:assert/strict';
import { bindDemoSource, releaseDemo, playDemo, autoplayMutedDemo } from '../src/media.js';

const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };

// Like a native media element, changing the assigned URL does not replace the
// decoder's current resource until the resource-selection algorithm runs.
class NativeVideo {
  baseURI = 'https://portfolio.test/';
  source = ''; currentSrc = ''; poster = ''; paused = true; calls = []; pending = [];
  children = [{ src: './assets/demos/old-child.mp4', removeAttribute(name) { if (name === 'src') this.src = ''; } }];
  get src() { return this.source ? new URL(this.source, this.baseURI).href : ''; }
  set src(value) { this.calls.push(['src', value]); this.source = value; }
  getAttribute(name) { return name === 'src' ? this.source || null : null; }
  removeAttribute(name) { this.calls.push(['remove', name]); if (name === 'src') this.source = ''; else if (name === 'poster') this.poster = ''; }
  querySelectorAll(selector) { assert.equal(selector, 'source'); return this.children; }
  pause() { this.calls.push(['pause', this.currentSrc]); this.paused = true; }
  load() { this.calls.push(['load', this.source]); this.currentSrc = this.src || (this.children[0].src ? new URL(this.children[0].src, this.baseURI).href : ''); this.paused = true; }
  play() {
    this.calls.push(['play', this.currentSrc]);
    assert.equal(this.muted, true); assert.equal(this.defaultMuted, true); assert.equal(this.playsInline, true); assert.equal(this.loop, true);
    this.paused = false; return this.pending.shift()?.promise ?? Promise.resolve();
  }
}

test('binding a language-specific recording resets the retained native source before muted playback', async () => {
  const video = new NativeVideo(); video.currentSrc = 'https://portfolio.test/assets/demos/icue.mp4';
  video.src = './assets/demos/vi/icue.mp4';
  assert.equal(video.currentSrc, 'https://portfolio.test/assets/demos/icue.mp4', 'A DOM URL assignment alone is not a decoder assertion'); video.calls = [];
  assert.equal(await bindDemoSource(video, { video: './assets/demos/vi/icue.mp4', poster: './assets/posters/vi/icue.jpg' }), true);
  assert.deepEqual(video.calls.map(call => call[0]), ['pause', 'src', 'load', 'play']);
  assert.equal(video.currentSrc, 'https://portfolio.test/assets/demos/vi/icue.mp4'); assert.equal(video.poster, './assets/posters/vi/icue.jpg');
  assert.equal(video.autoplay, true); assert.equal(video.paused, false);
});

test('unchanged bindings and visibility resumes preserve the decoder and playback position', async () => {
  const video = new NativeVideo(), media = { video: './assets/demos/icue.mp4', poster: './assets/posters/icue.jpg' };
  await bindDemoSource(video, media); video.currentTime = 48; video.calls = [];
  await bindDemoSource(video, { ...media, video: 'https://portfolio.test/assets/demos/icue.mp4', poster: './assets/posters/updated.jpg' });
  video.pause(); await autoplayMutedDemo(video); await playDemo(video);
  assert.ok(video.calls.every(call => call[0] !== 'load' && call[0] !== 'src'));
  assert.equal(video.currentTime, 48); assert.equal(video.poster, './assets/posters/updated.jpg');
});

test('a changed source pauses the old recording and stale play promises cannot change the latest selection', async () => {
  const video = new NativeVideo(), oldPlay = deferred(), currentPlay = deferred(); video.pending.push(oldPlay, currentPlay);
  const first = bindDemoSource(video, { video: './assets/demos/icue.mp4', poster: 'en.jpg' });
  const second = bindDemoSource(video, { video: './assets/demos/vi/icue.mp4', poster: 'vi.jpg' });
  assert.ok(video.calls.some(call => call[0] === 'pause' && call[1] === 'https://portfolio.test/assets/demos/icue.mp4'));
  currentPlay.resolve(); assert.equal(await second, true); const callsBeforeOldRejection = video.calls.length;
  oldPlay.reject(new Error('AbortError: old resource was replaced')); assert.equal(await first, false);
  assert.equal(video.calls.length, callsBeforeOldRejection); assert.equal(video.paused, false);
  assert.equal(video.currentSrc, 'https://portfolio.test/assets/demos/vi/icue.mp4'); assert.equal(video.poster, 'vi.jpg');
  const staleSuccess = deferred(); video.pending.push(staleSuccess); const playing = playDemo(video);
  await bindDemoSource(video, { video: './assets/demos/contracts.mp4', poster: 'contracts.jpg' });
  staleSuccess.resolve(); assert.equal(await playing, false); assert.ok(video.currentSrc.endsWith('/contracts.mp4')); assert.equal(video.paused, false);
});

test('release pauses and empties native sources, aborts pending playback, and is idempotent', async () => {
  const video = new NativeVideo(), pending = deferred(); video.pending.push(pending);
  const playing = bindDemoSource(video, { video: './assets/demos/vi/icue.mp4', poster: 'vi.jpg' }); video.calls = [];
  releaseDemo(video); assert.deepEqual(video.calls.map(call => call[0]), ['pause', 'remove', 'load']);
  assert.equal(video.src, ''); assert.equal(video.currentSrc, ''); assert.equal(video.children[0].src, ''); assert.equal(video.autoplay, false); assert.equal(video.paused, true);
  const afterRelease = video.calls.length; releaseDemo(video); assert.equal(await playDemo(video), false); assert.equal(await autoplayMutedDemo(video), false); assert.equal(video.calls.length, afterRelease);
  pending.resolve(); assert.equal(await playing, false); assert.equal(video.paused, true);
  assert.equal(await bindDemoSource(video, { video: './assets/demos/icue.mp4', poster: 'en.jpg' }), true); assert.ok(video.currentSrc.endsWith('/icue.mp4'));
});

test('an external source mutation is rebound while autoplay can be explicitly deferred', async () => {
  const video = new NativeVideo(), media = { video: './assets/demos/icue.mp4', poster: 'en.jpg' };
  await bindDemoSource(video, media); video.src = './assets/demos/wrong.mp4'; video.calls = [];
  assert.equal(await bindDemoSource(video, media, { autoplay: false }), true);
  assert.deepEqual(video.calls.map(call => call[0]), ['pause', 'src', 'load']); assert.equal(video.paused, true); assert.equal(video.autoplay, false);
  assert.ok(video.currentSrc.endsWith('/icue.mp4')); await autoplayMutedDemo(video); assert.equal(video.paused, false);
});

test('denied playback, missing media, and unsupported resource APIs fail without blocking panel cleanup', async () => {
  assert.equal(await bindDemoSource(null, { video: 'demo.mp4' }), false); assert.equal(await bindDemoSource(new NativeVideo(), null), false);
  const video = new NativeVideo(), denied = deferred(); video.pending.push(denied); const playing = bindDemoSource(video, { video: 'demo.mp4' }); denied.reject(new Error('NotAllowedError')); assert.equal(await playing, false);
  assert.doesNotThrow(() => releaseDemo({ pause() { throw new Error('Unsupported'); }, removeAttribute() { throw new Error('Unsupported'); } }));
  assert.equal(await bindDemoSource({ pause() {}, load() { throw new Error('Unsupported'); } }, { video: 'demo.mp4' }), false);
});
