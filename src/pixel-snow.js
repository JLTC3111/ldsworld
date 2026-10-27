import {buildAtlas} from './vendor/pixel-snow-atlas.js';

export const PIXEL_SNOW_SETTINGS=Object.freeze({color:'#ffffff',variant:'snowflake',density:.5,speed:1,wind:.25,flakeSize:1,pixelSize:3,glow:.8,mouseInteraction:true});
const vertexShader=`
attribute float snowSlot;
attribute float snowLight;
uniform float pixelSize;
uniform float pixelRatio;
uniform vec2 mouse;
uniform float mousePush;
uniform float aspect;
varying float vSize;
varying float vSlot;
varying float vLight;
void main(){
  float level=snowSlot<5.0?snowSlot:snowSlot-3.0;
  vSize=level<.5?1.0:level<1.5?3.0:level<2.5?5.0:level<3.5?7.0:9.0;
  vSlot=snowSlot;vLight=snowLight;
  vec4 mvPosition=modelViewMatrix*vec4(position,1.0);
  vec4 clip=projectionMatrix*mvPosition;
  vec2 delta=(clip.xy/clip.w-mouse)*vec2(aspect,1.0);
  float distanceToMouse=length(delta);
  float push=(1.0-smoothstep(0.0,.26,distanceToMouse))*mousePush;
  clip.xy+=normalize(delta+vec2(.0001))*.035*push*clip.w/vec2(aspect,1.0);
  gl_Position=clip;
  gl_PointSize=(vSize+2.0)*pixelSize*pixelRatio;
}`;
const fragmentShader=`
uniform sampler2D atlas;
uniform vec3 snowColor;
uniform float opacity;
uniform float glow;
uniform float atlasRow;
varying float vSize;
varying float vSlot;
varying float vLight;
vec2 sampleCell(vec2 p){
  if(p.x<0.0||p.y<0.0||p.x>=vSize||p.y>=vSize)return vec2(0.0);
  return texture2D(atlas,(vec2(vSlot*9.0,atlasRow)+p+.5)/vec2(72.0,27.0)).rg;
}
void main(){
  vec2 p=floor(gl_PointCoord*(vSize+2.0))-1.0;
  vec2 core=sampleCell(p);
  float edge=max(max(sampleCell(p+vec2(1.,0.)).r,sampleCell(p-vec2(1.,0.)).r),max(sampleCell(p+vec2(0.,1.)).r,sampleCell(p-vec2(0.,1.)).r));
  float alpha=opacity*vLight*max(core.r*(.68+core.g*.32),edge*glow*.14);
  if(alpha<.015)discard;
  gl_FragColor=vec4(snowColor,alpha);
}`;

/** Pixel Snow's atlas in the existing Three scene: one draw, no glow targets. */
export function createPixelSnow({THREE:T,renderer,capacity=920,coarse=false,reducedMotion=false,settings=PIXEL_SNOW_SETTINGS}={}){
  const artwork=buildAtlas(),texture=new T.DataTexture(artwork.data,artwork.width,artwork.height,T.RGBAFormat);
  texture.minFilter=texture.magFilter=T.NearestFilter;texture.generateMipmaps=false;texture.needsUpdate=true;
  const positions=new Float32Array(capacity*3),slots=new Float32Array(capacity),lights=new Float32Array(capacity),seeds=[];
  let seed=4271;const random=()=>{seed=seed*16807%2147483647;return(seed-1)/2147483646;};
  for(let i=0;i<capacity;i++){
    const chance=random(),level=chance<.46?0:chance<.73?1:chance<.88?2:chance<.96?3:4;
    slots[i]=level>=2&&random()<.5?level+3:level;lights[i]=[.42,.58,.76,.92,1][level];
    const particle={x:(random()-.5)*68,y:random()*30,z:(random()-.5)*56,speed:.8+level*.32,phase:random()*Math.PI*2};seeds.push(particle);
    positions.set([particle.x,particle.y,particle.z],i*3);
  }
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(positions,3));geometry.attributes.position.setUsage(T.DynamicDrawUsage);
  geometry.setAttribute('snowSlot',new T.BufferAttribute(slots,1));geometry.setAttribute('snowLight',new T.BufferAttribute(lights,1));
  const uniforms={atlas:{value:texture},snowColor:{value:new T.Color(settings.color)},opacity:{value:0},pixelSize:{value:settings.pixelSize*settings.flakeSize},pixelRatio:{value:1},glow:{value:settings.glow},atlasRow:{value:settings.variant==='square'?0:settings.variant==='round'?9:18},mouse:{value:new T.Vector2(2,2)},mousePush:{value:0},aspect:{value:1}};
  const material=new T.ShaderMaterial({uniforms,vertexShader,fragmentShader,transparent:true,depthWrite:false,depthTest:true,toneMapped:false});
  const object=new T.Points(geometry,material);object.name='atmosphere-snow';object.frustumCulled=false;object.visible=false;
  const surface=renderer?.domElement,size=new T.Vector2();let activeCount=0,disposed=false,mouseInside=false,averageFrame=1/60,slowFor=0,recoverFor=0,adaptive=false;
  const move=event=>{if(!object.visible||coarse||reducedMotion||!settings.mouseInteraction||event.pointerType==='touch')return;const r=surface.getBoundingClientRect();if(r.width&&r.height){uniforms.mouse.value.set((event.clientX-r.left)/r.width*2-1,1-(event.clientY-r.top)/r.height*2);mouseInside=true;}};
  const leave=()=>{mouseInside=false;};surface?.addEventListener?.('pointermove',move,{passive:true});surface?.addEventListener?.('pointerleave',leave);surface?.addEventListener?.('pointercancel',leave);
  function update(dt=0,{opacity=0,time=0,wind=0,paused=false}={}){
    if(disposed)return;
    object.visible=opacity>.01;material.opacity=opacity;uniforms.opacity.value=opacity;
    renderer?.getSize?.(size);const width=size.x||globalThis.innerWidth||1280,height=size.y||globalThis.innerHeight||720;
    uniforms.pixelRatio.value=Math.min(renderer?.getPixelRatio?.()||1,coarse?1.5:1.8);uniforms.aspect.value=width/height;
    if(!paused&&object.visible&&dt>0){averageFrame+=(Math.min(dt,.1)-averageFrame)*.06;slowFor=averageFrame>.027?slowFor+dt:0;recoverFor=averageFrame<.019?recoverFor+dt:0;if(slowFor>2)adaptive=true;if(recoverFor>8)adaptive=false;}
    const limit=reducedMotion?90:coarse?320:capacity;
    activeCount=Math.max(0,Math.min(capacity,limit,Math.round(width*height*settings.density/1100*(adaptive?.6:1))));geometry.setDrawRange(0,activeCount);
    const mouseTarget=mouseInside&&!paused&&object.visible&&!adaptive?1:0;
    uniforms.mousePush.value=paused?0:uniforms.mousePush.value+(mouseTarget-uniforms.mousePush.value)*Math.min(1,dt*8);
    if(paused||!object.visible||dt<=0)return;
    const step=Math.min(.1,dt)*(reducedMotion?.15:1)*settings.speed;
    for(let i=0;i<activeCount;i++){
      const p=seeds[i];p.y-=step*p.speed;p.x+=step*(settings.wind+wind*.08+Math.sin(time*.6+p.phase)*.4);p.z+=step*Math.cos(time*.45+p.phase)*.18;
      if(p.y<.18){p.y+=30;p.x=(random()-.5)*68;p.z=(random()-.5)*56;}
      const offset=i*3;positions[offset]=p.x;positions[offset+1]=p.y;positions[offset+2]=p.z;
    }
    geometry.attributes.position.needsUpdate=true;
  }
  update(0);
  return {object,material,geometry,update,getStats:()=>({capacity,activeCount,adaptive,drawCalls:1,atlasBytes:artwork.data.byteLength,settings:{...settings}}),dispose(){if(disposed)return;disposed=true;object.removeFromParent();surface?.removeEventListener?.('pointermove',move);surface?.removeEventListener?.('pointerleave',leave);surface?.removeEventListener?.('pointercancel',leave);geometry.dispose();material.dispose();texture.dispose();}};
}
