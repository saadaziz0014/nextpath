# Mohenjo Daro Express (Passenger)

Researched 9 October 2026. Implemented the published historical Kotri–Rohri 213 Up and Rohri–Kotri 214 Down profiles, each with 24 scheduled stops. The route follows the western Sindh corridor through Sindh University, Petaro, Sehwan Sharif, Dadu, Radhan, Mohenjo Daro, Larkana and Habib Kot, then Sukkur and Rohri. It does not take the Hyderabad/Nawabshah main line or detour through Jacobabad.

Sources:
- [APP restoration report](https://www.app.com.pk/domestic/moen-jo-daro-express-restored/) confirms the Kotri–Rohri endpoints and 213/214 numbers.
- [Published Up profile](https://trains.metro-status.com/timetable/mohinjo-daro-passenger/) supplies 24 stops.
- [Published Down profile](https://railwaystations.pk/search-by-train/214dn-mohinjo-daro-passenger/) gives the reverse stopping pattern.
- [APP October 2024 timetable announcement](https://www.app.com.pk/domestic/trains-winter-timetable-to-become-effective-from-oct-15/) reports a subsequent Karachi City extension. Its full stopping profile is not represented here.
- [Dawn suspension report](https://www.dawn.com/news/2021144) reports closure/suspension in 2026. This is a historical simulation, not a claim of current service availability or timetable accuracy.

Existing attributed OSM sources cover this corridor. No invented waypoints or gap repair are used. OSM names Petaro, Bhan Syedabad and Mohenjo-daro are explicitly matched to the published names. Cadet College Petaro is represented by the Petaro station node; its present operating status is unverified.

The sourced station approaches join south of Habib Kot's platform. Its visit is modeled as two connected track legs with a declared station reversal, requiring manual braking to zero and R confirmation in both directions. This is a geometry-based simulation choice. Starting after that boundary marks the earlier reversal complete, as on other routes.

Choose Mohenjo Daro Express in Train journeys and select Up or Down. Intermediate starts (including Dadu and Larkana), seven coaches, diesel audio, cruise, backing and local save reuse existing controls. M selects the corridor in Explore tracks. The user-requested seven-coach UI is retained rather than representing historical consist counts.
