# Tezgam Express route research

Researched 9 October 2026. The simulation adds 7 Up (Karachi Cantonment to Rawalpindi) and 8 Down (Rawalpindi to Karachi Cantonment). Both follow ML-1 through Shujabad and Multan, Khanewal, Sahiwal, Lahore, Gujranwala, Wazirabad and Jhelum. They do not use the Jahanian chord. No physical locomotive reversal is modeled on this corridor.

Published stopping profiles:
- [TrainTracking 7 Up](https://traintracking.pk/trains/tezgam-7up): 29 stops, including both endpoints.
- [TrainTracking 8 Down](https://traintracking.pk/trains/tezgam-8dn): 31 stops, including both endpoints; additionally Landhi and Drigh Road near Karachi.
- [Pakistan Railways map](https://pakrail.gov.pk/Map.aspx/index.aspx) identifies Tezgam, but the accessible response did not provide a complete current stop list. These simulation profiles are from an independent directory, not a verified official current timetable. Other directories show differing older counts; no arrival/departure times are promised by this simulator.

Geometry is generated from the existing attributed OSM source graph with one ordered itinerary and precise terminal projections. The importer checks every service's mapped station uniqueness and order before replacing the browser dataset. Starting-station selection, manual braking, 90 km/h forward limit, 20 km/h backing, diesel audio and H horn reuse the existing train controls. Explore tracks also exposes Tezgam with T.

Starting at Lahore: select Tezgam, choose Lahore Junction in Starting station, then select 7 Up for Rawalpindi or 8 Down for Karachi Cantonment. The selector uses scheduled stations from both directions, and disables services that do not call at the chosen stop or terminate there. The starting station can still be changed after service selection until the first movement; Reset unlocks it again. This flow is shared by all train profiles.
