import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';

const component=new URL('../components/react-bits/Topography.jsx',import.meta.url);
const bundle=await build({stdin:{contents:(await readFile(component,'utf8')).replace("import { useEffect, useRef, useState } from 'react';","const {useEffect,useRef,useState}=globalThis.__topographyHooks;"),resolveDir:fileURLToPath(new URL('.',component)),loader:'jsx'},bundle:true,write:false,platform:'node',format:'esm',jsx:'automatic',loader:{'.css':'empty'},define:{'process.env.NODE_ENV':'"production"'}});

test('the real contour engine respects pixel/frame budgets and static contours stop drawing',async()=>{
  const names=['__topographyHooks','window','document','ResizeObserver','IntersectionObserver','requestAnimationFrame','cancelAnimationFrame'];
  const saved=new Map(names.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
  const define=(name,value)=>Object.defineProperty(globalThis,name,{configurable:true,value,writable:true});
  let cleanup;
  try{
    for(const lowPower of [true,false]){
      let draws=0,sequence=0,time=0,constant=0;const frames=new Map(),effects=[],observers=[];
      const gl=new Proxy({
        getExtension:name=>name==='EXT_color_buffer_float'?{}:{loseContext(){}},
        getShaderParameter:()=>true,getProgramParameter:(_,parameter)=>parameter===gl.LINK_STATUS,
        getActiveUniform:()=>null,drawArrays(){draws++;},drawArraysInstanced(){draws++;}
      },{get(target,name){if(name in target)return target[name];if(/^[A-Z_0-9]+$/.test(name))return target[name]=++constant;return target[name]=name.startsWith('create')?()=>({}):()=>{};}});
      const canvas=Object.assign(new EventTarget(),{getContext:()=>gl});
      const container=Object.assign(new EventTarget(),{clientWidth:1400,clientHeight:1000,getBoundingClientRect:()=>({left:0,top:0,width:1400,height:1000})});
      const refs=[{current:container},{current:canvas},{current:null}];
      define('__topographyHooks',{useRef:initial=>refs.shift()||{current:initial},useState:()=>[0,()=>{}],useEffect:callback=>effects.push(callback)});
      define('window',Object.assign(new EventTarget(),{devicePixelRatio:3,matchMedia:()=>({matches:false})}));
      define('document',Object.assign(new EventTarget(),{hidden:false,documentElement:new EventTarget()}));
      class Observer {constructor(callback){this.callback=callback;observers.push(this);}observe(){}disconnect(){}}
      class Intersection extends Observer {observe(){this.callback([{isIntersecting:true}]);}}
      define('ResizeObserver',Observer);define('IntersectionObserver',Intersection);
      define('requestAnimationFrame',callback=>{const id=++sequence;frames.set(id,callback);return id;});define('cancelAnimationFrame',id=>frames.delete(id));
      // A distinct module instance reads the current hook fixture each time.
      const {default:Topography}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text+`\n// ${lowPower}`).toString('base64'));
      Topography({intro:false,speed:lowPower?0:.25,morph:lowPower?0:.2,glow:lowPower?0:.6,depthOfField:lowPower?0:.4,dpr:lowPower?1:1.5,maxCanvasPixels:lowPower?300000:600000,maxFps:30});
      cleanup=effects[0]();assert.equal(typeof cleanup,'function');
      assert.ok(canvas.width*canvas.height<=(lowPower?300000:600000),'Large panel canvases remain within their pixel budget');
      const passes=lowPower?2:16;assert.equal(draws,passes,'Static low-power contours skip the bloom terrain, blur and composite passes');
      const advance=count=>{for(let i=0;i<count;i++){const batch=[...frames.values()];frames.clear();time+=1000/120;batch.forEach(callback=>callback(time));}};
      const before=draws;advance(240);
      assert.ok((draws-before)/passes<=61,'120Hz callbacks render at most 30fps');
      if(lowPower){advance(600);assert.equal(frames.size,0,'Static contours release their animation loop once settled');}
      else assert.equal(frames.size,1,'Authored moving contours remain animated');
      document.hidden=true;document.dispatchEvent(new Event('visibilitychange'));assert.equal(frames.size,0);
      document.hidden=false;document.dispatchEvent(new Event('visibilitychange'));assert.equal(frames.size,1);
      observers.find(observer=>observer instanceof Intersection).callback([{isIntersecting:false}]);assert.equal(frames.size,0);
      cleanup();cleanup=null;assert.equal(frames.size,0);
    }
  }finally{cleanup?.();for(const[name,descriptor]of saved){if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}}
});
