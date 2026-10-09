# Musa Pak Express — route research

Researched 2026-10-08. Simulation profile, not a certified current timetable.

- **115 Up:** Multan Cantt → Khanewal → Mian Channu → Chichawatni → Sahiwal → Okara → Pattoki → Raiwind → Kot Lakhpat → Lahore Junction (10 stations including termini).
- **116 Down:** Lahore Junction → Raiwind → Okara → Sahiwal → Khanewal → Multan Cantt (6 stations including termini).

Sources: [Bookme](https://bookme.pk/musa-pak-express), [115 Up published profile](https://traintracking.pk/trains/musa-pak-express-115up), [116 Down published profile](https://tracktrain.pk/trains/musa-pak-express-116dn), [alternate Down directory](https://railwaystations.pk/search-by-train/116dn-musa-pak-express/).

Bookme and TrackTrain agree on six Down stations; the alternate directory includes Chichawatni as a seventh. The simulation uses the matching six-stop profile and records this disagreement rather than treating either as an official live schedule. Times are omitted. The Down service passes the other stations without listing them as stops; manual braking remains the user's responsibility.

The canonical Multan–Lahore route is solved on the existing sourced OSM graph through Khanewal, Chichawatni, Sahiwal, Okara and Raiwind. It does not use the Jahanian chord. No straight-line joins or invented tracks are added. Both service stop profiles are validated independently against sourced stations in travel order before data is written or loaded.

In Rail mode, select **Musa Pak Express**, then **1 / 115 Up** or **2 / 116 Down**. Choose an intermediate starting stop if desired. W accelerates, S brakes, Space pauses; max speed 90 km/h. Reset preserves the selected departure and unlocks edits. Explore tracks also exposes the canonical corridor as track 7.

Maintenance: `npm run rail:import`, `npm run rail:verify`, `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`.
