import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { currentLocation } from '../lib/geolocation';

const PRECISE = { enableHighAccuracy: true, timeout: 6000, maximumAge: 30000 };
const COARSE = { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 };

function device() {
  const calls: Array<{ success: PositionCallback; failure: PositionErrorCallback; options?: PositionOptions }> = [];
  const geolocation = { getCurrentPosition(onSuccess: PositionCallback, onError?: PositionErrorCallback | null, settings?: PositionOptions) {
    calls.push({ success: onSuccess, failure: onError!, options: settings });
  } };
  return {
    geolocation,
    success: (latitude: number, longitude: number, index = calls.length - 1) => calls[index].success({ coords: { latitude, longitude } } as GeolocationPosition),
    failure: (code: number, index = calls.length - 1) => calls[index].failure({ code } as GeolocationPositionError),
    options: (index: number) => calls[index].options,
    count: () => calls.length
  };
}

/** Drains pending promise continuations, including a fallback attempt. */
const flush = async () => { for (let index = 0; index < 10; index++) await new Promise<void>(resolve => setImmediate(resolve)); };

test('device location becomes a selected place in longitude/latitude order', async () => {
  const gps = device();
  const result = currentLocation(gps.geolocation, new AbortController().signal);
  gps.success(31.446, 74.269);
  const place = await result;
  assert.deepEqual(place.coordinate, [74.269, 31.446]);
  assert.match(place.label, /My location/);
  assert.deepEqual(gps.options(0), PRECISE);
  assert.equal(gps.count(), 1);
});

test('a timed-out precise fix falls back to one coarse network fix', async () => {
  const gps = device();
  const result = currentLocation(gps.geolocation, new AbortController().signal);
  gps.failure(3);
  await flush();
  assert.deepEqual(gps.options(1), COARSE);
  gps.success(31.5497, 74.3436, 1);
  const place = await result;
  assert.deepEqual(place.coordinate, [74.3436, 31.5497]);
  assert.equal(gps.count(), 2);
});

test('denied fixes are final; unavailable and timed-out fixes retry once and report the last failure', async () => {
  const denied = device();
  const deniedResult = currentLocation(denied.geolocation, new AbortController().signal);
  denied.failure(1);
  await assert.rejects(deniedResult, /denied/);
  assert.equal(denied.count(), 1);
  for (const [code, text] of [[2, /unavailable/], [3, /timed out/]] as const) {
    const gps = device();
    const result = currentLocation(gps.geolocation, new AbortController().signal);
    gps.failure(code);
    await flush();
    gps.failure(code);
    await assert.rejects(result, text);
    assert.equal(gps.count(), 2);
  }
});

test('a provider that never answers still settles, retries coarse and can succeed', async () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const gps = device();
    const result = currentLocation(gps.geolocation, new AbortController().signal);
    mock.timers.tick(PRECISE.timeout! + 2500);
    await flush();
    assert.equal(gps.count(), 2);
    assert.deepEqual(gps.options(1), COARSE);
    gps.success(31.5497, 74.3436, 1);
    const place = await result;
    assert.deepEqual(place.coordinate, [74.3436, 31.5497]);
  } finally {
    mock.timers.reset();
  }
});

test('a provider that never answers both attempts reports a timeout instead of hanging', async () => {
  mock.timers.enable({ apis: ['setTimeout'] });
  try {
    const gps = device();
    const result = currentLocation(gps.geolocation, new AbortController().signal);
    mock.timers.tick(PRECISE.timeout! + 2500);
    await flush();
    mock.timers.tick(COARSE.timeout! + 2500);
    await assert.rejects(result, /timed out/);
    assert.equal(gps.count(), 2);
  } finally {
    mock.timers.reset();
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
  assert.equal(gps.count(), 1);
  let called = false;
  const aborted = new AbortController(); aborted.abort();
  await assert.rejects(currentLocation({ getCurrentPosition() { called = true; } }, aborted.signal), { name: 'AbortError' });
  assert.equal(called, false);
});

test('invalid device fixes and browser exceptions leave the endpoint unset', async () => {
  for (const [latitude, longitude] of [[NaN, 74], [91, 74], [31, 181]]) {
    const gps = device();
    const result = currentLocation(gps.geolocation, new AbortController().signal);
    gps.success(latitude, longitude);
    await assert.rejects(result, /invalid location/);
    assert.equal(gps.count(), 1);
  }
  await assert.rejects(currentLocation({ getCurrentPosition() { throw new Error('Browser blocked access'); } }, new AbortController().signal), /Unable to request/);
});
