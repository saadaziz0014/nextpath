import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stepCruiseJourney } from '../lib/rail/cruise';
import { RAIL_MAX_KMH } from '../lib/rail/physics';
import type { RailPath } from '../lib/rail/types';
const path={distanceKm:100} as RailPath;
test('cruise holds 20 and 30 km/h after traction is released',()=>{
  for(const kmh of [20,30]) {
    let state={km:10,velocity:kmh/3.6};
    for(let i=0;i<1000;i++) {
      const result=stepCruiseJourney(state,new Set(),.1,path,new Set(),1,kmh/3.6);
      assert.equal(result.motion.velocity,kmh/3.6);state=result.motion;
    }
    assert.ok(state.km>10);
  }
});
test('speed-limit engagement holds on release and S cancels before braking',()=>{
  const speed=RAIL_MAX_KMH/3.6;
  const max=stepCruiseJourney({km:10,velocity:speed},new Set(['w']),.1,path,new Set(),1,null);
  assert.equal(max.target,speed);
  const held=stepCruiseJourney(max.motion,new Set(),.1,path,new Set(),1,max.target);
  assert.equal(held.motion.velocity,speed);
  const brake=stepCruiseJourney(held.motion,new Set(['w','s']),.1,path,new Set(),1,held.target);
  assert.equal(brake.target,null);assert.ok(brake.motion.velocity<speed);
  assert.equal(stepCruiseJourney(brake.motion,new Set(),.1,path,new Set(),1,brake.target).target,null);
});
test('manual override, reverse limit and reversal boundaries remain authoritative',()=>{
  const manual=stepCruiseJourney({km:10,velocity:30/3.6},new Set(['w']),.1,path,new Set(),1,30/3.6);
  assert.equal(manual.target,null);assert.ok(manual.motion.velocity>30/3.6);
  const reverse=stepCruiseJourney({km:10,velocity:20/3.6},new Set(['w']),.1,path,new Set(),-1,null);
  assert.equal(reverse.target,20/3.6);assert.ok(reverse.motion.km<10);
  const end=stepCruiseJourney({km:99.999,velocity:25},new Set(),.1,path,new Set(),1,25);
  assert.deepEqual(end,{motion:{km:100,velocity:0},target:null});
  const boundary=stepCruiseJourney({km:10.9999,velocity:25},new Set(),.1,{...path,reversals:[{stationId:'sibi',km:11}]},new Set(),1,25);
  assert.deepEqual(boundary,{motion:{km:11,velocity:0},target:null});
});
