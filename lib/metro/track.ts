import { bearing, distance } from '@turf/turf';
import type { Coordinate } from '../routeData';
import { ORANGE_STATIONS, type MetroDataset, type MetroPath } from './types';
export function validateMetroDataset(value: unknown): MetroDataset {
  const data=value as MetroDataset;
  const point=(p:unknown):p is Coordinate=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite)&&p[0]>74.18&&p[0]<74.45&&p[1]>31.40&&p[1]<31.65;
  if(!data||data.version!==1||data.id!=='lahore-orange'||typeof data.fingerprint!=='string'||!Array.isArray(data.paths)||data.paths.length!==2||typeof data.attribution!=='string')throw Error('Invalid Orange Line data');
  const directions=new Set(['dera-gujran','ali-town']);
  for(const path of data.paths) {
    if(!directions.delete(path.direction)||!Array.isArray(path.coordinates)||path.coordinates.length<26||!path.coordinates.every(point)||!Number.isFinite(path.distanceKm)||path.distanceKm<24||path.distanceKm>29||!Array.isArray(path.sections)||!path.sections.length||path.sections.some(section=>typeof section.underground!=='boolean'||!Array.isArray(section.coordinates)||section.coordinates.length<2||!section.coordinates.every(point)))throw Error('Invalid metro track');
    const names=path.direction==='dera-gujran'?[...ORANGE_STATIONS]:[...ORANGE_STATIONS].reverse();
    if(!Array.isArray(path.stations)||path.stations.length!==26||path.destination!==names.at(-1))throw Error('Missing metro stations');
    let previous=-1;const ids=new Set<string>();
    for(const [i,s] of path.stations.entries()) {
      if(!s||ids.has(s.id)||s.id!==`ol-${ORANGE_STATIONS.indexOf(names[i])+1}`||s.name!==names[i]||!point(s.coordinate)||!Number.isFinite(s.km)||s.km<=previous||s.km<0||s.km>path.distanceKm+.000001||!Number.isInteger(s.sourceId)||s.underground!==(s.name==='GPO'||s.name==='Anarkali'))throw Error('Invalid metro platform');
      ids.add(s.id);previous=s.km;
    }
    const track=indexMetroTrack(path);
    if(Math.abs(track.lengthKm-path.distanceKm)>.000001||path.stations[0].km>.000001||Math.abs(path.stations.at(-1)!.km-path.distanceKm)>.000001)throw Error('Invalid metro chainage');
    for(const station of path.stations) if(distance(sampleMetroTrack(track,station.km).position,station.coordinate)>.00001)throw Error('Platform is off the metro track');
  }
  return data;
}
export function indexMetroTrack(path:MetroPath) {
  const cumulative=[0];for(let i=1;i<path.coordinates.length;i++)cumulative.push(cumulative[i-1]+distance(path.coordinates[i-1],path.coordinates[i]));
  const tunnelEdges=new Set(path.sections.filter(section=>section.underground).flatMap(section=>section.coordinates.slice(1).map((point,i)=>`${section.coordinates[i]}|${point}`)));
  const underground=path.coordinates.slice(1).map((point,i)=>tunnelEdges.has(`${path.coordinates[i]}|${point}`));
  return {path,cumulative,underground,lengthKm:cumulative.at(-1)!};
}
/** Binary search and segment interpolation avoid scanning the full route at 60fps. */
export function sampleMetroTrack(track:ReturnType<typeof indexMetroTrack>,km:number) {
  const at=Math.max(0,Math.min(km,track.lengthKm));let low=0,high=track.cumulative.length-1;
  while(low+1<high){const mid=(low+high)>>>1;if(track.cumulative[mid]<=at)low=mid;else high=mid;}
  const a=track.path.coordinates[low],b=track.path.coordinates[low+1];
  const ratio=(at-track.cumulative[low])/(track.cumulative[low+1]-track.cumulative[low]);
  return {position:[a[0]+(b[0]-a[0])*ratio,a[1]+(b[1]-a[1])*ratio] as Coordinate,heading:(bearing(a,b)+360)%360,underground:track.underground[low]};
}
