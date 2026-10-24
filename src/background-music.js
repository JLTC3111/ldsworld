export function createBackgroundMusic({src='./assets/audio/mixkit-a-very-happy-christmas-897.mp3',enabled=true,muted=false,volume=.16,onStateChange,audioFactory=source=>new Audio(source),eventTarget=globalThis.window,documentTarget=globalThis.document}={}) {
  let audio,disposed=false,playing=false,blocked=false,generation=0,lastSnapshot='';
  try { audio=audioFactory(src);audio.loop=true;audio.preload='metadata';audio.volume=volume;audio.muted=muted; } catch { /* Browsers without audio keep usable controls. */ }
  const getState=()=>({enabled,muted,playing,blocked});
  const emit=()=>{const snapshot=getState(),key=JSON.stringify(snapshot);if(key!==lastSnapshot){lastSnapshot=key;onStateChange?.(snapshot);}};
  const wanted=()=>!disposed&&enabled&&!documentTarget?.hidden;
  function pause(){++generation;playing=false;try{audio?.pause();}catch{}emit();}
  function start(){
    if(!audio||!wanted())return Promise.resolve(false);
    if(playing)return Promise.resolve(true);
    const request=++generation;
    try{return Promise.resolve(audio.play()).then(()=>{
      if(request!==generation||!wanted()){if(!wanted())audio?.pause();return false;}
      playing=true;blocked=false;emit();return true;
    },()=>{if(request===generation&&!disposed){playing=false;blocked=true;emit();}return false;});}
    catch{blocked=true;playing=false;emit();return Promise.resolve(false);}
  }
  function gesture(event){if(event.isTrusted===false||event.ctrlKey||event.metaKey||event.altKey)return;if(enabled&&!playing)start();}
  function visibility(){if(documentTarget.hidden)pause();else if(enabled)start();}
  eventTarget?.addEventListener('pointerdown',gesture);eventTarget?.addEventListener('keydown',gesture);
  documentTarget?.addEventListener('visibilitychange',visibility);emit();
  return {
    start,getState,
    setEnabled(value){if(disposed)return;enabled=!!value;blocked=false;if(enabled)start();else pause();emit();},
    setMuted(value){if(disposed)return;muted=!!value;if(audio)audio.muted=muted;emit();},
    dispose(){if(disposed)return;disposed=true;pause();eventTarget?.removeEventListener('pointerdown',gesture);eventTarget?.removeEventListener('keydown',gesture);documentTarget?.removeEventListener('visibilitychange',visibility);try{audio?.removeAttribute('src');audio?.load();}catch{}audio=null;}
  };
}
