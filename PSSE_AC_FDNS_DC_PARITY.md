# PSS/E AC / FDNS / DC parity

Fresh licensed PSS/E36.5 FNSL references and both native SAV solves use exact source hashes recorded in [reference handoff](docs/psse-v3/AC_REFERENCE_HANDOFF.md). Comparison by bus/machine/circuit/winding identities has zero missing active identities.

| Quantity | 6875 buses | 6851 buses |
| --- | ---: | ---: |
| GA NR classification | SOLVED_APPROXIMATE | SOLVED_APPROXIMATE |
| Actual Newton updates | 1 | 1 |
| Maximum physical mismatch MVA | 1.82e-7 | 5.04e-9 |
| Max Vm difference from FNSL pu | 1.84e-5 | 1.45e-6 |
| Max angle difference degrees | 0.0001202 | 0.00006685 |
| Max matched terminal-net P loss difference MW | 7.55e-5 | 9.21e-5 |
| Max matched terminal-net Q loss difference MVAr | 0.001035 | 0.000513 |

All max/mean/P95 bus, generation, terminal P/Q and loss statistics are in `evidence/psse-v3/electrical-audit.json`. Net terminal reactive losses include charging; vendor QLOSS is a different quantity and is reported separately.

FDNS retains independent Bprime/Bdoubleprime factorization and residual-controlled updates. At0.001MVA,6851 converges (maxP0.000396MW,Q0.0000811MVAr);6875 remains NOT_CONVERGED (P0.00269MW,Q0.000829MVAr). Strict licensed FDNS also fails6875; source0.1MVA tolerance succeeds. Tolerances were not silently relaxed.

DC equations are preserved; the previously reported approximately0.245MW real-case discrepancy is not resolved or recertified here. Existing DC regressions remain part of the suite. The production comparator conservatively reports NOT_READY for the newly held-Q profile; the audited quantitative comparison is separate and does not manufacture MATCHED.
