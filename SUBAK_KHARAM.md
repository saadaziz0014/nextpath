# Subak Kharam (Railcar)

Researched 8 October 2026. The simulation uses published stopping profiles; current operations and the official timetable remain unverified.

- 103 Up: Lahore Junction, Gujranwala, Wazirabad, Gujrat, Lala Musa, Jhelum, Chaklala, Rawalpindi (8 stations).
- 104 Down: Rawalpindi, Chaklala, Gujar Khan, Jhelum, Lala Musa, Gujrat, Wazirabad, Gujranwala, Lahore Junction (9 stations).

The selected Down profile includes Gujar Khan while Up omits it. Definitions are separate so the simulator does not assume identical stopping patterns. Subak Kharam is distinct from Subak Raftar (101/102), which is not added by this change. The Railcar label identifies the requested service; this phase uses the existing generic train marker and physics.

Sources:
- https://trains.metro-status.com/timetable/subak-kharam/
- https://traintracking.pk/trains/subak-kharam-104dn

The route uses the existing connected OpenStreetMap Lahore–Rawalpindi main line through Gujranwala, Wazirabad and Jhelum. It ends at a precise sourced track projection at Rawalpindi. There are no artificial gap joins, Margalla detours or declared station reversals. Gujranwala uses the existing explicit station ID mapping to avoid ambiguous nearby features.

On `/rail`, choose Subak Kharam (Railcar), then 103 Up or 104 Down. Scheduled intermediate starting stations are selectable before movement. W accelerates, S brakes and Space pauses; manual station stops and the existing 90 km/h maximum remain. Reset unlocks departure selection. Explore tracks uses key K.

Reproduce validation with `npm run rail:import`, `npm run rail:verify`, `npm test`, `npm run lint` and `npm run build`. No timetable, dwell-time or fare automation is included.

Validation: 40 tests passed; all generated segments are source-backed; lint, production build and HTTP smoke checks passed. Browser interaction testing remains unverified because of the unresolved runtime sandbox initialization issue.
