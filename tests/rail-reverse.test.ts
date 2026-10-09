import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stepTrain } from '../lib/rail/physics';
import { stepRailJourney } from '../lib/rail/journey';
import type { RailPath } from '../lib/rail/types';
test('backing retraces chainage, caps at 20 km/h and brakes without changing direction', () => {
  let state = { km: 10, velocity: 0 };
  for (let i=0;i<300;i++) state=stepTrain(state,new Set(['w']),.1,100,-1);
  assert.ok(state.km<10); assert.equal(state.velocity*3.6,20);
  for (let i=0;i<100;i++) state=stepTrain(state,new Set(['s']),.1,100,-1);
  assert.equal(state.velocity,0);
  assert.deepEqual(stepTrain(state,new Set(['s']),.1,100,-1),state);
  assert.deepEqual(stepTrain({km:.00001,velocity:5},new Set(['w']),.1,100,-1),{km:0,velocity:0});
});
test('backing cannot cross a physical station reversal, including confirmed reversals', () => {
  const path = { distanceKm: 100, reversals: [{stationId:'kasur',km:5}] } as RailPath;
  const confirmed = new Set(['kasur']);
  const state=stepRailJourney({km:5.00001,velocity:5},new Set(['w']),.1,path,confirmed,-1);
  assert.deepEqual(state,{km:5,velocity:0});
  assert.deepEqual(stepRailJourney(state,new Set(['w']),.1,path,confirmed,-1),state);
  assert.ok(stepRailJourney(state,new Set(['w']),.1,path,confirmed).km>5);
});
