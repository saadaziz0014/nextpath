import {readFileSync} from 'node:fs';
import {busSourceWays,verifyBusSource,type BusSourceSnapshot} from '../lib/bus/sourceQuality';
import {validateBusDataset} from '../lib/bus/track';
const source=JSON.parse(readFileSync('data/bus/peshawar-brt.osm.json','utf8')) as BusSourceSnapshot;
const data=validateBusDataset(JSON.parse(readFileSync('public/data/bus/peshawar-brt.json','utf8')),'peshawar-brt');
verifyBusSource(data,busSourceWays(source,null));
console.log('Peshawar BRT: both directions, 30 ordered stations; every edge follows a sourced directional busway.');
