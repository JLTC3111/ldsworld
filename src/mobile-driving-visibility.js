/** Actual vehicle motion hides mobile chrome; desktop visibility stays separate. */
export function createMobileDrivingVisibility({ hero, dock, document: page = globalThis.document, focusSurface = () => page.querySelector('#island-canvas')?.focus({ preventScroll: true }) } = {}) {
  const elements = [hero, dock].filter(Boolean), previousInert = new Map();
  let mobile = false, hidden = false, stoppedFor = 0, disposed = false;
  const otherwiseHidden = element => page.body.classList.contains('ui-hidden') || Boolean(element.classList?.contains('hero-driving'));
  function sync() {
    if (disposed) return;
    const active=mobile&&hidden;
    if(page.body.classList.contains('mobile-driving')!==active)page.body.classList.toggle('mobile-driving',active);
    if (hidden) for (const element of elements) if(!element.inert)element.inert = true;
  }
  function setHidden(value) {
    if (hidden === value) { sync(); return; }
    if (value) {
      // Focus must leave the disappearing controls before they become inert.
      if (elements.some(element => element.contains(page.activeElement))) focusSurface();
      for (const element of elements) previousInert.set(element, Boolean(element.inert) && !otherwiseHidden(element));
    }
    hidden = value;
    if (!hidden) {
      for (const element of elements) element.inert = Boolean(previousInert.get(element)) || otherwiseHidden(element);
      previousInert.clear();
    }
    sync();
  }
  function setMobile(value) {
    if (disposed) return;
    mobile = Boolean(value);
    if (!mobile) { stoppedFor = 0; setHidden(false); }
    else sync();
  }
  function reset() {
    if (disposed) return;
    stoppedFor = 0; setHidden(false);
  }
  return {
    setMobile, sync, reset,
    updateMotion({ mobile: nextMobile = mobile, speed = 0, airborne = false, hop = 0, paused = false, dt = 0 } = {}) {
      if (disposed) return;
      if (Boolean(nextMobile) !== mobile) setMobile(nextMobile);
      if (!mobile) return;
      if (paused || page.hidden) { sync(); return; }
      // A lower stop threshold avoids flicker while coasting around the start
      // threshold. The delay uses simulation time, so a paused panel freezes it.
      const moving = Math.abs(Number(speed) || 0) > (hidden ? .015 : .035) || airborne || hop > .015;
      if (moving) { stoppedFor = 0; setHidden(true); }
      else if (hidden) {
        stoppedFor += Math.max(0, Math.min(.1, Number(dt) || 0));
        if (stoppedFor >= .35) reset();
        else sync();
      }
    },
    dispose() {
      if (disposed) return;
      reset(); disposed = true; previousInert.clear();
    },
    get hidden() { return hidden; }
  };
}
