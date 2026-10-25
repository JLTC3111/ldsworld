import test from 'node:test';
import assert from 'node:assert/strict';
import {bindEngineUnlock} from '../src/engine-unlock.js';
class Target{
  listeners=new Map();hidden=false;
  addEventListener(type,fn){this.listeners.set(type,fn);}
  removeEventListener(type,fn){if(this.listeners.get(type)===fn)this.listeners.delete(type);}
  emit(type,event={}){this.listeners.get(type)?.({type,isTrusted:true,...event});}
}
test('driving gestures retry denied audio, restore suspended audio and retain the mute choice',async()=>{
  const events=new Target(),documentTarget=new Target();let attempts=0;
  const audio={enabled:true,unlocked:false,context:null,async resume(){attempts++;this.context||={state:'suspended'};if(attempts===1)return false;this.context.state='running';this.unlocked=true;return true;}};
  const binding=bindEngineUnlock({audio,eventTarget:events,documentTarget,isDrivingGesture:e=>e.driving===true});
  events.emit('keydown',{driving:false});events.emit('keydown',{driving:true,isTrusted:false});events.emit('keydown',{driving:true,metaKey:true});assert.equal(attempts,0);
  events.emit('keydown',{driving:true});await Promise.resolve();assert.equal(attempts,1);assert.equal(audio.unlocked,false);
  events.emit('pointerdown',{driving:true});await Promise.resolve();assert.equal(attempts,2);assert.equal(audio.unlocked,true);
  events.emit('keydown',{driving:true});assert.equal(attempts,2,'Running audio is not restarted on every key press');
  audio.context.state='suspended';documentTarget.hidden=true;documentTarget.emit('visibilitychange');assert.equal(attempts,2);
  documentTarget.hidden=false;documentTarget.emit('visibilitychange');await Promise.resolve();assert.equal(attempts,3);
  audio.enabled=false;audio.context.state='suspended';events.emit('keydown',{driving:true});documentTarget.emit('visibilitychange');assert.equal(attempts,3,'Mute never gets overridden');
  binding.dispose();assert.equal(events.listeners.size,0);assert.equal(documentTarget.listeners.size,0);
});
