import fs from 'node:fs';
fetch('https://overpass.private.coffee/api/interpreter',{method:'POST',headers:{'User-Agent':'NextPathRailDataImporter/1.0'},body:new URLSearchParams({data:'[out:json][timeout:60];nwr["railway"~"station|halt"](30.26,71.90,30.34,72.00);out center tags;'}),signal:AbortSignal.timeout(90000)}).then(r=>{if(!r.ok)throw Error(r.status);return r.text()}).then(t=>{fs.writeFileSync('data/rail/khanewal-stations.osm.json',t);console.log(t)});



