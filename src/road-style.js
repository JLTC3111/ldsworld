import { isWater,bridgeAt } from './world-layout.js';
import { CatmullRomCurve3,Vector3 } from './vendor/three.module.js';

export const ASPHALT_COLOR='#34343b';
export function roadSvgPath(points,closed=false){const curve=new CatmullRomCurve3(points.map(([x,z])=>new Vector3(x,0,z)),closed,'catmullrom',.25);return 'M'+curve.getPoints(Math.max(24,Math.min(240,Math.ceil(curve.getLength()/2)))).map(p=>`${p.x.toFixed(2)},${p.z.toFixed(2)}`).join('L')+(closed?'Z':'');}
export function createAsphaltTexture(T,{coarse=false}={}){
  const canvas=globalThis.document?.createElement('canvas'),ctx=canvas?.getContext('2d');
  if(!ctx?.createImageData||!ctx?.putImageData)return null;
  canvas.width=canvas.height=coarse?256:512;const image=ctx.createImageData(canvas.width,canvas.height);let seed=73019;
  for(let i=0;i<image.data.length;i+=4){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const noise=seed/4294967296,value=noise>.965?254:noise<.045?140:195+Math.round(noise*40);image.data[i]=value;image.data[i+1]=value;image.data[i+2]=Math.min(255,value+3);image.data[i+3]=255;}
  ctx.putImageData(image,0,0);const texture=new T.CanvasTexture(canvas);texture.name='Fine asphalt aggregate';texture.colorSpace=T.SRGBColorSpace;texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.anisotropy=4;return texture;
}
const distanceToSegment=(x,z,a,b)=>{const dx=b.x-a.x,dz=b.z-a.z,t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz)));return Math.hypot(x-a.x-t*dx,z-a.z-t*dz);};
export function addRacingCurbs({THREE:T,parent,roads,geometry,red,ivory}){
  const root=new T.Group();root.name='Red and ivory racing curbs';root.userData.physicsIgnore=true;parent.add(root);
  const samples=roads.map(r=>r.curve.getSpacedPoints(Math.max(12,Math.ceil(r.curve.getLength()/3)))),entries=[[],[]],point=new T.Vector3(),tangent=new T.Vector3();
  for(const [index,road] of roads.entries()){
    const count=Math.ceil(road.curve.getLength()/2);
    for(let i=0;i<count;i++){
      const t=(i+.5)/count;road.curve.getPointAt(t,point);road.curve.getTangentAt(t,tangent);
      for(const side of [-1,1]){
        const offset=side*(road.width/2+.25),x=point.x-tangent.z*offset,z=point.z+tangent.x*offset;
        if(isWater(x,z)||bridgeAt(x,z))continue;
        const junction=roads.some((other,j)=>j!==index&&samples[j].slice(1).some((b,k)=>distanceToSegment(x,z,samples[j][k],b)<other.width/2+.5));
        if(junction)continue;
        entries[i%2].push({x,z,heading:Math.atan2(tangent.x,tangent.z),length:road.curve.getLength()/count+.025});
      }
    }
  }
  const dummy=new T.Object3D();
  for(const [i,material] of [red,ivory].entries()){
    const mesh=new T.InstancedMesh(geometry,material,entries[i].length);mesh.name=i?'Ivory track curb blocks':'Red track curb blocks';mesh.receiveShadow=true;
    entries[i].forEach((p,j)=>{dummy.position.set(p.x,.133,p.z);dummy.rotation.set(0,p.heading,0);dummy.scale.set(.7,.045,p.length);dummy.updateMatrix();mesh.setMatrixAt(j,dummy.matrix);});root.add(mesh);
  }
  return root;
}
