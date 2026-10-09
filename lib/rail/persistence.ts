import type { RailBranch, RailDataset } from './types';
import { TRAINS, servicePath } from './trains';
import { createRailDeparture } from './departure';
import { railSpeedLimitKmh } from './physics';
export const RAIL_SAVE_KEY = 'nextpath:rail-journey:v1';
export interface RailSave {
  version: 1; trainId: string; serviceId: string | null; branch: RailBranch;
  stationId: string; reverse: boolean; km: number; velocity: number;
  direction: 1 | -1; departed: boolean; following: boolean;
  confirmed: string[]; lengthKm: number; cruise?: number | null;
}
/** Rebuild geometry from the current dataset, never from browser storage.
 * Reject obsolete routes and malformed progress instead of teleporting a train. */
export function restoreRailSave(raw: string, dataset: RailDataset) {
  if (raw.length > 32000) throw new Error('Oversized rail save.');
  const value = JSON.parse(raw) as RailSave;
  if (!value || value.version !== 1 || typeof value.trainId !== 'string' || typeof value.stationId !== 'string' || typeof value.reverse !== 'boolean' || typeof value.departed !== 'boolean' || typeof value.following !== 'boolean' || ![1,-1].includes(value.direction) || !Array.isArray(value.confirmed) || value.confirmed.some(id=>typeof id!=='string') || ![value.km,value.velocity,value.lengthKm].every(Number.isFinite)) throw new Error('Invalid rail save.');
  const train = TRAINS.find(train=>train.id===value.trainId);
  if (!train) throw new Error('Unknown saved train.');
  const service = train.services.find(service=>service.id===value.serviceId);
  if (value.serviceId !== null && !service) throw new Error('Unknown saved service.');
  if (service && value.branch!==train.pathId) throw new Error('Saved service route mismatch.');
  if (service && value.reverse) throw new Error('Saved service is already directed.');
  const path = service ? servicePath(dataset,train,service) : dataset.paths.find(path=>path.id===value.branch);
  if (!path) throw new Error('Unknown saved route.');
  const limit = railSpeedLimitKmh(path.id, value.direction) / 3.6;
  if (value.cruise !== undefined && value.cruise !== null && (!Number.isFinite(value.cruise) || value.cruise <= 0 || value.cruise > limit)) throw new Error('Invalid saved cruise speed.');
  const departure = createRailDeparture(path,value.stationId,value.reverse);
  const directed = departure.track.path;
  if (Math.abs(departure.track.lengthKm-value.lengthKm)>.00001 || value.km<0 || value.km>departure.track.lengthKm || value.velocity<0 || value.velocity>limit) throw new Error('Saved progress is outside its route.');
  const stops=directed.reversals??[];
  if (new Set(value.confirmed).size!==value.confirmed.length || value.confirmed.some(id=>!stops.some(stop=>stop.stationId===id && stop.km<=value.km+.000001)) || stops.some(stop=>stop.km<value.km-.000001 && !value.confirmed.includes(stop.stationId))) throw new Error('Invalid saved reversal confirmations.');
  return { value, departure };
}
