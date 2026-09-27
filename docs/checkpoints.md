# Migration checkpoints

All times are observations from this session; agent token counts are unavailable.

| Checkpoint | Concrete result | Evidence |
|---|---|---|
| Baseline preservation | Original v6.8 HTML copied unchanged into `legacy/`; the two actual 2026-09-23 snapshots copied from `kontrol1/` into `control1/` and uploaded through Git LFS. | Base commit `4fa11d8`; `docs/dgs-source-profile.md` |
| Source inventory | Reachable views, version patch chains, active solvers, source immutability requirements and confirmed legacy issues recorded before replacement. | `docs/v6.8-feature-inventory.md`, `docs/module-dependency-map.md` |
| Domain foundation | Typed canonical model, overlays, six-part calculation identity, result store, settings/persistence and topology boundary. | Commit `77c3291` |
| Numerical migration | Split Full NR and reduced Fast AC/DC kernels; seven legacy self-cases; explicit final-Q-limit failure; source-to-canonical and old/new solver audit. | `tests/unit/numerical.test.ts`, `docs/validation/numerical-parity.json` |
| Worker/UI integration | Separate raw-import and calculation workers; paged catalogs; native TypeScript views; cached Canvas geometry; SVG SLD; portable Vite packaging. | `src/`, final build checks |
| Browser regression | Source baseline ran in browser; v7 small model ran base/scenario AC, delta, virtual energization/reset, voltage scope and paged electrical tables. A new source-worker lifetime defect was found through the SLD path and fixed. | `docs/validation/browser-validation.json` |
| Large models | Real 143 MB source snapshots exercised by fixture discovery; results and non-convergence states recorded without inventing PowerFactory reference values. | `docs/validation/full-model-results.json` |

The requested 2026-09-25 names were not present locally. Tests use the actual
2026-09-23 snapshots and report their names and sizes; they are not relabelled.
No historical performance values were inferred from current runs. Browser heap
measurements are `NOT_AVAILABLE`; Node heap figures identify their own source.

Agent allocation: one parent integrated architecture, topology, worker lifecycle,
scenario/result ownership and browser verification. Three explicitly requested
Luna/xhigh agents handled (1) feature inventory and bounded UI extraction,
(2) numerical extraction/parity and capacity preservation, and (3) DGS import,
regression/CI scaffolding and roadmap documentation. Work was kept in shared
files with explicit ownership; the parent performed integration checks.

`TOKEN_USAGE = NOT_EXPOSED_BY_RUNTIME` for every agent. The first recorded agent
inspection window was 14:42:55–15:11:24 UTC (28m 29s); later follow-ups are recorded
in the final report without presenting estimated totals as exact runtime usage.
