# Grid Analyzer v7.0.1

Grid Analyzer reads PowerFactory DGS JSON locally in the browser. It builds a
network model for inventory, map, scenario and electrical-analysis views. The
results are calculations from the supplied model; they are not measurements.

## Get started

You need Node.js 22.12+ and npm for development or to build the portable page.

```powershell
npm ci
npm run dev
```

Open the local address printed by Vite. In the Model view, choose a DGS 7.x
JSON file. From there you can inspect the inventory and operating inputs, open
the map, apply temporary scenario changes, view the single-line diagram (SLD),
and run **Tam AC** (Full AC) from the Analysis view.

To make the portable single-file page:

```powershell
npm run build:portable
```

The committed [portable HTML](dist-portable/GridAnalyzer_v7.html) can also be downloaded with **Download raw file** from GitHub. Then double-click `dist-portable/GridAnalyzer_v7.html` to open it in a modern
Chromium-based browser. `npm run build` creates the regular web build in `dist/`,
and `npm run preview` serves that build locally. The bundled page was tested over static HTTP. Direct `file://` testing was blocked by the automation browser protocol policy and remains a manual check.

## Tests and checks

```powershell
npm run typecheck
npm run lint
npm test
npm run build
npm run build:portable
```

The small deterministic DGS model in `tests/fixtures/small-dgs.json` is used by
unit and regression tests. Full-model checks are optional and run with:

```powershell
npm run test:full
# Bounded stabilization acceptance (12:00 base + H2525 only):
node --import tsx tools/stabilization-acceptance.ts
```

Place locally authorized model JSON files in `control1/`. They are ignored and
must not be committed; lint/CI rejects tracked model JSON. v7.0.1 removes both
reference snapshots from the current repository tree while preserving local
copies. Historical Git/LFS objects may remain; no history was rewritten.

All views share five voltage filter groups: ≥300 → 400 kV; ≥180 → 220 kV;
≥100 → 154 kV; >36 → 66 kV; positive ≤36 → ≤36 kV. Actual source nominal
values remain unchanged. Inventory and operating data share engineering labels,
parent context and raw CSV export. SLD offers a paged station overview,
source-connected feeder detail and regional links, with pan/zoom and SVG export.

## Scope and validation

The current engines are browser JavaScript: Full AC uses the network-wide
Newton-Raphson path, while Fast AC and DC keep their reduced-network scope.
`CanonicalNetwork` is the platform-independent model. Scenario changes are
temporary overlays, and `ResultStore` keeps base/scenario results separately
for each analysis type; it accepts a result only when its model hash, scenario
signature, analysis type, engine name/version and options hash are current.
PowerFactory reference results are not available in the current baseline, and
the inspected v6.8 baseline only maps station-controller data; it does not
implement the controller outer loop. An outer loop was not implemented in v6.8 and is not added in v7. The
project does not claim numerical equivalence with PowerFactory.

The [v6.8 feature inventory](docs/v6.8-feature-inventory.md) records observed
source behavior. The [v6.8 to v7 regression checklist](docs/v6.8-to-v7-regression.md)
tracks acceptance work and keeps unverified items pending. The
[full-model validation report](docs/validation/full-model-results.json) and
[v6.8 browser baseline](docs/validation/v6.8-browser-baseline.json) contain the
measurements gathered so far. The [DGS source profile](docs/dgs-source-profile.md)
lists the inspected reference file's schemas and row counts.

Future architecture notes describe the planned [SLD editor](docs/sld-editor-architecture.md),
[Rust/WASM engine](docs/rust-wasm-roadmap.md), [Tauri desktop shell](docs/tauri-roadmap.md),
[short-circuit analysis](docs/short-circuit-architecture.md), and
[N-1 contingency screening](docs/contingency-architecture.md). These are
roadmaps, not implemented capabilities.

See [architecture](docs/architecture.md), [checkpoints](docs/checkpoints.md), and the [final migration report](docs/final-report.md) for boundaries, measured outcomes and remaining validation limits.

The [v7.0.1 stabilization report](docs/v7.0.1-stabilization.md) supersedes the
migration report's model-distribution and UI acceptance notes.
