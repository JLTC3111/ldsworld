import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../src/vendor/three.module.js';
import {MODEL_ASSETS,modelAssetURL,createModelAssetLibrary,fitModelAsset} from '../src/model-assets.js';
import {createNodeModelLoader} from './helpers/model-node-loader.mjs';

function assetFixture(){
  const scene=new THREE.Group(),geometry=new THREE.BoxGeometry(2,4,6),texture=new THREE.Texture(),material=new THREE.MeshStandardMaterial({map:texture}),mesh=new THREE.Mesh(geometry,material);mesh.position.set(3,4,5);mesh.name='selected';scene.add(mesh);
  const releases={geometry:0,texture:0,material:0};for(const [name,resource]of Object.entries({geometry,texture,material}))resource.addEventListener('dispose',()=>releases[name]++);
  return {asset:{scene,animations:[]},geometry,material,texture,releases};
}

test('session model libraries deduplicate requests, retry failures, reject unknown IDs, and release shared sources once',async()=>{
  const f=assetFixture();let calls=0,fail=true;
  const library=createModelAssetLibrary({load:async(id,metadata)=>{calls++;assert.equal(metadata.file,MODEL_ASSETS[id].file);if(fail)throw Error('temporary');return f.asset;}});
  const first=library.load('tree'),overlap=library.load('tree');assert.equal(first,overlap);await assert.rejects(first,/temporary/);assert.equal(calls,1);
  fail=false;const asset=await library.load('tree');assert.equal(calls,2);assert.equal(await library.load('tree'),asset);assert.equal(calls,2);
  await assert.rejects(library.load('../secret'),/Unknown/);await assert.rejects(library.load('toString'),/Unknown/);assert.equal(calls,2);
  const one=fitModelAsset(asset,{height:2}),two=fitModelAsset(asset,{width:1});assert.equal(one.root.children[0].children[0].geometry,f.geometry);assert.equal(two.root.children[0].children[0].material,f.material);
  one.dispose();two.dispose();assert.deepEqual(f.releases,{geometry:0,texture:0,material:0});
  library.dispose();library.dispose();assert.deepEqual(f.releases,{geometry:1,texture:1,material:1});await assert.rejects(library.load('tree'),/disposed/);
});

test('disposing during a pending load releases its late result instead of retaining it',async()=>{
  const f=assetFixture();let finish;const library=createModelAssetLibrary({load:()=>new Promise(resolve=>finish=resolve)});
  const pending=library.load('pony');await Promise.resolve();library.dispose();finish(f.asset);await assert.rejects(pending,/disposed/);assert.deepEqual(f.releases,{geometry:1,texture:1,material:1});
});

test('source ImageBitmaps close once with the library and survive individual clone disposal',async()=>{
  const f=assetFixture();let closed=0;f.texture.image={close(){closed++;}};
  const library=createModelAssetLibrary({load:async()=>f.asset});const asset=await library.load('tree');
  const instance=fitModelAsset(asset,{height:2});instance.dispose();assert.equal(closed,0);
  library.dispose();library.dispose();assert.equal(closed,1);
});

test('oversized bitmap textures resize once per source, preserve aspect/color spaces, and close after every map is repointed',async()=>{
  const f=assetFixture();let originalCloses=0,resizedCloses=0,requests=0,options;
  const original={width:2048,height:1024,close(){originalCloses++;assert.equal(f.texture.image,resized);assert.equal(normal.image,resized);}};
  const resized={width:512,height:256,close(){resizedCloses++;}},normal=new THREE.Texture(original);normal.colorSpace=THREE.LinearSRGBColorSpace;
  f.texture.image=original;f.texture.colorSpace=THREE.SRGBColorSpace;f.material.normalMap=normal;
  const library=createModelAssetLibrary({load:async()=>f.asset,maxTextureSize:512,imageBitmapFactory:async(image,requested)=>{requests++;options=requested;assert.equal(image,original);return resized;}});
  const asset=await library.load('tree');assert.equal(requests,1);assert.deepEqual(options,{resizeWidth:512,resizeHeight:256,resizeQuality:'high',premultiplyAlpha:'none',colorSpaceConversion:'none'});
  assert.equal(originalCloses,1);assert.equal(resizedCloses,0);assert.equal(f.texture.colorSpace,THREE.SRGBColorSpace);assert.equal(normal.colorSpace,THREE.LinearSRGBColorSpace);assert.equal(f.asset.scene.children[0].material,f.material);
  const instance=fitModelAsset(asset,{height:2});instance.dispose();assert.equal(resizedCloses,0);
  library.dispose();library.dispose();assert.equal(originalCloses,1);assert.equal(resizedCloses,1);
});

test('shared images across concurrent models reuse resized pixels, including a late source that is already closed',async()=>{
  const a=assetFixture(),b=assetFixture(),c=assetFixture();let calls=0,closed=0;
  const original={width:4096,height:2048,close(){closed++;this.width=this.height=0;}},resized={width:1024,height:512,close(){}};
  for(const fixture of [a,b,c])fixture.texture.image=original;
  const fixtures={tree:a,pony:b,computer:c};
  const library=createModelAssetLibrary({load:async id=>fixtures[id].asset,imageBitmapFactory:async()=>{calls++;return resized;}});
  await Promise.all([library.load('tree'),library.load('pony')]);assert.equal(calls,1);assert.equal(closed,1);
  await library.load('computer');assert.equal(calls,1);assert.equal(c.texture.image,resized);library.dispose();assert.equal(closed,1);
});

test('unsupported bitmap resizing, ordinary image objects and an unlimited budget preserve original textures',async()=>{
  for(const mode of ['no-api','reject','ignored-options','ordinary','unlimited']){
    const f=assetFixture();let closed=0,copyClosed=0,calls=0;const original={width:2048,height:1024,close(){closed++;}};
    if(mode==='ordinary')delete original.close;f.texture.image=original;
    const factory=mode==='no-api'?null:async()=>{calls++;if(mode==='reject')throw Error('resize unsupported');return {width:2048,height:1024,close(){copyClosed++;}};};
    const library=createModelAssetLibrary({load:async()=>f.asset,maxTextureSize:mode==='unlimited'?Infinity:1024,imageBitmapFactory:factory});
    await library.load('tree');assert.equal(f.texture.image,original);assert.equal(closed,0);assert.equal(calls,['no-api','ordinary','unlimited'].includes(mode)?0:1);
    assert.equal(copyClosed,mode==='ignored-options'?1:0);library.dispose();assert.equal(closed,mode==='ordinary'?0:1);
  }
});

test('fit uses uniform constrained scale, ground centering, nested selection transforms, and leaves the source unchanged',()=>{
  const f=assetFixture(),parent=new THREE.Group();parent.position.set(20,1,30);parent.scale.setScalar(2);parent.add(f.asset.scene);parent.updateMatrixWorld(true);
  const original=f.asset.scene.children[0].position.clone(),handle=fitModelAsset(f.asset,{height:2,width:3,depth:8});
  const box=new THREE.Box3().setFromObject(handle.root,true),size=box.getSize(new THREE.Vector3());assert.ok(Math.abs(size.y-2)<1e-6);assert.ok(size.x<=3&&size.z<=8);assert.ok(Math.abs(box.min.y)<1e-6);assert.ok(box.getCenter(new THREE.Vector3()).distanceTo(new THREE.Vector3(0,1,0))<1e-6);
  assert.deepEqual(f.asset.scene.children[0].position,original);assert.equal(handle.mixer,null);
  const selected=fitModelAsset(f.asset,{selector:'selected',width:1});assert.equal(selected.root.children[0].name,'selected');assert.ok(Math.abs(new THREE.Box3().setFromObject(selected.root,true).getSize(new THREE.Vector3()).x-1)<1e-6);
  assert.throws(()=>fitModelAsset(f.asset,{selector:'missing'}),/selector/);handle.dispose();selected.dispose();
  for(const resource of [f.geometry,f.material,f.texture])resource.dispose();
});

test('all selected supplied models decode with the local Draco WASM and preserve independent skeleton animation',async t=>{
  const load=await createNodeModelLoader(),library=createModelAssetLibrary({load});const handles=[];
  try{
    for(const id of Object.keys(MODEL_ASSETS)){
      const asset=await library.load(id);assert.ok(asset.scene.isObject3D);let triangles=0;
      asset.scene.traverse(object=>{if(object.isMesh){assert.ok(object.geometry.attributes.position.count>0);triangles+=(object.geometry.index?.count||object.geometry.attributes.position.count)/3;}});
      assert.ok(triangles>0);t.diagnostic(`${id}: ${Math.round(triangles)} unique mesh triangles`);
      if(id==='city'){
        for(const index of [10,14]){
          const original=asset.parser.associations;
          const handle=fitModelAsset(asset,{width:8,height:8,depth:8,selector:scene=>{let selected;scene.traverse(object=>{if(original.get(object)?.nodes===index)selected=object;});return selected;}});handles.push(handle);
          const bounds=new THREE.Box3().setFromObject(handle.root,true),size=bounds.getSize(new THREE.Vector3());assert.ok(size.x<=8.001&&size.y<=8.001&&size.z<=8.001);assert.equal(handle.mixer,null);
        }
      }else{
        const handle=fitModelAsset(asset,{height:2});handles.push(handle);const size=new THREE.Box3().setFromObject(handle.root,true).getSize(new THREE.Vector3());assert.ok(Math.abs(size.y-2)<.001,`${id} fits actual bounds`);
        if(id==='bird'||id==='pedestrian'){
          assert.ok(handle.mixer);assert.ok(asset.animations.length>0);const second=fitModelAsset(asset,{height:2});handles.push(second);
          const bones=[];handle.root.traverse(object=>{if(object.isBone)bones.push(object);});const other=[];second.root.traverse(object=>{if(object.isBone)other.push(object);});assert.ok(bones.length);assert.notEqual(bones[0],other[0]);
          const before=other.map(bone=>bone.quaternion.toArray());handle.mixer.clipAction(asset.animations[0]).play();handle.mixer.update(.3);assert.deepEqual(other.map(bone=>bone.quaternion.toArray()),before,'one instance does not animate another');
        }
      }
    }
  }finally{for(const handle of handles)handle.dispose();library.dispose();}
});

test('asset URLs remain local and resolve only allowlisted source files',()=>{
  for(const id of Object.keys(MODEL_ASSETS)){const url=modelAssetURL(id);assert.ok(url.pathname.endsWith('/assets/3d_models/'+MODEL_ASSETS[id].file));}
  assert.throws(()=>modelAssetURL('https://elsewhere.test/model.glb'),/Unknown/);
});
