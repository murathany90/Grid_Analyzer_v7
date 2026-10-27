# PSS/E AC implementation handoff

## Implemented profile

The production AC path now solves a reduced but equation-based fixed-controls model. It uses the source-saved voltage state as the initial condition without replacing it before the initial mismatch is measured, enforces conventional Q limits, maps WMOD 0–4, holds remote IREG and assigned droop machines at saved Q when the full controller is not implemented, and contracts ideal non-transformer links to equal-complex-voltage nodes. Original-bus voltages and terminal flows are expanded after the solve; ideal-link terminal flows are recovered by bus KCL. Cyclic ideal-link flows use a deterministic minimum-|X| allocation and are explicitly approximate.

FDNS uses the same fixed controls, ideal-link contraction, and expansion around its own fixed B′/B″ matrices and iteration path. A residual descent step guard limits divergent FDNS updates. It is not a relabeled Newton result.

Every published calculation carries `SOLVED_FULL`, `SOLVED_APPROXIMATE`, `NOT_CONVERGED`, `INVALID_MODEL`, or `UNSUPPORTED_PHYSICS`. A small residual on a held remote/droop control profile is reported as approximate. `SOURCE_SAVED` also reports each local PV machine whose saved bus voltage differs from VS; the saved voltage is held in that profile. The source/normalized starting mismatch is available as `diagnostics.initialMismatchPu`.

WMOD 2 uses symmetric PF-derived Q limits; WMOD 3 uses signed PF-derived fixed Q and rejects zero/invalid PF; WMOD 4 fixes Q at source QG. Connected generatorless IDE=2 buses solve as zero-injection PQ equations, without synthetic generation. The AC path accepts supported BP bypass links as ideal contractions; the existing DC bypass gate remains unchanged.

## Reproduction

Run from the repository root:

```powershell
npm run typecheck
node --import tsx --test tests/unit/psse-powerflow.test.ts tests/unit/psse-ac-electrical-audit.test.ts
node --import tsx private-re/ac-v3-reference/run-ac-methods.ts private-re/ac-v3-reference/20261026_1600_SN1_TR0.sav 'C:/Program Files/PTI/PSSE36/36.5/control1/20261014_1200_SN3_TR0.sav'
```

The real-case harness uses `SOURCE_SAVED`, Q limits enabled, tolerance `1e-5 pu` (0.001 MVA), up to 80 iterations and 12 Q-limit rounds. The full SAVs and runner are ignored under `private-re/`; no full grid is added to the repository. The 6,875-bus SAV is extracted locally from the user's Downloads ZIP; the 6,851-bus case is read from the installed PSS/E control1 folder.

## Actual SAV results

Both source snapshots were freshly decoded and solved. The result is calculated from source values; no saved or PSS/E reference result is copied into the output.

| Source | Method | Classification | Iterations | Max P mismatch | Max Q mismatch | Ideal-link KCL residual |
|---|---|---|---:|---:|---:|---:|
| 6,875 buses, SHA `8cc8ccfeca14001c…` | NR_POLAR | SOLVED_APPROXIMATE | 1 | 1.27e-8 MW | 1.82e-7 Mvar | 8.13e-8 MVA |
| 6,851 buses, SHA `b57af8d4990a61d5…` | NR_POLAR | SOLVED_APPROXIMATE | 1 | 1.01e-9 MW | 5.02e-9 Mvar | 1.40e-9 MVA |
| 6,875 buses | FDNS_XB | NOT_CONVERGED | 1 | 2.69e-3 MW | 8.29e-4 Mvar | not published |
| 6,851 buses | FDNS_XB | SOLVED_APPROXIMATE | 1 | 3.96e-4 MW | 8.11e-5 Mvar | 1.75e-4 MVA |

The 6,875-bus FDNS residual exceeds the selected 0.001 MVA tolerance and is not published as solved. Licensed PSS/E strict-tolerance FDNS on this snapshot also reports unsolved with a ~0.0102 MVA maximum mismatch. NR converges from the decoded source-saved state for both cases.

Both NR runs contract 926/928 ideal branches to 5,967/5,940 numerical nodes and preserve all 6,875/6,851 physical bus outputs. The solved cases explicitly hold 442/460 remote machines at source QG; 9/13 local voltage setpoints differ from the saved bus voltage and are disclosed by `LOCAL_REGULATION_SOURCE_SAVED_VOLTAGE_HELD`. Cyclic ideal-link branch flows are nonunique and use the documented deterministic allocation. These counts make the `SOLVED_APPROXIMATE` classification visible in diagnostics and findings.

## Focused checks

The two focused test files cover control-mode equations, zero-PF rejection, saved-voltage/setpoint disclosure, ideal tree/cycle terminal KCL and shunt retention, BP contraction, three-winding star balance, nonmutation, load perturbation with a real Newton update, and all five publication classifications. The test output and exact commands are reproducible above.
