import fs from 'node:fs';
const query='[out:json][timeout:45];nwr["railway"="station"](33.55,73.0,33.65,73.1);out center tags;';
const response=await fetch('https://overpass.private.coffee/api/interpreter',{method:'POST',headers:{'User-Agent':'NextPathRailDataImporter/1.0'},body:new URLSearchParams({data:query}),signal:AbortSignal.timeout(90000)});
if(!response.ok)throw Error(`Overpass ${response.status}`);
const data=await response.json();if(!data.elements?.length)throw Error('Empty source response');fs.writeFileSync('data/rail/ml1-rawalpindi-stations.osm.json',JSON.stringify(data));console.log(data.elements.length,'station elements saved');

