import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {build} from 'esbuild';

const component=new URL('../components/react-bits/GooeyNav.jsx',import.meta.url);
const source=(await readFile(component,'utf8')).replace("import { useEffect, useLayoutEffect, useRef, useState } from 'react';","const {useEffect,useLayoutEffect,useRef,useState}=globalThis.__gooeyHooks;");
const bundle=await build({stdin:{contents:source,resolveDir:fileURLToPath(new URL('.',component)),loader:'jsx'},bundle:true,write:false,platform:'node',format:'esm',jsx:'automatic',loader:{'.css':'empty'},define:{'process.env.NODE_ENV':'"production"'}});
let instance=0;

async function fixture({lowPower=false,reduced=false}={}){
  const names=['__gooeyHooks','navigator','window','document','performance','ResizeObserver','requestAnimationFrame','cancelAnimationFrame'];
  const saved=new Map(names.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
  const define=(name,value)=>Object.defineProperty(globalThis,name,{configurable:true,value,writable:true});
  let draws=0,contexts=0,constant=0,sequence=0,time=0,refCursor=0,effectCursor=0,inner=0,tree,props;
  const frames=new Map(),refs=[],effects=[],pending=[],commits=[],counts=[];let count=0;
  const gl=new Proxy({getProgramParameter:()=>true,getUniformLocation:(_,name)=>name,getAttribLocation:()=>0,uniform1i(name,value){if(name==='uCount')count=value;},drawArrays(){draws++;counts.push(count);},getExtension:()=>({loseContext(){}})},
    {get(target,name){if(name in target)return target[name];if(/^[A-Z_0-9]+$/.test(name))return target[name]=++constant;return target[name]=name.startsWith('create')?()=>({}):()=>{};}});
  const element=()=>Object.assign(new EventTarget(),{style:{},getBoundingClientRect:()=>({left:0,top:0,width:400,height:36})});
  const stage=element(),canvas=element(),list=element(),overlay=element(),fallback=element();
  list.children=Array.from({length:5},(_,index)=>({getBoundingClientRect:()=>({left:index*80,top:0,width:80,height:36})}));
  canvas.getContext=()=>{contexts++;return gl;};
  const nodes=[stage,canvas,list,overlay,fallback];
  const effect=(callback,deps)=>{const index=effectCursor++,previous=effects[index];if(!previous||!deps||deps.some((value,i)=>!Object.is(value,previous.deps?.[i])))pending.push(()=>{previous?.cleanup?.();effects[index]={deps,cleanup:callback()};});};
  define('__gooeyHooks',{useRef:initial=>{const index=refCursor++;return refs[index]??=(index<nodes.length?{current:nodes[index]}:{current:initial});},useState:initial=>[inner??initial,value=>{inner=value;}],useEffect:effect,useLayoutEffect:effect});
  const motion=Object.assign(new EventTarget(),{matches:reduced});
  define('window',{devicePixelRatio:3,matchMedia:()=>motion});define('navigator',{hardwareConcurrency:lowPower?2:8,deviceMemory:8});
  define('document',Object.assign(new EventTarget(),{hidden:false}));define('performance',{now:()=>time});
  class Observer{observe(){}disconnect(){}}define('ResizeObserver',Observer);
  define('requestAnimationFrame',callback=>{const id=++sequence;frames.set(id,callback);return id;});define('cancelAnimationFrame',id=>frames.delete(id));
  const {default:GooeyNav}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text+`\n// fixture ${++instance}`).toString('base64'));
  const items=Array.from({length:5},(_,index)=>({label:`Page ${index}`}));
  function render(next={}){props={items,activeIndex:0,onChange:index=>commits.push(index),...props,...next};refCursor=effectCursor=0;tree=GooeyNav(props);while(pending.length)pending.shift()();return tree;}
  function buttons(){const result=[];function visit(node){if(Array.isArray(node)){node.forEach(visit);return;}if(!node?.props)return;if(node.type==='button'||node.type==='a')result.push(node);else visit(node.props.children);}visit(tree);return result;}
  render();
  return {frames,counts,commits,canvas,list,overlay,motion,render,buttons,get draws(){return draws;},get contexts(){return contexts;},
    click(index){const event={preventDefault(){this.defaultPrevented=true;}};buttons()[index].props.onClick(event);return event;},
    advance(number=120){for(let i=0;i<number;i++){const batch=[...frames.values()];frames.clear();time+=1000/60;batch.forEach(callback=>callback(time));}},
    hidden(value){document.hidden=value;document.dispatchEvent(new Event('visibilitychange'));},
    reduce(value){motion.matches=value;motion.dispatchEvent(Object.assign(new Event('change'),{matches:value}));},
    cleanup(){effects.forEach(record=>record?.cleanup?.());for(const[name,descriptor]of saved){if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}}
  };
}

test('hover and focus do not activate the effect, selection, or navigation action',async()=>{
  const f=await fixture();try{
    assert.equal(f.frames.size,0);const before=f.draws;
    for(const name of ['pointerover','pointerleave','focusin','focusout'])f.list.dispatchEvent(new Event(name));
    f.advance();assert.equal(f.draws,before);assert.equal(f.frames.size,0);assert.deepEqual(f.commits,[]);
    assert.equal(f.buttons()[0].props['aria-current'],'page');assert.equal(f.buttons()[1].props['aria-current'],undefined);
    assert.equal(f.buttons()[1].type,'button','Native keyboard activation and focus stay available');
  }finally{f.cleanup();}
});

test('actual selected-index changes animate once; repeat selection and unrelated updates do nothing',async()=>{
  const f=await fixture();try{
    f.click(0);assert.deepEqual(f.commits,[]);assert.equal(f.frames.size,0);
    f.click(1);assert.deepEqual(f.commits,[1]);assert.equal(f.frames.size,0,'Controlled navigation waits for the view to actually change');
    f.render({activeIndex:1});assert.equal(f.frames.size,1);f.advance();assert.equal(f.frames.size,0);
    assert.ok(f.counts.some(value=>value>0&&value<=4),'The change uses a small particle burst');
    assert.equal(f.buttons()[1].props['aria-current'],'page');
    const before=f.draws;f.click(1);f.render({activeIndex:1,ariaLabel:'Translated navigation'});f.advance();
    assert.deepEqual(f.commits,[1]);assert.equal(f.draws,before);assert.equal(f.frames.size,0);
    f.render({activeIndex:3});assert.equal(f.frames.size,1,'External view changes start the same effect without an action callback');
    f.advance();assert.deepEqual(f.commits,[1]);assert.equal(f.frames.size,0);
    assert.ok(f.canvas.width<=Math.ceil((400+56)*1.25));
  }finally{f.cleanup();}
});

test('rapid real changes finish at the latest page; hidden and reduced-motion states stop all frames',async()=>{
  const f=await fixture();try{
    for(const index of [1,4,2,3]){f.render({activeIndex:index});f.advance(4);}
    f.advance(180);assert.equal(f.frames.size,0);assert.equal(f.buttons()[3].props['aria-current'],'page');assert.deepEqual(f.commits,[]);
    assert.ok(f.counts.every(value=>value<=8),'Rapid view changes preserve the total particle cap');
    f.render({activeIndex:4});assert.equal(f.frames.size,1);f.hidden(true);assert.equal(f.frames.size,0);const before=f.draws;f.advance();assert.equal(f.draws,before);
    f.hidden(false);assert.equal(f.frames.size,0);f.render({activeIndex:2});f.reduce(true);assert.equal(f.frames.size,0);f.render({activeIndex:1});assert.equal(f.frames.size,0);
  }finally{f.cleanup();}
});

test('low-power and initial reduced motion use a selected pill without creating a WebGL context',async()=>{
  for(const options of [{lowPower:true},{reduced:true}]){
    const f=await fixture(options);try{
      assert.equal(f.contexts,0);f.render({activeIndex:2});assert.equal(f.frames.size,0);assert.equal(f.buttons()[2].props['aria-current'],'page');
      assert.equal(f.overlay.style.visibility,'visible');f.click(2);assert.deepEqual(f.commits,[]);f.click(1);assert.deepEqual(f.commits,[1]);
    }finally{f.cleanup();}
  }
});

test('native links keep keyboard/link semantics and language actions never move the page indicator',async()=>{
  const f=await fixture();try{
    const items=Array.from({length:5},(_,index)=>({label:`Page ${index}`,href:`#page-${index}`}));
    f.render({items});assert.equal(f.buttons()[1].type,'a');assert.equal(f.buttons()[1].props.href,'#page-1');
    assert.equal(f.click(0).defaultPrevented,true,'A repeated selected link must not trigger hash navigation');
    assert.equal(f.click(1).defaultPrevented,undefined,'A different actual link retains native navigation');
    f.render({items:items.map((item,index)=>index===4?{label:'EN',action:'toggle-language'}:item)});
    const before=f.draws;f.click(4);f.render({items:items.map((item,index)=>index===4?{label:'VI',action:'toggle-language'}:item)});f.advance();
    assert.deepEqual(f.commits,[1,4]);assert.equal(f.draws,before);assert.equal(f.frames.size,0);
    assert.equal(f.buttons()[0].props['aria-current'],'page');
  }finally{f.cleanup();}
});

test('auxiliary views clear selection and Work can return from details without replaying the group effect',async()=>{
  const f=await fixture();try{
    for(const view of ['map','help','garage']){
      f.render({activeIndex:-1});assert.ok(f.buttons().every(button=>button.props['aria-current']===undefined),view);
      assert.equal(f.overlay.style.clipPath,"path('M0,0Z')");assert.equal(f.frames.size,0);
      f.click(0);assert.equal(f.commits.at(-1),0,'Home remains actionable from an auxiliary view');
      f.render({activeIndex:0});assert.equal(f.frames.size,1);f.advance();assert.equal(f.frames.size,0);
    }
    f.render({activeIndex:1});f.advance();
    const items=Array.from({length:5},(_,index)=>({label:`Page ${index}`,allowReselect:index===1}));
    f.render({items,activeIndex:1});const before=f.draws,actions=f.commits.length;
    f.click(1);assert.equal(f.commits.length,actions+1);assert.equal(f.commits.at(-1),1);
    f.render({items:items.map(item=>({...item,allowReselect:false})),activeIndex:1});f.advance();
    assert.equal(f.draws,before,'Returning from project details preserves the existing Work indicator');assert.equal(f.frames.size,0);
    f.click(1);assert.equal(f.commits.length,actions+1,'Repeating Work on the actual list does nothing');
    f.render({activeIndex:4});f.advance(3);f.render({activeIndex:-1});assert.equal(f.frames.size,0,'An auxiliary view cancels a running transition');
  }finally{f.cleanup();}
});

test('portfolio routes give auxiliary panels no selection and only project details allow Work reactivation',async()=>{
  const controls=new URL('../components/portfolio-controls.jsx',import.meta.url);
  const source=(await readFile(controls,'utf8'))
    .replace("import { createRoot } from 'react-dom/client';","const createRoot=host=>({render:child=>host.child=child,unmount(){}});")
    .replace("import { flushSync } from 'react-dom';","const flushSync=callback=>callback();")
    .replace("import Dock from './react-bits/Dock.jsx';","const Dock='test-dock';")
    .replace("import StaggeredMenu from './react-bits/StaggeredMenu.jsx';","const StaggeredMenu='test-menu';")
    .replace("import GooeyNav from './react-bits/GooeyNav.jsx';","const GooeyNav='test-gooey';");
  const bundle=await build({stdin:{contents:source,resolveDir:fileURLToPath(new URL('.',controls)),loader:'jsx'},bundle:true,write:false,platform:'node',format:'esm',jsx:'automatic',define:{'process.env.NODE_ENV':'"production"'}});
  const {mountPortfolioControls}=await import('data:text/javascript;base64,'+Buffer.from(bundle.outputFiles[0].text).toString('base64'));
  const navigation={dataset:{}},dock={},actions=[],model={labels:{},language:'en',mobileNavigation:false};
  const controller=mountPortfolioControls({navigation,dock,model,onAction:action=>actions.push(action)});
  try{
    for(const [view,index]of [[null,0],['home',0],['projects',1],['project',1],['about',2],['contact',3],['world',-1],['map',-1],['help',-1],['garage',-1]]){
      controller.update({...model,view});const props=navigation.child.props;
      assert.equal(props.activeIndex,index,view);assert.equal(props.items[1].allowReselect,view==='project',view);
      assert.deepEqual(props.items.map(item=>item.action),['home','projects','about','contact','toggle-language']);
      const dockItems=dock.child.props.items;
      assert.deepEqual(dockItems.slice(0,2).map(item=>item.id),['garage','reset']);
      assert.ok(!dockItems.some(item=>item.id==='world'),'Desktop settings live below the location badge');
      assert.equal(dockItems.findIndex(item=>item.id==='music'),dockItems.findIndex(item=>item.id==='sound')+1,'Music remains immediately after sound');
      assert.equal(props.particleCount,4);assert.equal(props.animationTime,280);
    }
    controller.update({...model,view:'project'});const props=navigation.child.props;props.onChange(1,props.items[1]);assert.deepEqual(actions,['projects']);
    controller.update({...model,view:'world',mobileNavigation:true});
    assert.ok(navigation.child.props.items.some(item=>item.action==='world'&&item.current),'Mobile navigation retains its selected World destination');
    assert.deepEqual(dock.child.props.items.slice(0,3).map(item=>item.id),['garage','world','reset']);
    const world=dock.child.props.items.find(item=>item.id==='world');assert.equal(world.active,true);world.onClick();assert.equal(actions.at(-1),'world');
    assert.equal(navigation.child.props.items.length,6,'Utilities are not a seventh numbered menu item');
    controller.update({...model,mobileNavigation:true,mobileGameplay:true,night:true,labels:{theme:'Light theme',themeToggle:'Dark theme',languageGroup:'Language'}});
    const theme=navigation.child.props.socialControls,languages=navigation.child.props.headerControls;
    assert.equal(theme.type,'button');assert.equal(theme.props.id,'mobile-theme');assert.equal(theme.props['aria-pressed'],true);assert.equal(theme.props['aria-label'],'Dark theme');
    assert.equal(theme.props.children.type,'svg','The theme toggle is icon-only');theme.props.onClick();assert.equal(actions.at(-1),'toggle-theme');
    assert.equal(languages.props.role,'group');assert.equal(languages.props['aria-label'],'Language');
    assert.deepEqual(languages.props.children.map(button=>button.props['data-language']),['en','vi']);assert.equal(languages.props.children[0].props['aria-pressed'],true);
    assert.equal(dock.child.props.baseItemSize,44,'Stopped mobile gameplay keeps usable touch targets');
  }finally{controller.dispose();}
});
