// The dialog uses its vector map immediately. A single background capture is
// shared by every opening, language, category and zoom level.
export function createMapAtlas({capture,createURL=blob=>URL.createObjectURL(blob),revokeURL=url=>URL.revokeObjectURL(url)}={}){
  let image='',pending=null,revision=0,captured=-1,disposed=false;
  return {
    getImage:()=>image,
    invalidate(){revision++;},
    capture(){
      if(disposed)return Promise.resolve('');
      if(pending)return pending;
      if(image&&captured===revision)return Promise.resolve(image);
      const version=revision;
      pending=Promise.resolve().then(capture).then(blob=>{
        if(!blob||disposed)return image;
        const next=createURL(blob),previous=image;image=next;captured=version;
        if(previous)revokeURL(previous);return image;
      }).catch(()=>image).finally(()=>{pending=null;});
      return pending;
    },
    dispose(){if(disposed)return;disposed=true;if(image)revokeURL(image);image='';}
  };
}

export async function encodeMapBitmap(bitmap,{width=1024,height,canvas=typeof OffscreenCanvas==='function'?new OffscreenCanvas(width,height):document.createElement('canvas')}={}){
  try{
    canvas.width=width;canvas.height=height;
    const context=canvas.getContext('2d');if(!context)return null;
    context.drawImage(bitmap,0,0,width,height);
    if(canvas.convertToBlob)return await canvas.convertToBlob({type:'image/webp',quality:.86});
    return await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',.86));
  }finally{bitmap.close?.();}
}

// Two frames let the modal paint before any optional WebGL work starts.
export function createMapPreview({request=requestAnimationFrame,cancel=cancelAnimationFrame,capture,show,isActive}={}){
  let frame=null,generation=0,disposed=false;
  function clear(){generation++;if(frame!==null)cancel(frame);frame=null;}
  return {
    refresh(){
      clear();if(disposed)return;const token=generation;
      frame=request(()=>{frame=request(async()=>{
        frame=null;if(disposed||token!==generation||!isActive())return;
        try{const image=await capture();if(image&&!disposed&&token===generation&&isActive())show(image);}catch{/* The vector map remains usable. */}
      });});
    },
    clear,
    dispose(){disposed=true;clear();}
  };
}
