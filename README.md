# NextPath

**Drive roads, operate trains, and explore Pakistan’s urban transit routes.**

NextPath combines free city driving and route playback with Pakistan Rail,
Lahore Orange Line, and Metrobus simulations for Lahore, Islamabad/Rawalpindi,
Peshawar, and Multan. Vehicles follow connected road or track geometry, rotate
with their direction of travel, and use a following map camera.

Built with **Next.js 16 · React 19 · TypeScript · Mapbox GL JS · react-map-gl 7
· Turf · Tailwind CSS 3 · Lucide**.

[Quick start](#quick-start) · [Transport modes](#transport-modes) ·
[Road driving](#road-driving) · [Pakistan Rail](#pakistan-rail) ·
[Orange Line and Metrobus](#orange-line-and-metrobus) · [Development](#development)

## Quick start

You need Node.js **20.9+**, npm, a public Mapbox access token, and a browser
with WebGL support.

```powershell
npm ci
```

If `.env.local` does not already exist, copy `.env.example`:

```powershell
Copy-Item .env.example .env.local
```

Set your public token in `.env.local`:

```dotenv
NEXT_PUBLIC_MAPBOX_TOKEN=pk.your_actual_public_token
```

Preserve any existing environment configuration. Use a public `pk.*` token,
not a secret `sk.*` token. Configure its allowed URLs for localhost and your
deployment, and restart/rebuild after changing it.

```powershell
npm run dev
```

Open **[localhost:5555](http://localhost:5555)**. Development and normal
production start both use port **5555**. Map tiles, geocoding, and road routing
use your Mapbox account and are subject to its usage limits and billing.

## Transport modes

| Mode | Open | Included experience |
| --- | --- | --- |
| Roads | [Drive & Explore](http://localhost:5555/) | Select places, drive freely, or play a planned road route |
| Pakistan Rail | [Train journeys](http://localhost:5555/rail) | 13 named train profiles, intermediate starts, reverse and cruise |
| Orange Line | [Lahore metro](http://localhost:5555/metro) | Ali Town ↔ Dera Gujran; 26 stations; five electric cars |
| Lahore Metrobus | [Lahore](http://localhost:5555/metrobus) | Shahdara ↔ Gajjumata; 27 stations; red articulated bus |
| Islamabad Metrobus | [Islamabad / Rawalpindi](http://localhost:5555/metrobus/islamabad) | Saddar ↔ Pak Secretariat; 24 stations; red articulated bus |
| Peshawar BRT | [Peshawar](http://localhost:5555/metrobus/peshawar) | SR-02 Chamkani ↔ Karkhano Market; 30 stations; green Zu bus |
| Multan Metrobus | [Multan](http://localhost:5555/metrobus/multan) | BZU ↔ Chowk Kumharan; 21 stations; red articulated bus |

Rail and urban transit use bundled OpenStreetMap-derived route data. Both
travel directions are available. Rail and transit are simulations of documented
corridors and stop profiles; they do not provide live vehicle locations or
certified current timetables.

## Road driving

### Choose a journey

1. Expand **Plan a journey**.
2. Search for a starting place and select a result, or pick a point on the map.
   Coordinate input accepts `latitude, longitude`, such as `31.5204, 74.3587`.
3. Choose **Free drive from start** to drive without a destination. The car
   snaps to a loaded drivable road within 50 metres.
4. For navigation, also select a destination and choose **Build road route**.
   The planned route uses Mapbox Directions road geometry and snapped endpoints.
5. Drive manually, or select **Route playback** and resume.

Search defaults to **Pakistan**, with map-centre proximity and up to ten results.
Use **Search region → Worldwide** to remove the country filter; add a city name
for distant places. Search runs on explicit submission. Editing text alone does
not select a result. The Lahore–Karachi preset fills example endpoints; **Build**
requests the route.

Selecting a new endpoint clears the previous route. Choose free drive or build
again before driving. Failed routing shows an error rather than inventing a
straight-line route. Requests have timeouts, cancellation and stale-response
protection.

Use **Use my location** below Start or Destination to fill that endpoint from
your device, then allow the browser's location request. This needs HTTPS or
localhost. Each click requests one location fix; it does not track your movement.
A precise fix is tried first and a coarse network fix if the device stalls, so
every click ends with a filled endpoint or a clear error. While free driving,
choosing a new start (location, search or map pick) restarts the drive at that
point, and a new destination waits for **Build road route**.
After choosing your endpoints, select **Build road route**, or use **Free drive
from start**. Directions snaps route endpoints to roads. If location is denied,
unavailable or times out, you can retry, search, or pick on the map.

### Controls and junctions

| Input | Action |
| --- | --- |
| Hold **W** | Accelerate, up to 120 km/h |
| Hold **S** | Brake, then reverse along driven history, up to 25 km/h |
| **A / D** | Choose a connected left/right junction exit |
| **Enter** at a junction prompt | Commit the available straight exit |
| **Follow road** | Clear an uncommitted turn request |
| **Pause / Reset** | Suspend driving / return to the selected start |
| **Follow / Route overview** | Recenter at driving zoom / show the planned trip |

Within 50 metres of a junction, the prompt lists connected choices. Selecting
one commits that specific exit and locks A/D until the car crosses the junction.
W/S remain available. Ordinary bends follow the road; a junction without a
forward continuation stops the car until an available turn is chosen. An
unavailable turn stays queued when a forward exit exists. Reset or a mode
change clears the commitment.

Junction exits are matched by the driven direction, previous segment, road
connectivity and where the exit actually leads over the next metres, not by
nearest distance or first-segment angle alone. A shallow U-turn lane, slip road
or curved side street is therefore a turn even when it departs at a similar
angle, and W never follows one by itself. Same-source and same-named roads keep
their drive-through bends. At a shallow fork where both branches read as
straight, A/D still picks the branch leaning left or right while W keeps the
same road. If a continuation tile has not loaded, the car waits at the node and
resumes when it arrives instead of switching to a nearby connector. Free-drive
snapping also weights the vehicle heading so a nearby opposite carriageway is
not chosen over the aligned road.

Nearby map tiles extend the drivable graph during free driving. True dead ends
or unavailable road connectivity stop movement. The graph respects mapped
one-way directions and bridge/tunnel levels where tile data provides them.
Ground roads can enter bridges and tunnels at shared source endpoints;
interior crossings remain separated by level. Missing source connections
still stop the vehicle rather than moving it off-road.
Manual driving shows the current road level beside the car and in a small
diagram in the controls: ground road, flyover/bridge, or underpass/tunnel.
Labels use the current driven segment's map metadata, including after leaving
the planned route. Roads with only a layer value show elevated/below-ground
labels; missing structure metadata cannot identify every real-world underpass.
It represents road centre lines, without lane widths, collisions or a complete
legal turn-restriction model. Free drive has no destination progress; manual
route mode shows direct remaining distance, while playback uses route distance.

Playback follows the planned geometry at a **60 km/h base speed** with
**1× / 2× / 5× / 10×** multipliers. Changing modes resets to the route start.
On-screen driving controls support touch; editable fields do not drive the car.
Focus loss and tab hiding clear road input and suspend motion.

The road camera uses the same elevated rear angle as rail: zoom 16.5 and pitch
50 on recenter, with the car centred
in the visible map area so more road is shown ahead. Camera spacing adapts to
the planner and driving controls. The car stays upright and readable on the
tilted map with a rear perspective; heading follows turns smoothly across north.
Dragging or rotating releases follow. Zoom keeps follow enabled and retains
your chosen zoom, yielding to wheel, buttons and pinch while they animate;
**Follow** restores driving zoom. Reduced-motion
preferences disable animated overview and place-selection transitions. The
driving camera keeps its forward-facing perspective when following the car.

## Pakistan Rail

Choose a train, its **Up / Down** service, and a **Starting station**. Start from
an intermediate scheduled call, such as Lahore on Tezgam. The destination
terminal cannot be an outbound start in the same direction. Reset returns to
the selected departure; **Change route** opens journey selection. Selectors
lock once the train moves. **Explore tracks** provides the underlying corridors
with their displayed shortcuts; named journeys use **1 / 2** for Up / Down.

### Included train profiles

The numbers, endpoints and stop counts below describe profiles implemented in
the app. Direction-specific calls are retained rather than assuming symmetry.
Each train name links to its research, source references and coverage limits.

| Train | Services: Up / Down | Up journey | Stops: Up / Down |
| --- | --- | --- | --- |
| [Allama Iqbal Express](ALLAMA_IQBAL.md) | 9 / 10 | Karachi Cantt → Sialkot | 37 / 36 |
| [Musa Pak Express](MUSA_PAK.md) | 115 / 116 | Multan Cantt → Lahore Junction | 10 / 6 |
| [Baba Farid (Fareed) Express](FAREED_EXPRESS.md) | 37 / 38 | Karachi City → Lahore Junction | 45 / 46 |
| [Jaffar Express](JAFFAR_EXPRESS.md) | 39 / 40 | Quetta → Peshawar Cantt | 42 / 40 |
| [Green Line Express](GREEN_LINE.md) | 5 / 6 | Karachi Cantt → Margalla | 9 / 10 |
| [Awam Express](AWAM_EXPRESS.md) | 13 / 14 | Karachi Cantt → Peshawar Cantt | 62 / 62 |
| [Pak Business Express](PAK_BUSINESS_EXPRESS.md) | 33 / 34 | Karachi Cantt → Lahore Junction | 11 / 13 |
| [Subak Kharam (Railcar)](SUBAK_KHARAM.md) | 103 / 104 | Lahore Junction → Rawalpindi | 8 / 9 |
| [Tezgam Express](TEZGAM_ROUTE.md) | 7 / 8 | Karachi Cantt → Rawalpindi | 29 / 31 |
| [Mohenjo Daro Express (Passenger)](MOHENJO_DARO_ROUTE.md) | 213 / 214 | Kotri → Rohri | 24 / 24 |
| [Millat Express](MILLAT_ROUTE.md) | 17 / 18 | Karachi Cantt → Lala Musa | 35 / 36 |
| [Jamalo Express (Ho Jamalo)](JAMALO_ROUTE.md) | Local / Local | Shikarpur → Rohri, via Sukkur | 3 / 3 |
| [Karachi Circular Railway (Local)](KCR_LOCAL.md) | 1 / 2 display labels | Karachi City → Dhabeji | 11 / 11 |

Mohenjo Daro uses a historical Kotri–Rohri profile. Jamalo uses the reported
Shikarpur extension; official numbers and the full stopping pattern remain
unverified. KCR covers the shorter local corridor, approximately 55.20 km,
excluding the historic circle and Orangi extension. Departure Yard, Drigh Colony
and Pipri halt are omitted pending reliable mapped locations; KCR service
numbers and current operation are not verified.

### Train controls

| Input | Action |
| --- | --- |
| Hold **W / S** | Traction / manual brake |
| **C** | Toggle cruise at the current moving speed |
| **V**, while stopped | Toggle forward / backing |
| **R**, at a required stopped boundary | Confirm a station direction change |
| Hold **H** | Sound the horn |
| **Space** | Pause / resume |
| **Zoom in / Zoom out**, wheel or pinch | Inspect nearby places while following |
| **Follow train** | Recenter without resetting the chosen zoom |

Forward speed is capped at **110 km/h**, except **KCR at 90 km/h**; backing
is capped at **20 km/h** for every train. Manual traction
reaching the limit engages cruise; C can hold lower speeds such as 20 or 30 km/h.
S cancels cruise and brakes; W overrides it. **Cruise does not stop at stations**:
railway station braking remains manual.

Fareed requires a stopped direction-change confirmation at **Kasur**; Jaffar at
**Sibi**; Mohenjo Daro at **Habib Kot**. Backing cannot cross a physical reversal
boundary. Ordinary route ends also stop the train.

Each train has one locomotive and **seven amber coaches**. Coaches follow their
own track positions around bends and while backing, with zoom-aware spacing.
At a route origin they appear as the train advances onto the imported corridor;
no track is invented beyond the route boundary.

Dragging releases camera follow. Zooming preserves follow and the chosen level.
Saved journeys restore paused, including service, starting station, progress,
reverser, cruise, reversal confirmations and follow preference. Invalid saves
are discarded; unavailable browser storage does not interrupt driving.

## Orange Line and Metrobus

Choose a direction and starting station, then enter the driver cab. Orange Line
has **five electric cars** and its own cab/audio. Metrobus has **two articulated
sections**, with a city selector and network-specific livery.

| Input | Action |
| --- | --- |
| Hold **W / S** | Power / brake |
| **T** | Toggle Manual / Auto stops, including while paused |
| **O**, at a stopped platform | Open / close doors |
| **H** | Sound the horn |
| **Space** | Pause / resume |

Orange Line is capped at **80 km/h**; Metrobus at **60 km/h**. These are simulation
settings. Auto serves pending stations, opens doors for **12 seconds**, and
continues. Terminal doors remain open. S overrides auto; W overrides with doors
closed. Manual driving requires braking at the platform and using O for doors.
Open doors interlock traction. T clears held traction, and repeated key events
must not undo the selected mode.

Orange Line and each Metrobus city save progress separately and restore paused.
Use the opposite direction to depart from a destination terminal.

Route details: [Orange Line](ORANGE_LINE.md) · [Lahore](LAHORE_METROBUS.md) ·
[Islamabad / Rawalpindi](ISLAMABAD_METROBUS.md) · [Peshawar](PESHAWAR_BRT.md) ·
[Multan](MULTAN_METROBUS.md).

## Sound

Enable sound through a user gesture, then use volume and mute controls.

- **Rail:** bundled GE 7FDL idle recording with procedural fallback, turbo/rail
  layers and a synthesized horn. The recording is from an Australian NR Class
  locomotive, a substitute for the AGE-30 engine family; full throttle is
  approximated, and the horn is not an authentic AGE-30 recording.
- **Orange Line:** synthesized electric traction audio.
- **Metrobus:** synthesized engine/gear shifts, tyre rumble, air brakes,
  pneumatic doors and horn.

Pause and mute silence audio. See [TRAIN_AUDIO.md](TRAIN_AUDIO.md) and
[recording attribution](public/audio/ATTRIBUTION.txt) for licensing, lifecycle
checks and listening-verification limitations.

## Development

### Project structure

```text
app/
  layout.tsx, page.tsx         Server layout and road page
  icon.svg                    App favicon
  rail/page.tsx               Pakistan Rail
  metro/page.tsx              Orange Line
  metrobus/                   Lahore + Islamabad, Peshawar and Multan pages
  components/                 Road, rail, metro and bus maps/controllers/cabs
  hooks/                      Road animation and transport audio hooks
lib/
  routes.ts, roadNetwork.ts    Place search, Directions and connected road graph
  driving.ts, turnPrompt.ts    Road physics and junction decisions
  simulation.ts               Bearing smoothing
  rail/                       Train profiles, track, motion, consists and saves
  metro/, bus/, transit/      Transit networks, motion, shared stops and saves
  audio/                      Diesel, electric and bus audio engines
data/                         Original OSM source snapshots
public/data/                  Generated rail, metro and bus datasets
public/audio/                 Bundled recording and attribution
scripts/                      Explicit source fetch, import and verification
tests/                       node:test regression suite, run through tsx
AGENTS.md                     Repository guidance for coding agents
```

Map and simulation controllers are Client Components; page wrappers and the
layout remain Server Components. High-frequency motion stays in refs.
`requestAnimationFrame` drives vehicles and camera updates, with bounded frame
gaps and throttled UI telemetry. Indexed chainage sampling avoids scanning whole
routes every frame. Cleanup disposes animation frames, listeners, markers and
audio. Rendering performance depends on hardware, WebGL and tile connectivity.

Road search uses [Mapbox Geocoding v6](https://docs.mapbox.com/api/search/geocoding/);
planned road geometry uses [Mapbox Directions](https://docs.mapbox.com/api/navigation/directions/).
Rail/transit loads bundled routes without runtime OSM/Overpass requests.
No database or separate backend service is required.

### Checks

```powershell
npm test
npm run typecheck
npm run lint
npm run build
```

The full rail geometry suite can take several minutes. For a focused transit
change, for example:

```powershell
npx tsx --test tests/multan-bus.test.ts tests/transit-stops.test.ts
```

Verify real browser interactions separately: journey selection, keyboard/touch
input, junction commitments, manual/auto stops, doors, reverse, cruise, map zoom,
refresh and audio. Automated logic checks or HTTP status checks do not establish
perceived sound quality or complete real-time journey playback.
[TESTING.md](TESTING.md) records historical checks and their limitations;
[AGENTS.md](AGENTS.md) provides current development rules.

### Route data maintenance

Import commands below rebuild from checked-in source snapshots. Fetch scripts
in `scripts/` are explicit network maintenance tools. Review new geometry and
station evidence before rebuilding; source validators reject invented gaps,
wrong-way segments, unsupported stops and unintended reversals.

| Dataset | Offline import | Source verification |
| --- | --- | --- |
| Pakistan Rail | `npm run rail:import` | `npm run rail:verify` |
| KCR targeted update | `npm run rail:kcr:import` | `npm run rail:verify` |
| Orange Line | `npm run metro:import` | `npm run metro:verify` |
| Lahore Metrobus | `npm run metrobus:import` | `npm run metrobus:verify` |
| Islamabad Metrobus | `npm run metrobus:islamabad:import` | `npm run metrobus:islamabad:verify` |
| Peshawar BRT | `npm run metrobus:peshawar:import` | `npm run metrobus:peshawar:verify` |
| Multan Metrobus | `npm run metrobus:multan:import` | `npm run metrobus:multan:verify` |

See each linked route document for reproducible source refresh commands and
accuracy notes. [RAIL_PHASE2.md](RAIL_PHASE2.md) records the extended rail
importer's earlier review and coverage history.

### Production

Set `NEXT_PUBLIC_MAPBOX_TOKEN` on the deployment host **before** building:

```powershell
npm ci
npm run build
npm run start
```

Normal production start listens on port **5555**. Keep Mapbox attribution
visible and preserve the audio recording’s license attribution.

## Data accuracy and scope

Roads use simplified Mapbox vector-tile geometry; missing tiles or incomplete
junction topology can leave connections unavailable. Place search provides
address/place geocoding rather than an exhaustive business directory.
Rail and transit follow sourced geometry, but some platform positions are
inferred from station centres or footprints. Rounded official corridor lengths
can differ from distances between inferred terminal stopping points.

Research dates, historical/reported service scope, omitted halts, local source
interpretations and remaining verification gaps are recorded in the route
documents. Simulation speed limits and dwell times are app settings, not
verified operating rules. OpenStreetMap-derived data is attributed to
[OpenStreetMap contributors](https://www.openstreetmap.org/copyright) under ODbL;
Mapbox map attribution remains visible in the app.
