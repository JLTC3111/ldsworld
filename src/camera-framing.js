import { ISLAND_BOUNDS } from './world-layout.js';

export const MIN_ZOOM = .88;
export const MAX_ZOOM = 1.04;
export const clampZoom = value => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value));

// Cover the viewport with the island's projected footprint, including portrait screens.
export function islandFrame(aspect, yaw, pitch, zoom = 1) {
  const rightX = Math.cos(yaw), rightZ = -Math.sin(yaw);
  const upX = -Math.sin(yaw) * Math.sin(pitch), upZ = -Math.cos(yaw) * Math.sin(pitch);
  const landWidth = 2 * Math.hypot(ISLAND_BOUNDS.x * rightX, ISLAND_BOUNDS.z * rightZ);
  const landHeight = 2 * Math.hypot(ISLAND_BOUNDS.x * upX, ISLAND_BOUNDS.z * upZ);
  // Preserve a close, readable driving view as the playable area grows.
  const viewWidth = 2 * Math.hypot(28 * rightX, 21 * rightZ);
  const viewHeight = 2 * Math.hypot(28 * upX, 21 * upZ);
  const height = Math.min(viewHeight, viewWidth / aspect) * .94 * clampZoom(zoom);
  const width = height * aspect;
  return { width, height, yaw, pitch,
    horizontalLimit: Math.max(0, (landWidth - width) / 2),
    verticalLimit: Math.max(0, (landHeight - height) / 2) };
}

export function constrainIslandFocus(x, z, frame) {
  const cosine = Math.cos(frame.yaw), sine = Math.sin(frame.yaw), elevation = Math.sin(frame.pitch);
  const right = Math.max(-frame.horizontalLimit, Math.min(frame.horizontalLimit, x * cosine - z * sine));
  const up = Math.max(-frame.verticalLimit, Math.min(frame.verticalLimit, -x * sine * elevation - z * cosine * elevation));
  return { x: right * cosine - up * sine / elevation, z: -right * sine - up * cosine / elevation };
}

export function keepVehicleVisible(focus, frame, vehicle, viewportHeight) {
  const cosine = Math.cos(frame.yaw), sine = Math.sin(frame.yaw), elevation = Math.sin(frame.pitch);
  const carRight = vehicle.x * cosine - vehicle.z * sine;
  const carGround = -vehicle.x * sine * elevation - vehicle.z * cosine * elevation;
  const roof = carGround + ((vehicle.y || 0) + 3.1) * Math.cos(frame.pitch);
  const feet = carGround + ((vehicle.y || 0) + .1) * Math.cos(frame.pitch);
  const safeTop = frame.height * (.5 - Math.min(.23, 110 / viewportHeight));
  const safeBottom = frame.height * (.5 - Math.min(.24, 100 / viewportHeight));
  const leash = frame.height * Math.min(.3, .1 + 80 / viewportHeight);
  let right = focus.x * cosine - focus.z * sine;
  let up = -focus.x * sine * elevation - focus.z * cosine * elevation;
  up = Math.max(roof - safeTop, Math.min(feet + safeBottom, up));
  up = Math.max(-frame.verticalLimit - leash, Math.min(frame.verticalLimit + leash, up));
  const safeSide = Math.max(.2, frame.width / 2 - 1.35);
  right = Math.max(carRight - safeSide, Math.min(carRight + safeSide, right));
  right = Math.max(-frame.horizontalLimit - 1.5, Math.min(frame.horizontalLimit + 1.5, right));
  return { x: right * cosine - up * sine / elevation, z: -right * sine - up * cosine / elevation };
}
