# SN2 final acceptance — 2026-10-22

Acceptance used the private native `20261020_1800_SN2_TR0.zip`. Completed LF/scenario evidence was reused from the previous run; no artificial source changes or convergence adjustments were made.

One functional issue was reproduced: returning to a previously visited scenario could leave the automatic N-1 catalog empty because a completed request remained registered. The request slot now clears on completion/failure, without clearing a newer scenario's slot. Unit coverage checks deduplication, undo and retry; a focused real-worker browser check confirms automatic reload after undo.

Real SN2 evidence:

- Automatic catalog: 5,250 candidates, available before LF. Base LF: 4,180 solved buses / 5,255 branches, `CONVERGED_FULL_NR`, mismatch `8.779103465028637e-7 MW`. **Active P balance remains partial; this is not a fully verified solution.** Scenario/delta/undo preserved the base snapshot.
- One DC case produced P-only impacts; Q/V/AC loading were not fabricated. One explicitly approved diagnostic AC case produced `PARTIAL_SOLUTION`, 4,180 buses / 5,254 post branches, zero verified AC cases. Eight PV sources lack valid Q bounds; 60 station controllers remain unsupported. Source physics, reactive modes and active balancing retain their partial evidence.
- One real SC terminal was `BLOCKED`: `UNSUPPORTED_CONVERTER`, `MISSING_SOURCE_MODEL`, `MISSING_IEC_FACTOR`. No source assumptions were applied. Ikss/Skss/Ip/Ib/Ith remain null. This verifies the native blocked workflow, not numerical SC or IEC compliance.
- LF/N-1/SC transitions passed at 640/420 px without horizontal overflow. The 640×480 N-1 list remained 230 px. Multi-select filters, case expansion, outside map/menu click, Escape and Close passed without first-frame list shrinkage. SC search/pagination and the 50-row/choice DOM bound passed; calculated zero and blocked one remain distinct.
- For one filtered real FID, JSON/CSV/XLSX contents matched across 18 columns and three metric rows. Case, FID, endpoints, capacity denominator, raw PRE/POST/delta and GA provenance matched the retained numerical snapshots. CSV's decimal comma was interpreted explicitly. Loading delta uses pp. Export covers the filtered table across pages; raw analysis export remains separate.

Validation: 11 targeted unit tests, focused catalog-undo browser smoke, typecheck, architecture lint, standard/portable builds and raw portable byte/hash comparison. Branch CI is the final integration gate. Private inputs, cache, exports and screenshots remain ignored under `local-benchmark-results/sn2-final-30f91ee/`.

PF equivalence and normative IEC validation remain unverified. The declared model/source limitations above are preserved and must not be reported as complete engineering acceptance.
