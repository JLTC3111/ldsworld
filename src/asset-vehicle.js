import { cloneCarAsset } from './car-assets.js';
import { CAR_PIVOT_HEIGHT } from './aerial-dynamics.js';
import { createCarDetails } from './car-details.js';
export function createAssetVehicle({THREE:T,scene,model,reducedMotion=false}){
  const asset=cloneCarAsset(model.id);if(!asset)return null;
  const root=new T.Group(),body=new T.Group();root.name=`Long D. ${model.name} — supplied model`;root.userData.assetModel=model.id;root.add(body);scene.add(root);root.updateMatrixWorld(true);
  const profile={...model.profile,bodyTop:Math.max(model.profile.bodyTop,asset.height)},wheels=new Map(),wheelPivots=[],hydraulicRams=[],links=[];
  for(const mesh of asset.meshes){
    const match=mesh.name.match(/^(front|rear)_([LR])__/);
    if(match){const key=match[1]+'_'+match[2];let wheel=wheels.get(key);
      if(!wheel){const pivot=new T.Group(),roller=new T.Group(),position=mesh.getWorldPosition(new T.Vector3());pivot.position.copy(position);root.add(pivot);pivot.add(roller);root.updateMatrixWorld(true);wheel={pivot,roller,front:match[1]==='front',side:match[2]==='L'?-1:1,baseY:position.y,x:position.x,z:position.z};wheels.set(key,wheel);wheelPivots.push(wheel);}
      wheel.roller.attach(mesh);
    }else body.attach(mesh);
  }
  asset.orient.clear();
  const geometries=asset.geometries,materials=asset.materials;
  const chrome=new T.MeshStandardMaterial({color:'#d2d8d2',metalness:.8,roughness:.23}),dark=new T.MeshStandardMaterial({color:model.id==='monster-truck'?'#d7ac45':'#28353a',metalness:.65,roughness:.3});[chrome,dark].forEach(m=>materials.add(m));
  const tube=new T.CylinderGeometry(1,1,1,12);geometries.add(tube);
  const cylinder=(r,length,material)=>{const mesh=new T.Mesh(tube,material);mesh.scale.set(r,length,r);mesh.castShadow=true;root.add(mesh);return mesh;};
  for(const wheel of wheelPivots){
    const barrel=cylinder(.055,.28,dark),piston=cylinder(.025,.4,chrome);barrel.name='hydraulic-cylinder';piston.name='hydraulic-piston';hydraulicRams.push({barrel,piston,wheel});
    for(const dz of [-.13,.13]){const rod=cylinder(.025,1,dark);rod.name='Articulated suspension link';links.push({rod,wheel,dz});}
  }
  const details=createCarDetails({THREE:T,root,body,profile,id:model.id}),headLights=details.headLights;
  const flameMaterial=new T.MeshBasicMaterial({color:'#b1e9ff',transparent:true,opacity:.8,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false}),flameGeometry=new T.ConeGeometry(.1,1.1,12);materials.add(flameMaterial);geometries.add(flameGeometry);
  const flames=[-.4,.4].map(x=>{const flame=new T.Mesh(flameGeometry,flameMaterial);flame.name='Rocket boost exhaust';flame.rotation.x=-Math.PI/2;flame.position.set(x,.6,-profile.halfLength-.55);root.add(flame);return flame;});
  const offset=new T.Vector3(),up=new T.Vector3(0,1,0),a=new T.Vector3(),b=new T.Vector3();let travel=0,disposed=false;
  return {root,body,profile,headLights,tailLights:details.tailLights,wheelPivots,hydraulicRams,sourceAsset:true,
    update(dt,{driver,night=0,headlights='auto',braking=false,time=0}){
      const aerial=driver.attitude&&(driver.attitude.flying||driver.attitude.recovering),lift=(driver.rideHeight??profile.raised)+(driver.hydraulicOffset||0);
      if(aerial){root.quaternion.copy(driver.attitude.rotation);offset.set(0,CAR_PIVOT_HEIGHT,0).applyQuaternion(root.quaternion);root.position.set(driver.x-offset.x,(driver.groundHeight||0)+(driver.hop||0)+driver.attitude.supportLift+CAR_PIVOT_HEIGHT-offset.y,driver.z-offset.z);}else{root.rotation.set(0,driver.heading||0,0);root.position.set(driver.x,(driver.groundHeight||0)+(driver.hop||0),driver.z);}
      body.position.y=lift;body.rotation.x=aerial||reducedMotion?0:Math.max(-.16,Math.min(.16,driver.pitch||0));body.rotation.z=aerial||reducedMotion?0:Math.max(-.16,Math.min(.16,driver.roll||0));
      travel+=(driver.speed||0)*Math.min(.05,dt)/profile.wheelRadius;
      for(const wheel of wheelPivots){const key=`${wheel.front?'front':'rear'}${wheel.side<0?'Left':'Right'}`,terrain=driver.attitude?.flying?0:Math.max(-.22,Math.min(.35,(driver.wheelHeights?.[key]??driver.groundHeight??0)-(driver.groundHeight||0)));wheel.pivot.position.y=wheel.baseY+terrain;wheel.pivot.rotation.y=wheel.front?(driver.steering||0)*.38:0;wheel.roller.rotation.x=travel;}
      for(const {barrel,piston,wheel} of hydraulicRams){const y=wheel.pivot.position.y,top=y+.36+lift;barrel.position.set(wheel.x*.75,y+.14,wheel.z);piston.position.set(wheel.x*.75,(y+top)/2,wheel.z);piston.scale.y=Math.max(.08,top-y);}
      for(const {rod,wheel,dz} of links){a.set(wheel.x*.35,wheel.baseY+.3+lift,wheel.z+dz);b.set(wheel.x,wheel.pivot.position.y,wheel.z);rod.position.copy(a).add(b).multiplyScalar(.5);rod.scale.y=a.distanceTo(b);rod.quaternion.setFromUnitVectors(up,b.sub(a).normalize());}
      details.update({driver,night,headlights,braking,time});for(const material of asset.materials)if(material.userData.visibilityPaint)material.emissiveIntensity=.035+night*.14;
      flames.forEach(f=>{f.visible=Boolean(driver.boosting);f.position.y=.6+lift;f.scale.y=reducedMotion?1:.9+Math.sin(time*45)*.12;});
    },dispose(){if(disposed)return;disposed=true;root.removeFromParent();details.dispose();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());}
  };
}
