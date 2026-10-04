# Grid Analyzer

Grid Analyzer imports PowerFactory DGS JSON or ZIP files in the browser, builds a canonical
network, and presents inventory, scenario, map, single-line diagram, electrical analysis and a
PowerFactory comparison. **Calculated values are model results, not measurements.** The ZIP
reader and the offline Türkiye basemap are bundled; no server or runtime CDN is required.

- Version: **8.2.3**
- Engine: `BrowserJsEngine` (classical Newton–Raphson power equations, sparse direct KLU/WASM)
- Release manifest: [`docs/validation/v8.2.3-release.json`](docs/validation/v8.2.3-release.json)

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
| `maxStationControlCorrections` | 12 | Station-controller outer corrections |
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

```powershell
# 1. Solve Full AC on the golden fixture and capture the CalculationResult.
node --max-old-space-size=6144 --import tsx tools/sn4-parity.ts `
  kontrol1/20261001_1500_SN4_TR0.zip `
  kontrol1/PowerFactory_ControlContext_20261001_1500_SN4_TR0_20261003_224310.csv `
  .tmp/sn4-final-result.json

# 2. Score the six canonical KPIs against the PowerFactory numeric CSV.
node --max-old-space-size=6144 --import tsx tools/pf-kpi.ts `
  .tmp/sn4-final-result.json `
  kontrol1/PowerFactory_LoadFlow_20261001_1500_SN4_TR0_20261003_224310.csv `
  --out=.tmp/kpi-final.json --baseline=.tmp/kpi-baseline-8.2.1.json

# 3. Build the release manifest from the measured artifacts.
node --import tsx tools/release-manifest.ts --version=8.2.2 ... (see file header)
```

`src/analysis/validation/pf-kpi.ts` is the **single** KPI implementation. This README, the release
manifest and the merge decision all consume it, so no document can quote a differently computed
number.

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

## Baseline and final KPIs (8.2.2)

Population is identical in both runs — `minKv=66 | lines=2308 | transformers=2892 |
busesVoltage=1733 | busesAngle=1733` — with zero unmatched PowerFactory lines, transformers or
electrical buses.

| # | KPI | N | Baseline norm. % | Final norm. % | Improved ≥0.1 % |
| ---: | --- | ---: | ---: | ---: | :---: |
| 1 | Line active power (MW) | 4616 | 1.001351392 | 1.001351392 | no |
| 2 | Line reactive power (MVAr) | 4616 | 48.708913438 | 48.708913438 | no |
| 3 | Transformer active power (MW) | 5784 | 0.740357908 | 0.740357908 | no |
| 4 | Transformer reactive power (MVAr) | 5784 | 48.412123624 | 48.412123624 | no |
| 5 | Bus voltage (kV) | 1733 | 1.133309538 | 1.133309538 | no |
| 6 | Reference-aligned bus angle magnitude (deg) | 1733 | 1.995560238 | 1.995560238 | no |

Absolute averages (baseline = final): 0.680365144 MW, 6.826398096 MVAr, 0.225382920 MW,
2.409892547 MVAr, 2.184886099 kV, 0.183707051 deg.

**The baseline was reproduced independently with `tools/pf-kpi.ts` and matched to nine decimals.**
This release changes provenance, diagnostics and settings truthfulness; it does not change the
numerical solution, so 0 of 6 KPIs improved. **Full PowerFactory parity is not claimed.**

### Where the remaining error is

Diagnostic finding, reproducible from the captured result and the numeric CSV: the entire reactive
discrepancy originates at voltage-controlling units. Uncontrolled generators match PowerFactory
exactly (0.00 % normalized Q error over 1614 units), while the total generator Q differs by about
1370 MVAr (PowerFactory +564 MVAr, Grid Analyzer −806 MVAr). Per-controller totals are as far off as
per-unit values, so this is a reactive **ownership/target** problem rather than a participation-weight
problem. Sign disagreement is widespread on reactive quantities (654 / 4571 line Q observations,
440 / 5050 transformer Q observations).

## Performance

Measured on the exact committed portable artifact in headless Chromium
(`tools/portable-full-ac-benchmark.mjs`):

| Measure | Value |
| --- | ---: |
| `CalculationResult.elapsedMs` (portable, Chromium 153) | **11 540 ms** (budget 15 000 ms) |
| Browser wall clock from click to result | 12 980 ms |
| Newton iterations / full NR solves | 7 / 30 |
| Node engine time (separate environment) | 12 836 ms |

Repeated portable runs on one host varied between roughly 10 s and 21 s, so the budget is met in the
recorded run but with substantial host-level variance. Portable/browser and Node are different
environments and are reported separately rather than as an identical timing pair.

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

```powershell
node tools/portable-full-ac-benchmark.mjs   # SHA-256 of the exact artifact, before commit
Get-FileHash dist-portable/GridAnalyzer_v7.html -Algorithm SHA256
```

- Portable SHA-256: `fe2efa6d79dfcc0508cbc3e062c4f58f00adfe11dc8ab35b11dd4f866450539f`
- Portable bytes: 970 722

## Further fidelity work

In priority order, using source-first evidence: (A) reactive ownership and the voltage target for
zero-droop station controllers, including the `STAGNATED_TRIAL` cases; (B) `cvqq` / `qu_char`
reactive sharing priority; (C) Q-limit release semantics; (D) droop, only with `i_droop`, `pQmeas`,
`Srated` and `iQorient` semantics confirmed against official documentation and fixture behaviour;
(E) transformer phase and vector group. No enum behaviour is inferred from its numeric value alone.

Earlier context: [architecture](docs/architecture.md),
[v8.2.1 Full AC performance audit](docs/full-ac-performance-v8-2-1.md),
[v8.2 PowerFactory parity notes](docs/pf-full-ac-parity-v8-2.md),
[source audit](docs/validation/20260928-source-audit.md).
