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
    return { index, km, visible: km >= 0, ...sampleTrack(track, Math.max(0, km)) };
  });
}
/** Map-aligned roof views, inspired by Pakistan Railways green/cream livery.
 * The locomotive keeps a bright yellow nose and dark long hood; coaches keep a
 * cream body, twin window rows and a green roof so the formation reads clearly
 * at driving zoom. Illustrative, not a specific fleet drawing. Shared
 * proportions keep zoom-aware marker sizing and coupling consistent. */
export function trainCarSvg(locomotive: boolean) {
  const chassis = '<path d="M16 -1v7m0 132v7" stroke="#0f172a" stroke-width="4" stroke-linecap="round"/>' +
    '<g fill="#111827" stroke="#475569" stroke-width=".6"><rect x="1" y="22" width="30" height="20" rx="3"/><rect x="1" y="102" width="30" height="20" rx="3"/></g>' +
    '<g fill="#cbd5e1"><circle cx="7" cy="27" r="2"/><circle cx="7" cy="37" r="2"/><circle cx="25" cy="27" r="2"/><circle cx="25" cy="37" r="2"/><circle cx="7" cy="107" r="2"/><circle cx="7" cy="117" r="2"/><circle cx="25" cy="107" r="2"/><circle cx="25" cy="117" r="2"/></g>';

  const louvres = Array.from({ length: 10 }, (_, index) => {
    const y = 38 + index * 6;
    return `<path d="M9 ${y}h14" stroke="#0b3a2b" stroke-width="2"/>`;
  }).join('');
  const locomotiveBody =
    '<path d="M5 4h22l3 12v118l-3 6H5l-3-6V16z" fill="#176b4a" stroke="#04291f" stroke-width="2"/>' +
    // Yellow warning nose, twin headlights and cab glass.
    '<path d="M5 4h22l3 12v12H2V16z" fill="#f0d264" stroke="#806416" stroke-width="1.4"/>' +
    '<rect x="5.5" y="8" width="6" height="4.5" rx="1.4" fill="#fff8d8" stroke="#b8942c" stroke-width=".7"/>' +
    '<rect x="20.5" y="8" width="6" height="4.5" rx="1.4" fill="#fff8d8" stroke="#b8942c" stroke-width=".7"/>' +
    '<path d="M6 15h8l1.5 8H4.5zm20 0h-8l-1.5 8h11z" fill="#12344a" stroke="#8ab7c7" stroke-width=".8"/>' +
    '<path d="M2 28h28v7H2z" fill="#ece0b9"/>' +
    // Long hood with roof panels, radiator fans and walkway edge.
    '<rect x="7" y="35" width="18" height="85" rx="2" fill="#115a3f" stroke="#4b9577" stroke-width="1"/>' +
    '<path d="M9 35h14v18H9z" fill="#1d4b3d" stroke="#3f7e66"/>' + louvres +
    '<g fill="#0b3328" stroke="#659b86" stroke-width=".8"><circle cx="16" cy="64" r="6"/><circle cx="16" cy="82" r="6"/></g>' +
    '<path d="M13 61l6 6m-6 0l6-6m-6 12l6 6m-6 0l6-6" stroke="#4f846f"/>' +
    '<path d="M4.5 35v86m23-86v86" stroke="#f1e4b8" stroke-width="1.7"/>' +
    // Fuel tank, rear buffer beam and couplers.
    '<rect x="8" y="108" width="16" height="22" rx="2" fill="#1f2937" stroke="#64748b" stroke-width="1"/>' +
    '<path d="M8 113h16m-16 5h16" stroke="#475569" stroke-width="1.5"/>' +
    '<path d="M4 132h24" stroke="#b33a2b" stroke-width="5"/>' +
    '<path d="M9 137h14" stroke="#f0d264" stroke-width="2.5"/>';

  const windows = Array.from({ length: 9 }, (_, index) => {
    const y = 18 + index * 12.4;
    return `<g><rect x="2.4" y="${y}" width="5" height="8" rx="1" fill="#143c50" stroke="#c9b98a" stroke-width=".6"/><rect x="24.6" y="${y}" width="5" height="8" rx="1" fill="#143c50" stroke="#c9b98a" stroke-width=".6"/><path d="M4 ${y + 2}h1.5m-1.5 2h1.5m17.5-2H25m-1.9 2H25" stroke="#79a4b3" stroke-width=".7"/></g>`;
  }).join('');
  const roofVents = Array.from({ length: 5 }, (_, index) => {
    const y = 24 + index * 22;
    return `<rect x="11" y="${y}" width="10" height="8" rx="2" fill="#d7cfb4" stroke="#7b735d" stroke-width=".7"/><path d="M13 ${y + 2.5}h6m-6 3h6" stroke="#8b8268" stroke-width=".8"/>`;
  }).join('');
  const passengerBody =
    '<rect x="3" y="4" width="26" height="136" rx="6" fill="#efe4c0" stroke="#6b5d3c" stroke-width="2"/>' +
    // Green waist band, doors and roof spine.
    '<path d="M3 10h26M3 128h26" stroke="#1b6b4b" stroke-width="3"/>' +
    '<rect x="9" y="4" width="14" height="136" fill="#1c6a4b" stroke="#0b3d2b" stroke-width="1"/>' +
    '<path d="M12 8v128m8-128v128" stroke="#3d8a68" stroke-width="1"/>' + roofVents +
    // Twin rows of windows and vestibule doors.
    windows +
    '<g fill="#1b6b4b" stroke="#0b3d2b" stroke-width=".8"><rect x="2.5" y="7" width="7" height="10" rx="1"/><rect x="22.5" y="7" width="7" height="10" rx="1"/><rect x="2.5" y="127" width="7" height="10" rx="1"/><rect x="22.5" y="127" width="7" height="10" rx="1"/></g>' +
    '<g fill="#bfe3d3"><rect x="4" y="10" width="4" height="4" rx=".6"/><rect x="24" y="10" width="4" height="4" rx=".6"/><rect x="4" y="130" width="4" height="4" rx=".6"/><rect x="24" y="130" width="4" height="4" rx=".6"/></g>' +
    '<path d="M3 16h26M3 122h26" stroke="#c8a750" stroke-width="1.5"/>' +
    '<path d="M16 0v4m0 136v4" stroke="#1e293b" stroke-width="4"/>';

  return `<svg width="100%" height="100%" viewBox="0 0 ${TRAIN_CAR_WIDTH} ${TRAIN_CAR_HEIGHT}" style="filter:drop-shadow(0 1px 2px #020617)" xmlns="http://www.w3.org/2000/svg">${chassis}${locomotive ? locomotiveBody : passengerBody}</svg>`;
}
