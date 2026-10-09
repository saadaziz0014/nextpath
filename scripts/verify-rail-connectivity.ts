import { readFileSync } from 'node:fs';
import { lineString, nearestPointOnLine } from '@turf/turf';
import type { Coordinate } from '../lib/routeData';
import { EXT_FILES } from '../lib/rail/sourceFiles';
import { validateRailDataset } from '../lib/rail/dataset';
import { assertRailPathQuality } from '../lib/rail/quality';

interface SourceElement { type: string; tags?: { railway?: string }; geometry?: { lon: number; lat: number }[] }
const dataset = validateRailDataset(JSON.parse(readFileSync('public/data/rail/ml1.json', 'utf8')));
const cellSize = .05;
const buckets = new Map<string, [Coordinate, Coordinate][]>();
for (const file of ['data/rail/khanewal-lodhran.osm.json', ...EXT_FILES]) {
  const source = JSON.parse(readFileSync(file, 'utf8')) as { elements: SourceElement[] };
  for (const way of source.elements) {
    if (way.type !== 'way' || way.tags?.railway !== 'rail' || !way.geometry) continue;
    for (let i = 1; i < way.geometry.length; i++) {
      const a: Coordinate = [way.geometry[i - 1].lon, way.geometry[i - 1].lat], b: Coordinate = [way.geometry[i].lon, way.geometry[i].lat];
      for (let x = Math.floor(Math.min(a[0], b[0]) / cellSize) - 1; x <= Math.floor(Math.max(a[0], b[0]) / cellSize) + 1; x++) {
        for (let y = Math.floor(Math.min(a[1], b[1]) / cellSize) - 1; y <= Math.floor(Math.max(a[1], b[1]) / cellSize) + 1; y++) {
          const key = `${x},${y}`;
          if (!buckets.has(key)) buckets.set(key, []);
          buckets.get(key)!.push([a,b]);
        }
      }
    }
  }
}
for (const path of dataset.paths) {
  assertRailPathQuality(path);
  for (let i = 1; i < path.coordinates.length; i++) {
    const a = path.coordinates[i - 1], b = path.coordinates[i];
    const candidates = buckets.get(`${Math.floor(a[0] / cellSize)},${Math.floor(a[1] / cellSize)}`) ?? [];
    // Every output edge must lie within one original sourced track segment,
    // including virtual vertices introduced by station projection. No gap bridges.
    const backed = candidates.some(segment => {
      const epsilon = .000001;
      const [start,end] = segment;
      for (const point of [a,b]) if (point[0] < Math.min(start[0],end[0])-epsilon || point[0] > Math.max(start[0],end[0])+epsilon || point[1] < Math.min(start[1],end[1])-epsilon || point[1] > Math.max(start[1],end[1])+epsilon) return false;
      const line = lineString(segment);
      return (nearestPointOnLine(line, a).properties.dist ?? Infinity) < .00001 && (nearestPointOnLine(line, b).properties.dist ?? Infinity) < .00001;
    });
    if (!backed) throw new Error(`${path.id}: edge ${i} has no original OSM track segment.`);
  }
  console.log(`${path.id}: ${path.distanceKm.toFixed(2)} km, ${path.stations.length} stations, ${path.reversals?.length ?? 0} declared station reversals; no unintended retracing, every edge source-backed`);
}
