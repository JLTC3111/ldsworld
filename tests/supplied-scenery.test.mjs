import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../src/vendor/three.module.js';
import { createSuppliedScenery, SUPPLIED_SCENERY_IDS, SUPPLIED_SHOP_NODE } from '../src/supplied-scenery.js';
import { createModelAssetLibrary, fitModelAsset, MODEL_ASSETS } from '../src/model-assets.js';
import { drivingSurfaceAt } from '../src/driving.js';
import { collectWorldColliders } from '../src/world-physics.js';
import { createNodeModelLoader } from './helpers/model-node-loader.mjs';

function fixture({ lowPower = false, reducedMotion = false, failed = '', count = 32, load, cottages = false } = {}) {
  const scene = new THREE.Scene(), material = new THREE.MeshStandardMaterial(), geometry = new THREE.BoxGeometry(.3, 2, .3);
  const original = new THREE.InstancedMesh(geometry, material, count); scene.add(original);
  const trees = Array.from({ length: count }, (_, index) => ({ x: -70 + index * 5, z: -40, scale: 1.5, rotation: .2, round: true }));
  trees.forEach((tree, index) => original.setMatrixAt(index, new THREE.Matrix4().makeTranslation(tree.x, 1.12, tree.z)));
  const treeTargets = trees.map((tree, index) => ({ ...tree, id: `tree-${index + 1}`, parts: [{ object: original, index }] }));
  const colliders = collectWorldColliders({ THREE, roots: [original] }), blastDamage = { destroyed: new Set() };
  const vendor = new THREE.Group(); vendor.position.set(-10.5, .1, 22.5); const vendorMesh = new THREE.Mesh(new THREE.BoxGeometry(.6, 1.9, .35), material); vendorMesh.position.y = .95; vendor.add(vendorMesh); scene.add(vendor);
  const village = new THREE.Group(); scene.add(village);
  if (cottages) for (let index = 0; index < 4; index++) {
    const home = new THREE.Group(); home.name = `Riverside cottage ${index + 1}`; home.userData.building = true; home.position.set(40 + index * 10, 0, -40); home.scale.setScalar(1.5); village.add(home);
    const body = new THREE.Mesh(new THREE.BoxGeometry(2.65, 2, 2.45), material); body.position.y = 1.12; home.add(body);
  }
  const requests = [], sourceResources = new Set(), mixers = [], handles = [], invalidations = [], interactive = [];
  function asset(id) {
    const group = new THREE.Group(); group.name = id;
    if(id==='woodland'){
      for(const [name,bark]of [['Object_2668',true],['Object_2669',false],['Object_0',true],['Object_2671',false]]){
        const geometry=new THREE.BoxGeometry(bark?.2:1,1,2),material=new THREE.MeshStandardMaterial();material.name=bark?'Bark':'Leaves';sourceResources.add(geometry);sourceResources.add(material);
        const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.position.z=-1;group.add(mesh);
      }
      return {scene:group,animations:[]};
    }
    const geometry = new THREE.BoxGeometry(id === 'tree' ? 2 : .5, 2, .5), material = new THREE.MeshStandardMaterial(); sourceResources.add(geometry); sourceResources.add(material);
    const object = new THREE.Mesh(geometry, material); object.name = id === 'city' ? SUPPLIED_SHOP_NODE : `${id}-mesh`; object.position.y = 1; group.add(object);
    const animations = ['bird', 'pedestrian'].includes(id) ? [new THREE.AnimationClip('idle', 1, [new THREE.NumberKeyframeTrack(`${object.name}.rotation[y]`, [0, 1], [0, .2])])] : [];
    return { scene: group, animations };
  }
  const library = createModelAssetLibrary({ load: async id => { requests.push(id); if (id === failed) throw new Error('Optional model failed'); return load ? load(id, asset) : asset(id); } });
  const manager = createSuppliedScenery({ THREE, scene, trees, treeTargets, blastDamage, scenery: { root: village }, islandLife: { vendors: [vendor] }, lowPower, reducedMotion, library,
    fitAsset(asset, options) {
      const handle = fitModelAsset(asset, options); handles.push(handle);
      if (handle.mixer) {
        let count = 0; const update = handle.mixer.update.bind(handle.mixer); handle.mixer.update = dt => { count++; update(dt); };
        mixers.push({ handle, get updates() { return count; } });
      }
      return handle;
    }, onReady: id => invalidations.push(id), onInteractive: object => interactive.push(object) });
  return { scene, manager, library, original, material, geometry, trees, treeTargets, blastDamage, colliders, village, vendor, vendorMesh, requests, sourceResources, mixers, handles, invalidations, interactive };
}

test('supplied scenery selects real catalog assets, instances bounded trees, and keeps original contacts while replacing visual foliage', async () => {
  assert.deepEqual(SUPPLIED_SCENERY_IDS, ['tree', 'woodland', 'pony', 'bird', 'pedestrian', 'staircase', 'city']);
  for (const id of SUPPLIED_SCENERY_IDS) assert.ok(MODEL_ASSETS[id]?.file.endsWith('.glb'));
  for (const lowPower of [false, true]) {
    const f = fixture({ lowPower }); const result = await f.manager.ready;
    assert.deepEqual(result.loaded, [...SUPPLIED_SCENERY_IDS.slice(0, 5)]); assert.deepEqual(result.failed, []); assert.deepEqual(f.requests, [...SUPPLIED_SCENERY_IDS.slice(0, 5)]); assert.deepEqual(f.invalidations, f.requests);
    const batch = f.manager.root.getObjectByName('Supplied Roundleaf tree instances'), count = lowPower ? 3 : 4;
    const variants=f.manager.root.children.filter(object=>object.isInstancedMesh);assert.deepEqual(new Set(variants.map(object=>object.userData.treeVariant)),new Set(['roundleaf','wildwood','meadow']));assert.equal(variants.length,5,'Three fake source variants share five draw batches');
    assert.ok(batch.isInstancedMesh); assert.equal(batch.count, count); assert.equal(batch.castShadow, !lowPower); assert.equal(batch.userData.breakableInstances.get(0), 'tree-1');
    const matrix = new THREE.Matrix4(); f.original.getMatrixAt(0, matrix); assert.equal(matrix.determinant(), 0); f.original.getMatrixAt(count+(lowPower?8:16), matrix); assert.notEqual(matrix.determinant(), 0);
    for(let index=0;index<count+(lowPower?8:16);index++){f.original.getMatrixAt(index,matrix);assert.equal(matrix.determinant(),0,'Every imported variant masks its procedural counterpart');}
    assert.ok(f.colliders.every(collider => collider.active()), 'Visual masking must not deactivate physical trunk contacts');
    const version = f.original.instanceMatrix.version, importedVersion = batch.instanceMatrix.version;
    for (let i = 0; i < 60; i++) f.manager.update(1 / 60, { paused: true });
    assert.equal(f.original.instanceMatrix.version, version); assert.equal(batch.instanceMatrix.version, importedVersion, 'Unchanged trees do not upload per frame');
    const pony = f.manager.root.getObjectByName('Supplied Pony model beside the pond'); assert.equal(drivingSurfaceAt(pony.position.x, pony.position.z), 'grass'); assert.equal(pony.userData.physicsIgnore, true);
    assert.equal(f.vendor.visible, true); assert.notEqual(f.vendorMesh.material, f.material); assert.equal(f.vendorMesh.material.visible, false); assert.equal(f.material.visible, true);
    assert.equal(f.interactive[0], f.manager.root); f.manager.dispose(); f.library.dispose();
  }
});

test('selected buildings replace cottage visuals without changing protected roots or their collider activity, with a smaller low-power budget', async () => {
  for (const lowPower of [false, true]) {
    const f = fixture({ lowPower, cottages: true }), contacts = collectWorldColliders({ THREE, roots: [f.village] });
    const transforms = f.village.children.map(home => home.matrixWorld.clone()); await f.manager.ready;
    const count = lowPower ? 2 : 4;
    assert.equal(f.requests.includes('city'), !lowPower);
    for (const [index, home] of f.village.children.entries()) {
      assert.equal(home.visible, true); assert.equal(home.userData.building, true); assert.ok(home.matrixWorld.equals(transforms[index]));
      assert.equal(home.children[0].material.visible, index < count ? false : true);
      if (index < count) assert.ok(home.children[1].name.startsWith(index < 2 ? 'Supplied staircase cottage' : 'Supplied laundry shop'));
    }
    assert.ok(contacts.every(collider => collider.active())); f.manager.dispose(); assert.ok(f.village.children.every(home => home.children.length === 1 && home.children[0].material === f.material)); f.library.dispose();
  }
});

test('tree instances track destruction, same-frame respawn/reset rehide procedural matrices, and late loading handles destroyed trees', async () => {
  const f = fixture(); f.blastDamage.destroyed.add('tree-1'); await f.manager.ready;
  const batch = f.manager.root.getObjectByName('Supplied Roundleaf tree instances'), matrix = new THREE.Matrix4(); batch.getMatrixAt(0, matrix); assert.equal(matrix.determinant(), 0);
  f.blastDamage.destroyed.delete('tree-1'); f.original.setMatrixAt(0, new THREE.Matrix4().makeTranslation(-70, 1.12, -40)); f.original.instanceMatrix.needsUpdate = true;
  f.manager.update(0, { paused: true }); batch.getMatrixAt(0, matrix); assert.notEqual(matrix.determinant(), 0); f.original.getMatrixAt(0, matrix); assert.equal(matrix.determinant(), 0);
  // The destroyed ID can be added and cleared before update sees it. A source
  // buffer revision must still hide the fallback restored by blast reset.
  f.blastDamage.destroyed.add('tree-1'); f.blastDamage.destroyed.clear(); f.original.setMatrixAt(0, new THREE.Matrix4().makeTranslation(-70, 1.12, -40)); f.original.instanceMatrix.needsUpdate = true;
  f.manager.update(0); f.original.getMatrixAt(0, matrix); assert.equal(matrix.determinant(), 0);
  f.blastDamage.destroyed.add('tree-1'); f.manager.update(0); batch.getMatrixAt(0, matrix); assert.equal(matrix.determinant(), 0);
  f.blastDamage.destroyed.clear(); f.manager.update(0); batch.getMatrixAt(0, matrix); assert.notEqual(matrix.determinant(), 0);
  f.manager.dispose(); f.library.dispose();
});

test('animated supplied models share the world clock, cap mixers at 30Hz, and skip paused, far-away and reduced-motion work', async () => {
  const f = fixture(); await f.manager.ready;
  for (let i = 0; i < 60; i++) f.manager.update(1 / 60, { focus: { x: -30, z: 0 } });
  assert.equal(f.mixers.length, 2); assert.ok(f.mixers.every(mixer => mixer.updates === 30));
  for (let i = 0; i < 20; i++) f.manager.update(.1, { paused: true, focus: { x: -30, z: 0 } });
  for (let i = 0; i < 20; i++) f.manager.update(.1, { focus: { x: 100, z: 100 } });
  assert.ok(f.mixers.every(mixer => mixer.updates === 30)); f.manager.dispose(); f.library.dispose();
  const reduced = fixture({ reducedMotion: true }); await reduced.manager.ready;
  for (let i = 0; i < 20; i++) reduced.manager.update(.1, { focus: { x: -30, z: 0 } });
  assert.ok(reduced.mixers.every(mixer => mixer.updates === 0)); reduced.manager.dispose(); reduced.library.dispose();
});

test('optional load failures preserve fallback trees and disposal detaches handles before releasing shared resources', async () => {
  const f = fixture({ failed: 'tree' }), original = new THREE.Matrix4(); f.original.getMatrixAt(0, original); const result = await f.manager.ready;
  assert.equal(result.failed[0].id, 'tree'); const matrix = new THREE.Matrix4(); f.original.getMatrixAt(0, matrix); assert.deepEqual(matrix.elements, original.elements);
  let resourcesReleased = 0; f.sourceResources.forEach(resource => resource.addEventListener('dispose', () => resourcesReleased++));
  const hiddenMaterial = f.vendorMesh.material; let maskReleases = 0; hiddenMaterial.addEventListener('dispose', () => maskReleases++);
  f.manager.dispose(); f.manager.dispose(); assert.equal(resourcesReleased, 0, 'Caller-owned library keeps shared resources until its owner releases them'); assert.equal(maskReleases, 1);
  assert.equal(f.vendorMesh.material, f.material); assert.equal(f.manager.root.parent, null); assert.ok(f.handles.every(handle => !handle.root.parent));
  f.library.dispose(); assert.equal(resourcesReleased, f.sourceResources.size);
});

test('disposing during a pending background load prevents late scene insertion and follow-on downloads', async () => {
  let resolve; const f = fixture({ load: (id, asset) => new Promise(done => { resolve = () => done(asset(id)); }) });
  await Promise.resolve(); await Promise.resolve(); f.manager.dispose(); resolve(); await f.manager.ready;
  assert.deepEqual(f.requests, ['tree']); assert.equal(f.manager.root.children.length, 0); assert.deepEqual(f.invalidations, []); assert.equal(f.vendorMesh.material, f.material); f.library.dispose();
});

test('actual supplied GLBs decode, keep human-scale animation bounds, remove the Pony studio floor, and select a standalone city shop', async () => {
  const f = fixture({ load: await createNodeModelLoader(), cottages: true, count: 24 });
  const result = await f.manager.ready; assert.deepEqual(result.failed, []); assert.deepEqual(result.loaded, [...SUPPLIED_SCENERY_IDS]);
  f.scene.updateMatrixWorld(true);
  const pedestrian = f.scene.getObjectByName('Supplied market pedestrian'), personSize = new THREE.Box3().setFromObject(pedestrian, true).getSize(new THREE.Vector3());
  assert.ok(Math.abs(personSize.y - 1.9) < .01); assert.equal(f.mixers.length, 2);
  const pony = f.scene.getObjectByName('Supplied Pony model beside the pond'); pony.traverse(object => { if (object.isMesh) assert.notEqual(object.material.name, 'Ground_SG'); });
  for (const index of [2, 3]) {
    const shop = f.village.children[index].children[1], size = new THREE.Box3().setFromObject(shop, true).getSize(new THREE.Vector3());
    let meshes = 0; shop.traverse(object => { if (object.isMesh) { meshes++; assert.equal(object.name, SUPPLIED_SHOP_NODE); } });
    assert.equal(meshes, 1); assert.ok(size.x <= 2.65 * 1.5 + .001); assert.ok(size.z <= 2.45 * 1.5 + .001);
  }
  const batches = f.manager.root.children.filter(object => object.isInstancedMesh); assert.equal(batches.length, 7); assert.ok(batches.filter(batch=>batch.userData.treeVariant==='roundleaf').every(batch=>batch.count===4));assert.ok(batches.filter(batch=>batch.userData.treeVariant!=='roundleaf').every(batch=>batch.count===8));
  const triangles=batches.reduce((sum,batch)=>sum+(batch.geometry.index?.count||batch.geometry.attributes.position.count)/3*batch.count,0);assert.ok(triangles<160000,'Twenty imported trees stay below 160k rendered triangles without source grass or ground');assert.ok(batches.every(batch=>batch.material.name!=='Grass_C'));
  f.manager.update(1 / 30, { focus: { x: -30, z: 0 } }); assert.ok(f.mixers.every(mixer => mixer.updates === 1));
  for(let frame=0;frame<150;frame++){
    f.manager.update(1/30,{focus:{x:-10.5,z:22.5}});f.scene.updateMatrixWorld(true);
    const bounds=new THREE.Box3().setFromObject(pedestrian,true),size=bounds.getSize(new THREE.Vector3());
    assert.ok(size.y>1.8&&size.y<2,'The walking clip stays human-sized throughout repeated loops');
    assert.ok(bounds.min.y>.1&&bounds.max.y<2.3,'Walking feet stay above the stall floor and the head below the awning');
    assert.ok(Math.abs(bounds.getCenter(new THREE.Vector3()).x-(-10.5+.95))<.6,'The clip stays inside the stall rather than drifting out of its fitted root');
  }
  pedestrian.traverse(object=>{if(object.isSkinnedMesh)assert.equal(object.frustumCulled,false);});
  f.manager.dispose(); f.library.dispose();
});
