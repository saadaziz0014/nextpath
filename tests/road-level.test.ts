import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RoadNetwork } from '../lib/roadNetwork';
import { roadLevelFromProperties } from '../lib/roadLevel';

test('explicit structures take priority over layer, while layer-only roads use general level labels', () => {
  assert.equal(roadLevelFromProperties({ structure: 'bridge', layer: 0 }), 'bridge');
  assert.equal(roadLevelFromProperties({ structure: 'tunnel', layer: 1 }), 'tunnel');
  assert.equal(roadLevelFromProperties({ layer: '2' }), 'elevated');
  assert.equal(roadLevelFromProperties({ layer: -1 }), 'underground');
  assert.equal(roadLevelFromProperties({}), 'ground');
  assert.equal(roadLevelFromProperties({ layer: 'invalid' }), 'ground');
});

test('road structure metadata survives tile-driven edge splitting and reverse edges', () => {
  const graph = new RoadNetwork();
  graph.ingest([{ type: 'Feature', properties: { class: 'street', structure: 'bridge', layer: 0 }, geometry: { type: 'LineString', coordinates: [[74, 31], [74, 31.002]] } }]);
  const forward = graph.nearest([74, 31.0002], 0)!;
  const backward = graph.nearest([74, 31.0018], 180)!;
  graph.ingest([{ type: 'Feature', properties: { class: 'street', layer: 0 }, geometry: { type: 'LineString', coordinates: [[74, 31.001], [74.001, 31.001]] } }]);
  for (const cursor of [forward, backward]) {
    assert.equal(graph.sample(cursor).roadLevel, 'bridge');
    const moved = graph.advance(cursor, .1, null);
    assert.equal(moved.blocked, null);
    assert.equal(graph.sample(moved.cursor).roadLevel, 'bridge');
  }
});
