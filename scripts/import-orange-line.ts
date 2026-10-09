import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { distance } from '@turf/turf';
import { verifyMetroSource } from '../lib/metro/sourceQuality';
import { validateMetroDataset } from '../lib/metro/track';
import { ORANGE_STATIONS, type MetroDataset, type MetroPath } from '../lib/metro/types';
import type { Coordinate } from '../lib/routeData';
interface Element { type: string; id: number; lat?: number; lon?: number; nodes?: number[]; geometry?: {lat:number;lon:number}[]; tags?: Record<string,string>; members?: {type:string;ref:number;role:string}[] }
const source = JSON.parse(readFileSync('data/metro/orange-line.osm.json','utf8')) as {osm3s:{timestamp_osm_base:string};elements:Element[]};
const elements = new Map(source.elements.map(element=>[`${element.type}/${element.id}`,element]));
const normalize=(name:string)=>name.toLowerCase().replace(/station|[.\s-]/g,'').replace('bund','band').replace('shalimar','shalamar');
function build(relationId:number,direction:MetroPath['direction']):MetroPath {
  const relation=elements.get(`relation/${relationId}`)!;
  if(relation?.tags?.route!=='subway'||relation.tags.ref!=='O')throw Error('Missing Orange Line route relation');
  const members=relation.members!;
  const stops=members.filter(member=>member.role==='stop').map(member=>elements.get(`node/${member.ref}`)!);
  const names=direction==='dera-gujran'?[...ORANGE_STATIONS]:[...ORANGE_STATIONS].reverse();
  if(stops.length!==26)throw Error('Orange Line must have 26 mapped platform stops');
  stops.forEach((stop,index)=>{if(!stop||normalize(stop.tags?.['name:en']??stop.tags?.name??'')!==normalize(names[index]))throw Error(`Unexpected platform ${index}: ${stop?.tags?.['name:en']}`);});
  const ways=members.filter(member=>member.type==='way'&&member.role==='').map(member=>elements.get(`way/${member.ref}`)!);
  if(ways.some(way=>way?.tags?.railway!=='subway'||!way.nodes||!way.geometry||way.nodes.length!==way.geometry.length))throw Error('Missing sourced metro way');
  const nodeIds:number[]=[],coordinates:Coordinate[]=[],tunnels:boolean[]=[];
  ways.forEach((way,index)=>{
    const ids=[...way.nodes!],points=way.geometry!.map(point=>[point.lon,point.lat] as Coordinate);
    // Relation order identifies the actual directional running track. Only join
    // shared OSM node IDs; no snapping between tracks or straight gap repair.
    const reverse=index===0 ? !ways[1].nodes!.includes(ids.at(-1)!) : ids.at(-1)===nodeIds.at(-1);
    if(reverse){ids.reverse();points.reverse();}
    if(index&&ids[0]!==nodeIds.at(-1))throw Error(`Disconnected Orange Line way ${way.id}`);
    nodeIds.push(...(index?ids.slice(1):ids));coordinates.push(...(index?points.slice(1):points));
    tunnels.push(...Array(points.length-(index?1:0)).fill(!!way.tags?.tunnel && way.tags.tunnel!=='no'));
  });
  const first=nodeIds.indexOf(stops[0].id),last=nodeIds.indexOf(stops.at(-1)!.id);
  if(first<0||last<=first)throw Error('Platforms not ordered on sourced running track');
  const route=coordinates.slice(first,last+1),routeIds=nodeIds.slice(first,last+1),routeTunnels=tunnels.slice(first,last+1);
  const cumulative=[0];for(let i=1;i<route.length;i++){const km=distance(route[i-1],route[i]);if(km<=0)throw Error('Duplicate metro track point');cumulative.push(cumulative[i-1]+km);}
  let previous=-1;
  const stations=stops.map((stop,index)=>{
    const at=routeIds.indexOf(stop.id);if(at<=previous)throw Error('Metro stop out of order');previous=at;
    const name=names[index],ordinal=ORANGE_STATIONS.indexOf(name);
    return {id:`ol-${ordinal+1}`,name,coordinate:route[at],km:cumulative[at],sourceId:stop.id,underground:name==='Anarkali'||name==='GPO'};
  });
  const sections:MetroPath['sections']=[];
  for(let i=1;i<route.length;i++) {
    const underground=routeTunnels[i];const section=sections.at(-1);
    if(!section||section.underground!==underground)sections.push({underground,coordinates:[route[i-1],route[i]]});else section.coordinates.push(route[i]);
  }
  return {direction,destination:names.at(-1)!,coordinates:route,distanceKm:cumulative.at(-1)!,stations,sections};
}
const paths=[build(11803500,'dera-gujran'),build(11803498,'ali-town')];
const dataset:MetroDataset={version:1,id:'lahore-orange',fingerprint:createHash('sha256').update(JSON.stringify(paths)).digest('hex').slice(0,16),attribution:'© OpenStreetMap contributors, ODbL 1.0',sourceTimestamp:source.osm3s.timestamp_osm_base,paths};
validateMetroDataset(dataset);
verifyMetroSource(dataset,source.elements.filter(element=>element.type==='way'&&element.tags?.railway==='subway'&&element.geometry).map(element=>element.geometry!.map(point=>[point.lon,point.lat] as Coordinate)));
mkdirSync('public/data/metro',{recursive:true});writeFileSync('public/data/metro/orange-line.json',JSON.stringify(dataset));
console.log(paths.map(path=>({direction:path.direction,km:path.distanceKm,stations:path.stations.length,vertices:path.coordinates.length}))); 

