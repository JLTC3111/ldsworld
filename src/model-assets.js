import * as THREE from './vendor/three.module.js';
import {GLTFLoader} from './vendor/GLTFLoader.js';
import {DRACOLoader} from './vendor/DRACOLoader.js';
import {clone as cloneSkeleton} from './vendor/SkeletonUtils.js';
import {MODEL_ASSETS} from './model-catalog.js';
export {MODEL_ASSETS} from './model-catalog.js';

const revision=new URL(import.meta.url).searchParams.get('v');
export function modelAssetURL(id){
  const entry=Object.hasOwn(MODEL_ASSETS,id)&&MODEL_ASSETS[id];
  if(!entry)throw new RangeError(`Unknown model asset: ${id}`);
  const url=new URL(`./assets/3d_models/${entry.file}`,import.meta.url);
  if(revision)url.searchParams.set('v',revision);return url;
}

function ownedResources(asset){
  const resources=new Set();
  for(const scene of asset.scenes?.length?asset.scenes:[asset.scene])scene?.traverse(object=>{
    if(object.geometry)resources.add(object.geometry);
    if(object.skeleton)resources.add(object.skeleton);
    for(const material of object.material?Array.isArray(object.material)?object.material:[object.material]:[]){
      resources.add(material);for(const value of Object.values(material))if(value?.isTexture){
        resources.add(value);const image=value.source?.data||value.image;if(typeof image?.close==='function')resources.add(image);
      }
    }
  });
  return resources;
}

/** Session-owned source assets. No global cache or eager decoder/asset downloads. */
export function createModelAssetLibrary({load,fetch:fetcher=globalThis.fetch,maxTextureSize=1024,imageBitmapFactory=globalThis.createImageBitmap?.bind(globalThis)}={}){
  const cached=new Map(),pending=new Map(),owned=new Set(),released=new WeakSet(),controller=new AbortController();
  const imageReplacements=new WeakMap(),textureLimit=Number.isFinite(maxTextureSize)&&maxTextureSize>0?Math.max(1,Math.floor(maxTextureSize)):Infinity;
  let disposed=false,decoder=null,loader=null;
  const release=resources=>{for(const resource of resources)if(!released.has(resource)){released.add(resource);if(resource.dispose)resource.dispose();else resource.close?.();}};
  function pointTextures(textures,image){for(const texture of textures){texture.image=image;texture.needsUpdate=true;}}
  async function limitTextures(asset){
    if(typeof imageBitmapFactory!=='function'||textureLimit===Infinity)return;
    const images=new Map();
    for(const resource of ownedResources(asset))if(resource.isTexture){
      const image=resource.image;if(!image||typeof image.close!=='function')continue;
      if(!images.has(image))images.set(image,new Set());images.get(image).add(resource);
    }
    const replacements=[];
    for(const [image,textures]of images){
      let record=imageReplacements.get(image);
      if(record){
        for(const texture of textures)record.textures.add(texture);
        if(record.image)pointTextures(textures,record.image);replacements.push(record.promise);continue;
      }
      if(!(image.width>0&&image.height>0)||Math.max(image.width,image.height)<=textureLimit)continue;
      const ratio=textureLimit/Math.max(image.width,image.height),resizeWidth=Math.max(1,Math.round(image.width*ratio)),resizeHeight=Math.max(1,Math.round(image.height*ratio));
      record={textures,image:null,promise:null};imageReplacements.set(image,record);
      record.promise=Promise.resolve().then(()=>imageBitmapFactory(image,{resizeWidth,resizeHeight,resizeQuality:'high',premultiplyAlpha:'none',colorSpaceConversion:'none'})).then(bitmap=>{
        // Older implementations can ignore resizing options. Keep the original
        // usable image when resizing is unsupported or unexpectedly fails.
        if(!bitmap||bitmap===image||!(bitmap.width>0&&bitmap.height>0)||Math.max(bitmap.width,bitmap.height)>textureLimit){if(bitmap&&bitmap!==image)release([bitmap]);return;}
        record.image=bitmap;pointTextures(record.textures,bitmap);release([image]);
      }).catch(()=>{});
      replacements.push(record.promise);
    }
    await Promise.all(replacements);
  }
  function disposeDecoder(){if(disposed&&pending.size===0){decoder?.dispose();decoder=null;loader=null;}}
  async function defaultLoad(id){
    if(!loader){
      const manager=new THREE.LoadingManager();
      manager.setURLModifier(value=>{
        const url=new URL(value,import.meta.url);
        if(revision&&url.pathname.includes('/vendor/draco/'))url.searchParams.set('v',revision);return url.href;
      });
      decoder=new DRACOLoader(manager).setDecoderPath(new URL('./vendor/draco/',import.meta.url).href).setDecoderConfig({type:'wasm'}).setWorkerLimit(1);
      loader=new GLTFLoader(manager).setDRACOLoader(decoder);
    }
    const response=await fetcher(modelAssetURL(id),{signal:controller.signal});
    if(!response.ok)throw new Error(`Model ${id}: ${response.status}`);
    return loader.parseAsync(await response.arrayBuffer(),'');
  }
  return {
    load(id){
      if(disposed)return Promise.reject(new Error('Model asset library is disposed'));
      if(!Object.hasOwn(MODEL_ASSETS,id))return Promise.reject(new RangeError(`Unknown model asset: ${id}`));
      if(cached.has(id))return Promise.resolve(cached.get(id));
      if(pending.has(id))return pending.get(id);
      const request=Promise.resolve().then(()=>{
        if(disposed)throw new Error('Model asset library is disposed');
        return load?load(id,MODEL_ASSETS[id]):defaultLoad(id);
      }).then(async asset=>{
        if(!asset?.scene?.isObject3D)throw new TypeError(`Model ${id} has no scene`);
        await limitTextures(asset);
        const resources=ownedResources(asset);
        if(disposed){release(resources);throw new Error('Model asset library is disposed');}
        for(const resource of resources)owned.add(resource);
        const result={...asset,animations:asset.animations||[]};cached.set(id,result);return result;
      }).finally(()=>{pending.delete(id);disposeDecoder();});
      pending.set(id,request);return request;
    },
    dispose(){
      // Call after disposing instance handles: source textures/geometries are
      // shared, while decoded ImageBitmaps also need explicit CPU-side release.
      if(disposed)return;disposed=true;controller.abort();cached.clear();release(owned);owned.clear();
      // Let already-started Draco tasks settle before terminating their worker;
      // terminating mid-decode would strand the loader's pending promises.
      disposeDecoder();
    }
  };
}

/** Independent skeleton and mixer, shared immutable mesh/material/texture data. */
export function fitModelAsset(asset,{height,width,depth,selector}={}){
  if(!asset?.scene?.isObject3D)throw new TypeError('A loaded model scene is required');
  asset.scene.updateMatrixWorld(true);
  const source=typeof selector==='function'?selector(asset.scene):typeof selector==='string'?asset.scene.getObjectByName(selector):asset.scene;
  if(!source?.isObject3D)throw new RangeError('Model selector did not match an object');
  const content=cloneSkeleton(source),root=new THREE.Group();root.name=`Supplied ${source.name||'model'}`;
  if(source!==asset.scene)source.matrixWorld.decompose(content.position,content.quaternion,content.scale);
  root.add(content);root.updateMatrixWorld(true);
  const skeletons=new Set();content.traverse(object=>{if(object.isSkinnedMesh){skeletons.add(object.skeleton);object.skeleton.update();}});
  const bounds=new THREE.Box3().setFromObject(content,true),size=bounds.getSize(new THREE.Vector3()),center=bounds.getCenter(new THREE.Vector3());
  const scales=[[width,size.x],[height,size.y],[depth,size.z]].filter(([limit,extent])=>Number.isFinite(limit)&&limit>0&&extent>0).map(([limit,extent])=>limit/extent);
  const scale=scales.length?Math.min(...scales):1;
  if(!bounds.isEmpty()){content.position.x-=center.x;content.position.y-=bounds.min.y;content.position.z-=center.z;}
  root.scale.setScalar(scale);root.updateMatrixWorld(true);
  const animations=source===asset.scene?asset.animations||[]:[],mixer=animations.length?new THREE.AnimationMixer(content):null;
  let disposed=false;
  return {root,mixer,animations,dispose(){if(disposed)return;disposed=true;mixer?.stopAllAction();mixer?.uncacheRoot(content);for(const skeleton of skeletons)skeleton.dispose();root.removeFromParent();}};
}
