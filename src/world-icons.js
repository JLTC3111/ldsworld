import {lucideWorldPaths,weatherMorphPaths,weatherMorphSource} from './vendor/lucide-world-paths.js';

const svg=content=>`<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${content}</svg>`;
const paths=values=>values.map(d=>`<path d="${d||''}"/>`).join('');
const sunMotion=mode=>{
  const distance=mode==='sunrise'?2.8:-2.8;
  return `<animateTransform attributeName="transform" type="translate" values="0 ${distance};0 0;0 ${-distance};0 ${distance};0 ${distance}" keyTimes="0;.45;.8;.9;1" calcMode="spline" keySplines=".42 0 .58 1;.42 0 .58 1;.42 0 .58 1;.42 0 .58 1" dur="3.6s" repeatCount="indefinite" begin="indefinite"/><animate attributeName="opacity" values=".3;1;1;0;0;.3" keyTimes="0;.2;.65;.8;.9;1" dur="3.6s" repeatCount="indefinite" begin="indefinite"/>`;
};

/** Exact local Lucide artwork; an empty result lets other options keep their glyph. */
export function worldOptionIcon(mode,kind='time'){
  if(kind==='weather'&&mode==='auto')return `<span class="world-option-icon world-option-icon--weather" data-weather-morph aria-hidden="true">${svg(paths(weatherMorphSource))}</span>`;
  if(kind==='weather'&&mode==='clear')return `<span class="world-option-icon world-option-icon--cloud-sun" aria-hidden="true">${svg(paths(lucideWorldPaths.cloudSun))}</span>`;
  if(kind==='time'&&mode==='day')return `<span class="world-option-icon world-option-icon--day" aria-hidden="true">${svg('<circle cx="12" cy="12" r="4"/>'+paths(lucideWorldPaths.sun))}</span>`;
  if(kind!=='time'||!['sunrise','sunset'].includes(mode))return '';
  const data=lucideWorldPaths[mode];
  return `<span class="world-option-icon world-option-icon--${mode}" aria-hidden="true">${svg(paths([data[0],data[5],data[6]])+`<g class="world-icon-sun">${paths([data[1],data[2],data[3],data[4],data[7]])+sunMotion(mode)}</g>`)}</span>`;
}

/** Match cubic commands before interpolating, rather than crossfading drawings. */
export function weatherMorphPathData(progress){
  const amount=Math.max(0,Math.min(1,Number(progress)||0));
  if(amount===0)return weatherMorphSource.map(d=>d||'');
  if(amount===1)return [...lucideWorldPaths.sunSnow];
  return weatherMorphPaths.map(([from,to])=>{
    const values=from.map((value,i)=>Math.round((value+(to[i]-value)*amount)*10000)/10000);
    return `M${values[0]} ${values[1]} C${values.slice(2).join(' ')}`;
  });
}

/** Mount only for the World panel. Held endpoints use no frame loop. */
export function mountWorldIcons(root,{
  documentTarget=globalThis.document,motionMedia=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)'),
  Observer=globalThis.IntersectionObserver,request=globalThis.requestAnimationFrame,cancel=globalThis.cancelAnimationFrame,
  scheduler=globalThis,now=()=>performance.now()
}={}){
  const icons=[...root.querySelectorAll('.world-option-icon')],visible=new Set(icons);
  const weather=icons.filter(icon=>icon.hasAttribute('data-weather-morph')).map(icon=>({icon,paths:[...icon.querySelectorAll('path')]}));
  const native=icons.map(icon=>({icon,svg:icon.querySelector?.('svg'),animations:[...icon.querySelectorAll('animateTransform,animate')],started:false})).filter(item=>item.animations.length);
  let disposed=false,timer=null,frame=null,side=0,started=0,lastDraw=0;
  const canAnimate=()=>!disposed&&!documentTarget?.hidden&&!motionMedia?.matches&&root.isConnected!==false;
  const weatherActive=()=>canAnimate()&&weather.some(({icon})=>visible.has(icon));
  function draw(amount){
    const values=weatherMorphPathData(amount);
    for(const item of weather)for(const [i,path]of item.paths.entries()){
      path.setAttribute('d',values[i]||'');
      // New branches grow from collapsed curves. Fade just those branches so
      // round line caps cannot pop into view as full-size dots at the start.
      path.setAttribute('opacity',weatherMorphSource[i]?'1':String(amount));
    }
  }
  function hold(){if(weatherActive()&&timer===null&&frame===null)timer=scheduler.setTimeout(begin,120);}
  function begin(){timer=null;if(!weatherActive())return;started=now();lastDraw=-Infinity;frame=request(tick);}
  function tick(time){
    frame=null;if(!weatherActive())return;
    const fraction=Math.max(0,Math.min(1,(time-started)/1800));
    if(time-lastDraw>=1000/30||fraction===1){
      const eased=(1-Math.cos(Math.PI*fraction))/2;
      draw(side===0?eased:1-eased);lastDraw=time;
    }
    if(fraction===1){side=1-side;hold();}else frame=request(tick);
  }
  function stop(){
    const moving=frame!==null;
    if(timer!==null)scheduler.clearTimeout(timer);if(frame!==null)cancel(frame);
    timer=frame=null;if(moving)draw(side);
  }
  function update(){
    const active=canAnimate();
    for(const icon of icons)icon.classList.toggle('world-icon-running',active&&visible.has(icon));
    for(const item of native){
      if(active&&visible.has(item.icon)){
        if(!item.started){for(const animation of item.animations)animation.beginElement?.();item.started=true;}
        item.svg?.unpauseAnimations?.();
      }else{
        item.svg?.pauseAnimations?.();
        if(motionMedia?.matches){for(const animation of item.animations)animation.endElement?.();item.started=false;}
      }
    }
    // Start visibly moving on entry; brief endpoint holds let both original
    // drawings read clearly without making the icon appear static.
    if(weatherActive()){if(frame===null&&timer===null)begin();}else {stop();if(motionMedia?.matches){side=0;draw(0);}}
  }
  const observer=Observer?new Observer(entries=>{for(const entry of entries)entry.isIntersecting?visible.add(entry.target):visible.delete(entry.target);update();}):null;
  for(const icon of icons)observer?.observe(icon);
  documentTarget?.addEventListener('visibilitychange',update);motionMedia?.addEventListener?.('change',update);update();
  return {dispose(){if(disposed)return;disposed=true;stop();observer?.disconnect();documentTarget?.removeEventListener('visibilitychange',update);motionMedia?.removeEventListener?.('change',update);for(const item of native){item.svg?.pauseAnimations?.();for(const animation of item.animations)animation.endElement?.();}for(const icon of icons)icon.classList.remove('world-icon-running');}};
}
