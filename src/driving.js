import { vehicleModel } from './vehicle-models.js';
import { powertrainState } from './powertrain.js';
import { AerialDynamics, DRIVE_TUNING } from './aerial-dynamics.js';
import { bridges, bridgeHeightAt, driveHeightAt, isWater, WORLD_SCALE, ISLAND_BOUNDS, islandRadius, ROAD_WIDTHS, bridgeAt } from './world-layout.js';
import { ColliderIndex, colliderActive } from './physics.js';

export const roadNodes = {
  r0: [-18, -7], r1: [-12, -12.5], r2: [0, -13], r3: [12, -12],
  r4: [19, -6], r5: [20, -.9], r6: [18, 7], r7: [12, 12.5],
  r8: [0, 13], r9: [-12, 12.5], r10: [-19, 6], r11: [-20, 0],
  c0: [0, 0], c1: [-7, 0], c2: [8, -.9], 'link-west-1':[-16,-15], 'link-west-2':[-30,-23]
};
// The east junction sits just below the bridge entrance so a full-length car
// can turn onto the cross-island road without clipping its solid guardrail.
export const roadLoop = Array.from({ length: 12 }, (_, i) => roadNodes[`r${i}`]);
for(let i=0;i<12;i++) roadNodes[`o${i}`]=roadLoop[i].map(value=>value*WORLD_SCALE);
export const outerRoadLoop=Array.from({length:12},(_,i)=>roadNodes[`o${i}`]);
export const connectorPaths=[['r2','o2'],['r8','o8'],['r0','link-west-1','link-west-2','o0'],['r4','o4']];
for (const bridge of bridges) {
  roadNodes[`bridge-${bridge.id}-north`] = [bridge.x - Math.sin(bridge.heading) * 2.7, bridge.z - Math.cos(bridge.heading) * 2.7];
  roadNodes[`bridge-${bridge.id}-south`] = [bridge.x + Math.sin(bridge.heading) * 2.7, bridge.z + Math.cos(bridge.heading) * 2.7];
}
const edges = Array.from({ length: 12 }, (_, i) => [`r${i}`, `r${(i + 1) % 12}`]).filter(([a, b]) => !(['r5', 'r6'].includes(a) && ['r5', 'r6'].includes(b)) && !(['r10', 'r11'].includes(a) && ['r10', 'r11'].includes(b)));
edges.push(...Array.from({length:12},(_,i)=>[`o${i}`,`o${(i+1)%12}`]).filter(([a,b])=>!(['o5','o6'].includes(a)&&['o5','o6'].includes(b))&&!(['o10','o11'].includes(a)&&['o10','o11'].includes(b))));
for(const route of connectorPaths)for(let i=1;i<route.length;i++)edges.push([route[i-1],route[i]]);
edges.push(['r2', 'c0'], ['r11', 'c1'], ['c1', 'c0'], ['c0', 'c2'], ['c2', 'r5']);
for (const [id, a, b] of [['west', 'r11', 'r10'], ['village', 'c0', 'r8'], ['east', 'r5', 'r6'],['outer-west','o11','o10'],['outer-east','o5','o6']]) edges.push([a, `bridge-${id}-north`], [`bridge-${id}-north`, `bridge-${id}-south`], [`bridge-${id}-south`, b]);
const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const clamp = (x, lo, hi) => Math.min(Math.max(x, lo), hi);
export const angleDifference = (target, current) => Math.atan2(Math.sin(target - current), Math.cos(target - current));
export const CAR_HALF_WIDTH = .84;
export const CAR_HALF_LENGTH = 1.33;

function fixedContact(x, z, heading, obstacle, halfWidth=CAR_HALF_WIDTH, halfLength=CAR_HALF_LENGTH) {
  if (obstacle.radius && !obstacle.width) obstacle = { ...obstacle, width: obstacle.radius * 2, depth: obstacle.radius * 2 };
  const rightX = Math.cos(heading), rightZ = -Math.sin(heading), forwardX = Math.sin(heading), forwardZ = Math.cos(heading);
  const dx = x - obstacle.x, dz = z - obstacle.z, halfX = obstacle.width / 2, halfZ = obstacle.depth / 2;
  let depth = Infinity, nx = 0, nz = 0;
  // The world axes and the car's two local axes form the separating-axis test.
  // Resolving along its smallest overlap avoids an oversized diagonal AABB.
  for (const [axisX, axisZ] of [[1, 0], [0, 1], [rightX, rightZ], [forwardX, forwardZ]]) {
    const carRadius = halfWidth * Math.abs(axisX * rightX + axisZ * rightZ) + halfLength * Math.abs(axisX * forwardX + axisZ * forwardZ);
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
  const clear = (a, b) => !colliders.some(c => {
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
  const nodes = [start, goal, ...[...Object.values(roadNodes), ...corners].filter(p => islandRadius(...p) < .995 && !colliders.some(c => inside(p, c)))];
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
    this.profile=vehicleModel('explorer').profile;
    this.attitude=new AerialDynamics();
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
    this.attitude.reset(this.heading);this.airborne=false;this.boosting=false;this.rideHeight=this.profile.raised;this.hydraulicsRaised=true;
    this.inWater=false;this.collisionImpact = 0; this.weather = 'clear';
    this.blastFlightTime=0;
    this.acceleration = 0; this.rpm = 950; this.gear = 0;this.throttle=0;
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
  setVehicleProfile(profile){this.profile=profile||vehicleModel('explorer').profile;this.rideHeight=this.hydraulicsRaised?this.profile.raised:this.profile.low;this.attitude.bodyTop=this.profile.bodyTop+this.rideHeight;this.attitude.halfWidth=this.profile.halfWidth+.1;this.attitude.halfLength=this.profile.halfLength+.12;}
  canPark(x,z){if(islandRadius(x,z,2)>1||isWater(x,z))return false;const bottom=driveHeightAt(x,z)+.1;for(const c of this.colliderIndex.near(x,z,3))if(colliderActive(c,bottom,bottom+this.profile.bodyTop+this.profile.raised)&&fixedContact(x,z,this.heading,c,this.profile.halfWidth+.15,this.profile.halfLength+.15))return false;return true;}
  teleport(x,z,heading=this.heading){this.x=x;this.z=z;this.heading=this.velocityHeading=heading;this.cancelRoute();this.speed=0;this.vx=0;this.vz=0;this.groundHeight=driveHeightAt(x,z);this.groundVelocity=0;this.settle();this.inWater=isWater(x,z);}
  applyImpulse({x=0,y=0,z=0},spin=0){
    if(!this.attitude.flying){this.attitude.takeoff(this.heading,this.pitch,this.roll);this.vx=Math.sin(this.velocityHeading)*this.speed;this.vz=Math.cos(this.velocityHeading)*this.speed;}
    this.cancelRoute();this.jumpPending=false;this.jumpCharge=0;this.airborne=true;this.hop=Math.max(.03,this.hop);this.hopVelocity=Math.min(16,Math.max(0,this.hopVelocity)+y);this.vx+=x;this.vz+=z;this.attitude.angularVelocity.z+=spin;this.hydraulicPhase='airborne';
  }
  launchFromBlast({x,z,strength=8}){
    const dx=this.x-x,dz=this.z-z,length=Math.hypot(dx,dz);
    const nx=length>.05?dx/length:-Math.sin(this.heading),nz=length>.05?dz/length:-Math.cos(this.heading);
    // Nearby chained crates share one short reaction instead of stacking
    // velocity and airtime until the car crosses the island.
    if(this.blastFlightTime>0)return false;
    const shove=clamp(strength,3,8);
    if(!this.attitude.flying)this.attitude.takeoff(this.heading,this.pitch,this.roll);
    this.cancelRoute();this.jumpPending=false;this.jumpCharge=0;this.airborne=true;
    this.hop=Math.max(.08,this.hop);this.hopVelocity=Math.max(2.8,Math.min(4,this.hopVelocity));
    // Replace forward momentum so a frontal collision throws the car back away
    // from the crate, rather than letting it continue driving through the blast.
    this.vx=nx*shove;this.vz=nz*shove;this.speed=shove;
    this.attitude.angularVelocity.set(-1.3,0,0);this.attitude.impulseTime=.12;
    this.blastFlightTime=.9;this.hydraulicPhase='airborne';return true;
  }
  toggleHydraulics(){this.hydraulicsRaised=!this.hydraulicsRaised;return this.hydraulicsRaised;}
  jump() {
    if(this.attitude.flying)return false;
    if(this.hop>.015||this.jumpPending||this.jumpCooldown>0)return false;
    this.cancelRoute();this.jumpPending=true;this.jumpCharge=.14;this.hydraulicPhase='charging';return true;
  }
  settle(){this.hop=0;this.hopVelocity=0;this.airborne=false;this.attitude.reset(this.heading);this.jumpPending=false;this.jumpCharge=0;this.hydraulicOffset=0;this.hydraulicVelocity=0;this.hydraulicPhase='idle';this.jumpCooldown=0;this.landingTime=0;this.boosting=false;this.blastFlightTime=0;}
  step(elapsed,input={}){
    const duration=clamp(elapsed,0,.05),steps=Math.max(1,Math.ceil(duration*120));let arrived=null,cancelled=false;
    for(let i=0;i<steps;i++){const result=this._step(duration/steps,input);if(result.arrived)arrived=result.arrived;cancelled ||= result.cancelled;}
    return {arrived,cancelled};
  }
  _step(elapsed, input = {}) {
    const dt = clamp(elapsed, 0, .05);
    const wet = this.weather === 'rain', snowy = this.weather === 'snow';
    const traction = snowy ? .78 : wet ? .9 : 1;
    const previousSpeed = this.speed, flying=this.attitude.flying;
    this.blastFlightTime=Math.max(0,this.blastFlightTime-dt);
    this.attitude.bodyTop=this.profile.bodyTop+this.rideHeight+this.hydraulicOffset;this.attitude.halfWidth=this.profile.halfWidth+.1;this.attitude.halfLength=this.profile.halfLength+.12;
    this.boosting=Boolean(input.boost)&&(!this.route.length||Boolean(input.forward));
    this.collisionImpact *= Math.exp(-5 * dt);
    const manual = input.forward || input.reverse || input.left || input.right || input.brake || input.boost;
    let cancelled = false;
    if (manual && this.route.length) { this.cancelRoute(); cancelled = true; }
    let forward = input.forward ? 1 : 0;
    let reverse = input.reverse ? 1 : 0;
    let steering = (input.left ? 1 : 0) - (input.right ? 1 : 0);
    let arrived = null;
    if (flying) {
      this.attitude.stepAir(dt,input);
      const thrust=this.boosting?DRIVE_TUNING.airThrust:0, nose=this.attitude.forward;
      this.vx=(this.vx+nose.x*thrust*dt)*Math.exp(-.06*dt);this.vz=(this.vz+nose.z*thrust*dt)*Math.exp(-.06*dt);this.hopVelocity+=nose.y*thrust*dt;
      const speed=Math.hypot(this.vx,this.vz);if(speed>DRIVE_TUNING.airSpeed){this.vx*=DRIVE_TUNING.airSpeed/speed;this.vz*=DRIVE_TUNING.airSpeed/speed;}
      this.hopVelocity=clamp(this.hopVelocity,-26,16);if(this.hop>DRIVE_TUNING.ceiling)this.hopVelocity=Math.min(0,this.hopVelocity);
      if(Math.hypot(nose.x,nose.z)>.15)this.heading=Math.atan2(nose.x,nose.z);
      this.speed=Math.hypot(this.vx,this.vz);
    } else if (this.route.length) {
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
      const maxSpeed = input.boost ? DRIVE_TUNING.boostSpeed : DRIVE_TUNING.speed;
      if (forward || reverse || input.boost) this.speed += ((forward || (input.boost&&!reverse)?1:0) - reverse) * DRIVE_TUNING.acceleration * traction * dt;
      else this.speed *= Math.exp(-(snowy ? .9 : wet ? 1.5 : 2.2) * dt);
      if (input.brake) this.speed *= Math.exp(-9 * dt);
      this.speed = clamp(this.speed, -DRIVE_TUNING.reverseSpeed, maxSpeed);
      this.heading += steering * Math.sign(this.speed) * 3.2 * Math.min(Math.abs(this.speed) / 4, 1) * (1-.32*Math.min(1,Math.abs(this.speed)/DRIVE_TUNING.boostSpeed)) * traction * dt;
      if(this.attitude.recovering)this.speed*=Math.exp(-5*dt);
    }
    this.steering += (steering - this.steering) * Math.min(dt * 12, 1);
    if (Math.abs(this.speed) < .015) this.speed = 0;
    const oldX = this.x, oldZ = this.z;
    if (!flying&&this.route.length) this.velocityHeading = this.heading;
    else if(!flying)this.velocityHeading += angleDifference(this.heading, this.velocityHeading) * (1 - Math.exp(-(snowy ? 3.3 : wet ? 6 : 18) * dt));
    let nextX = this.x + (flying?this.vx:Math.sin(this.velocityHeading)*this.speed)*dt;
    let nextZ = this.z + (flying?this.vz:Math.cos(this.velocityHeading)*this.speed)*dt;
    const airBounds=flying||this.attitude.recovering?this.attitude.bounds():null;
    for (let pass = 0; pass < 2; pass++) for (const collider of this.colliderIndex.near(nextX+(airBounds?.offsetX||0),nextZ+(airBounds?.offsetZ||0),airBounds?2.5:1.6)) {
      const bottom = this.hop + this.groundHeight + (airBounds?airBounds.bottom+this.attitude.supportLift:.1);
      // Height ranges let the car travel under lanterns and through gateways,
      // while bridge rails and snow-only scenery remain genuinely solid.
      if (!colliderActive(collider, bottom, bottom + (airBounds?airBounds.top-airBounds.bottom:2.5))) continue;
      if (collider.minY === undefined && this.hop >= 1) continue;
      const roof=!airBounds&&(collider.minY??0)>this.groundHeight+this.hop+1.5;
      const contact=fixedContact(nextX+(airBounds?.offsetX||0),nextZ+(airBounds?.offsetZ||0),airBounds?0:this.heading,collider,airBounds?.halfX??(roof?this.profile.halfWidth*.74:this.profile.halfWidth),airBounds?.halfZ??(roof?this.profile.halfLength*.6:this.profile.halfLength));
      if (!contact) continue;
      const impactSpeed=Math.max(0,-((flying?this.vx:Math.sin(this.velocityHeading)*this.speed)*contact.nx+(flying?this.vz:Math.cos(this.velocityHeading)*this.speed)*contact.nz));
      if(impactSpeed>.1&&this.onImpact?.(collider,impactSpeed)){this.speed*=.88;continue;}
      nextX += contact.nx * (contact.depth + .003); nextZ += contact.nz * (contact.depth + .003);
      const inward = (flying?this.vx:Math.sin(this.velocityHeading)*this.speed)*contact.nx+(flying?this.vz:Math.cos(this.velocityHeading)*this.speed)*contact.nz;
      if (inward < -.001) {
        if(flying){this.vx-=inward*contact.nx*1.35;this.vz-=inward*contact.nz*1.35;this.attitude.angularVelocity.x+=contact.nz*inward*.1;this.attitude.angularVelocity.z-=contact.nx*inward*.1;}
        this.speed *= -.25;
        this.collisionImpact = Math.max(this.collisionImpact, Math.abs(previousSpeed));
      }
    }
    const shore = islandRadius(nextX,nextZ);
    if(shore>1){
      nextX/=shore*1.005;nextZ/=shore*1.005;this.collisionImpact=Math.max(this.collisionImpact,Math.abs(this.speed));this.speed*= -.3;
      if(flying){const nx=nextX/(ISLAND_BOUNDS.x**2),nz=nextZ/(ISLAND_BOUNDS.z**2),length=Math.hypot(nx,nz),outward=(this.vx*nx+this.vz*nz)/length;if(outward>0){this.vx-=outward*nx/length*1.35;this.vz-=outward*nz/length*1.35;}}
    }
    this.inWater=isWater(nextX,nextZ);
    if(this.inWater&&!flying&&this.hop<.1)this.speed*=Math.exp(-1.05*dt);
    this.x = nextX; this.z = nextZ;
    if(!flying){this.vx=dt?(this.x-oldX)/dt:0;this.vz=dt?(this.z-oldZ)/dt:0;}
    this.distance += Math.hypot(this.x - oldX, this.z - oldZ);
    this.jumpCooldown=Math.max(0,this.jumpCooldown-dt);this.landingTime=Math.max(0,this.landingTime-dt);this.landingImpact*=Math.exp(-12*dt);
    if(this.jumpPending){this.jumpCharge=Math.max(0,this.jumpCharge-dt);if(!this.jumpCharge){this.jumpPending=false;this.hopVelocity=DRIVE_TUNING.jumpSpeed;this.jumpCooldown=.3;this.hydraulicPhase='airborne';this.attitude.takeoff(this.heading,this.pitch,this.roll);this.vx=Math.sin(this.velocityHeading)*this.speed;this.vz=Math.cos(this.velocityHeading)*this.speed;}}
    const wasAirborne=this.attitude.flying;
    if(wasAirborne||this.hop>0){this.hopVelocity-=DRIVE_TUNING.gravity*dt;this.hop+=this.hopVelocity*dt;}
    const support=wasAirborne?Math.max(0,.08-this.attitude.bounds().bottom):0;
    if(this.hop<=support&&this.hopVelocity<0){
      if(wasAirborne){
        this.landingImpact=Math.abs(this.hopVelocity);this.hydraulicVelocity=-Math.min(3,this.landingImpact*.24);this.hydraulicPhase='landing';this.landingTime=.2;this.jumpCooldown=Math.max(.16,this.jumpCooldown);
        const projected=this.vx*Math.sin(this.heading)+this.vz*Math.cos(this.heading);this.speed=Math.hypot(this.vx,this.vz)*Math.sign(projected||1);this.velocityHeading=Math.atan2(this.vx,this.vz)+(this.speed<0?Math.PI:0);this.attitude.land(this.heading);
      }
      this.hop=0;this.hopVelocity=0;
    }
    this.airborne=this.attitude.flying;
    if(!this.airborne)this.attitude.stepGround(dt,this.heading);
    const hydraulicTarget=this.jumpPending?-.25:this.airborne?.48:this.landingTime>0?-.2:0;
    this.hydraulicVelocity+=((hydraulicTarget-this.hydraulicOffset)*140-this.hydraulicVelocity*18)*dt;
    this.hydraulicOffset=clamp(this.hydraulicOffset+this.hydraulicVelocity*dt,-.29,.52);
    const rideTarget=this.hydraulicsRaised?this.profile.raised:this.profile.low;this.rideHeight+=(rideTarget-this.rideHeight)*(1-Math.exp(-5*dt));
    if(!this.jumpPending&&!this.hop&&Math.abs(this.hydraulicOffset)<.002&&Math.abs(this.hydraulicVelocity)<.02){this.hydraulicOffset=0;this.hydraulicVelocity=0;this.hydraulicPhase='idle';}
    const targetGround = driveHeightAt(this.x,this.z);
    this.groundVelocity += ((targetGround - this.groundHeight) * 85 - this.groundVelocity * 16) * dt;
    this.groundHeight += this.groundVelocity * dt;
    if (Math.abs(this.groundHeight) < .0001 && !targetGround) this.groundHeight = 0;
    const front = driveHeightAt(this.x + Math.sin(this.heading) * .72, this.z + Math.cos(this.heading) * .72);
    const back = driveHeightAt(this.x - Math.sin(this.heading) * .72, this.z - Math.cos(this.heading) * .72);
    const targetPitch = clamp(Math.atan2(back - front, 1.44) + (this.speed - previousSpeed) * .018, -.3, .3);
    const targetRoll = clamp(-this.steering * this.speed * (snowy ? .022 : .013), -.22, .22);
    this.pitch += (targetPitch - this.pitch) * Math.min(dt * 10, 1); this.roll += (targetRoll - this.roll) * Math.min(dt * 8, 1);
    this.acceleration = dt ? clamp((this.speed - previousSpeed) / dt, -40, 30) : 0;
    this.throttle=input.brake?0:this.boosting||forward||reverse?1:this.route.length ? .42 : 0;
    const powertrain=powertrainState(this.speed,{throttle:this.throttle,airborne:this.airborne,boosting:this.boosting});
    this.gear=powertrain.gear;
    const targetRpm=powertrain.rpm;
    this.rpm += (targetRpm - this.rpm) * Math.min(dt * 7, 1);
    for (const [name, side, along] of [['frontLeft', -.72, .68], ['frontRight', .72, .68], ['rearLeft', -.72, -.66], ['rearRight', .72, -.66]]) {
      this.wheelHeights[name] = driveHeightAt(this.x + side * Math.cos(this.heading) + along * Math.sin(this.heading), this.z - side * Math.sin(this.heading) + along * Math.cos(this.heading));
    }
    return { arrived, cancelled };
  }
}

const distanceToSegment=(x,z,a,b)=>{const dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz)));return Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t);};
export function drivingSurfaceAt(x,z){
  if(isWater(x,z))return 'water';if(bridgeAt(x,z))return 'bridge';
  if([roadLoop,outerRoadLoop].some(loop=>loop.some((p,i)=>distanceToSegment(x,z,p,loop[(i+1)%loop.length])<ROAD_WIDTHS.ring/2)))return 'road';
  if(connectorPaths.some(path=>path.slice(1).some((key,i)=>distanceToSegment(x,z,roadNodes[path[i]],roadNodes[key])<ROAD_WIDTHS.spine/2))||Math.abs(x)<ROAD_WIDTHS.spine/2&&Math.abs(z)<14||Math.abs(z)<ROAD_WIDTHS.spine/2&&Math.abs(x)<21)return 'road';return 'grass';
}
