# Peshawar BRT — Zu SR-02

## Route and use

Open `/metrobus/peshawar`, or select **Peshawar** in the Metrobus city switcher.
This first Peshawar service is the main **SR-02 stopping corridor** between
Chamkani and Karkhano Market. All 30 stations are available as starting points
in both directions. Feeder routes and express stopping patterns are outside
this implementation.

The green Zu articulated bus uses the shared bus cab and richer synthesized bus
sound, rather than rail vehicles or rail audio. W accelerates, S brakes, O opens
or closes doors at a stopped platform, T toggles automatic driving/stops, H
sounds the horn, and Space pauses. Automatic trips dwell for the app's 12-second
setting and finish with doors open. The 60 km/h limit and dwell are simulation
settings, not an official timetable. Refresh restores the selected journey
paused, using `nextpath:metrobus-peshawar:v1`, separate from other cities.

## Research (9 October 2026)

- [TransPeshawar overview](https://transpeshawar.pk/about-transpeshawar/transpeshawar-overview/)
  describes the Chamkani–Karkhano corridor, 30 BRT stations and diesel/hybrid
  vehicles, including 18-metre articulated buses.
- [Operator schedule](https://transpeshawar.pk/passenger-services/operation-schedule/)
  supplies the SR-02 station sequence in both directions.
- [Peshawar Development Authority](https://www.pda.kp.gov.pk/public/brtpeshawar)
  describes the corridor's 30 stations and hybrid fleet.

Included stations, from Chamkani westward: Chamkani, Sardar Garhi, Chughal Pura,
Faisal Colony, Old Haji Camp, Lahore Adda, Gulbahar Chowk, Hashtnagri, Malik Saad
Shaheed, Khyber Bazar, Shoba Bazar, Dabgari Gardens, Railway Station, FC Chowk,
Saddar Bazar, Mall Road, Tehkal Payyan, Tehkal Bala, Abdara Road, University Town,
University of Peshawar, Islamia College, Board Bazar, Mall of Hayatabad,
Bab-e-Peshawar, Hayatabad Phase 3, Tatara Park, PDA, Hospital Chowk,
Karkhano Market.

## Source geometry and corrections

`data/bus/peshawar-brt.osm.json` retains original OSM objects, versions, retrieval
URLs and a retrieval timestamp. The SR-08 relation (20012008) provides the
shared central corridor. Two map extracts supply the outer SR-02 sections.
This does not relabel SR-08 as SR-02 or fabricate a route relation.

Twenty stations have separate platform nodes for each direction. Ten outer
stations have mapped building/platform footprints. Their stopping points are
inferred by projecting footprint centres onto connected busway edges, within
35 metres, rather than claiming exact surveyed platforms. Stable station
source IDs and a full ordered graph search choose the proper directional path.

The bus follows about 26.60 km westbound / 26.71 km eastbound, measured between
mapped stopping points. These lengths differ from rounded project corridor
lengths, which can include approaches and terminal facilities.

Source tags require three explicitly scoped interpretations:

- Ref 17 is unused in the mapped station numbering. Canonical IDs `zu-1` to
  `zu-30` follow the operator's 30-stop sequence.
- Abdara Road's two platform nodes (13410825898/13410825899) have a copied
  English Tehkal label. Their Urdu names and station ref 20 identify Abdara.
- Dedicated segment 906392649 uses the older `highway=bus_guideway` tag, with
  `bus=designated`, `name:en=TransPeshawar BRT` and `oneway=yes`. Include its
  original geometry and direction; do not make it bidirectional.

`lib/bus/peshawarImport.ts` searches all stations in order on connected sourced
busways. Projected stops split original edges without creating gap joins.
`verifyBusSource` checks projected subedges against one original directed
segment and rejects wrong-way travel, corner shortcuts or retracing. Tunnel
sections retain source tags; tunnel bus markers follow the existing visibility
behavior. No live timetables, signals or passenger-demand simulation are added.

## Maintenance

```powershell
node scripts/fetch-peshawar-brt.mjs # explicit source refresh; requires network
npm run metrobus:peshawar:import   # offline deterministic build
npm run metrobus:peshawar:verify   # station order and source geometry
npm test
npm run typecheck
npm run lint
npm run build
```

The app loads the checked-in browser dataset and never requests OSM/Overpass
while driving. No new dependency or environment variable is needed beyond the
existing Mapbox token. Data attribution: © OpenStreetMap contributors,
[ODbL 1.0](https://www.openstreetmap.org/copyright).

Tests cover all eligible starts, both complete automatic trips, every station
arrival, manual braking/door interlocks, refresh saves, source-tag corrections,
missing-data rejection and the existing Lahore/Islamabad behavior.
