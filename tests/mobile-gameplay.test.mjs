import test from 'node:test';
import assert from 'node:assert/strict';
import {createMobileGameplay} from '../src/mobile-gameplay.js';

const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
function fixture({unsupported=false,rejectFullscreen=false,rejectLock=false,fullGate=null,lockGate=null,existing=false}={}){
  const page=new EventTarget(),surface=new EventTarget(),calls=[],states=[];page.documentElement={};surface.innerWidth=390;surface.innerHeight=844;surface.visualViewport=new EventTarget();surface.screen={orientation:{}};
  if(existing)page.fullscreenElement={name:'external'};
  if(!unsupported){
    page.documentElement.requestFullscreen=options=>{calls.push(['fullscreen',options]);return (fullGate?.promise||Promise.resolve()).then(()=>{if(rejectFullscreen)throw Error('Not allowed');page.fullscreenElement=page.documentElement;page.dispatchEvent(new Event('fullscreenchange'));});};
    page.exitFullscreen=async()=>{calls.push(['exit']);page.fullscreenElement=null;page.dispatchEvent(new Event('fullscreenchange'));};
    surface.screen.orientation.lock=async mode=>{calls.push(['lock',mode]);if(lockGate)await lockGate.promise;if(rejectLock)throw Error('Not supported');surface.innerWidth=844;surface.innerHeight=390;surface.dispatchEvent(new Event('resize'));};
    surface.screen.orientation.unlock=()=>calls.push(['unlock']);
  }
  const controller=createMobileGameplay({window:surface,document:page,onChange:state=>states.push(state)});
  return {page,surface,calls,states,controller};
}

test('Explore requests fullscreen synchronously, then landscape, and exit restores owned native state',async()=>{
  const f=fixture(),request=f.controller.enter();assert.deepEqual(f.calls,[['fullscreen',{navigationUI:'hide'}]]);const state=await request;
  assert.deepEqual(f.calls.slice(0,2),[['fullscreen',{navigationUI:'hide'}],['lock','landscape']]);assert.deepEqual(state,{active:true,fullscreen:true,portrait:false});
  f.controller.exit();await Promise.resolve();assert.equal(f.page.fullscreenElement,null);assert.deepEqual(f.calls.slice(-2),[['unlock'],['exit']]);assert.equal(f.controller.active,false);f.controller.dispose();
});

test('unavailable APIs and denied permissions keep a playable viewport with a portrait hint state',async()=>{
  for(const options of [{unsupported:true},{rejectFullscreen:true,rejectLock:true},{rejectLock:true}]){const f=fixture(options),state=await f.controller.enter();assert.equal(state.active,true);assert.equal(state.portrait,true);assert.equal(f.controller.active,true);f.controller.dispose();}
});

test('closing while fullscreen is pending cleans up a late browser transition without locking orientation',async()=>{
  const gate=deferred(),f=fixture({fullGate:gate}),task=f.controller.enter();f.controller.exit();gate.resolve();const state=await task;assert.equal(state.active,false);assert.equal(f.page.fullscreenElement,null);assert.equal(f.calls.some(c=>c[0]==='lock'),false);f.controller.dispose();
});

test('disposing during a pending orientation lock unlocks late success and removes event listeners',async()=>{
  const gate=deferred(),f=fixture({lockGate:gate}),task=f.controller.enter();for(let i=0;i<5;i++)await Promise.resolve();assert.ok(f.calls.some(c=>c[0]==='lock'));f.controller.dispose();const count=f.states.length;gate.resolve();await task;assert.equal(f.page.fullscreenElement,null);assert.equal(f.calls.filter(c=>c[0]==='unlock').length,1);f.surface.dispatchEvent(new Event('resize'));assert.equal(f.states.length,count);
});

test('entering from an existing fullscreen view does not take ownership of its fullscreen session',async()=>{
  const f=fixture({existing:true});await f.controller.enter();f.controller.exit();assert.equal(f.calls.some(c=>c[0]==='fullscreen'||c[0]==='exit'),false);assert.equal(f.page.fullscreenElement.name,'external');f.controller.dispose();
});

test('repeated Explore gestures share one native request and reentry can reuse a pending request',async()=>{
  const gate=deferred(),f=fixture({fullGate:gate}),first=f.controller.enter();assert.equal(f.controller.enter(),first);f.controller.exit();assert.equal(f.controller.enter(),first);gate.resolve();const state=await first;assert.equal(f.calls.filter(c=>c[0]==='fullscreen').length,1);assert.equal(state.active,true);assert.equal(state.fullscreen,true);f.controller.dispose();
});

test('prefixed fullscreen with a delayed native event remains owned and exits cleanly',async()=>{
  const page=new EventTarget(),surface=new EventTarget();surface.innerWidth=390;surface.innerHeight=844;surface.screen={orientation:{}};let exitCalls=0;
  page.documentElement={webkitRequestFullscreen(){}};page.webkitExitFullscreen=()=>{exitCalls++;page.webkitFullscreenElement=null;page.dispatchEvent(new Event('webkitfullscreenchange'));};
  const controller=createMobileGameplay({window:surface,document:page});await controller.enter();controller.exit();page.webkitFullscreenElement=page.documentElement;page.dispatchEvent(new Event('webkitfullscreenchange'));assert.equal(exitCalls,1);assert.equal(page.webkitFullscreenElement,null);controller.dispose();
});
