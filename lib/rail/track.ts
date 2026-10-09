import { along, bearing, distance, lineString } from '@turf/turf';
import type { Coordinate } from '../routeData';
import type { RailPath } from './types';

export function indexTrack(path: RailPath) {
  const cumulative = [0];
  for (let i = 1; i < path.coordinates.length; i++) cumulative.push(cumulative[i - 1] + distance(path.coordinates[i - 1], path.coordinates[i]));
  return { path, cumulative, lengthKm: cumulative.at(-1)! };
}
export function sampleTrack(track: ReturnType<typeof indexTrack>, km: number) {
  const target = Math.max(0, Math.min(km, track.lengthKm));
  let low = 0, high = track.cumulative.length - 1;
  while (low + 1 < high) { const mid = (low + high) >>> 1; if (track.cumulative[mid] <= target) low = mid; else high = mid; }
  const a = track.path.coordinates[low], b = track.path.coordinates[low + 1];
  const position = along(lineString([a, b]), target - track.cumulative[low]).geometry.coordinates as Coordinate;
  return { position, heading: (bearing(a, b) + 360) % 360 };
}
export function nextStation(path: RailPath, km: number) { return path.stations.find(station => station.km > km + .015) ?? null; }
export function reversePath(path: RailPath): RailPath {
  return { ...path, reversals: path.reversals?.toReversed().map(stop => ({ ...stop, km: path.distanceKm - stop.km })), coordinates: [...path.coordinates].reverse(), stations: [...path.stations].reverse().map(station => ({ ...station, km: path.distanceKm - station.km })) };
}
