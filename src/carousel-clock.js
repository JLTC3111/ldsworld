/** Embla Autoplay owns normal cycles; a single timer preserves a paused remainder. */
export function createCarouselClock({
  autoplay, advance, duration = 7000, onChange = () => {}, now = Date.now,
  setTimeout: schedule = globalThis.setTimeout, clearTimeout: cancel = globalThis.clearTimeout
}) {
  let remaining = duration, started = 0, running = false, timer = null, disposed = false;
  const holds = new Set();
  const timeLeft = () => running ? Math.max(0, remaining - (now() - started)) : remaining;
  const state = () => ({ running, remaining: timeLeft(), duration, holds: [...holds] });
  const notify = () => { if (!disposed) onChange(state()); };
  function freeze(save = true) {
    if (save) remaining = timeLeft();
    running = false;
    if (timer !== null) cancel(timer);
    timer = null;
    autoplay.stop();
  }
  function resume() {
    if (disposed || holds.size || running) return;
    running = true; started = now();
    if (remaining >= duration - 1) autoplay.play();
    else timer = schedule(() => {
      timer = null; running = false; remaining = duration;
      if (disposed || holds.size) return;
      advance();
      resume();
    }, remaining);
    notify();
  }
  return {
    getState: state,
    hold(reason, value = true) {
      if (disposed) return;
      if (value) { holds.add(reason); freeze(); notify(); }
      else { holds.delete(reason); resume(); notify(); }
    },
    restart() { if (disposed) return; freeze(false); remaining = duration; resume(); notify(); },
    start: resume,
    // Protect holds from the plugin's own visibility/interaction restart hooks.
    timerStarted() { if (disposed || holds.size) { autoplay.stop(); return; } },
    destroy() { if (disposed) return; freeze(); disposed = true; holds.clear(); }
  };
}
