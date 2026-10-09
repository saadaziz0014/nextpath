import { writeFileSync } from 'node:fs';
// Refresh the exact two directional OSM Orange Line route relations and their
// members. This includes platform stop nodes even where their tags vary.
const query = '[out:json][timeout:100];(relation(11803500);relation(11803498););(._;>;);out body geom;';
const response = await fetch('https://maps.mail.ru/osm/tools/overpass/api/interpreter?data='+encodeURIComponent(query), { headers: { Accept:'application/json','User-Agent':'NextPathMetroImporter/1.0' }, signal:AbortSignal.timeout(130000) });
if(!response.ok)throw Error('Overpass '+response.status);
const data=await response.json();if(!data.elements?.length||data.remark||!data.osm3s?.timestamp_osm_base)throw Error(data.remark??'Incomplete metro data');
writeFileSync('data/metro/orange-line.osm.json',JSON.stringify(data));console.log('Downloaded',data.elements.length,'Orange Line relation members');
