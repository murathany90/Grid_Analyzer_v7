# PSS/E FNSL/FDNS parity — V4 (2026-10-28)

Branch `fix/psse-v1-real-model-parity`, commit `ace166996ba66d1643d2da07af44c15673c854a4` (remote-verified). Vendor: PSS/E 36.5 psspy (PSSPY314, Python 3.14), `psspy.psseinit(20000)`, `solution_parameters_5` with `TOLN=0.001` MVA unless stated, `fnsl`/`fdns` option arrays as recorded per run. GA: independent sparse polar NR (`NR_POLAR`) / fixed-slope XB (`FDNS_XB`), tolerance 1e-5 pu = 0,001 MVA at 100 MVA base, `SOURCE_SAVED`, Q limits on, 80 iterations.

## Base solutions (saved/warm start)

| Case | Vendor | GA | Parity (GA vs vendor, energized buses) |
|---|---|---|---|
| 6.875 fnsl | solved, 9 iter, sys msm 0,0122 MVA | SOLVED_APPROXIMATE, 1 NR update | dVm max 1,84e-5 / mean 1,07e-6 / P95 1,82e-6 pu; dVa max 1,20e-4 ° (V3 audit, unchanged) |
| 6.851 fnsl | solved, 2 iter | SOLVED_APPROXIMATE | dVm max 1,45e-6 pu (V3 audit, unchanged) |
| 6.875 fnsl-automatic `[1,1,1,1,1,0,0,1]` | solved, 9 iter | n/a (no active controls; see AC_FDNS_ROOT_CAUSE_V4.md §1) | vendor automatic vs vendor fixed: dVm max 1,49e-6 pu — controls move nothing |
| 6.851 fnsl-automatic | solved, 2 iter | n/a | vendor automatic vs fixed: identical |

## FDNS matrix (this session, committed evidence + fresh runs)

| Profile (tolerance) | Vendor 6.875 | Vendor 6.851 | GA 6.875 | GA 6.851 |
|---|---|---|---|---|
| FDNS strict 0,001 MVA, automatic options | **unsolved** (`solved=3`), msm 0,0505 MVA | **unsolved**, msm 0,0162 MVA | **NOT_CONVERGED**, max residual 2,69e-3 MVA | CONVERGED (3,96e-4 MW / 8,1e-5 Mvar, V3) |
| FDNS 0,1 MVA, automatic options | solved, 1 iter, msm 0,0505 MVA | solved, msm 0,0162 MVA | **CONVERGED** (`SOLVED_APPROXIMATE`, max 0,0170 pu = 1,70 MVA… see note) | **CONVERGED** (max 2,24e-5 pu) |

Note: the GA "operational" run in `evidence/psse-v4/scenario-parity.json` used `tolerancePu=0.001` (= 0,1 MVA) and reports `maxPMismatchPu/maxQMismatchPu` from its final residual — 1,70e-4 pu (0,017 MVA) on 6.875 and 2,24e-5 pu on 6.851, both inside the selected 0,1 MVA band. The strict 6.875 GA residual (2,69e-3 MVA) sits **below** the vendor's own unsolved strict residual (0,0505 MVA); no tolerance was widened to produce either result. `BLOCKED` was not used to mask strict non-convergence; FDNS keeps its own B′/B″ path (independent of NR).

## Scenario parity (`evidence/psse-v4/scenario-parity.json`, GA fixed-controls profile vs vendor per-scenario fnsl)

| Scenario | Vendor | GA | dVm max/mean/p95 (pu) | dVa max (°) |
|---|---|---|---|---|
| 6.875 +10% load | fnsl-fixed solved, 24 iter | CONVERGED, 14 iter | 0,463 / 0,177 / 0,404 | 16,4 |
| 6.875 line-out (514510-516112-1) | fnsl-automatic solved, 24 iter | CONVERGED | 0,081 / 0,00199 / 0,0042 | 0,68 |
| 6.851 +10% load | fnsl-fixed solved, 22 iter | **NON_CONVERGED** | — | — |
| 6.851 line-out | fnsl-fixed/automatic solved, 21 iter | CONVERGED | 0,042 / 0,0027 / 0,0040 | 0,35 |
| Both, +20% load | **unsolved in vendor** (msm ~8–10×10⁴ MVA) | not claimed | — | — |

The +10% divergence is the honest measured consequence of the fixed-controls profile (remote IREG machines held at source QG); root cause and WIP profile in `AC_FDNS_ROOT_CAUSE_V4.md`. The WIP `remoteRegulation` aggregate is `evidence/psse-v4/scenario-parity-remote-wip.json` (lineout improves to mean 1,4e-2–2,1e-2 pu with terminal-PV approximation; +10% hits `BLOCKED` on the slack-Q-limit guard) — it is **not** a solved full-control profile and is labeled as such.

## Reproduction

```
# vendor oracles (licensed, writes private-re/ only)
"C:\…\Python314\python.exe" tools/psse-v4-control-reference.py
"C:\…\Python314\python.exe" tools/psse-v4-scenario-reference.py
# GA side + aggregates (reads private SAVs, writes evidence/psse-v4/)
node --import tsx tools/psse-v4-scenario-parity.ts
```

Per-run raw vendor data (taps, shunts, per-bus voltages) stays in `private-re/ac-v4-reference/`; only aggregate statistics are committed. No vendor document, DLL, or licensed binary is included in the repository or the offline package.
