# Baba Farid (Fareed) Express — route research

Researched 2026-10-08. This is a simulation stop profile, not a certified current timetable.

## Route and stop profiles

**37 Up:** Karachi City → Karachi Cantt → Rohri → Bahawalpur → Lodhran → Mailsi → Vehari → Mandi Burewala → Arifwala → Pakpattan → Kasur → Raiwind → Lahore Junction.

**38 Down:** the reverse corridor. Published Up lists contain 45 stations including termini; Down lists contain 46, with Walton additionally listed after Lahore. The catalogue models the profiles separately. Karachi City is the actual endpoint; Karachi Cantt is an intermediate stop.

Sources:
- [37 Up stop profile](https://tracktrain.pk/trains/fareed-express-37up)
- [38 Down stop profile](https://tracktrain.pk/trains/fareed-express-38dn)
- [Independent Up cross-check](https://railwaystations.pk/search-by-train/37up-fareed-express/)
- [Independent Down cross-check](https://railwaystations.pk/search-by-train/38dn-fareed-express/)
- [Historical railway route description](https://irfca.org/docs/pak-train-names.html)
- [Historical footage of 38 Down changing locomotive direction at Kasur](https://www.youtube.com/watch?v=ISPgs427ZyY), filmed 7 August 2021. This corroborates the reversal found in the sourced rail topology; it does not verify current operating procedures.

Names vary across sources (Fareed/Farid, Vehari/Vihari, Pak Pattan/Pakpattan). The picker uses **Baba Farid (Fareed) Express** so the requested name and published service name are both recognizable. Station aliases resolve spelling differences to sourced objects. Times are omitted because this app simulates manual driving rather than real-time dispatch.

## Track geometry and Kasur reversal

The route uses sourced OSM railway segments throughout, including newly downloaded Karachi City and Pakpattan–Kasur corridor coverage. Refresh with `node scripts/fetch-fareed.mjs`, then `npm run rail:import` and `npm run rail:verify`. The generated journey measures approximately **1,253.25 km**, a geometry measurement rather than official railway mileage.

Kasur is not a through movement toward Raiwind: the route must change direction there. The importer solves each side of this reversal separately and joins them at the **same OSM graph node**, preserving real track continuity. It records one station reversal with its chainage and station ID. Other sharp reversals/retracing remain rejected within each leg; every output edge is still checked against source geometry. Reversing the journey transforms the reversal chainage as well as the station ordering.

The simulator uses Kasur as a hard boundary. **Brake manually on approach, stop at the boundary, then press R or Continue after reversal.** Continued W input cannot move beyond it before confirmation. If the boundary is reached with speed remaining, the safety boundary stops the simulation there; it never reverses a moving train automatically. R only works when stationary at the boundary, clears held traction, and unlocks the next leg. Regular station stops remain manual. Selecting Kasur as the starting station starts facing the service's departure direction and needs no arrival reversal. Reset restores the same departure and resets reversal confirmations.

## User controls

In Rail mode select Baba Farid (Fareed) Express, then **1 / 37 Up** or **2 / 38 Down**. Starting-station selection works for each service. W accelerates, S brakes, Space pauses, max speed 90 km/h. Explore tracks exposes the full corridor as track 8. Port 5555 and the favicon are retained.

## Validation

Regression coverage checks branch order, both termini, Walton asymmetry, reverse chainages, declaration of the Kasur reversal, rejection of undeclared reversals, and stationary-only confirmation. The source verifier checks all existing train corridors as well as Fareed. OSM data: © OpenStreetMap contributors, ODbL 1.0.
