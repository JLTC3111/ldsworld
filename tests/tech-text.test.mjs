import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createTechText} from '../src/tech-text.js';

function fixture({reduced=false,canvas=true}={}) {
  const descriptors=new Map(),names=['window','document','getComputedStyle','ResizeObserver','IntersectionObserver','MutationObserver','requestAnimationFrame','cancelAnimationFrame','MouseEvent'];
  names.forEach(name=>descriptors.set(name,Object.getOwnPropertyDescriptor(globalThis,name)));
  let ink='#292929',tick=performance.now(),sequence=0;const raf=new Map(),observers=[],canvases=[];
  class Element extends EventTarget {
    children=[];style={};classes=new Set();clientWidth=80;clientHeight=32;parent=null;
    classList={add:value=>this.classes.add(value),remove:value=>this.classes.delete(value),contains:value=>this.classes.has(value)};
    setAttribute(){}append(child){this.children.push(child);child.parent=this;}remove(){if(this.parent)this.parent.children=this.parent.children.filter(c=>c!==this);}
    getBoundingClientRect(){return{left:0,top:0,width:this.clientWidth,height:this.clientHeight};}
    querySelector(selector){return selector==='.tech-text-fallback'?this.fallback:null;}
    closest(){return this.anchor;}
  }
  function context(){return{font:'21px sans-serif',letterSpacing:'0px',fillStyle:'#000000',strokeStyle:'#000000',globalAlpha:1,draws:[],strokes:[],rectangles:0,
    measureText(text){const size=Number(/([\d.]+)px/.exec(this.font)?.[1]||21),width=text.length*size*.52;return{width,actualBoundingBoxLeft:0,actualBoundingBoxRight:width,actualBoundingBoxAscent:size*.72,actualBoundingBoxDescent:/[gpqy]/.test(text)?size*.2:0};},
    fillText(){},strokeText(text){this.strokes.push({text,color:this.strokeStyle});},drawImage(image){this.draws.push(image);},rect(){this.rectangles++;},setTransform(){},setLineDash(){},clearRect(){},fillRect(){},strokeRect(){},save(){},restore(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},fill(){},clip(){},getImageData(){return{data:new Uint8Array()};},createRadialGradient(){return{addColorStop(){}};}};}
  const anchor=new Element(),container=new Element();container.anchor=anchor;container.fallback=new Element();container.append(container.fallback);
  const doc={body:new Element(),documentElement:new Element(),createElement(type){assert.equal(type,'canvas');const el=new Element();el.ctx=context();el.getContext=()=>canvas?el.ctx:null;canvases.push(el);return el;}};
  class Observer{constructor(callback){this.callback=callback;this.disconnected=false;observers.push(this);}observe(){}disconnect(){this.disconnected=true;}}
  class Intersection extends Observer{observe(){this.callback([{isIntersecting:true}]);}}
  class Pointer extends Event{constructor(type,options={}){super(type);Object.assign(this,options);}}
  const values={window:{devicePixelRatio:2,matchMedia:()=>({matches:reduced,addEventListener(){},removeEventListener(){}})},document:doc,getComputedStyle:()=>({color:ink,fontFamily:'Arial'}),ResizeObserver:Observer,IntersectionObserver:Intersection,MutationObserver:Observer,requestAnimationFrame:callback=>{const id=++sequence;raf.set(id,callback);return id;},cancelAnimationFrame:id=>raf.delete(id),MouseEvent:Pointer};
  for(const [name,value]of Object.entries(values))Object.defineProperty(globalThis,name,{configurable:true,value,writable:true});
  function frames(n){for(let i=0;i<n;i++){const batch=[...raf.values()];raf.clear();tick+=1000/60;batch.forEach(callback=>callback(tick));}}
  return{container,anchor,canvases,observers,raf,Pointer,frames,setInk(value){ink=value;},cleanup(){for(const[name,d]of descriptors){if(d)Object.defineProperty(globalThis,name,d);else delete globalThis[name];}}};
}
const options={text:'long d.',fontSize:21,fontWeight:700,align:'left',sweep:false,draggable:false,clickKick:false,specks:0,labels:false};

test('the published Tech Text engine paints actual letter outlines on hover, updates neutral ink, and sleeps when settled',()=>{
  const f=fixture();let controller;
  try{
    controller=createTechText(f.container,options);f.frames(3);assert.ok(f.container.classList.contains('tech-text-ready'));
    const main=f.canvases[0].ctx;assert.ok(main.draws.length>0);assert.ok(main.draws.every(c=>!c.ctx.strokes.length),'Idle brand uses solid glyphs');
    f.container.dispatchEvent(new f.Pointer('pointermove',{clientX:39,clientY:16}));f.frames(30);
    assert.ok(main.draws.some(c=>c.ctx.strokes.length>0),'Hovered letters use the upstream dashed-outline sprite');assert.ok(main.rectangles>0,'The selection frame is drawn');
    f.container.dispatchEvent(new Event('pointerleave'));f.frames(180);assert.equal(f.raf.size,0,'No continual animation over the island while idle');
    f.setInk('#f4f3ef');controller.refresh();f.frames(3);assert.ok(f.canvases.some(c=>c.ctx.strokes.some(s=>s.color==='#f4f3ef')));
    controller.dispose();controller.dispose();assert.ok(f.observers.every(o=>o.disconnected));assert.equal(f.raf.size,0);assert.equal(f.container.children.length,1);assert.equal(f.container.classList.contains('tech-text-ready'),false);
  }finally{controller?.dispose();f.cleanup();}
});

test('keyboard focus reveals the effect without consuming the brand home-link click',()=>{
  const f=fixture();let controller;
  try{controller=createTechText(f.container,options);f.frames(3);let clicked=0;f.anchor.addEventListener('click',()=>clicked++);f.anchor.dispatchEvent(new Event('focusin'));f.frames(20);assert.ok(f.canvases[0].ctx.draws.some(c=>c.ctx.strokes.length));f.anchor.dispatchEvent(new Event('click'));assert.equal(clicked,1);f.anchor.dispatchEvent(new Event('focusout'));f.frames(180);assert.equal(f.raf.size,0);}finally{controller?.dispose();f.cleanup();}
});

test('reduced motion and unavailable canvas leave the stable readable wordmark fallback',()=>{
  for(const config of [{reduced:true},{canvas:false}]){const f=fixture(config);try{const controller=createTechText(f.container,options);assert.equal(f.container.children.length,1);assert.equal(f.container.classList.contains('tech-text-ready'),false);assert.equal(f.raf.size,0);assert.equal(f.observers.length,0);controller.refresh();controller.dispose();}finally{f.cleanup();}}
});


test('the neutral brand name and tagline retain contrast in light, dark, and hover states',async()=>{
  const css=await readFile(new URL('../src/styles.css',import.meta.url),'utf8');
  const luminance=hex=>{const c=hex.slice(1).match(/../g).map(v=>parseInt(v,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);return c[0]*.2126+c[1]*.7152+c[2]*.0722;};
  const contrast=(a,b)=>(Math.max(luminance(a),luminance(b))+.05)/(Math.min(luminance(a),luminance(b))+.05);
  for(const selector of [':root','body.evening']){
    const block=css.slice(css.indexOf(selector+' {')).split('}')[0],tokens=Object.fromEntries([...block.matchAll(/--brand-([\w-]+):\s*(#[a-f\d]{6});/gi)].map(m=>[m[1],m[2]]));
    for(const surface of ['bg','hover']){
      assert.ok(contrast(tokens.ink,tokens[surface])>=4.5);assert.ok(contrast(tokens.muted,tokens[surface])>=4.5);
      assert.ok(contrast(tokens.line,tokens[surface])>=3);assert.ok(contrast(tokens.focus,tokens[surface])>=3);
    }
  }
});
