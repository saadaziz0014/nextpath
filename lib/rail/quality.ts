import { bearing, distance } from '@turf/turf';
import type { RailPath } from './types';

/** Ordinary legs cannot retrace or reverse. A declared station reversal splits
 * the journey into separately checked legs; it never excuses a gap or a loop
 * within either leg. The simulator requires confirmation at that boundary. */
export function assertRailPathQuality(path: RailPath) {
  let seen = new Set<string>(), length = 0;
  const reversals = path.reversals ?? [];
  let reversalIndex = 0;
  for (let i = 0; i < path.coordinates.length; i++) {
    const point = path.coordinates[i];
    if (i) {
      const edge = distance(path.coordinates[i - 1], point);
      if (edge < .000001) throw new Error(`${path.id}: duplicate or zero-length edge ${i}.`);
      length += edge;
    }
    const reversal = reversals[reversalIndex];
    const atReversal = !!reversal && Math.abs(length - reversal.km) < .000001;
    if (atReversal) {
      const station = path.stations.find(station => station.id === reversal.stationId);
      if (!i || i === path.coordinates.length - 1 || !station || Math.abs(station.km - length) > .000001 || distance(station.coordinate, point) > .000001) throw new Error(`${path.id}: invalid station reversal.`);
    }
    if (seen.has(point.join(','))) throw new Error(`${path.id}: track retraced at vertex ${i}.`);
    seen.add(point.join(','));
    if (i && i + 1 < path.coordinates.length) {
      const incoming = bearing(path.coordinates[i - 1], point), outgoing = bearing(point, path.coordinates[i + 1]);
      const turn = Math.abs(((outgoing - incoming + 540) % 360) - 180);
      if (turn > 100 && !atReversal) throw new Error(`${path.id}: impossible reversal at vertex ${i}.`);
      if (atReversal && turn <= 100) throw new Error(`${path.id}: declared reversal is not a direction change.`);
    }
    if (atReversal) { seen = new Set([point.join(',')]); reversalIndex++; }
  }
  if (reversalIndex !== reversals.length) throw new Error(`${path.id}: reversal is not a track vertex.`);
  if (Math.abs(length - path.distanceKm) > .00001) throw new Error(`${path.id}: incorrect route length.`);
}
