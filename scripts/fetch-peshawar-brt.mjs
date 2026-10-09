import {writeFileSync} from 'node:fs';
const urls=[
 'https://api.openstreetmap.org/api/0.6/relation/20012008/full.json',
 'https://api.openstreetmap.org/api/0.6/map.json?bbox=71.59,34.005,71.665,34.03',
 'https://api.openstreetmap.org/api/0.6/map.json?bbox=71.40,33.96,71.47,34.005',
];
const snapshots=await Promise.all(urls.map(async url=>{const response=await fetch(url,{headers:{'User-Agent':'NextPathPeshawarBrtImporter/1.0'},signal:AbortSignal.timeout(60000)});if(!response.ok)throw Error('OSM API '+response.status);return response.json();}));
const elements=new Map();
for(const source of snapshots)for(const element of source.elements){const key=element.type+'/'+element.id;if(!elements.has(key)||(element.version??0)>=(elements.get(key).version??0))elements.set(key,element);}
// SR-08 supplies the shared central busways, not the full SR-02 service.
// Map extracts supply the two outer corridor sections. Preserve source objects
// and metadata; never fabricate a route relation for SR-02.
const buildings=new Set([851309848,851314993,851318480,906013639,906013640,906013641,906519866,906519863,906519858,906519844]);
const selected=[...elements.values()].filter(e=>e.type==='way'&&(['busway','bus_guideway'].includes(e.tags?.highway)||buildings.has(e.id)));
const required=new Set(selected.flatMap(e=>e.nodes??[]));
const nodes=[...elements.values()].filter(e=>e.type==='node'&&(required.has(e.id)||e.tags?.highway==='bus_stop'&&Number(e.tags?.ref)>=7&&Number(e.tags?.ref)<=27&&e.tags?.bus==='yes'));
const data={fetchedAt:new Date().toISOString(),sources:urls,elements:[...nodes,...selected]};
for(const way of selected)if(way.nodes.some(id=>!nodes.some(n=>n.id===id)))throw Error('Incomplete source way '+way.id);
writeFileSync('data/bus/peshawar-brt.osm.json',JSON.stringify(data));
console.log('Saved',data.elements.length,'Peshawar source objects');
