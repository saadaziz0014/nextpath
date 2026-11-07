import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { distance } from '@turf/turf';
import { indexTrack, reversePath } from '../lib/rail/track';
import { TRAINS, servicePath } from '../lib/rail/trains';
import {
  buildTrackSections, clipTrackSections, offsetCoordinate, offsetLineCoordinates,
  trackCountFromTags, trackSectionAt, reverseTrackSections, sliceTrackCoordinates,
  TRACK_OFFSET_METERS,
} from '../lib/rail/trackSections';
import type { RailDataset } from '../lib/rail/types';

const dataset = JSON.parse(readFileSync('public/data/rail/ml1.json', 'utf8')) as RailDataset;

test('OSM track counts prefer the physical tracks tag and never invent a count', () => {
  assert.equal(trackCountFromTags({ passenger_lines: '2' }), 2);
  assert.equal(trackCountFromTags({ tracks: '1', passenger_lines: '2' }), 1);
  assert.equal(trackCountFromTags({ passenger_lines: '4' }), 4);
  assert.equal(trackCountFromTags({ passenger_lines: 'yes' }), null);
  assert.equal(trackCountFromTags({ passenger_lines: '0' }), null);
  assert.equal(trackCountFromTags({ usage: 'main' }), null);
  assert.equal(trackCountFromTags(undefined), null);
});

test('sections merge equal counts and keep unstated runs distinct', () => {
  const coordinates: [number, number][] = [[74, 31], [74, 31.01], [74, 31.02], [74.01, 31.02], [74.02, 31.02]];
  const sections = buildTrackSections(coordinates, [1, 1, 2, null]);
  assert.deepEqual(sections.map(section => section.tracks), [1, 2, null]);
  assert.equal(sections[0].startKm, 0);
  assert.equal(sections.at(-1)!.endKm, indexTrack({ id: 'tezgam', name: 'test', coordinates, stations: [], distanceKm: 0 }).lengthKm);
  for (let i = 1; i < sections.length; i++) assert.ok(Math.abs(sections[i].startKm - sections[i - 1].endKm) < .000001);
});

test('trackSectionAt uses the next section at an exact boundary and clamps route ends', () => {
  const sections = [{ startKm: 0, endKm: 10, tracks: 1 }, { startKm: 10, endKm: 30, tracks: 2 }, { startKm: 30, endKm: 40, tracks: null }] as const;
  assert.equal(trackSectionAt(sections, 0)!.tracks, 1);
  assert.equal(trackSectionAt(sections, 9.999)!.tracks, 1);
  assert.equal(trackSectionAt(sections, 10)!.tracks, 2);
  assert.equal(trackSectionAt(sections, 40)!.tracks, null);
  assert.equal(trackSectionAt(sections, 99)!.tracks, null);
  assert.equal(trackSectionAt(undefined, 10), null);
});

test('reverse and clip preserve physical section order and coverage', () => {
  const sections = [{ startKm: 0, endKm: 10, tracks: 1 }, { startKm: 10, endKm: 30, tracks: 2 }, { startKm: 30, endKm: 40, tracks: null }] as const;
  const reversed = reverseTrackSections(sections, 40);
  assert.deepEqual(reversed, [{ startKm: 0, endKm: 10, tracks: null }, { startKm: 10, endKm: 30, tracks: 2 }, { startKm: 30, endKm: 40, tracks: 1 }]);
  assert.equal(trackSectionAt(reversed, 5)!.tracks, null);
  assert.deepEqual(clipTrackSections(sections, 25), [{ startKm: 0, endKm: 10, tracks: 1 }, { startKm: 10, endKm: 25, tracks: 2 }]);
});

test('every bundled route has contiguous sourced sections and a sourced double-track section', () => {
  for (const path of dataset.paths) {
    const sections = path.trackSections;
    assert.ok(sections?.length, `Missing track sections for ${path.id}`);
    assert.ok(Math.abs(sections[0].startKm) < .000001);
    assert.ok(Math.abs(sections.at(-1)!.endKm - path.distanceKm) < .000001);
    for (let i = 1; i < sections.length; i++) assert.ok(Math.abs(sections[i].startKm - sections[i - 1].endKm) < .000001, `Gap in ${path.id}`);
    for (let i = 0; i <= 20; i++) assert.ok(trackSectionAt(sections, path.distanceKm * i / 20), `No section at ${path.id} ${i * 5}%`);
  }
  const south = dataset.paths.find(path => path.id === 'south')!;
  assert.ok(south.trackSections!.some(section => section.tracks !== null && section.tracks >= 2), 'ML-1 south should include a mapped double-track run');
  const branch = dataset.paths.find(path => path.id === 'branch')!;
  assert.ok(branch.trackSections!.some(section => section.tracks === 1), 'The Lodhran–Mandi Burewala branch should include mapped single track');
  assert.ok(branch.trackSections!.every(section => section.tracks === null || section.tracks === 1), 'The branch has no mapped double-track run');
});

test('service and reverse directions carry mirrored track sections', () => {
  const source = dataset.paths.find(path => path.id === 'awam')!;
  const down = reversePath(source);
  assert.ok(down.trackSections?.length);
  for (const km of [0, source.distanceKm / 3, source.distanceKm / 2, source.distanceKm]) {
    const original = trackSectionAt(source.trackSections, source.distanceKm - km);
    const mirrored = trackSectionAt(down.trackSections, km);
    assert.equal(mirrored?.tracks ?? null, original?.tracks ?? null);
  }
  const train = TRAINS.find(item => item.id === 'awam-express')!;
  const service = servicePath(dataset, train, train.services[0]);
  assert.deepEqual(service.trackSections, source.trackSections);
});

test('double-track placement moves the train one rail left of its heading', () => {
  const point: [number, number] = [74, 31];
  const left = offsetCoordinate(point, 0, -TRACK_OFFSET_METERS);
  const right = offsetCoordinate(point, 0, TRACK_OFFSET_METERS);
  assert.ok(Math.abs(distance(left, point) * 1000 - TRACK_OFFSET_METERS) < .01);
  assert.ok(Math.abs(distance(right, point) * 1000 - TRACK_OFFSET_METERS) < .01);
  assert.ok(left[0] < point[0] && right[0] > point[0], 'Northbound left is west');
  // Eastbound left is north, not south, so an Up and a Down train use opposite rails.
  assert.ok(offsetCoordinate(point, 90, -TRACK_OFFSET_METERS)[1] > point[1]);
  const line: [number, number][] = [point, [74, 31.01]];
  const offset = offsetLineCoordinates(line, -TRACK_OFFSET_METERS);
  assert.equal(offset.length, 2);
  offset.forEach((coordinate, index) => assert.ok(Math.abs(distance(coordinate, line[index]) * 1000 - TRACK_OFFSET_METERS) < .01));
  assert.deepEqual(offsetLineCoordinates(line, 0), line);
});

test('geometry slices start and end at the requested chainages', () => {
  const path = dataset.paths.find(path => path.id === 'north')!;
  const track = indexTrack(path);
  const coordinates = sliceTrackCoordinates(track, 123.4, 156.7);
  assert.ok(coordinates.length >= 2);
  assert.ok(distance(coordinates[0], sampleAt(track, 123.4)) < .000001);
  assert.ok(distance(coordinates.at(-1)!, sampleAt(track, 156.7)) < .000001);
});

function sampleAt(track: ReturnType<typeof indexTrack>, km: number) {
  // Local copy avoids importing the map renderer's chainage sampler.
  let low = 0, high = track.cumulative.length - 1;
  while (low + 1 < high) { const mid = (low + high) >>> 1; if (track.cumulative[mid] <= km) low = mid; else high = mid; }
  const a = track.path.coordinates[low], b = track.path.coordinates[low + 1];
  const ratio = (km - track.cumulative[low]) / (track.cumulative[low + 1] - track.cumulative[low]);
  return [a[0] + (b[0] - a[0]) * ratio, a[1] + (b[1] - a[1]) * ratio] as [number, number];
}
