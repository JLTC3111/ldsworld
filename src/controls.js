const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const physicalKeys = { KeyW: 'w', KeyA: 'a', KeyS: 's', KeyD: 'd', KeyB: 'b', Space: ' ', ShiftLeft: 'Shift', ShiftRight: 'Shift' };
const drivingKeys = new Set(['w', 'a', 's', 'd', 'b', ' ', 'Shift', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

export function drivingKey(event) {
  const key = physicalKeys[event.code] || (event.key?.length === 1 ? event.key.toLowerCase() : event.key);
  return drivingKeys.has(key) ? key : null;
}

export function wheelGesture(event, height = 800) {
  const scale = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? height : 1;
  const x = clamp(event.deltaX * scale, -200, 200);
  const y = clamp(event.deltaY * scale, -200, 200);
  return event.shiftKey && !event.ctrlKey
    ? { type: 'pan', x: -x, y: -y }
    : { type: 'zoom', amount: clamp((y || x) * (event.ctrlKey ? .008 : .0025), -.35, .35) };
}

// Input is bound only to the scene, so dialogs keep native scrolling and selection.
export function bindNavigation({ surface, wheelTarget = surface, keyboard = window, isPaused = () => false, onKey, onClear, onJump, onClick, onOrbit, onPan, onZoom }) {
  const pointers = new Map();
  let drag = null, multiTouch = false;
  const typing = element => !!element?.closest?.('input, textarea, select, [contenteditable]:not([contenteditable="false"])');
  const keyDown = event => {
    if (isPaused() || event.ctrlKey || event.metaKey || event.altKey || typing(event.target)) return;
    const key = drivingKey(event);
    if (!key || key === ' ' && event.target?.closest?.('button, a')) return;
    event.preventDefault();
    if(event.repeat)return;
    onKey?.(key, true);
    if (key === ' ' && !event.repeat) onJump?.();
  };
  const keyUp = event => { const key = drivingKey(event); if (key) onKey?.(key, false); };
  function clear() { pointers.clear(); drag = null; multiTouch = false; surface.classList.remove('is-dragging'); onClear?.(); }
  const centroid = () => {
    const [a, b] = [...pointers.values()];
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)) };
  };
  const down = event => {
    if (isPaused() || event.button > 2) return;
    event.preventDefault();
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    try { surface.setPointerCapture(event.pointerId); } catch { /* Capture can end during a native gesture. */ }
    if (pointers.size >= 2) { multiTouch = true; drag = { ...centroid(), moved: true }; }
    else drag = { x: event.clientX, y: event.clientY, originX: event.clientX, originY: event.clientY, moved: false, pan: event.button !== 0 || event.shiftKey, primary: event.button === 0 };
  };
  const move = event => {
    if (isPaused() || !pointers.has(event.pointerId) || !drag) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    event.preventDefault();
    if (pointers.size >= 2) {
      const next = centroid();
      onPan?.(next.x - drag.x, next.y - drag.y);
      onZoom?.(Math.log(drag.distance / next.distance));
      drag = { ...next, moved: true }; return;
    }
    if (multiTouch) return;
    const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
    if (!drag.moved && Math.hypot(event.clientX - drag.originX, event.clientY - drag.originY) > 6) drag.moved = true;
    if (drag.moved) {
      surface.classList.add('is-dragging');
      (drag.pan || event.shiftKey ? onPan : onOrbit)?.(dx, dy);
    }
    drag.x = event.clientX; drag.y = event.clientY;
  };
  const finish = event => {
    const pointer = pointers.get(event.pointerId);
    if (!pointer) return;
    if (!isPaused() && event.type === 'pointerup' && !multiTouch && drag?.primary && !drag.moved && Math.hypot(event.clientX - drag.originX, event.clientY - drag.originY) <= 6) onClick?.(event.clientX, event.clientY);
    pointers.delete(event.pointerId);
    try { if (surface.hasPointerCapture?.(event.pointerId)) surface.releasePointerCapture(event.pointerId); } catch { /* Already released. */ }
    if (!pointers.size) { drag = null; multiTouch = false; surface.classList.remove('is-dragging'); }
  };
  const wheel = event => {
    if (isPaused()) return;
    event.preventDefault();
    const gesture = wheelGesture(event, surface.clientHeight || 800);
    if (gesture.type === 'pan') onPan?.(gesture.x, gesture.y); else onZoom?.(gesture.amount);
  };
  const context = event => { if (!isPaused()) event.preventDefault(); };
  keyboard.addEventListener('keydown', keyDown); keyboard.addEventListener('keyup', keyUp); keyboard.addEventListener('blur', clear);
  const listeners = { pointerdown: down, pointermove: move, pointerup: finish, pointercancel: finish, lostpointercapture: finish, contextmenu: context };
  for (const [name, listener] of Object.entries(listeners)) surface.addEventListener(name, listener, { passive: false });
  wheelTarget.addEventListener('wheel', wheel, { passive: false });
  return { clear, dispose() {
    clear();
    keyboard.removeEventListener('keydown', keyDown); keyboard.removeEventListener('keyup', keyUp); keyboard.removeEventListener('blur', clear);
    for (const [name, listener] of Object.entries(listeners)) surface.removeEventListener(name, listener);
    wheelTarget.removeEventListener('wheel', wheel);
  }
  };
}
