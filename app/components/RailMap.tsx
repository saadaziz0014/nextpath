'use client';
import { memo, useMemo, useRef } from 'react';
import MapView, { Source, Layer, NavigationControl, type MapRef } from 'react-map-gl';
import type { ExpressionSpecification, Map as MapboxMap } from 'mapbox-gl';
import type { RailDataset, RailTrackSection } from '@/lib/rail/types';
import { indexTrack } from '@/lib/rail/track';
import { offsetLineCoordinates, sliceTrackCoordinates, TRACK_OFFSET_METERS } from '@/lib/rail/trackSections';

interface Props { dataset: RailDataset; token: string; onReady: (map: MapboxMap) => void; onFailure: (message: string) => void; onExplore: () => void }

const BRANCH_COLOR: ExpressionSpecification = ['match', ['get', 'branch'], 'chord', '#34d399', 'multan', '#fbbf24', 'south', '#38bdf8', 'north', '#f472b6', 'branch', '#a78bfa', 'kcr', '#60a5fa', 'jamalo', '#f43f5e', 'millat', '#facc15', 'mohenjo-daro', '#a3e635', 'subak-kharam', '#e879f9', 'pak-business', '#22d3ee', 'awam', '#f97316', 'green-line', '#84cc16', 'jaffar', '#c084fc', 'fareed', '#2dd4bf', 'musa-pak', '#fb923c', 'allama-iqbal', '#fbbf24', '#64748b'];

export default memo(function RailMap({ dataset, token, onReady, onFailure, onExplore }: Props) {
  const ref = useRef<MapRef>(null);
  const tracks = useMemo(() => ({ type: 'FeatureCollection' as const, features: dataset.paths.flatMap(path => {
    const track = indexTrack(path);
    const sections: RailTrackSection[] = path.trackSections?.length ? path.trackSections : [{ startKm: 0, endKm: path.distanceKm, tracks: 1 }];
    return sections.flatMap(section => {
      const coordinates = sliceTrackCoordinates(track, section.startKm, section.endKm);
      if (coordinates.length < 2) return [];
      const properties = { branch: path.id, tracks: section.tracks ?? 0, startKm: section.startKm, endKm: section.endKm };
      if (section.tracks !== null && section.tracks >= 2) {
        return [TRACK_OFFSET_METERS, -TRACK_OFFSET_METERS].map(offset => ({ type: 'Feature' as const, properties, geometry: { type: 'LineString' as const, coordinates: offsetLineCoordinates(coordinates, offset) } }));
      }
      return [{ type: 'Feature' as const, properties, geometry: { type: 'LineString' as const, coordinates } }];
    });
  }) }), [dataset]);
  const stations = useMemo(() => ({ type: 'FeatureCollection' as const, features: [...new Map(dataset.paths.flatMap(path => path.stations).map(station => [station.id, station])).values()].map(station => ({ type: 'Feature' as const, properties: { name: station.name }, geometry: { type: 'Point' as const, coordinates: station.coordinate } })) }), [dataset]);
  const start = dataset.paths[0].coordinates[0];
  return <div className="relative h-full w-full">
    <MapView ref={ref} mapboxAccessToken={token} mapStyle="mapbox://styles/mapbox/dark-v11" initialViewState={{ longitude: start[0], latitude: start[1], zoom: 16.5, pitch: 50 }} style={{ width: '100%', height: '100%' }} onDragStart={onExplore} onLoad={() => { if (ref.current) onReady(ref.current.getMap()); }} onError={event => onFailure(event.error.message)}>
      <Source id="rail-tracks" type="geojson" data={tracks} attribution={dataset.attribution}>
        <Layer id="rail-outline" type="line" paint={{ 'line-color': '#0f172a', 'line-width': 6, 'line-opacity': .9 }} />
        <Layer id="rail-double-band" type="line" filter={['>=', ['get', 'tracks'], 2]} paint={{ 'line-color': BRANCH_COLOR, 'line-width': 4.6, 'line-opacity': .22, 'line-blur': 1.2 }} />
        <Layer id="rail-single" type="line" filter={['==', ['get', 'tracks'], 1]} paint={{ 'line-color': BRANCH_COLOR, 'line-width': 2.2, 'line-opacity': .92 }} />
        <Layer id="rail-double" type="line" filter={['>=', ['get', 'tracks'], 2]} paint={{ 'line-color': BRANCH_COLOR, 'line-width': 1.7, 'line-opacity': .95 }} />
        <Layer id="rail-unverified" type="line" filter={['==', ['get', 'tracks'], 0]} paint={{ 'line-color': BRANCH_COLOR, 'line-width': 1.9, 'line-opacity': .8, 'line-dasharray': [1.6, 1.3] }} />
      </Source>
      <Source id="rail-stations" type="geojson" data={stations}>
        <Layer id="rail-station-dots" type="circle" paint={{ 'circle-radius': 6, 'circle-color': '#fff', 'circle-stroke-width': 2, 'circle-stroke-color': '#0284c7' }} />
        <Layer id="rail-station-labels" type="symbol" layout={{ 'text-field': ['get', 'name'], 'text-size': 12, 'text-offset': [0, 1.5], 'text-anchor': 'top' }} paint={{ 'text-color': '#fff', 'text-halo-color': '#0f172a', 'text-halo-width': 2 }} />
      </Source>
      <NavigationControl position="top-right" />
    </MapView>
    <div aria-label="Rail track legend" className="pointer-events-none absolute bottom-6 right-4 z-10 hidden rounded-xl border border-white/10 bg-slate-950/85 px-3 py-2.5 text-[11px] text-slate-200 shadow-lg backdrop-blur md:block">
      <p className="mb-1.5 font-semibold text-slate-100">Track type</p>
      <p className="mb-1 flex items-center gap-2"><span aria-hidden="true" className="relative block h-2.5 w-7"><i className="absolute left-0 top-0 h-[2px] w-7 bg-sky-300" /><i className="absolute bottom-0 left-0 h-[2px] w-7 bg-sky-300" /></span>Double track</p>
      <p className="mb-1 flex items-center gap-2"><span aria-hidden="true" className="block h-[2px] w-7 bg-sky-300" />Single track</p>
      <p className="flex items-center gap-2"><span aria-hidden="true" className="block w-7 border-t-2 border-dashed border-sky-300" />Count not mapped</p>
    </div>
  </div>;
});
