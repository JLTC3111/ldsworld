import { bindDemoSource, playDemo, releaseDemo } from './media.js';

/** Own silent card previews for one rendered panel-reader and its language. */
export function createPanelPreviews({
  container,
  mediaFor,
  isActive = () => true,
  document: page = globalThis.document,
  IntersectionObserver: Observer = globalThis.IntersectionObserver
} = {}) {
  const entries = new Map();
  let destroyed = false, observer = null;
  const active = () => {
    try { return !destroyed && !page?.hidden && isActive(); }
    catch { return false; }
  };
  const mayPlay = entry => active() && entry.visible;
  const pause = video => {
    try { video.autoplay = false; video.pause(); }
    catch { /* A missing media API must not interrupt panel cleanup. */ }
  };

  function synchronize(video, entry) {
    if (!mayPlay(entry)) {
      ++entry.generation; entry.pending = false; entry.playing = false;
      pause(video); return;
    }
    let media;
    try { media = mediaFor?.(video.dataset.previewProject); }
    catch { media = null; }
    if (typeof media?.video !== 'string' || !media.video.trim()) {
      ++entry.generation; entry.pending = false; entry.playing = false;
      pause(video); return;
    }
    if (entry.source === media.video && (entry.pending || (entry.playing && !video.paused))) return;
    const generation = ++entry.generation;
    entry.source = media.video; entry.pending = true; entry.playing = false;
    // Deferring autoplay gives visibility/close changes a chance to cancel before
    // playback, while bindDemoSource still owns native source selection/resetting.
    bindDemoSource(video, media, { autoplay: false }).then(async bound => {
      if (generation !== entry.generation || !mayPlay(entry)) {
        if (!mayPlay(entry)) pause(video);
        return;
      }
      if (!bound) { entry.pending = false; return; }
      const played = await playDemo(video);
      // A native play promise may settle after scrolling away or closing. Do not
      // let that completion restart an invisible or disposed card.
      if (!mayPlay(entry)) pause(video);
      if (generation !== entry.generation) return;
      entry.pending = false; entry.playing = played && mayPlay(entry);
    });
  }

  function refresh() {
    if (destroyed) return;
    entries.forEach((entry, video) => synchronize(video, entry));
  }

  for (const video of container?.querySelectorAll('video[data-preview-project]') || []) {
    video.muted = true; video.defaultMuted = true; video.controls = false;
    video.loop = true; video.playsInline = true; video.autoplay = false;
    pause(video);
    entries.set(video, { visible: typeof Observer !== 'function', generation: 0, pending: false, playing: false, source: null });
  }
  if (entries.size && typeof Observer === 'function') {
    try {
      observer = new Observer(changes => {
        if (destroyed) return;
        for (const change of changes) {
          const entry = entries.get(change.target);
          if (!entry) continue;
          entry.visible = change.isIntersecting && (change.intersectionRatio === undefined || change.intersectionRatio > 0);
          synchronize(change.target, entry);
        }
      }, { root: container, threshold: 0 });
      entries.forEach((entry, video) => observer.observe(video));
    } catch {
      observer?.disconnect(); observer = null;
      entries.forEach(entry => { entry.visible = true; });
    }
  }
  page?.addEventListener('visibilitychange', refresh);
  refresh();

  return {
    refresh,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      observer?.disconnect();
      page?.removeEventListener('visibilitychange', refresh);
      entries.forEach((entry, video) => {
        ++entry.generation; entry.pending = false; entry.playing = false;
        releaseDemo(video);
      });
    }
  };
}
