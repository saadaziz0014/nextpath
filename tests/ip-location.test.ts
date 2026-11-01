import { test } from 'node:test';
import assert from 'node:assert/strict';
import { approximateLocation } from '../lib/ipLocation';

interface Call { url: string; signal?: AbortSignal | null }

function stub(payload: unknown, status = 200) {
  const previous = globalThis.fetch;
  const calls: Call[] = [];
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), signal: init?.signal });
    return new Response(typeof payload === 'string' ? payload : JSON.stringify(payload), { status });
  }) as typeof fetch;
  return { calls, restore: () => { globalThis.fetch = previous; } };
}

test('a city-level lookup becomes a labelled place in longitude/latitude order', async () => {
  const network = stub({ success: true, latitude: 31.5578824, longitude: 74.3507054, city: 'Lahore', country: 'Pakistan' });
  try {
    const place = await approximateLocation(new AbortController().signal);
    assert.deepEqual(place.coordinate, [74.3507054, 31.5578824]);
    assert.equal(place.label, 'Approximate location · Lahore');
    assert.match(network.calls[0].url, /^https:\/\/ipwho\.is\//);
    assert.ok(network.calls[0].signal);
  } finally {
    network.restore();
  }
});

test('a lookup without a usable city still fills a labelled place', async () => {
  const network = stub({ success: true, latitude: 24.86, longitude: 67.0, city: '', country: '  ' });
  try {
    const place = await approximateLocation(new AbortController().signal);
    assert.equal(place.label, 'Approximate location');
    assert.deepEqual(place.coordinate, [67.0, 24.86]);
  } finally {
    network.restore();
  }
});

test('failed, malformed and rejected lookups all leave the endpoint unset', async () => {
  const cases: Array<[unknown, number]> = [
    [{ success: false, message: 'Reserved range' }, 200],
    [{ success: true, latitude: 'north', longitude: 74 }, 200],
    [{ success: true, latitude: 91, longitude: 74 }, 200],
    [{ success: true, latitude: 31, longitude: 181 }, 200],
    [{ success: true, latitude: 31, longitude: 74 }, 429],
    ['<html>gateway error</html>', 200]
  ];
  for (const [payload, status] of cases) {
    const network = stub(payload, status);
    try {
      await assert.rejects(approximateLocation(new AbortController().signal), /Approximate location is unavailable/);
    } finally {
      network.restore();
    }
  }
});

test('network failures report the lookup as unavailable', async () => {
  const previous = globalThis.fetch;
  globalThis.fetch = (async () => { throw new TypeError('Failed to fetch'); }) as typeof fetch;
  try {
    await assert.rejects(approximateLocation(new AbortController().signal), /Approximate location is unavailable/);
  } finally {
    globalThis.fetch = previous;
  }
});

test('aborting the location click cancels the lookup instead of reporting a failure', async () => {
  const previous = globalThis.fetch;
  const controller = new AbortController();
  globalThis.fetch = ((_input: RequestInfo | URL, init?: RequestInit) => new Promise((_resolve, reject) => {
    const signal = init?.signal;
    const cancel = () => reject(new DOMException('cancelled', 'AbortError'));
    if (signal?.aborted) { cancel(); return; }
    signal?.addEventListener('abort', cancel, { once: true });
  })) as typeof fetch;
  try {
    const result = approximateLocation(controller.signal);
    controller.abort();
    await assert.rejects(result, { name: 'AbortError' });
  } finally {
    globalThis.fetch = previous;
  }
});
