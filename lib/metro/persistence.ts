import { metroDeparture, platformAt, type MetroMotion } from './motion';
import { METRO_MAX_KMH, type MetroDataset, type MetroDirection } from './types';
export const METRO_SAVE_KEY='nextpath:metro-orange:v1';
export interface MetroSave {version:1;fingerprint:string;direction:MetroDirection;stationId:string;motion:MetroMotion;following:boolean}
export function restoreMetroSave(raw:string,data:MetroDataset) {
  if(raw.length>8000)throw Error('Oversized metro save');const value=JSON.parse(raw) as MetroSave;
  const path=data.paths.find(path=>path.direction===value?.direction);
  if(!value||value.version!==1||value.fingerprint!==data.fingerprint||!path||typeof value.following!=='boolean'||typeof value.stationId!=='string')throw Error('Obsolete metro save');
  const departure=metroDeparture(path,value.stationId),m=value.motion;
  if(!m||![m.km,m.velocity,m.dwellSeconds,m.nextStop].every(Number.isFinite)||m.km<departure.km||m.km>path.distanceKm||m.velocity<0||m.velocity>METRO_MAX_KMH/3.6||!Number.isInteger(m.nextStop)||m.nextStop<departure.nextStop||m.nextStop>26||path.stations[m.nextStop-1].km>m.km+.025||typeof m.doorsOpen!=='boolean'||typeof m.automatic!=='boolean'||m.dwellSeconds<0||m.dwellSeconds>12||m.doorsOpen&&(!platformAt(path,m)||m.velocity!==0)||!m.doorsOpen&&m.dwellSeconds!==0||m.km===path.distanceKm&&m.velocity!==0||m.nextStop<26&&path.stations[m.nextStop].km<m.km-.025)throw Error('Invalid saved metro progress');
  return {value,path,departure};
}
