import { test } from 'node:test';
import assert from 'node:assert/strict';
import { distance } from '@turf/turf';
import { RoadNetwork } from '../lib/roadNetwork';
import type { Coordinate } from '../lib/routeData';
import type { Feature, LineString } from 'geojson';
const start: Coordinate = [74, 31], node: Coordinate = [74, 31.001], end: Coordinate = [74, 31.002];
const road = (coordinates: Coordinate[]): Feature<LineString> => ({ type: 'Feature', properties: { class: 'street' }, geometry: { type: 'LineString', coordinates } });

test('straight commitment uses the chosen connected road after tile geometry splits it', () => {
  const graph = new RoadNetwork(); graph.ingest([road([start, node, end]), road([node, [74.001, 31.001]])]);
  const cursor = graph.advance(graph.nearest(start, 0)!, distance(start, node) - .04, null).cursor;
  const decision = graph.decide(cursor, 'straight')!;
  assert.ok(decision);
  assert.equal(graph.decide(graph.nearest(start, 0)!, 'straight'), null);
  assert.equal(graph.decide(cursor, 'left'), null);
  graph.ingest([road([[74, 31.0015], [73.999, 31.0015]])]);
  const result = graph.advance(cursor, .08, null, decision);
  assert.equal(result.blocked, null);
  assert.equal(result.decisionPassed, true);
  assert.ok(graph.sample(result.cursor).position[1] > node[1]);
  assert.ok(Math.abs(graph.sample(result.cursor).position[0] - start[0]) < 1e-7);
});

test('committed right turn is not replaced by a competing direction and completes only at its node', () => {
  const graph = new RoadNetwork(); graph.ingest([road([start, node, end]), road([[73.999, 31.001], node, [74.001, 31.001]])]);
  const cursor = graph.advance(graph.nearest(start, 0)!, distance(start, node) - .04, null).cursor;
  const decision = graph.decide(cursor, 'right')!;
  const approaching = graph.advance(cursor, .01, 'left', decision);
  assert.equal(approaching.decisionPassed, false);
  const result = graph.advance(approaching.cursor, .05, 'left', decision);
  assert.equal(result.blocked, null);
  assert.equal(result.decisionPassed, true);
  assert.ok(graph.sample(result.cursor).position[0] > node[0]);
});
