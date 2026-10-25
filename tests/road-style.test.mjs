import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../src/vendor/three.module.js';
import { createRoadCurve,createRoadGeometry,roadSvgPath } from '../src/road-style.js';
import { isWater,isRiver,riverCenter,bridgeAt,RIVER_HALF_WIDTH } from '../src/world-layout.js';

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

test('the map road follows the smooth scene curve rather than straight polygon corners',()=>{
  const points=[[-10,-20],[0,-35],[20,-20],[0,-10]],path=roadSvgPath(points,true);
  assert.match(path,/^M-10\.00,-20\.00L/);assert.ok(path.endsWith('Z'));assert.ok(path.split('L').length>20);assert.doesNotMatch(path,/NaN|Infinity/);
  assert.ok(!roadSvgPath(points,false).endsWith('Z'));
});
