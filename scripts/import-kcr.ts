import { readFileSync, writeFileSync, statSync } from 'node:fs';
import { buildKcrLocalPath, type KcrStationSnapshot } from '../lib/rail/kcrImport';
import { KCR_STATIONS_FILE } from '../lib/rail/sourceFiles';
import { validateRailDataset } from '../lib/rail/dataset';
import { TRAINS, servicePath } from '../lib/rail/trains';
import type { RailDataset } from '../lib/rail/types';

// Targeted offline import preserves all existing paths and their saved lengths.
// rail:import also builds this service during a complete source rebuild.
const file = 'public/data/rail/ml1.json';
const dataset = JSON.parse(readFileSync(file, 'utf8')) as RailDataset;
const corridor = dataset.paths.find(path => path.id === 'fareed');
if (!corridor) throw new Error('Build the Fareed ML-1 corridor before importing KCR.');
const snapshot = JSON.parse(readFileSync(KCR_STATIONS_FILE, 'utf8')) as KcrStationSnapshot;
const path = buildKcrLocalPath(corridor, snapshot);
dataset.paths = [...dataset.paths.filter(path => path.id !== 'kcr'), path];
dataset.sources = [...(dataset.sources ?? []).filter(source => source.file !== KCR_STATIONS_FILE), { file: KCR_STATIONS_FILE, sourceTimestamp: snapshot.osm3s.timestamp_osm_base }];
dataset.sourceTimestamp = dataset.sources.map(source => source.sourceTimestamp).sort()[0];
dataset.retrievedAt = new Date(Math.max(Date.parse(dataset.retrievedAt), statSync(KCR_STATIONS_FILE).mtimeMs)).toISOString();
const scope = 'KCR shorter Karachi City–Dhabeji local simulation with 11 mapped calls; ';
if (!dataset.coverage.startsWith(scope)) dataset.coverage = scope + dataset.coverage;
validateRailDataset(dataset);
for (const train of TRAINS) for (const service of train.services) servicePath(dataset, train, service);
writeFileSync(file, JSON.stringify(dataset));
console.log(JSON.stringify({ id: path.id, km: path.distanceKm, stations: path.stations.map(station => ({ name: station.name, km: station.km, offsetMeters: station.offsetMeters })) }, null, 2));
