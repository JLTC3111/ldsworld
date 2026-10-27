/** Keep one stable destination while an existing gooey transition finishes. */
export function createNavHoverQueue({
  current, moving, commit, delay = 110, distantDelay = 160,
  setTimeout: schedule = globalThis.setTimeout,
  clearTimeout: cancel = globalThis.clearTimeout
}) {
  let timer = null, pending = null, ready = false, disposed = false;
  const clearTimer = () => { if (timer !== null) cancel(timer); timer = null; };
  function flush() {
    if (disposed || !ready || pending === null || moving()) return;
    const index = pending;
    pending = null; ready = false;
    commit(index);
  }
  return {
    request(index, immediate = false) {
      if (disposed) return;
      clearTimer();
      pending = index; ready = immediate;
      if (immediate) { flush(); return; }
      timer = schedule(() => { timer = null; ready = true; flush(); },
        Math.abs(index - current()) > 1 ? distantDelay : delay);
    },
    settled: flush,
    cancel() { clearTimer(); pending = null; ready = false; },
    dispose() { this.cancel(); disposed = true; }
  };
}
