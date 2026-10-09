import fs from 'node:fs';
import { distance, lineString, nearestPointOnLine } from '@turf/turf';
type Coordinate = [number, number];
interface Element { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; nodes?: number[]; geometry?: { lat: number; lon: number }[]; tags?: Record<string, string> }

const EXT_FILES = ['data/rail/ml1-north.osm.json','data/rail/ml1-kamoke.osm.json','data/rail/ml1-south.osm.json','data/rail/ml1-peshawar.osm.json','data/rail/ml1-farnorth-s1.osm.json','data/rail/ml1-farnorth-s2a.osm.json','data/rail/ml1-farnorth-s2b.osm.json','data/rail/ml1-sindh.osm.json','data/rail/ml1-gujranwala-jhelum.osm.json','data/rail/ml1-gujranwala-wazirabad.osm.json','data/rail/ml1-wazirabad-seam.osm.json','data/rail/ml1-gujrat-lalamusa.osm.json','data/rail/ml1-attock-band.osm.json'];
const elements: Element[] = [];
for (const f of EXT_FILES) elements.push(...JSON.parse(fs.readFileSync(f, 'utf8')).elements);
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

function candidates(coord: Coordinate) { return [...nodes].map(([id, pt]) => ({ id, km: distance(coord, pt) })).filter(n => n.km < .15).sort((a, b) => a.km - b.km); }
function flood(startIds: number[]) {
  const seen = new Set<number>(startIds);
  const q = [...seen];
  while (q.length) { const cur = q.pop()!; for (const e of edges.get(cur) ?? []) if (!seen.has(e.to)) { seen.add(e.to); q.push(e.to); } }
  let mnlat = 90, mxlat = -90, mnlon = 180, mxlon = -180;
  for (const id of seen) { const p = nodes.get(id)!; if (p[1] < mnlat) mnlat = p[1]; if (p[1] > mxlat) mxlat = p[1]; if (p[0] < mnlon) mnlon = p[0]; if (p[0] > mxlon) mxlon = p[0]; }
  return { seen, bbox: mnlat.toFixed(4) + 'N..' + mxlat.toFixed(4) + 'N, ' + mnlon.toFixed(4) + 'E..' + mxlon.toFixed(4) + 'E' };
}
const taxila = stations.find(s => /^taxila/i.test(s.name))!;
const nowshera = stations.find(s => /nowshera/i.test(s.name))!;
const tCands = candidates(taxila.coordinate);
const nCands = candidates(nowshera.coordinate);
console.log('\nTaxila candidates:', tCands.length, tCands.map(c => c.id).join(','));
console.log('Nowshera candidates:', nCands.length, nCands.map(c => c.id).join(','));
const tComp = flood(tCands.map(c => c.id));
const nComp = flood(nCands.map(c => c.id));
console.log('Taxila component:', tComp.seen.size, 'bbox', tComp.bbox);
console.log('Nowshera component:', nComp.seen.size, 'bbox', nComp.bbox);
console.log('components overlap?', [...tComp.seen].some(id => nComp.seen.has(id)));
// Do Taxila candidates reach Wah / Sanjwal / Hayat Sher Pao / Attock Khurd?
for (const name of [/^wah/i, /sanjwal/i, /hayat/i, /attock khurd/i, /rumian/i, /jehangira/i, /akora/i, /faqirabad/i, /burhan/i]) {
  const st = stations.find(s => name.test(s.name));
  if (!st) { console.log('  no station for', name); continue; }
  const cands = candidates(st.coordinate);
  const inT = cands.filter(c => tComp.seen.has(c.id));
  const inN = cands.filter(c => nComp.seen.has(c.id));
  console.log('  ' + st.name + ': ' + cands.length + ' cands, inTaxilaComp=' + inT.length + ', inNowsheraComp=' + inN.length);
}
