import { writeFileSync } from 'node:fs';

// Maintenance helper only: the application uses the bundled snapshots offline.
// Refresh deliberately, then run rail:import and rail:verify before shipping.
const endpoint = 'https://maps.mail.ru/osm/tools/overpass/api/interpreter';
async function snapshot(file, query) {
  const response = await fetch(`${endpoint}?data=${encodeURIComponent(query)}`, {
    headers: { 'User-Agent': 'NextPathRailDataImporter/1.0', Accept: 'application/json' },
    signal: AbortSignal.timeout(130000),
  });
  if (!response.ok) throw new Error(`Overpass ${response.status}: ${file}`);
  const data = await response.json();
  if (!data.elements?.length || data.remark || !data.osm3s?.timestamp_osm_base) {
    throw new Error(data.remark ?? `Incomplete source: ${file}`);
  }
  writeFileSync(file, JSON.stringify(data));
  console.log(`${file}: ${data.elements.length} sourced elements`);
}
await snapshot('data/rail/millat-faisalabad-lalamusa.osm.json',
  '[out:json][timeout:100];(way["railway"="rail"](30.15,71.85,31.70,73.25);nwr["railway"~"station|halt"](30.15,71.85,31.70,73.25);way["railway"="rail"](31.60,72.50,32.85,74.15);nwr["railway"~"station|halt"](31.60,72.50,32.85,74.15););out body center geom;');
// Faisalabad's actual station footprint is railway=stop, not railway=station.
await snapshot('data/rail/millat-faisalabad-station.osm.json',
  '[out:json][timeout:60];way(1370365121);out body center geom;');
