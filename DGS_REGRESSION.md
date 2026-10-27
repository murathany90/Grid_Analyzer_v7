# DGS regression scope

The DGS node-breaker engine, model, map and SLD source files are unchanged from initial6c9e67b. Changes are isolated to PSS/E domain/analysis/features and artifact output; existing DGS symbols and projection are imported without modification.

Initial baseline:860/860 unit/regression tests passed. V3 adds meaningful physical/control/view tests. Final suite:870/870 passed, zero failed/skipped. Real Chrome and Edge offline AC/map/TM checks and synthetic DGS JSON/ZIP, RAWX/mixedZIP, NR/FDNS/DC and export checks pass; see `evidence/psse-v3/validation.json`. The portable byte provenance gate is evaluated after committing the rebuilt portable bundle, since it intentionally compares with HEAD.

Full DGS/PSS/E1600x1000 visual comparison is still pending. Passing existing DGS tests does not claim visual equivalence of the PSS/E views.
