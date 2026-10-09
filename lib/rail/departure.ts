import type { RailPath } from './types';
import { indexTrack, reversePath } from './track';

/** Start from station chainage on the actual polyline, never from a building
 * coordinate. Reversal changes track order and bearings without inventing rails. */
export function createRailDeparture(path: RailPath, stationId: string, reverse: boolean) {
  const station = path.stations.find(station => station.id === stationId);
  if (!station) throw new Error('Departure station does not belong to this route.');
  const track = indexTrack(reverse ? reversePath(path) : path);
  const km = Math.max(0, Math.min(track.lengthKm, reverse ? path.distanceKm - station.km : station.km));
  if (track.lengthKm - km < .015) throw new Error('Choose the opposite direction to depart from this terminal.');
  return { track, km, stationId, reverse };
}
