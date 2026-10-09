import { writeFileSync } from 'node:fs';
const query = '[out:json][timeout:80];(way["railway"="rail"](31.5,74.1,32.65,75.1);nwr["railway"="station"](31.5,74.1,32.65,75.1););out body center geom;';
const response = await fetch('https://maps.mail.ru/osm/tools/overpass/api/interpreter', {method:'POST',body:new URLSearchParams({data:query}),signal:AbortSignal.timeout(110000)});
if(!response.ok) throw new Error(`Overpass ${response.status}`);
const data=await response.json(); if(!data.elements?.length) throw new Error('Empty rail source');
writeFileSync('data/rail/allama-iqbal-narowal-sialkot.osm.json',JSON.stringify(data));
console.log(`Saved ${data.elements.length} OSM elements`);
