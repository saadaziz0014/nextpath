# Orange Line Lahore — electric metro mode

Open **/metro**, or follow Orange Line from Road / Pakistan Rail mode. This is a separate metro experience: its own responsive orange-and-white map and driver console, five-car electric multiple unit artwork, electric motion model, traction audio and saved journey. It does not use RailSimulator, RailMap, diesel samples, the seven-coach locomotive formation or the railway journey save key.

## Researched facts

[PMA's project description](https://pma.punjab.gov.pk/orange-line-metro-train-system) identifies Ali Town–Dera Gujran with 26 stations. [PMA's station directory](https://pma.punjab.gov.pk/lahore_orange_line_metro_train_system) supplies station names and [PMA's overview](https://pma.punjab.gov.pk/system/files?file=STCS+Doc.pdf) identifies the five-car, roughly 100 m formation and underground Anarkali / GPO stations. [CRRC](https://www.crrcgc.cc/en/2017-05/23/article_14DDF7DB0DD748B9AD4940F24808A36F.html) specifies the five-car 3M+2T metro and maximum operating speed of about 80 km/h. These facts were researched on 9 October 2026.

Station sequence towards Dera Gujran: Ali Town, Thokar Niaz Baig, Canal View, Hanjarwal, Wahdat Road, Awan Town, Sabzazar, Shahnoor, Salahudin Road, Band Road, Samanabad, Gulshan-e-Ravi, Chauburji, Anarkali, GPO, Lakshmi, Railway Station, Sultanpura, UET, Baghbanpura, Shalamar Garden, Pakistan Mint, Mahmood Booti, Salamatpura, Islam Park, Dera Gujran. The opposite direction uses its own mapped running track and reversed station order.

The mainline Lahore Junction station is distinct from the metro stop called Railway Station. Metro stops are identified by OSM platform stop nodes in the directional route relations, not by mainline station names.

## Controls

1. Select a direction and starting platform, then Enter driver cab. Departure is unavailable from that direction's destination; choose the other direction. Reset keeps the selected departure. Choose a new metro journey allows a new platform or direction.
2. **W**: electric power. **S**: regenerative/service braking. Release to coast. The simulation caps speed at 80 km/h.
3. **O**: open / close doors when stopped within 25 m of a platform. Open doors interlock traction.
4. **T**: toggle Manual / Auto stops, including while paused. The controller follows a braking envelope, stops at each platform and opens doors for a **12-second simulated dwell**. W (with doors closed) or S returns to manual control. Mode changes preserve the pending station even within 25 metres; a served platform is not visited twice. In manual mode use O to close doors before powering away. This simplified controller and dwell are simulation choices, not the actual Orange Line signalling / stopping programme.
5. **Space**: pause / resume. **H**: synthesized metro chime. Enable sound is a user gesture; electric inverter / rolling audio changes with speed and traction. There is no recorded Orange Line sound claim.
6. Drag the map to explore, use Follow cab to resume tracking, or Line overview to see the corridor.

Metro progress saves under `nextpath:metro-orange:v1`, separately from Pakistan Rail. Refresh restores paused, including service direction, platform, doors and automatic mode. Geometry fingerprint and motion validation discard stale / malformed saves. Blocked browser storage does not interrupt the journey. Hidden tabs pause and clear held controls. Keyboard shortcuts leave form fields and focused button Space actions accessible.

## Data and geometry

Bundled OpenStreetMap snapshot: `data/metro/orange-line.osm.json`, ODbL attribution included. OSM relations **11803500** and **11803498** specify the two directions and all 26 platform stops. The importer joins only shared source node IDs, selects the actual directional track, and clips the corridor at the first and last platform. Each output edge must belong to the original subway geometry; yard tracks, mainline rails, gap bridges and unintended reversals are excluded.

The mapped platform-to-platform chainage is approximately **25.34 km** in each direction. PMA publishes **27.1 km** for the project. That figure differs from the mapped platform-to-platform chainage; the simulation uses the sourced geometry rather than adjusting coordinates to force a matching length. The reason for the difference has not been independently verified. Solid orange denotes elevated / surface track; dashed orange represents source-tagged tunnel track. The map remains a map view in tunnels, not a rendered tunnel interior. Individual cars are clipped at imported route boundaries until they enter the corridor.

## Structure and maintenance

- `app/metro/page.tsx`: Server Component and route metadata.
- `app/components/MetroSimulator.tsx`, `MetroCab.tsx`, `MetroMap.tsx`: dedicated client animation, console and memoized map.
- `app/metro/metro.css`: scoped metro design and mobile layout.
- `lib/metro/`: data types, sampling, physics / door interlocks, source verification, formation and saved state.
- `lib/audio/electric.ts` / `app/hooks/useMetroAudio.ts`: synthesized electric sound, gesture unlock and cleanup.
- `scripts/fetch-orange-line.mjs`: deliberate OSM refresh helper; the app uses the bundled snapshot.
- `scripts/import-orange-line.ts` / `verify-orange-line.ts`: deterministic import and source checks.

Use `npm run metro:import`, `npm run metro:verify`, `npm test`, `npm run lint` and `npm run build` after changing data or behaviour. No new dependencies or environment variables are needed; the map uses the existing `NEXT_PUBLIC_MAPBOX_TOKEN`.

Verification includes both full automatic journeys, station projections, source-backed edges, electric speed / braking, door interlocks, manual override, intermediate departures, separate persistence, five-car formation and audio graph disposal. Production HTTP checks cover the page and served route data. The browser automation kernel failed its Windows sandbox setup in this session; live visual, keyboard / pointer interaction and audible browser playback verification remain unperformed.
