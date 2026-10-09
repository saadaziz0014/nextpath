import{test}from'node:test';
import assert from'node:assert/strict';
import{readFileSync}from'node:fs';
import{distance}from'@turf/turf';
import{BUS_NETWORKS,busNetwork,ISLAMABAD_STATIONS}from'../lib/bus/networks';
import{validateBusDataset,indexBusTrack,sampleBusTrack}from'../lib/bus/track';
import{busSourceWays,verifyBusSource,type BusSourceSnapshot}from'../lib/bus/sourceQuality';
import{busDeparture,stepBus,toggleBusDoors,BUS_DWELL_SECONDS}from'../lib/bus/motion';
import{restoreBusSave,BUS_SAVE_KEY,type BusSave}from'../lib/bus/persistence';
import{BUS_MAX_KMH}from'../lib/bus/types';
const network=BUS_NETWORKS['islamabad-metrobus'];
const data=validateBusDataset(JSON.parse(readFileSync('public'+network.dataUrl,'utf8')),network.id);
const lahore=validateBusDataset(JSON.parse(readFileSync('public/data/bus/lahore-metrobus.json','utf8')),'lahore-metrobus');
const source=JSON.parse(readFileSync('data/bus/islamabad-metrobus.osm.json','utf8')) as BusSourceSnapshot;
const ways=busSourceWays(source,network.sourceRelation),noKeys=new Set<string>();

test('Red Line visits all 24 stations on separate sourced directional platforms and busways',()=>{
 verifyBusSource(data,ways);const [north,south]=data.paths;
 assert.deepEqual(north.stations.map(s=>s.name),ISLAMABAD_STATIONS);
 assert.deepEqual(south.stations.map(s=>s.name),[...ISLAMABAD_STATIONS].reverse());
 assert.notDeepEqual(north.coordinates,[...south.coordinates].reverse());
 const nodes=new Map(source.elements.filter(e=>e.type==='node').map(e=>[e.id,e]));
 for(const path of data.paths){const track=indexBusTrack(path);for(const station of path.stations){const original=nodes.get(station.sourceId)!;assert.deepEqual(station.coordinate,[original.lon,original.lat]);assert.ok(distance(sampleBusTrack(track,station.km).position,station.coordinate)<.000001);}}
 for(const station of north.stations)assert.notEqual(station.sourceId,south.stations.find(s=>s.id===station.id)!.sourceId);
});

test('Secretariat correction only permits its shared source stem; loop direction and coordinates remain authoritative',()=>{
 const exceptions=ways.filter(w=>w.note);assert.equal(exceptions.length,1);assert.deepEqual(exceptions[0].nodeIds,[9182527131,5220454818]);assert.equal(exceptions[0].coordinates.length,2);
 const loop=ways.find(w=>w.wayId===993894344&&!w.note)!;assert.equal(loop.oneway,'yes');assert.equal(loop.nodeIds![0],loop.nodeIds!.at(-1));
 assert.throws(()=>verifyBusSource(data,ways.map(w=>w.note?{...w,oneway:'yes'}:w)));
 const changed=structuredClone(source);const changedNodes=changed.elements.find(e=>e.type==='way'&&e.id===993894344)!.nodes!;changedNodes[changedNodes.length-1]=9182527130;assert.throws(()=>busSourceWays(changed,network.sourceRelation),/Secretariat terminal source changed/);
 const raw=source.elements.find(e=>e.type==='way'&&e.id===993894344)!;assert.equal(raw.tags!.oneway,'yes');assert.equal(raw.nodes!.length,loop.nodeIds!.length+1);
});

test('Islamabad dataset validation rejects Lahore data, mixed directions, missing stops and off-corridor geometry',()=>{
 assert.throws(()=>validateBusDataset(lahore,network.id));assert.throws(()=>validateBusDataset(data,'lahore-metrobus'));assert.throws(()=>busNetwork('unknown'));
 const bad=structuredClone(data);bad.paths[0].stations.pop();assert.throws(()=>validateBusDataset(bad));
 const direction=structuredClone(data);direction.paths[0].direction='gajjumata';assert.throws(()=>validateBusDataset(direction));
 const gap=structuredClone(data);gap.paths[0].coordinates[20]=[73.1,33.75];assert.throws(()=>verifyBusSource(gap,ways));
});

test('all intermediate Red Line stations support departures in both directions, including PIMS and Faizabad',()=>{
 for(const path of data.paths){for(const [index,station]of path.stations.slice(0,-1).entries()){const state=busDeparture(path,station.id);assert.equal(state.km,station.km);assert.equal(state.nextStop,index+1);assert.equal(state.automatic,false);assert.ok(stepBus(state,new Set(['w']),.1,path).km>state.km);const open=toggleBusDoors(path,state);assert.equal(stepBus(open,new Set(['w']),.1,path).velocity,0);}assert.throws(()=>busDeparture(path,path.stations.at(-1)!.id));}
});

test('automatic Red Line completes both directions with every stop and a restorable terminal state',()=>{
 for(const path of data.paths){let state={...busDeparture(path,path.stations[0].id),automatic:true};const arrivals:string[]=[];
  for(let frame=0;frame<60000;frame++){const before=state;state=stepBus(state,noKeys,.1,path);assert.ok(state.km>=before.km);assert.ok(state.velocity<=BUS_MAX_KMH/3.6);
   if(state.doorsOpen&&!before.doorsOpen){arrivals.push(path.stations[state.nextStop-1].id);assert.equal(state.dwellSeconds,BUS_DWELL_SECONDS);assert.equal(state.velocity,0);}
   if(state.km===path.distanceKm)break;
  }
  assert.deepEqual(arrivals,path.stations.slice(1).map(s=>s.id));assert.equal(state.km,path.distanceKm);assert.equal(state.nextStop,24);assert.equal(state.velocity,0);
  const value:BusSave={version:1,fingerprint:data.fingerprint,direction:path.direction,stationId:path.stations[0].id,motion:state,following:true};assert.deepEqual(restoreBusSave(JSON.stringify(value),data).value.motion,state);
  const braking=stepBus({...busDeparture(path,path.stations[0].id),velocity:10,automatic:true},new Set(['s']),.1,path);assert.equal(braking.automatic,false);assert.ok(braking.velocity<10);
 }
});

test('city saves remain isolated and Red Line restoration uses its 24-station boundary',()=>{
 assert.equal(BUS_SAVE_KEY,BUS_NETWORKS['lahore-metrobus'].saveKey);assert.notEqual(network.saveKey,BUS_SAVE_KEY);assert.notEqual(network.saveKey,'nextpath:metro-orange:v1');assert.notEqual(network.saveKey,'nextpath:rail-journey:v1');
 for(const path of data.paths)for(const station of path.stations.slice(0,-1)){
  const value:BusSave={version:1,fingerprint:data.fingerprint,direction:path.direction,stationId:station.id,motion:busDeparture(path,station.id),following:true};
  assert.equal(restoreBusSave(JSON.stringify(value),data).value.stationId,station.id);
  assert.throws(()=>restoreBusSave(JSON.stringify(value),lahore));
  assert.throws(()=>restoreBusSave(JSON.stringify({...value,motion:{...value.motion,nextStop:25}}),data));
 }
});
