import { CAR_PIVOT_HEIGHT } from './aerial-dynamics.js';
import { createReferenceVehicle } from './toy-vehicles.js';
import { vehicleModel } from './vehicle-models.js';
export function createVehicle(options){
  const id=options.model||'explorer';
  const vehicle=id==='explorer'?createExplorer(options):createReferenceVehicle({...options,model:vehicleModel(id)});
  vehicle.modelId=id==='explorer'?'explorer':vehicleModel(id).id;vehicle.profile=vehicleModel(vehicle.modelId).profile;
  return vehicle;
}
function createExplorer({ THREE, scene, reducedMotion = false }) {
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
  const cube = new THREE.BoxGeometry(1, 1, 1), panels=new Map();
  function panelGeometry(w,h,d){
    const key=[w,h,d].join(':');if(panels.has(key))return panels.get(key);
    const b=Math.min(.018,w*.08,h*.08,d*.08),r=Math.min(.055,w*.1,h*.13),x=w/2-b,y=h/2-b,shape=new THREE.Shape();
    shape.moveTo(-x+r,-y);shape.lineTo(x-r,-y);shape.lineTo(x,-y+r);shape.lineTo(x,y-r);shape.lineTo(x-r,y);shape.lineTo(-x+r,y);shape.lineTo(-x,y-r);shape.lineTo(-x,-y+r);shape.closePath();
    const geometry=new THREE.ExtrudeGeometry(shape,{depth:d-2*b,steps:1,bevelEnabled:true,bevelSize:b,bevelThickness:b,bevelSegments:2,curveSegments:2});geometry.translate(0,0,-d/2+b);panels.set(key,geometry);return geometry;
  }

  function box(w, h, d, mat, parent = body, x = 0, y = 0, z = 0) { const beveled=(mat===paint||mat===highlight||mat===cream)&&w>.2&&h>.1&&d>.08;const mesh=add(beveled?panelGeometry(w,h,d):cube,mat,parent,x,y,z);if(!beveled)mesh.scale.set(w,h,d);return mesh; }
  function cylinder(radius, length, mat, parent, x, y, z, segments = 16) { return add(new THREE.CylinderGeometry(radius, radius, length, segments), mat, parent, x, y, z); }
  function sphere(radius, mat, parent, x, y, z) { return add(new THREE.SphereGeometry(radius, 12, 8), mat, parent, x, y, z); }
  const paint=new THREE.MeshPhysicalMaterial({color:'#fa5837',emissive:'#fa5837',emissiveIntensity:.015,roughness:.28,metalness:.14,clearcoat:.85,clearcoatRoughness:.22});paint.name='Coral visibility paint';allMaterials.add(paint);
  const highlight = material('#ff9857', {emissive:'#ff9857',emissiveIntensity:.015,roughness:.3,metalness:.12});
  const cream = material('#f0e5c9', {emissive:'#f0e5c9',emissiveIntensity:.01,roughness:.32,metalness:.08});cream.name='Ivory contrast roof';
  const charcoal = material('#242a2d', { roughness: .85, metalness: .08 });
  const metal = material('#adb6bb', { roughness: .26, metalness: .75 });
  const rubber = material('#14191b', { roughness: .98, metalness: 0 });
  const glass = material('#344e5a', {roughness:.1,metalness:.2,transparent:true,opacity:.68});
  const upholstery = material('#303334', { roughness: .95 });
  const headMaterial = material('#fff2c7', { emissive: '#ffd795', emissiveIntensity: .25, roughness: .18 });
  const tailMaterial = material('#b95742', { emissive: '#ff3423', emissiveIntensity: .12 });

  // Chassis, two-tone bodywork, hood creases, bumpers and a metal mesh grille.
  box(1.4, .2, 2.55, charcoal, body, 0, .39, 0);
  box(1.42, .46, 2.3, paint, body, 0, .72, 0);
  box(1.34, .2, .92, highlight, body, 0, 1.02, .77);
  box(.3,.012,.8,charcoal,body,0,1.127,.77);
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
  for(const x of [-.34,.34])box(.29,.2,.12,upholstery,body,x,1.59,-.55);
  box(.13,.32,.37,charcoal,body,0,1.02,-.22);

  // Roof rack, strapped expedition luggage, spare tire and an exhaust pipe.
  for (const x of [-.58, .58]) box(.06, .13, 1.3, metal, body, x, 1.94, -.2);
  for (let i = 0; i < 5; i++) box(1.22, .055, .04, charcoal, body, 0, 1.91, -.75 + i * .27);
  box(1.25, .09, .055, charcoal, body, 0, 2.04, -.84);
  box(1.25, .09, .055, charcoal, body, 0, 2.04, .44);
  for(const x of [-.45,.45])box(.035,.06,1.17,metal,body,x,1.99,-.2);
  const spare = cylinder(.31, .24, rubber, body, .22, 1.02, -1.28); spare.rotation.x = Math.PI / 2;
  const spareHub = cylinder(.13, .26, metal, body, .22, 1.02, -1.28); spareHub.rotation.x = Math.PI / 2;
  box(.3,.38,.15,charcoal,body,-.47,.97,-1.25);
  const exhaust = cylinder(.055, .46, metal, body, -.54, .35, -1.17, 8); exhaust.rotation.x = Math.PI / 2;

  const wheelPivots = [], wheelRollers = [], suspension = [], hydraulicRams=[],links=[];
  const reservoir=cylinder(.1,.4,metal,body,0,.35,-.3,12);reservoir.rotation.z=Math.PI/2;reservoir.name='hydraulic-pressure-reservoir';
  const rodGeometry=new THREE.CylinderGeometry(.025,.025,1,8),vertical=new THREE.Vector3(0,1,0),start=new THREE.Vector3(),end=new THREE.Vector3(),pivotOffset=new THREE.Vector3();
  const coilPoints=Array.from({length:71},(_,i)=>new THREE.Vector3(Math.cos(i/70*Math.PI*14)*.075,i/70-.5,Math.sin(i/70*Math.PI*14)*.075));
  const coilGeometry=new THREE.TubeGeometry(new THREE.CatmullRomCurve3(coilPoints),70,.013,5,false);
  for(const z of [-.77,.8]){const axle=cylinder(.07,1.6,charcoal,root,0,.45,z,12);axle.rotation.z=Math.PI/2;sphere(.14,charcoal,root,0,.45,z);}
  const treadGeometry = new THREE.BoxGeometry(.24, .055, .11); geometries.add(treadGeometry);
  for (const x of [-.8, .8]) for (const z of [-.77, .8]) {
    const pivot = new THREE.Group(); pivot.position.set(x, .45, z); root.add(pivot);
    const roller = new THREE.Group(); pivot.add(roller);
    const tire=add(new THREE.LatheGeometry([[.22,-.145],[.31,-.145],[.35,-.11],[.365,-.05],[.365,.05],[.35,.11],[.31,.145],[.22,.145]].map(([r,y])=>new THREE.Vector2(r,y)),32),rubber,roller); tire.rotation.z = Math.PI / 2;
    const outerRing = add(new THREE.TorusGeometry(.245, .035, 6, 24), charcoal, roller); outerRing.rotation.y = Math.PI / 2; outerRing.position.x = Math.sign(x) * .14;
    const rim = cylinder(.205, .265, metal, roller, 0, 0, 0, 16); rim.rotation.z = Math.PI / 2;
    const hub = cylinder(.075, .29, '#51685b', roller, 0, 0, 0, 10); hub.rotation.z = Math.PI / 2;
    for (let i = 0; i < 6; i++) {
      const angle = i / 6 * Math.PI * 2;
      const spoke = box(.03, .29, .035, metal, roller, Math.sign(x) * .15, 0, 0); spoke.rotation.x = angle;
      const lug = cylinder(.018, .31, charcoal, roller, 0, Math.sin(angle) * .11, Math.cos(angle) * .11, 5); lug.rotation.z = Math.PI / 2;
    }
    const tread = new THREE.InstancedMesh(treadGeometry, rubber, 24), dummy = new THREE.Object3D();
    for (let i = 0; i < 24; i++) { const angle = i / 24 * Math.PI * 2; dummy.position.set(0, Math.sin(angle) * .35, Math.cos(angle) * .35); dummy.rotation.set(-angle, 0, i % 2 ? .16 : -.16); dummy.updateMatrix(); tread.setMatrixAt(i, dummy.matrix); }
    tread.castShadow = true; roller.add(tread);
    const guard = add(new THREE.TorusGeometry(.41, .065, 6, 18, Math.PI), paint, body, x, .48, z); guard.rotation.y = Math.PI / 2;
    const spring=add(coilGeometry,metal,root,x*.66,.75,z);spring.scale.y=.6;
    const barrel=cylinder(.075,.36,charcoal,root,x*.77,.58,z,16);barrel.name='hydraulic-cylinder';
    const piston=cylinder(.034,1,metal,root,x*.77,.8,z,16);piston.name='hydraulic-piston';
    box(.17,.065,.17,metal,body,x*.77,.75,z);
    hydraulicRams.push({barrel,piston});
    for(const along of [-.16,.16]){const rod=add(rodGeometry,metal,root);rod.name='Articulated suspension link';links.push({rod,side:Math.sign(x),z,along});}

    wheelPivots.push({ pivot, front: z > 0, side: Math.sign(x), z }); wheelRollers.push(roller); suspension.push(spring);
  }
  const headLights = [];
  for (const x of [-.48, .48]) {
    box(.35,.23,.09,charcoal,body,x,.86,1.245);
    box(.29,.1,.025,headMaterial,body,x,.87,1.3);
    for(const lx of [-.09,0,.09])box(.045,.11,.032,headMaterial,body,x+lx,.87,1.32);
    box(.15,.045,.035,'#d7a554',body,x,.7,1.3);
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
  const antenna = new THREE.Group(); antenna.position.set(.57,1.79,-.7);body.add(antenna);cylinder(.009,.35,charcoal,antenna,0,.175,0,6);
  // Fine panel seams, vents and a visible underbody skid plate.
  for(const x of [-.721,.721]){for(const z of [-.77,-.25,.4])box(.009,.36,.012,charcoal,body,x,.84,z);for(let i=0;i<4;i++)box(.012,.018,.2,charcoal,body,x,1.05+i*.045,.79);}
  box(1.03,.045,1.9,metal,body,0,.275,-.05);
  for(const z of [-.7,.55])box(1.12,.09,.06,charcoal,body,0,.3,z);
  const boostMaterial=new THREE.MeshBasicMaterial({color:'#9cddff',transparent:true,opacity:.8,depthWrite:false,blending:THREE.AdditiveBlending,toneMapped:false});
  const rocketFlames=[];
  for(const x of [-.43,.43]){const nozzle=cylinder(.1,.23,charcoal,body,x,.56,-1.39,16);nozzle.rotation.x=Math.PI/2;const ring=add(new THREE.TorusGeometry(.087,.015,6,16),metal,body,x,.56,-1.51);const flame=add(new THREE.ConeGeometry(.11,1.25,12),boostMaterial,root,x,.98,-2.1);flame.rotation.x=-Math.PI/2;flame.name='Rocket boost exhaust';flame.userData.physicsIgnore=true;flame.visible=false;rocketFlames.push(flame);}


  let lastSpeed = 0, wheelAngle = 0, disposed = false;
  return {
    root, body, headLights, wheelPivots, hydraulicRams,
    update(dt, { driver, night = 0, headlights = 'auto', braking = false, time = 0 }) {
      const aerial=driver.attitude&&(driver.attitude.flying||driver.attitude.recovering);
      if(aerial){root.quaternion.copy(driver.attitude.rotation);pivotOffset.set(0,CAR_PIVOT_HEIGHT,0).applyQuaternion(root.quaternion);root.position.set(driver.x-pivotOffset.x,(driver.groundHeight||0)+driver.hop+(driver.attitude.supportLift||0)+CAR_PIVOT_HEIGHT-pivotOffset.y,driver.z-pivotOffset.z);}
      else{root.rotation.set(0,driver.heading,0);root.position.set(driver.x,(driver.groundHeight||0)+driver.hop,driver.z);}

      const acceleration = Math.max(-24, Math.min(24, (driver.speed - lastSpeed) / Math.max(dt, .001))); lastSpeed = driver.speed;
      const active = headlights === 'on' ? 1 : headlights === 'off' ? 0 : Math.max(.08, night);
      const darkness=Math.max(0,Math.min(1,night));paint.emissiveIntensity=.015+darkness*.12;highlight.emissiveIntensity=.015+darkness*.1;cream.emissiveIntensity=.01+darkness*.075;
      headLights.forEach(light => { light.intensity = 32 * active; });
      headMaterial.emissiveIntensity = .25 + active * 3;
      tailMaterial.emissiveIntensity = braking || acceleration < -2 ? 3.5 : .18 + night * .7;
      root.children.filter(object => object.name === 'headlight-beam').forEach(beam => { beam.material.opacity = active * night * .025; });
      const pitch = reducedMotion||aerial ? 0 : Math.max(-.2, Math.min(.2, (driver.pitch || 0) - acceleration * .004));
      const roll = reducedMotion||aerial ? 0 : Math.max(-.22, Math.min(.22, (driver.roll || 0) - driver.steering * driver.speed * .012));
      const lift=(driver.rideHeight??.42)+Math.max(-.29,Math.min(.52,driver.hydraulicOffset||0));
      body.position.y=lift;
      body.rotation.x += (pitch - body.rotation.x) * Math.min(dt * 9, 1);
      body.rotation.z += (roll - body.rotation.z) * Math.min(dt * 9, 1);
      wheelPivots.forEach(({ pivot, front, side, z },index) => {
        pivot.rotation.y = front ? driver.steering * .4 : 0;
        const corner = `${front ? 'front' : 'rear'}${side < 0 ? 'Left' : 'Right'}`;
        const surface = driver.wheelHeights?.[corner] ?? driver.groundHeight ?? 0;
        const travel = driver.attitude?.flying?0:Math.max(-.25,Math.min(.38,surface-(driver.groundHeight||0)));
        pivot.position.y = .45 + travel + (reducedMotion ? 0 : Math.sin(time * 11 + z * 4) * Math.abs(driver.speed) * .0018 + roll * side * .12);
        const ram=hydraulicRams[index],bottom=.43+travel,top=.75+lift;
        ram.barrel.position.y=bottom+.15;ram.piston.position.y=(bottom+top)/2;
        ram.piston.scale.y=Math.max(.08,top-bottom);
        suspension[index].position.y=(bottom+top)/2;
      });
      wheelAngle += driver.speed * Math.min(dt, .05) / .35;
      wheelRollers.forEach(roller => { roller.rotation.x = wheelAngle; });
      suspension.forEach(spring=>{spring.scale.y=Math.max(.18,.32+lift);});
      for(const link of links){start.set(link.side*.27,.55+lift,link.z+link.along);end.set(link.side*.78,.45,link.z);link.rod.position.copy(start).add(end).multiplyScalar(.5);link.rod.scale.y=start.distanceTo(end);link.rod.quaternion.setFromUnitVectors(vertical,end.sub(start).normalize());}
      headLights.forEach(light=>light.position.y=.85+lift);
      rocketFlames.forEach((flame,index)=>{flame.position.y=.56+lift;flame.visible=Boolean(driver.boosting);flame.scale.y=reducedMotion?1:.9+Math.sin(time*47+index)*.13;});

      steeringWheel.rotation.z = -driver.steering * .7;
      antenna.rotation.z = reducedMotion ? 0 : Math.sin(time * 7) * Math.abs(driver.speed) * .006;
    },
    dispose() { if (disposed) return; disposed = true; root.removeFromParent(); geometries.forEach(geometry => geometry.dispose()); allMaterials.forEach(mat => mat.dispose()); textures.forEach(texture => texture.dispose()); }
  };
}
