import { sampleBusTrack, type indexBusTrack } from './track';
export const BUS_SECTION_WIDTH = 30;
export const BUS_SECTION_HEIGHT = 92;
export function articulatedBus(track:ReturnType<typeof indexBusTrack>,headKm:number,spacingKm=.009) {
 return [0,1].map(index=>({index,visible:headKm-index*spacingKm>=0,...sampleBusTrack(track,Math.max(0,headKm-index*spacingKm))}));
}
/** Illustrative roof/upper-body view of an articulated city bus, not an exact
 * manufacturer model. The two halves keep separate track samples on bends. */
export function busSectionSvg(index:number,colour='#e11d48',darkColour='#831843',livery:'metrobus'|'zu'='metrobus') {
 const front=index===0, zu=livery==='zu';
 const start=front?24:12,end=front?82:83;
 const tyres=(front?[29,72]:[61]).map(y=>`<g fill="#101923"><rect x=".5" y="${y}" width="4" height="10" rx="1.5"/><rect x="25.5" y="${y}" width="4" height="10" rx="1.5"/></g>`).join('');
 const glazing=Array.from({length:5},(_,i)=>{
  const y=start+i*(end-start)/5;
  return `<path d="M4 ${y}h3v8H4zm19 0h3v8h-3z" fill="#122e3e"/><path d="M4.5 ${y+1}h2m17 0h2" stroke="#82a7b5" stroke-width=".7"/>`;
 }).join('');
 const doors=(front?[35,65]:[28,73]).map(y=>`<path d="M25.5 ${y}v11m-2-11v11m0-5.5h2" stroke="#d4dde0" stroke-width=".65"/>`).join('');
 const joint=front
  ? '<path d="M5 84h20v8H5z" fill="#37424a"/><path d="M6 85h18M6 87h18M6 89h18M6 91h18" stroke="#9ba6a8" stroke-width=".8"/>'
  : '<path d="M5 0h20v8H5z" fill="#37424a"/><path d="M6 1h18M6 3h18M6 5h18M6 7h18" stroke="#9ba6a8" stroke-width=".8"/>';
 const shell=front
  ? 'M9 2h12q6 0 6 7v75H3V9q0-7 6-7z'
  : 'M3 8h24v75q0 7-6 7H9q-6 0-6-7z';
 const roof=front?27:12;
 const equipment=zu
  ? `<rect x="10" y="${roof+7}" width="10" height="29" rx="2" fill="#b6c6be" stroke="#718a7d" stroke-width=".6"/><path d="M11 ${roof+12}h8m-8 4h8m-8 4h8m-8 4h8" stroke="#789488"/><rect x="11" y="${roof+40}" width="8" height="10" rx="2" fill="#dce7df" stroke="#8aa396"/>`
  : `<rect x="10" y="${roof+6}" width="10" height="25" rx="2" fill="#e3e8e7" stroke="#8a9c9d" stroke-width=".6"/><g fill="#576e76"><circle cx="15" cy="${roof+13}" r="3"/><circle cx="15" cy="${roof+24}" r="3"/></g><path d="M13 ${roof+11}l4 4m-4 0l4-4m-4 11l4 4m-4 0l4-4" stroke="#91a7ad" stroke-width=".6"/>`;
 const cab=front
  ? '<path d="M5 9q10-5 20 0v10q-10 3-20 0z" fill="#102d3d" stroke="#80a1ae" stroke-width=".65"/><path d="M7 11l6-1m4 0l6 1" stroke="#a0c9d6" stroke-width="1.4"/><path d="M7 18l6-4m10 4l-6-4" stroke="#041621" stroke-width=".8"/><path d="M10 5h10" stroke="#fbbf24" stroke-width="1.2" stroke-dasharray="1 .5"/><path d="M4 20L1 17v6m25-3l3-3v6" stroke="#263b45" stroke-width="1.2"/><path d="M5 4h3m14 0h3" stroke="#fff7dc" stroke-width="1.7"/><path d="M4 8v3m22-3v3" stroke="#f9b34c" stroke-width="1.1"/>'
  : '<path d="M5 82h20v4H5z" fill="#1a3540"/><path d="M5 86h3m14 0h3" stroke="#fb5258" stroke-width="2"/><path d="M10 88h10" stroke="#263b45" stroke-width="1.5"/>';
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${BUS_SECTION_WIDTH} ${BUS_SECTION_HEIGHT}" width="100%" height="100%">${tyres}<path d="${shell}" fill="${colour}" stroke="${darkColour}" stroke-width="1.2"/><path d="M4 ${start}h22v${end-start}H4z" fill="${zu?'#c9d5ce':'#e9eded'}"/>${glazing}${doors}<rect x="8" y="${start-1}" width="14" height="${end-start+1}" rx="3" fill="${zu?'#dbe5df':'#f1f3f0'}" stroke="#a6b6b5" stroke-width=".65"/><path d="M9 ${start+2}v${end-start-5}" stroke="#fff" stroke-width="1"/>${equipment}<path d="M4 ${start+1}v${end-start-3}m22-${end-start-3}v${end-start-3}" stroke="${colour}" stroke-width=".7"/>${cab}${joint}</svg>`;
}
