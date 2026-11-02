/** Finite, CSS-only split-flap motion. The heading keeps one accessible label. */
export function createSplitFlapHeadline(host, { duration = 460, stagger = 45 } = {}) {
  if (!host) return { refresh() {}, replay() { return false; }, dispose() {} };
  const doc = host.ownerDocument, view = doc.defaultView || window;
  const motion = view.matchMedia?.('(prefers-reduced-motion: reduce)');
  const originalLabel = host.getAttribute('aria-label'), originalTabIndex = host.getAttribute('tabindex');
  const hero = host.closest('.hero');
  const cleanups = [];
  let source = host.innerHTML, tiles = [], frame = 0, disposed = false, intersecting = true, pendingReveal = false;
  const listen = (target, event, handler) => {
    target.addEventListener(event, handler);
    cleanups.push(() => target.removeEventListener(event, handler));
  };
  function canRun() {
    if (disposed || doc.hidden || !intersecting || motion?.matches) return false;
    if (hero?.classList.contains('hero-driving') || hero?.hidden || hero?.inert) return false;
    if (['panel-open', 'ui-hidden', 'mobile-gameplay'].some(name => doc.body.classList.contains(name))) return false;
    const style = view.getComputedStyle(host);
    return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
  }
  function cancel() {
    if (frame) view.cancelAnimationFrame(frame);
    frame = 0;
    for (const tile of tiles) tile.classList.remove('is-flipping');
  }
  function replay() {
    cancel();
    if (!canRun()) return false;
    // Two finite frames give a previous animation a paint to reset, without a
    // synchronous layout read or a continuously running animation loop.
    frame = view.requestAnimationFrame(() => {
      frame = view.requestAnimationFrame(() => {
        frame = 0;
        if (!canRun()) return;
        pendingReveal = false;
        for (const tile of tiles) tile.classList.add('is-flipping');
      });
    });
    return true;
  }
  function visibilityChanged() {
    if (!canRun()) cancel();
    else if (pendingReveal) replay();
  }
  function refresh(html = source) {
    if (disposed) return;
    cancel(); source = String(html);
    const template = doc.createElement('template'); template.innerHTML = source;
    const lines = [''];
    function read(node) {
      if (node.nodeType === 3) lines[lines.length - 1] += node.textContent;
      else if (node.nodeName === 'BR') lines.push('');
      else for (const child of node.childNodes) read(child);
    }
    read(template.content);
    const words = lines.map(line => line.trim().split(/\s+/u).filter(Boolean));
    tiles = [];
    const rows = words.map(line => {
      const row = doc.createElement('span'); row.className = 'split-flap-line'; row.setAttribute('aria-hidden', 'true');
      for (const word of line) {
        const tile = doc.createElement('span'); tile.className = 'split-flap-word';
        tile.style.setProperty('--flap-delay', `${Math.min(tiles.length * Math.max(0, stagger), 240)}ms`);
        tile.style.setProperty('--flap-duration', `${Math.max(180, Math.min(900, duration))}ms`);
        const label = doc.createElement('span'); label.className = 'split-flap-label'; label.textContent = word; tile.append(label);
        for (const half of ['top', 'bottom']) {
          const flap = doc.createElement('span'); flap.className = `split-flap-leaf split-flap-leaf--${half}`;
          const text = doc.createElement('span'); text.textContent = word; flap.append(text); tile.append(flap);
        }
        row.append(tile); tiles.push(tile);
      }
      return row;
    });
    host.replaceChildren(...rows);
    host.classList.add('split-flap-headline');
    host.setAttribute('aria-label', words.flat().join(' '));
    if (originalTabIndex === null) host.setAttribute('tabindex', '0');
    pendingReveal = true; replay();
  }
  listen(host, 'pointerenter', replay);
  listen(host, 'focus', replay);
  listen(host, 'animationend', event => {
    if (event.target.classList?.contains('split-flap-leaf--bottom')) event.target.parentElement.classList.remove('is-flipping');
  });
  listen(doc, 'visibilitychange', visibilityChanged);
  if (motion?.addEventListener) listen(motion, 'change', visibilityChanged);
  const intersection = view.IntersectionObserver ? new view.IntersectionObserver(entries => {
    intersecting = entries.some(entry => entry.isIntersecting); visibilityChanged();
  }) : null;
  intersection?.observe(host);
  const mutations = view.MutationObserver ? new view.MutationObserver(visibilityChanged) : null;
  mutations?.observe(doc.body, { attributes: true, attributeFilter: ['class'] });
  if (hero) mutations?.observe(hero, { attributes: true, attributeFilter: ['class', 'style', 'hidden', 'inert'] });
  refresh();
  return {
    refresh, replay,
    dispose() {
      if (disposed) return;
      cancel(); disposed = true;
      intersection?.disconnect(); mutations?.disconnect(); cleanups.forEach(cleanup => cleanup());
      host.classList.remove('split-flap-headline'); host.innerHTML = source;
      for (const [name, value] of [['aria-label', originalLabel], ['tabindex', originalTabIndex]]) {
        if (value === null) host.removeAttribute(name); else host.setAttribute(name, value);
      }
      tiles = [];
    }
  };
}
