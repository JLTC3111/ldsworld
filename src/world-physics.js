import { portals } from './world-layout.js';

// Derive contacts from authored geometry, including instanced village details.
// Rendering meshes remain the source of truth when an object is resized/moved.
export function collectWorldColliders({ THREE, roots = [], exclude = [], existing = [] } = {}) {
  const excluded = new Set(exclude), colliders = [...existing], matrix = new THREE.Matrix4();
  const bounds = new THREE.Box3(), size = new THREE.Vector3(), centre = new THREE.Vector3();
  const torusPoint = new THREE.Vector3(), torusScale = new THREE.Vector3();
  const visible = object => { for (let p = object; p; p = p.parent) if (!p.visible) return false; return true; };
  const visited = new Set();
  for (const root of roots) {
    root.updateWorldMatrix(true, true);
    root.traverse(object => {
      if (visited.has(object)) return; visited.add(object);
      for (let p = object; p; p = p.parent) if (excluded.has(p) || p.userData.physicsIgnore || p.userData.bridgeDeck) return;
      if (!object.isMesh || !object.geometry || object.material?.transparent || Array.isArray(object.material)) return;
      const geometry = object.geometry;
      if (['PlaneGeometry', 'CircleGeometry', 'RingGeometry'].includes(geometry.type)) return;
      if (!geometry.boundingBox) geometry.computeBoundingBox();
      const count = object.isInstancedMesh ? object.count : 1;
      for (let i = 0; i < count; i++) {
        if (object.isInstancedMesh) { object.getMatrixAt(i, matrix); matrix.premultiply(object.matrixWorld); }
        else matrix.copy(object.matrixWorld);
        if (geometry.type === 'TorusGeometry') {
          // An arch is a rim, not its enclosing box: retain the opening for
          // driving through portals. Low crosspieces act as driveable sills.
          const { radius, tube, arc = Math.PI * 2 } = geometry.parameters;
          torusScale.setFromMatrixScale(matrix);
          const segments = Math.max(12, Math.ceil(arc * radius / .3)), step = arc / segments;
          const extent = (tube + radius * Math.sin(step / 2)) * Math.max(torusScale.x, torusScale.y, torusScale.z);
          for (let segment = 0; segment < segments; segment++) {
            const angle = (segment + .5) * step;
            torusPoint.set(radius * Math.cos(angle), radius * Math.sin(angle), 0).applyMatrix4(matrix);
            if (torusPoint.y < .9 || torusPoint.y - extent > 2.5) continue;
            colliders.push({ x: torusPoint.x, z: torusPoint.z, width: extent * 2, depth: extent * 2, minY: torusPoint.y - extent, maxY: torusPoint.y + extent, kind: 'arch', object, active: () => visible(object) });
          }
          continue;
        }
        bounds.copy(geometry.boundingBox).applyMatrix4(matrix); bounds.getSize(size); bounds.getCenter(centre);
        if (bounds.max.y < .9 && portals.some(portal => Math.hypot(centre.x - portal.x, centre.z - portal.z) < 2.1)) continue;
        // Flat paving, tiny flowers, roofs and overhead lantern cables do not
        // form invisible walls across otherwise driveable ground/bridge decks.
        if (bounds.max.y <= .25 || bounds.min.y > 2.5 || size.y < .075 || Math.max(size.x, size.z) < .075) continue;
        if (size.y < .15 && Math.min(size.x, size.z) > .8) continue;
        if (![size.x, size.y, size.z, centre.x, centre.z].every(Number.isFinite)) continue;
        colliders.push({ x: centre.x, z: centre.z, width: Math.max(.035, size.x), depth: Math.max(.035, size.z), minY: bounds.min.y, maxY: bounds.max.y, kind: 'scenery', object, instance: object.isInstancedMesh ? i : undefined, active: () => visible(object) });
      }
    });
  }
  return colliders;
}

// Wrap a complete freestanding prop, rather than breaking its decorative parts
// into independent bodies. Reparenting preserves its world-space appearance.
export function createDynamicBody({ THREE, object, parent, id, mass = 1.5, kind = 'prop', active } = {}) {
  object.updateWorldMatrix(true, true);
  const bounds = new THREE.Box3().setFromObject(object), centre = bounds.getCenter(new THREE.Vector3()), size = bounds.getSize(new THREE.Vector3());
  const wrapper = new THREE.Group(); wrapper.name = `Physical ${id}`; wrapper.userData.propId = id;
  (parent || object.parent).add(wrapper); wrapper.position.copy(centre); wrapper.updateWorldMatrix(true, false); wrapper.attach(object);
  return { id, object: wrapper, x: centre.x, y: centre.y, z: centre.z, radius: Math.max(.13, Math.hypot(size.x, size.z) * .45), height: Math.max(.1, size.y), mass, kind, floorOffset: bounds.min.y - .12, initialSleeping: true, active };
}

// Loose shoreline rocks retain their original resting depth/orientation; a
// stationary island does not rearrange itself when physics first starts.
export function createInstancedBodies({ THREE, object, idPrefix = 'rock', mass = 2, filter = () => true } = {}) {
  object.updateWorldMatrix(true, false);
  if (!object.geometry.boundingBox) object.geometry.computeBoundingBox();
  const matrix = new THREE.Matrix4(), centre = new THREE.Vector3(), size = new THREE.Vector3(), bounds = new THREE.Box3(), scale = new THREE.Vector3(), quaternion = new THREE.Quaternion(), position = new THREE.Vector3();
  const bodies = [];
  for (let index = 0; index < object.count; index++) {
    object.getMatrixAt(index, matrix); matrix.premultiply(object.matrixWorld);
    bounds.copy(object.geometry.boundingBox).applyMatrix4(matrix); bounds.getCenter(centre); bounds.getSize(size);
    if (!filter({ index, size, centre })) continue;
    matrix.decompose(position, quaternion, scale);
    const id = `${idPrefix}-${index + 1}`;
    bodies.push({ id, x: position.x, y: position.y, z: position.z, radius: Math.max(.1, Math.hypot(size.x, size.z) * .4), height: Math.max(.1, size.y), mass: typeof mass === 'function' ? mass(size, index) : mass, kind: 'rock', floorOffset: position.y - .12 - size.y / 2, initialSleeping: true,
      instance: { object, index, quaternion: quaternion.clone(), scale: scale.clone() }, active: () => object.visible });
  }
  return bodies;
}

const syncCaches = new WeakMap();
export function syncPhysicsBodies(THREE, bodies) {
  let cache = syncCaches.get(THREE);
  if (!cache) { cache = { matrix: new THREE.Matrix4(), rotation: new THREE.Quaternion(), euler: new THREE.Euler(), position: new THREE.Vector3(), dirty: new Set() }; syncCaches.set(THREE, cache); }
  cache.dirty.clear();
  for (const body of bodies) {
    if (body.object) {
      if (body.active) body.object.visible = Boolean(body.active());
      body.object.position.set(body.x, body.y, body.z);
      body.object.rotation.set(body.tiltX || 0, body.rotation || 0, body.tiltZ || 0);
    }
    if (!body.instance) continue;
    const { object, index, quaternion, scale } = body.instance;
    cache.rotation.setFromEuler(cache.euler.set(body.tiltX || 0, body.rotation || 0, body.tiltZ || 0)).multiply(quaternion);
    cache.matrix.compose(cache.position.set(body.x, body.y, body.z), cache.rotation, scale);
    cache.matrix.premultiply(object.matrixWorld.clone().invert()); object.setMatrixAt(index, cache.matrix); cache.dirty.add(object);
  }
  for (const object of cache.dirty) { object.instanceMatrix.needsUpdate = true; object.computeBoundingSphere(); }
}
