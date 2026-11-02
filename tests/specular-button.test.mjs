import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'esbuild';

const bundle=await build({entryPoints:[new URL('../components/explore-specular-button.jsx',import.meta.url).pathname],bundle:true,write:false,platform:'node',format:'esm',jsx:'automatic',loader:{'.css':'empty'},define:{'process.env.NODE_ENV':'"production"'}});
const {mountExploreSpecularButton}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));

function fixture({lowPower=false,reduced=false,webgl=true}={}){
  const names=['window','document','navigator','ResizeObserver','IntersectionObserver','requestAnimationFrame','cancelAnimationFrame','performance'];
  const saved=new Map(names.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
  const define=(name,value)=>Object.defineProperty(globalThis,name,{configurable:true,writable:true,value});
  const frames=new Map(),observers=[],draws=[],live=new Set();let constants=0,sequence=0,time=0,contexts=0,losses=0,active=true;
  const uniforms={},gl=new Proxy({getShaderParameter:()=>true,getProgramParameter:()=>true,getUniformLocation:(_,name)=>name,
    shaderSource(shader,source){shader.source=source;},drawArrays(){draws.push({...uniforms});},getExtension:()=>({loseContext(){losses++;}})},
    {get(target,name){if(name in target)return target[name];if(/^[A-Z_0-9]+$/.test(name))return target[name]=++constants;
      if(name.startsWith('create'))return target[name]=()=>{const resource={};live.add(resource);return resource;};
      if(name.startsWith('delete'))return target[name]=resource=>{assert.ok(live.delete(resource),'Owned GL resources are released once');};
      if(name.startsWith('uniform'))return target[name]=(key,...value)=>{uniforms[key]=value.length===1?value[0]:value;};
      return target[name]=()=>{};}});
  class Element extends EventTarget {
    childNodes=[];parentNode=null;style={};dataset={};hidden=false;disabled=false;offsetWidth=240;offsetHeight=50;classes=new Set();
    classList={add:(...values)=>values.forEach(value=>this.classes.add(value)),remove:(...values)=>values.forEach(value=>this.classes.delete(value))};
    setAttribute(name,value){this[name]=value;}
    append(...children){for(const child of children){child.remove();child.parentNode=this;this.childNodes.push(child);}}
    prepend(child){child.remove();child.parentNode=this;this.childNodes.unshift(child);}
    insertBefore(child,before){child.remove();child.parentNode=this;this.childNodes.splice(this.childNodes.indexOf(before),0,child);}
    remove(){if(this.parentNode)this.parentNode.childNodes=this.parentNode.childNodes.filter(child=>child!==this);this.parentNode=null;}
    getBoundingClientRect(){return {left:100,top:100,width:this.offsetWidth,height:this.offsetHeight};}
  }
  const button=new Element();button.id='explore';const car=new Element(),label=new Element(),arrow=new Element();label.dataset.copy='explore';label.textContent='Let’s explore';button.append(car,label,arrow);
  const motion=Object.assign(new EventTarget(),{matches:reduced});
  define('window',Object.assign(new EventTarget(),{devicePixelRatio:3,matchMedia:()=>motion}));
  define('navigator',{hardwareConcurrency:lowPower?2:8,deviceMemory:8});
  define('document',Object.assign(new EventTarget(),{hidden:false,documentElement:new EventTarget(),createElement(tag){const element=new Element();element.tagName=tag.toUpperCase();if(tag==='canvas')element.getContext=type=>{
    if(type==='webgl2'){contexts++;return webgl?gl:null;}
    return {clearRect(){},fillRect(){},getImageData(){return {data:[255,245,224,255]};}};
  };return element;}}));
  define('performance',{now:()=>time});
  class Observer{constructor(callback){this.callback=callback;this.disconnected=false;observers.push(this);}observe(){}disconnect(){this.disconnected=true;}}
  class Intersection extends Observer{observe(){this.callback([{isIntersecting:true}]);}}
  define('ResizeObserver',Observer);define('IntersectionObserver',Intersection);
  define('requestAnimationFrame',callback=>{const id=++sequence;frames.set(id,callback);return id;});define('cancelAnimationFrame',id=>frames.delete(id));
  const controller=mountExploreSpecularButton(button,{isActive:()=>active});
  const event=(target,name,properties={})=>target.dispatchEvent(Object.assign(new Event(name),properties));
  return {button,label,car,arrow,controller,frames,draws,live,observers,get contexts(){return contexts;},get losses(){return losses;},
    advance(count=240,hz=120){for(let i=0;i<count;i++){const batch=[...frames.values()];frames.clear();time+=1000/hz;batch.forEach(callback=>callback(time));}},
    pointer(x,y){event(window,'pointermove',{clientX:x,clientY:y,pointerType:'mouse'});},focus(){event(button,'focus');},blur(){event(button,'blur');},click(){event(button,'click');},
    cover(value){active=!value;controller.refresh();},hidden(value){document.hidden=value;event(document,'visibilitychange');},
    reduce(value){motion.matches=value;event(motion,'change',{matches:value});},
    cleanup(){controller.dispose();for(const[name,descriptor]of saved){if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}}
  };
}

test('upstream specular rim follows nearby pointers at 30fps, sleeps idle and ignores distant movement',()=>{
  const f=fixture();try{
    f.advance();assert.equal(f.frames.size,0);assert.equal(f.button.dataset.specular,'gpu');const before=f.draws.length;
    f.pointer(2000,2000);f.advance(30);assert.equal(f.draws.length,before);assert.equal(f.frames.size,0);
    f.pointer(310,110);f.advance(120);assert.ok(f.draws.length>before);assert.ok(f.draws.length-before<=31);
    f.advance();assert.equal(f.frames.size,0,'A stationary hovered pointer does not run continuously');
    const canvas=f.button.childNodes.find(child=>child.tagName==='CANVAS');assert.ok(canvas.width*canvas.height<=60000);
    assert.ok(f.draws.some(draw=>draw.uIntensity>.35));assert.ok(f.draws.every(draw=>Number.isFinite(draw.uSpot)));
  }finally{f.cleanup();}assert.equal(f.live.size,0);
});

test('keyboard focus retains native activation, translations and icons survive refresh/replacement',()=>{
  const f=fixture();try{
    let clicks=0;f.button.addEventListener('click',()=>clicks++);f.focus();f.advance();f.click();assert.equal(clicks,1);
    f.label.textContent='Cùng khám phá';f.controller.refresh();assert.equal(f.label.textContent,'Cùng khám phá');assert.equal(f.button.id,'explore');
    assert.ok(f.button.childNodes.some(child=>child.childNodes.includes(f.car)&&child.childNodes.includes(f.arrow)));
    for(const node of [...f.button.childNodes])node.remove();f.button.append(f.label,f.arrow);f.controller.refresh();
    assert.ok(f.button.childNodes.some(child=>child.tagName==='CANVAS'),'Fallback innerHTML replacement reattaches the light canvas');
    assert.ok(f.button.childNodes.some(child=>child.childNodes.includes(f.label)));f.click();assert.equal(clicks,2);
    f.blur();f.advance();assert.equal(f.frames.size,0);
  }finally{f.cleanup();}
});

test('covered, hidden and offscreen heroes cancel frames and disposal releases all owned resources',()=>{
  const f=fixture();try{
    f.pointer(310,110);f.cover(true);assert.equal(f.frames.size,0);const before=f.draws.length;f.pointer(150,100);f.advance();assert.equal(f.draws.length,before);
    f.cover(false);f.pointer(310,110);f.hidden(true);assert.equal(f.frames.size,0);f.hidden(false);f.advance();
    f.pointer(150,100);f.observers.find(observer=>observer.constructor.name==='Intersection').callback([{isIntersecting:false}]);assert.equal(f.frames.size,0);
    f.controller.dispose();f.controller.dispose();assert.equal(f.frames.size,0);assert.equal(f.live.size,0);assert.ok(f.observers.every(observer=>observer.disconnected));assert.equal(f.losses,1);
    assert.ok(f.button.childNodes.includes(f.label));assert.equal(f.button.id,'explore');
  }finally{f.cleanup();}
});

test('low-power, reduced-motion and unavailable WebGL keep a static native CTA',()=>{
  for(const options of [{lowPower:true},{reduced:true},{webgl:false}]){
    const f=fixture(options);try{
      assert.equal(f.button.dataset.specular,'static');if(options.webgl!==false)assert.equal(f.contexts,0);
      f.pointer(150,110);f.focus();f.advance();assert.equal(f.frames.size,0);assert.equal(f.draws.length,0);
      let clicks=0;f.button.addEventListener('click',()=>clicks++);f.click();assert.equal(clicks,1);
    }finally{f.cleanup();}
  }
});

test('runtime reduced-motion changes release the old context and can restore a fresh bounded light',()=>{
  const f=fixture();try{
    f.pointer(310,110);f.reduce(true);assert.equal(f.frames.size,0);assert.equal(f.live.size,0);assert.equal(f.button.dataset.specular,'static');
    f.reduce(false);assert.equal(f.button.dataset.specular,'gpu');assert.equal(f.contexts,2);f.advance();assert.equal(f.frames.size,0);
  }finally{f.cleanup();}
});
