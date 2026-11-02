import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from '../src/vendor/three.module.js';
import { VEHICLE_MODELS } from '../src/vehicle-models.js';
import { mapLocations } from '../src/locations.js';
import { copy, projects } from '../src/data.js';

class Surface extends EventTarget {
  style={};classList={add(){},remove(){}};
  attributes=new Map();dataset={};
  setAttribute(name,value){this.attributes.set(name,value);}focus(){}remove(){this.removed=true;}
  getBoundingClientRect(){return {left:0,top:0,width:1920,height:1080};}
  getContext(){return {fillRect(){},fillText(){},measureText:text=>({width:text.length*10})};}
}

test('the live world keeps scenery static, supports navigation, and suspends paused or hidden frames',async t=>{
  let renderer,clock=0,serial=0,world,bitmapReads=0,bitmapCloses=0;const queue=new Map(),frames=[],impacts=[],arrivals=[],portals=[],opened=[];
  class Renderer {
    constructor(options){renderer=this;this.options=options;this.shadowMap={autoUpdate:true,needsUpdate:false};this.domElement=new Surface();this.renders=0;this.mapRenders=0;this.sizes=0;this.color=new THREE.Color('#123456');this.alpha=.4;}
    setPixelRatio(value){this.ratio=value;}getPixelRatio(){return this.ratio;}
    setSize(width,height){this.width=width;this.height=height;this.sizes++;}
    getSize(target){return target.set(this.width,this.height);}
    getClearAlpha(){return this.alpha;}getClearColor(color){return color.copy(this.color);}setClearColor(color,alpha){this.color.set(color);this.alpha=alpha;}
    render(scene,camera){scene.updateMatrixWorld(true);camera.updateMatrixWorld();this.scene=scene;this.camera=camera;this.renders++;if(camera.up.z===-1){this.mapRenders++;assert.equal(scene.background,null);assert.equal(scene.fog.near,10000);assert.equal(this.shadowMap.autoUpdate,false);assert.equal(scene.children.find(object=>object.userData.vehicleId).visible,false);}}
    dispose(){this.disposed=true;}
  }
  const windowTarget=new EventTarget(),documentTarget=new EventTarget();
  documentTarget.hidden=false;documentTarget.createElement=()=>new Surface();
  const globals={
    __worldTestRenderer:Renderer,window:windowTarget,document:documentTarget,
    navigator:{hardwareConcurrency:4,deviceMemory:4},innerWidth:1920,innerHeight:1080,devicePixelRatio:2,
    matchMedia:()=>({matches:false}),performance:{now:()=>clock},
    requestAnimationFrame:callback=>{queue.set(++serial,callback);return serial;},
    cancelAnimationFrame:id=>queue.delete(id),
    createImageBitmap:()=>{bitmapReads++;return Promise.resolve({close(){bitmapCloses++;}});},
    OffscreenCanvas:class{getContext(){return {drawImage(){}};}async convertToBlob(){return new Blob(['atlas'],{type:'image/webp'});}}
  };
  const originals=new Map(Object.keys(globals).map(key=>[key,Object.getOwnPropertyDescriptor(globalThis,key)]));
  for(const [key,value]of Object.entries(globals))Object.defineProperty(globalThis,key,{configurable:true,writable:true,value});
  function tick(milliseconds=34){clock+=milliseconds;const pending=[...queue.values()];queue.clear();for(const callback of pending)callback(clock);}
  function visibility(hidden){documentTarget.hidden=hidden;documentTarget.dispatchEvent(new Event('visibilitychange'));}
  try{
    // Substitute only WebGLRenderer: geometry, scenery, atmosphere,
    // controllers and the render-budget integration all use production code.
    const location=new URL('../src/world.js',import.meta.url);
    let source=await readFile(location,'utf8');
    source=source.replace("import * as THREE from './vendor/three.module.js';",`import * as VENDOR from '${new URL('./vendor/three.module.js',location).href}';const THREE={...VENDOR,WebGLRenderer:globalThis.__worldTestRenderer};`)
      .replace(/from (['"])(\.\/[^'"]+)\1/g,(_,quote,path)=>`from ${quote}${new URL(path,location).href}${quote}`);
    const {createWorld}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
    const container=new Surface();container.prepend=()=>{};const overlays=[];container.append=object=>overlays.push(object);
    world=createWorld({container,onFrame:frame=>frames.push(frame),onImpact:event=>impacts.push(event),onArrival:id=>arrivals.push(id),onPortal:id=>portals.push(id),onProject:id=>opened.push(id)});
    assert.equal(renderer.renders,1);assert.equal(queue.size,1);
    assert.equal(renderer.options.antialias,false);assert.equal(renderer.options.powerPreference,'low-power');
    assert.ok(renderer.width*renderer.height*renderer.ratio**2<=900001,'low-spec drawing buffer obeys its pixel budget');
    const inventory={meshes:0,instancedMeshes:0,shadowCasters:0};
    renderer.scene.traverse(object=>{if(object.isMesh)inventory.meshes++;if(object.isInstancedMesh)inventory.instancedMeshes++;if(object.castShadow)inventory.shadowCasters++;});
    assert.ok(inventory.meshes>1000,'the complete island is present');t.diagnostic(`Scene inventory: ${JSON.stringify(inventory)}`);

    tick();assert.equal(queue.size,1,'active world keeps one frame queued');
    assert.equal(overlays.length,1);assert.equal(overlays[0].className,'weather-overlay');
    world.setPaused(true);const pausedRenders=renderer.renders;tick();
    assert.equal(renderer.renders,pausedRenders+1);assert.equal(frames.at(-1).elapsed,0);assert.equal(queue.size,0,'paused world has no background RAF');
    for(const change of [()=>world.setWeather('rain'),()=>world.setHeadlightsMode('on'),()=>windowTarget.dispatchEvent(new Event('resize'))]){
      const before=renderer.renders;change();assert.equal(queue.size,1);tick();
      assert.equal(renderer.renders,before+1);assert.equal(queue.size,0);assert.equal(frames.at(-1).paused,true);assert.equal(frames.at(-1).elapsed,0);
    }
    assert.equal(world.getEnvironment().weather,'rain');assert.equal(overlays[0].dataset.weather,'rain');assert.equal(overlays[0].dataset.paused,'true');
    world.setWeather('snow');world.setHeadlightsMode('off');world.setLanguage('vi');
    assert.equal(queue.size,1,'multiple invalidations share a frame');tick();assert.equal(queue.size,0);
    world.setPaused(true);assert.equal(queue.size,0,'repeated pause does not create work');

    world.setPaused(false);tick();assert.equal(queue.size,1);assert.equal(frames.at(-1).paused,false);
    visibility(true);assert.equal(queue.size,0);const hiddenRenders=renderer.renders;
    clock+=60000;world.setWeather('clear');world.resetCamera();assert.equal(queue.size,0,'settings do not render a hidden tab');
    assert.equal(renderer.renders,hiddenRenders);
    visibility(false);assert.equal(queue.size,1);tick();assert.equal(queue.size,1);
    assert.ok(frames.at(-1).elapsed<=.05,'resume does not simulate the hidden minute');

    { // Half-size cars and static scenery without playgrounds or destruction effects.
      for(const name of ['Bowling and TNT playground','Blast debris and residual fires','Impact TNT crate 1','Bowling pin 1'])assert.equal(renderer.scene.getObjectByName(name),undefined);
      for(const model of VEHICLE_MODELS){
        world.setCarModel(model.id);tick();
        const car=renderer.scene.children.find(object=>object.userData.vehicleId===model.id);
        assert.ok(car);assert.deepEqual(car.scale.toArray(),[.63,.63,.63]);
      }
      const staticObjects=[];
      renderer.scene.traverse(object=>{if(object.userData.propId||object.userData.physicsKind||object.name.startsWith('Decorative '))staticObjects.push([object,object.position.clone(),object.quaternion.clone()]);});
      assert.ok(staticObjects.length>20,'the decorative props remain in the island');
      for(const weather of ['clear','rain','snow']){
        world.setWeather(weather);world.teleportTo('woodland');world.setKey('Shift',true);
        for(let frame=0;frame<40;frame++)tick();
        world.setKey('Shift',false);
        assert.ok(frames.at(-1).x>-53,'the car drives through the woodland without collision reactions');
        assert.ok(frames.at(-1).actualSpeed>0);
      }
      for(const [object,position,rotation]of staticObjects){assert.ok(object.position.equals(position),object.name);assert.ok(object.quaternion.equals(rotation),object.name);}
      assert.deepEqual(impacts,[],'scenery never emits physical impacts');
      assert.equal(world.teleportTo('tnt'),false);assert.equal(world.teleportTo('bowling'),false);
      for(const language of ['en','vi']){world.setLanguage(language);assert.equal(renderer.domElement.attributes.get('aria-label'),copy[language].canvasAria);}
    }

    { // Scenery clicks leave props intact; project clicks and guided travel still work.
      world.reset();world.setWeather('clear');tick();
      const crate=[];renderer.scene.traverse(object=>{if(object.userData.propId==='crate-1')crate.push(object);});
      assert.equal(crate.length,1);
      const position=crate[0].position.clone(),rotation=crate[0].quaternion.clone();
      function click(point){
        const projected=point.clone().project(renderer.camera),clientX=(projected.x+1)*960,clientY=(1-projected.y)*540;
        for(const type of ['pointerdown','pointerup']){const event=new Event(type,{cancelable:true});Object.assign(event,{pointerId:1,button:0,clientX,clientY,pointerType:'mouse'});renderer.domElement.dispatchEvent(event);}
      }
      click(crate[0].getWorldPosition(new THREE.Vector3()));for(let frame=0;frame<40;frame++)tick();
      assert.ok(crate[0].position.equals(position));assert.ok(crate[0].quaternion.equals(rotation));assert.equal(crate[0].visible,true);
      world.reset();tick();
      const project=projects[0];
      click(new THREE.Vector3(project.position[0],2,project.position[1]));assert.equal(opened.at(-1),project.id);
      world.driveToProject(project.id);for(let frame=0;frame<1800&&!arrivals.includes(project.id);frame++)tick();assert.ok(arrivals.includes(project.id),'guided project tours arrive');
      world.reset();world.goToPortal('west-gate');for(let frame=0;frame<1800&&!portals.length;frame++)tick();assert.ok(portals.includes('west-gate'),'portals still transport the car');
      for(const location of mapLocations())assert.equal(world.teleportTo(location.id),true,location.id);
    }
    { // Background atlas capture never resizes the live canvas and restores all scene state.
      const sky=renderer.scene.background.clone(),fog=renderer.scene.fog.clone(),size=renderer.sizes,ratio=renderer.ratio,exposure=renderer.toneMappingExposure,mainCamera=renderer.camera;
      const car=renderer.scene.children.find(object=>object.userData.vehicleId),visibility=car.visible;
      const first=world.captureMap();assert.equal(first,world.captureMap());const image=await first;assert.match(image,/^blob:/);
      assert.equal(world.getMapImage(),image);assert.equal(await world.captureMap(),image);assert.equal(renderer.mapRenders,1);assert.equal(bitmapReads,1);assert.equal(bitmapCloses,1);
      assert.equal(renderer.sizes,size);assert.equal(renderer.ratio,ratio);assert.equal(renderer.camera,mainCamera);assert.equal(renderer.scene.background.getHex(),sky.getHex());assert.equal(renderer.scene.fog.near,fog.near);assert.equal(renderer.scene.fog.far,fog.far);assert.equal(renderer.toneMappingExposure,exposure);assert.equal(car.visible,visibility);assert.equal(renderer.shadowMap.autoUpdate,true);assert.equal(renderer.color.getHexString(),'123456');assert.equal(renderer.alpha,.4);
    }
    world.dispose();world=null;assert.equal(overlays[0].removed,true);assert.equal(queue.size,0);assert.equal(renderer.disposed,true);assert.equal(renderer.domElement.removed,true);
    windowTarget.dispatchEvent(new Event('resize'));visibility(false);assert.equal(queue.size,0,'disposal removes frame-producing listeners');
  }finally{
    world?.dispose();
    for(const [key,descriptor]of originals)if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];
  }
});
