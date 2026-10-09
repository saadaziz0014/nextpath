# Jamalo Express (Ho Jamalo) — selected Shikarpur extension

Researched 9 October 2026. The user selected the **reported Rohri–Sukkur–Shikarpur extension** rather than only the short Sukkur–Rohri core service.

## Evidence and limits

- [Radio Pakistan, 9 June 2026](https://www.radio.gov.pk/09-06-2026/sindh-govt-pakistan-railways-to-launch-jamalo-train-between-sukkur-to-rohri-before-muharam) confirms the Sukkur–Rohri core and a successful trial.
- [ProPakistani, 26 May 2026](https://propakistani.pk/2026/05/26/new-train-service-to-launch-between-two-major-cities/) reports officials describing operation from Rohri to Shikarpur, with station stops along the way. Its introductory reference to Pano Aqil is broader than the quoted corridor; that town is not added to this simulation.
- [ARY Urdu, 3 July 2026](https://urdu.arynews.tv/train-going-from-sukkur-to-shikarpur-collides-with-car-3-7-2026/) describes Ho Jamalo travelling from Sukkur toward Shikarpur, corroborating that segment.

No official complete Jamalo timetable or numbered service pair was found. The simulator therefore displays **Local Up** and **Local Down**, without inventing Pakistan Railways numbers. The three included service stations are Shikarpur, Sukkur and Rohri. Other mapped stations on the corridor are available only in Explore tracks; they are not claimed as confirmed Jamalo calls. The train picker explicitly labels the route as a reported extension.

## Directed journeys and starting stations

- **Local Up:** Shikarpur → Sukkur → Rohri.
- **Local Down:** Rohri → Sukkur → Shikarpur.

Up/Down are simulation directions following the existing Jaffar convention on this segment. They are not claimed as a verified Jamalo timetable designation. Choose either origin or start at Sukkur, then select the direction. A service destination is unavailable as its departure terminal; use the other direction. **J** selects Jamalo's corridor in Explore tracks.

## Geometry and shared functionality

The dedicated `jamalo` corridor follows connected OSM ML-3 rails through Habib Kot and Sukkur, including the Indus railway crossing to Rohri. It reuses the existing bundled source snapshots; no new downloads, dependencies or access tokens are needed. The through approach at Habib Kot does not require the Mohenjo Daro branch reversal. The importer pins both termini to their sourced track projections, validates every train's station order, and rejects hidden reversals or invented gap bridges.

The shared simulation supplies seven coaches, diesel sound and horn, manual station braking, a 90 km/h forward cap, reverse, cruise and localStorage journey restoration. Refresh restores paused. This simulator's speed cap is not a claim about Jamalo's real operating speed.

Run `npm run rail:import`, `npm run rail:verify`, `npm test`, `npm run lint` and `npm run build` after changing the route. Jamalo tests cover direction labels, station ordering, intermediate starts, persistence, terminal eligibility and uninterrupted travel through Habib Kot.
