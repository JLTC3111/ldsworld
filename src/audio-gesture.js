// Explicit controls own their click/keyboard action. Retrying autoplay during
// pointerdown or keydown would change their state before that action runs.
export function isAudioControl(event) {
  return !!event.target?.closest?.('#sound, #music, [data-action="toggle-sound"], [data-action="toggle-music"]');
}
