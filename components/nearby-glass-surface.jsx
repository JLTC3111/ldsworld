import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import GlassSurface from './react-bits/GlassSurface.jsx';
import {deviceBudget} from '../src/render-budget.js';

/** Keep the existing native project button, labels and click/keyboard handling. */
export function mountNearbyGlassSurface(button){
  if(!button)return {dispose(){}};
  const host=document.createElement('span');host.className='nearby-glass-host';host.setAttribute('aria-hidden','true');
  button.append(host);button.classList.add('nearby-project--glass');
  const root=createRoot(host),motion=matchMedia('(prefers-reduced-motion: reduce)'),hardware=globalThis.navigator;
  const budget=deviceBudget({hardwareConcurrency:hardware?.hardwareConcurrency,deviceMemory:hardware?.deviceMemory,saveData:hardware?.connection?.saveData});
  let disposed=false;
  const render=()=>flushSync(()=>root.render(<GlassSurface width="100%" height="100%" borderRadius={16} borderWidth={.12} brightness={55} opacity={.93} blur={8} displace={0} backgroundOpacity={.2} saturation={1.15} distortionScale={-90} redOffset={0} greenOffset={5} blueOffset={10} refraction={!budget.lowPower&&!motion.matches} renderer="svg" />));
  render();motion.addEventListener?.('change',render);
  return {dispose(){if(disposed)return;disposed=true;motion.removeEventListener?.('change',render);root.unmount();host.remove();button.classList.remove('nearby-project--glass');}};
}
