const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));
const axis=value=>Math.abs(value)<=3?0:Math.sign(value)*clamp((Math.abs(value)-3)/16,0,1);
export function screenTilt(beta,gamma,angle=0){
  const r=angle*Math.PI/180,c=Math.cos(r),s=Math.sin(r);
  return {pitch:beta*c-gamma*s,roll:gamma*c+beta*s};
}

/** Calibrate to the way the phone is held, including either landscape side. */
export function createTiltControls({window:surface=globalThis.window,document:page=globalThis.document,onInput=()=>{},onStatus=()=>{},isMobile=()=>true,setTimer=setTimeout,clearTimer=clearTimeout}={}){
  let enabled=false,paused=false,baseline=null,filtered={throttle:0,steer:0},timer=null,pending=null,disposed=false;
  const emitZero=()=>{filtered={throttle:0,steer:0};onInput(filtered);clearTimer(timer);timer=null;};
  function calibrate(){baseline=null;emitZero();}
  const angle=()=>surface.screen?.orientation?.angle??surface.orientation??0;
  function sample(event){
    if(!enabled||paused||page.hidden||!isMobile()||!Number.isFinite(event.beta)||!Number.isFinite(event.gamma))return;
    const tilt=screenTilt(event.beta,event.gamma,angle());
    if(!baseline){baseline=tilt;emitZero();onStatus('ready');return;}
    const target={throttle:axis(baseline.pitch-tilt.pitch),steer:axis(tilt.roll-baseline.roll)};
    for(const key of ['throttle','steer']){filtered[key]+=(target[key]-filtered[key])*.25;if(Math.abs(filtered[key])<.01)filtered[key]=0;}
    onInput({...filtered});clearTimer(timer);timer=setTimer(emitZero,700);
  }
  async function request(){
    if(disposed||!isMobile())return false;
    if(enabled){calibrate();return true;}
    if(pending)return pending;
    const Sensor=surface.DeviceOrientationEvent;
    if(!Sensor||surface.isSecureContext===false){onStatus('unavailable');return false;}
    // iOS requires this call synchronously within the Explore click gesture.
    let permission;
    try{permission=typeof Sensor.requestPermission==='function'?Sensor.requestPermission():'granted';}catch{onStatus('denied');return false;}
    pending=Promise.resolve(permission).then(result=>{
      if(disposed||result!=='granted'){if(!disposed)onStatus('denied');return false;}
      enabled=true;calibrate();surface.addEventListener('deviceorientation',sample);onStatus('calibrating');return true;
    },()=>{if(!disposed)onStatus('denied');return false;}).finally(()=>{pending=null;});
    return pending;
  }
  const orientation=()=>calibrate(),visibility=()=>{if(page.hidden)calibrate();};
  surface.addEventListener('orientationchange',orientation);surface.screen?.orientation?.addEventListener?.('change',orientation);page.addEventListener('visibilitychange',visibility);
  return {request,calibrate,setPaused(value){paused=value;calibrate();},dispose(){disposed=true;enabled=false;emitZero();surface.removeEventListener('deviceorientation',sample);surface.removeEventListener('orientationchange',orientation);surface.screen?.orientation?.removeEventListener?.('change',orientation);page.removeEventListener('visibilitychange',visibility);},get enabled(){return enabled;}};
}
