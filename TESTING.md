# Driving validation

Automated checks: `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`.

The junction decision regressions cover selecting an exact straight road before
new tile geometry subdivides it, retaining a committed right exit against a
competing direction, 50-metre prompt timing, and preserving genuine T-junction
stops. Existing tests cover road seams, grade separation, reverse history,
one-way edges, route sampling and API failures.

Browser checks on the Lahore example streets:

- Start free drive without a destination.
- Press Enter at the first junction prompt: straight is committed, the prompt
  closes, A/D buttons disable, and pressing D does not replace the choice.
- Drive through the straight exit: the vehicle crosses without stopping and
  A/D unlock for the next junction.
- Press A at the next prompt, then D: left remains selected; driving crosses
  onto the selected left road and releases the lock.
- Focus Pause and press Enter: playback input does not steal the button action.
- Reset while a direction is committed: the vehicle returns to its start,
  the lock clears, and the junction prompt becomes available again.

Mapbox road coverage and tile topology vary by location. For a new reported
stop, record the displayed coordinates, status message, selected direction,
and whether W remains held; those distinguish missing road data from decision
or input failures.

Route-mode checks: build the nearby Lahore route after free driving, switch to Route playback (manual prompts disappear), and start playback at 60 km/h.

## Rail pilot browser verification

Verified `/rail` in the in-app browser with real Mapbox tiles and bundled OSM data:

- Loading overlay clears; train marker and station labels appear on track.
- `1` commits chord; `2` commits via Multan after reset/reload.
- Pressing another branch key or A/D after commitment does not change the route.
- Holding the pointer traction control increases speed and journey distance.
- Holding the brake control returns the train to zero speed.
- Space changes Pause to Resume; train marker remains centered with follow on.

Automated rail checks cover the 90 km/h cap, full-speed stopping distance,
brake priority, coasting, endpoint stopping, frame-time clamp, both track paths,
station snapping and station ordering. A complete real-time traversal of both
90+ km paths was not performed in the browser. Full ML-1 is outside this pilot.
- Reset restores zero speed and reopens branch selection; Road mode navigation
  returns to the existing road simulator with its controls intact.

## Extended railroad review regression checks

- Corrected north itinerary passes Raiwind → Lahore Junction → Gujranwala →
  Wazirabad → Jhelum → Rawalpindi → Taxila → Peshawar in order.
- Rejected the old 1,247.86 km north detour; rebuilt north route is 747.40 km.
- All five route paths pass reversal/retracing, station chainage and length checks.
- `npm run rail:verify` checks every generated segment against original OSM rail
  geometry and passes all five routes, including projected station vertices.
- Added regression cases for ordered-anchor routing without reversing and for
  malformed route IDs, coordinates and station data.
- Production build browser checks: keyboard 4 selects north; traction moves the
  train; 3/A/D cannot override its commitment. Reset then 3 begins at Lodhran;
  Reset then 5 selects the partial Mandi Burewala branch. Map tiles and train
  marker render with the expected street-level follow camera.
- No complete real-time 747/839 km end-to-end browser traversal was performed.

## Rail starting-station selection

- Automated test checks departure placement on the real track in both directions,
  remaining chainages, terminal direction restrictions and invalid station IDs.
- Browser verified Hyderabad departure with zero progress, Karachi terminal
  departure toward Lodhran, movement locking both selectors, and Reset returning
  to Karachi at zero speed with selectors unlocked.
- Existing physics and route quality tests still pass; 30 tests total.

## Allama Iqbal Express — 2026-10-08

- 31 tests pass, including 37-stop Up / 36-stop Down profiles, Gambat asymmetry, chord and Narowal corridor order, reversed geometry, intermediate departures and missing-stop rejection.
- Rail source verification passes all six canonical paths; every segment is backed by an original OSM rail segment. Allama Iqbal measures 1,362.73 km with 127 sourced stations before applying the service stop profiles.
- ESLint, TypeScript and Next.js production build pass.
- Production browser checks: train picker loads Mapbox; keyboard 1 selects 9 Up from Karachi; Narowal can be selected as departure; pointer acceleration locks starting-station edits; reset restores Narowal at zero speed and unlocks. Keyboard 2 selects 10 Down from Sialkot with 36 stops, excludes Gambat and disables Karachi as an outbound start. Lahore can be selected for the Down journey. Speed cap and manual braking verified in physics tests; a complete real-time journey was not driven in the browser.
- Timetable certainty and sources documented in ALLAMA_IQBAL.md. Profiles are not certified current official schedules.

## Musa Pak Express — 2026-10-08

- All 32 tests pass, including independent 115 Up / 116 Down stop lists, terminal direction, intermediate departures, main-line corridor and unchanged Allama Iqbal profiles.
- All seven canonical rail paths pass original-source segment verification. Musa Pak: 333.94 km, 31 sourced stations, 10 Up / 6 Down service stops.
- ESLint and the final production build (including TypeScript) pass.
- Production browser: Musa Pak selection shows the correct route labels and Multan preview; keyboard 1 starts 115 Up at Multan, keyboard 2 starts 116 Down at Lahore. Khanewal can be chosen in both directions; the final destination is disabled as an outbound start. Switching trains updates preview station text and camera together.
- Down stop-list disagreement and research sources are documented in MUSA_PAK.md. No live timetable or full real-time journey verification is claimed.

## Baba Farid (Fareed) Express — 2026-10-08

- 34 tests pass: existing road and rail regressions, 45-stop 37 Up / 46-stop 38 Down profiles, Walton asymmetry, the Pakpattan branch, Karachi City endpoints, Kasur reversal chainage in both directions and stationary-only confirmation.
- All eight canonical paths pass source verification. Fareed measures 1,253.25 km with 126 sourced stations and one declared Kasur reversal. Every edge is backed by an original OSM rail segment; each leg rejects unintended retracing/reversals.
- Final production build (including TypeScript) and ESLint pass.
- Production browser: Baba Farid appears alongside both existing trains; keyboard 1 starts 37 Up at Karachi City and lists 45 stops. Kasur can be selected as a departure, facing toward Raiwind without an arrival reversal. Keyboard 2 starts 38 Down at Lahore, lists Walton second and 46 stops, disables Karachi City as an outbound start, and shows the pending Kasur reversal with R disabled before arrival.
- Kasur boundary and confirmation behavior are exercised by automated physics tests in both directions. The complete real-time journey and an arrival reversal were not driven in the browser.
- Route references, historical evidence for Kasur and timetable limits are recorded in FAREED_EXPRESS.md. Port 5555 and app/icon.svg remain unchanged.

Jaffar: verify 39 Up / 40 Down endpoints, 42 / 40 scheduled stops, Jacobabad departure selection, Bolan–Sukkur–Multan corridor connectivity, and existing train regressions.

Jaffar validation completed: all 36 automated tests, all nine source-track connectivity checks, ESLint and Next.js production build passed. Production browser smoke check verified 39 Up selection, Jacobabad intermediate departure and keyboard selection of 40 Down at Peshawar. Sibi boundary behavior was tested in both directions in automated physics tests; the complete multi-hour journey was not driven in the browser.

Green Line: all 37 automated tests, ten source-track connectivity checks, ESLint and production build passed. Production HTTP smoke checks returned 200 for /rail and /data/rail/ml1.json, including the 1514.83 km Green Line corridor terminating at Margalla. Browser interaction testing was unavailable because the browser runtime sandbox failed to initialize. Direction-specific stops, chord routing and Rawalpindi intermediate starts in both directions were covered by automated tests.

Awam Express validation: all 38 automated tests, all eleven source-track connectivity checks, ESLint and production build passed. Production HTTP checks returned 200 for /rail and /data/rail/ml1.json, including the 1722.70 km Awam corridor. Tests cover all 62 stops in both directions, Multan routing, intermediate departures and invalid destination starts. Browser interaction testing was blocked by a runtime sandbox initialization failure.

Pak Business validation: 39 automated tests passed, along with all twelve source-track connectivity checks, ESLint and production build. HTTP smoke checks returned 200 for /rail and its dataset, containing the 1215.70 km Karachi–Lahore corridor. Automated coverage verifies 11 Up / 13 Down stops, Landhi and Drigh Road on Down only, chord routing and intermediate starts in both directions. Browser interaction testing was not completed; the browser runtime's sandbox startup failure from prior checks remains unresolved.

Subak Kharam validation: all 40 automated tests, all thirteen source-track connectivity checks, ESLint and production build passed. Production HTTP checks returned 200 for /rail and its dataset, including the 288.74 km Lahore–Rawalpindi corridor. Tests verify 8 Up / 9 Down scheduled stations, Gujar Khan on Down only and intermediate departures in both directions. Browser interaction testing was not completed; the browser runtime sandbox startup problem from prior checks remains unresolved.
