/** The interface stays visible until the player explicitly hides it. */
export function createDrivingHud({document:page=globalThis.document}={}) {
  const overlays=[...page.querySelectorAll('[data-world-overlay]')];
  let hidden=false;
  function setHidden(value){
    if(hidden===value)return;
    hidden=value;page.body.classList.toggle('ui-hidden',value);
    if(value&&overlays.some(element=>element.contains(page.activeElement)))page.querySelector('#island-canvas')?.focus({preventScroll:true});
    overlays.forEach(element=>{element.inert=value;});
  }
  return {
    toggle(){setHidden(!hidden);return hidden;},
    reveal(){setHidden(false);},
    dispose(){setHidden(false);},
    get hidden(){return hidden;}
  };
}
