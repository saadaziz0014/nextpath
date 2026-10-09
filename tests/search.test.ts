import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchPlaces, DEFAULT_START } from '../lib/routes';

test('search defaults to Pakistan, biases to the map view, and allows explicit worldwide searches', async () => {
  const previous = globalThis.fetch;
  const urls: URL[] = [];
  globalThis.fetch = async input => {
    urls.push(new URL(String(input)));
    return new Response(JSON.stringify({ features: [{ geometry: { coordinates: [74.3, 31.5] }, properties: { full_address: 'Gulberg, Lahore, Punjab, Pakistan' } }] }));
  };
  try {
    const places = await searchPlaces('Gulberg', 'pk.test', new AbortController().signal);
    assert.equal(urls[0].searchParams.get('country'), 'pk');
    assert.equal(urls[0].searchParams.get('proximity'), DEFAULT_START.coordinate.join(','));
    assert.equal(urls[0].searchParams.get('limit'), '10');
    assert.equal(places[0].label, 'Gulberg, Lahore, Punjab, Pakistan');
    await searchPlaces('Gulberg', 'pk.test', new AbortController().signal, { proximity: [67.01, 24.86] });
    assert.equal(urls[1].searchParams.get('proximity'), '67.01,24.86');
    await searchPlaces('London', 'pk.test', new AbortController().signal, { country: 'worldwide' });
    assert.equal(urls[2].searchParams.has('country'), false);
    const coordinates = await searchPlaces('51.5, -0.1', 'pk.test', new AbortController().signal);
    assert.equal(urls.length, 3); // Coordinates do not require a geocoding request.
    assert.deepEqual(coordinates[0].coordinate, [-0.1, 51.5]);
  } finally { globalThis.fetch = previous; }
});
