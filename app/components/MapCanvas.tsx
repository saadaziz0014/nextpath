'use client';

import { memo, useRef } from 'react';
import Map, { Layer, Source, Marker, NavigationControl, ScaleControl, type MapRef } from 'react-map-gl';
import type { Map as MapboxMap } from 'mapbox-gl';
import type { Coordinate } from '@/lib/routeData';
import { DEFAULT_START, type DrivingRoute, type Place } from '@/lib/routes';

interface Props {
  token: string; route: DrivingRoute | null; start: Place | null; end: Place | null; picking: boolean;
  onReady: (map: MapboxMap) => void; onFailure: (message: string) => void;
  onInteraction: () => void; onPick: (coordinate: Coordinate) => void;
}
// Memoized map remains isolated from the 10Hz telemetry panel.
export default memo(function MapCanvas({ token, route, start, end, picking, onReady, onFailure, onInteraction, onPick }: Props) {
  const ref = useRef<MapRef>(null);
  return <Map ref={ref} mapboxAccessToken={token} mapStyle="mapbox://styles/mapbox/streets-v12"
    initialViewState={{ longitude: DEFAULT_START.coordinate[0], latitude: DEFAULT_START.coordinate[1], zoom: 17, pitch: 60 }}
    style={{ width: '100%', height: '100%' }} cursor={picking ? 'crosshair' : 'grab'}
    onLoad={() => { if (ref.current) onReady(ref.current.getMap()); }}
    onError={event => onFailure(event.error.message)} onDragStart={onInteraction}
    onZoomStart={event => { if (event.originalEvent) onInteraction(); }}
    onRotateStart={event => { if (event.originalEvent) onInteraction(); }}
    onClick={event => { if (picking) onPick([event.lngLat.lng, event.lngLat.lat]); }}
  >
    {route && <Source id="journey" type="geojson" data={route.feature}>
      <Layer id="route-glow" type="line" layout={{ 'line-cap': 'round', 'line-join': 'round' }} paint={{ 'line-color': '#0284c7', 'line-width': 12, 'line-opacity': .2 }} />
      <Layer id="route-line" type="line" layout={{ 'line-cap': 'round', 'line-join': 'round' }} paint={{ 'line-color': '#0284c7', 'line-width': 5 }} />
    </Source>}
    {start && <Marker longitude={start.coordinate[0]} latitude={start.coordinate[1]} anchor="bottom"><span role="img" aria-label="Start point" className="block rounded-full border-2 border-white bg-emerald-500 px-2 py-1 text-[10px] font-bold text-white shadow-lg">A</span></Marker>}
    {end && <Marker longitude={end.coordinate[0]} latitude={end.coordinate[1]} anchor="bottom"><span role="img" aria-label="Destination point" className="block rounded-full border-2 border-white bg-rose-500 px-2 py-1 text-[10px] font-bold text-white shadow-lg">B</span></Marker>}
    <NavigationControl position="top-right" /><ScaleControl position="bottom-right" />
  </Map>;
});
