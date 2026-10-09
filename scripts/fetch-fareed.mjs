import { writeFileSync } from 'node:fs';
const query = '[out:json][timeout:90];(way["railway"="rail"](30.0,72.6,31.35,74.55);nwr["railway"="station"](30.0,72.6,31.35,74.55);way["railway"="rail"](24.8,66.9,24.9,67.1);nwr["railway"="station"](24.8,66.9,24.9,67.1););out body center geom;';
const response = await fetch('https://maps.mail.ru/osm/tools/overpass/api/interpreter', { method:'POST',body:new URLSearchParams({data:query}),signal:AbortSignal.timeout(120000) });
if(!response.ok) throw new Error(`Overpass ${response.status}`);
const data=await response.json(); if(!data.elements?.length) throw new Error('Empty railway extract');
writeFileSync('data/rail/fareed-pakpattan-kasur.osm.json',JSON.stringify(data));
console.log(`Saved ${data.elements.length} OSM elements`);

