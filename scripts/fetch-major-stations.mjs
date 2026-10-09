import fs from 'node:fs';
const query='[out:json][timeout:45];nwr["railway"="station"]["name:en"~"^(Bahawalpur|Rohri|Wazirabad)",i](24,66,35,75);out center tags;';
const response=await fetch('https://maps.mail.ru/osm/tools/overpass/api/interpreter',{method:'POST',headers:{'User-Agent':'NextPathRailDataImporter/1.0'},body:new URLSearchParams({data:query}),signal:AbortSignal.timeout(70000)});
if(!response.ok)throw Error(`Overpass ${response.status}`);
const data=await response.json();if(!data.elements?.length)throw Error('Empty source response');fs.writeFileSync('data/rail/ml1-major-stations.osm.json',JSON.stringify(data));console.log(data.elements.length,'major station elements saved');
