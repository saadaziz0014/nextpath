import fs from 'node:fs';
import { distance, lineString, nearestPointOnLine } from '@turf/turf';
type Coordinate = [number, number];
interface Element { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; nodes?: number[]; geometry?: { lat: number; lon: number }[]; tags?: Record<string, string> }

const FILES = ['data/rail/ml1-north.osm.json','data/rail/ml1-south.osm.json','data/rail/ml1-peshawar.osm.json','data/rail/ml1-farnorth-s1.osm.json','data/rail/ml1-farnorth-s2a.osm.json','data/rail/ml1-farnorth-s2b.osm.json','data/rail/ml1-sindh.osm.json','data/rail/ml1-gujranwala-jhelum.osm.json','data/rail/ml1-gujranwala-wazirabad.osm.json'];
const elements: Element[] = [];
for (const f of FILES) elements.push(...JSON.parse(fs.readFileSync(f, 'utf8')).elements);
const stations = elements.filter(e => e.tags?.railway === 'station' && (e.type === 'node' || e.center)).map(e => ({ id: String(e.id), name: e.tags?.['name:en'] ?? e.tags?.name ?? '', coordinate: [e.lon ?? e.center!.lon, e.lat ?? e.center!.lat] as Coordinate }));

let virtualId = -1;
const nodes = new Map<number, Coordinate>(), edges = new Map<number, { to: number; km: number }[]>();
for (const way of elements.filter(e => e.type === 'way' && e.tags?.railway === 'rail')) {
  if (!way.nodes || !way.geometry || way.nodes.length !== way.geometry.length) continue;
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
console.log('nodes:', nodes.size, 'edges:', edges.size);

// Flood-fill component from Lodhran station-area nodes
const lodhran = stations.find(s => /lodhran/i.test(s.name))!;
const start = [...nodes].map(([id, pt]) => ({ id, km: distance(lodhran.coordinate, pt) })).filter(n => n.km < .15);
console.log('Lodhran start nodes:', start.length);
const seen = new Set<number>(start.map(n => n.id));
const queue = [...seen];
while (queue.length) {
  const cur = queue.pop()!;
  for (const e of edges.get(cur) ?? []) if (!seen.has(e.to)) { seen.add(e.to); queue.push(e.to); }
}
console.log('component size:', seen.size);
let minLat = 90, maxLat = -90, minLon = 180, maxLon = -180;
for (const id of seen) { const p = nodes.get(id)!; if (p[1] < minLat) minLat = p[1]; if (p[1] > maxLat) maxLat = p[1]; if (p[0] < minLon) minLon = p[0]; if (p[0] > maxLon) maxLon = p[0]; }
console.log('component bbox:', minLat.toFixed(4) + 'N..' + maxLat.toFixed(4) + 'N,', minLon.toFixed(4) + 'E..' + maxLon.toFixed(4) + 'E');

// Which stations fall inside the component bbox?
console.log('stations in bbox:', stations.filter(s => s.coordinate[1] >= minLat && s.coordinate[1] <= maxLat && s.coordinate[0] >= minLon && s.coordinate[0] <= maxLon).map(s => s.name).join(', '));

// Does the component reach near Samasata (29.3477,71.5462)?
const samasata = stations.find(s => /samasata/i.test(s.name))!;
const nearSamasata = [...seen].map(id => ({ id, km: distance(samasata.coordinate, nodes.get(id)!) })).sort((a, b) => a.km - b.km)[0];
console.log('closest component node to Samasata:', nearSamasata.km.toFixed(3), 'km');

// Where does the component end on the south side? Print southernmost component points.
const southmost = [...seen].map(id => nodes.get(id)!).sort((a, b) => a[1] - b[1]).slice(0, 5);
console.log('southernmost component points:', southmost.map(p => p[1].toFixed(4) + 'N,' + p[0].toFixed(4) + 'E').join(' | '));
const northernmost = [...seen].map(id => nodes.get(id)!).sort((a, b) => b[1] - a[1]).slice(0, 5);
console.log('northernmost component points:', northernmost.map(p => p[1].toFixed(4) + 'N,' + p[0].toFixed(4) + 'E').join(' | '));

// And separately: component containing the ML-1 main chain node near (29.4818,71.6405)
const target = [...nodes].map(([id, pt]) => ({ id, km: distance([71.6405, 29.4818] as Coordinate, pt) })).sort((a, b) => a.km - b.km)[0];
console.log('\nnode nearest (29.4818,71.6405):', target.id, target.km.toFixed(4), 'km — in Lodhran component?', seen.has(target.id));
