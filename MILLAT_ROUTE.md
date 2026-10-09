# Millat Express — route research and maintenance

Researched 9 October 2026. The simulation implements the published full Karachi Cantonment–Lala Musa route:

- **17 Up:** Karachi Cantonment → Lala Musa, 35 scheduled stations including both termini.
- **18 Down:** Lala Musa → Karachi Cantonment, 36 scheduled stations. Down additionally calls at Landhi, between Hyderabad and Drigh Road.

## Sources and scope

The [17 Up profile](https://traintracking.pk/trains/millat-express-17up) and [18 Down profile](https://traintracking.pk/trains/millat-express-18dn) supply the stopping patterns. The [MetroStatus Up timetable](https://trains.metro-status.com/timetable/millat-express/) corroborates Up. These are published third-party profiles, not a verified current Pakistan Railways operational timetable. Historical descriptions ending at Faisalabad or Malakwal are not the selected simulation. Older general descriptions mention Multan; the detailed profiles explicitly list Lodhran, Dunyapur and Jahanian, so this implementation uses the Jahanian chord.

## Corridor

Karachi → Rohri → Bahawalpur → Lodhran → Jahanian → Khanewal → Abdul Hakim → Shorkot Cantt → Toba Tek Singh → Gojra → Faisalabad → Chak Jhumra → Chiniot → Chenab Nagar → Shaheenabad → Sargodha → Bhalwal → Phularwan → Malakwal → Mandi Bahauddin → Chilian Wala → Dinga → Lala Musa.

Geometry comes from bundled OpenStreetMap / Overpass snapshots, principally `data/rail/millat-faisalabad-lalamusa.osm.json`, with the Faisalabad station footprint in `data/rail/millat-faisalabad-station.osm.json`. Existing ML-1 and chord snapshots supply the southern section. OSM attribution and source timestamps are included in the browser dataset. Station operating status is not independently verified.

Faisalabad's station footprint (OSM way 1370365121) is tagged `railway=stop`, `public_transport=station`, `train=yes`; the importer accepts that combination without treating ordinary stop positions as stations. It is separate from Faisalabad Dry Port. Dinga's sourced station node 2445623565 has an Urdu name; its English display name is explicitly mapped. Chailianwala maps to the published spelling Chilian Wala.

## Implementation and checks

Train definitions separate each direction's scheduled calls from the canonical `millat` track. Continuous graph routing through ordered anchors excludes alternate corridors through Jhang or Hafizabad. Source verification checks every resulting edge; no straight-line gap bridges or hidden switch U-turns are allowed. Both directions support intermediate station starts, localStorage restore, seven coaches, diesel audio, reverse, cruise and the shared 90 km/h cap with manual station braking. **L** selects Millat in Explore tracks.

Run `npm run rail:import`, `npm run rail:verify` and `npm test` after changing sources or profiles. Millat regression tests check service numbers, termini, direction-specific stops, corridor selection, intermediate departures and saved-state restoration.
