# PF–GA diagnostic map and method correction

Correction of sealed 0cf28d0 on fix/pf-ga-diagnostic-map-n1-sc-20261009.
Measurements use the two separate private SN3/SN4 model/benchmark pairs;
study-case identities and unchanged Full AC digests were checked locally.
Raw workbooks, model/source hashes, topology, FIDs, per-cell results and screenshots
remain ignored. Public numbers below are measured anonymous aggregates.

| Phase | Evidence and outcome |
|---|---|
| A — Map identity | PASS: separate consent-gated EXPLORATORY_DELTA; native class/FID, partition, side, units/phase/quality, current snapshot and provenance gates; actual canvas pixel tests for positive/negative/zero/missing values. Certified DELTA stays closed. |
| B — Hybrid N1 | PASS for selected-case AC map and shared seasonal loading; real 20-case queue per study resumed through budgets 5/10/20. Complete 660/664-case coverage and PF parity remain unverified. |
| C — LF diagnostics | PASS: real metric/kind/unit errors and coverage below; private nominal-kV and YTM breakdowns and worst FID/side retained. Certified errors null. |
| D — SC sources | Analytical/native-input tests PASS. Real computed coverage remains zero, with source/element blockers documented below; IEC subset and parity blocked. |
| E — Browser/performance | PARTIAL: real installed Chrome on localhost loads and displays diagnostic maps. Long main-thread stalls are measured; continuous responsiveness is not established. |
| F — Delivery | Final regression, portable byte checks and new-branch delivery are recorded after validation below. |

## Data regimes and map behavior

PF, GA, EXPLORATORY_DELTA and certified DELTA are four separate choices.
Diagnostic signed Δ is GA−PF, with per-metric/unit robust |Δ| P95 saturation,
positive orange, negative blue, zero neutral and missing gray. P95 zero uses a
nonzero fallback. Tooltips preserve PF/GA, signed/absolute/relative differences,
source cells, snapshot/case/side/FID, method and reason. NO_GEOMETRY is counted.
Multi-voltage sites retain per-kV extrema and the largest |Δ| representative;
ordinary PF/GA voltage retains the largest |V−1| rule. Case, result and settings
changes invalidate cached values. Opt-in plots show a sampled PF–GA scatter,
all-cell |Δ| histogram and the largest 20 local FID/side errors; no accuracy badge.

## LF measured errors

SN3: 62,369 diagnostic metric cells; SN4: 62,427. All have certified delta null.
The earlier 65,105/65,101 counts are superseded by the strict native class/FID
check: alias-only class/identity matches no longer authorize diagnostics.
NR results are unchanged: SN3 4,077 buses/5,140 branches, 12 iterations;
SN4 4,088 buses/5,141 branches, 11 iterations. Both CONVERGED_FULL_NR,
preflight COMPATIBLE, method gate EXPLORATORY_ONLY. Missing/raw-enum-only PF
calculation-setting semantics prevent method certification. Convergence is not parity.

[Complete metric coverage and error CSV](PF_GA_LF_DIAGNOSTIC_METRICS.csv) includes
nPF/nGA/identity/diagnostic/certified, missing/invalid/rating/method exclusions,
bias, MAE, RMSE, P50/P95/P99/max absolute and median relative error.
All errors below are exploratory, in the displayed unit. Percent loading error
is percentage points; relative error uses |Δ/PF| and excludes PF=0.
Nearest-rank absolute quantiles are used. Deduplication is by source cell plus
metric (derived MVA and native P remain distinct metrics). Missing counts retain
unavailable physical-terminal records and unsupported endpoint columns, rather
than silently dropping them. Exclusion counts may overlap. No-data groups have
null errors, not zero errors. Private voltage groups: 324/346; private YTM groups:
354/354 (each is a metric×dimension group, not a count of areas).

### SN3

| Kind / metric | Unit | n_diag | Bias_diag | MAE_diag | RMSE_diag | P50_abs | P95_abs | P99_abs | Max_abs |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
|bus / voltagePu|pu|4076|-0.0186565|0.0218854|0.0348243|0.0220373|0.0407812|0.0572433|0.953956|
|bus / voltageKv|kV|4077|-1.87958|2.01220|3.17883|0.882741|7.00142|11.3804|20.9888|
|bus / angleDeg|deg|4077|1.48569|1.62401|3.18949|1.52983|2.57264|3.03984|117.317|
|line / pFromMw|MW|2280|0.160620|1.58752|4.86237|0.447121|6.23612|22.0596|82.8279|
|line / qFromMvar|Mvar|2280|-0.0664576|6.52328|16.3047|2.00947|29.9147|71.7773|220.233|
|line / sFromMva|MVA|2280|-0.677069|2.70178|8.26532|0.697435|10.7465|37.8763|180.741|
|line / pToMw|MW|2280|-0.151836|1.58399|4.84487|0.448306|6.17981|22.0929|81.8144|
|line / qToMvar|Mvar|2280|0.538088|6.57294|16.4259|1.98744|30.3291|71.5176|221.559|
|line / sToMva|MVA|2280|-0.704440|2.66149|8.41326|0.681249|10.9514|38.1547|181.991|
|line / iFromA|A|2280|1.76775|7.46742|22.3749|3.21610|24.4956|60.3152|723.435|
|line / iToA|A|2280|1.66657|7.36193|22.4391|3.11518|23.7662|64.1982|723.228|
|line / loadingPercent|%|2280|0.137865|0.734578|2.20568|0.351864|2.36924|5.46419|71.4689|
|line / pLossMw|MW|2280|0.00878323|0.0187295|0.0734832|0.00204660|0.0764804|0.348734|1.58894|
|line / qLossMvar|Mvar|2280|0.471631|0.517908|1.64676|0.0866160|3.01128|8.96156|19.0162|
|transformer / pHvMw|MW|2851|-0.196924|0.213404|0.511055|0.0981025|0.817288|2.01019|10.1544|
|transformer / qHvMvar|Mvar|2851|-0.342421|2.66807|12.9261|0.0243342|13.1838|55.9531|262.418|
|transformer / sHvMva|MVA|2851|-0.366955|0.979042|7.10854|0.141467|2.78760|14.1106|240.430|
|transformer / pLvMw|MW|2851|0.193979|0.210377|0.494677|0.0975577|0.816032|1.97364|10.1641|
|transformer / qLvMvar|Mvar|2851|0.183713|2.43462|11.1294|2.86094e-8|13.0000|52.9233|199.389|
|transformer / sLvMva|MVA|2851|-0.187960|0.788939|3.88979|0.138770|2.80895|11.7765|92.3938|
|transformer / loadingPercent|%|967|-2.67329|3.89351|54.4741|0.395571|4.60755|13.5939|1406.93|
|transformer / pLossMw|MW|2851|-0.00294496|0.00359278|0.127688|0.000849358|0.00348088|0.00877404|6.81698|
|transformer / qLossMvar|Mvar|2851|-0.158708|0.313113|6.86465|0.0161604|0.428534|1.95582|288.452|
|generator / pResultMw|MW|642|4.86122e-8|4.23058e-7|0.00000130370|7.62939e-8|0.00000183105|0.00000549316|0.0000134277|
|generator / qResultMvar|Mvar|642|-0.665077|7.87271|22.7366|7.15256e-9|49.1779|98.4334|199.389|

### SN4

| Kind / metric | Unit | n_diag | Bias_diag | MAE_diag | RMSE_diag | P50_abs | P95_abs | P99_abs | Max_abs |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|
|bus / voltagePu|pu|4087|-0.0361425|0.0386595|0.0490698|0.0359188|0.0667721|0.0744633|0.960939|
|bus / voltageKv|kV|4088|-3.58914|3.66194|5.73931|1.80086|10.6660|23.9056|28.8886|
|bus / angleDeg|deg|4088|-0.238353|2.01160|3.51442|2.04157|3.61894|4.07179|122.343|
|line / pFromMw|MW|2275|0.0975237|1.15530|3.06949|0.359547|5.03839|14.2482|44.0942|
|line / qFromMvar|Mvar|2275|-0.00129170|8.19161|18.7296|2.62243|38.2237|79.8316|229.647|
|line / sFromMva|MVA|2275|-0.464522|2.59499|7.31811|0.677845|12.0518|28.8636|182.614|
|line / pToMw|MW|2275|-0.0648392|1.14558|3.03693|0.357107|4.92453|14.5726|43.3155|
|line / qToMvar|Mvar|2275|1.10824|8.44854|19.4443|2.60116|41.1061|91.5329|230.973|
|line / sToMva|MVA|2275|-0.570181|2.54955|7.34382|0.652312|11.3204|31.2298|183.864|
|line / iFromA|A|2275|5.98539|10.4342|22.8347|5.52384|38.6167|69.3620|724.001|
|line / iToA|A|2275|5.63009|10.2076|22.5476|5.38268|37.1018|67.4887|723.751|
|line / loadingPercent|%|2275|0.482377|0.986339|2.16916|0.576308|3.06536|5.03515|71.5248|
|line / pLossMw|MW|2275|0.0326844|0.0377125|0.167576|0.00341833|0.142593|0.744127|2.75620|
|line / qLossMvar|Mvar|2275|1.10695|1.12430|4.00824|0.160155|6.12133|19.6264|47.7260|
|transformer / pHvMw|MW|2857|-0.134022|0.151406|0.348096|0.0706750|0.620639|1.41729|7.57793|
|transformer / qHvMvar|Mvar|2857|-0.722435|2.92126|13.1302|0.0510104|13.1620|69.6701|267.586|
|transformer / sHvMva|MVA|2857|-0.526032|0.877428|5.96742|0.0991634|3.04754|16.2538|244.928|
|transformer / pLvMw|MW|2857|0.130532|0.147890|0.317809|0.0694127|0.611277|1.39474|4.21184|
|transformer / qLvMvar|Mvar|2857|0.679030|2.73446|11.9162|2.38428e-8|12.8181|65.0000|158.525|
|transformer / sLvMva|MVA|2857|-0.344359|0.736053|3.25311|0.0981843|3.03808|13.1090|73.3639|
|transformer / loadingPercent|%|979|-2.02544|4.18194|54.2549|0.841507|5.39623|15.9626|1486.47|
|transformer / pLossMw|MW|2857|-0.00349018|0.00463473|0.141807|0.00140433|0.00619648|0.0113622|7.57788|
|transformer / qLossMvar|Mvar|2857|-0.0434049|0.323341|5.74977|0.0308429|0.730815|2.50470|291.505|
|generator / pResultMw|MW|652|5.08966e-8|4.91726e-7|0.00000180404|7.62939e-8|0.00000152588|0.00000732422|0.0000244141|
|generator / qResultMvar|Mvar|652|1.28074|9.01276|24.1725|1.13791e-8|59.9297|111.171|158.525|

PF minimum voltage 0.0460443/0.0390614 pu and maximum reported loading
1465.8912/1545.3637% remain present in the actual diagnostic records. They are
SOURCE_UNVERIFIED anomalies. Native identity/electrical partition checks and
metric-specific LF rating exclusions are recorded independently; they do not
prove these extreme physical conditions or PF effective control/rating semantics.
The physical low-voltage cause and complete current-denominator audit remain
unverified. Values were neither removed nor used to tune the GA solver.

## Hybrid N1 measured coverage

| Quantity | SN3 | SN4 |
|---|---:|---:|
| Full PF/native catalog | 660 | 664 |
| Full-graph non-bridge / bridge | 352 / 308 | 351 / 313 |
| Scoped, explicitly selected/promoted sample | 20 | 20 |
| Excluded catalog cases | 640 | 644 |
| Selected lines / transformers | 18 / 2 | 18 / 2 |
| Budget 5: cumulative AC / pending | 5 / 15 | 5 / 15 |
| Resume budget 10: cumulative AC / pending | 15 / 5 | 15 / 5 |
| Resume budget 20: cumulative AC / pending | 20 / 0 | 20 / 0 |
| AC_CONVERGED_VIOLATION / PARTIAL_SOLUTION | 14 / 6 | 14 / 6 |
| Cases with unknown/control/rating qualification | 20 | 20 |
| DC SCREENED_VIOLATION / ISLANDING / UNSCREENABLE | 14 / 4 / 2 | 14 / 4 / 2 |
| Selected 154 / 400 / 380 kV outages | 15 / 4 / 1 | 16 / 3 / 1 |
| PF recorded extrema / identity-matched cells | 17 / 3 | 20 / 4 |
| PF extrema diagnostic differences | 0 | 0 |
| PF complete post-case matrix rows | 0 | 0 |

The YTM TOUCHING sample also exercises two non-bridge, one bridge and one
transformer as standalone Full AC checks. No DC-clear case occurred in this
selected real sample: real DC-clear/low-voltage false-negative coverage is
NOT_MEASURED, not evidence of absence. The synthetic DC-clear/voltage-risk
and seasonal/missing-rating cases cover the logic, not real population parity.
Numerically solved partial components retain their actual results; unreferenced
components have no V/Q/S/I and remain gray. The overall hybrid status stays
PARTIAL. User selection forces promotion and cannot establish PF automatic
promotion equality. Runtime case/time budgets may change on resume; physical
policy/model/scenario/settings/scope/season changes invalidate it.

Manual current Full AC has deterministic priority, otherwise the same hybrid
case's compact bus/branch snapshot feeds both map and extrema resolver. A shared
assembler supplies seasonal current-based line loading and native apparent-MVA
loading separately. PF N1 loading lacks denominator/season proof, so even the
3/4 identity matches have LOADING_DENOMINATOR_UNVERIFIED and null diagnostic Δ.
The previous 3/4 diagnostic-loading claim is superseded. GA case values remain
available independently. Certified N1 Δ remains closed.

## Independent SC source audit

| Quantity | SN3 | SN4 |
|---|---:|---:|
| Physical fault points | 4689 | 4686 |
| Computed Ikss/Skss fault points | 0 | 0 |
| BLOCKED fault points | 4689 | 4686 |
| CALCULATED_IEC_SUBSET / certified comparisons | 0 / 0 | 0 / 0 |
| Active ElmXnet / ElmSym / ElmGenStat / ElmVac | 1 / 642 / 1323 / 8 | 1 / 652 / 1292 / 8 |
| Active source locations unresolved | 0 | 0 |

Each fault is in the same connected component. Six overlapping blocker families
occur at all selected faults: MISSING_SOURCE_MODEL, unverified line sections,
UNSUPPORTED_CONVERTER, unverified transformer base/tap, INVALID_UNIT and
MISSING_IEC_FACTOR. Thus each family covers 4689/4686 faults; these are overlapping
counts. Component isolation cannot discard connected unsupported sources.

The new ElmXnet adapter converts native model input kA or MVA plus R/X and nominal
kV only with an independently proven source voltage factor. Native input mode
consistency and unit tests are checked; solved workbook Ikss never supplies an
impedance. The separately assumed fault-profile c=1.1 is not source-factor or
IEC evidence. Native MAX/MIN fields, machine bases/subtransient parameters,
generator-transformer grouping, converter contribution mode, line-section data
and transformer bases/taps are audited privately. Current real inputs do not
establish a supported physical equivalent for all connected contributions.
No source field presence is promoted to a computed fault or normative proof.

Minimum additional evidence is listed in [MISSING_PF_SOURCE_REQUEST.md](MISSING_PF_SOURCE_REQUEST.md).
Physical conversion evidence and mathematical scope are in [METHOD_SCOPE.md](METHOD_SCOPE.md).
Supported synthetic faults compute CALCULATED_NETWORK_APPROXIMATION; fault/profile,
physical/electrical partition and snapshot matching permit opt-in Ikss/Skss
diagnostics only. Actual dataset IEC edition/factors remain unverified; edition
null and Ip/Ib/Ith/unbalanced results null are retained. Blocked is never 0 kA.

## Real portable browser measurements

Windows, installed Chrome 154.0.8037.99, portable HTML at localhost
(http://127.0.0.1:5182), Core Ultra 7 155U, 14 logical CPUs, 15.5 GiB RAM.
Final artifact SHA-256: 63b46270d5e97b42ecd96d5d7a49bd1106ba9e5fcf0facd59a43fbf1d8685b5f. Both private browser profiles
record exactly this committed artifact hash.

| Measurement | SN3 | SN4 |
|---|---:|---:|
| Benchmark ready (s) | 34.353 | 30.744 |
| Final main-isolate heap used (MiB) | 509.84 | 437.14 |
| Final main-isolate heap total (MiB) | 582.53 | 498.04 |
| Maximum measured event-loop stall (s) | 8.792 | 5.606 |
| Independent LF / diagnostic map | CONVERGED / displayed | CONVERGED / displayed |
| Page errors | 0 | 0 |

Checkpoints at 5/30 seconds show elapsed time, compressed input bytes and worker
stages. Both loads completed before 60 s; 60/120/180 s checkpoints were not
needed and are not counted as passes. Earlier measurements loaded in 40–52 s
and stalled for 10–14 s, illustrating run/concurrency variability.
Source/provenance workers and hidden-view render suppression improve placement
of work but continuous UI responsiveness remains unverified: final measured
stalls of 8.792/5.606 s leave performance acceptance PARTIAL.
CDP heap is the main isolate at a sample, not total browser/worker peak or RSS.
The profiler's Node RSS is a separate process measurement. Full browser OOM/peak
memory budget and reliable interaction during every long stall are NOT_VERIFIED.
Reduced synthetic native-JSON/OOXML stress, actual worker termination and
successful reload run in CI; they do not establish full-size responsiveness.

## Regression and delivery evidence

Baseline: npm ci, typecheck, lint, 308/308 tests, browser E2E and portable build PASS.
Correction: typecheck/lint, dev E2E and offline portable E2E PASS. Both real LF
CLI runs and both 20-case hybrid/SC acceptance runs completed. Protected NR/KLU
Full AC, old DC screening and DGS importer source paths are unchanged.
Implementation commit: 163646491ca250660e632ad2b2d4335e03ed2fe7.
Final typecheck, lint, **314/314 tests (0 skipped)**, dev E2E, offline portable E2E,
standard and portable builds PASS. The 308 baseline tests are retained, with
six added tests. Committed artifact raw-byte equality, LF-only and repeated
build determinism PASS. npm run test:full is **SKIPPED / SOURCE_UNAVAILABLE**,
not a passing full-model test. Both real fixtures use the separate local CLI
acceptance path instead.

[Implementation CI #68](https://github.com/murathany90/Grid_Analyzer_v7/actions/runs/37979089638)
completed **success**, including Ubuntu portable raw-byte equality and browser
smoke. This is code/release evidence, not PF parity. This report's delivery-only
follow-up commit changes documentation; its final remote SHA and CI are
verified separately at delivery.

Normal push targets only the new fix branch. Remote protected references
remain main=f13567add3a0d4b16d4dc164b6a9cd645d5fa2b5,
feat/pf-sn3-sn4-benchmark-20261009=b85ca2fe35b154cf9f8c5204716ddf2219bf7cb2,
feat/ga-n1-hybrid-iec60909-20261009=0cf28d030c06316488515eeb275407d896fc7f68.
No merge/force push or private input/output upload occurred.
Real IEC/PF certification and continuous large-data responsiveness remain
explicitly unverified; the delivered diagnostics do not claim those results.
