import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../src/vendor/three.module.js';
import { VEHICLE_SCALE } from '../src/vehicle-scale.js';
import { buildShowcaseModel, createShowcase, createShowcaseScreenTexture, getShowcaseScreenContent, wrapShowcaseText, resolveShowcasePoster, hitShowcaseScreen, isShowcaseScreenTap, SUPPLIED_COMPUTER_FIT, SUPPLIED_COMPUTER_SCREEN,frameShowcaseCamera } from '../src/showcase.js';
import { projects } from '../src/data.js';
import {fitModelAsset,createModelAssetLibrary} from '../src/model-assets.js';
import {createNodeModelLoader} from './helpers/model-node-loader.mjs';

function resources(root) {
  const geometries=new Set(),materials=new Set();
  root.traverse(object=>{if(object.geometry)geometries.add(object.geometry);for(const material of Array.isArray(object.material)?object.material:object.material?[object.material]:[])materials.add(material);});
  return {geometries,materials};
}
function withCanvas(callback) {
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'document');
  Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement(type){assert.equal(type,'canvas');return{width:0,height:0,getContext(){return{fillRect(){},fillText(){}};}};}}});
  try{return callback();}finally{if(descriptor)Object.defineProperty(globalThis,'document',descriptor);else delete globalThis.document;}
}
function withScreenCanvas(callback, { missing = false } = {}) {
  const descriptor=Object.getOwnPropertyDescriptor(globalThis,'document'),canvases=[];
  Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement(type){
    assert.equal(type,'canvas');const canvas={width:0,height:0,text:[],rects:[]};
    const size=()=>Number(context.font.match(/([\d.]+)px/)?.[1]||16);
    const context={font:'16px sans-serif',measureText(value){return{width:Array.from(value).length*size()*.55};},fillText(value,x,y){canvas.text.push({value,x,y,width:this.measureText(value).width,size:size(),color:this.fillStyle});},fillRect(x,y,width,height){canvas.rects.push({x,y,width,height,color:this.fillStyle});}};
    canvas.getContext=()=>missing?null:context;canvases.push(canvas);return canvas;
  }}});
  try{return callback(canvases);}finally{if(descriptor)Object.defineProperty(globalThis,'document',descriptor);else delete globalThis.document;}
}

test('every project has a bounded physical display using its real preview texture',()=>{
  const signature=[];
  for(const project of projects){
    const texture=new THREE.Texture();const model=buildShowcaseModel({project,texture});
    assert.equal(model.screenMaterial.map,texture);
    assert.ok(model.root.getObjectByName('Original project preview'));
    assert.ok(!model.focusBounds.isEmpty());
    const size=model.focusBounds.getSize(new THREE.Vector3());
    assert.ok(size.x>3&&size.x<7,`${project.id} width ${size.x}`);assert.ok(size.y>2&&size.y<5,`${project.id} height ${size.y}`);
    let meshCount=0,triangles=0;
    model.root.traverse(object=>{
      if(!object.isMesh)return;meshCount++;
      for(const value of object.geometry.attributes.position.array)assert.ok(Number.isFinite(value));
      if(object.isInstancedMesh)for(const value of object.instanceMatrix.array)assert.ok(Number.isFinite(value));
      triangles+=(object.geometry.index?.count||object.geometry.attributes.position.count)/3*(object.count||1);
    });
    assert.ok(meshCount>10&&meshCount<110);assert.ok(triangles<45000,`${project.id} should stay light: ${triangles} triangles`);
    signature.push(meshCount);model.dispose();texture.dispose();
  }
  assert.ok(new Set(signature).size>3,'Project artifacts should differ beyond their screen image');
});

test('screen textures can be replaced without fabricating interface content or taking caller ownership',()=>{
  const first=new THREE.Texture(),second=new THREE.Texture();let disposals=0;
  first.addEventListener('dispose',()=>disposals++);second.addEventListener('dispose',()=>disposals++);
  const model=buildShowcaseModel({project:projects[0],texture:first});model.setTexture(second);
  assert.equal(model.screenMaterial.map,second);model.setTexture(null);assert.equal(model.screenMaterial.map,null);
  model.dispose();assert.equal(disposals,0);first.dispose();second.dispose();
});

test('workbench and contact artifacts construct finite geometry without a renderer',()=>{
  for(const mode of ['workbench','mail']){
    const model=buildShowcaseModel({project:projects[5],mode});
    const size=model.focusBounds.getSize(new THREE.Vector3());assert.ok(size.x>3&&size.y>2);
    model.root.traverse(object=>{if(object.geometry)for(const value of object.geometry.attributes.position.array)assert.ok(Number.isFinite(value));});
    model.setTheme(true);model.update(.1,2);model.dispose();
  }
});

test('the car showcase reuses the detailed vehicle and honors headlight modes while parked',()=>withCanvas(()=>{
  const model=buildShowcaseModel({mode:'car'});assert.ok(model.root.getObjectByName('Long D. Explorer'));
  const lights=[];model.root.traverse(object=>{if(object.isSpotLight)lights.push(object);});assert.equal(lights.length,2);
  model.setTheme(true);model.setHeadlights('on');model.update(.1,0);assert.ok(lights.every(light=>light.intensity>20*VEHICLE_SCALE**2));
  model.setHeadlights('off');model.update(.1,1);assert.ok(lights.every(light=>light.intensity===0));model.dispose();
}));

test('artifact disposal releases owned geometry and materials once',()=>{
  const model=buildShowcaseModel({project:projects[1]});const tracked=resources(model.root);let geometries=0,materials=0;
  tracked.geometries.forEach(geometry=>geometry.addEventListener('dispose',()=>geometries++));tracked.materials.forEach(material=>material.addEventListener('dispose',()=>materials++));
  model.dispose();model.dispose();assert.equal(geometries,tracked.geometries.size);assert.equal(materials,tracked.materials.size);
});

class Container extends EventTarget {
  clientWidth=0;clientHeight=0;dataset={};classes=new Set();
  classList={add:value=>this.classes.add(value),remove:value=>this.classes.delete(value)};
  append(){throw new Error('A hidden stage should not create a renderer');}
}
test('hidden/mobile stages do not create WebGL and leave the poster fallback visible',()=>{
  const container=new Container();const controller=createShowcase({container,project:projects[0]});
  assert.equal(container.dataset.ready,'false');assert.ok(!container.classes.has('showcase-ready'));
  controller.setProject(projects[1]);controller.setMode('mail');controller.setTheme(true);controller.setHeadlights('off');controller.resetView();controller.dispose();controller.dispose();
  assert.equal(container.dataset.ready,'false');
});

test('an unavailable WebGL context leaves a safe reusable controller and visible fallback',()=>{
  const container=new Container();container.clientWidth=500;container.clientHeight=400;
  const controller=createShowcase({container,project:projects[0]});assert.equal(container.dataset.ready,'false');
  controller.setProject(projects[1]);controller.setMode('workbench');controller.setTheme(false);controller.resetView();controller.dispose();
  assert.ok(!container.classes.has('showcase-ready'));
});

test('information screens use real English and Vietnamese project facts and fit inside the physical display',()=>withScreenCanvas(canvases=>{
  for(const project of projects)for(const language of ['en','vi'])for(const screen of ['project','stack']){
    const texture=createShowcaseScreenTexture({project,language,screen,height:606});
    assert.ok(texture.isCanvasTexture);assert.equal(texture.colorSpace,THREE.SRGBColorSpace);
    const content=texture.userData.showcase.content;
    assert.equal(content.title,language==='vi'?project.vi.title:project.title);assert.equal(content.year,project.year);assert.deepEqual(content.tech,project.tech);
    const canvas=canvases.at(-1);assert.ok(canvas.text.length>3);
    for(const line of canvas.text){assert.ok(line.x>=62);assert.ok(line.x+line.width<=canvas.width-62+.001,`${line.value} stays within the screen`);assert.ok(line.y>=0&&line.y+line.size<canvas.height);}
    if(screen==='stack')assert.ok(project.tech.every(tool=>canvas.text.some(line=>line.value===tool)),'Every supplied tool is visible');
    texture.dispose();
  }
}));

test('unbroken titles, long descriptions, and oversized tool lists are clipped intentionally rather than escaping',()=>withScreenCanvas(canvases=>{
  const project={title:'W'.repeat(200),description:'A long description with detail. '.repeat(100),tech:Array.from({length:14},(_,index)=>`Tool ${index} ${'X'.repeat(90)}`)};
  for(const screen of ['project','stack']){
    const texture=createShowcaseScreenTexture({project,screen,height:606});const canvas=canvases.at(-1);
    assert.ok(canvas.text.some(line=>line.value.endsWith('…')));
    for(const line of canvas.text){assert.ok(line.x+line.width<=canvas.width-62+.001);assert.ok(line.y+line.size<canvas.height);}
    if(screen==='stack')assert.ok(canvas.text.some(line=>line.value==='+6 more'));
    texture.dispose();
  }
  const context={measureText(value){return{width:value.length*10};}};
  assert.deepEqual(wrapShowcaseText(context,'One two three',70,{maxLines:2}),['One two','three']);
  assert.deepEqual(getShowcaseScreenContent({title:'Only the title'}),{title:'Only the title',description:'',category:'',year:'',tech:[]});
}));

test('light and dark information screens maintain readable text contrast on their actual canvas surfaces',()=>withScreenCanvas(canvases=>{
  const luminance=hex=>{const rgb=hex.slice(1).match(/../g).map(value=>parseInt(value,16)/255).map(value=>value<=.04045?value/12.92:((value+.055)/1.055)**2.4);return rgb[0]*.2126+rgb[1]*.7152+rgb[2]*.0722;};
  for(const night of [false,true])for(const screen of ['project','stack']){
    const texture=createShowcaseScreenTexture({project:projects[0],screen,night});const canvas=canvases.at(-1);
    for(const line of canvas.text){
      const surface=canvas.rects.findLast(rect=>rect.x<=line.x&&rect.y<=line.y&&rect.x+rect.width>=line.x+line.width&&rect.y+rect.height>=line.y+line.size);
      assert.ok(surface);const a=luminance(line.color),b=luminance(surface.color);assert.ok((Math.max(a,b)+.05)/(Math.min(a,b)+.05)>=4.5,`${line.value} has sufficient contrast`);
    }
    texture.dispose();
  }
}));

test('information textures refresh for theme, language, and selection and release ownership exactly once',()=>withScreenCanvas(()=>{
  const preview=new THREE.Texture(),disposals=new Map();let previewDisposals=0;preview.addEventListener('dispose',()=>previewDisposals++);
  const model=buildShowcaseModel({project:projects[0],mode:'workbench',texture:preview,screen:'project'});
  const track=()=>{const texture=model.screenMaterial.map;disposals.set(texture,0);texture.addEventListener('dispose',()=>disposals.set(texture,disposals.get(texture)+1));return texture;};
  const first=track();assert.equal(first.userData.showcase.screen,'project');assert.ok(model.screenReady);
  model.setScreen('stack');const second=track();assert.equal(disposals.get(first),1);assert.equal(second.userData.showcase.screen,'stack');
  model.setTheme(true);const third=track();assert.equal(disposals.get(second),1);assert.equal(third.userData.showcase.night,true);
  model.setLanguage('vi');const fourth=track();assert.equal(disposals.get(third),1);assert.equal(fourth.userData.showcase.content.title,projects[0].vi.title);
  model.setTexture(preview);assert.equal(model.screenMaterial.map,fourth);model.setScreen('preview');assert.equal(disposals.get(fourth),1);assert.equal(model.screenMaterial.map,preview);
  model.setScreen('project');track();model.dispose();model.dispose();
  assert.ok([...disposals.values()].every(count=>count===1));assert.equal(previewDisposals,0);preview.dispose();
}));

test('missing canvas contexts retain the real preview without claiming an empty screen is ready',()=>withScreenCanvas(()=>{
  assert.equal(createShowcaseScreenTexture({project:projects[0]}),null);
  const model=buildShowcaseModel({project:projects[0],screen:'project'});assert.equal(model.screenReady,false);assert.equal(model.getScreen(),'project');
  const preview=new THREE.Texture();model.setTexture(preview);assert.equal(model.screenMaterial.map,preview);assert.equal(model.screenReady,true);
  model.dispose();preview.dispose();
},{missing:true}));

test('screen raycasting hits the monitor surface and ignores the surrounding artifact and outside points',()=>{
  const model=buildShowcaseModel({project:projects[0]});
  const center=model.screen.getWorldPosition(new THREE.Vector3()),normal=new THREE.Vector3(0,0,1).transformDirection(model.screen.matrixWorld);
  const camera=new THREE.PerspectiveCamera(40,1,.1,100);camera.position.copy(center).addScaledVector(normal,8);camera.lookAt(center);camera.updateProjectionMatrix();
  const rect={left:20,top:30,width:600,height:600};
  assert.equal(hitShowcaseScreen({model,camera,clientX:320,clientY:330,rect}),true);
  assert.equal(hitShowcaseScreen({model,camera,clientX:22,clientY:32,rect}),false);
  assert.equal(hitShowcaseScreen({model,camera,clientX:10,clientY:330,rect}),false);
  assert.equal(hitShowcaseScreen({model:{root:model.root,screen:null},camera,clientX:320,clientY:330,rect}),false);model.dispose();
});

test('the actual image is the first visible opaque surface of every monitor, ahead of its beveled frame',()=>{
  const cases=[...projects.map(project=>({project,mode:'device'})),{project:projects[0],mode:'workbench'}];
  for(const {project,mode} of cases){
    const model=buildShowcaseModel({project,mode});model.root.rotation.set(.08,.35,0);model.root.updateMatrixWorld(true);
    const center=model.screen.getWorldPosition(new THREE.Vector3());
    for(const offset of [[0,0,8],[5,3.3,8]]){
      const origin=model.screen.localToWorld(new THREE.Vector3(...offset));
      const raycaster=new THREE.Raycaster(origin,center.clone().sub(origin).normalize());
      const first=raycaster.intersectObjects(model.root.children,true).find(hit=>hit.object.isMesh&&!hit.object.material.transparent&&hit.object.material.opacity>0);
      assert.equal(first?.object,model.screen,`${project.id}/${mode} exposes its image from ${offset.join(',')}`);
    }
    model.dispose();
  }
});

test('a screen tap can activate while rotations, cancelled gestures, and other pointers cannot',()=>{
  const gesture={id:3,x:100,y:120,screen:true,dragged:false};const event={type:'pointerup',pointerId:3,clientX:102,clientY:121};
  assert.equal(isShowcaseScreenTap(gesture,event),true);
  assert.equal(isShowcaseScreenTap({...gesture,dragged:true},event),false);
  assert.equal(isShowcaseScreenTap({...gesture,screen:false},event),false);
  assert.equal(isShowcaseScreenTap(gesture,{...event,type:'pointercancel'}),false);
  assert.equal(isShowcaseScreenTap(gesture,{...event,pointerId:4}),false);
  assert.equal(isShowcaseScreenTap(gesture,{...event,clientX:110}),false);
});

test('screen selection survives project changes and fallback rendering while callbacks report only valid changes',()=>{
  const container=new Container(),changes=[];
  const controller=createShowcase({container,project:projects[0],screen:'project',onScreenChange:value=>changes.push(value)});
  assert.equal(controller.getScreen(),'project');controller.setScreen('stack');controller.setScreen('stack');controller.setScreen('invalid');
  controller.setProject({...projects[2],language:'vi',poster:'./src/assets/posters/contracts-vi.jpg'});controller.setLanguage('en');
  assert.equal(controller.getScreen(),'stack');assert.equal(container.dataset.screen,'stack');assert.deepEqual(changes,['stack']);
  controller.setScreen('preview');assert.deepEqual(changes,['stack','preview']);controller.dispose();controller.setScreen('project');assert.equal(controller.getScreen(),'preview');
  assert.equal(resolveShowcasePoster({poster:'./src/assets/posters/contracts-vi.jpg'},'https://portfolio.test/'),'https://portfolio.test/src/assets/posters/contracts-vi.jpg');
  assert.ok(resolveShowcasePoster({id:'hr'}).endsWith('/src/assets/posters/hr.jpg'));
});

test('configured monitor modes normalize old selections and reject disallowed Preview changes',()=>{
  const container=new Container(),changes=[];
  const controller=createShowcase({container,screen:'preview',screenModes:['project','stack','project','invalid'],onScreenChange:value=>changes.push(value)});
  assert.equal(controller.getScreen(),'project');assert.equal(container.dataset.screen,'project');
  controller.setScreen('preview');assert.equal(controller.getScreen(),'project');assert.deepEqual(changes,[]);
  controller.setScreen('stack');controller.setProject(projects[2]);assert.equal(controller.getScreen(),'stack');
  controller.setScreen('preview');assert.equal(controller.getScreen(),'stack');assert.deepEqual(changes,['stack']);controller.dispose();
  const single=createShowcase({container:new Container(),screen:'stack',screenModes:[]});assert.equal(single.getScreen(),'project');single.setScreen('stack');assert.equal(single.getScreen(),'project');single.dispose();
});

test('clicking the real monitor cycles only configured modes while default callers retain Preview',async()=>{
  let capturedScene,capturedCamera;
  class Renderer {
    constructor(){this.shadowMap={};this.domElement={style:{},setAttribute(){},remove(){}};}
    setPixelRatio(){}setSize(){}dispose(){}
    render(scene,camera){scene.updateMatrixWorld(true);camera.updateMatrixWorld();capturedScene=scene;capturedCamera=camera;}
  }
  const rendererDescriptor=Object.getOwnPropertyDescriptor(globalThis,'__showcaseScreenTestRenderer');
  Object.defineProperty(globalThis,'__showcaseScreenTestRenderer',{configurable:true,value:Renderer});
  const source=(await readFile(new URL('../src/showcase.js',import.meta.url),'utf8'))
    .replace("import * as THREE from './vendor/three.module.js';",`import * as VENDOR from '${new URL('../src/vendor/three.module.js',import.meta.url).href}';const THREE={...VENDOR,WebGLRenderer:globalThis.__showcaseScreenTestRenderer};`)
    .replace("from './vehicle.js'",`from '${new URL('../src/vehicle.js',import.meta.url).href}'`)
    .replace("from './render-budget.js'",`from '${new URL('../src/render-budget.js',import.meta.url).href}'`)
    .replaceAll('import.meta.url',JSON.stringify(new URL('../src/showcase.js',import.meta.url).href));
  const runtime=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
  if(rendererDescriptor)Object.defineProperty(globalThis,'__showcaseScreenTestRenderer',rendererDescriptor);else delete globalThis.__showcaseScreenTestRenderer;
  const originalRaf=Object.getOwnPropertyDescriptor(globalThis,'requestAnimationFrame'),originalCancel=Object.getOwnPropertyDescriptor(globalThis,'cancelAnimationFrame');
  Object.defineProperty(globalThis,'requestAnimationFrame',{configurable:true,value:()=>1});Object.defineProperty(globalThis,'cancelAnimationFrame',{configurable:true,value:()=>{}});
  try{withScreenCanvas(()=>{
    for(const screenModes of [['project','stack'],undefined]){
      const container=new Container();container.clientWidth=500;container.clientHeight=500;container.append=()=>{};container.getBoundingClientRect=()=>({left:0,top:0,width:500,height:500});
      const changes=[],controller=runtime.createShowcase({container,mode:'workbench',project:projects[0],screenModes,onScreenChange:value=>changes.push(value)});
      assert.equal(container.dataset.ready,'true','The actual 3D model rendered successfully');
      const center=capturedScene.getObjectByName('Original project preview').getWorldPosition(new THREE.Vector3()).project(capturedCamera);
      const point={clientX:(center.x*.5+.5)*500,clientY:(-center.y*.5+.5)*500};
      const click=()=>{for(const type of ['pointerdown','pointerup']){const event=new Event(type,{cancelable:true});for(const[key,value]of Object.entries({...point,button:0,pointerId:1}))Object.defineProperty(event,key,{value});container.dispatchEvent(event);}};
      click();click();click();
      assert.deepEqual(changes,screenModes?['stack','project','stack']:['stack','preview','project']);
      if(screenModes){controller.setScreen('preview');assert.equal(controller.getScreen(),'stack');}
      controller.dispose();
    }
  });}finally{
    if(originalRaf)Object.defineProperty(globalThis,'requestAnimationFrame',originalRaf);else delete globalThis.requestAnimationFrame;
    if(originalCancel)Object.defineProperty(globalThis,'cancelAnimationFrame',originalCancel);else delete globalThis.cancelAnimationFrame;
  }
});

test('showcase budgets bound pixels and frame rate, and low-power/reduced-motion displays sleep after a drag',async()=>{
  const saved=new Map(['__showcaseBudgetRenderer','__showcaseBudgetLoader','navigator','devicePixelRatio','requestAnimationFrame','cancelAnimationFrame'].map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
  let latest,posterLoads=0,sequence=0,tick=performance.now();const frames=new Map();
  class Renderer {
    constructor(options){this.options=options;this.shadowMap={};this.domElement={style:{},setAttribute(){},remove(){}};this.draws=0;latest=this;}
    setPixelRatio(value){this.ratio=value;}setSize(){}dispose(){}forceContextLoss(){this.lost=true;}
    render(scene,camera){this.draws++;scene.updateMatrixWorld(true);camera.updateMatrixWorld();}
  }
  class Loader {load(){posterLoads++;}}
  const define=(name,value)=>Object.defineProperty(globalThis,name,{configurable:true,value,writable:true});
  define('__showcaseBudgetRenderer',Renderer);define('__showcaseBudgetLoader',Loader);
  define('devicePixelRatio',3);define('requestAnimationFrame',callback=>{const id=++sequence;frames.set(id,callback);return id;});define('cancelAnimationFrame',id=>frames.delete(id));
  const source=(await readFile(new URL('../src/showcase.js',import.meta.url),'utf8'))
    .replace("import * as THREE from './vendor/three.module.js';",`import * as VENDOR from '${new URL('../src/vendor/three.module.js',import.meta.url).href}';const THREE={...VENDOR,WebGLRenderer:globalThis.__showcaseBudgetRenderer,TextureLoader:globalThis.__showcaseBudgetLoader};`)
    .replace("from './vehicle.js'",`from '${new URL('../src/vehicle.js',import.meta.url).href}'`)
    .replace("from './render-budget.js'",`from '${new URL('../src/render-budget.js',import.meta.url).href}'`)
    .replaceAll('import.meta.url',JSON.stringify(new URL('../src/showcase.js',import.meta.url).href));
  const runFrames=(count,hz)=>{for(let i=0;i<count;i++){const batch=[...frames.values()];frames.clear();tick+=1000/hz;batch.forEach(callback=>callback(tick));}};
  let controller;
  try{
    const runtime=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
    withScreenCanvas(()=>{
      for(const config of [{cores:2,reducedMotion:false},{cores:8,reducedMotion:true},{cores:8,reducedMotion:false}]){
        define('navigator',{hardwareConcurrency:config.cores,deviceMemory:8});
        const container=new Container();container.clientWidth=1200;container.clientHeight=1000;container.append=()=>{};container.getBoundingClientRect=()=>({left:0,top:0,width:1200,height:1000});
        tick=performance.now();controller=runtime.createShowcase({container,mode:'workbench',project:projects[0],screenModes:['project','stack'],reducedMotion:config.reducedMotion});
        const renderer=latest;assert.ok(1200*1000*renderer.ratio**2<=600001,'The complete canvas respects its pixel budget');
        assert.equal(renderer.shadowMap.enabled,config.cores>4);assert.equal(posterLoads,0,'Information screens do not fetch unused poster textures');
        const still=config.cores<=4||config.reducedMotion;
        assert.equal(frames.size,still?0:1);
        if(still){
          const before=renderer.draws;
          for(const [type,x]of [['pointerdown',100],['pointermove',150],['pointerup',150]]){const event=new Event(type,{cancelable:true});for(const[key,value]of Object.entries({button:0,pointerId:1,clientX:x,clientY:100}))Object.defineProperty(event,key,{value});container.dispatchEvent(event);}
          assert.equal(frames.size,1,'Dragging wakes a static display');runFrames(240,60);
          assert.ok(renderer.draws>before,'Dragging renders the changed model');assert.equal(frames.size,0,'Settled displays release their frame loop');
          const settled=renderer.draws;controller.setScreen('stack');assert.equal(renderer.draws,settled+1,'Screen changes render while the animation loop sleeps');
        }else{
          const before=renderer.draws;runFrames(240,120);
          assert.ok(renderer.draws-before<=61,'A high refresh display still renders at most 30fps');
          assert.ok(renderer.draws-before>=50,'The animated display continues to update');
        }
        controller.dispose();assert.equal(frames.size,0);assert.equal(renderer.lost,true);controller=null;
      }
    });
  }finally{controller?.dispose();for(const[name,descriptor]of saved){if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}}
});

test('a supplied computer keeps its baked resources and exposes readable, independently owned Project/Stack notes',()=>withScreenCanvas(()=>{
  const scene=new THREE.Group(),geometry=new THREE.BoxGeometry(90,63,98),paint=new THREE.MeshStandardMaterial({color:'#88c3c8'});
  const shell=new THREE.Mesh(geometry,paint);shell.position.y=31.5;scene.add(shell);
  const computer=fitModelAsset({scene,animations:[]},{width:3.2,height:2.6,depth:3.5});let released=0;
  geometry.addEventListener('dispose',()=>released++);paint.addEventListener('dispose',()=>released++);
  const model=buildShowcaseModel({project:projects[0],screen:'project',computer});
  assert.ok(model.root.getObjectByName('Supplied retrofuturistic computer'));assert.ok(model.root.getObjectByName('Project notes beside supplied computer'));
  assert.equal(model.screenMaterial.map.userData.showcase.content.title,projects[0].title);
  model.setScreen('stack');assert.equal(model.screenMaterial.map.userData.showcase.screen,'stack');
  model.setLanguage('vi');assert.equal(model.screenMaterial.map.userData.showcase.content.title,projects[0].vi.title);
  const size=model.focusBounds.getSize(new THREE.Vector3());assert.ok(size.x<7&&size.y<5&&size.z<5);
  const center=model.screen.getWorldPosition(new THREE.Vector3()),camera=new THREE.PerspectiveCamera(40,1,.1,100);
  camera.position.copy(center).add(new THREE.Vector3(0,0,8));camera.lookAt(center);camera.updateProjectionMatrix();
  assert.equal(hitShowcaseScreen({model,camera,clientX:250,clientY:250,rect:{left:0,top:0,width:500,height:500}}),true);
  let triangles=0;model.root.traverse(object=>{if(object.isMesh)triangles+=(object.geometry.index?.count||object.geometry.attributes.position.count)/3;});assert.ok(triangles<60000);
  model.dispose();model.dispose();assert.equal(computer.root.parent,null);assert.equal(released,0,'The library retains ownership of shared chassis geometry/materials');
  geometry.dispose();paint.dispose();assert.equal(released,2);
}));

test('computer loading upgrades only the latest visible device and disposes clones before its library',async()=>{
  const names=['__showcaseAssetRenderer','document','window','IntersectionObserver','requestAnimationFrame','cancelAnimationFrame'];
  const saved=new Map(names.map(name=>[name,Object.getOwnPropertyDescriptor(globalThis,name)]));
  const define=(name,value)=>Object.defineProperty(globalThis,name,{configurable:true,writable:true,value});
  let capturedScene,capturedCamera,intersection,resolveAsset,rejectAsset,loads=0,fits=0,libraryDisposals=0;const handles=[],rendered=[];
  class Renderer{constructor(){this.shadowMap={};this.domElement={style:{},setAttribute(){},remove(){}};}setPixelRatio(){}setSize(){}dispose(){}render(scene,camera){scene.updateMatrixWorld(true);camera.updateMatrixWorld();capturedScene=scene;capturedCamera=camera;rendered.push(scene.getObjectByName('Supplied retrofuturistic computer'));}}
  define('__showcaseAssetRenderer',Renderer);define('window',new EventTarget());
  define('requestAnimationFrame',()=>1);define('cancelAnimationFrame',()=>{});
  class Observer{constructor(callback){this.callback=callback;intersection=this;}observe(){}disconnect(){}show(visible){this.callback([{isIntersecting:visible}]);}}
  define('IntersectionObserver',Observer);
  const page=Object.assign(new EventTarget(),{hidden:false,createElement(){return {width:0,height:0,getContext(){return {fillRect(){},fillText(){}};}};}});define('document',page);
  const source=(await readFile(new URL('../src/showcase.js',import.meta.url),'utf8'))
    .replace("import * as THREE from './vendor/three.module.js';",`import * as VENDOR from '${new URL('../src/vendor/three.module.js',import.meta.url).href}';const THREE={...VENDOR,WebGLRenderer:globalThis.__showcaseAssetRenderer};`)
    .replace("from './vehicle.js'",`from '${new URL('../src/vehicle.js',import.meta.url).href}'`)
    .replace("from './render-budget.js'",`from '${new URL('../src/render-budget.js',import.meta.url).href}'`)
    .replaceAll('import.meta.url',JSON.stringify(new URL('../src/showcase.js',import.meta.url).href));
  const shellScene=new THREE.Group();shellScene.add(new THREE.Mesh(new THREE.BoxGeometry(90,63,98),new THREE.MeshStandardMaterial()));
  const modelAssets={createModelAssetLibrary(){return {load(id){assert.equal(id,'computer');loads++;return new Promise((resolve,reject)=>{resolveAsset=resolve;rejectAsset=reject;});},dispose(){assert.ok(handles.every(handle=>!handle.root.parent),'Detach fitted copies before disposing shared source resources');libraryDisposals++;}};},fitModelAsset(asset,options){fits++;const handle=fitModelAsset(asset,options);handles.push(handle);return handle;}};
  const settle=async()=>{for(let i=0;i<10;i++)await Promise.resolve();};let controller;
  try{
    const {createShowcase}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
    const container=new Container();container.clientWidth=600;container.clientHeight=500;container.append=()=>{};
    controller=createShowcase({container,project:projects[0],screen:'project',screenModes:['project','stack'],reducedMotion:true,modelAssets});
    assert.equal(loads,0,'Offscreen stages do not request the model or decoder');intersection.show(true);assert.equal(loads,1);
    assert.equal(rendered.length,0,'No old monitor or empty frame is rendered while the retro computer loads');assert.equal(container.dataset.ready,'false');
    controller.setScreen('stack');controller.setLanguage('vi');controller.setTheme(true);controller.resetView();assert.equal(rendered.length,0,'Setting changes cannot reveal the old monitor');
    controller.setProject(projects[1]);intersection.show(false);resolveAsset({scene:shellScene,animations:[]});await settle();assert.equal(fits,0,'A late result cannot upgrade an offscreen stage');
    intersection.show(true);await settle();assert.equal(loads,1);assert.equal(fits,1);
    assert.equal(container.dataset.ready,'true');assert.ok(rendered.every(Boolean),'Every rendered device frame contains the retro computer');
    assert.ok(capturedScene.getObjectByName(`Portfolio artifact: device/${projects[1].id}`));assert.ok(capturedScene.getObjectByName('Supplied retrofuturistic computer'));
    const screen=capturedScene.getObjectByName('Original project preview');assert.equal(screen.material.map.userData.showcase.screen,'stack');assert.equal(screen.material.map.userData.showcase.content.title,projects[1].vi.title);
    const center=screen.getWorldPosition(new THREE.Vector3()).project(capturedCamera);assert.ok(Math.abs(center.x)<1&&Math.abs(center.y)<1);
    controller.setMode('mail');assert.equal(fits,1);controller.setMode('device');assert.equal(fits,2);assert.equal(loads,1);
    controller.dispose();controller=null;assert.equal(libraryDisposals,1);
    controller=createShowcase({container,project:projects[0],reducedMotion:true,modelAssets});intersection.show(true);
    controller.setMode('mail');resolveAsset({scene:shellScene,animations:[]});await settle();assert.equal(fits,2,'A completed device request cannot replace the current mail model');
    controller.setMode('device');await settle();assert.equal(fits,3);controller.dispose();controller=null;
    controller=createShowcase({container,project:projects[0],reducedMotion:true,modelAssets});intersection.show(true);controller.dispose();controller=null;
    resolveAsset({scene:shellScene,animations:[]});await settle();assert.equal(fits,3,'Disposed stages ignore late model results');assert.equal(libraryDisposals,3);
    controller=createShowcase({container,project:projects[0],reducedMotion:true,modelAssets});intersection.show(true);const beforeFailure=rendered.length;rejectAsset(new Error('Model unavailable'));await settle();
    controller.resetView();controller.setProject(projects[1]);intersection.show(true);await settle();assert.equal(container.dataset.ready,'false');assert.equal(rendered.length,beforeFailure,'Load failure leaves the stage neutral instead of reviving the old computer');controller.dispose();controller=null;
  }finally{controller?.dispose();shellScene.traverse(object=>{object.geometry?.dispose();object.material?.dispose();});for(const[name,descriptor]of saved){if(descriptor)Object.defineProperty(globalThis,name,descriptor);else delete globalThis[name];}}
});

test('the real supplied computer decodes within budget and its CRT overlay is the visible clickable surface',async()=>{
  const library=createModelAssetLibrary({load:await createNodeModelLoader()});let model;
  try{
    const asset=await library.load('computer'),computer=fitModelAsset(asset,SUPPLIED_COMPUTER_FIT);
    withScreenCanvas(()=>{model=buildShowcaseModel({project:projects[0],screen:'project',computer,computerScreen:SUPPLIED_COMPUTER_SCREEN});});
    assert.ok(model.root.getObjectByName('Supplied CRT information screen'));assert.ok(!model.root.getObjectByName('Project notes beside supplied computer'));
    assert.ok(model.screenMaterial.map.isCanvasTexture);model.root.updateMatrixWorld(true);
    assert.equal(model.screenMaterial.map.image.width,768);assert.ok(Math.abs(model.screenMaterial.map.image.width/model.screenMaterial.map.image.height-SUPPLIED_COMPUTER_SCREEN.width/SUPPLIED_COMPUTER_SCREEN.height)<.002);
    let triangles=0,meshes=0;model.root.traverse(object=>{if(object.isMesh){meshes++;triangles+=(object.geometry.index?.count||object.geometry.attributes.position.count)/3;}});
    assert.ok(triangles>52000&&triangles<60000);assert.ok(meshes<=3,'A single source mesh, live screen and pedestal replace the many-part procedural computer');
    const camera=new THREE.OrthographicCamera(-3,3,2,-2,.1,50);frameShowcaseCamera({model,camera,width:570,height:180});
    let outside=0;const point=new THREE.Vector3();model.content.traverse(object=>{if(!object.geometry)return;const positions=object.geometry.attributes.position;for(let index=0;index<positions.count;index++){point.fromBufferAttribute(positions,index).applyMatrix4(object.matrixWorld).project(camera);if(Math.abs(point.x)>1.001||Math.abs(point.y)>1.001)outside++;}});
    assert.equal(outside,0,'A short laptop stage retains the complete supplied chassis');
    const left=model.screen.localToWorld(new THREE.Vector3(-SUPPLIED_COMPUTER_SCREEN.width/2,0,0)).project(camera),right=model.screen.localToWorld(new THREE.Vector3(SUPPLIED_COMPUTER_SCREEN.width/2,0,0)).project(camera);
    assert.ok((right.x-left.x)*570/2>65,'Tight near-frontal fitting enlarges the CRT beyond the previous 48px face');
    const {width,height}=model.screen.geometry.parameters;
    for(const x of [-.4,0,.4])for(const y of [-.4,0,.4]){
      const point=model.screen.localToWorld(new THREE.Vector3(x*width,y*height,0));
      for(const offset of [[0,0,8],[5,3.3,8]]){
        const origin=point.clone().add(new THREE.Vector3(...offset)),ray=new THREE.Raycaster(origin,point.clone().sub(origin).normalize());
        const hit=ray.intersectObject(model.root,true).find(hit=>hit.object.isMesh&&!hit.object.material.transparent&&hit.object.material.opacity>0);
        assert.equal(hit?.object===model.screen,true,`CRT content remains in front of source glass at ${x}/${y}/${offset}; first hit ${hit?.object.name}`);
      }
    }
  }finally{model?.dispose();library.dispose();}
});

test('square CRT screens reflow localized project identity and the complete tool list using larger type',()=>withScreenCanvas(canvases=>{
  for(const project of projects)for(const language of ['en','vi'])for(const screen of ['project','stack']){
    const texture=createShowcaseScreenTexture({project,language,screen,layout:'crt',width:768,height:708}),canvas=canvases.at(-1);
    assert.equal(texture.userData.showcase.layout,'crt');
    assert.ok(canvas.text.every(line=>line.x>=40&&line.x+line.width<=728.001&&line.y+line.size<708),'All square-screen text fits');
    if(screen==='stack')assert.ok(project.tech.every(tool=>canvas.text.some(line=>line.value===tool&&line.size>=60)),'Every actual tool remains visible in larger type');
    else assert.ok(canvas.text.some(line=>line.size>=100),'Project identity is large enough for the physical CRT');
    texture.dispose();
  }
}));
