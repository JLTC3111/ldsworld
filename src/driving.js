import { bridges, bridgeHeightAt, crossesWater, isWater, riverCenter, RIVER_HALF_WIDTH, WORLD_SCALE, islandRadius } from './world-layout.js';
import { ColliderIndex, colliderActive } from './physics.js';

export const roadNodes = {
  r0: [-18, -7], r1: [-12, -12.5], r2: [0, -13], r3: [12, -12],
  r4: [19, -6], r5: [20, -.9], r6: [18, 7], r7: [12, 12.5],
  r8: [0, 13], r9: [-12, 12.5], r10: [-19, 6], r11: [-20, 0],
  c0: [0, 0], c1: [-7, 0], c2: [8, -.9]
};
// The east junction sits just below the bridge entrance so a full-length car
// can turn onto the cross-island road without clipping its solid guardrail.
export const roadLoop = Array.from({ length: 12 }, (_, i) => roadNodes[`r${i}`]);
for(let i=0;i<12;i++) roadNodes[`o${i}`]=roadLoop[i].map(value=>value*WORLD_SCALE);
export const outerRoadLoop=Array.from({length:12},(_,i)=>roadNodes[`o${i}`]);
for (const bridge of bridges) {
  roadNodes[`bridge-${bridge.id}-north`] = [bridge.x - Math.sin(bridge.heading) * 2.7, bridge.z - Math.cos(bridge.heading) * 2.7];
  roadNodes[`bridge-${bridge.id}-south`] = [bridge.x + Math.sin(bridge.heading) * 2.7, bridge.z + Math.cos(bridge.heading) * 2.7];
}
const edges = Array.from({ length: 12 }, (_, i) => [`r${i}`, `r${(i + 1) % 12}`]).filter(([a, b]) => !(['r5', 'r6'].includes(a) && ['r5', 'r6'].includes(b)) && !(['r10', 'r11'].includes(a) && ['r10', 'r11'].includes(b)));
edges.push(...Array.from({length:12},(_,i)=>[`o${i}`,`o${(i+1)%12}`]).filter(([a,b])=>!(['o5','o6'].includes(a)&&['o5','o6'].includes(b))&&!(['o10','o11'].includes(a)&&['o10','o11'].includes(b))));
edges.push(['r2','o2'],['r8','o8'],['r0','o0'],['r4','o4']);
edges.push(['r2', 'c0'], ['r11', 'c1'], ['c1', 'c0'], ['c0', 'c2'], ['c2', 'r5']);
for (const [id, a, b] of [['west', 'r11', 'r10'], ['village', 'c0', 'r8'], ['east', 'r5', 'r6'],['outer-west','o11','o10'],['outer-east','o5','o6']]) edges.push([a, `bridge-${id}-north`], [`bridge-${id}-north`, `bridge-${id}-south`], [`bridge-${id}-south`, b]);
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const clamp = (x, lo, hi) => Math.min(Math.max(x, lo), hi);
export const angleDifference = (target, current) => Math.atan2(Math.sin(target - current), Math.cos(target - current));
export const CAR_HALF_WIDTH = .84;
export const CAR_HALF_LENGTH = 1.33;

function fixedContact(x, z, heading, obstacle) {
  if (obstacle.radius && !obstacle.width) obstacle = { ...obstacle, width: obstacle.radius * 2, depth: obstacle.radius * 2 };
  const rightX = Math.cos(heading), rightZ = -Math.sin(heading), forwardX = Math.sin(heading), forwardZ = Math.cos(heading);
  const dx = x - obstacle.x, dz = z - obstacle.z, halfX = obstacle.width / 2, halfZ = obstacle.depth / 2;
  let depth = Infinity, nx = 0, nz = 0;
  // The world axes and the car's two local axes form the separating-axis test.
  // Resolving along its smallest overlap avoids an oversized diagonal AABB.
  for (const [axisX, axisZ] of [[1, 0], [0, 1], [rightX, rightZ], [forwardX, forwardZ]]) {
    const carRadius = CAR_HALF_WIDTH * Math.abs(axisX * rightX + axisZ * rightZ) + CAR_HALF_LENGTH * Math.abs(axisX * forwardX + axisZ * forwardZ);
    const obstacleRadius = halfX * Math.abs(axisX) + halfZ * Math.abs(axisZ);
    const signedDistance = dx * axisX + dz * axisZ, overlap = carRadius + obstacleRadius - Math.abs(signedDistance);
    if (overlap <= 0) return null;
    if (overlap < depth) { depth = overlap; nx = axisX * Math.sign(signedDistance || 1); nz = axisZ * Math.sign(signedDistance || 1); }
  }
  return { depth, nx, nz };
}

export function planRoute(position, destination) {
  if (!roadNodes[destination]) throw new Error(`Unknown road destination: ${destination}`);
  const start = Object.keys(roadNodes).reduce((best, id) => distance(position, roadNodes[id]) < distance(position, roadNodes[best]) ? id : best, 'r0');
  const costs = Object.fromEntries(Object.keys(roadNodes).map(id => [id, Infinity]));
  const previous = {};
  const remaining = new Set(Object.keys(roadNodes));
  costs[start] = 0;
  while (remaining.size) {
    const current = [...remaining].reduce((a, b) => costs[a] < costs[b] ? a : b);
    remaining.delete(current);
    if (current === destination) break;
    for (const [a, b] of edges) {
      const neighbour = a === current ? b : b === current ? a : null;
      if (!neighbour || !remaining.has(neighbour)) continue;
      const cost = costs[current] + distance(roadNodes[current], roadNodes[neighbour]);
      if (cost < costs[neighbour]) { costs[neighbour] = cost; previous[neighbour] = current; }
    }
  }
  const ids = [destination];
  while (ids[0] !== start) { if (!previous[ids[0]]) throw new Error('Unreachable road destination'); ids.unshift(previous[ids[0]]); }
  return ids.map(id => [...roadNodes[id]]);
}

export function planGroundRoute(start, target, colliders = []) {
  colliders = colliders.filter(c => colliderActive(c));
  const goal = [...target];
  const radius = islandRadius(goal[0],goal[1],.5);
  if (radius > 1) { goal[0] /= radius; goal[1] /= radius; }
  const inside = (point, c, padding = .85) => Math.abs(point[0] - c.x) < c.width / 2 + padding && Math.abs(point[1] - c.z) < c.depth / 2 + padding;
  for (const c of colliders) {
    if (!inside(goal, c)) continue;
    const dx = goal[0] - c.x, dz = goal[1] - c.z;
    if (c.width / 2 + .85 - Math.abs(dx) < c.depth / 2 + .85 - Math.abs(dz)) goal[0] = c.x + Math.sign(dx || 1) * (c.width / 2 + .87);
    else goal[1] = c.z + Math.sign(dz || 1) * (c.depth / 2 + .87);
  }
  if (isWater(goal[0], goal[1])) goal[1] = riverCenter(goal[0]) + Math.sign(goal[1] - riverCenter(goal[0]) || 1) * (RIVER_HALF_WIDTH + .12);
  const clear = (a, b) => !crossesWater(a, b) && !colliders.some(c => {
    if (inside(a, c, .8)) {
      // A car resting against a wall must be able to leave the clearance band.
      const axis = c.width / 2 + .8 - Math.abs(a[0] - c.x) < c.depth / 2 + .8 - Math.abs(a[1] - c.z) ? 0 : 1;
      const centre = axis === 0 ? c.x : c.z;
      return (b[axis] - a[axis]) * Math.sign(a[axis] - centre || 1) <= 0 || inside(b, c, .8);
    }
    let lo = 0, hi = 1;
    for (const [index, centre, half] of [[0, c.x, c.width / 2 + .8], [1, c.z, c.depth / 2 + .8]]) {
      const delta = b[index] - a[index];
      if (Math.abs(delta) < 1e-8) { if (a[index] <= centre - half || a[index] >= centre + half) return false; continue; }
      const x = (centre - half - a[index]) / delta, y = (centre + half - a[index]) / delta;
      lo = Math.max(lo, Math.min(x, y)); hi = Math.min(hi, Math.max(x, y));
      if (lo >= hi) return false;
    }
    return hi > 1e-5 && lo < 1 - 1e-5;
  });
  if (clear(start, goal)) return [goal];
  const corners = colliders.flatMap(c => [-1, 1].flatMap(x => [-1, 1].map(z => [c.x + x * (c.width / 2 + 1.75), c.z + z * (c.depth / 2 + 1.75)])));
  const nodes = [start, goal, ...[...Object.values(roadNodes), ...corners].filter(p => islandRadius(...p) < .995 && !isWater(...p) && !colliders.some(c => inside(p, c)))];
  const costs = nodes.map(() => Infinity), previous = [], remaining = new Set(nodes.map((_, index) => index)); costs[0] = 0;
  while (remaining.size) {
    const current = [...remaining].reduce((a, b) => costs[a] < costs[b] ? a : b);
    if (!Number.isFinite(costs[current])) break;
    remaining.delete(current); if (current === 1) break;
    for (const next of remaining) {
      const candidate = costs[current] + distance(nodes[current], nodes[next]);
      if (candidate < costs[next] && clear(nodes[current], nodes[next])) { costs[next] = candidate; previous[next] = current; }
    }
  }
  if (!Number.isFinite(costs[1])) return [];
  const route = [1]; while (route[0] !== 0) route.unshift(previous[route[0]]);
  return route.slice(1).map(index => [...nodes[index]]);
}

export class Driver {
  constructor(colliders = [], { routeColliders = colliders } = {}) {
    this.colliders = colliders;
    this.routeColliders = routeColliders;
    this.colliderIndex = new ColliderIndex(colliders);
    this.reset();
  }
  reset() {
    this.x = 0; this.z = 13; this.heading = Math.PI / 2; this.speed = 0;
    this.steering = 0; this.distance = 0; this.hop = 0; this.hopVelocity = 0;
    this.hydraulicOffset=0; this.hydraulicVelocity=0; this.hydraulicPhase='idle'; this.jumpCharge=0; this.jumpPending=false; this.jumpCooldown=0; this.landingImpact=0;this.landingTime=0;
    this.route = []; this.destinationId = null; this.routeTimer = 0;
    this.routeDurationLimit=35;
    this.finalTolerance = 1.05;
    this.vx = 0; this.vz = 0; this.velocityHeading = this.heading;
    this.groundHeight = 0; this.groundVelocity = 0; this.pitch = 0; this.roll = 0;
    this.collisionImpact = 0; this.weather = 'clear';
    this.acceleration = 0; this.rpm = 650; this.gear = 0;
    this.wheelHeights = { frontLeft: 0, frontRight: 0, rearLeft: 0, rearRight: 0 };
  }
  setWeather(weather) { this.weather = ['rain', 'snow'].includes(weather) ? weather : 'clear'; }
  navigate(stop, id) {
    this.route = planRoute([this.x, this.z], stop);
    this.destinationId = id;
    this.routeTimer = 0;
    this.routeDurationLimit=this.routeBudget();
    this.finalTolerance = 1.05;
  }
  driveTo(x, z) {
    this.route = planGroundRoute([this.x, this.z], [x, z], this.routeColliders);
    this.destinationId = null;
    this.routeTimer = 0;
    this.routeDurationLimit=this.routeBudget();
    this.finalTolerance = isWater(x, z) ? .18 : 1.05;
  }
  cancelRoute() { this.route = []; this.destinationId = null; }
  routeBudget() { let previous=[this.x,this.z],length=0;for(const point of this.route){length+=distance(previous,point);previous=point;}return Math.max(35,length/3.5+15); }
  jump() {
    if(this.hop>.015||this.jumpPending||this.jumpCooldown>0)return false;
    this.jumpPending=true;this.jumpCharge=.14;this.hydraulicPhase='charging';return true;
  }
  step(elapsed, input = {}) {
    const dt = clamp(elapsed, 0, .05);
    const wet = this.weather === 'rain', snowy = this.weather === 'snow';
    const traction = snowy ? .78 : wet ? .9 : 1;
    const previousSpeed = this.speed;
    this.collisionImpact *= Math.exp(-5 * dt);
    const manual = input.forward || input.reverse || input.left || input.right || input.brake;
    let cancelled = false;
    if (manual && this.route.length) { this.cancelRoute(); cancelled = true; }
    let forward = input.forward ? 1 : 0;
    let reverse = input.reverse ? 1 : 0;
    let steering = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    let arrived = null;
    if (this.route.length) {
      this.routeTimer += dt;
      while (this.route.length && Math.hypot(this.route[0][0] - this.x, this.route[0][1] - this.z) < (this.route.length === 1 ? this.finalTolerance : 1.05)) this.route.shift();
      if (!this.route.length) {
        arrived = this.destinationId;
        this.destinationId = null; this.speed *= .2;
      } else {
        const [tx, tz] = this.route[0];
        const delta = angleDifference(Math.atan2(tx - this.x, tz - this.z), this.heading);
        const desiredSpeed = Math.abs(delta) > .9 ? .65 : Math.abs(delta) > .45 ? 2.7 : 6.3;
        this.speed += clamp(desiredSpeed - this.speed, -10 * dt, 7 * dt);
        this.heading += clamp(delta, -2.7 * dt, 2.7 * dt);
        steering = clamp(delta, -1, 1);
        forward = 0;
        // A clicked location behind a building should stop rather than spin indefinitely.
        if (this.routeTimer > this.routeDurationLimit) { this.cancelRoute(); cancelled = true; }
      }
    } else {
      const maxSpeed = input.boost ? 12 : 7.5;
      if (forward || reverse) this.speed += (forward - reverse) * 12 * traction * dt;
      else this.speed *= Math.exp(-(snowy ? .9 : wet ? 1.5 : 2.2) * dt);
      if (input.brake) this.speed *= Math.exp(-9 * dt);
      this.speed = clamp(this.speed, -4.2, maxSpeed);
      this.heading += steering * Math.sign(this.speed) * 2.2 * Math.min(Math.abs(this.speed) / 4, 1) * traction * dt;
    }
    this.steering += (steering - this.steering) * Math.min(dt * 12, 1);
    if (Math.abs(this.speed) < .015) this.speed = 0;
    const oldX = this.x, oldZ = this.z;
    if (this.route.length) this.velocityHeading = this.heading;
    else this.velocityHeading += angleDifference(this.heading, this.velocityHeading) * (1 - Math.exp(-(snowy ? 3.3 : wet ? 6 : 18) * dt));
    let nextX = this.x + Math.sin(this.velocityHeading) * this.speed * dt;
    let nextZ = this.z + Math.cos(this.velocityHeading) * this.speed * dt;
    for (let pass = 0; pass < 2; pass++) for (const collider of this.colliderIndex.near(nextX, nextZ, 1.6)) {
      const bottom = .1 + this.hop + this.groundHeight;
      // Height ranges let the car travel under lanterns and through gateways,
      // while bridge rails and snow-only scenery remain genuinely solid.
      if (!colliderActive(collider, bottom, bottom + 1.65)) continue;
      if (collider.minY === undefined && this.hop >= 1) continue;
      const contact = fixedContact(nextX, nextZ, this.heading, collider);
      if (!contact) continue;
      nextX += contact.nx * (contact.depth + .003); nextZ += contact.nz * (contact.depth + .003);
      const inward = Math.sin(this.velocityHeading) * this.speed * contact.nx + Math.cos(this.velocityHeading) * this.speed * contact.nz;
      if (inward < -.001) {
        this.speed *= -.25;
        this.collisionImpact = Math.max(this.collisionImpact, Math.abs(previousSpeed));
      }
    }
    const shore = islandRadius(nextX,nextZ);
    if (shore > 1) { nextX /= shore * 1.005; nextZ /= shore * 1.005; this.collisionImpact = Math.max(this.collisionImpact, Math.abs(this.speed)); this.speed *= -.3; }
    if (isWater(nextX, nextZ)) {
      const side = Math.sign(oldZ - riverCenter(oldX) || 1);
      nextZ = riverCenter(nextX) + side * (RIVER_HALF_WIDTH + .025);
      this.collisionImpact = Math.max(this.collisionImpact, Math.abs(this.speed) * .6);
      this.speed *= -.25;
    }
    this.x = nextX; this.z = nextZ;
    this.vx = dt ? (this.x - oldX) / dt : 0; this.vz = dt ? (this.z - oldZ) / dt : 0;
    this.distance += Math.hypot(this.x - oldX, this.z - oldZ);
    this.jumpCooldown=Math.max(0,this.jumpCooldown-dt);this.landingTime=Math.max(0,this.landingTime-dt);this.landingImpact*=Math.exp(-12*dt);
    if(this.jumpPending){this.jumpCharge=Math.max(0,this.jumpCharge-dt);if(!this.jumpCharge){this.jumpPending=false;this.hopVelocity=6.6;this.jumpCooldown=.85;this.hydraulicPhase='airborne';}}
    const wasAirborne=this.hop>0;
    this.hopVelocity -= 12 * dt;
    this.hop += this.hopVelocity * dt;
    if (this.hop < 0) { if(wasAirborne){this.landingImpact=Math.abs(this.hopVelocity);this.hydraulicVelocity=-Math.min(2,this.landingImpact*.24);this.hydraulicPhase='landing';this.landingTime=.16;this.jumpCooldown=Math.max(.16,this.jumpCooldown);}this.hop = 0; this.hopVelocity = 0; }
    const hydraulicTarget=this.jumpPending?-.17:this.hop>.02?.13:this.landingTime>0?-.12:0;
    this.hydraulicVelocity+=((hydraulicTarget-this.hydraulicOffset)*140-this.hydraulicVelocity*18)*dt;
    this.hydraulicOffset=clamp(this.hydraulicOffset+this.hydraulicVelocity*dt,-.21,.17);
    if(!this.jumpPending&&!this.hop&&Math.abs(this.hydraulicOffset)<.002&&Math.abs(this.hydraulicVelocity)<.02){this.hydraulicOffset=0;this.hydraulicVelocity=0;this.hydraulicPhase='idle';}
    const targetGround = Math.max(0, bridgeHeightAt(this.x, this.z) - .1);
    this.groundVelocity += ((targetGround - this.groundHeight) * 85 - this.groundVelocity * 16) * dt;
    this.groundHeight += this.groundVelocity * dt;
    if (Math.abs(this.groundHeight) < .0001 && !targetGround) this.groundHeight = 0;
    const front = bridgeHeightAt(this.x + Math.sin(this.heading) * .72, this.z + Math.cos(this.heading) * .72);
    const back = bridgeHeightAt(this.x - Math.sin(this.heading) * .72, this.z - Math.cos(this.heading) * .72);
    const targetPitch = clamp(Math.atan2(back - front, 1.44) + (this.speed - previousSpeed) * .018, -.3, .3);
    const targetRoll = clamp(-this.steering * this.speed * (snowy ? .022 : .013), -.22, .22);
    this.pitch += (targetPitch - this.pitch) * Math.min(dt * 10, 1); this.roll += (targetRoll - this.roll) * Math.min(dt * 8, 1);
    this.acceleration = dt ? clamp((this.speed - previousSpeed) / dt, -40, 30) : 0;
    this.gear = this.speed < -.2 ? -1 : Math.abs(this.speed) < .2 ? 0 : Math.min(4, Math.floor(Math.abs(this.speed) / 3) + 1);
    const targetRpm = clamp(650 + Math.abs(this.speed) * 280 + Math.max(0, this.acceleration) * 65, 650, 5600);
    this.rpm += (targetRpm - this.rpm) * Math.min(dt * 7, 1);
    for (const [name, side, along] of [['frontLeft', -.72, .68], ['frontRight', .72, .68], ['rearLeft', -.72, -.66], ['rearRight', .72, -.66]]) {
      this.wheelHeights[name] = Math.max(0, bridgeHeightAt(this.x + side * Math.cos(this.heading) + along * Math.sin(this.heading), this.z - side * Math.sin(this.heading) + along * Math.cos(this.heading)) - .1);
    }
    return { arrived, cancelled };
  }
}
