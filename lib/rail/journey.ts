import type { RailMotion, RailPath } from './types';
import { stepTrain, railSpeedLimitKmh } from './physics';

/** Kasur is a physical reversal, not a corner to drive through at speed. Keep
 * the next unconfirmed reversal as a hard end of the current driving leg. */
export function nextReversal(path: RailPath, km: number, confirmed: ReadonlySet<string>) {
  return path.reversals?.find(stop => !confirmed.has(stop.stationId) && stop.km >= km - .000001) ?? null;
}
export function stepRailJourney(state: RailMotion, keys: ReadonlySet<string>, elapsed: number, path: RailPath, confirmed: ReadonlySet<string>, direction: 1 | -1 = 1, cruise: number | null = null) {
  // Backing stays within the current physical leg. A station reversal must not
  // be crossed backwards without reconfiguring the locomotive at that boundary.
  const minimum = path.reversals?.filter(stop => stop.km <= state.km + .000001).at(-1)?.km ?? 0;
  return stepTrain(state, keys, elapsed, nextReversal(path, state.km, confirmed)?.km ?? path.distanceKm, direction, direction === -1 ? minimum : 0, cruise, railSpeedLimitKmh(path.id));
}
export function confirmableReversal(path: RailPath, state: RailMotion, confirmed: ReadonlySet<string>) {
  const stop = nextReversal(path, state.km, confirmed);
  return stop && state.velocity === 0 && Math.abs(stop.km - state.km) < .000001 ? stop : null;
}
