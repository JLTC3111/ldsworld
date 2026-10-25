import { ISLAND_BOUNDS } from './world-layout.js';

export const BOUNDARY_INSET=1.2;
export const boundaryPoint=angle=>({x:Math.cos(angle)*(ISLAND_BOUNDS.x-BOUNDARY_INSET),z:Math.sin(angle)*(ISLAND_BOUNDS.z-BOUNDARY_INSET)});

// Short instanced sections keep the physical edge precise even at diagonal
// stretches. The existing shoreline limit remains the airborne backstop.
export function createIslandBoundary({THREE:T,scene,coarse=false}){
  const root=new T.Group();root.name='Visible island driving boundary';scene.add(root);
  const geometry=new T.BoxGeometry(1,1,1),count=512,posts=128,dummy=new T.Object3D();
  const dark=new T.MeshStandardMaterial({color:'#283b42',roughness:.72,metalness:.18});
  const railMaterial=new T.MeshStandardMaterial({color:'#d8ddd1',roughness:.4,metalness:.45,emissive:'#d8ddd1',emissiveIntensity:.01});
  const reflectorMaterial=new T.MeshBasicMaterial({color:'#fff0c2',toneMapped:false});
  const curbMaterial=new T.MeshStandardMaterial({color:'#ffffff',roughness:.9});
  const curb=new T.InstancedMesh(geometry,curbMaterial,count);curb.name='Striped perimeter curb';
  const rail=new T.InstancedMesh(geometry,railMaterial,count);rail.name='Continuous perimeter guardrail';
  const uprights=new T.InstancedMesh(geometry,dark,posts);uprights.name='Boundary posts';
  const reflectors=new T.InstancedMesh(geometry,reflectorMaterial,posts);reflectors.name='Boundary reflectors';reflectors.userData.physicsIgnore=true;
  root.add(curb,rail,uprights,reflectors);const pale=new T.Color('#eed49a'),ink=new T.Color('#283b42');
  for(let i=0;i<count;i++){
    const a=boundaryPoint(i/count*Math.PI*2),b=boundaryPoint((i+1)/count*Math.PI*2),dx=b.x-a.x,dz=b.z-a.z,length=Math.hypot(dx,dz),angle=Math.atan2(dx,dz);
    dummy.position.set((a.x+b.x)/2,.17,(a.z+b.z)/2);dummy.rotation.set(0,angle,0);dummy.scale.set(.65,.34,length+.035);dummy.updateMatrix();curb.setMatrixAt(i,dummy.matrix);curb.setColorAt(i,i%8<4?pale:ink);
    dummy.position.y=.72;dummy.scale.set(.14,.24,length+.035);dummy.updateMatrix();rail.setMatrixAt(i,dummy.matrix);
  }
  for(let i=0;i<posts;i++){
    const angle=i/posts*Math.PI*2,p=boundaryPoint(angle);dummy.position.set(p.x,.48,p.z);dummy.rotation.set(0,-angle,0);dummy.scale.set(.15,.96,.15);dummy.updateMatrix();uprights.setMatrixAt(i,dummy.matrix);
    dummy.position.y=.91;dummy.scale.set(.26,.12,.26);dummy.updateMatrix();reflectors.setMatrixAt(i,dummy.matrix);
  }
  curb.receiveShadow=rail.receiveShadow=true;uprights.castShadow=!coarse;let disposed=false;
  return {root,curb,rail,reflectors,update({night=0}={}){railMaterial.emissiveIntensity=.01+Math.max(0,Math.min(1,night))*.2;},dispose(){if(disposed)return;disposed=true;root.removeFromParent();geometry.dispose();[dark,railMaterial,reflectorMaterial,curbMaterial].forEach(m=>m.dispose());}};
}
