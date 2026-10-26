import * as THREE from './vendor/three.module.js';
import { createVehicle } from './vehicle.js';

const colors = { ink: '#444444', sage: '#a8a8a8', pale: '#dedede', cream: '#e6e6e6', gold: '#b6b6b6', wood: '#9f9f9f', glass: '#949494' };
const modes = new Set(['device', 'car', 'workbench', 'mail']);
const screens = ['project', 'stack', 'preview'];
const screenCopy = {
  en: { project: 'PROJECT NOTES', stack: 'BUILT WITH', hint: 'Click screen to explore', empty: 'Tools are listed in the project details.', more: 'more' },
  vi: { project: 'GHI CHÚ DỰ ÁN', stack: 'CÔNG NGHỆ SỬ DỤNG', hint: 'Nhấp màn hình để khám phá', empty: 'Công nghệ được liệt kê trong chi tiết dự án.', more: 'khác' }
};
const cleanText = value => typeof value === 'string' || typeof value === 'number' ? String(value).replace(/\s+/gu, ' ').trim().slice(0, 1600) : '';
const validLanguage = value => value === 'vi' ? 'vi' : 'en';

export function getShowcaseScreenContent(project = {}, language = project.language || 'en') {
  const localized = language === 'vi' && project.vi ? { ...project, ...project.vi } : project;
  return {
    title: cleanText(localized.title || localized.short), description: cleanText(localized.description),
    category: cleanText(localized.category), year: cleanText(localized.year),
    tech: Array.isArray(localized.tech) ? localized.tech.map(cleanText).filter(Boolean) : []
  };
}

// Break long tokens as well as sentences; no canvas text is allowed to run
// outside the screen, including localized titles and unbroken tool names.
export function wrapShowcaseText(context, value, maxWidth, { fontSize = 32, maxLines = 4 } = {}) {
  const measure = text => context.measureText?.(text)?.width ?? Array.from(text).length * fontSize * .56;
  const words = cleanText(value).split(' ').filter(Boolean), lines = [];
  let line = '';
  for (const word of words) {
    if (measure(line ? `${line} ${word}` : word) <= maxWidth) { line = line ? `${line} ${word}` : word; continue; }
    if (line) { lines.push(line); line = ''; }
    for (const char of Array.from(word)) {
      if (line && measure(line + char) > maxWidth) { lines.push(line); line = ''; }
      line += char;
    }
  }
  if (line) lines.push(line);
  if (lines.length <= maxLines) return lines;
  const result = lines.slice(0, maxLines); let last = result.at(-1);
  while (last && measure(`${last}…`) > maxWidth) last = Array.from(last).slice(0, -1).join('');
  result[result.length - 1] = `${last}…`; return result;
}

export function createShowcaseScreenTexture({ project = {}, screen = 'project', language = project.language || 'en', night = false, width = 1024, height = 640, namespace = THREE } = {}) {
  if (!['project', 'stack'].includes(screen)) return null;
  let canvas, context;
  try { canvas = globalThis.document?.createElement('canvas'); context = canvas?.getContext('2d'); } catch { return null; }
  if (!context || typeof context.fillText !== 'function' || typeof context.fillRect !== 'function') return null;
  canvas.width = width; canvas.height = height;
  const content = getShowcaseScreenContent(project, language), copy = screenCopy[validLanguage(language)];
  const palette = night ? { background: '#2e2e2e', card: '#424242', ink: '#eeeeee', muted: '#cccccc', accent: '#c6c6c6' } : { background: '#ededed', card: '#e3e3e3', ink: '#3c3c3c', muted: '#5e5e5e', accent: '#5c5c5c' };
  const margin = 62, usable = width - margin * 2;
  const text = (value, x, y, size, color = palette.ink, weight = 400, maxWidth = usable, maxLines = 1) => {
    context.font = `${weight} ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`; context.fillStyle = color;
    const lines = wrapShowcaseText(context, value, maxWidth, { fontSize: size, maxLines });
    lines.forEach((line, index) => context.fillText(line, x, y + index * size * 1.25)); return lines.length * size * 1.25;
  };
  context.fillStyle = palette.background; context.fillRect(0, 0, width, height); context.textBaseline = 'top'; context.textAlign = 'left';
  text(copy[screen], margin, 38, 25, palette.accent, 650);
  context.fillStyle = palette.accent; context.fillRect(margin, 84, 42, 4);
  const titleHeight = text(content.title, margin, 111, screen === 'project' ? 58 : 49, palette.ink, 650, usable, 2);
  if (screen === 'project') {
    const metaY = 111 + titleHeight + 15;
    text([content.category, content.year].filter(Boolean).join('  /  '), margin, metaY, 28, palette.muted, 500, usable, 2);
    const bodyY = metaY + 88, available = height - bodyY - 87;
    text(content.description, margin, bodyY, 33, palette.ink, 400, usable, Math.max(2, Math.floor(available / 41.25)));
  } else {
    const top = 111 + titleHeight + 28, bottom = height - (content.tech.length > 8 ? 119 : 83);
    const tools = content.tech.slice(0, 8), count = tools.length || 1, rows = Math.ceil(count / 2), gap = 16, cellWidth = (usable - gap) / 2;
    const cellHeight = Math.min(94, (bottom - top - (rows - 1) * gap) / rows);
    if (!tools.length) text(copy.empty, margin, top, 32, palette.muted, 400, usable, 3);
    tools.forEach((tool, index) => {
      const x = margin + (index % 2) * (cellWidth + gap), y = top + Math.floor(index / 2) * (cellHeight + gap);
      context.fillStyle = palette.card; context.fillRect(x, y, cellWidth, cellHeight);
      const size = Math.min(34, Math.max(24, cellHeight - 24));
      text(tool, x + 22, y + (cellHeight - size * 1.15) / 2, size, palette.ink, 550, cellWidth - 44, 1);
    });
    if (content.tech.length > tools.length) text(`+${content.tech.length - tools.length} ${copy.more}`, margin, height - 88, 24, palette.muted);
  }
  context.fillStyle = palette.card; context.fillRect(margin, height - 57, usable, 1);
  text(copy.hint, margin, height - 39, 22, palette.muted, 500);
  const texture = new namespace.CanvasTexture(canvas); texture.colorSpace = namespace.SRGBColorSpace; texture.minFilter = namespace.LinearFilter; texture.magFilter = namespace.LinearFilter; texture.generateMipmaps = false;
  texture.userData.showcase = { screen, language: validLanguage(language), night: !!night, content };
  return texture;
}

export function resolveShowcasePoster(project = {}, baseURL = globalThis.document?.baseURI || new URL('../', import.meta.url).href) {
  if(project.poster){try{return new URL(project.poster,baseURL).href;}catch{}}
  return new URL(`./assets/posters/${project.id || 'hr'}.jpg`,import.meta.url).href;
}

export function hitShowcaseScreen({ model, camera, clientX, clientY, rect }) {
  if (!model?.screen || !camera || !rect || rect.width <= 0 || rect.height <= 0 || clientX < rect.left || clientX > rect.left + rect.width || clientY < rect.top || clientY > rect.top + rect.height) return false;
  model.root.updateMatrixWorld(true); camera.updateMatrixWorld();
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(new THREE.Vector2((clientX - rect.left) / rect.width * 2 - 1, -(clientY - rect.top) / rect.height * 2 + 1), camera);
  return raycaster.intersectObject(model.screen, false).length > 0;
}

export function isShowcaseScreenTap(gesture, event) {
  return !!gesture?.screen && event.type==='pointerup' && event.pointerId===gesture.id && !gesture.dragged && Math.hypot(event.clientX-gesture.x,event.clientY-gesture.y)<=6;
}

// Geometry and resource ownership are separate from WebGL, so models can be
// verified without a browser and every panel can release its own resources.
export function buildShowcaseModel({ project = {}, mode = 'device', carModel='explorer', texture = null, screen = 'preview', language = project.language || 'en', namespace = THREE } = {}) {
  const T = namespace;
  const root = new T.Group(); root.name = `Portfolio artifact: ${mode}/${project.id || 'longd'}`;
  const content = new T.Group(); root.add(content);
  const geometries = new Set(), materials = new Set(), cache = new Map();
  let vehicle = null, screenMaterial = null, screenObject = null, informationTexture = null, disposed = false, night = false, lights = 'auto';
  let selectedScreen = screens.includes(screen) ? screen : 'project', selectedLanguage = validLanguage(language), previewTexture = texture;
  const mat = (color, options = {}) => {
    const key = color + JSON.stringify(options);
    if (!cache.has(key)) { const result = new T.MeshStandardMaterial({ color, roughness: .58, metalness: .08, ...options }); cache.set(key, result); materials.add(result); }
    return cache.get(key);
  };
  const cube = new T.BoxGeometry(1, 1, 1); geometries.add(cube);
  function mesh(geometry, material, parent = content, x = 0, y = 0, z = 0) {
    geometries.add(geometry);
    const resolved = typeof material === 'string' ? mat(material) : material; materials.add(resolved);
    const object = new T.Mesh(geometry, resolved); object.position.set(x, y, z); object.castShadow = true; object.receiveShadow = true; parent.add(object); return object;
  }
  function box(w, h, d, material, parent = content, x = 0, y = 0, z = 0) { const object = mesh(cube, material, parent, x, y, z); object.scale.set(w, h, d); return object; }
  function cylinder(radius, height, material, parent = content, x = 0, y = 0, z = 0, segments = 24) { return mesh(new T.CylinderGeometry(radius, radius, height, segments), material, parent, x, y, z); }
  function sphere(radius, material, parent = content, x = 0, y = 0, z = 0) { return mesh(new T.IcosahedronGeometry(radius, 1), material, parent, x, y, z); }
  function rounded(w, h, d, material, parent = content, x = 0, y = 0, z = 0, radius = .12) {
    const r = Math.min(radius, w / 3, h / 3), shape = new T.Shape();
    shape.moveTo(-w/2+r,-h/2); shape.lineTo(w/2-r,-h/2); shape.quadraticCurveTo(w/2,-h/2,w/2,-h/2+r);
    shape.lineTo(w/2,h/2-r); shape.quadraticCurveTo(w/2,h/2,w/2-r,h/2); shape.lineTo(-w/2+r,h/2);
    shape.quadraticCurveTo(-w/2,h/2,-w/2,h/2-r); shape.lineTo(-w/2,-h/2+r); shape.quadraticCurveTo(-w/2,-h/2,-w/2+r,-h/2);
    return mesh(new T.ExtrudeGeometry(shape, { depth:d, bevelEnabled:true, bevelSize:.025, bevelThickness:.025, bevelSegments:2, steps:1, curveSegments:6 }), material, parent, x, y, z-d/2);
  }
  function paper(parent, x, y, z, width = 1.15, depth = 1.48, index = 0) {
    const sheet = box(width, .035, depth, index % 2 ? '#dddddd' : '#ededed', parent, x, y, z); sheet.rotation.y = (index - 1) * .06; return sheet;
  }
  function plant(x, z, scale = 1) {
    const pot = mesh(new T.CylinderGeometry(.25,.19,.4,12), colors.wood, content, x, .24, z);
    const leaves = new T.Group(); leaves.position.set(x,.46,z); content.add(leaves);
    for(let i=0;i<5;i++) { const leaf = sphere(.22, ['#949494','#a5a5a5','#b1b1b1'][i%3], leaves, Math.sin(i*2.4)*.18, .15+Math.cos(i)*.08, Math.cos(i*2.4)*.18); leaf.scale.set(.55,1.6,.7); leaf.rotation.z=Math.sin(i)*.55; }
    pot.scale.setScalar(scale); leaves.scale.setScalar(scale); return leaves;
  }
  function keyboard(parent, width = 3.8, depth = 1.2, x = 0, y = .2, z = .9) {
    const deck = rounded(width,.11,depth,colors.pale,parent,x,y,z,.08);
    const keyGeometry = new T.BoxGeometry(.21,.025,.14); geometries.add(keyGeometry);
    const keys = new T.InstancedMesh(keyGeometry, mat('#c9c9c9'), 42); keys.castShadow=true; const dummy = new T.Object3D();
    for(let row=0;row<3;row++) for(let column=0;column<14;column++){dummy.position.set(x-width*.41+column*width*.063,y+.09,z-depth*.25+row*.19);dummy.updateMatrix();keys.setMatrixAt(row*14+column,dummy.matrix);}
    parent.add(keys); box(.9,.02,.2,'#bfbfbf',parent,x,y+.1,z+.43); return deck;
  }
  function display({ width=3.9,height=2.45,laptop=false,tablet=false } = {}) {
    const device = new T.Group(); device.position.set(0,laptop?1.72:1.92,tablet?-.12:-.2); device.rotation.x=-.09; content.add(device);
    rounded(width+.23,height+.25,.2,colors.cream,device);
    rounded(width+.08,height+.1,.075,colors.ink,device,0,0,.14,.09);
    screenMaterial = new T.MeshBasicMaterial({ color:texture?'#ffffff':'#dadada',map:texture,toneMapped:false }); materials.add(screenMaterial);
    // The beveled inner frame reaches z=.2025; the image must sit in front
    // of that opaque face, including when the monitor is turned slightly.
    const screen = mesh(new T.PlaneGeometry(width,height),screenMaterial,device,0,0,.215); screen.name='Original project preview'; screen.userData.showcaseScreen=true; screen.castShadow=false; screen.receiveShadow=false;screenObject=screen;
    const cameraDot = sphere(.023,colors.ink,device,0,height/2+.07,.214); cameraDot.castShadow=false;
    if(laptop){keyboard(content,width+.31,1.8,0,.28,.7);box(width+.25,.08,.11,colors.sage,content,0,.44,-.09);}
    else if(tablet){const kickstand=box(1.4,.08,1.1,colors.sage,content,0,.45,-.45);kickstand.rotation.x=.22;}
    else {box(.2,1.05,.2,colors.sage,content,0,.74,-.25);const foot=cylinder(.81,.08,colors.pale,content,0,.2,-.25);foot.scale.set(1.3,1,.65);keyboard(content,3.2,.9,0,.19,1.13);}
    return device;
  }
  function teamBadge() {
    const badge=new T.Group();content.add(badge);badge.position.set(-2.2,.65,.88);badge.rotation.set(-.06,0,-.13);
    rounded(.85,1.13,.065,colors.cream,badge,0,.16,0,.09);box(.28,.13,.09,colors.sage,badge,0,.77,0);
    sphere(.12,colors.sage,badge,0,.39,.06);const torso=sphere(.2,colors.sage,badge,0,.15,.055);torso.scale.set(1,.5,.15);
    for(let i=0;i<2;i++)box(.43,.025,.02,'#c1c1c1',badge,0,-.08-i*.12,.05);
    const loop=mesh(new T.TorusGeometry(.23,.028,5,28,Math.PI),colors.gold,badge,0,.95,0);loop.rotation.z=0;
    for(let i=0;i<3;i++){const token=cylinder(.19,.06,['#959595','#acacac','#c0c0c0'][i],content,1.95+i*.24,.27+i*.045,.82);token.rotation.x=.08;}
  }
  function chartAndCoins() {
    for(let i=0;i<4;i++){const height=[.45,.85,.66,1.2][i];box(.22,height,.32,['#b8b8b8','#aaaaaa','#a0a0a0','#bdbdbd'][i],content,-2.45+i*.32,.18+height/2,.75);}
    for(let i=0;i<3;i++){const coin=cylinder(.28,.08,colors.gold,content,2.22,.26+i*.1,.7);coin.rotation.z=.06;}
    const standing=cylinder(.48,.11,colors.gold,content,2.26,.95,.5);standing.rotation.x=Math.PI/2;standing.rotation.z=.18;
    const ring=mesh(new T.TorusGeometry(.32,.02,5,30),'#d7d7d7',standing,0,.066,0);ring.rotation.x=Math.PI/2;
  }
  function documents() {
    for(let i=0;i<5;i++)paper(content,-2.05,.23+i*.046,1.05,1.05,1.3,i);
    const clip=box(.37,.06,.15,colors.sage,content,-2.05,.48,.52);
    const pen=cylinder(.035,1.3,colors.ink,content,2.03,.26,1.08,10);pen.rotation.z=Math.PI/2;pen.rotation.y=-.32;
    const nib=mesh(new T.ConeGeometry(.035,.17,8),colors.gold,content,2.65,.26,.87);nib.rotation.z=-Math.PI/2;
    for(let i=0;i<2;i++)box(.86,.025,.02,'#b9b9b9',content,-2.05,.48,.88+i*.2).rotation.x=-Math.PI/2;
  }
  function archiveBox() {
    const archive=new T.Group();archive.position.set(2.15,.21,.7);archive.rotation.y=-.2;content.add(archive);
    rounded(1.04,1.0,.94,'#afafaf',archive,0,.5,0,.06);box(1.14,.13,1.03,'#c5c5c5',archive,0,1.06,0);
    box(.13,.92,.026,'#838383',archive,0,.51,.49);for(let i=0;i<7;i++)box(.18,.025,.03,'#dfdfdf',archive,i%2?.025:-.025,.15+i*.12,.515);
    const handle=mesh(new T.TorusGeometry(.18,.025,5,20,Math.PI),colors.ink,archive,0,1.19,0);
    const paperStack=new T.Group();paperStack.position.set(-2.2,0,.95);content.add(paperStack);for(let i=0;i<4;i++)paper(paperStack,0,.23+i*.045,0,.93,1.05,i);
  }
  function lanterns() {
    const stand=new T.Group();stand.position.set(2.1,.2,.2);content.add(stand);
    box(.48,.08,.48,colors.sage,stand,0,.04,0);cylinder(.035,2.5,colors.wood,stand,0,1.28,0,8);box(1.18,.07,.08,colors.wood,stand,-.4,2.5,0);
    for(let i=0;i<2;i++){const x=-.35-i*.6;cylinder(.009,.32,colors.ink,stand,x,2.31,0,4);const globe=sphere(.23,['#a5a5a5','#bfbfbf'][i],stand,x,1.97,0);globe.scale.set(.85,1.18,.85);box(.12,.055,.12,colors.wood,stand,x,1.69,0);}
    const postcard=rounded(.87,1.04,.035,colors.cream,content,-2.02,.7,1.03,.05);postcard.rotation.z=.12;
    const roof=mesh(new T.ConeGeometry(.38,.3,4),colors.wood,content,-2.02,.8,1.07);roof.rotation.y=Math.PI/4;roof.scale.z=.12;
    box(.52,.35,.035,colors.gold,content,-2.02,.53,1.07);
  }
  function architecture() {
    const building=new T.Group();building.position.set(2.08,.2,.76);building.rotation.y=-.13;content.add(building);
    box(1.2,.12,1.04,colors.pale,building,0,.06,0);box(1.02,.85,.73,colors.cream,building,0,.54,0);
    for(const x of[-.36,0,.36]){cylinder(.035,.73,colors.pale,building,x,.52,.44,8);for(let row=0;row<2;row++)box(.14,.17,.02,colors.glass,building,x,.33+row*.32,.38);}
    const pediment=mesh(new T.ConeGeometry(.76,.44,4),colors.sage,building,0,1.15,0);pediment.rotation.y=Math.PI/4;pediment.scale.z=.75;
    plant(-2.1,.8,.95);
  }
  function workbench() {
    display({width:3.6,height:2.25});plant(-2.1,.6);
    for(let i=0;i<3;i++){const book=box(.95,.15,1.25,['#adadad','#aaaaaa','#d4d4d4'][i],content,2.07,.25+i*.16,.83);book.rotation.y=(i-1)*.07;}
    const mug=cylinder(.22,.42,colors.cream,content,-1.8,.38,1.35,20);const handle=mesh(new T.TorusGeometry(.14,.035,6,18),colors.cream,content,-1.51,.4,1.35);handle.rotation.y=Math.PI/2;
  }
  function mail() {
    const envelope=new T.Group();envelope.position.set(0,1.37,0);envelope.rotation.z=-.08;content.add(envelope);
    rounded(3.55,2.14,.18,colors.cream,envelope,0,-.13,0,.1);
    rounded(2.9,2.48,.055,'#ededed',envelope,0,.67,-.1,.06);
    for(let i=0;i<4;i++)box(i===3?1.4:2.13,.035,.015,'#b7b7b7',envelope,i===3?-.35:0,1.43-i*.25,-.058);
    const triangle=(points,color,z)=>{const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(points.flatMap(([x,y])=>[x,y,z]),3));geometry.computeVertexNormals();return mesh(geometry,mat(color,{side:T.DoubleSide}),envelope);};
    triangle([[-1.76,.88],[0,-.19],[-1.76,-1.18]],'#dcdcdc',.12);triangle([[1.76,.88],[1.76,-1.18],[0,-.19]],'#dfdfdf',.13);triangle([[-1.76,-1.18],[1.76,-1.18],[0,.13]],'#e4e4e4',.15);
    const seal=cylinder(.26,.04,colors.gold,envelope,0,-.12,.19,32);seal.rotation.x=Math.PI/2;
    for(let i=0;i<6;i++){const petal=sphere(.052,'#dedede',envelope,Math.sin(i*Math.PI/3)*.115,-.12+Math.cos(i*Math.PI/3)*.115,.222);petal.scale.z=.25;}
    const stamp=rounded(.44,.53,.018,colors.sage,envelope,1.12,1.19,-.04,.03);stamp.rotation.z=.08;
  }

  const pedestalMaterial=mat('#dbdbdb',{roughness:.82});
  const pedestal=cylinder(mode==='car'?2.15:3.0,.12,pedestalMaterial,root,0,.03,0,64);pedestal.scale.z=mode==='car'?1:.76;
  if(mode==='car') {
    vehicle=createVehicle({THREE:T,scene:content,reducedMotion:true,model:carModel});vehicle.root.rotation.y=-.28;
  } else if(mode==='mail') mail();
  else if(mode==='workbench') workbench();
  else {
    const type=project.id||'hr';
    display(type==='ceremony'?{width:2.9,height:2.7,tablet:true}:type==='compressor'?{width:3.0,height:2.75}:{width:3.75,height:2.22,laptop:['hr','contracts','icue'].includes(type)});
    ({hr:teamBadge,crypto:chartAndCoins,contracts:documents,compressor:archiveBox,ceremony:lanterns,icue:architecture}[type]||teamBadge)();
  }
  root.updateMatrixWorld(true);
  const focusBounds=new T.Box3();
  if(vehicle){vehicle.body.position.y=vehicle.profile.raised;focusBounds.setFromObject(vehicle.body);focusBounds.expandByScalar(.22);}
  else focusBounds.setFromObject(content);
  const driver={x:0,z:0,heading:-.28,speed:0,distance:0,steering:0,groundHeight:0,hop:0,pitch:0,roll:0};
  function updateScreen() {
    if(!screenMaterial||disposed)return;
    const previous=informationTexture;
    const aspect=screenObject.geometry.parameters.width/screenObject.geometry.parameters.height;
    informationTexture=createShowcaseScreenTexture({project,screen:selectedScreen,language:selectedLanguage,night,width:1024,height:Math.round(1024/aspect),namespace:T});
    applyTexture();previous?.dispose();
  }
  function applyTexture(){if(screenMaterial){const nextTexture=informationTexture||previewTexture;screenMaterial.map=nextTexture;screenMaterial.color.set(nextTexture?'#ffffff':'#dadada');screenMaterial.needsUpdate=true;}}
  updateScreen();
  return {
    root, content, focusBounds, screenMaterial, screen:screenObject,
    get screenReady(){return !!screenMaterial?.map;},
    getScreen(){return selectedScreen;},
    setScreen(value){if(disposed||!screens.includes(value)||selectedScreen===value)return;selectedScreen=value;updateScreen();},
    setLanguage(value){const next=validLanguage(value);if(disposed||next===selectedLanguage)return;selectedLanguage=next;updateScreen();},
    setTexture(nextTexture) { if(disposed)return;previewTexture=nextTexture;applyTexture(); },
    setTheme(value){const changed=night!==!!value;night=!!value;pedestalMaterial.color.set(night?'#585858':'#dbdbdb');if(changed)updateScreen();},
    setHeadlights(value){if(['auto','on','off'].includes(value))lights=value;},
    update(dt,time=0){vehicle?.update(dt,{driver,night:night ? .85 : 0,headlights:lights,time});},
    dispose(){if(disposed)return;disposed=true;vehicle?.dispose();informationTexture?.dispose();root.removeFromParent();geometries.forEach(geometry=>geometry.dispose());materials.forEach(material=>material.dispose());}
  };
}

export function createShowcase({ container, project = {}, mode = 'device', carModel='explorer', screen = 'project', screenModes = screens, language = project.language || 'en', onScreenChange, night = false, reducedMotion = false } = {}) {
  const allowedScreens=[...new Set((Array.isArray(screenModes)?screenModes:screens).filter(value=>screens.includes(value)))];
  if(!allowedScreens.length)allowedScreens.push('project');
  const initialScreen=allowedScreens.includes(screen)?screen:allowedScreens[0];
  if(!container) return {setProject(){},setMode(){},setTheme(){},setHeadlights(){},setScreen(){},setLanguage(){},getScreen(){return initialScreen;},resetView(){},dispose(){}};
  let renderer=null,scene=null,camera=null,model=null,disposed=false,failed=false,visible=true,raf=0,observer=null,intersection=null;
  let currentProject=project,currentMode=modes.has(mode)?mode:'device',currentScreen=initialScreen,currentLanguage=validLanguage(language),dark=!!night,headlights='auto',request=0;
  let yaw=0,pitch=0,targetYaw=0,targetPitch=0,pointer=null,clock=0,lastTime=0;
  const textures=new Map(),ownedTextures=new Set();
  const removeReady=()=>{container.classList.remove('showcase-ready');container.dataset.ready='false';};
  const markReady=()=>{if(renderer&&model&&(!model.screen||model.screenReady)&&!disposed){container.classList.add('showcase-ready');container.dataset.ready='true';}else removeReady();};
  function loadPoster(){
    const generation=++request;
    if(!model?.screen)return;
    const url=resolveShowcasePoster(currentProject);
    if(textures.has(url)){model?.setTexture(textures.get(url));return;}
    try {
      new THREE.TextureLoader().load(url,texture=>{
        if(disposed){texture.dispose();return;}
        texture.colorSpace=THREE.SRGBColorSpace;texture.minFilter=THREE.LinearFilter;
        ownedTextures.add(texture);textures.set(url,texture);
        if(generation!==request)return;
        model?.setTexture(texture);draw();
      },undefined,()=>{if(generation===request&&!model?.screenReady)removeReady();});
    } catch { if(!model?.screenReady)removeReady(); }
  }
  function rebuild(){
    if(!scene||disposed)return;removeReady();model?.dispose();model=buildShowcaseModel({project:currentProject,carModel,mode:currentMode,screen:currentScreen,language:currentLanguage});
    model.setTheme(dark);model.setHeadlights(headlights);model.update(0,clock);scene.add(model.root);yaw=pitch=targetYaw=targetPitch=0;loadPoster();resize();draw();
  }
  function fit(){
    if(!model||!camera)return;
    const bounds=model.focusBounds,center=bounds.getCenter(new THREE.Vector3());
    camera.position.copy(center).add(new THREE.Vector3(5,3.3,8));camera.lookAt(center);camera.updateMatrixWorld();
    let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
    for(const x of[bounds.min.x,bounds.max.x])for(const y of[bounds.min.y,bounds.max.y])for(const z of[bounds.min.z,bounds.max.z]){
      const point=new THREE.Vector3(x,y,z).applyMatrix4(camera.matrixWorldInverse);minX=Math.min(minX,point.x);maxX=Math.max(maxX,point.x);minY=Math.min(minY,point.y);maxY=Math.max(maxY,point.y);
    }
    const aspect=Math.max(.2,container.clientWidth/Math.max(1,container.clientHeight)),height=Math.max(maxY-minY,(maxX-minX)/aspect)*1.13;
    camera.left=-height*aspect/2;camera.right=height*aspect/2;camera.top=height/2;camera.bottom=-height/2;camera.updateProjectionMatrix();
  }
  function draw(){if(!renderer||!scene||!camera||disposed||container.clientWidth<2||container.clientHeight<2)return;renderer.render(scene,camera);markReady();}
  function start(){
    if(disposed||failed||renderer||container.clientWidth<2||container.clientHeight<2)return;
    try {
      renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'low-power'});
      renderer.setPixelRatio(Math.min(globalThis.devicePixelRatio||1,1.6));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
      renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=dark?1:1.13;
      renderer.domElement.setAttribute('aria-hidden','true');renderer.domElement.tabIndex=-1;renderer.domElement.style.touchAction='none';container.append(renderer.domElement);
      scene=new THREE.Scene();camera=new THREE.OrthographicCamera(-3,3,2,-2,.1,50);
      scene.add(new THREE.HemisphereLight('#f9f9f9','#909090',2));
      const key=new THREE.DirectionalLight('#f2f2f2',2.6);key.position.set(-4,7,5);key.castShadow=true;key.shadow.mapSize.set(1024,1024);Object.assign(key.shadow.camera,{left:-6,right:6,top:7,bottom:-5,near:.1,far:20});key.shadow.normalBias=.025;scene.add(key);
      const rim=new THREE.DirectionalLight('#d3d3d3',1.2);rim.position.set(5,4,-4);scene.add(rim);
      rebuild();resume();
    } catch {
      failed=true;stop();renderer?.dispose();renderer?.domElement.remove();renderer=null;model?.dispose();model=null;removeReady();
    }
  }
  function canAnimate(){return !disposed&&renderer&&model&&visible&&!globalThis.document?.hidden&&container.clientWidth>=2&&container.clientHeight>=2;}
  function stop(){if(raf)globalThis.cancelAnimationFrame?.(raf);raf=0;}
  function resume(){if(!raf&&canAnimate()){lastTime=performance.now();raf=requestAnimationFrame(animate);}}
  function visibility(){if(canAnimate()){draw();resume();}else stop();}
  function resize(){if(disposed)return;if(!renderer){start();return;}const width=container.clientWidth,height=container.clientHeight;if(width<2||height<2){stop();return;}renderer.setSize(width,height);fit();draw();resume();}
  function animate(now){
    raf=0;if(!canAnimate())return;const dt=Math.min(.05,Math.max(0,(now-lastTime)/1000));lastTime=now;
    clock+=dt;const damping=1-Math.exp(-dt*7);yaw+=(targetYaw-yaw)*damping;pitch+=(targetPitch-pitch)*damping;
    model.root.rotation.y=yaw;model.root.rotation.x=pitch;model.root.position.y=reducedMotion?0:Math.sin(clock*.7)*.035;
    model.update(dt,clock);draw();if(canAnimate())raf=requestAnimationFrame(animate);
  }
  function setScreen(value){
    if(disposed||!allowedScreens.includes(value)||value===currentScreen)return;
    currentScreen=value;container.dataset.screen=value;removeReady();model?.setScreen(value);draw();
    if(typeof onScreenChange==='function')onScreenChange(value);
  }
  const hitScreen=event=>hitShowcaseScreen({model,camera,clientX:event.clientX,clientY:event.clientY,rect:container.getBoundingClientRect()});
  function down(event){
    if(event.button!==0||event.target?.closest?.('button,a,input,select,textarea'))return;
    if(pointer){pointer.dragged=true;return;}
    event.preventDefault();pointer={id:event.pointerId,x:event.clientX,y:event.clientY,yaw:targetYaw,pitch:targetPitch,screen:hitScreen(event),dragged:false};
    try{container.setPointerCapture(event.pointerId);}catch{}
  }
  function move(event){
    if(!pointer){if(reducedMotion)return;const rect=container.getBoundingClientRect();targetYaw=(event.clientX-rect.left-rect.width/2)/Math.max(1,rect.width)*.18;targetPitch=(event.clientY-rect.top-rect.height/2)/Math.max(1,rect.height)*.06;return;}
    if(event.pointerId!==pointer.id)return;event.preventDefault();if(Math.hypot(event.clientX-pointer.x,event.clientY-pointer.y)>6)pointer.dragged=true;targetYaw=THREE.MathUtils.clamp(pointer.yaw+(event.clientX-pointer.x)*.004,-.45,.45);targetPitch=THREE.MathUtils.clamp(pointer.pitch+(event.clientY-pointer.y)*.002,-.13,.13);
  }
  function up(event){
    if(pointer?.id!==event.pointerId)return;
    const gesture=pointer;pointer=null;
    try{if(container.hasPointerCapture?.(event.pointerId))container.releasePointerCapture(event.pointerId);}catch{}
    if(isShowcaseScreenTap(gesture,event)&&hitScreen(event))setScreen(allowedScreens[(allowedScreens.indexOf(currentScreen)+1)%allowedScreens.length]);
  }
  function leave(){if(!pointer){targetYaw=0;targetPitch=0;}}
  const listeners={pointerdown:down,pointermove:move,pointerup:up,pointercancel:up,lostpointercapture:up,pointerleave:leave};
  for(const[name,listener]of Object.entries(listeners))container.addEventListener(name,listener);
  if(typeof ResizeObserver!=='undefined'){observer=new ResizeObserver(resize);observer.observe(container);}else globalThis.window?.addEventListener('resize',resize);
  if(typeof IntersectionObserver!=='undefined'){intersection=new IntersectionObserver(entries=>{visible=entries.some(entry=>entry.isIntersecting);visibility();});intersection.observe(container);}
  globalThis.document?.addEventListener?.('visibilitychange',visibility);
  container.dataset.screen=currentScreen;removeReady();start();
  return {
    setProject(value){if(disposed)return;currentProject=value||{};if(currentProject.language)currentLanguage=validLanguage(currentProject.language);if(renderer)rebuild();},
    setMode(value){if(disposed||!modes.has(value)||value===currentMode)return;currentMode=value;if(renderer)rebuild();},
    setScreen,
    getScreen(){return currentScreen;},
    setLanguage(value){if(disposed)return;currentLanguage=validLanguage(value);model?.setLanguage(currentLanguage);removeReady();draw();},
    setTheme(value){dark=!!value;model?.setTheme(dark);model?.update(0,clock);if(renderer)renderer.toneMappingExposure=dark?1:1.13;draw();},
    setHeadlights(value){if(!['auto','on','off'].includes(value))return;headlights=value;model?.setHeadlights(value);model?.update(0,clock);draw();},
    resetView(){targetYaw=targetPitch=yaw=pitch=0;if(model){model.root.rotation.set(0,0,0);model.root.position.y=0;}fit();draw();},
    dispose(){if(disposed)return;disposed=true;++request;stop();observer?.disconnect();intersection?.disconnect();globalThis.document?.removeEventListener?.('visibilitychange',visibility);globalThis.window?.removeEventListener('resize',resize);for(const[name,listener]of Object.entries(listeners))container.removeEventListener(name,listener);model?.dispose();ownedTextures.forEach(texture=>texture.dispose());scene?.traverse(object=>object.shadow?.dispose());renderer?.dispose();renderer?.domElement.remove();removeReady();}
  };
}
