import { distance, lineString, nearestPointOnLine } from '@turf/turf';
import type { Coordinate } from '../routeData';
import { routeThroughAnchors, type RailEdge } from '../rail/importGraph';
import { BUS_NETWORKS } from './networks';
import type { BusSourceSnapshot } from './sourceQuality';
import { multanSourceWays } from './multanSource';
import type { BusPath } from './types';

// Stable mapped station IDs, ordered from BZU to Chowk Kumharan. Source names
// differ from passenger-facing spellings; validate each explicit alias.
export const MULTAN_STATION_SOURCES = [
 [8365794881,'Bahauddin Zakariya University Metrobus'],[8365794880,'Bahadar Pur Metrobus'],[8365794879,'Mehmood Kot Metrobus'],[8365794878,'Northern Bypass Metrobus'],[8365794877,'Shalimar Colony Metrobus'],[8365794876,'Sabzazar Metrobus'],[8365794875,'Chungi No. 06 Metrobus'],[8365794874,'Gulgasht Metrobus'],[8365794873,'Chungi No. 9 Chowk Metrobus'],[8362722933,'Qasim Bagh Metrobus'],[8362709160,'Daulat Gate Metrobus'],[8362709163,'Shah Jamal Metrobus'],[8362709166,'Manzoorabad Metrobus'],[8365794865,'Ahmad Abad Metrobus'],[8365794866,'BCG Chowk Metrobus'],[8365794867,'Peoples Colony Metrobus'],[8365794868,'Vehari Chowk Metrobus'],[8365794869,'General Bus Stand Metrobus'],[8365794870,'Jinnah Park Metrobus'],[8365794871,'Shah Rukne Alam Metrobus'],[8365794872,'Kumharanwala Chowk Metrobus'],
] as const;
/** Project mapped station centres onto original directed corridor edges.
 * These are inferred stopping positions, within 35 metres of source stations.
 * Search the entire ordered itinerary so a platform snap cannot cause a U-turn.
 * Preserve shared node connectivity and one-way tags; never repair a gap.
 */
export function buildMultanPaths(source: BusSourceSnapshot): BusPath[] {
  const network = BUS_NETWORKS['multan-metrobus'];
  const elements = new Map(source.elements.map(e => [`${e.type}/${e.id}`, e]));
  const ways = multanSourceWays(source);
  const point = (id:number):Coordinate => {
    const node = elements.get(`node/${id}`);
    if (!Number.isFinite(node?.lon) || !Number.isFinite(node?.lat)) throw Error('Missing Multan source node.');
    return [node!.lon!, node!.lat!];
  };
  const nodes = new Map<number, Coordinate>();
  for (const way of ways) for (const id of way.nodeIds!) nodes.set(id, point(id));
  const splits = new Map<string, {id:number;fraction:number}[]>();
  const anchors: Set<number>[] = [];
  const sourceIds = new Map<number, number>();
  let virtualId = -1;
  for (let ordinal = 0; ordinal < network.stations.length; ordinal++) {
    const [stationId,expectedName]=MULTAN_STATION_SOURCES[ordinal];
    const station=elements.get('node/'+stationId);
    if(station?.tags?.amenity!=='bus_station'||station.tags.name!==expectedName)throw Error('Missing Multan station source: '+network.stations[ordinal]);
    const centre=point(stationId);
    const candidates = ways.flatMap(way => way.coordinates.slice(1).map((b,i) => {
      const a = way.coordinates[i], projected = nearestPointOnLine(lineString([a,b]), centre);
      return {a:way.nodeIds![i],b:way.nodeIds![i+1],coordinate:projected.geometry.coordinates as Coordinate,offset:projected.properties.dist,fraction:projected.properties.location/distance(a,b)};
    })).sort((a,b)=>a.offset-b.offset);
    if (!candidates.length || candidates[0].offset > .035) throw Error('Multan station is off the busway: '+network.stations[ordinal]);
    const selected = candidates.filter(candidate=>candidate.offset <= .035);
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
      stops.add(id);sourceIds.set(id,stationId);
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
    catch { throw Error(`Disconnected Multan ${direction.id} corridor: no invented gap repair is allowed.`); }
    const coordinates=ids.map(id=>nodes.get(id)!);
    const cumulative=[0];for(let i=1;i<ids.length;i++)cumulative.push(cumulative[i-1]+distance(coordinates[i-1],coordinates[i]));
    let previous=-1;
    const stations=order.map(ordinal=>{
      const at=ids.findIndex((id,index)=>index>previous&&anchors[ordinal].has(id));
      if(at<0)throw Error('Station missing from directed BRT track.');previous=at;
      return {id:`mlt-${ordinal+1}`,name:network.stations[ordinal],coordinate:coordinates[at],km:cumulative[at],sourceId:sourceIds.get(ids[at])!,underground:tunnels.has(`${ids[at-1]}:${ids[at]}`)||tunnels.has(`${ids[at]}:${ids[at+1]}`)};
    });
    const sections:BusPath['sections']=[];
    for(let i=1;i<ids.length;i++){const underground=tunnels.has(`${ids[i-1]}:${ids[i]}`),section=sections.at(-1);if(!section||section.underground!==underground)sections.push({underground,coordinates:[coordinates[i-1],coordinates[i]]});else section.coordinates.push(coordinates[i]);}
    return {direction:direction.id,destination:direction.destination,coordinates,distanceKm:cumulative.at(-1)!,stations,sections};
  });
}
