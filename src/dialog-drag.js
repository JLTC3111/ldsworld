const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

// Move the dialog itself. Its reader and native media controls keep their own
// scrolling/selection, and header buttons never start a drag.
export function createDialogDrag({dialog,handle,keyboardHandle=handle,viewport=globalThis.window}){
  let offset={x:0,y:0},drag=null;
  const bounds=()=>{const rect=dialog.getBoundingClientRect();return {left:rect.left-offset.x,top:rect.top-offset.y,width:rect.width,height:rect.height};};
  function move(x,y,base=bounds()){
    const gutter=8,width=viewport.innerWidth,height=viewport.innerHeight;
    offset={x:clamp(x,gutter-base.left,Math.max(gutter,width-base.width-gutter)-base.left),y:clamp(y,gutter-base.top,Math.max(gutter,height-base.height-gutter)-base.top)};
    dialog.style.translate=`${offset.x}px ${offset.y}px`;
  }
  function finish(event){
    if(!drag||event&&event.pointerId!==drag.id)return;
    const id=drag.id;drag=null;dialog.classList.remove('is-dragging');
    try{if(handle.hasPointerCapture?.(id))handle.releasePointerCapture(id);}catch{}
  }
  function down(event){
    if(!dialog.open||event.button!==0||drag||event.target.closest?.('button,a,input,select,textarea'))return;
    event.preventDefault();dialog.classList.add('is-dragging');
    drag={id:event.pointerId,x:event.clientX,y:event.clientY,start:{...offset},base:bounds()};
    try{handle.setPointerCapture(event.pointerId);}catch{}
  }
  function pointerMove(event){
    if(!drag||event.pointerId!==drag.id)return;
    event.preventDefault();move(drag.start.x+event.clientX-drag.x,drag.start.y+event.clientY-drag.y,drag.base);
  }
  function keyDown(event){
    if(!dialog.open||event.target!==keyboardHandle||event.ctrlKey||event.metaKey||event.altKey)return;
    const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[event.key];
    if(delta){event.preventDefault();const step=event.shiftKey?40:12;move(offset.x+delta[0]*step,offset.y+delta[1]*step);}
    if(event.key==='Home'){event.preventDefault();reset();}
  }
  function reset(){finish();offset={x:0,y:0};dialog.style.translate='';}
  const resize=()=>{if(dialog.open){finish();move(offset.x,offset.y);}};
  const listeners={pointerdown:down,pointermove:pointerMove,pointerup:finish,pointercancel:finish,lostpointercapture:finish};
  for(const [type,listener]of Object.entries(listeners))handle.addEventListener(type,listener);
  keyboardHandle.addEventListener('keydown',keyDown);viewport.addEventListener('resize',resize);dialog.addEventListener('close',reset);
  return {reset,dispose(){reset();for(const [type,listener]of Object.entries(listeners))handle.removeEventListener(type,listener);keyboardHandle.removeEventListener('keydown',keyDown);viewport.removeEventListener('resize',resize);dialog.removeEventListener('close',reset);}};
}
