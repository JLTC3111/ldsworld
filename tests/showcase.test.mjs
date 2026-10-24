import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../src/vendor/three.module.js';
import { buildShowcaseModel, createShowcase, createShowcaseScreenTexture, getShowcaseScreenContent, wrapShowcaseText, resolveShowcasePoster, hitShowcaseScreen, isShowcaseScreenTap } from '../src/showcase.js';
import { projects } from '../src/data.js';

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
  model.setTheme(true);model.setHeadlights('on');model.update(.1,0);assert.ok(lights.every(light=>light.intensity>20));
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
    .replaceAll('import.meta.url',JSON.stringify(new URL('../src/showcase.js',import.meta.url).href));
  const runtime=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
  if(rendererDescriptor)Object.defineProperty(globalThis,'__showcaseScreenTestRenderer',rendererDescriptor);else delete globalThis.__showcaseScreenTestRenderer;
  const originalRaf=Object.getOwnPropertyDescriptor(globalThis,'requestAnimationFrame'),originalCancel=Object.getOwnPropertyDescriptor(globalThis,'cancelAnimationFrame');
  Object.defineProperty(globalThis,'requestAnimationFrame',{configurable:true,value:()=>1});Object.defineProperty(globalThis,'cancelAnimationFrame',{configurable:true,value:()=>{}});
  try{withScreenCanvas(()=>{
    for(const screenModes of [['project','stack'],undefined]){
      const container=new Container();container.clientWidth=500;container.clientHeight=500;container.append=()=>{};container.getBoundingClientRect=()=>({left:0,top:0,width:500,height:500});
      const changes=[],controller=runtime.createShowcase({container,project:projects[0],screenModes,onScreenChange:value=>changes.push(value)});
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
