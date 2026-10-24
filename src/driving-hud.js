/** Fade the page chrome while driving; keep the canvas and scene fully interactive. */
export function createDrivingHud({document:page=globalThis.document}={}) {
  const overlays=[...page.querySelectorAll('[data-world-overlay]')];
  let hidden=false,idleTime=0,revealed=false;
  function setHidden(value){
    if(hidden===value)return;
    hidden=value;page.body.classList.toggle('is-driving',value);
    if(value&&overlays.some(element=>element.contains(page.activeElement)))page.querySelector('#island-canvas')?.focus({preventScroll:true});
    overlays.forEach(element=>{element.inert=value;});
  }
  return {
    update({speed=0,hop=0,elapsed=1/60,paused=false,panelOpen=false}={}){
      if(paused||panelOpen){idleTime=0;revealed=false;setHidden(false);return;}
      const moving=Math.abs(speed)>.18||hop>.04;
      if(moving){idleTime=0;if(!revealed)setHidden(true);}
      else {idleTime+=Math.max(0,Math.min(.1,elapsed));if(idleTime>=.55){revealed=false;setHidden(false);}}
    },
    engage(){revealed=false;idleTime=0;},
    reveal(){revealed=true;idleTime=0;setHidden(false);},
    dispose(){revealed=false;setHidden(false);},
    get hidden(){return hidden;}
  };
}
