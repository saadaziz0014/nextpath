import { indexTrack, sampleTrack } from './track';
export const TRAIN_COACH_COUNT = 7;
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
/** Share the locomotive silhouette and detailing; only the coach palette differs.
 * Fixed viewBox proportions prevent stretched or flattened car shapes. */
export function trainCarSvg(locomotive: boolean) {
  const body = locomotive ? '#f8fafc' : '#f59e0b';
  const window = locomotive ? '#0284c7' : '#0c4a6e';
  const roof = locomotive ? '#334155' : '#78350f';
  const lights = locomotive ? '#fbbf24' : '#fef3c7';
  return '<svg width="100%" height="100%" viewBox="0 0 26 58" style="filter:drop-shadow(0 1px 1px #020617)" xmlns="http://www.w3.org/2000/svg"><rect x="2" y="2" width="22" height="54" rx="5" fill="' + body + '" stroke="#0f172a" stroke-width="2"/><path d="M5 9h16v9H5z" fill="' + window + '"/><path d="M5 25h16v25H5z" fill="' + roof + '"/><circle cx="7" cy="5" r="2" fill="' + lights + '"/><circle cx="19" cy="5" r="2" fill="' + lights + '"/></svg>';
}
