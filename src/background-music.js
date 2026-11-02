export function createBackgroundMusic({src='./assets/audio/mixkit-a-very-happy-christmas-897.mp3',enabled=true,muted=false,volume=.16,onStateChange,audioFactory=source=>new Audio(source),eventTarget=globalThis.window,documentTarget=globalThis.document,activationTarget=globalThis.navigator?.userActivation}={}) {
  let audio,disposed=false,playing=false,blocked=false,generation=0,lastSnapshot='';
  const getState=()=>({enabled,muted,playing,blocked});
  const emit=()=>{const snapshot=getState(),key=JSON.stringify(snapshot);if(key!==lastSnapshot){lastSnapshot=key;onStateChange?.(snapshot);}};
  const wanted=()=>!disposed&&enabled&&!documentTarget?.hidden;
  function pause(){++generation;playing=false;try{audio?.pause();}catch{}emit();}
  function start(explicit=false){
    if(!wanted())return Promise.resolve(false);
    // Do not fetch a multi-megabyte soundtrack just to discover that the
    // browser requires user activation. Explicit controls still start it.
    if(!explicit&&activationTarget&&!activationTarget.hasBeenActive&&!activationTarget.isActive){blocked=true;emit();return Promise.resolve(false);}
    if(!audio)try { audio=audioFactory(src);audio.loop=true;audio.preload='none';audio.volume=volume;audio.muted=muted; } catch { return Promise.resolve(false); }
    if(playing)return Promise.resolve(true);
    const request=++generation;
    try{return Promise.resolve(audio.play()).then(()=>{
      if(request!==generation||!wanted()){if(!wanted())audio?.pause();return false;}
      playing=true;blocked=false;emit();return true;
    },()=>{if(request===generation&&!disposed){playing=false;blocked=true;emit();}return false;});}
    catch{blocked=true;playing=false;emit();return Promise.resolve(false);}
  }
  function gesture(event){if(event.isTrusted===false||event.ctrlKey||event.metaKey||event.altKey)return;if(enabled&&!playing)start(true);}
  function visibility(){if(documentTarget.hidden)pause();else if(enabled)start();}
  eventTarget?.addEventListener('pointerdown',gesture);eventTarget?.addEventListener('keydown',gesture);
  documentTarget?.addEventListener('visibilitychange',visibility);emit();
  return {
    start,getState,
    setEnabled(value){if(disposed)return;enabled=!!value;blocked=false;if(enabled)start(true);else pause();emit();},
    setMuted(value){if(disposed)return;muted=!!value;if(audio)audio.muted=muted;emit();},
    dispose(){if(disposed)return;disposed=true;pause();eventTarget?.removeEventListener('pointerdown',gesture);eventTarget?.removeEventListener('keydown',gesture);documentTarget?.removeEventListener('visibilitychange',visibility);try{audio?.removeAttribute('src');audio?.load();}catch{}audio=null;}
  };
}
