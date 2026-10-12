# Fresh real-data numerical and PF comparison acceptance

Fresh runs use `tools/engineering-real-acceptance.ts` (Node native engine) and an ignored SN3 exact-portable/real-worker harness. No cached result substitutes for new import/LF/N-1/SC. Full private proofs, source paths, settings, scenario/outage identities, native FIDs, source audit and raw snapshots remain in ignored `local-benchmark-results/engineering-20261012`. No full model/PF output or native ID list is committed.

## Dataset and run inventory

| Model | Model ZIP SHA-256 | PF reference ZIP SHA-256 | Reference version |
|---|---|---|---|
| SN3, 20261007_1400 | `854b098802a0a6c4a45c03b9702fd9b891225dc96c876781a283c488ccc607a7` | `181e2c2770ffdec51059f617c36733999b58d3f8cd5a5d12a6c1df2b744e496e` | actual manifest 24.0.7 |
| SN4, 20261008_1000 | `3f07133052e256e75b0ddcdb00cc1500b03ee01fb9252b00fab17297de88728c` | `2e8b79be7f3327c47829e96c5d62daad60dd9c8d0b2e7143cc8fc0487e64eda4` | actual manifest 24.0.7 |
| SN7, 20261004_1600 | `a9a0c7a17eb8d57e5c3687e6d7c9f4da8501db912eb6caccd0cd3e96bd811797` | unavailable | version not inferred |

Models are the actual `.local-fixtures/powerfactory/SN3` and `SN4` ZIPs and locally found SN7 ZIP. B0 is an empty scenario overlay; 100 MVA is the native system base. SC requests explicitly use 50 Hz; native frequency verification is **NOT_RECORDED**, not inferred from the PF version. Actual PF method/control manifests are retained independently. Source settings remain default droop + distributed adjustable loads; PF control context supplies native eligibility/participation inputs for SN3/SN4, not solved voltages/powers as guesses. SN7 lacks that independent reference context and reports active balance PARTIAL.

| Fresh result | SN3 | SN4 | SN7 |
|---|---:|---:|---:|
| LF electrical buses / branches | 4077 / 5140 | 4088 / 5141 | 4062 / 5149 |
| LF residual MW | 2.0407307441128175e-8 | 2.09180264776343e-7 | 5.093170329928398e-9 |
| OA N-1 catalog | 660 | 664 | 651 |
| Actual selected AC attempts / numerical solutions | 2 / 2 | 2 / 2 | 2 / 2 |
| AC_VERIFIED / AC_UNVERIFIED | 0 / 660 | 0 / 664 | 0 / 651 |
| DC_SCREENED in selected scope | 1 | 1 | 1 |
| OA SC physical / electrical targets | 6278 / 500 | 6368 / 505 | 6340 / 491 |
| Native selected 3PH faults BLOCKED | 3 | 3 | 3 |
| Distinct diagnostic selected faults calculated | 3 | 3 | 3 |
| Requested 2016 faults BLOCKED / factors / RHS | 3 / 0 / 0 | 3 / 0 / 0 | 3 / 0 / 0 |

Each supplied BASE is single-island. Each selected islanding POST explicitly retains an unsupplied component. The full graph remains the solver input; YTM filters choose targets/outages and presentation. SC aliases reuse driving points: SN3 totals five calculated physical records, three RHS, one factorization and two reuses; SN4/SN7 later alias batches require zero additional RHS/factors. These are sparse mathematical diagnostics, not IEC acceptance.

Native source gaps block selected SC faults. The separate user-authorized diagnostic profile explicitly supplies missing machine R/X, converter phase/terminal basis, external-grid c_source and mixed-base normalization; assumptions/native source counts remain in proof. It is NETWORK_APPROXIMATION. Ip/Ib/Ith remain null for every real result.

## Commit and numerical preservation

SN3 real-worker/portable run and SN7 Node run were performed at `d5e8b10`; SN3 artifact SHA-256 `79d7054d7316bf7c1637365c149dde22c080b3244bc5f75a7dbe83258297862f`. SN4 fresh full run was at `f9f8621`; after the residual gate fix, only its two affected POSTs were re-solved at `d5e8b10`. Their entire numerical map snapshots are byte-hash identical before/after; residuals 2.3940605053951458e-8 and 3.0006503948243335e-7 MW. No import/LF/SC was unnecessarily repeated.

The final later change is SC batch and tab presentation, not any electrical equation. Final source/portable/UI/CI provenance is recorded in reports 13–15. SN3's BASE residual and 4077/5140 cardinality match the prior main acceptance exactly; protected LF/DC numerical sources have no diff from `a3cf862`.

The real UI helper initially exposed a caller-provenance mismatch: Node LF identities omitted Application's active-settings hash and source-context hash. The helper now uses the official identity helpers. SN4 LF was re-solved only to obtain a genuine Application-compatible result, without rewriting an old identity or bypassing the stale gate. The complete buses/branches/generator numerical hash remains identical. The 169 MB genuine snapshot is served through same-origin loopback HTTP rather than one oversized CDP message; data/catalog are not reduced.

## PF gates and limits

LF certified comparable observations: **0** for both available references. The method/control evidence does not permit certified statistics. N-1 references do not supply a matching full POST matrix for these selected native controls; PF parity is NOT_COMPARABLE. SC electrical partition audits reject missing membership and, for some targets, nominal-base mismatch; norm/source applicability also remains unaccepted. Certified SC observations: **0**. MAE/RMSE/P95/max and parity percentages are null/unavailable, never zero-error claims.

SN7 S1/S2 is a **new controlled test scenario**, not the original historical S2. Two cumulative native line/transformer maneuvers converge numerically (S1 4062/5148, S2 4061/5147); controls/islands remain partial. No PF reference was found for this exact test. Real test execution is PASS for the bounded software workflows, engineering acceptance is PARTIAL, and IEC/PF parity is not established.

Final exact-commit software CI and merge decision: report 15.
