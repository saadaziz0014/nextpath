import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {distance} from '@turf/turf';
import {BUS_NETWORKS} from '../lib/bus/networks';
import type {BusDataset,BusPath} from '../lib/bus/types';
import {validateBusDataset} from '../lib/bus/track';
import {verifyBusSource,busSourceWays,type BusSourceSnapshot} from '../lib/bus/sourceQuality';
import type {Coordinate} from '../lib/routeData';
const source=JSON.parse(readFileSync('data/bus/islamabad-metrobus.osm.json','utf8')) as BusSourceSnapshot;
const network=BUS_NETWORKS['islamabad-metrobus'];
const elements=new Map(source.elements.map(e=>[`${e.type}/${e.id}`,e]));
const relation=elements.get(`relation/${network.sourceRelation}`);if(relation?.tags?.route!=='bus'||!relation.members)throw Error('Missing Red Line route');
const ways=relation.members.filter(m=>m.type==='way').map(m=>elements.get(`way/${m.ref}`)!);
if(ways.some(w=>w?.tags?.highway!=='busway'||!w.nodes))throw Error('Missing source busway');
const point=(id:number):Coordinate=>{const n=elements.get(`node/${id}`);if(!Number.isFinite(n?.lat)||!Number.isFinite(n?.lon))throw Error('Missing Red Line road node');return [n!.lon!,n!.lat!];};
const aliases:Record<string,string>={'Liaqat Bagh':'Liaquat Bagh','Chandani Chowk':'Chandni Chowk','IJP':'IJP Road','Pothohar':'Potohar','Khayaban-i-Johar':'Khayaban-e-Johar','Faiz Ahmed Faiz':'Faiz Ahmad Faiz','Ibne Sina':'Ibn-e-Sina','Kachehri':'Katchery','Shaheed-i-Millat':'Shaheed-e-Millat','Secretariat':'Pak Secretariat'};
// The mapped platform ref runs in the opposite order to our default journey:
// ref 24 = Saddar, ref 1 = Pak Secretariat. Both lanes have platform nodes.
const platformNodes=source.elements.filter(n=>n.type==='node'&&n.tags?.highway==='bus_stop'&&Number(n.tags.ref)>=1&&Number(n.tags.ref)<=24);
const stationNodes=new Map(platformNodes.map(n=>[n.id,n]));
if(platformNodes.length!==48)throw Error('Expected 24 distinct platforms on each side');
for(const n of platformNodes){const name=(n.tags!['name:en']??n.tags!.name??'').replace(/Metro Bus /g,'').replace(/ Station$/,'').trim();if((aliases[name]??name)!==network.stations[24-Number(n.tags!.ref)])throw Error('Unexpected Red Line platform '+name);}
const graph=new Map<number,{id:number;km:number;tunnel:boolean}[]>();
function edge(a:number,b:number,tunnel:boolean){const list=graph.get(a)??[];list.push({id:b,km:distance(point(a),point(b)),tunnel});graph.set(a,list);}
for(const way of busSourceWays(source,network.sourceRelation)){const original=elements.get(`way/${way.wayId}`)!;const tunnel=!!original.tags?.tunnel&&original.tags.tunnel!=='no';for(let i=1;i<way.nodeIds!.length;i++){const a=way.nodeIds![i-1],b=way.nodeIds![i];if(way.oneway!=='-1')edge(a,b,tunnel);if(way.oneway!=='yes')edge(b,a,tunnel);}}
function route(start:number,finish:number){
 const cost=new Map([[start,0]]),prev=new Map<number,{id:number;tunnel:boolean}>(),open=new Set([start]);
 while(open.size){let at=-1,best=Infinity;for(const id of open)if(cost.get(id)!<best){at=id;best=cost.get(id)!;}open.delete(at);if(at===finish)break;
  for(const e of graph.get(at)??[])if(best+e.km<(cost.get(e.id)??Infinity)){cost.set(e.id,best+e.km);prev.set(e.id,{id:at,tunnel:e.tunnel});open.add(e.id);}}
 if(!cost.has(finish))return null;
 const ids=[finish],tunnels:boolean[]=[];while(ids.at(-1)!==start){const before=prev.get(ids.at(-1)!)!;tunnels.push(before.tunnel);ids.push(before.id);}ids.reverse();tunnels.reverse();return {ids,tunnels,km:cost.get(finish)!};
}
function build(direction:BusPath['direction']):BusPath {
 const north=direction==='pak-secretariat',expected=Array.from({length:24},(_,i)=>north?24-i:1+i);
 let chosen:NonNullable<ReturnType<typeof route>>|null=null;
 // Select a terminal-platform pair only if its entire directional path visits
 // all 24 platforms exactly once, in order. No proximity snapping across lanes.
 for(const start of platformNodes.filter(n=>Number(n.tags!.ref)===expected[0]))for(const finish of platformNodes.filter(n=>Number(n.tags!.ref)===expected.at(-1))){
  const candidate=route(start.id,finish.id);if(!candidate)continue;
  const refs=candidate.ids.filter(id=>stationNodes.has(id)).map(id=>Number(stationNodes.get(id)!.tags!.ref));
  if(refs.length===24&&refs.every((ref,i)=>ref===expected[i])&&(!chosen||candidate.km<chosen.km))chosen=candidate;
 }
 if(!chosen)throw Error('No connected directional route through all 24 platforms');
 const {ids,tunnels}=chosen,coordinates=ids.map(point),cumulative=[0];for(let i=1;i<ids.length;i++)cumulative.push(cumulative[i-1]+distance(coordinates[i-1],coordinates[i]));
 const stations=ids.flatMap((id,at)=>{const n=stationNodes.get(id);if(!n)return [];const ordinal=24-Number(n.tags!.ref);return [{id:`isb-${ordinal+1}`,name:network.stations[ordinal],coordinate:point(id),km:cumulative[at],sourceId:id,underground:!!(tunnels[at-1]||tunnels[at])}];});
 const sections:BusPath['sections']=[];for(let i=1;i<coordinates.length;i++){const underground=tunnels[i-1],section=sections.at(-1);if(!section||section.underground!==underground)sections.push({underground,coordinates:[coordinates[i-1],coordinates[i]]});else section.coordinates.push(coordinates[i]);}
 return {direction,destination:stations.at(-1)!.name,coordinates,distanceKm:cumulative.at(-1)!,stations,sections};
}
const paths=[build('pak-secretariat'),build('saddar')];
const dataset:BusDataset={version:1,id:network.id,fingerprint:createHash('sha256').update(JSON.stringify(paths)).digest('hex').slice(0,16),attribution:'© OpenStreetMap contributors, ODbL 1.0',sourceTimestamp:source.fetchedAt,paths};
validateBusDataset(dataset,network.id);verifyBusSource(dataset,busSourceWays(source,network.sourceRelation));
mkdirSync('public/data/bus',{recursive:true});writeFileSync('public/data/bus/islamabad-metrobus.json',JSON.stringify(dataset));console.log(paths.map(p=>({direction:p.direction,km:p.distanceKm,stations:p.stations.length,vertices:p.coordinates.length,underground:p.stations.filter(s=>s.underground).map(s=>s.name)})));
