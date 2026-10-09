import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TRAINS, servicePath } from '../lib/rail/trains';
import { createRailDeparture } from '../lib/rail/departure';
import { restoreRailSave, type RailSave } from '../lib/rail/persistence';
import { nextStation } from '../lib/rail/track';
import type { RailDataset } from '../lib/rail/types';
const dataset = JSON.parse(readFileSync('public/data/rail/ml1.json', 'utf8')) as RailDataset;
const train = TRAINS.find(train => train.id === 'millat-express')!;

test('Millat runs 17 Up Karachi–Lala Musa and 18 Down with a direction-specific Landhi call', () => {
  assert.deepEqual(train.services.map(service => service.number), ['17', '18']);
  const [up, down] = train.services.map(service => servicePath(dataset, train, service));
  assert.equal(up.stations.length, 35);
  assert.equal(down.stations.length, 36);
  assert.match(up.stations[0].name, /Karachi.*Canton/);
  assert.match(up.stations.at(-1)!.name, /Lala Musa/);
  assert.deepEqual(down.stations.filter(station => !/^Landhi/.test(station.name)).map(station => station.id), up.stations.map(station => station.id).reverse());
  assert.ok(!up.stations.some(station => /^Landhi/.test(station.name)));
  assert.ok(down.stations.some(station => /^Landhi/.test(station.name)));
  const source = dataset.paths.find(path => path.id === 'millat')!;
  assert.ok(source.distanceKm > 1300 && source.distanceKm < 1700);
  for (const name of ['Jahanian', 'Faisalabad Railway Station', 'Chiniot', 'Sargodha', 'Malakwal', 'Mandi Bahauddin', 'Dinga']) assert.ok(up.stations.some(station => station.name === name), name);
  assert.ok(!source.stations.some(station => /Multan|Lahore|Jhang Sadar|Hafizabad/.test(station.name)));
  assert.equal(source.reversals?.length ?? 0, 0);
});

test('Millat starts and restores on the correct directed track at Faisalabad and Sargodha', () => {
  for (const service of train.services) for (const name of ['Faisalabad Railway Station', 'Sargodha']) {
    const path = servicePath(dataset, train, service);
    const station = path.stations.find(station => station.name === name)!;
    const departure = createRailDeparture(path, station.id, false);
    assert.equal(departure.km, station.km);
    const next = nextStation(departure.track.path, departure.km);
    assert.ok(next);
    assert.match(next!.name, name === 'Sargodha' ? (service.reverse ? /Shaheenabad/ : /Bhalwal/) : (service.reverse ? /Gojra/ : /Chak Jhumra/));
    const value: RailSave = { version: 1, trainId: train.id, serviceId: service.id, branch: train.pathId, stationId: station.id, reverse: false, km: station.km, velocity: 0, direction: 1, departed: false, following: true, confirmed: [], lengthKm: departure.track.lengthKm };
    const restored = restoreRailSave(JSON.stringify(value), dataset);
    assert.equal(restored.departure.stationId, station.id);
    assert.equal(restored.departure.km, station.km);
    assert.throws(() => createRailDeparture(path, path.stations.at(-1)!.id, false), /opposite direction/);
  }
});

