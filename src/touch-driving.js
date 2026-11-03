/** Two independent pointer-captured thumb pads, with no sensor permissions. */
export function createTouchDriving({root,onInput=()=>{},window:surface=globalThis.window,document:page=globalThis.document}={}){
  const buttons=[...root.querySelectorAll('[data-thumb-action]')],steeringPad=root.querySelector('[data-steering-pad]'),movementPad=root.querySelector('[data-movement-pad]'),owners=new Map(),bindings=[];
  const steeringButtons=buttons.filter(button=>['left','right'].includes(button.dataset.thumbAction));
  let enabled=false,paused=false,disposed=false;
  const group=action=>action==='forward'||action==='reverse'?'movement':'steering';
  const emit=()=>{
    const active=new Set([...owners.values()].filter(owner=>owner.pad==='movement').map(owner=>owner.action));
    const steering=[...owners.values()].find(owner=>owner.pad==='steering'),steer=steering?.steer??0;
    for(const button of buttons){const action=button.dataset.thumbAction;button.setAttribute('aria-pressed',String(action==='left'?steer<0:action==='right'?steer>0:active.has(action)));}
    if(steeringPad){
      steeringPad.style.setProperty('--steer-x',`${steering?.x??0}px`);
      steeringPad.style.setProperty('--steer-y',`${steering?.y??0}px`);
      steeringPad.toggleAttribute('data-active',Boolean(steering));
    }
    onInput({throttle:Number(active.has('forward'))-Number(active.has('reverse')),steer,smoothDrive:true});
  };
  const listen=(target,type,fn,options)=>{target?.addEventListener?.(type,fn,options);bindings.push(()=>target?.removeEventListener?.(type,fn,options));};
  const available=()=>enabled&&!paused&&!disposed&&!page.hidden;
  function releaseCapture(id,owner){try{if(owner.target.hasPointerCapture?.(id))owner.target.releasePointerCapture(id);}catch{}}
  function release(id){const owner=owners.get(id);if(!owner)return;owners.delete(id);releaseCapture(id,owner);emit();}
  function clear(){const previous=[...owners];owners.clear();for(const[id,owner]of previous)releaseCapture(id,owner);emit();}
  function press(id,button){
    if(!available())return;
    const action=button.dataset.thumbAction,pad=group(action);
    if(owners.has(id)||[...owners.values()].some(owner=>owner.pad===pad))return;
    const steer=action==='left'?-1:action==='right'?1:0;
    owners.set(id,{button,target:button,action,pad,steer,x:steer?steer*steeringGeometry().radius:0,y:0});emit();
  }
  function steeringGeometry(){
    const rect=steeringPad?.getBoundingClientRect(),size=rect?Math.min(rect.width,rect.height):112;
    const buttonSize=steeringButtons[0]?.getBoundingClientRect().width||44;
    return {cx:rect?rect.left+rect.width/2:0,cy:rect?rect.top+rect.height/2:0,radius:Math.max(1,(size-buttonSize)/2)};
  }
  function moveSteering(owner,event){
    const {cx,cy,radius}=owner.geometry,dx=event.clientX-cx,dy=event.clientY-cy,distance=Math.hypot(dx,dy);
    // Project the circular thumb vector onto the steering axis, preserving every
    // intermediate angle. Clamp radially so diagonal drags never gain strength.
    const travel=Math.min(distance,radius),scale=distance?travel/distance:0;
    owner.x=dx*scale;owner.y=dy*scale;
    const deadZone=.06,magnitude=Math.max(0,(travel/radius-deadZone)/(1-deadZone));
    owner.steer=magnitude?dx/distance*magnitude:0;
    emit();
  }
  const finish=event=>{if(owners.has(event.pointerId)){event.preventDefault();event.stopPropagation();release(event.pointerId);}};
  if(movementPad){
    const move=event=>{const owner=owners.get(event.pointerId);if(owner?.target!==movementPad)return;event.preventDefault();event.stopPropagation();const offset=event.clientY-owner.cy;owner.action=Math.abs(offset)<=4?null:offset<0?'forward':'reverse';emit();};
    listen(movementPad,'pointerdown',event=>{
      if(event.button>0||!available())return;event.preventDefault();event.stopPropagation();
      if(owners.has(event.pointerId)||[...owners.values()].some(owner=>owner.pad==='movement'))return;
      const rect=movementPad.getBoundingClientRect();owners.set(event.pointerId,{target:movementPad,pad:'movement',cy:rect.top+rect.height/2});move(event);
      try{movementPad.setPointerCapture(event.pointerId);}catch{}
    });
    listen(movementPad,'pointermove',move);
    for(const type of ['pointerup','pointercancel','lostpointercapture'])listen(movementPad,type,finish);
    listen(movementPad,'contextmenu',event=>event.preventDefault());
  }
  if(steeringPad){
    listen(steeringPad,'pointerdown',event=>{
      if(event.button>0||!available())return;event.preventDefault();event.stopPropagation();
      if(owners.has(event.pointerId)||[...owners.values()].some(owner=>owner.pad==='steering'))return;
      const owner={target:steeringPad,pad:'steering',geometry:steeringGeometry()};owners.set(event.pointerId,owner);moveSteering(owner,event);
      try{steeringPad.setPointerCapture(event.pointerId);}catch{}
    });
    listen(steeringPad,'pointermove',event=>{const owner=owners.get(event.pointerId);if(!owner?.geometry)return;event.preventDefault();event.stopPropagation();moveSteering(owner,event);});
    for(const type of ['pointerup','pointercancel','lostpointercapture'])listen(steeringPad,type,finish);
    listen(steeringPad,'contextmenu',event=>event.preventDefault());
  }
  for(const button of buttons){
    if(!steeringPad?.contains(button)&&!movementPad?.contains(button)){
      listen(button,'pointerdown',event=>{if(event.button>0||!available())return;event.preventDefault();event.stopPropagation();press(event.pointerId,button);if(owners.has(event.pointerId))try{button.setPointerCapture(event.pointerId);}catch{}});
      listen(button,'pointermove',event=>{const owner=owners.get(event.pointerId);if(!owner)return;event.preventDefault();const next=page.elementFromPoint?.(event.clientX,event.clientY)?.closest?.('[data-thumb-action]');if(next&&root.contains(next)&&group(next.dataset.thumbAction)===owner.pad&&next.dataset.thumbAction!==owner.action){owner.action=next.dataset.thumbAction;owner.steer=owner.action==='left'?-1:owner.action==='right'?1:0;emit();}});
      for(const type of ['pointerup','pointercancel','lostpointercapture'])listen(button,type,finish);
    }
    const keyId=event=>`key:${button.dataset.thumbAction}:${event.key}`;
    listen(button,'keydown',event=>{if(![' ','Enter'].includes(event.key)||!available())return;event.preventDefault();event.stopPropagation();if(!event.repeat)press(keyId(event),button);});
    listen(button,'keyup',event=>{if(![' ','Enter'].includes(event.key))return;event.preventDefault();event.stopPropagation();release(keyId(event));});
    listen(button,'blur',()=>{for(const[id,owner]of owners)if(typeof id==='string'&&owner.button===button)release(id);});
    listen(button,'contextmenu',event=>event.preventDefault());
    listen(button,'click',event=>{event.preventDefault();event.stopPropagation();});
  }
  listen(surface,'blur',clear);listen(surface,'resize',clear);listen(surface,'orientationchange',clear);listen(surface.screen?.orientation,'change',clear);
  listen(page,'visibilitychange',()=>{if(page.hidden)clear();});
  function sync(){root.hidden=!enabled||paused;root.inert=!enabled||paused;for(const button of buttons)button.disabled=!enabled||paused;}
  sync();
  return {setEnabled(value){value=Boolean(value);if(disposed||value===enabled)return;enabled=value;clear();sync();},setPaused(value){value=Boolean(value);if(disposed||value===paused)return;paused=value;clear();sync();},clear,dispose(){if(disposed)return;disposed=true;enabled=false;clear();bindings.forEach(remove=>remove());sync();},get active(){return enabled&&!paused;},get held(){return owners.size>0;}};
}
