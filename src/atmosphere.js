import { EnvironmentClock } from './environment-state.js';

/** A small, deterministic atmosphere. It owns no application theme or project state. */
export function createAtmosphere({ THREE, scene, renderer, sun, hemisphere, fill, sea, coarse = false, reducedMotion = false }) {
  const clock = new EnvironmentClock();
  const root = new THREE.Group(); root.name = 'island-atmosphere'; scene.add(root);
  const geometries = new Set(), materials = new Set();
  const ownGeometry = geometry => { geometries.add(geometry); return geometry; };
  const ownMaterial = material => { materials.add(material); return material; };
  const counts = {
    rain: reducedMotion ? 90 : coarse ? 320 : 760,
    snow: reducedMotion ? 130 : coarse ? 440 : 920,
    stars: coarse ? 110 : 230,
    splashes: reducedMotion ? 6 : coarse ? 16 : 28
  };
  let seed = 6299;
  const random = () => { seed = seed * 16807 % 2147483647; return (seed - 1) / 2147483646; };
  let elapsedTime = 0, disposed = false;
  const blend = { rain: 0, snow: 0 };
  const state = clock.getState();
  const initial = {
    background: scene.background?.isColor ? scene.background.clone() : scene.background, fog: scene.fog?.clone?.(), exposure: renderer.toneMappingExposure,
    sunPosition: sun.position.clone(), sunColor: sun.color.clone(), sunIntensity: sun.intensity, sunCastShadow: sun.castShadow,
    skyColor: hemisphere.color.clone(), groundColor: hemisphere.groundColor.clone(), skyIntensity: hemisphere.intensity,
    fillColor: fill.color.clone(), fillIntensity: fill.intensity, seaColor: sea?.material?.color?.clone()
  };
  const colors = {
    day: new THREE.Color('#dce8e3'), night: new THREE.Color('#182d3c'), dawn: new THREE.Color('#f4d3ad'), dusk: new THREE.Color('#dba899'),
    seaDay: new THREE.Color('#cbded8'), seaNight: new THREE.Color('#172e38'), rain: new THREE.Color('#91a7af'), snow: new THREE.Color('#dce6e8'),
    sunDay: new THREE.Color('#fff2ce'), sunWarm: new THREE.Color('#ffb16a'), moon: new THREE.Color('#a8bfd4'),
    rainDay: new THREE.Color('#466d83'), rainNight: new THREE.Color('#bddde7')
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
  const moonMaterial = ownMaterial(new THREE.MeshBasicMaterial({ color: '#d7e0de', toneMapped: false }));
  const glowMaterial = ownMaterial(new THREE.MeshBasicMaterial({ color: '#ffd69a', transparent: true, opacity: .12, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  const sunOrb = new THREE.Mesh(orbGeometry, sunMaterial); sunOrb.name = 'atmosphere-sun'; sunOrb.scale.setScalar(2.15);
  const moonOrb = new THREE.Mesh(orbGeometry, moonMaterial); moonOrb.name = 'atmosphere-moon'; moonOrb.scale.setScalar(1.45);
  const sunGlow = new THREE.Mesh(orbGeometry, glowMaterial); sunGlow.scale.setScalar(3.8);
  root.add(sunOrb, moonOrb, sunGlow);
  // Small surface details make the moon read as a moon at a glance.
  const craterMaterial = ownMaterial(new THREE.MeshBasicMaterial({ color: '#a9bec1', toneMapped: false }));
  for (let i = 0; i < 4; i++) {
    const crater = new THREE.Mesh(orbGeometry, craterMaterial); crater.scale.setScalar(.1 + random() * .1);
    crater.position.set((random() - .5) * .8, (random() - .5) * .8, .9); moonOrb.add(crater);
  }

  const dummy = new THREE.Object3D();

  const rainPositions = new Float32Array(counts.rain * 6);
  const rainSeeds = Array.from({ length: counts.rain }, () => ({ x: (random() - .5) * 68, y: random() * 32, z: (random() - .5) * 56, speed: 30 + random() * 13 }));
  const rainGeometry = ownGeometry(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(rainPositions, 3)));
  rainGeometry.attributes.position.setUsage(THREE.DynamicDrawUsage);
  const rainMaterial = ownMaterial(new THREE.LineBasicMaterial({ color: '#b4d5df', transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
  const rain = new THREE.LineSegments(rainGeometry, rainMaterial); rain.name = 'atmosphere-rain'; rain.frustumCulled = false; root.add(rain);

  const snowPositions = new Float32Array(counts.snow * 3);
  const snowSeeds = Array.from({ length: counts.snow }, () => ({ x: (random() - .5) * 68, y: random() * 30, z: (random() - .5) * 56, speed: .8 + random() * 1.5, phase: random() * Math.PI * 2 }));
  const snowGeometry = ownGeometry(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(snowPositions, 3)));
  snowGeometry.attributes.position.setUsage(THREE.DynamicDrawUsage);
  const snowMaterial = ownMaterial(new THREE.PointsMaterial({ color: '#f9fcfa', size: coarse ? 2.8 : 2.6, sizeAttenuation: false, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }));
  const snow = new THREE.Points(snowGeometry, snowMaterial); snow.name = 'atmosphere-snow'; snow.frustumCulled = false; root.add(snow);

  const splashMaterial = ownMaterial(new THREE.MeshBasicMaterial({ color: '#d7e9e8', transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }));
  const splashes = new THREE.InstancedMesh(ownGeometry(new THREE.RingGeometry(.06, .085, 9)), splashMaterial, counts.splashes);
  splashes.name = 'atmosphere-splashes'; splashes.frustumCulled = false; root.add(splashes);
  const splashSeeds = Array.from({ length: counts.splashes }, () => ({ x: (random() - .5) * 44, z: (random() - .5) * 30, phase: random() }));
  const puddleMaterial = ownMaterial(new THREE.MeshStandardMaterial({ color: '#7fadb2', roughness: .12, metalness: .45, transparent: true, opacity: 0, depthWrite: false }));
  const snowPatchMaterial = ownMaterial(new THREE.MeshStandardMaterial({ color: '#f1f5e9', roughness: 1, transparent: true, opacity: 0, depthWrite: false }));
  const discGeometry = ownGeometry(new THREE.CircleGeometry(1, 24));
  const patches = [[-17, -8, 1.15], [1, -4, .7], [17, 1, 1.25], [-7, 12.7, .8], [11, -13.1, .9], [-19, 7.5, 1.2]];
  for (const [x, z, radius] of patches) {
    const puddle = new THREE.Mesh(discGeometry, puddleMaterial); puddle.position.set(x, .125, z); puddle.rotation.x = -Math.PI / 2; puddle.scale.set(radius, radius * .42, 1); root.add(puddle);
    const patch = new THREE.Mesh(discGeometry, snowPatchMaterial); patch.position.set(x + .4, .13, z - .6); patch.rotation.x = -Math.PI / 2; patch.scale.set(radius * 1.65, radius * .9, 1); root.add(patch);
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
    sun.position.set(Math.cos(sunAngle) * 53, Math.max(4, sunHeight * 58), 15 + Math.sin(sunAngle) * 22);
    lightColor.copy(colors.sunDay).lerp(colors.sunWarm, warmth).lerp(colors.moon, night);
    sun.color.copy(lightColor); sun.intensity = .06 + daylight * 2.35 * (1 - wet * .48 - white * .18); sun.castShadow = daylight > .12;
    hemisphere.color.copy(colors.moon).lerp(colors.sunDay, daylight).lerp(colors.sunWarm, warmth * .28);
    hemisphere.groundColor.set(night > .5 ? '#425f60' : '#91a381');
    hemisphere.intensity = .78 + daylight * 1.03 - wet * .2;
    fill.color.copy(colors.moon).lerp(colors.day, daylight); fill.intensity = .42 + night * .24 + wet * .06;
    renderer.toneMappingExposure = 1.02 + night * .13 + warmth * .025;
    starsMaterial.opacity = night * .82 * (1 - wet * .82 - white * .65);
    stars.visible = starsMaterial.opacity > .01;
    sunOrb.position.set(Math.cos(sunAngle) * 50, sunHeight * 39 + 4, -27);
    sunGlow.position.copy(sunOrb.position); sunOrb.visible = sunHeight > -.17; sunGlow.visible = sunOrb.visible;
    sunMaterial.color.copy(colors.sunDay).lerp(colors.sunWarm, warmth); glowMaterial.opacity = (.08 + warmth * .14) * (1 - wet * .7 - white * .4);
    moonOrb.position.set(-Math.cos(sunAngle) * 48, -sunHeight * 40 + 3, -29); moonOrb.visible = night > .08;
  }
  function paintWeather(dt) {
    const wind = reducedMotion ? .15 : .8 + Math.sin(elapsedTime * .13) * .3;
    rain.visible = blend.rain > .01; snow.visible = blend.snow > .01; splashes.visible = rain.visible;
    // Dark daylight strokes and bright night strokes remain visible against the
    // sky and island. Longer slanted tails read as rain at the overview scale.
    rainMaterial.opacity = blend.rain * (.64 + state.daylight * .21);
    const skyLuminance = skyColor.r * .2126 + skyColor.g * .7152 + skyColor.b * .0722;
    const strokeContrast = color => {
      const strokeLuminance = color.r * .2126 + color.g * .7152 + color.b * .0722;
      const rendered = strokeLuminance * rainMaterial.opacity + skyLuminance * (1 - rainMaterial.opacity);
      return (Math.max(rendered, skyLuminance) + .05) / (Math.min(rendered, skyLuminance) + .05);
    };
    rainMaterial.color.copy(strokeContrast(colors.rainDay) >= strokeContrast(colors.rainNight) ? colors.rainDay : colors.rainNight);
    snowMaterial.opacity = blend.snow * .88; splashMaterial.opacity = blend.rain * .48;
    puddleMaterial.opacity = blend.rain * .32; snowPatchMaterial.opacity = blend.snow * .56;
    for (let i = 0; i < rainSeeds.length; i++) {
      const particle = rainSeeds[i]; particle.y -= dt * particle.speed * (reducedMotion ? .3 : 1); particle.x += dt * wind;
      if (particle.y < .18) { particle.y += 32; particle.x = (random() - .5) * 68; particle.z = (random() - .5) * 56; }
      const offset = i * 6; rainPositions[offset] = particle.x; rainPositions[offset + 1] = particle.y; rainPositions[offset + 2] = particle.z;
      rainPositions[offset + 3] = particle.x - wind * (reducedMotion ? .12 : .33); rainPositions[offset + 4] = particle.y + (reducedMotion ? .72 : 1.85); rainPositions[offset + 5] = particle.z - (reducedMotion ? .025 : .08);
    }
    for (let i = 0; i < snowSeeds.length; i++) {
      const particle = snowSeeds[i]; particle.y -= dt * particle.speed * (reducedMotion ? .28 : 1);
      particle.x += dt * (Math.sin(elapsedTime * .6 + particle.phase) * .4 + wind * .12);
      particle.z += dt * Math.cos(elapsedTime * .45 + particle.phase) * .18;
      if (particle.y < .18) { particle.y += 30; particle.x = (random() - .5) * 68; particle.z = (random() - .5) * 56; }
      const offset = i * 3; snowPositions[offset] = particle.x; snowPositions[offset + 1] = particle.y; snowPositions[offset + 2] = particle.z;
    }
    rainGeometry.attributes.position.needsUpdate = true; snowGeometry.attributes.position.needsUpdate = true;
    splashSeeds.forEach((splash, i) => {
      const progress = reducedMotion ? .35 : (splash.phase + elapsedTime * .9) % 1;
      dummy.position.set(splash.x, .18, splash.z); dummy.rotation.set(-Math.PI / 2, 0, 0); dummy.scale.setScalar(progress * 4.5 + .05); dummy.updateMatrix(); splashes.setMatrixAt(i, dummy.matrix);
    });
    splashes.instanceMatrix.needsUpdate = true;
  }
  function snapshot() { return { ...state, particleCounts: { ...counts } }; }
  function update(elapsed = 0, { paused = false } = {}) {
    if (disposed) return snapshot();
    const dt = !paused && Number.isFinite(elapsed) ? Math.max(0, Math.min(elapsed, .1)) : 0;
    Object.assign(state, clock.update(dt, paused)); elapsedTime += dt;
    const damping = 1 - Math.exp(-dt * 2);
    blend.rain += ((state.weather === 'rain' ? 1 : 0) - blend.rain) * damping;
    blend.snow += ((state.weather === 'snow' ? 1 : 0) - blend.snow) * damping;
    paintLighting(state); paintWeather(dt); return snapshot();
  }
  update(0);
  return {
    update,
    setTimeMode(mode) { Object.assign(state, clock.setTimeMode(mode)); update(0); return snapshot(); },
    setWeather(mode) {
      Object.assign(state, clock.setWeather(mode)); blend.rain = state.weather === 'rain' ? 1 : 0; blend.snow = state.weather === 'snow' ? 1 : 0;
      update(0); return snapshot();
    },
    getState: snapshot,
    dispose() {
      if (disposed) return; disposed = true; root.removeFromParent();
      geometries.forEach(geometry => geometry.dispose()); materials.forEach(material => material.dispose());
      scene.background = initial.background;
      scene.fog = initial.fog || null; renderer.toneMappingExposure = initial.exposure;
      sun.position.copy(initial.sunPosition); sun.color.copy(initial.sunColor); sun.intensity = initial.sunIntensity; sun.castShadow = initial.sunCastShadow;
      hemisphere.color.copy(initial.skyColor); hemisphere.groundColor.copy(initial.groundColor); hemisphere.intensity = initial.skyIntensity;
      fill.color.copy(initial.fillColor); fill.intensity = initial.fillIntensity;
      if (initial.seaColor) sea.material.color.copy(initial.seaColor);
    }
  };
}
