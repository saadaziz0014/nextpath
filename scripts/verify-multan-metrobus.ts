import {readFileSync} from 'node:fs';
import {verifyBusSource,type BusSourceSnapshot} from '../lib/bus/sourceQuality';
import {multanSourceWays} from '../lib/bus/multanSource';
import {validateBusDataset} from '../lib/bus/track';
const source=JSON.parse(readFileSync('data/bus/multan-metrobus.osm.json','utf8')) as BusSourceSnapshot;
const data=validateBusDataset(JSON.parse(readFileSync('public/data/bus/multan-metrobus.json','utf8')),'multan-metrobus');
verifyBusSource(data,multanSourceWays(source));
console.log('Multan Metrobus: both directions, 21 ordered stations; every edge follows a sourced directional busway.');
