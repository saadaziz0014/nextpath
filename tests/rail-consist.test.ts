import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { sampleConsist, COACH_SPACING_KM } from '../lib/rail/consist';
import { indexTrack, sampleTrack, reversePath } from '../lib/rail/track';
import type { RailPath, RailDataset } from '../lib/rail/types';
const path: RailPath = { id:'tezgam',name:'Curved rail',coordinates:[[74,31],[74,31.01],[74.01,31.01]],stations:[],distanceKm:2.1 };
test('ten coaches follow a bend independently behind the locomotive', () => {
  const track=indexTrack(path),head=track.cumulative[1]+.06;
  const cars=sampleConsist(track,head);
  assert.equal(cars.length,11); assert.ok(cars.every(car=>car.visible));
  cars.forEach((car,index)=>assert.deepEqual(car.position,sampleTrack(track,head-index*COACH_SPACING_KM).position));
  assert.ok(Math.abs(cars[0].heading-cars[10].heading)>45);
});
test('backing preserves coach order and Down follows reversed track geometry', () => {
  for(const track of [indexTrack(path),indexTrack(reversePath(path))]) {
    const before=sampleConsist(track,.5),after=sampleConsist(track,.4);
    after.forEach((car,index)=>{
      assert.deepEqual(car.position,sampleTrack(track,.4-index*COACH_SPACING_KM).position);
      assert.notDeepEqual(car.position,before[index].position);
    });
  }
});
test('route boundaries clip coaches without stacking them or extrapolating off track', () => {
  const track=indexTrack(path);
  const start=sampleConsist(track,0);
  assert.equal(start.filter(car=>car.visible).length,1);
  const leaving=sampleConsist(track,COACH_SPACING_KM*3+.000001);
  assert.equal(leaving.filter(car=>car.visible).length,4);
  assert.ok(sampleConsist(track,track.lengthKm).every(car=>car.visible));
});

test('all ten coaches stay on the bundled Awam and KCR corridors in both directions', () => {
  const dataset = JSON.parse(readFileSync('public/data/rail/ml1.json', 'utf8')) as RailDataset;
  for (const id of ['awam', 'kcr']) {
    const route = dataset.paths.find(route => route.id === id);
    assert.ok(route, `Missing bundled ${id} corridor`);
    for (const directed of [route, reversePath(route)]) {
      const track = indexTrack(directed);
      for (const head of [track.lengthKm / 2, track.lengthKm]) {
        const cars = sampleConsist(track, head);
        assert.equal(cars.length, 11);
        assert.ok(cars.every(car => car.visible));
        assert.equal(new Set(cars.map(car => car.position.join(','))).size, 11);
        cars.forEach((car, index) => assert.deepEqual(car.position, sampleTrack(track, head - index * COACH_SPACING_KM).position));
      }
      assert.equal(sampleConsist(track, 0).filter(car => car.visible).length, 1);
    }
  }
});
