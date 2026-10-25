import { drivingSurfaceAt } from './driving.js';
import { createStreamWater } from './stream-water.js';
import { bridges, bridgeHeightAt, houses, portals, riverCenter, RIVER_HALF_WIDTH, bridgeAt, RIVER_REACH, WORLD_SCALE, LANDMARKS } from './world-layout.js';
import { projects } from './data.js';

// These are geometry-built objects rather than downloaded models, so the world
// stays small, works offline, and shares one consistent handcrafted scale.
export function createScenery({ THREE, scene, land, box, cylinder, sphere, group, mesh, mat, coarse = false, reducedMotion = false }) {
  const root = group(land); root.name = 'River village and portals';
  const colliders = [], bodies = [], lamps = [], portalGroups = [],breakableTargets=[],bridgeGroups=[];
  const ownedGeometries = new Set(), ownedMaterials = new Set();
  // Box helpers share the world's unit cube; sphere/cylinder helpers allocate
  // their own geometry, which belongs to this module's lifetime.
  const cylinderHelper = cylinder, sphereHelper = sphere;
  cylinder = (...args) => { const object = cylinderHelper(...args); ownedGeometries.add(object.geometry); return object; };
  sphere = (...args) => { const object = sphereHelper(...args); ownedGeometries.add(object.geometry); return object; };
  const swaying = [], smoke = [], snowLayers = [], portalEffects = [], lightObjects = [];
  let snowCover = 0, tick = 0;
  let seed = 74291;
  const random = () => { seed = seed * 16807 % 2147483647; return (seed - 1) / 2147483646; };
  const ownGeo = geometry => { ownedGeometries.add(geometry); return geometry; };
  const ownMat = (color, options = {}) => { const material = new THREE.MeshStandardMaterial({ color, roughness: .88, ...options }); ownedMaterials.add(material); return material; };
  const basic = (color, options = {}) => { const material = new THREE.MeshBasicMaterial({ color, ...options }); ownedMaterials.add(material); return material; };
  const dummy = new THREE.Object3D(), scratch = new THREE.Color();
  const noProject = (x, z, padding = 1) => !projects.some(project => Math.abs(x - project.position[0]) < project.footprint[0] / 2 + padding && Math.abs(z - project.position[1]) < project.footprint[1] / 2 + padding);
  const noBridge = (x, z, padding = .7) => !bridges.some(bridge => {
    const dx = x - bridge.x, dz = z - bridge.z;
    return Math.abs(dx * Math.cos(bridge.heading) - dz * Math.sin(bridge.heading)) < bridge.width / 2 + padding && Math.abs(dx * Math.sin(bridge.heading) + dz * Math.cos(bridge.heading)) < bridge.length / 2 + padding;
  });
  function roof(w, d, h, color, parent, x = 0, y = 0, z = 0) {
    const geometry = ownGeo(new THREE.BufferGeometry());
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([
      -w/2,0,d/2,w/2,0,d/2,0,h,d/2, -w/2,0,-d/2,0,h,-d/2,w/2,0,-d/2,
      -w/2,0,-d/2,-w/2,0,d/2,0,h,d/2,0,h,-d/2,
      0,h,-d/2,0,h,d/2,w/2,0,d/2,w/2,0,-d/2,
      -w/2,0,-d/2,w/2,0,-d/2,w/2,0,d/2,-w/2,0,d/2
    ], 3));
    geometry.setIndex([0,1,2,3,4,5,6,7,8,6,8,9,10,11,12,10,12,13,14,15,16,14,16,17]); geometry.computeVertexNormals();
    return mesh(geometry, typeof color === 'string' ? mat(color) : color, parent, x, y, z);
  }
  function curveLine(points, color, parent, radius = .016) {
    const curve = new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point)));
    return mesh(ownGeo(new THREE.TubeGeometry(curve, coarse?10:15, radius, 4, false)), color, parent);
  }
  function beamBetween(a, b, width, color, parent) {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b);
    const object = box(width, start.distanceTo(end), width, color, parent);
    object.position.copy(start).add(end).multiplyScalar(.5);
    object.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.sub(start).normalize()); return object;
  }
  const lanternMaterials = ['#eac176', '#d79269', '#b4bc8b'].map(color => {
    const material = ownMat(color, { emissive: color, emissiveIntensity: .14 }); lamps.push(material); return material;
  });
  const lanternGeometry = ownGeo(new THREE.BoxGeometry(.25,.32,.25));
  const roofTileCage=ownGeo(new THREE.BoxGeometry(1,1,1));
  const lanternRib = ownGeo(new THREE.TorusGeometry(.14, .01, 4, 12));
  function lantern(parent, x, y, z, index = 0) {
    const hanging = group(parent, x, z); hanging.position.y = y;
    cylinder(.009, .009, .3, '#776c50', hanging, 0, .22, 0, 4);
    const globe = mesh(lanternGeometry, lanternMaterials[index % lanternMaterials.length], hanging, 0, -.02, 0); globe.scale.set(.85, 1.13, .85);
    cylinder(.11, .11, .045, '#a38555', hanging, 0, .185, 0, 8);
    cylinder(.09, .11, .045, '#a38555', hanging, 0, -.225, 0, 8);
    const rib = mesh(lanternRib, '#a38051', hanging, 0, -.02, 0); rib.rotation.x = Math.PI / 2;
    beamBetween([0, -.25, 0], [0, -.37, 0], .018, '#c89a56', hanging);
    const cage=new THREE.InstancedMesh(roofTileCage,mat('#7a7153'),12);cage.name='Lantern timber cage';hanging.add(cage);
    let frame=0;
    for(const px of [-.13,.13])for(const pz of [-.13,.13]){dummy.position.set(px,-.02,pz);dummy.rotation.set(0,0,0);dummy.scale.set(.022,.39,.022);dummy.updateMatrix();cage.setMatrixAt(frame++,dummy.matrix);}
    for(const py of [-.21,.17])for(const axis of [0,1])for(const side of [-1,1]){dummy.position.set(axis?side*.13:0,py,axis?0:side*.13);dummy.scale.set(axis?.024:.28,.026,axis?.28:.024);dummy.updateMatrix();cage.setMatrixAt(frame++,dummy.matrix);}
    swaying.push({ object: hanging, phase: index * .7, amplitude: .075 }); return hanging;
  }

  const stream=createStreamWater({THREE,parent:root,scene,coarse,reducedMotion});

  // Every crossing shares the exact driveable profile used by physics.
  for (const bridge of bridges) {
    const crossing = group(root, bridge.x, bridge.z); crossing.rotation.y = bridge.heading; crossing.name = `Arched ${bridge.id} bridge`;
    crossing.userData.breakableId=`bridge-${bridge.id}`;crossing.userData.breakableKind='bridge';bridgeGroups.push({bridge,object:crossing});
    const planks = coarse ? 15 : 23;
    const bolts=new THREE.InstancedMesh(ownGeo(new THREE.CylinderGeometry(.055,.055,.025,8)),mat('#65726a'),planks*2);bolts.name='Bridge iron fasteners';crossing.add(bolts);
    const grain=new THREE.InstancedMesh(ownGeo(new THREE.BoxGeometry(1,1,1)),mat('#8c7556'),planks*3);grain.name='Bridge timber grain';crossing.add(grain);
    for (let i = 0; i < planks; i++) {
      const along = -bridge.length / 2 + (i + .5) / planks * bridge.length;
      const worldX = bridge.x + Math.sin(bridge.heading) * along, worldZ = bridge.z + Math.cos(bridge.heading) * along;
      const top = bridgeHeightAt(worldX, worldZ);
      const plank = box(bridge.width - .25, .11, bridge.length / planks * .94, ['#b4956b', '#c1a476', '#ad9168'][i % 3], crossing, 0, top - .055, along);
      plank.userData.bridgeDeck = bridge.id;
      // Each plank tilts with the arch instead of forming a flat tabletop.
      const sample = .03;
      const before = bridgeHeightAt(worldX - Math.sin(bridge.heading) * sample, worldZ - Math.cos(bridge.heading) * sample);
      const after = bridgeHeightAt(worldX + Math.sin(bridge.heading) * sample, worldZ + Math.cos(bridge.heading) * sample);
      plank.rotation.x = -Math.atan2(after - before, sample * 2);
      for(let side=0;side<2;side++){dummy.position.set((side?1:-1)*(bridge.width/2-.38),top+.025,along);dummy.rotation.set(plank.rotation.x,0,0);dummy.scale.set(1,1,1);dummy.updateMatrix();bolts.setMatrixAt(i*2+side,dummy.matrix);}
      for(let g=0;g<3;g++){dummy.position.set((g-1)*bridge.width*.24,top+.009,along+(g%2?-.055:.045));dummy.rotation.set(plank.rotation.x,0,0);dummy.scale.set(bridge.width*(.12+(i%3)*.025),.008,.009);dummy.updateMatrix();grain.setMatrixAt(i*3+g,dummy.matrix);}
    }
    // Leave the shallow ramp ends open where the bridge meets a crossroad;
    // long guardrails here cut across the horizontal road's turning envelope.
    const railHalfLength=Math.min(2.6,bridge.length/2-1.8);
    for (const side of [-1, 1]) {
      const x = side * (bridge.width / 2 - .14);
      const railStart=bridge.id==='village'?-1.2:bridge.id==='west'&&side===1?-.8:bridge.id==='east'&&side===-1?.3:-railHalfLength;
      const railSpan=railHalfLength-railStart;
      for (let i = 0; i <= 6; i++) {
        const along = railStart+i/6*railSpan;
        const top = bridgeHeightAt(bridge.x + Math.sin(bridge.heading) * along, bridge.z + Math.cos(bridge.heading) * along);
        box(.14, .95, .14, '#8d7757', crossing, x, top + .39, along);
        box(.23, .08, .23, '#b8a178', crossing, x, top + .91, along);
        box(.165,.09,.165,'#637465',crossing,x,top+.3,along);
      }
      const railPoints = [];
      for (let i = 0; i <= 16; i++) {
        const along = railStart+i/16*railSpan;
        const top = bridgeHeightAt(bridge.x + Math.sin(bridge.heading) * along, bridge.z + Math.cos(bridge.heading) * along);
        railPoints.push([x, top + .82, along]);
      }
      curveLine(railPoints, '#a18962', crossing, .065);
      curveLine(railPoints.map(([px, py, pz]) => [px, py - .4, pz]), '#9c835e', crossing, .035);
      for(let i=0;i<6;i++){
        const a=railStart+i/6*railSpan,b=a+railSpan/6;
        const height=along=>bridgeHeightAt(bridge.x+Math.sin(bridge.heading)*along,bridge.z+Math.cos(bridge.heading)*along);
        curveLine([[x,height(a)+.72,a],[x,height((a+b)/2)+.24,(a+b)/2],[x,height(b)+.72,b]],'#b5a17a',crossing,.022);
      }
    }
    // Lantern gates sit above the travel lane, with a sagging cable and tassels.
    for (const end of [-1, 1]) {
      const z=end*(bridge.length/2+.9);
      for (const x of [-bridge.width / 2, bridge.width / 2]) {
        box(.16, 4.15, .16, '#8f7855', crossing, x, 2.14, z);
        roof(.5, .5, .19, '#798767', crossing, x, 4.2, z);
      }
      curveLine([[-bridge.width / 2, 4.15, z], [0, 3.73, z], [bridge.width / 2, 4.15, z]], '#7f785c', crossing, .014);
      for (let i = 0; i < 5; i++) {
        const x = -1.5 + i * .75, y = 3.72 + .42 * (x / (bridge.width / 2)) ** 2;
        lantern(crossing, x, y - .12, z, i + (end + 1) * 3);
      }
    }
    if (bridge.id === 'village') {
      const light = new THREE.PointLight('#f7c27b', 0, 10, 2); light.position.set(0,3.6,0); crossing.add(light); lightObjects.push(light); lamps.push(light);
    }
  }

  // Roof tiles are instanced, giving the cottages detail without hundreds of draws.
  const roofTileGeometry = ownGeo(new THREE.BoxGeometry(1, 1, 1));
  const windowMaterials = [];
  houses.forEach((house, index) => {
    const home = group(root, house.x, house.z); home.name = `Riverside cottage ${index + 1}`;home.scale.setScalar(house.scale||1);
    home.userData.building=true;
    const wall = ownMat(house.color), timber = '#8f795b', roofColor = ['#a77e5e', '#899474', '#8b7772', '#7c8f82'][index];
    box(3.05, .22, 2.85, '#c8c5a5', home, 0, .16, 0);
    box(2.65, 2.2, 2.45, wall, home, 0, 1.35, 0);
    roof(2.67, 2.45, .96, house.color, home, 0, 2.45, 0);
    box(2.8, .16, 2.6, timber, home, 0, .44, 0);
    for (const x of [-1.28, 1.28]) box(.12, 2.2, .14, timber, home, x, 1.35, 1.24);
    box(2.7, .09, .09, timber, home, 0, 2.4, 1.26);
    beamBetween([-1.3, 2.42, 1.26], [0, 3.4, 1.26], .09, timber, home);
    beamBetween([0, 3.4, 1.26], [1.3, 2.42, 1.26], .09, timber, home);
    box(.09, .88, .09, timber, home, 0, 2.9, 1.27);
    const baseRoof = ownMat(roofColor);
    for (const side of [-1, 1]) {
      const panel = box(1.82, .13, 3.05, baseRoof, home, side * .72, 2.94, 0); panel.rotation.z = -side * .625;
      const snow = box(1.87, .035, 3.08, ownMat('#eff2e8', { transparent: true, opacity: 0, depthWrite: false }), home, side * .72, 3.035, 0);
      snow.rotation.z = -side * .625; snowLayers.push(snow);
    }
    const rows = coarse ? 3 : 4, columns = coarse ? 4 : 7;
    const tiles = new THREE.InstancedMesh(roofTileGeometry, ownMat('#ffffff'), rows * columns * 2);
    tiles.castShadow = true; tiles.receiveShadow = true; home.add(tiles); let tile = 0;
    for (const side of [-1, 1]) for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
      const x = side * (.18 + row / rows * 1.38);
      dummy.position.set(x, 3.47 - Math.abs(x) * .72 + .04, -1.38 + (column + .5) / columns * 2.76);
      dummy.rotation.set(0, 0, -side * .625); dummy.scale.set(1.65 / rows, .075, 2.92 / columns * .97); dummy.updateMatrix(); tiles.setMatrixAt(tile, dummy.matrix);
      scratch.set(roofColor).multiplyScalar(.9 + random() * .2); tiles.setColorAt(tile++, scratch);
    }
    cylinder(.075, .075, 3.16, timber, home, 0, 3.46, 0, 6).rotation.x = Math.PI / 2;
    const glass = ownMat('#899f8b', { emissive: '#f5cd82', emissiveIntensity: .04, roughness: .35 }); lamps.push(glass); windowMaterials.push(glass);
    box(.84, 1.01, .06, '#d6c8a2', home, -.66, 1.58, 1.25);
    box(.69, .87, .07, glass, home, -.66, 1.58, 1.3);
    box(.065, .89, .035, timber, home, -.66, 1.58, 1.35); box(.72, .06, .035, timber, home, -.66, 1.58, 1.35);
    for (const x of [-1.17, -.16]) {
      box(.27, .97, .08, '#7c9378', home, x, 1.58, 1.3);
      for (let i = 0; i < 4; i++) box(.23, .035, .025, '#b0b494', home, x, 1.27 + i * .19, 1.35);
    }
    box(.82, 1.77, .09, timber, home, .64, 1.2, 1.28);
    box(.64, 1.59, .11, '#c7b488', home, .64, 1.2, 1.34);
    box(.5, .4, .04, glass, home, .64, 1.62, 1.42);
    sphere(.045, '#8b7650', home, .85, 1.03, 1.43, 0);
    for (let i = 0; i < 3; i++) box(.52, .035, .03, timber, home, .64, .53 + i * .25, 1.41);
    // A little roof dormer, chimney masonry, porch, window box and side drain.
    box(.78, .62, .62, house.color, home, -.12, 3.15, .78);
    roof(.98, .86, .36, roofColor, home, -.12, 3.47, .79);
    box(.45, .45, .05, timber, home, -.12, 3.18, 1.105);
    box(.34, .34, .06, glass, home, -.12, 3.18, 1.14);
    box(.045, .34, .03, '#d2c6a2', home, -.12, 3.18, 1.18);
    box(.44, 1.1, .48, '#b7a18b', home, .83, 3.35, -.62);
    for (let i = 0; i < 4; i++) box(.46, .035, .5, '#8e806c', home, .83, 2.95 + i * .24, -.62);
    box(.6, .14, .63, '#8a816b', home, .83, 3.98, -.62); box(.31, .02, .34, '#5b6556', home, .83, 4.06, -.62);
    for (let i = 0; i < 3; i++) {
      const puff = sphere(.12 + i * .025, basic('#e4e6d8', { transparent: true, opacity: .35, depthWrite: false }), home, .83, 4.25 + i * .37, -.62, 1);
      smoke.push({ object: puff, origin: new THREE.Vector3(.83, 4.1, -.62), phase: i / 3, house: index });
    }
    for (let i = 0; i < 6; i++) box(2.6, .09, .2, '#b5a079', home, 0, .4, 1.4 + i * .18);
    for (const x of [-1.15, 1.15]) { box(.1, 1.9, .1, timber, home, x, 1.35, 2.2); box(.32, .08, .32, '#d6c5a0', home, x, 2.32, 2.2); }
    roof(2.85, 1.25, .25, '#a39776', home, 0, 2.33, 1.82);
    for (let i = 0; i < 3; i++) box(1.3 + i * .35, .1, .24, '#c0b28b', home, .45, .27 - i * .08, 2.45 + i * .2);
    box(.87, .3, .37, '#a18a65', home, -.66, 1.04, 1.48);
    for (let i = 0; i < 5; i++) sphere(.12, i % 2 ? '#d0b77a' : '#88a16f', home, -1 + i * .17, 1.24 + (i % 2) * .07, 1.5, 0);
    cylinder(.04, .04, 2.1, '#8e9c83', home, 1.36, 1.35, .7, 5);
    lantern(home, 1.08, 2.04, 1.67, index);
    colliders.push({ x: house.x, z:house.z+.72*(house.scale||1),width:3.2*(house.scale||1),depth:4.5*(house.scale||1), kind: 'house' });
  });

  // A few lush, drooping willows and slender birches distinguish the river banks.
  const leafGeometry = ownGeo(new THREE.IcosahedronGeometry(1, 0));
  const willowMaterial = ownMat('#90a974'), birchMaterial = ownMat('#b1bd85');
  const treeLocations=[[-7.5,-5.8,.95]];
  const willowLeaves = new THREE.InstancedMesh(leafGeometry, willowMaterial, treeLocations.length * (coarse?48:84)); willowLeaves.castShadow = true; willowLeaves.receiveShadow = true; root.add(willowLeaves);
  willowLeaves.userData.physicsIgnore = true;
  let leafIndex = 0;
  treeLocations.forEach(([x, z, authoredScale], index) => {
    const scale=authoredScale*1.8;
    const tree = group(root, x, z); tree.name = `River willow ${index + 1}`;
    const target={id:`willow-${index+1}`,kind:'tree',x,z,parts:[{object:tree}]};tree.userData.breakableId=target.id;tree.userData.breakableKind='tree';breakableTargets.push(target);
    const trunk = cylinder(.12 * scale, .23 * scale, 2.2 * scale, '#988565', tree, 0, 1.2 * scale, 0, 7); trunk.rotation.z = -.08;
    for (let branch = 0; branch < 3; branch++) {
      const angle = branch / 3 * Math.PI * 2 + index;
      beamBetween([0, 1.4 * scale, 0], [Math.cos(angle) * .9 * scale, 2.6 * scale, Math.sin(angle) * .9 * scale], .1 * scale, '#988565', tree);
    }
    for (let i = 0; i < (coarse?48:84); i++) {
      const angle = i * 2.39996, radius = .4+random()*.85;
      dummy.position.set(x + Math.cos(angle) * radius * scale, (1.85+random()*1.35-radius*.22) * scale, z + Math.sin(angle) * radius * scale);
      dummy.rotation.set(random(), angle, Math.sin(angle) * .4); dummy.scale.set(.2 * scale, (.23+random()*.18) * scale, .18 * scale); dummy.updateMatrix();target.parts.push({object:willowLeaves,index:leafIndex});willowLeaves.setMatrixAt(leafIndex++, dummy.matrix);
    }
  });
  const birches=[[-10,-24]];
  const birchLeaves = new THREE.InstancedMesh(leafGeometry, birchMaterial, birches.length * (coarse?30:54)); birchLeaves.castShadow = true; root.add(birchLeaves); leafIndex = 0;
  birchLeaves.userData.physicsIgnore = true;
  birches.forEach(([x, z], index) => {
    const tree=group(root,x,z),target={id:`birch-${index+1}`,kind:'tree',x,z,parts:[{object:tree}]};tree.userData.breakableId=target.id;tree.userData.breakableKind='tree';breakableTargets.push(target);
    cylinder(.15,.28,5.6,'#e6dfc6',tree,0,2.9,0,7);
    for (let i = 0; i < 7; i++) box(.12, .035, .035, '#938e75', tree, i % 2 ? -.04 : .04, .6 + i * .4, .115);
    for (let i = 0; i < (coarse?30:54); i++) {const a=i*2.4,r=.3+random()*.65; dummy.position.set(x + Math.sin(a) * r, 4.5 + random()*2.1, z + Math.cos(a) * r); dummy.rotation.set(random(), a + index, .2); dummy.scale.set(.34,.4+random()*.23,.31); dummy.updateMatrix();target.parts.push({object:birchLeaves,index:leafIndex});birchLeaves.setMatrixAt(leafIndex++, dummy.matrix); }
  });
  const pebbleLocations = [];
  for (let i = 0; i < 96; i++) {
    const x = -27 + random() * 54, bank = i % 2 ? -1 : 1;
    const z = riverCenter(x) + bank * (RIVER_HALF_WIDTH + .16 + random() * .24);
    if(noBridge(x,z,1)&&noProject(x,z,.3)&&drivingSurfaceAt(x,z)==='grass') pebbleLocations.push({ x, z, size: .18 + random() * .24 });
  }
  const pebbles = new THREE.InstancedMesh(ownGeo(new THREE.IcosahedronGeometry(1, 0)), ownMat('#afb9a3'), pebbleLocations.length); pebbles.castShadow = true; pebbles.receiveShadow = true; root.add(pebbles);
  pebbleLocations.forEach((pebble, i) => { dummy.position.set(pebble.x, .14, pebble.z); dummy.rotation.set(random(), random() * 3, random()); dummy.scale.set(pebble.size * 1.4, pebble.size * .6, pebble.size); dummy.updateMatrix(); pebbles.setMatrixAt(i, dummy.matrix); scratch.set(i % 3 ? '#b0bba8' : '#c5c7ae'); pebbles.setColorAt(i, scratch); });
  const reedsGeometry = ownGeo(new THREE.CylinderGeometry(.012, .02, 1, 4));
  const reedPositions = pebbleLocations.filter((_, i) => i % 3 === 0);
  const reeds = new THREE.InstancedMesh(reedsGeometry, ownMat('#9da579'), reedPositions.length * 3); root.add(reeds);
  reedPositions.forEach((position, i) => { for (let j = 0; j < 3; j++) { dummy.position.set(position.x + (j - 1) * .07, .35 + j * .04, position.z); dummy.rotation.set(.15 * Math.sin(i), 0, (j - 1) * .14); dummy.scale.set(1, .4 + j * .1, 1); dummy.updateMatrix(); reeds.setMatrixAt(i * 3 + j, dummy.matrix); } });
  [[-35,-1,.88],[35,-4,1],[-18,29,.77],[25,35,.93]].forEach(([x, z, size], index) => {
    const stone = sphere(size, ['#a8ad97', '#b1b5a0', '#9fae9a', '#bcbda4'][index], root, x, size * .35, z, 1); stone.scale.set(1.2, .75, .92); stone.rotation.y = index * .7;
    const moss = sphere(size * .6, '#90a072', root, x - .12, size * .77, z + .03, 0); moss.scale.set(1.2, .17, .8);
    colliders.push({ x, z, width: size * 2.2, depth: size * 1.8, kind: 'rock' });
  });

  // A riverside handcart, sacks and tool racks give the props a place to belong.
  const cart = group(root,LANDMARKS.cart.x,LANDMARKS.cart.z); cart.rotation.y = Math.PI - .2;
  cart.userData.breakableId='riverside-cart';cart.userData.breakableKind='cart';
  box(1.5, .13, .95, '#aa8b5f', cart, 0, .55, 0);
  for (const x of [-.7, .7]) {
    box(.1, .5, 1, '#b79b6c', cart, x, .85, 0);
    const wheel = cylinder(.32, .32, .1, '#776c50', cart, x * 1.16, .37, 0, 12); wheel.rotation.z = Math.PI / 2;
    const hub = cylinder(.09, .09, .13, '#c4ae7d', cart, x * 1.18, .37, 0, 8); hub.rotation.z = Math.PI / 2;
  }
  for (const z of [-.46, .46]) box(1.4, .5, .1, '#b79b6c', cart, 0, .85, z);
  for (const x of [-.45, .45]) box(.07, .07, 1.7, '#9a825c', cart, x, .5, 1.1);
  for (let i = 0; i < 3; i++) { const sack = sphere(.3, '#c7b88e', cart, -.4 + i * .38, .92, 0, 1); sack.scale.set(.7, 1.2, .8); }
  colliders.push({ x:LANDMARKS.cart.x,z:LANDMARKS.cart.z, width: 1.8, depth: 1.2, kind: 'cart',active:()=>cart.visible });

  function crate(id, x, z, size = .85) {
    const object = group(root, x, z); object.position.y = .12 + size / 2; object.userData.propId = id; object.name = `Pushable ${id}`;
    box(size, size, size, '#bb9b6a', object);
    for (const axis of [-1, 1]) {
      box(size + .04, .09, .07, '#8e7955', object, 0, axis * size * .35, size / 2 + .025);
      box(.07, size + .03, size + .05, '#a18a60', object, axis * size * .36, 0, 0);
    }
    const brace = box(.08, size * 1.2, .06, '#d2b37c', object, 0, 0, size / 2 + .07); brace.rotation.z = -.7;
    bodies.push({ id, object, x, z, y: object.position.y, radius: size * .66, mass: 1.5, height: size, kind: 'crate' });
  }
  function barrel(id, x, z) {
    const height = .86, object = group(root, x, z); object.position.y = .12 + height / 2; object.userData.propId = id; object.name = `Pushable ${id}`;
    cylinder(.33, .34, height, '#a18b61', object, 0, 0, 0, 12);
    cylinder(.37, .37, .1, '#798678', object, 0, -.25, 0, 12); cylinder(.37, .37, .1, '#798678', object, 0, .25, 0, 12);
    cylinder(.32, .32, .035, '#c3ab77', object, 0, .45, 0, 12);
    cylinder(.06, .06, .04, '#85785b', object, .1, .475, .07, 7);
    bodies.push({ id, object, x, z, y: object.position.y, radius: .38, mass: 1.1, height, kind: 'barrel' });
  }
  function ball(id, x, z) {
    const object = group(root, x, z); object.position.y = .54; object.userData.propId = id; object.name = `Pushable ${id}`;
    sphere(.42, '#a9b2a1', object, 0, 0, 0, 1);
    bodies.push({ id, object, x, z, y: object.position.y, radius: .42, mass: 2.1, height: .84, kind: 'stone' });
  }
  [[-14.6, -2.9], [8.7, -11.3], [9.8, -11], [-9, 14.3], [-10, 14.5]].forEach(([x, z], i) => crate(`crate-${i + 1}`, x, z, i % 2 ? .76 : .88));
  [[-4, 14.8], [-6, 14.9], [15.8, 10.5], [-18, -8.7]].forEach(([x, z], i) => barrel(`barrel-${i + 1}`, x, z));
  ball('stone-1', 17, -1.9); ball('stone-2', -16, -1.9);

  // Linked gateways have a physical silhouette, luminous inner edge and vortex.
  const portalRingGeometry = ownGeo(new THREE.TorusGeometry(1.48, .17, 7, 32));
  const glowRingGeometry = ownGeo(new THREE.TorusGeometry(1.24, .035, 5, 48));
  portals.forEach((portal, index) => {
    const gate = group(root, portal.x, portal.z); gate.rotation.y = portal.heading;
    gate.userData.portalId = portal.id; gate.name = `Portal ${portal.id}`; portalGroups.push(gate);
    gate.userData.breakableId=portal.id;gate.userData.breakableKind='portal';
    cylinder(1.9, 2.04, .16, '#acb39b', gate, 0, .12, 0, 16);
    const floorRing = mesh(ownGeo(new THREE.TorusGeometry(1.72, .03, 4, 48)), basic(portal.color, { transparent: true, opacity: .7, toneMapped: false }), gate, 0, .22, 0, false); floorRing.rotation.x = -Math.PI / 2;
    const frame = mesh(portalRingGeometry, '#a4ac98', gate, 0, 1.65, 0); frame.scale.y = 1.07;
    for (let i = 0; i < 13; i++) {
      const angle = i / 12 * Math.PI * 2, stone = box(.32, .41, .43, i % 2 ? '#bbc0a8' : '#8d9f91', gate, Math.cos(angle) * 1.48, 1.65 + Math.sin(angle) * 1.58, 0);
      stone.rotation.z = angle - Math.PI / 2;
    }
    for (const x of [-1.4, 1.4]) { box(.5, .3, .7, '#a3ab93', gate, x, .29, 0); sphere(.12, portal.color, gate, x, .53, .25, 0); }
    const glowMaterial = basic(portal.color, { toneMapped: false, transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false });
    const rim = mesh(glowRingGeometry, glowMaterial, gate, 0, 1.65, .08, false); rim.scale.y = 1.07;
    const membraneMaterial = basic(portal.color, { toneMapped: false, transparent: true, opacity: .15, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false });
    const membrane = mesh(ownGeo(new THREE.CircleGeometry(1.2, 48)), membraneMaterial, gate, 0, 1.65, 0, false); membrane.scale.y = 1.07;
    const vortex = group(gate); vortex.position.set(0, 1.65, .02);
    const spirals = [];
    for (let arm = 0; arm < 3; arm++) {
      const points = [];
      for (let i = 0; i < 44; i++) { const t = i / 43, angle = t * Math.PI * 2.15 + arm * Math.PI * 2 / 3, radius = .08 + t * 1.1; points.push(new THREE.Vector3(Math.cos(angle) * radius, Math.sin(angle) * radius * 1.07, 0)); }
      const material = new THREE.LineBasicMaterial({ color: portal.color, transparent: true, opacity: .35, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }); ownedMaterials.add(material);
      const line = new THREE.Line(ownGeo(new THREE.BufferGeometry().setFromPoints(points)), material); vortex.add(line); spirals.push(line);
    }
    const particleCount = coarse ? 22 : 44, particles = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      const angle = i * 2.399, radius = .3 + i / particleCount * 1.1;
      particles.set([Math.cos(angle) * radius, Math.sin(angle) * radius * 1.07, .04], i * 3);
    }
    const geometry = ownGeo(new THREE.BufferGeometry()); geometry.setAttribute('position', new THREE.BufferAttribute(particles, 3));
    const material = new THREE.PointsMaterial({ color: portal.color, size: 2.2, sizeAttenuation: false, transparent: true, opacity: .8, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }); ownedMaterials.add(material);
    const sparks = new THREE.Points(geometry, material); sparks.position.y = 1.65; gate.add(sparks);
    const light = new THREE.PointLight(portal.color, .3, 7, 2); light.position.set(0, 1.7, .5); gate.add(light); lamps.push(light); lightObjects.push(light);
    portalEffects.push({ gate, vortex, rim, membrane, sparks, particles, particleCount, phase: index * 2.3, light });
  });

  // Repeated static timber, trim and stone become instanced batches. Animated
  // lanterns, physics props, snow covers and the sampled bridge deck stay local.
  const movingRoots = new Set([...swaying.map(item => item.object), ...smoke.map(item => item.object), ...bodies.map(body => body.object), ...snowLayers]);
  root.updateMatrixWorld(true);
  const inverseRoot = root.matrixWorld.clone().invert(), batches = new Map();
  root.traverse(object => {
    if (!object.isMesh || object.isInstancedMesh || object.userData.bridgeDeck || object.material.transparent || !['BoxGeometry', 'CylinderGeometry'].includes(object.geometry.type)) return;
    for (let ancestor = object; ancestor && ancestor !== root; ancestor = ancestor.parent) if (movingRoots.has(ancestor)) return;
    let owner=root;for(let ancestor=object.parent;ancestor&&ancestor!==root;ancestor=ancestor.parent)if(ancestor.userData.building||ancestor.userData.breakableId){owner=ancestor;break;}
    const key = owner.uuid+object.geometry.type + JSON.stringify(object.geometry.parameters) + object.material.uuid + object.castShadow;
    if (!batches.has(key)) batches.set(key, {owner,objects:[]}); batches.get(key).objects.push(object);
  });
  let staticBatches = 0, batchedObjects = 0;
  for (const {owner,objects} of batches.values()) {
    if (objects.length < 3) continue;
    const batch = new THREE.InstancedMesh(objects[0].geometry, objects[0].material, objects.length);
    batch.castShadow = objects[0].castShadow; batch.receiveShadow = true; batch.name = 'Batched village details';
    const inverse=owner===root?inverseRoot:owner.matrixWorld.clone().invert();
    objects.forEach((object, i) => { batch.setMatrixAt(i, new THREE.Matrix4().multiplyMatrices(inverse, object.matrixWorld)); object.removeFromParent(); });
    owner.add(batch); staticBatches++; batchedObjects += objects.length;
  }

  const baseWillow = new THREE.Color('#90a974'), baseBirch = new THREE.Color('#b1bd85'), snowColor = new THREE.Color('#e7ece0');
  function update(dt,time,{night=0,daylight=1-night,weather='clear',driver,sunAngle=0,sunHeight=1}={}) {
    const darkness = typeof night === 'boolean' ? Number(night) : THREE.MathUtils.clamp(night, 0, 1);
    snowCover += ((weather === 'snow' ? 1 : 0) - snowCover) * Math.min(1, dt * .45);
    snowLayers.forEach(layer => { layer.visible = snowCover > .01; layer.material.opacity = snowCover * .9; });
    willowMaterial.color.copy(baseWillow).lerp(snowColor, snowCover * .42); birchMaterial.color.copy(baseBirch).lerp(snowColor, snowCover * .5);
    stream.update(dt,{night,weather,driver,daylight,sunAngle,sunHeight});
    for (const material of lanternMaterials) material.emissiveIntensity = .12 + darkness * 1.65;
    windowMaterials.forEach(material => { material.emissiveIntensity = .025 + darkness * 1.3; });
    lightObjects.forEach(light => { light.intensity = light.color.getHex() === 0xf7c27b ? darkness * 1.4 : .3 + darkness * .8; });
    if (reducedMotion) return;
    tick = time;
    swaying.forEach(({ object, phase, amplitude }) => { object.rotation.z = Math.sin(time * .8 + phase) * amplitude * (weather === 'rain' ? 1.7 : 1); });
    smoke.forEach(puff => {
      const age = (time * .22 + puff.phase) % 1;
      puff.object.position.copy(puff.origin); puff.object.position.x += age * .4 + Math.sin(time * .5 + puff.house) * .06;
      puff.object.position.y += age * 1.4; puff.object.position.z += age * .2;
      puff.object.scale.setScalar(.7 + age * 1.2); puff.object.material.opacity = (1 - age) * .32;
    });
    portalEffects.forEach(effect => {
      effect.vortex.rotation.z = time * .32 + effect.phase;
      effect.rim.material.opacity = .75 + Math.sin(time * 2.1 + effect.phase) * .17;
      effect.membrane.material.opacity = .13 + Math.sin(time * 1.4 + effect.phase) * .035;
      for (let i = 0; i < effect.particleCount; i++) {
        const t = (i / effect.particleCount + time * .08) % 1, angle = i * 2.399 + time * .65, radius = .3 + t * 1.1, at = i * 3;
        effect.particles[at] = Math.cos(angle) * radius; effect.particles[at + 1] = Math.sin(angle) * radius * 1.07; effect.particles[at + 2] = Math.sin(t * Math.PI) * .15;
      }
      effect.sparks.geometry.attributes.position.needsUpdate = true;
    });
  }
  update(0, 0);
  return {
    root, colliders, bodies, lamps, portalGroups,bridgeGroups,breakableTargets, stats: { staticBatches, batchedObjects },
    update,
    reset() { stream.reset();tick = 0; swaying.forEach(item => { item.object.rotation.z = 0; }); portalEffects.forEach(effect => { effect.vortex.rotation.z = effect.phase; }); },
    dispose() { stream.dispose();root.removeFromParent(); ownedGeometries.forEach(geometry => geometry.dispose()); ownedMaterials.forEach(material => material.dispose()); }
  };
}
