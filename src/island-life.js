export const islandLifeLayout=[
  {x:-10.5,z:22.5,width:3.6,depth:2.8,kind:'stall'}, {x:10.5,z:22.5,width:3.6,depth:2.8,kind:'stall'},
  {x:-38,z:-14,width:2.1,depth:1.4,kind:'snowman'}, {x:12,z:-24,width:2.1,depth:1.4,kind:'snowman'}, {x:17,z:24,width:2.1,depth:1.4,kind:'snowman'}
];
export const reservesIslandLifeSpace=(x,z,padding=.8)=>islandLifeLayout.some(p=>Math.abs(x-p.x)<p.width/2+padding&&Math.abs(z-p.z)<p.depth/2+padding);
export function createIslandLife({THREE:T,scene,reducedMotion=false}={}) {
  const root=new T.Group();root.name='Island market and snowmen';scene.add(root);
  const geo=new Set(),mats=new Map(),bulbs=[],vendors=[],stalls=[];let disposed=false,time=0;
  const cube=new T.BoxGeometry(1,1,1),orb=new T.IcosahedronGeometry(1,2);geo.add(cube);geo.add(orb);
  const material=(color,glow=false)=>{const key=color+glow;if(!mats.has(key))mats.set(key,new T.MeshStandardMaterial({color,roughness:.8,...(glow?{emissive:color,emissiveIntensity:.2}:{})}));return mats.get(key);};
  const mesh=(g,c,p,x,y,z)=>{geo.add(g);const o=new T.Mesh(g,typeof c==='string'?material(c):c);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;p.add(o);return o;};
  const box=(w,h,d,c,p,x=0,y=0,z=0)=>{const o=mesh(cube,c,p,x,y,z);o.scale.set(w,h,d);return o;};
  const ball=(r,c,p,x=0,y=0,z=0)=>{const o=mesh(orb,c,p,x,y,z);o.scale.setScalar(r);return o;};
  const cyl=(r,h,c,p,x,y,z)=>mesh(new T.CylinderGeometry(r,r,h,12),c,p,x,y,z);
  function beam(a,b,w,c,p){const av=new T.Vector3(...a),bv=new T.Vector3(...b),o=box(w,av.distanceTo(bv),w,c,p);o.position.copy(av).add(bv).multiplyScalar(.5);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),bv.sub(av).normalize());return o;}
  const snowmen=new T.Group();snowmen.name='Snow-weather snowmen';snowmen.visible=false;root.add(snowmen);
  islandLifeLayout.filter(p=>p.kind==='snowman').forEach((p,i)=>{
    const s=new T.Group();s.name=`Snowman ${i+1}`;s.userData.physicsKind='snowman';s.position.set(p.x,.12,p.z);s.rotation.y=[.3,-.4,-.3][i];snowmen.add(s);
    ball(.58,'#e9f1e9',s,0,.55,0);ball(.43,'#f3f5e9',s,0,1.22,0);ball(.31,'#f4f7ee',s,0,1.84,0);
    const scarf=['#c67c55','#6e9e91','#b49b59'][i];cyl(.35,.12,scarf,s,0,1.58,0);box(.15,.52,.1,scarf,s,.18,1.3,.37);
    for(const x of [-.105,.105])ball(.035,'#314039',s,x,1.91,.284);
    for(let j=0;j<4;j++)ball(.021,'#34463d',s,(j-1.5)*.061,1.73+Math.abs(j-1.5)*.025,.285);
    const nose=mesh(new T.ConeGeometry(.075,.32,7),'#dc9b51',s,0,1.82,.41);nose.rotation.x=Math.PI/2;
    for(let j=0;j<3;j++)ball(.045,'#3b5147',s,0,1.33-j*.23,.41+(j*.04));
    cyl(.37,.065,'#3f5c50',s,0,2.13,0);cyl(.25,.35,'#3f5c50',s,0,2.31,0);cyl(.255,.07,scarf,s,0,2.18,0);
    for(const side of [-1,1]){beam([side*.32,1.35,0],[side*.95,1.57,.04],.045,'#8b745b',s);beam([side*.79,1.51,.04],[side*.85,1.77,.03],.028,'#8b745b',s);}
  });
  const caps=[];
  islandLifeLayout.filter(p=>p.kind==='stall').forEach((p,i)=>{
    const stall=new T.Group();stall.name=i?'Garden produce stall':'Lantern coffee stall';stall.position.set(p.x,.12,p.z);root.add(stall);stalls.push(stall);
    const paint=i?'#9eae78':'#be8f6e';box(3.35,.14,2.5,'#b49b76',stall,0,.08,0);
    box(3.1,.9,.65,paint,stall,0,.65,.61);box(3.35,.14,.9,'#d1b58a',stall,0,1.15,.61);
    for(let j=0;j<10;j++)box(.025,.79,.018,'#8a785c',stall,-1.4+j*.31,.65,.95);
    for(const x of [-1.48,1.48])for(const z of [-1,1])box(.12,2.7,.12,'#8c7659',stall,x,1.4,z);
    for(let j=0;j<9;j++){const awning=box(.38,.13,2.8,j%2?'#eee2c3':paint,stall,-1.52+j*.38,2.83,0);awning.rotation.x=-.1;box(.38,.25,.09,j%2?'#eee2c3':paint,stall,-1.52+j*.38,2.6,1.38);}
    const cap=box(3.48,.07,2.8,'#eef4e9',stall,0,2.95,-.01);caps.push(cap);
    const vendor=new T.Group();vendor.name=`Vendor ${i+1}`;vendor.position.set(0,.1,-.4);stall.add(vendor);vendors.push(vendor);
    for(const x of [-.16,.16]){box(.16,.57,.2,'#40544a',vendor,x,.42,0);box(.2,.12,.32,'#455047',vendor,x,.14,.07);}
    box(.58,.72,.32,i?'#718f78':'#c49b75',vendor,0,1.02,0);box(.43,.6,.025,'#e2d7b8',vendor,0,.94,.18);
    const head=ball(.24,i?'#ad7e5e':'#d8ac86',vendor,0,1.64,0);head.scale.y*=1.1;
    for(const x of [-.075,.075])ball(.019,'#39483d',vendor,x,1.67,.226);
    cyl(.26,.09,paint,vendor,0,1.88,0);ball(.22,paint,vendor,0,1.94,-.02).scale.y=.35;
    for(const side of [-1,1]){beam([side*.29,1.27,0],[side*.38,.95,.55],.13,i?'#718f78':'#c49b75',vendor);ball(.08,i?'#ad7e5e':'#d8ac86',vendor,side*.38,.95,.57);}
    if(i){for(let k=0;k<3;k++){box(.76,.14,.47,'#b19a70',stall,-1+k,1.3,.63);for(let n=0;n<4;n++)ball(.11,['#b5a55b','#bd7859','#85a376'][k],stall,-1+k+(n%2-.5)*.26,1.46,.49+Math.floor(n/2)*.23);}}
    else {for(let k=0;k<3;k++)cyl(.095,.18,'#eee3c8',stall,-.7+k*.45,1.32,.65);box(.5,.62,.45,'#647b6c',stall,.9,1.52,.47);cyl(.17,.08,'#e1d5b7',stall,.9,1.85,.47);}
    const glow=material('#efc87c',true);bulbs.push(glow);for(const x of [-.9,0,.9]){cyl(.008,.3,'#6d7054',stall,x,2.5,.9);ball(.1,glow,stall,x,2.31,.9);}
    const light=new T.PointLight('#f5d399',0,5,2);light.position.set(0,2.4,.8);stall.add(light);bulbs.push(light);
  });
  return {root,snowmen,vendors,stalls,colliders:islandLifeLayout.filter(p=>p.kind==='stall').map((p,i)=>({...p,kind:'market',active:()=>stalls[i].visible})),
    update(dt,{weather='clear',night=0,paused=false}={}){if(disposed)return;snowmen.visible=weather==='snow';caps.forEach(c=>c.visible=weather==='snow');if(!paused&&!reducedMotion)time+=Math.max(0,Number(dt)||0);vendors.forEach((v,i)=>v.rotation.y=Math.sin(time*.5+i)*.035);bulbs.forEach(b=>{if(b.isLight)b.intensity=night*3;else b.emissiveIntensity=.2+night*2;});},
    dispose(){if(disposed)return;disposed=true;root.removeFromParent();geo.forEach(g=>g.dispose());mats.forEach(m=>m.dispose());}
  };
}
