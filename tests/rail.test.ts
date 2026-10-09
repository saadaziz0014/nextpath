import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { distance, nearestPointOnLine, lineString } from '@turf/turf';
import { stepRailJourney, confirmableReversal } from '../lib/rail/journey';
import { stepTrain, brakingDistanceMeters } from '../lib/rail/physics';
import { routeThroughAnchors } from '../lib/rail/importGraph';
import { validateRailDataset } from '../lib/rail/dataset';
import { assertRailPathQuality } from '../lib/rail/quality';
import { TRAINS, servicePath } from '../lib/rail/trains';
import { createRailDeparture } from '../lib/rail/departure';
import { indexTrack, sampleTrack, reversePath, nextStation } from '../lib/rail/track';
import type { RailDataset } from '../lib/rail/types';
const dataset = JSON.parse(readFileSync('public/data/rail/ml1.json', 'utf8')) as RailDataset;
test('train throttle caps at 110 km/h and manual brake stops without reversing', () => {
  let state = { km: 0, velocity: 0 };
  for (let i = 0; i < 2000; i++) state = stepTrain(state, new Set(['w']), .1, 200);
  assert.equal(state.velocity * 3.6, 110);
  const before = state.km;
  for (let i = 0; i < 500; i++) state = stepTrain(state, new Set(['s']), .1, 200);
  assert.equal(state.velocity, 0);
  assert.ok(Math.abs((state.km - before) * 1000 - brakingDistanceMeters(110/3.6)) < .1);
  assert.equal(stepTrain(state, new Set(['s']), .1, 200).km, state.km);
});
test('coasting remains moving; braking takes priority and endpoint is a hard boundary', () => {
  assert.ok(stepTrain({ km: 2, velocity: 10 }, new Set(), .1, 100).velocity > 9);
  assert.ok(stepTrain({ km: 2, velocity: 10 }, new Set(['w','s']), .1, 100).velocity < 10);
  assert.deepEqual(stepTrain({ km: 99.999, velocity: 25 }, new Set(['w']), 10, 100), { km: 100, velocity: 0 });
  assert.deepEqual(stepTrain({ km: 0, velocity: 0 }, new Set(['w']), 10, 100), stepTrain({ km: 0, velocity: 0 }, new Set(['w']), .1, 100));
});
test('all sourced routes stay on track and station ordering is consistent', () => {
  assert.deepEqual(dataset.paths.map(path => path.id), ['chord','multan','south','north','branch','allama-iqbal','musa-pak','fareed','jaffar','green-line','awam','pak-business','subak-kharam','tezgam','mohenjo-daro','millat','jamalo','kcr']);
  const endpoints = new Map([
    ['chord', [/Khanewal/, /Lodhran/]],
    ['multan', [/Khanewal/, /Lodhran/]],
    ['south', [/Lodhran/, /Karachi/]],
    ['north', [/Khanewal/, /Peshawar/]],
    ['branch', [/Lodhran/, /Burewala/]],
    ['allama-iqbal', [/Karachi/, /Sialkot/]],
    ['musa-pak', [/Multan/, /Lahore Junction/]],
    ['mohenjo-daro', [/Kotri/, /Rohri/]],
    ['millat', [/Karachi/, /Lala Musa/]],
    ['jamalo', [/Shikarpur/, /Rohri/]],
    ['kcr', [/Karachi City/, /Dhabeji/]],
    ['tezgam', [/Karachi/, /Rawalpindi/]],
    ['subak-kharam', [/Lahore Junction/, /Rawalpindi/]],
    ['pak-business', [/Karachi/, /Lahore Junction/]],
    ['awam', [/Karachi/, /Peshawar/]],
    ['green-line', [/Karachi/, /Margalla/]],
    ['jaffar', [/Quetta/, /Peshawar/]],
    ['fareed', [/Karachi City/, /Lahore Junction/]],
  ] as const);
  validateRailDataset(dataset);
  for (const path of dataset.paths) {
    assertRailPathQuality(path);
    const [first, last] = endpoints.get(path.id)!;
    const track = indexTrack(path), line = lineString(path.coordinates);
    assert.ok(Math.abs(track.lengthKm - path.distanceKm) < .00001);
    assert.ok(path.stations.length >= (path.id === 'jamalo' ? 3 : 10));
    assert.match(path.stations[0].name, first);
    assert.match(path.stations.at(-1)!.name, last);
    for (let i=0;i<=200;i++) {
      const sample = sampleTrack(track, track.lengthKm * i / 200);
      assert.ok((nearestPointOnLine(line, sample.position).properties.dist ?? 1) < .00001);
      assert.ok(Number.isFinite(sample.heading));
    }
    assert.ok(distance(sampleTrack(track, track.lengthKm).position, path.coordinates.at(-1)!) < .00001);
    for (let i=1;i<path.stations.length;i++) assert.ok(path.stations[i].km >= path.stations[i-1].km);
    assert.ok(path.stations.every(station => station.offsetMeters < 250));
    for (const station of path.stations) assert.ok((nearestPointOnLine(line, station.coordinate).properties.dist ?? 1) < .00001);
    assert.ok(distance(reversePath(path).coordinates[0], path.coordinates.at(-1)!) === 0);
  }
  assert.ok(dataset.paths[0].stations.some(station => /Jahanian/.test(station.name)));
  assert.ok(!dataset.paths[0].stations.some(station => /Multan/.test(station.name)));
  assert.ok(dataset.paths[1].stations.some(station => /Multan Cantt/.test(station.name)));
  const byId = new Map(dataset.paths.map(path => [path.id, path.stations]));
  assert.ok(byId.get('south')!.some(station => /Rahim Yar Khan/i.test(station.name)));
  assert.ok(byId.get('south')!.some(station => /Hyderabad/.test(station.name)));
  assert.ok(byId.get('south')!.some(station => /Bahawalpur/.test(station.name)));
  assert.ok(byId.get('south')!.some(station => /Rohri/.test(station.name)));
  assert.ok(byId.get('north')!.some(station => /Raiwind/.test(station.name)));
  assert.ok(byId.get('north')!.some(station => /Golra|Rawalpindi/i.test(station.name)));
  assert.ok(byId.get('branch')!.some(station => /Vehari|Mailsi/i.test(station.name)));
  assert.ok(!byId.get('north')!.some(station => /Karachi/.test(station.name)));
  assert.ok(!byId.get('south')!.some(station => /Peshawar/.test(station.name)));
});

test('north follows the main-line station sequence without returning to Khanewal', () => {
  const path = dataset.paths.find(path => path.id === 'north')!;
  const names = [/Khanewal/i,/Chichawatni/i,/Sahiwal/i,/^Okara$/i,/Raiwind/i,/Lahore Junction/i,/Gujranwala/i,/Wazirabad/i,/Jhelum/i,/Rawalpindi/i,/Taxila/i,/Nowshera/i,/Peshawar Cantonment/i];
  let last = -1;
  for (const name of names) {
    const index = path.stations.findIndex(station => name.test(station.name));
    assert.ok(index > last, 'Missing or out-of-order station ' + name); last = index;
  }
  assert.ok(path.distanceKm < 900, 'Reject the previous 1,248 km branch-line detour');
});
test('rail itinerary chooses a through platform instead of reversing at an intermediate anchor', () => {
  const nodes = new Map<number, [number,number]>([[1,[74,31]],[2,[74,31.001]],[3,[74,31.002]],[4,[74.001,31.001]]]);
  const edges = new Map([[1,[{to:2,km:1}]],[2,[{to:1,km:1},{to:3,km:1},{to:4,km:.1}]],[3,[{to:2,km:1}]],[4,[{to:2,km:.1}]]]);
  // Node 4 is a tempting dead-end platform. Greedy per-leg routing picks it,
  // then reverses to 2. The entire itinerary must select through node 2.
  assert.deepEqual(routeThroughAnchors(nodes,edges,[{id:1,km:0}],[new Set([2,4]),new Set([3])]), [1,2,3]);
  assert.throws(() => routeThroughAnchors(nodes,edges,[{id:1,km:0}],[new Set([4]),new Set([3])]), /without reversing/);
});
test('rail JSON rejects duplicate IDs, missing routes, bad coordinates and invalid station chainages', () => {
  const copy = () => JSON.parse(JSON.stringify(dataset)) as RailDataset;
  let data = copy(); data.paths[1].id = data.paths[0].id;
  assert.throws(() => validateRailDataset(data), /duplicate/);
  data = copy(); data.paths.pop(); assert.throws(() => validateRailDataset(data), /Missing rail/);
  data = copy(); data.paths[0].coordinates[0][0] = 999; assert.throws(() => validateRailDataset(data), /geometry/);
  data = copy(); data.paths[0].stations[1].km = -1; assert.throws(() => validateRailDataset(data), /station/);
});

 test('station departures snap to track chainage in either direction and reject wrong terminals', () => {
  const path = dataset.paths.find(path => path.id === 'south')!;
  const middle = path.stations.find(station => /Hyderabad/.test(station.name))!;
  const forward = createRailDeparture(path, middle.id, false);
  const reverse = createRailDeparture(path, middle.id, true);
  assert.ok(distance(sampleTrack(forward.track, forward.km).position, middle.coordinate) < .00001);
  assert.ok(distance(sampleTrack(reverse.track, reverse.km).position, middle.coordinate) < .00001);
  assert.ok(Math.abs(forward.km + reverse.km - path.distanceKm) < .00001);
  assert.match(nextStation(forward.track.path, forward.km)!.name, /Gidu/);
  assert.ok(nextStation(reverse.track.path, reverse.km)!.km > reverse.km);
  const terminal = path.stations.at(-1)!;
  assert.throws(() => createRailDeparture(path, terminal.id, false), /opposite direction/);
  const fromKarachi = createRailDeparture(path, terminal.id, true);
  assert.ok(fromKarachi.km < .015);
  assert.ok(fromKarachi.track.lengthKm - fromKarachi.km > 800);
  assert.throws(() => createRailDeparture(path, 'not-on-route', false), /does not belong/);
});

test('Allama Iqbal services follow the chord and Narowal, with distinct Up/Down stops', () => {
  const train = TRAINS[0];
  const up = servicePath(dataset, train, train.services[0]);
  const down = servicePath(dataset, train, train.services[1]);
  assert.equal(up.stations.length, 37);
  assert.equal(down.stations.length, 36);
  assert.match(up.stations[0].name, /Karachi/);
  assert.match(up.stations.at(-1)!.name, /Sialkot/);
  assert.match(down.stations[0].name, /Sialkot/);
  assert.match(down.stations.at(-1)!.name, /Karachi/);
  assert.ok(up.stations.some(s => s.name === 'Gambat'));
  assert.ok(!down.stations.some(s => s.name === 'Gambat'));
  const required = [/Lodhran/,/Dunyapur/,/Jahanian/,/Khanewal/,/Lahore Junction/,/Shahdara/,/Narang/,/Baddomalhi/,/Narowal/,/Pasrur/,/Sialkot/];
  let previous = -1;
  for (const name of required) {
    const index = up.stations.findIndex(s => name.test(s.name));
    assert.ok(index > previous, String(name)); previous = index;
  }
  assert.ok(!up.stations.some(s => /Multan|Wazirabad|Gujranwala/.test(s.name)));
  assert.ok(up.distanceKm > 1300 && up.distanceKm < 1500);
  assert.deepEqual(up.coordinates.toReversed(), down.coordinates);
  for (const path of [up, down]) {
    const departure = createRailDeparture(path, path.stations[0].id, false);
    assert.ok(departure.km < .015);
    const lahore = path.stations.find(s => /Lahore Junction/.test(s.name))!;
    const middle = createRailDeparture(path, lahore.id, false);
    assert.ok(distance(sampleTrack(middle.track, middle.km).position, lahore.coordinate) < .00001);
    assert.throws(() => createRailDeparture(path, path.stations.at(-1)!.id, false));
  }
  const broken = structuredClone(dataset);
  broken.paths.find(p => p.id === train.pathId)!.stations = [];
  assert.throws(() => servicePath(broken, train, train.services[0]), /mapped stop/);
});

test('Musa Pak has distinct 115 Up and 116 Down stops on the Multan–Lahore main line', () => {
  const train = TRAINS.find(train => train.id === 'musa-pak-express')!;
  assert.deepEqual(train.services.map(service => service.number), ['115', '116']);
  const up = servicePath(dataset, train, train.services[0]);
  const down = servicePath(dataset, train, train.services[1]);
  assert.equal(up.stations.length, 10);
  assert.equal(down.stations.length, 6);
  assert.match(up.stations[0].name, /Multan.*Cant/i);
  assert.match(up.stations.at(-1)!.name, /Lahore Junction/);
  assert.match(down.stations[0].name, /Lahore Junction/);
  assert.match(down.stations.at(-1)!.name, /Multan.*Cant/i);
  assert.deepEqual(down.stations.map(station => station.name), ['Lahore Junction', 'Raiwind Junction', 'Okara', 'Sahiwal', 'Khanewal Junction Railway Station', 'Multan Cantt']);
  assert.ok(up.distanceKm > 300 && up.distanceKm < 350);
  assert.deepEqual(up.coordinates.toReversed(), down.coordinates);
  assert.ok(!up.stations.some(station => /Jahanian|Lodhran|Narowal/.test(station.name)));
  for (const path of [up, down]) {
    const origin = createRailDeparture(path, path.stations[0].id, false);
    assert.ok(origin.km < .015);
    const khanewal = path.stations.find(station => /Khanewal/.test(station.name))!;
    const departure = createRailDeparture(path, khanewal.id, false);
    assert.ok(distance(sampleTrack(departure.track, departure.km).position, khanewal.coordinate) < .00001);
    assert.match(nextStation(departure.track.path, departure.km)!.name, path === up ? /Mian Channu/ : /Multan/);
    assert.throws(() => createRailDeparture(path, path.stations.at(-1)!.id, false));
  }
});

test('Fareed follows the Pakpattan branch and declares only the Kasur station reversal', () => {
  const train = TRAINS.find(train => train.id === 'baba-farid-express')!;
  const up = servicePath(dataset, train, train.services[0]);
  const down = servicePath(dataset, train, train.services[1]);
  assert.equal(up.stations.length, 45);
  assert.equal(down.stations.length, 46);
  assert.match(up.stations[0].name, /Karachi City/);
  assert.match(down.stations[0].name, /Lahore Junction/);
  assert.ok(!up.stations.some(station => station.name === 'Walton'));
  assert.equal(down.stations[1].name, 'Walton');
  let previous = -1;
  for (const name of [/Lodhran/, /Vehari/, /Burewala/, /Arifwala/, /Pakpattan/, /^Kasur Junction$/, /Raiwind/, /Lahore Junction/]) {
    const index = up.stations.findIndex(station => name.test(station.name));
    assert.ok(index > previous, String(name)); previous = index;
  }
  assert.ok(!up.stations.some(station => /Khanewal|Sahiwal|Jahanian|Multan/.test(station.name)));
  assert.ok(up.distanceKm > 1200 && up.distanceKm < 1400);
  assert.deepEqual(up.coordinates.toReversed(), down.coordinates);
  for (const path of [up, down]) {
    assertRailPathQuality(path);
    assert.equal(path.reversals?.length, 1);
    const reversal = path.reversals![0];
    const kasur = path.stations.find(station => station.id === reversal.stationId)!;
    assert.match(kasur.name, /^Kasur Junction$/);
    assert.equal(kasur.km, reversal.km);
    assert.ok(distance(sampleTrack(indexTrack(path), reversal.km).position, kasur.coordinate) < .000001);
    assert.throws(() => assertRailPathQuality({...path, reversals:undefined}), /reversal|retraced/);
    const origin = createRailDeparture(path, path.stations[0].id, false);
    assert.ok(origin.km < .015);
    assert.throws(() => createRailDeparture(path, path.stations.at(-1)!.id, false));
  }
  assert.ok(Math.abs(up.reversals![0].km + down.reversals![0].km - up.distanceKm) < .000001);
});

test('Kasur blocks continued traction until the stopped train confirms its reversal', () => {
  const train = TRAINS.find(train => train.id === 'baba-farid-express')!;
  for (const service of train.services) {
    const path = servicePath(dataset, train, service), reversal = path.reversals![0];
    const confirmed = new Set<string>();
    assert.equal(confirmableReversal(path, {km:reversal.km,velocity:1}, confirmed), null);
    assert.equal(confirmableReversal(path, {km:reversal.km-.001,velocity:0}, confirmed), null);
    const stopped = stepRailJourney({km:reversal.km-.0005,velocity:25}, new Set(['w']), .1, path, confirmed);
    assert.deepEqual(stopped, {km:reversal.km,velocity:0});
    assert.deepEqual(stepRailJourney(stopped,new Set(['w']),.1,path,confirmed), stopped);
    assert.equal(confirmableReversal(path,stopped,confirmed)?.stationId,reversal.stationId);
    confirmed.add(reversal.stationId);
    assert.ok(stepRailJourney(stopped,new Set(['w']),.1,path,confirmed).km > reversal.km);
    assert.equal(confirmableReversal(path,stopped,confirmed), null);
  }
  const malformed = structuredClone(dataset);
  malformed.paths.find(path=>path.id==='fareed')!.reversals![0].km += 1;
  assert.throws(()=>validateRailDataset(malformed), /reversal/);
});

test('Jaffar services follow the full Quetta–Peshawar corridor in both directions', () => {
  const train = TRAINS.find(train => train.id === 'jaffar-express')!;
  const up = servicePath(dataset, train, train.services[0]);
  const down = servicePath(dataset, train, train.services[1]);
  assert.equal(up.stations.length, 42);
  assert.equal(down.stations.length, 40);
  assert.match(up.stations[0].name, /^Quetta$/);
  assert.match(up.stations.at(-1)!.name, /Peshawar Cantonment/);
  assert.match(down.stations[0].name, /Peshawar Cantonment/);
  assert.match(down.stations.at(-1)!.name, /^Quetta$/);
  assert.ok(up.distanceKm > 1500 && up.distanceKm < 1900);
  for (const name of [/Kolpur/, /^Mach$/, /Aab-e-Gum/, /Sibi/, /Jacobabad/, /Sukkur/, /Multan/, /Rawalpindi/]) assert.ok(up.stations.some(station => name.test(station.name)));
  assert.ok(!up.stations.some(station => /Jahanian|Kasur/.test(station.name)));
  assert.ok(!down.stations.some(station => /Kot Lakhpat|^Khanpur/.test(station.name)));
  const jacobabad = up.stations.find(station => /Jacobabad/.test(station.name))!;
  const departure = createRailDeparture(up, jacobabad.id, false);
  assert.equal(departure.km, jacobabad.km);
  assert.ok(departure.track.lengthKm > departure.km);
});

test('Jaffar Sibi reversal requires a complete stop and confirmation in both directions', () => {
  const train = TRAINS.find(train=>train.id==='jaffar-express')!;
  for (const service of train.services) {
    const path = servicePath(dataset,train,service);
    const reversal = path.reversals![0];
    assert.match(path.stations.find(station=>station.id===reversal.stationId)!.name,/Sibi/);
    const stopped = stepRailJourney({km:reversal.km-.0001,velocity:25},new Set(['w']),.1,path,new Set());
    assert.equal(stopped.km,reversal.km);
    assert.equal(stopped.velocity,0);
    assert.equal(confirmableReversal(path,stopped,new Set())?.stationId,reversal.stationId);
    assert.ok(stepRailJourney(stopped,new Set(['w']),.1,path,new Set([reversal.stationId])).km>reversal.km);
  }
});

test('Green Line has direction-specific stops and reaches Margalla through the chord', () => {
  const train = TRAINS.find(train=>train.id==='green-line-express')!;
  const up = servicePath(dataset,train,train.services[0]);
  const down = servicePath(dataset,train,train.services[1]);
  assert.equal(up.stations.length,9);
  assert.equal(down.stations.length,10);
  assert.match(up.stations[0].name,/Karachi.*Canton/i);
  assert.match(up.stations.at(-1)!.name,/Margalla/);
  assert.match(down.stations[0].name,/Margalla/);
  assert.match(down.stations.at(-1)!.name,/Karachi.*Canton/i);
  assert.ok(!up.stations.some(station=>station.name==='Drigh Road'));
  assert.ok(down.stations.some(station=>station.name==='Drigh Road'));
  assert.ok(up.distanceKm>1450 && up.distanceKm<1650);
  const track=dataset.paths.find(path=>path.id==='green-line')!;
  assert.ok(track.stations.some(station=>/Jahanian/.test(station.name)));
  assert.ok(!track.stations.some(station=>/Multan Cantt|Peshawar|Kasur/.test(station.name)));
  assert.equal(track.reversals?.length??0,0);
  for(const path of [up,down]) {
    const rawalpindi=path.stations.find(station=>/Rawalpindi/.test(station.name))!;
    const departure=createRailDeparture(path,rawalpindi.id,false);
    assert.equal(departure.km,rawalpindi.km);
    assert.ok(departure.track.lengthKm>departure.km);
  }
});

test('Awam follows Multan main line with all 62 scheduled stops in both directions', () => {
  const train=TRAINS.find(train=>train.id==='awam-express')!;
  const up=servicePath(dataset,train,train.services[0]);
  const down=servicePath(dataset,train,train.services[1]);
  assert.equal(up.stations.length,62);
  assert.equal(down.stations.length,62);
  assert.match(up.stations[0].name,/Karachi.*Canton/i);
  assert.match(up.stations.at(-1)!.name,/Peshawar Cantonment/);
  assert.deepEqual(down.stations.map(station=>station.id),up.stations.map(station=>station.id).reverse());
  assert.ok(up.distanceKm>1650 && up.distanceKm<1800);
  const path=dataset.paths.find(path=>path.id==='awam')!;
  for(const name of [/Shujabad/,/Multan Cantt/,/Lahore Junction/,/Rawalpindi/,/Golra Sharif/,/Taxila/]) assert.ok(path.stations.some(station=>name.test(station.name)));
  assert.ok(!path.stations.some(station=>/Jahanian|Margalla|Faisalabad|Kasur|Sibi/.test(station.name)));
  assert.equal(path.reversals?.length??0,0);
  for(const directed of [up,down]) {
    const multan=directed.stations.find(station=>station.name==='Multan Cantt')!;
    const departure=createRailDeparture(directed,multan.id,false);
    assert.equal(departure.km,multan.km);
    assert.ok(departure.track.lengthKm>departure.km);
    assert.throws(()=>createRailDeparture(directed,directed.stations.at(-1)!.id,false));
  }
});

test('Pak Business uses the chord with distinct Up and Down stopping patterns', () => {
  const train=TRAINS.find(train=>train.id==='pak-business-express')!;
  const up=servicePath(dataset,train,train.services[0]);
  const down=servicePath(dataset,train,train.services[1]);
  assert.equal(up.stations.length,11);
  assert.equal(down.stations.length,13);
  assert.match(up.stations[0].name,/Karachi.*Canton/i);
  assert.match(up.stations.at(-1)!.name,/Lahore Junction/);
  assert.match(down.stations[0].name,/Lahore Junction/);
  assert.match(down.stations.at(-1)!.name,/Karachi.*Canton/i);
  assert.ok(up.distanceKm>1150 && up.distanceKm<1300);
  assert.ok(!up.stations.some(station=>/Landhi|Drigh Road/.test(station.name)));
  assert.deepEqual(down.stations.slice(-3).map(station=>station.name),['Landhi','Drigh Road','Karachi Cantonment Railway Station']);
  const path=dataset.paths.find(path=>path.id==='pak-business')!;
  assert.ok(path.stations.some(station=>/Jahanian/.test(station.name)));
  assert.ok(!path.stations.some(station=>/Multan Cantt|Rawalpindi|Kasur|Sialkot/.test(station.name)));
  assert.equal(path.reversals?.length??0,0);
  for(const directed of [up,down]) {
    const sahiwal=directed.stations.find(station=>station.name==='Sahiwal')!;
    assert.equal(createRailDeparture(directed,sahiwal.id,false).km,sahiwal.km);
    assert.throws(()=>createRailDeparture(directed,directed.stations.at(-1)!.id,false));
  }
});

test('Subak Kharam railcar follows Lahore–Rawalpindi with direction-specific stops', () => {
  const train=TRAINS.find(train=>train.id==='subak-kharam')!;
  const up=servicePath(dataset,train,train.services[0]);
  const down=servicePath(dataset,train,train.services[1]);
  assert.equal(up.stations.length,8);
  assert.equal(down.stations.length,9);
  assert.match(up.stations[0].name,/Lahore Junction/);
  assert.match(up.stations.at(-1)!.name,/Rawalpindi/);
  assert.match(down.stations[0].name,/Rawalpindi/);
  assert.match(down.stations.at(-1)!.name,/Lahore Junction/);
  assert.ok(up.distanceKm>270 && up.distanceKm<310);
  assert.ok(!up.stations.some(station=>station.name==='Gujar Khan'));
  assert.ok(down.stations.some(station=>station.name==='Gujar Khan'));
  assert.ok(up.stations.some(station=>station.name==='Chaklala'));
  const path=dataset.paths.find(path=>path.id==='subak-kharam')!;
  assert.ok(!path.stations.some(station=>/Margalla|Multan|Peshawar|Sialkot/.test(station.name)));
  assert.equal(path.reversals?.length??0,0);
  for(const directed of [up,down]) {
    const jhelum=directed.stations.find(station=>station.name==='Jhelum')!;
    assert.equal(createRailDeparture(directed,jhelum.id,false).km,jhelum.km);
    assert.throws(()=>createRailDeparture(directed,directed.stations.at(-1)!.id,false));
  }
});

test('Tezgam has distinct 7 Up and 8 Down stops on the Multan–Rawalpindi corridor', () => {
  const train = TRAINS.find(train => train.id === 'tezgam-express')!;
  assert.equal(train.pathId, 'tezgam');
  const [upService, downService] = train.services;
  assert.equal(upService.number, '7'); assert.equal(downService.number, '8');
  const up = servicePath(dataset, train, upService), down = servicePath(dataset, train, downService);
  assert.equal(up.stations.length, 29); assert.equal(down.stations.length, 31);
  assert.match(up.stations[0].name, /Karachi.*Canton/i);
  assert.match(up.stations.at(-1)!.name, /Rawalpindi/i);
  assert.match(down.stations[0].name, /Rawalpindi/i);
  assert.match(down.stations.at(-1)!.name, /Karachi.*Canton/i);
  for (const name of ['Landhi','Drigh Road']) {
    assert.equal(upService.stopNames.includes(name), false);
    assert.equal(downService.stopNames.includes(name), true);
  }
  assert.ok(upService.stopNames.indexOf('Multan Cantt') < upService.stopNames.indexOf('Khanewal'));
  const path = dataset.paths.find(path => path.id === 'tezgam')!;
  assert.ok(path.stations.some(station => /^shujabad$/i.test(station.name)));
  assert.ok(!path.stations.some(station => /^j[ae]han/i.test(station.name)));
  assert.ok(!path.stations.some(station => /^taxila/i.test(station.name)));
  assert.equal(path.reversals, undefined);
  for (const service of [up, down]) {
    assert.ok(Math.abs(service.stations[0].km) < .015);
    assert.ok(Math.abs(service.stations.at(-1)!.km - service.distanceKm) < .015);
    const departure = createRailDeparture(service, service.stations[12].id, false);
    assert.equal(departure.km, service.stations[12].km);
    for (let i=1;i<service.stations.length;i++) assert.ok(service.stations[i].km > service.stations[i-1].km);
  }
});
