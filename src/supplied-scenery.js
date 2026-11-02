import { createModelAssetLibrary, fitModelAsset } from './model-assets.js';
import { LANDMARKS, driveHeightAt } from './world-layout.js';
import { WOODLAND_VARIANTS,woodlandTreeAsset } from './tree-variants.js';

export const SUPPLIED_SCENERY_IDS = Object.freeze(['tree', 'woodland', 'pony', 'bird', 'pedestrian', 'staircase', 'city']);
export const SUPPLIED_SHOP_NODE = 'pasted__pPlane94_Laundrymat_0';

/** Supplied scenery shares the world renderer, simulation clock and asset cache. */
export function createSuppliedScenery({ THREE: T, scene, trees = [], treeTargets = [], blastDamage, scenery, islandLife, lowPower = false, reducedMotion = false, onReady = () => {}, onInteractive = () => {}, library, fitAsset = fitModelAsset } = {}) {
  const ownsLibrary = !library;
  library ||= createModelAssetLibrary({maxTextureSize:lowPower?512:1024});
  const root = new T.Group(); root.name = 'Supplied island scenery'; root.userData.physicsIgnore = true; scene.add(root);
  const handles = new Set(), batches = [], treeSlots = [], animated = [], sourceBatches = new Map(), sourceMaterials = [], hiddenMaterials = new Set();
  const zero = new T.Matrix4().makeScale(0, 0, 0), scratch = new T.Matrix4(), position = new T.Vector3();
  const status = { loaded: [], failed: [] };
  let disposed = false;

  function hideOriginalMaterials(object) {
    // Material visibility removes the procedural draw without disabling the
    // original geometry-derived collider, whose activity checks Object3D.visible.
    const copies = new Map();
    object.traverse(part => {
      if (!part.isMesh || !part.material) return;
      const original = part.material;
      const hide = material => {
        if (!copies.has(material)) { const copy = material.clone(); copy.visible = false; copies.set(material, copy); hiddenMaterials.add(copy); }
        return copies.get(material);
      };
      part.material = Array.isArray(original) ? original.map(hide) : hide(original);
      sourceMaterials.push({ object: part, original });
    });
  }
  function rememberSourceParts(target) {
    for (const part of target.parts) {
      if (part.index === undefined || !part.object.isInstancedMesh) continue;
      let batch = sourceBatches.get(part.object);
      if (!batch) { batch = { entries: new Map(), version: -1 }; sourceBatches.set(part.object, batch); }
      if (!batch.entries.has(part.index)) {batch.entries.set(part.index, { target, original: null });batch.version=-1;}
    }
  }
  function hideSourceInstances() {
    for (const [object, batch] of sourceBatches) {
      if (batch.version === object.instanceMatrix.version) continue;
      for (const [index, entry] of batch.entries) {
        object.getMatrixAt(index, scratch);
        // A model can resolve while its old tree is destroyed. Capture the real
        // original only after respawn restores a nonzero instance transform.
        if (!entry.original && scratch.determinant() !== 0) entry.original = scratch.clone();
        object.setMatrixAt(index, zero);
      }
      object.instanceMatrix.needsUpdate = true; batch.version = object.instanceMatrix.version;
    }
  }
  function syncTrees() {
    let changed = false;
    for (const slot of treeSlots) {
      const destroyed = Boolean(blastDamage?.destroyed.has(slot.target.id));
      if (destroyed === slot.destroyed) continue;
      slot.destroyed = destroyed; changed = true;
      for (const entry of slot.instances) entry.object.setMatrixAt(slot.index, destroyed ? zero : entry.matrix);
    }
    if (changed) for (const object of batches) object.instanceMatrix.needsUpdate = true;
    hideSourceInstances();
  }
  function configureVisual(object) {
    object.userData.physicsIgnore = true;
    object.traverse(part => {
      if (part.isLight || part.isCamera) part.visible = false;
      if (part.isMesh) { part.castShadow = !lowPower; part.receiveShadow = true; }
      // These two small animated characters can leave their bind-pose spheres.
      // Avoid a per-frame CPU skinning scan just to refresh their culling bounds.
      if (part.isSkinnedMesh) part.frustumCulled = false;
    });
  }
  function fit(asset, options) {
    const handle = fitAsset(asset, options); handles.add(handle); configureVisual(handle.root); return handle;
  }
  function animateAsset(asset, handle) {
    if (!handle.mixer || !asset.animations?.length || reducedMotion) return;
    handle.mixer.clipAction(asset.animations[0]).play(); animated.push({ handle, elapsed: 0 });
  }
  const treeCandidates = trees.map((tree, index) => ({ tree, target: treeTargets.find(target => target.id === `tree-${index + 1}`) }))
    .filter(entry => entry.target && entry.target.parts.some(part => part.index !== undefined))
    .sort((a,b)=>Number(!!b.tree.landscaped)-Number(!!a.tree.landscaped));
  const selectedTrees=treeCandidates.filter(entry=>entry.tree.round).slice(0,lowPower?3:4),selectedIds=new Set(selectedTrees.map(entry=>entry.target.id));
  const woodlandTrees=treeCandidates.filter(entry=>!selectedIds.has(entry.target.id)).slice(0,lowPower?8:16);
  const cottages = Array.from({ length: lowPower ? 2 : 4 }, (_, index) => scenery?.root?.getObjectByName(`Riverside cottage ${index + 1}`)).filter(Boolean);

  function installTreeVariant(asset,slots,{id='roundleaf',name='Roundleaf',heightScale=3.3}={}) {
    if (!slots.length) return;
    const handle = fit(asset, { height: 1 });
    handle.root.updateWorldMatrix(true, true);
    const primitives = [];
    handle.root.traverse(object => { if (object.isMesh && !object.isSkinnedMesh && object.geometry && object.material) primitives.push(object); });
    if (!primitives.length) { handle.dispose(); handles.delete(handle); throw new Error('Supplied tree has no static mesh'); }
    const transform = new T.Object3D(),variantBatches=[];
    for (const primitive of primitives) {
      const batch = new T.InstancedMesh(primitive.geometry, primitive.material, slots.length);
      batch.name = `Supplied ${name} tree instances`; batch.userData.treeVariant=id;batch.castShadow = !lowPower; batch.receiveShadow = true;
      batch.userData.physicsIgnore = true;
      batch.userData.breakableInstances = new Map(slots.map(({ target }, index) => [index, target.id]));
      for (const [index, { tree }] of slots.entries()) {
        transform.position.set(tree.x, .12 + driveHeightAt(tree.x, tree.z), tree.z); transform.rotation.set(0, tree.rotation || 0, 0); transform.scale.setScalar(tree.scale * heightScale); transform.updateMatrix();
        batch.setMatrixAt(index, scratch.multiplyMatrices(transform.matrix, primitive.matrixWorld));
      }
      // Keep bounds covering every authored position, including trees that are
      // currently destroyed, so respawning never needs another bounds scan.
      batch.computeBoundingSphere(); root.add(batch); batches.push(batch);variantBatches.push(batch);
    }
    for (const [index, { tree, target }] of slots.entries()) {
      const instances = variantBatches.map(object => { object.getMatrixAt(index, scratch); return { object, matrix: scratch.clone() }; });
      treeSlots.push({ tree, target, index, instances, destroyed: null }); rememberSourceParts(target);
    }
    handle.dispose(); handles.delete(handle); syncTrees(); onInteractive(root);
  }
  function installWoodland(asset){
    for(const [index,variant]of WOODLAND_VARIANTS.entries()){
      const slots=woodlandTrees.filter((_,slot)=>slot%WOODLAND_VARIANTS.length===index);
      if(slots.length)installTreeVariant(woodlandTreeAsset({THREE:T,asset,variant}),slots,variant);
    }
  }
  function installPony(asset) {
    // The source includes a wide transparent studio floor, which belongs to its
    // preview rather than the island. Strip it from a hierarchy copy before fit.
    const display = asset.scene.clone(true), remove = [];
    display.traverse(object => { if (object.isMesh && (Array.isArray(object.material) ? object.material : [object.material]).some(material => material?.name === 'Ground_SG')) remove.push(object); });
    remove.forEach(object => object.removeFromParent());
    const handle = fit({ ...asset, scene: display }, { height: 1.8, width: 2.8, depth: 3.2 });
    handle.root.name = 'Supplied Pony model beside the pond'; handle.root.position.set(LANDMARKS.pond.x - 7, .12, LANDMARKS.pond.z + 5); handle.root.rotation.y = -.65; root.add(handle.root);
  }
  function installBird(asset) {
    const handle = fit(asset, { height: .48, width: .8, depth: .8 });
    handle.root.name = 'Supplied orange bird at the pond'; handle.root.position.set(LANDMARKS.pond.x + 2.8, .14, LANDMARKS.pond.z + 1.3); handle.root.rotation.y = .5; root.add(handle.root); animateAsset(asset, handle);
  }
  function installPedestrian(asset) {
    const vendor = islandLife?.vendors?.[0]; if (!vendor) return;
    const handle = fit(asset, { height: 1.9, width: .85, depth: .8 });
    handle.root.name = 'Supplied market pedestrian'; handle.root.position.set(.95,.08,.15);
    hideOriginalMaterials(vendor); vendor.add(handle.root); animateAsset(asset, handle);
  }
  function installCottages(asset, start, end, selector) {
    for (let index = start; index < Math.min(end, cottages.length); index++) {
      const home = cottages[index];
      const handle = fit(asset, { height: 3.45, width: 2.65, depth: 2.45, selector });
      handle.root.name = `Supplied ${selector ? 'laundry shop' : 'staircase cottage'} ${index + 1}`; handle.root.position.y = .12;
      hideOriginalMaterials(home); home.add(handle.root);
    }
  }
  const installers = [['tree', asset=>installTreeVariant(asset,selectedTrees)], ['woodland',installWoodland], ['pony', installPony], ['bird', installBird], ['pedestrian', installPedestrian],
    ['staircase', asset => installCottages(asset, 0, 2)], ['city', asset => installCottages(asset, 2, 4, SUPPLIED_SHOP_NODE)]];
  const ready = (async () => {
    // Sequential, background requests bound decoding and upload pressure. A
    // failed optional asset leaves its procedural counterpart intact.
    for (const [id, install] of installers) {
      if (disposed) break;
      if (id === 'tree' && !selectedTrees.length || id === 'pedestrian' && !islandLife?.vendors?.length) continue;
      if(id==='woodland'&&!woodlandTrees.length)continue;
      if (id === 'staircase' && !cottages.length || id === 'city' && cottages.length < 3) continue;
      try {
        const asset = await library.load(id);
        if (disposed) break;
        install(asset); status.loaded.push(id); onReady(id);
      } catch (error) { if (!disposed) status.failed.push({ id, message: error.message }); }
    }
    return status;
  })();
  return {
    root, ready,
    update(dt, { paused = false, focus = { x: 0, z: 0 } } = {}) {
      if (disposed) return;
      syncTrees();
      if (paused || reducedMotion) return;
      const elapsed = Math.max(0, Math.min(.1, Number(dt) || 0));
      for (const entry of animated) {
        entry.handle.root.getWorldPosition(position);
        if ((position.x - focus.x) ** 2 + (position.z - focus.z) ** 2 > 65 ** 2) { entry.elapsed = 0; continue; }
        entry.elapsed += elapsed;
        if (entry.elapsed + 1e-8 >= 1 / 30) { entry.handle.mixer.update(entry.elapsed); entry.elapsed = 0; }
      }
    },
    dispose() {
      if (disposed) return; disposed = true;
      root.removeFromParent(); handles.forEach(handle => handle.dispose()); handles.clear();
      for (const object of batches) object.dispose();
      for (const [object, batch] of sourceBatches) {
        for (const [index, entry] of batch.entries) if (entry.original && !blastDamage?.destroyed.has(entry.target.id)) object.setMatrixAt(index, entry.original);
        object.instanceMatrix.needsUpdate = true;
      }
      sourceMaterials.forEach(({ object, original }) => { object.material = original; }); hiddenMaterials.forEach(material => material.dispose());
      if (ownsLibrary) library.dispose(); animated.length = 0; treeSlots.length = 0; sourceBatches.clear();
    }
  };
}
