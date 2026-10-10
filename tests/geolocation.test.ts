import { test } from 'node:test';
import assert from 'node:assert/strict';
import { currentLocation } from '../lib/geolocation';

function device() {
  let success!: PositionCallback;
  let failure!: PositionErrorCallback;
  let options: PositionOptions | undefined;
  const geolocation = { getCurrentPosition(onSuccess: PositionCallback, onError?: PositionErrorCallback | null, settings?: PositionOptions) {
    success = onSuccess; failure = onError!; options = settings;
  } };
  return { geolocation, success: (latitude: number, longitude: number) => success({ coords: { latitude, longitude } } as GeolocationPosition), failure: (code: number) => failure({ code } as GeolocationPositionError), options: () => options };
}

test('device location becomes a selected place in longitude/latitude order', async () => {
  const gps = device();
  const result = currentLocation(gps.geolocation, new AbortController().signal);
  gps.success(31.446, 74.269);
  const place = await result;
  assert.deepEqual(place.coordinate, [74.269, 31.446]);
  assert.match(place.label, /My location/);
  assert.deepEqual(gps.options(), { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
});

test('denied, unavailable and timed-out fixes give actionable errors', async () => {
  for (const [code, message] of [[1, /denied/], [2, /unavailable/], [3, /timed out/]] as const) {
    const gps = device();
    const result = currentLocation(gps.geolocation, new AbortController().signal);
    gps.failure(code);
    await assert.rejects(result, message);
  }
});

test('aborting ignores late location callbacks, and aborted requests never access the device', async () => {
  const gps = device();
  const controller = new AbortController();
  const result = currentLocation(gps.geolocation, controller.signal);
  controller.abort();
  gps.success(31.446, 74.269);
  gps.failure(2);
  await assert.rejects(result, { name: 'AbortError' });
  let called = false;
  await assert.rejects(currentLocation({ getCurrentPosition() { called = true; } }, controller.signal), { name: 'AbortError' });
  assert.equal(called, false);
});

test('invalid device fixes and browser exceptions leave the endpoint unset', async () => {
  for (const [latitude, longitude] of [[NaN, 74], [91, 74], [31, 181]]) {
    const gps = device();
    const result = currentLocation(gps.geolocation, new AbortController().signal);
    gps.success(latitude, longitude);
    await assert.rejects(result, /invalid location/);
  }
  await assert.rejects(currentLocation({ getCurrentPosition() { throw new Error('Browser blocked access'); } }, new AbortController().signal), /Unable to request/);
});
