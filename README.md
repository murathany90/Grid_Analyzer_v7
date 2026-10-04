# Grid Analyzer

Grid Analyzer imports PowerFactory DGS JSON or ZIP files in the browser, builds a canonical
network, and presents inventory, scenario, map, single-line diagram, electrical analysis and a
PowerFactory comparison. **Calculated values are model results, not measurements.** The ZIP
reader and the offline Türkiye basemap are bundled; no server or runtime CDN is required.

- Version: **8.2.5**
- Engine: `BrowserJsEngine` (classical Newton–Raphson power equations, sparse direct KLU/WASM)
- Release manifest: [`docs/validation/v8.2.5-release.json`](docs/validation/v8.2.5-release.json)

## 8.2.5 release status

The numerical solver baseline is the validated v8.2.3 source. Version 8.2.5 finalizes
diagnostics, release provenance and packaging without carrying over the rejected numerical
changes. The v8.2.4 numerical candidate regressed all six KPIs and was **REJECTED / NEVER
MERGED**. Rejected commits: `a9ff9145838dcc85b34e2c27848f33163ab55146`,
`f25053f9e36c6e9d160701b604a10e0b36ab5d2f`; rejection record:
`ed31ecb670c0741dc365bceb556ab7551cc288de`.

The parity profile remains **PARTIAL**. Zero-droop station control is
`STATION_CONTROL_PARTIAL` with 101 `CONTROL_RESIDUAL_AFTER_FINAL_BALANCE` controllers;
223 droop controllers remain `UNSUPPORTED_DROOP`. These states are reported in the
diagnostics and release manifest. Active balancing converges and SL1 remains Qmin-limited.


## Supported inputs

| Input | Purpose |
| --- | --- |
| DGS `.json` / `.zip` | Network model (buses, lines, 2-winding transformers, generators, loads, shunts, series compensation, external grids, station controllers, switches) |
| PowerFactory numeric `.csv` | Load-flow reference for comparison (`PF-GA-BENCHMARK-*`) |
| PowerFactory ControlContext `.csv` | Load attributes, controller membership and source control fields (`PF-GA-CONTROL-1.0`) |

Model files and reference data stay local and are never committed (`kontrol1/` is ignored).

## Calculation engines

| Engine | Scope | Notes |
| --- | --- | --- |
| **Full AC** | All voltage levels | Newton–Raphson on power equations, PV/PQ buses, reactive limits, distributed active balancing, station controllers, KLU/WASM direct solves on large systems, separate electrical islands |
| **Fast AC** | ≥ configured `minVoltageKv` (default 66 kV) | Reduced model, approximate; Q and control fidelity reported as partial |
| **DC** | ≥ configured `minVoltageKv` (default 66 kV) | Active power and angle only; no reactive or voltage settings |

### Full AC specifics

- **Newton + KLU/WASM.** Small systems use the iterative-first path; systems with at least 512
  unknowns use the KLU sparse direct factorization. A direct solve is accepted only when its true
  residual is at least three orders of magnitude tighter than the nodal tolerance
  (`min(1e-8, nodalTolerancePu * 1e-3)`), so an accepted direction cannot carry a residual the
  nodal test would treat as progress.
- **Distributed active balancing.** With `activeBalancingMode=DISTRIBUTED_ADJUSTABLE_LOADS` the
  reference P target is met by adjusting sourced adjustable loads. Load eligibility comes from the
  source ControlContext (`i_scale`), never from a hardcoded list.
- **Q-limit handling.** Reactive limits are a monotonic PV → limited active set. Each bus that
  reaches a limit is switched to PQ at that limit. **Limit release is not implemented**
  (`releaseSupport: UNSUPPORTED`), and repeated reactive-limit detection is **not applied**
  (`repeatedReactiveLimitDetectionApplied: false`). Both limits are stated rather than hidden.
- **Station controllers.** Zero-droop remote voltage control is solved with a sensitivity /
  trust-region outer loop. Droop semantics are **not implemented**: droop controllers are reported
  `UNSUPPORTED_DROOP` rather than approximated with an unverified equation.

## Effective Full AC limits

These are typed settings. Provenance, diagnostics and the settings table all report the values
actually used — there are no hidden internal caps.

| Setting | Default | Meaning |
| --- | ---: | --- |
| `maxInnerIterations` | 100 | Newton iterations per full NR solve |
| `maxQLimitRounds` | 8 | Reactive active-set rounds |
| `maxActiveBalanceCorrections` | 8 | Distributed active-balance corrections |
| `maxStationControlCorrections` | 16 in parity profile | Station-controller outer corrections |
| `maxOuterIterations` | 50 | Outer control budget; the station loop still uses `maxStationControlCorrections` |
| `nodalToleranceKva` | 5 | Nodal P/Q residual tolerance |
| `modelEquationTolerancePercent` | 0.2 | Controller voltage-residual tolerance |
| `maxNoImprovementIterations` | 20 | Stagnation guard |
| `qLimitToleranceMvar` | 0.02 | PV → limited transition band |

The Newton line-search acceptance test uses `nodalToleranceKva` rather than a fixed `1e-6`
threshold that contradicted the configured tolerance.

## Convergence states

Convergence is reported per concern; one generic "converged" is never used.

| State | Meaning |
| --- | --- |
| `NR_CONVERGED` / `NR_NOT_CONVERGED` | Newton–Raphson only |
| `ACTIVE_BALANCE_CONVERGED` / `ACTIVE_BALANCE_PARTIAL` | Distributed P target reached or not |
| `STATION_CONTROL_CONVERGED` / `STATION_CONTROL_PARTIAL` | All supported controllers satisfied, saturated, or pending |
| `COMPARABLE` / `NOT_FULLY_COMPARABLE` | Overall PowerFactory comparability |

After the final distributed-P correction every remote voltage residual is recomputed and **all**
controller states are revalidated. A controller that satisfied its target before the correction
does not keep `SATISFIED` when the corrected operating point leaves it outside tolerance; it becomes
`SATURATED_QMIN`/`SATURATED_QMAX` at a reactive limit, or
`CONTROL_RESIDUAL_AFTER_FINAL_BALANCE` otherwise. When any such residual exists the result
provenance is downgraded from `SENSITIVITY_STATION_CONTROL` to `BASELINE_FALLBACK` and the
operating point is not presented as control-converged.

Work counters are reported separately and never as a single "step" count: Newton iterations, full
NR solves, Q-limit rounds, active-balance corrections, station-control rounds, KLU factorizations.

## PowerFactory benchmark workflow

The canonical scorer is `src/analysis/validation/pf-kpi.ts`. The final benchmark uses
the exact committed `dist-portable/GridAnalyzer_v7.html` and the three golden inputs
recorded in the [release manifest](docs/validation/v8.2.5-release.json).
The preservation gate compares every KPI with the validated v8.2.3 result. It permits at most
0.5% **relative** regression per KPI and requires source, input and portable byte provenance.

### Golden fixture facts

- Model `20261001_1500_SN4_TR0`, study time `2026-10-01 15:00:00`, PowerFactory 24.0.7.1.
- 1986 relevant loads, all with sourced `i_scale = 1`.
- 366 `ElmStactrl` controllers, 604 controller memberships, 223 droop controllers.
- `SL1` is the reference external grid. The fixture has no phase-shifting transformers.
- Automatic transformer tap and automatic shunt control are **off**.
- **FID and `electricalBusKey` are the authoritative identities.** `loc_name` is presentation only.
- No fixture-specific coefficients, FIDs or PowerFactory-result fitting are used anywhere.

### ControlContext role

The ControlContext sidecar supplies load dispatch attributes and the measured `i_scale` eligibility
that distributed active balancing needs, plus the source station-controller fields. It is applied to
the network before the solve; its SHA-256 is recorded in the release manifest.

## Canonical merge KPIs

Only equipment at **≥ 66 kV** is used. For each individual terminal or value:

```
error_i          = abs( abs(GA_i) - abs(PF_i) )
absoluteAverage  = sum(error_i) / N
normalizedPercent = 100 * sum(error_i) / sum(abs(PF_i))
```

`abs(GA - PF)`, row-wise MAPE and averages of row percentages are **not** the primary KPI.

- **Lines** — `pFrom` and `pTo` are separate observations; likewise `qFrom` and `qTo`.
- **Transformers** — qualified by HV nominal voltage ≥ 66 kV; then both HV and LV terminal P and Q
  are observations.
- **Buses** — nominal voltage ≥ 66 kV, one observation per distinct PF electrical bus.
- **Bus angle** — the existing per-island reference-angle alignment is applied first, then the KPI is
  `abs(abs(GA_aligned) - abs(PF))`. Islands without a PowerFactory reference bus fall back to the
  median offset, which is reported. Signed aligned-angle error is kept as a secondary diagnostic.

Secondary diagnostics are also exported: signed terminal P error, signed terminal Q error, signed
aligned-angle error, and sign-disagreement counts over materially non-zero values.

## Canonical 8.2.5 KPIs

The v8.2.3 numerical baseline is preserved. The final measured values and signed secondary
diagnostics are recorded in the [8.2.5 release manifest](docs/validation/v8.2.5-release.json).
Population: 2308 lines (4616 observations), 2892 transformers (5784 observations),
and 1733 voltage/angle buses.

| KPI | N | v8.2.3 normalized % | 8.2.5 normalized % |
| --- | ---: | ---: | ---: |
| Line MW | 4616 | 0.879454489 | 0.879454489 |
| Line MVAr | 4616 | 45.961722931 | 45.961722931 |
| Transformer MW | 5784 | 0.721830436 | 0.721830436 |
| Transformer MVAr | 5784 | 47.615779757 | 47.615779757 |
| Bus voltage | 1733 | 0.768447838 | 0.768447838 |
| Reference-aligned angle | 1733 | 0.825548679 | 0.825548679 |

## Performance

The release gate requires the exact committed portable in Chromium to complete Full AC in
at most **15,000 ms**. Its final engine time, browser wall time, total/final Newton counts,
NR solves and KLU factorizations are recorded in the
[8.2.5 release manifest](docs/validation/v8.2.5-release.json). The validated v8.2.3
reference took 3,710 ms engine time and 5,699 ms browser wall time; these are prior
measurements, not a substituted 8.2.5 result.

## N-1 scope and limitations

Reduced DC N-1 screening exists and is reported as `REDUCED_GE66_DC_P_ONLY` / `PARTIAL`:

- In-service lines and two-winding transformers in the reduced ≥ 66 kV network.
- Classifies islanding outages and ranks estimated **active-power** impacts.
- Runs in a worker, supports cancellation, exports summary CSV and full JSON.

It does **not** cover reactive power, voltage behaviour, or Full AC contingency verification.
`SCREENED_NO_VIOLATION` does not mean AC security is verified.

## Feature matrix

| Feature | State | Note |
| --- | --- | --- |
| DGS JSON/ZIP import | VERIFIED | Bounded ZIP reader with CRC and size checks |
| Full AC Newton–Raphson | VERIFIED | Multi-island, PV/PQ, KLU/WASM on large systems |
| Reactive limits PV → limited | VERIFIED | Monotonic active set |
| Reactive limit release | **UNSUPPORTED** | Limited buses are not returned to PV |
| Repeated reactive-limit detection | **UNSUPPORTED** | Value carried in provenance, not applied |
| Distributed active balancing | PARTIAL | P target met; Q response of adjusted loads is not claimed |
| Station control, zero droop | PARTIAL | Sensitivity/trust-region solve; residual count reported |
| Station control, droop | **UNSUPPORTED** | Reported, not approximated |
| PowerFactory parity profile | PARTIAL | Named `POWERFACTORY_TEIAS_PARITY` for stored settings only; always shown as not verified |
| Active power limits | **UNSUPPORTED** | Setting exposed and marked unsupported |
| Automatic transformer tap | **UNSUPPORTED** | Snapshot tap positions only |
| Automatic shunt control | **UNSUPPORTED** | Snapshot shunts only |
| Load voltage dependency | **UNSUPPORTED** | Constant-power loads |
| Feeder load scaling | **UNSUPPORTED** | |
| Interchange schedule | **UNSUPPORTED** | |
| Line resistance temperature correction | **UNSUPPORTED** | |
| Q-limit scaling | **UNSUPPORTED** | |
| Load / generation / motor / storage-heater scaling | **UNSUPPORTED** | Shared settings exposed and marked unsupported |
| Fast AC (reduced) | PARTIAL | Approximate Q and control |
| DC | VERIFIED for P and angle | No Q or voltage settings |
| Reduced DC N-1 | PARTIAL | `REDUCED_GE66_DC_P_ONLY` |
| Full AC contingency verification | **UNSUPPORTED** | |
| Transformer phase shift / vector group | **UNSUPPORTED** | `PHASE_SHIFT_SOURCE_UNAVAILABLE`; fixture has none |
| Short circuit, OPF, Rust/Tauri port | out of scope | |

A setting that the engine does not consume is never presented as an effective calculation setting;
it is listed as `UNSUPPORTED` in the settings dialog, in the settings comparison table and in
calculation provenance.

## Build, test and validation commands

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

`dist-portable/GridAnalyzer_v7.html` is the single-file portable build; the app also runs from the
regular Vite build in `dist/`.

Portable integrity for this release:

- Final portable SHA-256: `9db9fca8e8d41d1d1f0c20a10a5c3875cf4747406cbda51d083fe19eb0797721`
- The Chromium-tested bytes must match the committed portable byte for byte.
- Exact measured performance and source commit are recorded in the release manifest.

Earlier context: [architecture](docs/architecture.md),
[v8.2.1 Full AC performance audit](docs/full-ac-performance-v8-2-1.md),
[v8.2 PowerFactory parity notes](docs/pf-full-ac-parity-v8-2.md),
[source audit](docs/validation/20260928-source-audit.md).
