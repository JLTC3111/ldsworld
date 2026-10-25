import { roadNodes,outerRoadLoop,connectorPaths,planRoute } from './driving.js';

export const TOWN_CENTER=Object.freeze({x:0,z:13});
export const townPathLength=path=>path.reduce((total,p,i)=>i?total+Math.hypot(p[0]-path[i-1][0],p[1]-path[i-1][1]):0,0);
export const townRouteCost=key=>townPathLength(planRoute(roadNodes[key],'r8'));
export const outerTownDirections=Object.freeze(outerRoadLoop.map((_,i)=>townRouteCost(`o${(i+1)%12}`)<townRouteCost(`o${i}`)?1:-1));

export function createWayfinding({THREE:T,scene,language='en'}){
  const root=new T.Group();root.name='Road arrows to town';scene.add(root);const geometries=new Set(),materials=new Set(),textures=[];
  const ownGeo=g=>{geometries.add(g);return g;},ownMat=m=>{materials.add(m);return m;};
  const dark=ownMat(new T.MeshStandardMaterial({color:'#243a40',roughness:.85})),ivory=ownMat(new T.MeshStandardMaterial({color:'#fff0b9',roughness:.72,emissive:'#fff0b9',emissiveIntensity:.035}));
  const shape=new T.Shape();shape.moveTo(-.23,1.05);shape.lineTo(.23,1.05);shape.lineTo(.23,-.02);shape.lineTo(.8,-.02);shape.lineTo(0,-1.2);shape.lineTo(-.8,-.02);shape.lineTo(-.23,-.02);shape.closePath();
  const arrowGeometry=ownGeo(new T.ShapeGeometry(shape));arrowGeometry.rotateX(-Math.PI/2);
  const arrows=[],boards=[];
  function arrow(point,tangent,kind){
    const group=new T.Group();group.name='Town direction arrow';group.position.set(point.x,.127,point.z);group.rotation.y=Math.atan2(tangent.x,tangent.z);group.userData.townArrow={x:point.x,z:point.z,heading:group.rotation.y,kind};root.add(group);
    const outline=new T.Mesh(arrowGeometry,dark);outline.scale.setScalar(1.2);group.add(outline);
    const paint=new T.Mesh(arrowGeometry,ivory);paint.position.y=.008;group.add(paint);group.userData.physicsIgnore=true;arrows.push(group);
  }
  const loop=new T.CatmullRomCurve3(outerRoadLoop.map(([x,z])=>new T.Vector3(x,0,z)),true,'catmullrom',.25);
  for(let i=0;i<12;i++){const t=(i+.45)/12;arrow(loop.getPoint(t),loop.getTangent(t).multiplyScalar(outerTownDirections[i]),'outer-road');}
  const unitCube=ownGeo(new T.BoxGeometry(1,1,1)),boardGeometry=ownGeo(new T.PlaneGeometry(3,.7));
  const box=(w,h,d,material,parent,x,y,z)=>{const o=new T.Mesh(unitCube,material);o.scale.set(w,h,d);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;parent.add(o);return o;};
  for(const [index,path] of connectorPaths.entries()){
    const curve=new T.CatmullRomCurve3(path.map(key=>new T.Vector3(roadNodes[key][0],0,roadNodes[key][1])),false,'catmullrom',.25),length=curve.getLength();
    const count=Math.max(2,Math.floor(length/14));
    for(let i=0;i<count;i++){const t=(i+.6)/count;arrow(curve.getPointAt(t),curve.getTangentAt(t).negate(),'town-connector');}
    const position=curve.getPointAt(.7),tangent=curve.getTangentAt(.7),right=new T.Vector3(tangent.z,0,-tangent.x);
    const sign=new T.Group();sign.name='Town wayfinding sign';sign.position.copy(position).addScaledVector(right,5.5);sign.rotation.y=Math.atan2(tangent.x,tangent.z);root.add(sign);
    box(3.24,.92,.12,dark,sign,0,2,0);for(const x of [-.95,.95])box(.09,1.65,.09,dark,sign,x,.95,0);
    const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;textures.push(texture);
    const material=ownMat(new T.MeshBasicMaterial({map:texture,toneMapped:false}));
    for(const side of [-1,1]){const face=new T.Mesh(boardGeometry,material);face.position.set(0,2,side*.065);face.rotation.y=side<0?Math.PI:0;sign.add(face);}
    boards.push({canvas,texture,sign,index});
  }
  function setLanguage(value){language=value==='vi'?'vi':'en';for(const {canvas,texture} of boards){const ctx=canvas.getContext('2d');ctx.fillStyle='#243a40';ctx.fillRect(0,0,512,128);ctx.fillStyle='#fff0b9';ctx.font='700 54px Arial, sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(language==='vi'?'THỊ TRẤN ↑':'TOWN ↑',256,64,480);texture.needsUpdate=true;}}
  setLanguage(language);let disposed=false;
  return {root,arrows,boards,setLanguage,update({night=0}={}){ivory.emissiveIntensity=.035+Math.max(0,Math.min(1,night))*.34;},dispose(){if(disposed)return;disposed=true;root.removeFromParent();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());}};
}
