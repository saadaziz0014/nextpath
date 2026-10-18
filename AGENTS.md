# AGENTS.md — NextPath

## Scope and source of truth

This file applies to the whole repository. NextPath is a browser map-driving
simulation, not a live transport tracker, certified timetable or surveyed lane
model. Preserve the existing transport modes while making focused changes.

Use the code, package.json and checked-in datasets as the implementation source
of truth. README.md explains product behavior; route documents explain research
and source limitations. TESTING.md contains historical verification reports:
older route/test counts and browser observations are not current guarantees.
Update this file when architecture, commands or supported networks change.

## Setup and commands

- Next.js 16 App Router, React 19, strict TypeScript, Tailwind CSS 3, Mapbox GL JS,
  react-map-gl 7, Turf and lucide-react. Use the existing dependencies and lockfile.
- Node.js 20.9+ is the declared project requirement; npm is the package manager.
- Run npm ci, then npm run dev. Development and normal production start use
  port **5555**. npm run start requires npm run build first.
- Mapbox uses NEXT_PUBLIC_MAPBOX_TOKEN in .env.local. Copy .env.example only if
  no local environment file exists. Preserve existing configuration. Never
  expose token values in logs, commits or documentation; use a public pk token,
  not a secret sk token. Rebuild/restart after token changes.
- The browser needs WebGL; audio must be unlocked by a user gesture.

Standard checks:

```powershell
npm test
npm run typecheck
npm run lint
npm run build
```

Tests use node:test through tsx, not Jest. A focused check can use:

```powershell
npx tsx --test tests/multan-bus.test.ts tests/transit-stops.test.ts
```

The full rail geometry tests can take several minutes. Wait for completion;
do not report success from partial output. A documentation-only change needs
content/link checks, rather than a new app build or tests mirroring prose.

## Pages and architecture

| URL | Mode | Current coverage |
| --- | --- | --- |
| / | Road | Route planning, route playback and free city driving |
| /rail | Pakistan Rail | Train services plus corridor exploration |
| /metro | Orange Line | Ali Town–Dera Gujran; 26 stations, both directions |
| /metrobus | Lahore Metrobus | Shahdara–Gajjumata; 27 stations |
| /metrobus/islamabad | Islamabad / Rawalpindi Metrobus | Saddar–Pak Secretariat; 24 stations |
| /metrobus/peshawar | Peshawar BRT | SR-02 Chamkani–Karkhano Market; 30 stations |
| /metrobus/multan | Multan Metrobus | BZU–Chowk Kumharan; 21 stations |

All Metrobus networks support both directions and eligible station departures.
The destination terminal requires switching direction before departing.

- app/layout.tsx and page wrappers are Server Components. Components owning
  DOM, WebGL, animation, localStorage or Web Audio belong behind 'use client'.
- app/components/MapSimulator.tsx, MapCanvas.tsx and
  app/hooks/useVehicleSimulation.ts implement road UI, map and simulation.
  lib/routes.ts handles Geocoding/Directions; lib/roadNetwork.ts,
  lib/driving.ts and lib/turnPrompt.ts handle manual road traversal.
- app/components/RailSimulator.tsx and RailMap.tsx own rail presentation and
  lifecycle. lib/rail/ separates trains, datasets, departure, track sampling,
  physics, journey boundaries, cruise, consist and persistence.
- MetroSimulator/MetroMap/MetroCab use lib/metro/ for Orange Line.
- MobileCabPanel separates urban-transit journey selection from the mobile
  driving toolbar and expandable settings. TouchDpad places traction/brake on
  the left and vehicle actions on the right below 1024 CSS pixels; rail uses
  its own compact status/selection panels. Desktop cabs retain their layouts.
  Keep the map mounted when settings change and preserve paused Auto selection.
- BusSimulator/BusMap/BusCab share lib/bus/ across cities. Register networks
  in lib/bus/networks.ts and their ID/direction types in lib/bus/types.ts.
  Keep bounds, station order, URLs, colours and save keys network-specific.
- lib/transit/stops.ts and controls.ts share Orange Line/Metrobus stop and
  keyboard semantics. Avoid city-specific fixes in generic motion functions.
- lib/audio/ and app/hooks/use*Audio.ts own audio behavior and lifecycle.
- @/* resolves from the project root. Coordinate tuples are [longitude, latitude];
  text coordinate input accepts latitude, longitude. Chainage is kilometres,
  motion velocity is metres per second, and displayed speed is km/h.

## Simulation behavior to preserve

Use requestAnimationFrame with elapsed-time physics and bounded frame gaps.
Keep per-frame motion, keys and map instances in refs; throttle React telemetry
updates. Do not replace animation with setInterval or rerender a heavy map for
every frame. Interpolate track positions and smooth bearings across north by
the shortest angle. Dispose frames, markers, listeners and audio on cleanup.

- Road: W accelerates; S brakes, then reverses along driven history. A/D choose
  connected junction exits. The prompt appears within 50 metres; Enter commits
  an available straight exit. Committing an exit locks A/D until that junction
  is traversed. Ordinary bends continue; no forward road means stop and wait
  for a legal choice. Junction exits are matched by driven heading, previous
  segment, road continuity and where the exit leads, never by nearest distance
  alone, so shallow U-turn lanes and slip roads are not auto-followed; A/D can
  still pick a leaning branch of a shallow fork. Respect mapped one-way
  directions and grade separation. Never bypass missing connectivity by moving
  the car off-road. Search defaults to Pakistan with map proximity; worldwide
  search is an explicit option. While free driving, a changed start (location,
  search or map pick) restarts the drive there and a changed destination waits
  for the route build instead of ending the session. Use my location tries one
  precise device fix, then one coarse network fix if the device stalls, and
  always ends with a filled endpoint or a visible error.
- Rail: W traction, S manual brake, C cruise, V stopped reverser, R stopped
  confirmation at a declared station reversal, H horn, Space pause. Forward
  limit is 110 km/h except KCR at 90 km/h; backing stays at 20 km/h for all
  trains. Seven coaches follow the locomotive
  with close zoom-aware spacing and sample their own chainages. Preserve Kasur,
  Sibi and Habib Kot reversal boundaries. Zoom must keep the chosen level while
  following; map dragging enters exploration. Station stops remain manual.
- Orange Line: five electric cars with separate metro presentation and audio;
  80 km/h simulation cap. Do not reuse diesel train sound or rail cab UI.
- Metrobus: two articulated sections; 60 km/h simulation cap. Lahore, Islamabad
  and Multan use red livery; Peshawar uses green Zu livery and hybrid labeling.
- Both transit categories: W power, S brake, T Manual / Auto stops, O platform
  doors, H horn and Space pause. Open doors interlock traction. Auto serves
  pending platforms with 12-second dwell, never snaps back to a passed stop,
  and finishes with terminal doors open. S overrides auto; W overrides with
  doors closed. T works while paused and clears held traction; key repeats
  must not undo that choice. These speeds/dwells are simulation settings.

Ignore driving shortcuts in editable controls and with browser modifiers;
clear held keys on focus loss and tab hiding. Preserve keyboard, pointer and
touch controls. Audio pause/mute must silence pending horn and pneumatic bursts.
Use abortable requests and stale-response guards for async loading.

## Journey saves and audio provenance

Rail uses nextpath:rail-journey:v1; Orange Line uses nextpath:metro-orange:v1.
Metrobus networks each have their own saveKey in lib/bus/networks.ts. Validate
saved state against current geometry, fingerprints where available, service,
direction, station, boundaries and motion limits. Restore journeys paused.
Malformed/obsolete saves and unavailable localStorage must not break driving.
Do not store trusted route geometry in browser saves or mix city progress.

Rail's bundled recording is a GE 7FDL idle substitute from an Australian NR
locomotive, not an authentic Pakistan AGE-30 recording or recorded throttle
notches. Preserve public/audio/ATTRIBUTION.txt and procedural fallback. The horn
is synthesized. Orange Line is electric; Metrobus uses synthesized bus engine,
gear, tyre, brake and door layers. See TRAIN_AUDIO.md for licensing and limits.

## Route research and data maintenance

Research a new service before adding it. Prefer operator/official sources;
record URLs, research date, direction-specific station order and uncertainty
in its route document. Do not present historical or reported services as
verified current operation. Train definitions and stop profiles live in
lib/rail/trains.ts, separately from shared track geometry.

Existing services include Allama Iqbal, Musa Pak, Fareed (Baba Farid), Jaffar,
Green Line, Awam, Pak Business, Subak Kharam, Tezgam, Mohenjo Daro, Millat,
Jamalo and the shorter KCR local service. Their root-level route documents
record evidence and limitations. Jamalo uses the reported Shikarpur extension;
KCR includes 11 mapped calls, not the historic loop or invented missing halts.

- Original source snapshots belong in data/rail, data/metro and data/bus.
  Generated browser datasets belong in public/data/. Retain attribution,
  source IDs, original geometry and retrieval/source metadata.
- Fetch scripts are explicit maintenance tools. Rail/transit driving loads
  bundled data; do not add runtime OSM/Overpass requests to those simulations.
  Roads still use Mapbox tiles and explicit Geocoding/Directions requests.
- Build only connected sourced rail/busway geometry. Preserve one-way edges,
  tunnel/bridge information and station order. Never invent gap bridges,
  ordinary-road shortcuts, stations, or route relations to make a route pass.
- Inferred station projections must remain on original source segments with
  bounded offsets and documented accuracy. Declared rail station reversals
  split checked legs; they do not excuse arbitrary retracing elsewhere.
- Preserve tightly scoped source interpretations: Islamabad's Secretariat
  terminal stem, Peshawar's legacy busway/platform aliases, and Multan's reviewed
  legacy ways and station aliases. Consult source validators and route docs;
  do not globally relax validation to accommodate a local source defect.
- Adding a bus network requires types/config, a Server page wrapper, source
  import/verification, bundled data, unique storage key, docs and regressions.
  Extend shared transit tests and city-count assumptions. Reuse bus UI/audio.
- Adding a train requires its separate Up/Down stop profiles, service mapping,
  any needed sourced corridor, documentation and departure/persistence tests.
  Preserve other train geometries and existing saves during targeted imports.

Offline rebuild and source-check commands:

| Dataset | Import | Verify |
| --- | --- | --- |
| Rail | npm run rail:import | npm run rail:verify |
| KCR targeted update | npm run rail:kcr:import | npm run rail:verify |
| Orange Line | npm run metro:import | npm run metro:verify |
| Lahore Metrobus | npm run metrobus:import | npm run metrobus:verify |
| Islamabad Metrobus | npm run metrobus:islamabad:import | npm run metrobus:islamabad:verify |
| Peshawar BRT | npm run metrobus:peshawar:import | npm run metrobus:peshawar:verify |
| Multan Metrobus | npm run metrobus:multan:import | npm run metrobus:multan:verify |

rail:import is the extended importer configured in package.json; do not run
scripts/import-rail.ts as a replacement for the full current dataset. A KCR
targeted update preserves other routes. Review generated data changes, then
run the appropriate source verification before claiming route correctness.

## Verification and documentation

For motion, junction, stop, source or persistence changes, add meaningful
regressions using actual datasets: eligible starts in both directions, complete
auto trips where supported, terminal boundaries, braking/door interlocks,
malformed saves, source connectivity and existing-mode compatibility.
Run focused tests during development and the full suite plus TypeScript, lint
and build before reporting a substantive cross-mode implementation complete.
Run relevant source checks for imported geometry changes.

Browser checks with real tiles should cover selection, input, map follow/zoom,
refresh and audio where relevant. HTTP status checks and mocked audio tests
are not interactive browser or listening verification. Report what actually
ran and any material gaps; do not copy historical successful checks forward.
Never claim that a whole real-time train journey was driven without doing so.

Keep README.md and the relevant route/audio document aligned with changes.
Keep future guidance factual and actionable; avoid fixed passing-test counts
in this file because they become stale as the suite grows.
