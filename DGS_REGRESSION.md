# DGS regression scope

## V5 final acceptance — 2026-10-28

- DGS map, SLD, shared power-flow and native PSS/E importer sources are unchanged from `c06446764b9cc49863b9b26ba1454607fd362377`. The new electrical equations are isolated under `src/analysis/psse`; engine identity invalidates stale PSS/E results.
- Full unit/regression gate: **904/904 PASS**, zero skips. Earlier integration failures (pure finding helper importing CSS, documentation files not yet tracked and pre-commit portable byte provenance) were corrected and are recorded; the completed post-commit full run passes. TypeScript and architecture lint pass.
- Real installed Chrome and Edge `file://` checks pass on final HTML `f2251cd05ed55260365632a5030266f99c7607d64b10077a74d32ad01424fcc0`: real DGS ZIP import, map display, both viewport sizes; PSS/E SAV, independent NR, flows, scenario/delta/undo, SLD, 3-winding source grouping and numeric exports, zoom/DPR/fullscreen, zero external requests/errors.
- Additional original synthetic offline Chrome/Edge smoke passes NR, FDNS and DC; DGS JSON/ZIP and PSS/E/mixed ZIP import, opaque sidecar byte preservation, readable results, CSV/JSON provenance, result-option invalidation and missing DC quantities are checked. Historical tab selectors were adapted to the new shared result table controls; product DGS components were not changed.
- The prior nine-command DGS desktop regression remains historical evidence from V4; it was not rerun redundantly. Current automated unit coverage plus actual offline DGS import/map checks are reported above. This does not imply complete electrical PSS/E reference parity; see [V5 AC limitations](PSSE_FULL_AC_REFERENCE_PARITY.md).

The DGS node-breaker engine, model, map and SLD source files are unchanged from initial6c9e67b. Changes are isolated to PSS/E domain/analysis/features and artifact output; existing DGS symbols and projection are imported without modification.

Initial baseline:860/860 unit/regression tests passed. V3 adds meaningful physical/control/view tests. Final suite:870/870 passed, zero failed/skipped. Real Chrome and Edge offline AC/map/TM checks and synthetic DGS JSON/ZIP, RAWX/mixedZIP, NR/FDNS/DC and export checks pass; see `evidence/psse-v3/validation.json`. The portable byte provenance gate is evaluated after committing the rebuilt portable bundle, since it intentionally compares with HEAD.

Full DGS/PSS/E1600x1000 visual comparison is still pending. Passing existing DGS tests does not claim visual equivalence of the PSS/E views.
