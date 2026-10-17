import { test } from 'node:test';
import assert from 'node:assert/strict';
import { destination, distance } from '@turf/turf';
import { RoadNetwork } from '../lib/roadNetwork';
import type { Coordinate } from '../lib/routeData';
import type { Feature, LineString } from 'geojson';

const road = (coordinates: Coordinate[], properties: Record<string, unknown> = {}): Feature<LineString> => ({ type: 'Feature', properties: { class: 'street', ...properties }, geometry: { type: 'LineString', coordinates } });
const at = (origin: Coordinate, bearing: number, meters: number): Coordinate => destination(origin, meters / 1000, bearing).geometry.coordinates as Coordinate;
const start: Coordinate = [74, 31], junction: Coordinate = [74, 31.001];

test('driving straight past a shallow U-turn opening keeps the main road', () => {
  const graph = new RoadNetwork();
  // The main road continues through a short skewed stub; the U-turn lane leaves
  // at a shallow angle before curving back across the median.
  const stub = at(junction, 40, 9), north = at(stub, 0, 120);
  const u1 = at(junction, -20, 10), u2 = at(u1, -80, 10), u3 = at(u2, -170, 25);
  graph.ingest([road([start, junction]), road([junction, stub, north]), road([junction, u1, u2, u3])]);

  const cursor = graph.nearest(start, 0)!;
  const opening = graph.junction(cursor)!;
  const straights = opening.choices.filter(choice => choice.turn === 'straight');
  assert.equal(straights.length, 1, 'only the connected through road is a straight exit');
  const uTurn = opening.choices.find(choice => choice.turn === 'left')!;
  assert.ok(uTurn, 'the U-turn departure is a turn, not a straight continuation');
  assert.ok(uTurn.exitAngle < -60, 'the exit is judged by where it actually leads');

  const driven = graph.advance(cursor, distance(start, junction) + .012, null);
  assert.equal(driven.blocked, null);
  const point = graph.sample(driven.cursor).position;
  assert.ok(point[1] > junction[1], 'the car crossed the opening');
  assert.ok(point[0] > junction[0], 'the car stayed on the main road, not the U-turn lane');
});

test('an intentional U-turn selects the connector through driver input', () => {
  const graph = new RoadNetwork();
  const u1 = at(junction, -20, 10), u2 = at(u1, -80, 10), u3 = at(u2, -170, 25);
  const stub = at(junction, 40, 9), north = at(stub, 0, 120);
  graph.ingest([road([start, junction]), road([junction, stub, north]), road([junction, u1, u2, u3])]);

  const cursor = graph.nearest(start, 0)!;
  const near = graph.advance(cursor, distance(start, junction) - .04, null).cursor;
  const decision = graph.decide(near, 'left');
  assert.ok(decision, 'A commits the connected U-turn lane');
  const turned = graph.advance(near, .05, null, decision);
  assert.equal(turned.blocked, null);
  assert.equal(turned.decisionPassed, true);
  assert.ok(graph.sample(turned.cursor).position[0] < junction[0], 'the car entered the U-turn lane');
});

test('a near-aligned side road curving away does not beat the named through road', () => {
  const graph = new RoadNetwork();
  const mainBend = at(junction, 16, 10), mainAhead = at(mainBend, 0, 150);
  const sideBend = at(junction, -4, 15), sideAway = at(sideBend, 80, 40);
  graph.ingest([
    road([start, junction], { name: 'Main Road' }),
    road([junction, mainBend, mainAhead], { name: 'Main Road' }),
    road([junction, sideBend, sideAway], { name: 'Side Road' }),
  ]);

  const cursor = graph.nearest(start, 0)!;
  const view = graph.junction(cursor)!;
  assert.equal(view.choices.find(choice => choice.edge.name === 'Main Road')!.turn, 'straight');
  assert.equal(view.choices.find(choice => choice.edge.name === 'Side Road')!.turn, 'right');
  const driven = graph.advance(cursor, distance(start, junction) + .02, null);
  assert.equal(driven.blocked, null);
  assert.equal(graph.sample(driven.cursor).name, 'Main Road');
});

test('a named through road wins a near-collinear four-way junction', () => {
  const graph = new RoadNetwork();
  const through = at(junction, 10, 160);
  const crossA = at(junction, -6, 160), crossB = at(junction, 174, 160);
  graph.ingest([
    road([start, junction], { name: 'Ferozepur Road' }),
    road([junction, through], { name: 'Ferozepur Road' }),
    road([crossB, junction, crossA], { name: 'Canal Road' }),
  ]);
  const driven = graph.advance(graph.nearest(start, 0)!, distance(start, junction) + .02, null);
  assert.equal(driven.blocked, null);
  assert.equal(graph.sample(driven.cursor).name, 'Ferozepur Road');
});

test('a missing continuation never auto-follows a U-turn exit and driving recovers when tiles load', () => {
  const graph = new RoadNetwork();
  const u1 = at(junction, -20, 10), u2 = at(u1, -80, 10);
  graph.ingest([road([start, junction]), road([junction, u1, u2])]);
  const cursor = graph.nearest(start, 0)!;
  const stopped = graph.advance(cursor, distance(start, junction) + .02, null);
  assert.match(stopped.blocked!, /No road ahead/);
  assert.deepEqual(graph.sample(stopped.cursor).position, junction);

  // New tiles deliver the continuation at the same node: holding W moves on.
  const stub = at(junction, 12, 8), north = at(stub, 0, 120);
  graph.ingest([road([junction, stub, north])]);
  const resumed = graph.advance(stopped.cursor, .02, null);
  assert.equal(resumed.blocked, null);
  const point = graph.sample(resumed.cursor).position;
  assert.ok(point[0] > junction[0] && point[1] > junction[1]);
});

test('a skewed first segment on a named through road continues without input', () => {
  const graph = new RoadNetwork();
  const stub = at(junction, 52, 12), ahead = at(stub, 0, 140);
  graph.ingest([road([start, junction], { name: 'Canal Road' }), road([junction, stub, ahead], { name: 'Canal Road' })]);
  const driven = graph.advance(graph.nearest(start, 0)!, distance(start, junction) + .02, null);
  assert.equal(driven.blocked, null);
  assert.equal(graph.sample(driven.cursor).name, 'Canal Road');
  assert.ok(graph.sample(driven.cursor).position[1] > junction[1]);
});

test('driver A/D selects a shallow service-road branch while W keeps the main road', () => {
  const graph = new RoadNetwork();
  const mainAhead = at(junction, 4, 140), serviceAhead = at(junction, -4, 140);
  graph.ingest([
    road([start, junction], { name: 'Main Boulevard' }),
    road([junction, mainAhead], { name: 'Main Boulevard' }),
    road([junction, serviceAhead], { name: 'Service Road' }),
  ]);
  const cursor = graph.nearest(start, 0)!;
  const view = graph.junction(cursor)!;
  assert.equal(view.choices.length, 2);
  assert.ok(view.choices.every(choice => choice.turn === 'straight'), 'a shallow fork is straight for both branches');
  const held = graph.advance(cursor, distance(start, junction) + .02, null);
  assert.equal(graph.sample(held.cursor).name, 'Main Boulevard');

  const near = graph.advance(cursor, distance(start, junction) - .04, null).cursor;
  const decision = graph.decide(near, 'left');
  assert.ok(decision, 'A picks the left-leaning branch of a shallow fork');
  const turned = graph.advance(near, .05, null, decision);
  assert.equal(turned.blocked, null);
  assert.equal(graph.sample(turned.cursor).name, 'Service Road');
});

test('nearest snapping prefers the road matching the vehicle heading over a closer opposite carriageway', () => {
  const graph = new RoadNetwork();
  const northboundStart: Coordinate = [74, 31], southboundStart = at(northboundStart, 90, 16);
  const northboundEnd = at(northboundStart, 0, 250), southboundEnd = at(southboundStart, 180, 250);
  graph.ingest([
    road([northboundStart, northboundEnd], { oneway: 'true' }),
    road([southboundStart, southboundEnd], { oneway: 'true' }),
  ]);
  const position = at(southboundStart, 45, 1);
  const north = graph.nearest(position, 0)!;
  assert.ok(Math.abs(graph.sample(north).position[0] - northboundStart[0]) < 1e-5, 'northbound heading snaps to the northbound carriageway');
  assert.ok(Math.abs(graph.sample(north).heading) < 1);
  const south = graph.nearest(position, 180)!;
  assert.ok(Math.abs(graph.sample(south).heading - 180) < 1, 'southbound heading snaps to the southbound carriageway');
});
