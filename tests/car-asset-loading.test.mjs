import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { loadCarAssets, getCarAsset, CAR_ASSET_IDS } from '../src/car-assets.js';

test('overlapping garage requests share each model and failed loads can be retried',async()=>{
  const originalFetch=globalThis.fetch,originalWarn=console.warn,requests=[];
  const bytes=new Map(await Promise.all(CAR_ASSET_IDS.map(async id=>[id,await readFile(new URL(`../src/assets/cars/${id}.glb`,import.meta.url))])));
  let release,failPickup=true;const gate=new Promise(resolve=>release=resolve);
  globalThis.fetch=async url=>{
    const id=url.pathname.split('/').at(-1).replace('.glb','');requests.push(id);
    await gate;
    if(id==='toy-story'&&failPickup)return {ok:false,status:503};
    const data=bytes.get(id);return {ok:true,arrayBuffer:async()=>data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength)};
  };
  console.warn=()=>{};
  try{
    const first=loadCarAssets(['8-ball','8-ball']),second=loadCarAssets(['8-ball','monster-truck']);
    await Promise.resolve();assert.deepEqual(requests,['8-ball','monster-truck']);
    release();assert.deepEqual(await Promise.all([first,second]),[true,true]);
    assert.ok(getCarAsset('8-ball'));assert.ok(getCarAsset('monster-truck'));
    assert.equal(await loadCarAssets(['toy-story']),false);assert.equal(getCarAsset('toy-story'),null);
    failPickup=false;assert.equal(await loadCarAssets(['toy-story']),true);assert.ok(getCarAsset('toy-story'));
    assert.deepEqual(requests,['8-ball','monster-truck','toy-story','toy-story']);
    assert.equal(await loadCarAssets(),true);assert.equal(requests.length,4,'successful models are cached');
    assert.equal(await loadCarAssets(['explorer','unknown']),true);assert.equal(requests.length,4,'procedural cars need no network request');
  }finally{globalThis.fetch=originalFetch;console.warn=originalWarn;}
});
