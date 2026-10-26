import * as T from './vendor/three.module.js';
import { GLTFLoader } from './vendor/GLTFLoader.js';
import { vehicleModel } from './vehicle-models.js';
import { suppliedCarFinish } from './car-finishes.js';
const assets=new Map(),loading=new Map();
export const CAR_ASSET_IDS=['8-ball','monster-truck','toy-story'];
export async function registerCarAsset(id,bytes){
  if(!CAR_ASSET_IDS.includes(id))throw new Error(`Unknown car asset ${id}`);
  const gltf=await new GLTFLoader().parseAsync(bytes,'');
  const scene=gltf.scene;scene.traverse(o=>{if(o.name.startsWith('display_base'))o.visible=false;});
  assets.set(id,scene);return scene;
}
export function getCarAsset(id){return assets.get(id)||null;}
export function loadCarAssets(ids=CAR_ASSET_IDS){
  const selected=ids.filter(id=>CAR_ASSET_IDS.includes(id)),key=selected.join(',');
  if(loading.has(key))return loading.get(key);
  const result=Promise.allSettled(selected.map(async id=>{
    if(assets.has(id))return;
    const url=new URL(`./assets/cars/${id}.glb`,import.meta.url),revision=new URL(import.meta.url).searchParams.get('v');if(revision)url.searchParams.set('v',revision);
    const response=await fetch(url);if(!response.ok)throw new Error(`Car model ${id}: ${response.status}`);
    await registerCarAsset(id,await response.arrayBuffer());
  })).then(results=>{results.forEach((r,i)=>{if(r.status==='rejected')console.warn(`Using the local fallback for ${selected[i]}.`,r.reason);});return results.every(r=>r.status==='fulfilled');});
  loading.set(key,result);return result;
}

// Prepare in island coordinates (+Y up, +Z forward), retaining the source's
// axle pivots and proportions. Each live copy owns its geometries/materials.
export function cloneCarAsset(id){
  const source=assets.get(id);if(!source)return null;
  const config=vehicleModel(id),clone=source.clone(true),geometries=new Map(),materials=new Map(),meshes=[];
  clone.traverse(o=>{if(o.isMesh){if(o.name.startsWith('display_base')){o.visible=false;return;}meshes.push(o);
    if(!geometries.has(o.geometry))geometries.set(o.geometry,o.geometry.clone());o.geometry=geometries.get(o.geometry);
    if(!materials.has(o.material)){
      const old=o.material,finish=suppliedCarFinish(id,o.name,old),{visibilityPaint,...properties}=finish;
      const material=new T.MeshPhysicalMaterial({...properties,emissive:visibilityPaint?properties.color:0,side:old.side});material.name=old.name||o.name;material.userData.visibilityPaint=visibilityPaint;materials.set(o.material,material);
    }o.material=materials.get(o.material);o.castShadow=o.receiveShadow=true;
  }});
  const orient=new T.Group();orient.name=`Supplied ${config.name} GLB`;orient.add(clone);
  orient.quaternion.setFromRotationMatrix(new T.Matrix4().set(0,-1,0,0,0,0,1,0,-1,0,0,0,0,0,0,1));orient.updateMatrixWorld(true);
  const bounds=new T.Box3();for(const mesh of meshes)bounds.expandByObject(mesh);const size=bounds.getSize(new T.Vector3());
  const scale=Math.min(config.profile.halfWidth*2/size.x,config.profile.halfLength*2/size.z);orient.scale.setScalar(scale);orient.updateMatrixWorld(true);bounds.makeEmpty();for(const mesh of meshes)bounds.expandByObject(mesh);const centre=bounds.getCenter(new T.Vector3());
  orient.position.set(-centre.x,.08-bounds.min.y,-centre.z);orient.updateMatrixWorld(true);
  return {orient,meshes,height:size.y*scale+.08,geometries:new Set(geometries.values()),materials:new Set(materials.values())};
}
