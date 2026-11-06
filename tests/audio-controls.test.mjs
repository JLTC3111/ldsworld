import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const app = await readFile(new URL('../src/app.js', import.meta.url), 'utf8');

// Exercise the application's real control handlers without booting its 3D world.
function declaration(name) {
  const match = new RegExp(`^(?:async )?function ${name}\\(`, 'm').exec(app);
  assert.ok(match, `The application exposes its ${name} handler`);
  const start = match.index, opening = app.indexOf('{', start);
  let depth = 0, quote = '', comment = '';
  for (let index = opening; index < app.length; index++) {
    const char = app[index], next = app[index + 1];
    if (comment === '//') { if (char === '\n') comment = ''; continue; }
    if (comment === '/*') { if (char === '*' && next === '/') { comment = ''; index++; } continue; }
    if (quote) {
      if (char === '\\') index++;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '/' && (next === '/' || next === '*')) { comment = char + next; index++; continue; }
    if (char === "'" || char === '"' || char === '`') { quote = char; continue; }
    if (char === '{') depth++;
    if (char === '}' && --depth === 0) return app.slice(start, index + 1);
  }
  assert.fail(`Unterminated ${name} handler`);
}

function fixture({ sound = true, music = true, playing = false, blocked = true, muted = !sound, engineResult = Promise.resolve(true) } = {}) {
  const state = { sound, music, musicPlaying: playing && !muted, environmentSoundPlaying: false };
  const saved = new Map(), syncs = [], calls = { engine: 0, ambience: 0, music: [] };
  let controls;
  const engineAudio = {
    enabled: sound, unlocked: false, context: null,
    setEnabled(value) { this.enabled = value; },
    resume() {
      calls.engine++;
      return engineResult.then(running => {
        this.unlocked = !!running;
        this.context = { state: running ? 'running' : 'suspended' };
        return running;
      });
    }
  };
  const environmentAudio = {
    enabled: sound,
    setEnabled(value) { if (this.enabled === value) return; this.enabled = value; if (value) this.start(); },
    start() { calls.ambience++; return Promise.resolve(false); }
  };
  const snapshot = { enabled: music, playing, blocked, muted };
  const emit = () => controls?.syncMusicButton({ ...snapshot });
  const backgroundMusic = {
    getState: () => ({ ...snapshot }),
    setMuted(value) { snapshot.muted = value; emit(); },
    setEnabled(value) {
      snapshot.enabled = value;
      snapshot.blocked = false;
      if (value) this.start(true);
      else { snapshot.playing = false; emit(); }
    },
    start(explicit) {
      calls.music.push(explicit);
      if (!snapshot.enabled) return Promise.resolve(false);
      snapshot.playing = true; snapshot.blocked = false; emit();
      return Promise.resolve(true);
    }
  };
  const source = ['soundActive', 'setSoundEnabled', 'toggleSound', 'toggleMusic', 'syncMusicButton', 'syncSoundButton'].map(declaration).join('\n');
  controls = runInNewContext(`${source}\n({soundActive,setSoundEnabled,toggleSound,toggleMusic,syncMusicButton});`, {
    state, engineAudio, environmentAudio, backgroundMusic,
    storage: { set: (key, value) => saved.set(key, value) },
    syncControls: () => syncs.push({ sound: state.sound, musicPlaying: state.musicPlaying }),
    showToast() {}, t: key => key
  });
  return { state, saved, syncs, calls, engineAudio, environmentAudio, backgroundMusic, controls };
}

test('the first speaker activation unlocks an enabled but silent soundscape instead of muting it', () => {
  const f = fixture();
  assert.equal(f.controls.soundActive(), false);
  f.controls.toggleSound();
  assert.equal(f.state.sound, true);
  assert.equal(f.saved.get('sound'), 'on');
  assert.equal(f.engineAudio.enabled, true);
  assert.equal(f.environmentAudio.enabled, true);
  assert.ok(f.calls.engine > 0);
  assert.ok(f.calls.ambience > 0, 'Already-enabled ambience gets another playback attempt');
  assert.ok(f.calls.music.includes(true), 'Blocked music retries with explicit user intent');
  assert.equal(f.backgroundMusic.getState().muted, false);
});

test('unmuting retries blocked music and ambience, while an explicit music pause remains paused', () => {
  for (const music of [true, false]) {
    const f = fixture({ sound: false, music });
    f.controls.toggleSound();
    assert.equal(f.state.sound, true);
    assert.equal(f.state.music, music);
    assert.equal(f.backgroundMusic.getState().enabled, music);
    assert.ok(f.calls.ambience > 0);
    if (music) {
      assert.ok(f.calls.music.includes(true));
      assert.equal(f.backgroundMusic.getState().playing, true);
    } else {
      assert.equal(f.calls.music.length, 0, 'Speaker activation respects the music-off preference');
      assert.equal(f.backgroundMusic.getState().playing, false);
    }
  }
});

test('Play unmutes the speaker and starts music when a saved master mute would otherwise hide playback', () => {
  const f = fixture({ sound: false, music: true, playing: true, blocked: false });
  f.controls.toggleMusic();
  assert.equal(f.state.sound, true);
  assert.equal(f.state.music, true);
  assert.equal(f.saved.get('sound'), 'on');
  assert.equal(f.saved.get('music'), 'on');
  assert.equal(f.backgroundMusic.getState().muted, false);
  assert.equal(f.backgroundMusic.getState().playing, true);
  assert.equal(f.state.musicPlaying, true);
});

test('pausing audible music persists the pause through later speaker off/on controls', () => {
  const f = fixture({ playing: true, blocked: false });
  f.controls.toggleMusic();
  assert.equal(f.state.music, false);
  assert.equal(f.saved.get('music'), 'off');
  assert.equal(f.backgroundMusic.getState().playing, false);
  f.state.environmentSoundPlaying = true;
  f.controls.toggleSound();
  assert.equal(f.state.sound, false);
  f.controls.toggleSound();
  assert.equal(f.state.sound, true);
  assert.equal(f.backgroundMusic.getState().enabled, false);
  assert.equal(f.calls.music.length, 0);
});

test('a pending engine unlock cannot delay speaker feedback, ambience, or music playback', () => {
  const f = fixture({ sound: false, engineResult: new Promise(() => {}) });
  f.controls.toggleSound();
  assert.equal(f.state.sound, true);
  assert.ok(f.syncs.some(snapshot => snapshot.sound), 'The speaker UI updates during the original gesture');
  assert.ok(f.calls.ambience > 0, 'Ambience does not wait for the Web Audio context');
  assert.ok(f.calls.music.includes(true), 'Music does not wait for the Web Audio context');
});

test('the music indicator follows successful audible playback rather than an enabled preference', () => {
  const f = fixture();
  for (const info of [
    { enabled: true, playing: false, blocked: false, muted: false },
    { enabled: true, playing: true, blocked: false, muted: true },
    { enabled: false, playing: true, blocked: false, muted: false }
  ]) {
    f.controls.syncMusicButton(info);
    assert.equal(f.state.musicPlaying, false);
  }
  f.controls.syncMusicButton({ enabled: true, playing: true, blocked: false, muted: false });
  assert.equal(f.state.musicPlaying, true);
});
