import type { Coordinate } from './routeData';
export type DriveKey = 'w' | 'a' | 's' | 'd';
export interface VehicleState { position: Coordinate; heading: number; velocity: number; traveledKm: number }
export interface RoadVehicleState extends VehicleState { routeKm: number }

// Shared throttle physics. RoadNetwork owns spatial movement and junction choices.
export function nextVelocity(velocity: number, keys: ReadonlySet<DriveKey>, elapsed: number) {
  const dt = Math.max(0, Math.min(elapsed, .1));
  const throttle = Number(keys.has('w')) - Number(keys.has('s'));
  if (throttle) velocity += throttle * (velocity * throttle < 0 ? 9 : 4.5) * dt;
  else velocity = Math.sign(velocity) * Math.max(0, Math.abs(velocity) - 1.6 * dt);
  return Math.max(-25 / 3.6, Math.min(120 / 3.6, velocity));
}
export function isDrivingKey(key: string): key is DriveKey { return ['w', 'a', 's', 'd'].includes(key.toLowerCase()); }
