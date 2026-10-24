import test from 'node:test';
import assert from 'node:assert/strict';
import { createPanelPreviews } from '../src/panel-previews.js';
import { getProjectMedia } from '../src/project-media.js';

const settle = async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); };
const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};

class PreviewVideo {
  constructor(id) { this.dataset = { previewProject: id }; }
  baseURI = 'https://portfolio.test/';
  source = ''; currentSrc = ''; poster = ''; paused = true;
  loads = 0; plays = 0; pauses = 0; pending = [];
  get src() { return this.source ? new URL(this.source, this.baseURI).href : ''; }
  set src(value) { this.source = value; }
  getAttribute(name) { return name === 'src' ? this.source || null : null; }
  removeAttribute(name) { if (name === 'src') this.source = ''; }
  querySelectorAll() { return []; }
  load() { this.loads++; this.currentSrc = this.src; this.paused = true; }
  pause() { this.pauses++; this.paused = true; }
  play() {
    assert.equal(this.muted, true); assert.equal(this.defaultMuted, true);
    assert.equal(this.controls, false); assert.equal(this.playsInline, true); assert.equal(this.loop, true);
    this.plays++; this.paused = false;
    const pending = this.pending.shift();
    // Model a late native playback completion that arrives after an earlier pause.
    return pending ? pending.promise.then(() => { this.paused = false; }) : Promise.resolve();
  }
}

class PreviewDocument {
  hidden = false; listeners = new Set();
  addEventListener(name, listener) { assert.equal(name, 'visibilitychange'); this.listeners.add(listener); }
  removeEventListener(name, listener) { assert.equal(name, 'visibilitychange'); this.listeners.delete(listener); }
  visibility(hidden) { this.hidden = hidden; this.listeners.forEach(listener => listener()); }
}

function setup({ language = 'en', observer = true, active = () => true, ids = ['icue', 'ceremony'] } = {}) {
  const videos = ids.map(id => new PreviewVideo(id)), page = new PreviewDocument();
  const container = { querySelectorAll(selector) { assert.equal(selector, 'video[data-preview-project]'); return videos; } };
  let intersection;
  class FakeIntersectionObserver {
    constructor(callback, options) { this.callback = callback; this.options = options; this.observed = []; this.disconnected = false; intersection = this; }
    observe(video) { this.observed.push(video); }
    disconnect() { this.disconnected = true; }
    show(video, visible) { this.callback([{ target: video, isIntersecting: visible, intersectionRatio: visible ? 1 : 0 }]); }
  }
  const controller = createPanelPreviews({ container, mediaFor: id => getProjectMedia(id, language), isActive: active, document: page, IntersectionObserver: observer ? FakeIntersectionObserver : undefined });
  return { videos, page, container, intersection, controller };
}

test('only cards intersecting the reader bind and play; re-entry preserves their decoder', async () => {
  const { videos: [first, second], container, intersection, controller } = setup();
  assert.equal(intersection.options.root, container);
  assert.equal(intersection.observed.length, 2);
  await settle(); assert.equal(first.source, ''); assert.equal(second.source, '');
  intersection.show(first, true); await settle();
  assert.equal(first.plays, 1); assert.equal(first.paused, false); assert.equal(second.source, '');
  first.currentTime = 8.4; const loads = first.loads;
  intersection.show(first, false); await settle(); assert.equal(first.paused, true);
  assert.ok(first.source, 'A paused offscreen card may retain its resource');
  intersection.show(first, true); await settle();
  assert.equal(first.paused, false); assert.equal(first.loads, loads); assert.equal(first.currentTime, 8.4);
  intersection.show(first, true); await settle(); assert.equal(first.plays, 2, 'Duplicate observer entries must not restart playback');
  controller.destroy();
});

test('document visibility and panel activity pause previews and resume only visible cards', async () => {
  let active = true;
  const { videos: [first, second], page, intersection, controller } = setup({ active: () => active });
  intersection.show(first, true); await settle();
  page.visibility(true); assert.equal(first.paused, true);
  intersection.show(second, true); await settle(); assert.equal(second.source, '', 'Hidden documents must not load a newly visible card');
  intersection.show(second, false);
  page.visibility(false); await settle(); assert.equal(first.paused, false); assert.equal(second.source, '');
  active = false; controller.refresh(); await settle(); assert.equal(first.paused, true);
  page.visibility(true); page.visibility(false); await settle(); assert.equal(first.paused, true);
  active = true; controller.refresh(); await settle(); assert.equal(first.paused, false);
  controller.destroy();
});

test('destroy disconnects, removes its listener, releases all sources, and ignores queued observations', async () => {
  const { videos, page, intersection, controller } = setup();
  videos.forEach(video => intersection.show(video, true)); await settle();
  assert.equal(page.listeners.size, 1); controller.destroy();
  assert.equal(intersection.disconnected, true); assert.equal(page.listeners.size, 0);
  for (const video of videos) { assert.equal(video.source, ''); assert.equal(video.currentSrc, ''); assert.equal(video.paused, true); }
  const loads = videos.map(video => video.loads);
  controller.destroy(); controller.refresh(); intersection.show(videos[0], true); page.visibility(false); await settle();
  assert.deepEqual(videos.map(video => video.loads), loads);
});

test('a late play completion cannot revive a hidden or disposed preview', async () => {
  for (const end of ['hide', 'destroy']) {
    const { videos: [video], page, intersection, controller } = setup({ ids: ['icue'] });
    const pending = deferred(); video.pending.push(pending);
    intersection.show(video, true); await settle(); assert.equal(video.plays, 1);
    if (end === 'hide') page.visibility(true); else controller.destroy();
    pending.resolve(); await settle(); assert.equal(video.paused, true, `${end} must win over a late native playback success`);
    if (end === 'destroy') assert.equal(video.source, '');
    controller.destroy();
  }
});

test('each render resolves the requested English or Vietnamese recording and poster', async () => {
  for (const language of ['en', 'vi']) {
    const { videos: [video], intersection, controller } = setup({ language, ids: ['icue'] });
    intersection.show(video, true); await settle();
    const media = getProjectMedia('icue', language);
    assert.equal(video.source, media.video); assert.equal(video.poster, media.poster);
    assert.equal(video.currentSrc, new URL(media.video, video.baseURI).href);
    controller.destroy();
  }
});

test('without IntersectionObserver visible cards still respect hidden and inactive panels', async () => {
  let active = false;
  const { videos, page, controller } = setup({ observer: false, active: () => active });
  await settle(); assert.ok(videos.every(video => video.source === ''));
  page.visibility(true); active = true; controller.refresh(); await settle();
  assert.ok(videos.every(video => video.source === ''));
  page.visibility(false); await settle(); assert.ok(videos.every(video => !video.paused && video.source));
  controller.destroy(); assert.ok(videos.every(video => video.paused && !video.source));
});
