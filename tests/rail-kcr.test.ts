import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { distance, lineString, nearestPointOnLine } from '@turf/turf';
import { buildKcrLocalPath, type KcrStationSnapshot } from '../lib/rail/kcrImport';
import { KCR_STATIONS_FILE } from '../lib/rail/sourceFiles';
import { TRAINS, servicePath } from '../lib/rail/trains';
import { RAIL_ROUTES, validateRailDataset } from '../lib/rail/dataset';
import { createRailDeparture } from '../lib/rail/departure';
import { nextStation, indexTrack, sampleTrack } from '../lib/rail/track';
import { stepRailJourney } from '../lib/rail/journey';
import { restoreRailSave, type RailSave } from '../lib/rail/persistence';

const dataset = validateRailDataset(JSON.parse(readFileSync('public/data/rail/ml1.json', 'utf8')));
const train = TRAINS.find(train => train.id === 'karachi-circular-railway')!;
const source = dataset.paths.find(path => path.id === 'kcr')!;
const corridor = dataset.paths.find(path => path.id === 'fareed')!;
const snapshot = JSON.parse(readFileSync(KCR_STATIONS_FILE, 'utf8')) as KcrStationSnapshot;

test('KCR exposes the shorter local corridor with honest mapped-stop coverage', () => {
  assert.deepEqual(train.services.map(service => [service.number, service.direction]), [['1', 'Up'], ['2', 'Down']]);
  assert.ok(train.note?.includes('11 mapped stops'));
  assert.ok(train.note?.includes('unverified'));
  assert.equal(RAIL_ROUTES.find(route => route.id === 'kcr')!.key, 'z');
  const [up, down] = train.services.map(service => servicePath(dataset, train, service));
  assert.deepEqual(up.stations.map(station => station.name), ['Karachi City','Karachi Cantonment','Drigh Road','Airport','Malir Colony','Malir','Landhi','Jumma Goth','Bin Qasim','Badal Nala','Dhabeji']);
  assert.deepEqual(down.stations.map(station => station.id), up.stations.map(station => station.id).reverse());
  assert.deepEqual(up.coordinates.toReversed(), down.coordinates);
  assert.equal(source.reversals?.length ?? 0, 0);
  assert.ok(source.distanceKm > 55 && source.distanceKm < 56);
  assert.ok(!source.stations.some(station => /Orangi|Wazir|Gaddar|Departure|Pipri|Drigh Colony/.test(station.name)));
  for (const path of [up, down]) {
    assert.ok(path.stations[0].km < .000001);
    assert.ok(Math.abs(path.distanceKm - path.stations.at(-1)!.km) < .000001);
  }
});

test('offline KCR rebuild is deterministic and preserves its source corridor', () => {
  const before = JSON.stringify(corridor);
  assert.deepEqual(buildKcrLocalPath(corridor, snapshot), source);
  assert.equal(JSON.stringify(corridor), before);
  const line = lineString(source.coordinates);
  for (const station of source.stations) {
    assert.ok(distance(station.sourceCoordinate, station.coordinate) * 1000 < 50);
    assert.ok((nearestPointOnLine(line, station.coordinate).properties.dist ?? 1) < .000001);
    assert.ok(distance(sampleTrack(indexTrack(source), station.km).position, station.coordinate) < .000001);
  }
  assert.equal(source.stations.find(station => station.name === 'Malir Colony')!.id, '5226556649');
});

test('KCR rejects missing or off-track source halts instead of inventing stations', () => {
  const missing = structuredClone(snapshot);
  missing.elements = missing.elements.filter(element => element.id !== 5226556649);
  assert.throws(() => buildKcrLocalPath(corridor, missing), /Malir Colony/);
  const displaced = structuredClone(snapshot);
  displaced.elements.find(element => element.id === 5226556649)!.lat = 25;
  assert.throws(() => buildKcrLocalPath(corridor, displaced), /too far from track/);
  const noTerminal = structuredClone(corridor);
  noTerminal.stations = noTerminal.stations.filter(station => station.name !== 'Dhabeji');
  assert.throws(() => buildKcrLocalPath(noTerminal, snapshot), /terminals/);
});

test('every KCR departure and saved service uses the correct directed track', () => {
  for (const service of train.services) {
    const path = servicePath(dataset, train, service);
    for (let i = 0; i < path.stations.length - 1; i++) {
      const station = path.stations[i];
      const departure = createRailDeparture(path, station.id, false);
      assert.equal(departure.km, station.km);
      assert.equal(nextStation(path, departure.km)!.id, path.stations[i + 1].id);
      const value: RailSave = { version:1, trainId:train.id, serviceId:service.id, branch:'kcr', stationId:station.id, reverse:false, km:station.km+.01, velocity:30/3.6, direction:1, departed:true, following:true, confirmed:[], lengthKm:departure.track.lengthKm, cruise:30/3.6 };
      const restored = restoreRailSave(JSON.stringify(value), dataset);
      assert.equal(restored.value.serviceId, service.id);
      assert.equal(restored.value.cruise, value.cruise);
      assert.equal(restored.departure.stationId, station.id);
    }
    assert.throws(() => createRailDeparture(path, path.stations.at(-1)!.id, false), /opposite direction/);
  }
});

test('KCR keeps manual stops, cruise, reverse and hard terminal boundaries', () => {
  for (const service of train.services) {
    const path = servicePath(dataset, train, service);
    const station = path.stations.find(station => station.name === 'Malir Colony')!;
    const passing = stepRailJourney({ km:station.km-.001, velocity:25 }, new Set(['w']), .1, path, new Set());
    assert.ok(passing.km > station.km);
    assert.equal(passing.velocity * 3.6, 90);
    const cruise = stepRailJourney({ km:station.km, velocity:30/3.6 }, new Set(), .1, path, new Set(), 1, 30/3.6);
    assert.equal(cruise.velocity, 30/3.6);
    const braking = stepRailJourney(cruise, new Set(['s']), .1, path, new Set(), 1, 30/3.6);
    assert.ok(braking.velocity < cruise.velocity);
    const backing = stepRailJourney({km:station.km+.001,velocity:20/3.6},new Set(['w']),.1,path,new Set(),-1);
    assert.ok(backing.km < station.km+.001);
    assert.equal(backing.velocity * 3.6, 20);
    assert.deepEqual(stepRailJourney({km:path.distanceKm-.0001,velocity:25},new Set(['w']),.1,path,new Set()),{km:path.distanceKm,velocity:0});
  }
});
