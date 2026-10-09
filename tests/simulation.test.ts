import { test } from 'node:test';
import assert from 'node:assert/strict';
import { smoothBearing } from '../lib/simulation';
test('heading crosses north by the shortest angle, including unwrapped headings', () => {
  assert.equal(smoothBearing(359, 1, .5), 360);
  assert.equal(smoothBearing(1, 359, .5), 0);
  assert.equal(smoothBearing(1081, 359, .5), 1080);
  assert.equal(smoothBearing(-1081, 1, .5), -1080);
});
test('angular smoothing clamps the interpolation factor', () => {
  assert.equal(smoothBearing(0, 90, -1), 0);
  assert.equal(smoothBearing(0, 90, 2), 90);
});
