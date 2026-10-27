/** Two independent pointer-captured thumb pads, with no sensor permissions. */
export function createTouchDriving({root,onInput=()=>{},window:surface=globalThis.window,document:page=globalThis.document}={}){
  const buttons=[...root.querySelectorAll('[data-thumb-action]')],owners=new Map(),bindings=[];
  let enabled=false,paused=false,disposed=false;
  const group=action=>action==='forward'||action==='reverse'?'movement':'steering';
  const emit=()=>{
    const active=new Set([...owners.values()].map(owner=>owner.action));
    for(const button of buttons)button.setAttribute('aria-pressed',String(active.has(button.dataset.thumbAction)));
    onInput({throttle:Number(active.has('forward'))-Number(active.has('reverse')),steer:Number(active.has('right'))-Number(active.has('left')),smoothDrive:true});
  };
  const listen=(target,type,fn,options)=>{target?.addEventListener?.(type,fn,options);bindings.push(()=>target?.removeEventListener?.(type,fn,options));};
  const available=()=>enabled&&!paused&&!disposed&&!page.hidden;
  function release(id){const owner=owners.get(id);if(!owner)return;owners.delete(id);try{if(owner.button.hasPointerCapture?.(id))owner.button.releasePointerCapture(id);}catch{}emit();}
  function clear(){const previous=[...owners];owners.clear();for(const[id,owner]of previous)try{if(owner.button.hasPointerCapture?.(id))owner.button.releasePointerCapture(id);}catch{}emit();}
  function press(id,button){
    if(!available())return;
    const action=button.dataset.thumbAction,pad=group(action);
    if([...owners.values()].some(owner=>owner.pad===pad))return;
    owners.set(id,{button,action,pad});emit();
  }
  for(const button of buttons){
    listen(button,'pointerdown',event=>{if(event.button>0||!available())return;event.preventDefault();event.stopPropagation();press(event.pointerId,button);if(owners.has(event.pointerId))try{button.setPointerCapture(event.pointerId);}catch{}});
    listen(button,'pointermove',event=>{const owner=owners.get(event.pointerId);if(!owner)return;event.preventDefault();const next=page.elementFromPoint?.(event.clientX,event.clientY)?.closest?.('[data-thumb-action]');if(next&&root.contains(next)&&group(next.dataset.thumbAction)===owner.pad&&next.dataset.thumbAction!==owner.action){owner.action=next.dataset.thumbAction;emit();}});
    const finish=event=>{if(owners.has(event.pointerId)){event.preventDefault();event.stopPropagation();release(event.pointerId);}};
    for(const type of ['pointerup','pointercancel','lostpointercapture'])listen(button,type,finish);
    listen(button,'keydown',event=>{if(![' ','Enter'].includes(event.key)||!available())return;event.preventDefault();event.stopPropagation();if(!event.repeat)press('key:'+event.key,button);});
    listen(button,'keyup',event=>{if(![' ','Enter'].includes(event.key))return;event.preventDefault();event.stopPropagation();release('key:'+event.key);});
    listen(button,'blur',()=>{for(const[id,owner]of owners)if(typeof id==='string'&&owner.button===button)release(id);});
    listen(button,'contextmenu',event=>event.preventDefault());
    listen(button,'click',event=>{event.preventDefault();event.stopPropagation();});
  }
  listen(surface,'blur',clear);listen(surface,'resize',clear);listen(surface,'orientationchange',clear);listen(surface.screen?.orientation,'change',clear);
  listen(page,'visibilitychange',()=>{if(page.hidden)clear();});
  function sync(){root.hidden=!enabled||paused;root.inert=!enabled||paused;for(const button of buttons)button.disabled=!enabled||paused;}
  sync();
  return {setEnabled(value){value=Boolean(value);if(disposed||value===enabled)return;enabled=value;clear();sync();},setPaused(value){value=Boolean(value);if(disposed||value===paused)return;paused=value;clear();sync();},clear,dispose(){if(disposed)return;disposed=true;enabled=false;clear();bindings.forEach(remove=>remove());sync();},get active(){return enabled&&!paused;}};
}
