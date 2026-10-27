# Source geography and viewport fit audit

Fresh native audits:6875/6851 source buses;1625/1618 valid source TM coordinates;6581/6562 uniquely name-matched buses;294/289 unmatched buses. Both cases have65 unreferenced coordinate-bearing stations. Unmatched bus coordinates are never generated. Aggregate source dictionary/geography records are in `evidence/psse-v3/mapping-6875.json` and `mapping-6851.json`.

PSS/E uses the unchanged DGS WGS84 projection with longitude first, latitude second and39N standard parallel. The former SVG meet/letterbox viewport and stretched Canvas could disagree when CSS overrode aspect ratio. Both layers now share one affine transform and a stage retaining1200:690 ratio. Network fit uses only filtered, source-matched TM projected bounds; Turkey fit restores the common national viewport. Projection/fit unit checks include padding, singleton centring and invalid-coordinate rejection.

Real Chrome offline checks validate the viewport ratio and independent network-fit action. Source lines connect their two source TM points directly. Labels are suppressed at national zoom for readability. PNG export, source provenance CSV and original popup functionality are retained. Full DGS visual parity and every requested equipment/owner-class/island layer remain unfinished.
