# Multan Metrobus — Red Line

Open /metrobus/multan, or select **Multan** in the Metrobus city selector.
The main BZU–Chowk Kumharan corridor includes all 21 stations in both directions.
Choose any intermediate station or the originating terminal as your departure.
To leave the destination terminal, select the opposite direction.

## Driving

The red articulated bus has two sections and uses the existing Metrobus cab
and synthesized bus audio. Hold **W** for traction, **S** to brake, **O** for
platform doors, **T** to toggle Manual / Auto stops, **H** for the horn and
**Space** to pause. Automatic trips serve every remaining platform, dwell for
12 seconds and finish with the terminal doors open. Manual braking and closed
doors are required before departure in manual mode. Camera follow and map
zoom remain available. The 60 km/h cap and dwell are simulation settings.

Progress uses nextpath:metrobus-multan:v1, isolated from Lahore, Islamabad,
Peshawar, rail and Orange Line. Refresh restores the journey paused.
No new dependency or environment variable is needed beyond the existing
NEXT_PUBLIC_MAPBOX_TOKEN. The app loads a checked-in dataset while driving.

## Research — 9 October 2026

- [Punjab Masstransit Authority](https://pma.punjab.gov.pk/multan-metrobus-system)
  describes the BZU–Chowk Kumaharan Red Line, 18.5 km, 21 stations, seven
  at-grade and 14 elevated stations, and 35 articulated buses.
- [PMA route map index](https://pma.punjab.gov.pk/route-maps) links its
  [Multan map](https://pma.punjab.gov.pk/system/files/MMBSMap1.pdf).
  The PDF could not be retrieved during this implementation.
- [Safar station sequence](https://www.safar.fyi/multan/transit-lines/mlt:37)
  supplies the complete passenger-facing order in both directions, cross-checked
  against the 21 mapped OSM station locations. This is a secondary station-list
  source; the implementation does not claim a verified timetable or fare.

BZU → Bahadarpur → Mehmood Kot → Northern Bypass → Shalimar Colony → Sabzazar
→ Chungi No. 6 → Gulgasht → Chungi No. 9 → Qasim Fort → Daulat Gate
→ Hafiz Jamal → Manzoorabad → Ahmadabad → BCG Chowk → Peoples Colony
→ Vehari Chowk → General Bus Stand → Jinnah Park → Shah Rukn-e-Alam
→ Chowk Kumharan. Reverse this order towards BZU. Feeder routes are not included.

## Source geometry and accuracy

The source snapshot data/bus/multan-metrobus.osm.json preserves original OSM
objects, versions, retrieval URLs and a timestamp. Relation 10995086 covers only
part of one direction. Four public OSM map extracts supply the complete dedicated
corridor and all 21 station nodes; no complete route relation is fabricated.

lib/bus/multanSource.ts restricts the importer to 16 reviewed corridor ways
with bus=designated. Most use the legacy highway=bus_guideway tag. Way
1203515975 has no highway tag; its exact ID, original endpoint nodes, bridge=yes,
access=no and bus designation guard this narrow interpretation. Existing one-way
tags are preserved. Shared geometry with oneway=no or an absent one-way tag
remains bidirectional as mapped; this is not a surveyed lane model.

All station nodes are centre locations rather than exact directional stop
positions. The builder projects them onto existing busway segments within
35 metres, inserts only subedges of those segments, and searches the complete
ordered itinerary without U-turns or invented gap connections. Stable source
IDs and exact source-name checks guard station aliases, including Qasim Bagh
for Qasim Fort and the mapped Shah Jamal label at the Hafiz Jamal call.
Station stopping positions should therefore be understood as approximations.

The generated stopping-point journeys measure about 18.12 km in either
 direction, compared with the official rounded 18.5 km project corridor.
They end at the inferred terminal platforms and exclude depot/turnaround
approaches. Source tunnel tags are retained, although the station-to-station
journeys stop before the eastern terminal turnaround tunnel.

## Maintenance and checks

```powershell
npx tsx scripts/fetch-multan-metrobus.ts # explicit network source refresh
npm run metrobus:multan:import         # deterministic offline route build
npm run metrobus:multan:verify         # station order and directed geometry
npm test
npm run typecheck
npm run lint
npm run build
```

A refresh validates source stations and connectivity before replacing the usable
snapshot. Review geometry/name changes rather than weakening the guards.
Source validation proves every generated edge follows an original directed
busway segment; it rejects reversed ramps, ordinary roads and shortcuts.
Tests cover every eligible departure, both full automatic journeys, variable
frame times, late auto engagement, manual boarding, terminal arrivals, door
interlocks, brake priority, refresh saves and cross-city isolation.

Data attribution: © OpenStreetMap contributors,
[ODbL 1.0](https://www.openstreetmap.org/copyright).
