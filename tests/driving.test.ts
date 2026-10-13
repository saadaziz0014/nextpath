import { test } from 'node:test';
import assert from 'node:assert/strict';
import { distance } from '@turf/turf';
import { nextVelocity, isDrivingKey } from '../lib/driving';
import { RoadNetwork } from '../lib/roadNetwork';
import { createDrivingRoute, sampleDrivingRoute, searchPlaces, fetchDrivingRoute, DEFAULT_START, DEFAULT_END } from '../lib/routes';
import type { Coordinate } from '../lib/routeData';
import type { Feature, LineString } from 'geojson';
const road = (coordinates: Coordinate[], properties = {}): Feature<LineString> => ({ type: 'Feature', properties: { class: 'street', ...properties }, geometry: { type: 'LineString', coordinates } });
const a: Coordinate = [74, 31], junction: Coordinate = [74, 31.001], north: Coordinate = [74, 31.002], west: Coordinate = [73.999, 31.001], east: Coordinate = [74.001, 31.001];
const network = () => { const graph = new RoadNetwork(); graph.ingest([road([a, junction, north]), road([west, junction, east])]); return graph; };

test('shared bridge endpoints allow committed turns, continued driving and history reversal', () => {
  for (const structure of ['bridge', 'tunnel']) {
    for (const elevatedFirst of [false, true]) {
      const graph = new RoadNetwork();
      const approach = road([a, junction]);
      const ramp = road([junction, east], { structure, oneway: 'true' });
      // The ground connection is also a source endpoint, not an interior crossing.
      const features = [approach, ramp, road([junction, north])];
      if (elevatedFirst) features.reverse();
      graph.ingest(features);
      const cursor = graph.advance(graph.nearest(a, 0)!, distance(a, junction) - .02, null).cursor;
      assert.equal(graph.sample(cursor).roadLevel, 'ground');
      const decision = graph.decide(cursor, 'right');
      assert.ok(decision);
      const result = graph.advance(cursor, .04, null, decision);
      assert.equal(result.blocked, null);
      assert.equal(result.decisionPassed, true);
      assert.ok(graph.sample(result.cursor).position[0] > junction[0]);
      assert.equal(graph.sample(result.cursor).roadLevel, structure);
      const reverse = graph.advance(result.cursor, -.04, null);
      assert.equal(reverse.blocked, null);
      assert.ok(graph.sample(reverse.cursor).position[1] < junction[1]);
      assert.equal(graph.sample(reverse.cursor).roadLevel, 'ground');
      // A one-way ramp is not available as a forward exit from its far end.
      assert.ok(graph.advance(result.cursor, 1, null).blocked);
    }
  }
});

test('grade transitions do not join interior crossings or nearby ramp endpoints', () => {
  for (const elevated of [road([west, junction, east], { structure: 'bridge' }), road([[74.00002, 31.001], east], { structure: 'bridge' })]) {
    const graph = new RoadNetwork();
    graph.ingest([road([a, junction]), elevated]);
    assert.equal(graph.decide(graph.advance(graph.nearest(a, 0)!, distance(a, junction), null).cursor, 'right'), null);
    assert.ok(graph.advance(graph.nearest(a, 0)!, distance(a, junction) + .02, 'right').blocked);
  }
});

test('A/D and W/S are recognized, throttle is capped, and braking reverses', () => {
  for (const key of ['w', 'a', 's', 'd', 'A', 'D']) assert.ok(isDrivingKey(key));
  assert.equal(isDrivingKey('x'), false);
  assert.ok(nextVelocity(10, new Set(['s']), .1) < 10);
  assert.ok(nextVelocity(0, new Set(['s']), .1) < 0);
  assert.equal(nextVelocity(120 / 3.6, new Set(['w']), .1), 120 / 3.6);
  assert.equal(nextVelocity(0, new Set(['w']), 10), nextVelocity(0, new Set(['w']), .1));
});
test('left/right choose connected roads instead of staying on the guide route', () => {
  const graph = network();
  const cursor = graph.nearest(a, 0)!;
  const kmToJunction = distance(a, junction);
  const left = graph.advance(cursor, kmToJunction + .02, 'left');
  const right = graph.advance(cursor, kmToJunction + .02, 'right');
  const straight = graph.advance(cursor, kmToJunction + .02, null);
  assert.ok(graph.sample(left.cursor).position[0] < junction[0]);
  assert.ok(graph.sample(right.cursor).position[0] > junction[0]);
  assert.ok(graph.sample(straight.cursor).position[1] > junction[1]);
  assert.equal(left.queuedTurn, null);
  assert.equal(right.queuedTurn, null);
});
test('junction preview exposes connected choices and turn requests survive intermediate bends', () => {
  const graph = network();
  const cursor = graph.nearest(a, 0)!;
  assert.deepEqual(new Set(graph.junction(cursor)!.choices.map(choice => choice.turn)), new Set(['left', 'straight', 'right']));
  const before = graph.advance(cursor, .02, 'left');
  assert.equal(before.queuedTurn, 'left');
  assert.equal(before.blocked, null);
});
test('W follows a forward curved fork and an unavailable turn stays queued', () => {
  const graph = new RoadNetwork();
  const continuation: Coordinate = [74.0003, 31.002];
  graph.ingest([road([a, junction], { name: 'Main' }), road([junction, continuation], { name: 'Main' }), road([junction, west], { name: 'Side' })]);
  const forward = graph.advance(graph.nearest(a, 0)!, distance(a, junction) + .03, null);
  assert.equal(forward.blocked, null);
  assert.ok(graph.sample(forward.cursor).position[1] > junction[1]);
  const unavailable = graph.advance(graph.nearest(a, 0)!, distance(a, junction) + .03, 'right');
  assert.equal(unavailable.blocked, null);
  assert.equal(unavailable.queuedTurn, 'right');
});

test('T-junction stops at the node until A/D selects an available turn', () => {
  const graph = new RoadNetwork(); graph.ingest([road([a, junction]), road([west, junction, east])]);
  const cursor = graph.nearest(a, 0)!;
  const stopped = graph.advance(cursor, distance(a, junction) + .03, null);
  assert.match(stopped.blocked!, /No road ahead/);
  assert.deepEqual(graph.sample(stopped.cursor).position, junction);
  const heldW = graph.advance(stopped.cursor, .1, null);
  assert.deepEqual(graph.sample(heldW.cursor).position, junction);
  assert.equal(heldW.movedKm, 0);
  const chosen = graph.advance(cursor, distance(a, junction) + .02, 'right');
  assert.ok(graph.sample(chosen.cursor).position[0] > junction[0]);
});

test('a single side exit cannot turn automatically, including a road with the same name', () => {
  const graph = new RoadNetwork();
  graph.ingest([road([a, junction], { name: 'Main' }), road([junction, east], { name: 'Main', oneway: 'true' })]);
  const stopped = graph.advance(graph.nearest(a, 0)!, distance(a, junction) + .02, null);
  assert.match(stopped.blocked!, /No road ahead/);
  assert.deepEqual(graph.sample(stopped.cursor).position, junction);
  assert.equal(graph.junction(stopped.cursor)!.choices[0].turn, 'right');
  const wrong = graph.advance(stopped.cursor, .02, 'left');
  assert.ok(wrong.blocked);
  assert.equal(wrong.queuedTurn, 'left');
  const chosen = graph.advance(stopped.cursor, .02, 'right');
  assert.equal(chosen.blocked, null);
  assert.equal(chosen.queuedTurn, null);
  assert.ok(graph.sample(chosen.cursor).position[0] > junction[0]);
});
test('curved source geometry continues through a junction without consuming a queued turn', () => {
  const bend: Coordinate = [74.001, 31.002];
  const graph = new RoadNetwork(); graph.ingest([road([a, junction, bend]), road([junction, west])]);
  const result = graph.advance(graph.nearest(a, 0)!, distance(a, junction) + .03, 'right');
  assert.equal(result.blocked, null);
  assert.equal(result.queuedTurn, 'right');
  assert.ok(graph.sample(result.cursor).position[1] > junction[1]);
  // The side branch remains selectable independently of the road's curvature.
  const left = graph.advance(graph.nearest(a, 0)!, distance(a, junction) + .03, 'left');
  assert.equal(left.queuedTurn, null);
  assert.ok(graph.sample(left.cursor).position[0] < junction[0]);
});

test('an angled separate side road still requires a turn and sharp same-polyline corners stop', () => {
  const side: Coordinate = [74.001, 31.002];
  const separate = new RoadNetwork(); separate.ingest([road([a, junction]), road([junction, side])]);
  assert.ok(separate.advance(separate.nearest(a, 0)!, distance(a, junction) + .02, null).blocked);
  const sharp = new RoadNetwork(); sharp.ingest([road([a, junction, east])]);
  assert.ok(sharp.advance(sharp.nearest(a, 0)!, distance(a, junction) + .02, null).blocked);
});
test('quantized tile seams connect but separate nearby roads do not', () => {
  const graph = new RoadNetwork();
  graph.ingest([road([a, junction]), road([[74.000004, 31.001002], north])]);
  const result = graph.advance(graph.nearest(a, 0)!, distance(a, junction) + .03, null);
  assert.equal(result.blocked, null);
  assert.ok(graph.sample(result.cursor).position[1] > junction[1]);
  const gap = new RoadNetwork(); gap.ingest([road([a, junction]), road([[74.0001, 31.001], [74.0001, 31.002]])]);
  assert.ok(gap.advance(gap.nearest(a, 0)!, .15, null).blocked);
});

test('T-junction inside a segment connects, including cursors created before new tiles arrived', () => {
  const graph = new RoadNetwork(); graph.ingest([road([a, north])]);
  const cursor = graph.nearest(a, 0)!;
  graph.ingest([road([junction, east])]);
  const result = graph.advance(cursor, distance(a, junction) + .02, 'right');
  assert.equal(result.blocked, null);
  assert.ok(graph.sample(result.cursor).position[0] > junction[0]);
  const reverse = graph.advance(result.cursor, -.04, null);
  assert.ok(graph.sample(reverse.cursor).position[1] < junction[1]);
  // A ground endpoint lying on a bridge must never create a new connection.
  const bridge = new RoadNetwork(); bridge.ingest([road([a, north], { structure: 'bridge' }), road([junction, east])]);
  const across = bridge.advance(bridge.nearest(a, 0)!, distance(a, junction) + .02, 'right');
  assert.equal(graph.sample(result.cursor).heading > 0, true);
  assert.ok(Math.abs(bridge.sample(across.cursor).position[0] - a[0]) < 1e-7);
});
test('reverse retraces the chosen branch and cannot fly beyond the loaded road network', () => {
  const graph = network(); const cursor = graph.nearest(a, 0)!;
  const forward = graph.advance(cursor, distance(a, junction) + .03, 'left');
  const reverse = graph.advance(forward.cursor, -.05, null);
  const point = graph.sample(reverse.cursor).position;
  assert.ok(Math.abs(point[0] - a[0]) < 1e-7 && point[1] < junction[1]);
  const end = graph.advance(cursor, 10, 'straight');
  assert.ok(end.blocked);
  assert.deepEqual(graph.sample(end.cursor).position, north);
});
test('grade-separated crossings, pedestrian paths and restricted roads are not selectable', () => {
  const graph = new RoadNetwork();
  graph.ingest([road([a, junction, north]), road([west, junction, east], { structure: 'bridge' }), road([junction, [74.001, 31.002]], { class: 'path' }), road([junction, [73.999, 31.002]], { access: 'restricted' })]);
  assert.equal(graph.junction(graph.nearest(a, 0)!, 300)?.choices.length, 0);
});
test('tile duplicates do not duplicate choices, and one-way roads have forward edges only', () => {
  const graph = network(); const size = graph.edges.size;
  graph.ingest([road([a, junction, north]), road([west, junction, east])]);
  assert.equal(graph.edges.size, size);
  const oneWay = new RoadNetwork(); oneWay.ingest([road([a, junction], { oneway: 'true' })]);
  assert.equal(oneWay.edges.size, 1);
  assert.equal(oneWay.nearest([80, 40], 0), null);
});

test('dense dynamic routes interpolate endpoints and intermediate positions', () => {
  const points: Coordinate[] = [[74, 31], [74, 31], [74, 31.001], [74.002, 31.001]];
  const route = createDrivingRoute(points, DEFAULT_START, DEFAULT_END);
  assert.deepEqual(sampleDrivingRoute(route, 0).position, points[0]);
  assert.deepEqual(sampleDrivingRoute(route, route.distanceKm).position, points.at(-1));
  for (let i = 0; i <= 100; i++) {
    const sample = sampleDrivingRoute(route, route.distanceKm * i / 100);
    assert.ok(sample.position.every(Number.isFinite));
    assert.ok(Number.isFinite(sample.bearing));
  }
  assert.throws(() => createDrivingRoute([[74, 31], [74, 31]], DEFAULT_START, DEFAULT_END));
  assert.throws(() => createDrivingRoute([[200, 31], [74, 31]], DEFAULT_START, DEFAULT_END));
});
test('coordinate searches use latitude, longitude and enforce bounds', async () => {
  const places = await searchPlaces('31.5204, 74.3587', '', new AbortController().signal);
  assert.deepEqual(places[0].coordinate, [74.3587, 31.5204]);
  await assert.rejects(searchPlaces('91, 74', '', new AbortController().signal));
});
test('Directions NoRoute and HTTP authorization failures are handled', async () => {
  const original = globalThis.fetch;
  try {
    globalThis.fetch = async () => new Response(JSON.stringify({ code: 'NoRoute', routes: [] }), { status: 200 });
    await assert.rejects(fetchDrivingRoute(DEFAULT_START, DEFAULT_END, 'pk.test', new AbortController().signal), /No drivable route/);
    globalThis.fetch = async () => new Response('', { status: 403 });
    await assert.rejects(fetchDrivingRoute(DEFAULT_START, DEFAULT_END, 'pk.test', new AbortController().signal), /authorize routing/);
  } finally { globalThis.fetch = original; }
});
test('Directions uses returned road geometry and snapped endpoints', async () => {
  const original = globalThis.fetch;
  const coordinates = [[74.3586, 31.5203], [74.351, 31.511], [74.3435, 31.5015]];
  try {
    globalThis.fetch = async () => new Response(JSON.stringify({ code: 'Ok', routes: [{ geometry: { type: 'LineString', coordinates }, duration: 300 }] }), { status: 200 });
    const route = await fetchDrivingRoute(DEFAULT_START, DEFAULT_END, 'pk.test', new AbortController().signal);
    assert.deepEqual(route.start.coordinate, coordinates[0]);
    assert.deepEqual(route.end.coordinate, coordinates.at(-1));
    assert.equal(route.durationSeconds, 300);
  } finally { globalThis.fetch = original; }
});

test('advance accurately tracks covered distance in km across forward driving and reversing', () => {
  const graph = network();
  const cursor = graph.nearest(a, 0)!;
  const forwardStep = graph.advance(cursor, .03, 'straight');
  assert.equal(forwardStep.blocked, null);
  assert.ok(Math.abs(forwardStep.movedKm - .03) < 1e-6);

  // Reversing along driven history also counts toward total distance covered
  const reverseStep = graph.advance(forwardStep.cursor, -.02, null);
  assert.equal(reverseStep.blocked, null);
  assert.ok(Math.abs(reverseStep.movedKm - .02) < 1e-6);

  // When stopped at the end of driven history, movedKm is bounded to available travel
  const blockedReverse = graph.advance(reverseStep.cursor, -.05, null);
  assert.ok(blockedReverse.blocked);
  assert.ok(blockedReverse.movedKm < .02);
});







