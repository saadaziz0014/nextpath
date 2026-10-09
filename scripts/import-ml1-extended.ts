import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { distance, lineString, nearestPointOnLine } from '@turf/turf';
import type { Coordinate } from '../lib/routeData';
import { routeThroughAnchors } from '../lib/rail/importGraph';
import type { RailDataset, RailPath } from '../lib/rail/types';

// ---- Source files ----
import { EXT_FILES, KCR_STATIONS_FILE } from '../lib/rail/sourceFiles';
import { buildKcrLocalPath, type KcrStationSnapshot } from '../lib/rail/kcrImport';
import { TRAINS, servicePath } from '../lib/rail/trains';
import { validateRailDataset } from '../lib/rail/dataset';
import { assertRailPathQuality } from '../lib/rail/quality';

interface Element { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; nodes?: number[]; geometry?: { lat: number; lon: number }[]; tags?: Record<string, string> }

// ---- Build the existing chord/multan from the original local file (stable, unchanged) ----
const localFile = process.argv[2] ?? 'data/rail/khanewal-lodhran.osm.json';
const local = JSON.parse(readFileSync(localFile, 'utf8')) as { elements: Element[]; osm3s: { timestamp_osm_base: string } };
local.elements.push(...JSON.parse(readFileSync('data/rail/khanewal-stations.osm.json', 'utf8')).elements);
if (!local.elements?.length) throw new Error('No local source railway data');
const localStations = local.elements.filter(e => e.tags?.railway === 'station' && e.tags?.subway !== 'yes' && e.tags?.station !== 'subway' && e.tags?.light_rail !== 'yes' && e.tags?.disused !== 'yes' && (e.type === 'node' || e.center)).map(e => ({ id: String(e.id), name: e.tags?.['name:en'] ?? e.tags?.name ?? '', coordinate: [e.lon ?? e.center!.lon, e.lat ?? e.center!.lat] as Coordinate }));
let localVirtual = -1;
const localNodes = new Map<number, Coordinate>(), localEdges = new Map<number, { to: number; km: number }[]>();
for (const way of local.elements.filter(e => e.type === 'way' && e.tags?.railway === 'rail' && !['yard','siding','spur'].includes(e.tags?.service ?? '') && e.tags?.disused !== 'yes')) {
  if (!way.nodes || !way.geometry || way.nodes.length !== way.geometry.length) throw new Error(`Invalid local OSM way ${way.id}`);
  for (let i = 0; i < way.nodes.length; i++) localNodes.set(way.nodes[i], [way.geometry[i].lon, way.geometry[i].lat]);
  for (let i = 1; i < way.nodes.length; i++) {
    const a = way.nodes[i - 1], b = way.nodes[i], km = distance(localNodes.get(a)!, localNodes.get(b)!);
    if (!km) continue;
    const splits = [{ id: a, km: 0 }, { id: b, km }];
    for (const station of localStations) {
      const p = nearestPointOnLine(lineString([localNodes.get(a)!, localNodes.get(b)!]), station.coordinate);
      if ((p.properties.dist ?? Infinity) > .08) continue;
      const loc = p.properties.location ?? 0;
      if (loc < .000001 || km - loc < .000001) continue;
      const id = localVirtual--; localNodes.set(id, p.geometry.coordinates as Coordinate); splits.push({ id, km: loc });
    }
    splits.sort((a, b) => a.km - b.km);
    for (let j = 1; j < splits.length; j++) for (const [f, t] of [[splits[j - 1].id, splits[j].id], [splits[j].id, splits[j - 1].id]]) {
      if (!localEdges.has(f)) localEdges.set(f, []); localEdges.get(f)!.push({ to: t, km: splits[j].km - splits[j - 1].km });
    }
  }
}
function localStation(name: RegExp) { const m = localStations.find(s => name.test(s.name)); if (!m) throw new Error(`Missing local station ${name}`); return m; }
function localNearby(c: Coordinate) { const cs = [...localNodes].map(([id, pt]) => ({ id, km: distance(c, pt) })).filter(n => n.km < .15).sort((a, b) => a.km - b.km); if (!cs.length) throw new Error('No local track node within 150m'); return cs; }
function localShortest(from: { id: number; km: number }[], targets: Set<number>) {
  const costs = new Map(from.map(n => [n.id, n.km])), previous = new Map<number, number>(), visited = new Set<number>();
  const heap: { id: number; km: number }[] = [];
  const push = (e: { id: number; km: number }) => { heap.push(e); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >>> 1; if (heap[p].km <= e.km) break; heap[i] = heap[p]; i = p; } heap[i] = e; };
  const pop = () => { const r = heap[0], t = heap.pop()!; if (heap.length) { let i = 0; while (i * 2 + 1 < heap.length) { let c = i * 2 + 1; if (c + 1 < heap.length && heap[c + 1].km < heap[c].km) c++; if (heap[c].km >= t.km) break; heap[i] = heap[c]; i = c; } heap[i] = t; } return r; };
  for (const n of from) push(n);
  while (heap.length) {
    const cur = pop(); if (visited.has(cur.id)) continue; visited.add(cur.id);
    if (targets.has(cur.id)) { const ids = [cur.id]; while (previous.has(ids.at(-1)!)) ids.push(previous.get(ids.at(-1)!)!); return ids.reverse(); }
    for (const e of localEdges.get(cur.id) ?? []) { const c = cur.km + e.km; if (c < (costs.get(e.to) ?? Infinity)) { costs.set(e.to, c); previous.set(e.to, cur.id); push({ id: e.to, km: c }); } }
  }
  throw new Error(`Disconnected local tracks: ${from.map(n => n.id)} -> ${[...targets]}`);
}

// ---- Build the extended graph from ALL extension files (node-id-keyed, matches existing importer) ----
const extElements: Element[] = [];
const sourceElements = new Map<string, Element>();
const sources = EXT_FILES.map(file => ({ file, data: JSON.parse(readFileSync(file, 'utf8')) as { elements: Element[]; osm3s: { timestamp_osm_base: string } } })).sort((a,b) => b.data.osm3s.timestamp_osm_base.localeCompare(a.data.osm3s.timestamp_osm_base));
for (const source of sources) for (const element of source.data.elements) {
  const key = `${element.type}/${element.id}`;
  if (!sourceElements.has(key)) sourceElements.set(key, element);
  else {
    // Preserve translated names/centres omitted by a newer overlapping response.
    const newest = sourceElements.get(key)!;
    newest.tags = { ...element.tags, ...newest.tags };
    newest.center ??= element.center;
  }
}
extElements.push(...sourceElements.values());
// Faisalabad is tagged railway=stop with public_transport=station and train=yes.
// Accept that station footprint, while excluding ordinary track stop positions.
const isStationElement = (e: Element) => e.tags?.railway === 'station' || (e.tags?.railway === 'stop' && e.tags?.public_transport === 'station' && e.tags?.train === 'yes');
for (const element of extElements) {
  if (isStationElement(element) && !element.center && element.type !== 'node' && element.geometry?.length) {
    const lons = element.geometry.map(p => p.lon), lats = element.geometry.map(p => p.lat);
    element.center = { lon: (Math.min(...lons) + Math.max(...lons)) / 2, lat: (Math.min(...lats) + Math.max(...lats)) / 2 };
  }
}
if (!extElements.length) throw new Error('No extension source railway data');
// The same OSM station node appears in several overlapping source files; keep
// the first occurrence so station lists are not duplicated.
const seenStationIds = new Set<string>();
const stationNames: Record<string,string> = { '1778013861': 'Narowal Junction', '8892037534': 'Baddomalhi', '2445623565': 'Dinga' };
// Karachi Cantt's footprint duplicates its sourced station node 14185206054.
const extStations = extElements.filter(e => !(e.type === 'way' && e.id === 408164895) && isStationElement(e) && e.tags?.station !== 'subway' && e.tags?.subway !== 'yes' && e.tags?.light_rail !== 'yes' && e.tags?.disused !== 'yes' && (e.type === 'node' || e.center)).map(e => ({ id: String(e.id), name: stationNames[String(e.id)] ?? e.tags?.['name:en'] ?? e.tags?.name ?? '', coordinate: [e.lon ?? e.center!.lon, e.lat ?? e.center!.lat] as Coordinate })).filter(s => { if (seenStationIds.has(s.id)) return false; seenStationIds.add(s.id); return true; });
let extVirtual = -1;
const extNodes = new Map<number, Coordinate>(), extEdges = new Map<number, { to: number; km: number }[]>();
for (const way of extElements.filter(e => e.type === 'way' && e.tags?.railway === 'rail')) {
  if (!way.nodes || !way.geometry || way.nodes.length !== way.geometry.length) throw new Error(`Invalid extension OSM way ${way.id}`);
  for (let i = 0; i < way.nodes.length; i++) extNodes.set(way.nodes[i], [way.geometry[i].lon, way.geometry[i].lat]);
  for (let i = 1; i < way.nodes.length; i++) {
    const a = way.nodes[i - 1], b = way.nodes[i], km = distance(extNodes.get(a)!, extNodes.get(b)!);
    if (!km) continue;
    const splits = [{ id: a, km: 0 }, { id: b, km }];
    // Cheap bounding-box prefilter: a station farther than 0.01° from the
    // segment can never pass the 0.08 projection threshold below, so skip the
    // expensive turf projection for it. Semantics are unchanged.
    const pa = extNodes.get(a)!, pb = extNodes.get(b)!;
    const minLon = Math.min(pa[0], pb[0]) - .01, maxLon = Math.max(pa[0], pb[0]) + .01;
    const minLat = Math.min(pa[1], pb[1]) - .01, maxLat = Math.max(pa[1], pb[1]) + .01;
    for (const station of extStations) {
      if (station.coordinate[0] < minLon || station.coordinate[0] > maxLon || station.coordinate[1] < minLat || station.coordinate[1] > maxLat) continue;
      const p = nearestPointOnLine(lineString([extNodes.get(a)!, extNodes.get(b)!]), station.coordinate);
      if ((p.properties.dist ?? Infinity) > .08) continue;
      const loc = p.properties.location ?? 0;
      if (loc < .000001 || km - loc < .000001) continue;
      const id = extVirtual--; extNodes.set(id, p.geometry.coordinates as Coordinate); splits.push({ id, km: loc });
    }
    splits.sort((a, b) => a.km - b.km);
    for (let j = 1; j < splits.length; j++) for (const [f, t] of [[splits[j - 1].id, splits[j].id], [splits[j].id, splits[j - 1].id]]) {
      if (!extEdges.has(f)) extEdges.set(f, []); extEdges.get(f)!.push({ to: t, km: splits[j].km - splits[j - 1].km });
    }
  }
}
function extStation(name: RegExp) { const m = extStations.find(s => name.test(s.name)); if (!m) throw new Error(`Missing extension station ${name}`); return m; }
function extNearby(c: Coordinate) { const cs = [...extNodes].map(([id, pt]) => ({ id, km: distance(c, pt) })).filter(n => n.km < .15).sort((a, b) => a.km - b.km); if (!cs.length) throw new Error('No extension track node within 150m of ' + c.map(v => v.toFixed(4)).join(',')); return cs; }
// ---- Build the local chord & multan paths (unchanged results) ----
const khanewal = localStation(/khanewal/i), lodhran = localStation(/lodhran/i), multan = localStation(/multan.*(cant|canton)/i), jahanian = localStation(/jahan|jehan/i);
function localPath(id: RailPath['id'], name: string, anchors: typeof localStations): RailPath {
  const ids: number[] = [];
  for (let i = 1; i < anchors.length; i++) { const leg = localShortest(i === 1 ? localNearby(anchors[0].coordinate) : [{ id: ids.at(-1)!, km: 0 }], new Set(localNearby(anchors[i].coordinate).map(n => n.id))); ids.push(...(i === 1 ? leg : leg.slice(1))); }
  const coordinates = ids.map(id => localNodes.get(id)!);
  const line = lineString(coordinates);
  const linked = localStations.map(s => { const p = nearestPointOnLine(line, s.coordinate); return { ...s, sourceCoordinate: s.coordinate, coordinate: p.geometry.coordinates as Coordinate, km: p.properties.location ?? 0, offsetMeters: (p.properties.dist ?? Infinity) * 1000 }; }).filter(s => s.offsetMeters <= 250).sort((a, b) => a.km - b.km);
  const distanceKm = coordinates.slice(1).reduce((km, pt, i) => km + distance(coordinates[i], pt), 0);
  return { id, name, coordinates, stations: linked, distanceKm };
}

// ---- Build the extended paths (south, north, branch) ----
// Shared junction node 4306557464 sits on the chord's Lodhran end AND on the south-file Lodhran-Raiwind branch way.
// Use the Lodhran station area as the south anchor; topology decides the usable platform track.
function extPath(id: RailPath['id'], name: string, anchors: { id: string; name: string; coordinate: Coordinate }[], starts?: {id:number;km:number}[], onNodes?: (ids:number[]) => void, preciseEnd = false): RailPath {
  const ids = routeThroughAnchors(extNodes, extEdges, starts ?? extNearby(anchors[0].coordinate), anchors.slice(1).map((anchor, i) => {
    const nearby = extNearby(anchor.coordinate);
    return new Set((preciseEnd && i === anchors.length - 2 ? nearby.filter(node => node.km <= nearby[0].km + .000001) : nearby).map(node => node.id));
  }));
  onNodes?.(ids);
  const coordinates = ids.map(id => extNodes.get(id)!);
  const line = lineString(coordinates);
  // Merge the local Khanewal and Lodhran stations (Khanewal is a station
  // *building* in OSM, present only in the local snapshot) so both termini
  // appear on the extension paths. Unnamed halt nodes are dropped.
  const mergedStations = [...extStations, { id: khanewal.id, name: khanewal.name, coordinate: khanewal.coordinate }, { id: lodhran.id, name: lodhran.name, coordinate: lodhran.coordinate }];
  const seenMerged = new Set<string>();
  const uniqueStations = mergedStations.filter(s => { if (seenMerged.has(s.id)) return false; seenMerged.add(s.id); return true; });
  const linked = uniqueStations.map(s => { const p = nearestPointOnLine(line, s.coordinate); return { ...s, sourceCoordinate: s.coordinate, coordinate: p.geometry.coordinates as Coordinate, km: p.properties.location ?? 0, offsetMeters: (p.properties.dist ?? Infinity) * 1000 }; }).filter(s => s.offsetMeters <= 250 && s.name.trim()).sort((a, b) => a.km - b.km);
  const distanceKm = coordinates.slice(1).reduce((km, pt, i) => km + distance(coordinates[i], pt), 0);
  return { id, name, coordinates, stations: linked, distanceKm };
}

// Anchors sourced from OSM (operating status unverified)
const lodhranSouth = extStation(/lodhran/i);            // Lodhran Junction (south anchor)
const samasata = extStation(/samasata/i);               // Samasata Junction
const rahimYarKhan = extStation(/rahim yar khan/i);     // Rahim Yar Khan (south terminus)
const karachiStat = extStation(/karachi.*canton/i);     // Karachi Cantonment (far south terminus)
const khanewalNorth = khanewal;                         // Khanewal is a station *building* in OSM, so only the local snapshot has it
const gujranwala = extStation(/gujranwala.*cant/i);     // Gujranwala Cantt (operational)
const jhelumNorth = extStation(/^jhelum$/i);            // Jhelum
const taxila = extStation(/taxila/i);                   // Taxila Cantt
const nowshera = extStation(/nowshera/i);               // Nowshera Junction
const peshawarNorth = extStation(/peshawar.canton/i);   // Peshawar Cantonment
// Branch anchors
const mandiBurewala = extStation(/mandi.*burewala/i);   // Mandi Burewala (branch terminus)

const chord = localPath('chord', 'Chord via Jahanian', [khanewal, jahanian, lodhran]);
const multanLocal = localPath('multan', 'Main route via Multan', [khanewal, multan, lodhran]);

// South: Lodhran -> Rahim Yar Khan -> Karachi (ML-1 south)
const bahawalpur = extStation(/^bahawalpur/i), rohri = extStation(/^rohri/i);
const south = extPath('south', 'Main line south to Karachi', [lodhranSouth, bahawalpur, samasata, rahimYarKhan, rohri, karachiStat]);

// North: Khanewal -> Peshawar (full operational ML-1 north). Anchors through
// Chichawatni, Sahiwal, Okara and Raiwind keep the route on the Karachi–Peshawar
// main line; a shortest-path search alone would shave distance through the
// Khanewal–Wazirabad and Shorkot–Sheikhupura branch lines.
const chichawatni = extStation(/chichawatni/i);
const sahiwal = extStation(/sahiwal/i);
const okara = extStation(/okara/i);
const raiwind = extStation(/raiwind/i);
const lahore = extStation(/^lahore junction/i);
const rawalpindi = extStation(/^rawalpindi/i);
const wazirabad = extStation(/^wazirabad/i);
const north = extPath('north', 'Main line north to Peshawar', [khanewalNorth, chichawatni, sahiwal, okara, raiwind, lahore, gujranwala, wazirabad, jhelumNorth, rawalpindi, taxila, nowshera, peshawarNorth]);

// Branch: Lodhran -> Mandi Burewala via the Lodhran-Raiwind Branch Line (shared node 4306557464 bridges local track and extension graph)
const branch = extPath('branch', 'Lodhran-Raiwind branch toward Mandi Burewala', [lodhranSouth, mandiBurewala]);

const allamaIqbal = extPath('allama-iqbal', 'Allama Iqbal Express', [karachiStat, rohri, rahimYarKhan, samasata, bahawalpur, lodhranSouth, jahanian, khanewalNorth, chichawatni, sahiwal, okara, raiwind, lahore, extStation(/shahdara/i), extStation(/^narang/i), extStation(/^narowal/i), extStation(/^pasrur/i), extStation(/^sialkot/i)]);

// Musa Pak uses the main line from Multan through Khanewal and Sahiwal.
// Solve the continuous itinerary in the sourced graph; do not join polylines.
const musaPak = extPath('musa-pak', 'Musa Pak Express', [multan, khanewalNorth, chichawatni, sahiwal, okara, raiwind, lahore]);

// Fareed leaves ML-1 at Lodhran and rejoins at Raiwind through Kasur.
const kasur = extStation(/^kasur junction$/i);
let kasurNode = 0;
const fareedArrival = extPath('fareed', 'Fareed arrival', [extStation(/^karachi city/i), karachiStat, rohri, rahimYarKhan, samasata, bahawalpur, lodhranSouth, mandiBurewala, extStation(/^arif.?wala/i), extStation(/^pak.?pattan/i), kasur], undefined, ids => { kasurNode = ids.at(-1)!; }, true);
const fareedDeparture = extPath('fareed', 'Fareed departure', [kasur, raiwind, lahore], [{id: kasurNode, km: 0}]);
const pivot = fareedArrival.distanceKm;
const kasurStop = fareedArrival.stations.find(station => station.id === kasur.id)!;
const arrivalStations = fareedArrival.stations.map(station => station.id === kasur.id ? { ...station, km: pivot, coordinate: fareedArrival.coordinates.at(-1)! } : station);
const arrivalIds = new Set(arrivalStations.map(station => station.id));
const fareed: RailPath = {
  id: 'fareed', name: 'Baba Farid (Fareed) Express',
  coordinates: [...fareedArrival.coordinates, ...fareedDeparture.coordinates.slice(1)],
  distanceKm: pivot + fareedDeparture.distanceKm,
  stations: [...arrivalStations, ...fareedDeparture.stations.filter(station => !arrivalIds.has(station.id)).map(station => ({...station, km: pivot + station.km}))].sort((a,b) => a.km-b.km),
  reversals: [{stationId: kasurStop.id, km: pivot}],
};

// Quetta reaches ML-1 at Rohri, then uses the Multan main line.
// Both sourced approaches join south of Sibi's platforms. Model the
// direction change explicitly; never permit an unannounced U-turn at a switch.
const sibi = extStation(/^sibi junction$/i);
let sibiNode = 0;
const jaffarArrival = extPath('jaffar', 'Jaffar arrival', [extStation(/^quetta$/i), extStation(/^kolpur$/i), extStation(/^mach$/i), extStation(/^aab-e-gum$/i), sibi], undefined, ids => {sibiNode = ids.at(-1)!;}, true);
const jaffarDeparture = extPath('jaffar', 'Jaffar departure', [sibi, extStation(/^jacobabad/i), extStation(/^shikarpur$/i), extStation(/^sukkur$/i), rohri, rahimYarKhan, bahawalpur, lodhranSouth, multan, khanewalNorth, chichawatni, sahiwal, okara, raiwind, lahore, gujranwala, wazirabad, jhelumNorth, rawalpindi, taxila, nowshera, peshawarNorth], [{id:sibiNode,km:0}]);
const sibiKm = jaffarArrival.distanceKm;
const jaffarArrivalStations = jaffarArrival.stations.map(station=>station.id===sibi.id ? {...station,km:sibiKm,coordinate:jaffarArrival.coordinates.at(-1)!}:station);
const jaffarArrivalIds = new Set(jaffarArrivalStations.map(station=>station.id));
const jaffar: RailPath = {
 id:'jaffar',name:'Jaffar Express',
 coordinates:[...jaffarArrival.coordinates,...jaffarDeparture.coordinates.slice(1)],
 distanceKm:sibiKm+jaffarDeparture.distanceKm,
 stations:[...jaffarArrivalStations,...jaffarDeparture.stations.filter(station=>!jaffarArrivalIds.has(station.id)).map(station=>({...station,km:sibiKm+station.km}))].sort((a,b)=>a.km-b.km),
 reversals:[{stationId:sibi.id,km:sibiKm}],
};

// Green Line uses the Jahanian chord, then the main line to Rawalpindi
// and the connected Islamabad branch to Margalla. One graph search preserves
// through-track continuity at every junction instead of joining polylines.
const greenLine = extPath('green-line', 'Green Line Express', [karachiStat, rohri, rahimYarKhan, samasata, bahawalpur, lodhranSouth, jahanian, khanewalNorth, chichawatni, sahiwal, okara, raiwind, lahore, gujranwala, wazirabad, jhelumNorth, rawalpindi, extStation(/^margalla railway station$/i)], undefined, undefined, true);

// Awam follows the full main line via Shujabad and Multan, not the chord.
// Ordered anchors prevent shortcuts onto unrelated branch lines.
const awam = extPath('awam', 'Awam Express', [karachiStat, rohri, rahimYarKhan, samasata, bahawalpur, lodhranSouth, extStation(/^shujabad$/i), multan, khanewalNorth, chichawatni, sahiwal, okara, raiwind, lahore, gujranwala, wazirabad, jhelumNorth, rawalpindi, taxila, nowshera, peshawarNorth]);

// Pak Business shares the Jahanian chord corridor but terminates at Lahore.
const pakBusiness = extPath('pak-business', 'Pak Business Express', [karachiStat, rohri, rahimYarKhan, samasata, bahawalpur, lodhranSouth, jahanian, khanewalNorth, chichawatni, sahiwal, okara, raiwind, lahore], undefined, undefined, true);

// Subak Kharam uses the existing Lahore–Rawalpindi main-line corridor.
// Solve the whole itinerary through the sourced graph; use the precise
// Rawalpindi projection so the train ends at its actual destination station.
const subakKharam = extPath('subak-kharam', 'Subak Kharam (Railcar)', [lahore, gujranwala, wazirabad, jhelumNorth, rawalpindi], undefined, undefined, true);

// Tezgam follows the Multan main line, not the Jahanian chord, and ends
// precisely at Rawalpindi. Solve one continuous itinerary from OSM rails.
const tezgam = extPath('tezgam', 'Tezgam Express', [karachiStat, rohri, rahimYarKhan, samasata, bahawalpur, lodhranSouth, extStation(/^shujabad$/i), multan, khanewalNorth, chichawatni, sahiwal, okara, raiwind, lahore, gujranwala, wazirabad, jhelumNorth, rawalpindi], undefined, undefined, true);

// The western Sindh corridor uses ML-2 to Habib Kot, then ML-3 to
// Sukkur/Rohri. Both approaches meet south of Habib Kot's platforms, so
// the station visit requires an explicit direction change, not a hidden U-turn.
const habibKot = extStation(/^habib kot junction$/i);
let habibNode = 0;
const mohenjoArrival = extPath('mohenjo-daro','Mohenjo Daro arrival', [extStation(/^kotri/i),extStation(/^sindh university$/i),extStation(/^petaro$/i),extStation(/^sehwan sharif$/i),extStation(/^dadu$/i),extStation(/^mohenjo-daro$/i),extStation(/^larkana$/i),extStation(/^madeji road$/i),extStation(/^ruk$/i),habibKot],undefined,ids=>{habibNode=ids.at(-1)!;},true);
const mohenjoDeparture = extPath('mohenjo-daro','Mohenjo Daro departure',[habibKot,extStation(/^sukkur$/i),rohri],[{id:habibNode,km:0}],undefined,true);
const habibKm = mohenjoArrival.distanceKm;
const mohenjoStations = mohenjoArrival.stations.map(station=>station.id===habibKot.id?{...station,km:habibKm,coordinate:mohenjoArrival.coordinates.at(-1)!}:station);
const mohenjoIds = new Set(mohenjoStations.map(station=>station.id));
const mohenjoDaro: RailPath = {
  id:'mohenjo-daro',name:'Mohenjo Daro Express (Passenger)',
  coordinates:[...mohenjoArrival.coordinates,...mohenjoDeparture.coordinates.slice(1)],
  distanceKm:habibKm+mohenjoDeparture.distanceKm,
  stations:[...mohenjoStations,...mohenjoDeparture.stations.filter(station=>!mohenjoIds.has(station.id)).map(station=>({...station,km:habibKm+station.km}))].sort((a,b)=>a.km-b.km),
  reversals:[{stationId:habibKot.id,km:habibKm}],
};

// Millat leaves ML-1 at Khanewal and follows the Faisalabad–Sargodha
// branch to Lala Musa. Ordered station anchors rule out shortcuts through
// Jhang or Hafizabad; every segment must follow connected sourced rails.
const millat = extPath('millat','Millat Express',[karachiStat,rohri,rahimYarKhan,samasata,bahawalpur,lodhranSouth,jahanian,khanewalNorth,
  extStation(/^abdul hakim railway station$/i),extStation(/^shorkot cantt junction railway station$/i),
  extStation(/^toba tek singh railway station$/i),extStation(/^gojra railway station$/i),extStation(/^faisalabad(?: railway station)?$/i),
  extStation(/^chak jhumra junction railway station$/i),extStation(/^chiniot$/i),extStation(/^chenab nagar$/i),
  extStation(/^shaheenabad$/i),extStation(/^sargodha$/i),extStation(/^bhalwal$/i),extStation(/^phularwan$/i),
  extStation(/^malakwal$/i),extStation(/^mandi bahauddin$/i),extStation(/^chailianwala$/i),extStation(/^dinga$/i),extStation(/^lala musa/i)],undefined,undefined,true);

// Jamalo's reported extension shares connected ML-3 tracks with Jaffar.
// Keep a dedicated short corridor instead of exposing Jaffar's full journey.
// Precise endpoint projections allow departure from either actual terminal.
const jamaloOrigin = extStation(/^shikarpur$/i);
const jamaloStarts = extNearby(jamaloOrigin.coordinate);
const jamalo = extPath('jamalo','Jamalo Express (Ho Jamalo)',
  [jamaloOrigin,extStation(/^sukkur$/i),rohri],
  jamaloStarts.filter(node=>node.km<=jamaloStarts[0].km+.000001),undefined,true);

const kcr = buildKcrLocalPath(fareed, JSON.parse(readFileSync(KCR_STATIONS_FILE, 'utf8')) as KcrStationSnapshot);

const allFiles = [...new Set([KCR_STATIONS_FILE, localFile, 'data/rail/khanewal-stations.osm.json', ...EXT_FILES])];
const sourceManifest = allFiles.map(file => ({ file, sourceTimestamp: JSON.parse(readFileSync(file, 'utf8')).osm3s.timestamp_osm_base as string }));
const extRetrieved = new Date(Math.max(...allFiles.map(file => statSync(file).mtimeMs))).toISOString();
const dataset: RailDataset = {
  version: 1,
  source: 'OpenStreetMap / Overpass',
  attribution: '© OpenStreetMap contributors, ODbL 1.0',
  retrievedAt: extRetrieved,
  sourceTimestamp: [...sourceManifest.map(source => source.sourceTimestamp)].sort()[0],
  sources: sourceManifest,
  coverage: 'KCR shorter Karachi City–Dhabeji local simulation with 11 mapped calls; Jamalo reported Shikarpur–Sukkur–Rohri extension; Millat Express Karachi Cantt–Lala Musa via Jahanian, Faisalabad, Sargodha and Malakwal; Historical Mohenjo Daro Kotri–Rohri via Sehwan, Dadu, Larkana and Habib Kot; Tezgam Karachi Cantt–Rawalpindi via Multan, Lahore and Jhelum; Subak Kharam Lahore–Rawalpindi via Gujranwala and Jhelum; Pak Business Express Karachi Cantt–Lahore via Jahanian chord and Sahiwal; Awam Express Karachi Cantt–Peshawar via Shujabad, Multan, Lahore and Rawalpindi; Green Line Karachi Cantt–Margalla via Jahanian chord, Lahore and Rawalpindi; Jaffar Express full Quetta–Peshawar simulation via Bolan, Sukkur, Multan and Rawalpindi; Fareed Express Karachi City–Lahore via Vehari, Pakpattan and Kasur; Musa Pak Express Multan–Lahore via Khanewal and Sahiwal; Allama Iqbal Express Karachi–Sialkot via Jahanian chord and Narowal, plus ML-1 exploration: Karachi-Lodhran (south), Khanewal-Peshawar (north), Lodhran–Mandi Burewala partial branch; chord & via-Multan branches retained. Station status is not independently verified.',
  paths: [chord, multanLocal, south, north, branch, allamaIqbal, musaPak, fareed, jaffar, greenLine, awam, pakBusiness, subakKharam, tezgam, mohenjoDaro, millat, jamalo, kcr],
};
// Reject invalid output before replacing the known-good browser dataset.
validateRailDataset(dataset);
for (const path of dataset.paths) assertRailPathQuality(path);
for (const train of TRAINS) for (const service of train.services) servicePath(dataset, train, service);
writeFileSync('public/data/rail/ml1.json', JSON.stringify(dataset));
console.log(JSON.stringify({
  kcr: {distanceKm:kcr.distanceKm,stations:kcr.stations.map(s=>s.name)},
  jamalo: {distanceKm:jamalo.distanceKm,stations:jamalo.stations.map(s=>s.name)},
  millat: {distanceKm:millat.distanceKm,stations:millat.stations.map(s=>s.name)},
  mohenjoDaro: {distanceKm:mohenjoDaro.distanceKm,stations:mohenjoDaro.stations.map(s=>s.name)},
  tezgam: {distanceKm:tezgam.distanceKm,stations:tezgam.stations.map(s=>s.name)},
  subakKharam: {distanceKm:subakKharam.distanceKm,stations:subakKharam.stations.map(s=>s.name)},
  pakBusiness: {distanceKm:pakBusiness.distanceKm,stations:pakBusiness.stations.map(s=>s.name)},
  awam: {distanceKm:awam.distanceKm,stations:awam.stations.map(s=>s.name)},
  greenLine: {distanceKm:greenLine.distanceKm,stations:greenLine.stations.map(s=>s.name)},
  jaffar: {distanceKm:jaffar.distanceKm,stations:jaffar.stations.map(s=>({id:s.id,name:s.name,km:s.km}))},
  fareed: { distanceKm: fareed.distanceKm, stations: fareed.stations.map(s => ({id:s.id,name:s.name,km:s.km})) },
  musaPak: { distanceKm: musaPak.distanceKm, stations: musaPak.stations.map(s => s.name) },
  allamaIqbal: { distanceKm: allamaIqbal.distanceKm, stations: allamaIqbal.stations.map(s => ({id:s.id,name:s.name,km:s.km})) },
  chord: { name: chord.name, distanceKm: chord.distanceKm, vertices: chord.coordinates.length, stations: chord.stations.map(s => s.name) },
  multan: { name: multanLocal.name, distanceKm: multanLocal.distanceKm, vertices: multanLocal.coordinates.length, stations: multanLocal.stations.map(s => s.name) },
  south: { name: south.name, distanceKm: south.distanceKm, vertices: south.coordinates.length, stations: south.stations.map(s => s.name) },
  north: { name: north.name, distanceKm: north.distanceKm, vertices: north.coordinates.length, stations: north.stations.map(s => s.name) },
  branch: { name: branch.name, distanceKm: branch.distanceKm, vertices: branch.coordinates.length, stations: branch.stations.map(s => s.name) },
}, null, 2));
