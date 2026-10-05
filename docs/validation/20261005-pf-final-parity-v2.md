# Final PowerFactory parity v2 — local validation

Canonical model: `20261001_1500_SN4_TR0`. PowerFactory reference: 24.0.7.1. Branch: `codex/pf-final-parity-v2`; implementation and portable source commit: `a5f1fe6cd8310747f00aa11dd0fe955e03bf1aeb`. Main was not merged.

The solve reads DGS and the validated ControlContext. The PF numeric export is read only by the frozen-state audit, KPI scorer and generator-Q audit after solving. There is no FID correction, PF-result lookup in production, empirical network multiplier, or line/ElmScap model change.

## Frozen PowerFactory-state gate

The independent audit maps each PF voltage in kV onto the canonical electrical-bus nominal base and evaluates the local equations without Newton.

| Measure | Local | Attached report |
| --- | ---: | ---: |
| Line P | 0.0000036123% | 0.00000361% |
| Line Q | 0.0000083795% | 0.00000838% |
| Transformer P | 0.0552867% | 0.05529% |
| Transformer Q | 0.3885907% | 0.38859% |
| Bus-Q balance MAE | 0.0257354 MVAr | 0.02574 MVAr |

The attached Formula Set writes the LV-tap series term as `1/ρ²`. Applied literally, it yields 4.11986% transformer P, 5.87308% transformer Q and 0.38519 MVAr bus-Q MAE at the same frozen PF state. The implemented `ρ²` term exactly reproduces the attached report's validated results. It models the tapped LV winding's series ohms changing with the squared physical voltage ratio. This source-document contradiction was resolved by the frozen-state equation gate, not by tuning against the full-solve KPI.

## Full canonical solve

| KPI | Local v2 | Cloud reference | Hard acceptance |
| --- | ---: | ---: | ---: |
| Line P | **0.069347869%** | 0.06719% | <1% |
| Line Q | **4.779533721%** | 4.48633% | <10% |
| Transformer P | **0.018133768%** | 0.01783% | <1% |
| Transformer Q | **3.727118399%** | 3.28025% | <10% |
| Bus V | **0.079824152%** | 0.07219% | <0.25% |
| Aligned angle | **0.133162049%** | 0.12858% | <0.75% |
| Zero-droop generator Q MAE | **1.481989 MVAr** | 1.17452 MVAr | <5 MVAr |
| Droop generator Q MAE | **0.348045 MVAr** | 0.33170 MVAr | <0.5 MVAr |
| Non-station generator Q MAE | **4.035×10⁻⁹ MVAr** | source dispatch | unchanged |
| Movable controller residual | **0** | 0 | <10 |
| Exact portable Chromium engine time | **4.06 s** | 6.34 s cloud engine | <15 s |

The KPI population is exactly 2308 lines / 4616 observations, 2892 transformers / 5784 observations, and 1733 voltage/angle electrical buses. The solve converged with 107 total Newton iterations, 107 KLU factorizations, 92 Full NR calls and 90 station active-set restarts. Controller states: ACTIVE 291, QMIN 49, QMAX 17, fixed/no-headroom 9. A setpoint residual above 0.002 pu remains on 46 saturated controllers; none remains on movable controllers.

SL1: P ≈ 0 MW, Q = −500 MVAr, V = 1.023761837 pu, `QMIN_LIMITED`. Its voltage remains above the PF reference (~1.014054 pu) and the cloud solution (1.022765 pu), despite passing the global bus-V gate.

The three nonlinear-basin checks remain physically saturated at QMIN: `VK2050` −15.78 MVAr (residual −0.002369 pu), `VK3465` −9.86 MVAr (−0.003313 pu), and `VK3048` −14.78 MVAr (−0.012107 pu). They receive no FID-specific correction. The remaining local/cloud Q and transformer-Q differences are consistent with operating-point and member active-set selection, rather than the frozen equipment equations.

## Portable provenance and checks

`dist-portable/GridAnalyzer_v7.html` SHA-256 is `177b15c7f335e6af07d82e889e5d943e8be631c6a28a8c32d994f3e0140b4e7d`. `tools/portable-full-ac-benchmark.mjs` verified byte equality to the committed artifact at `a5f1fe6`, clean measured source, Chromium 153.0.8010.12, engine time 4060 ms, browser wall clock 5851 ms, converged P balance and station control, and no page errors.

Quality gates: typecheck, architecture lint, 215 unit/regression tests, browser E2E, production build, and portable build passed.

Reproduce with:

```text
node --import tsx tools/frozen-state-audit.ts
node --max-old-space-size=6144 --import tsx tools/sn4-parity.ts
node --import tsx tools/pf-kpi.ts .tmp/sn4-full-ac-result.json kontrol1/PowerFactory_LoadFlow_20261001_1500_SN4_TR0_20261003_224310.csv
node --import tsx tools/sn4-controller-audit.ts .tmp/sn4-full-ac-result.json
node tools/portable-full-ac-benchmark.mjs
```
