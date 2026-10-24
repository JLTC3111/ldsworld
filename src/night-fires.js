import { projects } from './data.js';
import { roadNodes,roadLoop,outerRoadLoop,connectorPaths } from './driving.js';

const clamp=value=>Math.max(0,Math.min(1,value));
export function nightFirePower(environment={}){
  const raw=Number.isFinite(environment.sunHeight)?(.02-environment.sunHeight)/.2:((environment.night||0)-.2)/.6;
  const t=clamp(raw);return t*t*(3-2*t);
}
const segments=[roadLoop,outerRoadLoop].flatMap(loop=>loop.map((point,index)=>[point,loop[(index+1)%loop.length]]));
segments.push(...connectorPaths.flatMap(path=>path.slice(1).map((key,i)=>[roadNodes[path[i]],roadNodes[key]])));
const roadDistance=(x,z,a,b)=>{const dx=b[0]-a[0],dz=b[1]-a[1],t=clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz));return Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t);};
export const fireLocations=projects.map(project=>{
  const [x,z]=roadNodes[project.stop],direction=Math.atan2(project.position[1]-z,project.position[0]-x);
  for(const radius of [6,8,10])for(const offset of [.65,-.65,1.2,-1.2,2.1,-2.1]){
    const point={id:`trash-fire-${project.id}`,x:x+Math.cos(direction+offset)*radius,z:z+Math.sin(direction+offset)*radius};
    if(segments.some(([a,b])=>roadDistance(point.x,point.z,a,b)<4.1))continue;
    if(projects.some(p=>Math.abs(point.x-p.position[0])<p.footprint[0]/2+1.4&&Math.abs(point.z-p.position[1])<p.footprint[1]/2+1.4))continue;
    return point;
  }
  return {id:`trash-fire-${project.id}`,x:x+7,z:z+7};
});

export function createNightFires({THREE:T,scene,reducedMotion=false}){
  const root=new T.Group();root.name='Night-time trash-can fires';scene.add(root);
  const geometries=new Set(),materials=new Set(),cans=[];let time=0,disposed=false;
  const geometry=g=>{geometries.add(g);return g;},material=m=>{materials.add(m);return m;};
  const steel=material(new T.MeshStandardMaterial({color:'#63716b',metalness:.65,roughness:.55,side:T.DoubleSide}));
  const rim=material(new T.MeshStandardMaterial({color:'#a9b3a7',metalness:.8,roughness:.32}));
  const dark=material(new T.MeshStandardMaterial({color:'#27332d',roughness:.98}));
  const bodyGeometry=geometry(new T.CylinderGeometry(.37,.31,.86,16,1,true));
  const bandGeometry=geometry(new T.TorusGeometry(.367,.026,6,20)),floorGeometry=geometry(new T.CylinderGeometry(.31,.31,.035,16));
  const handleGeometry=geometry(new T.TorusGeometry(.1,.02,5,12)),coalGeometry=geometry(new T.IcosahedronGeometry(.095,0));
  const flameGeometry=geometry(new T.PlaneGeometry(.9,1.4));
  const firePaint=material(new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending,toneMapped:false,
    uniforms:{uTime:{value:0},uPower:{value:0}},
    vertexShader:`varying vec2 vUv;varying vec3 vWorld;void main(){vUv=uv;vec4 world=modelMatrix*vec4(position,1.0);vWorld=world.xyz;gl_Position=projectionMatrix*viewMatrix*world;}`,
    fragmentShader:`
      uniform float uTime;uniform float uPower;varying vec2 vUv;varying vec3 vWorld;
      float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
      float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
      void main(){
        float n=noise(vec2(vUv.x*5.0+vWorld.x*.17,vUv.y*5.0-uTime*2.7+vWorld.z*.13));
        float center=.5+sin(vUv.y*9.0-uTime*4.0+vWorld.x)*.07*vUv.y;
        float width=pow(max(0.0,1.0-vUv.y),.65)*.44;
        float mask=smoothstep(-.045,.07,width-abs(vUv.x-center)+(n-.5)*.17);
        float alpha=mask*smoothstep(0.0,.09,vUv.y)*(1.0-smoothstep(.83,1.0,vUv.y))*uPower;
        vec3 glow=mix(vec3(1.0,.17,.015),vec3(1.0,.86,.3),pow(1.0-vUv.y,1.6));
        gl_FragColor=vec4(glow*1.5,alpha*.82);
      }`
  }));
  for(const [index,location] of fireLocations.entries()){
    const can=new T.Group();can.name=`Fire can ${index+1}`;can.userData.physicsKind='trash-can';can.position.set(location.x,.12,location.z);root.add(can);
    const add=(g,m,x=0,y=0,z=0)=>{const mesh=new T.Mesh(g,m);mesh.position.set(x,y,z);mesh.castShadow=true;mesh.receiveShadow=true;can.add(mesh);return mesh;};
    add(bodyGeometry,steel,0,.46,0);add(floorGeometry,dark,0,.05,0);
    for(const y of [.08,.25,.67,.91]){const ring=add(bandGeometry,rim,0,y,0);ring.rotation.x=Math.PI/2;}
    for(const x of [-.38,.38]){const handle=add(handleGeometry,rim,x,.7,0);handle.rotation.y=Math.PI/2;}
    for(let i=0;i<5;i++)add(coalGeometry,dark,Math.sin(i*2.4)*.2,.82,Math.cos(i*2.4)*.2);
    const flames=new T.Group();flames.name='Automatic night flames';flames.userData.physicsIgnore=true;flames.visible=false;can.add(flames);
    for(let i=0;i<3;i++){const plane=new T.Mesh(flameGeometry,firePaint);plane.position.y=1.45;plane.rotation.y=i*Math.PI/3;plane.renderOrder=3;flames.add(plane);}
    const light=new T.PointLight('#ffae57',0,11,2);light.position.set(0,1.2,0);light.visible=false;can.add(light);
    cans.push({object:can,flames,light,position:new T.Vector3()});
  }
  function update(dt=0,environment={},driver={x:0,z:0},paused=false){
    if(disposed)return;
    if(!paused&&!reducedMotion)time+=Math.max(0,Math.min(.1,dt));
    const power=nightFirePower(environment);firePaint.uniforms.uPower.value=power;firePaint.uniforms.uTime.value=time;
    const nearest=cans.map((can,index)=>{can.object.getWorldPosition(can.position);return{index,distance:Math.hypot(can.position.x-driver.x,can.position.z-driver.z)};}).sort((a,b)=>a.distance-b.distance).filter(item=>item.distance<42).slice(0,2).map(item=>item.index);
    cans.forEach((can,index)=>{can.flames.visible=power>.005;can.light.visible=power>.005&&nearest.includes(index);can.light.intensity=can.light.visible?power*(7+Math.sin(time*11+index)*.65+Math.sin(time*17+index*2)*.35):0;});
  }
  update(0);
  return {root,cans,update,dispose(){if(disposed)return;disposed=true;root.removeFromParent();cans.forEach(can=>can.object.removeFromParent());geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());}};
}
