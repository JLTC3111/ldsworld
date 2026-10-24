export const BOWLING_AREA=Object.freeze({x:39,z:41,width:13,depth:25});
export const TNT_LOCATIONS=Object.freeze([[-44,22],[-47,23],[-50,22],[-48,27],[-44,27]]);
export const PLAYGROUND_APPROACHES=Object.freeze({bowling:{stop:'r6',points:[[18,7],[21,16],[27,24],[39,32]]},tnt:{stop:'r9',points:[[-12,12.5],[-18,20],[-30,22],[-44,15]]}});
export function reservesPlaygroundSpace(x,z,padding=3){
  if(Math.abs(x-BOWLING_AREA.x)<BOWLING_AREA.width/2+padding&&Math.abs(z-BOWLING_AREA.z)<BOWLING_AREA.depth/2+padding||TNT_LOCATIONS.some(([px,pz])=>Math.hypot(x-px,z-pz)<5+padding))return true;
  return Object.values(PLAYGROUND_APPROACHES).some(({points})=>points.slice(1).some((b,i)=>{const a=points[i],dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz)));return Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t)<padding+2.5;}));
}

export function createPlayground({THREE:T,scene,coarse=false,reducedMotion=false,onExplosion}){
  const root=new T.Group();root.name='Bowling and TNT playground';root.userData.physicsIgnore=true;scene.add(root);
  const geometries=new Set(),materials=new Set(),textures=new Set(),bodies=[],detonated=new Set(),fuses=new Map();let disposed=false;
  const geo=g=>{geometries.add(g);return g;},paint=(color,options={})=>{const m=new T.MeshStandardMaterial({color,roughness:.6,...options});materials.add(m);return m;};
  const cube=geo(new T.BoxGeometry(1,1,1)),plane=geo(new T.PlaneGeometry(1,1));
  const box=(w,h,d,material,parent,x=0,y=0,z=0)=>{const mesh=new T.Mesh(cube,material);mesh.position.set(x,y,z);mesh.scale.set(w,h,d);mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh;};
  const lane=paint('#baaa87',{roughness:.62}),line=paint('#e6ddc4'),dark=paint('#424944'),red=paint('#b6372f'),steel=paint('#717a75',{metalness:.6,roughness:.38});
  box(BOWLING_AREA.width,.025,BOWLING_AREA.depth,lane,root,BOWLING_AREA.x,.025,BOWLING_AREA.z).name='Drive-through bowling lane';
  for(const side of [-1,1])box(.12,.012,BOWLING_AREA.depth,line,root,BOWLING_AREA.x+side*5.8,.045,BOWLING_AREA.z);
  box(11.5,.012,.12,line,root,39,.047,32);
  for(let i=-2;i<=2;i++){const arrow=box(.15,.012,.65,dark,root,39+i*1.5,.047,36);arrow.rotation.y=.4;}
  const profile=[[0,-1.05],[.27,-1.05],[.34,-1.01],[.38,-.83],[.41,-.55],[.36,-.2],[.23,.1],[.15,.37],[.15,.61],[.22,.72],[.235,.86],[.19,1],[.06,1.05],[0,1.06]].map(([r,y])=>new T.Vector2(r,y));
  const pinGeometry=geo(new T.LatheGeometry(profile,24)),white=paint('#f2f0e4',{roughness:.24,metalness:.05});
  const stripeGeometry=geo(new T.CylinderGeometry(.158,.158,.065,24,1,true));let pinIndex=0;
  for(let row=0;row<4;row++)for(let column=0;column<=row;column++){
    const id=`bowling-pin-${++pinIndex}`,x=39+(column-row/2)*1.3,z=45+row*1.22,object=new T.Group();object.name=`Bowling pin ${pinIndex}`;object.userData.propId=id;root.add(object);
    const shape=new T.Mesh(pinGeometry,white);shape.castShadow=shape.receiveShadow=true;object.add(shape);
    for(const y of [.4,.51]){const stripe=new T.Mesh(stripeGeometry,red);stripe.position.y=y;object.add(stripe);}
    object.position.set(x,1.175,z);bodies.push({id,object,x,z,y:1.175,height:2.11,uprightHeight:2.11,radius:.41,baseRadius:.41,mass:1.2,kind:'bowling-pin',initialSleeping:true});
  }
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=128;const ctx=canvas.getContext('2d');
  ctx.fillStyle='#edcf78';ctx.fillRect(0,0,256,128);ctx.fillStyle='#262b28';ctx.font='900 74px monospace';ctx.textAlign='center';ctx.fillText('TNT',128,87);
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;textures.add(texture);const labelMaterial=new T.MeshBasicMaterial({map:texture,toneMapped:false});materials.add(labelMaterial);
  for(const [index,[x,z]] of TNT_LOCATIONS.entries()){
    const id=`tnt-${index+1}`,object=new T.Group();object.name=`Impact TNT crate ${index+1}`;object.userData.propId=id;root.add(object);object.position.set(x,.72,z);
    box(1.2,1.2,1.2,red,object);
    for(const side of [-1,1]){box(1.23,.09,1.23,steel,object,0,side*.45,0);for(const axis of [0,1]){const label=new T.Mesh(plane,labelMaterial);label.scale.set(.79,.41,1);label.position.set(axis?side*.607:0,0,axis?0:side*.607);label.rotation.y=axis?side*Math.PI/2:side<0?Math.PI:0;object.add(label);}}
    box(.09,.2,.09,dark,object,0,.69,0);
    bodies.push({id,object,x,z,y:.72,height:1.2,radius:.72,mass:2,kind:'tnt',initialSleeping:true,active:()=>!detonated.has(id)});
  }
  const sparkGeometry=geo(new T.BoxGeometry(.07,.07,.15)),ballGeometry=geo(new T.SphereGeometry(1,12,8)),dummy=new T.Object3D();
  const bursts=Array.from({length:4},()=>{
    const group=new T.Group();group.visible=false;group.name='TNT blast and debris';root.add(group);
    const fireMaterial=new T.MeshBasicMaterial({color:'#ffb645',transparent:true,opacity:0,depthWrite:false,toneMapped:false});materials.add(fireMaterial);
    const fire=new T.Mesh(ballGeometry,fireMaterial);group.add(fire);
    const smokeMaterial=paint('#777c73',{transparent:true,opacity:0,depthWrite:false});
    const smoke=new T.Mesh(ballGeometry,smokeMaterial);group.add(smoke);
    const sparkMaterial=new T.MeshBasicMaterial({color:'#e8a352',transparent:true,opacity:1,depthWrite:false,toneMapped:false});materials.add(sparkMaterial);
    const sparks=new T.InstancedMesh(sparkGeometry,sparkMaterial,coarse?18:36);sparks.frustumCulled=false;group.add(sparks);
    const particles=Array.from({length:sparks.count},(_,i)=>{const angle=i*2.39996;return{vx:Math.cos(angle)*(3+i%5),vz:Math.sin(angle)*(3+i%5),vy:3+i%6};});
    return {group,fire,smoke,sparks,particles,age:10};
  });
  const flash=new T.PointLight('#ffb467',0,19,2);root.add(flash);let burstIndex=0;
  function detonate(id,physics,driver){
    const body=physics.bodies.find(b=>b.id===id);if(!body||detonated.has(id))return false;
    detonated.add(id);body.object.visible=false;fuses.delete(id);
    const burst=bursts[burstIndex++%bursts.length];burst.age=0;burst.group.visible=true;burst.group.position.set(body.x,body.y,body.z);
    flash.position.copy(burst.group.position);physics.explode({x:body.x,y:body.y,z:body.z,radius:8,strength:15},driver);
    for(const other of physics.bodies){if(other.kind==='tnt'&&!detonated.has(other.id)&&Math.hypot(other.x-body.x,other.z-body.z)<6&&!fuses.has(other.id))fuses.set(other.id,.1+Math.hypot(other.x-body.x,other.z-body.z)*.035);}
    onExplosion?.({x:body.x,z:body.z,distance:Math.hypot(body.x-driver.x,body.z-driver.z)});return true;
  }
  function update(dt,physics,driver,{paused=false}={}){
    if(disposed||paused)return;
    dt=Math.max(0,Math.min(.05,dt));flash.intensity=0;
    for(const [id,remaining] of [...fuses]){if(remaining<=dt)detonate(id,physics,driver);else fuses.set(id,remaining-dt);}
    for(const body of physics.bodies)if(body.kind==='tnt'&&!detonated.has(body.id)&&!fuses.has(body.id)&&body.impactSpeed>=3.2)detonate(body.id,physics,driver);
    for(const burst of bursts){
      burst.age+=dt;const age=burst.age;if(age>1.8){burst.group.visible=false;continue;}
      burst.group.visible=true;burst.fire.scale.setScalar(reducedMotion?1.2:.3+Math.min(.3,age)*10);burst.fire.material.opacity=Math.max(0,1-age/.35)*.85;
      burst.smoke.scale.setScalar(1+age*2.2);burst.smoke.position.y=age*1.5;burst.smoke.material.opacity=Math.max(0,1-age/1.8)*.24;
      burst.sparks.material.opacity=Math.max(0,1-age/1.5);
      for(let i=0;i<burst.particles.length;i++){const p=burst.particles[i],t=reducedMotion?Math.min(age,.12):age;dummy.position.set(p.vx*t,Math.max(-.55,p.vy*t-6*t*t),p.vz*t);dummy.rotation.set(t*3+i,t*4,t*2);dummy.scale.setScalar(1);dummy.updateMatrix();burst.sparks.setMatrixAt(i,dummy.matrix);}burst.sparks.instanceMatrix.needsUpdate=true;
      if(!reducedMotion)flash.intensity=Math.max(flash.intensity,Math.max(0,1-age/.22)*65);
    }
  }
  function reset(){detonated.clear();fuses.clear();flash.intensity=0;bursts.forEach(b=>{b.age=10;b.group.visible=false;});bodies.forEach(b=>b.object.visible=true);}
  return {root,bodies,update,reset,detonate,detonated,dispose(){if(disposed)return;disposed=true;root.removeFromParent();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());}};
}
