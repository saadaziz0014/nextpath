import fs from 'node:fs';
const query='[out:json][timeout:60];(way["railway"="rail"](31.2,74.1,31.8,74.6);node["railway"="station"](31.2,74.1,31.8,74.6););out body geom;';
const response=await fetch('https://maps.mail.ru/osm/tools/overpass/api/interpreter',{method:'POST',headers:{'User-Agent':'NextPathRailDataImporter/1.0'},body:new URLSearchParams({data:query}),signal:AbortSignal.timeout(90000)});
if(!response.ok)throw Error(`Overpass ${response.status}`);
const data=await response.json();if(!data.elements?.length)throw Error('Empty source response');fs.writeFileSync('data/rail/ml1-lahore-corridor.osm.json',JSON.stringify(data));console.log(data.elements.length,'elements saved');


