import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../src/vendor/three.module.js';
import { addRacingCurbs,createAsphaltTexture,roadSvgPath } from '../src/road-style.js';
import { isWater,bridgeAt } from '../src/world-layout.js';

test('striped curb geometry stays beside the asphalt and leaves junctions and crossings open',()=>{
  const parent=new THREE.Group(),geometry=new THREE.BoxGeometry(1,1,1),red=new THREE.MeshStandardMaterial({color:'#e44c3b'}),ivory=new THREE.MeshStandardMaterial({color:'#f1e4ce'});
  const curve=points=>new THREE.CatmullRomCurve3(points.map(([x,z])=>new THREE.Vector3(x,.1,z)),false,'catmullrom',.25);
  const roads=[{curve:curve([[20,-40],[80,-40]]),width:12},{curve:curve([[50,-65],[50,-15]]),width:10}];
  const root=addRacingCurbs({THREE,parent,roads,geometry,red,ivory}),matrix=new THREE.Matrix4(),position=new THREE.Vector3(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3();
  assert.equal(root.userData.physicsIgnore,true);assert.equal(root.children.length,2);
  let count=0;
  for(const [index,mesh] of root.children.entries()){
    assert.equal(mesh.material,index?ivory:red);assert.ok(mesh.count>20);
    for(let i=0;i<mesh.count;i++){
      mesh.getMatrixAt(i,matrix);matrix.decompose(position,rotation,scale);count++;
      assert.ok([...position,...scale,...rotation].every(Number.isFinite));assert.ok(Math.abs(position.y-.133)<1e-6);assert.ok(scale.y<.05);
      assert.equal(isWater(position.x,position.z),false);assert.equal(!!bridgeAt(position.x,position.z),false);
      const horizontal=Math.abs(Math.abs(position.z+40)-6.25)<.001;
      if(horizontal)assert.ok(Math.abs(position.x-50)>=5.5);else{assert.ok(Math.abs(Math.abs(position.x-50)-5.25)<.001);assert.ok(Math.abs(position.z+40)>=6.5);}
    }
  }
  assert.ok(count>60);geometry.dispose();red.dispose();ivory.dispose();
});

test('the map road follows the smooth scene curve rather than straight polygon corners',()=>{
  const points=[[-10,-20],[0,-35],[20,-20],[0,-10]],path=roadSvgPath(points,true);
  assert.match(path,/^M-10\.00,-20\.00L/);assert.ok(path.endsWith('Z'));assert.ok(path.split('L').length>20);assert.doesNotMatch(path,/NaN|Infinity/);
  assert.ok(!roadSvgPath(points,false).endsWith('Z'));
});

test('asphalt has a deterministic local aggregate texture with opaque pixels and repeating UV support',()=>{
  const original=globalThis.document;let pixels;
  globalThis.document={createElement:()=>({getContext:()=>({createImageData:(width,height)=>({data:new Uint8ClampedArray(width*height*4)}),putImageData:image=>{pixels=image.data;}})})};
  try{
    const texture=createAsphaltTexture(THREE,{coarse:true});assert.equal(texture.image.width,256);assert.equal(texture.image.height,256);assert.equal(texture.wrapS,THREE.RepeatWrapping);assert.equal(texture.wrapT,THREE.RepeatWrapping);assert.equal(texture.colorSpace,THREE.SRGBColorSpace);
    assert.ok(new Set(pixels.filter((_,i)=>i%4===0)).size>20);assert.ok(pixels.every((value,i)=>i%4!==3||value===255));texture.dispose();
  }finally{if(original===undefined)delete globalThis.document;else globalThis.document=original;}
});
