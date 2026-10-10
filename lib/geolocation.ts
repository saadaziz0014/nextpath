import type { Place } from './routes';

/** One location fix; aborted requests cannot update a later endpoint selection. */
export function currentLocation(geolocation: Pick<Geolocation, 'getCurrentPosition'>, signal: AbortSignal): Promise<Place> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException('Location request cancelled', 'AbortError')); return; }
    let settled = false;
    const finish = (action: () => void) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener('abort', abort);
      action();
    };
    const abort = () => finish(() => reject(new DOMException('Location request cancelled', 'AbortError')));
    signal.addEventListener('abort', abort, { once: true });
    try {
      geolocation.getCurrentPosition(position => finish(() => {
        const { longitude, latitude } = position.coords;
        if (!Number.isFinite(longitude) || !Number.isFinite(latitude) || Math.abs(longitude) > 180 || Math.abs(latitude) > 90) {
          reject(new Error('Your device returned an invalid location. Try again or pick on the map.'));
          return;
        }
        resolve({ label: `My location (${latitude.toFixed(5)}, ${longitude.toFixed(5)})`, coordinate: [longitude, latitude] });
      }), error => finish(() => reject(new Error(error.code === 1
        ? 'Location access was denied. Allow location in your browser settings, then try again.'
        : error.code === 3 ? 'Finding your location timed out. Try again or pick on the map.'
        : 'Your location is unavailable. Try again or pick on the map.'))),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 });
    } catch {
      finish(() => reject(new Error('Unable to request your location. Try again or pick on the map.')));
    }
  });
}
