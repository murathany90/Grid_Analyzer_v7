# Analysis v7 baseline audit

Date: 2026-10-12. Starting and fetched `origin/main`: `9b1eee94d5ef4548716611fc5447f07727c41d51`.
Working branch: `feat/analysis-ui-native-n1-iec60909-2016`. Clean user checkout before work. No main integration or branch deletion is authorized by this task.

## Protected behavior and inventory

| Module / actual entry point | Current behavior | Boundary to preserve |
| --- | --- | --- |
| `src/analysis/api/browser-js-engine.ts`, `src/analysis/power-flow/` | Full AC NR, station/droop controls, active balancing, explicit control/source diagnostics | Mathematical core, defaults and numerical results unchanged |
| `src/domain/n1/index.ts`, `src/domain/n1/catalog.ts` | Sparse ≥66 kV DC/P-only screen; full-voltage line/2W-transformer catalog, exact source identity | DC remains screening; scope selects targets rather than truncating the connected model |
| `src/analysis/contingency-hybrid/index.ts::runHybridN1` | Full AC BASE, DC promotion, bounded sequential POST queue, checkpoints, settings identity, 33 kV direct AC, sampled DC-clear AC checks | Unsolved cases never become AC all-clear; cancel/resume and worker wall-clock budgets retained |
| `src/analysis/contingency-ac/index.ts::validateAcOutages` | Copied outage overlay; actual Full AC; supplied/unsupplied/multiple-reference components | No fake slack; no source or PF result substituted; no implicit station-control switch-off |
| `src/analysis/contingency-hybrid/constraints.ts` | BASE/POST constraints, endpoint/rating basis, new/worsened/persistent/relieved and missing-rating states | Null remains unknown; missing ratings never prove safety |
| `src/analysis/short-circuit/{source-adapter,index,positive-sequence}.ts` | Native physical source audit, MAX/MIN contexts, sparse complex KLU factors, physical/electrical partition catalog | Existing method is NETWORK_APPROXIMATION; IEC edition, corrections, Ip/Ib/Ith and asymmetric faults are not certified |
| `src/features/analysis/{analysis-workspace,workspace-results,study-result-rows}.ts` | Three retained tabs, common paged results, case/fault selection, CSV/XLSX; existing map/lightning/SLD | Reuse existing views, comparison and exports; bounded DOM and keyboard access |
| `src/domain/benchmark/`, `src/features/comparison/` | Model/settings/method/endpoint/partition evidence gates; exploratory comparisons distinct | No unverified PF parity or fake zero error |
| `src/domain/scenario/`, `src/importers/`, `src/workers/` | Scenario/model/FID identities, DGS JSON/ZIP, isolated workers | Preserve overlays, cancellation, import and offline single-HTML build |

## Baseline checks (before implementation)

| Check | Result |
| --- | --- |
| `npm ci` | PASS; one pre-existing high advisory in transitive development `source-map-js` (<1.2.2); no blind dependency upgrade |
| `npm run typecheck`, `npm run lint` | PASS; lint 274 files |
| `npm test` | PASS: 398 tests, 0 failures, 0 skipped |
| `npm run test:e2e` | PASS: Chromium smoke, PF benchmark smoke, map/lightning audit; four desktop viewports and mobile |
| `npm run build`, `npm run build:portable` | PASS |
| Portable SHA-256 | `13e658ad0350a2fc8ee808e23c44e7cf993f60d1f360ed9da10ad4a647068630` (1,649,720 bytes), identical baseline |
| `npm run test:full` | `SKIPPED / SOURCE_UNAVAILABLE`: tracked `control1` contains only its README; this is not a real-model acceptance PASS |

Logs remain in ignored `local-benchmark-results/analysis-v7-20261011/`. Browser smoke screenshots are generated synthetic evidence, restored after baseline. Real SN3 model and PF workbooks exist locally and will be exercised separately; private files/IDs/results will not be committed.

## Known limitations and acceptance gates

* P1: current strict BASE and POST gates reject unsupported station configurations. Numerical convergence alone does not establish source-exact station/droop control. `GA_APPROX_STATION_OFF` is explicit and diagnostic. Control completion requiring LF core changes must be a separate proposal. BASE and POST need the same audited fidelity verdict, including active balancing, pending controls and missing source limits, rather than only unsupported counts.
* N-1 catalog count, actual DC screened count, AC attempted/solved/fully verified and unverified count must be distinct. A sampled safe DC case does not verify the unsolved catalog. Constraint deltas require matching endpoint and denominator.
* P2: existing SC handles sparse positive-sequence network mathematics, not the whole IEC method. No validated KG/KT/KKW, peak/decay/thermal or sequence/grounding implementation can be inferred from Ikss/Skss alone. Fault `c` and source-equivalent `c_source` are distinct.
* The supplied local `PF_GA_IEC60909_2016_Agent_Paketi (1).zip` contains analysis/development notes, a source index and PF screenshots. It does not contain the full licensed IEC standard or independently solved normative examples. Screenshots are not effective ComShc option manifests.
* [IEC 60909-0:2016 Edition 2 catalog](https://webstore.iec.ch/en/publication/24100) establishes the requested edition and scope. The catalog and [IEC TR 60909-4 worked-example catalog](https://webstore.iec.ch/en/publication/3892) are metadata, not full equations or numerical acceptance evidence. Edition 3 / 2026 must not enter a 2016 profile.
* Prior redacted `docs/benchmark/SN3_OA_INDEPENDENT_ACCEPTANCE.md` is baseline evidence, not a new feature acceptance. It records 4,077 solved buses / 5,140 branches globally, OA 500 electrical buses / 660 branches, OA SC 6,278 physical terminals / 500 partitions. Strict native N-1 and native SC were BLOCKED; diagnostic calculations did not prove IEC/PF parity. New evidence must retain that distinction.
* P3: result layout needs shared model/scenario/method context, separate quality states, table controls and a compact evidence/details panel. Existing comparison gates and map/SLD links must remain usable.

Final acceptance will report PASS/PARTIAL/BLOCKED/NOT_TESTED/SOURCE_UNAVAILABLE separately. Full IEC completion requires independent normative examples, actual source applicability/corrections and supported quantities. A functioning UI, synthetic mocked worker response, or diagnostic real-model result cannot satisfy that gate.
