import type { RailBranch, RailMotion } from './types';
export const RAIL_MAX_KMH = 110;
export const KCR_MAX_KMH = 90;
/** Forward limits belong to the corridor, including directed service paths. */
export const railSpeedLimitKmh = (branch: RailBranch | null | undefined, direction: 1 | -1 = 1) => direction === -1 ? 20 : branch === 'kcr' ? KCR_MAX_KMH : RAIL_MAX_KMH;
export const RAIL_ACCELERATION = .35;
export const RAIL_BRAKING = .7;

/** Manual train controls: W traction, S service brake. Stopped trains do not
 * reverse from S. The reverser is changed explicitly at a complete stop; backing is capped at 20 km/h. */
export function stepTrain(state: RailMotion, keys: ReadonlySet<string>, elapsed: number, lengthKm: number, direction: 1 | -1 = 1, minimumKm = 0, cruise: number | null = null, forwardMaxKmh = RAIL_MAX_KMH): RailMotion {
  const dt = Math.max(0, Math.min(.1, elapsed));
  const target = cruise !== null && Number.isFinite(cruise) ? Math.max(0, Math.min((direction === -1 ? 20 : forwardMaxKmh) / 3.6, cruise)) : null;
  const acceleration = keys.has('s') ? -RAIL_BRAKING : keys.has('w') ? RAIL_ACCELERATION : target !== null ? state.velocity < target ? RAIL_ACCELERATION : state.velocity > target ? -RAIL_BRAKING : 0 : -.025;
  let velocity = Math.max(0, Math.min((direction === -1 ? 20 : forwardMaxKmh) / 3.6, state.velocity + acceleration * dt));
  if (target !== null && !keys.has('s') && !keys.has('w')) velocity = state.velocity < target ? Math.min(velocity,target) : Math.max(velocity,target);
  const km = Math.min(lengthKm, Math.max(minimumKm, state.km + direction * (state.velocity + velocity) / 2 * dt / 1000));
  if (direction === 1 ? km >= lengthKm : km <= minimumKm) velocity = 0;
  return { km, velocity };
}
export const brakingDistanceMeters = (velocity: number) => Math.max(0, velocity) ** 2 / (2 * RAIL_BRAKING);
