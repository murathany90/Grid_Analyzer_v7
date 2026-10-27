# YTBS AREA / ZONE / OWNER audit

Verified from the local YTBS network modelling guide dated 01.06.2026, printed pages 15-18. This report uses fresh native decoding of the original SAV inputs, rather than treating earlier reports as evidence. Aggregate records: `evidence/psse-v3/mapping-6875.json` and `mapping-6851.json`. Reproduce with `node --import tsx tools/psse-v3-mapping-audit.ts SOURCE.sav OUTPUT.json`.

| Source field | Meaning in these YTBS models |
| --- | --- |
| Bus AREA | Regional dispatch centre (YTM), codes 1-10 |
| Bus ZONE | Voltage class: 1=400, 2=154, 3=66, 4=33kV; 7=generator |
| Bus OWNER | Regional directorate (BM), 701-722; 723=foreign |
| Transformer O2 | Regional directorate; O1 describes transformer class |
| Generator O1/O2/O3/O4 | Organisation / energy source / basin / province |
| Branch O1-O3 | Line classification; these are not BM identifiers |

All 10 AREA dictionary names match the guide. All 23 BM names match. ZONE names match after whitespace normalisation. Dictionary order is source storage order and must not be used as an external code.

| Input | Buses | Valid source TM coordinates | Uniquely matched buses | Unmatched buses | Buses <=36kV |
| --- | ---: | ---: | ---: | ---: | ---: |
| 20261026 1600 | 6875 | 1625 | 6581 | 294 | 3382 |
| 20261014 1200 | 6851 | 1618 | 6562 | 289 | 3371 |

Both sources contain 65 coordinate-bearing substations without a matched bus. Matching uses exact unique normalised source names; neither SAV contains explicit bus ISUB references in the current native representation. No coordinates are inferred for unmatched buses.

ZONE is a classification, not the numeric nominal voltage. The first model has 2293 buses whose exact nominal kV differs from the ZONE label, and the second has 2285. These are not 2293/2285 modelling errors: ZONE4 includes diverse nominal voltages <=36kV and source ZONE1 also contains 220kV buses. Both inputs have zero disagreements under this observed class interpretation. UI voltage filters must use actual BASKV; all <=36kV levels belong to one option, including 36kV itself. ZONE7 does not imply a distinct numeric voltage.

The original map's `Bölge` filter reads `busZone()`, so it selects voltage class rather than BM. Production UI correction follows the P0 AC work; this checkpoint establishes the independently verified mapping and source dictionaries.
