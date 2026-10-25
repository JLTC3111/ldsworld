import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../src/vendor/three.module.js';
import { createWayfinding,TOWN_CENTER,outerTownDirections,townRouteCost } from '../src/wayfinding.js';
import { roadNodes,outerRoadLoop } from '../src/driving.js';
import { collectWorldColliders } from '../src/world-physics.js';

function fixture(){const old=Object.getOwnPropertyDescriptor(globalThis,'document');Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement:()=>{const context={fillRect(){},fillText(text){this.text=text;}};return {getContext:()=>context};}}});try{const scene=new THREE.Scene();return{scene,signs:createWayfinding({THREE,scene})};}finally{if(old)Object.defineProperty(globalThis,'document',old);else delete globalThis.document;}}

test('outer-road arrows follow the shortest road toward town, while every connector points inward',()=>{
  const {signs}=fixture();assert.ok(signs.arrows.length>=24&&signs.arrows.length<40);assert.equal(signs.boards.length,4);
  for(let i=0;i<12;i++){const next=(i+1)%12;assert.equal(outerTownDirections[i],townRouteCost(`o${next}`)<townRouteCost(`o${i}`)?1:-1);}
  for(const arrow of signs.arrows){const data=arrow.userData.townArrow,forward=new THREE.Vector3(0,0,1).applyQuaternion(arrow.quaternion);assert.ok(Number.isFinite(data.heading));if(data.kind==='town-connector')assert.ok(forward.x*(TOWN_CENTER.x-data.x)+forward.z*(TOWN_CENTER.z-data.z)>0);const geometry=arrow.children[0].geometry;for(let i=0;i<geometry.attributes.normal.count;i++)assert.ok(geometry.attributes.normal.getY(i)>.99);}
  for(const key of Object.keys(roadNodes).filter(key=>key.startsWith('o')))assert.ok(outerRoadLoop.includes(roadNodes[key]));signs.dispose();
});

test('town signs support Vietnamese, keep lane centres clear, brighten at night and dispose all owned assets',()=>{
  const {scene,signs}=fixture();assert.ok(signs.boards.every(b=>b.canvas.getContext('2d').text==='TOWN ↑'));signs.setLanguage('vi');assert.ok(signs.boards.every(b=>b.canvas.getContext('2d').text==='THỊ TRẤN ↑'));
  scene.updateMatrixWorld(true);const contacts=collectWorldColliders({THREE,roots:[signs.root]});assert.equal(contacts.length,12,'Only the roadside boards and posts should collide; painted arrows stay driveable');
  signs.update({night:0});const day=signs.arrows[0].children[1].material.emissiveIntensity;signs.update({night:1});assert.ok(signs.arrows[0].children[1].material.emissiveIntensity>day);
  const geometries=new Set(),materials=new Set(),textures=new Set();signs.root.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material){materials.add(o.material);if(o.material.map)textures.add(o.material.map);}});let released=0;for(const r of [...geometries,...materials,...textures])r.addEventListener('dispose',()=>released++);signs.dispose();signs.dispose();assert.equal(released,geometries.size+materials.size+textures.size);assert.ok(!scene.children.includes(signs.root));
});
