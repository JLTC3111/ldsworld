import test from 'node:test';
import assert from 'node:assert/strict';
import { projects } from '../src/data.js';
import { roadNodes } from '../src/driving.js';
import { islandRadius,isWater,PROJECT_PLOTS } from '../src/world-layout.js';

test('project buildings occupy the six inner plots with clear parking and proportionate footprints',()=>{
  for(const project of projects){
    assert.ok(islandRadius(...project.position)<.55);assert.ok(Math.hypot(project.position[0]/100,project.position[1]/65)<.82,project.id);assert.deepEqual(project.position,PROJECT_PLOTS[project.id].position);assert.equal(isWater(...roadNodes[project.stop]),false,project.id);
    assert.ok(project.scale>=1.3&&project.scale<=1.8);
    const [x,z]=roadNodes[project.stop],dx=Math.max(0,Math.abs(x-project.position[0])-project.footprint[0]/2),dz=Math.max(0,Math.abs(z-project.position[1])-project.footprint[1]/2);
    assert.ok(Math.hypot(dx,dz)>2,`${project.id}: parking must clear the full car`);
    for(const other of projects)if(other!==project)assert.ok(Math.hypot(project.position[0]-other.position[0],project.position[1]-other.position[1])>25,'Inner plots stay distinct');
    const c=Math.abs(Math.cos(project.rotation)),s=Math.abs(Math.sin(project.rotation)),[width,depth]=project.baseFootprint;
    assert.ok(Math.abs(project.footprint[0]-((width+1.1)*c+(depth+1.1)*s)*project.scale)<1e-8);
    assert.ok(Math.abs(project.footprint[1]-((width+1.1)*s+(depth+1.1)*c)*project.scale)<1e-8);
  }
});
