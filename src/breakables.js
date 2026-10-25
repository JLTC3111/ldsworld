export const BREAK_PROFILES={
  'bowling-pin':{speed:7,respawn:18},tnt:{speed:3.2,respawn:25},crate:{speed:5,respawn:20},cone:{speed:4,respawn:12},
  snowman:{speed:5,respawn:35},planter:{speed:6,respawn:30},barrel:{speed:8,respawn:35},'trash-can':{speed:9,respawn:40},
  bench:{speed:8,respawn:50},cart:{speed:7,respawn:45},fence:{speed:5,respawn:35},sign:{speed:6,respawn:35},
  tree:{speed:11,respawn:100},rock:{speed:13,respawn:90},stone:{speed:12,respawn:75},sculpture:{speed:16,respawn:90},
  portal:{speed:18,respawn:60},scenery:{speed:7,respawn:45}
};
export const isProtectedKind=kind=>['building','bridge','stall'].includes(kind);
const protectedProfile=Object.freeze({speed:Infinity,respawn:Infinity});
export const breakProfile=kind=>isProtectedKind(kind)?protectedProfile:BREAK_PROFILES[kind]||BREAK_PROFILES.scenery;
export function isProtectedObject(object){for(let p=object;p;p=p.parent)if(p.userData.projectId||p.userData.building||p.userData.blastProtected||isProtectedKind(p.userData.breakableKind))return true;return false;}

// Keep authored objects whole. Every physical contact either belongs to a
// protected structure or a restorable object/instance; decorative parts follow it.
export function collectBreakableTargets({THREE:T,colliders,existing=[]}){
  const allowed=existing.filter(t=>!t.protected&&!isProtectedKind(t.kind)&&!t.parts.some(p=>isProtectedObject(p.object)));
  const targets=new Map(allowed.map(t=>[t.id,t])),parts=new WeakMap();
  for(const target of allowed)for(const part of target.parts){
    if(part.index!==undefined){let ids=parts.get(part.object);if(!ids){ids=new Map();parts.set(part.object,ids);}ids.set(part.index,target.id);}
    else part.object.userData.breakableId=target.id;
  }
  for(const collider of colliders){
    const object=collider.object;if(!object||isProtectedObject(object))continue;
    let owner=null;for(let p=object;p;p=p.parent)if(p.userData.breakableId){owner=p;break;}
    const known=parts.get(object)?.get(collider.instance);
    const id=known||owner?.userData.breakableId||`scenery-${object.uuid}-${collider.instance??'whole'}`;
    if(!targets.has(id)){
      const bounds=owner?new T.Box3().setFromObject(owner):null,centre=bounds?.getCenter(new T.Vector3());
      const kind=owner?.userData.breakableKind||(object.name.includes('guardrail')||object.name.includes('Boundary')?'fence':'scenery');
      targets.set(id,{id,kind,x:centre?.x??collider.x,z:centre?.z??collider.z,width:bounds?bounds.max.x-bounds.min.x:collider.width,depth:bounds?bounds.max.z-bounds.min.z:collider.depth,radius:bounds?Math.max(.5,Math.hypot(bounds.max.x-bounds.min.x,bounds.max.z-bounds.min.z)/2):Math.max(.3,collider.radius||Math.hypot(collider.width,collider.depth)/2),parts:[owner?{object:owner}:{object,index:collider.instance}]});
    }
    collider.breakableId=id;
    (targets.get(id).contacts??=[]).push(collider);
  }
  for(const target of targets.values())for(const part of target.parts){
    if(part.index!==undefined)(part.object.userData.breakableInstances??=new Map()).set(part.index,target.id);
    else part.object.userData.breakableId=target.id;
  }
  return [...targets.values()];
}
