import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {distance} from '@turf/turf';
import {BUS_NETWORKS,PESHAWAR_STATIONS,busNetwork} from '../lib/bus/networks';
import {buildPeshawarPaths,PESHAWAR_FOOTPRINTS} from '../lib/bus/peshawarImport';
import {busSourceWays,verifyBusSource,type BusSourceSnapshot} from '../lib/bus/sourceQuality';
import {validateBusDataset,indexBusTrack,sampleBusTrack} from '../lib/bus/track';
import {busDeparture,stepBus,toggleBusDoors,toggleBusAutomatic,BUS_DWELL_SECONDS} from '../lib/bus/motion';
import {restoreBusSave,type BusSave} from '../lib/bus/persistence';
import {busSectionSvg} from '../lib/bus/vehicle';
import {BUS_MAX_KMH} from '../lib/bus/types';
const network=BUS_NETWORKS['peshawar-brt'];
const data=validateBusDataset(JSON.parse(readFileSync('public'+network.dataUrl,'utf8')),network.id);
const source=JSON.parse(readFileSync('data/bus/peshawar-brt.osm.json','utf8')) as BusSourceSnapshot;
const ways=busSourceWays(source,null);

test('Peshawar SR-02 has 30 sourced stops in both directions, including all outer station footprints',()=>{
 assert.equal(busNetwork(network.id),network);
 assert.deepEqual(data.paths[0].stations.map(station=>station.name),PESHAWAR_STATIONS);
 assert.deepEqual(data.paths[1].stations.map(station=>station.name),[...PESHAWAR_STATIONS].reverse());
 assert.notDeepEqual(data.paths[0].coordinates.toReversed(),data.paths[1].coordinates);
 verifyBusSource(data,ways);
 assert.ok(data.paths.every(path=>path.distanceKm>26&&path.distanceKm<28));
 const elements=new Map(source.elements.map(element=>[`${element.type}/${element.id}`,element]));
 for(const path of data.paths){const track=indexBusTrack(path);for(const station of path.stations){
  assert.ok(distance(station.coordinate,sampleBusTrack(track,station.km).position)<.000001);
  const ordinal=PESHAWAR_STATIONS.indexOf(station.name as typeof PESHAWAR_STATIONS[number]);
  const footprint=PESHAWAR_FOOTPRINTS[ordinal];
  if(footprint){assert.equal(station.sourceId,footprint);const polygon=elements.get(`way/${footprint}`)!.nodes!.map(id=>elements.get(`node/${id}`)!);const centre:[number,number]=[(Math.min(...polygon.map(p=>p.lon!))+Math.max(...polygon.map(p=>p.lon!)))/2,(Math.min(...polygon.map(p=>p.lat!))+Math.max(...polygon.map(p=>p.lat!)))/2];assert.ok(distance(centre,station.coordinate)<.035);}
  else{const platform=elements.get(`node/${station.sourceId}`)!;assert.deepEqual(station.coordinate,[platform.lon,platform.lat]);}
 }
 assert.ok(path.sections.some(section=>section.underground));}
});

test('Peshawar import is deterministic, rejects missing stations and uses the legacy dedicated busway in its correct direction',()=>{
 assert.deepEqual(buildPeshawarPaths(source),data.paths);
 const missing=structuredClone(source);missing.elements=missing.elements.filter(element=>element.id!==906519863);
 assert.throws(()=>buildPeshawarPaths(missing),/footprint/);
 const disconnected=structuredClone(source);disconnected.elements=disconnected.elements.filter(element=>element.id!==906392649);
 assert.throws(()=>buildPeshawarPaths(disconnected),/Disconnected/);
 const legacy=source.elements.find(element=>element.id===906392649)!;
 assert.equal(legacy.tags!.highway,'bus_guideway');assert.equal(legacy.tags!.oneway,'yes');
 // Reversing this source segment must reject the generated forward journey,
 // including its projected station subedges; no bidirectional workaround.
 assert.throws(()=>verifyBusSource(data,ways.map(way=>way.wayId===legacy.id?{...way,oneway:'-1'}:way)),/edge missing/);
});

test('all Peshawar intermediate starts are drivable with manual brakes and door interlocks',()=>{
 for(const path of data.paths){for(const [index,station] of path.stations.slice(0,-1).entries()){
  const state=busDeparture(path,station.id);assert.equal(state.km,station.km);assert.equal(state.nextStop,index+1);
  const moving=stepBus(state,new Set(['w']),.1,path);assert.ok(moving.km>state.km);
  const open=toggleBusDoors(path,state);assert.equal(stepBus(open,new Set(['w']),.1,path).velocity,0);
  const braking=stepBus({...state,velocity:10},new Set(['w','s']),.1,path);assert.ok(braking.velocity<10);
 }assert.throws(()=>busDeparture(path,path.stations.at(-1)!.id));}
});

test('Peshawar automatic trips board once at all 30 stations and complete in both directions',()=>{
 for(const path of data.paths){let state=toggleBusAutomatic(path,busDeparture(path,path.stations[0].id));const arrivals:string[]=[];
  for(let frame=0;frame<60000;frame++){const before=state;state=stepBus(state,new Set(),.1,path);assert.ok(state.km>=before.km);assert.ok(state.velocity<=BUS_MAX_KMH/3.6);
   if(state.doorsOpen&&!before.doorsOpen){arrivals.push(path.stations[state.nextStop-1].id);assert.equal(state.velocity,0);assert.equal(state.dwellSeconds,BUS_DWELL_SECONDS);}
   if(state.km===path.distanceKm)break;
  }
  assert.deepEqual(arrivals,path.stations.slice(1).map(station=>station.id));assert.equal(state.km,path.distanceKm);assert.equal(state.velocity,0);assert.equal(state.doorsOpen,true);
  const value:BusSave={version:1,fingerprint:data.fingerprint,direction:path.direction,stationId:path.stations[0].id,motion:state,following:true};assert.deepEqual(restoreBusSave(JSON.stringify(value),data).value.motion,state);
 }
});

test('Peshawar saves remain isolated and restore every starting station in both directions',()=>{
 assert.equal(new Set(Object.values(BUS_NETWORKS).map(item=>item.saveKey)).size,4);
 const other=validateBusDataset(JSON.parse(readFileSync('public/data/bus/islamabad-metrobus.json','utf8')));
 for(const path of data.paths)for(const station of path.stations.slice(0,-1)){
  const value:BusSave={version:1,fingerprint:data.fingerprint,direction:path.direction,stationId:station.id,motion:busDeparture(path,station.id),following:true};
  assert.equal(restoreBusSave(JSON.stringify(value),data).value.stationId,station.id);
  assert.throws(()=>restoreBusSave(JSON.stringify(value),other));
  assert.throws(()=>restoreBusSave(JSON.stringify({...value,motion:{...value.motion,nextStop:31}}),data));
 }
 assert.throws(()=>validateBusDataset(data,'lahore-metrobus'));
});

test('Zu bus livery is green and existing cities keep their original red vehicles',()=>{
 assert.ok(busSectionSvg(0,network.colour,network.darkColour).includes('fill="#16a34a"'));
 assert.ok(busSectionSvg(1,network.colour,network.darkColour).includes('stroke="#14532d"'));
 assert.ok(busSectionSvg(0).includes('fill="#e11d48"'));
});
