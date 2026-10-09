import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TRAINS, servicePath } from '../lib/rail/trains';
import { createRailDeparture } from '../lib/rail/departure';
import { confirmableReversal, stepRailJourney } from '../lib/rail/journey';
import { restoreRailSave, type RailSave } from '../lib/rail/persistence';
import type { RailDataset } from '../lib/rail/types';
const dataset=JSON.parse(readFileSync('public/data/rail/ml1.json','utf8')) as RailDataset;
test('Mohenjo Daro has 213 Up and 214 Down through all 24 published western Sindh stops',()=>{
  const train=TRAINS.find(train=>train.id==='mohenjo-daro-passenger')!;
  assert.deepEqual(train.services.map(service=>service.number),['213','214']);
  const [up,down]=train.services.map(service=>servicePath(dataset,train,service));
  assert.equal(up.stations.length,24);assert.equal(down.stations.length,24);
  assert.match(up.stations[0].name,/Kotri/);assert.match(up.stations.at(-1)!.name,/Rohri/);
  assert.deepEqual(down.stations.map(station=>station.id),up.stations.map(station=>station.id).reverse());
  const path=dataset.paths.find(path=>path.id===train.pathId)!;
  assert.ok(path.distanceKm>350 && path.distanceKm<500);
  for(const name of ['Sehwan Sharif','Dadu','Larkana','Mohenjo-daro','Habib Kot Junction','Sukkur']) assert.ok(path.stations.some(station=>station.name===name));
  assert.ok(!path.stations.some(station=>/Hyderabad|Nawabshah|Jacobabad/.test(station.name)));
});
test('both directions can start at Dadu, restore there and require stopped confirmation at Habib Kot',()=>{
  const train=TRAINS.find(train=>train.id==='mohenjo-daro-passenger')!;
  for(const service of train.services) {
    const path=servicePath(dataset,train,service),dadu=path.stations.find(station=>station.name==='Dadu')!;
    const departure=createRailDeparture(path,dadu.id,false);
    assert.equal(departure.km,dadu.km);
    const confirmed=new Set(path.reversals?.filter(stop=>stop.km<=dadu.km).map(stop=>stop.stationId));
    const value:RailSave={version:1,trainId:train.id,serviceId:service.id,branch:train.pathId,stationId:dadu.id,reverse:false,km:dadu.km,velocity:0,direction:1,departed:false,following:true,confirmed:[...confirmed],lengthKm:departure.track.lengthKm};
    assert.equal(restoreRailSave(JSON.stringify(value),dataset).departure.stationId,dadu.id);
    const boundary=path.reversals![0];
    assert.equal(boundary.stationId,path.stations.find(station=>/^Habib Kot/.test(station.name))!.id);
    const stopped=stepRailJourney({km:boundary.km-.0001,velocity:25},new Set(['w']),.1,path,new Set());
    assert.deepEqual(stopped,{km:boundary.km,velocity:0});
    assert.ok(confirmableReversal(path,stopped,new Set()));
    assert.deepEqual(stepRailJourney(stopped,new Set(['w']),.1,path,new Set()),stopped);
    assert.ok(stepRailJourney(stopped,new Set(['w']),.1,path,new Set([boundary.stationId])).km>boundary.km);
  }
});
