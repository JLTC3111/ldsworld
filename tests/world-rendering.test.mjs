import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

class Surface extends EventTarget {
  style={};classList={add(){},remove(){}};
  setAttribute(){}focus(){}remove(){this.removed=true;}
  getBoundingClientRect(){return {left:0,top:0,width:1920,height:1080};}
  getContext(){return {fillRect(){},fillText(){},measureText:text=>({width:text.length*10})};}
}

test('the real world drains paused frames, redraws changed settings once, and suspends hidden tabs',async t=>{
  let renderer,clock=0,serial=0,world;const queue=new Map(),frames=[];
  class Renderer {
    constructor(options){renderer=this;this.options=options;this.shadowMap={};this.domElement=new Surface();this.renders=0;}
    setPixelRatio(value){this.ratio=value;}getPixelRatio(){return this.ratio;}
    setSize(width,height){this.width=width;this.height=height;}
    getSize(target){return target.set(this.width,this.height);}
    render(scene,camera){scene.updateMatrixWorld(true);camera.updateMatrixWorld();this.scene=scene;this.renders++;}
    dispose(){this.disposed=true;}
  }
  const windowTarget=new EventTarget(),documentTarget=new EventTarget();
  documentTarget.hidden=false;documentTarget.createElement=()=>new Surface();
  const globals={
    __worldTestRenderer:Renderer,window:windowTarget,document:documentTarget,
    navigator:{hardwareConcurrency:4,deviceMemory:4},innerWidth:1920,innerHeight:1080,devicePixelRatio:2,
    matchMedia:()=>({matches:false}),performance:{now:()=>clock},
    requestAnimationFrame:callback=>{queue.set(++serial,callback);return serial;},
    cancelAnimationFrame:id=>queue.delete(id)
  };
  const originals=new Map(Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  for(const [key,value]of Object.entries(globals))Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
  function tick(milliseconds=34){clock+=milliseconds;const pending=[...queue.values()];queue.clear();for(const callback of pending)callback(clock);}
  function visibility(hidden){documentTarget.hidden=hidden;documentTarget.dispatchEvent(new Event('visibilitychange'));}
  try{
    // Substitute only WebGLRenderer: geometry, scenery, atmosphere, physics,
    // controllers and the render-budget integration all use production code.
    const location=new URL('../src/world.js',import.meta.url);
    let source=await readFile(location,'utf8');
    source=source.replace("import * as THREE from './vendor/three.module.js';",`import * as VENDOR from '${new URL('./vendor/three.module.js',location).href}';const THREE={...VENDOR,WebGLRenderer:globalThis.__worldTestRenderer};`)
      .replace(/from (['"])(\.\/[^'"]+)\1/g,(_,quote,path)=>`from ${quote}${new URL(path,location).href}${quote}`);
    const {createWorld}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
    const container=new Surface();container.prepend=()=>{};
    world=createWorld({container,onFrame:frame=>frames.push(frame)});
    assert.equal(renderer.renders,1);assert.equal(queue.size,1);
    assert.equal(renderer.options.antialias,false);assert.equal(renderer.options.powerPreference,'low-power');
    assert.ok(renderer.width*renderer.height*renderer.ratio**2<=900001,'low-spec drawing buffer obeys its pixel budget');
    const inventory={meshes:0,instancedMeshes:0,shadowCasters:0};
    renderer.scene.traverse(object=>{if(object.isMesh)inventory.meshes++;if(object.isInstancedMesh)inventory.instancedMeshes++;if(object.castShadow)inventory.shadowCasters++;});
    assert.ok(inventory.meshes>1000,'the complete island is present');t.diagnostic(`Scene inventory: ${JSON.stringify(inventory)}`);

    tick();assert.equal(queue.size,1,'active world keeps one frame queued');
    world.setPaused(true);const pausedRenders=renderer.renders;tick();
    assert.equal(renderer.renders,pausedRenders+1);assert.equal(frames.at(-1).elapsed,0);assert.equal(queue.size,0,'paused world has no background RAF');
    for(const change of [()=>world.setWeather('rain'),()=>world.setHeadlightsMode('on'),()=>windowTarget.dispatchEvent(new Event('resize'))]){
      const before=renderer.renders;change();assert.equal(queue.size,1);tick();
      assert.equal(renderer.renders,before+1);assert.equal(queue.size,0);assert.equal(frames.at(-1).paused,true);assert.equal(frames.at(-1).elapsed,0);
    }
    assert.equal(world.getEnvironment().weather,'rain');
    world.setWeather('snow');world.setHeadlightsMode('off');world.setLanguage('vi');
    assert.equal(queue.size,1,'multiple invalidations share a frame');tick();assert.equal(queue.size,0);
    world.setPaused(true);assert.equal(queue.size,0,'repeated pause does not create work');

    world.setPaused(false);tick();assert.equal(queue.size,1);assert.equal(frames.at(-1).paused,false);
    visibility(true);assert.equal(queue.size,0);const hiddenRenders=renderer.renders;
    clock+=60000;world.setWeather('clear');world.resetCamera();assert.equal(queue.size,0,'settings do not render a hidden tab');
    assert.equal(renderer.renders,hiddenRenders);
    visibility(false);assert.equal(queue.size,1);tick();assert.equal(queue.size,1);
    assert.ok(frames.at(-1).elapsed<=.05,'resume does not simulate the hidden minute');
    world.dispose();world=null;assert.equal(queue.size,0);assert.equal(renderer.disposed,true);assert.equal(renderer.domElement.removed,true);
    windowTarget.dispatchEvent(new Event('resize'));visibility(false);assert.equal(queue.size,0,'disposal removes frame-producing listeners');
  }finally{
    world?.dispose();
    for(const [key,descriptor]of originals)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];
  }
});
