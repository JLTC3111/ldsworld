import test from 'node:test';
import assert from 'node:assert/strict';
import { createProjectPlayer } from '../src/project-player.js';

const settle=async()=>{for(let i=0;i<5;i++)await Promise.resolve();};
function fixture(){
  class Video extends EventTarget{paused=true;ended=false;autoplay=true;plays=0;play(){this.plays++;this.paused=false;this.dispatchEvent(new Event('play'));return this.pending||Promise.resolve();}pause(){this.paused=true;this.dispatchEvent(new Event('pause'));}}
  const video=new Video(),button=new EventTarget(),attributes={},classes=new Set(),page=new EventTarget();page.hidden=false;
  button.setAttribute=(k,v)=>attributes[k]=v;button.closest=()=>({classList:{toggle:(k,v)=>v?classes.add(k):classes.delete(k)}});
  let observer;
  class Observer{constructor(callback,options){this.callback=callback;this.options=options;observer=this;}observe(target){this.target=target;}disconnect(){this.disconnected=true;}show(value){this.callback([{target:video,isIntersecting:value}]);}}
  const controller=createProjectPlayer({container:{querySelector:s=>s.startsWith('video')?video:button},label:playing=>playing?'Pause video':'Play video',document:page,IntersectionObserver:Observer});
  return {video,button,attributes,classes,page,observer,controller,click(){button.dispatchEvent(new Event('click'));},hide(value){page.hidden=value;page.dispatchEvent(new Event('visibilitychange'));}};
}
test('the centered button starts paused, then controls native playback and its accessible label',async()=>{
  const f=fixture();assert.equal(f.video.autoplay,false);assert.equal(f.video.plays,0);assert.equal(f.attributes['aria-label'],'Play video');
  f.click();await settle();assert.equal(f.video.paused,false);assert.equal(f.attributes['aria-label'],'Pause video');assert.ok(f.classes.has('video-playing'));
  f.click();assert.equal(f.video.paused,true);assert.equal(f.attributes['aria-pressed'],'false');f.controller.destroy();
});
test('scrolling away pauses the player and returning never resumes it',async()=>{
  const f=fixture();f.click();await settle();f.observer.show(false);assert.equal(f.video.paused,true);
  f.observer.show(true);f.controller.refresh();await settle();assert.equal(f.video.plays,1);assert.equal(f.video.paused,true);
  f.click();await settle();assert.equal(f.video.plays,2);assert.equal(f.video.paused,false);f.controller.destroy();
});
test('returning to the tab or updating its label cannot restart the video',async()=>{
  const f=fixture();await f.video.play();f.hide(true);assert.equal(f.video.paused,true);f.hide(false);f.controller.refresh();await settle();assert.equal(f.video.plays,1);assert.equal(f.video.paused,true);f.controller.destroy();
});
test('a late play promise cannot override scrolling away or closing the detail',async()=>{
  for(const close of [false,true]){
    const f=fixture();let resolve;f.video.pending=new Promise(r=>resolve=r);f.click();
    if(close)f.controller.destroy();else{f.observer.show(false);f.observer.show(true);}
    resolve();await settle();assert.equal(f.video.paused,true);assert.equal(f.video.plays,1);if(!close)f.controller.destroy();assert.equal(f.observer.disconnected,true);
  }
});
test('an older play promise cannot pause a newer explicit play request',async()=>{
  const f=fixture();let first,second;f.video.pending=new Promise(resolve=>first=resolve);f.click();f.click();
  f.video.pending=new Promise(resolve=>second=resolve);f.click();first();await settle();assert.equal(f.video.paused,false);second();await settle();assert.equal(f.video.paused,false);assert.equal(f.video.plays,2);f.controller.destroy();
});
