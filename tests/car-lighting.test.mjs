import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../src/vendor/three.module.js';
import {registerCarAsset,getCarAsset,cloneCarAsset,CAR_ASSET_IDS} from '../src/car-assets.js';
import {createCarEnvironment,createCarLighting} from '../src/car-lighting.js';

const finishes=object=>{const values=new Map();object.traverse(o=>{if(o.isMesh&&!o.name.startsWith('display_base'))values.set(o.name.split('__').at(-1),o.material);});return values;};
test('supplied paint receives owned glossy finishes while the original assets remain untouched',async()=>{
  for(const id of CAR_ASSET_IDS){
    const bytes=await readFile(new URL(`../src/assets/cars/${id}.glb`,import.meta.url));await registerCarAsset(id,bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
    const source=finishes(getCarAsset(id)),before=new Map([...source].map(([name,m])=>[name,m.color.getHexString()])),clone=cloneCarAsset(id);
    const painted=finishes(clone.orient);
    // A lit material needs vertex normals or the derivative-based flat shader.
    // Checking color values alone missed the gray-paint regression.
    for(const mesh of clone.meshes){assert.ok(mesh.geometry.hasAttribute('normal')||mesh.material.flatShading,`${id}/${mesh.name}: missing usable surface normals`);assert.equal(mesh.material.flatShading,true,'Preserve the GLTF loader’s face-normal shader for these supplied assets');}
    for(const [name,m]of painted){assert.notEqual(m,source.get(name));if(m.userData.visibilityPaint){assert.equal(m.isMeshPhysicalMaterial,true);assert.equal(m.clearcoat,.95);assert.equal(m.roughness,.25);assert.ok(m.emissiveIntensity>0);}}
    if(id==='8-ball'){assert.equal(painted.get('red').color.getHexString(),'ff3829');assert.equal(painted.get('red_lite').color.getHexString(),'ff7964');assert.ok(painted.get('red_dark').color.r>painted.get('red_dark').color.g*3);}
    clone.geometries.forEach(g=>g.dispose());clone.materials.forEach(m=>m.dispose());for(const [name,m]of source)assert.equal(m.color.getHexString(),before.get(name));
  }
});

test('the car rig follows jumps, adds local night fill, and releases only its own resources',()=>{
  const scene=new THREE.Scene(),root=new THREE.Group();scene.add(root);
  const material=new THREE.MeshPhysicalMaterial();material.userData.visibilityPaint=true;
  root.add(new THREE.Mesh(new THREE.BoxGeometry(1,1,1),material));
  const texture=new THREE.Texture(),vehicle={root,profile:{halfWidth:1.1,halfLength:2,bodyTop:2.5}};
  const rig=createCarLighting({THREE,scene,vehicle,environmentMap:texture});let textureDisposals=0;texture.addEventListener('dispose',()=>textureDisposals++);
  root.position.set(15,8,-12);rig.update({night:0});assert.equal(rig.group.position.x,15);assert.equal(rig.group.position.z,-12);assert.ok(rig.group.position.y>8);
  const daylight=rig.key.intensity;rig.update({night:1});assert.ok(rig.key.intensity>daylight);assert.equal(rig.key.distance,14);assert.equal(rig.rim.distance,12);assert.equal(rig.key.castShadow,false);assert.equal(material.envMap,texture);
  rig.dispose();rig.dispose();assert.deepEqual(scene.children,[root]);assert.equal(textureDisposals,0);material.dispose();root.children[0].geometry.dispose();texture.dispose();
});

function environmentFixture({fail=false}={}){
  const original={target:{name:'map-target'},face:2,mip:3,autoClear:false,toneMapping:THREE.ACESFilmicToneMapping,exposure:1.3,color:'#425462',alpha:.3,xr:true};
  const renderer={isWebGLRenderer:true,target:original.target,face:2,mip:3,xr:{enabled:true},autoClear:false,toneMapping:original.toneMapping,toneMappingExposure:1.3,color:new THREE.Color(original.color),alpha:.3,
    getRenderTarget(){return this.target;},getActiveCubeFace(){return this.face;},getActiveMipmapLevel(){return this.mip;},getClearAlpha(){return this.alpha;},getClearColor(c){return c.copy(this.color);},setClearColor(c,a){this.color.copy(c);this.alpha=a;},setRenderTarget(t,f,m){this.target=t;this.face=f;this.mip=m;}};
  let targetDisposals=0,generatorDisposals=0,geometries=[],materials=[];const texture=new THREE.Texture();
  class PMREMGenerator{constructor(r){assert.equal(r,renderer);}fromScene(room,sigma,near,far,options){assert.equal(options.size,128);assert.equal(room.children.length,5);room.traverse(o=>{if(o.geometry&&!geometries.includes(o.geometry)){geometries.push(o.geometry);o.geometry.addEventListener('dispose',()=>o.geometry.userData.released=true);}if(o.material){materials.push(o.material);o.material.addEventListener('dispose',()=>o.material.userData.released=true);}});renderer.target=null;renderer.face=0;renderer.mip=0;renderer.xr.enabled=false;renderer.autoClear=true;renderer.toneMapping=0;renderer.toneMappingExposure=9;renderer.color.set('#ff0000');renderer.alpha=1;if(fail)throw new Error('Unavailable GPU');return{texture,dispose(){targetDisposals++;}};}dispose(){generatorDisposals++;}}
  return{renderer,original,T:{...THREE,PMREMGenerator},texture,getResources:()=>({targetDisposals,generatorDisposals,geometries,materials})};
}
for(const fail of [false,true])test(`studio bake restores renderer state after ${fail?'a failed':'a successful'} capture`,()=>{
  const f=environmentFixture({fail}),environment=createCarEnvironment({THREE:f.T,renderer:f.renderer});
  const r=f.renderer,o=f.original;assert.equal(r.target,o.target);assert.equal(r.face,o.face);assert.equal(r.mip,o.mip);assert.equal(r.xr.enabled,o.xr);assert.equal(r.autoClear,o.autoClear);assert.equal(r.toneMapping,o.toneMapping);assert.equal(r.toneMappingExposure,o.exposure);assert.equal(r.color.getHexString(),o.color.slice(1));assert.equal(r.alpha,o.alpha);
  assert.equal(environment.texture,fail?null:f.texture);environment.dispose();environment.dispose();const resources=f.getResources();assert.equal(resources.targetDisposals,fail?0:1);assert.equal(resources.generatorDisposals,1);assert.ok(resources.geometries.every(g=>g.userData.released));assert.ok(resources.materials.every(m=>m.userData.released));
});
test('a renderer without WebGL retains the existing car material path',()=>{const result=createCarEnvironment({THREE,renderer:{}});assert.equal(result.texture,null);assert.doesNotThrow(()=>result.dispose());});
