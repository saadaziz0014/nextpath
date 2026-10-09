# Awam Express

Researched 8 October 2026. This is a manually driven simulation using published stopping profiles, not a live timetable or confirmation of current operations.

13 Up runs Karachi Cantonment to Peshawar Cantonment; 14 Down runs the reverse direction. The selected published profiles list the same 62 scheduled stations in reverse order. Both directions use the main line through Shujabad, Multan Cantonment, Khanewal, Sahiwal, Lahore, Rawalpindi, Taxila and Nowshera. They do not use the Jahanian chord or the Margalla branch.

## Sources and uncertainty

- Up profile: https://trains.metro-status.com/timetable/awam-express/
- Down profile: https://trains.metro-status.com/timetable/awam-express-14dn/
- Cross-check: https://traintracking.pk/trains/awam-express-13up

Older directories list a different stopping pattern, including Jungshahi, Jhimpir and Kharian Cantt. The simulation uses the selected 62-stop profiles consistently, including Bin Qasim, Sarhari, Daur, Bandhi, Lodhran and Golra Sharif. No departure times, fares or automatic station stops are imported. The app's existing timetable-verification notice remains applicable.

## Geometry and controls

The importer solves one connected itinerary in the existing OpenStreetMap graph. Shujabad and Multan anchors enforce the correct corridor without artificial line joins. Source files and provenance are retained; every generated segment is checked against sourced railway geometry. No station reversals are declared for this route.

Select Awam Express on `/rail`, then 13 Up or 14 Down. Scheduled intermediate stops can be selected before movement; Reset unlocks the starting-station selector. W accelerates, S brakes and Space pauses. Manual braking and the existing 90 km/h maximum remain. Explore tracks provides the same corridor with key E.

Run `npm run rail:import`, `npm run rail:verify`, `npm test`, `npm run lint` and `npm run build` to reproduce validation.

Validation completed: 38 tests passed; all route segments are source-backed; lint and production build passed. Production HTTP smoke checks passed. Browser interaction verification was unavailable because its sandbox could not initialize.
