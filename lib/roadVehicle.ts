/** An unbranded blue sedan seen from above/rear, with its nose toward north.
 * Viewport-aligned map markers rotate this artwork using the camera bearing. */
export function roadCarSvg() {
  return `<svg viewBox="0 0 56 112" xmlns="http://www.w3.org/2000/svg" width="100%" height="100%">
    <defs>
      <linearGradient id="nextpath-car-paint" x1="0" x2="1">
        <stop stop-color="#103e66"/><stop offset=".18" stop-color="#2684b7"/>
        <stop offset=".48" stop-color="#69bce0"/><stop offset=".76" stop-color="#267ca9"/><stop offset="1" stop-color="#123e60"/>
      </linearGradient>
      <linearGradient id="nextpath-car-glass" x1="0" y1="0" x2=".7" y2="1">
        <stop stop-color="#9bc6d3"/><stop offset=".38" stop-color="#274e65"/><stop offset="1" stop-color="#102c42"/>
      </linearGradient>
    </defs>
    <ellipse cx="28" cy="59" rx="23" ry="49" fill="#020617" opacity=".35"/>
    <g fill="#101820" stroke="#475569" stroke-width=".6">
      <rect x="5" y="24" width="6" height="16" rx="2"/><rect x="45" y="24" width="6" height="16" rx="2"/>
      <rect x="5" y="78" width="6" height="16" rx="2"/><rect x="45" y="78" width="6" height="16" rx="2"/>
    </g>
    <path d="M18 5q10-3 20 0l7 8q3 8 3 23v48q0 15-6 20-14 5-28 0-6-5-6-20V36q0-15 3-23z" fill="url(#nextpath-car-paint)" stroke="#082a42" stroke-width="1.3"/>
    <path d="M13 15q15-5 30 0M13 19l3 8m27-8-3 8" fill="none" stroke="#9bd6e9" stroke-width=".9"/>
    <path d="M12 29q16-5 32 0l-6 14H18z" fill="url(#nextpath-car-glass)" stroke="#bee3e9" stroke-width=".8"/>
    <path d="M15 31l12-2m4 0 8 2" stroke="#d7edf3" stroke-width="1.3" opacity=".75"/>
    <path d="M15 40l7-7m19 7-7-7" stroke="#122b3c" stroke-width=".8"/>
    <path d="M11 42l-7 1-2 5 10-1m33-5 7 1 2 5-10-1" fill="#247ca8" stroke="#0c334f" stroke-width=".8"/>
    <path d="M11 45l5 1v21l-5 9zm29 1 5-1v31l-5-9z" fill="#15374e" stroke="#73afc6" stroke-width=".6"/>
    <path d="M11 59h5m24 0h5" stroke="#9ebdce" stroke-width="1"/>
    <path d="M18 45h20l2 22H16z" fill="url(#nextpath-car-paint)" stroke="#8ccbe0" stroke-width=".8"/>
    <path d="M21 48h14" stroke="#c2eaf4" stroke-width=".8" opacity=".7"/>
    <path d="M17 70h22l5 13q-16 5-32 0z" fill="url(#nextpath-car-glass)" stroke="#a3c5d3" stroke-width=".8"/>
    <path d="M16 75h24m-23 3h22m-21 3h20" stroke="#7394a5" stroke-width=".5"/>
    <path d="M11 87q17 5 34 0m-31 4q14 4 28 0" fill="none" stroke="#8dccdf" stroke-width=".8"/>
    <path d="M10 51v31m36-31v31" stroke="#0e466a" stroke-width="1.3"/>
    <path d="M12 54h2m28 0h2M12 74h2m28 0h2" stroke="#d9e8ea" stroke-width="1.2"/>
    <path d="M12 10l7-3m18 0 7 3" stroke="#fff4d4" stroke-width="2.8" stroke-linecap="round"/>
    <path d="M20 5h16" stroke="#172d3e" stroke-width="1.5"/>
    <path d="M12 98l9 2m14 0 9-2" stroke="#f43f5e" stroke-width="3" stroke-linecap="round"/>
    <path d="M13 97l7 2m16 0 7-2" stroke="#ffafab" stroke-width=".8"/>
    <rect x="23" y="99" width="10" height="4" rx="1" fill="#e3e9e7"/>
    <path d="M16 105q12 3 24 0" fill="none" stroke="#102e42" stroke-width="2.3"/>
    <path d="M18 107h3m14 0h3" stroke="#a3b6bc" stroke-width="1.4"/>
  </svg>`;
}
