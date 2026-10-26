import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { projects } from '../src/data.js';
import { getProjectMedia, projectMedia } from '../src/project-media.js';
import { getCaseStudy } from '../src/case-studies.js';

// SHA-256 values from the owner-supplied gallery/videos update on 2026-10-26.
// Crypto remains the explicitly English-only recording shared by both languages.
const supplied = {
  hr: {
    en: ['hr_en.mp4', 'ecf14582f599f1b7c148bacb10e0783b79546185ea58154f94161aa131a4b34e'],
    vi: ['hr_vn.mp4', '693930a77311dd02d30706a59e3e5a8e16c77ca4e91223b3fba59de8aaecb219']
  },
  crypto: {
    en: ['cryptodashboard_demo.mp4', 'db115790f79b445c3148cc7b41fc16f1ac71c6825a45763adb520fa156136016'],
    vi: ['cryptodashboard_demo.mp4', 'db115790f79b445c3148cc7b41fc16f1ac71c6825a45763adb520fa156136016']
  },
  contracts: {
    en: ['contract_en.mp4', '66154aa8ce95f6ac13cc72e8595c88c0c8c83beef4f1bc0a056b8b5a846d8a66'],
    vi: ['contract_vi.mp4', 'a319d4ca4aabcceb2de6ae25437b79e3dacb7881fbdb5b3a700a82ea0eee344d']
  },
  compressor: {
    en: ['file_compressor_en.mp4', 'd80d1a8b091805711f0c99f8923554837f22afcc6df74ee36250179ae0e132bb'],
    vi: ['file_compressor_vn.mp4', '981bc04cef9ebb31f440e69aa588e05bc2faa7818a40ae5277a3afd846dd96a6']
  },
  ceremony: {
    en: ['gizikiicue_en.mp4', 'bbbe39c535ad0931aa6b83f873b31559995fabd27bbd6e7974e0d760d7187282'],
    vi: ['gizikiicue_vn.mp4', '2995c6ae7180aafd18aad9f15400ff83775f6685c3694fccf7c3f7a0562463f9']
  },
  icue: {
    en: ['icue-en.mp4', '7a53443974eda684d44fc37e2a9c4ae136071d98cdb94c1481fe25940d536fd6'],
    vi: ['icue-vn.mp4', '27fd6833d21a4492ed4dc893b5c76875b0bcfc5c767d9282071b25671792db7f']
  }
};
const asset = src => new URL(`../src/${src.slice(2)}`, import.meta.url);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

test('recordings exactly match the owner-supplied EN and VI gallery files', async () => {
  assert.deepEqual(Object.keys(projectMedia).sort(), projects.map(project => project.id).sort());
  for (const project of projects) for (const language of ['en', 'vi']) {
    const media = getProjectMedia(project.id, language);
    assert.match(media.video, /^\.\/assets\/gallery\/videos\/((en|vi)\/)?[\w-]+\.mp4$/);
    assert.match(media.poster, /^\.\/assets\/gallery\/images\/(en|vi)\/[\w-]+\.jpg$/);
    assert.equal(hash(await readFile(asset(media.video))), supplied[project.id][language][1], `${project.id}/${language}: selected source must match the supplied recording ${supplied[project.id][language][0]}`);
    const poster = await readFile(asset(media.poster));
    assert.equal(poster.readUInt16BE(0), 0xffd8, 'Every selected poster must be an actual JPEG');
  }
});

test('only distinct recordings use localized copies and matching real-frame posters', async () => {
  for (const project of projects) {
    const en = getProjectMedia(project.id), vi = getProjectMedia(project.id, 'vi');
    const shared = project.id==='crypto';
    assert.equal(en.video === vi.video, shared, 'Identical originals should reuse one recording');
    assert.equal(en.poster === vi.poster, shared, 'Shared recordings should reuse one poster');
    if (shared) {
      assert.equal(en.language, 'shared'); assert.equal(vi.language, 'shared');
    } else {
      assert.equal(en.language, 'en'); assert.equal(vi.language, 'vi');
      assert.ok(vi.video.includes('/vi/')); assert.ok(vi.poster.includes('/vi/'));
      assert.equal(hash(await readFile(asset(vi.poster))), hash(await readFile(asset(getCaseStudy(project.id, 'vi').gallery[0].src))), 'The Vietnamese poster must be the inspected frame from the matching recording');
    }
  }
});

test('recording language describes visible UI rather than source folder labels', () => {
  const actual = {
    hr: ['en', 'vi'], crypto: ['en', 'en'], contracts: ['en', 'vi'],
    compressor: ['en', 'vi'], ceremony: ['en', 'vi'], icue: ['en', 'vi']
  };
  for (const [id, languages] of Object.entries(actual)) {
    assert.deepEqual(['en', 'vi'].map(language => getProjectMedia(id, language).recordingLanguage), languages);
    for (const language of ['en', 'vi']) assert.ok(getProjectMedia(id, language).duration > 0);
  }
});

test('unsupported languages fall back to English and invalid IDs are safe', () => {
  assert.equal(getProjectMedia('icue', 'fr'), getProjectMedia('icue', 'en'));
  assert.equal(getProjectMedia('icue'), getProjectMedia('icue', 'en'));
  for (const id of ['todo', 'not-a-project', '__proto__', 'toString']) assert.equal(getProjectMedia(id, 'vi'), null);
});

test('retired projects cannot select a recording through the active media catalog', async () => {
  assert.equal(getProjectMedia('todo'), null);
  for(const languages of Object.values(projectMedia))for(const media of Object.values(languages))assert.doesNotMatch(media.video,/to-?do/i);
});
