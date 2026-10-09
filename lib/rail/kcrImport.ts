import { distance, lineString, nearestPointOnLine } from '@turf/turf';
import type { Coordinate } from '../routeData';
import { indexTrack } from './track';
import { assertRailPathQuality } from './quality';
import type { RailPath, RailStation } from './types';

export interface KcrStationSnapshot {
  osm3s: { timestamp_osm_base: string };
  elements: { type: string; id: number; lon?: number; lat?: number; tags?: Record<string, string> }[];
}

// Stable OSM station IDs identify the corridor, rather than fuzzy name matches
// that could select a similarly named suburb, bus stop or station building.
const calls: readonly [string, string][] = [
  ['539432952', 'Karachi City'], ['14185206054', 'Karachi Cantonment'],
  ['3523382867', 'Drigh Road'], ['4104333346', 'Airport'],
  ['5226556649', 'Malir Colony'], ['13306443777', 'Malir'],
  ['4104332771', 'Landhi'], ['13306443776', 'Jumma Goth'],
  ['5164599146', 'Bin Qasim'], ['13368860507', 'Badal Nala'],
  ['2775029954', 'Dhabeji'],
];

/** Reuse the already sourced, connected City–Dhabeji section of Fareed's ML-1
 * track. No straight-line station joins or new long-distance routing: adding a
 * local service must not change the geometry of existing saved journeys.
 * Departure Yard, Drigh Colony and Pipri have unverified/ambiguous locations
 * and are deliberately not fabricated. The UI and research document say so.
 */
export function buildKcrLocalPath(corridor: RailPath, snapshot: KcrStationSnapshot): RailPath {
  if (corridor.id !== 'fareed') throw new Error('KCR needs the sourced Fareed ML-1 corridor.');
  const city = corridor.stations.find(station => station.id === calls[0][0]);
  const dhabeji = corridor.stations.find(station => station.id === calls.at(-1)![0]);
  if (!city || !dhabeji || city.km > .000001 || dhabeji.km <= city.km) throw new Error('Missing KCR corridor terminals.');
  const track = indexTrack(corridor);
  if (distance(corridor.coordinates[0], city.coordinate) > .00001) throw new Error('KCR origin does not match Karachi City.');
  // Preserve every original vertex through Dhabeji. The projected terminal is
  // within the last original edge, so trimming never creates an off-track gap.
  const coordinates = corridor.coordinates.filter((_, i) => track.cumulative[i] < dhabeji.km - 1e-9);
  coordinates.push([...dhabeji.coordinate]);
  const line = lineString(coordinates);
  const stations: RailStation[] = calls.map(([id, name]) => {
    const existing = corridor.stations.find(station => station.id === id);
    let sourceCoordinate: Coordinate;
    if (id === '5226556649') {
      const matches = snapshot.elements.filter(element => element.type === 'node' && String(element.id) === id);
      const halt = matches[0];
      // Malir Halt explicitly records Malir Colony as its English alternate
      // name. Never substitute the separate Malir or Malir Cantt stations.
      if (matches.length !== 1 || halt.tags?.railway !== 'halt' || halt.tags?.['alt_name:en'] !== 'Malir Colony' || !Number.isFinite(halt.lon) || !Number.isFinite(halt.lat)) throw new Error('Missing verified Malir Colony halt.');
      sourceCoordinate = [halt.lon!, halt.lat!];
    } else {
      if (!existing || existing.km > dhabeji.km + .000001) throw new Error(`Missing KCR source station: ${name}.`);
      sourceCoordinate = [...existing.sourceCoordinate];
    }
    const projected = nearestPointOnLine(line, sourceCoordinate);
    const offsetMeters = (projected.properties.dist ?? Infinity) * 1000;
    if (!Number.isFinite(offsetMeters) || offsetMeters > 250) throw new Error(`KCR station too far from track: ${name}.`);
    return { id, name, sourceCoordinate, coordinate: projected.geometry.coordinates as Coordinate, km: projected.properties.location, offsetMeters };
  });
  const result: RailPath = { id: 'kcr', name: 'KCR local · Karachi City–Dhabeji', coordinates, stations, distanceKm: indexTrack({ ...corridor, coordinates }).lengthKm };
  if (result.distanceKm < 50 || result.distanceKm > 60 || stations.some((station, i) => i > 0 && station.km <= stations[i - 1].km)) throw new Error('Unexpected KCR corridor length or station order.');
  if (stations[0].km > .000001 || result.distanceKm - stations.at(-1)!.km > .000001) throw new Error('KCR stations do not match its track terminals.');
  assertRailPathQuality(result);
  return result;
}
