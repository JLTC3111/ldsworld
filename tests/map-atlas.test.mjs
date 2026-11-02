import test from 'node:test';
import assert from 'node:assert/strict';
import {createMapAtlas,createMapPreview,encodeMapBitmap} from '../src/map-atlas.js';

test('atlas captures coalesce and every map view reuses a cached image until scenery changes',async()=>{
  let captures=0,resolve;const revoked=[];
  const atlas=createMapAtlas({capture(){captures++;return new Promise(done=>resolve=done);},createURL:blob=>'blob:'+blob.id,revokeURL:url=>revoked.push(url)});
  const a=atlas.capture(),b=atlas.capture();assert.equal(a,b);assert.equal(captures,0,'Capturing does not run in the caller stack');
  await Promise.resolve();assert.equal(captures,1);resolve({id:1});assert.equal(await a,'blob:1');
  for(let view=0;view<20;view++)assert.equal(await atlas.capture(),'blob:1');assert.equal(captures,1);
  atlas.invalidate();const next=atlas.capture();await Promise.resolve();assert.equal(atlas.getImage(),'blob:1','The last map remains available during refresh');resolve({id:2});assert.equal(await next,'blob:2');assert.deepEqual(revoked,['blob:1']);
  atlas.dispose();atlas.dispose();assert.deepEqual(revoked,['blob:1','blob:2']);assert.equal(await atlas.capture(),'');
});

test('failed and late captures keep the vector fallback and never leak object URLs',async()=>{
  let resolve,created=0;
  const atlas=createMapAtlas({capture:()=>new Promise(done=>resolve=done),createURL(){created++;return 'blob:late';}});
  const pending=atlas.capture();await Promise.resolve();atlas.dispose();resolve({});assert.equal(await pending,'');assert.equal(created,0);
  const failed=createMapAtlas({capture(){throw Error('Snapshot unsupported');}});assert.equal(await failed.capture(),'');assert.equal(failed.getImage(),'');failed.dispose();
});

test('bitmap encoding is asynchronous, bounded and releases the bitmap without synchronous PNG conversion',async()=>{
  let closed=0,drawn=0,resolve;
  const bitmap={close(){closed++;}},blob={type:'image/webp'},canvas={getContext(){return {drawImage(source,x,y,width,height){assert.equal(source,bitmap);assert.deepEqual([x,y,width,height],[0,0,1024,800]);drawn++;}};},convertToBlob(options){assert.deepEqual(options,{type:'image/webp',quality:.86});return new Promise(done=>resolve=done);}};
  const result=encodeMapBitmap(bitmap,{width:1024,height:800,canvas});assert.equal(drawn,1);assert.equal(closed,0);resolve(blob);assert.equal(await result,blob);assert.equal(closed,1);
  await assert.rejects(encodeMapBitmap(bitmap,{width:10,height:10,canvas:{getContext(){throw Error('Context lost');}}}));assert.equal(closed,2);
});

test('the dialog paints before optional capture and closing or replacing it cancels stale results',async()=>{
  let serial=0,captures=0,active=true,resolve;const frames=new Map(),shown=[];
  const preview=createMapPreview({request:callback=>{frames.set(++serial,callback);return serial;},cancel:id=>frames.delete(id),capture(){captures++;return new Promise(done=>resolve=done);},show:image=>shown.push(image),isActive:()=>active});
  const frame=()=>{const callbacks=[...frames.values()];frames.clear();callbacks.forEach(callback=>callback());};
  preview.refresh();assert.equal(captures,0);frame();assert.equal(captures,0,'The first dialog paint does not capture');frame();assert.equal(captures,1);
  preview.clear();resolve('blob:stale');await Promise.resolve();assert.deepEqual(shown,[]);
  preview.refresh();frame();frame();resolve('blob:ready');await Promise.resolve();assert.deepEqual(shown,['blob:ready']);
  active=false;preview.refresh();frame();frame();assert.equal(captures,2,'Hidden maps do not perform expensive work');
  active=true;preview.refresh();preview.dispose();assert.equal(frames.size,0);
});
