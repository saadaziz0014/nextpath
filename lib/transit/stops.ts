/** Shared station state for Orange Line and both Metrobus networks. */
export interface TransitMotion {
  km: number;
  velocity: number;
  doorsOpen: boolean;
  dwellSeconds: number;
  nextStop: number;
  automatic: boolean;
}
interface Station { km: number }
interface StopPath { stations: readonly Station[] }
export const PLATFORM_TOLERANCE_KM = .025;

export function stoppedPlatform<T extends Station>(path: { stations: readonly T[] }, state: TransitMotion): T | null {
  return state.velocity < .05
    ? path.stations.find(station => Math.abs(station.km - state.km) <= PLATFORM_TOLERANCE_KM) ?? null
    : null;
}

/** Skip only platforms behind us. The boarding radius must never skip an
 * upcoming stop, even when auto is enabled in the last few metres. Keep the
 * served-stop cursor so switching modes during dwell cannot serve it twice. */
export function pendingStopIndex(path: StopPath, state: TransitMotion): number {
  let index = state.nextStop;
  while (index < path.stations.length && path.stations[index].km < state.km - 1e-9) index++;
  return index;
}

/** Manual boarding anywhere inside the terminal platform finishes the trip;
 * it must not show an endless departure countdown for a served final stop. */
export function transitJourneyFinished(path: StopPath & { distanceKm: number }, state: TransitMotion): boolean {
  return state.km >= path.distanceKm - .000001 ||
    (state.nextStop === path.stations.length && stoppedPlatform(path, state) === path.stations.at(-1));
}

export function toggleAutomaticStops(path: StopPath, state: TransitMotion, dwellSeconds: number): TransitMotion {
  const automatic = !state.automatic;
  return {
    ...state,
    automatic,
    nextStop: automatic ? pendingStopIndex(path, state) : state.nextStop,
    dwellSeconds: automatic && state.doorsOpen ? dwellSeconds : 0,
  };
}

export function togglePlatformDoors(path: StopPath, state: TransitMotion): TransitMotion {
  const station = stoppedPlatform(path, state);
  if (!station) return state;
  const doorsOpen = !state.doorsOpen;
  return {
    ...state,
    // An accepted platform stop is at rest immediately, including tiny residual
    // velocities. Saving in the same event must never store moving open doors.
    velocity: 0,
    doorsOpen,
    automatic: false,
    dwellSeconds: 0,
    // Boarding in manual mode serves this platform too. Resuming auto should
    // close these doors and continue to the following station, not stop twice.
    nextStop: doorsOpen ? Math.max(state.nextStop, path.stations.indexOf(station) + 1) : state.nextStop,
  };
}
