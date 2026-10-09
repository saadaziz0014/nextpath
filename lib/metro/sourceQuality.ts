import { bearing } from '@turf/turf';
import type { Coordinate } from '../routeData';
import { validateMetroDataset } from './track';
import type { MetroDataset } from './types';
/** Exact source-edge membership guarantees the metro never bridges unmapped
 * gaps, switches onto mainline rails or travels between the two running tracks. */
export function verifyMetroSource(dataset:MetroDataset,ways:Coordinate[][]) {
  validateMetroDataset(dataset);
  const edges=new Set<string>();for(const way of ways)for(let i=1;i<way.length;i++){edges.add(`${way[i-1]}|${way[i]}`);edges.add(`${way[i]}|${way[i-1]}`);}
  for(const path of dataset.paths){const seen=new Set<string>();for(let i=0;i<path.coordinates.length;i++){const point=path.coordinates[i];if(seen.has(String(point)))throw Error('Metro track retraces itself');seen.add(String(point));if(i&&!edges.has(`${path.coordinates[i-1]}|${point}`))throw Error('Metro edge missing from original source');if(i&&i<path.coordinates.length-1){const a=bearing(path.coordinates[i-1],point),b=bearing(point,path.coordinates[i+1]);if(Math.abs(((b-a+540)%360)-180)>100)throw Error('Impossible metro track reversal');}}}
}
