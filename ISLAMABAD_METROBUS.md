# Islamabad–Rawalpindi Metrobus: Red Line

Open http://localhost:5555/metrobus/islamabad, or select **Islamabad / Rawalpindi**
in the Metrobus cab's network selector. Lahore remains at `/metrobus`.
Run with `npm run dev` on port 5555; the existing public Mapbox token in
`.env.local` is reused. No new package or API key is required.

## Route sources

This addition covers the **Red Line, Saddar ↔ Pak Secretariat**, not the separate
Islamabad airport Orange Line, Blue Line or Green Line. PMA confirms the
[24-station articulated-bus system](https://pma.punjab.gov.pk/node/14) and
[Saddar–Pak Secretariat service](https://pma.punjab.gov.pk/operating-hours).
[Punjab Transport](https://transport.punjab.gov.pk/metro_bus_services) publishes
a corridor length of 24 km. The [Safar station directory](https://www.safar.fyi/islamabad/transit-lines/1:red)
provides the full directional sequence, cross-checked against source platform
names and refs; spelling aliases are explicit in the importer.

The geometry comes from [OSM route relation 13911249](https://www.openstreetmap.org/relation/13911249).
The bundled snapshot contains 87 `highway=busway` ways and 48 named platform
nodes (24 per direction). Every simulated station uses its actual directional
source node, rather than snapping to the opposite platform. The generated
journeys have 305 vertices / 22.131 km towards Pak Secretariat and 286 vertices /
22.113 km towards Saddar. These measurements differ from the published 24 km;
the cause has not been independently verified. Two-way source ways can represent
a shared corridor centerline; this is not surveyed individual lane geometry.

Source-tagged tunnels are dashed on the map. Station underground flags derive
only from the adjacent source-tagged segments (Kashmir Highway in this snapshot).
This does not claim complete classification of underground/elevated stations.

### Local terminal direction exception

OSM [way 993894344](https://www.openstreetmap.org/way/993894344) combines a closed
one-way Secretariat terminal loop with its short, shared entrance/exit stem.
The `oneway=yes` tag also covers the last edge from node 9182527131 to node
5220454818, making arrival at either Secretariat platform unreachable from Saddar
when applied literally. The importer treats **only this existing final edge** as
bidirectional. The loop keeps its one-way direction and every coordinate remains
an original source point. This is a local topology inference needed for the
published through service; it has not been independently surveyed, and no edit
is made to OpenStreetMap. Other one-way edges remain enforced.

`busSourceWays` documents the exception and checks the exact source IDs and loop
shape before applying it. If that shape changes, importing fails and requires
review. Regression tests prove that removing the exception blocks verification,
that the loop stays one-way, and that the original snapshot is not modified.
The simulator starts/ends at platforms and does not automatically drive around
terminal loops to reverse a journey; select the opposite direction explicitly.

## Controls and station starts

Select either direction and any station other than that direction's destination.
To depart from the destination terminal, choose the opposite direction.
Manual driving is the default. An articulated red bus follows the sourced
corridor with its rear body sampled 9 m behind the front around bends.

| Key | Action |
|---|---|
| Hold W | Accelerate |
| Hold S | Brake and cancel automatic stops |
| Release W/S | Coast |
| O | Open/close doors when stopped within 25 m of a platform |
| T | Toggle Manual / Auto stops (also while paused) |
| H | Synthesized bus horn |
| Space | Pause/resume |

Pointer controls mirror keyboard controls. Doors block acceleration. Automatic
mode brakes at every remaining station, opens doors for 12 seconds, closes them
and continues; W/S returns to manual. Manual mode needs manual station braking.
The 60 km/h cap and 12-second dwell are **simulation settings**, not an official
speed limit or service timetable. The destination is a hard route boundary.
Camera follow uses zoom 18; dragging detaches it and Follow restores it.
Audio is shared with Lahore Metrobus: layered synthesized bus engine, smoother automatic gear shifts, turbo/intake noise, tyre rumble, air brakes, pneumatic doors and a dual-tone horn. Actual acceleration/braking drives the sound, including automatic station stops. Enable Sound with a user gesture and adjust the Sound volume slider from 0–100%. Pause/mute cancels scheduled air and horn sounds as well as engine layers. The sound is generic bus synthesis, not an exact fleet recording.

## Shared architecture and independent progress

`lib/bus/networks.ts` holds per-city IDs, station sequence, direction labels,
bounds, dataset URL and storage key. `BusSimulator`, `BusCab`, `BusMap`, motion,
track sampling, articulated vehicle and audio are shared; the route pages are
Server Components. Each page keys the client simulator by network ID so changing
cities releases the old input, animation, audio and map before loading the new
network. Dataset validation checks the requested network to prevent mixed-city
paths. Station-count logic uses the current path length rather than Lahore's 27.

Islamabad progress uses `nextpath:metrobus-islamabad:v1`; Lahore retains its
existing `nextpath:metrobus-lahore:v1`. Existing Lahore saves remain valid.
Each journey saves once per second and on page hide. Refresh restores paused,
with validated station, direction, chainage, speed, doors and source fingerprint.
Switching cities saves the current journey and preserves the other city's save.
Rail and Orange Line progress remain independent.

## Reproduce and verify

```sh
node scripts/fetch-islamabad-metrobus.mjs
npm run metrobus:islamabad:import
npm run metrobus:islamabad:verify
npx tsx --test tests/bus.test.ts tests/islamabad-bus.test.ts
npm run lint
npm run build
npm test
```

Snapshots: `data/bus/islamabad-metrobus.osm.json` and
`public/data/bus/islamabad-metrobus.json`. © OpenStreetMap contributors,
[ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/); attribution is shown on
the map. No live OSM calls are needed to drive the bundled route.

Tests cover original source edges, directional platforms, every intermediate
start, all automatic stops in both directions, door interlocks, terminal state,
the scoped direction exception, cross-city validation and isolated saves.
Browser visual/audio interaction testing remains unavailable because the desktop
browser runtime cannot initialize its Windows sandbox; build, regression and
production HTTP checks can still be performed.
