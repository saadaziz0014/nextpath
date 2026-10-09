import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {distance} from '@turf/turf';
import {BUS_NETWORKS,MULTAN_STATIONS,busNetwork} from '../lib/bus/networks';
import {buildMultanPaths,MULTAN_STATION_SOURCES} from '../lib/bus/multanImport';
import {multanSourceWays,MULTAN_BUSWAY_IDS} from '../lib/bus/multanSource';
import {verifyBusSource,type BusSourceSnapshot} from '../lib/bus/sourceQuality';
import {validateBusDataset,indexBusTrack,sampleBusTrack} from '../lib/bus/track';
import {busDeparture,stepBus,toggleBusDoors} from '../lib/bus/motion';
import {restoreBusSave,type BusSave} from '../lib/bus/persistence';
const network=BUS_NETWORKS['multan-metrobus'];
const data=validateBusDataset(JSON.parse(readFileSync('public'+network.dataUrl,'utf8')),network.id);
const source=JSON.parse(readFileSync('data/bus/multan-metrobus.osm.json','utf8')) as BusSourceSnapshot;
const ways=multanSourceWays(source);

test('Multan Red Line contains all 21 stations, directed busways and on-track stopping positions',()=>{
 assert.equal(busNetwork(network.id),network);assert.equal(data.paths.length,2);
 assert.deepEqual(data.paths[0].stations.map(station=>station.name),MULTAN_STATIONS);
 assert.deepEqual(data.paths[1].stations.map(station=>station.name),[...MULTAN_STATIONS].reverse());
 assert.notDeepEqual(data.paths[0].coordinates.toReversed(),data.paths[1].coordinates);
 verifyBusSource(data,ways);
 const elements=new Map(source.elements.map(element=>[element.type+'/'+element.id,element]));
 for(const path of data.paths){assert.ok(path.distanceKm>18&&path.distanceKm<19);const track=indexBusTrack(path);
  for(const station of path.stations){const ordinal=MULTAN_STATIONS.indexOf(station.name as typeof MULTAN_STATIONS[number]);
   assert.equal(station.sourceId,MULTAN_STATION_SOURCES[ordinal][0]);const node=elements.get('node/'+station.sourceId)!;
   assert.ok(distance([node.lon!,node.lat!],station.coordinate)<=.035);
   assert.ok(distance(station.coordinate,sampleBusTrack(track,station.km).position)<.000001);
  }
 }
});

test('Multan imports deterministically and rejects absent or distant station sources',()=>{
 assert.deepEqual(buildMultanPaths(source),data.paths);
 const missing=structuredClone(source);missing.elements=missing.elements.filter(element=>element.id!==8365794872);
 assert.throws(()=>buildMultanPaths(missing),/Missing Multan station/);
 const offTrack=structuredClone(source);offTrack.elements.find(element=>element.id===8365794872)!.lon=71.525;
 assert.throws(()=>buildMultanPaths(offTrack),/off the busway/);
});

test('Multan legacy lane interpretations remain narrow and preserve one-way travel',()=>{
 assert.equal(ways.length,16);assert.equal(new Set(ways.map(way=>way.wayId)).size,MULTAN_BUSWAY_IDS.length);
 const missing=structuredClone(source);missing.elements=missing.elements.filter(element=>element.id!==1203557181);
 assert.throws(()=>buildMultanPaths(missing),/Missing dedicated Multan busway/);
 const bridge=structuredClone(source);bridge.elements.find(element=>element.id===1203515975)!.nodes![0]=7401594139;
 assert.throws(()=>multanSourceWays(bridge),/Missing dedicated Multan busway/);
 const ordinary=structuredClone(source);ordinary.elements.find(element=>element.id===1203557181)!.tags!.highway='primary';
 assert.throws(()=>multanSourceWays(ordinary),/Missing dedicated Multan busway/);
 assert.throws(()=>verifyBusSource(data,ways.map(way=>way.wayId===1203557181?{...way,oneway:'-1'}:way)),/edge missing/);
});

test('every eligible Multan start supports manual traction, braking and platform door interlocks',()=>{
 for(const path of data.paths){for(const [index,station] of path.stations.slice(0,-1).entries()){
  const state=busDeparture(path,station.id);assert.equal(state.km,station.km);assert.equal(state.nextStop,index+1);
  assert.ok(stepBus(state,new Set(['w']),.1,path).km>state.km);
  const open=toggleBusDoors(path,state);assert.equal(stepBus(open,new Set(['w']),.1,path).velocity,0);
  assert.ok(stepBus({...state,velocity:10},new Set(['w','s']),.1,path).velocity<10);
 }assert.throws(()=>busDeparture(path,path.stations.at(-1)!.id));}
});

test('Multan saves restore all starting stations and cannot replace another city journey',()=>{
 assert.equal(new Set(Object.values(BUS_NETWORKS).map(item=>item.saveKey)).size,4);
 const other=validateBusDataset(JSON.parse(readFileSync('public/data/bus/lahore-metrobus.json','utf8')));
 for(const path of data.paths)for(const station of path.stations.slice(0,-1)){
  const value:BusSave={version:1,fingerprint:data.fingerprint,direction:path.direction,stationId:station.id,motion:busDeparture(path,station.id),following:true};
  assert.deepEqual(restoreBusSave(JSON.stringify(value),data).value,value);
  assert.throws(()=>restoreBusSave(JSON.stringify(value),other));
 }
 assert.throws(()=>validateBusDataset(data,'peshawar-brt'));
});

test('Multan dataset rejects missing stations, wrong city geometry and invented corridor shortcuts',()=>{
 const missing=structuredClone(data);missing.paths[0].stations.splice(4,1);assert.throws(()=>validateBusDataset(missing),/Missing bus stations/);
 const elsewhere=structuredClone(data);elsewhere.paths[0].coordinates[3]=[74.3,31.5];assert.throws(()=>validateBusDataset(elsewhere),/Invalid bus track/);
 const shortcut=structuredClone(data);shortcut.paths[0].coordinates.splice(10,1);
 // Keep chainage valid so source geometry verification checks the shortcut,
 // instead of just catching a stale route-length field.
 const path=shortcut.paths[0];const track=indexBusTrack(path);path.distanceKm=track.lengthKm;
 for(const station of path.stations){const at=path.coordinates.findIndex(p=>p[0]===station.coordinate[0]&&p[1]===station.coordinate[1]);assert.ok(at>=0);station.km=track.cumulative[at];}
 path.sections=[{underground:false,coordinates:path.coordinates}];
 assert.throws(()=>verifyBusSource(shortcut,ways),/edge missing/);
});
