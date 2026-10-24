const definitions = {
  wind: { loop: true, retry: 32 }, water: { loop: true, retry: 32 },
  rooster: { loop: false, interval: 32, gain: .065, phase: hour => hour >= 5.5 && hour < 9.5 },
  birds: { loop: true, interval: 16, gain: .085, phase: hour => hour >= 17 && hour < 19 }
};
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

/** Native recordings share the speaker preference, independent of panel state. */
export function createEnvironmentAudio({
  enabled = true, sources = {}, audioFactory = source => new Audio(source),
  eventTarget = globalThis.window, documentTarget = globalThis.document,
  now = () => (globalThis.performance?.now?.() ?? Date.now()) / 1000,
  scheduler = globalThis, onStateChange
} = {}) {
  let disposed = false, started = false, timer = null, lastTick = now(), lastSnapshot = '';
  const environment = { hour: 8.5, weather: 'clear', riverDistance: 12 };
  const tracks = Object.fromEntries(Object.entries(definitions).map(([id, definition]) => {
    const track = { id, ...definition, audio: null, playing: false, pending: false, blocked: false, generation: 0, nextCallAt: -Infinity, retryAt: -Infinity, volume: 0, listeners: {} };
    try {
      track.audio = audioFactory(sources[id] || new URL(`./assets/audio/ambience/${id}.mp3`, import.meta.url).href);
      track.audio.loop = definition.loop; track.audio.preload = 'none'; track.audio.muted = false; track.audio.volume = 0;
    } catch { /* Missing audio support leaves the portfolio usable. */ }
    return [id, track];
  }));
  const wanted = () => !disposed && started && enabled && !documentTarget?.hidden && Object.values(tracks).some(track => track.audio);
  const inPhase = track => !track.phase || track.phase(environment.hour);
  const getState = () => ({
    enabled, playing: Object.values(tracks).some(track => track.playing), blocked: Object.values(tracks).some(track => track.blocked),
    active: Object.values(tracks).filter(track => track.playing).map(track => track.id),
    volumes: Object.fromEntries(Object.entries(tracks).map(([id, track]) => [id, track.volume])), ...environment
  });
  function emit() {
    const state = getState(), snapshot = JSON.stringify(state);
    if (snapshot !== lastSnapshot) { lastSnapshot = snapshot; try { onStateChange?.(state); } catch {} }
  }
  // Gains account for the quieter field recordings: audible under the music,
  // with the stream coming forward only near its banks.
  function gain(track) {
    if (track.id === 'wind') return { clear: .10, rain: .16, snow: .12 }[environment.weather] || .10;
    if (track.id === 'water') return .035 + .225 * Math.exp(-environment.riverDistance / 6);
    return track.gain;
  }
  function volume(track, value, force = false) {
    value = clamp(value, 0, 1);
    if (!force && Math.abs(track.volume - value) < .002) return;
    track.volume = value; try { if (track.audio) track.audio.volume = value; } catch {}
  }
  function stop(track, rewind = !!track.interval) {
    ++track.generation; track.pending = track.playing = false;
    volume(track, 0, true);
    try { track.audio?.pause(); if (rewind && track.audio) track.audio.currentTime = 0; } catch {}
  }
  function stopAll() {
    if (timer !== null) scheduler.clearTimeout(timer); timer = null;
    Object.values(tracks).forEach(track => stop(track)); emit();
  }
  function commit(track, generation) {
    if (generation !== track.generation || !wanted() || !inPhase(track)) return false;
    if (!track.playing && track.interval) track.nextCallAt = now() + track.interval;
    track.playing = true; track.pending = false; track.blocked = false; track.retryAt = -Infinity; emit(); return true;
  }
  function attempt(track, { retryBlocked = false } = {}) {
    if (!track.audio || !wanted() || !inPhase(track) || track.playing || track.pending) return null;
    if (track.blocked && !retryBlocked) return null;
    if (track.interval && now() < track.nextCallAt) return null;
    if (!(retryBlocked && track.blocked) && now() < track.retryAt) return null;
    const audio = track.audio, generation = ++track.generation;
    track.pending = true; track.retryAt = now() + 1;
    // Start at the real, quiet audible gain; volume zero must not bypass policy.
    volume(track, gain(track), true);
    try {
      return Promise.resolve(audio.play()).then(() => {
        if (commit(track, generation)) return true;
        if (!wanted() || !inPhase(track)) { try { audio.pause(); } catch {} }
        return false;
      }, error => rejected(track, generation, error));
    } catch (error) { return Promise.resolve(rejected(track, generation, error)); }
  }
  function rejected(track, generation, error) {
    if (disposed || generation !== track.generation) return false;
    track.pending = track.playing = false;
    track.blocked = error?.name === 'NotAllowedError' || /NotAllowed|autoplay/iu.test(error?.message || '');
    track.retryAt = track.blocked ? -Infinity : now() + (track.interval || track.retry);
    volume(track, 0, true); emit(); return false;
  }
  function run(options) { return Object.values(tracks).map(track => attempt(track, options)).filter(Boolean); }
  function tick() {
    timer = null; if (!wanted()) return;
    const current = now(), dt = clamp(current - lastTick, 0, 1); lastTick = current;
    for (const track of Object.values(tracks)) {
      if (!inPhase(track)) { if (track.playing || track.pending) stop(track); continue; }
      if (track.loop && (track.playing || track.pending)) volume(track, track.volume + (gain(track) - track.volume) * (1 - Math.exp(-dt * 2.5)));
    }
    run(); emit(); schedule();
  }
  function schedule() { if (timer === null && wanted()) timer = scheduler.setTimeout(tick, 200); }
  function start() {
    if (disposed) return Promise.resolve(false);
    started = true; if (!wanted()) return Promise.resolve(false);
    lastTick = now(); const attempts = run({ retryBlocked: true }); schedule();
    return Promise.all(attempts).then(results => !disposed && (results.some(Boolean) || Object.values(tracks).some(track => track.playing)));
  }
  function gesture(event) {
    if (event.isTrusted !== true || event.ctrlKey || event.metaKey || event.altKey || event.repeat || !wanted()) return;
    // Invoke play synchronously while the native user activation is still live.
    run({ retryBlocked: true }); schedule();
  }
  function visibility() { if (documentTarget?.hidden) stopAll(); else if (enabled && started) start(); }
  for (const track of Object.values(tracks)) {
    track.listeners = {
      playing: () => { if (track.pending && !track.audio?.paused) commit(track, track.generation); },
      ended: () => { track.playing = false; track.pending = false; emit(); },
      error: () => { if (disposed) return; track.playing = track.pending = track.blocked = false; track.retryAt = now() + (track.interval || track.retry); volume(track, 0, true); emit(); }
    };
    for (const [event, listener] of Object.entries(track.listeners)) track.audio?.addEventListener?.(event, listener);
  }
  eventTarget?.addEventListener('pointerdown', gesture); eventTarget?.addEventListener('keydown', gesture);
  documentTarget?.addEventListener('visibilitychange', visibility); emit();
  return {
    start, resume: start, getState,
    setEnabled(value) { if (disposed || enabled === !!value) return; enabled = !!value; if (enabled) start(); else stopAll(); emit(); },
    update(value = {}) {
      if (disposed) return;
      if (Number.isFinite(value.hour)) environment.hour = ((value.hour % 24) + 24) % 24;
      if (['clear', 'rain', 'snow'].includes(value.weather)) environment.weather = value.weather;
      if (Number.isFinite(value.riverDistance)) environment.riverDistance = Math.max(0, value.riverDistance);
      for (const track of Object.values(tracks)) if (!inPhase(track) && (track.playing || track.pending || track.blocked)) { stop(track); track.blocked = false; }
      if (wanted()) { run(); schedule(); }
    },
    dispose() {
      if (disposed) return; disposed = true; stopAll();
      eventTarget?.removeEventListener('pointerdown', gesture); eventTarget?.removeEventListener('keydown', gesture);
      documentTarget?.removeEventListener('visibilitychange', visibility);
      for (const track of Object.values(tracks)) {
        for (const [event, listener] of Object.entries(track.listeners)) track.audio?.removeEventListener?.(event, listener);
        try { track.audio?.removeAttribute('src'); track.audio?.load(); } catch {}
      }
    }
  };
}
