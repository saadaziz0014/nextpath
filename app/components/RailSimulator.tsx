'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Marker, type Map as MapboxMap } from 'mapbox-gl';
import { Volume2, VolumeX, LoaderCircle, TrainFront, RotateCcw, Pause, Play, LocateFixed, ZoomIn, ZoomOut, ChevronDown, ChevronUp } from 'lucide-react';
import TouchDpad from './TouchDpad';
import type { RailBranch, RailDataset, RailMotion } from '@/lib/rail/types';
import { stepCruiseJourney } from '@/lib/rail/cruise';
import { nextReversal, confirmableReversal } from '@/lib/rail/journey';
import { brakingDistanceMeters, railSpeedLimitKmh } from '@/lib/rail/physics';
import { TRAINS, servicePath } from '@/lib/rail/trains';
import { RAIL_ROUTES, validateRailDataset } from '@/lib/rail/dataset';
import { smoothBearing } from '@/lib/simulation';
import { createRailDeparture } from '@/lib/rail/departure';
import { RAIL_SAVE_KEY, restoreRailSave, type RailSave } from '@/lib/rail/persistence';
import { sampleConsist, trainCarSvg } from '@/lib/rail/consist';
import { indexTrack, nextStation, sampleTrack, reversePath } from '@/lib/rail/track';
import { useTrainAudio } from '@/app/hooks/useTrainAudio';
const RailMap = dynamic(() => import('./RailMap'), { ssr: false });
const initialMotion = { km: 0, velocity: 0 };

export default function RailSimulator() {
  const { enabled: soundEnabled, started: soundStarted, volume, error: audioError, recordingReady, unlock, update: updateAudio, horn, blast, stopHorn, silence, toggle: toggleSound, setVolume } = useTrainAudio();
  const [dataset, setDataset] = useState<RailDataset | null>(null);
  const [error, setError] = useState('');
  const [mapInstance, setMapInstance] = useState<MapboxMap | null>(null);
  const ready = mapInstance !== null;
  const [trainId, setTrainId] = useState(TRAINS[0].id);
  const [plannedStationId, setPlannedStationId] = useState('');
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [explore, setExplore] = useState(false);
  const train = TRAINS.find(item => item.id === trainId)!;
  const service = train.services.find(item => item.id === serviceId);
  const serviceTrack = useMemo(() => dataset && service ? servicePath(dataset, train, service) : null, [dataset, train, service]);
  const servicePreviews = useMemo(() => dataset ? train.services.map(service => ({ service, path: servicePath(dataset, train, service) })) : [], [dataset, train]);
  const startingStations = useMemo(() => {
    const stations = new Map(servicePreviews.flatMap(item => item.path.stations).map(station => [station.id, station]));
    return [...stations.values()].sort((a,b) => a.name.localeCompare(b.name));
  }, [servicePreviews]);
  const [branch, setBranch] = useState<RailBranch | null>(null);
  const [stationId, setStationId] = useState('');
  const [reverse, setReverse] = useState(false);
  const [departed, setDeparted] = useState(false);
  const [departureKm, setDepartureKm] = useState(0);
  const journey = useRef<ReturnType<typeof createRailDeparture> | null>(null);
  const departureLocked = useRef(false);
  const confirmedReversals = useRef(new Set<string>());
  const [confirmedForUI, setConfirmedForUI] = useState<ReadonlySet<string>>(new Set());
  const cruiseRef = useRef<number | null>(null);
  const [cruise, setCruise] = useState<number | null>(null);
  const cancelCruise = useCallback(() => { cruiseRef.current = null; setCruise(null); }, []);
  const [backing, setBacking] = useState(false);
  const driveDirection = useRef<1 | -1>(1);
  const [paused, setPaused] = useState(false);
  const [following, setFollowing] = useState(true);
  const [panelCollapsed, setPanelCollapsed] = useState(true);
  const [telemetry, setTelemetry] = useState<RailMotion>(initialMotion);
  const carMarkers = useRef<Marker[]>([]);
  const motion = useRef<RailMotion>({ ...initialMotion }), keys = useRef(new Set<string>());
  const selected = useRef<RailBranch | null>(null), pauseRef = useRef(false), followRef = useRef(true);
  const saveSelection = useRef<{trainId: string; serviceId: string | null; branch: RailBranch} | null>(null);
  const persistJourney = useCallback(() => {
    const departure = journey.current, selection = saveSelection.current;
    if (!departure || !selection || !selected.current) return;
    const value: RailSave = { version: 1, ...selection, stationId: departure.stationId,
      reverse: departure.reverse, ...motion.current, direction: driveDirection.current,
      departed: departureLocked.current, following: followRef.current,
      cruise: cruiseRef.current, confirmed: [...confirmedReversals.current], lengthKm: departure.track.lengthKm };
    // Storage may be blocked or full. Driving must continue even if saving fails.
    try { localStorage.setItem(RAIL_SAVE_KEY, JSON.stringify(value)); } catch {}
  }, []);
  useEffect(() => {
    const save = () => persistJourney();
    window.addEventListener('pagehide', save);
    document.addEventListener('visibilitychange', save);
    return () => { save(); window.removeEventListener('pagehide', save); document.removeEventListener('visibilitychange', save); };
  }, [persistJourney]);
  // Public, browser-visible token: configure NEXT_PUBLIC_MAPBOX_TOKEN in .env.local.
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
  useEffect(() => {
    const controller = new AbortController();
    fetch('/data/rail/ml1.json', { signal: controller.signal }).then(async response => {
      if (!response.ok) throw new Error('Rail dataset could not be loaded.');
      const data = validateRailDataset(await response.json());
      for (const train of TRAINS) for (const service of train.services) servicePath(data, train, service);
      try {
        const raw = localStorage.getItem(RAIL_SAVE_KEY);
        if (raw) {
          const { value, departure } = restoreRailSave(raw, data);
          saveSelection.current = {trainId:value.trainId,serviceId:value.serviceId,branch:value.branch};
          journey.current = departure; selected.current = value.branch;
          motion.current = {km:value.km,velocity:value.velocity};
          departureLocked.current = value.departed || value.velocity > 0 || Math.abs(value.km-departure.km)>.000001;
          confirmedReversals.current = new Set(value.confirmed);
          cruiseRef.current = value.cruise ?? null; setCruise(cruiseRef.current);
          driveDirection.current = value.direction; pauseRef.current = true; followRef.current = value.following;
          keys.current.clear();
          setTrainId(value.trainId); setServiceId(value.serviceId); setBranch(value.branch);
          setExplore(value.serviceId===null); setStationId(value.stationId); setPlannedStationId(value.stationId);
          setReverse(value.reverse); setDepartureKm(departure.km); setTelemetry({...motion.current});
          setDeparted(departureLocked.current); setConfirmedForUI(new Set(value.confirmed));
          setBacking(value.direction===-1); setFollowing(value.following); setPaused(true);
        }
      } catch { try { localStorage.removeItem(RAIL_SAVE_KEY); } catch {} }
      setDataset(data);
    }).catch(cause => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : 'Rail loading failed.'); });
    return () => controller.abort();
  }, []);
  const tracks = useMemo(() => dataset?.paths.toSorted((a, b) => Number(b.id === 'allama-iqbal') - Number(a.id === 'allama-iqbal')).map(indexTrack) ?? [], [dataset]);
  // Follow the selected train's origin while previewing its services.
  const preview = useRef<ReturnType<typeof indexTrack> | null>(null);
  useEffect(() => {
    const path = dataset?.paths.find(path => path.id === train.pathId);
    preview.current = path ? indexTrack(path) : null;
  }, [dataset, train]);
  const configureDeparture = useCallback((departure: ReturnType<typeof createRailDeparture>) => {
    cancelCruise(); stopHorn(); driveDirection.current = 1; setBacking(false);
    journey.current = departure; departureLocked.current = false;
    confirmedReversals.current = new Set(departure.track.path.reversals?.filter(stop => stop.km <= departure.km + .000001).map(stop => stop.stationId));
    setConfirmedForUI(new Set(confirmedReversals.current));
    keys.current.clear(); motion.current = { km: departure.km, velocity: 0 };
    pauseRef.current = false; followRef.current = true;
    setPaused(false); setFollowing(true); setDeparted(false);
    setStationId(departure.stationId); setReverse(departure.reverse);
    setDepartureKm(departure.km); setTelemetry({ ...motion.current });
  }, [stopHorn, cancelCruise]);
  const choose = useCallback((value: RailBranch) => {
    // Commit once per run. A/D cannot override a railway switch selection.
    if (!ready || selected.current || !dataset?.paths.some(path => path.id === value)) return;
    const path = dataset.paths.find(path => path.id === value)!;
    configureDeparture(createRailDeparture(path, path.stations[0].id, false));
    selected.current = value; setBranch(value);
    saveSelection.current = {trainId,serviceId:null,branch:value}; persistJourney();
  }, [ready, dataset, configureDeparture, trainId, persistJourney]);
  const chooseService = useCallback((id: string) => {
    if (!ready || selected.current || !dataset) return;
    const chosen = train.services.find(item => item.id === id);
    if (!chosen) return;
    try {
      const directed = servicePath(dataset, train, chosen);
      const startId = plannedStationId || directed.stations[0].id;
      const start = directed.stations.find(station => station.id === startId);
      // A shared starting-station selector can include a stop called by only one
      // direction. Keyboard shortcuts obey the same eligibility as buttons.
      if (!start || directed.distanceKm - start.km < .015) return;
      configureDeparture(createRailDeparture(directed, startId, false));
      selected.current = train.pathId; setBranch(train.pathId); setServiceId(id);
      saveSelection.current = {trainId:train.id,serviceId:id,branch:train.pathId}; persistJourney();
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Train service could not be loaded.'); }
  }, [ready, dataset, train, configureDeparture, plannedStationId, persistJourney]);
  const confirmReversal = useCallback(() => {
    if (!journey.current) return;
    const stop = confirmableReversal(journey.current.track.path, motion.current, confirmedReversals.current);
    if (stop) { confirmedReversals.current.add(stop.stationId); setConfirmedForUI(new Set(confirmedReversals.current)); keys.current.clear(); setTelemetry({...motion.current}); }
  }, []);
  const toggleCruise = useCallback(() => {
    if (cruiseRef.current !== null) { keys.current.delete('w'); cancelCruise(); return; }
    if (!selected.current || pauseRef.current || motion.current.velocity <= 0 || keys.current.has('s')) return;
    keys.current.delete('w'); unlock();
    cruiseRef.current = motion.current.velocity; setCruise(cruiseRef.current);
  }, [cancelCruise, unlock]);
  const toggleReverser = useCallback(() => {
    if (!selected.current || motion.current.velocity !== 0) return;
    keys.current.clear(); stopHorn();
    driveDirection.current = driveDirection.current === 1 ? -1 : 1;
    setBacking(driveDirection.current === -1);
  }, [stopHorn]);
  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && event.target.closest('input, textarea, select, [contenteditable="true"]')) return;
      const key = event.key.toLowerCase();
      if (key === ' ' && event.target instanceof HTMLElement && event.target.closest('button')) return;
      if (key === 'w' && !event.repeat && selected.current) unlock();
      if (key === 'h' && !event.repeat && selected.current && !pauseRef.current) horn('keyboard', true);
      if (['z', 'j', 'l', 'm', 'c', 't', 'v', 'h', 'w', 's', 'a', 'd', 'r', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', 'e', 'b', 'k', ' '].includes(key)) event.preventDefault();
      const route = RAIL_ROUTES.find(route => route.key === key);
      if (explore && route) choose(route.id);
      else if (!explore && (key === '1' || key === '2')) chooseService(train.services[Number(key) - 1]?.id);
      if (key === 'c' && !event.repeat) toggleCruise();
      if ((key === 'w' || key === 's') && !event.repeat) cancelCruise();
      if (key === 'v' && !event.repeat) toggleReverser();
      if (key === 'r' && !event.repeat) confirmReversal();
      if ((key === 'w' || key === 's') && !event.repeat) keys.current.add(key);
      if (key === ' ' && !event.repeat) { silence(); pauseRef.current = !pauseRef.current; setPaused(pauseRef.current); }
    };
    const up = (event: KeyboardEvent) => { keys.current.delete(event.key.toLowerCase()); if (event.key.toLowerCase() === 'h') horn('keyboard', false); };
    const clear = () => { silence(); keys.current.clear(); pauseRef.current = true; setPaused(true); };
    const visibility = () => { if (document.hidden) clear(); };
    window.addEventListener('keydown', down); window.addEventListener('keyup', up); window.addEventListener('blur', clear); document.addEventListener('visibilitychange', visibility);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', clear); document.removeEventListener('visibilitychange', visibility); };
  }, [choose, chooseService, explore, train, confirmReversal, toggleReverser, toggleCruise, cancelCruise, unlock, horn, silence]);
  const onReady = useCallback((instance: MapboxMap) => { setMapInstance(instance); }, []);
  const onFailure = useCallback((message: string) => setError(message), []);
  // A deliberate map drag enters exploration; zoom alone keeps train follow on.
  // Only the lightweight controls rerender when this preference changes.
  const onExplore = useCallback(() => { followRef.current = false; setFollowing(false); }, []);
  const changeZoom = (delta: number) => {
    if (!mapInstance) return;
    const zoom = Math.max(mapInstance.getMinZoom(), Math.min(mapInstance.getMaxZoom(), mapInstance.getZoom() + delta));
    mapInstance.zoomTo(zoom, { duration: 250 });
  };
  useEffect(() => {
    if (!mapInstance || !tracks.length) return;
    const instance = mapInstance;
    // Allocate one locomotive and seven coaches once; never render React at
    // animation frequency. Rotation and pitch align each car with the map.
    carMarkers.current = sampleConsist(tracks[0], 0).map(car => {
      const element = document.createElement('div');
      element.setAttribute('role', 'img');
      element.setAttribute('aria-label', car.index === 0 ? 'Locomotive' : 'Coach ' + car.index);
      element.dataset.trainCar = String(car.index);
      element.style.pointerEvents = 'none';
      element.style.visibility = car.visible ? 'visible' : 'hidden';
      element.style.width = (32 * 26 / 58) + 'px'; element.style.height = '32px';
      element.innerHTML = trainCarSvg(car.index === 0);
      return new Marker({ element, rotationAlignment: 'map', pitchAlignment: 'map' }).setLngLat(car.position).addTo(instance);
    });
    let frame = 0, previous = 0, lastTelemetry = 0, lastSave = 0, cameraBearing = instance.getBearing();
    // Mouse wheels can take 40 ms to classify before isZooming becomes true.
    // Reserve a brief window on input so follow never interrupts that startup.
    let zoomIntentUntil = 0;
    const onWheel = () => { zoomIntentUntil = performance.now() + 100; };
    instance.on('wheel', onWheel);
    const tick = (now: number) => {
      // Use elapsed real time, capped by physics after backgrounding. Position is
      // a distance along sourced track geometry: steering never leaves the rail.
      const dt = previous ? (now - previous) / 1000 : 0; previous = now;
      const track = journey.current?.track ?? preview.current ?? tracks[0];
      // Require an explicit switch choice before departure.
      if (!pauseRef.current && selected.current) {
        const result = stepCruiseJourney(motion.current, keys.current, dt, track.path, confirmedReversals.current, driveDirection.current, cruiseRef.current);
        motion.current = result.motion;
        if (result.target !== cruiseRef.current) { cruiseRef.current = result.target; setCruise(result.target); }
      }
      // Lock departure edits on the first movement, so changing station cannot
      // teleport a moving train. Reset unlocks the same departure configuration.
      if (!departureLocked.current && motion.current.velocity > 0) { departureLocked.current = true; setDeparted(true); }
      updateAudio({ speedKmh: motion.current.velocity * 3.6, throttle: keys.current.has('w') || cruiseRef.current !== null, braking: keys.current.has('s'), active: !!selected.current, paused: pauseRef.current || document.hidden });
      const sample = sampleTrack(track, motion.current.km);
      // Preserve the locomotive aspect ratio for every car. Keep cars readable
      // and couple them using projected screen distance, including map pitch.
      const metresPerPixel = 156543.03392 * Math.cos(sample.position[1] * Math.PI / 180) / 2 ** instance.getZoom();
      // At close zoom, cap marker size so the train does not obscure nearby places.
      const carHeight = Math.min(96, Math.max(32, 26 / metresPerPixel));
      // Map perspective scales ground distances and DOM markers differently.
      // Measure the rendered car and projected rail instead of assuming that
      // metres-per-pixel gives the visible gap on a pitched navigation map.
      const probeKm = Math.min(.029, Math.max(.001, motion.current.km));
      const center = instance.project(sample.position);
      const probe = instance.project(sampleTrack(track, Math.max(0, motion.current.km - probeKm)).position);
      const projectedDistance = Math.hypot(center.x - probe.x, center.y - probe.y);
      const bounds = carMarkers.current[0].getElement().getBoundingClientRect();
      const renderedLength = .9 * Math.hypot(bounds.width, bounds.height);
      const spacingKm = projectedDistance > .01 && renderedLength > 0
        ? probeKm * (renderedLength + 1) / projectedDistance
        : (carHeight + 1) * metresPerPixel / 1000;
      const consist = sampleConsist(track, motion.current.km, spacingKm);
      consist.forEach(car => {
        const marker = carMarkers.current[car.index];
        marker.setLngLat(car.position).setRotation(car.heading);
        const element = marker.getElement();
        element.style.visibility = car.visible ? 'visible' : 'hidden';
        element.style.height = carHeight + 'px';
        element.style.width = (carHeight * 26 / 58) + 'px';
      });
      // Smooth angular changes in frame-rate independent time, including north.
      cameraBearing = smoothBearing(cameraBearing, sample.heading, 1 - Math.exp(-Math.min(dt, .1) * 8));
      // The map owns its zoom: never overwrite the user's chosen level here.
      // jumpTo cancels Mapbox camera animations, so yield while buttons, wheel,
      // or pinch are zooming. Physics and markers continue at full frame rate;
      // follow resumes at the current train position when the zoom finishes.
      if (followRef.current && now >= zoomIntentUntil && !instance.isZooming()) instance.jumpTo({ center: sample.position, bearing: cameraBearing, pitch: 50 });
      // Only lightweight telemetry rerenders at 10 Hz. Map/marker stay imperative.
      if (now - lastTelemetry > 100) { setTelemetry({ ...motion.current }); lastTelemetry = now; }
      if (now - lastSave >= 1000) { persistJourney(); lastSave = now; }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(frame); instance.off('wheel', onWheel); carMarkers.current.forEach(marker => marker.remove()); carMarkers.current = []; };
  }, [mapInstance, tracks, updateAudio, persistJourney]);
  const path = serviceTrack ?? dataset?.paths.find(path => path.id === branch);
  const visibleDataset = useMemo(() => dataset ? { ...dataset, paths: serviceTrack ? [serviceTrack] : branch ? dataset.paths.filter(path => path.id === branch) : explore ? dataset.paths : dataset.paths.filter(path => path.id === train.pathId) } : null, [dataset, serviceTrack, branch, explore, train]);
  const active = useMemo(() => path ? indexTrack(reverse ? reversePath(path) : path) : tracks.find(track => track.path.id === train.pathId) ?? tracks[0], [path, reverse, tracks, train]);
  const departureStation = path?.stations.find(station => station.id === stationId);
  const remainingKm = Math.max(0, (active?.lengthKm ?? 0) - departureKm);
  const station = active ? backing ? active.path.stations.findLast(station => station.km < telemetry.km - .000001) ?? null : nextStation(active.path, telemetry.km) : null;
  const stoppedAt = active?.path.stations.find(station => Math.abs(station.km - telemetry.km) < .08 && telemetry.velocity < .15);
  const reversal = active ? nextReversal(active.path, telemetry.km, confirmedForUI) : null;
  const canReverse = active ? confirmableReversal(active.path, telemetry, confirmedForUI) : null;
  const reset = () => { if (journey.current) { configureDeparture(journey.current); persistJourney(); } };
  const changeRoute = () => {
    persistJourney();
    cancelCruise(); silence(); driveDirection.current = 1; setBacking(false);
    saveSelection.current = null;
    keys.current.clear(); journey.current = null; selected.current = null;
    confirmedReversals.current.clear(); setConfirmedForUI(new Set());
    departureLocked.current = false; motion.current = { ...initialMotion };
    pauseRef.current = false; setPaused(false); setDeparted(false);
    setBranch(null); setServiceId(null); setStationId(''); setReverse(false); setDepartureKm(0); setTelemetry(initialMotion);
  };
  const changeStation = (id: string) => {
    if (!path || departureLocked.current) return;
    const station = path.stations.find(station => station.id === id)!;
    // Terminals automatically face the only available departure direction.
    const backwards = service ? false : station.km < .015 ? false : path.distanceKm - station.km < .015 ? true : reverse;
    configureDeparture(createRailDeparture(path, id, backwards)); persistJourney();
  };
  const changeDirection = (backwards: boolean) => {
    if (!path || departureLocked.current) return;
    configureDeparture(createRailDeparture(path, stationId, backwards)); persistJourney();
  };
  return <div data-rail-simulator className="relative h-dvh min-h-[560px] overflow-hidden bg-slate-950">
    {token && visibleDataset && <RailMap token={token} dataset={visibleDataset} onReady={onReady} onFailure={onFailure} onExplore={onExplore} />}
    <div className="absolute left-4 top-4 flex items-center gap-3 rounded-xl glass px-4 py-3"><TrainFront className="text-emerald-400" /><div><h1 className="font-bold">Pakistan Rail</h1><p className="text-xs text-slate-400">{explore ? 'Explore Pakistan tracks' : 'Choose your train journey'}</p></div><Link href="/" className="ml-4 text-sm text-sky-300 underline">Road mode</Link><Link href="/metro" className="text-sm text-orange-300 underline">Orange Line</Link><Link href="/metrobus" className="text-sm text-rose-300 underline">Metrobus</Link></div>
    {(!token || error) ? <div role="alert" className="absolute inset-0 grid place-items-center bg-slate-950/90 p-8"><p className="max-w-lg rounded-xl glass p-6">{!token ? 'Set NEXT_PUBLIC_MAPBOX_TOKEN in .env.local and restart the server.' : error}</p></div> : !ready && <div role="status" className="absolute inset-0 grid place-items-center bg-slate-950/80"><div className="flex items-center gap-3"><LoaderCircle className="animate-spin" /> Loading Pakistan tracks…</div></div>}
    {panelCollapsed && !!branch && <section aria-label="Train HUD (compact)" className="glass absolute bottom-4 left-4 z-10 flex items-center gap-2 rounded-2xl p-2.5 sm:hidden">
      <div className="px-2">
        <span className="text-lg font-bold tabular-nums">{(telemetry.velocity * 3.6).toFixed(0)}</span>
        <span className="ml-1 text-[10px] text-slate-400">km/h</span>
      </div>
      <button aria-label={paused ? 'Resume simulation' : 'Pause simulation'} onClick={() => { silence(); keys.current.clear(); pauseRef.current = !pauseRef.current; setPaused(pauseRef.current); }} className="rounded-xl bg-white/10 p-2 text-white">
        {paused ? <Play size={14} /> : <Pause size={14} />}
      </button>
      <button type="button" onClick={() => setPanelCollapsed(false)} aria-label="Expand train controls" className="rounded-xl border border-slate-600 p-2 text-slate-300">
        <ChevronUp size={14} />
      </button>
    </section>}
    <section aria-label="Train controls" className={`glass absolute bottom-8 left-4 right-4 max-w-md max-h-[calc(100dvh-124px)] overflow-y-auto rounded-2xl p-5 ${panelCollapsed && !!branch ? 'hidden sm:block' : ''}`}>
      <div className="flex items-center justify-between">
        <div><span className="text-4xl font-bold tabular-nums">{(telemetry.velocity * 3.6).toFixed(0)}</span><span className="ml-2 text-sm text-slate-400">km/h · max {railSpeedLimitKmh(branch ?? (explore ? undefined : train.pathId), backing ? -1 : 1)}</span></div>
        <div className="flex items-center gap-1">
          {!!branch && <button type="button" aria-label="Minimize train controls" onClick={() => setPanelCollapsed(true)} className="rounded-lg p-3 hover:bg-white/10 sm:hidden"><ChevronDown size={20} /></button>}
          <button aria-label="Reset journey" onClick={reset} className="rounded-lg p-3 hover:bg-white/10"><RotateCcw size={20} /></button>
        </div>
      </div>
      <div role="group" aria-label="Rail map controls" className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/10 pt-3">
        <span className="mr-auto text-xs text-slate-400">Map view</span>
        <button type="button" aria-label="Zoom out rail map" title="Zoom out" disabled={!ready} onClick={() => changeZoom(-1)} className="rounded-lg bg-white/10 p-3 hover:bg-white/20 disabled:opacity-40"><ZoomOut size={18} aria-hidden="true" /></button>
        <button type="button" aria-label="Zoom in rail map" title="Zoom in" disabled={!ready} onClick={() => changeZoom(1)} className="rounded-lg bg-white/10 p-3 hover:bg-white/20 disabled:opacity-40"><ZoomIn size={18} aria-hidden="true" /></button>
        <button type="button" aria-label="Toggle camera follow" aria-pressed={following} disabled={!ready} onClick={() => { followRef.current = !followRef.current; setFollowing(followRef.current); }} className={`flex items-center gap-2 rounded-lg px-3 py-3 text-xs disabled:opacity-40 ${following ? 'bg-sky-600' : 'bg-white/10'}`}><LocateFixed size={18} aria-hidden="true" />Follow train</button>
      </div>
      <p className="mt-2 text-xs text-slate-400">Scroll or pinch to zoom. Drag to explore nearby places; Follow train recenters at your chosen zoom.</p>
      {!branch ? <div className="my-4">
        <div className="mb-3 flex gap-2"><button aria-pressed={!explore} onClick={() => setExplore(false)} className={`rounded-lg px-3 py-2 text-sm ${!explore ? 'bg-emerald-600' : 'bg-white/10'}`}>Train journeys</button><button aria-pressed={explore} onClick={() => setExplore(true)} className={`rounded-lg px-3 py-2 text-sm ${explore ? 'bg-sky-600' : 'bg-white/10'}`}>Explore tracks</button></div>
        {explore ? <fieldset><legend className="mb-2 text-sm">Choose a track</legend><div className="grid grid-cols-2 gap-2">{RAIL_ROUTES.map(route => <button key={route.id} disabled={!ready} onClick={() => choose(route.id)} className="rounded-xl bg-sky-500/20 p-3 text-sm text-sky-200 disabled:opacity-40">{route.key} · {route.label}</button>)}</div></fieldset> : <>
          <label htmlFor="rail-train" className="text-xs text-slate-400">Train</label><select id="rail-train" value={trainId} onChange={event => { setTrainId(event.target.value); setPlannedStationId(''); }} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 p-2 text-sm">{TRAINS.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
          <label htmlFor="rail-planned-start" className="mt-3 block text-xs text-slate-400">Starting station</label>
          <select id="rail-planned-start" value={plannedStationId} disabled={!dataset || !ready} onChange={event => setPlannedStationId(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 p-2 text-sm disabled:opacity-40">
            <option value="">Service origin (default)</option>
            {startingStations.map(station => <option key={station.id} value={station.id}>{station.name}</option>)}
          </select>
          <p className="mt-1 text-xs text-slate-400">Select a station, then choose Up or Down below. Each service continues toward its own destination.</p>
          {train.note && <p className="mt-2 text-xs text-amber-200">{train.note}</p>}
          <fieldset className="mt-3"><legend className="mb-2 text-sm">Choose a service</legend><div className="grid grid-cols-2 gap-2">{train.services.map((item, index) => {
            const directed = servicePreviews.find(preview => preview.service.id === item.id)?.path;
            const start = directed?.stations.find(station => station.id === plannedStationId);
            const eligible = !plannedStationId || !!start && !!directed && directed.distanceKm - start.km >= .015;
            return <button key={item.id} disabled={!ready || !eligible} onClick={() => chooseService(item.id)} className="rounded-xl bg-emerald-500/20 p-3 text-left text-sm text-emerald-200 disabled:opacity-40"><strong>{index + 1} · {item.number} {item.direction}</strong><span className="mt-1 block text-xs">{start?.name ?? item.stopNames[0]} → {item.stopNames.at(-1)}</span><span className="mt-1 block text-xs text-slate-400">{start && directed ? directed.stations.filter(station => station.km >= start.km).length : item.stopNames.length} stops · via {train.via}</span>{!eligible && <span className="mt-1 block text-xs text-amber-200">{start ? 'Destination terminal — choose the other direction' : 'This service does not call at the selected station'}</span>}</button>; })}</div></fieldset>
        </>}
      </div> : <div className="my-3"><div className="flex items-center justify-between gap-2"><p className="text-sm text-emerald-300">{path?.name}</p><button onClick={changeRoute} className="shrink-0 text-xs text-sky-300 underline">Change route</button></div>
        <label className="mt-3 block text-xs text-slate-400" htmlFor="rail-start">Starting station</label>
        <select id="rail-start" value={stationId} disabled={departed} onChange={event => changeStation(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 p-2 text-sm disabled:opacity-60">{path?.stations.map(station => <option key={station.id} value={station.id} disabled={!!service && !!path && path.distanceKm - station.km < .015}>{station.name} · {station.km.toFixed(1)} km</option>)}</select>
        {!service && <><label className="mt-2 block text-xs text-slate-400" htmlFor="rail-direction">Travel direction</label>
        <select id="rail-direction" value={reverse ? 'reverse' : 'forward'} disabled={departed} onChange={event => changeDirection(event.target.value === 'reverse')} className="mt-1 w-full rounded-lg border border-slate-600 bg-slate-900 p-2 text-sm disabled:opacity-60"><option value="forward" disabled={!!departureStation && !!path && path.distanceKm - departureStation.km < .015}>Toward {path?.stations.at(-1)?.name}</option><option value="reverse" disabled={!!departureStation && departureStation.km < .015}>Toward {path?.stations[0]?.name}</option></select></>}
        {service && <p className="mt-2 text-xs text-slate-400">{service.number} {service.direction} · Destination: {path?.stations.at(-1)?.name} · {path?.stations.length} stops</p>}
        {service && train.pathId === 'kcr' && <p className="mt-2 text-xs text-amber-200">{train.note}</p>}
        <p className="mt-2 text-xs text-slate-400">{departed ? 'Departure locked. Reset to change your starting station.' : 'Choose your starting station, then use the controls below. Tab out of the selector to drive with W/S.'}</p>
      </div>}
      <div aria-live="polite" className="mb-3 text-sm"><p>{stoppedAt ? `At ${stoppedAt.name}` : station ? `Next: ${station.name}` : 'End of track'}</p><p className="mt-1 text-xs text-slate-400">{station ? `${Math.max(0, (backing ? telemetry.km - station.km : station.km - telemetry.km) * 1000).toFixed(0)} m to next station · ` : ''}Braking distance ≈ {brakingDistanceMeters(telemetry.velocity).toFixed(0)} m</p></div>
      {reversal && <div className="mb-3 rounded-lg border border-amber-400/30 bg-amber-400/10 p-3 text-xs text-amber-200"><p>{active?.path.stations.find(station => station.id === reversal.stationId)?.name ?? 'Station'} direction change · {Math.max(0,(reversal.km-telemetry.km)*1000).toFixed(0)} m ahead. Brake manually before arrival. The train cannot pass this boundary until confirmed.</p><button disabled={!canReverse} onClick={confirmReversal} className="mt-2 rounded-lg bg-amber-400/20 px-3 py-2 disabled:opacity-40">R · Continue after reversal</button></div>}
      <p className="mb-2 text-[10px] text-slate-400">Journey auto-save · refresh restores paused · Selecting a new journey replaces the save</p>
      <p className="mb-2 text-xs text-emerald-300">1 locomotive · 7 coaches</p>
      <progress aria-label="Journey progress" max={remainingKm || 1} value={Math.max(0, telemetry.km - departureKm)} className="mb-3 h-1 w-full accent-emerald-400" />
      <div className="flex gap-2"><button disabled={!branch || !ready} onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); cancelCruise(); keys.current.add('w'); unlock(); }} onPointerUp={() => keys.current.delete('w')} onPointerCancel={() => keys.current.delete('w')} onLostPointerCapture={() => keys.current.delete('w')} className="touch-none flex-1 select-none rounded-xl bg-emerald-600 px-4 py-3 font-semibold disabled:opacity-40">W · Accelerate</button><button onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); cancelCruise(); keys.current.add('s'); }} onPointerUp={() => keys.current.delete('s')} onPointerCancel={() => keys.current.delete('s')} onLostPointerCapture={() => keys.current.delete('s')} className="touch-none flex-1 select-none rounded-xl bg-rose-600 px-4 py-3 font-semibold">S · Brake</button><button aria-label={paused ? 'Resume simulation' : 'Pause simulation'} onClick={() => { silence(); keys.current.clear(); pauseRef.current = !pauseRef.current; setPaused(pauseRef.current); }} className="rounded-xl bg-white/10 p-3">{paused ? <Play size={18} /> : <Pause size={18} />}</button></div>
      <button aria-pressed={cruise !== null} disabled={!branch || !ready || (cruise === null && (paused || telemetry.velocity <= 0))} onClick={toggleCruise} className={"mt-3 w-full rounded-lg px-3 py-2 text-sm disabled:opacity-40 " + (cruise !== null ? 'bg-emerald-600 text-white' : 'bg-white/10 text-slate-200')}>C · {cruise !== null ? 'Cruise ' + (cruise * 3.6).toFixed(0) + ' km/h — cancel' : 'Cruise at current speed'}</button>
      <p className="mt-1 text-xs text-slate-400">Hold any moving speed with C. Cruise engages at the speed limit. S cancels and brakes; W returns to manual traction.</p>
      <button disabled={!branch || !ready || telemetry.velocity !== 0} aria-pressed={backing} onClick={toggleReverser} className="mt-3 w-full rounded-lg bg-sky-500/20 px-3 py-2 text-sm text-sky-200 disabled:opacity-40">V · {backing ? 'Reverse selected — switch to forward' : 'Forward selected — switch to reverse'}</button>
      <p className="mt-2 text-xs text-slate-400">Brake to a complete stop before changing direction. Reverse uses W for traction and S for braking, up to 20 km/h. Backing stops at the beginning of this track leg.</p>
      <div className="mt-3 flex items-center gap-2">
        <button onClick={toggleSound} aria-pressed={soundEnabled && soundStarted} className="flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-xs">{soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}{!soundStarted || !soundEnabled ? 'Enable sound' : 'Mute sound'}</button>
        <button disabled={!branch || !ready || paused || !soundEnabled} onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); horn('pointer-' + event.pointerId, true); }} onPointerUp={event => horn('pointer-' + event.pointerId, false)} onPointerCancel={event => horn('pointer-' + event.pointerId, false)} onLostPointerCapture={event => horn('pointer-' + event.pointerId, false)} onClick={event => { if (event.detail === 0) blast(); }} className="touch-none select-none rounded-lg bg-amber-500/20 px-3 py-2 text-xs text-amber-200 disabled:opacity-40">H · Horn</button>
        <label htmlFor="train-volume" className="sr-only">Train sound volume</label><input id="train-volume" aria-valuetext={Math.round(volume * 100) + '%'} type="range" min="0" max="100" value={Math.round(volume * 100)} onChange={event => setVolume(Number(event.target.value) / 100)} className="min-w-0 flex-1 accent-emerald-400" />
      </div>
      <p className="mt-2 text-[10px] text-slate-400">{recordingReady ? 'Recorded GE 7FDL V16 engine (AGE-30 family substitute)' : 'Synthesized diesel fallback'} · synthesized air horn. Hold H or the horn button.</p>
      <p className="mt-1 text-[10px] text-slate-500">Engine recording by <a href="https://freesound.org/people/WeenyBeany/sounds/773336/" target="_blank" rel="noreferrer" className="underline">WeenyBeany</a> · <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer" className="underline">CC BY 4.0</a> · looped and pitch adapted</p>
      {audioError && <p role="status" className="mt-2 text-xs text-amber-200">{audioError}</p>}
      <p className="mt-3 text-xs leading-relaxed text-slate-400">Hold W for traction, S for manual braking. Release to coast. Stations do not stop the train automatically. Space pauses. A/D are locked.</p>
      <p className="mt-2 text-[10px] text-slate-500">OSM tracks · Train stop profiles researched {train.researchedOn} from published lists; official current timetable unverified. Manual station stops.</p>
    </section>
    {ready && !!branch && <TouchDpad mode="rail" active={!!branch && !paused} onAccelerate={pressed => { if (pressed) { cancelCruise(); keys.current.add('w'); unlock(); } else keys.current.delete('w'); }} onBrake={pressed => { if (pressed) { cancelCruise(); keys.current.add('s'); } else keys.current.delete('s'); }} onCruise={toggleCruise} cruiseActive={cruise !== null} onReverser={toggleReverser} reverserBacking={backing} reverserDisabled={telemetry.velocity !== 0} onHorn={pressed => horn('pointer-touch', pressed)} hornDisabled={!soundEnabled || paused} />}
  </div>;
}
