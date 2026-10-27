import {createRoot} from 'react-dom/client';
import {flushSync} from 'react-dom';
import FlyingButton from './react-bits/FlyingButton.jsx';

/** Keep normal one-tap/keyboard navigation on touch and reduced-motion devices. */
export function mountFlyingProjectAction({host,model,onOpen}){
  const root=createRoot(host),hover=matchMedia('(hover: hover) and (pointer: fine)'),reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let current=model,disposed=false;
  const stage=host.closest('.panel-stage'),flightController={current:null};
  function measureStage(){
    if(!stage||host.dataset.flightMode!=='on')return;
    const bounds=stage.getBoundingClientRect(),anchor=host.getBoundingClientRect();
    const padding=parseFloat(getComputedStyle(stage).paddingBottom)||0;
    const height=Math.ceil(Math.max(stage.clientHeight||bounds.height||96,anchor.bottom-bounds.top+stage.scrollTop+padding));
    const value=height+'px';if(host.style.getPropertyValue('--project-flight-height')!==value)host.style.setProperty('--project-flight-height',value);
    flightController.current?.refresh();
  }
  const observer=typeof ResizeObserver==='function'?new ResizeObserver(measureStage):null;
  if(stage){observer?.observe(stage);for(const child of stage.children)observer?.observe(child);}observer?.observe(host);
  const resized=()=>measureStage();window.addEventListener('resize',resized);
  const activate=event=>{event.stopPropagation();onOpen(current.projectId);};
  function update(next=current){
    if(disposed)return;current=next;const restoreFocus=host.contains(document.activeElement);
    const flight=hover.matches&&!reduced.matches;
    host.dataset.flightMode=flight?'on':'off';measureStage();
    const attributes={'data-stage-open':'','data-open-project':current.projectId,'aria-label':current.ariaLabel};
    const content=<><span>{current.label}</span><svg className="icon small" aria-hidden="true"><use href="#i-up-right" /></svg></>;
    flushSync(()=>root.render(flight?<FlyingButton anchorElement={host} controllerRef={flightController} quality={.5} maxDpr={1.25} maxFps={30} maxCanvasPixels={480000} buttonProps={attributes} onClick={activate} theme={current.night?'dark':'light'} size="medium" style={{'--fly-radius':'25%'}} altitude={140} hoverTime={1.4} jets={2} carryCursor={false} ramp={false} smoke={.6} smokeColor={current.night?'#d6e0ef':'#9faebb'} turbulence={.5} wobble={.25} buttonColor={current.night?'#c9c3b8':'#59636b'} textColor={current.night?'#353d44':'#f4f0e8'} className="project-flying-button">{content}</FlyingButton>:<button type="button" {...attributes} className="primary-button project-action-fallback" onClick={activate}>{content}</button>));
    if(restoreFocus&&!host.contains(document.activeElement))host.querySelector('button')?.focus({preventScroll:true});
  }
  const refresh=()=>update();hover.addEventListener?.('change',refresh);reduced.addEventListener?.('change',refresh);update();
  return {update,dispose(){if(disposed)return;disposed=true;hover.removeEventListener?.('change',refresh);reduced.removeEventListener?.('change',refresh);observer?.disconnect();window.removeEventListener('resize',resized);root.unmount();}};
}
