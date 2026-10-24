export function createTreeDetails({THREE:T,scene,trees,coarse=false}) {
  const root=new T.Group();root.name='Layered woodland foliage';scene.add(root);
  const broad=trees.filter(t=>t.round),count=coarse?56:96;
  const leafGeometry=new T.IcosahedronGeometry(.22,0),branchGeometry=new T.CylinderGeometry(.035,.075,1,5);
  const material=new T.MeshStandardMaterial({color:'#ffffff',roughness:1,flatShading:true});
  const frostMaterial=new T.MeshStandardMaterial({color:'#edf4ec',roughness:1,transparent:true,opacity:0,depthWrite:false});
  const leaves=new T.InstancedMesh(leafGeometry,material,broad.length*count);leaves.name='Individual canopy leaf clusters';leaves.castShadow=true;leaves.receiveShadow=true;
  const frost=new T.InstancedMesh(leafGeometry,frostMaterial,broad.length*Math.ceil(count/3));frost.name='Frosted canopy tips';frost.visible=false;
  const branches=new T.InstancedMesh(branchGeometry,new T.MeshStandardMaterial({color:'#8d7659',roughness:1}),broad.length*5);branches.name='Forked tree branches';branches.castShadow=true;root.add(leaves,frost,branches);
  let seed=1907,index=0,tip=0,branchIndex=0;const random=()=>{seed=seed*16807%2147483647;return(seed-1)/2147483646;};
  const dummy=new T.Object3D(),col=new T.Color(),palette=['#9aa777','#bd9f71','#b4b77f','#c28d70','#93ab84','#b0bc8a'];
  broad.forEach((tree,i)=>{
    for(let j=0;j<count;j++){const theta=random()*Math.PI*2,h=random()*2-1,r=Math.sqrt(1-h*h),s=tree.scale;
      dummy.position.set(tree.x+Math.cos(theta)*r*s,2.15*s+h*1.15*s,tree.z+Math.sin(theta)*r*.93*s);dummy.rotation.set(random()*3,random()*6,random()*3);dummy.scale.set(s*(.8+random()*.7),s*(.45+random()*.4),s*(1+random()*.6));dummy.updateMatrix();leaves.setMatrixAt(index,dummy.matrix);col.set(palette[i%palette.length]).multiplyScalar(.88+random()*.22);leaves.setColorAt(index++,col);
      if(j%3===0){frost.setMatrixAt(tip++,dummy.matrix);}
    }
    for(let j=0;j<5;j++){const a=j/5*Math.PI*2;const start=new T.Vector3(tree.x,tree.scale*1.05,tree.z),end=new T.Vector3(tree.x+Math.cos(a)*.72*tree.scale,tree.scale*(2.1+j*.11),tree.z+Math.sin(a)*.72*tree.scale);dummy.position.copy(start).add(end).multiplyScalar(.5);dummy.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),end.clone().sub(start).normalize());dummy.scale.set(tree.scale,start.distanceTo(end),tree.scale);dummy.updateMatrix();branches.setMatrixAt(branchIndex++,dummy.matrix);}
  });
  const pines=trees.filter(t=>!t.round),perPine=coarse?12:24;
  const needleGeometry=new T.ConeGeometry(.19,.48,4),needleMaterial=new T.MeshStandardMaterial({color:'#78976d',roughness:1,flatShading:true});
  const needles=new T.InstancedMesh(needleGeometry,needleMaterial,pines.length*perPine);needles.name='Layered pine needle sprays';needles.castShadow=true;needles.receiveShadow=true;root.add(needles);
  let needleIndex=0;
  pines.forEach((tree,i)=>{for(let j=0;j<perPine;j++){const tier=j%3,a=j/perPine*Math.PI*6+i,r=tree.scale*(.8-tier*.15);dummy.position.set(tree.x+Math.sin(a)*r,(1.4+tier*.69)*tree.scale,tree.z+Math.cos(a)*r);dummy.rotation.set(Math.cos(a)*.45,a,Math.sin(a)*.45);dummy.scale.setScalar(tree.scale*(.8+random()*.5));dummy.updateMatrix();needles.setMatrixAt(needleIndex,dummy.matrix);col.set(['#6b8762','#90a57b','#7c986f'][j%3]);needles.setColorAt(needleIndex++,col);}});
  let disposed=false;return {root,updateSnow(amount){frost.visible=amount>.01;frostMaterial.opacity=Math.min(.78,Math.max(0,amount));},dispose(){if(disposed)return;disposed=true;root.removeFromParent();leafGeometry.dispose();branchGeometry.dispose();material.dispose();frostMaterial.dispose();branches.material.dispose();needleGeometry.dispose();needleMaterial.dispose();}};
}
