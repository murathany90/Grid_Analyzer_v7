# AC root cause and working solution

The original AC path stopped in capability auditing before Newton iteration. The new independent sparse polar NR profile genuinely converges on both original SAVs. Source-saved voltages are initial values; they are not substituted for calculated results.

Root causes were unreduced ideal switches (926/928), WMOD3/4 incorrectly treated as voltage controllers, unreferenced droop-table records treated as active physics, generatorless type2 semantics, and source-vs-remote voltage setpoint handling. The model has zero assigned DROOPNAME controllers despite161/227 enabled table records.

Implemented: AC equal-complex-voltage reduction with terminal shunt retention, recovered original terminal flows and KCL, WMOD0-4 equations, effective PQ boundaries, Q limits, source warm start and initial mismatch, honest five-way classification and Engine3 result identity. Remote Q controls442/460 and local saved voltage deviations9/13 are explicitly held and disclosed. Ideal cyclic flows use a deterministic nonunique allocation.

Both cases are SOLVED_APPROXIMATE. Independently checked physical max residuals are1.82e-7/5.04e-9MVA. A20%load perturbation requires3 actual Newton updates and reduces residual0.26pu to1.90e-14pu.

See [independent audit](docs/psse-v3/FINAL_ELECTRICAL_AUDIT.md), [implementation](docs/psse-v3/IMPLEMENTATION_HANDOFF.md) and [licensed reference](docs/psse-v3/AC_REFERENCE_HANDOFF.md). Full remote/RMPCT, assigned droop and automatic tap/shunt controls remain unfinished. This is a working approximate AC milestone, not full V3 acceptance.
