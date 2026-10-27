# PSS/E AC/DC numerical parity report

## V2 current engine and requested new model

New SAV `20261026_1600_SN1_TR0.sav` SHA-256 `8cc8ccfeca14001c392d2bebf578caafe61589c431f071f64db235a81dbbe60b`; licensed RAW export SHA-256 `40086c10e93819d16861b5c35d4afdd3ee641dfe14474c76dd3594ee88aa64ea`. It is distinct from the old 20261014 model. Source SAV/RAW decode 6,875 buses, 2,414 lines, 3,715 transformers, 2,932 generators, 2,516 loads, 2,571 switches, 137 fixed shunts and 1,625 substations. Comparison checks 239,858 fields, zero missing IDs and four IDE source-state differences, retained explicitly in `evidence/psse-v2/source-new-sav-raw.json`.

Engine2 has 10 unique cached experiment comparisons: 3 BLOCKED, 2 DIFFERENCES, 5 PASS. Current version results follow; historical tables below remain attributed by engine.

| Source | Method / start / Q limits | GA numerical / physics | Reference ierr / solved / iterations | Outcome |
|---|---|---|---|---|
| 20261014_1200_SN3_TR0.sav | LOSSLESS_DC / FLAT / False | CONVERGED / PARTIAL | 0 / 0 / 1 | DIFFERENCES |
| 20261026_1600_SN1_TR0.sav | LOSSLESS_DC / FLAT / False | CONVERGED / PARTIAL | 0 / 0 / 1 | DIFFERENCES |
| 20261026_1600_SN1_TR0.sav | FDNS_XB / SOURCE_SAVED / True | BLOCKED / BLOCKED | 0 / 3 / 1 | BLOCKED |
| 20261026_1600_SN1_TR0.raw | LOSSLESS_DC / FLAT / False | BLOCKED / BLOCKED | 0 / 9 / 0 | BLOCKED |
| pv-no-generator.rawx | LOSSLESS_DC / FLAT / False | CONVERGED / SUPPORTED | 0 / 9 / 0 | PASS |
| pq-no-generator.rawx | LOSSLESS_DC / FLAT / False | CONVERGED / SUPPORTED | 0 / 9 / 0 | PASS |
| pv-inactive-generator.rawx | LOSSLESS_DC / FLAT / False | CONVERGED / SUPPORTED | 0 / 9 / 0 | PASS |
| dc-loadtype-tag.rawx | LOSSLESS_DC / FLAT / False | CONVERGED / SUPPORTED | 0 / 9 / 0 | PASS |
| dc-large-core-loss.rawx | LOSSLESS_DC / FLAT / False | CONVERGED / SUPPORTED | 0 / 9 / 0 | PASS |
| 20261026_1600_SN1_TR0.sav | NR_POLAR / SOURCE_SAVED / True | BLOCKED / BLOCKED | 0 / 0 / 9 | BLOCKED |

Old/new current real DC differences (all matched quantities, no missing IDs):

| Source | Active buses / directed terminal MW | MW max / mean / P95 | Degrees max / mean / P95 |
|---|---:|---|---|
| 20261014_1200_SN3_TR0.sav | 5029 / 12244 | 0.246692 / 0.0239553 / 0.0480102 | 0.00628441 / 0.004147 / 0.00517335 |
| 20261026_1600_SN1_TR0.sav | 5072 / 12330 | 0.244677 / 0.023982 / 0.0479722 | 0.00689369 / 0.00493032 / 0.00575533 |

Both real SAV DC runs numerically converge in one sparse solve with PARTIAL physics and publish LIMITED_PROFILE. The new source active-P residual is 7.88435e-12 pu. They meet the initial 0.5 MW / 0.05 degree engineering bounds for compared P/angle, but fail strict 0.051 MW parity. DC Vm/Q/current/AC loss and blocked GA AC metrics remain unavailable. The new SAV warm/Q-enabled FNSL reference reaches solved=0 in 9 iterations (system mismatch 0.0121785 MVA). FDNS ierr=0 but solved=3, mismatch 0.0504561 MVA, is not a positive AC reference convergence. Both GA real AC methods remain BLOCKED by active unimplemented controls/AC ideal-link physics.

The new RAW retains four isolated IDE=2 islands with no reference generator and remains BLOCKED. PSS/E's RAW reader changes these four buses to TYPE=4 before DCLF; native SAV already stores IDE=4. An original tiny RAWX empty-PV-island returns DCLF ierr=12, so a general automatic deenergization rule is unproved and was not added. LOADTYPE is verified descriptor metadata, not a static-load-law gate. RAW voltage-droop metadata is recognized; pure-Q controls are permitted DC omissions while active AC droop stays blocked.

### Proven fixes and unresolved strict DC difference

PV-without-online-generator is an AC voltage-control constraint. Three original PV/PQ/inactive-generator fixtures have equal six directed DCLF MW values and angles with ierr=0. DC now accepts these supported cases; AC keeps its control gate. No-slack/island/unknown-active-physics checks remain. A large core-loss/tap discriminator matches all six rounded terminal MW values; changing core-G globally is unjustified. Proofs are in `evidence/psse-v2/dc-pv-eligibility-proof.json` and `loadtype-descriptor-proof.json`.

The old large case matches all 6,122 branch identities; the historical 98 over-threshold from-end rows become 102 branches when testing the worse of both ends. API angles are Float32-valued; half-ULP angle/report bounds explain most reevaluated branch differences, but angle display precision alone does not explain every nodal residual. The old case has zero nonzero phase shifts. Alternative core-G policies worsen differences. Matrix/RHS rounding fails original-equation residual/recovery checks and is not shipped.

An original three-bus witness changes only one finite-link impedance: condition number increases from 13.3077 to 12308.6923; maximum MW difference rises from 0.0421965 to 0.1675026 MW and angle difference from 1.75492e-5 to 0.00392263 degrees, while production residual is 2.26805e-12 pu. One reference report nodal balance misses specified injection by 0.2 MW, beyond the 0.1 MW combined display-rounding bound. This supports numerical sensitivity/conditioning; it does not establish Siemens internals or prove every large-case discrepancy. Strict differences remain unresolved. See `dc-tiny-conditioning-proof.json`, `dc-precision-old.json`, `dc-arithmetic-old-backward.json` under `evidence/psse-v2/` and architecture §18.

### Local Excel/CSV separation

`tools/psse-v2-export-comparison.ts` exports separate SOURCE_SAVED, GA_PSSE_CALCULATED and PSSE_REFERENCE CSVs from cached actual Engine2 runs. The local workbook has all 10,101 matched active DC buses and 5,852 source/reference generators. Its branch sheet shows the worst 200 directed-terminal differences per model; full 24,574 matched terminal comparisons remain in CSV. Summary maximum/mean/P95 always use all rows. GA AC columns stay blank because BLOCKED; converged reference FNSL values are never substituted. Detailed licensed-derived CSV/XLSX files stay local, outside Git and the public ZIP.

Measured on 2026-10-27 (Europe/Istanbul). This report is generated by `tools/psse-parity-report.py` from actual retained runs. It certifies only the named methods, fixtures and control profiles. It does not certify unsupported source physics or a blocked case.

## Reproducible conditions

Native input is decoded by the production TypeScript decoder, normalized by the production PSS/E model builder and solved by the same modules used by the web worker/offline HTML. The development oracle is the user's installed licensed PSS/E 36.5.0. Its outputs are not used to supply the browser solution. Detailed model values remain in ignored `private-re/`; published evidence contains aggregate differences.

The original synthetic RAWX networks are authored in `tools/psse-synthetic-cases.ts`. Their local SAV variants are created by `tools/psse-generate-sav.py`. Every uncached oracle run reloads its source. Cache keys include source SHA-256, method and exact options hash. FNSL/FDNS fixed controls use `[0,0,0,0,0,flat,qLimit,1]`; the standard reference mismatch setting is 0.001 MVA. Browser residual target for these comparisons is 1e-8 pu, up to 150 iterations. A positive mathematical result requires both solvers to converge. Reference failures remain explicit.

DCLF_2 uses `[0,0,1,1,0,1]`: no saved-voltage loss estimate, fixed phase control, saved base-case DC angles. DC comparison uses actual DCLF report MW (0.1 MW resolution) and API angle values. `abrnreal P/Q` after saving DC angles evaluates an AC circuit and is excluded from DC parity. The PSS/E-compatible DC tap policy is distinct from the optional tap-aware lossless approximation. DC does not solve Vm, Q, AC losses or AC current.

AC provisional acceptance limits are Vm 1e-4 pu, angle 0.05 degrees, P/Q and net terminal losses 0.5 MW/Mvar. Tap ratio threshold is 1e-5 pu. DC MW threshold is 0.051 MW to account for report rounding. Tighter observed differences are reported below; limits were not widened to hide failures. Angles use radians at the oracle API and degrees in the comparison. Transformer terminal orientation and circuit/winding identities are preserved. Net reactive branch loss includes its terminal shunts, so it may be negative.

## Run outcomes

There are **101 distinct experiment/version comparisons**: 13 BLOCKED, 6 DIFFERENCES, 81 PASS, 1 REFERENCE_NOT_CONVERGED. The 105 retained rows include 4 duplicate comparisons in overlapping groups; each source/method/start/Q-policy/reference-options/engine-version identity is counted once. These are profile/experiment counts, not independent model counts. Engine1 runs remain historical evidence, not new Engine2 reruns.

| Evidence group | Comparisons | PASS | Other states |
|---|---:|---:|---|
| [parity-lossless_dc-v2-real.json](evidence/psse-ac-dc/parity-lossless_dc-v2-real.json) (GA_PSSE_ENGINE_2) | 2 | 0 | DIFFERENCES: 2 |
| [parity-fdns_xb-bench.json](evidence/psse-ac-dc/parity-fdns_xb-bench.json) (GA_PSSE_ENGINE_1) | 1 | 1 | — |
| [parity-fdns_xb-examples.json](evidence/psse-ac-dc/parity-fdns_xb-examples.json) (GA_PSSE_ENGINE_1) | 3 | 0 | BLOCKED: 3 |
| [parity-fdns_xb-extended.json](evidence/psse-ac-dc/parity-fdns_xb-extended.json) (GA_PSSE_ENGINE_1) | 4 | 4 | — |
| [parity-fdns_xb-q-limits-active.json](evidence/psse-ac-dc/parity-fdns_xb-q-limits-active.json) (GA_PSSE_ENGINE_1) | 1 | 0 | REFERENCE_NOT_CONVERGED: 1 |
| [parity-fdns_xb-q-limits-warm-v2-new.json](evidence/psse-ac-dc/parity-fdns_xb-q-limits-warm-v2-new.json) (GA_PSSE_ENGINE_2) | 1 | 0 | BLOCKED: 1 |
| [parity-fdns_xb-sav.json](evidence/psse-ac-dc/parity-fdns_xb-sav.json) (GA_PSSE_ENGINE_1) | 7 | 7 | — |
| [parity-fdns_xb-switched.json](evidence/psse-ac-dc/parity-fdns_xb-switched.json) (GA_PSSE_ENGINE_1) | 4 | 4 | — |
| [parity-fdns_xb.json](evidence/psse-ac-dc/parity-fdns_xb.json) (GA_PSSE_ENGINE_1) | 8 | 8 | — |
| [parity-lossless_dc-bench.json](evidence/psse-ac-dc/parity-lossless_dc-bench.json) (GA_PSSE_ENGINE_1) | 1 | 0 | DIFFERENCES: 1 |
| [parity-lossless_dc-end-shunts.json](evidence/psse-ac-dc/parity-lossless_dc-end-shunts.json) (GA_PSSE_ENGINE_1) | 1 | 1 | — |
| [parity-lossless_dc-examples.json](evidence/psse-ac-dc/parity-lossless_dc-examples.json) (GA_PSSE_ENGINE_1) | 3 | 0 | BLOCKED: 3 |
| [parity-lossless_dc-extended.json](evidence/psse-ac-dc/parity-lossless_dc-extended.json) (GA_PSSE_ENGINE_1) | 3 | 3 | — |
| [parity-lossless_dc-negative-x.json](evidence/psse-ac-dc/parity-lossless_dc-negative-x.json) (GA_PSSE_ENGINE_1) | 1 | 1 | — |
| [parity-lossless_dc-real.json](evidence/psse-ac-dc/parity-lossless_dc-real.json) (GA_PSSE_ENGINE_1) | 1 | 0 | DIFFERENCES: 1 |
| [parity-lossless_dc-sav.json](evidence/psse-ac-dc/parity-lossless_dc-sav.json) (GA_PSSE_ENGINE_1) | 7 | 7 | — |
| [parity-lossless_dc-switched.json](evidence/psse-ac-dc/parity-lossless_dc-switched.json) (GA_PSSE_ENGINE_1) | 4 | 4 | — |
| [parity-lossless_dc-v2-core-loss.json](evidence/psse-ac-dc/parity-lossless_dc-v2-core-loss.json) (GA_PSSE_ENGINE_1) | 1 | 1 | — |
| [parity-lossless_dc-v2-new-raw.json](evidence/psse-ac-dc/parity-lossless_dc-v2-new-raw.json) (GA_PSSE_ENGINE_2) | 1 | 0 | BLOCKED: 1 |
| [parity-lossless_dc-v2-new.json](evidence/psse-ac-dc/parity-lossless_dc-v2-new.json) (GA_PSSE_ENGINE_1) | 1 | 0 | DIFFERENCES: 1 |
| [parity-lossless_dc-v2-pv-eligibility.json](evidence/psse-ac-dc/parity-lossless_dc-v2-pv-eligibility.json) (GA_PSSE_ENGINE_2) | 5 | 5 | — |
| [parity-lossless_dc-v2-tiny-precision.json](evidence/psse-ac-dc/parity-lossless_dc-v2-tiny-precision.json) (GA_PSSE_ENGINE_1) | 2 | 1 | DIFFERENCES: 1 |
| [parity-lossless_dc.json](evidence/psse-ac-dc/parity-lossless_dc.json) (GA_PSSE_ENGINE_1) | 8 | 8 | — |
| [parity-nr_polar-bench.json](evidence/psse-ac-dc/parity-nr_polar-bench.json) (GA_PSSE_ENGINE_1) | 1 | 1 | — |
| [parity-nr_polar-examples.json](evidence/psse-ac-dc/parity-nr_polar-examples.json) (GA_PSSE_ENGINE_1) | 3 | 0 | BLOCKED: 3 |
| [parity-nr_polar-extended.json](evidence/psse-ac-dc/parity-nr_polar-extended.json) (GA_PSSE_ENGINE_1) | 4 | 4 | — |
| [parity-nr_polar-fixed-q.json](evidence/psse-ac-dc/parity-nr_polar-fixed-q.json) (GA_PSSE_ENGINE_1) | 1 | 1 | — |
| [parity-nr_polar-q-limits-active.json](evidence/psse-ac-dc/parity-nr_polar-q-limits-active.json) (GA_PSSE_ENGINE_1) | 1 | 1 | — |
| [parity-nr_polar-q-limits-warm-real.json](evidence/psse-ac-dc/parity-nr_polar-q-limits-warm-real.json) (GA_PSSE_ENGINE_1) | 1 | 0 | BLOCKED: 1 |
| [parity-nr_polar-q-limits-warm-v2-new.json](evidence/psse-ac-dc/parity-nr_polar-q-limits-warm-v2-new.json) (GA_PSSE_ENGINE_2) | 1 | 0 | BLOCKED: 1 |
| [parity-nr_polar-sav.json](evidence/psse-ac-dc/parity-nr_polar-sav.json) (GA_PSSE_ENGINE_1) | 7 | 7 | — |
| [parity-nr_polar-switched.json](evidence/psse-ac-dc/parity-nr_polar-switched.json) (GA_PSSE_ENGINE_1) | 4 | 4 | — |
| [parity-nr_polar.json](evidence/psse-ac-dc/parity-nr_polar.json) (GA_PSSE_ENGINE_1) | 8 | 8 | — |

## Maximum, mean and P95 absolute differences

Each row uses all matched equipment quantities from PASS and DIFFERENCES comparisons retained in that evidence group after deduplication. Failed strict comparisons are included. P95 is calculated from the individual differences, not averaged percentiles. Empty quantities remain unavailable; DC has no Vm/Q/current/AC-loss claim.

| Evidence group | Quantity | Count | Maximum | Mean | P95 |
|---|---|---:|---:|---:|---:|
| lossless_dc-v2-real | vaDeg | 10101 | 0.00689369 | 0.00454033 | 0.00560363 |
| lossless_dc-v2-real | terminalPMw | 24574 | 0.246692 | 0.0239687 | 0.0479999 |
| fdns_xb-bench | vmPu | 1648 | 1.87363e-05 | 8.86894e-08 | 2.24165e-07 |
| fdns_xb-bench | vaDeg | 1648 | 0.00163208 | 2.8073e-05 | 5.79661e-05 |
| fdns_xb-bench | pgMw | 313 | 0.000149952 | 3.08206e-06 | 1.52588e-05 |
| fdns_xb-bench | qgMvar | 313 | 0.00701873 | 0.000153136 | 0.000461415 |
| fdns_xb-bench | terminalPMw | 5204 | 0.0367467 | 0.000162947 | 0.0003669 |
| fdns_xb-bench | terminalQMvar | 5204 | 0.0139929 | 7.50858e-05 | 0.000217864 |
| fdns_xb-bench | branchLossMw | 2602 | 0.000413635 | 3.33173e-06 | 1.24302e-05 |
| fdns_xb-bench | branchLossMvar | 2602 | 0.0020554 | 1.91431e-05 | 8.88761e-05 |
| fdns_xb-extended | vmPu | 12 | 6.90525e-08 | 2.44954e-08 | 6.90525e-08 |
| fdns_xb-extended | vaDeg | 12 | 7.72485e-06 | 4.02784e-06 | 7.72485e-06 |
| fdns_xb-extended | pgMw | 8 | 0.000232126 | 9.89336e-05 | 0.000232126 |
| fdns_xb-extended | qgMvar | 8 | 0.000129449 | 7.47038e-05 | 0.000129449 |
| fdns_xb-extended | terminalPMw | 24 | 0.000137384 | 7.20875e-05 | 0.000137001 |
| fdns_xb-extended | terminalQMvar | 24 | 0.000114627 | 6.05909e-05 | 0.000114627 |
| fdns_xb-extended | branchLossMw | 12 | 1.02266e-05 | 2.27884e-06 | 1.02266e-05 |
| fdns_xb-extended | branchLossMvar | 12 | 2.48963e-05 | 9.00229e-06 | 2.48963e-05 |
| fdns_xb-sav | vmPu | 21 | 3.8997e-07 | 4.47194e-08 | 2.91918e-07 |
| fdns_xb-sav | vaDeg | 21 | 2.68117e-05 | 6.46783e-06 | 1.92621e-05 |
| fdns_xb-sav | pgMw | 14 | 0.000823967 | 0.000165504 | 0.000823967 |
| fdns_xb-sav | qgMvar | 14 | 0.000393372 | 0.000144879 | 0.000393372 |
| fdns_xb-sav | terminalPMw | 41 | 0.000486693 | 0.000136968 | 0.000349211 |
| fdns_xb-sav | terminalQMvar | 41 | 0.000384086 | 9.39246e-05 | 0.00033752 |
| fdns_xb-sav | branchLossMw | 20 | 0.000164073 | 1.03686e-05 | 6.32896e-06 |
| fdns_xb-sav | branchLossMvar | 20 | 0.000168161 | 3.02475e-05 | 0.000137369 |
| fdns_xb-sav | tapPu | 3 | 0 | 0 | 0 |
| fdns_xb-switched | vmPu | 12 | 1.30885e-07 | 5.48475e-08 | 1.30885e-07 |
| fdns_xb-switched | vaDeg | 12 | 7.61011e-06 | 2.59801e-06 | 7.61011e-06 |
| fdns_xb-switched | pgMw | 8 | 0.000227105 | 7.31801e-05 | 0.000227105 |
| fdns_xb-switched | qgMvar | 8 | 9.97831e-05 | 5.87099e-05 | 9.97831e-05 |
| fdns_xb-switched | terminalPMw | 24 | 0.000135123 | 6.50141e-05 | 0.000134908 |
| fdns_xb-switched | terminalQMvar | 24 | 7.69569e-05 | 4.51424e-05 | 7.69569e-05 |
| fdns_xb-switched | branchLossMw | 12 | 6.2161e-06 | 3.02618e-06 | 6.2161e-06 |
| fdns_xb-switched | branchLossMvar | 12 | 1.13843e-05 | 6.15757e-06 | 1.13843e-05 |
| fdns_xb | vmPu | 24 | 3.81011e-07 | 5.75614e-08 | 2.81603e-07 |
| fdns_xb | vaDeg | 24 | 2.67138e-05 | 6.51596e-06 | 1.93433e-05 |
| fdns_xb | pgMw | 16 | 0.000827612 | 0.000173073 | 0.000827612 |
| fdns_xb | qgMvar | 16 | 0.000425993 | 0.000131989 | 0.000425993 |
| fdns_xb | terminalPMw | 47 | 0.000488178 | 0.000148851 | 0.000354573 |
| fdns_xb | terminalQMvar | 47 | 0.000385599 | 8.7403e-05 | 0.000336584 |
| fdns_xb | branchLossMw | 23 | 0.000164109 | 9.31425e-06 | 6.39579e-06 |
| fdns_xb | branchLossMvar | 23 | 0.000168586 | 2.96001e-05 | 0.000137497 |
| fdns_xb | tapPu | 3 | 2.86102e-08 | 9.53674e-09 | 2.86102e-08 |
| lossless_dc-bench | vaDeg | 1648 | 0.00103901 | 0.00035232 | 0.000693883 |
| lossless_dc-bench | terminalPMw | 5204 | 0.0533194 | 0.0234763 | 0.0474643 |
| lossless_dc-end-shunts | vaDeg | 3 | 7.23089e-07 | 2.63764e-07 | 7.23089e-07 |
| lossless_dc-end-shunts | terminalPMw | 6 | 0.0333333 | 0.0333333 | 0.0333333 |
| lossless_dc-extended | vaDeg | 9 | 2.56132e-07 | 1.24153e-07 | 2.56132e-07 |
| lossless_dc-extended | terminalPMw | 18 | 0 | 0 | 0 |
| lossless_dc-negative-x | vaDeg | 3 | 1.82138e-07 | 7.5891e-08 | 1.82138e-07 |
| lossless_dc-negative-x | terminalPMw | 6 | 0.0333333 | 0.0333333 | 0.0333333 |
| lossless_dc-real | vaDeg | 5029 | 0.00628441 | 0.004147 | 0.00517335 |
| lossless_dc-real | terminalPMw | 12244 | 0.246692 | 0.0239553 | 0.0480102 |
| lossless_dc-sav | vaDeg | 21 | 8.44284e-07 | 1.66701e-07 | 5.22862e-07 |
| lossless_dc-sav | terminalPMw | 41 | 0.0499969 | 0.0229668 | 0.0333373 |
| lossless_dc-switched | vaDeg | 12 | 1.99214e-07 | 1.22671e-07 | 1.99214e-07 |
| lossless_dc-switched | terminalPMw | 24 | 0.0333333 | 0.0333333 | 0.0333333 |
| lossless_dc-v2-core-loss | vaDeg | 3 | 2.56132e-07 | 1.24153e-07 | 2.56132e-07 |
| lossless_dc-v2-core-loss | terminalPMw | 6 | 0 | 0 | 0 |
| lossless_dc-v2-new | vaDeg | 5072 | 0.00689369 | 0.00493032 | 0.00575533 |
| lossless_dc-v2-new | terminalPMw | 12330 | 0.244677 | 0.023982 | 0.0479722 |
| lossless_dc-v2-pv-eligibility | vaDeg | 15 | 4.06965e-07 | 2.08167e-07 | 4.06965e-07 |
| lossless_dc-v2-pv-eligibility | terminalPMw | 30 | 0.0333333 | 0.0266667 | 0.0333333 |
| lossless_dc-v2-tiny-precision | vaDeg | 6 | 0.00392263 | 0.00131288 | 0.00392263 |
| lossless_dc-v2-tiny-precision | terminalPMw | 12 | 0.167503 | 0.065682 | 0.167503 |
| lossless_dc | vaDeg | 24 | 8.28472e-07 | 2.12717e-07 | 7.2689e-07 |
| lossless_dc | terminalPMw | 47 | 0.05 | 0.0242914 | 0.0333333 |
| nr_polar-bench | vmPu | 1648 | 1.87363e-05 | 8.91892e-08 | 2.24165e-07 |
| nr_polar-bench | vaDeg | 1648 | 0.00162931 | 2.73653e-05 | 5.87054e-05 |
| nr_polar-bench | pgMw | 313 | 5.75906e-05 | 2.78697e-06 | 1.52588e-05 |
| nr_polar-bench | qgMvar | 313 | 0.00701873 | 0.000153001 | 0.000461416 |
| nr_polar-bench | terminalPMw | 5204 | 0.0367429 | 0.000162952 | 0.000362407 |
| nr_polar-bench | terminalQMvar | 5204 | 0.0139929 | 7.50655e-05 | 0.000215985 |
| nr_polar-bench | branchLossMw | 2602 | 0.000406006 | 3.30089e-06 | 1.2398e-05 |
| nr_polar-bench | branchLossMvar | 2602 | 0.0020554 | 1.91646e-05 | 8.88761e-05 |
| nr_polar-extended | vmPu | 12 | 4.81952e-08 | 2.87337e-08 | 4.81952e-08 |
| nr_polar-extended | vaDeg | 12 | 2.79103e-07 | 8.15433e-08 | 2.79103e-07 |
| nr_polar-extended | pgMw | 8 | 1.10607e-05 | 6.54129e-06 | 1.10607e-05 |
| nr_polar-extended | qgMvar | 8 | 6.22459e-05 | 5.11993e-05 | 6.22459e-05 |
| nr_polar-extended | terminalPMw | 24 | 8.68346e-06 | 3.9372e-06 | 7.78801e-06 |
| nr_polar-extended | terminalQMvar | 24 | 3.21243e-05 | 2.58719e-05 | 3.21243e-05 |
| nr_polar-extended | branchLossMw | 12 | 5.99313e-06 | 2.96312e-06 | 5.99313e-06 |
| nr_polar-extended | branchLossMvar | 12 | 1.92211e-05 | 5.23024e-06 | 1.92211e-05 |
| nr_polar-fixed-q | vmPu | 3 | 6.62106e-08 | 5.18018e-08 | 6.62106e-08 |
| nr_polar-fixed-q | vaDeg | 3 | 1.62227e-07 | 1.00349e-07 | 1.62227e-07 |
| nr_polar-fixed-q | pgMw | 2 | 4.02812e-06 | 3.92141e-06 | 4.02812e-06 |
| nr_polar-fixed-q | qgMvar | 2 | 1.53506e-06 | 7.67531e-07 | 1.53506e-06 |
| nr_polar-fixed-q | terminalPMw | 6 | 1.00221e-05 | 3.52218e-06 | 1.00221e-05 |
| nr_polar-fixed-q | terminalQMvar | 6 | 4.03052e-06 | 1.34541e-06 | 4.03052e-06 |
| nr_polar-fixed-q | branchLossMw | 3 | 1.14421e-05 | 4.93973e-06 | 1.14421e-05 |
| nr_polar-fixed-q | branchLossMvar | 3 | 3.08225e-06 | 1.36307e-06 | 3.08225e-06 |
| nr_polar-q-limits-active | vmPu | 3 | 1.08211e-07 | 7.70457e-08 | 1.08211e-07 |
| nr_polar-q-limits-active | vaDeg | 3 | 4.11319e-07 | 1.89435e-07 | 4.11319e-07 |
| nr_polar-q-limits-active | pgMw | 2 | 1.0433e-05 | 7.12387e-06 | 1.0433e-05 |
| nr_polar-q-limits-active | qgMvar | 2 | 2.56109e-06 | 1.28125e-06 | 2.56109e-06 |
| nr_polar-q-limits-active | terminalPMw | 6 | 3.88131e-06 | 2.67907e-06 | 3.88131e-06 |
| nr_polar-q-limits-active | terminalQMvar | 6 | 2.75078e-06 | 1.16237e-06 | 2.75078e-06 |
| nr_polar-q-limits-active | branchLossMw | 3 | 4.64384e-06 | 2.4363e-06 | 4.64384e-06 |
| nr_polar-q-limits-active | branchLossMvar | 3 | 1.34936e-06 | 8.53219e-07 | 1.34936e-06 |
| nr_polar-sav | vmPu | 21 | 9.72311e-08 | 1.40153e-08 | 8.09469e-08 |
| nr_polar-sav | vaDeg | 21 | 1.23606e-05 | 1.02946e-06 | 6.22391e-06 |
| nr_polar-sav | pgMw | 14 | 0.000342502 | 2.596e-05 | 0.000342502 |
| nr_polar-sav | qgMvar | 14 | 0.000144144 | 4.17313e-05 | 0.000144144 |
| nr_polar-sav | terminalPMw | 41 | 0.000233631 | 2.45416e-05 | 0.000113889 |
| nr_polar-sav | terminalQMvar | 41 | 0.000144809 | 2.11268e-05 | 8.38794e-05 |
| nr_polar-sav | branchLossMw | 20 | 2.36278e-05 | 3.89082e-06 | 1.04347e-05 |
| nr_polar-sav | branchLossMvar | 20 | 0.000158703 | 2.13165e-05 | 9.9225e-05 |
| nr_polar-sav | tapPu | 3 | 0 | 0 | 0 |
| nr_polar-switched | vmPu | 12 | 3.8147e-08 | 2.00922e-08 | 3.8147e-08 |
| nr_polar-switched | vaDeg | 12 | 1.99222e-07 | 6.10368e-08 | 1.99222e-07 |
| nr_polar-switched | pgMw | 8 | 8.45366e-06 | 5.46394e-06 | 8.45366e-06 |
| nr_polar-switched | qgMvar | 8 | 4.86579e-05 | 4.61017e-05 | 4.86579e-05 |
| nr_polar-switched | terminalPMw | 24 | 1.02677e-05 | 4.10351e-06 | 1.02677e-05 |
| nr_polar-switched | terminalQMvar | 24 | 3.47857e-05 | 2.15248e-05 | 3.43084e-05 |
| nr_polar-switched | branchLossMw | 12 | 6.22211e-06 | 2.13257e-06 | 6.22211e-06 |
| nr_polar-switched | branchLossMvar | 12 | 4.37059e-06 | 2.63523e-06 | 4.37059e-06 |
| nr_polar | vmPu | 24 | 8.35766e-08 | 3.28701e-08 | 7.17947e-08 |
| nr_polar | vaDeg | 24 | 1.19638e-05 | 9.03275e-07 | 6.12602e-06 |
| nr_polar | pgMw | 16 | 0.000346147 | 2.7228e-05 | 0.000346147 |
| nr_polar | qgMvar | 16 | 0.000174448 | 6.01848e-05 | 0.000174448 |
| nr_polar | terminalPMw | 47 | 0.000235788 | 2.47829e-05 | 0.000114479 |
| nr_polar | terminalQMvar | 47 | 0.000143233 | 3.22277e-05 | 9.2176e-05 |
| nr_polar | branchLossMw | 23 | 2.36633e-05 | 3.46475e-06 | 1.04731e-05 |
| nr_polar | branchLossMvar | 23 | 0.000159128 | 1.9342e-05 | 9.93524e-05 |
| nr_polar | tapPu | 3 | 2.86102e-08 | 9.53674e-09 | 2.86102e-08 |

## Strict DC differences and the initial engineering targets

The strict DC flow threshold remains 0.051 MW. The following converged DC cases exceed it and remain DIFFERENCES. Engineering bounds are evaluated separately for each row; they do not establish full source physics or strict PSS/E equivalence.

| Case | Source coverage | Maximum MW difference | Maximum angle difference (degrees) | Matched terminal MW values | Missing identities | Initial engineering bounds |
|---|---|---:|---:|---:|---:|---|
| 20261014_1200_SN3_TR0.sav (GA_PSSE_ENGINE_2) | PARTIAL | 0.246692 | 0.00628441 | 12244 | 0 | Met for compared P/angle only |
| 20261026_1600_SN1_TR0.sav (GA_PSSE_ENGINE_2) | PARTIAL | 0.244677 | 0.00689369 | 12330 | 0 | Met for compared P/angle only |
| bench.sav (GA_PSSE_ENGINE_1) | PARTIAL | 0.0533194 | 0.00103901 | 5204 | 0 | Met for compared P/angle only |
| 20261014_1200_SN3_TR0.sav (GA_PSSE_ENGINE_1) | PARTIAL | 0.246692 | 0.00628441 | 12244 | 0 | Met for compared P/angle only |
| 20261026_1600_SN1_TR0.sav (GA_PSSE_ENGINE_1) | PARTIAL | 0.244677 | 0.00689369 | 12330 | 0 | Met for compared P/angle only |
| ill-conditioned.rawx (GA_PSSE_ENGINE_1) | SUPPORTED | 0.167503 | 0.00392263 | 6 | 0 | Met for compared P/angle only |

The real-model DC result contains all 6,851 original bus rows. The reference comparison covers 5,029 active buses and 12,244 directed terminal MW values, with no missing matched identities. The ideal-link reduction contracts 928 source switches and reconstructs their terminal flows with a weighted Laplacian. Cached-reference cycle projection differs by at most 0.033333 MW, within report rounding. The remaining worst full-network MW difference is not attributed to a proven single cause; it remains a documented numerical/model difference rather than being hidden with a wider strict tolerance. Evidence gaStatus describes numerical residual convergence; the public application and exports label a converged PARTIAL result LIMITED_PROFILE, not unqualified readiness or equivalence.

## Historical V1 source fidelity and old-model boundary

Fresh native SAV validation against the installed development-only oracle checked **277,131 source quantities with zero mismatches** (`evidence/psse-ac-dc/native-oracle.json`). The installed reference SAV and the requested Downloads SAV have identical SHA-256. Both real SAV and RAW decoded 6,851 buses, 2,403 lines, 3,703 transformers, 2,920 generators and 2,520 loads.

The independent SAV/RAW field comparison checked 239,048 quantities with no missing equipment identities and found seven source-state differences: four IDE values, one Pg and two Qg values. These are retained in `source-parity.json`; the files are not forced into one identical state. Native SAV byte fidelity and cross-file state parity are separate findings.

The real source has 227 active voltage-droop control records and 473 active remote-regulating machines. These require validated AC control equations; a numerically converged reduced problem cannot establish full AC source coverage. The authoritative per-method readiness and measured real-case outcome are in the evidence JSON and model-fidelity report. A BLOCKED run is not a large-network solver convergence/performance pass.

Local PSS/E on the real SAV, warm start with Q limits enabled, FNSL fixed controls reached solved=0 in two iterations; system mismatch was approximately 0.01299 MVA. The same family with Q limits ignored failed. FDNS at the tight reference setting stopped through nondivergence with solved=3, approximately 0.01617 MVA total mismatch, and remains a reference failure. These observations demonstrate why source saved values, ierr=0 and chosen control policy are not interchangeable convergence evidence.

## Corrections established by the first parity gate

The initial run is preserved as `first-parity-findings.json`. It caught source YQ sign, saved slack Pg in calculated output, and inappropriate Q clipping when limits were disabled. These were corrected and checked again against the same cached references. Source YQ is positive for capacitive admittance, so reactive load consumption is QL + IQ·V − YQ·V². Three-winding star reuse, per-unit terminal shunts, secondary-tap impedance and CM=2 were independently exercised.

Multiple-generator active/reactive sharing is not inferred from RMPCT. Where individual dispatch is undetermined, the model exposes aggregate generation and marks individual values unavailable. Unverified automatic taps, phase control, switched-shunt control, remote/droop AC controls, HVDC/FACTS/induction models and low-voltage load characteristics must retain explicit capability restrictions. See `MODEL_FIDELITY_REPORT.md`, `ARCHITECTURE_DECISIONS.md` and `PSSE_SOLVER_RESEARCH.md` for the exact scope and source equations.

## Control-state scope

Tap differences above compare the fixed source transformer ratios, not automatic tap-controller operation. The four switched-shunt variants compare their retained initial fixed electrical state, not a discrete/continuous control search. The active-Q-limit and zero-range fixed-Q fixtures exercise the corresponding implemented bus-type/output rules; the failed FDNS active-Q oracle remains excluded from positive acceptance. There is no claimed statistical parity for unimplemented automatic control states, distributed slack or area interchange. Their absence cannot be certified by a small voltage mismatch.
