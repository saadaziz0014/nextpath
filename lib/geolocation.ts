import type { Place } from './routes';

const PRECISE: PositionOptions = { enableHighAccuracy: true, timeout: 6000, maximumAge: 30000 };
// High-accuracy requests can stall on desktops without GPS or with the OS
// location provider off; a coarse, possibly cached network fix still snaps to
// a loaded road and frees the waiting driver.
const COARSE: PositionOptions = { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 };
// Browsers may stay silent while a provider stalls, so a slightly later
// watchdog guarantees that every attempt settles.
const WATCHDOG_MS = 2500;
const DENIED = 'Location access was denied. Allow Location for this site from the address bar, then reload.';
const UNAVAILABLE = 'Your location is unavailable. Enable system location services for this browser, then try again, or search or pick on the map.';
const TIMED_OUT = 'Finding your location timed out. Check system location settings or try again, or search or pick on the map.';
const INVALID = 'Your device returned an invalid location. Try again or pick on the map.';
const FAILED = 'Unable to request your location. Try again or pick on the map.';
const CANCELLED = 'Location request cancelled';

/** Why a device fix failed; callers use this to decide whether to offer a fallback. */
export type LocationFailure = 'denied' | 'unavailable' | 'timeout' | 'invalid' | 'failed';

/** Carries the failure category alongside the driver-facing guidance. */
export class LocationError extends Error {
  readonly reason: LocationFailure;
  constructor(reason: LocationFailure, message: string) {
    super(message);
    this.name = 'LocationError';
    this.reason = reason;
  }
}

const isAbort = (failure: unknown): failure is DOMException => failure instanceof DOMException && failure.name === 'AbortError';

/** The browser's own explanation, e.g. "Location services are disabled". */
function detail(failure: unknown): string {
  if (typeof failure !== 'object' || failure === null) return '';
  const value = (failure as { message?: unknown }).message;
  return typeof value === 'string' ? value.trim() : '';
}

function reasonOf(failure: unknown): LocationFailure {
  const code = typeof failure === 'object' && failure !== null && 'code' in failure ? (failure as GeolocationPositionError).code : 0;
  return code === 1 ? 'denied' : code === 2 ? 'unavailable' : code === 3 ? 'timeout' : 'failed';
}

function guidance(reason: LocationFailure, failure: unknown): string {
  const base = reason === 'denied' ? DENIED : reason === 'unavailable' ? UNAVAILABLE : reason === 'timeout' ? TIMED_OUT : reason === 'invalid' ? INVALID : FAILED;
  const reasonText = detail(failure);
  return reasonText && !base.toLowerCase().includes(reasonText.toLowerCase()) ? `${base} (${reasonText})` : base;
}

/** One location fix; aborted requests cannot update a later endpoint selection. */
export async function currentLocation(geolocation: Pick<Geolocation, 'getCurrentPosition'>, signal: AbortSignal): Promise<Place> {
  try {
    return await fix(geolocation, signal, PRECISE);
  } catch (failure) {
    if (isAbort(failure)) throw failure;
    const error = failure instanceof LocationError ? failure : new LocationError('failed', guidance('failed', failure));
    // A denial is the driver's decision and an invalid fix will not improve; both are final.
    if (error.reason === 'denied' || error.reason === 'invalid') throw error;
    try {
      return await fix(geolocation, signal, COARSE);
    } catch (final) {
      if (isAbort(final)) throw final;
      throw final instanceof LocationError ? final : new LocationError('failed', guidance('failed', final));
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
    const watchdog = setTimeout(() => finish(() => reject(new LocationError('timeout', TIMED_OUT))), (options.timeout ?? 0) + WATCHDOG_MS);
    signal.addEventListener('abort', abort, { once: true });
    try {
      geolocation.getCurrentPosition(position => finish(() => {
        const { longitude, latitude } = position.coords;
        if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || Math.abs(longitude) > 180 || Math.abs(latitude) > 90) {
          reject(new LocationError('invalid', INVALID));
          return;
        }
        resolve({ label: `My location (${latitude.toFixed(5)}, ${longitude.toFixed(5)})`, coordinate: [longitude, latitude] });
      }), error => finish(() => {
        const reason = reasonOf(error);
        reject(new LocationError(reason, guidance(reason, error)));
      }), options);
    } catch {
      finish(() => reject(new LocationError('failed', FAILED)));
    }
  });
}
