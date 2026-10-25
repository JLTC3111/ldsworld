import { driveHeightAt } from './world-layout.js';
import { breakProfile,isProtectedObject,isProtectedKind } from './breakables.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export const BLAST_BURN_SECONDS=7;

export function treeBlastTargets({THREE:T,trees,objects}){
  const targets=trees.map((tree,index)=>({id:`tree-${index+1}`,kind:'tree',x:tree.x,z:tree.z,parts:[]}));
  const matrix=new T.Matrix4(),position=new T.Vector3();
  for(const object of objects){
    if(!object.isInstancedMesh)continue;object.updateWorldMatrix(true,false);
    for(let index=0;index<object.count;index++){
      object.getMatrixAt(index,matrix);matrix.premultiply(object.matrixWorld);position.setFromMatrixPosition(matrix);
      let nearest=null,distance=Infinity;
      for(const target of targets){const d=Math.hypot(target.x-position.x,target.z-position.z);if(d<distance){distance=d;nearest=target;}}
      if(nearest&&distance<4)nearest.parts.push({object,index});
    }
  }
  return targets;
}

// Registered scenery and loose physics props break and return on individual
// timers. Buildings and the terrain remain outside the destruction registry.
export function createBlastDamage({THREE:T,scene,physics,targets=[],coarse=false,reducedMotion=false,onRespawn,onBreak}){
  const root=new T.Group();root.name='Blast debris and residual fires';root.userData.physicsIgnore=true;scene.add(root);
  const count=coarse?12:24,sites=Array.from({length:count},()=>({age:100,used:false}));
  const destroyed=new Set(),snapshots=new Map(),respawns=new Map(),targetById=new Map(targets.map(t=>[t.id,t])),geometries=new Set(),materials=new Set();let disposed=false,clock=0;
  const initialById=new Map(physics.initial.map(body=>[body.id,body]));
  const geometry=g=>{geometries.add(g);return g;},material=m=>{materials.add(m);return m;};
  const flameGeometry=geometry(new T.ConeGeometry(1,1,7)),smokeGeometry=geometry(new T.IcosahedronGeometry(1,1)),chunkGeometry=geometry(new T.BoxGeometry(1,1,1));
  const instanced=(g,m,n,name)=>{const object=new T.InstancedMesh(g,m,n);object.name=name;object.frustumCulled=false;root.add(object);return object;};
  const outer=instanced(flameGeometry,material(new T.MeshBasicMaterial({color:'#fb6d20',transparent:true,opacity:.82,depthWrite:false,toneMapped:false})),count*3,'Residual orange flames');
  const inner=instanced(flameGeometry,material(new T.MeshBasicMaterial({color:'#ffe19a',transparent:true,opacity:.95,depthWrite:false,toneMapped:false})),count*3,'Residual yellow flame cores');
  const smoke=instanced(smokeGeometry,material(new T.MeshBasicMaterial({color:'#69645d',transparent:true,opacity:.17,depthWrite:false})),count*3,'Lingering fire smoke');
  const embers=instanced(chunkGeometry,material(new T.MeshBasicMaterial({color:'#ffb25a',transparent:true,opacity:.9,depthWrite:false,toneMapped:false})),count*4,'Residual fire embers');
  const debris=instanced(chunkGeometry,material(new T.MeshStandardMaterial({color:'#ffffff',roughness:1})),count*8,'Charred blast fragments');debris.castShadow=debris.receiveShadow=true;
  const light=new T.PointLight('#ff9e42',0,18,2);root.add(light);
  const dummy=new T.Object3D(),matrix=new T.Matrix4(),zero=new T.Matrix4().makeScale(0,0,0),color=new T.Color();
  for(const object of [outer,inner,smoke,embers,debris]){for(let i=0;i<object.count;i++)object.setMatrixAt(i,zero);object.instanceMatrix.needsUpdate=true;}

  function hidePart(part){
    if(part.index!==undefined){
      let owned=snapshots.get(part.object);if(!owned){owned=new Map();snapshots.set(part.object,owned);}
      if(!owned.has(part.index)){part.object.getMatrixAt(part.index,matrix);owned.set(part.index,matrix.clone());}
      (part.object.userData.destroyedInstances??=new Set()).add(part.index);
      part.object.setMatrixAt(part.index,zero);part.object.instanceMatrix.needsUpdate=true;
    }else{
      if(!snapshots.has(part.object))snapshots.set(part.object,part.object.visible);
      part.object.visible=false;
    }
  }
  function ignite({x,z,scale=1,burn=true,kind='wood',ownerId=null}){
    const site=sites.find(s=>!s.used)||sites.reduce((a,b)=>a.age>b.age?a:b);
    Object.assign(site,{x,z,y:Math.max(.12,driveHeightAt(x,z)),scale:clamp(scale,.5,2.2),age:0,used:true,burn,kind,ownerId});
    return site;
  }
  function destroyBody(body,{burn=false,force=false}={}){
    if(!body||destroyed.has(body.id)||(isProtectedKind(body.kind)||body.kind==='bowling-pin')||body.blastProtected||isProtectedObject(body.object)||!force&&(body.destroyed||body.active&&!body.active()))return false;
    body.destroyed=true;destroyed.add(body.id);if(body.object)body.object.visible=false;
    respawns.set(body.id,{id:body.id,kind:body.kind,body:true,at:clock+breakProfile(body.kind).respawn});
    ignite({x:body.x,z:body.z,scale:clamp(body.radius,.5,1.6),burn:burn&&!['rock','stone','snowman'].includes(body.kind),kind:body.kind,ownerId:body.id});
    onBreak?.({id:body.id,kind:body.kind,x:body.x,z:body.z});return true;
  }
  function destroyTarget(target,{burn=false}={}){
    if(!target||target.protected||(isProtectedKind(target.kind)||target.kind==='bowling-pin')||target.parts.some(part=>isProtectedObject(part.object))||destroyed.has(target.id))return false;
    destroyed.add(target.id);target.parts.forEach(hidePart);
    respawns.set(target.id,{id:target.id,kind:target.kind,body:false,at:clock+breakProfile(target.kind).respawn});
    ignite({x:target.x,z:target.z,scale:target.kind==='tree'?1.5:1.15,burn:burn&&!['rock','stone','portal','sculpture'].includes(target.kind),kind:target.kind,ownerId:target.id});
    onBreak?.({id:target.id,kind:target.kind,x:target.x,z:target.z});return true;
  }
  function impact(colliderOrId,strength){
    if(disposed)return false;const id=typeof colliderOrId==='string'?colliderOrId:colliderOrId?.breakableId,target=targetById.get(id);
    return strength>=breakProfile(target?.kind).speed&&destroyTarget(target);
  }
  function processImpacts(){
    for(const body of physics.bodies){
      if(body.destroyed||body.active&&!body.active()||isProtectedKind(body.kind)||isProtectedObject(body.object))continue;
      const initial=initialById.get(body.id),displaced=initial&&Math.hypot(body.x-initial.x,body.z-initial.z)>Math.max(.75,initial.radius);
      if(body.kind!=='tnt'&&(body.impactSpeed||0)>=breakProfile(body.kind).speed)destroyBody(body);
      else if((displaced||body.kind==='bowling-pin'&&(body.tipAngle||0)>1.25)&&!respawns.has(body.id))respawns.set(body.id,{id:body.id,kind:body.kind,body:true,at:clock+breakProfile(body.kind).respawn});
    }
  }
  function blast({x,y=.7,z,radius=11,sourceId}){
    if(disposed)return 0;let hits=0;
    if(sourceId)destroyBody(physics.bodies.find(b=>b.id===sourceId),{burn:true,force:true});else ignite({x,z,scale:1.25});
    for(const body of physics.bodies){
      if(body.kind==='tnt')continue;
      if(Math.hypot(body.x-x,body.z-z,Math.max(0,body.y-y-body.height/2))>radius)continue;
      if(destroyBody(body,{burn:true}))hits++;
    }
    for(const target of targets){
      if(Math.hypot(target.x-x,target.z-z)>radius)continue;
      if(destroyTarget(target,{burn:true}))hits++;
    }
    return hits;
  }
  function clearSite(index){for(const [object,per] of [[outer,3],[inner,3],[smoke,3],[embers,4],[debris,8]]){for(let j=0;j<per;j++)object.setMatrixAt(index*per+j,zero);object.instanceMatrix.needsUpdate=true;}}
  function restorePart(part){
    const saved=snapshots.get(part.object);
    if(part.index!==undefined){const original=saved?.get(part.index);if(original){part.object.setMatrixAt(part.index,original);part.object.instanceMatrix.needsUpdate=true;saved.delete(part.index);part.object.userData.destroyedInstances?.delete(part.index);if(!saved.size)snapshots.delete(part.object);}}
    else if(saved!==undefined){part.object.visible=saved;snapshots.delete(part.object);}
  }
  function restore(id){
    const record=respawns.get(id);if(!record)return false;
    if(record.body){const body=physics.restoreBody(id);onRespawn?.(id,body);if(body?.object)body.object.visible=!body.active||body.active();}
    else targetById.get(id)?.parts.forEach(restorePart);
    destroyed.delete(id);respawns.delete(id);sites.forEach((s,i)=>{if(s.ownerId===id){s.used=false;clearSite(i);}});return true;
  }
  function respawnReady(record,focus,returning=new Set()){
    const body=record.body?initialById.get(record.id):null,target=body||targetById.get(record.id);if(!target)return true;
    const radius=body?.radius||Math.min(9,target.radius||1.5);
    const carRadius=Math.max(focus.profile?.halfWidth||1,focus.profile?.halfLength||1.6)+.45;
    if((focus.hop||0)<4){
      const dx=record.body||!target.width?Math.abs(target.x-focus.x):Math.max(0,Math.abs(target.x-focus.x)-target.width/2),dz=record.body||!target.depth?Math.abs(target.z-focus.z):Math.max(0,Math.abs(target.z-focus.z)-target.depth/2);
      if(Math.hypot(dx,dz)<carRadius+(record.body||!target.width?radius:0))return false;
    }
    return !physics.bodies.some(b=>{
      if(b.id===record.id||b.destroyed||returning.has(b.id)||b.active&&!b.active())return false;
      if(record.body){
        if(b.y-b.height/2>=body.y+body.height/2||b.y+b.height/2<=body.y-body.height/2)return false;
        return Math.hypot(b.x-target.x,b.z-target.z)<radius+(b.radius||.3)*.75;
      }
      return (target.contacts||[]).some(c=>{
        if((c.maxY??Infinity)<=b.y-b.height/2||(c.minY??-Infinity)>=b.y+b.height/2)return false;
        const dx=Math.max(0,Math.abs(b.x-c.x)-(c.width||c.radius*2||.1)/2),dz=Math.max(0,Math.abs(b.z-c.z)-(c.depth||c.radius*2||.1)/2);return Math.hypot(dx,dz)<b.radius+.05;
      });
    });
  }
  const put=(object,index,x,y,z,sx,sy,sz,rx=0,ry=0,rz=0)=>{dummy.position.set(x,y,z);dummy.rotation.set(rx,ry,rz);dummy.scale.set(sx,sy,sz);dummy.updateMatrix();object.setMatrixAt(index,dummy.matrix);};
  function update(dt,{paused=false,focus={x:0,z:0}}={}){
    if(disposed||paused)return;dt=clamp(Number(dt)||0,0,.1);clock+=dt;let nearest=Infinity;light.intensity=0;
    // Fallen or displaced props can occupy each other's starting spots. Resolve
    // a ready group together, so those objects cannot permanently block each
    // other's return. Anything blocked by the car stays out of the group.
    const ready=new Set([...respawns.values()].filter(record=>record.at<=clock).map(record=>record.id));
    let changed=true;while(changed){changed=false;for(const id of ready)if(!respawnReady(respawns.get(id),focus,ready)){ready.delete(id);changed=true;}}
    for(const id of ready)restore(id);
    sites.forEach((site,index)=>{
      if(!site.used)return;site.age+=dt;
      const fade=clamp(((site.burn?BLAST_BURN_SECONDS:1.2)-site.age)/1.2,0,1),fire=site.burn?fade:0,base=site.y,age=site.age,s=site.scale;
      for(let j=0;j<3;j++){
        const a=j*2.39996+index,h=(.8+Math.sin(clock*9+index+j)*.22)*s*fire,x=site.x+Math.sin(a)*s*.38,z=site.z+Math.cos(a)*s*.38;
        put(outer,index*3+j,x,base+h*.52,z,.4*s*fire,h,.4*s*fire,Math.sin(clock*6+j)*.12,0,Math.cos(clock*7+j)*.12);
        put(inner,index*3+j,x,base+h*.3,z,.21*s*fire,h*.65,.21*s*fire);
        const rise=(clock*.45+j*.83)%2.5,smokeScale=fade*(.3+rise*.48)*s;
        put(smoke,index*3+j,site.x+Math.sin(index+rise)*rise*.22,base+.9+rise*1.8,site.z+Math.cos(index+rise)*rise*.16,smokeScale,smokeScale*.85,smokeScale);
      }
      for(let j=0;j<4;j++){
        const rise=(clock*(1+j*.04)+j*.9)%2.5;
        put(embers,index*4+j,site.x+Math.sin(index+j*3+rise)*rise*.3,base+.35+rise*1.5,site.z+Math.cos(index+j*3)*rise*.3,.035*fire,.07*fire,.035*fire,0,j,0);
      }
      for(let j=0;j<8;j++){
        const a=j*2.39996+index,t=reducedMotion?Math.min(age,.25):Math.min(age,1.1),flight=Math.max(0,(2+j%3)*t-4.5*t*t),r=(.5+j%3)*s*t;
        put(debris,index*8+j,site.x+Math.sin(a)*r,base+.08+flight,site.z+Math.cos(a)*r,(.18+j%2*.13)*s,(site.kind==='tree'?.22:.12)*s,(site.kind==='tree'?.8:.28)*s,t*3+j,j*.7,t*2);
        color.set(['rock','stone','sculpture','portal'].includes(site.kind)?'#686962':site.burn?j%3?'#302a23':'#5b3f29':j%3?'#9a704b':'#bc9365');debris.setColorAt(index*8+j,color);
      }
      const distance=Math.hypot(site.x-focus.x,site.z-focus.z);
      if(fire&&distance<nearest){nearest=distance;light.position.set(site.x,base+1,site.z);light.intensity=(reducedMotion?7:8+Math.sin(clock*11)*1.5)*fire;}
    });
    for(const object of [outer,inner,smoke,embers,debris])object.instanceMatrix.needsUpdate=true;
    if(debris.instanceColor)debris.instanceColor.needsUpdate=true;
    light.intensity=nearest<35?light.intensity:0;
  }
  function reset(){
    destroyed.clear();respawns.clear();clock=0;
    for(const [object,state] of snapshots){
      if(state instanceof Map){for(const [index,value] of state)object.setMatrixAt(index,value);object.instanceMatrix.needsUpdate=true;object.userData.destroyedInstances?.clear();}
      else object.visible=state;
    }
    snapshots.clear();for(const body of physics.bodies){if(body.destroyed){body.destroyed=false;if(body.object)body.object.visible=!body.active||body.active();}}
    sites.forEach(s=>{s.used=false;s.age=100;});
    for(const object of [outer,inner,smoke,embers,debris]){for(let i=0;i<object.count;i++)object.setMatrixAt(i,zero);object.instanceMatrix.needsUpdate=true;}
    light.intensity=0;
  }
  return {root,destroyed,sites,respawns,blast,impact,processImpacts,restore,update,reset,dispose(){if(disposed)return;reset();disposed=true;root.removeFromParent();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());}};
}
