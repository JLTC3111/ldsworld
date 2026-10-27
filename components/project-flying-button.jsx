import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import FlyingButton from './react-bits/FlyingButton.jsx';

/** Keep normal one-tap/keyboard navigation on touch and reduced-motion devices. */
export function mountFlyingProjectAction({host,model,onOpen}){
  const root=createRoot(host),hover=matchMedia('(hover: hover) and (pointer: fine)'),reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let current=model,disposed=false;
  const activate=event=>{event.stopPropagation();onOpen(current.projectId);};
  function update(next=current){
    if(disposed)return;current=next;const restoreFocus=host.contains(document.activeElement);
    const flight=hover.matches&&!reduced.matches;
    host.dataset.flightMode=flight?'on':'off';
    const attributes={'data-stage-open':'','data-open-project':current.projectId,'aria-label':current.ariaLabel};
    const content=<><span>{current.label}</span><svg className="icon small" aria-hidden="true"><use href="#i-up-right" /></svg></>;
    flushSync(()=>root.render(flight?<FlyingButton buttonProps={attributes} onClick={activate} theme={current.night?'dark':'light'} size="medium" radius={0} altitude={28} hoverTime={1.4} jets={2} carryCursor={true} ramp={false} smoke={.45} turbulence={.5} wobble={.25} buttonColor={current.night?'#c9c3b8':'#59636b'} textColor={current.night?'#353d44':'#f4f0e8'} className="project-flying-button">{content}</FlyingButton>:<button type="button" {...attributes} className="primary-button" onClick={activate}>{content}</button>));
    if(restoreFocus&&!host.contains(document.activeElement))host.querySelector('button')?.focus({preventScroll:true});
  }
  const refresh=()=>update();hover.addEventListener?.('change',refresh);reduced.addEventListener?.('change',refresh);update();
  return {update,dispose(){if(disposed)return;disposed=true;hover.removeEventListener?.('change',refresh);reduced.removeEventListener?.('change',refresh);root.unmount();}};
}
