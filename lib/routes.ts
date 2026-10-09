import { along, bearing, distance, lineString } from '@turf/turf';
import type { Feature, LineString } from 'geojson';
import type { Coordinate } from './routeData';

export interface Place { label: string; coordinate: Coordinate }
export interface DrivingRoute {
  feature: Feature<LineString>;
  cumulativeKm: number[];
  distanceKm: number;
  durationSeconds: number;
  start: Place;
  end: Place;
}
export const DEFAULT_START: Place = { label: 'Lahore · example start', coordinate: [74.3587, 31.5204] };
export const DEFAULT_END: Place = { label: 'Lahore · nearby destination', coordinate: [74.3436, 31.5014] };

export function isCoordinate(value: unknown): value is Coordinate {
  return Array.isArray(value) && value.length === 2 && value.every(v => typeof v === 'number' && Number.isFinite(v)) && Math.abs(value[0]) <= 180 && Math.abs(value[1]) <= 85;
}

export function createDrivingRoute(coordinates: Coordinate[], start: Place, end: Place, durationSeconds = 0): DrivingRoute {
  if (coordinates.length < 2 || !coordinates.every(isCoordinate)) throw new Error('The route contains invalid coordinates.');
  // Index distance once, not on every frame. Dense Directions geometries can
  // contain thousands of vertices; sampling then costs O(log n) + one segment.
  const cumulativeKm = [0];
  for (let i = 1; i < coordinates.length; i++) cumulativeKm.push(cumulativeKm[i - 1] + distance(coordinates[i - 1], coordinates[i]));
  const distanceKm = cumulativeKm.at(-1)!;
  if (distanceKm < .01) throw new Error('Choose two different points at least 10 metres apart.');
  return { feature: lineString(coordinates), cumulativeKm, distanceKm, durationSeconds, start, end };
}

function pointOnRoute(route: DrivingRoute, km: number): Coordinate {
  const coordinates = route.feature.geometry.coordinates as Coordinate[];
  const clamped = Math.max(0, Math.min(km, route.distanceKm));
  if (clamped === route.distanceKm) return coordinates.at(-1)!;
  let low = 0, high = route.cumulativeKm.length - 1;
  while (low + 1 < high) {
    const mid = (low + high) >>> 1;
    if (route.cumulativeKm[mid] <= clamped) low = mid; else high = mid;
  }
  return along(lineString([coordinates[low], coordinates[low + 1]]), clamped - route.cumulativeKm[low]).geometry.coordinates as Coordinate;
}

export function sampleDrivingRoute(route: DrivingRoute, km: number) {
  const clamped = Math.max(0, Math.min(km, route.distanceKm));
  const position = pointOnRoute(route, clamped);
  const from = pointOnRoute(route, Math.max(0, clamped - .002));
  const to = pointOnRoute(route, Math.min(route.distanceKm, clamped + .012));
  return { position, bearing: (bearing(from, to) + 360) % 360 };
}

export async function fetchDrivingRoute(start: Place, end: Place, token: string, signal: AbortSignal): Promise<DrivingRoute> {
  if (distance(start.coordinate, end.coordinate) < .01) throw new Error('Choose different start and destination points.');
  const coordinates = `${start.coordinate.join(',')};${end.coordinate.join(',')}`;
  const params = new URLSearchParams({ access_token: token, geometries: 'geojson', overview: 'full', steps: 'false' });
  const response = await fetch(`https://api.mapbox.com/directions/v5/mapbox/driving/${coordinates}?${params}`, { signal });
  if (!response.ok) throw new Error(response.status === 401 || response.status === 403 ? 'Mapbox could not authorize routing. Check your token and allowed URLs.' : response.status === 429 ? 'Mapbox request limit reached. Try again shortly.' : 'Unable to fetch a road route. Please try again.');
  const data = await response.json();
  if (data.code !== 'Ok' || !data.routes?.[0]) throw new Error('No drivable route connects these points. Choose points connected by roads.');
  const result = data.routes[0];
  if (result.geometry?.type !== 'LineString' || !Array.isArray(result.geometry.coordinates)) throw new Error('Mapbox returned an invalid route.');
  const route = createDrivingRoute(result.geometry.coordinates, start, end, result.duration);
  // Directions snaps the requested locations to the road network. The car and
  // endpoint pins use those exact snapped points, so playback never starts off-road.
  route.start = { ...start, coordinate: route.feature.geometry.coordinates[0] as Coordinate };
  route.end = { ...end, coordinate: route.feature.geometry.coordinates.at(-1) as Coordinate };
  return route;
}

export interface PlaceSearchOptions { country?: 'pk' | 'worldwide'; proximity?: Coordinate }

export async function searchPlaces(query: string, token: string, signal: AbortSignal, options: PlaceSearchOptions = {}): Promise<Place[]> {
  // Coordinate entry is latitude, longitude, matching common map UI conventions.
  const match = query.trim().match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
  if (match) {
    const coordinate: Coordinate = [Number(match[2]), Number(match[1])];
    if (!isCoordinate(coordinate)) throw new Error('Use latitude −85…85 and longitude −180…180.');
    return [{ label: query.trim(), coordinate }];
  }
  const params = new URLSearchParams({ q: query, access_token: token, limit: '10', autocomplete: 'false', language: 'en' });
  if (options.country !== 'worldwide') params.set('country', 'pk');
  const proximity = options.proximity ?? DEFAULT_START.coordinate;
  if (isCoordinate(proximity)) params.set('proximity', proximity.join(','));
  const response = await fetch(`https://api.mapbox.com/search/geocode/v6/forward?${params}`, { signal });
  if (!response.ok) throw new Error(response.status === 429 ? 'Search limit reached. Try again shortly.' : 'Place search failed. Check your connection and token.');
  const data = await response.json();
  return (data.features ?? []).filter((feature: { geometry?: { coordinates?: unknown } }) => isCoordinate(feature.geometry?.coordinates)).map((feature: { geometry: { coordinates: Coordinate }; properties?: { full_address?: string; name?: string } }) => ({ label: feature.properties?.full_address ?? feature.properties?.name ?? 'Selected place', coordinate: feature.geometry.coordinates }));
}

