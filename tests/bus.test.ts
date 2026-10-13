import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {distance} from '@turf/turf';
import {validateBusDataset,indexBusTrack,sampleBusTrack} from '../lib/bus/track';
import {verifyBusSource,busSourceWays,type BusSourceSnapshot} from '../lib/bus/sourceQuality';
import {BUS_MAX_KMH} from '../lib/bus/types';
import {busDeparture,stepBus,toggleBusDoors,BUS_DWELL_SECONDS} from '../lib/bus/motion';
import {restoreBusSave,BUS_SAVE_KEY,type BusSave} from '../lib/bus/persistence';
import {articulatedBus,busSectionSvg} from '../lib/bus/vehicle';
import DoubleBusIcon from '../app/components/DoubleBusIcon';
import {busProfile,BusAudio} from '../lib/audio/bus';
import {audioHarness} from './helpers/audioHarness';
const data=validateBusDataset(JSON.parse(readFileSync('public/data/bus/lahore-metrobus.json','utf8')));
const source=JSON.parse(readFileSync('data/bus/lahore-metrobus.osm.json','utf8')) as BusSourceSnapshot;
const ways=busSourceWays(source);
const noKeys=new Set<string>();

test('Metrobus uses 27 ordered stations and actual directional busways, including different one-way ramps',()=>{
 verifyBusSource(data,ways);
 assert.deepEqual(data.paths[0].stations.map(s=>s.id),data.paths[1].stations.map(s=>s.id).reverse());
 assert.notDeepEqual(data.paths[0].coordinates,[...data.paths[1].coordinates].reverse());
 for(const path of data.paths){const track=indexBusTrack(path);for(const station of path.stations)assert.ok(distance(sampleBusTrack(track,station.km).position,station.coordinate)<.000001);}
 // Removing the sourced one-way roads cannot quietly fall back to a gap bridge.
 assert.throws(()=>verifyBusSource(data,ways.filter(w=>w.oneway!=='yes')));
 assert.throws(()=>verifyBusSource(data,ways.map(w=>({...w,oneway:w.oneway==='yes'?'-1':w.oneway}))));
});

test('every intermediate Metrobus station can be a manual departure in either direction',()=>{
 for(const path of data.paths){for(const [index,station] of path.stations.slice(0,-1).entries()){
  const departure=busDeparture(path,station.id);assert.equal(departure.km,station.km);assert.equal(departure.nextStop,index+1);assert.equal(departure.automatic,false);assert.equal(departure.velocity,0);
  const moved=stepBus(departure,new Set(['w']),.1,path);assert.ok(moved.km>departure.km);
 }assert.throws(()=>busDeparture(path,path.stations.at(-1)!.id));assert.throws(()=>busDeparture(path,'unknown'));}
});

test('manual bus speed is capped, brake wins over accelerator, doors interlock, and background gaps do not teleport',()=>{
 const path=data.paths[0],origin=busDeparture(path,'mb-1');let state=origin;
 for(let i=0;i<600;i++)state=stepBus(state,new Set(['w']),.1,path);
 assert.equal(state.velocity,BUS_MAX_KMH/3.6);
 assert.ok(stepBus(state,new Set(['w','s']),.1,path).velocity<state.velocity);
 assert.ok(stepBus(state,noKeys,.1,path).velocity<state.velocity);
 const open=toggleBusDoors(path,origin);assert.equal(open.doorsOpen,true);assert.equal(stepBus(open,new Set(['w']),.1,path).km,origin.km);
 assert.equal(toggleBusDoors(path,{...origin,velocity:1}).doorsOpen,false);
 assert.equal(toggleBusDoors(path,{...origin,km:.1}).doorsOpen,false);
 assert.deepEqual(stepBus(origin,new Set(['w']),100,path),stepBus(origin,new Set(['w']),.1,path));
 assert.deepEqual(stepBus(origin,new Set(['w']),NaN,path),origin);
 // Manual mode passes stations without being stopped by the auto-stops logic.
 const target=path.stations[1];state={...origin,km:target.km-.001,velocity:10};state=stepBus(state,new Set(['w']),.1,path);state=stepBus(state,new Set(['w']),.1,path);assert.ok(state.km>target.km);assert.equal(state.doorsOpen,false);
});

test('automatic bus trips stop at all platforms, dwell, and reach both terminals without getting stuck',()=>{
 for(const path of data.paths){let state={...busDeparture(path,path.stations[0].id),automatic:true};const stops:string[]=[];
  for(let frame=0;frame<60000;frame++){const before=state;state=stepBus(state,noKeys,.1,path);assert.ok(state.km>=before.km);assert.ok(state.velocity<=BUS_MAX_KMH/3.6);
   if(state.doorsOpen&&!before.doorsOpen){const station=path.stations[state.nextStop-1];stops.push(station.id);assert.equal(state.km,station.km);assert.equal(state.velocity,0);assert.equal(state.dwellSeconds,BUS_DWELL_SECONDS);}
   if(state.km===path.distanceKm)break;
  }
  assert.deepEqual(stops,path.stations.slice(1).map(s=>s.id));assert.equal(state.km,path.distanceKm);assert.equal(state.velocity,0);
  const manual=stepBus({...busDeparture(path,path.stations[0].id),velocity:10,automatic:true},new Set(['s']),.1,path);assert.equal(manual.automatic,false);assert.ok(manual.velocity<10);
 }
});

test('Metrobus saves are isolated, support every starting station and reject invalid restored motion',()=>{
 assert.notEqual(BUS_SAVE_KEY,'nextpath:rail-journey:v1');assert.notEqual(BUS_SAVE_KEY,'nextpath:metro-orange:v1');
 for(const path of data.paths)for(const station of path.stations.slice(0,-1)){
  const m=toggleBusDoors(path,busDeparture(path,station.id));const value:BusSave={version:1,fingerprint:data.fingerprint,direction:path.direction,stationId:station.id,motion:m,following:true};
  assert.deepEqual(restoreBusSave(JSON.stringify(value),data).value.motion,m);
  for(const bad of [{...value,fingerprint:'old'},{...value,motion:{...m,velocity:20}},{...value,motion:{...m,km:-1}},{...value,motion:{...m,nextStop:27}},{...value,motion:{...m,dwellSeconds:13}}])assert.throws(()=>restoreBusSave(JSON.stringify(bad),data));
 }
 assert.throws(()=>restoreBusSave('null',data));assert.throws(()=>restoreBusSave('x'.repeat(8001),data));
});

test('articulated bus bodies remain on the corridor with close 9 metre spacing and different cab/rear silhouettes',()=>{
 const track=indexBusTrack(data.paths[0]);for(let km=.05;km<track.lengthKm;km+=.05){const bodies=articulatedBus(track,km);assert.equal(bodies.length,2);assert.ok(bodies.every(b=>b.visible));assert.ok(distance(bodies[0].position,bodies[1].position)<.00901);}
 assert.ok(busSectionSvg(0).includes('#e11d48'));assert.notEqual(busSectionSvg(0),busSectionSvg(1));assert.equal(articulatedBus(track,0)[1].visible,false);
});

test('bus sound has engine idle, gear changes, braking and mute behavior',()=>{
 const input={speedKmh:0,traction:false,braking:false,audible:true};assert.ok(busProfile(input).engineGain>0);assert.equal(busProfile(input).rollingGain,0);
 assert.ok(busProfile({...input,speedKmh:14}).engineHz>busProfile({...input,speedKmh:16}).engineHz);
 assert.ok(busProfile({...input,traction:true}).engineGain>busProfile(input).engineGain);
 assert.ok(busProfile({...input,braking:true}).engineGain<busProfile(input).engineGain);
 assert.equal(busProfile({...input,audible:false}).engineGain,0);
 assert.equal(busProfile({...input,speedKmh:50,audible:false}).rollingGain,0);
});

test('bus audio reuses one graph and disposes every source once',async()=>{
 const h=audioHarness(),audio=new BusAudio(h.context);await audio.start();const count=h.nodes.length;
 for(let i=0;i<60;i++)audio.update({speedKmh:i,traction:true,braking:false,audible:true});audio.horn();assert.equal(h.nodes.length,count);
 await audio.dispose();await audio.dispose();assert.equal(h.closes(),1);
 for(const node of h.nodes){assert.equal(node.disconnects,1);if(node.kind==='oscillator'||node.kind==='buffer-source'){assert.equal(node.starts,1);assert.equal(node.stops,1);}}
});

test('DoubleBusIcon renders an articulated two-section bus with custom and default sizes',()=>{
 const defaultIcon=DoubleBusIcon({});
 assert.equal(defaultIcon.type,'svg');
 assert.equal(defaultIcon.props.width,24);
 assert.equal(defaultIcon.props.viewBox,'0 0 24 24');
 const customIcon=DoubleBusIcon({size:23});
 assert.equal(customIcon.props.width,23);
 assert.equal(customIcon.props.height,23);
});
