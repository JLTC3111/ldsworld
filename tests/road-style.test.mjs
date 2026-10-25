import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../src/vendor/three.module.js';
import { addRacingCurbs,createAsphaltTexture,createRoadCurve,createRoadGeometry,roadSvgPath } from '../src/road-style.js';
import { isWater,isRiver,riverCenter,bridgeAt,RIVER_HALF_WIDTH } from '../src/world-layout.js';

test('striped curb geometry stays beside the asphalt and leaves junctions and crossings open',()=>{
  const parent=new THREE.Group(),geometry=new THREE.BoxGeometry(1,1,1),red=new THREE.MeshStandardMaterial({color:'#e44c3b'}),ivory=new THREE.MeshStandardMaterial({color:'#f1e4ce'});
  const curve=points=>createRoadCurve(points,false,.1);
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

test('two-point connectors remain straight and never fold backward at their endpoints',()=>{
  const curve=createRoadCurve([[20,-40],[80,-40]],false,.1);
  for(let i=0;i<=200;i++){const p=curve.getPointAt(i/200),tangent=curve.getTangentAt(i/200);assert.ok(p.x>=20&&p.x<=80);assert.equal(p.z,-40);assert.ok(tangent.x>.999);}
});

test('road triangles meet the actual river banks with flat surfaces and no asphalt across the water',()=>{
  for(const points of [[[0,-10],[0,18]],[[-23,-10],[-16,18]],[[86,-10],[110,18]]]){
    const geometry=createRoadGeometry({THREE,curve:createRoadCurve(points),width:12.25}),p=geometry.attributes.position,uv=geometry.attributes.uv,ids=geometry.index.array;
    assert.equal(p.count,uv.count);for(const value of [...p.array,...uv.array])assert.ok(Number.isFinite(value));
    let north=false,south=false;
    for(let i=0;i<ids.length;i+=3){
      const a=new THREE.Vector3().fromBufferAttribute(p,ids[i]),b=new THREE.Vector3().fromBufferAttribute(p,ids[i+1]),c=new THREE.Vector3().fromBufferAttribute(p,ids[i+2]);
      for(const [u,v,w] of [[1/3,1/3,1/3],[.1,.45,.45],[.45,.1,.45],[.45,.45,.1]]){const x=a.x*u+b.x*v+c.x*w,z=a.z*u+b.z*v+c.z*w;assert.ok(Math.abs(z-riverCenter(x))>=RIVER_HALF_WIDTH-.001,'No asphalt triangle crosses the stream');north ||= z<riverCenter(x);south ||= z>riverCenter(x);}
      assert.ok(Math.abs(a.y-.1)<1e-6&&Math.abs(b.y-.1)<1e-6&&Math.abs(c.y-.1)<1e-6,'No lowered diagonal triangles');
    }
    assert.ok(north&&south);geometry.dispose();
  }
});

test('the complete curb footprint leaves streams and bridge ends clear',()=>{
  const parent=new THREE.Group(),geometry=new THREE.BoxGeometry(1,1,1),red=new THREE.MeshBasicMaterial(),ivory=new THREE.MeshBasicMaterial();
  const roads=[{curve:createRoadCurve([[10,-10],[10,18]]),width:12.25}],root=addRacingCurbs({THREE,parent,roads,geometry,red,ivory}),m=new THREE.Matrix4();
  for(const mesh of root.children)for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,m);for(const x of [-.5,0,.5])for(const z of [-.5,0,.5]){const p=new THREE.Vector3(x,0,z).applyMatrix4(m);assert.equal(isRiver(p.x,p.z,.1),false);assert.equal(!!bridgeAt(p.x,p.z),false);}}
  geometry.dispose();red.dispose();ivory.dispose();
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
