import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { TRAINS, servicePath } from '../lib/rail/trains';
import { createRailDeparture } from '../lib/rail/departure';
import { nextStation } from '../lib/rail/track';
import { stepRailJourney } from '../lib/rail/journey';
import { restoreRailSave, type RailSave } from '../lib/rail/persistence';
import type { RailDataset } from '../lib/rail/types';
const dataset = JSON.parse(readFileSync('public/data/rail/ml1.json', 'utf8')) as RailDataset;
const train = TRAINS.find(train => train.id === 'jamalo-express')!;

test('Jamalo uses the reported Shikarpur–Sukkur–Rohri extension with honest local-service labels', () => {
  assert.ok(train.note?.includes('unverified'));
  assert.deepEqual(train.services.map(service => service.number), ['Local', 'Local']);
  const [up, down] = train.services.map(service => servicePath(dataset, train, service));
  assert.deepEqual(up.stations.map(station => station.name), ['Shikarpur', 'Sukkur', 'Rohri Junction']);
  assert.deepEqual(down.stations.map(station => station.id), up.stations.map(station => station.id).reverse());
  const source = dataset.paths.find(path => path.id === 'jamalo')!;
  assert.ok(source.distanceKm > 35 && source.distanceKm < 55);
  assert.equal(source.reversals?.length ?? 0, 0);
  assert.ok(!source.stations.some(station => /Jacobabad|Pano Akil|Kotri/.test(station.name)));
  assert.ok(up.stations[0].km < .001);
  assert.ok(up.distanceKm - up.stations.at(-1)!.km < .001);
});

test('Jamalo can start at Sukkur in both directions and restore its selected local service', () => {
  for (const service of train.services) {
    const path = servicePath(dataset, train, service);
    const suk = path.stations.find(station => station.name === 'Sukkur')!;
    const departure = createRailDeparture(path, suk.id, false);
    assert.equal(departure.km, suk.km);
    assert.match(nextStation(departure.track.path, departure.km)!.name, service.reverse ? /Shikarpur/ : /Rohri/);
    const value: RailSave = { version: 1, trainId: train.id, serviceId: service.id, branch: train.pathId, stationId: suk.id, reverse: false, km: suk.km + .01, velocity: 30 / 3.6, direction: 1, departed: true, following: true, confirmed: [], lengthKm: departure.track.lengthKm, cruise: 30 / 3.6 };
    const restored = restoreRailSave(JSON.stringify(value), dataset);
    assert.equal(restored.value.serviceId, service.id);
    assert.equal(restored.value.km, value.km);
    assert.equal(restored.value.cruise, value.cruise);
    assert.equal(restored.departure.stationId, suk.id);
    assert.throws(() => createRailDeparture(path, path.stations.at(-1)!.id, false), /opposite direction/);
  }
});

test('Jamalo passes the Habib Kot through-track and stops only at its track boundary without hidden reversals', () => {
  const source = dataset.paths.find(path => path.id === 'jamalo')!;
  const habib = source.stations.find(station => /^Habib Kot/.test(station.name))!;
  assert.ok(habib);
  for (const service of train.services) {
    const path = servicePath(dataset, train, service);
    const km = service.reverse ? path.distanceKm - habib.km : habib.km;
    const moving = stepRailJourney({ km: km - .001, velocity: 25 }, new Set(['w']), .1, path, new Set());
    assert.ok(moving.km > km);
    assert.ok(moving.velocity > 25);
    assert.deepEqual(stepRailJourney({ km: path.distanceKm - .0001, velocity: 25 }, new Set(['w']), .1, path, new Set()), { km: path.distanceKm, velocity: 0 });
  }
});
