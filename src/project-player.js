import { playDemo } from './media.js';

/** Playback is explicit. Visibility may pause a demo, but never resumes it. */
export function createProjectPlayer({container,label,document:page=globalThis.document,IntersectionObserver:Observer=globalThis.IntersectionObserver}={}) {
  const video=container?.querySelector('video[data-project-demo]'),button=container?.querySelector('[data-demo-toggle]');
  if(!video||!button)return {destroy(){}};
  let disposed=false,visible=true,wanted=false,observer;
  video.autoplay=false;
  const sync=()=>{
    const playing=!video.paused&&!video.ended;
    button.setAttribute('aria-label',label(playing));button.setAttribute('aria-pressed',String(playing));
    button.innerHTML=`<svg class="icon" aria-hidden="true"><use href="#i-${playing?'pause':'play'}"/></svg>`;
    button.closest('.project-video-wrap')?.classList.toggle('video-playing',playing);
  };
  const pause=()=>{wanted=false;video.pause();sync();};
  const toggle=async()=>{
    if(!video.paused){pause();return;}
    wanted=true;
    await playDemo(video);
    if(disposed||!wanted||page.hidden||!visible)video.pause();
    if(!disposed)sync();
  };
  const nativePlay=()=>{if(page.hidden||!visible)pause();else{wanted=!video.paused;sync();}};
  const hidden=()=>{if(page.hidden)pause();};
  button.addEventListener('click',toggle);
  for(const event of ['play','playing'])video.addEventListener(event,nativePlay);
  for(const event of ['pause','ended','emptied','error'])video.addEventListener(event,sync);
  page.addEventListener('visibilitychange',hidden);
  if(typeof Observer==='function'){
    observer=new Observer(entries=>{for(const entry of entries)if(entry.target===video){visible=entry.isIntersecting;if(!visible)pause();}},{root:null,threshold:0});
    observer.observe(video);
  }
  sync();
  return {refresh:sync,destroy(){if(disposed)return;disposed=true;pause();observer?.disconnect();button.removeEventListener('click',toggle);page.removeEventListener('visibilitychange',hidden);for(const event of ['play','playing'])video.removeEventListener(event,nativePlay);for(const event of ['pause','ended','emptied','error'])video.removeEventListener(event,sync);}};
}
