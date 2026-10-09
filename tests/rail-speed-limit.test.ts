import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {TRAINS,servicePath} from '../lib/rail/trains';
import {stepCruiseJourney} from '../lib/rail/cruise';
import {railSpeedLimitKmh} from '../lib/rail/physics';
import {restoreRailSave,type RailSave} from '../lib/rail/persistence';
import type {RailDataset} from '../lib/rail/types';
const data=JSON.parse(readFileSync('public/data/rail/ml1.json','utf8')) as RailDataset;

test('all rail services and explored corridors cap forward speed at 110, except KCR at 90',()=>{
 const paths=[...data.paths,...TRAINS.flatMap(train=>train.services.map(service=>servicePath(data,train,service)))];
 for(const path of paths){const cap=path.id==='kcr'?90:110;assert.equal(railSpeedLimitKmh(path.id),cap);
  const start={km:path.stations[0].km,velocity:cap/3.6};
  const accelerated=stepCruiseJourney(start,new Set(['w']),.1,path,new Set(),1,null);
  assert.equal(accelerated.motion.velocity,cap/3.6);assert.equal(accelerated.target,cap/3.6);
  const cruising=stepCruiseJourney(accelerated.motion,new Set(),.1,path,new Set(),1,accelerated.target);
  assert.equal(cruising.motion.velocity,cap/3.6);
  const excessive=stepCruiseJourney(start,new Set(),.1,path,new Set(),1,120/3.6);
  assert.equal(excessive.motion.velocity,cap/3.6);assert.equal(excessive.target,cap/3.6);
  const brake=stepCruiseJourney(cruising.motion,new Set(['s']),.1,path,new Set(),1,cruising.target);
  assert.ok(brake.motion.velocity<cap/3.6);assert.equal(brake.target,null);
  assert.equal(railSpeedLimitKmh(path.id,-1),20);
  const backing=stepCruiseJourney({km:start.km+.1,velocity:20/3.6},new Set(['w']),.1,path,new Set(),-1,null);
  assert.equal(backing.motion.velocity,20/3.6);assert.equal(backing.target,20/3.6);
 }
});

test('saves accept 110 km/h rail progress and cruise while KCR and backing retain their limits',()=>{
 for(const train of TRAINS)for(const service of train.services){const path=servicePath(data,train,service),cap=path.id==='kcr'?90:110;
  const value:RailSave={version:1,trainId:train.id,serviceId:service.id,branch:path.id,stationId:path.stations[0].id,reverse:false,km:path.stations[0].km+.01,velocity:cap/3.6,direction:1,departed:true,following:true,confirmed:[],lengthKm:path.distanceKm,cruise:cap/3.6};
  assert.deepEqual(restoreRailSave(JSON.stringify(value),data).value,value);
  assert.throws(()=>restoreRailSave(JSON.stringify({...value,velocity:(cap+1)/3.6}),data));
  assert.throws(()=>restoreRailSave(JSON.stringify({...value,cruise:(cap+1)/3.6}),data));
  assert.deepEqual(restoreRailSave(JSON.stringify({...value,direction:-1,velocity:20/3.6,cruise:20/3.6}),data).value.direction,-1);
  assert.throws(()=>restoreRailSave(JSON.stringify({...value,direction:-1,velocity:21/3.6,cruise:20/3.6}),data));
 }
});
