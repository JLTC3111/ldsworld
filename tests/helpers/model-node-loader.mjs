// Real vendored Draco WASM + production GLTFLoader, with worker messages routed
// in-process for Node. Only browser image decoding is replaced with textures.
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import * as THREE from '../../src/vendor/three.module.js';
import {GLTFLoader} from '../../src/vendor/GLTFLoader.js';
import {DRACOLoader} from '../../src/vendor/DRACOLoader.js';
import {MODEL_ASSETS} from '../../src/model-catalog.js';

export async function createNodeModelLoader(){
  const base=new URL('../../src/vendor/draco/',import.meta.url),source=await readFile(new URL('draco_wasm_wrapper.js',base),'utf8');
  const factory=Function('require','__dirname','module','exports',source+';return DracoDecoderModule;')(createRequire(import.meta.url),fileURLToPath(base),{exports:{}},{});
  const loaderSource=await readFile(new URL('../../src/vendor/DRACOLoader.js',import.meta.url),'utf8');
  const workerSource=loaderSource.slice(loaderSource.indexOf('function DRACOWorker()'),loaderSource.lastIndexOf('export { DRACOLoader }'));
  const callbacks=new Map(),geometryLoader=new DRACOLoader();let serial=0;
  const scope={Float32Array,Int8Array,Int16Array,Int32Array,Uint8Array,Uint16Array,Uint32Array,postMessage(message){const callback=callbacks.get(message.id);callbacks.delete(message.id);if(message.type==='error')callback.reject(Error(message.error));else callback.resolve(geometryLoader._createGeometry(message.geometry));}};
  const message=Function('DracoDecoderModule','self','let onmessage;'+workerSource+';DRACOWorker();return event=>onmessage(event);')(factory,scope);
  message({data:{type:'init',decoderConfig:{wasmBinary:await readFile(new URL('draco_decoder.wasm',base))}}});
  const decoder={preload(){},decodeDracoFile(buffer,onLoad,attributeIDs,attributeTypes,vertexColorSpace,onError){const id=++serial;const promise=new Promise((resolve,reject)=>callbacks.set(id,{resolve,reject}));promise.then(onLoad,onError);message({data:{type:'decode',id,buffer,taskConfig:{attributeIDs,attributeTypes,vertexColorSpace,useUniqueIDs:true}}});}};
  const loader=new GLTFLoader().setDRACOLoader(decoder);
  loader.pluginCallbacks.unshift(()=>({name:'NodeTextureFallback',loadTexture:()=>Promise.resolve(new THREE.Texture())}));
  return async id=>{
    const bytes=await readFile(new URL(`../../src/assets/3d_models/${MODEL_ASSETS[id].file}`,import.meta.url));
    return loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  };
}
