import { busDeparture, platformAt, type BusMotion } from './motion';
import { BUS_MAX_KMH, type BusDataset, type BusDirection } from './types';
// Retain the original Lahore key for existing saved journeys. The controller
// selects each city's key from BUS_NETWORKS.
export const BUS_SAVE_KEY='nextpath:metrobus-lahore:v1';
export interface BusSave {version:1;fingerprint:string;direction:BusDirection;stationId:string;motion:BusMotion;following:boolean}
export function restoreBusSave(raw:string,data:BusDataset) {
  if(raw.length>8000)throw Error('Oversized bus save');const value=JSON.parse(raw) as BusSave;
  const path=data.paths.find(path=>path.direction===value?.direction);
  if(!value||value.version!==1||value.fingerprint!==data.fingerprint||!path||typeof value.following!=='boolean'||typeof value.stationId!=='string')throw Error('Obsolete bus save');
  const departure=busDeparture(path,value.stationId),m=value.motion;
  if(!m||![m.km,m.velocity,m.dwellSeconds,m.nextStop].every(Number.isFinite)||m.km<departure.km||m.km>path.distanceKm||m.velocity<0||m.velocity>BUS_MAX_KMH/3.6||!Number.isInteger(m.nextStop)||m.nextStop<departure.nextStop||m.nextStop>path.stations.length||path.stations[m.nextStop-1].km>m.km+.025||typeof m.doorsOpen!=='boolean'||typeof m.automatic!=='boolean'||m.dwellSeconds<0||m.dwellSeconds>12||m.doorsOpen&&(!platformAt(path,m)||m.velocity!==0)||!m.doorsOpen&&m.dwellSeconds!==0||m.km===path.distanceKm&&m.velocity!==0||m.nextStop<path.stations.length&&path.stations[m.nextStop].km<m.km-.025)throw Error('Invalid saved bus progress');
  return {value,path,departure};
}
