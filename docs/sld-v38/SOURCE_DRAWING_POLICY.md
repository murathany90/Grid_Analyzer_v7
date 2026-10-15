# V3.8 — source-evidenced SLD switch visibility

Continues `c125d45` on `codex/sld-three-reference-layout`. This change only adds source evidence and drawing projections. Raw DGS, canonical endpoints, physical switch IDs/states, scenario hashes and numerical engines are unchanged.

## Policy

`DRAW_VERIFIED_PATH` preserves raw/canonical/projected FIDs, cubicle ownership and source state. Open devices, parallel selectors, bypasses and couplers remain structurally present. Equipment-free native feeder outlets require a real bar path and breaker; names and coordinates are never attachment evidence.

`HIDE_NONFUNCTIONAL_SOURCE_LEAF` removes an independently evidenced dead-end branch from drawing geometry. Intermediate terminals can continue the same branch: it is peeled back only as far as the first equipment, real bar or verified feeder outlet. Raw incident edges and every cubicle owner must agree at each removed node. The SVG contains no hidden device, contact, wire, terminal point or replacement icon. Sources and the original graph remain intact. The SLD source audit list retains FIDs, both native ends, classification and reason.

`REVIEW_UNRESOLVED` retains the device. Missing/contradictory source identities, unknown usage/state, unknown cubicle equipment ownership and multiple unordered cubicle devices cannot authorize hiding or batch operation. A single proven `StaSwitch` attaches to its equipment lead even when canonical `from===to`; an unordered group never receives an invented order. Proven cubicle devices can participate in the feeder command plan. Hidden leaves cannot.

## SN3 evidence

The existing V3.7 raw cache is reused: inner JSON SHA-256 `f58d958269fd31a95da0203dd0db50db589bac3faec36690bf059e7293943ce6`. No new load flow is required to establish structural identity.

- 1,554 stations / 95,665 source switches: 91,760 drawn, 3,905 hidden, zero ambiguous switch decisions in this snapshot.
- All 50 previously reported leaves classify as hidden. This is a subset of the model-wide inventory, not a target count.
- Kayaş `T5133.bushv → ft00-13064 → B89867` stays fixed. `C112442: B89867/B102871`, `C113230: B89867/B102869`, `C112617: B89868/B102874`, `C113231: B89868/B102872` have no downstream equipment/cubicle continuation and are hidden. No winding is moved.
- Full-model independent branch oracle checks raw endpoints, cubicle owners and hidden components. No hidden component may bridge two retained functional boundaries. Input signatures for switches, terminals and equipment must equal V3.7 for every station.
- Thirteen stations / 26 real normal-LF SVGs include independent visible-glyph winding contacts, actual switch omission sets, source contour continuity, open gaps, foreign-net touches and overlap checks. Five transformer-bank HV/LV closeups cover Kayaş, Temelli, İç Anadolu DGKÇ, Küçükbakkalköy and Kayabaşı.
- Source SN3 contains **zero StaSwitch rows**; cubicle semantics are validated by explicit synthetic raw fixtures and real browser SVG tests, not claimed as field evidence.

## PARTIAL and review limits

The previous **60 unresolved feeder-terminal issues in 31 stations remain** and are separately listed; these sheets report PARTIAL. A successful render/inventory check is not an electrical engineering acceptance. The 65 sites without source terminals retain the explicit missing-data view. Dense crossing regions and reference styling still require visual acceptance. No main merge is authorized.

## Reproduction and validation

`tools/sld-v38-audit.mjs` classifies cached source graphs; `sld-v38-browser.mjs` scans actual Chromium SVGs without relaxing source inventory assertions. Any source/visible inventory difference must match the independently verified hidden FID set. `sld-v38-evidence.mjs` writes source signatures, per-FID CSVs and independent SVG proofs; `sld-v38-gallery.mjs` creates the offline comparison gallery.

The existing 597 tests are retained; 13 new policy/oracle tests and browser acceptance cover immutable analysis inputs, hidden-remnant rejection, real series devices, open/parallel paths, cubicle attachment, ambiguous mappings and multi-device dead-end branches. Final validation additionally requires typecheck, lint, all four E2E suites, portable raw-byte equality and GitHub exact-commit CI. Do not bypass the portable test: it rebuilds and compares with HEAD, so the rebuilt artifact must first be committed.

The positive branched-series regression fixture now explicitly terminates both fork legs in synthetic load equipment/cubicles. Its original all-device inventory and geometry assertions remain unchanged. Separate negative fixtures represent truly unowned dead-end branches and require their complete omission. Production source records are never edited to make a fixture pass.
