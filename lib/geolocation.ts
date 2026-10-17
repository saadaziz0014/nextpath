import type { Place } from './routes';

const PRECISE: PositionOptions = { enableHighAccuracy: true, timeout: 6000, maximumAge: 30000 };
// High-accuracy requests can stall on desktops without GPS or with the OS
// location provider off; a coarse, possibly cached network fix still snaps to
// a loaded road and frees the waiting driver.
const COARSE: PositionOptions = { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 };
// Browsers may stay silent while a provider stalls, so a slightly later
// watchdog guarantees that every attempt settles.
const WATCHDOG_MS = 2500;
const DENIED = 'Location access was denied. Allow location in your browser settings, then try again.';
const UNAVAILABLE = 'Your location is unavailable. Try again or pick on the map.';
const TIMED_OUT = 'Finding your location timed out. Try again or pick on the map.';
const INVALID = 'Your device returned an invalid location. Try again or pick on the map.';
const FAILED = 'Unable to request your location. Try again or pick on the map.';
const CANCELLED = 'Location request cancelled';

/** A denial, invalid device fix or browser exception cannot improve by retrying. */
class FinalError extends Error {}

const isAbort = (failure: unknown): failure is DOMException => failure instanceof DOMException && failure.name === 'AbortError';
const isDenied = (failure: unknown) => typeof failure === 'object' && failure !== null && (failure as GeolocationPositionError).code === 1;

function message(failure: unknown): string {
  const code = typeof failure === 'object' && failure !== null && 'code' in failure ? (failure as GeolocationPositionError).code : 0;
  if (code === 1) return DENIED;
  if (code === 2) return UNAVAILABLE;
  if (code === 3) return TIMED_OUT;
  return failure instanceof Error ? failure.message : FAILED;
}

/** One location fix; aborted requests cannot update a later endpoint selection. */
export async function currentLocation(geolocation: Pick<Geolocation, 'getCurrentPosition'>, signal: AbortSignal): Promise<Place> {
  try {
    return await fix(geolocation, signal, PRECISE);
  } catch (failure) {
    if (isAbort(failure)) throw failure;
    if (isDenied(failure) || failure instanceof FinalError) throw new Error(message(failure));
    try {
      return await fix(geolocation, signal, COARSE);
    } catch (final) {
      throw new Error(message(final));
    }
  }
}

function fix(geolocation: Pick<Geolocation, 'getCurrentPosition'>, signal: AbortSignal, options: PositionOptions): Promise<Place> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException(CANCELLED, 'AbortError')); return; }
    let settled = false;
    const finish = (action: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(watchdog);
      signal.removeEventListener('abort', abort);
      action();
    };
    const abort = () => finish(() => reject(new DOMException(CANCELLED, 'AbortError')));
    const watchdog = setTimeout(() => finish(() => reject(new Error(TIMED_OUT))), (options.timeout ?? 0) + WATCHDOG_MS);
    signal.addEventListener('abort', abort, { once: true });
    try {
      geolocation.getCurrentPosition(position => finish(() => {
        const { longitude, latitude } = position.coords;
        if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || Math.abs(longitude) > 180 || Math.abs(latitude) > 90) {
          reject(new FinalError(INVALID));
          return;
        }
        resolve({ label: `My location (${latitude.toFixed(5)}, ${longitude.toFixed(5)})`, coordinate: [longitude, latitude] });
      }), error => finish(() => reject(error)), options);
    } catch {
      finish(() => reject(new Error(FAILED)));
    }
  });
}
