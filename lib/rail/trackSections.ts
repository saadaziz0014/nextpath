import { bearing, destination, distance } from '@turf/turf';
import type { Coordinate } from '../routeData';
import type { RailTrackSection } from './types';
import type { indexTrack } from './track';

const EPSILON = 1e-9;

/** OSM records the physical passenger track count in `tracks`, while many
 * Pakistan Railways ways only carry `passenger_lines`. Prefer the physical tag
 * when both exist. Unknown stays null rather than pretending the line is single. */
export function trackCountFromTags(tags?: Record<string, string> | null): number | null {
  const raw = tags?.tracks ?? tags?.passenger_lines;
  if (raw === undefined || raw === null || raw === '') return null;
  const value = Number(raw);
  return Number.isInteger(value) && value >= 1 && value <= 4 ? value : null;
}

/** Build one section per run of equal track counts. Counts are per source edge,
 * so `counts[i]` describes the segment from coordinates[i] to coordinates[i + 1]. */
export function buildTrackSections(coordinates: Coordinate[], counts: readonly (number | null)[]): RailTrackSection[] {
  if (coordinates.length < 2) throw new Error('Track sections need at least two coordinates.');
  if (counts.length !== coordinates.length - 1) throw new Error('Track count list does not match the coordinate segments.');
  const sections: RailTrackSection[] = [];
  let cursor = 0;
  for (let i = 0; i < counts.length; i++) {
    const length = distance(coordinates[i], coordinates[i + 1]);
    if (length < EPSILON) continue;
    const end = cursor + length;
    const previous = sections.at(-1);
    if (previous && previous.tracks === counts[i] && Math.abs(previous.endKm - cursor) < EPSILON) previous.endKm = end;
    else sections.push({ startKm: cursor, endKm: end, tracks: counts[i] ?? null });
    cursor = end;
  }
  if (!sections.length) throw new Error('Track sections have no length.');
  return sections;
}

/** Merge touching runs with the same count. Gaps are preserved, because an
 * unstated gap is not the same evidence as a stated one-track section. */
export function mergeTrackSections(sections: readonly RailTrackSection[]): RailTrackSection[] {
  const merged: RailTrackSection[] = [];
  for (const section of [...sections].sort((a, b) => a.startKm - b.startKm)) {
    if (!(section.endKm > section.startKm)) continue;
    const previous = merged.at(-1);
    if (previous && previous.tracks === section.tracks && Math.abs(previous.endKm - section.startKm) < EPSILON) previous.endKm = section.endKm;
    else merged.push({ ...section });
  }
  return merged;
}

/** Offset a later leg before joining two imported graph legs. */
export function offsetTrackSections(sections: readonly RailTrackSection[], offsetKm: number): RailTrackSection[] {
  return sections.map(section => ({ ...section, startKm: section.startKm + offsetKm, endKm: section.endKm + offsetKm }));
}

export function appendTrackSections(first: readonly RailTrackSection[], second: readonly RailTrackSection[], offsetKm: number): RailTrackSection[] {
  return mergeTrackSections([...first, ...offsetTrackSections(second, offsetKm)]);
}

/** Clip a corridor to its simulated end, used by the shorter KCR profile. */
export function clipTrackSections(sections: readonly RailTrackSection[], endKm: number): RailTrackSection[] {
  const clipped: RailTrackSection[] = [];
  for (const section of sections) {
    const startKm = Math.max(0, Math.min(section.startKm, endKm));
    const stopKm = Math.max(0, Math.min(section.endKm, endKm));
    if (stopKm > startKm) clipped.push({ startKm, endKm: stopKm, tracks: section.tracks });
  }
  return mergeTrackSections(clipped);
}

/** Down trains traverse the same physical sections in reverse chainage. */
export function reverseTrackSections(sections: readonly RailTrackSection[], lengthKm: number): RailTrackSection[] {
  return mergeTrackSections(sections.map(section => ({ tracks: section.tracks, startKm: lengthKm - section.endKm, endKm: lengthKm - section.startKm })));
}

export function trackSectionAt(sections: readonly RailTrackSection[] | undefined, km: number): RailTrackSection | null {
  if (!sections?.length) return null;
  for (const section of sections) if (km < section.endKm - EPSILON) return km >= section.startKm - EPSILON ? section : null;
  return km >= sections.at(-1)!.endKm - EPSILON ? sections.at(-1)! : null;
}

/** Geometry for one chainage slice, including interpolated section boundaries.
 * This keeps the map's single/double rendering aligned with source chainages. */
export function sliceTrackCoordinates(track: ReturnType<typeof indexTrack>, startKm: number, endKm: number): Coordinate[] {
  const start = Math.max(0, Math.min(startKm, track.lengthKm));
  const end = Math.max(start, Math.min(endKm, track.lengthKm));
  if (end - start < EPSILON) return [];
  const coordinates: Coordinate[] = [sample(track, start)];
  for (let i = 1; i < track.cumulative.length - 1; i++) {
    const km = track.cumulative[i];
    if (km > start + EPSILON && km < end - EPSILON) coordinates.push(track.path.coordinates[i]);
  }
  coordinates.push(sample(track, end));
  return coordinates;
}

function sample(track: ReturnType<typeof indexTrack>, km: number): Coordinate {
  const target = Math.max(0, Math.min(km, track.lengthKm));
  let low = 0, high = track.cumulative.length - 1;
  while (low + 1 < high) { const mid = (low + high) >>> 1; if (track.cumulative[mid] <= target) low = mid; else high = mid; }
  const a = track.path.coordinates[low], b = track.path.coordinates[low + 1];
  const ratio = track.cumulative[low + 1] - track.cumulative[low] < EPSILON ? 0 : (target - track.cumulative[low]) / (track.cumulative[low + 1] - track.cumulative[low]);
  return [a[0] + (b[0] - a[0]) * ratio, a[1] + (b[1] - a[1]) * ratio];
}

export function trackSectionLabel(tracks: number | null): string {
  if (tracks === null) return 'Track count unverified';
  if (tracks === 1) return 'Single track';
  return tracks === 2 ? 'Double track' : `${tracks} tracks`;
}

/** Centreline separation used by the map and by train placement. Real
 * double-track centres are roughly 4–5 m apart; 3.4 m keeps both rails legible
 * at driving zoom without looking like two unrelated routes. */
export const TRACK_OFFSET_METERS = 3.4;

/** Offset one point to the right of its heading when the value is positive. */
export function offsetCoordinate(position: Coordinate, heading: number, offsetMeters: number): Coordinate {
  if (!offsetMeters) return position;
  return destination(position, Math.abs(offsetMeters) / 1000, heading + (offsetMeters > 0 ? 90 : -90)).geometry.coordinates as Coordinate;
}

/** Offset a polyline by a metric distance. Endpoints use their only available
 * segment; interior vertices use the incoming→outgoing chord to avoid the
 * doubled corners that independent segment offsets produce. */
export function offsetLineCoordinates(coordinates: Coordinate[], offsetMeters: number): Coordinate[] {
  if (!offsetMeters || coordinates.length < 2) return coordinates;
  return coordinates.map((point, index) => {
    const before = coordinates[Math.max(0, index - 1)];
    const after = coordinates[Math.min(coordinates.length - 1, index + 1)];
    return offsetCoordinate(point, bearing(before, after), offsetMeters);
  });
}
