import {writeFileSync} from 'node:fs';
for (const [name,bbox] of [['bolan','29.25,66.85,30.3,68.05'],['sibi-rohri','27.6,67.7,29.6,69.1']]) {
 const query=`[out:json][timeout:90];(way["railway"="rail"](${bbox});nwr["railway"="station"](${bbox}););out body center geom;`;
 const response=await fetch('https://maps.mail.ru/osm/tools/overpass/api/interpreter',{method:'POST',body:new URLSearchParams({data:query}),signal:AbortSignal.timeout(120000)});
 if(!response.ok) throw new Error(`${name}: ${response.status}`);
 const data=await response.json();if(!data.elements?.length||data.remark)throw new Error(JSON.stringify(data));
 writeFileSync(`data/rail/jaffar-${name}.osm.json`,JSON.stringify(data));console.log(name,data.elements.length);
}
