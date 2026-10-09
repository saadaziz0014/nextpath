import { sampleBusTrack, type indexBusTrack } from './track';
export function articulatedBus(track:ReturnType<typeof indexBusTrack>,headKm:number,spacingKm=.009) {
 return [0,1].map(index=>({index,visible:headKm-index*spacingKm>=0,...sampleBusTrack(track,Math.max(0,headKm-index*spacingKm))}));
}
export function busSectionSvg(index:number,colour='#e11d48',darkColour='#831843') {
 const front=index===0;
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 30 92" width="100%" height="100%"><rect x="3" y="2" width="24" height="88" rx="${front?7:3}" fill="${colour}" stroke="${darkColour}" stroke-width="1.3"/><path d="M5 18v60M25 18v60" stroke="#f8fafc" stroke-width="2"/><rect x="9" y="23" width="12" height="48" rx="2" fill="#e2e8f0"/><path d="M10 30h10M10 40h10M10 50h10M10 60h10" stroke="#64748b" stroke-width="4"/><path d="M1 21v10M29 21v10M1 71v10M29 71v10" stroke="#17212b" stroke-width="2"/>${front?'<path d="M5 9q10-7 20 0v10H5z" fill="#112533"/><path d="M6 4h4m10 0h4" stroke="#fff7ed" stroke-width="2"/><rect x="8" y="82" width="14" height="8" fill="#334155"/><path d="M8 84h14M8 87h14" stroke="#94a3b8"/>':'<rect x="7" y="2" width="16" height="8" fill="#334155"/><path d="M7 4h16M7 7h16" stroke="#94a3b8"/><path d="M5 86h4m12 0h4" stroke="#fde68a" stroke-width="2"/>'}</svg>`;
}
