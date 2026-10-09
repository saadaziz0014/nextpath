# Pak Business Express

Researched 8 October 2026. Published stopping profiles are used for simulation; current operations and the official timetable are unverified.

33 Up runs Karachi Cantonment to Lahore Junction with 11 scheduled stations: Karachi Cantt, Hyderabad, Nawabshah, Rohri, Rahim Yar Khan, Bahawalpur, Khanewal, Sahiwal, Raiwind, Kot Lakhpat and Lahore. 34 Down reverses these stops and additionally calls at Landhi and Drigh Road before Karachi, giving 13 stations including both termini.

Sources:
- https://trains.metro-status.com/timetable/pak-business/
- https://traintracking.pk/trains/pak-business-34dn
- Corridor cross-check: Pakistan Railways outsourcing advertisement, https://e.jang.com.pk/static_pages/7-7-2024/karachi/jang.pdf (Karachi Cantt–Lahore via chord).

Older directories quote different stop counts and stopping patterns. The selected Up and Down profiles are kept separately; times and fares are not imported. Manual station braking remains required.

The route follows the connected OpenStreetMap railway graph through Lodhran, the Jahanian chord, Khanewal and Sahiwal, ending precisely on a sourced track projection at Lahore. It does not use the Multan detour or Kasur branch. No straight-line gap repairs or station reversals are added. Source provenance and ODbL attribution remain in the dataset.

Choose Pak Business Express on `/rail`, then 33 Up or 34 Down. Scheduled intermediate stations are selectable before movement. Reset unlocks the starting station. W accelerates, S brakes and Space pauses; max speed remains 90 km/h. Explore tracks exposes the corridor with key B.

Validation commands: `npm run rail:import`, `npm run rail:verify`, `npm test`, `npm run lint`, `npm run build`.

Validation: all 39 tests, track connectivity checks, lint, production build and production HTTP smoke checks passed. Browser interaction testing was not completed because of the unresolved browser runtime sandbox startup problem.
