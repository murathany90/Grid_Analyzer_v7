# Benchmark acceptance matrix

Counts below are source records for the named metric, including records without
a numeric PF value. `matched` counts records eligible for a numeric comparison,
not merely FID matches. Error statistics use only eligible records. `—` means
null/not applicable; it is never zero error. Counts can overlap between exclusion
gates. Source-bearing per-metric exports remain local.

| phase | metric | sourceCount | matched | missingPF | missingGA | excludedMethod | excludedRating | mae | p95 | maxAbsDelta | unit | status | reason | testEvidence |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- | --- | --- |
| BASE-1 | Workbook SHA | 6 | 6 | 0 | — | 0 | — | — | — | — | files | DONE | Sidecars match workbook bytes | Local integrity audit |
| CMP-3 SN3 | Vpu | 49275 | 0 | 44647 | 45198 | 4077 | 0 | — | — | — | pu | EXPLORATORY_ONLY | PF calculation-setting semantics unverified | Actual final-SN3 runner |
| CMP-3 SN4 | Vpu | 48898 | 0 | 44254 | 44810 | 4088 | 0 | — | — | — | pu | EXPLORATORY_ONLY | PF calculation-setting semantics unverified | Actual final-SN4 runner |
| CMP-3 SN3 | Line from P | 5140 | 0 | 2851 | 2851 | 2289 | 0 | — | — | — | MW | EXPLORATORY_ONLY | Includes transformer records whose from-P field is blank; HV/LV are separate metrics | Actual final-SN3 runner |
| CMP-3 SN4 | Line from P | 5141 | 0 | 2857 | 2857 | 2284 | 0 | — | — | — | MW | EXPLORATORY_ONLY | Settings unverified; endpoint-specific metrics | Actual final-SN4 runner |
| N1 SN3 | Cases / extrema | 660 / 17 | 0 | detailed post-case absent | — | 660 | — | — | — | — | cases | PARTIAL | CAPABILITY_UNVERIFIED; no PF post-P/Q/S/V | Actual source / browser audit |
| N1 SN4 | Cases / extrema | 664 / 20 | 0 | detailed post-case absent | — | 664 | — | — | — | — | cases | PARTIAL | CAPABILITY_UNVERIFIED; no PF post-P/Q/S/V | Actual source / browser audit |
| N1-6 | Synthetic radial V/P/Q/S | 2 cases | 2 | — | 0 | 0 | loading unknown | tested tolerances | — | — | pu/MW/Mvar/MVA | DONE | Independent analytic solution; immutable input | n1-ac-validation.test.ts |
| N1-6 | Actual sampled outage | 2 cases | 0 converged | PF detail absent | 2 unsupplied | — | — | — | — | — | cases | PARTIAL | No slack in post-outage island; explicit null result | Local n1-SN3 / n1-SN4 |
| SC-A SN3 | Physical / electrical buses | 4689 / 3769 | 0 parity | per-cell audit | all SC GA | all | — | — | — | — | kA/MVA | DONE reference | Separate PF-only tables | Actual source / portable smoke |
| SC-A SN4 | Physical / electrical buses | 4686 / 3768 | 0 parity | per-cell audit | all SC GA | all | — | — | — | — | kA/MVA | DONE reference | No 1:1 physical/electrical assumption | Actual source / portable smoke |
| SC-A | Four contribution/run matrices | 0 each | 0 | absent | absent | all | — | — | — | — | rows | BLOCKED parity | Empty is not zero contribution | Actual source audit |
| SC-B | DGS source readiness | local class/FID inventory | 0 calculable | field-specific | — | factors/edition unknown | — | — | — | — | source fields | DONE audit | Sentinel/sequence/source/method statuses | pf-benchmark-comparison.test.ts |
| SC-C | Independent IEC Ikss | — | 0 | normative/source factors missing | all | all | — | — | — | — | kA | BLOCKED | No computed IEC subset or synthetic Ikss pass claimed | Local PDF / IEC catalog / Luna review |

| Operational acceptance | Status | Evidence / limit |
| --- | --- | --- |
| Two ZIP / cross-mix / cancellation | DONE | Actual SN3/SN4 portable browser; mismatched pair blocked with no partial data |
| Formula/CSV/XSS/null/zero | DONE | Strict XML, text-only DOM, escaped CSV, inline-string XLSX; focused importer/export tests |
| Map gates and no-data color | PARTIAL | Synthetic and actual browser tests; GA SC/N1 delta disabled, existing pan/zoom preserved; no exact memory-budget claim |
| Selected AC and stale identity | PARTIAL | Model/scenario/settings identities and worker cancellation; synthetic convergence, actual sampled unsupplied cases |
| Full AC / DC immutability | DONE | Protected source files byte-identical; SN3/SN4 stable base/final numerical digests match |
| Unit/regression / legacy + benchmark browser / builds | DONE | 287 tests, final Chromium smoke and both builds; importer target after version-gate tightening |
| Existing test:full | SKIPPED | SOURCE_UNAVAILABLE; does not count as real-model execution |
| Real fixture privacy | DONE | Ignored local sources/results; selective staging, synthetic-only public tests |
| Feature CI | Delivery verification | Actual pushed SHA/run is reported in the delivery response |
