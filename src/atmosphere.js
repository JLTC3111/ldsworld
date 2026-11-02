import { EnvironmentClock } from './environment-state.js';

/** A small, deterministic atmosphere. It owns no application theme or project state. */
export function createAtmosphere({ THREE, scene, renderer, sun, hemisphere, fill, sea, camera:skyCamera, coarse = false, reducedMotion = false }) {
  const clock = new EnvironmentClock();
  const root = new THREE.Group(); root.name = 'island-atmosphere'; scene.add(root);
  const groundDetails=new THREE.Group();groundDetails.name='Weather ground patches';scene.add(groundDetails);
  const geometries = new Set(), materials = new Set();
  const ownGeometry = geometry => { geometries.add(geometry); return geometry; };
  const ownMaterial = material => { materials.add(material); return material; };
  const counts = {
    rain: 0,
    snow: 0,
    stars: coarse ? 110 : 230,
    splashes: 0
  };
  let seed = 6299;
  const random = () => { seed = seed * 16807 % 2147483647; return (seed - 1) / 2147483646; };
  let disposed = false;
  const blend = { rain: 0, snow: 0 };
  const state = clock.getState();
  const initial = {
    background: scene.background?.isColor ? scene.background.clone() : scene.background, fog: scene.fog?.clone?.(), exposure: renderer.toneMappingExposure,
    sunPosition: sun.position.clone(), sunTarget: sun.target.position.clone(), sunColor: sun.color.clone(), sunIntensity: sun.intensity, sunCastShadow: sun.castShadow,
    skyColor: hemisphere.color.clone(), groundColor: hemisphere.groundColor.clone(), skyIntensity: hemisphere.intensity,
    fillColor: fill.color.clone(), fillIntensity: fill.intensity, seaColor: sea?.material?.color?.clone()
  };
  const colors = {
    day: new THREE.Color('#dce8e3'), night: new THREE.Color('#182d3c'), dawn: new THREE.Color('#f4d3ad'), dusk: new THREE.Color('#dba899'),
    seaDay: new THREE.Color('#cbded8'), seaNight: new THREE.Color('#172e38'), rain: new THREE.Color('#91a7af'), snow: new THREE.Color('#dce6e8'),
    sunDay: new THREE.Color('#fff2ce'), sunWarm: new THREE.Color('#ffb16a'), nightFill: new THREE.Color('#a8bfd4')
  };
  const skyColor = new THREE.Color(), seaColor = new THREE.Color(), lightColor = new THREE.Color();
  if (!scene.background?.isColor) scene.background = new THREE.Color('#dce8e3');
  if (!scene.fog?.isFog) scene.fog = new THREE.Fog('#dce8e3', 125, 260);

  const starPositions = new Float32Array(counts.stars * 3);
  for (let i = 0; i < counts.stars; i++) {
    const angle = random() * Math.PI * 2, radius = 45 + random() * 65;
    starPositions[i * 3] = Math.cos(angle) * radius;
    starPositions[i * 3 + 1] = 18 + random() * 62;
    starPositions[i * 3 + 2] = Math.sin(angle) * radius;
  }
  const starsMaterial = ownMaterial(new THREE.PointsMaterial({ color: '#f5ead2', size: coarse ? 1.9 : 1.6, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
  const stars = new THREE.Points(ownGeometry(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(starPositions, 3))), starsMaterial);
  stars.name = 'atmosphere-stars'; stars.frustumCulled = false; root.add(stars);

  const orbGeometry = ownGeometry(new THREE.IcosahedronGeometry(1, 2));
  const sunMaterial = ownMaterial(new THREE.MeshBasicMaterial({ color: '#ffe1a3', toneMapped: false }));
  const glowMaterial = ownMaterial(new THREE.MeshBasicMaterial({ color: '#ffd69a', transparent: true, opacity: .12, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  const sunOrb = new THREE.Mesh(orbGeometry, sunMaterial); sunOrb.name = 'atmosphere-sun'; sunOrb.scale.setScalar(2.15);
  const sunGlow = new THREE.Mesh(orbGeometry, glowMaterial); sunGlow.scale.setScalar(3.8);
  root.add(sunOrb, sunGlow);
  const skyRight=new THREE.Vector3(),skyUp=new THREE.Vector3(),skyForward=new THREE.Vector3();
  function updateSky(camera=skyCamera){
    if(camera)skyCamera=camera;
    if(!camera?.isOrthographicCamera){
      sunOrb.position.set(Math.cos(state.sunAngle)*160,140+Math.max(0,state.sunHeight)*30,-180);
      sunGlow.position.copy(sunOrb.position);return;
    }
    camera.updateWorldMatrix(true,false);
    const height=(camera.top-camera.bottom)/camera.zoom,width=(camera.right-camera.left)/camera.zoom;
    // The sun stays behind the island at a stable screen size, clear of the
    // driving plane even when the view zooms in.
    const depth=camera.far*.82;
    skyRight.setFromMatrixColumn(camera.matrixWorld,0);skyUp.setFromMatrixColumn(camera.matrixWorld,1);camera.getWorldDirection(skyForward);
    const place=(object,x,y,radius)=>{
      object.position.copy(camera.position).addScaledVector(skyForward,depth).addScaledVector(skyRight,width*x).addScaledVector(skyUp,height*y).sub(root.position);
      object.scale.setScalar(height*radius);
    };
    place(sunOrb,-.32,.34,.032);place(sunGlow,-.32,.34,.052);
  }

  const puddleMaterial = ownMaterial(new THREE.MeshStandardMaterial({ color: '#7fadb2', roughness: .12, metalness: .45, transparent: true, opacity: 0, depthWrite: false }));
  const snowPatchMaterial = ownMaterial(new THREE.MeshStandardMaterial({ color: '#f1f5e9', roughness: 1, transparent: true, opacity: 0, depthWrite: false }));
  const discGeometry = ownGeometry(new THREE.CircleGeometry(1, 24));
  const patches = [[-17, -8, 1.15], [1, -4, .7], [17, 1, 1.25], [-7, 12.7, .8], [11, -13.1, .9], [-19, 7.5, 1.2]];
  for (const [x, z, radius] of patches) {
    const puddle = new THREE.Mesh(discGeometry, puddleMaterial); puddle.position.set(x, .125, z); puddle.rotation.x = -Math.PI / 2; puddle.scale.set(radius, radius * .42, 1); groundDetails.add(puddle);
    const patch = new THREE.Mesh(discGeometry, snowPatchMaterial); patch.position.set(x + .4, .13, z - .6); patch.rotation.x = -Math.PI / 2; patch.scale.set(radius * 1.65, radius * .9, 1); groundDetails.add(patch);
  }

  function paintLighting(current) {
    const { daylight, night, warmth, sunHeight, sunAngle } = current;
    const wet = blend.rain, white = blend.snow;
    skyColor.copy(colors.night).lerp(colors.day, daylight).lerp(current.hour < 12 ? colors.dawn : colors.dusk, warmth * .72);
    skyColor.lerp(colors.rain, wet * (.16 + daylight * .34)).lerp(colors.snow, white * (.12 + daylight * .24));
    scene.background.copy(skyColor); scene.fog.color.copy(skyColor);
    scene.fog.near = 125 - wet * 55 - white * 40; scene.fog.far = 260 - wet * 95 - white * 80;
    seaColor.copy(colors.seaNight).lerp(colors.seaDay, daylight).lerp(colors.dusk, warmth * .3).lerp(colors.rain, wet * .28).lerp(colors.snow, white * .2);
    if (sea?.material?.color) sea.material.color.copy(seaColor);
    sun.position.set(root.position.x+Math.cos(sunAngle)*53,Math.max(4,sunHeight*58),root.position.z+15+Math.sin(sunAngle)*22);
    sun.target.position.set(root.position.x,0,root.position.z);sun.target.updateMatrixWorld();
    lightColor.copy(colors.sunDay).lerp(colors.sunWarm, warmth).lerp(colors.nightFill, night);
    sun.color.copy(lightColor); sun.intensity = .06 + daylight * 2.35 * (1 - wet * .48 - white * .18); sun.castShadow = daylight > .12;
    hemisphere.color.copy(colors.nightFill).lerp(colors.sunDay, daylight).lerp(colors.sunWarm, warmth * .28);
    hemisphere.groundColor.set(night > .5 ? '#425f60' : '#91a381');
    hemisphere.intensity = .78 + daylight * 1.03 - wet * .2;
    fill.color.copy(colors.nightFill).lerp(colors.day, daylight); fill.intensity = .42 + night * .24 + wet * .06;
    renderer.toneMappingExposure = 1.02 + night * .13 + warmth * .025;
    starsMaterial.opacity = night * .82 * (1 - wet * .82 - white * .65);
    stars.visible = starsMaterial.opacity > .01;
    sunOrb.visible = sunHeight > -.17; sunGlow.visible = sunOrb.visible;
    sunMaterial.color.copy(colors.sunDay).lerp(colors.sunWarm, warmth); glowMaterial.opacity = (.08 + warmth * .14) * (1 - wet * .7 - white * .4);
    updateSky();
  }
  // Precipitation is a CSS overlay; only the anchored ground styling lives here.
  function paintWeather() {
    puddleMaterial.opacity = blend.rain * .32;
    snowPatchMaterial.opacity = blend.snow * .56;
  }
  function snapshot() { return { ...state, particleCounts: { ...counts } }; }
  function update(elapsed = 0, { paused = false, focus } = {}) {
    if (disposed) return snapshot();
    if(focus&&Number.isFinite(focus.x)&&Number.isFinite(focus.z))root.position.set(focus.x,0,focus.z);
    const dt = !paused && Number.isFinite(elapsed) ? Math.max(0, Math.min(elapsed, .1)) : 0;
    Object.assign(state, clock.update(dt, paused));
    const damping = 1 - Math.exp(-dt * 2);
    blend.rain += ((state.weather === 'rain' ? 1 : 0) - blend.rain) * damping;
    blend.snow += ((state.weather === 'snow' ? 1 : 0) - blend.snow) * damping;
    paintLighting(state); paintWeather(); return snapshot();
  }
  update(0);
  return {
    update,updateSky,
    setTimeMode(mode) { Object.assign(state, clock.setTimeMode(mode)); update(0); return snapshot(); },
    setWeather(mode) {
      Object.assign(state, clock.setWeather(mode)); blend.rain = state.weather === 'rain' ? 1 : 0; blend.snow = state.weather === 'snow' ? 1 : 0;
      update(0); return snapshot();
    },
    getState: snapshot,
    dispose() {
      if (disposed) return; disposed = true;root.removeFromParent();groundDetails.removeFromParent();
      geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose());
      scene.background = initial.background;
      scene.fog = initial.fog || null; renderer.toneMappingExposure = initial.exposure;
      sun.target.position.copy(initial.sunTarget);sun.target.updateMatrixWorld();
      sun.position.copy(initial.sunPosition); sun.color.copy(initial.sunColor); sun.intensity = initial.sunIntensity; sun.castShadow = initial.sunCastShadow;
      hemisphere.color.copy(initial.skyColor); hemisphere.groundColor.copy(initial.groundColor); hemisphere.intensity = initial.skyIntensity;
      fill.color.copy(initial.fillColor); fill.intensity = initial.fillIntensity;
      if (initial.seaColor) sea.material.color.copy(initial.seaColor);
    }
  };
}
