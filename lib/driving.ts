import type { Coordinate } from './routeData';
export type DriveKey = 'w' | 'a' | 's' | 'd';
export interface VehicleState { position: Coordinate; heading: number; velocity: number; traveledKm: number }
export interface RoadVehicleState extends VehicleState { routeKm: number }

// Shared throttle physics. RoadNetwork owns spatial movement and junction choices.
// A normal city car: 0-60 km/h (16.7 m/s) takes about 6.7 seconds, the forward
// cap matches the road-mode 60 km/h limit, and braking is firmer than pull-away.
export const ROAD_SPEED_LIMIT_KMH = 60;
export const REVERSE_LIMIT_KMH = 25;
const ACCELERATION = 2.5; // m/s²
const BRAKING = 7; // m/s²
const COAST = 1.2; // m/s² of engine/rolling drag

export function nextVelocity(velocity: number, keys: ReadonlySet<DriveKey>, elapsed: number) {
  const dt = Math.max(0, Math.min(elapsed, .1));
  const throttle = Number(keys.has('w')) - Number(keys.has('s'));
  if (throttle) velocity += throttle * (velocity * throttle < 0 ? BRAKING : ACCELERATION) * dt;
  else velocity = Math.sign(velocity) * Math.max(0, Math.abs(velocity) - COAST * dt);
  return Math.max(-REVERSE_LIMIT_KMH / 3.6, Math.min(ROAD_SPEED_LIMIT_KMH / 3.6, velocity));
}
export function isDrivingKey(key: string): key is DriveKey { return ['w', 'a', 's', 'd'].includes(key.toLowerCase()); }
