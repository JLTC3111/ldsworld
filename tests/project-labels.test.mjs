import test from 'node:test';import assert from 'node:assert/strict';
import * as THREE from '../src/vendor/three.module.js';
import { projects } from '../src/data.js';
import { createProjectLabels,projectLabelText } from '../src/project-labels.js';
test('each real project gets finite extruded rooftop lettering with Vietnamese accents and camera-facing orientation',()=>{
  const scene=new THREE.Scene(),buildings=projects.map(p=>{const b=new THREE.Mesh(new THREE.BoxGeometry(5,6,4),new THREE.MeshStandardMaterial());b.userData.projectId=p.id;b.position.set(p.position[0],3,p.position[1]);scene.add(b);return b;}),labels=createProjectLabels({THREE,scene,projects,buildings});
  assert.equal(labels.labels.length,6);assert.ok(labels.root.userData.physicsIgnore);
  for(const language of ['en','vi']){labels.setLanguage(language);labels.update({yaw:1.1,night:1});for(const label of labels.labels){assert.ok(label.position.y>6);assert.equal(label.rotation.y,1.1);assert.ok(label.name.includes(projectLabelText(projects.find(p=>p.id===label.userData.projectId),language)));label.traverse(o=>{if(o.geometry){assert.ok(['ExtrudeGeometry','BoxGeometry'].includes(o.geometry.type));for(const n of o.geometry.attributes.position.array)assert.ok(Number.isFinite(n));}});}}
  assert.match(projectLabelText(projects[4],'vi'),/HỘI/);const owned=new Set();labels.root.traverse(o=>{if(o.geometry)owned.add(o.geometry);for(const m of o.material?Array.isArray(o.material)?o.material:[o.material]:[])owned.add(m);});let releases=0;owned.forEach(r=>r.addEventListener('dispose',()=>releases++));labels.dispose();labels.dispose();assert.equal(releases,owned.size);
});
