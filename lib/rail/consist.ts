import { indexTrack, sampleTrack } from './track';
export const TRAIN_COACH_COUNT = 10;
export const TRAIN_CAR_WIDTH = 32;
export const TRAIN_CAR_HEIGHT = 144;
export const COACH_SPACING_KM = .029;
/** Each coach samples its own distance on the rail, rather than using a straight
 * screen offset. Backing decreases head chainage without swapping the formation.
 * Clip at route ends: the imported corridor contains no track outside its bounds. */
export function sampleConsist(track: ReturnType<typeof indexTrack>, headKm: number, spacingKm = COACH_SPACING_KM) {
  const head = Math.max(0, Math.min(track.lengthKm, headKm));
  return Array.from({ length: TRAIN_COACH_COUNT + 1 }, (_, index) => {
    const km = head - index * spacingKm;
    return { index, visible: km >= 0, ...sampleTrack(track, Math.max(0, km)) };
  });
}
/** Map-aligned roof views, inspired by Pakistan Railways green/cream livery.
 * Distinct diesel and passenger silhouettes; illustrative, not a fleet model.
 * Shared proportions keep zoom-aware marker sizing and coupling consistent. */
export function trainCarSvg(locomotive: boolean) {
  const chassis = '<path d="M16 1v8m0 126v8" stroke="#1e293b" stroke-width="4"/>' +
    '<g fill="#111827"><rect x="0" y="23" width="32" height="19" rx="2"/><rect x="0" y="102" width="32" height="19" rx="2"/></g>';
  const diesel = '<path d="M7 8h18l4 12v110l-4 6H7l-4-6V20z" fill="#176347" stroke="#092e25" stroke-width="1.5"/>' +
    '<path d="M5 18l3-8h16l3 8v21H5z" fill="#efe4bf"/>' +
    '<path d="M7 20h8v9H6zm10 0h8l1 9h-9z" fill="#17394d" stroke="#8bb1ba" stroke-width=".7"/>' +
    '<path d="M7 32h18v6H7z" fill="#227956"/><path d="M8 43h16v82H8z" fill="#12543f" stroke="#43836b"/>' +
    '<path d="M10 46h12v17H10z" fill="#2d443e"/><path d="M11 49h10m-10 4h10m-10 4h10m-10 4h10" stroke="#0b221d" stroke-width="2"/>' +
    '<g fill="#0b2924" stroke="#659183" stroke-width=".8"><circle cx="16" cy="78" r="6.5"/><circle cx="16" cy="96" r="6.5"/><circle cx="16" cy="114" r="6.5"/></g>' +
    '<path d="M12 74l8 8m-8 0l8-8m-8 18l8 8m-8 0l8-8m-8 18l8 8m-8 0l8-8" stroke="#3c6155"/>' +
    '<path d="M5 45v79m22-79v79" stroke="#e3ce82" stroke-width="1.2"/>' +
    '<path d="M7 8h18M6 133h20" stroke="#d5483b" stroke-width="3"/><path d="M7 13h4m10 0h4" stroke="#fff3ae" stroke-width="3"/>';
  const windows = Array.from({ length: 8 }, (_, index) => {
    const y = 24 + index * 12;
    return `<path d="M4 ${y}h4v8H4zm20 0h4v8h-4z" fill="#143c50" stroke="#88a6aa" stroke-width=".5"/>`;
  }).join('');
  const passenger = '<rect x="3" y="7" width="26" height="130" rx="6" fill="#195e43" stroke="#0a3025" stroke-width="1.5"/>' +
    '<path d="M4 18h24v110H4z" fill="#e7dbb6"/>' + windows +
    '<rect x="9" y="12" width="14" height="120" rx="6" fill="#c2ccc6" stroke="#6c8177"/>' +
    '<path d="M12 18v108" stroke="#e7eee8" stroke-width="2"/><path d="M21 18v108" stroke="#94a69e"/>' +
    '<path d="M10 35h12m-12 25h12m-12 25h12m-12 25h12" stroke="#8faaa0" stroke-width=".7"/>' +
    '<g fill="#738e82"><rect x="14" y="24" width="5" height="5" rx="1"/><rect x="14" y="49" width="5" height="5" rx="1"/><rect x="14" y="74" width="5" height="5" rx="1"/><rect x="14" y="99" width="5" height="5" rx="1"/></g>' +
    '<path d="M4 17h4m16 0h4M4 128h4m16 0h4" stroke="#d0ad56" stroke-width="2"/>' +
    '<path d="M12 7h8v5h-8zm0 125h8v5h-8z" fill="#364a42"/>';
  return `<svg width="100%" height="100%" viewBox="0 0 ${TRAIN_CAR_WIDTH} ${TRAIN_CAR_HEIGHT}" style="filter:drop-shadow(0 1px 1px #020617)" xmlns="http://www.w3.org/2000/svg">${chassis}${locomotive ? diesel : passenger}</svg>`;
}
