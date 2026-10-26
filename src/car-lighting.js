/** A baked studio environment gives paint and metal soft, shaped reflections. */
export function createCarEnvironment({THREE:T,renderer}={}) {
  if(!renderer?.isWebGLRenderer)return {texture:null,dispose(){}};
  const previous={target:renderer.getRenderTarget?.(),face:renderer.getActiveCubeFace?.(),mip:renderer.getActiveMipmapLevel?.(),xr:renderer.xr?.enabled,autoClear:renderer.autoClear,toneMapping:renderer.toneMapping,exposure:renderer.toneMappingExposure,alpha:renderer.getClearAlpha?.(),color:renderer.getClearColor?.(new T.Color())?.clone()};
  const room=new T.Scene(),geometry=new T.BoxGeometry(1,1,1),materials=[];
  const panel=(color,intensity,x,y,z,w,h,d)=>{
    const material=new T.MeshBasicMaterial({color:new T.Color(color).multiplyScalar(intensity),side:T.DoubleSide,toneMapped:false});materials.push(material);
    const mesh=new T.Mesh(geometry,material);mesh.position.set(x,y,z);mesh.scale.set(w,h,d);room.add(mesh);return mesh;
  };
  const shell=panel('#929ba4',.5,0,0,0,18,12,18);shell.material.side=T.BackSide;
  panel('#fff4e5',3.4,-4,4,2,3,4,.1);
  panel('#e4edff',2.6,4,2,-3,.1,3,4);
  panel('#ffffff',3,0,5,-1,5,.1,3);
  panel('#d5dfeb',1.3,0,-4,0,7,.1,7);
  let generator,target;
  try{
    generator=new T.PMREMGenerator(renderer);target=generator.fromScene(room,.04,.1,30,{size:128});
    return {texture:target.texture,dispose(){target?.dispose();target=null;}};
  }catch{
    target?.dispose();return {texture:null,dispose(){}};
  }finally{
    generator?.dispose();geometry.dispose();materials.forEach(m=>m.dispose());
    renderer.setRenderTarget?.(previous.target,previous.face,previous.mip);if(renderer.xr)renderer.xr.enabled=previous.xr;
    renderer.autoClear=previous.autoClear;renderer.toneMapping=previous.toneMapping;renderer.toneMappingExposure=previous.exposure;
    if(previous.color)renderer.setClearColor(previous.color,previous.alpha);
  }
}

/** Short-range lights follow the car and leave the island's day/night intact. */
export function createCarLighting({THREE:T,scene,vehicle,environmentMap=null}) {
  const group=new T.Group();group.name='Vehicle studio lights';scene.add(group);
  const span=Math.max(vehicle.profile.halfLength,vehicle.profile.halfWidth),power=span*span;
  const key=new T.PointLight('#fff0dd',8*power,span*7,2),rim=new T.PointLight('#dbe8ff',5*power,span*6,2);
  key.position.set(-span*1.3,span*2.5,span*1.5);rim.position.set(span*1.7,span*1.35,-span*1.6);group.add(key,rim);
  const materials=new Set();
  vehicle.root.traverse(object=>{for(const m of Array.isArray(object.material)?object.material:object.material?[object.material]:[])if(m.isMeshStandardMaterial)materials.add(m);});
  if(environmentMap)for(const material of materials){material.envMap=environmentMap;material.envMapIntensity=material.userData.visibilityPaint?1.15:.8;material.needsUpdate=true;}
  let disposed=false;
  return {group,key,rim,update({night=0}={}){
    group.position.copy(vehicle.root.position);group.position.y+=vehicle.profile.bodyTop*.35;
    key.intensity=(8+4*night)*power;rim.intensity=(5+3*night)*power;
  },dispose(){if(disposed)return;disposed=true;group.removeFromParent();key.dispose();rim.dispose();}};
}
