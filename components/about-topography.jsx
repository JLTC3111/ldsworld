import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import Topography from './react-bits/Topography.jsx';

export function mountTopography(host) {
  const root=createRoot(host);
  flushSync(()=>root.render(<Topography color="#4f7cff" lineCount={22} lineWidth={1.2} elevation={1} foreground={0.2} tilt={32} speed={0.25} direction="forward" glow={0.6} depthOfField={0.4} fog={0.35} hoverEffect="lift" clickEffect="pulse" />));
  // Keep the authored contours readable when WebGL is unavailable.
  const fallback=host.parentElement.querySelector('.topography-fallback');
  if(fallback)fallback.hidden=!!host.querySelector('canvas')?.getContext('webgl2');
  return {dispose(){root.unmount();}};
}
