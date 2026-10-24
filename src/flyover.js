/** A quiet, occasional flight through the island's sky; it owns no audio or camera. */
export function createFlyover({ THREE, scene, reducedMotion = false, coarse = false }) {
  const root = new THREE.Group(); root.name = 'island-flyover'; scene.add(root);
  const aircraft = new THREE.Group(); aircraft.name = 'Long D. Air'; root.add(aircraft);
  const geometries = new Set(), materials = new Set();
  const geometry = value => { geometries.add(value); return value; };
  const material = (color, extra = {}) => {
    const value = new THREE.MeshStandardMaterial({ color, roughness: .52, metalness: .12, ...extra }); materials.add(value); return value;
  };
  const cream = material('#eee7cb'), green = material('#5f8c79'), gold = material('#c9a467'), dark = material('#344b49');
  const glass = material('#86bbc3', { metalness: .35, roughness: .2 });
  const cube = geometry(new THREE.BoxGeometry(1, 1, 1));
  const orb = geometry(new THREE.SphereGeometry(1, coarse ? 12 : 20, coarse ? 8 : 12));
  function mesh(shape, paint, parent = aircraft, x = 0, y = 0, z = 0) {
    const object = new THREE.Mesh(shape, paint); object.position.set(x, y, z); object.castShadow = true; object.receiveShadow = true; parent.add(object); return object;
  }
  function box(w, h, d, paint, parent = aircraft, x = 0, y = 0, z = 0) {
    const object = mesh(cube, paint, parent, x, y, z); object.scale.set(w, h, d); return object;
  }
  function ellipsoid(x, y, z, sx, sy, sz, paint, parent = aircraft) {
    const object = mesh(orb, paint, parent, x, y, z); object.scale.set(sx, sy, sz); return object;
  }
  // A shallow prism gives the swept wings visible top surfaces and tidy edges.
  function wing(span, chord, paint, y, z) {
    const shape = new THREE.Shape();
    shape.moveTo(-span / 2, -.26 * chord); shape.lineTo(-span / 2 + .22, .28 * chord);
    shape.lineTo(-.42, .58 * chord); shape.lineTo(.42, .58 * chord);
    shape.lineTo(span / 2 - .22, .28 * chord); shape.lineTo(span / 2, -.26 * chord); shape.closePath();
    const object = mesh(geometry(new THREE.ExtrudeGeometry(shape, { depth: .075, bevelEnabled: false })), paint, aircraft, 0, y, z);
    object.rotation.x = Math.PI / 2; return object;
  }
  ellipsoid(0, 0, .1, .43, .43, 1.9, cream);
  ellipsoid(0, .12, -.97, .25, .25, 1.17, green);
  ellipsoid(0, .38, .45, .32, .29, .69, glass);
  box(.065, .17, 1.1, cream, aircraft, 0, .57, .43); // cockpit center frame
  box(.61, .07, .07, cream, aircraft, 0, .49, .88);
  wing(5.7, 1.38, cream, .08, .26);
  wing(2.05, .78, green, .13, -1.51);
  for (const side of [-1, 1]) {
    box(.32, .026, .68, gold, aircraft, side * 2.24, .108, .15);
    box(.035, .035, 1.03, green, aircraft, side * 1.42, .12, .18);
    const brace = box(.045, .045, 1.45, dark, aircraft, side * .74, -.25, .1);
    brace.rotation.z = side * -.55; brace.rotation.x = -.08;
    box(.055, .59, .07, dark, aircraft, side * .58, -.54, .61).rotation.z = side * -.18;
    const tire = mesh(geometry(new THREE.CylinderGeometry(.2, .2, .13, 12)), dark, aircraft, side * .64, -.82, .61); tire.rotation.z = Math.PI / 2;
    ellipsoid(side * .64, -.77, .64, .12, .14, .33, green);
  }
  const finShape = new THREE.Shape();
  finShape.moveTo(-.48, 0); finShape.lineTo(-.12, .83); finShape.lineTo(.19, .83); finShape.lineTo(.42, 0); finShape.closePath();
  const fin = mesh(geometry(new THREE.ExtrudeGeometry(finShape, { depth: .075, bevelEnabled: false })), green, aircraft, -.0375, .12, -1.53); fin.rotation.y = Math.PI / 2;
  ellipsoid(0, -.34, -1.7, .1, .12, .14, dark);
  const propeller = new THREE.Group(); propeller.position.set(0, .015, 2.01); aircraft.add(propeller);
  for (let index = 0; index < 3; index++) {
    const blade = box(.13, .94, .035, dark, propeller, 0, .44, 0); blade.rotation.z = index * Math.PI * 2 / 3;
    blade.position.set(-Math.sin(blade.rotation.z) * .44, Math.cos(blade.rotation.z) * .44, 0);
    const tip = box(.13, .16, .038, gold, propeller); tip.rotation.z = blade.rotation.z;
    tip.position.set(-Math.sin(blade.rotation.z) * .83, Math.cos(blade.rotation.z) * .83, .005);
  }
  ellipsoid(0, .015, 2.08, .19, .19, .24, gold);
  const lamps = [];
  for (const [x, color] of [[-2.8, '#ff8069'], [2.8, '#8ee3bd']]) {
    const paint = material(color, { emissive: color, emissiveIntensity: .4 });
    const lamp = ellipsoid(x, .1, .12, .075, .075, .11, paint); lamp.castShadow = false; lamps.push(paint);
  }
  const beaconPaint = material('#f4e5ba', { emissive: '#f4e5ba', emissiveIntensity: .5 });
  const beacon = ellipsoid(0, .37, -1.17, .07, .07, .07, beaconPaint); beacon.castShadow = false;
  let elapsed = 0, disposed = false;
  const period = 52, flightLength = 17, delay = 2;
  function place() {
    const cycle = Math.floor(elapsed / period), phase = elapsed % period;
    root.visible = !reducedMotion && phase >= delay && phase <= delay + flightLength;
    const u = Math.max(0, Math.min(1, (phase - delay) / flightLength)), reverse = cycle % 2 === 1;
    const progress = reverse ? 1 - u : u, direction = reverse ? -1 : 1;
    const x = -38 + 76 * progress, z = -7 + progress * 14 + Math.sin(progress * Math.PI) * 2;
    const y = 9 + Math.sin(progress * Math.PI) * 1.25;
    const dx = 76 * direction, dz = (14 + Math.cos(progress * Math.PI) * Math.PI * 2) * direction;
    const dy = Math.cos(progress * Math.PI) * Math.PI * 1.25 * direction;
    aircraft.position.set(x, y, z); aircraft.rotation.order = 'YXZ';
    aircraft.rotation.set(-Math.atan2(dy, Math.hypot(dx, dz)), Math.atan2(dx, dz), Math.sin(progress * Math.PI * 2) * .12 * direction);
    propeller.rotation.z = elapsed * 34;
    root.updateMatrixWorld(true);
  }
  function getState() { return { visible: root.visible, elapsed, position: aircraft.position.toArray(), heading: aircraft.rotation.y }; }
  place();
  return {
    root,
    update(dt = 0, { night = 0, paused = false } = {}) {
      if (disposed) return getState();
      if (!paused && !reducedMotion && Number.isFinite(dt)) elapsed += Math.max(0, Math.min(dt, .1));
      const darkness = Math.max(0, Math.min(1, Number(night) || 0));
      lamps.forEach(paint => { paint.emissiveIntensity = .35 + darkness * 2.2; });
      beaconPaint.emissiveIntensity = .3 + darkness * (1.5 + Math.pow(Math.max(0, Math.sin(elapsed * 4.2)), 12) * 1.7);
      place(); return getState();
    },
    getState,
    dispose() {
      if (disposed) return; disposed = true; root.removeFromParent();
      geometries.forEach(value => value.dispose()); materials.forEach(value => value.dispose());
    }
  };
}
