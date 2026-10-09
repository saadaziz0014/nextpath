import {writeFileSync} from 'node:fs';
const response=await fetch('https://api.openstreetmap.org/api/0.6/relation/13911249/full.json',{headers:{'User-Agent':'NextPathMetrobusImporter/1.0'},signal:AbortSignal.timeout(60000)});
if(!response.ok)throw Error('OSM API '+response.status);const data=await response.json();
if(!data.elements?.some(e=>e.type==='relation'&&e.id===13911249))throw Error('Incomplete Red Line snapshot');
data.fetchedAt=new Date().toISOString();writeFileSync('data/bus/islamabad-metrobus.osm.json',JSON.stringify(data));console.log('Downloaded',data.elements.length,'Red Line source members');
