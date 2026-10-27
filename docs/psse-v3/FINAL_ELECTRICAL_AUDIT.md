# Final electrical audit — 2026-10-27

**Both real SAV cases genuinely converge in GA's independent sparse polar Newton engine under the explicit saved-voltage/fixed-control approximation.** Their expanded physical bus and branch outputs satisfy independently reconstructed P/Q balance. Both results must remain `SOLVED_APPROXIMATE`; these measurements do not certify full remote regulation, droop, automatic controls, or large-case FDNS support.

The audit used the current working tree on `fix/psse-v1-real-model-parity`, based on `bf0dddb9613b5631e2ca14582e7cd12679906851`. Read the implementation commit together with this report. No Siemens solver was invoked by the native calculation. Cached, separately converged licensed FNSL results supplied the comparison.

## Scope, sources and reproduction

- Source/official semantics and reference cache provenance: [AC_REFERENCE_HANDOFF.md](AC_REFERENCE_HANDOFF.md), including PSS/E 36.5 *DataFormats* printed pp.19–25, 32–44. The mandatory `Downloads/GA_PSSE_YTBS_FULL_AC_TEKNIK_REFERANS.md` was read as reference data.
- Source SHA-256: 6,875 buses `8cc8ccfeca14001c392d2bebf578caafe61589c431f071f64db235a81dbbe60b`; 6,851 buses `b57af8d4990a61d530db72276b3e89016d134bf670008da0c28c93b78df20cbf`.
- Reference: `private-re/solver-reference/<source-sha>-fnsl-414d5d7ca070ca60f0abc24f3a0fa653c505385b119bd53b778544a91eb3b981/reference.json`. Both have `solved=0`, options `[0,0,0,0,0,0,0,1]`, tolerance 0.001 MVA, and 9 / 2 reference iterations.
- Public aggregates: [electrical-audit.json](../../evidence/psse-v3/electrical-audit.json). Full native results remain ignored under `private-re/ac-v3-electrical-audit/<sha>/native-result.json`. No private grid identities, coordinates, or complete model are published.

```powershell
node --import tsx tools/psse-v3-electrical-audit.ts 'private-re/ac-v3-reference/20261026_1600_SN1_TR0.sav' 'C:/Program Files/PTI/PSSE36/36.5/control1/20261014_1200_SN3_TR0.sav'
node --import tsx --test tests/unit/psse-ac-electrical-audit.test.ts
npm run typecheck
```

The audit harness reports absolute maximum, mean and nearest-rank P95 errors. It matches bus numbers, generator bus + machine ID, directed branch endpoint numbers + circuit ID, and three-winding endpoint numbers + circuit ID + winding. There are **zero unmatched active buses, generators, or branch terminals** in both real-case comparisons. Inactive buses and equipment are excluded from numerical parity. These particular real snapshots contain no three-winding devices; the independent public fixture checks their physical/star balance separately.

## Numerical convergence and independently reconstructed balance

GA used `SOURCE_SAVED`, reactive limits enabled, `tolerancePu=1e-6`, 80 maximum iterations and 12 maximum Q-limit rounds. At the 100 MVA base the requested tolerance is **0.0001 MVA**, tighter than the cached FNSL profile. GA did not widen tolerance to obtain convergence.

| Measurement | 6,875 source buses | 6,851 source buses |
|---|---:|---:|
| Energized physical buses checked | 5,072 | 5,029 |
| Total numerical nodes after contraction, including inactive | 5,967 | 5,940 |
| Ideal links / cycle rank | 926 / 18 | 928 / 17 |
| Actual NR updates / Q-limit outer rounds | 1 / 0 | 1 / 0 |
| Initial effective max P mismatch, MW | 0.00224519 | 0.00187818 |
| Initial effective max Q mismatch, Mvar | 0.01700290 | 0.00223837 |
| Final independent physical-bus max P residual, MW | 1.27064e-8 | 1.01210e-9 |
| Final independent physical-bus max Q residual, Mvar | 1.81510e-7 | 5.01866e-9 |
| Final independent physical-bus max complex residual, MVA | 1.81580e-7 | 5.03905e-9 |
| Global P balance residual, MW | -1.17363e-8 | -1.03319e-9 |
| Global Q balance residual, Mvar | -2.45385e-7 | -1.41372e-8 |
| Ideal-link recovery max complex KCL residual, MVA | 8.13440e-8 | 1.40163e-9 |

Final KCL was reconstructed independently from the **returned physical-bus generation, both returned terminals of every active branch, source normalized ZIP loads at solved Vm, and fixed/saved switched-shunt admittances**. It did not reuse Newton's residual arrays or final Ybus multiplication. Every active branch has available terminal powers. Net branch losses equal the sum of their terminals exactly in the output representation.

The global equation is `generation − voltage-dependent load − bus-shunt consumption − sum(branch terminal powers) = residual`. Capacitive reactive injections can make total net branch Q loss negative; this is included in the balance.

| Global component | 6,875 buses, MW / Mvar | 6,851 buses, MW / Mvar |
|---|---:|---:|
| Generation | 39638.268135 / -1729.358646 | 43650.524830 / 2013.401231 |
| ZIP load | 38736.315708 / 386.276018 | 42749.638097 / 786.632904 |
| Bus-shunt consumption | 0 / 7529.249050 | 0 / 10710.373656 |
| Net branch terminal sum | 901.952426 / -9644.883714 | 900.886733 / -9483.605329 |

All 1,568 / 1,900 active machines have available P and Q in these cases. Summing machine outputs agrees with bus generation totals exactly; no contracted-node aggregate is repeated at each physical bus. Where another case contains multiple unobservable regulating units, the implementation reports machine dispatch unavailable and marks its bus-level recovery allocation approximate; this audit does not infer individual-machine parity from a shared bus aggregate.

## FNSL parity

Each cell contains **maximum / mean / P95 absolute difference**. Angles are compared in degrees with circular wrapping. Branch losses in this table use the same definition on both sides: the sum of the two matched directed terminal powers, including charging and terminal shunts.

| Quantity | 6,875 buses | 6,851 buses |
|---|---|---|
| Vm, pu | 1.83919e-5 / 1.07252e-6 / 1.82167e-6 | 1.44871e-6 / 4.59672e-7 / 1.03171e-6 |
| Va, degrees | 1.20193e-4 / 4.33716e-5 / 9.61404e-5 | 6.68496e-5 / 1.61145e-5 / 3.81586e-5 |
| Machine Pg, MW | 0.00119560 / 1.26087e-6 / 2.86102e-6 | 0.000426433 / 6.67967e-7 / 1.66893e-6 |
| Machine Qg, Mvar | 0.01026672 / 3.99161e-5 / 1.77622e-5 | 0.00433034 / 1.28523e-5 / 2.48849e-6 |
| Branch terminal P, MW | 0.000744578 / 1.34733e-5 / 5.96873e-5 | 0.000278371 / 6.56980e-6 / 2.76346e-5 |
| Branch terminal Q, Mvar | 0.00956691 / 0.000125898 / 0.000536946 | 0.00248817 / 6.32017e-5 / 0.000230359 |
| Net branch P loss, MW | 7.54710e-5 / 1.86573e-6 / 6.47335e-6 | 9.20966e-5 / 1.77988e-6 / 6.17739e-6 |
| Net branch Q loss, Mvar | 0.00103463 / 3.45306e-5 / 0.000148925 | 0.000512660 / 2.92598e-5 / 0.000124647 |

The comparisons contain 12,330 / 12,244 directed active branch terminals, including 1,852 / 1,856 ideal-link terminals. Their ideal-link maximum terminal differences are 0.000700435 / 0.000240463 MW and 0.00397567 / 0.00175657 Mvar.

**Do not equate the cached API's `PLOSS`/`QLOSS` fields with these net terminal sums.** Those fields measurably differ from the cached reference's own terminal sums in these snapshots. The JSON preserves direct native-net versus reported-field differences as diagnostics with an explicit caution. These direct differences are not used as equivalent-quantity parity failures. The terminal-sum balance above is independently checkable without assuming an undocumented reported-loss decomposition.

## Boundary conditions, approximations and corrected audit findings

- **WMOD:** 768 / 975 active mode-3 machines use PF-derived fixed Q; 334 / 429 mode-4 machines retain source QG. Their maximum independently calculated fixed-Q output errors are 6.30e-14 / 4.87e-13 Mvar. No real mode-3 unit has zero PF. The audit identified that zero PF was accepted as Q=0; the implementation now rejects it. Known regulating-machine Q-limit violations are zero in both runs. These warm starts required no PV→PQ transition; the existing small Q-limit fixtures exercise that transition separately.
- **Remote control:** 442 / 460 effective regulating devices hold source Q. These counts exclude already fixed-Q mode-3 devices and must not be added to overlapping WMOD/IREG counts. The solver does not claim to enforce remote VS or full RMPCT control equations.
- **Local saved voltage:** 9 / 13 local regulators have saved Vm differing from VS by more than 1e-5 pu, with maximum differences 0.0370689 / 0.0304309 pu. `SOURCE_SAVED` intentionally holds those saved local voltages in this profile. The audit caused an explicit `LOCAL_REGULATION_SOURCE_SAVED_VOLTAGE_HELD` finding/count and approximate classification to be added; these are not conventional PV setpoint enforcement claims.
- **Droop:** both real sources have zero assigned DROOPNAME. Active unreferenced records have no steady-state equation effect. Assigned Q(V) curves in another case are explicitly approximated by saved Q, with a finding; full droop equations remain unvalidated.
- **Ideal links:** physical voltages expand to every source bus. Charging and terminal shunts survive contraction; the tests check both conductance and susceptance. Tree flows satisfy nodal balance. Cyclic flows use the disclosed deterministic source-absolute-X weighted allocation; individual ideal-loop flows are not claimed unique. Real-cycle validation here uses these snapshots' source weights, not arbitrary signed/zero-weight loop equivalence.
- **Bypass:** the audit found that valid nonzero BP was contracted and then blocked unconditionally. The implementation now errors only on unknown/invalid BP; the focused test verifies valid bypass, retained shunts and per-bus KCL.
- **Unchanged network:** hashes before/after each real AC calculation match. The public ideal-link and perturbation fixtures also assert input-network immutability. AC contraction does not mutate the network subsequently used by DC/DGS. This audit does not replace the repository's separate DC and DGS regression checks.
- **Remaining scope:** automatic tap/shunt adjustment, full remote multi-device controls, assigned droop, low-voltage source load curves, and real-case FDNS parity are not certified. Unsupported profiles must remain explicitly blocked or approximated and labelled; this report certifies only the measured NR profile.

Finding-record counts in the JSON can include both capability and applied-control findings for the same equipment. Equipment counts above use the applied profile's diagnostic counters rather than adding duplicate finding records.

## Source mismatch versus initialization

The licensed **loaded source** maximum complex mismatches are 0.01030813 / 0.00225937 MVA. The **GA effective profile's initial** P/Q mismatches are recorded separately above; they use contraction and the explicit held-Q/saved-voltage boundary conditions, so they are not identical residual contracts.

The harness also evaluates a clearly labelled hypothetical PV-setpoint overwrite at the same source angles. It produces initial maxima of **2.02693 MW / 130.39943 Mvar** and **13.23419 MW / 131.60411 Mvar**. Those larger numbers are not reported as the untouched `SOURCE_SAVED` mismatch. The actual measured NR runs reduce their effective initial residuals through a sparse Jacobian solve to the final physical balances above.

## Perturbation and focused tests

The public three-bus fixture was solved, its solved Vm/Va reused as the next initial state, and its P/Q load increased by 20%. GA performed **three actual Newton updates**:

`0.2600000001 → 0.00243226173 → 4.88762883e-7 → 1.89848137e-14 pu`.

The final maximum voltage change is **0.00699025 pu**, and independent output KCL passes. This demonstrates equation solving after an operating-point change, beyond returning saved voltages.

Focused electrical tests: **4/4 passed**, covering ideal tree/cycle shunts and physical KCL, valid BP bypass, three-winding physical/star balance, and the load perturbation. `npm run typecheck` passed after these changes. The aggregate evidence contains the real-case residual histories and perturbation measurements; the four focused tests do not invoke PSS/E.
