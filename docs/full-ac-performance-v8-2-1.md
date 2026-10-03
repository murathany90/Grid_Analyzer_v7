# Full AC performance audit (8.2.1)

Source: `20261001_1500_SN4_TR0.zip`, matching PowerFactory LoadFlow and ControlContext CSVs. Identity matching uses FID and unique electrical buses. The historical 8.2.0 portable observation was 217.7 s; the archived Node benchmark measured 291.134 s. These are separate environments and are not treated as an identical timing pair.

The hot path restarted distributed active balancing during every station Q trial. The shared outer iteration setting also governed active balancing, station control, and Q limit processing. Large NR Jacobians used slow iterative solves despite the available KLU backend. The fix balances P once, carries its load adjustments through Q trials, gives the loops independent caps, uses KLU directly for large NR systems, retains sensitivity factorizations across good controller steps, and throttles inner iteration progress.

## Measured portable/browser run

The final measured run used the 8.2.1 portable HTML in headless Chromium, with SN4 ZIP and source ControlContext loaded through the UI. This run preceded the final bounded P correction backtracking change below. No third full-model run was made, per the two-run quota.

| Measure | Archived 8.2.0 | Measured 8.2.1 |
| --- | ---: | ---: |
| `CalculationResult.elapsedMs` | 217,700 ms portable observation; 291,134 ms Node archive | 5,871 ms portable |
| Browser wall clock from Full AC click to worker result | unavailable | 7,616 ms |
| Full NR solves | uninstrumented | 23 |
| KLU NR factorizations | uninstrumented | 136 |
| Initial active balance rounds | 4 in archive | 4 |
| Final active balance corrections | previously nested in trials | 0, with unresolved mismatch |
| Station outer rounds | 7 | 8 |
| Sensitivity factorizations / RHS | 8 / 980 | 9 / 1082 |

The historical portable timing to new portable timing is a 97.3% reduction. The target of 15,000 ms was met in the measured run. The later final P correction patch has **not** been benchmarked on SN4, so this timing is not a measurement of the exact final commit.

## PowerFactory accuracy (MAE)

| Quantity | 8.2.0 | Measured 8.2.1 | Change |
| --- | ---: | ---: | ---: |
| Bus V pu | 0.016258 | 0.013644 | −16.08% |
| Island aligned angle deg | 0.289673 | 0.268380 | −7.35% |
| Line P from MW | 0.686362 | 0.690194 | +0.56% |
| Line Q from MVAr | 8.285876 | 8.400532 | +1.38% |
| Transformer HV P MW | 0.224264 | 0.225976 | +0.76% |
| Transformer HV Q MVAr | 3.342065 | 3.385255 | +1.29% |
| Controlled generator Q MVAr | 15.476954 | 15.678295 | +1.30% |
| Line current from A | 6.507009 | 6.398490 | −1.67% |
| Verified line current loading % | 0.685174 | 0.678547 | −0.97% |

The measured run kept SL1 Q at −500 MVAr with `QMIN_LIMITED`, but SL1 P was −11.724 MW instead of approximately zero. Its final active balancing status was `PARTIAL_NOT_CONVERGED`. The final code adds bounded backtracking to that correction and a failure reason diagnostic; a small-model test exercises the correction. Its SN4 effect is **unverified**. The PF parity gate therefore remains open. The controller status counts in the measured run were 36 satisfied, 13 Q saturated, 94 stagnated trials, and 223 unsupported droop. `STAGNATED_TRIAL` distinguishes exhausted trust trials from a true outer-round limit. The 94 residual controllers still need further controller accuracy work.

The direct KLU NR path requires a true residual at most `1e-8` before accepting a step. Small systems retain the prior iterative-first path. No SN4-specific coefficient, FID, or offset was introduced.
