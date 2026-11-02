import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import Topography from './react-bits/Topography.jsx';
import {deviceBudget} from '../src/render-budget.js';

export function mountTopography(host) {
  const root=createRoot(host);
  const budget=deviceBudget({hardwareConcurrency:navigator.hardwareConcurrency,deviceMemory:navigator.deviceMemory,saveData:navigator.connection?.saveData,coarse:matchMedia('(pointer: coarse)').matches});
  flushSync(()=>root.render(<Topography color="#4f7cff" lineCount={22} lineWidth={1.2} elevation={1} foreground={0.2} tilt={32} speed={budget.lowPower?0:0.25} morph={budget.lowPower?0:0.2} direction="forward" glow={budget.lowPower?0:0.6} depthOfField={budget.lowPower?0:0.4} fog={0.35} hoverEffect="lift" clickEffect="pulse" dpr={budget.lowPower?1:Math.min(devicePixelRatio||1,1.5)} maxCanvasPixels={budget.lowPower?300000:600000} maxFps={30} />));
  // Keep the authored contours readable when WebGL is unavailable.
  const fallback=host.parentElement.querySelector('.topography-fallback');
  if(fallback)fallback.hidden=!!host.querySelector('canvas')?.getContext('webgl2');
  return {dispose(){root.unmount();}};
}
