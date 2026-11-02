// Two CSS layers supply precipitation without particles, pointer listeners,
// animation callbacks or another graphics context.
export function createWeatherOverlay({container,reducedMotion=false,document:page=container?.ownerDocument||globalThis.document}={}){
  if(!container||!page?.createElement)return {update(){},dispose(){}};
  const root=page.createElement('div');root.className='weather-overlay';
  root.setAttribute('aria-hidden','true');root.dataset.reducedMotion=String(reducedMotion);
  container.append(root);
  let disposed=false,state={weather:'clear',night:0,paused:false};
  function update(next={}){
    if(disposed)return;
    state={...state,...next};
    const weather=['rain','snow'].includes(state.weather)?state.weather:'clear';
    const values={weather,night:String(state.night>.5),paused:String(state.paused||!!page.hidden)};
    for(const [key,value]of Object.entries(values))if(root.dataset[key]!==value)root.dataset[key]=value;
    const hidden=weather==='clear';if(root.hidden!==hidden)root.hidden=hidden;
  }
  const visibility=()=>update();page.addEventListener('visibilitychange',visibility);update();
  return {update,dispose(){if(disposed)return;disposed=true;page.removeEventListener('visibilitychange',visibility);root.remove();}};
}
