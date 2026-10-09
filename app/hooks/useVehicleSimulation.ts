'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import mapboxgl, { type Map as MapboxMap, type Marker } from 'mapbox-gl';
import { destination, distance } from '@turf/turf';
import { RoadNetwork, type RoadCursor, type Turn, type JunctionDecision } from '@/lib/roadNetwork';
import { DEFAULT_START, sampleDrivingRoute, type DrivingRoute, type Place } from '@/lib/routes';
import { isDrivingKey, nextVelocity, type DriveKey, type RoadVehicleState } from '@/lib/driving';
import { smoothBearing } from '@/lib/simulation';
import { getTurnPrompt, type TurnPrompt } from '@/lib/turnPrompt';
import type { PlaybackSpeed } from '@/lib/routeData';

export type SimulationMode = 'drive' | 'playback';
const DRIVE_ZOOM = 17;
const INITIAL_VEHICLE: RoadVehicleState = { position: DEFAULT_START.coordinate, heading: 180, velocity: 0, traveledKm: 0, routeKm: 0 };
interface Telemetry { turnLocked: boolean; turnPrompt: TurnPrompt | null; speedKmh: number; traveledKm: number; remainingKm: number | null; progress: number; arrived: boolean; position: [number, number]; pendingTurn: Turn | null; junctionHint: string; roadName: string; roadsReady: boolean }
const INITIAL_TELEMETRY: Telemetry = { turnLocked: false, turnPrompt: null, speedKmh: 0, traveledKm: 0, remainingKm: null, progress: 0, arrived: false, position: DEFAULT_START.coordinate, pendingTurn: null, junctionHint: 'Build a route to start driving', roadName: '', roadsReady: false };

export function useVehicleSimulation() {
  const [freeDriving, setFreeDriving] = useState(false);
  const freeDriveRef = useRef(false);
  const [ready, setReady] = useState(false);
  const [mode, setModeState] = useState<SimulationMode>('drive');
  const [active, setActive] = useState(false);
  const [following, setFollowing] = useState(true);
  const [speed, setSpeedState] = useState<PlaybackSpeed>(1);
  const [telemetry, setTelemetry] = useState(INITIAL_TELEMETRY);
  const mapRef = useRef<MapboxMap | null>(null);
  const markerRef = useRef<Marker | null>(null);
  const stateRef = useRef<RoadVehicleState>({ ...INITIAL_VEHICLE });
  const startRef = useRef(INITIAL_VEHICLE);
  const routeRef = useRef<DrivingRoute | null>(null);
  const routeDistanceRef = useRef(0);
  const networkRef = useRef(new RoadNetwork());
  const cursorRef = useRef<RoadCursor | null>(null);
  const turnRef = useRef<Turn | null>(null);
  const decisionRef = useRef<JunctionDecision | null>(null);
  const dismissedJunctionRef = useRef<string | null>(null);
  const blockedRef = useRef<string | null>(null);
  const roadCleanupRef = useRef<(() => void) | null>(null);
  const modeRef = useRef<SimulationMode>('drive');
  const activeRef = useRef(false);
  const followRef = useRef(true);
  const speedRef = useRef<PlaybackSpeed>(1);
  const cameraHeadingRef = useRef(INITIAL_VEHICLE.heading);
  const keysRef = useRef(new Set<DriveKey>());
  const suspendedRef = useRef(false);
  const reducedRef = useRef(false);
  const lastTimeRef = useRef<number | null>(null);

  const clearInput = useCallback(() => {
    keysRef.current.clear();
    stateRef.current = { ...stateRef.current, velocity: 0 };
    lastTimeRef.current = null;
  }, []);

  const updateTelemetry = useCallback(() => {
    const state = stateRef.current;
    const route = routeRef.current;
    const remainingKm = route ? modeRef.current === 'drive' ? distance(state.position, route.end.coordinate) : Math.max(0, route.distanceKm - routeDistanceRef.current) : null;
    const arrived = !!route && (modeRef.current === 'drive' ? remainingKm! < .015 : routeDistanceRef.current >= route.distanceKm);
    const junction = cursorRef.current ? networkRef.current.junction(cursorRef.current) : null;
    const junctionId = junction?.choices[0]?.edge.from ?? null;
    if (dismissedJunctionRef.current !== junctionId) dismissedJunctionRef.current = null;
    const turnPrompt = modeRef.current === 'drive' && !decisionRef.current ? getTurnPrompt(junction, dismissedJunctionRef.current) : null;
    const roadName = cursorRef.current ? networkRef.current.sample(cursorRef.current).name : '';
    const junctionHint = !cursorRef.current && freeDriveRef.current ? 'Loading nearby roads — pick a start on a road if none is found' : blockedRef.current ?? (junction ? junction.choices.length ? "In " + Math.round(junction.meters) + ' m: ' + [...new Set(junction.choices.map(choice => choice.turn))].join(' / ') : 'Road ends ahead — brake or reverse' : 'Continue along this road');
    setTelemetry({ turnLocked: !!decisionRef.current, turnPrompt, pendingTurn: turnRef.current, junctionHint, roadName, roadsReady: !!cursorRef.current, speedKmh: state.velocity * 3.6, traveledKm: state.traveledKm, remainingKm, progress: route ? Math.min(100, routeDistanceRef.current / route.distanceKm * 100) : 0, arrived, position: state.position });
    return arrived;
  }, []);

  const renderVehicle = useCallback((dt = 0, recenter = false) => {
    const vehicle = stateRef.current;
    if (markerRef.current) {
      markerRef.current.getElement().style.display = (routeRef.current || freeDriveRef.current) && (modeRef.current === 'playback' || cursorRef.current) ? '' : 'none';
      markerRef.current.setLngLat(vehicle.position).setRotation(vehicle.heading);
    }
    cameraHeadingRef.current = recenter ? vehicle.heading : smoothBearing(cameraHeadingRef.current, vehicle.heading, 1 - Math.exp(-dt * 5));
    if (followRef.current && mapRef.current) {
      // Look a little ahead to leave more road visible in front of the vehicle.
      const center = reducedRef.current ? vehicle.position : destination(vehicle.position, .025, cameraHeadingRef.current).geometry.coordinates as [number, number];
      const mobile = mapRef.current.getContainer().clientWidth < 640;
      const padding = { top: mobile ? 70 : 0, bottom: mobile ? 430 : 0, left: 0, right: 0 };
      mapRef.current.jumpTo({ center, padding, bearing: reducedRef.current ? 0 : cameraHeadingRef.current, pitch: reducedRef.current ? 0 : 60, ...(recenter ? { zoom: DRIVE_ZOOM } : {}) });
    }
  }, []);

  const initializeRoad = useCallback(() => {
    if (cursorRef.current || (!routeRef.current && !freeDriveRef.current) || modeRef.current !== 'drive') return false;
    const start = routeRef.current ? sampleDrivingRoute(routeRef.current, 0) : { position: startRef.current.position, bearing: startRef.current.heading };
    const cursor = networkRef.current.nearest(start.position, start.bearing, freeDriveRef.current ? 50 : 20);
    if (!cursor) return false;
    cursorRef.current = cursor;
    const sample = networkRef.current.sample(cursor);
    stateRef.current = { ...stateRef.current, position: sample.position, heading: sample.heading, velocity: 0 };
    return true;
  }, []);

  const readRoads = useCallback((map: MapboxMap) => {
    if (!map.isStyleLoaded()) return;
    const sources = new Set(map.getStyle().layers.filter(layer => 'source-layer' in layer && layer['source-layer'] === 'road').map(layer => 'source' in layer ? layer.source : '').filter((source): source is string => typeof source === 'string' && !!source));
    for (const source of sources) {
      networkRef.current.ingest(map.querySourceFeatures(source, { sourceLayer: 'road' }));
    }
    if (initializeRoad()) { renderVehicle(0, true); updateTelemetry(); }
  }, [initializeRoad, renderVehicle, updateTelemetry]);

  const attachMap = useCallback((map: MapboxMap) => {
    roadCleanupRef.current?.();
    mapRef.current = map;
    map.keyboard.disable(); // Mapbox keyboard movement must not compete with driving.
    markerRef.current?.remove();
    const element = document.createElement('div');
    element.className = 'vehicle';
    element.setAttribute('role', 'img');
    element.setAttribute('aria-label', 'Your vehicle');
    // Static trusted SVG, north-facing. Mapbox compensates for camera bearing.
    element.innerHTML = '<svg viewBox="0 0 30 52" xmlns="http://www.w3.org/2000/svg"><rect x="1" y="10" width="5" height="10" rx="2" fill="#020617"/><rect x="24" y="10" width="5" height="10" rx="2" fill="#020617"/><rect x="1" y="34" width="5" height="10" rx="2" fill="#020617"/><rect x="24" y="34" width="5" height="10" rx="2" fill="#020617"/><rect x="5" y="1" width="20" height="50" rx="7" fill="#38bdf8" stroke="#e0f2fe" stroke-width="1.5"/><path d="M8 13h14l-2 10H10z" fill="#0f172a"/><rect x="9" y="28" width="12" height="12" rx="2" fill="#0f172a"/><path d="M8 4h4M18 4h4" stroke="white" stroke-width="3"/><path d="M8 47h4M18 47h4" stroke="#fb7185" stroke-width="2"/></svg>';
    markerRef.current = new mapboxgl.Marker({ element, anchor: 'center', offset: [0, 0], altitude: 0, draggable: false, rotationAlignment: 'map', pitchAlignment: 'map' }).setLngLat(stateRef.current.position).addTo(map);
    renderVehicle(0, true);
    setReady(true);
    readRoads(map);
    let roadTimer: ReturnType<typeof setTimeout> | null = null;
    const refreshRoads = () => { if (roadTimer) return; roadTimer = setTimeout(() => { roadTimer = null; readRoads(map); }, 300); };
    map.on('idle', refreshRoads); map.on('sourcedata', refreshRoads);
    roadCleanupRef.current = () => { if (roadTimer) clearTimeout(roadTimer); map.off('idle', refreshRoads); map.off('sourcedata', refreshRoads); };
  }, [renderVehicle, readRoads]);

  const reset = useCallback(() => {
    clearInput();
    stateRef.current = { ...startRef.current, position: [...startRef.current.position] };
    decisionRef.current = null;
    dismissedJunctionRef.current = null;
    routeDistanceRef.current = 0; cursorRef.current = null; turnRef.current = null; blockedRef.current = null;
    initializeRoad();
    activeRef.current = (!!routeRef.current || freeDriveRef.current) && modeRef.current === 'drive';
    setActive(activeRef.current);
    updateTelemetry();
    renderVehicle(0, true);
  }, [clearInput, initializeRoad, renderVehicle, updateTelemetry]);

  const configureRoute = useCallback((route: DrivingRoute) => {
    freeDriveRef.current = false; setFreeDriving(false);
    routeRef.current = route;
    const start = sampleDrivingRoute(route, 0);
    startRef.current = { position: start.position, heading: start.bearing, velocity: 0, traveledKm: 0, routeKm: 0 };
    followRef.current = true; setFollowing(true);
    reset();
  }, [reset]);

  const relocate = useCallback((place: Place) => {
    freeDriveRef.current = false; setFreeDriving(false);
    routeRef.current = null;
    startRef.current = { position: [...place.coordinate], heading: 180, velocity: 0, traveledKm: 0, routeKm: 0 };
    modeRef.current = 'drive'; setModeState('drive');
    followRef.current = true; setFollowing(true);
    reset();
  }, [reset]);

  // Free drive shares the road graph and rAF physics; it never needs Directions
  // or a destination. New map tiles extend the graph as the camera follows.
  const startFreeDrive = useCallback((place: Place) => {
    routeRef.current = null;
    freeDriveRef.current = true; setFreeDriving(true);
    startRef.current = { position: [...place.coordinate], heading: mapRef.current?.getBearing() ?? 0, velocity: 0, traveledKm: 0, routeKm: 0 };
    modeRef.current = 'drive'; setModeState('drive');
    followRef.current = true; setFollowing(true);
    reset();
  }, [reset]);
  const setMode = useCallback((next: SimulationMode) => {
    if (!routeRef.current && !freeDriveRef.current) return;
    if (next === 'playback' && !routeRef.current) return;
    modeRef.current = next; setModeState(next);
    followRef.current = true; setFollowing(true);
    reset();
  }, [reset]);

  const toggle = useCallback(() => {
    if (!routeRef.current && !freeDriveRef.current) return;
    if (modeRef.current === 'playback' && updateTelemetry()) { reset(); activeRef.current = true; }
    else activeRef.current = !activeRef.current;
    setActive(activeRef.current);
    clearInput(); updateTelemetry();
  }, [clearInput, reset, updateTelemetry]);

  const suspend = useCallback((value: boolean) => { suspendedRef.current = value; if (value) clearInput(); }, [clearInput]);
  const stop = useCallback(() => { activeRef.current = false; setActive(false); clearInput(); updateTelemetry(); }, [clearInput, updateTelemetry]);
  const explore = useCallback(() => { followRef.current = false; setFollowing(false); }, []);
  const focusPlace = useCallback((place: Place) => { explore(); mapRef.current?.easeTo({ center: place.coordinate, zoom: 16, pitch: 0, bearing: 0, duration: reducedRef.current ? 0 : 700 }); }, [explore]);
  const follow = useCallback(() => { followRef.current = true; setFollowing(true); mapRef.current?.stop(); renderVehicle(0, true); }, [renderVehicle]);
  const overview = useCallback(() => {
    const route = routeRef.current;
    if (!route || !mapRef.current) return;
    explore();
    const bounds = new mapboxgl.LngLatBounds();
    for (const coordinate of route.feature.geometry.coordinates) bounds.extend(coordinate as [number, number]);
    mapRef.current.fitBounds(bounds, { padding: { top: 100, bottom: 300, left: 60, right: 60 }, pitch: 0, bearing: 0, duration: reducedRef.current ? 0 : 700, maxZoom: 17 });
  }, [explore]);
  const getSearchProximity = useCallback((): [number, number] => {
    const center = mapRef.current?.getCenter();
    return center ? [center.lng, center.lat] : startRef.current.position;
  }, []);
  const setSpeed = useCallback((value: PlaybackSpeed) => { speedRef.current = value; setSpeedState(value); }, []);
  const chooseTurn = useCallback((turn: Turn | null) => {
    if (decisionRef.current || !cursorRef.current || suspendedRef.current || !activeRef.current || modeRef.current !== 'drive') return;
    const decision = networkRef.current.decide(cursorRef.current, turn ?? 'straight');
    if (!decision) return; // Invalid/unavailable directions never replace a valid choice.
    decisionRef.current = decision;
    dismissedJunctionRef.current = decision.nodeId;
    turnRef.current = decision.turn; blockedRef.current = null; updateTelemetry();
  }, [updateTelemetry]);
  const setKey = useCallback((key: DriveKey, pressed: boolean) => {
    if (pressed && (!!routeRef.current || freeDriveRef.current) && modeRef.current === 'drive' && activeRef.current && !suspendedRef.current) {
      if (key === 'a' || key === 'd') chooseTurn(key === 'a' ? 'left' : 'right');
      else keysRef.current.add(key);
    } else keysRef.current.delete(key);
  }, [chooseTurn]);

  useEffect(() => {
    const pressedKeys = keysRef.current;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const preference = () => { reducedRef.current = media.matches; };
    preference(); media.addEventListener('change', preference);
    const editable = (target: EventTarget | null) => target instanceof HTMLElement && (!!target.closest('input, textarea, select, [contenteditable="true"]'));
    const keydown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.altKey || event.metaKey || editable(event.target) || (!isDrivingKey(event.key) && event.key !== 'Enter') || modeRef.current !== 'drive' || !activeRef.current || suspendedRef.current || !mapRef.current || (!routeRef.current && !freeDriveRef.current)) return;
      if (event.key === 'Enter' && event.target instanceof HTMLElement && event.target.closest('button, a')) return;
      event.preventDefault();
      if (event.key === 'Enter') { if (!event.repeat) chooseTurn('straight'); return; }
      const key = event.key.toLowerCase() as DriveKey;
      if (key === 'a' || key === 'd') { if (!event.repeat) chooseTurn(key === 'a' ? 'left' : 'right'); }
      else keysRef.current.add(key);
    };
    const keyup = (event: KeyboardEvent) => { if (isDrivingKey(event.key)) keysRef.current.delete(event.key.toLowerCase() as DriveKey); };
    const focus = (event: FocusEvent) => { if (editable(event.target)) clearInput(); };
    const visibility = () => { clearInput(); updateTelemetry(); };
    window.addEventListener('keydown', keydown);
    window.addEventListener('keyup', keyup);
    window.addEventListener('blur', visibility);
    document.addEventListener('visibilitychange', visibility);
    document.addEventListener('focusin', focus);
    const resize = () => renderVehicle();
    window.addEventListener('resize', resize);
    let frame = 0, lastUiUpdate = 0;
    const tick = (now: number) => {
      const previous = lastTimeRef.current; lastTimeRef.current = now;
      if (mapRef.current && markerRef.current && activeRef.current && !suspendedRef.current && !document.hidden) {
        // One loop owns both manual physics and playback. Background/tab stalls
        // cannot accumulate time; only HUD updates cause React renders (~10Hz).
        const dt = previous === null ? 0 : Math.min((now - previous) / 1000, .1);
        const previousVehicle = stateRef.current;
        if (modeRef.current === 'drive') {
          if (cursorRef.current) {
            const velocity = nextVelocity(stateRef.current.velocity, keysRef.current, dt);
            const result = networkRef.current.advance(cursorRef.current, (stateRef.current.velocity + velocity) / 2 * dt / 1000, null, decisionRef.current);
            if (result.decisionPassed) decisionRef.current = null;
            cursorRef.current = result.cursor; turnRef.current = decisionRef.current?.turn ?? null; blockedRef.current = result.blocked;
            const sample = networkRef.current.sample(result.cursor);
            stateRef.current = { ...stateRef.current, position: sample.position, heading: sample.heading, velocity: result.blocked ? 0 : velocity, traveledKm: stateRef.current.traveledKm + result.movedKm };
          } else stateRef.current = { ...stateRef.current, velocity: 0 };
        }
        else if (routeRef.current) {
          const route = routeRef.current;
          // Realistic 60km/h base speed, rather than compressing a cross-country
          // journey into minutes at street zoom. Multipliers affect playback only.
          routeDistanceRef.current = Math.min(route.distanceKm, routeDistanceRef.current + dt * 60 / 3600 * speedRef.current);
          const sample = sampleDrivingRoute(route, routeDistanceRef.current);
          stateRef.current = { position: sample.position, heading: smoothBearing(stateRef.current.heading, sample.bearing, 1 - Math.exp(-dt * 10)), velocity: 60 / 3.6 * speedRef.current, traveledKm: routeDistanceRef.current, routeKm: routeDistanceRef.current };
        }
        // Avoid re-rendering WebGL while the car and camera are stationary.
        const moving = Math.abs(stateRef.current.velocity) > .001 || Math.abs(previousVehicle.velocity) > .001;
        const turningCamera = Math.abs(smoothBearing(cameraHeadingRef.current, stateRef.current.heading, 1) - cameraHeadingRef.current) > .01;
        if (moving || turningCamera) renderVehicle(dt);
        if (now - lastUiUpdate >= 100) {
          if (updateTelemetry() && modeRef.current === 'playback') { activeRef.current = false; setActive(false); clearInput(); updateTelemetry(); }
          lastUiUpdate = now;
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('keydown', keydown); window.removeEventListener('keyup', keyup);
      window.removeEventListener('blur', visibility); document.removeEventListener('visibilitychange', visibility); document.removeEventListener('focusin', focus);
      media.removeEventListener('change', preference);
      window.removeEventListener('resize', resize);
      roadCleanupRef.current?.(); roadCleanupRef.current = null;
      markerRef.current?.remove(); markerRef.current = null; mapRef.current = null;
      pressedKeys.clear();
    };
  }, [clearInput, chooseTurn, renderVehicle, updateTelemetry]);

  return { getSearchProximity, freeDriving, startFreeDrive, ready, mode, active, following, speed, telemetry, attachMap, configureRoute, relocate, setMode, toggle, reset, suspend, stop, explore, focusPlace, follow, overview, setSpeed, setKey, chooseTurn };
}
















