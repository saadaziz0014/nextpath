import type { RailMotion, RailPath } from './types';
import { stepRailJourney } from './journey';
import { railSpeedLimitKmh } from './physics';
/** Cruise targets use m/s, matching physics. W overrides; S always cancels.
 * Automatic engagement happens only when manual traction reaches the limit. */
export function stepCruiseJourney(state: RailMotion, keys: ReadonlySet<string>, elapsed: number, path: RailPath, confirmed: ReadonlySet<string>, direction: 1 | -1, target: number | null) {
  const limit = railSpeedLimitKmh(path.id, direction) / 3.6;
  if (target !== null && Number.isFinite(target)) target = Math.min(target, limit);
  if (keys.has('s') || keys.has('w')) target = null;
  const motion = stepRailJourney(state,keys,elapsed,path,confirmed,direction,target);
  if (!keys.has('s') && keys.has('w') && motion.velocity >= limit - .000001) target = limit;
  if (motion.velocity === 0) target = null;
  return { motion, target };
}
