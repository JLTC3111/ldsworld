import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {createBackgroundMusic} from '../src/background-music.js';
class Target{listeners=new Map();hidden=false;addEventListener(k,f){this.listeners.set(k,f);}removeEventListener(k){this.listeners.delete(k);}fire(k,event={isTrusted:true}){this.listeners.get(k)?.(event);}}
const flush=()=>new Promise(resolve=>setTimeout(resolve,0));
function fixture(){const events=new Target(),doc=new Target(),audio={muted:false,plays:0,paused:true,denied:true,play(){this.plays++;if(this.denied)return Promise.reject(Error('NotAllowedError'));this.paused=false;return Promise.resolve();},pause(){this.paused=true;},removeAttribute(){},load(){}};const player=createBackgroundMusic({eventTarget:events,documentTarget:doc,audioFactory:()=>audio});return{events,doc,audio,player};}

test('blocked autoplay unlocks on a trusted gesture; pause remains paused through later gestures and visibility',async()=>{
  const {events,doc,audio,player}=fixture();assert.equal(await player.start(),false);assert.equal(player.getState().blocked,true);
  audio.denied=false;events.fire('pointerdown');await flush();assert.equal(player.getState().playing,true);assert.equal(audio.loop,true);assert.equal(audio.volume,.16);
  player.setEnabled(false);const before=audio.plays;events.fire('keydown');doc.hidden=true;doc.fire('visibilitychange');doc.hidden=false;doc.fire('visibilitychange');await flush();assert.equal(audio.plays,before);assert.equal(audio.paused,true);
  player.setEnabled(true);await flush();player.setMuted(true);assert.equal(audio.muted,true);assert.equal(player.getState().enabled,true);doc.hidden=true;doc.fire('visibilitychange');assert.equal(audio.paused,true);doc.hidden=false;doc.fire('visibilitychange');await flush();assert.equal(player.getState().playing,true);player.dispose();assert.equal(events.listeners.size,0);assert.equal(doc.listeners.size,0);
});

test('late playback cannot restart music after disposal and disabled preferences avoid initial playback',async()=>{
  const {events,doc,audio}=fixture();audio.denied=false;let resolve;audio.play=()=>new Promise(done=>resolve=done);
  const player=createBackgroundMusic({enabled:false,eventTarget:events,documentTarget:doc,audioFactory:()=>audio});assert.equal(await player.start(),false);player.setEnabled(true);player.dispose();resolve();await flush();assert.equal(audio.paused,true);
});

test('the default soundtrack is the exact requested local Christmas recording',async()=>{
  let selectedSource;
  const audio={pause(){},removeAttribute(){},load(){}};
  const player=createBackgroundMusic({enabled:false,audioFactory:source=>{selectedSource=source;return audio;},eventTarget:new Target(),documentTarget:new Target()});
  assert.equal(selectedSource,'./assets/audio/mixkit-a-very-happy-christmas-897.mp3');
  assert.equal(audio.volume,.16);assert.equal(audio.loop,true);player.dispose();
  const bytes=await readFile(new URL('../src/assets/audio/mixkit-a-very-happy-christmas-897.mp3',import.meta.url));
  assert.equal(bytes.length,4164589);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),'714baa43f1c04e8ca77a8268825ea7e68e958917f5f5fe4c656d83811e1d0c98');
});
