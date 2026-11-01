import type { Place } from './routes';

// City-level network fallback for browsers that cannot produce a device fix.
// It runs only from a location click, never in the background.
const ENDPOINT = 'https://ipwho.is/';
const TIMEOUT_MS = 8000;
const UNAVAILABLE = 'Approximate location is unavailable. Search for a place or pick on the map.';

interface Payload {
  success?: boolean;
  latitude?: unknown;
  longitude?: unknown;
  city?: unknown;
  country?: unknown;
}

/** One city-level lookup from the connection's address; abortable with the click. */
export async function approximateLocation(signal: AbortSignal): Promise<Place> {
  let response: Response;
  try {
    response = await fetch(ENDPOINT, { signal: AbortSignal.any([signal, AbortSignal.timeout(TIMEOUT_MS)]), headers: { accept: 'application/json' } });
  } catch (failure) {
    if (failure instanceof DOMException && failure.name === 'AbortError') throw failure;
    throw new Error(UNAVAILABLE);
  }
  if (!response.ok) throw new Error(UNAVAILABLE);
  let data: Payload;
  try {
    data = await response.json() as Payload;
  } catch {
    throw new Error(UNAVAILABLE);
  }
  const latitude = Number(data?.latitude);
  const longitude = Number(data?.longitude);
  if (data?.success !== true || !Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    throw new Error(UNAVAILABLE);
  }
  const area = [data.city, data.country].find((value): value is string => typeof value === 'string' && !!value.trim());
  return { label: `Approximate location${area ? ` · ${area.trim()}` : ''}`, coordinate: [longitude, latitude] };
}
