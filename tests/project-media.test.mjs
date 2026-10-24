import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { projects } from '../src/data.js';
import { getProjectMedia, projectMedia } from '../src/project-media.js';
import { getCaseStudy } from '../src/case-studies.js';

// SHA-256 values audited directly from public/<filename> referenced by the two
// original full-stack-course/1.web-portfolio-{en,vn}/index.html files. Keeping the
// evidence here makes this test portable without requiring that source checkout.
const originals = {
  hr: {
    en: ['hr_demo.mp4', '375948455c4dac9f3392d6114db6851c2bb100a1c6d44dd3f1d1c79ec0bab7df'],
    vi: ['hr_demo.mp4', '375948455c4dac9f3392d6114db6851c2bb100a1c6d44dd3f1d1c79ec0bab7df']
  },
  crypto: {
    en: ['cryptodashboard_demo.mp4', 'db115790f79b445c3148cc7b41fc16f1ac71c6825a45763adb520fa156136016'],
    vi: ['cryptodashboard_demo.mp4', 'db115790f79b445c3148cc7b41fc16f1ac71c6825a45763adb520fa156136016']
  },
  contracts: {
    en: ['demo_contract.mp4', '5af808ccc7fec1300aac1d131cc770e04feebc3e95a314006a642551a42e0e03'],
    vi: ['demo_contract.mp4', 'a24cba52dfe11e8f9485ea9d7c230948ea5e18db90c32a9615eda510463b5c9c']
  },
  compressor: {
    en: ['file_compressor.mp4', '2b1db4a669c47217bc08c88bffeb1f95f5625decfbe750416f3be5a6211842a4'],
    vi: ['file_compressor.mp4', '981bc04cef9ebb31f440e69aa588e05bc2faa7818a40ae5277a3afd846dd96a6']
  },
  ceremony: {
    en: ['gizikiicue.mp4', 'bbbe39c535ad0931aa6b83f873b31559995fabd27bbd6e7974e0d760d7187282'],
    vi: ['gizikiicue.mp4', '2995c6ae7180aafd18aad9f15400ff83775f6685c3694fccf7c3f7a0562463f9']
  },
  icue: {
    en: ['icue-en.mp4', '0490dd9c1682580abb478034ef0d5a7b3e5af354c13b1da46995d79fcd49fb96'],
    vi: ['icue-vn.mp4', '2b1a8628c6d0c9408514a7612a4160a1daafc9fe3a8cde155a9a00560fe09f58']
  }
};
const asset = src => new URL(`../src/${src.slice(2)}`, import.meta.url);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');

test('copied recordings exactly match their original EN and VN source files', async () => {
  assert.deepEqual(Object.keys(projectMedia).sort(), projects.map(project => project.id).sort());
  for (const project of projects) for (const language of ['en', 'vi']) {
    const media = getProjectMedia(project.id, language);
    assert.match(media.video, /^\.\/assets\/demos\/((en|vi)\/)?[\w-]+\.mp4$/);
    assert.match(media.poster, /^\.\/assets\/posters\/((en|vi)\/)?[\w-]+\.jpg$/);
    assert.equal(hash(await readFile(asset(media.video))), originals[project.id][language][1], `${project.id}/${language}: copied source must match the audited original ${originals[project.id][language][0]}`);
    const poster = await readFile(asset(media.poster));
    assert.equal(poster.readUInt16BE(0), 0xffd8, 'Every selected poster must be an actual JPEG');
  }
});

test('only distinct recordings use localized copies and matching real-frame posters', async () => {
  for (const project of projects) {
    const en = getProjectMedia(project.id), vi = getProjectMedia(project.id, 'vi');
    const shared = ['hr', 'crypto'].includes(project.id);
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
    hr: ['vi', 'vi'], crypto: ['en', 'en'], contracts: ['vi', 'vi'],
    compressor: ['vi', 'vi'], ceremony: ['en', 'vi'], icue: ['en', 'vi']
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

test('retired project recordings and images are absent from the shipped assets', async () => {
  assert.equal(getProjectMedia('todo'), null);
  const paths = await readdir(new URL('../src/assets/', import.meta.url), { recursive: true });
  assert.deepEqual(paths.filter(path => /todo/i.test(path.split('/').at(-1))), []);
});
