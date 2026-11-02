// Hardware hints are optional: an unknown device starts balanced and can adapt
// from observed frame times instead of relying on a mobile user-agent string.
export function deviceBudget({hardwareConcurrency,deviceMemory,saveData=false,coarse=false,reducedMotion=false}={}) {
  const lowPower = !!saveData || hardwareConcurrency > 0 && hardwareConcurrency <= 4 || deviceMemory > 0 && deviceMemory <= 4;
  return {lowPower,maxPixelRatio:lowPower?1:coarse?1.25:1.5,maxPixels:lowPower?900000:coarse?1500000:2400000,shadowSize:lowPower?512:1024,maxFps:lowPower||reducedMotion?30:60};
}

export function pixelRatioFor(width,height,dpr,budget) {
  const area = Math.max(1,width)*Math.max(1,height);
  return Math.min(Math.max(.1,dpr||1),budget.maxPixelRatio,Math.sqrt(budget.maxPixels/area));
}

// Downgrade only after sustained slow rendering. Ignore pauses/loading spikes,
// and never alternate quality levels when a device sits near a threshold.
export function createAdaptiveBudget(initial) {
  let budget={...initial},elapsed=0,samples=0,slow=0,level=0;
  return {
    get current(){return budget;},
    reset(){elapsed=0;samples=0;slow=0;},
    sample(milliseconds){
      if(!Number.isFinite(milliseconds)||milliseconds<=0)return false;
      // A compilation/loading stall gets one vote rather than dominating the
      // window. Sustained very slow frames must still trigger adaptation.
      milliseconds=Math.min(milliseconds,100);
      elapsed+=milliseconds;samples++;if(milliseconds>1000/budget.maxFps*1.4)slow++;
      if(elapsed<2500||samples<30)return false;
      const degrade=slow/samples>.65&&level<2;
      elapsed=0;samples=0;slow=0;
      if(!degrade)return false;
      level++;
      budget={...budget,maxPixelRatio:budget.maxPixelRatio*.8,maxPixels:Math.round(budget.maxPixels*.64),shadowSize:512,maxFps:level===2?30:budget.maxFps};
      return true;
    }
  };
}

// A single queued frame supports continuous play and demand rendering while
// paused. Resuming never advances the simulation by time spent behind a panel.
export function createRenderLoop({frame,maxFps=()=>60,request=requestAnimationFrame,cancel=cancelAnimationFrame,now=()=>performance.now()}) {
  let pending=null,paused=false,visible=true,disposed=false,dirty=true,last=now();
  function invalidate(){dirty=true;schedule();}
  function schedule(){if(!disposed&&visible&&pending===null)pending=request(tick);}
  function tick(time){
    pending=null;if(disposed||!visible)return;
    const milliseconds=time-last;
    if(!dirty&&milliseconds<1000/maxFps()-.5){schedule();return;}
    last=time;dirty=false;
    frame(time,paused?0:Math.min(Math.max(0,milliseconds)/1000,.05),milliseconds);
    if(!paused)schedule();
  }
  return {
    invalidate,
    setPaused(value){if(paused===!!value)return;paused=!!value;last=now();invalidate();},
    setVisible(value){visible=!!value;if(pending!==null){cancel(pending);pending=null;}last=now();if(visible)invalidate();},
    dispose(){disposed=true;if(pending!==null)cancel(pending);pending=null;}
  };
}
