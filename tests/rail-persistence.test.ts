import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { restoreRailSave, type RailSave } from '../lib/rail/persistence';
import { TRAINS, servicePath } from '../lib/rail/trains';
import { createRailDeparture } from '../lib/rail/departure';
import type { RailDataset } from '../lib/rail/types';
const dataset=JSON.parse(readFileSync('public/data/rail/ml1.json','utf8')) as RailDataset;
function save(direction:'Up'|'Down'):RailSave {
  const train=TRAINS.find(train=>train.id==='tezgam-express')!;
  const service=train.services.find(service=>service.direction===direction)!;
  const path=servicePath(dataset,train,service),station=path.stations.find(station=>station.name==='Lahore Junction')!;
  const departure=createRailDeparture(path,station.id,false);
  return {version:1,trainId:train.id,serviceId:service.id,branch:train.pathId,stationId:station.id,reverse:false,km:station.km+.5,velocity:10,direction:1,departed:true,following:true,confirmed:[],lengthKm:departure.track.lengthKm};
}
test('saved Tezgam Up and Down restore the same station, progress and directed route',()=>{
  for(const direction of ['Up','Down'] as const) {
    const value=save(direction),restored=restoreRailSave(JSON.stringify(value),dataset);
    assert.deepEqual(restored.value,value);
    assert.equal(restored.departure.stationId,value.stationId);
    assert.match(restored.departure.track.path.stations.at(-1)!.name,direction==='Up'?/Rawalpindi/:/Karachi/);
    assert.ok(restored.value.km>restored.departure.km);
  }
});
test('malformed, stale and out-of-route saves are rejected',()=>{
  const original=save('Up');
  for(const patch of [{version:2},{trainId:'unknown'},{serviceId:'unknown'},{branch:'awam'},{reverse:true},{stationId:'missing'},{km:-1},{km:9000},{velocity:100},{direction:0},{direction:-1,velocity:10},{lengthKm:original.lengthKm+1},{confirmed:['fake']}])
    assert.throws(()=>restoreRailSave(JSON.stringify({...original,...patch}),dataset));
  assert.throws(()=>restoreRailSave('invalid JSON',dataset));
  assert.throws(()=>restoreRailSave('null',dataset));
});
test('explore routes and backing restore without reversing a directed service twice',()=>{
  const value={...save('Down'),direction:-1 as const,velocity:4};
  assert.equal(restoreRailSave(JSON.stringify(value),dataset).value.direction,-1);
  const path=dataset.paths.find(path=>path.id==='chord')!;
  const departure=createRailDeparture(path,path.stations.at(-1)!.id,true);
  const explore={...value,serviceId:null,branch:path.id,stationId:departure.stationId,reverse:true,km:.2,velocity:0,lengthKm:departure.track.lengthKm};
  assert.equal(restoreRailSave(JSON.stringify(explore),dataset).departure.reverse,true);
});

test('cruise target persists with progress and invalid saved targets are rejected',()=>{
  const value={...save('Up'),cruise:30/3.6};
  assert.equal(restoreRailSave(JSON.stringify(value),dataset).value.cruise,30/3.6);
  for(const cruise of [-1,0,100,'30']) assert.throws(()=>restoreRailSave(JSON.stringify({...value,cruise}),dataset));
  assert.throws(()=>restoreRailSave(JSON.stringify({...value,direction:-1,velocity:4,cruise:30/3.6}),dataset));
});
