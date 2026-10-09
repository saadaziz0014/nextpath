'use client';
import { memo, useMemo, useRef } from 'react';
import MapView, { Source, Layer, NavigationControl, type MapRef } from 'react-map-gl';
import type { Map as MapboxMap } from 'mapbox-gl';
import type { RailDataset } from '@/lib/rail/types';
interface Props { dataset: RailDataset; token: string; onReady: (map: MapboxMap) => void; onFailure: (message: string) => void; onExplore: () => void }
export default memo(function RailMap({ dataset, token, onReady, onFailure, onExplore }: Props) {
  const ref = useRef<MapRef>(null);
  const tracks = useMemo(() => ({ type: 'FeatureCollection' as const, features: dataset.paths.map(path => ({ type: 'Feature' as const, properties: { branch: path.id }, geometry: { type: 'LineString' as const, coordinates: path.coordinates } })) }), [dataset]);
  const stations = useMemo(() => ({ type: 'FeatureCollection' as const, features: [...new Map(dataset.paths.flatMap(path => path.stations).map(station => [station.id, station])).values()].map(station => ({ type: 'Feature' as const, properties: { name: station.name }, geometry: { type: 'Point' as const, coordinates: station.coordinate } })) }), [dataset]);
  const start = dataset.paths[0].coordinates[0];
  return <MapView ref={ref} mapboxAccessToken={token} mapStyle="mapbox://styles/mapbox/dark-v11" initialViewState={{ longitude: start[0], latitude: start[1], zoom: 16.5, pitch: 50 }} style={{ width: '100%', height: '100%' }} onDragStart={onExplore} onLoad={() => { if (ref.current) onReady(ref.current.getMap()); }} onError={event => onFailure(event.error.message)}>
    <Source id="rail-tracks" type="geojson" data={tracks} attribution={dataset.attribution}>
      <Layer id="rail-outline" type="line" paint={{ 'line-color': '#0f172a', 'line-width': 5 }} />
      <Layer id="rail-lines" type="line" paint={{ 'line-color': ['match', ['get', 'branch'], 'chord', '#34d399', 'multan', '#fbbf24', 'south', '#38bdf8', 'north', '#f472b6', 'branch', '#a78bfa', 'kcr', '#60a5fa', 'jamalo', '#f43f5e', 'millat', '#facc15', 'mohenjo-daro', '#a3e635', 'subak-kharam', '#e879f9', 'pak-business', '#22d3ee', 'awam', '#f97316', 'green-line', '#84cc16', 'jaffar', '#c084fc', 'fareed', '#2dd4bf', 'musa-pak', '#fb923c', 'allama-iqbal', '#fbbf24', '#64748b'], 'line-width': 2, 'line-opacity': .85 }} />
    </Source>
    <Source id="rail-stations" type="geojson" data={stations}>
      <Layer id="rail-station-dots" type="circle" paint={{ 'circle-radius': 6, 'circle-color': '#fff', 'circle-stroke-width': 2, 'circle-stroke-color': '#0284c7' }} />
      <Layer id="rail-station-labels" type="symbol" layout={{ 'text-field': ['get', 'name'], 'text-size': 12, 'text-offset': [0, 1.5], 'text-anchor': 'top' }} paint={{ 'text-color': '#fff', 'text-halo-color': '#0f172a', 'text-halo-width': 2 }} />
    </Source>
    <NavigationControl position="top-right" />
  </MapView>;
});

