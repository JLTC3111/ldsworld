import { CAR_PIVOT_HEIGHT } from './aerial-dynamics.js';

// Reconstructed from the six views of each toy in assets/3D_CARS.
// Geometry is generated locally; no remote models or textures are required.
export function createReferenceVehicle({THREE:T,scene,model,reducedMotion=false}){
  const root=new T.Group();root.name=`Long D. ${model.name}`;scene.add(root);const body=new T.Group();root.add(body);
  const geometries=new Set(),materials=new Set(),textures=new Set(),cache=new Map();
  const geo=g=>{geometries.add(g);return g;},mat=(color,options={})=>{const key=color+JSON.stringify(options);if(!cache.has(key)){const m=new T.MeshPhysicalMaterial({color,roughness:.32,metalness:.18,clearcoat:.65,...options});cache.set(key,m);materials.add(m);}return cache.get(key);};
  const mesh=(g,m,parent=body,x=0,y=0,z=0)=>{const o=new T.Mesh(g,m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;parent.add(o);return o;};
  const cube=geo(new T.BoxGeometry(1,1,1)),orb=geo(new T.SphereGeometry(1,24,16)),tube=geo(new T.CylinderGeometry(1,1,1,20));
  const box=(w,h,d,m,p=body,x=0,y=0,z=0)=>{const o=mesh(cube,m,p,x,y,z);o.scale.set(w,h,d);return o;};
  const ball=(r,m,p=body,x=0,y=0,z=0)=>{const o=mesh(orb,m,p,x,y,z);o.scale.setScalar(r);return o;};
  const cylinder=(r,h,m,p=body,x=0,y=0,z=0)=>{const o=mesh(tube,m,p,x,y,z);o.scale.set(r,h,r);return o;};
  const paint=mat(model.color,{emissive:model.color,emissiveIntensity:.02}),black=mat('#10191b',{roughness:.23,metalness:.18}),rubber=mat('#171b1d',{roughness:.95,metalness:0}),chrome=mat('#c5d1d1',{metalness:.78,roughness:.2}),gold=mat('#e4b743',{metalness:.6,roughness:.27}),white=mat('#f3f0db'),yellow=mat('#f9d24b'),blue=mat('#328ccc'),brown=mat('#765044',{roughness:.75,metalness:0});
  const profile=model.profile,lightPaint=mat('#fff2cb',{emissive:'#ffe2a0',emissiveIntensity:.4}),tailPaint=mat('#c73c2d',{emissive:'#ff3423',emissiveIntensity:.2});
  function panel(w,h,d,m,x,y,z,r=.06){
    r=Math.min(r,w/4,h/4,d/4);const shape=new T.Shape(),a=w/2-r,b=h/2-r;shape.moveTo(-a,-b);shape.lineTo(a,-b);shape.lineTo(a,b);shape.lineTo(-a,b);shape.closePath();const g=geo(new T.ExtrudeGeometry(shape,{depth:d-2*r,steps:1,bevelEnabled:true,bevelThickness:r,bevelSize:r,bevelSegments:3}));g.translate(0,0,-d/2+r);return mesh(g,m,body,x,y,z);
  }
  function beam(a,b,r,m,parent=body){const av=new T.Vector3(...a),bv=new T.Vector3(...b),o=cylinder(r,av.distanceTo(bv),m,parent);o.position.copy(av).add(bv).multiplyScalar(.5);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),bv.sub(av).normalize());return o;}
  function label(text,w,h,parent,x,y,z,rotationX=0){const canvas=document.createElement('canvas');canvas.width=512;canvas.height=512;const ctx=canvas.getContext('2d');ctx.fillStyle='#f5f5e9';ctx.fillRect(0,0,512,512);ctx.fillStyle='#10191b';ctx.font='700 410px Arial,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,256,278);const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;textures.add(texture);const material=new T.MeshStandardMaterial({map:texture,roughness:.25});materials.add(material);const o=mesh(geo(new T.CircleGeometry(w/2,48)),material,parent,x,y,z);o.scale.y=h/w;o.rotation.x=rotationX;return o;}
  box(1.3,.16,2.65,model.id==='monster-truck'?gold:chrome,body,0,.36,0);
  if(model.id==='8-ball'){
    panel(1.62,.35,2.85,paint,0,.66,0,.12);panel(1.3,.2,.82,paint,0,.82,1.04,.09);panel(1.27,.17,.6,paint,0,.82,-1.12,.08);
    const dome=mesh(geo(new T.SphereGeometry(.8,48,24,0,Math.PI*2,0,Math.PI/2)),mat('#0c151b',{roughness:.13,metalness:.42,clearcoat:1}),body,0,.85,-.06);dome.scale.set(1.02,1.05,1.13);dome.name='Glossy 8 Ball canopy';
    const ring=mesh(geo(new T.TorusGeometry(.805,.025,8,48)),chrome,body,0,.85,-.06);ring.rotation.x=Math.PI/2;ring.scale.y=1.13;
    label('8',.6,.6,body,0,1.698,-.06,-Math.PI/2).name='8 Ball number badge';
    for(const x of [-.22,0,.22])box(.09,.018,.45,yellow,body,x,.934,1.03);
    for(const [i,c] of ['#48bed8','#ef7250','#f4d04b'].entries())box(.075,.018,.43,mat(c),body,-.2+i*.2,.919,-1.14);
    panel(.45,.22,.37,black,0,.98,-.97,.035);for(let i=0;i<6;i++)box(.043,.13,.025,chrome,body,-.16+i*.064,1,-.765);
    for(const x of [-.7,.7])for(const z of [-.96,.96]){const fender=ball(.4,paint,body,x,.64,z);fender.scale.set(.55,.5,1.13);}
    for(const x of [-.51,.51])box(.21,.07,.025,lightPaint,body,x,.69,1.45);
    box(.52,.13,.04,black,body,0,.52,1.46);
  }else if(model.id==='monster-truck'){
    panel(1.5,.58,2.38,paint,0,1.38,-.15,.13);panel(1.25,.47,1.13,paint,0,1.47,1.02,.15);panel(1.3,.22,.98,yellow,0,1.18,1.08,.08);
    for(const side of [-1,1]){
      for(let i=0;i<7;i++){const tooth=mesh(geo(new T.ConeGeometry(.085,.18,5)),white,body,side*.58,1.25,.65+i*.13);tooth.rotation.z=Math.PI;}
      const eye=ball(.17,yellow,body,side*.61,1.76,.59);eye.scale.set(.3,.8,1.1);box(.018,.14,.038,black,body,side*.665,1.76,.6);
      panel(.28,.58,.9,gold,side*.78,1.45,-.16,.04);for(let i=0;i<3;i++)beam([side*.83,1.5,-.42+i*.2],[side*1.02,1.91,-.52+i*.2],.06,gold);
      for(let i=0;i<2;i++)ball(.06,black,body,side*.26,1.721,1.36-i*.16);
    }
    const scales=new T.InstancedMesh(geo(new T.IcosahedronGeometry(.075,0)),mat('#7aa54b',{metalness:.3}),72),dummy=new T.Object3D();body.add(scales);scales.name='Crocodile scales';for(let i=0;i<72;i++){dummy.position.set((i%6-2.5)*.19,1.72+Math.sin(i)*.035,-1.11+Math.floor(i/6)*.18);dummy.scale.set(1,.45,1.25);dummy.updateMatrix();scales.setMatrixAt(i,dummy.matrix);}
    for(let i=0;i<5;i++)mesh(geo(new T.ConeGeometry(.13,.21,4)),paint,body,0,1.91,-.4-i*.19);
    const tail=ball(.28,paint,body,0,1.71,-1.43);tail.scale.set(.55,.65,1.6);beam([0,1.72,-1.4],[0,2,-1.65],.09,paint);
    for(const x of [-.5,.5])box(.1,.045,.04,lightPaint,body,x,1.36,1.58);
  }else{
    panel(1.52,.36,2.66,blue,0,.62,0,.08);panel(1.5,.38,.9,yellow,0,.96,1,.065);panel(1.38,.75,1.02,yellow,0,1.27,.02,.06);
    box(1.18,.46,.025,black,body,0,1.36,.543);for(const side of [-1,1]){box(.018,.4,.73,black,body,side*.698,1.37,.02);panel(.08,.08,.22,yellow,side*.74,1.07,.04,.015);box(.025,.44,.63,white,body,side*.772,.91,.06);for(let i=0;i<5;i++){const spot=ball(.13,black,body,side*.79,.79+(i%3)*.12,-.14+(i%2)*.29);spot.scale.set(.035,.7+i*.1,1.15);}}
    box(1.28,.1,.91,yellow,body,0,.7,-1.03);for(const x of [-.7,.7])box(.12,.4,.94,yellow,body,x,.91,-1.02);box(1.5,.4,.1,yellow,body,0,.91,-1.44);
    for(let i=0;i<7;i++){const z=-1.37+i*.42;box(1.53,.018,.018,mat('#c3482f'),body,0,1.162,z);for(const x of [-.761,.761])box(.012,.034,.038,mat('#c3482f'),body,x,1.05,z);}
    for(const x of [-.5,-.15,.2,.55])box(.021,.014,.83,mat('#c3482f'),body,x,1.165,.98);
    const brimGeometry=geo(new T.CylinderGeometry(1.05,1.05,.06,64));const p=brimGeometry.attributes.position;for(let i=0;i<p.count;i++){const angle=Math.atan2(p.getZ(i),p.getX(i));if(Math.hypot(p.getX(i),p.getZ(i))>.8)p.setY(i,p.getY(i)+Math.cos(angle*2)*.09+Math.sin(angle*12)*.018);}brimGeometry.computeVertexNormals();const brim=mesh(brimGeometry,brown,body,0,1.82,.02);brim.scale.z=.78;brim.name='Woody cowboy hat';
    const crown=mesh(geo(new T.CylinderGeometry(.38,.5,.48,32)),brown,body,0,2.04,.02);crown.scale.z=.83;const band=cylinder(.505,.065,mat('#5a3b32'),body,0,1.86,.02);band.scale.z=.83;
    const starShape=new T.Shape();for(let i=0;i<10;i++){const a=i*Math.PI/5,r=i%2?.07:.16;const x=Math.sin(a)*r,y=Math.cos(a)*r;i?starShape.lineTo(x,y):starShape.moveTo(x,y);}starShape.closePath();const star=mesh(geo(new T.ShapeGeometry(starShape)),gold,body,.5,1.2,1.46);star.rotation.x=-Math.PI/2;
    for(const x of [-.51,.51])box(.2,.12,.025,lightPaint,body,x,.93,1.47);
  }
  const wheelPivots=[],rollers=[],rams=[],links=[],up=new T.Vector3(0,1,0),a=new T.Vector3(),b=new T.Vector3(),pivotOffset=new T.Vector3();
  const treadGeo=geo(new T.BoxGeometry(.16,.055,.1));
  for(const side of [-1,1])for(const along of [-1,1]){
    const x=side*profile.wheelX,z=along*profile.wheelZ,pivot=new T.Group(),roller=new T.Group();pivot.name='Steering wheel pivot';pivot.position.set(x,profile.wheelY,z);root.add(pivot);pivot.add(roller);
    const tire=cylinder(profile.wheelRadius,model.id==='monster-truck'?.44:.25,rubber,roller);tire.rotation.z=Math.PI/2;
    const hub=cylinder(profile.wheelRadius*.64,model.id==='monster-truck'?.455:.27,model.id==='monster-truck'?gold:chrome,roller);hub.rotation.z=Math.PI/2;
    const outer=model.id==='monster-truck'?.24:.145;
    if(model.id==='8-ball'){const ring=mesh(geo(new T.TorusGeometry(.235,.024,8,32)),white,roller,side*outer,0,0);ring.rotation.y=Math.PI/2;for(let i=0;i<3;i++){const spoke=box(.016,.29,.055,white,roller,side*outer,0,0);spoke.rotation.x=i*Math.PI*2/3;}}
    if(model.id==='monster-truck'){const tread=new T.InstancedMesh(treadGeo,rubber,48),dummy=new T.Object3D();roller.add(tread);for(let i=0;i<48;i++){const angle=Math.floor(i/2)/24*Math.PI*2;dummy.position.set(i%2?.12:-.12,Math.sin(angle)*.6,Math.cos(angle)*.6);dummy.rotation.set(-angle,0,i%2?.45:-.45);dummy.scale.set(1.2,1.15,1.6);dummy.updateMatrix();tread.setMatrixAt(i,dummy.matrix);}for(let i=0;i<6;i++){const s=box(.025,.66,.035,gold,roller,side*outer,0,0);s.rotation.x=i*Math.PI/3;}}
    const barrel=cylinder(.055,.32,model.id==='monster-truck'?gold:black,root,x*.7,.65,z),piston=cylinder(.025,1,chrome,root,x*.7,.8,z);barrel.name='hydraulic-cylinder';piston.name='hydraulic-piston';rams.push({barrel,piston});wheelPivots.push({pivot,front:along>0,side,z});rollers.push(roller);
    for(const dz of [-.14,.14]){const rod=cylinder(.027,1,model.id==='monster-truck'?gold:chrome,root);rod.name='Articulated suspension link';links.push({rod,x,z,dz});}
  }
  const headLights=[];for(const side of [-1,1]){const lamp=new T.SpotLight('#ffe6b0',0,20,Math.PI/7,.65,1.35),target=new T.Object3D();lamp.position.set(side*.48,1,1.4);target.position.set(side*.48,0,10);root.add(lamp,target);lamp.target=target;headLights.push(lamp);box(.13,.07,.025,tailPaint,body,side*.5,.76,-1.45);}
  const flames=[];const flameMaterial=new T.MeshBasicMaterial({color:'#a5e6ff',transparent:true,opacity:.8,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false});materials.add(flameMaterial);
  for(const x of [-.43,.43]){const nozzle=cylinder(.08,.18,chrome,body,x,.54,-1.46);nozzle.rotation.x=Math.PI/2;const f=mesh(geo(new T.ConeGeometry(.11,1.25,12)),flameMaterial,root,x,.8,-2.1);f.rotation.x=-Math.PI/2;f.name='Rocket boost exhaust';f.userData.physicsIgnore=true;f.visible=false;flames.push(f);}
  let wheelAngle=0,disposed=false,lastSpeed=0;
  return {root,body,headLights,wheelPivots,hydraulicRams:rams,
    update(dt,{driver,night=0,headlights='auto',braking=false,time=0}){
      const aerial=driver.attitude&&(driver.attitude.flying||driver.attitude.recovering);
      if(aerial){root.quaternion.copy(driver.attitude.rotation);pivotOffset.set(0,CAR_PIVOT_HEIGHT,0).applyQuaternion(root.quaternion);root.position.set(driver.x-pivotOffset.x,(driver.groundHeight||0)+(driver.hop||0)+driver.attitude.supportLift+CAR_PIVOT_HEIGHT-pivotOffset.y,driver.z-pivotOffset.z);}else{root.rotation.set(0,driver.heading||0,0);root.position.set(driver.x,(driver.groundHeight||0)+(driver.hop||0),driver.z);}
      const lift=(driver.rideHeight??profile.raised)+(driver.hydraulicOffset||0);body.position.y=lift;body.rotation.x=reducedMotion||aerial?0:Math.max(-.2,Math.min(.2,driver.pitch||0));body.rotation.z=reducedMotion||aerial?0:Math.max(-.2,Math.min(.2,driver.roll||0));
      const active=headlights==='off'?0:headlights==='on'?1:Math.max(.08,night);headLights.forEach(l=>{l.intensity=32*active;l.position.y=(model.id==='monster-truck'?1.5:.8)+lift;});paint.emissiveIntensity=.02+night*.1;lightPaint.emissiveIntensity=.4+active*3;tailPaint.emissiveIntensity=braking||driver.speed<lastSpeed-1?3:.2+night*.6;lastSpeed=driver.speed;
      wheelAngle+=(driver.speed||0)*Math.min(dt,.05)/profile.wheelRadius;rollers.forEach(r=>r.rotation.x=wheelAngle);
      wheelPivots.forEach(({pivot,front,side},i)=>{const key=`${front?'front':'rear'}${side<0?'Left':'Right'}`,travel=driver.attitude?.flying?0:Math.max(-.25,Math.min(.38,(driver.wheelHeights?.[key]??driver.groundHeight??0)-(driver.groundHeight||0)));pivot.position.y=profile.wheelY+travel;pivot.rotation.y=front?(driver.steering||0)*.4:0;const bottom=profile.wheelY+travel,top=profile.wheelY+.38+lift,r=rams[i];r.barrel.position.y=bottom+.14;r.piston.position.y=(bottom+top)/2;r.piston.scale.y=Math.max(.08,top-bottom);});
      for(const link of links){a.set(link.x*.35,profile.wheelY+.3+lift,link.z+link.dz);b.set(link.x,profile.wheelY,link.z);link.rod.position.copy(a).add(b).multiplyScalar(.5);link.rod.scale.y=a.distanceTo(b);link.rod.quaternion.setFromUnitVectors(up,b.sub(a).normalize());}
      flames.forEach(f=>{f.visible=Boolean(driver.boosting);f.position.y=.54+lift;f.scale.y=reducedMotion?1:.9+Math.sin(time*45)*.12;});
    },
    dispose(){if(disposed)return;disposed=true;root.removeFromParent();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());}
  };
}
