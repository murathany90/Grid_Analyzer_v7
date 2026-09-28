# Grid Analyzer v7.2.0

Grid Analyzer imports PowerFactory DGS JSON or ZIP in the browser, builds a canonical network, and presents inventory, scenario, map, single-line diagram, and electrical analysis. Calculated values are model results, not measurements. The ZIP reader and offline Türkiye basemap are bundled; no server or runtime CDN is required.

## Run and build

Node.js 22.12+ and npm are required for development.

```powershell
npm ci
npm run dev
npm run typecheck
npm run lint
npm test
npm run test:e2e
npm run build
npm run build:portable
```

`dist-portable/GridAnalyzer_v7.html` is the single-file portable build. The app also runs from the regular Vite build in `dist/`.

Open **Model** to select a DGS JSON or a ZIP containing one or more JSON files. When several JSON entries are present, the app asks which one to load. Run **Tam AC · Full Newton–Raphson** from **Analizler**. Baz and Senaryo are explicit calculation roles; the result selector changes display only. CSV and four-sheet XLSX result exports are available in Analizler. The map provides P, Q, V, angle θ, loading, nominal-voltage, and scenario-difference views with configurable display scales.

Full AC solves separately referenced electrical islands and reports unsupplied islands. The existing NR equations, line search, and Q-limit handling remain in place. A bounded outer loop now controls remote voltage for a narrow `ElmStactrl` subset: zero droop, resolved remote bus, referenced island, complete unit Q limits, and one electrical actuator bus without conflicting PV ownership. It derives ΔV/ΔQ from the converged NR Jacobian, checks Q limits, and reports per-controller outcomes; unresolved numerical sensitivity is labeled separately from exhausted Q headroom. Other controllers retain the previous numerical behavior. The inspected 20260928 source does not establish the numeric `i_ctrl`/`imode` meanings, droop formula, or reactive sharing priority; multi-bus unit distribution stays unsupported. The inspected `TypTr2` table has no trustworthy phase-displacement field; transformers retain phase 0 with `PHASE_SHIFT_SOURCE_UNAVAILABLE` provenance. These are fidelity limits, not claims of PowerFactory equivalence.

Reference JSON/CSV can be loaded in Analizler for a partial comparison. The local YTBS workbook benchmark is an opt-in developer check:

```powershell
node --import tsx tools/ytbs-benchmark.ts --baseline-only
node --max-old-space-size=4096 --import tsx tools/ytbs-benchmark.ts --output=docs/validation/20260928-v72-benchmark.json
```

The full command expects the ignored 20260928 ZIP and XLSX under `kontrol1/` and writes only aggregate metrics to the selected output. The original v7.1 baseline in `docs/validation/20260928-benchmark.json` is retained. Local model JSON/ZIP and the reference workbook must not be committed. The workbook's historical baseline was produced at a different commit and is labeled as such in the report.

Further fidelity work requires source validation in this order: (A) droop using `pQmeas`, `Srated`, `ddroop`, and `iQorient`; (B) `imode` reactive sharing; (C) `iPbalancing` active-power balancing; (D) tap/model validation; (E) transformer phase and vector group. No enum behavior is inferred from its numeric value alone.

The [source audit](docs/validation/20260928-source-audit.md) records the observed controller, transformer, external-grid, and ComLdf fields. The [architecture](docs/architecture.md) and [v7.0.1 stabilization report](docs/v7.0.1-stabilization.md) provide earlier context. Short circuit, N−1, OPF, Rust/WASM, and Tauri are outside this release.
