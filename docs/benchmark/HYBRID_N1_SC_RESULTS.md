# Hybrid N1 and independent SC acceptance

Branch: `feat/ga-n1-hybrid-iec60909-20261009`.
Development base: `b85ca2fe35b154cf9f8c5204716ddf2219bf7cb2`.
Original numerical baseline: `f13567add3a0d4b16d4dc164b6a9cd645d5fa2b5`.
Implementation commit and final validation are recorded below after the committed
portable artifact is verified. Private source hashes, native FIDs, case outputs,
workbooks and field audits remain in ignored local storage.

## Phase assessment

| Phase | Assessment | Evidence / limitation |
|---|---|---|
| Full electrical topology / partial islands | PASS | Both real graphs audited; two non-bridge lines, one bridge line and one transformer outage per model run through Full AC. |
| Automatic DC → AC hybrid | PARTIAL | Real selected three-case queues and synthetic automatic promotion pass; incomplete scope, control fidelity and ratings remain explicit. |
| Independent 3PH SC mathematics | PASS | Own sparse positive-sequence equations; analytical 2/3/5-bus and small native DGS cases calculate Zkk, Ikss and Skss. |
| Normative IEC method / exact PF SC parity | BLOCKED | Edition, corrected source parameters and unsupported contribution models are not verified. |
| PF diagnostic comparison | PARTIAL | Opt-in differences require native identity, side, unit and source-cell gates; certified differences/statistics stay null. |
| UI / map / export / interruption | PASS | Existing manual actions retained, separate hybrid and SC actions, extrema-aware voltage map, metadata exports and actual worker termination/recovery. |

See [METHOD_SCOPE.md](METHOD_SCOPE.md) for equations, source citations, evidence
categories, controller limitations and method gates. Required exporter additions
are in [MISSING_PF_SOURCE_REQUEST.md](MISSING_PF_SOURCE_REQUEST.md).

## Real topology and AC checks

| Measure | SN3 | SN4 |
|---|---:|---:|
| PF outage identities audited | 660 | 664 |
| Bridge / non-bridge | 308 / 352 | 313 / 351 |
| Unmapped outage identities | 0 | 0 |
| Full electrical buses / edges | 4077 / 5140 | 4088 / 5141 |
| Selected non-bridge line outages | 2 CONVERGED | 2 CONVERGED |
| Selected bridge outage | 1 PARTIAL_SOLUTION | 1 PARTIAL_SOLUTION |
| Selected transformer outage | 1 CONVERGED | 1 CONVERGED |
| Maximum iterations in selected checks | 12 | 11 |
| Largest final physical mismatch, MW | 3.77e-6 | 1.76e-5 |

The bridge case retains the supplied component's numerical result and identifies
the unsupplied component; no artificial slack or zero voltage is inserted.
Native identities, service state, terminal voltage/angle and both branch ends'
P/Q/S/I/loading are in the private acceptance logs. Station control off uses
local PV behavior with PARTIAL control fidelity, so convergence establishes
numerical performance, not PF method parity. Base Full AC digests match both the
original baseline and the previous feature exactly. Protected Full AC equations,
DC screening and DGS importer files have no diff against the development base.

## Real budgeted hybrid coverage

Each model used an explicit three-case catalog subset in the native YTM scope:
two non-bridge lines and one bridge line. Selection prioritized native PF extrema
case identities without using PF magnitudes as solver inputs. The full catalog
was audited; it was not fully AC solved.

| Measure | SN3 | SN4 |
|---|---:|---:|
| Full catalog / excluded from selected run | 660 / 657 | 664 / 661 |
| Selected DC cases / promoted / AC_CALCULATED | 3 / 3 / 3 | 3 / 3 / 3 |
| AC_CONVERGED_VIOLATION | 2 | 2 |
| PARTIAL_SOLUTION | 1 | 1 |
| NOT_RUN / UNKNOWN | 0 / 3 | 0 / 3 |
| DC risk confirmed by AC | 2 | 2 |
| DC violation not confirmed / DC clear violated | 0 / 0 | 0 / 0 |
| Global outcome | PARTIAL | PARTIAL |
| DC factorizations / RHS | 1 / 2 | 1 / 2 |
| DC maximum residual | 2.3e-13 | 2.7e-13 |

UNKNOWN includes incomplete rating/control/island coverage and can coexist with
AC_CALCULATED. The zero false-positive/negative counters apply only to this small
selected subset; they do not establish population accuracy. Operational loading
100% and voltage 0.90–1.10 come from the PF manifest. Promotion 90% is separately
identified as user policy. Default AC budget is ten cases with sequential hard
worker limits, stop and snapshot-bound resume.

## SC fault coverage and comparison

| Measure | SN3 | SN4 |
|---|---:|---:|
| Native physical faults swept | 4689 | 4686 |
| Calculated real Ikss / Skss faults | 0 / 0 | 0 / 0 |
| BLOCKED physical faults | 4689 | 4686 |
| CALCULATED_IEC_SUBSET | 0 | 0 |
| Native N1 recorded extrema | 17 | 20 |
| N1 identity-matched diagnostic metric cells | 3 | 4 |
| LF diagnostic metric cells in recorded acceptance | 65105 | 65101 |
| Certified LF / N1 / SC MAE | null / null / null | null / null / null |

All real faults remain BLOCKED. Per-fault reason codes link to compact component
evidence; detailed native field units, zero/missing/sentinel distinctions and
source attributes are stored once in the private audit. Reasons include missing
source equivalents/corrections, unsupported connected converters/machines,
invalid source units, unverified line sections and transformer base/tap data.
No default ideal external grid, generator Xd'' or IEC factor is invented.

Supported analytical and small DGS examples return
CALCULATED_NETWORK_APPROXIMATION, not certified IEC results. Passive load/shunt
omission, canonical transformer phase and unverified normative corrections are
explicit. Ip/Ib/Ith and unbalanced faults remain unavailable. PF physical and
electrical partitions are checked separately; device rows without fault identity
cannot become contributions. Nonempty scenario overlays cannot reuse a native
PF scenario until common scenario identity evidence is supplied.

PF N1 contains extrema rather than full post-case P/Q/S/V matrices or case solver
status. The reported 3/4 matches are metric-cell coverage, not full-case parity.
Real SC has no computed GA values, so no SC errors or accuracy claim exists.

## Performance and regression

Recorded combined acceptance runs took approximately 144/143 seconds with sampled
Node heap 922/1194 MiB. Final source-adapter SC-only reruns took 78/79 seconds with
sampled Node heap 1494/1511 MiB. These are CLI measurements, not browser peak RAM.
The real-model parsing/audit footprint remains significant; the browser defaults
to ten selected faults and sequential AC, and preserves compact summaries.

Initial unbounded pilots were stopped and are not acceptance results. A newly
introduced quadratic provenance lookup before the hybrid phase was indexed;
CLI calculations now run in individually terminating workers. Browser tests
inject an actual CPU-bound worker, verify timeout terminates it, and then verify
a subsequent calculation succeeds. No LF/SC calibration uses PF solved values.

Baseline: npm ci, typecheck, lint, 287 unit/regression tests, e2e, standard and
portable builds passed. `npm run test:full` reported SKIPPED/SOURCE_UNAVAILABLE
because its expected `control1` path is absent; it is not counted as a pass.
The separate real-fixture acceptance runner supplies the checks above.

Final validation: pending committed-artifact unit/regression byte check.
Final remote SHA and CI run: pending push; no success is claimed before completion.
