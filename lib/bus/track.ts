import { bearing, distance } from '@turf/turf';
import type { Coordinate } from '../routeData';
import { type BusDataset, type BusPath, type BusNetworkId } from './types';
import { busNetwork } from './networks';
export function validateBusDataset(value: unknown, expectedId?:BusNetworkId): BusDataset {
  const data=value as BusDataset;
  const network=busNetwork(data?.id);
  const [west,south,east,north]=network.bounds;
  const point=(p:unknown):p is Coordinate=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&p[0]>west&&p[0]<east&&p[1]>south&&p[1]<north;
  if(!data||data.version!==1||expectedId!==undefined&&data.id!==expectedId||typeof data.fingerprint!=='string'||!/^[a-f0-9]{16}$/.test(data.fingerprint)||typeof data.sourceTimestamp!=='string'||!Number.isFinite(Date.parse(data.sourceTimestamp))||!Array.isArray(data.paths)||data.paths.length!==2||typeof data.attribution!=='string')throw Error('Invalid Metrobus data');
  const directions=new Set(network.directions.map(d=>d.id));
  for(const path of data.paths) {
    if(!directions.delete(path.direction)||!Array.isArray(path.coordinates)||path.coordinates.length<network.stations.length||!path.coordinates.every(point)||!Number.isFinite(path.distanceKm)||path.distanceKm<network.lengthRange[0]||path.distanceKm>network.lengthRange[1]||!Array.isArray(path.sections)||!path.sections.length||path.sections.some(section=>typeof section.underground!=='boolean'||!Array.isArray(section.coordinates)||section.coordinates.length<2||!section.coordinates.every(point)))throw Error('Invalid bus track');
    const names=path.direction===network.directions[0].id?[...network.stations]:[...network.stations].reverse();
    if(!Array.isArray(path.stations)||path.stations.length!==network.stations.length||path.destination!==names.at(-1))throw Error('Missing bus stations');
    let previous=-1;const ids=new Set<string>();
    for(const [i,s] of path.stations.entries()) {
      if(!s||ids.has(s.id)||s.id!==`${network.stationPrefix}${network.stations.indexOf(names[i])+1}`||s.name!==names[i]||!point(s.coordinate)||!Number.isFinite(s.km)||s.km<=previous||s.km<0||s.km>path.distanceKm+.000001||!Number.isInteger(s.sourceId)||typeof s.underground!=='boolean')throw Error('Invalid bus platform');
      ids.add(s.id);previous=s.km;
    }
    const track=indexBusTrack(path);
    if(Math.abs(track.lengthKm-path.distanceKm)>.000001||path.stations[0].km>.000001||Math.abs(path.stations.at(-1)!.km-path.distanceKm)>.000001)throw Error('Invalid bus chainage');
    for(const station of path.stations) if(distance(sampleBusTrack(track,station.km).position,station.coordinate)>.00001)throw Error('Platform is off the bus track');
  }
  return data;
}
export function indexBusTrack(path:BusPath) {
  const cumulative=[0];for(let i=1;i<path.coordinates.length;i++){const km=distance(path.coordinates[i-1],path.coordinates[i]);if(km<=0)throw Error("Duplicate busway vertex");cumulative.push(cumulative[i-1]+km);}
  const tunnelEdges=new Set(path.sections.filter(section=>section.underground).flatMap(section=>section.coordinates.slice(1).map((point,i)=>`${section.coordinates[i]}|${point}`)));
  const underground=path.coordinates.slice(1).map((point,i)=>tunnelEdges.has(`${path.coordinates[i]}|${point}`));
  return {path,cumulative,underground,lengthKm:cumulative.at(-1)!};
}
/** Binary search and segment interpolation avoid scanning the full route at 60fps. */
export function sampleBusTrack(track:ReturnType<typeof indexBusTrack>,km:number) {
  const at=Math.max(0,Math.min(km,track.lengthKm));let low=0,high=track.cumulative.length-1;
  while(low+1<high){const mid=(low+high)>>>1;if(track.cumulative[mid]<=at)low=mid;else high=mid;}
  const a=track.path.coordinates[low],b=track.path.coordinates[low+1];
  const ratio=(at-track.cumulative[low])/(track.cumulative[low+1]-track.cumulative[low]);
  return {position:[a[0]+(b[0]-a[0])*ratio,a[1]+(b[1]-a[1])*ratio] as Coordinate,heading:(bearing(a,b)+360)%360,underground:track.underground[low]};
}
