import { writeFileSync } from 'node:fs';
import { MULTAN_BUSWAY_IDS, multanSourceWays } from '../lib/bus/multanSource';
import { MULTAN_STATION_SOURCES, buildMultanPaths } from '../lib/bus/multanImport';
import type { BusSourceSnapshot } from '../lib/bus/sourceQuality';
// Explicit maintenance tool; the browser never fetches OSM while driving.
async function main(){
const sources=[
 'https://api.openstreetmap.org/api/0.6/relation/10995086/full.json',
 'https://api.openstreetmap.org/api/0.6/map.json?bbox=71.46,30.225,71.515,30.28',
 'https://api.openstreetmap.org/api/0.6/map.json?bbox=71.46,30.195,71.51,30.23',
 'https://api.openstreetmap.org/api/0.6/map.json?bbox=71.475,30.165,71.54,30.20',
 'https://api.openstreetmap.org/api/0.6/map.json?bbox=71.51,30.195,71.535,30.215',
];
const elements=new Map<string,BusSourceSnapshot['elements'][number]>();
// Sequential API reads respect the public service's concurrency limits.
for(const url of sources){
 const response=await fetch(url,{headers:{'User-Agent':'NextPathMultanMetrobusImporter/1.0'},signal:AbortSignal.timeout(60000)});
 if(!response.ok)throw Error('OSM source request failed: '+response.status);
 const snapshot=await response.json() as Pick<BusSourceSnapshot,'elements'>;
 for(const element of snapshot.elements)elements.set(element.type+'/'+element.id,element);
}
const ways=MULTAN_BUSWAY_IDS.map(id=>elements.get('way/'+id));
if(ways.some(way=>!way?.nodes))throw Error('Incomplete Multan source busways');
const required=new Set(ways.flatMap(way=>way!.nodes!));
for(const [id] of MULTAN_STATION_SOURCES)required.add(id);
const snapshot={fetchedAt:new Date().toISOString(),sources,elements:[...elements.values()].filter(element=>element.type==='node'&&required.has(element.id)||element.type==='way'&&MULTAN_BUSWAY_IDS.some(id=>id===element.id)||element.type==='relation'&&element.id===10995086)};
// Validate before replacing the last usable source snapshot.
multanSourceWays(snapshot);buildMultanPaths(snapshot);
writeFileSync('data/bus/multan-metrobus.osm.json',JSON.stringify(snapshot));
console.log('Saved',snapshot.elements.length,'original Multan source objects');

}
main().catch(cause=>{console.error(cause);process.exitCode=1;});
