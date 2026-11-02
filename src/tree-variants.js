// Descriptive names for the supplied artwork, without renaming the originals.
export const WOODLAND_VARIANTS=Object.freeze([
  {id:'wildwood',name:'Wildwood',parts:['Object_2668','Object_2669'],heightScale:3.6},
  {id:'meadow',name:'Meadow',parts:['Object_0','Object_2671'],heightScale:3.1}
]);

export function woodlandTreeAsset({THREE:T,asset,variant}){
  const tree=new T.Group();tree.name=`${variant.name} tree`;
  // The source pack has thousands of grass/ground instances. Extract only one
  // trunk and crown from their base geometries, then orient the Z-up artwork.
  tree.rotation.x=Math.PI/2;
  for(const name of variant.parts){
    const source=asset.scene.getObjectByName(name);
    if(!source?.isMesh)throw new Error(`Missing ${variant.name} tree part: ${name}`);
    const part=new T.Mesh(source.geometry,source.material);part.name=`${variant.name} ${source.material.name==='Bark'?'trunk':'canopy'}`;tree.add(part);
  }
  return {scene:tree,animations:[]};
}
