/** End an entered driving session only after movement settles with both thumbs released. */
export function createMobileDrivingSession({onStop=()=>{}}={}){
  let active=false,held=false,moved=false,stoppedFor=0,notified=false,disposed=false;
  return {
    setActive(value){
      value=Boolean(value);if(disposed||value===active)return;
      active=value;moved=false;stoppedFor=0;notified=false;
      if(!active)held=false;
    },
    setHeld(value){if(disposed)return;held=Boolean(value);if(held)stoppedFor=0;},
    updateMotion({speed=0,hop=0,airborne=false,paused=false,dt=0}={}){
      if(disposed||!active||notified||paused)return;
      const velocity=Math.abs(Number(speed)||0),offGround=Boolean(airborne)||hop>.015;
      if(velocity>.035||offGround){moved=true;stoppedFor=0;return;}
      if(held||velocity>.015){stoppedFor=0;return;}
      if(!moved)return;
      stoppedFor+=Math.max(0,Math.min(.1,Number(dt)||0));
      if(stoppedFor>=.35){notified=true;onStop();}
    },
    dispose(){disposed=true;active=false;held=false;moved=false;stoppedFor=0;}
  };
}
