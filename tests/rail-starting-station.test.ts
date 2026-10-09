import { distance } from '@turf/turf';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TRAINS, servicePath } from '../lib/rail/trains';
import { createRailDeparture } from '../lib/rail/departure';
import { sampleTrack } from '../lib/rail/track';
import type { RailDataset } from '../lib/rail/types';
const dataset = JSON.parse(readFileSync('public/data/rail/ml1.json','utf8')) as RailDataset;
test('Tezgam can depart Lahore toward Rawalpindi in Up and Karachi in Down', () => {
  const train=TRAINS.find(train=>train.id==='tezgam-express')!;
  for(const service of train.services) {
    const path=servicePath(dataset,train,service);
    const lahore=path.stations.find(station=>station.name==='Lahore Junction')!;
    const departure=createRailDeparture(path,lahore.id,false);
    assert.equal(departure.km,lahore.km);
    assert.ok(distance(sampleTrack(departure.track,departure.km).position,lahore.coordinate) < .000001);
    assert.ok(departure.km>0 && departure.km<path.distanceKm);
    const next=path.stations.find(station=>station.km>departure.km)!;
    assert.match(next.name,service.direction==='Up'?/Gujranwala/:/Raiwind/);
    assert.match(path.stations.at(-1)!.name,service.direction==='Up'?/Rawalpindi/:/Karachi/);
    assert.throws(()=>createRailDeparture(path,path.stations.at(-1)!.id,false));
  }
});
test('every Up and Down service supports an intermediate scheduled departure without reversing twice', () => {
  for(const train of TRAINS) for(const service of train.services) {
    const path=servicePath(dataset,train,service), station=path.stations[Math.floor(path.stations.length/2)];
    const departure=createRailDeparture(path,station.id,false);
    assert.equal(departure.km,station.km);
    assert.equal(departure.track.path.stations.at(-1)!.id,path.stations.at(-1)!.id);
    assert.ok(departure.track.lengthKm>departure.km);
  }
});
