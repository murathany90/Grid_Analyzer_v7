# Full AC / PowerFactory SN4 verification (v8.2.0)

## Source and eligibility

The source pair is `20261001_1500_SN4_TR0.zip`, `PowerFactory_LoadFlow_20261001_1500_SN4_TR0_20261003_224310.csv`, and `PowerFactory_ControlContext_20261001_1500_SN4_TR0_20261003_224310.csv` (PowerFactory 24.0.7.1, exporter 8.0, study time 2026-10-01 15:00). The ZIP JSON SHA-256 is `31b9a53f4a8fa29627d53064fd079b1fc4bb141e019c4285db3752bca8319663`. The benchmark script validates model, study time, ZIP hash, base scenario and the sidecar's declared numeric CSV filename. The application also verifies terminal partition and every branch endpoint before comparison. Its calculation-settings gate is still `EXPLORATORY_ONLY` because the PF `ComLdf` raw enum meanings and comparable settings hash are not authoritatively available. Load eligibility is complete and does **not** cause `COMPARABLE_PARTIAL` for SN4.

The reference has 51,011 physical terminals, 4,689 result-bearing terminal rows, 4,117 unique electrical buses, and 5,200 branch endpoints. Three unmatched terminal rows are inactive stubs; there are zero active partition or endpoint conflicts. Bus errors weight each electrical bus once. Two PF source rows for electrical bus B3812 disagree on voltage; this one bus is excluded from Vpu statistics. The source also flags U960's 6.3 kV generator versus 0.8 kV bus nominal-voltage conflict; the model is not silently altered.

The ControlContext has 1,986 active ElmLod records. Every one has `i_scale=1` and `scale0=1`, verified against DGS by FID, bus, in-service state and initial P/Q. Its 366 active ElmStactrl records include 604 ordered `psym`/`cvqq` members, also joined by FID. Of these, 143 are zero-droop and 223 have signed droop. No load eligibility, controller member or missing phase value is guessed. The sidecar's observed PF load P sum changes from 43,339.4783 to 43,288.9460 MW (−50.5323 MW). PF load Q changes by only +0.00000033 MVAr. The median relative change for nonzero load P is −0.001113177; this is an observation only and is not a solver coefficient.

## Staged numerical comparison

MAE is GA minus PF in absolute value. A is the immutable 8.1.1 baseline against the new PF numeric CSV. D applies the explicit ElmXnet Q limit alone and has no change because the initial reference is inside its range. C adds FID-eligible distributed load balancing with controllers off. E adds zero-droop station control; F keeps source `cvqq` shares through Q allocation and limit redistribution. F numerically matches E on SN4 to displayed precision. `POWERFACTORY_TEIAS_PARITY` numerical settings are used for C/E/F (100 inner, 50 outer, 5 kVA nodal, 0.2% control equation tolerance); this is not an isolated numerical-only comparison.

| Quantity | A baseline MAE | C distributed MAE | F distributed + zero-droop + cvqq MAE / P95 | F change vs A |
| --- | ---: | ---: | ---: | ---: |
| Bus Vpu (4,116 buses) | 0.020241 | 0.020201 | 0.016258 / 0.030769 | 19.67% better |
| Aligned angle, degrees (4,117 buses) | 0.595785 | 0.424002 | 0.289673 / 0.557201 | 51.38% better |
| Line P from, MW | 0.856116 | 0.714856 | 0.686362 / 3.012059 | 19.83% better |
| Line Q from, MVAr | 8.378944 | 8.389277 | 8.285876 / 37.801338 | 1.11% better |
| Transformer HV P, MW | 0.244900 | 0.228086 | 0.224264 / 1.382730 | 8.43% better |
| Transformer HV Q, MVAr | 3.398901 | 3.403575 | 3.342065 / 15.455089 | 1.67% better |
| Generator P, MW | <0.000001 | <0.000001 | <0.000001 | unchanged |
| Generator Q, MVAr | 3.703379 | 3.708695 | 3.490484 / 18.217523 | 5.75% better |
| Station-controlled generator Q, MVAr | 16.420940 | 16.444510 | 15.476954 / 77.912444 | 5.75% better |
| Line current-derived loading, percentage points | 0.738284 | 0.729294 | 0.685174 / 2.243518 | 7.19% better |
| Transformer current-derived loading, percentage points | 2.349270 | 2.338485 | 2.268604 / 5.307458 | 3.43% better |

C worsens line Q by 0.12%, transformer HV Q by 0.14%, and generator Q by 0.14% versus A. E/F recovers those metrics and improves them by the values above. The F result has the same bus/branch/generator values as the source-cvqq-loaded run before the distribution fix within numerical precision; the largest generator Q difference is 0.00000018 MVAr. The fix ensures source participation is respected on models where it changes allocation.

PF SL1 is P≈0 MW, Q=−500 MVAr, V=1.022680 pu. A has GA P=73.4346 MW, Q=−478.728 MVAr, V=1.000000 pu. C has GA P=−0.000302 MW, Q=−468.5485 MVAr, V=1.000000 pu. F has GA P=+0.000215 MW, Q=−500.000001 MVAr, V=1.001888 pu. The reference Q-limit state is reproduced, but voltage still differs by −0.020792 pu. F reduces the GA–PF P loss gap from +22.9024 to +14.3780 MW; Q loss gap from +623.965 to +122.773 MVAr. GA's total load P adjustment is −64.9100 MW versus PF's −50.5323 MW; their −14.3777 MW difference tracks the remaining P loss gap, rather than an eligibility mismatch. No fixture coefficient is applied.

## Implemented fixes and remaining limits

The new ControlContext parser fails closed on missing/duplicate eligibility, source FID/bus/P/Q mismatch, and controller member mismatch. The UI imports it separately, invalidates old calculations and records its hash in result/export provenance. Numeric reference filename mismatch blocks comparison. Distributed balancing uses explicit eligible initial load P weights and leaves Q fixed as observed. A KLU direct fallback repairs a real SN4 failure when the iterative Newton linear solve stalled in a later distributed-balance Q-limit round. External-grid Q-limit handling separates the angle reference from its voltage-control state. Source `cvqq` now drives station Q distribution and active-set redistribution, including zero-weight members.

Full PF parity remains unproven. All 223 signed-droop controllers are reported unsupported because their `ddroop`/`pQmeas` orientation is not established. Of 143 zero-droop controllers, 15 satisfy the target, 25 saturate Q limits and 103 hit the configured outer-round limit. PV-to-limited transitions are monotonic; Q-limit release and repeated reactive-limit detection are not implemented. PF raw `ComLdf` enums lack authoritative semantic mapping. The maximum Vpu error remains 0.92719 pu and the maximum aligned angle error 123.745 degrees, dominated by outliers that require source/model investigation. Missing transformer phase/control values are not synthesized. Exact PF Newton/outer iteration counts are not treated as a parity target.
