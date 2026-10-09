import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {distance} from '@turf/turf';
import {BUS_STATIONS,type BusDataset,type BusPath} from '../lib/bus/types';
import {validateBusDataset} from '../lib/bus/track';
import {verifyBusSource,busSourceWays} from '../lib/bus/sourceQuality';
import type {Coordinate} from '../lib/routeData';
interface Element {type:string;id:number;lat?:number;lon?:number;nodes?:number[];tags?:Record<string,string>;members?:{type:string;ref:number;role:string}[]}
const source=JSON.parse(readFileSync('data/bus/lahore-metrobus.osm.json','utf8')) as {fetchedAt:string;elements:Element[]};
const elements=new Map(source.elements.map(e=>[`${e.type}/${e.id}`,e]));
const relation=elements.get('relation/19984670');if(relation?.tags?.route!=='bus')throw Error('Missing Metrobus route');
const ways=relation.members!.filter(m=>m.type==='way').map(m=>elements.get(`way/${m.ref}`)!);
if(ways.some(w=>w?.tags?.highway!=='busway'||!w.nodes))throw Error('Missing dedicated busway');
const point=(id:number):Coordinate=>{const node=elements.get(`node/${id}`);if(!Number.isFinite(node?.lon)||!Number.isFinite(node?.lat))throw Error('Missing source node');return [node!.lon!,node!.lat!];};
const stations=relation.members!.filter(m=>m.type==='node').map(m=>elements.get(`node/${m.ref}`)!).filter(n=>n.tags?.highway==='bus_stop').sort((a,b)=>Number(a.tags!.ref)-Number(b.tags!.ref));
const aliases:Record<string,string>={'Bhatti Chowk':'Bhati Chowk','Katchery':'Katchehry','Ichara':'Ichhra','Qaddafi Stadium':'Gaddafi Stadium','Kalmah Chowk':'Kalma Chowk','Cordoba Square':'Qartaba Chowk','Dulu Khurd':'Dullu Khurd'};
if(stations.length!==27)throw Error('Metrobus must have 27 platforms');
stations.forEach((s,i)=>{const name=s.tags!['name:en'];if(Number(s.tags!.ref)!==i+1||(aliases[name]??name)!==BUS_STATIONS[i])throw Error('Unexpected Metrobus station '+name);});
const graph=new Map<number,{id:number;km:number;tunnel:boolean}[]>();
function edge(a:number,b:number,tunnel:boolean){const neighbours=graph.get(a)??[];neighbours.push({id:b,km:distance(point(a),point(b)),tunnel});graph.set(a,neighbours);}
// Retain shared OSM node connectivity and tagged one-way directions. Junction
// ramps and loops are not straight-line "repairs" of the station sequence.
for(const way of ways)for(let i=1;i<way.nodes!.length;i++){const a=way.nodes![i-1],b=way.nodes![i],tunnel=!!way.tags?.tunnel&&way.tags.tunnel!=='no';if(way.tags?.oneway!=='-1')edge(a,b,tunnel);if(way.tags?.oneway!=='yes')edge(b,a,tunnel);}
function build(direction:BusPath['direction']):BusPath{
 const stops=direction==='gajjumata'?stations:[...stations].reverse(),start=stops[0].id,finish=stops.at(-1)!.id;
 const cost=new Map([[start,0]]),previous=new Map<number,{id:number;tunnel:boolean}>(),open=new Set([start]);
 while(open.size){let at=-1,best=Infinity;for(const id of open){const km=cost.get(id)!;if(km<best){at=id;best=km;}}open.delete(at);if(at===finish)break;
  for(const e of graph.get(at)??[])if(best+e.km<(cost.get(e.id)??Infinity)){cost.set(e.id,best+e.km);previous.set(e.id,{id:at,tunnel:e.tunnel});open.add(e.id);}}
 if(!cost.has(finish))throw Error('Disconnected directional busway');
 const ids=[finish],tunnels:boolean[]=[];while(ids.at(-1)!==start){const prev=previous.get(ids.at(-1)!)!;tunnels.push(prev.tunnel);ids.push(prev.id);}ids.reverse();tunnels.reverse();
 const coordinates=ids.map(point),cumulative=[0];for(let i=1;i<ids.length;i++)cumulative.push(cumulative[i-1]+distance(coordinates[i-1],coordinates[i]));
 let last=-1;const platforms=stops.map(s=>{const at=ids.indexOf(s.id);if(at<=last)throw Error('Platform missing or out of order: '+s.tags!['name:en']);last=at;const ordinal=Number(s.tags!.ref)-1;return {id:`mb-${ordinal+1}`,name:BUS_STATIONS[ordinal],coordinate:point(s.id),km:cumulative[at],sourceId:s.id,underground:false};});
 const sections:BusPath['sections']=[];for(let i=1;i<coordinates.length;i++){const underground=tunnels[i-1],section=sections.at(-1);if(!section||section.underground!==underground)sections.push({underground,coordinates:[coordinates[i-1],coordinates[i]]});else section.coordinates.push(coordinates[i]);}
 return {direction,destination:platforms.at(-1)!.name,coordinates,distanceKm:cumulative.at(-1)!,stations:platforms,sections};
}
const paths=[build('gajjumata'),build('shahdara')];
const dataset:BusDataset={version:1,id:'lahore-metrobus',fingerprint:createHash('sha256').update(JSON.stringify(paths)).digest('hex').slice(0,16),attribution:'© OpenStreetMap contributors, ODbL 1.0',sourceTimestamp:source.fetchedAt,paths};
validateBusDataset(dataset);verifyBusSource(dataset,busSourceWays(source));
mkdirSync('public/data/bus',{recursive:true});writeFileSync('public/data/bus/lahore-metrobus.json',JSON.stringify(dataset));console.log(paths.map(p=>({direction:p.direction,km:p.distanceKm,stations:p.stations.length,vertices:p.coordinates.length})));
