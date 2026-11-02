import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createSplitFlapHeadline } from '../src/split-flap-text.js';

function fixture({ reduced = false } = {}) {
  let doc, sequence = 0;
  const frames = new Map(), observers = [];
  class Element extends EventTarget {
    constructor(name = 'SPAN', text = '') { super(); this.nodeName = name; this.nodeType = name === '#text' ? 3 : 1; this.rawText = text; this.childNodes = []; this.attributes = new Map(); this.styles = new Map(); this.style = { setProperty: (key, value) => this.styles.set(key, value) }; this.classes = new Set(); this.classList = { add: name => this.classes.add(name), remove: name => this.classes.delete(name), contains: name => this.classes.has(name) }; }
    get ownerDocument() { return doc; }
    set className(value) { this.classes = new Set(value.split(' ')); }
    get className() { return [...this.classes].join(' '); }
    set textContent(value) { this.rawText = value; this.childNodes = []; }
    get textContent() { return this.childNodes.length ? this.childNodes.map(node => node.textContent).join('') : this.rawText; }
    set innerHTML(value) {
      this.html = value;
      if (this.nodeName === 'TEMPLATE') {
        this.content = new Element('#document-fragment');
        for (const part of value.split(/(<br\s*\/?\s*>)/i)) this.content.append(new Element(/^<br/i.test(part) ? 'BR' : '#text', /^<br/i.test(part) ? '' : part));
      } else this.childNodes = [];
    }
    get innerHTML() { return this.html; }
    append(child) { child.parentElement = this; this.childNodes.push(child); }
    replaceChildren(...children) { this.childNodes = []; children.forEach(child => this.append(child)); }
    getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }
    setAttribute(name, value) { this.attributes.set(name, value); }
    removeAttribute(name) { this.attributes.delete(name); }
    closest() { return hero; }
  }
  const media = Object.assign(new EventTarget(), { matches: reduced });
  class Observer {
    constructor(callback) { this.callback = callback; this.disconnected = false; observers.push(this); }
    observe() {} disconnect() { this.disconnected = true; }
  }
  class Intersection extends Observer {}
  class Mutation extends Observer {}
  const view = { matchMedia: () => media, getComputedStyle: () => ({ display: 'flex', visibility: 'visible', opacity: '1' }), IntersectionObserver: Intersection, MutationObserver: Mutation,
    requestAnimationFrame(callback) { const id = ++sequence; frames.set(id, callback); return id; }, cancelAnimationFrame(id) { frames.delete(id); } };
  doc = Object.assign(new EventTarget(), { hidden: false, body: new Element('BODY'), defaultView: view, createElement: name => new Element(name.toUpperCase()) });
  const hero = new Element('SECTION'), host = new Element('H1'); host.innerHTML = 'Ideas, made<br>into things.';
  return { host, hero, doc, media, frames, observers,
    tick() { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback()); },
    visibility(hidden) { doc.hidden = hidden; doc.dispatchEvent(new Event('visibilitychange')); },
    intersection(visible) { observers.find(observer => observer instanceof Intersection).callback([{ isIntersecting: visible }]); },
    mutation() { observers.find(observer => observer instanceof Mutation).callback([]); }
  };
}
const tiles = host => host.childNodes.flatMap(row => row.childNodes);

test('split-flap heading preserves authored words, line breaks, diacritics, and a single accessible phrase on language changes', () => {
  const f = fixture(), controller = createSplitFlapHeadline(f.host);
  assert.equal(f.host.getAttribute('aria-label'), 'Ideas, made into things.');
  assert.equal(f.host.getAttribute('tabindex'), '0');
  assert.deepEqual(f.host.childNodes.map(row => row.childNodes.map(tile => tile.childNodes[0].textContent)), [['Ideas,', 'made'], ['into', 'things.']]);
  assert.ok(f.host.childNodes.every(row => row.getAttribute('aria-hidden') === 'true'));
  controller.refresh('Từ ý tưởng<br>đến thực tế.');
  assert.equal(f.host.getAttribute('aria-label'), 'Từ ý tưởng đến thực tế.');
  assert.deepEqual(f.host.childNodes.map(row => row.childNodes.map(tile => tile.childNodes[0].textContent)), [['Từ', 'ý', 'tưởng'], ['đến', 'thực', 'tế.']]);
  assert.ok(tiles(f.host).every(tile => tile.childNodes.length === 3));
  controller.dispose(); controller.dispose();
  assert.equal(f.host.innerHTML, 'Từ ý tưởng<br>đến thực tế.');
  assert.equal(f.host.getAttribute('aria-label'), null); assert.equal(f.host.getAttribute('tabindex'), null);
  assert.equal(f.frames.size, 0); assert.ok(f.observers.every(observer => observer.disconnected));
});

test('initial reveal, hover, and keyboard focus schedule finite flips and disposal removes listeners', () => {
  const f = fixture(), controller = createSplitFlapHeadline(f.host);
  f.tick(); f.tick(); assert.equal(f.frames.size, 0); assert.ok(tiles(f.host).every(tile => tile.classList.contains('is-flipping')));
  const tile = tiles(f.host)[0], end = new Event('animationend'); Object.defineProperty(end, 'target', { value: tile.childNodes[2] }); f.host.dispatchEvent(end);
  assert.equal(tile.classList.contains('is-flipping'), false);
  f.host.dispatchEvent(new Event('pointerenter')); assert.equal(f.frames.size, 1); f.tick(); f.tick(); assert.equal(f.frames.size, 0);
  f.host.dispatchEvent(new Event('focus')); assert.equal(f.frames.size, 1); f.tick(); f.tick(); assert.equal(f.frames.size, 0);
  controller.dispose(); f.host.dispatchEvent(new Event('pointerenter')); f.host.dispatchEvent(new Event('focus')); assert.equal(f.frames.size, 0);
});

test('hidden tabs, offscreen headings, hidden heroes and panel/UI states cancel and skip motion', () => {
  const f = fixture(), controller = createSplitFlapHeadline(f.host); f.tick(); f.tick();
  f.visibility(true); assert.ok(tiles(f.host).every(tile => !tile.classList.contains('is-flipping'))); assert.equal(controller.replay(), false);
  f.visibility(false); assert.equal(f.frames.size, 0);
  controller.replay(); f.intersection(false); assert.equal(f.frames.size, 0); assert.equal(controller.replay(), false); f.intersection(true);
  for (const name of ['panel-open', 'ui-hidden', 'mobile-gameplay']) {
    controller.replay(); f.doc.body.classList.add(name); f.mutation(); assert.equal(f.frames.size, 0); assert.equal(controller.replay(), false); f.doc.body.classList.remove(name);
  }
  controller.replay(); f.hero.classList.add('hero-driving'); f.mutation(); assert.equal(f.frames.size, 0); assert.equal(controller.replay(), false);
  controller.dispose();
});

test('reduced motion keeps complete static tiles and responds immediately to preference changes', () => {
  const f = fixture({ reduced: true }), controller = createSplitFlapHeadline(f.host);
  assert.equal(f.frames.size, 0); assert.equal(tiles(f.host).length, 4); assert.equal(controller.replay(), false);
  f.media.matches = false; f.media.dispatchEvent(new Event('change')); f.tick(); f.tick(); assert.ok(tiles(f.host).every(tile => tile.classList.contains('is-flipping')));
  f.media.matches = true; f.media.dispatchEvent(new Event('change')); assert.ok(tiles(f.host).every(tile => !tile.classList.contains('is-flipping'))); assert.equal(f.frames.size, 0);
  controller.dispose();
});

test('split-flap source uses two hinged CSS halves with finite motion and no timer, canvas, or dependency', async () => {
  const js = await readFile(new URL('../src/split-flap-text.js', import.meta.url), 'utf8'), css = await readFile(new URL('../src/split-flap-text.css', import.meta.url), 'utf8');
  assert.doesNotMatch(js, /setInterval|setTimeout|createElement\(['"]canvas|^import /m);
  assert.match(css, /clip-path:inset\(0 0 50% 0\)/); assert.match(css, /clip-path:inset\(50% 0 0 0\)/);
  assert.match(css, /transform-origin:50% 50%/); assert.match(css, /rotateX\(-90deg\)/); assert.match(css, /prefers-reduced-motion:reduce/);
  assert.doesNotMatch(css, /infinite|will-change/);
});
