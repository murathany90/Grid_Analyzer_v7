# Engineering baseline — 2026-10-12

Live refs were queried before changes: main `9b1eee94d5ef4548716611fc5447f07727c41d51`, hardening `a3cf86268f94cd846c2f48cf0cd67857f11ae2a6`, prior analysis feature `ae82a5f3de8f3dc1ffd277a37d08290dbba148dd`. Main is an ancestor of hardening. Work starts from hardening on `feat/engineering-n1-iec60909-validation`. The user's untracked IEC ZIP is preserved and excluded from commits. No investigation commits are imported; branches and tags are preserved in this task.

Before changing code, `npm ci` and `npm test` passed: **422 tests, 422 passed, 0 failed/cancelled/skipped**. Log: ignored `local-benchmark-results/engineering-20261012/baseline-tests.log`. Existing acceptance: [hardening exact-commit CI](https://github.com/murathany90/Grid_Analyzer_v7/actions/runs/38184038033). Baseline portable: 1,688,550 bytes, SHA-256 `1ce2b1a18343e95de60a75c12143b55b2930de7d221e5e3d553771d88d22743d`.

## Actual call chains

* Import: `importers/model-file.ts` → DGS model/canonical mapper → canonical network and raw source context. PF exports remain independent reference inputs.
* LF: Application/analysis worker → `analysis/api/browser-js-engine.ts::runPowerFlow` → effective overlay → `power-flow/preparation.ts::prepareModel` → `station-controls-v73.ts` → sparse Newton/KLU → results. Fixed tap/phase/shunt physics and Q-limited PV/PQ remain in this engine.
* N-1: worker → `contingency-hybrid/index.ts::runHybridN1` → limits preflight, BASE LF, existing DC screen and selected `contingency-ac/index.ts::validateAcOutages` → same LF engine with copied outage overlay → control evidence and BASE/POST constraints.
* SC: worker → raw DGS `adaptShortCircuitSources` → `short-circuit/index.ts::calculateThreePhase` → full topology/source audit → leased positive-sequence KLU preparation and driving-point RHS. Normative requests stay blocked. No alternate engine is introduced.
* Presentation: shared study rows/evidence → analysis workspace, map, SLD and comparison. Current selected result ownership and immutable snapshot cache remain enforced.

## Scope and independent acceptance

No LF/DC numerical defaults or equations are changed without a separate justified regression. Existing tests cover radial/parallel/ring, transformer identity, source limits, station controls, droop, distributed eligible-load balance, islands, missing ratings, cancellation, stale identity and sparse reuse. New independent physical tests and negative evidence tests supplement these; production output is never copied into expected references.

Owned PF manuals and actual SN3/SN4/SN7 ZIPs are available. The supplied IEC package contains notes/indexes/screenshots, not the licensed standard or solved normative vectors. PF manuals alone cannot certify IEC. Fresh import/calculation evidence and final software gates are recorded in reports 10–15; cached UI results are not new engineering acceptance.
