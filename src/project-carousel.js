import { bindDemoSource, playDemo, releaseDemo } from './media.js';
import { createCarouselClock } from './carousel-clock.js';

// Embla's loop-aware tween pattern, applied to video layers instead of images.
export function carouselParallax(api, nodes, reduced = false) {
  const engine = api.internalEngine(), progress = api.scrollProgress();
  const visible = api.slidesInView();
  api.scrollSnapList().forEach((snap, snapIndex) => {
    for (const index of engine.slideRegistry[snapIndex] || []) {
      if (!nodes[index] || !visible.includes(index)) continue;
      let difference = snap - progress;
      if (engine.options.loop) for (const point of engine.slideLooper.loopPoints) {
        if (index !== point.index || point.target() === 0) continue;
        difference = snap + (point.target() < 0 ? -1 : 1) - progress;
      }
      const shift = reduced ? 0 : Math.max(-16, Math.min(16, difference * api.scrollSnapList().length * -18));
      nodes[index].style.transform = `translate3d(${shift.toFixed(3)}%,0,0)`;
    }
  });
}

export function createProjectCarousel({
  root, EmblaCarousel, Autoplay, mediaFor, labels, initialId, onSelect = () => {},
  isActive = () => true, document: page = root?.ownerDocument,
  IntersectionObserver: Observer = globalThis.IntersectionObserver,
  motionQuery = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)'),
  duration = 7000, now = Date.now, setTimeout: schedule = globalThis.setTimeout,
  clearTimeout: cancel = globalThis.clearTimeout
}) {
  const viewport = root?.querySelector('[data-carousel-viewport]');
  const entries = [...(root?.querySelectorAll('[data-carousel-project]') || [])].map(slide => ({
    slide, id: slide.dataset.carouselProject, video: slide.querySelector('[data-carousel-video]'),
    button: slide.querySelector('[data-carousel-play]'), layer: slide.querySelector('[data-carousel-parallax]'),
    generation: 0, mode: 'idle'
  }));
  if (!viewport || !entries.length) return { destroy() {}, select: () => false, getState: () => ({ watching: false }) };
  const autoplay = Autoplay({ delay: duration, playOnInit: false, stopOnInteraction: true, stopOnFocusIn: false });
  let disposed = false, visible = true, current = -1, observer, reduced = !!motionQuery?.matches;
  const listeners = [], parallaxNodes = entries.map(entry => entry.layer);
  const active = () => !disposed && !page.hidden && visible && isActive();
  const listen = (element, event, callback, options) => {
    element.addEventListener(event, callback, options);
    listeners.push(() => element.removeEventListener(event, callback, options));
  };
  const api = EmblaCarousel(viewport, {
    loop: true, align: 'center', duration: reduced ? 0 : 32,
    startIndex: Math.max(0, entries.findIndex(entry => entry.id === initialId)),
    watchDrag: (_, event) => !event.target.closest('button,a,input,select,textarea') && entries[current]?.mode !== 'watch',
    watchFocus: false
  }, [autoplay]);
  const progress = root.querySelector('[data-carousel-progress]'), toggle = root.querySelector('[data-carousel-autoplay]');
  const status = root.querySelector('[data-carousel-status]');
  function paintClock(state) {
    const fraction = 1 - state.remaining / state.duration;
    progress.style.transition = 'none';
    progress.style.transform = `scaleX(${fraction})`;
    if (state.running) {
      // One layout read per timer change; no extra animation loop for the meter.
      progress.getBoundingClientRect();
      progress.style.transition = `transform ${state.remaining}ms linear`;
      progress.style.transform = 'scaleX(1)';
    }
    root.dataset.autoplay = state.running ? 'playing' : 'paused';
    toggle.setAttribute('aria-label', state.running ? labels.pause : labels.resume);
    toggle.setAttribute('aria-pressed', String(!state.running));
    toggle.innerHTML = `<svg class="icon" aria-hidden="true"><use href="#i-${state.running ? 'pause' : 'play'}"/></svg>`;
    const text = entries[current]?.mode === 'watch' ? labels.watching : state.running ? labels.automatic : labels.paused;
    if (status.textContent !== text) status.textContent = text;
  }
  const clock = createCarouselClock({ autoplay, duration, now, setTimeout: schedule, clearTimeout: cancel,
    advance: () => api.canScrollNext() ? api.scrollNext(reduced) : api.scrollTo(0, reduced), onChange: paintClock });
  clock.hold('initializing');
  clock.hold('layout', api.scrollSnapList().length < 2);
  clock.hold('hidden', !!page.hidden);
  clock.hold('inactive', !isActive());
  clock.hold('reduced', reduced);

  function paintVideo(entry) {
    const playing = !entry.video.paused && !entry.video.ended;
    const watching = entry.mode === 'watch';
    entry.slide.classList.toggle('is-watching', watching);
    entry.slide.classList.toggle('video-playing', watching && playing);
    entry.button.setAttribute('aria-label', watching ? (playing ? labels.videoPause : labels.videoPlay) : labels.watch);
    entry.button.setAttribute('aria-pressed', String(watching && playing));
    entry.button.innerHTML = `<svg class="icon" aria-hidden="true"><use href="#i-${watching && playing ? 'pause' : 'play'}"/></svg>`;
  }
  function pausePreview() {
    const entry = entries[current];
    if (!entry) return;
    ++entry.generation;
    entry.video.pause(); paintVideo(entry);
  }
  async function preview(entry) {
    if (!active() || reduced || clock.getState().holds.includes('user') || entry.mode !== 'preview') return;
    const generation = ++entry.generation;
    const bound = await bindDemoSource(entry.video, mediaFor(entry.id), { autoplay: false });
    if (!bound || generation !== entry.generation || entries[current] !== entry || !active()) return;
    entry.video.loop = false; entry.video.controls = false;
    await playDemo(entry.video);
    if (disposed || entries[current] !== entry || !active() ||
      entry.mode === 'preview' && (reduced || clock.getState().holds.includes('user'))) entry.video.pause();
    if (generation === entry.generation) paintVideo(entry);
  }
  async function watch(entry = entries[current], seconds) {
    if (!entry || entries[current] !== entry || !active()) return;
    const restart = entry.mode !== 'watch' || entry.video.ended;
    entry.mode = 'watch';
    clock.hold('video'); clock.hold('focus', false);
    const generation = ++entry.generation;
    const bound = entry.video.getAttribute('src') ? true : await bindDemoSource(entry.video, mediaFor(entry.id), { autoplay: false });
    if (generation !== entry.generation || entries[current] !== entry || !active()) return;
    if (!bound) { entry.mode = 'idle'; clock.hold('video', false); paintVideo(entry); return; }
    entry.video.loop = false; entry.video.controls = true;
    if (restart || Number.isFinite(seconds)) {
      try { entry.video.currentTime = Number.isFinite(seconds) ? seconds : 0; } catch { /* Metadata may not be ready yet. */ }
    }
    const played = await playDemo(entry.video);
    if (disposed || entries[current] !== entry || !active()) entry.video.pause();
    if (generation !== entry.generation) return;
    if (!played) { entry.mode = 'idle'; clock.hold('video', false); }
    paintVideo(entry);
  }
  function selection() {
    if (disposed) return;
    const next = api.selectedScrollSnap();
    if (next === current) return;
    clock.hold('selection');
    const previous = entries[current];
    if (previous) { ++previous.generation; previous.mode = 'idle'; releaseDemo(previous.video); paintVideo(previous); }
    current = next;
    const entry = entries[current];
    entry.mode = 'preview'; entry.video.controls = false;
    entries.forEach((item, index) => {
      item.slide.setAttribute('aria-hidden', String(index !== current));
      item.slide.toggleAttribute('inert', index !== current);
      root.querySelector(`[data-carousel-index="${index}"]`)?.setAttribute('aria-current', String(index === current));
    });
    root.querySelector('[data-carousel-count]').textContent = `${String(current + 1).padStart(2, '0')} / ${String(entries.length).padStart(2, '0')}`;
    clock.hold('video', false); clock.restart(); clock.hold('selection', false);
    paintVideo(entry); carouselParallax(api, parallaxNodes, reduced);
    onSelect(entry.id); void preview(entry);
  }
  for (const entry of entries) {
    listen(entry.button, 'click', event => {
      event.stopPropagation();
      if (entry.mode === 'watch' && !entry.video.paused) { ++entry.generation; entry.video.pause(); paintVideo(entry); }
      else void watch(entry);
    });
    listen(entry.video, 'click', () => { if (entry.mode !== 'watch') void watch(entry); });
    listen(entry.video, 'play', () => {
      if (!active() || entries[current] !== entry) entry.video.pause();
      else if (entry.mode !== 'preview' && entry.mode !== 'watch') {
        entry.mode = 'watch'; clock.hold('video'); clock.hold('focus', false);
      }
      paintVideo(entry);
    });
    listen(entry.video, 'pause', () => paintVideo(entry));
    listen(entry.video, 'ended', () => {
      if (disposed || entries[current] !== entry) return;
      if (entry.mode === 'watch') { entry.mode = 'ended'; clock.hold('video', false); }
      paintVideo(entry);
    });
    listen(entry.video, 'error', () => {
      if (entries[current] === entry && entry.mode === 'watch') { entry.mode = 'idle'; clock.hold('video', false); }
      paintVideo(entry);
    });
  }
  const nextSlide = direction => {
    if (direction < 0) api.scrollPrev(reduced); else api.scrollNext(reduced);
    if (entries.length === 1) clock.restart();
  };
  listen(root.querySelector('[data-carousel-prev]'), 'click', () => nextSlide(-1));
  listen(root.querySelector('[data-carousel-next]'), 'click', () => nextSlide(1));
  root.querySelectorAll('[data-carousel-index]').forEach(button => listen(button, 'click', () => api.scrollTo(Number(button.dataset.carouselIndex), reduced)));
  listen(toggle, 'click', () => {
    const state = clock.getState();
    if (state.running) { clock.hold('user'); pausePreview(); }
    else {
      const entry = entries[current];
      if (entry.mode === 'watch') { pausePreview(); entry.mode = 'idle'; paintVideo(entry); }
      clock.hold('video', false); clock.hold('focus', false); clock.hold('user', false); clock.hold('reduced', false);
      if (entry.mode === 'preview') void preview(entry);
    }
  });
  listen(root, 'keydown', event => {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key) || event.target.closest('video,input,select,textarea')) return;
    event.preventDefault(); event.stopPropagation(); nextSlide(event.key === 'ArrowLeft' ? -1 : 1);
  });
  listen(root, 'focusin', event => {
    if (!event.target.closest('[data-carousel-play],video') && event.target.matches(':focus-visible')) clock.hold('focus');
  });
  listen(root, 'focusout', event => { if (!root.contains(event.relatedTarget)) clock.hold('focus', false); });
  function visibility() {
    clock.hold('hidden', !!page.hidden);
    if (page.hidden) pausePreview();
  }
  // Capture first so Embla sees a stopped timer when it handles a hidden document.
  listen(page, 'visibilitychange', visibility, true);
  const motionChanged = event => {
    reduced = event.matches;
    clock.hold('reduced', reduced);
    if (reduced && entries[current]?.mode === 'preview') pausePreview();
    api.reInit({ duration: reduced ? 0 : 32 });
    carouselParallax(api, parallaxNodes, reduced);
  };
  motionQuery?.addEventListener?.('change', motionChanged);
  if (typeof Observer === 'function') {
    observer = new Observer(changes => {
      if (disposed) return;
      for (const change of changes) if (change.target === root) {
        visible = change.isIntersecting;
        clock.hold('offscreen', !visible);
        if (!visible) pausePreview();
      }
    }, { root: root.closest('.panel-reader'), threshold: 0 });
    observer.observe(root);
  }
  const tween = () => carouselParallax(api, parallaxNodes, reduced);
  const down = () => clock.hold('drag'), up = () => clock.hold('drag', false);
  const timerStarted = () => clock.timerStarted();
  const reinit = () => { clock.hold('layout', api.scrollSnapList().length < 2); selection(); clock.restart(); tween(); };
  api.on('select', selection).on('scroll', tween).on('reInit', reinit)
    .on('pointerDown', down).on('pointerUp', up).on('autoplay:timerset', timerStarted);
  root.dataset.ready = '';
  selection();
  clock.hold('initializing', false);
  return {
    select(id) { const index = entries.findIndex(entry => entry.id === id); if (index < 0) return false; api.scrollTo(index, reduced); return true; },
    play: seconds => watch(entries[current], seconds),
    activeVideo: () => entries[current]?.video,
    getState: () => ({ ...clock.getState(), id: entries[current]?.id, watching: entries[current]?.mode === 'watch' }),
    refresh() { clock.hold('inactive', !isActive()); if (!isActive()) pausePreview(); },
    destroy() {
      if (disposed) return;
      disposed = true; clock.destroy(); observer?.disconnect();
      motionQuery?.removeEventListener?.('change', motionChanged);
      listeners.forEach(remove => remove());
      api.off('select', selection).off('scroll', tween).off('reInit', reinit)
        .off('pointerDown', down).off('pointerUp', up).off('autoplay:timerset', timerStarted);
      api.destroy();
      entries.forEach(entry => { ++entry.generation; releaseDemo(entry.video); });
      delete root.dataset.ready;
    }
  };
}
