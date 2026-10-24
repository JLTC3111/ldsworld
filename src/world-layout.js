// Expand the land, never the scale of a vehicle, building, tree or prop.
export const WORLD_SCALE = 5;
export const ISLAND_BOUNDS = Object.freeze({ x:28*WORLD_SCALE, z:21*WORLD_SCALE });
export const RIVER_REACH = 29*WORLD_SCALE;
export const MAP_BOUNDS = Object.freeze({ x:33*WORLD_SCALE, z:25*WORLD_SCALE });
export const MAP_VIEWBOX = `${-MAP_BOUNDS.x} ${-MAP_BOUNDS.z} ${MAP_BOUNDS.x*2} ${MAP_BOUNDS.z*2}`;
export const islandRadius = (x,z,margin=0) => Math.hypot(x/(ISLAND_BOUNDS.x-margin),z/(ISLAND_BOUNDS.z-margin));
export const ROAD_WIDTHS = Object.freeze({ring:4.9,shoulder:5.5,spine:4.2});
export const RIVER_HALF_WIDTH = 1.05;
export const riverCenter = x => 3.4 + Math.sin(x * .25) * .45;
export const bridges = [
  { id: 'west', x: -19.4, z: riverCenter(-19.4), heading: .165, width: 8.4, length: 6.2 },
  { id: 'village', x: 0, z: riverCenter(0), heading: 0, width: 8.4, length: 6.2 },
  { id: 'east', x: 19.15, z: riverCenter(19.15), heading: -.278, width: 8.4, length: 6.2 },
  { id: 'outer-west', x:-99.4, z:riverCenter(-99.4), heading:.165, width:8.4, length:6.2 },
  { id: 'outer-east', x:99, z:riverCenter(99), heading:-.25, width:8.4, length:6.2 }
];
export const portals = [
  { id: 'west-gate', x: -23, z: -8, exitX: 21, exitZ: 10.5, heading: -Math.PI / 2, color: '#78dfd1' },
  { id: 'east-gate', x: 23, z: 8.7, exitX: -21, exitZ: -10, heading: Math.PI / 2, color: '#c1a2f3' }
];
export const houses = [
  {x:-36,z:-42,scale:1.5,color:'#d6a178'}, {x:28,z:-48,scale:1.5,color:'#d2bc87'},
  {x:58,z:27,scale:1.5,color:'#a3b9ab'}, {x:-45,z:50,scale:1.5,color:'#b0a1bd'}
];
export function bridgeAt(x, z) {
  return bridges.find(bridge => {
    const dx = x - bridge.x, dz = z - bridge.z;
    const side = dx * Math.cos(bridge.heading) - dz * Math.sin(bridge.heading);
    const along = dx * Math.sin(bridge.heading) + dz * Math.cos(bridge.heading);
    return Math.abs(side) <= bridge.width / 2 && Math.abs(along) <= bridge.length / 2;
  });
}
export function bridgeHeightAt(x, z) {
  const bridge = bridgeAt(x, z); if (!bridge) return 0;
  const along = (x - bridge.x) * Math.sin(bridge.heading) + (z - bridge.z) * Math.cos(bridge.heading);
  return .12 + .52 * Math.cos(along / (bridge.length / 2) * Math.PI / 2) ** 2;
}
export const isRiver = (x, z, margin = 0) => Math.abs(x) < RIVER_REACH && Math.abs(z - riverCenter(x)) < RIVER_HALF_WIDTH + margin;
export const isWater = (x, z) => isRiver(x, z) && !bridgeAt(x, z);
export const driveHeightAt=(x,z)=>bridgeAt(x,z)?Math.max(0,bridgeHeightAt(x,z)-.1):isWater(x,z)?-.09:0;
export function crossesWater(a, b) {
  const count = Math.max(2, Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / .45));
  for (let i = 0; i <= count; i++) {
    const t = i / count;
    if (isWater(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)) return true;
  }
  return false;
}
