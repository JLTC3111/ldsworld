import { isRiver,bridgeAt,riverCenter,RIVER_HALF_WIDTH,RIVER_REACH } from './world-layout.js';
import { CatmullRomCurve3,LineCurve3,Vector3 } from './vendor/three.module.js';

export const ASPHALT_COLOR='#34343b';
export function createRoadCurve(points,closed=false,height=0){const vectors=points.map(([x,z])=>new Vector3(x,height,z));return points.length===2?new LineCurve3(...vectors):new CatmullRomCurve3(vectors,closed,'catmullrom',.25);}
// Clip road triangles to the same river banks as the water surface. Lowering
// isolated grid vertices used to leave diagonal asphalt/water patches here.
export function createRoadGeometry({THREE:T,curve,width,height=.1}){
  const length=curve.getLength(),count=Math.max(curve.closed?360:100,Math.ceil(length/.65)),across=Math.ceil(width/.55);
  const vertices=[],positions=[],uvs=[],indices=[],point=new T.Vector3(),tangent=new T.Vector3();
  const add=p=>{const index=positions.length/3;positions.push(p.x,height,p.z);uvs.push(p.u,p.v);return index;};
  for(let i=0;i<=count;i++){
    const t=i/count;curve.getPointAt(t,point);curve.getTangentAt(t,tangent);
    for(let j=0;j<=across;j++){
      const offset=(j/across-.5)*width,p={x:point.x-tangent.z*offset,z:point.z+tangent.x*offset,u:j/across,v:t*length/4};vertices.push(p);add(p);
    }
  }
  const bank=(p,side)=>side*(p.z-riverCenter(p.x))-RIVER_HALF_WIDTH-.03;
  function clip(polygon,side){
    const result=[];
    for(let i=0;i<polygon.length;i++){
      const a=polygon[i],b=polygon[(i+1)%polygon.length],insideA=bank(a,side)>=0,insideB=bank(b,side)>=0;
      if(insideA)result.push(a);
      if(insideA!==insideB){
        let low=0,high=1;
        for(let n=0;n<20;n++){const t=(low+high)/2,p={x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t};if((bank(p,side)>=0)===insideA)low=t;else high=t;}
        const t=(low+high)/2;result.push({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t,u:a.u+(b.u-a.u)*t,v:a.v+(b.v-a.v)*t});
      }
    }
    return result;
  }
  function triangle(a,b,c){
    const polygon=[vertices[a],vertices[b],vertices[c]];
    // A wide ribbon can fold through itself at a tight inside bend. Discard
    // that reversed sliver instead of drawing it over the neighboring lane.
    if((polygon[1].x-polygon[0].x)*(polygon[2].z-polygon[0].z)-(polygon[1].z-polygon[0].z)*(polygon[2].x-polygon[0].x)<=1e-9)return;
    if(polygon.every(p=>Math.abs(p.x)>=RIVER_REACH)||[1,-1].some(side=>polygon.every(p=>bank(p,side)>=0))){indices.push(a,b,c);return;}
    for(const side of [1,-1]){
      const clipped=clip(polygon,side);if(clipped.length<3)continue;
      const ids=clipped.map(add);for(let i=1;i<ids.length-1;i++)indices.push(ids[0],ids[i],ids[i+1]);
    }
  }
  for(let i=0;i<count;i++)for(let j=0;j<across;j++){const a=i*(across+1)+j,b=a+across+1;triangle(a,b,a+1);triangle(a+1,b,b+1);}
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}
export function roadSvgPath(points,closed=false){const curve=createRoadCurve(points,closed);return 'M'+curve.getPoints(Math.max(24,Math.min(240,Math.ceil(curve.getLength()/2)))).map(p=>`${p.x.toFixed(2)},${p.z.toFixed(2)}`).join('L')+(closed?'Z':'');}
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
  const samples=roads.map(r=>r.curve.getSpacedPoints(Math.max(12,Math.ceil(r.curve.getLength()/3)))),entries=[[],[]];
  const edge=(road,t,side)=>{const p=road.curve.getPointAt(t),tangent=road.curve.getTangentAt(t),offset=side*(road.width/2+.25);return {x:p.x-tangent.z*offset,z:p.z+tangent.x*offset};};
  for(const [index,road] of roads.entries()){
    const count=Math.ceil(road.curve.getLength()/2);
    for(let i=0;i<count;i++){
      for(const side of [-1,1]){
        const a=edge(road,i/count,side),b=edge(road,(i+1)/count,side),x=(a.x+b.x)/2,z=(a.z+b.z)/2,dx=b.x-a.x,dz=b.z-a.z,span=Math.hypot(dx,dz),nx=-dz/span,nz=dx/span;
        if(span<.05)continue;
        const footprint=[{x,z},...[-1,1].flatMap(end=>[-1,1].map(side=>({x:x+end*dx/2+side*nx*.36,z:z+end*dz/2+side*nz*.36})))];
        if(footprint.some(p=>isRiver(p.x,p.z,.18)||bridgeAt(p.x,p.z)))continue;
        if(samples[index].slice(1).some((b,k)=>distanceToSegment(x,z,samples[index][k],b)<road.width/2+.05))continue;
        const junction=roads.some((other,j)=>j!==index&&footprint.some(p=>samples[j].slice(1).some((b,k)=>distanceToSegment(p.x,p.z,samples[j][k],b)<other.width/2+.5)));
        if(junction)continue;
        entries[i%2].push({x,z,heading:Math.atan2(dx,dz),length:span-.025});
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
