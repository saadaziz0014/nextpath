# Pakistan Rail — extended route review

Rail mode is `/rail`; road mode is `/`. Five **separate** journeys are bundled:

| Key | Journey | Approximate geometry length |
| --- | --- | --- |
| 1 | Khanewal → Lodhran, chord via Jahanian | 91 km |
| 2 | Khanewal → Lodhran, via Multan | 136 km |
| 3 | Lodhran → Karachi Cantonment | 839 km |
| 4 | Khanewal → Peshawar Cantonment, via Lahore and Rawalpindi | 747 km |
| 5 | Lodhran → Mandi Burewala, partial Lodhran–Raiwind branch | 131 km |

Hold W for traction; S brakes manually. Release to coast. Space pauses.
Maximum speed is 90 km/h. Stations do not automatically brake the train.
A/D cannot leave the rails; route selection is committed until Change route. Reset unlocks departure settings.
Each journey stops at its geometry endpoint. Journeys are not yet stitched into
one continuous Karachi–Peshawar run with an approach-time Khanewal switch.

## Review findings and corrections

The incoming north path was 1,247.86 km and contained 384 repeated coordinate
vertices plus five turns over 100 degrees. It reached Raiwind, returned toward
Khanewal, and used other branch lines instead of passing through Lahore.
The previous interpolation tests checked whether the train followed that same
incorrect line, so they did not detect the detour.

- Added real OSM Lahore corridor geometry and Rawalpindi, Bahawalpur, Rohri,
  and Wazirabad station metadata. The dataset now includes 78 station objects
  on the south itinerary and 97 on the north itinerary.
- North now follows ordered main-line anchors through Lahore Junction and
  Rawalpindi. Its rebuilt length is about 747.40 km.
- Replaced independent extension-leg searches and the escape fallback with
  one ordered-itinerary graph search that retains incoming direction. It rejects
  near-180-degree switch movements and does not reverse at station anchors.
- Deduplicated overlapping OSM ways by type/ID, preferring newer source snapshots.
- Excluded yard/siding/spur tracks and explicitly disused tracks, plus subway and
  light-rail station objects. Station operating status is otherwise unverified.
- Added import-time checks for retracing, reversals, zero-length edges, station
  ordering, IDs, finite geometry and length consistency before writing output.
- Replaced the broken diagnostic with an offline verifier that checks every
  output segment against original OSM rail geometry, including station projections.
- Fixed the old `import-rail.ts` entry point so it rebuilds all five journeys.
- Corrected route-selection labels: south begins at Lodhran, and the branch
  ends at Mandi Burewala rather than extending all the way to Raiwind.

## Rebuild and verify

```powershell
npm run rail:import
npm run rail:verify
npm test
npm run lint
npm run typecheck
npm run build
```

`rail:import` uses checked-in source snapshots and needs no network access.
`rail:verify` rejects invented gap bridges, reversals and retraced vertices.
Source files are listed in `lib/rail/sourceFiles.ts`, plus the two regional
Khanewal snapshots. `public/data/rail/ml1.json` records the source-file manifest
and database timestamps. Snapshots have different dates; the root timestamp is
the oldest included source timestamp, not a claim of uniformly current data.

New missing-data queries are retained in `scripts/fetch-lahore.mjs` and
`scripts/fetch-rawalpindi.mjs`, plus `scripts/fetch-major-stations.mjs`. They are explicit maintenance tools; browsing the
app never calls Overpass. Public servers may time out, so rebuild from local
snapshots for routine development.

Data attribution: © OpenStreetMap contributors, ODbL 1.0.
https://www.openstreetmap.org/copyright
Public endpoint documentation: https://wiki.openstreetmap.org/wiki/Overpass_API

## Remaining limits

This is a geometry-based simulation, not an operational railway model. Station
lists are sourced OSM objects near the track, not an exhaustive timetable or
confirmation that every station is open. There are no signals, timetable-based
station stops or automatic journey transfers. Reverse travel along a selected itinerary is supported. The via-Multan
geometry length still differs from a previously consulted 121 km project
reference; distances should not be used as official railway chainages.

## Choose a starting station

After selecting a rail itinerary, choose **Starting station** and **Travel
 direction**. Any station on that itinerary can be used. At a terminal, the
available direction is selected automatically. The train is positioned at the
station's distance along the track, and progress starts at zero for the remaining
journey. When using the keyboard, Tab out of the selector before holding W/S.

Departure settings lock on the first movement. **Reset journey** stops and
returns the train to your selected station, keeping the station and direction
while unlocking both selectors. **Change route** clears the journey and opens
the route picker. Manual braking and the 90 km/h speed cap still apply.


## Named train journeys
The default rail picker now offers Allama Iqbal Express 9 Up / 10 Down. Previous itineraries remain under Explore tracks. See [Allama Iqbal research and maintenance](ALLAMA_IQBAL.md).
