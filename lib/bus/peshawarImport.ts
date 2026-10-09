import { distance, lineString, nearestPointOnLine } from '@turf/turf';
import type { Coordinate } from '../routeData';
import { routeThroughAnchors, type RailEdge } from '../rail/importGraph';
import { BUS_NETWORKS } from './networks';
import { busSourceWays, type BusSourceSnapshot } from './sourceQuality';
import type { BusPath } from './types';

// The outer stations have mapped footprints, while the central stations have
// precise platform nodes. Ref 17 is unused in OSM: the operator has 30 calls.
export const PESHAWAR_FOOTPRINTS: Readonly<Record<number, number>> = {
  0:851309848, 1:851314993, 2:851318480, 3:906013639, 4:906013640,
  5:906013641, 26:906519866, 27:906519863, 28:906519858, 29:906519844,
};

/** Build both SR-02 directions from connected dedicated busways. Station
 * projection splits actual source edges; it never joins disconnected roads.
 * One ordered graph search per direction prevents a greedy station snap from
 * choosing the opposite platform and requiring a hidden U-turn to continue.
 */
export function buildPeshawarPaths(source: BusSourceSnapshot): BusPath[] {
  const network = BUS_NETWORKS['peshawar-brt'];
  const elements = new Map(source.elements.map(e => [`${e.type}/${e.id}`, e]));
  const ways = busSourceWays(source, null);
  const point = (id:number):Coordinate => {
    const node = elements.get(`node/${id}`);
    if (!Number.isFinite(node?.lon) || !Number.isFinite(node?.lat)) throw Error('Missing Peshawar source node.');
    return [node!.lon!, node!.lat!];
  };
  const nodes = new Map<number, Coordinate>();
  for (const way of ways) for (const id of way.nodeIds!) nodes.set(id, point(id));
  const splits = new Map<string, {id:number;fraction:number}[]>();
  const anchors: Set<number>[] = [];
  const sourceIds = new Map<number, number>();
  let virtualId = -1;
  for (let ordinal = 0; ordinal < network.stations.length; ordinal++) {
    const footprintId = PESHAWAR_FOOTPRINTS[ordinal];
    if (!footprintId) {
      const ref = ordinal < 16 ? ordinal + 1 : ordinal + 2;
      const platforms = source.elements.filter(e => e.type === 'node' && e.tags?.highway === 'bus_stop' && e.tags.bus === 'yes' && Number(e.tags.ref) === ref);
      if (platforms.length !== 2 || platforms.some(e => !nodes.has(e.id))) throw Error(`Missing directional platforms: ${network.stations[ordinal]}.`);
      for (const platform of platforms) {
        const name = platform.tags!['name:en'];
        // Exact source IDs + Urdu spelling guard the known copied English
        // tag on the Abdara Road pair. Unrelated Tehkal platforms cannot match.
        const abdara = ordinal === 18 && [13410825898,13410825899].includes(platform.id) && platform.tags!.name === 'ابدرہ روڈ';
        if (!abdara && name !== network.stations[ordinal] && !(ordinal === 10 && name === 'Shuba Bazar') && !(ordinal === 25 && name === 'Hayatabad Phase-3')) throw Error('Unexpected Peshawar platform name: '+name);
        sourceIds.set(platform.id,platform.id);
      }
      anchors.push(new Set(platforms.map(e => e.id)));
      continue;
    }
    const footprint = elements.get(`way/${footprintId}`);
    if (!footprint?.nodes?.length || !(footprint.tags?.amenity === 'bus_station' || footprint.tags?.public_transport === 'platform')) throw Error('Missing station footprint: '+network.stations[ordinal]);
    const polygon = footprint.nodes.map(point);
    const centre:Coordinate = [(Math.min(...polygon.map(p=>p[0]))+Math.max(...polygon.map(p=>p[0])))/2,(Math.min(...polygon.map(p=>p[1]))+Math.max(...polygon.map(p=>p[1])))/2];
    const candidates = ways.flatMap(way => way.coordinates.slice(1).map((b,i) => {
      const a = way.coordinates[i], projected = nearestPointOnLine(lineString([a,b]), centre);
      return {a:way.nodeIds![i],b:way.nodeIds![i+1],coordinate:projected.geometry.coordinates as Coordinate,offset:projected.properties.dist,fraction:projected.properties.location/distance(a,b)};
    })).sort((a,b)=>a.offset-b.offset);
    if (!candidates.length || candidates[0].offset > .035) throw Error('Station footprint is off the busway: '+network.stations[ordinal]);
    const selected = candidates.filter(candidate=>candidate.offset <= Math.min(.035,candidates[0].offset+.014));
    const stops = new Set<number>();
    for (const candidate of selected) {
      let id:number;
      if (candidate.fraction < 1e-7) id=candidate.a;
      else if (candidate.fraction > 1-1e-7) id=candidate.b;
      else {
        const key=`${candidate.a}:${candidate.b}`;
        const list=splits.get(key)??[];
        const existing=list.find(split=>Math.abs(split.fraction-candidate.fraction)<1e-7);
        id=existing?.id??virtualId--;
        if (!existing) {nodes.set(id,candidate.coordinate);list.push({id,fraction:candidate.fraction});splits.set(key,list);}
      }
      stops.add(id);sourceIds.set(id,footprintId);
    }
    anchors.push(stops);
  }
  const edges = new Map<number, RailEdge[]>();
  const tunnels = new Set<string>();
  const add=(a:number,b:number,underground:boolean)=>{const list=edges.get(a)??[];list.push({to:b,km:distance(nodes.get(a)!,nodes.get(b)!)});edges.set(a,list);if(underground)tunnels.add(`${a}:${b}`);};
  for (const way of ways) {
    const original=elements.get(`way/${way.wayId}`)!;
    const underground=!!original.tags?.tunnel&&original.tags.tunnel!=='no';
    for(let i=1;i<way.nodeIds!.length;i++) {
      const a=way.nodeIds![i-1],b=way.nodeIds![i];
      const divisions=[...(splits.get(`${a}:${b}`)??[]),...(splits.get(`${b}:${a}`)??[]).map(split=>({...split,fraction:1-split.fraction}))].sort((x,y)=>x.fraction-y.fraction);
      const ids=[a,...divisions.map(split=>split.id),b];
      for(let j=1;j<ids.length;j++){if(way.oneway!=='-1')add(ids[j-1],ids[j],underground);if(way.oneway!=='yes')add(ids[j],ids[j-1],underground);}
    }
  }
  return network.directions.map((direction,directionIndex) => {
    const order=Array.from({length:network.stations.length},(_,i)=>directionIndex===0?i:network.stations.length-1-i);
    let ids:number[];
    try { ids=routeThroughAnchors(nodes,edges,[...anchors[order[0]]].map(id=>({id,km:0})),order.slice(1).map(ordinal=>anchors[ordinal])); }
    catch { throw Error(`Disconnected Peshawar ${direction.id} corridor: no invented gap repair is allowed.`); }
    const coordinates=ids.map(id=>nodes.get(id)!);
    const cumulative=[0];for(let i=1;i<ids.length;i++)cumulative.push(cumulative[i-1]+distance(coordinates[i-1],coordinates[i]));
    let previous=-1;
    const stations=order.map(ordinal=>{
      const at=ids.findIndex((id,index)=>index>previous&&anchors[ordinal].has(id));
      if(at<0)throw Error('Station missing from directed BRT track.');previous=at;
      return {id:`zu-${ordinal+1}`,name:network.stations[ordinal],coordinate:coordinates[at],km:cumulative[at],sourceId:sourceIds.get(ids[at])!,underground:tunnels.has(`${ids[at-1]}:${ids[at]}`)||tunnels.has(`${ids[at]}:${ids[at+1]}`)};
    });
    const sections:BusPath['sections']=[];
    for(let i=1;i<ids.length;i++){const underground=tunnels.has(`${ids[i-1]}:${ids[i]}`),section=sections.at(-1);if(!section||section.underground!==underground)sections.push({underground,coordinates:[coordinates[i-1],coordinates[i]]});else section.coordinates.push(coordinates[i]);}
    return {direction:direction.id,destination:direction.destination,coordinates,distanceKm:cumulative.at(-1)!,stations,sections};
  });
}
