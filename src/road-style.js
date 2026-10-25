import { isRiver,bridgeAt,riverCenter,RIVER_HALF_WIDTH,RIVER_REACH } from './world-layout.js';
import { CatmullRomCurve3,LineCurve3,Vector3 } from './vendor/three.module.js';

export const ROAD_COLOR='#ebe7d3';
export const ROAD_SHOULDER_COLOR='#d4d2b6';
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
