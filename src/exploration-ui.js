/** Explicit exploration hides only the introduction; Escape still owns all UI. */
export function createExplorationUI({ hero, badge, focusSurface, setTimer=setTimeout, clearTimer=clearTimeout } = {}) {
  let timer=null, exploring=false, touring=false, expired=false;
  let heroHidden=false, moved=false, stoppedFor=0;
  const renderBadge=()=>{ badge.hidden=!exploring || expired && !touring; };
  function showHero() {
    heroHidden=false; moved=false; stoppedFor=0;
    hero.classList.remove('hero-driving'); hero.inert=hero.ownerDocument.body.classList.contains('ui-hidden');
  }
  return {
    setStatus(next) {
      if (next.exploring !== exploring) {
        exploring=next.exploring; expired=false; clearTimer(timer); timer=null;
        if (exploring) timer=setTimer(()=>{ expired=true; timer=null; renderBadge(); },10000);
      }
      touring=next.touring; renderBadge();
    },
    explore() {
      heroHidden=true; moved=false; stoppedFor=0;
      if (hero.contains(hero.ownerDocument.activeElement)) focusSurface?.();
      hero.classList.add('hero-driving'); hero.inert=true;
    },
    updateMotion({ speed=0, airborne=false, hop=0, paused=false, dt=0 }={}) {
      if (!heroHidden || paused) return;
      const moving=Math.abs(speed)>.035 || airborne || hop>.015;
      if (moving) { moved=true; stoppedFor=0; }
      else if (moved) {
        stoppedFor+=Math.max(0,Math.min(.1,dt));
        if (stoppedFor>=.35) showHero();
      }
    },
    revealHero:showHero,
    reset() { showHero(); this.setStatus({exploring:false,touring:false}); },
    dispose() { clearTimer(timer); showHero(); },
    get heroHidden() { return heroHidden; }
  };
}
