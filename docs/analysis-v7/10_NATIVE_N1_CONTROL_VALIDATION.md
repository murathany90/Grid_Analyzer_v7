# Native N-1 control validation

Implementation commits: `0f02b13` and `83d65e1`; portable code snapshot `d5e8b10`. Final exact-commit CI is recorded in report 15. The LF/Newton/station-control/DC engines have no diff from hardening `a3cf862`; no investigation engine changes are imported.

## Fixed defects and scope

`contingency-ac/control-evidence.ts::n1ControlEvidence` previously could certify an unconsumed requested automatic control, unknown runtime mode or a forged `converged:true` with excessive residual. It now requires a finite nonnegative residual within the actual nodal tolerance, accepted modes, supported requested settings, source-physics and reactive-mode fidelity. Fixed tap/phase and fixed shunt receive separate SUPPORTED/PARTIAL/INVALID_INPUT evidence. Inert default settings retain the established operating point. `validateAcOutages` refuses invalid physical residuals even under ALLOW_PARTIAL; a diagnostic profile cannot bypass numerical acceptance.

This extends **verification coverage**, not the set of LF equations. Local/remote voltage, supported self-cubicle droop, source-bounded Q sharing/PV→PQ and sourced adjustable-load P balancing remain the existing models. Q/PF/tan(phi) station modes, automatic bus selection, general cubicle/boundary droop, generator distributed slack/P bounds, OLTC, automatic shunts and SVC/STATCOM control laws remain unsupported or partial. They are not silently mapped to voltage or single-reference control.

Owned PowerFactory 2024 Station Controller reference §2.1 (printed p1, PDF p5, visually inspected) distinguishes terminal voltage control from cubicle/boundary Q/PF/tan(phi) measurements. The canonical model lacks complete measurement/actuator semantics for those modes. Static Generator and Static Var System references were also inventoried locally. No unsourced controller equation is added.

## Independent physical references

`tests/unit/engineering-independent-n1.test.ts` runs actual native solves. The receiving-end equation is `y² + (2Xq−E²)y + X²(p²+q²)=0`, `V=√y`, with angle and source Q derived directly from specified P/Q/X. Production Ybus or solved output never supplies expected values.

* Parallel outage + closed coupler: V/angle, both endpoint powers, S, zero MW loss, null unknown rating.
* Transformer outage: exact class/FID isolation and surviving radial result.
* Fixed tap/phase: `E=1/tap`, phase shift in angle; endpoint losses preserve conservation.
* Station target and QMAX saturation: independent PV equation followed by a separate PQ quadratic. Q sharing/remote/droop cases from all prior tests remain enabled.
* Lossless distributed eligible-load balancing: known 1:3 participation, 5/15 MW remaining loads, fixed 2/6 MVAr and independently derived voltage.

Test nodal tolerance is explicitly 0.001 kVA (1e-6 MW), supporting 1e-5 MW/angular/voltage comparisons and 1e-4 MVAr control comparisons. Initial failures were resolved by using this tighter solve precision and explicitly supplying the constant-Q fixture semantics; no assertion threshold was relaxed. Default production tolerance remains 5 kVA.

`engineering-control-gates.test.ts` adds positive defaults and negative unsupported setting, unknown mode, NaN/Infinity/negative/excessive residual, substituted source, offline equipment and forged BASE/POST cases. Existing radial/ring/reference/island, missing Q/rating, stale identity, manual rejection and budget/cancel/resume tests remain unchanged.

## Real bounded scope

New SN3/SN4/SN7 imports, native LF and two selected POSTs per model are recorded in report 12. All six POSTs are numerically solved and remain PARTIAL; **AC_VERIFIED=0**. The complete catalogs are 660/664/651 and are not represented as fully AC solved. Each bounded study DC-screens one applicable candidate; islanding/direct AC and excluded catalog cases remain distinct. Unsupplied islands receive no invented reference.

SN7 has a new controlled B0→S1→S2 test ledger. It is not the historical user's original S2. Real controller completion and PF parity remain PARTIAL/NOT_COMPARABLE.
