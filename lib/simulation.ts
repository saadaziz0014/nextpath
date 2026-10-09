// Follow the shortest angular path: 359° → 1° should not spin backwards 358°.
// Accept unwrapped current headings so smoothing remains continuous across north.
export function smoothBearing(current: number, target: number, alpha: number) {
  const delta = (((target - current) % 360 + 540) % 360) - 180;
  return current + delta * Math.max(0, Math.min(1, alpha));
}
