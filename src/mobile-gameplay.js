/** Native fullscreen and landscape are requested from the Explore user gesture. */
export function createMobileGameplay({window:surface=globalThis.window,document:page=globalThis.document,onChange=()=>{}}={}){
  let active=false,disposed=false,pending=null,ownedFullscreen=false,ownedOrientation=false;
  const fullscreen=()=>page.fullscreenElement||page.webkitFullscreenElement;
  const snapshot=()=>({active,fullscreen:Boolean(fullscreen()),portrait:(surface.innerHeight||0)>(surface.innerWidth||0)});
  const notify=()=>{if(!disposed)onChange(snapshot());};
  const unlock=()=>{if(!ownedOrientation)return;ownedOrientation=false;try{surface.screen?.orientation?.unlock?.();}catch{}};
  async function leaveFullscreen(){if(!ownedFullscreen||!fullscreen())return;ownedFullscreen=false;try{const exit=page.exitFullscreen||page.webkitExitFullscreen;await exit?.call(page);}catch{}}
  function enter(){
    if(disposed)return Promise.resolve(snapshot());
    active=true;notify();
    if(pending)return pending;
    let request,requested=false;
    // Do not await anything before the browser's activation-gated API call.
    try{
      if(fullscreen())request=Promise.resolve();
      else if(page.documentElement.requestFullscreen){requested=true;ownedFullscreen=true;request=page.documentElement.requestFullscreen({navigationUI:'hide'});}
      else if(page.documentElement.webkitRequestFullscreen){requested=true;ownedFullscreen=true;request=page.documentElement.webkitRequestFullscreen();}
    }catch{ownedFullscreen=false;}
    const task=(async()=>{
      try{await request;if(requested&&fullscreen())ownedFullscreen=true;}catch{ownedFullscreen=false;}
      if(disposed||!active){await leaveFullscreen();return snapshot();}
      try{if(surface.screen?.orientation?.lock){await surface.screen.orientation.lock('landscape');ownedOrientation=true;}}catch{}
      if(disposed||!active){unlock();await leaveFullscreen();return snapshot();}
      notify();return snapshot();
    })();
    pending=task;const settled=()=>{if(pending===task)pending=null;};task.then(settled,settled);return task;
  }
  function exit(){active=false;unlock();void leaveFullscreen();notify();}
  const orientation=()=>notify(),fullscreenChange=()=>{if(!fullscreen()){if(!pending)ownedFullscreen=false;unlock();}else if(ownedFullscreen&&!active)void leaveFullscreen();notify();};
  surface.addEventListener('resize',orientation);surface.addEventListener('orientationchange',orientation);surface.screen?.orientation?.addEventListener?.('change',orientation);
  surface.visualViewport?.addEventListener?.('resize',orientation);
  page.addEventListener('fullscreenchange',fullscreenChange);page.addEventListener('webkitfullscreenchange',fullscreenChange);
  return {enter,exit,get active(){return active;},dispose(){if(disposed)return;exit();disposed=true;surface.removeEventListener('resize',orientation);surface.removeEventListener('orientationchange',orientation);surface.screen?.orientation?.removeEventListener?.('change',orientation);surface.visualViewport?.removeEventListener?.('resize',orientation);page.removeEventListener('fullscreenchange',fullscreenChange);page.removeEventListener('webkitfullscreenchange',fullscreenChange);}};
}
