import test from 'node:test';
import assert from 'node:assert/strict';
import { createProjectCarousel, carouselParallax } from '../src/project-carousel.js';
import { renderProjectCarousel } from '../src/project-carousel-view.js';
import { projects, localizeProject } from '../src/data.js';
import { getProjectMedia } from '../src/project-media.js';

const settle = async () => { for (let i = 0; i < 10; i++) await Promise.resolve(); };
class Element extends EventTarget {
  dataset = {}; style = {}; attributes = new Map(); nodes = new Map(); innerHTML = ''; textContent = '';
  classes = new Set(); classList = { toggle: (key, value) => value ? this.classes.add(key) : this.classes.delete(key) };
  setAttribute(key, value) { this.attributes.set(key, value); }
  getAttribute(key) { return this.attributes.get(key) ?? null; }
  removeAttribute(key) { this.attributes.delete(key); }
  toggleAttribute(key, value) { if (value) this.setAttribute(key, ''); else this.removeAttribute(key); }
  querySelector(selector) { return this.nodes.get(selector) ?? null; }
  getBoundingClientRect() { return { width: 600, height: 400 }; }
  closest() { return null; } matches() { return true; } contains(element) { return element === this; }
  click() { this.dispatchEvent(new Event('click')); }
}
class Video extends Element {
  baseURI = 'https://portfolio.test/'; paused = true; ended = false; plays = 0; loads = 0; currentTime = 0; pending = [];
  set src(value) { this.setAttribute('src', value); } get src() { return this.getAttribute('src') || ''; }
  querySelectorAll() { return []; }
  load() { this.loads++; this.paused = true; this.currentTime = 0; }
  pause() { this.paused = true; this.dispatchEvent(new Event('pause')); }
  play() { this.plays++; this.paused = false; this.ended = false; this.dispatchEvent(new Event('play')); return this.pending.shift() ?? Promise.resolve(); }
  finish() { this.paused = true; this.ended = true; this.dispatchEvent(new Event('ended')); }
}

function fixture({ language = 'en', reduced = false } = {}) {
  let time = 10000, sequence = 0, selected = 0, active = true, observer, api, autoplay;
  const tasks = new Map(), callbacks = new Map(), selections = [], page = new Element(); page.hidden = false;
  const schedule = (fn, delay) => { tasks.set(++sequence, { fn, at: time + delay }); return sequence; };
  const cancel = id => tasks.delete(id);
  const root = new Element(), viewport = new Element();
  for (const selector of ['[data-carousel-viewport]','[data-carousel-progress]','[data-carousel-autoplay]','[data-carousel-status]','[data-carousel-count]','[data-carousel-prev]','[data-carousel-next]']) root.nodes.set(selector, selector.includes('viewport') ? viewport : new Element());
  const entries = projects.map(project => {
    const slide = new Element(), video = new Video(), button = new Element(), layer = new Element(), dot = new Element();
    slide.dataset.carouselProject = project.id;
    slide.nodes.set('[data-carousel-video]', video); slide.nodes.set('[data-carousel-play]', button); slide.nodes.set('[data-carousel-parallax]', layer);
    root.nodes.set(`[data-carousel-index="${projects.indexOf(project)}"]`, dot);
    dot.dataset.carouselIndex = String(projects.indexOf(project));
    return { slide, video, button, layer, dot };
  });
  root.querySelectorAll = selector => selector === '[data-carousel-project]' ? entries.map(entry => entry.slide) : entries.map(entry => entry.dot);
  const query = new Element(); query.matches = reduced;
  class Observer { constructor(callback) { this.callback = callback; observer = this; } observe() {} disconnect() { this.disconnected = true; } show(isIntersecting) { this.callback([{ target: root, isIntersecting }]); } }
  const Autoplay = options => {
    let timer = null, playing = false;
    autoplay = { options, play() { playing = true; if (timer !== null) cancel(timer); timer = schedule(() => { api.scrollNext(); this.play(); }, options.delay); api.emit('autoplay:timerset'); },
      stop() { playing = false; if (timer !== null) cancel(timer); timer = null; }, isPlaying: () => playing };
    return autoplay;
  };
  const EmblaCarousel = (_, options) => {
    selected = options.startIndex;
    api = {
      options, selectedScrollSnap: () => selected, scrollProgress: () => selected / entries.length,
      scrollSnapList: () => entries.map((_, index) => index / entries.length), slidesInView: () => [selected],
      internalEngine: () => ({ options: { loop: true }, slideRegistry: entries.map((_, index) => [index]), slideLooper: { loopPoints: [] } }),
      on(event, fn) { if (!callbacks.has(event)) callbacks.set(event, new Set()); callbacks.get(event).add(fn); return this; },
      off(event, fn) { callbacks.get(event)?.delete(fn); return this; }, emit(event) { for (const fn of callbacks.get(event) || []) fn(this, event); return this; },
      scrollTo(index) { if (index === selected) return; selected = index; this.emit('select'); this.emit('scroll'); },
      scrollNext() { this.scrollTo((selected + 1) % entries.length); }, scrollPrev() { this.scrollTo((selected - 1 + entries.length) % entries.length); },
      canScrollNext: () => true, reInit() { this.emit('reInit'); }, destroy() { autoplay.stop(); this.destroyed = true; }
    };
    return api;
  };
  const labels = { pause: 'Pause previews', resume: 'Resume previews', watching: 'Watching', automatic: 'Automatic', paused: 'Paused', watch: 'Watch full video', videoPlay: 'Play video', videoPause: 'Pause video' };
  const controller = createProjectCarousel({ root, EmblaCarousel, Autoplay, mediaFor: id => getProjectMedia(id, language), labels, initialId: 'hr', onSelect: id => selections.push(id),
    isActive: () => active, document: page, IntersectionObserver: Observer, motionQuery: query, now: () => time, setTimeout: schedule, clearTimeout: cancel });
  return { root, entries, api, controller, observer, query, tasks, selections, autoplay,
    advance(ms) { const end = time + ms; for (;;) { const next = [...tasks].sort((a,b) => a[1].at - b[1].at)[0]; if (!next || next[1].at > end) break; time = next[1].at; tasks.delete(next[0]); next[1].fn(); } time = end; },
    hide(value) { page.hidden = value; page.dispatchEvent(new Event('visibilitychange')); },
    setActive(value) { active = value; controller.refresh(); } };
}

test('all six language-matched previews cycle with one loaded video and no looping', async () => {
  for (const language of ['en', 'vi']) {
    const f = fixture({ language }); await settle();
    for (let index = 0; index < projects.length; index++) {
      const selected = f.entries[index];
      assert.equal(f.controller.getState().id, projects[index].id);
      assert.equal(selected.video.src, getProjectMedia(projects[index].id, language).video);
      assert.equal(selected.video.muted, true); assert.equal(selected.video.loop, false); assert.equal(selected.video.paused, false);
      assert.equal(f.entries.filter(entry => entry.video.src).length, 1);
      assert.equal(selected.slide.getAttribute('inert'), null);
      f.advance(7000); await settle();
    }
    assert.equal(f.controller.getState().id, 'hr'); f.controller.destroy();
    assert.equal(f.tasks.size, 0); assert.ok(f.entries.every(entry => !entry.video.src && entry.video.paused));
  }
});
test('playing the full video freezes the countdown until ended, then resumes the exact remainder', async () => {
  const f = fixture(); await settle(); f.advance(2400);
  f.entries[0].button.click(); await settle();
  assert.equal(f.controller.getState().watching, true); assert.equal(f.controller.getState().remaining, 4600);
  assert.equal(f.entries[0].video.controls, true); assert.equal(f.entries[0].video.loop, false);
  f.advance(30000); assert.equal(f.controller.getState().id, 'hr');
  f.entries[0].video.finish(); assert.equal(f.controller.getState().watching, false);
  f.advance(4599); assert.equal(f.controller.getState().id, 'hr'); f.advance(1); await settle();
  assert.equal(f.controller.getState().id, 'crypto'); f.controller.destroy();
});
test('pausing a full video keeps the slide held; explicit carousel resume or selection releases it', async () => {
  const f = fixture(); await settle(); f.entries[0].button.click(); await settle(); f.entries[0].button.click();
  assert.equal(f.entries[0].video.paused, true); f.advance(20000); assert.equal(f.controller.getState().id, 'hr');
  f.root.querySelector('[data-carousel-autoplay]').click(); assert.equal(f.controller.getState().watching, false);
  f.advance(7000); await settle(); assert.equal(f.controller.getState().id, 'crypto');
  f.entries[1].button.click(); await settle(); f.controller.select('icue'); await settle();
  assert.equal(f.controller.getState().id, 'icue'); assert.equal(f.entries[1].video.paused, true);
  assert.equal(f.controller.getState().running, true); f.controller.destroy();
});
test('replaying through native video controls pauses the carousel again', async () => {
  const f = fixture(); await settle(); f.advance(1600); await f.controller.play();
  const video = f.entries[0].video; video.finish(); f.advance(2000);
  await video.play(); assert.equal(f.controller.getState().watching, true);
  assert.equal(f.controller.getState().remaining, 3400);
  f.advance(20000); assert.equal(f.controller.getState().id, 'hr');
  video.finish(); f.advance(3400); await settle(); assert.equal(f.controller.getState().id, 'crypto');
  f.controller.destroy();
});
test('a full-video request wins over an earlier preview binding', async () => {
  const f = fixture();
  f.entries[0].button.click(); await settle();
  assert.equal(f.entries[0].video.controls, true);
  assert.equal(f.controller.getState().watching, true);
  assert.equal(f.controller.getState().running, false);
  assert.equal(f.entries[0].video.plays, 1, 'The obsolete automatic preview does not issue a second play');
  f.controller.destroy();
});
test('offscreen, hidden and inactive panels pause without automatically replaying on return', async () => {
  const f = fixture(); await settle(); const video = f.entries[0].video;
  for (const pause of [value => f.observer.show(!value), value => f.hide(value), value => f.setActive(!value)]) {
    await f.controller.play(); await settle(); const plays = video.plays;
    pause(true); assert.equal(video.paused, true); pause(false); await settle(); assert.equal(video.plays, plays); assert.equal(video.paused, true);
  }
  f.controller.destroy(); assert.equal(f.observer.disconnected, true);
});
test('reduced motion starts with a static preview, while an explicit full video remains available', async () => {
  const f = fixture({ reduced: true }); await settle(); assert.equal(f.controller.getState().running, false); assert.equal(f.entries[0].video.plays, 0);
  f.advance(20000); assert.equal(f.controller.getState().id, 'hr');
  f.entries[0].button.click(); await settle(); assert.equal(f.entries[0].video.paused, false);
  f.entries[0].video.finish(); assert.equal(f.controller.getState().running, false); f.controller.destroy();
});
test('late preview play completion cannot revive a closed or hidden carousel', async () => {
  for (const close of [true, false]) {
    const f = fixture(); await settle(); f.controller.select('crypto');
    let resolve; const entry = f.entries[1]; entry.video.pending.push(new Promise(r => resolve = r)); await settle();
    if (close) f.controller.destroy(); else f.hide(true);
    resolve(); await settle(); assert.equal(entry.video.paused, true);
    f.controller.destroy(); assert.equal(f.tasks.size, 0);
  }
});
test('parallax follows loop boundaries and is disabled for reduced motion', () => {
  const nodes = [new Element(), new Element()];
  const api = { internalEngine: () => ({ options: { loop: true }, slideRegistry: [[0],[1]], slideLooper: { loopPoints: [{ index: 0, target: () => 1 }] } }),
    scrollProgress: () => .96, slidesInView: () => [0,1], scrollSnapList: () => [0,.5] };
  carouselParallax(api,nodes); assert.equal(nodes[0].style.transform, 'translate3d(-1.440%,0,0)');
  carouselParallax(api,nodes,true); assert.ok(nodes.every(node => node.style.transform === 'translate3d(0.000%,0,0)'));
});
test('carousel markup keeps MP4 sources, bilingual recording labels, and explicit player controls', () => {
  for (const language of ['en','vi']) {
    const html = renderProjectCarousel({ projects, mediaFor: p => getProjectMedia(p.id,language), localize: p => localizeProject(p,language),
      storyFor: () => ({ teaser: 'A useful project.' }), captionFor: () => '', labels: {}, initialId: 'hr', language });
    assert.equal((html.match(/data-carousel-video/g)||[]).length, 6);
    assert.equal((html.match(/preload="none"/g)||[]).length, 6);
    for (const project of projects) assert.ok(html.includes(getProjectMedia(project.id,language).video));
    assert.ok(!html.includes(' autoplay')); assert.ok(!html.includes(' loop'));
  }
});
