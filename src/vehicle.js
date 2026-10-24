export function createVehicle({ THREE, scene, reducedMotion = false }) {
  const root = new THREE.Group(); root.name = 'Long D. Explorer'; scene.add(root);
  const body = new THREE.Group(); root.add(body);
  const materials = new Map(), allMaterials = new Set(), geometries = new Set(), textures = [];
  const material = (color, options = {}) => {
    const key = color + JSON.stringify(options);
    if (!materials.has(key)) { const mat = new THREE.MeshStandardMaterial({ color, roughness: .5, metalness: .12, ...options }); materials.set(key, mat); allMaterials.add(mat); }
    return materials.get(key);
  };
  const add = (geometry, mat, parent = body, x = 0, y = 0, z = 0) => {
    geometries.add(geometry); const object = new THREE.Mesh(geometry, typeof mat === 'string' ? material(mat) : mat);
    allMaterials.add(object.material); object.position.set(x, y, z); object.castShadow = true; object.receiveShadow = true; parent.add(object); return object;
  };
  const cube = new THREE.BoxGeometry(1, 1, 1);
  function box(w, h, d, mat, parent = body, x = 0, y = 0, z = 0) { const mesh = add(cube, mat, parent, x, y, z); mesh.scale.set(w, h, d); return mesh; }
  function cylinder(radius, length, mat, parent, x, y, z, segments = 16) { return add(new THREE.CylinderGeometry(radius, radius, length, segments), mat, parent, x, y, z); }
  function sphere(radius, mat, parent, x, y, z) { return add(new THREE.SphereGeometry(radius, 12, 8), mat, parent, x, y, z); }
  const paint = material('#739e94', { roughness: .32, metalness: .26 });
  const highlight = material('#a4c0b0', { roughness: .3, metalness: .22 });
  const cream = material('#e7e1c4', { roughness: .45 });
  const charcoal = material('#283e37', { roughness: .85, metalness: .08 });
  const metal = material('#aabeb1', { roughness: .26, metalness: .75 });
  const rubber = material('#23332e', { roughness: .98, metalness: 0 });
  const glass = material('#609d9a', { roughness: .15, metalness: .35, transparent: true, opacity: .47 });
  const upholstery = material('#655b46', { roughness: .95 });
  const headMaterial = material('#fff2c7', { emissive: '#ffd795', emissiveIntensity: .25, roughness: .18 });
  const tailMaterial = material('#b95742', { emissive: '#ff3423', emissiveIntensity: .12 });

  // Chassis, two-tone bodywork, hood creases, bumpers and a metal mesh grille.
  box(1.4, .2, 2.55, charcoal, body, 0, .39, 0);
  box(1.42, .46, 2.3, paint, body, 0, .72, 0);
  box(1.34, .2, .92, highlight, body, 0, 1.02, .77);
  for (const x of [-.46, .46]) box(.045, .025, .72, paint, body, x, 1.13, .8);
  box(1.14, .39, .055, charcoal, body, 0, .77, 1.18);
  for (let i = 0; i < 9; i++) box(.045, .27, .025, metal, body, -.44 + i * .11, .78, 1.22);
  box(1.55, .16, .17, charcoal, body, 0, .44, 1.3);
  box(1.55, .16, .17, charcoal, body, 0, .43, -1.25);
  for (const x of [-.62, .62]) { box(.1, .43, .08, metal, body, x, .65, 1.33); box(.19, .06, .16, '#c09e56', body, x, .37, 1.4); }
  box(1.36, .07, .08, metal, body, 0, .9, 1.34);
  box(.13, .13, .12, '#d8b05a', body, 0, .69, 1.3);

  // Cabin frame, window seals, door handles, hinges and wing mirrors.
  box(1.31, .64, 1.28, glass, body, 0, 1.35, -.18);
  for (const x of [-.69, .69]) {
    for (const z of [-.85, .46]) box(.07, .78, .07, highlight, body, x, 1.35, z);
    box(.065, .7, .055, paint, body, x, 1.34, -.24);
    box(.045, .04, 1.27, charcoal, body, x, 1.03, -.19);
    box(.05, .06, 1.3, charcoal, body, x, 1.68, -.18);
    box(.035, .36, 1.14, highlight, body, x * 1.022, .83, -.18);
    box(.055, .035, .23, metal, body, x * 1.055, 1.03, -.57);
    for (const z of [-.67, .24]) box(.045, .085, .085, metal, body, x * 1.04, .83, z);
    box(.21, .055, .055, charcoal, body, x * 1.12, 1.27, .32);
    box(.11, .2, .19, paint, body, x * 1.27, 1.32, .34);
    box(.02, .14, .13, metal, body, x * 1.36, 1.32, .34);
    box(.21, .085, 1.25, charcoal, body, x * 1.08, .49, -.13);
  }
  box(1.45, .14, 1.49, cream, body, 0, 1.77, -.2);
  box(.045, .67, .04, charcoal, body, 0, 1.35, .48);
  for (const x of [-.32, .32]) { const wiper = box(.025, .025, .47, charcoal, body, x, 1.12, .53); wiper.rotation.x = -.85; wiper.rotation.z = .16; }

  // Interior remains visible through the tinted windshield.
  box(1.15, .15, .27, charcoal, body, 0, 1.05, .28);
  for (const x of [-.34, .34]) { box(.43, .18, .49, upholstery, body, x, .98, -.25); const seat = box(.43, .51, .15, upholstery, body, x, 1.27, -.56); seat.rotation.x = -.12; }
  const steeringWheel = add(new THREE.TorusGeometry(.17, .025, 6, 20), charcoal, body, -.34, 1.19, .17); steeringWheel.rotation.x = -.7;
  for (let i = 0; i < 3; i++) { const spoke = box(.018, .31, .02, metal, steeringWheel, 0, 0, 0); spoke.rotation.z = i * Math.PI * 2 / 3; }
  box(.3, .38, .28, '#c7a567', body, -.34, 1.22, -.23);
  sphere(.16, '#b99778', body, -.34, 1.52, -.23);
  const helmet = sphere(.175, '#dcd9b5', body, -.34, 1.59, -.25); helmet.scale.y = .65;
  box(.3, .055, .06, charcoal, body, -.34, 1.55, -.095);
  for (const x of [-.48, -.2]) { const arm = box(.08, .27, .08, '#b99778', body, x, 1.2, .01); arm.rotation.x = -.7; }

  // Roof rack, strapped expedition luggage, spare tire and an exhaust pipe.
  for (const x of [-.58, .58]) box(.06, .13, 1.3, metal, body, x, 1.94, -.2);
  for (let i = 0; i < 5; i++) box(1.22, .055, .04, charcoal, body, 0, 1.91, -.75 + i * .27);
  box(1.25, .09, .055, charcoal, body, 0, 2.04, -.84);
  box(1.25, .09, .055, charcoal, body, 0, 2.04, .44);
  box(.64, .3, .77, '#b99b69', body, -.2, 2.09, -.27);
  for (const z of [-.52, -.04]) box(.68, .025, .045, charcoal, body, -.2, 2.25, z);
  const blanket = cylinder(.15, .72, '#a7b69b', body, .3, 2.1, -.46, 12); blanket.rotation.z = Math.PI / 2;
  const spare = cylinder(.31, .24, rubber, body, .22, 1.02, -1.28); spare.rotation.x = Math.PI / 2;
  const spareHub = cylinder(.13, .26, metal, body, .22, 1.02, -1.28); spareHub.rotation.x = Math.PI / 2;
  box(.32, .41, .18, '#beaa69', body, -.47, .97, -1.25);
  const exhaust = cylinder(.055, .46, metal, body, -.54, .35, -1.17, 8); exhaust.rotation.x = Math.PI / 2;

  const wheelPivots = [], wheelRollers = [], suspension = [], hydraulicRams=[];
  const reservoir=cylinder(.1,.4,metal,body,0,.35,-.3,12);reservoir.rotation.z=Math.PI/2;reservoir.name='hydraulic-pressure-reservoir';
  const treadGeometry = new THREE.BoxGeometry(.24, .055, .11); geometries.add(treadGeometry);
  for (const x of [-.8, .8]) for (const z of [-.77, .8]) {
    const pivot = new THREE.Group(); pivot.position.set(x, .45, z); root.add(pivot);
    const roller = new THREE.Group(); pivot.add(roller);
    const tire = cylinder(.35, .25, rubber, roller, 0, 0, 0, 24); tire.rotation.z = Math.PI / 2;
    const outerRing = add(new THREE.TorusGeometry(.245, .035, 6, 24), charcoal, roller); outerRing.rotation.y = Math.PI / 2; outerRing.position.x = Math.sign(x) * .14;
    const rim = cylinder(.205, .265, metal, roller, 0, 0, 0, 16); rim.rotation.z = Math.PI / 2;
    const hub = cylinder(.075, .29, '#51685b', roller, 0, 0, 0, 10); hub.rotation.z = Math.PI / 2;
    for (let i = 0; i < 6; i++) {
      const angle = i / 6 * Math.PI * 2;
      const spoke = box(.03, .29, .035, cream, roller, Math.sign(x) * .15, 0, 0); spoke.rotation.x = angle;
      const lug = cylinder(.018, .31, charcoal, roller, 0, Math.sin(angle) * .11, Math.cos(angle) * .11, 5); lug.rotation.z = Math.PI / 2;
    }
    const tread = new THREE.InstancedMesh(treadGeometry, rubber, 24), dummy = new THREE.Object3D();
    for (let i = 0; i < 24; i++) { const angle = i / 24 * Math.PI * 2; dummy.position.set(0, Math.sin(angle) * .35, Math.cos(angle) * .35); dummy.rotation.set(-angle, 0, i % 2 ? .16 : -.16); dummy.updateMatrix(); tread.setMatrixAt(i, dummy.matrix); }
    tread.castShadow = true; roller.add(tread);
    const guard = add(new THREE.TorusGeometry(.41, .065, 6, 18, Math.PI), paint, body, x, .48, z); guard.rotation.y = Math.PI / 2;
    const spring = add(new THREE.TorusKnotGeometry(.06, .012, 32, 4, 2, 7), metal, root, x * .7, .52, z); spring.scale.y = 2.2;
    const barrel=cylinder(.065,.27,charcoal,root,x*.77,.43,z,10);barrel.name='hydraulic-cylinder';
    const piston=cylinder(.03,1,metal,root,x*.77,.62,z,10);piston.name='hydraulic-piston';
    box(.17,.065,.17,metal,body,x*.77,.75,z);
    hydraulicRams.push({barrel,piston});
    wheelPivots.push({ pivot, front: z > 0, side: Math.sign(x), z }); wheelRollers.push(roller); suspension.push(spring);
  }
  const headLights = [];
  for (const x of [-.48, .48]) {
    const surround = cylinder(.15, .08, metal, body, x, .85, 1.24, 20); surround.rotation.x = Math.PI / 2;
    const lens = cylinder(.12, .09, headMaterial, body, x, .85, 1.25, 20); lens.rotation.x = Math.PI / 2;
    box(.16, .1, .055, tailMaterial, body, x, .77, -1.24);
    const light = new THREE.SpotLight('#ffe5ad', 0, 19, Math.PI / 7, .65, 1.35);
    light.position.set(x, .85, 1.3); const target = new THREE.Object3D(); target.position.set(x, .03, 11); root.add(target); light.target = target; root.add(light); headLights.push(light);
    // Faint cones make the headlights visible in fog without expensive volumetrics.
    const beam = add(new THREE.ConeGeometry(1.45, 9, 24, 1, true), new THREE.MeshBasicMaterial({ color: '#ffdc9a', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending }), root, x, .52, 5.7);
    beam.rotation.x = -Math.PI / 2; beam.name = 'headlight-beam';
  }
  const plateCanvas = document.createElement('canvas'); plateCanvas.width = 256; plateCanvas.height = 96;
  const ctx = plateCanvas.getContext('2d'); ctx.fillStyle = '#e8e4cb'; ctx.fillRect(0, 0, 256, 96); ctx.fillStyle = '#314b3b'; ctx.font = 'bold 55px monospace'; ctx.textAlign = 'center'; ctx.fillText('LD · 007', 128, 68);
  const plateTexture = new THREE.CanvasTexture(plateCanvas); plateTexture.colorSpace = THREE.SRGBColorSpace; textures.push(plateTexture);
  const plate = add(new THREE.PlaneGeometry(.51, .2), new THREE.MeshBasicMaterial({ map: plateTexture, toneMapped: false }), body, 0, .42, 1.395);
  const antenna = new THREE.Group(); antenna.position.set(.6, 1.04, -.9); body.add(antenna);
  cylinder(.012, 1.3, metal, antenna, 0, .65, 0, 5); box(.3, .18, .02, '#e3be69', antenna, .14, 1.17, 0);

  let lastSpeed = 0, wheelAngle = 0, disposed = false;
  return {
    root, body, headLights,
    update(dt, { driver, night = 0, headlights = 'auto', braking = false, time = 0 }) {
      root.position.set(driver.x, (driver.groundHeight || 0) + driver.hop, driver.z); root.rotation.y = driver.heading;
      const acceleration = Math.max(-24, Math.min(24, (driver.speed - lastSpeed) / Math.max(dt, .001))); lastSpeed = driver.speed;
      const active = headlights === 'on' ? 1 : headlights === 'off' ? 0 : Math.max(.08, night);
      headLights.forEach(light => { light.intensity = 32 * active; });
      headMaterial.emissiveIntensity = .25 + active * 3;
      tailMaterial.emissiveIntensity = braking || acceleration < -2 ? 3.5 : .18 + night * .7;
      root.children.filter(object => object.name === 'headlight-beam').forEach(beam => { beam.material.opacity = active * night * .025; });
      const pitch = reducedMotion ? 0 : Math.max(-.2, Math.min(.2, (driver.pitch || 0) - acceleration * .004));
      const roll = reducedMotion ? 0 : Math.max(-.22, Math.min(.22, (driver.roll || 0) - driver.steering * driver.speed * .012));
      const lift=Math.max(-.21,Math.min(.17,driver.hydraulicOffset||0));
      body.position.y=lift;
      body.rotation.x += (pitch - body.rotation.x) * Math.min(dt * 9, 1);
      body.rotation.z += (roll - body.rotation.z) * Math.min(dt * 9, 1);
      wheelPivots.forEach(({ pivot, front, side, z },index) => {
        pivot.rotation.y = front ? driver.steering * .4 : 0;
        const corner = `${front ? 'front' : 'rear'}${side < 0 ? 'Left' : 'Right'}`;
        const surface = driver.wheelHeights?.[corner] ?? driver.groundHeight ?? 0;
        const travel = Math.max(-.12, Math.min(.12, surface - (driver.groundHeight || 0)));
        pivot.position.y = .45 + travel + (reducedMotion ? 0 : Math.sin(time * 11 + z * 4) * Math.abs(driver.speed) * .0018 + roll * side * .12);
        const ram=hydraulicRams[index],bottom=.43+travel*.5,top=.75+lift;
        ram.barrel.position.y=bottom;ram.piston.position.y=(bottom+top)/2;
        ram.piston.scale.y=Math.max(.08,top-bottom);
        suspension[index].position.y=.52+lift*.5+travel*.5;
      });
      wheelAngle += driver.speed * Math.min(dt, .05) / .35;
      wheelRollers.forEach(roller => { roller.rotation.x = wheelAngle; });
      suspension.forEach(spring => { spring.scale.y = Math.max(.9,2.2+lift*4) + (reducedMotion ? 0 : Math.sin(time * 11) * Math.abs(driver.speed) * .008); });
      steeringWheel.rotation.z = -driver.steering * .7;
      antenna.rotation.z = reducedMotion ? 0 : Math.sin(time * 7) * Math.abs(driver.speed) * .006;
    },
    dispose() { if (disposed) return; disposed = true; root.removeFromParent(); geometries.forEach(geometry => geometry.dispose()); allMaterials.forEach(mat => mat.dispose()); textures.forEach(texture => texture.dispose()); }
  };
}
