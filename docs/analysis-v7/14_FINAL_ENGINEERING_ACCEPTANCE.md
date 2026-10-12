# Final engineering acceptance

Baseline main `9b1eee94d5ef4548716611fc5447f07727c41d51`; baseline hardening `a3cf86268f94cd846c2f48cf0cd67857f11ae2a6`. New work: `feat/engineering-n1-iec60909-validation`. Electrical/UI portable source `872bf86`; acceptance tools `d3f2add`. Final exact commit/CI and main receipt are recorded in report 15.

## Actual acceptance matrix

| Area | Status | Evidence / scope |
|---|---|---|
| LF regression | PASS | protected numerical sources unchanged; independent oracles, fresh SN3 residual/cardinality preserved; SN4 full numerical hash identical after caller identity correction |
| DC N-1 regression | PASS | all previous tests; three fresh bounded DC screens |
| Full AC N-1 mathematics | PASS for supported fixtures; real PARTIAL | input-derived radial/PV/PQ/tap/phase/participation tests; six real numerical POSTs |
| Station controller | PARTIAL | supported existing voltage/droop/Q-bounded controls; real unsupported modes and missing source bounds preserved |
| Active-power balancing | PARTIAL | eligible-load mathematical acceptance; general generator slack/P bounds unsupported, SN7 source fidelity partial |
| IEC60909 3PH | BLOCKED normatively | positive-sequence diagnostics only; explicit 2016 rejected/null/zero RHS |
| Unbalanced IEC faults | BLOCKED | LL/1LG/2LG sequence/grounding models not implemented |
| Ip / Ib / Ith | BLOCKED | null quantities; independent method/source/time acceptance missing |
| Equipment duties | PARTIAL | verified-quantity/nameplate/connection API tests PASS; native adapter/automatic engineering certification unavailable |
| Actual SN3 / SN4 / SN7 | PARTIAL | new import/LF/N-1/SC completed; controls/IEC/PF not fully accepted |
| PF comparison | NOT_COMPARABLE | available 24.0.7 references, zero certified comparable observations; no parity percentage |
| UI/UX | PASS scoped | six viewport sizes; synthetic interactions plus actual fresh results; SC empty/batch/blocked states corrected |
| Performance | PASS scoped | bounded 50-row rendering; actual 6368 rows and unchanged numeric snapshots; no new speedup claimed |
| All unit/regression tests | PASS | **437 total/pass, 0 fail/cancelled/skipped**; original 422 preserved +15 |
| Three E2E suites | PASS | browser-smoke, PF-benchmark, map/lightning; cancellation, timeout recovery, exports, geometry |
| Standard / portable build | PASS | both built from final source |
| Raw portable byte gate / offline | PASS | git blob == rebuild, LF-only, exact HTML offline worker/import smoke |
| Exact feature CI | PENDING at this report's initial commit | report 15 contains observed exact CI and integration receipt |
| Main integration | NOT_MERGED at this report's initial commit | conditionally authorized; report 15 records actual outcome |

`npm ci`, typecheck, lint (294 source files), unit tests, Chromium installation, three E2E suites, standard/portable builds and raw-byte tool ran successfully. `npm run test:full` was invoked: its exact `control1/*.json` fixture set is absent, so **NOT_RUN / SOURCE_UNAVAILABLE** (not a passed full-model test). Separate new genuine ZIP-based acceptance is documented in report 12; this is not hidden as the old fixture suite's success. No private JSON is copied into tracked `control1` or validation reports.

## Portable receipt

`dist-portable/GridAnalyzer_v7.html`: **1,694,524 bytes**. Raw SHA-256:

`fee5ae1f0d4dec642f95803ea6aec6c18676266b4dfad98b9ee08ad88324de56`

Source, committed blob and rebuild are byte-identical and LF-only. SN3 fresh calculation ran the earlier `d5e8b10` portable (recorded in report 12); the final change is presentation only. The final portable was separately built, byte-checked and tested offline; fresh SN4 results verify the final UI without relabeling/recomputing all prior models.

## Merge boundary and actual debt

This is acceptance of a safely bounded software improvement, **not completion of all requested engineering calculations**. The prompt explicitly permits integration of independently tested partial improvements while unsupported engineering stays blocked. Merge requires exact feature CI, current main ancestry, raw artifact integrity and all successful local gates; main CI must also pass after push.

Priority debt: (1) independent source-complete station Q/PF/tan(phi), remote/boundary droop, generator participation/P limits and OLTC/SVC/STATCOM controls; (2) authoritative IEC2016 applicability and independently solved vectors, then corrected source/sequence/grounding and decay/peak/thermal components; (3) physically matched native equipment ratings and valid Ib/Ip/Ith; (4) complete same-method PF POST/SC partition references; (5) complete result timestamp provenance and broader real cases. Historical SN7 S2 is not recovered: the new controlled test is explicitly labeled. Diagnostic SN3/SN4 N-1 and SC results **do not establish IEC/PF parity**.

Reports 09–13 provide changed functions, reproductions, named tests, models, tolerances and limits. Public docs contain only aggregate receipts; full real network identities/outputs stay ignored.
