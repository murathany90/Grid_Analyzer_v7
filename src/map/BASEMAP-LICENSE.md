# Offline Türkiye basemap

`turkey-basemap-data.ts` derives from geoBoundaries gbOpen Türkiye ADM0
(TUR-ADM0-4540299) and ADM1 (TUR-ADM1-25984515), snapshot `9469f09`.
Source provider: OpenStreetMap contributors, distributed by geoBoundaries.
The 81 province boundaries and country/coastline geometry were simplified with
Douglas–Peucker tolerance 0.007 degrees and rounded to four decimal places.
This derived geographic data is licensed under Creative Commons Attribution–ShareAlike 2.0.
No endorsement is implied. This license applies to the geographic data, not application code.

- https://www.geoboundaries.org/api/current/gbOpen/TUR/ADM0/
- https://www.geoboundaries.org/api/current/gbOpen/TUR/ADM1/
- https://github.com/wmgeolab/geoBoundaries/tree/9469f09/releaseData/gbOpen/TUR
- https://creativecommons.org/licenses/by-sa/2.0/
- https://www.openstreetmap.org/copyright

The data is bundled locally; no map server, CDN or tile requests are made at runtime.
