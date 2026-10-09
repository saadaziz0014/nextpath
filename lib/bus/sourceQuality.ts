import { bearing, lineString, nearestPointOnLine } from '@turf/turf';
import type { Coordinate } from '../routeData';
import { validateBusDataset } from './track';
import type { BusDataset } from './types';
export interface BusSourceWay { coordinates:Coordinate[]; oneway?:string; nodeIds?:number[]; wayId?:number; note?:string }
export interface BusSourceSnapshot { fetchedAt:string; elements:{type:string;id:number;lat?:number;lon?:number;nodes?:number[];tags?:Record<string,string>;members?:{type:string;ref:number}[]}[] }
export function busSourceWays(source:BusSourceSnapshot,relationId:number|null=19984670):BusSourceWay[] {
 const elements=new Map(source.elements.map(e=>[`${e.type}/${e.id}`,e]));
 // Peshawar SR-02 has no complete mapped route relation. Its checked-in
 // corridor snapshot contains the sourced busways from three OSM extracts.
 const members=relationId===null?source.elements.filter(e=>e.type==='way'&&(e.tags?.highway==='busway'||e.tags?.highway==='bus_guideway'&&e.tags.bus==='designated'&&e.tags['name:en']==='TransPeshawar BRT')).map(e=>({type:'way',ref:e.id})):null;
 const relation=members?{tags:{route:'bus'},members}:elements.get(`relation/${relationId}`);if(relation?.tags?.route!=='bus'||!relation.members)throw Error('Missing Metrobus source relation');
 return relation.members.filter(m=>m.type==='way').flatMap(m=>{
  const way=elements.get(`way/${m.ref}`);if((way?.tags?.highway!=='busway'&&!(relationId===null&&way?.tags?.highway==='bus_guideway'&&way.tags.bus==='designated'&&way.tags['name:en']==='TransPeshawar BRT'))||!way.nodes)throw Error('Missing source busway');
  const coordinates=way.nodes.map(id=>{const node=elements.get(`node/${id}`);if(!Number.isFinite(node?.lon)||!Number.isFinite(node?.lat))throw Error('Missing busway node');return [node!.lon!,node!.lat!] as Coordinate;});
  // OSM way 993894344 combines a one-way closed terminal loop with its
  // only entrance/exit stem. The stem must be usable both ways for a
  // Saddar–Secretariat journey to exist. This is a local topology inference,
  // not an OSM edit: preserve every point, split only the final sourced edge.
  if(relationId===13911249&&way.id===993894344&&way.tags.oneway==='yes'){
   if(way.nodes[0]!==9182527131||way.nodes.at(-2)!==9182527131||way.nodes.at(-1)!==5220454818)throw Error('Secretariat terminal source changed; review the stem exception');
   return [{wayId:way.id,nodeIds:way.nodes.slice(0,-1),coordinates:coordinates.slice(0,-1),oneway:'yes'}, {wayId:way.id,nodeIds:way.nodes.slice(-2),coordinates:coordinates.slice(-2),note:'Secretariat shared entrance/exit stem: local bidirectional exception'}];
  }
  return [{wayId:way.id,nodeIds:way.nodes,oneway:way.tags.oneway,coordinates}];
 });
}
/** Every generated edge must belong to a directional source busway. This
 * rejects gap bridges, ordinary streets, reversed one-way ramps and U-turns. */
export function verifyBusSource(dataset:BusDataset,ways:BusSourceWay[]) {
 validateBusDataset(dataset);
 const edges=new Set<string>();
 const segments: {a:Coordinate;b:Coordinate}[]=[];
 for(const {coordinates:p,oneway} of ways)for(let i=1;i<p.length;i++){if(oneway!=='-1')segments.push({a:p[i-1],b:p[i]});if(oneway!=='yes')segments.push({a:p[i],b:p[i-1]});}
 // Footprint-based stops may split an existing edge. Both endpoints must
 // lie on ONE directed source segment: no shortcuts or gap bridges.
 const projectedEdge=(a:Coordinate,b:Coordinate)=>segments.some(segment=>{
   const epsilon=.0000001,start=segment.a,end=segment.b;
   for(const p of [a,b])if(p[0]<Math.min(start[0],end[0])-epsilon||p[0]>Math.max(start[0],end[0])+epsilon||p[1]<Math.min(start[1],end[1])-epsilon||p[1]>Math.max(start[1],end[1])+epsilon)return false;
   if((b[0]-a[0])*(end[0]-start[0])+(b[1]-a[1])*(end[1]-start[1])<=0)return false;
   const line=lineString([start,end]);return (nearestPointOnLine(line,a).properties.dist??Infinity)<.00001&&(nearestPointOnLine(line,b).properties.dist??Infinity)<.00001;
 });
 for(const {coordinates:p,oneway} of ways)for(let i=1;i<p.length;i++){if(oneway!=='-1')edges.add(`${p[i-1]}|${p[i]}`);if(oneway!=='yes')edges.add(`${p[i]}|${p[i-1]}`);}
 for(const path of dataset.paths){
  const seen=new Set<string>();
  for(let i=0;i<path.coordinates.length;i++){
   const point=path.coordinates[i];if(seen.has(String(point)))throw Error('Bus corridor retraces itself');seen.add(String(point));
   if(i&&!edges.has(`${path.coordinates[i-1]}|${point}`)&&!projectedEdge(path.coordinates[i-1],point))throw Error('Directional busway edge missing from source');
   if(i&&i<path.coordinates.length-1){const a=bearing(path.coordinates[i-1],point),b=bearing(point,path.coordinates[i+1]);if(Math.abs(((b-a+540)%360)-180)>135)throw Error('Impossible busway reversal');}
  }
 }
}
