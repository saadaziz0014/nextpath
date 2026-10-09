# Karachi Circular Railway local corridor

## Scope and use

Open `/rail`, choose **Karachi Circular Railway (Local)**, select a starting
station and choose **1 Up** toward Dhabeji or **2 Down** toward Karachi City.
The simulator covers the shorter Karachi City–Dhabeji main-line corridor,
55.20 km, with 11 mapped stations. Explore tracks also exposes it with **Z**.

This is the diesel local-service simulation requested by the user, with the
existing locomotive, seven coaches, manual W/S braking, 90 km/h simulation
limit, V reverser, C cruise, H horn, zoom/follow and local-storage restoration.
The speed limit is an app setting, not a verified operational KCR speed limit.
It does not represent the historic full circle or the proposed electric system.

## Research and limitations (9 October 2026)

- [Radio Pakistan's inauguration report, 19 November 2020](https://www.radio.gov.pk/19-11-2020/railways-minister-inaugurates-kcr-at-city-station-karachi)
  confirms the first revived phase between Pipri and Karachi City. This does
  not verify today's operation or a Dhabeji extension.
- [Published 1 Up profile](https://tracktrain.pk/trains/karachi-circular-railway-1up)
  lists Karachi City–Dhabeji, despite an inconsistent Orangi banner.
- [Published 2 Down profile](https://tracktrain.pk/trains/karachi-circular-railway-2dn)
  includes an Orangi extension. Only its Dhabeji–Karachi City section is used.
  Titles say 1 Up / 2 Down; number fields say 229/230. Display labels follow
  the titles and are not presented as verified official service numbers.
- [Radio Pakistan's restoration report, 22 April 2026](https://radio.gov.pk/22-04-2026/pakistan-railways-sindh-govt-agree-to-restore-karachi-circular-railway)
  discusses further revival. The app does not claim a verified current timetable.

Published station calls and usable track locations are separate concerns.
The published City–Dhabeji list contains 14 calls. **Departure Yard, Drigh
Colony and Marshalling Yard Pipri** are not given invented coordinates:
they remain omitted until reliable, distinct stopping locations are available.
Drigh Colony coordinates found in public references overlap the mapped Airport
station and disagree with published stop order. Gaddar is not substituted for
Pipri. This limitation is displayed in the train picker.

The 11 included stops are Karachi City, Karachi Cantonment, Drigh Road,
Airport, Malir Colony, Malir, Landhi, Jumma Goth, Bin Qasim, Badal Nala, Dhabeji.
Malir Colony is sourced from OSM node 5226556649 (Malir Halt, explicitly named
Malir Colony in `alt_name:en`). Others use stable station IDs on the existing
Fareed ML-1 corridor. These are mapped locations, not verified current calls.

## Data and maintenance

`lib/rail/kcrImport.ts` trims the sourced, connected Fareed track at Dhabeji.
It preserves every original track vertex, projects station source points onto
that geometry, rejects offsets over 250 m, missing terminals or incorrect
station order, and applies the existing no-retracing/no-hidden-reversal checks.
Existing long-distance routes are unchanged, preserving their saved journeys.

`data/rail/kcr-local-stations.osm.json` is a checked-in OSM/Overpass snapshot.
It was obtained from `https://overpass.kumi.systems/api/interpreter` using:

```overpass
[out:json][timeout:90];
nwr["railway"~"^(station|halt)$"](24.78,66.98,24.97,67.60);
out center geom;
```

The remaining track and station sources are the existing ML-1 snapshots.
The browser dataset records all source-file timestamps. © OpenStreetMap
contributors, ODbL 1.0; [attribution and licence](https://www.openstreetmap.org/copyright).

```powershell
npm run rail:kcr:import # targeted offline rebuild, preserves other paths
npm run rail:import     # full offline rebuild, includes KCR
npm run rail:verify     # verifies every output edge against sourced rails
npm test
npm run typecheck
npm run lint
npm run build
```

Tests cover both directions, every eligible starting station, source-aligned
stops, deterministic imports, missing-data rejection, saved cruise/restoration,
manual station passage, backing, and the track boundary.
