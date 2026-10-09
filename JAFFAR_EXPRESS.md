# Jaffar Express route research

Researched 8 October 2026. This is a manually driven simulation of the traditional full Quetta–Peshawar route, not a live timetable or confirmation of today's service. Some recent third-party listings start at Jacobabad; select Jacobabad as a starting station to simulate that shorter journey.

## Service definitions

- 39 Up: Quetta to Peshawar Cantonment, 42 stops in the Bookme profile.
- 40 Down: Peshawar Cantonment to Quetta, 40 stops in that same profile. Down omits Kot Lakhpat and Khanpur; it is deliberately not an identical reversal of the Up stop list.
- Via Kolpur, Mach, Ab-i-gum and Sibi through Bolan Pass; Jacobabad, Shikarpur, Sukkur and Rohri; Bahawalpur, Lodhran and Multan; Khanewal, Sahiwal, Lahore, Rawalpindi, Attock and Nowshera.

The Senate's August 2025 answer identifies 39 Up/40 Down as Quetta–Peshawar. Bookme supplies the historical full stopping patterns. Other directories disagree about several intermediate stops. No departure times, fares, temporary-stop extensions or current operating guarantees are imported.

## Sources

- Pakistan Senate, 18 August 2025, question 45: https://www.senate.gov.pk/uploads/documents/questions/1755574483_850.pdf
- Full Up/Down profiles: https://bookme.pk/jaffar-express
- Conflicting shorter profile: https://trains.metro-status.com/timetable/jaffar-express/
- Track geometry: OpenStreetMap contributors, downloaded through Overpass; ODbL attribution remains visible on the map.

## Implementation and validation

`node scripts/fetch-jaffar.mjs` refreshes the two bounded source extracts. `npm run rail:import` rebuilds the route from connected OSM node IDs, through ordered corridor anchors. No straight-line gap repairs are permitted. The existing source-edge verifier checks every generated segment against source rail geometry. Gujranwala's traditional city station uses explicit OSM feature 2433331678 to disambiguate two named features.

Use the train picker on `/rail`, choose 39 Up or 40 Down, then optionally choose an intermediate starting station. W accelerates, S brakes, Space pauses; the 90 km/h limit and manual braking remain in force. Starting stations lock after movement until Reset. Existing trains retain their independent service definitions.

## Sibi movement
Both approach tracks in the source graph join south of Sibi's platforms. The simulation therefore requires a stationary R confirmation at Sibi before departing on the other leg, in both directions. This maneuver is inferred from the sourced topology; current railway shunting procedures have not been independently confirmed. The boundary is joined at one exact sourced track node and validated like Fareed's Kasur reversal.
