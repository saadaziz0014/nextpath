import {readFileSync} from 'node:fs';
import {validateBusDataset} from '../lib/bus/track';
import {verifyBusSource,busSourceWays,type BusSourceSnapshot} from '../lib/bus/sourceQuality';
const data=validateBusDataset(JSON.parse(readFileSync('public/data/bus/lahore-metrobus.json','utf8')));
const source=JSON.parse(readFileSync('data/bus/lahore-metrobus.osm.json','utf8')) as BusSourceSnapshot;
verifyBusSource(data,busSourceWays(source));
console.log('Verified both Metrobus directions, 27 ordered platforms each, original busway connectivity and one-way ramps.');
