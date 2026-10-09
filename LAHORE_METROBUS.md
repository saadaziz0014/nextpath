# Lahore Metrobus

Open http://localhost:5555/metrobus after `npm run dev`. The existing public
Mapbox token (`NEXT_PUBLIC_MAPBOX_TOKEN` in `.env.local`) is used. No additional
API key or package is required. Metrobus is linked from Road, Pakistan Rail and
Orange Line.

## Route and provenance

The [Punjab Transport Department](https://transport.punjab.gov.pk/metro_bus_services)
identifies the Shahdara–Gajjumata corridor as 27 km with 27 stations.
Station naming/order follows the PMA directory:
[stations 1–20](https://pma.punjab.gov.pk/lahore_metrobus_system?page=0) and
[stations 21–27](https://pma.punjab.gov.pk/index.php/lahore_metrobus_system?page=1).
PMA describes an articulated bus fleet in its
[system overview](https://pma.punjab.gov.pk/node/12).

The bundled geometry comes from [OSM relation 19984670](https://www.openstreetmap.org/relation/19984670).
All 27 platform nodes are on its dedicated `highway=busway` ways. The importer
builds a connected node graph, respects `oneway=yes/-1`, finds a directional
path and checks each station appears in order. It adds no straight-line gap
bridges and does not use ordinary street routing or railway geometry.

The actual generated paths measure **25.842 km towards Gajjumata** and
**25.856 km towards Shahdara**, with 342 and 345 source vertices respectively.
That differs from the published 27 km; the cause has not been independently
verified. Shared two-way OSM ways represent a corridor centerline, not surveyed
individual lane offsets. Directional one-way ramps remain separate.
A short source-tagged underpass is dashed on the map. Platform locations are
exact source nodes; display spelling aliases are explicit in the importer.

OSM attribution remains visible on the map. Snapshot and derived geometry:
`data/bus/lahore-metrobus.osm.json`, `public/data/bus/lahore-metrobus.json`.
© OpenStreetMap contributors, licensed under
[ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/).

Refresh and reproduce:

```sh
node scripts/fetch-metrobus.mjs
npm run metrobus:import
npm run metrobus:verify
```

The bundled route works without contacting OSM during a journey. A source/API
failure cannot cause an automatic fallback to invented route geometry.

## Driving

Choose either direction and any starting station other than that direction's
destination. To leave a destination terminal, choose the opposite direction.
Manual driving is the default; the selected route keeps the bus on its corridor.

| Input | Action |
|---|---|
| Hold W | Accelerate |
| Hold S | Brake; overrides automatic stops |
| Release W/S | Coast |
| O | Open/close doors while stopped within 25 m of a station |
| T | Toggle Manual / Auto stops (also while paused) |
| H | Synthesized road-bus horn |
| Space | Pause/resume |

Pointer controls mirror the keyboard controls. Open doors block traction.
Automatic stops brake at every remaining station, open the doors, dwell for
12 seconds, close them and continue. W/S immediately returns to manual mode.
The **60 km/h speed cap** and 12-second dwell are simulation settings, not claims
about an official operational speed limit or timetable. Manual mode requires
manual station braking; the destination is a hard route boundary.

The red articulated bus has a front and rear body sampled 9 m apart on the
source road geometry. The rear uses its own road bearing around bends. The icon
is schematic, with a minimum visible size; at a terminal route origin the rear
is clipped until it enters the imported path. It is not a train or a full
steering/suspension simulation. Metrobus audio uses layered synthesized combustion and low engine body, a six-speed gearbox with shift hysteresis, light turbo/intake noise, filtered tyre rumble, air braking, pneumatic door releases and a dual-tone bus horn. Auto driving derives sound from actual acceleration/braking, and door dwell uses idle rather than throttle. Sound is enabled by a user gesture; the Sound volume slider adjusts 0–100%. Pause, mute and hidden tabs silence continuous layers and cancel scheduled horn/air bursts. This is generic bus tuning, not a recording of a particular fleet model.

## Architecture and saves

`app/metrobus/page.tsx` is a Server Component. Client cab/map/controller live in
`app/components/Bus*.tsx`, with route validation, binary-search sampling,
physics, persistence, vehicle geometry and source checks in `lib/bus/`.
Scoped `.bus-*` styles avoid changing the Orange Line or railway theme.

`requestAnimationFrame` updates refs, markers, sound and following camera;
React gets telemetry at 10 Hz. The heavy map is memoized. Simulation time steps
are capped at 100 ms after interruptions. Backgrounding pauses, releases keys,
silences sound and saves. Dragging detaches the camera; Follow restores a close
zoom-18 view. Audio starts only after user interaction and is disposed on exit.

Progress is saved once per second and on page hide under
`nextpath:metrobus-lahore:v1`, independently of rail/Orange Line saves.
Refresh restores paused, with audio gated by a new gesture. Source fingerprints,
departures, speed, route chainage, next station and door state are validated;
malformed or obsolete bus saves are discarded without interrupting the app.
Choosing a new journey preserves the previous save until the new journey starts.

## Verification

```sh
npm run metrobus:verify
npx tsx --test tests/bus.test.ts
npm run lint
npm run build
npm test
```

Tests cover source connectivity and one-way direction, all intermediate starts
in both directions, braking and door interlocks, full automatic journeys,
terminal boundaries, articulated body positions, isolated saves, invalid
restores and audio lifecycle. Browser visual/audio interaction verification
requires a working browser automation runtime; the desktop runtime currently
fails to start its Windows sandbox, so it could not be performed here.
