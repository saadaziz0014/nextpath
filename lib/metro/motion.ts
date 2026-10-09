import { METRO_MAX_KMH, type MetroPath } from './types';
import { pendingStopIndex, stoppedPlatform, toggleAutomaticStops, togglePlatformDoors, type TransitMotion } from '../transit/stops';
export const METRO_ACCELERATION=1.0;
export const METRO_BRAKE=1.15;
export const METRO_DWELL_SECONDS=12;
export type MetroMotion = TransitMotion;
export function metroDeparture(path:MetroPath,stationId:string):MetroMotion {
  const at=path.stations.findIndex(station=>station.id===stationId);
  if(at<0||at===path.stations.length-1)throw Error('Choose the other direction to depart from this station.');
  return {km:path.stations[at].km,velocity:0,doorsOpen:false,dwellSeconds:0,nextStop:at+1,automatic:false};
}
export function platformAt(path:MetroPath,state:MetroMotion) {
  return stoppedPlatform(path,state);
}
export function toggleMetroDoors(path:MetroPath,state:MetroMotion):MetroMotion {
  return togglePlatformDoors(path,state);
}
export function toggleMetroAutomatic(path:MetroPath,state:MetroMotion):MetroMotion {
  return toggleAutomaticStops(path,state,METRO_DWELL_SECONDS);
}
export function stepMetro(state:MetroMotion,keys:ReadonlySet<string>,seconds:number,path:MetroPath):MetroMotion {
  const dt=Number.isFinite(seconds)?Math.max(0,Math.min(.1,seconds)):0;
  if(!dt)return state;
  const next={...state};
  // Power cannot engage with open doors; braking always overrides auto.
  if(keys.has('s')||(keys.has('w')&&!next.doorsOpen)){next.automatic=false;next.dwellSeconds=0;}
  // Recover a target passed in manual mode or an older saved state without
  // snapping backwards to a platform that is now behind the vehicle.
  if(next.automatic)next.nextStop=pendingStopIndex(path,next);
  if(next.doorsOpen){
    if(next.automatic&&next.nextStop<path.stations.length){next.dwellSeconds=Math.max(0,next.dwellSeconds-dt);if(next.dwellSeconds<=0)next.doorsOpen=false;}
    return {...next,velocity:0};
  }
  let acceleration=keys.has('s')?-METRO_BRAKE:keys.has('w')?METRO_ACCELERATION:-.055;
  const target=next.automatic?path.stations[next.nextStop]:null;
  if(target){
    const metres=Math.max(0,(target.km-next.km)*1000);
    // A braking envelope makes each platform an actual stopping target. Reduce
    // speed continuously as the remaining braking distance decreases.
    const desired=Math.min(METRO_MAX_KMH/3.6,Math.sqrt(2*METRO_BRAKE*metres)*.96);
    acceleration=next.velocity>desired? -METRO_BRAKE : next.velocity<desired-.12 ? METRO_ACCELERATION : 0;
    if(metres<.8&&next.velocity<1){return {...next,km:target.km,velocity:0,doorsOpen:true,dwellSeconds:METRO_DWELL_SECONDS,nextStop:next.nextStop+1};}
  }
  const velocity=Math.max(0,Math.min(METRO_MAX_KMH/3.6,next.velocity+acceleration*dt));
  const km=Math.min(path.distanceKm,next.km+(next.velocity+velocity)*.5*dt/1000);
  if(target&&km>=target.km)return {...next,km:target.km,velocity:0,doorsOpen:true,dwellSeconds:METRO_DWELL_SECONDS,nextStop:next.nextStop+1};
  while(!next.automatic&&next.nextStop<path.stations.length&&path.stations[next.nextStop].km<km-.025)next.nextStop++;
  return {...next,km,velocity:km>=path.distanceKm?0:velocity};
}
