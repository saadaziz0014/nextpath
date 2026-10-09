import { mkdirSync,writeFileSync } from 'node:fs';
// Refresh the relation and all of its exact node/way members via the OSM API.
const response=await fetch('https://api.openstreetmap.org/api/0.6/relation/19984670/full.json',{headers:{'User-Agent':'NextPathMetrobusImporter/1.0'},signal:AbortSignal.timeout(60000)});
if(!response.ok)throw Error('OSM API '+response.status);const data=await response.json();
if(!data.elements?.some(e=>e.type==='relation'&&e.id===19984670))throw Error('Incomplete Metrobus snapshot');
data.fetchedAt=new Date().toISOString();mkdirSync('data/bus',{recursive:true});writeFileSync('data/bus/lahore-metrobus.osm.json',JSON.stringify(data));console.log('Downloaded',data.elements.length,'Metrobus members');
