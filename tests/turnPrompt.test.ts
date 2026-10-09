import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RoadNetwork } from '../lib/roadNetwork';
import { getTurnPrompt } from '../lib/turnPrompt';

test('junction prompt starts at 50m, includes only connected choices, and dismisses per junction', () => {
  const graph = new RoadNetwork();
  graph.ingest([{ type: 'Feature', properties: { class: 'street' }, geometry: { type: 'LineString', coordinates: [[74, 31], [74, 31.001], [74, 31.002]] } }, { type: 'Feature', properties: { class: 'street' }, geometry: { type: 'LineString', coordinates: [[74, 31.001], [74.001, 31.001]] } }]);
  const junction = graph.junction(graph.nearest([74, 31], 0)!)!;
  assert.equal(getTurnPrompt({ ...junction, meters: 50.01 }, null), null);
  const prompt = getTurnPrompt({ ...junction, meters: 50 }, null)!;
  assert.deepEqual(new Set(prompt.turns), new Set(['straight', 'right']));
  assert.equal(getTurnPrompt({ ...junction, meters: 20 }, prompt.id), null);
  assert.ok(getTurnPrompt({ ...junction, meters: 0 }, 'another-junction'));
  assert.equal(getTurnPrompt(null, null), null);
  assert.equal(getTurnPrompt({ meters: 0, choices: [] }, null), null);
  const onlyStraight = junction.choices.filter(choice => choice.turn === 'straight');
  assert.equal(getTurnPrompt({ meters: 10, choices: onlyStraight }, null), null);
});
