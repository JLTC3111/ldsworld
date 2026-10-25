// Audio must unlock inside a real driving gesture. Keep listening after the
// first attempt: browsers can deny it or suspend the context after a tab switch.
export function bindEngineUnlock({audio,eventTarget=globalThis.window,documentTarget=globalThis.document,isDrivingGesture=()=>true}){
  let disposed=false;
  const unlock=event=>{
    if(disposed||!audio.enabled||documentTarget?.hidden||event.isTrusted===false||event.repeat||event.ctrlKey||event.metaKey||event.altKey||!isDrivingGesture(event))return;
    if(audio.unlocked&&audio.context?.state==='running')return;
    audio.resume().catch(()=>{});
  };
  const visibility=()=>{if(!disposed&&!documentTarget?.hidden&&audio.enabled&&audio.context&&audio.unlocked&&audio.context.state!=='running')audio.resume().catch(()=>{});};
  eventTarget.addEventListener('pointerdown',unlock,true);eventTarget.addEventListener('keydown',unlock,true);documentTarget?.addEventListener('visibilitychange',visibility);
  return {dispose(){disposed=true;eventTarget.removeEventListener('pointerdown',unlock,true);eventTarget.removeEventListener('keydown',unlock,true);documentTarget?.removeEventListener('visibilitychange',visibility);}};
}
