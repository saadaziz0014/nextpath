import type { RailBranch, RailDataset } from './types';
export const RAIL_ROUTES: { id: RailBranch; key: string; label: string }[] = [
  { id: 'kcr', key: 'z', label: 'KCR local · Karachi City–Dhabeji' },
  { id: 'jamalo', key: 'j', label: 'Jamalo · Shikarpur–Sukkur–Rohri' },
  { id: 'millat', key: 'l', label: 'Millat · Karachi–Lala Musa via Faisalabad' },
  { id: 'mohenjo-daro', key: 'm', label: 'Mohenjo Daro · Kotri–Rohri via Dadu' },
  { id: 'tezgam', key: 't', label: 'Tezgam · Karachi–Rawalpindi' },
  { id: 'subak-kharam', key: 'k', label: 'Subak Kharam · Lahore–Rawalpindi' },
  { id: 'pak-business', key: 'b', label: 'Pak Business · Karachi–Lahore' },
  { id: 'awam', key: 'e', label: 'Awam Express · Karachi–Peshawar' },
  { id: 'green-line', key: '0', label: 'Green Line · Karachi–Margalla' },
  { id: 'jaffar', key: '9', label: 'Jaffar Express · Quetta–Peshawar' },
  { id: 'fareed', key: '8', label: 'Fareed Express · Karachi City–Lahore' },
  { id: 'musa-pak', key: '7', label: 'Musa Pak Express · Multan–Lahore' },
  { id: 'allama-iqbal', key: '6', label: 'Allama Iqbal Express · Karachi–Sialkot' },
  { id: 'chord', key: '1', label: 'Khanewal → Lodhran · chord' },
  { id: 'multan', key: '2', label: 'Khanewal → Lodhran · via Multan' },
  { id: 'south', key: '3', label: 'Lodhran → Karachi Cantt' },
  { id: 'north', key: '4', label: 'Khanewal → Peshawar Cantt' },
  { id: 'branch', key: '5', label: 'Lodhran → Mandi Burewala' },
];
const coordinate = (value: unknown): boolean => Array.isArray(value) && value.length === 2 && value.every(Number.isFinite) && Math.abs(value[0]) <= 180 && Math.abs(value[1]) <= 90;
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

/** Validate before WebGL or animation can consume downloaded JSON. Route IDs,
 * geometry and station chainages matter; a matching array length is insufficient. */
export function validateRailDataset(value: unknown): RailDataset {
  if (!value || typeof value !== 'object') throw new Error('Invalid rail dataset.');
  const data = value as RailDataset;
  if (data.version !== 1 || !Array.isArray(data.paths) || typeof data.attribution !== 'string') throw new Error('Invalid rail dataset metadata.');
  const expected = new Set<string>(RAIL_ROUTES.map(route => route.id));
  for (const path of data.paths) {
    if (!path || !expected.delete(path.id) || typeof path.name !== 'string') throw new Error('Unknown or duplicate rail route.');
    if (!finite(path.distanceKm) || path.distanceKm <= 0 || !Array.isArray(path.coordinates) || path.coordinates.length < 2 || !path.coordinates.every(coordinate)) throw new Error(`Invalid track geometry: ${path.id}.`);
    if (!Array.isArray(path.stations) || path.stations.length < 2) throw new Error(`Missing stations: ${path.id}.`);
    if (path.reversals !== undefined && (!Array.isArray(path.reversals) || path.reversals.some((stop, i) => !stop || typeof stop.stationId !== 'string' || !finite(stop.km) || stop.km <= 0 || stop.km >= path.distanceKm || (i > 0 && stop.km <= path.reversals![i-1].km) || path.reversals!.slice(0,i).some(previous => previous.stationId === stop.stationId) || !path.stations.some(station => station.id === stop.stationId && Math.abs(station.km-stop.km) < .000001)))) throw new Error('Invalid rail reversal.');
    let previous = -Infinity;
    const ids = new Set<string>();
    for (const station of path.stations) {
      if (!station || typeof station.id !== 'string' || ids.has(station.id) || typeof station.name !== 'string' || !station.name.trim() || !coordinate(station.coordinate) || !coordinate(station.sourceCoordinate) || !finite(station.km) || station.km < 0 || station.km > path.distanceKm + .001 || station.km < previous || !finite(station.offsetMeters) || station.offsetMeters < 0 || station.offsetMeters > 250) throw new Error(`Invalid station data: ${path.id}.`);
      ids.add(station.id); previous = station.km;
    }
  }
  if (expected.size) throw new Error(`Missing rail routes: ${[...expected].join(', ')}.`);
  return data;
}
