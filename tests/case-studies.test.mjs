import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { projects } from '../src/data.js';
import { caseStudies, getCaseStudy } from '../src/case-studies.js';
import { getProjectMedia } from '../src/project-media.js';

function jpegSize(bytes) {
  assert.equal(bytes.readUInt16BE(0), 0xffd8, 'Gallery assets must be genuine JPEG files');
  let offset = 2;
  while (offset < bytes.length) {
    while (bytes[offset] === 0xff) offset++;
    const marker = bytes[offset++];
    if (marker === 0xda || marker === 0xd9) break;
    const length = bytes.readUInt16BE(offset);
    if ([0xc0, 0xc1, 0xc2].includes(marker)) return { height: bytes.readUInt16BE(offset + 3), width: bytes.readUInt16BE(offset + 5) };
    offset += length;
  }
  throw new Error('No image dimensions in gallery JPEG');
}

test('all six retained projects have concise case studies in English and Vietnamese', () => {
  assert.equal(projects.length, 6);
  assert.deepEqual(Object.keys(caseStudies).sort(), projects.map(project => project.id).sort());
  for (const project of projects) for (const language of ['en', 'vi']) {
    const study = getCaseStudy(project.id, language);
    for (const key of ['teaser', 'focus', 'approach']) {
      assert.equal(typeof study[key], 'string');
      assert.ok(study[key].length >= 20 && study[key].length <= 320, `${project.id}/${language}/${key} should stay useful and concise`);
    }
    assert.equal(study.useCases.length, 3);
    assert.equal(new Set(study.useCases.map(item => item.title)).size, 3);
    for (const item of study.useCases) { assert.ok(item.title.trim()); assert.ok(item.text.length > 25); }
    assert.deepEqual(Object.keys(study).sort(), ['teaser', 'focus', 'approach', 'useCases', 'gallery'].sort());
  }
});

test('gallery stills exist at their declared dimensions and remain compact', async () => {
  const unique = new Set(); let total = 0;
  for (const project of projects) {
    const english = getCaseStudy(project.id), vietnamese = getCaseStudy(project.id, 'vi');
    assert.equal(english.gallery.length, 2); assert.equal(vietnamese.gallery.length, 2);
    const shared = getProjectMedia(project.id, 'vi').language === 'shared';
    for (const [index, image] of english.gallery.entries()) {
      assert.notEqual(image.alt, vietnamese.gallery[index].alt);
      assert.equal(image.src === vietnamese.gallery[index].src, shared, 'A distinct localized recording needs matching localized gallery frames');
    }
    for (const [language, story] of [['en', english], ['vi', vietnamese]]) for (const image of story.gallery) {
      assert.match(image.src, /^\.\/assets\/gallery\/images\/(en|vi)\/[\w-]+\.jpg$/);
      assert.ok(image.alt.length > 25 && image.caption.length > 8);
      assert.ok(image.time >= 0 && Number.isFinite(image.time));
      assert.ok(image.time < getProjectMedia(project.id, language).duration, 'Gallery seek time must be inside the selected recording, for that project');
      const path = new URL(`../src/${image.src.slice(2)}`, import.meta.url);
      const bytes = await readFile(path), dimensions = jpegSize(bytes);
      assert.equal(dimensions.width, image.width); assert.equal(dimensions.height, image.height);
      assert.ok(image.width <= 900);
      if (!unique.has(image.src)) { total += (await stat(path)).size; unique.add(image.src); }
    }
  }
  assert.equal(unique.size, 22); assert.ok(total < 2_000_000, 'Localized stills should not turn the portfolio into a heavy gallery');
});

test('localized gallery timestamps match inspected moments in the corresponding recording', () => {
  const expected = {
    hr:[15,21.6],contracts: [2,9.22], compressor: [9.03, 27.09],
    ceremony: [1.79, 5.38], icue: [3,7.28]
  };
  for (const [id, times] of Object.entries(expected)) {
    assert.deepEqual(getCaseStudy(id, 'vi').gallery.map(image => image.time), times);
    for (const image of getCaseStudy(id, 'vi').gallery) assert.ok(image.src.includes('/vi/'));
  }
});

test('unknown project IDs are safe and unsupported languages use English', () => {
  assert.equal(getCaseStudy('not-a-project'), null);
  assert.equal(getCaseStudy('todo', 'en'), null, 'Retired project content must not remain available');
  assert.equal(getCaseStudy('todo', 'vi'), null);
  assert.equal(getCaseStudy('__proto__'), null);
  assert.equal(getCaseStudy('toString'), null);
  assert.equal(getCaseStudy('hr', 'fr'), getCaseStudy('hr', 'en'));
});
