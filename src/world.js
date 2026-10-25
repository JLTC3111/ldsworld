import { vehicleModel } from './vehicle-models.js';
import { mapLocations } from './locations.js';
import * as THREE from './vendor/three.module.js';
import { projects, copy } from './data.js';
import { Driver, roadLoop, outerRoadLoop, roadNodes, connectorPaths, drivingSurfaceAt } from './driving.js';
import { bindNavigation } from './controls.js';
import { createPlayground,reservesPlaygroundSpace,PLAYGROUND_APPROACHES } from './playground.js';
import { createBlastDamage, treeBlastTargets } from './blast-damage.js';
import { collectBreakableTargets,breakProfile } from './breakables.js';
import { createProjectLabels } from './project-labels.js';
import { ROAD_COLOR,ROAD_SHOULDER_COLOR,createRoadCurve,createRoadGeometry } from './road-style.js';
import { createIslandBoundary } from './island-boundary.js';
import { createWayfinding } from './wayfinding.js';
import { createNightFires } from './night-fires.js';
import { createScenery } from './scenery.js';
import { createAtmosphere } from './atmosphere.js';
import { createFlyover } from './flyover.js';
import { createIslandLife, reservesIslandLifeSpace } from './island-life.js';
import { createTreeDetails } from './tree-details.js';
import { PhysicsWorld, PortalSystem } from './physics.js';
import { collectWorldColliders, createDynamicBody, createInstancedBodies, syncPhysicsBodies } from './world-physics.js';
import { createVehicle } from './vehicle.js';
import { bridges, bridgeHeightAt, isRiver, houses, portals, ROAD_WIDTHS, WORLD_SCALE, ISLAND_BOUNDS, islandRadius, LANDMARKS, isWater, MAP_BOUNDS } from './world-layout.js';
import { islandFrame, constrainIslandFocus, keepVehicleVisible, clampZoom } from './camera-framing.js';

const colors = { grass: '#b7c49c', sand: '#e0d3b0', road: ROAD_COLOR, sea: '#e2e8dc', cream: '#eae4cb', dark: '#3d5146', leaf: '#7a9365', pine: '#698264', trunk: '#94785a', glass: '#8da9a1', yellow: '#d8b45d' };
const rand = (() => { let seed = 8137; return () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; })();

export function createWorld({ container, onStart, onProject, onArrival, onCancelRoute, onNearby, onFrame, onPortal, onEnvironment, onExplosion, onImpact, carModel='8-ball', reducedMotion = false }) {
  const coarse = matchMedia('(pointer: coarse)').matches;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, coarse ? 1.5 : 1.8));
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.domElement.id = 'island-canvas';
  renderer.domElement.tabIndex = 0;
  renderer.domElement.setAttribute('aria-label', 'Drive with WASD or arrow keys. Click the ground to move, a building to open a project, or a loose object to nudge it.');
  renderer.domElement.setAttribute('aria-describedby', 'drive-instructions');
  container.prepend(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(colors.sea);
  scene.fog = new THREE.Fog(colors.sea, 130, 260);
  const camera = new THREE.OrthographicCamera(-40, 40, 25, -25, .1, 350);
  const cameraOffset = new THREE.Vector3(48, 58, 62);
  const cameraDistance = cameraOffset.length();
  const defaultYaw = Math.atan2(cameraOffset.x, cameraOffset.z);
  const defaultPitch = Math.atan2(cameraOffset.y, Math.hypot(cameraOffset.x, cameraOffset.z));
  let orbitYaw = defaultYaw, orbitPitch = defaultPitch, zoomScale = 1;
  const panOffset = new THREE.Vector3();
  const lookAt = new THREE.Vector3(-9, 0, -3);
  let viewHeight = 47, exploring = false, night = false, paused = false, wasVisible = true;
  let animationId, lastTime = performance.now(), nearestId = null, updateFrame = 0;
  let language = 'en', smoothedSpeed = 0, headlightsMode = 'auto', winterAmount = 0;
  const hemisphere = new THREE.HemisphereLight('#fff8e8', '#94a184', 1.8);
  scene.add(hemisphere);
  const sun = new THREE.DirectionalLight('#fff4da', 2.3);
  sun.position.set(-26, 48, 24);
  sun.castShadow = true;
  sun.shadow.mapSize.set(coarse ? 1024 : 2048, coarse ? 1024 : 2048);
  Object.assign(sun.shadow.camera, { left: -43, right: 43, top: 40, bottom: -38, near: 1, far: 120 });
  sun.shadow.normalBias = .035;
  sun.shadow.bias = -.00015;
  sun.shadow.radius = 3;
  scene.add(sun,sun.target);
  const fill = new THREE.DirectionalLight('#d3e3df', .6);
  fill.position.set(30, 20, -30); scene.add(fill);
  const materials = new Map();
  function mat(color, options = {}) {
    const key = color + JSON.stringify(options);
    if (!materials.has(key)) materials.set(key, new THREE.MeshStandardMaterial({ color, roughness: .9, metalness: 0, ...options }));
    return materials.get(key);
  }
  const meshes = [];
  const translatedBoards = [];
  function mesh(geometry, material, parent, x = 0, y = 0, z = 0, cast = true) {
    const object = new THREE.Mesh(geometry, typeof material === 'string' ? mat(material) : material);
    object.position.set(x, y, z); object.castShadow = cast; object.receiveShadow = true;
    parent.add(object); meshes.push(object); return object;
  }
  const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  function box(w, h, d, color, parent, x = 0, y = 0, z = 0, cast = true) {
    const object = mesh(boxGeometry, color, parent, x, y, z, cast); object.scale.set(w, h, d); return object;
  }
  function cylinder(rt, rb, h, color, parent, x = 0, y = 0, z = 0, segments = 12) {
    return mesh(new THREE.CylinderGeometry(rt, rb, h, segments), color, parent, x, y, z);
  }
  function sphere(radius, color, parent, x, y, z, detail = 1) {
    return mesh(new THREE.IcosahedronGeometry(radius, detail), color, parent, x, y, z);
  }
  function group(parent, x = 0, z = 0) { const g = new THREE.Group(); g.position.set(x, 0, z); parent.add(g); return g; }
  function board(text, w, h, color, textColor, parent, x, y, z, fontSize = 70, translationKey = null) {
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = Math.max(96, Math.round(512 * h / w));
    const ctx = canvas.getContext('2d');
    const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
    const draw = value => {
      ctx.fillStyle = color; ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#354a36'; ctx.font = `600 ${fontSize}px Arial, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const lines = value.split('\n');
      lines.forEach((line, i) => ctx.fillText(line, 256, canvas.height / 2 + (i - (lines.length - 1) / 2) * fontSize * 1.2, 470));
      texture.needsUpdate = true;
    };
    draw(translationKey ? copy[language][translationKey] : text);
    if (translationKey) translatedBoards.push({ key: translationKey, draw });
    return mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: texture, toneMapped: false, side: THREE.DoubleSide }), parent, x, y, z, false);
  }
  function gable(w, d, h, color, parent, x, y, z) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([
      -w/2,0,d/2, w/2,0,d/2, 0,h,d/2,
      -w/2,0,-d/2, 0,h,-d/2, w/2,0,-d/2,
      -w/2,0,-d/2,-w/2,0,d/2,0,h,d/2, 0,h,-d/2,
      0,h,-d/2,0,h,d/2,w/2,0,d/2,w/2,0,-d/2,
      -w/2,0,-d/2,w/2,0,-d/2,w/2,0,d/2,-w/2,0,d/2
    ],3));
    geo.setIndex([0,1,2,3,4,5,6,7,8,6,8,9,10,11,12,10,12,13,14,15,16,14,16,17]);
    geo.computeVertexNormals(); return mesh(geo, color, parent, x, y, z);
  }
  function windowPane(parent, x, y, z, w = 1, h = 1) {
    box(w + .12, h + .12, .06, colors.cream, parent, x, y, z);
    box(w, h, .07, colors.glass, parent, x, y, z + .045);
    box(.045, h, .02, '#cdd2bc', parent, x, y, z + .09, false);
  }
  function planter(parent, x, z, scale = 1) {
    const pot = group(parent, x, z);pot.scale.setScalar(1/(parent.userData.buildingScale||1)); pot.name = 'Movable planter'; pot.userData.physicsKind = 'planter';
    cylinder(.36 * scale, .27 * scale, .5 * scale, '#b59272', pot, 0, .28 * scale, 0, 8);
    const plant = sphere(.48 * scale, '#819263', pot, 0, .7 * scale, 0, 0); plant.scale.set(1, 1.1, 1);
    return pot;
  }
  function bench(parent, x, z, angle = 0) {
    const b = group(parent, x, z);b.scale.setScalar(1/(parent.userData.buildingScale||1)); b.rotation.y = angle; b.name = 'Movable bench'; b.userData.physicsKind = 'bench';
    box(1.7, .14, .55, '#ab8e65', b, 0, .6, 0);
    box(1.7, .5, .1, '#ab8e65', b, 0, .95, -.23);
    [-.6, .6].forEach(px => box(.09, .6, .45, '#596b57', b, px, .3, 0));
    return b;
  }

  // A beveled, hand-shaped island, with its own shoreline and sandy sides.
  const land = group(scene);
  const islandShape = new THREE.Shape();
  islandShape.moveTo(-28, 0); islandShape.bezierCurveTo(-30, -13, -19, -22, -8, -22);
  islandShape.bezierCurveTo(7, -24, 22, -21, 27, -11);
  islandShape.bezierCurveTo(32, -1, 29, 12, 22, 17);
  islandShape.bezierCurveTo(12, 24, -6, 25, -19, 19);
  islandShape.bezierCurveTo(-27, 15, -30, 7, -28, 0);
  const shoreGeo = new THREE.ExtrudeGeometry(islandShape, { depth: 1.15, bevelEnabled: true, bevelSegments: 2, steps: 1, bevelSize: .4, bevelThickness: .3, curveSegments: 14 });
  const island = mesh(shoreGeo, [mat(colors.grass), mat(colors.sand)], land, 0, -1.5, 0);
  island.rotation.x = -Math.PI / 2; island.scale.set(WORLD_SCALE,WORLD_SCALE,1); island.name='Expanded island terrain';
  const sea = mesh(new THREE.PlaneGeometry(MAP_BOUNDS.x*4,MAP_BOUNDS.z*4), mat(colors.sea), scene, 0, -1.5, 0, false); sea.rotation.x = -Math.PI / 2;
  const atmosphere = createAtmosphere({ THREE, scene, renderer, sun, hemisphere, fill, sea, coarse, reducedMotion });
  const flyover = createFlyover({ THREE, scene, reducedMotion, coarse });
  let environment = atmosphere.getState();
  const summerGrass = new THREE.Color(colors.grass), snowGrass = new THREE.Color('#dce6dc');
  const shoreLine = new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(islandShape.getPoints(160).map(p => new THREE.Vector3(p.x * 1.025*WORLD_SCALE, -1.12, -p.y * 1.025*WORLD_SCALE))), new THREE.LineBasicMaterial({ color: '#eaf0e2', transparent: true, opacity: .8 }));
  scene.add(shoreLine);

  const roadMaterial=mat(ROAD_COLOR,{roughness:.92,side:THREE.DoubleSide});
  const roadSurfaces=[];
  function road(points, width, closed = false, color = colors.road, height = .1) {
    const curve=createRoadCurve(points,closed,height);
    const geometry=createRoadGeometry({THREE,curve,width,height});
    const surface = mesh(geometry,color===colors.road?roadMaterial:mat(color, { side: THREE.DoubleSide }), land, 0, color===colors.road?roadSurfaces.length*.0007:0, 0, false);surface.name=color===colors.road?'Pale island road':'Soft road shoulder';
    if(color===colors.road)roadSurfaces.push({curve,width});
    surface.userData.roadWidth=width;
    return { curve, surface };
  }
  road(roadLoop, ROAD_WIDTHS.shoulder, true, ROAD_SHOULDER_COLOR, .055);
  const loopRoad=road(roadLoop, ROAD_WIDTHS.ring, true);
  road(outerRoadLoop,ROAD_WIDTHS.shoulder,true,ROAD_SHOULDER_COLOR,.055);
  road(outerRoadLoop,ROAD_WIDTHS.ring,true);
  for(const path of connectorPaths)road(path.map(key=>roadNodes[key]),ROAD_WIDTHS.spine);
  road([roadNodes.r2, [-.75, -9], [-.75, -6.8], [0, -3], roadNodes.c0, [0, 6], roadNodes.r8], ROAD_WIDTHS.spine, false);
  road([roadNodes.r11, [-10, 0], roadNodes.c0, [10, 0], roadNodes.r5], ROAD_WIDTHS.spine, false);
  for(let i=0;i<68;i++){
    const point=loopRoad.curve.getPointAt(i/68),tangent=loopRoad.curve.getTangentAt(i/68);if(isRiver(point.x,point.z,.5))continue;
    const dash=box(.055,.012,.48,'#c1c7ac',land,point.x,.12,point.z,false);dash.name='Quiet road centre marking';dash.userData.physicsIgnore=true;dash.rotation.y=Math.atan2(tangent.x,tangent.z);
  }
  const welcome = board('TAKE THE\nSCENIC ROUTE', 5.2, 2.1, colors.grass, '#a1ad86', land, 4, .06, 17, 55, 'scenicSign'); welcome.rotation.x = -Math.PI / 2;
  const homeLine = box(3.2, .018, .15, '#ecebd4', land, 0, .13, 12.6, false);
  const startChecks = group(land, 0, 12.8);
  for (let r = 0; r < 2; r++) for (let c = 0; c < 8; c++) if ((r + c) % 2 === 0) box(.3, .015, .3, '#b4bea0', startChecks, -.95 + c * .3, .125, -.15 + r * .3, false);

  // Buildings deliberately echo each project's purpose rather than copying a template.
  const landmarkGroups = [];
  const lanterns = [], animatedObjects = [], lamps = [];
  function projectGroup(project) {
    const p = group(land, ...project.position); p.userData.projectId = project.id;p.userData.buildingScale=project.scale||1;p.scale.setScalar(project.scale||1);p.rotation.y=project.rotation||0; landmarkGroups.push(p);
    box(project.baseFootprint[0] + 1.1, .16, project.baseFootprint[1] + 1.1, '#ddd8bc', p, 0, .14, 0);
    return p;
  }
  function buildHR(project) {
    const p = projectGroup(project);
    box(5.2, 1.85, 3.6, '#dfd0b6', p, 0, 1.12, 0);
    box(5.7, .24, 4, '#c98068', p, 0, 2.16, 0);
    box(3.55, 1.55, 2.8, '#cf8d74', p, -.55, 3.04, -.2);
    box(3.9, .24, 3.1, '#eadcc3', p, -.55, 3.94, -.2);
    windowPane(p, -1.1, 1.2, 1.83, 2.25, 1.05); windowPane(p, -.6, 3.05, 1.23, 2.4, .82);
    box(.9, 1.65, .08, '#688d81', p, 1.5, .99, 1.85);
    box(.08, .2, .07, '#dfd0b6', p, 1.75, 1, 1.94);
    board('HR', 1.1, .75, '#e8d8bb', '#94735c', p, 1.8, 3.05, 1.81, 150);
    for (let i = 0; i < 7; i++) box(.72, .07, .85, i % 2 ? '#e9d6bb' : '#c88569', p, -2.15 + i * .72, 2.16, 2.12);
    box(.08, 1.85, .08, '#bc9d78', p, -2.5, 1.1, 2.4); box(.08, 1.85, .08, '#bc9d78', p, 2.5, 1.1, 2.4);
    planter(p, -2.95, 1.5, .85); planter(p, 2.9, -1.2, .9);
    bench(p, -1.6, 3, Math.PI);
    box(1.2, .4, .9, '#ddd3b3', p, 1, .3, 2.25);
  }
  function buildCrypto(project) {
    const p = projectGroup(project);
    cylinder(2.15, 2.35, .3, '#d7cba8', p, 0, .35, 0);
    cylinder(1.8, 1.95, 2.5, '#e2d6b2', p, 0, 1.75, 0, 10);
    cylinder(1.93, 1.93, .4, '#be9d5e', p, 0, 3.1, 0, 10);
    cylinder(1.7, 1.7, .9, '#87a39a', p, 0, 3.72, 0, 10);
    cylinder(2.05, 2.05, .2, '#ddd2ad', p, 0, 4.25, 0, 10);
    sphere(1.8, '#cfb36d', p, 0, 4.4, 0, 1);
    const ring = mesh(new THREE.TorusGeometry(2, .055, 6, 48), '#a18c55', p, 0, 4.5, 0); ring.rotation.x = Math.PI / 2.5; ring.rotation.y = -.3;
    cylinder(.04, .04, .9, '#99885b', p, 0, 6.13, 0, 5);
    const coin = cylinder(.43, .43, .13, '#e7c570', p, 0, 6.7, 0, 16); coin.rotation.z = Math.PI / 2; animatedObjects.push({ object: coin, type: 'coin' });
    const bars = [1.1, 1.65, 1.35, 2.15];
    bars.forEach((height, i) => box(.48, height, .45, ['#b7b77d', '#d6ba71', '#9ca982', '#b29359'][i], p, -1.08 + i * .7, .3 + height / 2, 1.68));
    board('DATA LAB', 2.5, .48, '#e7dbb5', '#8b835e', p, 0, 2.65, 1.87, 65, 'dataSign');
    planter(p, 2.65, -.6, .85);
  }
  function buildContracts(project) {
    const p = projectGroup(project);
    box(4.4, 2.8, 3.3, '#a6a0b1', p, 0, 1.65, 0);
    box(.5, 2.8, 3.4, '#85829c', p, -1.75, 1.65, 0);
    windowPane(p, .5, 1.55, 1.68, 1.8, 1.5);
    box(.75, 1.7, .08, '#747e89', p, -1.45, 1.12, 1.72);
    for (let i = 0; i < 3; i++) { const paper = box(4.8, .26, 3.65, i === 1 ? '#cbc5d0' : '#ece4cc', p, .07 * i, 3.2 + .3 * i, 0); paper.rotation.y = (i - 1) * .035; }
    const book = box(2.6, .3, 1.8, '#afa5b6', p, -.2, 4.3, 0); book.rotation.y = -.15;
    box(.11, 1.85, .09, '#d8c589', p, 1.65, 2.2, 1.73);
    board('CONTRACTS', 2.8, .52, '#e6e1cf', '#777888', p, .45, 2.7, 1.75, 61, 'contractsSign');
    planter(p, -2.9, 1.9, .85); planter(p, 2.9, -1.3, .8);
    box(1.4, .2, .9, '#cec9b7', p, -.9, .27, 2.1);
  }
  function buildCompressor(project) {
    const p = projectGroup(project);
    box(4.2, 2.45, 3.3, '#9ab7b3', p, 0, 1.45, 0);
    box(4.65, .24, 3.7, '#d9ddc9', p, 0, 2.83, 0);
    windowPane(p, -.95, 1.5, 1.68, 1.3, 1.2);
    box(1.1, 1.9, .08, '#759895', p, 1.15, 1.14, 1.7);
    for (let i = 0; i < 4; i++) box(.85, .035, .08, '#a5c0b8', p, 1.15, .6 + i * .35, 1.76);
    box(2.15, 1.65, 1.65, '#cba76b', p, 0, 3.84, 0);
    box(2.28, .18, 1.78, '#d4ba87', p, 0, 4.76, 0);
    box(.27, 1.7, .035, '#8a7962', p, 0, 3.86, .84);
    for (let i = 0; i < 7; i++) box(.35, .055, .045, '#ead9b3', p, i % 2 ? -.03 : .03, 3.15 + i * .21, .87);
    const handle = mesh(new THREE.TorusGeometry(.28, .07, 6, 16, Math.PI), '#9d835b', p, 0, 4.9, 0); handle.rotation.z = 0;
    board('SMALLER IS BETTER', 3.2, .42, '#e0e1c8', '#6e938b', p, 0, 2.44, 1.7, 40, 'compressorSign');
    const crate = box(.9, .8, .85, '#d3b07a', p, -2.8, .6, .9); crate.rotation.y = .15;
    box(.9, .1, .9, '#b39467', p, -2.8, 1.05, .9);
    planter(p, 2.6, -1.4, .9);
  }
  function buildCeremony(project) {
    const p = projectGroup(project);
    box(6, .27, 4, '#d5caa4', p, 0, .35, 0);
    box(5.4, 2.5, 3.1, '#d6b16b', p, 0, 1.72, -.2);
    box(1.2, 1.95, .09, '#617d6d', p, 0, 1.42, 1.4);
    windowPane(p, -1.7, 1.6, 1.4, .9, 1.2); windowPane(p, 1.7, 1.6, 1.4, .9, 1.2);
    box(6.3, .18, 4, '#a26c4f', p, 0, 3.03, -.15);
    gable(6.1, 3.9, 1.4, '#ad7758', p, 0, 3.12, -.15);
    box(.13, .13, 4.1, '#c2996d', p, 0, 4.5, -.15);
    [-2.6, 2.6].forEach(px => box(.14, 2.7, .14, '#a78f60', p, px, 1.72, 1.65));
    board('HỘI AN', 2.25, .58, '#e1bf7a', '#775c42', p, 0, 2.6, 1.44, 90);
    for (let i = 0; i < 5; i++) {
      const x = -2.4 + i * 1.2;
      box(.025, .6, .025, '#9b8060', p, x, 2.8, 1.95, false);
      const lantern = sphere(.22, i % 2 ? '#d4a35b' : '#c5845d', p, x, 2.3, 1.95, 1); lantern.scale.y = 1.25; lanterns.push(lantern);
      cylinder(.1, .1, .08, '#ad8051', p, x, 2.02, 1.95, 6);
    }
    planter(p, -3.4, 1.5, .9); planter(p, 3.4, 1.5, .9);
    box(2.2, .2, 1, '#d2c4a0', p, 0, .23, 2.2);
  }
  function buildICUE(project) {
    const p = projectGroup(project);
    box(5.8, 3.8, 3.5, '#dedcc4', p, 0, 2.2, -.1);
    box(6.15, .25, 3.9, '#a3b19a', p, 0, 4.23, -.1);
    gable(6.25, 4, 1.05, '#7e9680', p, 0, 4.38, -.1);
    for (let row = 0; row < 2; row++) for (const x of [-2, -1, 1, 2]) windowPane(p, x, 1.4 + row * 1.55, 1.68, .58, .85);
    box(1, 2.15, .09, '#8aa59a', p, 0, 1.45, 1.72);
    [-2.5, -.8, .8, 2.5].forEach(x => { cylinder(.13, .17, 2.85, '#ebe5ce', p, x, 1.9, 2, 8); box(.4, .16, .4, '#cdd0b6', p, x, .53, 2); box(.35, .16, .35, '#d7dcc3', p, x, 3.3, 2); });
    box(6.05, .28, 1.05, '#d1d4ba', p, 0, 3.49, 1.9);
    gable(3.2, 1.2, .9, '#91a28b', p, 0, 3.65, 1.9);
    board('ICUE', 1.3, .45, '#dce0ca', '#5d7b64', p, 0, 4, 2.52, 110);
    box(1.25, 1.45, 1.2, '#dbddc4', p, 0, 5.18, -.5);
    gable(1.65, 1.6, .6, '#6b876e', p, 0, 5.96, -.5);
    cylinder(.035, .035, .95, '#d3ba7e', p, 0, 6.9, -.5, 5);
    sphere(.1, '#d2b46c', p, 0, 7.43, -.5, 0);
    for (let i = 0; i < 3; i++) box(3.8 + i * .5, .12, .45, '#d2cfb5', p, 0, .38 - i * .1, 2.45 + i * .35);
    planter(p, -3.5, -.5, 1); planter(p, 3.5, -.5, 1);
  }
  const builders = { hr: buildHR, crypto: buildCrypto, contracts: buildContracts, compressor: buildCompressor, ceremony: buildCeremony, icue: buildICUE };
  projects.forEach(project => builders[project.id](project));
  const projectLabels=createProjectLabels({THREE,scene,projects,buildings:landmarkGroups,language});

  // Instanced vegetation keeps the toy-like world inexpensive to render.
  const treePositions = [];
  const segmentDistance = (x, z, a, b) => {
    const dx = b[0] - a[0], dz = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz)));
    return Math.hypot(x - a[0] - dx * t, z - a[1] - dz * t);
  };
  const onRoad = (x, z) => roadLoop.some((p, i) => segmentDistance(x, z, p, roadLoop[(i + 1) % roadLoop.length]) < 10) || (Math.abs(x)<10&&Math.abs(z)<20) || (Math.abs(z)<10&&Math.abs(x)<27) || outerRoadLoop.some((p,i)=>segmentDistance(x,z,p,outerRoadLoop[(i+1)%12])<10) || connectorPaths.some(path=>path.slice(1).some((key,i)=>segmentDistance(x,z,roadNodes[path[i]],roadNodes[key])<10));
  const nearBridge=(x,z)=>bridges.some(b=>{const dx=x-b.x,dz=z-b.z;return Math.abs(dx*Math.cos(b.heading)-dz*Math.sin(b.heading))<b.width/2+3.5&&Math.abs(dx*Math.sin(b.heading)+dz*Math.cos(b.heading))<b.length/2+7;});
  for (let i = 0; i < 1600 && treePositions.length < (coarse ? 4 : 6); i++) {
    const x = (rand() - .5) * 54, z = (rand() - .5) * 40;
    if (Math.hypot(x / 27, z / 20) > .97 || onRoad(x, z) || nearBridge(x,z) || isRiver(x, z, 2)) continue;
    if (reservesIslandLifeSpace(x,z)||reservesPlaygroundSpace(x,z)) continue;
    if (houses.some(h => Math.abs(x - h.x) < 3.2*(h.scale||1) && Math.abs(z - h.z) < 3*(h.scale||1))) continue;
    if (portals.some(p => Math.hypot(x - p.x, z - p.z) < 3 || Math.hypot(x - p.exitX, z - p.exitZ) < 2.5)) continue;
    if (projects.some(p => Math.abs(x - p.position[0]) < p.footprint[0] / 2 + 1.8 && Math.abs(z - p.position[1]) < p.footprint[1] / 2 + 1.8)) continue;
    if (Math.hypot(x - 22, z + 12) < 3 || Math.hypot(x + 21, z - 12) < 4) continue;
    if (treePositions.some(p => Math.hypot(x - p.x, z - p.z) < 5)) continue;
    treePositions.push({ x, z, scale: 1.4 + rand() * .8, round: rand() > .72 });
  }
  // Sparse woodland around the original village leaves broad clearings for future play areas.
  const forestTarget=treePositions.length+(coarse?30:60);
  for(let i=0;i<5000&&treePositions.length<forestTarget;i++){
    const x=(rand()-.5)*(ISLAND_BOUNDS.x-5)*2,z=(rand()-.5)*(ISLAND_BOUNDS.z-5)*2;
    if(Math.hypot(x/30,z/24)<1.15||islandRadius(x,z,5)>.97||nearBridge(x,z)||isRiver(x,z,2))continue;
    if(outerRoadLoop.some((a,j)=>segmentDistance(x,z,a,outerRoadLoop[(j+1)%12])<10))continue;
    if(connectorPaths.some(path=>path.slice(1).some((key,i)=>segmentDistance(x,z,roadNodes[path[i]],roadNodes[key])<10)))continue;
    if(reservesPlaygroundSpace(x,z))continue;
    if(houses.some(h=>Math.hypot(x-h.x,z-h.z)<7)||projects.some(p=>Math.abs(x-p.position[0])<p.footprint[0]/2+4&&Math.abs(z-p.position[1])<p.footprint[1]/2+4))continue;
    if(treePositions.some(t=>Math.hypot(x-t.x,z-t.z)<10))continue;
    treePositions.push({x,z,scale:1.4+rand()*.8,round:rand()>.72});
  }
  // Retain the broadleaf trees and only one in four remaining pines.
  // Consume the original rotation seeds before filtering so shoreline props
  // keep their existing positions.
  treePositions.forEach(tree=>tree.rotation=rand()*Math.PI);let pineSerial=0;
  const sparseTrees=treePositions.filter(tree=>tree.round||pineSerial++%4===0);
  // Two broadleaf targets frame the TNT clearing without narrowing its approach.
  sparseTrees.push({x:-57,z:23,scale:1.5,round:true,rotation:.3},{x:-51,z:35,scale:1.6,round:true,rotation:.8});
  treePositions.splice(0,treePositions.length,...sparseTrees);
  const pineCount = treePositions.filter(t => !t.round).length;
  const roundCount = treePositions.length - pineCount;
  const trunks = new THREE.InstancedMesh(new THREE.CylinderGeometry(.12, .16, 1.25, 5), mat(colors.trunk), treePositions.length);
  const pines = new THREE.InstancedMesh(new THREE.ConeGeometry(1, 2, 5), mat(colors.pine), pineCount * 3);
  pines.name='Sparse island pines';
  const rounds = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(1, 0), mat(colors.leaf), roundCount * 2);
  for (const object of [trunks, pines, rounds]) { object.castShadow = true; object.receiveShadow = true; scene.add(object); }
  const dummy = new THREE.Object3D(), color = new THREE.Color();
  let pineIndex = 0, roundIndex = 0;
  treePositions.forEach((tree, i) => {
    const { x, z, scale, round } = tree;
    dummy.position.set(x, .7 * scale, z); dummy.scale.set(scale, scale, scale); dummy.rotation.set(0,tree.rotation,0); dummy.updateMatrix(); trunks.setMatrixAt(i, dummy.matrix);
    if (!round) {
      for (let j = 0; j < 3; j++) {
        const s = scale * (1 - j * .2); dummy.position.set(x, (1.45 + j * .7) * scale, z); dummy.scale.set(s, s * 1.04, s); dummy.updateMatrix(); pines.setMatrixAt(pineIndex, dummy.matrix);
        color.set(['#698565', '#78906a', '#83966c', '#617d60'][i % 4]); pines.setColorAt(pineIndex++, color);
      }
    } else {
      for (let j = 0; j < 2; j++) { dummy.position.set(x + j * .3 * scale, (1.75 + j * .65) * scale, z); dummy.scale.set(scale * .9, scale * (j ? .9 : 1.3), scale * .9); dummy.updateMatrix(); rounds.setMatrixAt(roundIndex, dummy.matrix); color.set(['#a4ad76', '#8f9d6b', '#a3aa71'][i % 3]); rounds.setColorAt(roundIndex++, color); }
    }
  });
  rounds.visible=false;
  const detailedTrees=createTreeDetails({THREE,scene,trees:treePositions,coarse});
  const winterMaterial = mat('#edf4ec', { transparent: true, opacity: 0, roughness: 1 });
  const winterPines = new THREE.InstancedMesh(new THREE.ConeGeometry(.62, .82, 5), winterMaterial, pineCount);
  const winterRounds = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(.75, 0), winterMaterial, roundCount);
  winterPines.visible = false; winterRounds.visible = false; scene.add(winterPines, winterRounds);
  let winterPineIndex = 0, winterRoundIndex = 0;
  treePositions.forEach(tree => {
    dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(tree.scale);
    dummy.position.set(tree.x, tree.scale * (tree.round ? 2.7 : 3.13), tree.z); dummy.updateMatrix();
    (tree.round ? winterRounds : winterPines).setMatrixAt(tree.round ? winterRoundIndex++ : winterPineIndex++, dummy.matrix);
  });
  const rocks = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), mat('#bbc0aa'), 34);
  rocks.castShadow = true; rocks.receiveShadow = true;
  for (let i = 0; i < 34; i++) {
    const angle = i / 34 * Math.PI * 2; const s = .3 + rand() * .5;
    dummy.position.set(Math.cos(angle) * (ISLAND_BOUNDS.x-1 + rand()), -.25, Math.sin(angle) * (ISLAND_BOUNDS.z-1 + rand())); dummy.rotation.set(rand(), rand(), rand()); dummy.scale.set(s * 1.6, s * .8, s); dummy.updateMatrix(); rocks.setMatrixAt(i, dummy.matrix);
  }
  scene.add(rocks);
  const flowers = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(.1, 0), mat('#d7c47d'), 110);
  for (let i = 0; i < 110; i++) {
    const x = (rand() - .5) * 48, z = (rand() - .5) * 34;
    dummy.position.set(x, onRoad(x, z) || isRiver(x, z, 1.4) ? -3 : .22, z); dummy.scale.setScalar(.6 + rand() * .8); dummy.rotation.set(0, rand() * 3, 0); dummy.updateMatrix(); flowers.setMatrixAt(i, dummy.matrix);
  }
  scene.add(flowers);

  // Lighthouse, pond, jetty, sculptures and street furniture reward a little detour.
  const lighthouse = group(land,LANDMARKS.lighthouse.x,LANDMARKS.lighthouse.z);
  lighthouse.userData.building=true;
  cylinder(1.1, 1.45, .45, '#d8d1b6', lighthouse, 0, .4, 0);
  cylinder(.6, .95, 4, '#e3dfc3', lighthouse, 0, 2.5, 0, 8);
  cylinder(.71, .76, .8, '#a2b2a0', lighthouse, 0, 3.3, 0, 8);
  cylinder(.95, .95, .18, '#70866e', lighthouse, 0, 4.6, 0, 8);
  cylinder(.56, .56, .9, '#b9c6b3', lighthouse, 0, 5.1, 0, 8);
  mesh(new THREE.ConeGeometry(.92, .65, 8), '#8ca185', lighthouse, 0, 5.85, 0);
  const beacon = sphere(.23, mat('#f7dda2', { emissive: '#ffbf58', emissiveIntensity: .12 }), lighthouse, 0, 5.1, 0);
  lamps.push(beacon.material);
  const pond = mesh(new THREE.CircleGeometry(3.2, 32), mat('#9dbcb1'), land,LANDMARKS.pond.x,.04,LANDMARKS.pond.z); pond.rotation.x = -Math.PI / 2; pond.scale.set(1, .62, 1);
  const pondRim = mesh(new THREE.RingGeometry(3.2, 3.45, 40), '#b5c3a0', land,LANDMARKS.pond.x,.045,LANDMARKS.pond.z,false); pondRim.rotation.x = -Math.PI / 2; pondRim.scale.set(1, .62, 1);
  for (let i = 0; i < 3; i++) { const lily = mesh(new THREE.CircleGeometry(.24, 7), '#809d82', land,LANDMARKS.pond.x-1+i*1.2,.07,LANDMARKS.pond.z+Math.sin(i)*.5,false); lily.rotation.x = -Math.PI / 2; }
  const dock = group(land,LANDMARKS.pond.x-3,LANDMARKS.pond.z+1);
  dock.userData.blastProtected=true;dock.userData.breakableKind='bridge';
  for (let i = 0; i < 8; i++) box(.35, .12, 1.5, '#b9a077', dock, -1.3 + i * .36, .13, 0);
  [-1.2, 1.2].forEach(x => [-.65, .65].forEach(z => cylinder(.09, .09, .8, '#a98d67', dock, x, .15, z, 5)));
  bench(land,LANDMARKS.pond.x-3,LANDMARKS.pond.z-4, -Math.PI / 2); bench(land,-14,25,0); bench(land, 9, -16, Math.PI);
  const art = group(land,LANDMARKS.sculpture.x,LANDMARKS.sculpture.z);
  art.userData.breakableId='town-sculpture';art.userData.breakableKind='sculpture';
  cylinder(.65, .85, .32, '#d6d1b5', art, 0, .3, 0);
  const sculpture = group(art);
  for (let i = 0; i < 3; i++) { const bar = box(.23, 2.5, .23, '#ceae66', sculpture, 0, 1.8, 0); bar.rotation.z = i * Math.PI / 3; }
  animatedObjects.push({ object: sculpture, type: 'sculpture' });
  const sign = group(land,LANDMARKS.welcome.x,LANDMARKS.welcome.z);
  sign.userData.breakableId='welcome-sign';sign.userData.breakableKind='sign';
  [-1.2, 1.2].forEach(x => box(.1, 1.4, .1, '#a88e64', sign, x, .8, 0));
  box(3.2, 1.1, .12, '#e7dcbb', sign, 0, 1.65, 0);
  board('HELLO, CURIOUS HUMAN.', 2.95, .7, '#e7dcbb', '#8b8d65', sign, 0, 1.65, .07, 36, 'welcomeSign');
  const fence = group(land);
  fence.userData.breakableId='village-fence';fence.userData.breakableKind='fence';
  for(let i=0;i<15;i++){
    const x=-18+i*2;
    if(Math.abs(x)>8)box(.09,.8,.09,'#a6a681',fence,x,.5,-27);
    if(i<14&&Math.abs(x+1)>8.5){box(2,.08,.08,'#b8b08b',fence,x+1,.78,-27);box(2,.08,.08,'#b8b08b',fence,x+1,.4,-27);}
  }
  const cones = [];
  [[-15, -11], [-14, -11.6], [15.5, 9], [16.2, 8.2], [5, 14.6], [6, 14.5]].forEach(([x, z]) => {
    const cone = group(land, x, z); box(.43, .07, .43, '#b4b499', cone, 0, .16, 0);
    cylinder(.035, .17, .5, '#ca9267', cone, 0, .42, 0, 7); cylinder(.09, .11, .12, '#e4d7b7', cone, 0, .42, 0, 7);
    cones.push({ object: cone, vx: 0, vz: 0, tilt: 0 });
  });

  const boundary=createIslandBoundary({THREE,scene,coarse});
  const wayfinding=createWayfinding({THREE,scene,language});
  const scenery = createScenery({ THREE, scene, land, box, cylinder, sphere, group, mesh, mat, board, coarse, reducedMotion });
  scenery.bridgeGroups.forEach(({bridge,object})=>bridge.active=()=>object.visible);
  const islandLife=createIslandLife({THREE,scene,reducedMotion,coarse});
  let blastDamage=null;
  const playground=createPlayground({THREE,scene,coarse,reducedMotion,onExplosion:event=>{blastDamage?.blast(event);onExplosion?.(event);}});
  const nightFires=createNightFires({THREE,scene,reducedMotion});
  let vehicle=createVehicle({THREE,scene,reducedMotion,model:vehicleModel(carModel).id});
  let car=vehicle.root;car.userData.vehicleId=vehicle.modelId;
  const carShadow = mesh(new THREE.CircleGeometry(1, 24), new THREE.MeshBasicMaterial({ color: '#6d7d61', transparent: true, opacity: .13, depthWrite: false }), scene, 0, .14, 13, false); carShadow.rotation.x = -Math.PI / 2; carShadow.scale.set(.9, 1.35, 1);
  const routeColliders = [...projects.map(p => ({ x:p.position[0], z:p.position[1], width:p.footprint[0], depth:p.footprint[1] })), ...scenery.colliders, ...islandLife.colliders];
  const coneBodies = cones.map((cone, index) => {
    cone.object.children.forEach(child => child.position.y -= .42);
    const id = `traffic-cone-${index}`; cone.object.userData.propId = id;
    return { id, object:cone.object, x:cone.object.position.x, z:cone.object.position.z, y:.42, radius:.28, mass:.4, height:.6, kind:'cone' };
  });
  const looseObjects = [];
  scene.traverse(object => { if (object.userData.physicsKind) looseObjects.push(object); });
  const furnitureBodies = looseObjects.map((object,index) => {
    const kind = object.userData.physicsKind;
    return createDynamicBody({ THREE, object, parent:scene, id:`${kind}-${index+1}`, mass:kind==='bench'?4:kind==='snowman'?2:kind==='trash-can'?2.4:.9, kind,
      active:kind==='snowman'?()=>environment.weather==='snow':undefined });
  });
  const shoreBodies = createInstancedBodies({ THREE, object:rocks, idPrefix:'shore-rock', mass:3 });
  const bodyDefinitions = [...playground.bodies,...scenery.bodies, ...coneBodies, ...furnitureBodies, ...shoreBodies];
  const colliders = collectWorldColliders({ THREE, roots:[land,trunks,rocks,islandLife.root,nightFires.root,boundary.root,wayfinding.root], exclude:[...bodyDefinitions.map(body=>body.object).filter(Boolean),rocks] });
  const physics = new PhysicsWorld({ bodies:bodyDefinitions, colliders });
  const treeTargets=treeBlastTargets({THREE,trees:treePositions,objects:[trunks,pines,rounds,winterPines,winterRounds,...detailedTrees.root.children]});
  const breakableTargets=collectBreakableTargets({THREE,colliders,existing:[...treeTargets,...scenery.breakableTargets]});
  blastDamage=createBlastDamage({THREE,scene,physics,targets:breakableTargets,coarse,reducedMotion,onRespawn:id=>playground.rearm(id),onBreak:({kind,x,z})=>onImpact?.({kind:['tree','bridge','fence','sign','cart','stall','crate','bench','planter'].includes(kind)?'wood':['rock','stone'].includes(kind)?'stone':'metal',strength:6,distance:Math.hypot(driver.x-x,driver.z-z)})});
  const portalSystem = new PortalSystem(portals.map((p,i)=>({...p,active:()=>scenery.portalGroups[i].visible})));
  function syncProps() { syncPhysicsBodies(THREE,physics.bodies); }
  syncProps();
  const driver = new Driver(colliders,{routeColliders});driver.setVehicleProfile(vehicle.profile);
  driver.onImpact=(collider,strength)=>blastDamage.impact(collider,strength);
  const targetRing = mesh(new THREE.RingGeometry(.65, .76, 32), new THREE.MeshBasicMaterial({ color: '#f5ecc4', side: THREE.DoubleSide, transparent: true, opacity: .85, depthWrite: false }), scene, 0, .17, 0, false); targetRing.rotation.x = -Math.PI / 2; targetRing.visible = false;
  const routeGeometry = new THREE.BufferGeometry();
  const routeLine = new THREE.Line(routeGeometry, new THREE.LineDashedMaterial({ color: '#d5b45e', dashSize: .4, gapSize: .45, transparent: true, opacity: .9, depthWrite: false })); scene.add(routeLine);
  const dust = [];
  const dustMaterial = new THREE.MeshBasicMaterial({ color: '#ddd8b7', transparent: true, opacity: .35, depthWrite: false });
  for (let i = 0; i < 14; i++) { const particle = mesh(new THREE.IcosahedronGeometry(.12, 0), dustMaterial, scene, 0, -10, 0, false); dust.push({ object: particle, age: 1, life: .6, dx: 0, dz: 0 }); }
  let dustIndex = 0, dustElapsed = 0;

  const impactTimes=new Map();let lastLandingSound=-Infinity;
  const keys = new Set();
  const pointer = new THREE.Vector2();
  const raycaster = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -.14);
  const pointerPoint = new THREE.Vector3();
  const surface = renderer.domElement, hoverPointers = new Set();
  const interactiveGroups = [...new Set([...landmarkGroups,projectLabels.root, ...scenery.portalGroups, car, ...bodyDefinitions.map(body=>body.object).filter(Boolean), rocks,...breakableTargets.flatMap(t=>t.parts.map(p=>p.object))])];
  const shoreIds = new Map(shoreBodies.map(body=>[body.instance.index,body.id]));
  function begin() {
    if (!exploring) { exploring = true; onStart?.(); }
  }
  function stopDriving(){driver.jumpPending=false;driver.jumpCharge=0;driver.cancelRoute();driver.speed=0;driver.vx=0;driver.vz=0;driver.boosting=false;navigation.clear();onCancelRoute?.();}
  function clearKeys() { keys.clear(); hoverPointers.clear(); surface.style.cursor = paused ? 'default' : 'grab'; }
  function pickInteractive(x, y) {
    const rect = surface.getBoundingClientRect(), width = rect.width || innerWidth, height = rect.height || innerHeight;
    pointer.set((x - rect.left) / width * 2 - 1, -(y - rect.top) / height * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(interactiveGroups, true);
    for (const hit of hits) {
      const paints=Array.isArray(hit.object.material)?hit.object.material:[hit.object.material];
      if(paints.every(paint=>!paint||paint.visible===false||(paint.transparent&&paint.opacity<=.05)))continue;
      let visible=true;
      for(let parent=hit.object;parent;parent=parent.parent) if(!parent.visible){visible=false;break;}
      if(!visible)continue;
      if(hit.object===rocks)return {propId:shoreIds.get(hit.instanceId)};
      if(hit.instanceId!==undefined&&hit.object.userData.breakableInstances?.has(hit.instanceId))return {breakableId:hit.object.userData.breakableInstances.get(hit.instanceId)};
      let object=hit.object;
      while(object&&!object.userData.propId&&!object.userData.projectId&&!object.userData.portalId&&!object.userData.vehicleId&&!object.userData.breakableId)object=object.parent;
      if(object)return object.userData;
    }
    return null;
  }
  const clickGround = (x, y) => {
    const target = pickInteractive(x, y);
    if (target?.vehicleId) { stopDriving();return; }
    if (target?.propId) { begin(); physics.kick(target.propId,{x:driver.x,z:driver.z,strength:4}); return; }
    if (target?.portalId) { goToPortal(target.portalId); return; }
    if (target?.projectId) { onProject?.(target.projectId); return; }
    if(target?.breakableId){begin();const object=breakableTargets.find(t=>t.id===target.breakableId);blastDamage.impact(target.breakableId,breakProfile(object?.kind).speed+.1);return;}
    if (raycaster.ray.intersectPlane(plane, pointerPoint) && islandRadius(pointerPoint.x,pointerPoint.z) < 1) {
      begin(); driver.driveTo(pointerPoint.x, pointerPoint.z); onCancelRoute?.();
      const target = driver.route.at(-1) || [pointerPoint.x, pointerPoint.z]; targetRing.position.set(target[0], bridgeHeightAt(...target) + .17, target[1]); targetRing.visible = true;
    }
  };
  function goToPortal(id) {
    const gate = portals.find(gate => gate.id === id); if (!gate) return;
    // Approach the open face of the arch so a routed car does not hit its solid rim.
    const nx=Math.sin(gate.heading), nz=Math.cos(gate.heading);
    begin(); driver.navigate(gate.id==='west-gate'?'r0':'r7',null);
    if(gate.id==='east-gate')driver.route.push([22,18],[28,17],[28,11]);
    driver.route.push([gate.x-nx*3.4,gate.z-nz*3.4],[gate.x-nx*2,gate.z-nz*2],[gate.x,gate.z]); driver.finalTolerance=.4;
    driver.routeDurationLimit=driver.routeBudget();
    onCancelRoute?.(); updateRoute();
    targetRing.position.set(gate.x, .17, gate.z); targetRing.visible = true;
  }
  function safeArrival(x,z){
    const free=(px,pz)=>driver.canPark(px,pz)&&!physics.bodies.some(b=>!b.destroyed&&(!b.active||b.active())&&Math.hypot(px-b.x,pz-b.z)<b.radius+Math.max(driver.profile.halfWidth,driver.profile.halfLength)+.25);
    if(free(x,z))return [x,z];for(const radius of [2,4,6,8,11])for(let i=0;i<16;i++){const px=x+Math.cos(i/16*Math.PI*2)*radius,pz=z+Math.sin(i/16*Math.PI*2)*radius;if(free(px,pz))return[px,pz];}return null;
  }
  function setCarModel(id){
    const config=vehicleModel(id);if(vehicle.modelId===config.id)return config.id;stopDriving();driver.settle();const index=interactiveGroups.indexOf(car);vehicle.dispose();vehicle=createVehicle({THREE,scene,reducedMotion,model:config.id});car=vehicle.root;car.userData.vehicleId=vehicle.modelId;interactiveGroups[index]=car;driver.setVehicleProfile(vehicle.profile);const spot=safeArrival(driver.x,driver.z);if(spot)driver.teleport(...spot);vehicle.update(0,{driver,night:environment.night,headlights:headlightsMode});return config.id;
  }
  function teleportTo(id){
    const location=mapLocations(language).find(location=>location.id===id);if(!location)return false;const heading=driver.heading;driver.heading=location.heading??Math.PI/2;const spot=safeArrival(...location.spawn);if(!spot){driver.heading=heading;return false;}
    begin();navigation.clear();driver.teleport(...spot,location.heading??Math.PI/2);portalSystem.cooldown=2;portalSystem.armed=false;panOffset.set(0,0,0);nearestId=null;onNearby?.(null);onCancelRoute?.();updateRoute();vehicle.update(0,{driver,night:environment.night,headlights:headlightsMode});updateCamera(1);return true;
  }
  function captureMap({x=0,z=0,halfWidth=MAP_BOUNDS.x,halfHeight=MAP_BOUNDS.z}={}){
    const altitude=Math.max(halfWidth,halfHeight)*2+100;
    const mapCamera=new THREE.OrthographicCamera(-halfWidth,halfWidth,halfHeight,-halfHeight,.1,altitude+500);mapCamera.up.set(0,0,-1);mapCamera.position.set(x,altitude,z);mapCamera.lookAt(x,0,z);mapCamera.updateMatrixWorld();
    const fog=scene.fog,background=scene.background,sky=hemisphere.intensity,sunlight=sun.intensity,fillLight=fill.intensity,hidden=[],savedColors=[],savedUniforms=[];
    const sunPosition=sun.position.clone(),sunTarget=sun.target.position.clone(),shadowCamera=sun.shadow.camera,shadow={left:shadowCamera.left,right:shadowCamera.right,top:shadowCamera.top,bottom:shadowCamera.bottom,near:shadowCamera.near,far:shadowCamera.far};
    const oldSize=renderer.getSize?.(new THREE.Vector2()),oldRatio=renderer.getPixelRatio?.();
    const tint=(color,value)=>{savedColors.push([color,color.clone()]);color.set(value);};
    scene.traverse(object=>{
      if(['island-atmosphere','island-flyover','Project rooftop typography','Frosted canopy tips'].includes(object.name)||object.material===winterMaterial||object.userData.atlasSnow){hidden.push([object,object.visible]);object.visible=false;}
      const uniforms=object.material?.uniforms;
      if(uniforms?.uDaylight){savedUniforms.push([uniforms.uDaylight,uniforms.uDaylight.value]);uniforms.uDaylight.value=1;}
      if(uniforms?.uRain){savedUniforms.push([uniforms.uRain,uniforms.uRain.value]);uniforms.uRain.value=0;}
      if(uniforms?.uSky){savedColors.push([uniforms.uSky.value,uniforms.uSky.value.clone()]);uniforms.uSky.value.set('#b9dedc');}
    });
    try{
      scene.fog=null;scene.background=new THREE.Color('#243f4d');
      tint(island.material[0].color,'#91a765');tint(island.material[1].color,'#dcb985');tint(sea.material.color,'#264957');tint(pond.material.color,'#63b7bb');tint(hemisphere.color,'#fff5df');tint(hemisphere.groundColor,'#788a61');tint(sun.color,'#fff1d2');
      hemisphere.intensity=2;sun.intensity=2.7;fill.intensity=.9;sun.position.set(-90,140,100);sun.target.position.set(0,0,0);
      Object.assign(shadowCamera,{left:-195,right:195,top:170,bottom:-170,near:1,far:400});shadowCamera.updateProjectionMatrix();sun.shadow.needsUpdate=true;
      if(oldSize&&Number.isFinite(oldRatio)){renderer.setPixelRatio(1);renderer.setSize(1536,Math.round(1536*halfHeight/halfWidth),false);}
      renderer.render(scene,mapCamera);const picture=renderer.domElement.toDataURL?.('image/png');return typeof picture==='string'&&picture.startsWith('data:image/png')?picture:'';
    }catch{return '';}finally{
      scene.fog=fog;scene.background=background;hemisphere.intensity=sky;sun.intensity=sunlight;fill.intensity=fillLight;
      savedColors.forEach(([color,value])=>color.copy(value));savedUniforms.forEach(([uniform,value])=>uniform.value=value);hidden.forEach(([object,visible])=>object.visible=visible);
      sun.position.copy(sunPosition);sun.target.position.copy(sunTarget);Object.assign(shadowCamera,shadow);shadowCamera.updateProjectionMatrix();sun.shadow.needsUpdate=true;
      if(oldSize&&Number.isFinite(oldRatio)){renderer.setPixelRatio(oldRatio);renderer.setSize(oldSize.x,oldSize.y,false);}
      renderer.render(scene,camera);
    }
  }
  function resetView() { orbitYaw = defaultYaw; orbitPitch = defaultPitch; zoomScale = 1; panOffset.set(0, 0, 0); }
  const readInput=()=>({forward:keys.has('ArrowUp')||keys.has('w'),reverse:keys.has('ArrowDown')||keys.has('s'),left:keys.has('ArrowLeft')||keys.has('a'),right:keys.has('ArrowRight')||keys.has('d'),boost:keys.has('Shift'),brake:keys.has('b')});
  const navigation = bindNavigation({
    surface: renderer.domElement, wheelTarget: container, isPaused: () => paused,
    onKey(key, pressed) { if (pressed) { begin(); panOffset.set(0, 0, 0); keys.add(key); } else keys.delete(key); },
    onClear: clearKeys, onJump:()=>{if(driver.jump()){onImpact?.({kind:'hydraulic',strength:3,distance:0});onCancelRoute?.();}},onHydraulics:()=>driver.toggleHydraulics(), onClick: clickGround,
    onOrbit(dx, dy) { begin(); orbitYaw -= dx * .006; orbitPitch = THREE.MathUtils.clamp(orbitPitch + dy * .004, .4, 1.12); },
    onPan(dx, dy) {
      begin(); const unit = viewHeight / innerHeight;
      panOffset.x -= (dx * Math.cos(orbitYaw) + dy * Math.sin(orbitYaw) / Math.sin(orbitPitch)) * unit;
      panOffset.z += (dx * Math.sin(orbitYaw) - dy * Math.cos(orbitYaw) / Math.sin(orbitPitch)) * unit;
      panOffset.x = THREE.MathUtils.clamp(panOffset.x, -ISLAND_BOUNDS.x, ISLAND_BOUNDS.x); panOffset.z = THREE.MathUtils.clamp(panOffset.z, -ISLAND_BOUNDS.z, ISLAND_BOUNDS.z);
    },
    onZoom(amount) { begin(); zoomScale = clampZoom(zoomScale * Math.exp(amount)); }
  });
  function hover(event) {
    if (paused || hoverPointers.size || event.pointerType === 'touch') return;
    surface.style.cursor = pickInteractive(event.clientX, event.clientY) ? 'pointer' : 'grab';
  }
  function hoverDown(event) {
    if (paused || event.button > 2) return;
    hoverPointers.add(event.pointerId); surface.style.cursor = '';
  }
  function hoverFinish(event) {
    hoverPointers.delete(event.pointerId);
    if (!hoverPointers.size) surface.style.cursor = paused ? 'default' : 'grab';
  }
  function hoverLeave() { if (!hoverPointers.size) surface.style.cursor = paused ? 'default' : 'grab'; }
  const hoverListeners = { pointermove: hover, pointerdown: hoverDown, pointerup: hoverFinish, pointercancel: hoverFinish, lostpointercapture: hoverFinish, pointerleave: hoverLeave };
  for (const [event, listener] of Object.entries(hoverListeners)) surface.addEventListener(event, listener);
  surface.style.cursor = 'grab';
  function dimensions() {
    const aspect = innerWidth / innerHeight;
    const framing = islandFrame(aspect, orbitYaw, orbitPitch, zoomScale);
    return { aspect, small: innerWidth < 800, targetHeight: framing.height, framing };
  }
  function resize() { renderer.setSize(innerWidth, innerHeight); }
  window.addEventListener('resize', resize);
  const visibility = () => { wasVisible = !document.hidden; if (!wasVisible) navigation.clear(); else lastTime = performance.now(); };
  document.addEventListener('visibilitychange', visibility);
  function updateCamera(dt) {
    const { aspect, targetHeight, framing } = dimensions();
    const damping = reducedMotion ? 1 : 1 - Math.exp(-2.5 * dt);
    viewHeight = Math.min(targetHeight, viewHeight + (targetHeight - viewHeight) * damping);
    const liveFrame = { ...framing, height: viewHeight, width: viewHeight * aspect,
      horizontalLimit: framing.horizontalLimit + (targetHeight - viewHeight) * aspect / 2,
      verticalLimit: framing.verticalLimit + (targetHeight - viewHeight) / 2 };
    const follow = exploring ? 1 : .35;
    const desiredLook = new THREE.Vector3(driver.x * follow, 0, driver.z * follow).add(panOffset);
    const constrained = constrainIslandFocus(desiredLook.x, desiredLook.z, liveFrame);
    desiredLook.set(constrained.x, 0, constrained.z); lookAt.lerp(desiredLook, damping);
    let safeFocus = constrainIslandFocus(lookAt.x, lookAt.z, liveFrame);
    if (exploring) safeFocus = keepVehicleVisible(safeFocus, liveFrame, { x: driver.x, z: driver.z, y: (driver.groundHeight || 0) + driver.hop,height:driver.profile.bodyTop+driver.rideHeight+.2 }, innerHeight);
    lookAt.set(safeFocus.x, 0, safeFocus.z);
    cameraOffset.set(Math.sin(orbitYaw) * Math.cos(orbitPitch), Math.sin(orbitPitch), Math.cos(orbitYaw) * Math.cos(orbitPitch)).multiplyScalar(cameraDistance);
    camera.left = -viewHeight * aspect / 2; camera.right = viewHeight * aspect / 2; camera.top = viewHeight / 2; camera.bottom = -viewHeight / 2;
    camera.position.copy(lookAt).add(cameraOffset); camera.lookAt(lookAt); camera.updateProjectionMatrix(); camera.updateMatrixWorld();
  }
  function updateRoute() {
    routeLine.visible = driver.route.length > 0 && Math.abs(driver.speed)<=.18 && driver.hop<=.05;
    if (routeLine.visible) {
      const stops = [[driver.x, driver.z], ...driver.route], points = [];
      for (let i = 0; i < stops.length - 1; i++) {
        const [a, b] = [stops[i], stops[i + 1]], steps = Math.max(1, Math.ceil(Math.hypot(a[0] - b[0], a[1] - b[1]) / .4));
        for (let j = 0; j <= steps; j++) { const t = j / steps, x = a[0] + (b[0] - a[0]) * t, z = a[1] + (b[1] - a[1]) * t; points.push(new THREE.Vector3(x, bridgeHeightAt(x, z) + .17, z)); }
      }
      routeLine.geometry.dispose(); routeLine.geometry = new THREE.BufferGeometry().setFromPoints(points); routeLine.computeLineDistances();
    }
    if (!driver.route.length) targetRing.visible = false;
  }
  function animate(now) {
    animationId = requestAnimationFrame(animate);
    if (!wasVisible) { lastTime = now; return; }
    const elapsed = Math.min((now - lastTime) / 1000, .05); lastTime = now;
    const simulationElapsed=elapsed*playground.timeScale();
    const time = now / 1000;
    environment = atmosphere.update(elapsed, { paused, focus:driver });
    boundary.update(environment);wayfinding.update(environment);
    flyover.update(elapsed, { night:environment.night, paused });
    driver.setWeather(environment.weather);
    winterAmount += ((environment.weather === 'snow' ? .72 : 0) - winterAmount) * Math.min(elapsed * .7, 1);
    island.material[0].color.lerpColors(summerGrass, snowGrass, winterAmount);
    winterMaterial.opacity = winterAmount / .72;
    winterPines.visible = winterAmount > .01; winterRounds.visible=false;detailedTrees.updateSnow(winterAmount);
    islandLife.update(simulationElapsed,{weather:environment.weather,night:environment.night,paused});
    scenery.update(paused ? 0 : simulationElapsed, reducedMotion ? 0 : time, {...environment,driver});
    lamps.forEach(material => material.emissiveIntensity = .12 + environment.night * 2);
    if (!paused && exploring) {
      const result=driver.step(simulationElapsed,readInput());
      if (result.cancelled) onCancelRoute?.();
      if (result.arrived) onArrival?.(result.arrived);
      dustElapsed += simulationElapsed;
      if (!reducedMotion && !driver.airborne && !driver.inWater && Math.abs(driver.speed) > 2 && dustElapsed > .07) {
        dustElapsed = 0; const particle = dust[dustIndex++ % dust.length]; particle.age = 0; particle.object.position.set(driver.x - Math.sin(driver.heading), .25, driver.z - Math.cos(driver.heading)); particle.dx = (rand() - .5) * .8; particle.dz = (rand() - .5) * .8;
      }
      physics.update(simulationElapsed, driver, { weather: environment.weather });
      const impacts=physics.bodies.filter(b=>!b.destroyed&&(!b.active||b.active())&&b.kind!=='tnt'&&(b.impactSpeed||0)>1.2&&time-(impactTimes.get(b.id)??-Infinity)>.18).sort((a,b)=>b.impactSpeed-a.impactSpeed).slice(0,3);
      for(const body of impacts){impactTimes.set(body.id,time);onImpact?.({kind:body.kind==='bowling-pin'?'pin':['barrel','trash-can'].includes(body.kind)?'metal':['rock','stone'].includes(body.kind)?'stone':body.kind==='snowman'?'snow':'wood',strength:body.impactSpeed,distance:Math.hypot(driver.x-body.x,driver.z-body.z)});}
      if(driver.landingImpact>1&&driver.landingTime>0&&time-lastLandingSound>.4){lastLandingSound=time;onImpact?.({kind:'landing',strength:driver.landingImpact,distance:0});}
      const portalId = portalSystem.update(simulationElapsed, driver);
      if (portalId) { panOffset.set(0, 0, 0); onCancelRoute?.(); onPortal?.(portalId); }
    }
    playground.update(simulationElapsed,physics,driver,{paused:paused||!exploring,realElapsed:elapsed});
    if(!paused&&exploring)blastDamage.processImpacts();
    blastDamage.update(elapsed,{paused:paused||!exploring,focus:driver});
    syncProps();
    nightFires.update(elapsed,environment,driver,paused);
    vehicle.update(simulationElapsed, { driver, night: environment.night, headlights: headlightsMode, braking: keys.has('b') || keys.has('ArrowDown') || keys.has('s'), time });
    projectLabels.update({yaw:orbitYaw,night:environment.night});
    carShadow.position.set(driver.x, .14 + (driver.groundHeight || 0), driver.z); carShadow.rotation.z = -driver.heading; carShadow.material.opacity=.15*Math.max(.08,1-driver.hop*.17);
    if (!reducedMotion && !paused) {
      animatedObjects.forEach(({ object, type }) => { if (type === 'coin') object.rotation.y = time * .45; else object.rotation.y = Math.sin(time * .3) * .3; });
      lanterns.forEach((lantern, i) => { lantern.rotation.z = Math.sin(time * .8 + i) * .12; });
      targetRing.scale.setScalar(1 + Math.sin(time * 4) * .08);
      for (const particle of dust) { particle.age += elapsed; if (particle.age < particle.life) { particle.object.position.x += particle.dx * elapsed; particle.object.position.z += particle.dz * elapsed; particle.object.position.y += elapsed * .25; particle.object.scale.setScalar((1 - particle.age / particle.life) * 1.7); } else particle.object.position.y = -10; }
    }
    // Driving leaves only the physical scene, with no navigation paint over the road.
    if(Math.abs(driver.speed)>.18||driver.hop>.05){routeLine.visible=false;targetRing.visible=false;}
    updateCamera(elapsed);
    if (++updateFrame % 5 === 0) {
      updateRoute();
      const nearest = exploring ? projects.reduce((best, project) => Math.hypot(driver.x - project.position[0], driver.z - project.position[1]) < Math.hypot(driver.x - best.position[0], driver.z - best.position[1]) ? project : best, projects[0]) : null;
      const newId = nearest && Math.hypot(driver.x - nearest.position[0], driver.z - nearest.position[1]) < Math.hypot(...nearest.footprint)/2+9 ? nearest.id : null;
      if (newId !== nearestId) { nearestId = newId; onNearby?.(nearestId); }
    }
    smoothedSpeed += (Math.abs(driver.speed) - smoothedSpeed) * Math.min(elapsed * 8, 1);
    onEnvironment?.(environment);
    onFrame?.({ x: driver.x, z: driver.z, heading: driver.heading, speed: smoothedSpeed, actualSpeed: driver.speed, rpm: driver.rpm, gear: driver.gear,throttle:driver.throttle, acceleration: driver.acceleration, hop:driver.hop, hydraulicPhase:driver.hydraulicPhase, elapsed, paused, weather: environment.weather,surface:drivingSurfaceAt(driver.x,driver.z),airborne:driver.airborne,boosting:driver.boosting,landingImpact:driver.landingImpact,carModel:vehicle.modelId,steering:driver.steering });
    renderer.render(scene, camera);
  }
  // Set the final overview before the first paint; avoid a camera fly-in at load.
  viewHeight = dimensions().targetHeight;
  lookAt.set(driver.x * .35, 0, driver.z * .35);
  updateCamera(1); renderer.render(scene, camera); animationId = requestAnimationFrame(animate);

  return {
    captureMap,teleportTo,setCarModel,getCarModel:()=>vehicle.modelId,
    start() { begin(); renderer.domElement.focus({ preventScroll: true }); },
    reset() { impactTimes.clear();driver.reset();driver.setVehicleProfile(vehicle.profile); navigation.clear(); resetView();blastDamage.reset();playground.reset(); physics.reset(); portalSystem.reset(); syncProps(); scenery.reset(); updateRoute(); onCancelRoute?.(); },
    overview() { exploring = false; driver.cancelRoute(); navigation.clear(); resetView(); driver.speed = 0; driver.hop = 0; driver.hopVelocity = 0; driver.jumpPending=false;driver.jumpCharge=0;driver.hydraulicOffset=0;driver.hydraulicVelocity=0;driver.hydraulicPhase='idle';driver.jumpCooldown=0;driver.landingTime=0;driver.groundHeight = Math.max(0, bridgeHeightAt(driver.x, driver.z) - .1); driver.groundVelocity = 0;driver.settle(); nearestId = null; onNearby?.(null); },
    setPaused(value) { paused = value; navigation.clear(); driver.speed = 0;driver.vx=0;driver.vz=0;driver.boosting=false; dust.forEach(p => { p.age = 1; p.object.position.y = -10; }); },
    setLanguage(value) { language = value === 'vi' ? 'vi' : 'en';projectLabels.setLanguage(language);wayfinding.setLanguage(language); renderer.domElement.setAttribute('aria-label', copy[language].canvasAria); translatedBoards.forEach(board => board.draw(copy[language][board.key])); },
    setKey(key, pressed) { if (paused) return; begin(); pressed ? keys.add(key) : keys.delete(key); },
    driveToProject(id) { const p = projects.find(p => p.id === id); if (!p) return; begin(); driver.navigate(p.stop, id); updateRoute(); },
    stopRoute() { driver.cancelRoute(); updateRoute(); },
    hydraulics(){if(!paused)return driver.toggleHydraulics();},
    jump() { if(!paused){begin();return driver.jump();}return false; },
    stopDriving,
    setNight(value) { environment = atmosphere.setTimeMode(value ? 'night' : 'day'); },
    setTimeMode(mode) { environment = atmosphere.setTimeMode(mode); return environment; },
    setWeather(mode) { environment = atmosphere.setWeather(mode); return environment; },
    setHeadlightsMode(mode) { if (['auto', 'on', 'off'].includes(mode)) headlightsMode = mode; },
    getEnvironment() { return atmosphere.getState(); },
    goToPlayground(id){const approach=PLAYGROUND_APPROACHES[id];if(!approach)return;begin();driver.navigate(approach.stop,null);driver.route.push(...approach.points.slice(1).map(point=>[...point]));driver.routeDurationLimit=driver.routeBudget();onCancelRoute?.();updateRoute();},
    goToPortal,
    zoomBy(amount) { zoomScale = clampZoom(zoomScale * Math.exp(amount)); },
    resetCamera: resetView,
    dispose() {
      cancelAnimationFrame(animationId); clearKeys();
      navigation.dispose(); window.removeEventListener('resize', resize); document.removeEventListener('visibilitychange', visibility);
      for (const [event, listener] of Object.entries(hoverListeners)) surface.removeEventListener(event, listener);
      // Snowman geometry is owned by islandLife even after its bodies are reparented.
      physics.bodies.filter(body=>body.kind==='snowman'||body.kind==='trash-can').forEach(body=>body.object.removeFromParent());
      blastDamage.dispose();projectLabels.dispose();scenery.bridgeGroups.forEach(({bridge})=>delete bridge.active);boundary.dispose();wayfinding.dispose();playground.dispose();nightFires.dispose();scenery.dispose(); atmosphere.dispose(); flyover.dispose(); vehicle.dispose(); islandLife.dispose(); detailedTrees.dispose();
      const geometries = new Set(); scene.traverse(o => { if (o.geometry) geometries.add(o.geometry); }); geometries.forEach(g => g.dispose());
      materials.forEach(m => m.dispose()); renderer.dispose(); renderer.domElement.remove();
    }
  };
}
