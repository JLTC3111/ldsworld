import {createSpecularButtonLight} from './react-bits/SpecularButton.jsx';
import {deviceBudget} from '../src/render-budget.js';
import './react-bits/SpecularButton.css';

/** Enhance the existing native CTA, retaining its click handler and translated children. */
export function mountExploreSpecularButton(button,{isActive=()=>true}={}) {
  if(!button)return {refresh(){},dispose(){}};
  const hardware=globalThis.navigator;
  const budget=deviceBudget({hardwareConcurrency:hardware?.hardwareConcurrency,deviceMemory:hardware?.deviceMemory,saveData:hardware?.connection?.saveData});
  const motion=window.matchMedia('(prefers-reduced-motion: reduce)');
  const makeCanvas=()=>{const canvas=document.createElement('canvas');canvas.className='specular-button__light';canvas.setAttribute('aria-hidden','true');return canvas;};
  let canvas=makeCanvas();
  const settingsRef={current:{radius:12,lineColor:'#fff2d9',baseColor:'#c5c3bd',intensity:1,idleIntensity:.35,shineSize:10,shineFade:34,thickness:1.2,glow:1,speed:.35,followMouse:true,proximity:180,autoAnimate:false,disabled:false}};
  let engine=null,disposed=false,label=null;
  button.classList.add('specular-button','explore-specular-button');
  function attach(){
    if(canvas.parentNode!==button)button.prepend(canvas);
    if(label?.parentNode!==button){label=document.createElement('span');label.className='specular-button__label';button.append(label);}
    for(const child of [...button.childNodes])if(child!==canvas&&child!==label)label.append(child);
  }
  function refresh(){
    if(disposed)return;attach();
    const staticMode=budget.lowPower||motion.matches;
    if(staticMode&&engine){engine.dispose();engine=null;canvas.remove();canvas=makeCanvas();attach();}
    if(!staticMode&&!engine)engine=createSpecularButtonLight(button,canvas,{settingsRef,isActive,maxFps:30,maxDpr:1.25,maxPixels:60000});
    button.dataset.specular=staticMode||!engine?.supported?'static':'gpu';
    canvas.hidden=button.dataset.specular==='static'||!isActive();
    engine?.refresh();
  }
  motion.addEventListener?.('change',refresh);refresh();
  return {refresh,dispose(){
    if(disposed)return;disposed=true;motion.removeEventListener?.('change',refresh);engine?.dispose();canvas.remove();
    if(label?.parentNode===button){for(const child of [...label.childNodes])button.insertBefore(child,label);label.remove();}
    button.classList.remove('specular-button','explore-specular-button');delete button.dataset.specular;
  }};
}
