'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import { LoaderCircle, AlertTriangle } from 'lucide-react';
import PlaybackControls from './PlaybackControls';
import TurnPrompt from './TurnPrompt';
import TouchDpad from './TouchDpad';
import RoutePlanner, { type Endpoint, type PlaceDraft } from './RoutePlanner';
import { useVehicleSimulation } from '@/app/hooks/useVehicleSimulation';
import { DEFAULT_START, DEFAULT_END, fetchDrivingRoute, type DrivingRoute, type Place } from '@/lib/routes';
import type { Coordinate } from '@/lib/routeData';
import { currentLocation } from '@/lib/geolocation';

// Server page/layout wrap this client-only WebGL boundary.
const MapCanvas = dynamic(() => import('./MapCanvas'), { ssr: false });
const draft = (place: Place): PlaceDraft => ({ query: place.label, place });

export default function MapSimulator() {
  // Public pk.* token in .env.local; rebuild when changing deployment values.
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  const validToken = !!token?.startsWith('pk.') && !token.includes('your_mapbox');
  const simulation = useVehicleSimulation();
  const { attachMap, stop, explore, suspend, relocate, configureRoute, focusPlace } = simulation;
  const [start, setStart] = useState<PlaceDraft>(draft(DEFAULT_START));
  const [end, setEnd] = useState<PlaceDraft>(draft(DEFAULT_END));
  const [route, setRoute] = useState<DrivingRoute | null>(null);
  const [picking, setPicking] = useState<Endpoint | null>(null);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const pickingRef = useRef<Endpoint | null>(null);
  const startRef = useRef<PlaceDraft>(draft(DEFAULT_START));
  const requestRef = useRef<AbortController | null>(null);
  const locationRequestRef = useRef<AbortController | null>(null);
  const [locating, setLocating] = useState<Endpoint | null>(null);
  const [locationError, setLocationError] = useState<string | null>(null);
  const cancelLocation = useCallback(() => {
    locationRequestRef.current?.abort(); locationRequestRef.current = null;
    setLocating(null); setLocationError(null);
  }, []);

  useEffect(() => () => {
    requestRef.current?.abort();
    locationRequestRef.current?.abort(); locationRequestRef.current = null;
  }, []);
  useEffect(() => { suspend(loadingRoute || picking !== null || !!mapError); }, [loadingRoute, picking, mapError, suspend]);
  const cancelRequest = useCallback(() => { requestRef.current?.abort(); requestRef.current = null; setLoadingRoute(false); }, []);
  const onFailure = useCallback((message: string) => { stop(); setMapError(message); }, [stop]);
  const onReady = useCallback((map: Parameters<typeof attachMap>[0]) => { attachMap(map); setMapError(null); }, [attachMap]);
  const onPick = useCallback((endpoint: Endpoint | null) => {
    cancelLocation();
    pickingRef.current = endpoint; setPicking(endpoint);
    if (endpoint) { explore(); suspend(true); }
  }, [cancelLocation, explore, suspend]);

  const selectPlace = useCallback((endpoint: Endpoint, place: Place, focus = true) => {
    cancelLocation();
    cancelRequest(); setRouteError(null); setRoute(null);
    if (endpoint === 'start') { startRef.current = draft(place); setStart(draft(place)); relocate(place); }
    else { setEnd(draft(place)); relocate(startRef.current.place ?? DEFAULT_START); }
    pickingRef.current = null; setPicking(null);
    if (focus) focusPlace(place);
  }, [cancelLocation, cancelRequest, relocate, focusPlace]);
  const useLocation = async (endpoint: Endpoint) => {
    cancelLocation();
    if (!window.isSecureContext) { setLocationError('Location requires HTTPS or localhost. Open NextPath on a secure address to use your location.'); return; }
    if (!navigator.geolocation) { setLocationError('This browser does not support location. Search for a place or pick on the map.'); return; }
    const controller = new AbortController();
    locationRequestRef.current = controller; setLocating(endpoint);
    try {
      const place = await currentLocation(navigator.geolocation, controller.signal);
      if (!controller.signal.aborted && locationRequestRef.current === controller) selectPlace(endpoint, place);
    } catch (failure) {
      if (!controller.signal.aborted && locationRequestRef.current === controller) setLocationError(failure instanceof Error ? failure.message : 'Unable to find your location.');
    } finally {
      if (locationRequestRef.current === controller) { locationRequestRef.current = null; setLocating(null); }
    }
  };
  const mapPick = useCallback((coordinate: Coordinate) => {
    const endpoint = pickingRef.current;
    if (endpoint) selectPlace(endpoint, { label: `${coordinate[1].toFixed(5)}, ${coordinate[0].toFixed(5)}`, coordinate }, false);
  }, [selectPlace]);
  const edit = (endpoint: Endpoint, query: string) => {
    cancelLocation();
    cancelRequest(); setRouteError(null);
    if (endpoint === 'start') { startRef.current = { query, place: null }; setStart({ query, place: null }); }
    else setEnd({ query, place: null });
  };
  const build = async () => {
    if (!start.place || !end.place || !token || !simulation.ready) return;
    cancelRequest(); onPick(null); suspend(true);
    const controller = new AbortController(); requestRef.current = controller;
    setLoadingRoute(true); setRouteError(null);
    try {
      const result = await fetchDrivingRoute(start.place, end.place, token, AbortSignal.any([controller.signal, AbortSignal.timeout(20000)]));
      if (controller.signal.aborted) return;
      setRoute(result); setStart(draft(result.start)); startRef.current = draft(result.start); setEnd(draft(result.end));
      configureRoute(result);
    } catch (failure) {
      if (!controller.signal.aborted) setRouteError(failure instanceof Error && failure.name === 'TimeoutError' ? 'Route request timed out. Please try again.' : failure instanceof Error ? failure.message : 'Unable to build route.');
    } finally {
      if (requestRef.current === controller) { requestRef.current = null; setLoadingRoute(false); }
    }
  };
  const freeDrive = () => {
    if (!start.place || !simulation.ready) return;
    cancelRequest(); setRouteError(null); setRoute(null); onPick(null);
    simulation.startFreeDrive(start.place);
  };
  const preset = () => {
    cancelRequest(); setRouteError(null); setRoute(null); onPick(null);
    const example = { label: 'Karachi · example destination', coordinate: [67.0099, 24.8607] as Coordinate };
    startRef.current = draft(DEFAULT_START); setStart(draft(DEFAULT_START)); setEnd(draft(example)); relocate(DEFAULT_START);
  };

  const usable = simulation.ready && !mapError && !loadingRoute && picking === null;
  return <div data-road-simulator className="relative h-dvh min-h-[540px] w-full overflow-hidden bg-slate-950">
    {validToken && <MapCanvas token={token!} route={route} start={route?.start ?? start.place} end={simulation.freeDriving ? null : route?.end ?? end.place} picking={!!picking} onReady={onReady} onFailure={onFailure} onInteraction={explore} onPick={mapPick} />}
    <RoutePlanner locating={locating} locationError={locationError} onUseLocation={useLocation} getSearchProximity={simulation.getSearchProximity} token={token ?? ''} start={start} end={end} picking={picking} loading={loadingRoute} ready={simulation.ready && !mapError} error={routeError} hasRoute={!!route} freeDriving={simulation.freeDriving} onFreeDrive={freeDrive} onEdit={edit} onSelect={selectPlace} onPick={onPick} onBuild={build} onPreset={preset} onOverview={simulation.overview} />
    {!simulation.ready && validToken && !mapError && <div role="status" className="absolute inset-0 flex items-center justify-center bg-slate-950/60"><div className="flex items-center gap-3 rounded-xl bg-slate-900 p-5"><LoaderCircle className="animate-spin text-sky-400" />Loading street map…</div></div>}
    {(!validToken || mapError) && <div role="alert" className="absolute inset-0 z-30 flex items-center justify-center bg-slate-950/90 px-6"><div className="max-w-lg rounded-2xl border border-slate-700 bg-slate-900 p-6"><AlertTriangle className="mb-3 text-amber-400" /><h2 className="text-lg font-semibold">{validToken ? 'Unable to load the map' : 'Connect your Mapbox account'}</h2><p className="mt-2 text-sm text-slate-400">{validToken ? 'Check your connection, token permissions and allowed URLs, then reload.' : 'Set NEXT_PUBLIC_MAPBOX_TOKEN to a public pk.* token in .env.local and restart the server.'}</p>{mapError && <p className="mt-3 break-words text-xs text-slate-500">{mapError}</p>}{validToken && <button onClick={() => window.location.reload()} className="mt-4 rounded-lg bg-sky-400 px-4 py-2 text-sm font-semibold text-slate-950">Retry</button>}</div></div>}
    <TurnPrompt prompt={usable ? simulation.telemetry.turnPrompt : null} enabled={usable && simulation.active} onChoose={simulation.chooseTurn} />
    <PlaybackControls mode={simulation.mode} active={simulation.active} speed={simulation.speed} ready={usable && (simulation.mode === 'playback' ? !!route : simulation.telemetry.roadsReady)} freeDriving={simulation.freeDriving} following={simulation.following} route={route} {...simulation.telemetry} onMode={simulation.setMode} onToggle={simulation.toggle} onReset={simulation.reset} onSpeed={simulation.setSpeed} onFollow={simulation.follow} onKey={simulation.setKey} onStraight={() => simulation.chooseTurn(null)} />
    {usable && simulation.active && simulation.mode === 'drive' && <TouchDpad mode="road" active={simulation.active} onAccelerate={pressed => simulation.setKey('w', pressed)} onBrake={pressed => simulation.setKey('s', pressed)} onLeft={() => simulation.chooseTurn('left')} onRight={() => simulation.chooseTurn('right')} leftDisabled={simulation.telemetry.turnLocked} rightDisabled={simulation.telemetry.turnLocked} />}
  </div>;
}







