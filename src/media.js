const bindings = new WeakMap();

function bindingFor(video) {
  if (!bindings.has(video)) bindings.set(video, { source: null, generation: 0, released: false });
  return bindings.get(video);
}

function configureDemo(video, autoplay = true) {
  video.muted = true;
  video.defaultMuted = true;
  video.autoplay = autoplay;
  video.loop = true;
  video.playsInline = true;
}

function sourceKey(video, source) {
  try { return new URL(source, video.baseURI || video.ownerDocument?.baseURI || globalThis.location?.href || 'http://localhost/').href; }
  catch { return source; }
}

export function playDemo(video) {
  if (!video) return Promise.resolve(false);
  const binding = bindingFor(video), generation = binding.generation;
  if (binding.released) return Promise.resolve(false);
  try {
    return Promise.resolve(video.play()).then(
      () => !binding.released && binding.generation === generation,
      () => false
    );
  } catch { return Promise.resolve(false); }
}

export function autoplayMutedDemo(video) {
  if (!video || bindings.get(video)?.released) return Promise.resolve(false);
  configureDemo(video);
  return playDemo(video);
}

/** Bind the selected recording before playback, resetting native resource selection. */
export function bindDemoSource(video, media, { autoplay = true } = {}) {
  if (!video || typeof media?.video !== 'string' || !media.video.trim()) return Promise.resolve(false);
  const source = media.video.trim(), key = sourceKey(video, source), binding = bindingFor(video);
  const assigned = video.getAttribute?.('src') ?? video.src;
  const unchanged = !binding.released && binding.source === key && !!assigned && sourceKey(video, assigned) === key;
  try {
    configureDemo(video, autoplay);
    if (typeof media.poster === 'string') video.poster = media.poster;
    else video.removeAttribute?.('poster');
    if (!unchanged) {
      ++binding.generation; binding.released = false; binding.source = null;
      video.pause();
      video.src = source;
      video.load();
      binding.source = key;
    }
  } catch { return Promise.resolve(false); }
  return autoplay ? playDemo(video) : Promise.resolve(true);
}

/** Stop decoder/network work before a panel is removed or its recording replaced. */
export function releaseDemo(video) {
  if (!video) return;
  const binding = bindingFor(video);
  if (binding.released) return;
  ++binding.generation; binding.source = null; binding.released = true;
  try { video.autoplay = false; video.pause(); } catch { /* Continue clearing resources. */ }
  try {
    video.removeAttribute('src');
    video.querySelectorAll('source').forEach(source => source.removeAttribute('src'));
    video.load();
  } catch { /* Unsupported media APIs must not interrupt closing the panel. */ }
}
