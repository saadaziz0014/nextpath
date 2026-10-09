import { METRO_CAR_COUNT } from './types';
import { sampleMetroTrack, type indexMetroTrack } from './track';
export function metroConsist(track:ReturnType<typeof indexMetroTrack>,headKm:number,spacingKm=.0205) {
  return Array.from({length:METRO_CAR_COUNT},(_,index)=>{const km=headKm-index*spacingKm;return {index,visible:km>=0,...sampleMetroTrack(track,Math.max(0,km))};});
}
/** Electric multiple-unit: cab cars at both ends, flush orange side bands,
 * wide windows and roof equipment, with no separate locomotive. */
export function metroCarSvg(index:number) {
  const cab=index===0||index===METRO_CAR_COUNT-1;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 76" width="100%" height="100%"><rect x="2" y="1" width="24" height="74" rx="${cab?10:4}" fill="#f8fafc" stroke="#38414a" stroke-width="1.2"/><path d="M4 14v48M24 14v48" stroke="#f97316" stroke-width="4"/><rect x="7" y="18" width="14" height="43" rx="3" fill="#cbd5e1"/><path d="M8 24h12M8 33h12M8 42h12M8 51h12" stroke="#64748b" stroke-width="4"/>${cab?'<path d="M5 8q9-7 18 0v7H5z" fill="#17242c"/><path d="M7 5h3m8 0h3" stroke="#fff7ed" stroke-width="2"/>':'<rect x="7" y="5" width="14" height="9" rx="2" fill="#94a3b8"/>'}<rect x="9" y="64" width="10" height="6" rx="2" fill="#475569"/></svg>`;
}
