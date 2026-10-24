import { RIVER_REACH, RIVER_HALF_WIDTH, riverCenter, isWater } from './world-layout.js';

const vertexShader=`
  varying vec3 vStreamWorld;
  varying float vBank;
  attribute float bank;
  #include <fog_pars_vertex>
  void main(){
    vBank=bank;
    vec4 world=modelMatrix*vec4(position,1.0);
    vStreamWorld=world.xyz;
    vec4 mvPosition=viewMatrix*world;
    gl_Position=projectionMatrix*mvPosition;
    #include <fog_vertex>
  }
`;

const fragmentShader=`
  uniform float uTime;
  uniform float uDaylight;
  uniform float uRain;
  uniform vec3 uSky;
  uniform vec3 uSun;
  uniform vec4 uRipples[8];
  varying vec3 vStreamWorld;
  varying float vBank;
  #include <fog_pars_fragment>
  void main(){
    vec2 p=vStreamWorld.xz;
    float a=p.x*3.1+p.y*4.7-uTime*2.4;
    float b=p.x*7.3-p.y*3.8+uTime*1.3;
    vec2 gradient=vec2(3.1,4.7)*cos(a)*.014+vec2(7.3,-3.8)*cos(b)*.005;
    float wake=0.0;
    for(int i=0;i<8;i++){
      float age=uTime-uRipples[i].z;
      if(uRipples[i].w>.001&&age>=0.0&&age<2.0){
        vec2 delta=p-uRipples[i].xy;float d=length(delta);
        float ring=exp(-pow((d-age*1.7)*5.0,2.0))*(1.0-age*.5)*uRipples[i].w;
        gradient+=delta/max(d,.05)*ring*.22;wake+=ring;
      }
    }
    vec3 n=normalize(vec3(-gradient.x,1.0,-gradient.y));
    vec3 viewDirection=normalize(cameraPosition-vStreamWorld);
    float fresnel=pow(1.0-max(dot(n,viewDirection),0.0),4.0);
    float depth=1.0-pow(abs(vBank),1.3);
    vec3 shallow=vec3(.22,.48,.43),deep=vec3(.045,.24,.26);
    vec3 water=mix(shallow,deep,depth)*(.28+uDaylight*.72);
    float sparkle=pow(max(dot(reflect(-normalize(uSun),n),viewDirection),0.0),110.0)*(1.0-uRain*.65);
    vec3 reflected=mix(uSky*.75,vec3(.92,.97,1.0),sparkle*.8);
    water=mix(water,reflected,.16+fresnel*.64)+vec3(1.0,.9,.65)*sparkle*uDaylight*.65;
    float shore=smoothstep(.75,.99,abs(vBank))*(.25+.2*sin(p.x*8.0-uTime*2.5));
    float streak=pow(max(0.0,sin(a*.65+sin(b)*.5)),18.0)*.08;
    water=mix(water,vec3(.77,.89,.85)*(.3+.7*uDaylight),min(.7,shore+streak+wake*.5));
    gl_FragColor=vec4(water,.74+depth*.16+fresnel*.08);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

export function createStreamWater({THREE:T,parent,scene,reducedMotion=false,coarse=false}){
  const root=new T.Group();root.name='Shallow flowing stream';root.userData.physicsIgnore=true;parent.add(root);
  const geometries=new Set(),materials=new Set();
  const ownGeometry=g=>{geometries.add(g);return g;},ownMaterial=m=>{materials.add(m);return m;};
  const count=Math.max(180,Math.ceil(RIVER_REACH*2/.65)),positions=[],banks=[],indices=[];
  const bedPositions=[],bedColors=[],color=new T.Color();
  for(let i=0;i<=count;i++){
    const x=-RIVER_REACH+i/count*RIVER_REACH*2;
    for(const side of [-1,0,1]){
      const z=riverCenter(x)+side*RIVER_HALF_WIDTH;
      positions.push(x,.075,z);banks.push(side);
      bedPositions.push(x,-.033,z);
      color.set(side?'#9caa89':'#667f74').multiplyScalar(.92+.08*Math.sin(x*5.7));bedColors.push(color.r,color.g,color.b);
    }
    if(i<count)for(let j=0;j<2;j++){const a=i*3+j;indices.push(a,a+3,a+1,a+1,a+3,a+4);}
  }
  const geometry=ownGeometry(new T.BufferGeometry());geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('bank',new T.Float32BufferAttribute(banks,1));geometry.setIndex(indices);geometry.computeVertexNormals();
  const ripples=Array.from({length:8},()=>new T.Vector4(0,0,-10,0));
  const uniforms=T.UniformsUtils.merge([T.UniformsLib.fog,{uTime:{value:0},uDaylight:{value:1},uRain:{value:0},uSky:{value:new T.Color('#dce8e3')},uSun:{value:new T.Vector3(-.5,.8,.3)},uRipples:{value:ripples}}]);
  const material=ownMaterial(new T.ShaderMaterial({uniforms,vertexShader,fragmentShader,transparent:true,depthWrite:false,side:T.DoubleSide,fog:true}));
  const surface=new T.Mesh(geometry,material);surface.name='Winding animated river';surface.renderOrder=2;root.add(surface);
  const bedGeometry=ownGeometry(new T.BufferGeometry());bedGeometry.setAttribute('position',new T.Float32BufferAttribute(bedPositions,3));bedGeometry.setAttribute('color',new T.Float32BufferAttribute(bedColors,3));bedGeometry.setIndex(indices);bedGeometry.computeVertexNormals();
  const bed=new T.Mesh(bedGeometry,ownMaterial(new T.MeshStandardMaterial({vertexColors:true,roughness:.96,side:T.DoubleSide})));bed.name='Visible shallow stream bed';bed.receiveShadow=true;root.add(bed);
  const bankGeometry=ownGeometry(new T.BufferGeometry()),bankVertices=[],bankIndices=[];
  for(const side of [-1,1])for(let i=0;i<=count;i++){
    const x=-RIVER_REACH+i/count*RIVER_REACH*2,z=riverCenter(x)+side*RIVER_HALF_WIDTH,base=bankVertices.length/3;
    bankVertices.push(x,.072,z,x,.065,z+side*.22,x,-.025,z+side*.5);
    if(i<count)bankIndices.push(base,base+3,base+1,base+1,base+3,base+4,base+1,base+4,base+2,base+2,base+4,base+5);
  }
  bankGeometry.setAttribute('position',new T.Float32BufferAttribute(bankVertices,3));bankGeometry.setIndex(bankIndices);bankGeometry.computeVertexNormals();
  const shore=new T.Mesh(bankGeometry,ownMaterial(new T.MeshStandardMaterial({color:'#b2b89a',roughness:1,side:T.DoubleSide})));shore.name='Low ford banks';root.add(shore);
  const fallGeometry=ownGeometry(new T.BoxGeometry(.12,1.55,RIVER_HALF_WIDTH*1.9));
  const fallMaterial=ownMaterial(new T.MeshStandardMaterial({color:'#93beb8',roughness:.18,transparent:true,opacity:.72,side:T.DoubleSide}));
  for(const x of [-RIVER_REACH+.3,RIVER_REACH-.3]){const fall=new T.Mesh(fallGeometry,fallMaterial);fall.position.set(x,-.7,riverCenter(x));fall.name='River mouth waterfall';root.add(fall);}
  let time=0,lastRipple=-1,rippleIndex=0,disposed=false;
  function update(dt=0,{driver,night=0,daylight=1-night,weather='clear',sunAngle=0,sunHeight=1}={}){
    if(disposed)return;
    if(!reducedMotion)time+=Math.max(0,Math.min(.1,dt));
    uniforms.uTime.value=time;uniforms.uDaylight.value=daylight;uniforms.uRain.value=weather==='rain'?1:0;
    if(scene?.background?.isColor)uniforms.uSky.value.copy(scene.background);
    uniforms.uSun.value.set(Math.cos(sunAngle),Math.max(.12,sunHeight),.35).normalize();
    if(driver&&!reducedMotion&&isWater(driver.x,driver.z)&&(driver.hop||0)<.15&&Math.abs(driver.speed)>.3&&time-lastRipple>.12){
      uniforms.uRipples.value[rippleIndex++%8].set(driver.x,driver.z,time,Math.min(1,Math.abs(driver.speed)/5));lastRipple=time;
    }
    if(!reducedMotion){const p=geometry.attributes.position;for(let i=0;i<p.count;i++)p.setY(i,.075+Math.sin(p.getX(i)*1.8-time*1.6+p.getZ(i)*2)*.009+Math.sin(p.getX(i)*5.4+time*.7)*.003);p.needsUpdate=true;}
  }
  update(0);
  return {root,surface,update,reset(){time=0;lastRipple=-1;uniforms.uRipples.value.forEach(r=>r.set(0,0,-10,0));update(0);},dispose(){if(disposed)return;disposed=true;root.removeFromParent();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());}};
}
