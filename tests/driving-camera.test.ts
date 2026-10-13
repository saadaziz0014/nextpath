import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drivingCameraPadding, drivingCameraOptions, vehicleScreenHeading } from '../lib/drivingCamera';
import { RoadNetwork } from '../lib/roadNetwork';
import { nextVelocity } from '../lib/driving';
import { bearing } from '@turf/turf';

test('W moves toward the car nose for north, south, east and west driving', () => {
  for (const end of [[74, 31.001], [74, 30.999], [74.001, 31], [73.999, 31]]) {
    const graph = new RoadNetwork();
    graph.ingest([{ type: 'Feature', properties: { class: 'street', oneway: 'true' }, geometry: { type: 'LineString', coordinates: [[74, 31], end] } }]);
    const heading = bearing([74, 31], end);
    const cursor = graph.nearest([74, 31], heading)!;
    const before = graph.sample(cursor);
    const velocity = nextVelocity(0, new Set(['w']), .1);
    const after = graph.sample(graph.advance(cursor, velocity * .1 / 1000, null).cursor);
    const movementHeading = bearing(before.position, after.position);
    assert.ok(Math.abs(vehicleScreenHeading(movementHeading, before.heading)) < .01);
    assert.equal(vehicleScreenHeading(before.heading, before.heading), 0);
  }
});

test('car orientation compensates for explored cameras and crosses north correctly', () => {
  assert.equal(vehicleScreenHeading(180, 0), -180);
  assert.equal(vehicleScreenHeading(90, 0), 90);
  assert.equal(vehicleScreenHeading(359, 1), -2);
  assert.equal(vehicleScreenHeading(1, 359), 2);
  assert.equal(vehicleScreenHeading(1081, 1), 0);
});

test('following yields to zoom gestures, then resumes without resetting the chosen zoom', () => {
  const input = { position: [74, 31] as [number, number], bearing: 180, padding: { top: 80, bottom: 40, left: 440, right: 48 }, recenter: false, zooming: false, now: 1000, zoomIntentUntil: 1100 };
  assert.equal(drivingCameraOptions(input), null);
  assert.equal(drivingCameraOptions({ ...input, now: 1200, zooming: true }), null);
  const resumed = drivingCameraOptions({ ...input, now: 1200 })!;
  assert.equal('zoom' in resumed, false);
  assert.equal(resumed.bearing, 180);
  assert.equal(resumed.pitch, 50);
  assert.deepEqual(resumed.center, input.position);
  const recentered = drivingCameraOptions({ ...input, recenter: true })!;
  assert.equal(recentered.zoom, 16.5);
});

test('desktop follow leaves the car to the right of controls with more road ahead', () => {
  const view = { width: 1280, height: 800, controlsTop: 360, controlsRight: 408, plannerBottom: 100 };
  const padding = drivingCameraPadding(view);
  const carX = (padding.left + view.width - padding.right) / 2;
  const carY = (padding.top + view.height - padding.bottom) / 2;
  assert.ok(carX > view.controlsRight + 40);
  assert.ok(carY > view.height / 2);
  assert.ok(view.height - padding.bottom - carY > 100);
});

test('mobile follow reserves the actual controls and adjusts when they expand', () => {
  for (const controlsTop of [480, 400, 340]) {
    const view = { width: 390, height: 844, controlsTop, controlsRight: 378, plannerBottom: 90 };
    const padding = drivingCameraPadding(view);
    const carY = (padding.top + view.height - padding.bottom) / 2;
    assert.ok(carY + 31 < controlsTop);
    assert.ok(carY - 62 > view.plannerBottom);
    assert.equal((padding.left + view.width - padding.right) / 2, view.width / 2);
  }
});

test('short, landscape and loading viewports always retain valid camera padding', () => {
  for (const [width, height] of [[390, 540], [844, 390], [640, 540], [0, 0]]) {
    const padding = drivingCameraPadding({ width, height, controlsTop: 50, controlsRight: 408, plannerBottom: 400 });
    assert.ok(padding.left + padding.right < Math.max(1, width));
    assert.ok(padding.top + padding.bottom < Math.max(1, height));
    assert.ok(Object.values(padding).every(value => Number.isFinite(value) && value >= 0));
  }
});
