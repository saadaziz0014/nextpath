import fs from 'node:fs';
import { distance, lineString, nearestPointOnLine } from '@turf/turf';
type Coordinate = [number, number];
interface Element { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; nodes?: number[]; geometry?: { lat: number; lon: number }[]; tags?: Record<string, string> }

const EXT_FILES = ['data/rail/ml1-north.osm.json','data/rail/ml1-south.osm.json','data/rail/ml1-peshawar.osm.json','data/rail/ml1-farnorth-s1.osm.json','data/rail/ml1-farnorth-s2a.osm.json','data/rail/ml1-farnorth-s2b.osm.json','data/rail/ml1-sindh.osm.json','data/rail/ml1-gujranwala-jhelum.osm.json','data/rail/ml1-gujranwala-wazirabad.osm.json'];
const elements: Element[] = [];
for (const f of EXT_FILES) elements.push(...JSON.parse(fs.readFileSync(f, 'utf8')).elements);
const stations = elements.filter(e => e.tags?.railway === 'station' && (e.type === 'node' || e.center)).map(e => ({ id: String(e.id), name: e.tags?.['name:en'] ?? e.tags?.name ?? '', coordinate: [e.lon ?? e.center!.lon, e.lat ?? e.center!.lat] as Coordinate }));
console.log('total stations:', stations.length);

let virtualId = -1;
const nodes = new Map<number, Coordinate>(), edges = new Map<number, { to: number; km: number }[]>();
let invalidWays = 0;
for (const way of elements.filter(e => e.type === 'way' && e.tags?.railway === 'rail')) {
  if (!way.nodes || !way.geometry || way.nodes.length !== way.geometry.length) { invalidWays++; continue; }
  for (let i = 0; i < way.nodes.length; i++) nodes.set(way.nodes[i], [way.geometry[i].lon, way.geometry[i].lat]);
  for (let i = 1; i < way.nodes.length; i++) {
    const a = way.nodes[i - 1], b = way.nodes[i], km = distance(nodes.get(a)!, nodes.get(b)!);
    if (!km) continue;
    const splits = [{ id: a, km: 0 }, { id: b, km }];
    const pa = nodes.get(a)!, pb = nodes.get(b)!;
    const minLon = Math.min(pa[0], pb[0]) - .5, maxLon = Math.max(pa[0], pb[0]) + .5;
    const minLat = Math.min(pa[1], pb[1]) - .5, maxLat = Math.max(pa[1], pb[1]) + .5;
    for (const station of stations) {
      if (station.coordinate[0] < minLon || station.coordinate[0] > maxLon || station.coordinate[1] < minLat || station.coordinate[1] > maxLat) continue;
      const p = nearestPointOnLine(lineString([pa, pb]), station.coordinate);
      if ((p.properties.dist ?? Infinity) > .08) continue;
      const loc = p.properties.location ?? 0;
      if (loc < .000001 || km - loc < .000001) continue;
      const id = virtualId--; nodes.set(id, p.geometry.coordinates as Coordinate); splits.push({ id, km: loc });
    }
    splits.sort((a, b) => a.km - b.km);
    for (let j = 1; j < splits.length; j++) for (const [f, t] of [[splits[j - 1].id, splits[j].id], [splits[j].id, splits[j - 1].id]]) {
      if (!edges.has(f)) edges.set(f, []); edges.get(f)!.push({ to: t, km: splits[j].km - splits[j - 1].km });
    }
  }
}
console.log('invalid ways skipped:', invalidWays, 'nodes:', nodes.size, 'edges:', edges.size);

// EXACT importer extStation: first /lodhran/i match in station order
const lodhranSouth = stations.find(s => /lodhran/i.test(s.name))!;
console.log('lodhranSouth:', lodhranSouth.id, lodhranSouth.name, lodhranSouth.coordinate);

const extNearbyStart = [...nodes].map(([id, pt]) => ({ id, km: distance(lodhranSouth.coordinate, pt) })).filter(n => n.km < .15).sort((a, b) => a.km - b.km);
console.log('start set size:', extNearbyStart.length);
console.log('start ids:', extNearbyStart.map(n => n.id).join(','));

// Flood fill from the start set
const seen = new Set<number>(extNearbyStart.map(n => n.id));
const queue = [...seen];
while (queue.length) { const cur = queue.pop()!; for (const e of edges.get(cur) ?? []) if (!seen.has(e.to)) { seen.add(e.to); queue.push(e.to); } }
console.log('component size from importer-equivalent start set:', seen.size);

const samasata = stations.find(s => /samasata/i.test(s.name))!;
const karachi = stations.find(s => /karachi.*canton/i.test(s.name))!;
const closestSamasata = [...seen].reduce((best, id) => { const km = distance(samasata.coordinate, nodes.get(id)!); return km < best.km ? { id, km } : best; }, { id: 0, km: Infinity });
const closestKarachi = [...seen].reduce((best, id) => { const km = distance(karachi.coordinate, nodes.get(id)!); return km < best.km ? { id, km } : best; }, { id: 0, km: Infinity });
console.log('closest component node to Samasata:', closestSamasata.km.toFixed(3), 'km');
console.log('closest component node to Karachi:', closestKarachi.km.toFixed(3), 'km');

// Also check the second /lodhran/i match if any
const allLodhran = stations.filter(s => /lodhran/i.test(s.name));
console.log('all /lodhran/i stations:', allLodhran.map(s => s.id + ':' + s.name + '@' + s.coordinate.map(v => v.toFixed(4)).join(',')).join(' | '));
