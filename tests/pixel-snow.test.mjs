import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../src/vendor/three.module.js';
import {createPixelSnow,PIXEL_SNOW_SETTINGS} from '../src/pixel-snow.js';
import {buildAtlas} from '../src/vendor/pixel-snow-atlas.js';

function fixture(options={}){
  const surface=new EventTarget();surface.getBoundingClientRect=()=>({left:0,top:0,width:1440,height:900});surface.getContext=()=>{throw Error('Snow must reuse the world renderer');};
  const renderer={domElement:surface,getSize:v=>v.set(1440,900),getPixelRatio:()=>2};
  const snow=createPixelSnow({THREE,renderer,...options});return{snow,surface};
}

test('Pixel Snow uses its original crisp snowflake atlas, requested settings and one existing-renderer batch',()=>{
  const atlas=buildAtlas();assert.equal(atlas.width,72);assert.equal(atlas.height,27);assert.equal(atlas.data.length,7776);assert.ok(atlas.data.some(n=>n===255));
  const {snow}=fixture();assert.deepEqual(snow.getStats().settings,PIXEL_SNOW_SETTINGS);assert.equal(snow.material.isShaderMaterial,true);assert.equal(snow.material.uniforms.atlas.value.magFilter,THREE.NearestFilter);assert.equal(snow.material.uniforms.atlas.value.generateMipmaps,false);assert.equal(snow.getStats().drawCalls,1);
  snow.update(.016,{opacity:.88,time:1});assert.equal(snow.geometry.drawRange.count,Math.round(1440*900*.5/1100));assert.ok(snow.geometry.drawRange.count<=920);assert.equal(snow.material.uniforms.atlasRow.value,18);assert.equal(snow.material.uniforms.snowColor.value.getHexString(),'ffffff');snow.dispose();
});

test('snow has bounded geometry, no position uploads while hidden/paused and smaller mobile/reduced-motion budgets',()=>{
  for(const options of [{},{coarse:true},{reducedMotion:true}]){
    const {snow}=fixture(options),attribute=snow.geometry.attributes.position,buffer=attribute.array,initial=[...buffer],version=attribute.version;
    snow.update(.05,{opacity:0,time:1});assert.deepEqual([...buffer],initial);assert.equal(attribute.version,version);
    snow.update(.05,{opacity:1,time:1,paused:true});assert.deepEqual([...buffer],initial);assert.equal(attribute.version,version);
    snow.update(.05,{opacity:1,time:1});assert.equal(attribute.array,buffer);assert.notDeepEqual([...buffer],initial);assert.ok([...buffer].every(Number.isFinite));assert.ok(snow.getStats().activeCount<=(options.reducedMotion?90:options.coarse?320:920));snow.dispose();
  }
});

test('sustained slow frames reduce snow load without reallocating buffers and recover conservatively',()=>{
  const {snow}=fixture(),buffer=snow.geometry.attributes.position.array;snow.update(1/60,{opacity:1});const normal=snow.getStats().activeCount;
  for(let i=0;i<100;i++)snow.update(.05,{opacity:1,time:i*.05});assert.equal(snow.getStats().adaptive,true);assert.ok(snow.getStats().activeCount<normal);assert.equal(snow.geometry.attributes.position.array,buffer);
  for(let i=0;i<650;i++)snow.update(1/60,{opacity:1,time:i/60});assert.equal(snow.getStats().adaptive,false);assert.equal(snow.getStats().activeCount,normal);assert.equal(snow.geometry.attributes.position.array,buffer);snow.dispose();
});

test('pointer response stays fine-pointer only, pauses safely and cleans up owned resources once',()=>{
  for(const coarse of [false,true]){
    const {snow,surface}=fixture({coarse});snow.update(.016,{opacity:1});const move=Object.assign(new Event('pointermove'),{clientX:720,clientY:450,pointerType:'mouse'});surface.dispatchEvent(move);snow.update(.05,{opacity:1});assert.equal(snow.material.uniforms.mousePush.value>0,!coarse);
    snow.update(.05,{opacity:1,paused:true});assert.equal(snow.material.uniforms.mousePush.value,0);
    const owned=[snow.geometry,snow.material,snow.material.uniforms.atlas.value];let releases=0;owned.forEach(r=>r.addEventListener('dispose',()=>releases++));snow.dispose();snow.dispose();assert.equal(releases,3);
  }
});
