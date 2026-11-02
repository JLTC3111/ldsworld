import test from 'node:test';
import assert from 'node:assert/strict';
import {createWeatherOverlay} from '../src/weather-overlay.js';

function fixture(options={}){
  let writes=0,element;
  const page=Object.assign(new EventTarget(),{hidden:false,createElement(tag){
    assert.equal(tag,'div','Weather never creates a canvas');
    element={dataset:new Proxy({},{set(target,key,value){writes++;target[key]=value;return true;}}),setAttribute(name,value){this[name]=value;},remove(){this.removed=true;}};return element;
  }});
  const children=[],container={ownerDocument:page,append:child=>children.push(child)};
  const overlay=createWeatherOverlay({container,...options});
  return {overlay,page,element,children,get writes(){return writes;}};
}

test('one inert CSS overlay handles rain/snow/clear without repeated frame writes',()=>{
  const f=fixture();assert.equal(f.children.length,1);assert.equal(f.element['aria-hidden'],'true');assert.equal(f.element.hidden,true);
  f.overlay.update({weather:'snow',night:0});assert.equal(f.element.hidden,false);assert.equal(f.element.dataset.weather,'snow');
  const writes=f.writes;for(let frame=0;frame<240;frame++)f.overlay.update({weather:'snow',night:frame/1000});assert.equal(f.writes,writes,'Unchanged weather does not churn DOM styles each frame');
  f.overlay.update({weather:'rain',night:.9});assert.equal(f.element.dataset.weather,'rain');assert.equal(f.element.dataset.night,'true');
  f.overlay.update({weather:'clear'});assert.equal(f.element.hidden,true);f.overlay.dispose();assert.equal(f.element.removed,true);
});

test('weather freezes through panels, hidden tabs, and reduced motion and cleans up visibility events',()=>{
  const f=fixture({reducedMotion:true});assert.equal(f.element.dataset.reducedMotion,'true');
  f.overlay.update({weather:'snow',paused:true});assert.equal(f.element.dataset.paused,'true');
  f.overlay.update({paused:false});assert.equal(f.element.dataset.paused,'false');
  f.page.hidden=true;f.page.dispatchEvent(new Event('visibilitychange'));assert.equal(f.element.dataset.paused,'true');
  f.page.hidden=false;f.page.dispatchEvent(new Event('visibilitychange'));assert.equal(f.element.dataset.paused,'false');
  f.overlay.update({paused:true});f.page.hidden=true;f.page.dispatchEvent(new Event('visibilitychange'));f.page.hidden=false;f.page.dispatchEvent(new Event('visibilitychange'));assert.equal(f.element.dataset.paused,'true','Showing a tab does not override a paused world');
  f.overlay.dispose();const writes=f.writes;f.overlay.update({weather:'rain',paused:false});f.page.dispatchEvent(new Event('visibilitychange'));f.overlay.dispose();assert.equal(f.writes,writes);
});
