# Green Line Express

Researched 8 October 2026. These are published stopping profiles for a manually driven simulation, not an official live timetable.

- 5 Up: Karachi Cantonment, Hyderabad, Rohri, Bahawalpur, Khanewal, Lahore Junction, Chaklala, Rawalpindi, Margalla (Islamabad).
- 6 Down: Margalla, Rawalpindi, Chaklala, Lahore Junction, Khanewal, Bahawalpur, Rohri, Hyderabad, Drigh Road, Karachi Cantonment.

Down has an additional Drigh Road stop. Both directions follow the Jahanian chord between Lodhran and Khanewal, continuing via Sahiwal and Lahore to Rawalpindi and the Islamabad branch. Multan is not used. The train terminates at Margalla rather than at Rawalpindi.

Sources: https://traintracking.pk/trains/green-line-5up and https://traintracking.pk/trains/green-line-6dn. The matching Up profile also appears at https://trains.metro-status.com/timetable/green-line/ . Published lists disagree about timings and some stops; no departure times or fares are imported. The existing UI identifies stop profiles as unofficial and current operations as unverified.

Geometry is solved in the existing connected OpenStreetMap rail graph, with an exact track projection at Margalla. It is not assembled with straight-line joins. Original snapshots and their timestamps remain in the dataset provenance. Run `npm run rail:import`, `npm run rail:verify`, and `npm test` to reproduce validation.

Select Green Line Express on `/rail`, then 5 Up or 6 Down. Any scheduled intermediate stop can be selected as a starting station before movement. W accelerates, S brakes, Space pauses; the existing 90 km/h maximum and manual station braking apply. Explore tracks also exposes this corridor with key 0.

Validation: 37 tests passed; every generated segment is source-backed; lint and production build passed. Production HTTP checks passed. Browser interaction verification was blocked by a runtime sandbox initialization failure.
