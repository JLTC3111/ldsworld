import { bridgeHeightAt, isWater, portals as islandPortals, ISLAND_BOUNDS } from './world-layout.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const floorAt = body => Math.max(.12,bridgeHeightAt(body.x,body.z)) + (isWater(body.x,body.z)?-.09:0) + body.height/2 + (body.floorOffset||0);
const activeBody = body => !body.active || body.active();
export function tipPin(body,speed,nx,nz){
  if(body.kind!=='bowling-pin'||speed<.3)return;
  if((body.tipAngle||0)<.15){body.tipAxisX=nz;body.tipAxisZ=-nx;}
  body.tipVelocity=Math.max(body.tipVelocity||0,Math.min(7,speed*.72));body.sleeping=false;body.sleepTime=0;
}
export const colliderActive = (collider, bottom = -Infinity, top = Infinity) => (!collider.active || collider.active()) && (collider.maxY ?? Infinity) > bottom && (collider.minY ?? -Infinity) < top;

// One small spatial grid serves both the car and props. Detailed geometry can
// have thousands of contacts without checking every contact every substep.
export class ColliderIndex {
  constructor(colliders = [], cellSize = 4) {
    this.cellSize = cellSize; this.cells = new Map();
    colliders.forEach(collider => this.insert(collider));
  }
  insert(collider) {
    const halfX = collider.radius || (collider.width || .1) / 2, halfZ = collider.radius || (collider.depth || .1) / 2;
    for (let x = Math.floor((collider.x - halfX) / this.cellSize); x <= Math.floor((collider.x + halfX) / this.cellSize); x++) for (let z = Math.floor((collider.z - halfZ) / this.cellSize); z <= Math.floor((collider.z + halfZ) / this.cellSize); z++) {
      const key = `${x},${z}`; if (!this.cells.has(key)) this.cells.set(key, []); this.cells.get(key).push(collider);
    }
  }
  near(x, z, radius = 1) {
    const found = new Set();
    for (let ix = Math.floor((x - radius) / this.cellSize); ix <= Math.floor((x + radius) / this.cellSize); ix++) for (let iz = Math.floor((z - radius) / this.cellSize); iz <= Math.floor((z + radius) / this.cellSize); iz++) for (const collider of this.cells.get(`${ix},${iz}`) || []) found.add(collider);
    return found;
  }
}

// A compact rigid-body solver for the small, reachable props in the island.
// Coordinates are metres; y is the body's centre, not its bottom surface.
export class PhysicsWorld {
  constructor({ bodies = [], colliders = [] } = {}) {
    this.colliders = colliders;
    this.colliderIndex = new ColliderIndex(colliders);
    this.initial = bodies.map((definition, index) => {
      const body = { ...definition, id: definition.id || `prop-${index}`, radius: Math.max(.1, definition.radius || .4), mass: Math.max(.05, definition.mass || 1) };
      body.height = Math.max(.1, definition.height || body.radius * 2);
      body.y = definition.y ?? floorAt(body);
      body.boundaryScale = Math.max(1, Math.hypot(body.x / Math.max(1, ISLAND_BOUNDS.x - body.radius), body.z / Math.max(1, ISLAND_BOUNDS.z - body.radius)) * 1.002);
      return body;
    });
    this.bodies = [];
    this.reset();
  }
  reset() {
    // Keep the array identity so a renderer can retain a reference to it.
    this.bodies.splice(0, this.bodies.length, ...this.initial.map(body => ({ ...body, vx: 0, vz: 0, vy: 0, rotation: body.rotation || 0, angularVelocity: 0, tiltX: 0, tiltZ: 0, sleepTime: 0, sleeping: Boolean(body.initialSleeping), displaced: false })));
  }
  explode({x,y=.6,z,radius=8,strength=15},driver){
    for(const body of this.bodies){
      if(!activeBody(body))continue;
      const dx=body.x-x,dz=body.z-z,dy=body.y-y,distance=Math.hypot(dx,dy,dz);
      if(distance>=radius)continue;
      const force=strength*(1-distance/radius)/Math.sqrt(body.mass),length=Math.hypot(dx,dz)||1,nx=dx/length||.6,nz=dz/length||.8;
      body.vx+=nx*force;body.vz+=nz*force;body.vy+=force*.55;body.angularVelocity+=force*.5;body.sleeping=false;body.sleepTime=0;body.displaced=true;
      body.impactSpeed=Math.max(body.impactSpeed||0,force);tipPin(body,force,nx,nz);
    }
    if(driver){const dx=driver.x-x,dz=driver.z-z,distance=Math.hypot(dx,dz,(driver.groundHeight||0)+(driver.hop||0)+1-y);if(distance<radius){const length=Math.hypot(dx,dz)||1,force=strength*(1-distance/radius)*.75;driver.applyImpulse?.({x:(dx/length||.4)*force,y:force*.7,z:(dz/length||.6)*force},force*.15);}}
  }
  kick(id, { x = 0, z = 0, strength = 4 } = {}) {
    const body = this.bodies.find(item => item.id === id);
    if (!body || !activeBody(body)) return false;
    const dx = body.x - x, dz = body.z - z, length = Math.hypot(dx, dz) || 1;
    const velocity = clamp(strength, .2, 12) / Math.sqrt(body.mass);
    body.vx += (dx / length || .35) * velocity; body.vz += (dz / length || .35) * velocity;
    body.vy = Math.max(body.vy, Math.min(1.2, velocity * .18)); body.angularVelocity += velocity * .4;
    body.sleeping = false; body.sleepTime = 0; body.displaced = true;
    tipPin(body,velocity,dx/length,dz/length);
    return true;
  }
  update(elapsed, driver, { weather = 'clear' } = {}) {
    const duration = clamp(elapsed, 0, .1);
    if (!duration) return;
    const steps = Math.ceil(duration * 120), dt = duration / steps;
    const friction = weather === 'snow' ? .75 : weather === 'rain' ? 1.55 : 2.8;
    for(const body of this.bodies)body.impactSpeed=0;
    for (let step = 0; step < steps; step++) {
      for (const body of this.bodies) {
        if (!activeBody(body)) continue;
        if (body.sleeping) {
          if (driver) this.resolveCar(body, driver);
          if (body.sleeping) continue;
        }
        body.previousY = body.y;
        const grounded = body.y <= floorAt(body) + .015 && body.vy <= .05;
        const damping = Math.exp(-(grounded ? friction : .12) * dt);
        body.vx *= damping; body.vz *= damping;
        body.vy -= 13.5 * dt;
        body.x += body.vx * dt; body.z += body.vz * dt; body.y += body.vy * dt;
        body.rotation += body.angularVelocity * dt;
        body.angularVelocity *= Math.exp(-friction * .55 * dt);
        if(body.kind==='bowling-pin'){
          body.tipAngle ||= 0;body.tipVelocity ||= 0;
          if(body.tipVelocity||body.tipAngle>.02){
            body.tipVelocity+=(8*Math.sin(body.tipAngle)-body.tipVelocity*1.8)*dt;body.tipAngle+=body.tipVelocity*dt;
            if(body.tipAngle>Math.PI/2){body.tipAngle=Math.PI/2;body.tipVelocity=-Math.abs(body.tipVelocity)*.18;if(Math.abs(body.tipVelocity)<.15)body.tipVelocity=0;}
          }
          const c=Math.abs(Math.cos(body.tipAngle)),s=Math.abs(Math.sin(body.tipAngle));body.height=(body.uprightHeight||2.1)*c+(body.baseRadius||.37)*2*s;body.radius=(body.baseRadius||.37)*c+(body.uprightHeight||2.1)*.5*s;
          const sin=Math.sin(body.tipAngle/2),cos=Math.cos(body.tipAngle/2),sy=Math.sin(body.rotation/2),cy=Math.cos(body.rotation/2),tx=(body.tipAxisX||0)*sin,tz=(body.tipAxisZ||0)*sin;
          body.quaternion=[tx*cy-tz*sy,cos*sy,tx*sy+tz*cy,cos*cy];
        }else{body.tiltX *= Math.exp(-5 * dt); body.tiltZ *= Math.exp(-5 * dt);}
        this.resolveGround(body);
        this.resolveFixed(body);
        if (Math.hypot(body.vx, body.vz, body.vy) > .03) body.displaced = true;
        const shore = Math.hypot(body.x / ((ISLAND_BOUNDS.x - body.radius) * body.boundaryScale), body.z / ((ISLAND_BOUNDS.z - body.radius) * body.boundaryScale));
        if (shore > 1) {
          body.x /= shore * 1.001; body.z /= shore * 1.001;
          const length = Math.hypot(body.x, body.z), nx = body.x / length, nz = body.z / length;
          const outward = body.vx * nx + body.vz * nz;
          if (outward > 0) { body.vx -= outward * nx * 1.35; body.vz -= outward * nz * 1.35; }
        }
        if (driver) this.resolveCar(body, driver);
        body.vx = clamp(body.vx, -22, 22); body.vz = clamp(body.vz, -22, 22); body.angularVelocity = clamp(body.angularVelocity, -20, 20);
        if (Math.hypot(body.vx, body.vz, body.vy) < .025 && Math.abs(body.angularVelocity) < .025 && Math.abs(body.tipVelocity||0)<.025) body.sleepTime += dt;
        else body.sleepTime = 0;
        if (body.sleepTime > .8) { body.sleeping = true; body.vx = 0; body.vz = 0; body.vy = 0; body.angularVelocity = 0; }
      }
      const active = this.bodies.filter(activeBody), pairs = new ColliderIndex(active.map(body => ({ ...body, _body: body })));
      const checked = new Set();
      for (const a of active) for (const entry of pairs.near(a.x, a.z, a.radius)) {
        const b = entry._body; if (a === b || (a.sleeping && b.sleeping)) continue;
        const pair = a.id < b.id ? `${a.id}|${b.id}` : `${b.id}|${a.id}`;
        if (checked.has(pair)) continue; checked.add(pair); this.resolvePair(a, b);
      }
      for (const body of active) this.resolveGround(body);
    }
  }
  resolveGround(body) {
    const floor = floorAt(body);
    if (body.y < floor) {
      body.impactSpeed=Math.max(body.impactSpeed||0,-body.vy);
      body.y = floor;
      body.vy = body.vy < -.6 ? -body.vy * .23 : 0;
    }
    if (Math.abs(body.vx) < .002) body.vx = 0;
    if (Math.abs(body.vz) < .002) body.vz = 0;
  }
  resolveFixed(body) {
    for (const obstacle of this.colliderIndex.near(body.x, body.z, body.radius)) {
      if (!colliderActive(obstacle, body.y - body.height / 2 + .015, body.y + body.height / 2 - .015)) continue;
      let nx, nz, penetration;
      if (obstacle.radius) {
        const dx = body.x - obstacle.x, dz = body.z - obstacle.z, distance = Math.hypot(dx, dz);
        penetration = body.radius + obstacle.radius - distance;
        nx = distance ? dx / distance : 1; nz = distance ? dz / distance : 0;
      } else {
        const halfX = (obstacle.width || 0) / 2, halfZ = (obstacle.depth || 0) / 2;
        const nearestX = clamp(body.x, obstacle.x - halfX, obstacle.x + halfX), nearestZ = clamp(body.z, obstacle.z - halfZ, obstacle.z + halfZ);
        const dx = body.x - nearestX, dz = body.z - nearestZ, distance = Math.hypot(dx, dz);
        if (distance) { penetration = body.radius - distance; nx = dx / distance; nz = dz / distance; }
        else {
          const overlapX = halfX + body.radius - Math.abs(body.x - obstacle.x), overlapZ = halfZ + body.radius - Math.abs(body.z - obstacle.z);
          if (overlapX < overlapZ) { penetration = overlapX; nx = Math.sign(body.x - obstacle.x || 1); nz = 0; }
          else { penetration = overlapZ; nx = 0; nz = Math.sign(body.z - obstacle.z || 1); }
        }
      }
      if (!(penetration > 0)) continue;
      body.x += nx * (penetration + .002); body.z += nz * (penetration + .002);
      const inward = body.vx * nx + body.vz * nz;
      body.impactSpeed=Math.max(body.impactSpeed||0,-inward);tipPin(body,-inward,-nx,-nz);
      if (inward < 0) { body.vx -= inward * nx * 1.35; body.vz -= inward * nz * 1.35; }
      body.angularVelocity *= .75;
    }
  }
  resolveCar(body, driver) {
    const aerial=driver.attitude&&(driver.attitude.flying||driver.attitude.recovering),bounds=aerial?driver.attitude.bounds():null;
    const halfWidth=bounds?.halfX??.84,halfLength=bounds?.halfZ??1.33;
    const bottom=(driver.groundHeight||0)+(driver.hop||0)+(bounds?bounds.bottom+(driver.attitude.supportLift||0):.1);
    if(body.y+body.height/2<bottom||body.y-body.height/2>bottom+(bounds?bounds.top-bounds.bottom:2.5))return;
    const rightX = Math.cos(driver.heading || 0), rightZ = -Math.sin(driver.heading || 0), forwardX = Math.sin(driver.heading || 0), forwardZ = Math.cos(driver.heading || 0);
    const dx=body.x-driver.x-(bounds?.offsetX||0),dz=body.z-driver.z-(bounds?.offsetZ||0);
    const side = bounds?dx:dx * rightX + dz * rightZ, along = bounds?dz:dx * forwardX + dz * forwardZ;
    let sideDelta = side-clamp(side,-halfWidth,halfWidth),alongDelta=along-clamp(along,-halfLength,halfLength);
    const distance = Math.hypot(sideDelta, alongDelta);
    let overlap = body.radius - distance;
    if (!distance) {
      if(halfWidth-Math.abs(side)<halfLength-Math.abs(along)){overlap+=halfWidth-Math.abs(side);sideDelta=Math.sign(side||1);}
      else{overlap+=halfLength-Math.abs(along);alongDelta=Math.sign(along||1);}
    }
    if (overlap <= 0) return;
    const normalLength = Math.hypot(sideDelta, alongDelta) || 1;
    const nx=(bounds?sideDelta:sideDelta*rightX+alongDelta*forwardX)/normalLength,nz=(bounds?alongDelta:sideDelta*rightZ+alongDelta*forwardZ)/normalLength;
    const invBody = 1 / body.mass, invCar = 1 / 5, inverseSum = invBody + invCar;
    body.x += nx * overlap * invBody / inverseSum; body.z += nz * overlap * invBody / inverseSum;
    driver.x -= nx * overlap * invCar / inverseSum; driver.z -= nz * overlap * invCar / inverseSum;
    const moving = Math.hypot(driver.vx || 0, driver.vz || 0) > .01;
    const vx = moving ? driver.vx : Math.sin(driver.heading || 0) * (driver.speed || 0), vz = moving ? driver.vz : Math.cos(driver.heading || 0) * (driver.speed || 0);
    const closing = (vx - body.vx) * nx + (vz - body.vz) * nz;
    if (closing <= 0) return;
    body.impactSpeed=Math.max(body.impactSpeed||0,closing);tipPin(body,closing,nx,nz);
    body.sleeping = false; body.sleepTime = 0; body.displaced = true;
    const impulse = closing * 1.18 / inverseSum;
    body.vx += impulse * nx * invBody; body.vz += impulse * nz * invBody;
    body.vy = Math.max(body.vy, Math.min(closing * .13, 1.1));
    body.angularVelocity += (vx * nz - vz * nx + .12) * impulse * invBody * .12;
    body.tiltX = clamp(nz * closing * .05, -.4, .4); body.tiltZ = clamp(-nx * closing * .05, -.4, .4);
    const slowdown = clamp(1 - body.mass / (body.mass + 5) * .22, .8, .995);
    driver.speed *= slowdown;
    driver.vx = vx * slowdown; driver.vz = vz * slowdown;
    driver.collisionImpact = Math.max(driver.collisionImpact || 0, closing);
  }
  resolvePair(a, b) {
    const dx = b.x - a.x, dz = b.z - a.z, distance = Math.hypot(dx, dz), overlap = a.radius + b.radius - distance;
    if (overlap <= 0) return;
    const aBottom = a.y - a.height / 2, aTop = a.y + a.height / 2, bBottom = b.y - b.height / 2, bTop = b.y + b.height / 2;
    const stack = (top, lower) => {
      const bottom = top.y - top.height / 2, oldBottom = (top.previousY ?? top.y) - top.height / 2, surface = lower.y + lower.height / 2;
      if (oldBottom >= surface - .07 && bottom < surface && top.vy <= lower.vy + .05 && distance < (a.radius + b.radius) * .8) {
        top.y = surface + top.height / 2; top.vy = Math.max(0, -top.vy * .13); top.vx *= .94; top.vz *= .94; return true;
      }
      return false;
    };
    if (stack(a, b) || stack(b, a)) return;
    if (aBottom >= bTop - .01 || bBottom >= aTop - .01) return;
    a.sleeping = false; b.sleeping = false; a.sleepTime = 0; b.sleepTime = 0;
    const nx = distance > .001 ? dx / distance : 1, nz = distance > .001 ? dz / distance : 0, invA = 1 / a.mass, invB = 1 / b.mass, total = invA + invB;
    a.x -= nx * (overlap + .001) * invA / total; a.z -= nz * (overlap + .001) * invA / total;
    b.x += nx * (overlap + .001) * invB / total; b.z += nz * (overlap + .001) * invB / total;
    const closing = (b.vx - a.vx) * nx + (b.vz - a.vz) * nz;
    if (closing >= 0) return;
    a.impactSpeed=Math.max(a.impactSpeed||0,-closing);b.impactSpeed=Math.max(b.impactSpeed||0,-closing);tipPin(a,-closing,-nx,-nz);tipPin(b,-closing,nx,nz);
    const impulse = -closing * 1.28 / total;
    a.vx -= impulse * nx * invA; a.vz -= impulse * nz * invA; b.vx += impulse * nx * invB; b.vz += impulse * nz * invB;
    const tangent = (b.vx - a.vx) * -nz + (b.vz - a.vz) * nx;
    a.angularVelocity -= tangent * impulse * invA * .05; b.angularVelocity += tangent * impulse * invB * .05;
  }
}

export class PortalSystem {
  constructor(definitions = islandPortals) { this.portals = definitions; this.reset(); }
  reset() { this.cooldown = 0; this.armed = true; }
  update(elapsed, driver) {
    this.cooldown = Math.max(0, this.cooldown - clamp(elapsed, 0, .1));
    const near = this.portals.find(portal => Math.hypot(driver.x - portal.x, driver.z - portal.z) < (portal.radius || 1.25));
    if (!near) { if (!this.cooldown) this.armed = true; return null; }
    if (!this.armed || this.cooldown || (driver.hop || 0) > 1) return null;
    driver.x = near.exitX; driver.z = near.exitZ; driver.heading = near.heading ?? driver.heading;
    driver.speed = 0; driver.vx = 0; driver.vz = 0; driver.velocityHeading = driver.heading;
    driver.hop = .12; driver.hopVelocity = 1.3;
    driver.groundHeight = Math.max(0, bridgeHeightAt(driver.x, driver.z) - .1);
    driver.groundVelocity = 0;
    driver.attitude?.reset(driver.heading);driver.airborne=false;driver.boosting=false;
    driver.cancelRoute?.();
    this.cooldown = 2; this.armed = false;
    return near.id;
  }
}
