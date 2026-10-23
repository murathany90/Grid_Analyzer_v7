# Main merge record — MERGED

The engineering prompt explicitly authorized conditional merge/push, including safely blocked/partial engineering scope. All software gates passed before integration; no further approval was requested.

* Initial main: `9b1eee94d5ef4548716611fc5447f07727c41d51`.
* Initial hardening: `a3cf86268f94cd846c2f48cf0cd67857f11ae2a6`.
* Tested feature and **actual fast-forward main head**: `e4eee80f62e835105927744c9de69e57e05852cb`.
* Feature: `feat/engineering-n1-iec60909-validation`.
* [Exact feature CI 38288839177](https://github.com/murathany90/Grid_Analyzer_v7/actions/runs/38288839177): completed/success on that exact SHA.
* [Separate main CI 38289317851](https://github.com/murathany90/Grid_Analyzer_v7/actions/runs/38289317851): completed/success on that exact SHA. Raw portable byte step succeeded.

The GitHub connector refused PR creation with 403 “Resource not accessible by integration”; **no PR was created**. Public branch metadata showed main `protected:false` and repository rulesets were empty. The prompt's permitted fast-forward path was therefore used: fetch → recheck feature/main refs and ancestry → switch main → pull --ff-only → merge --ff-only → push main. No force, squash, rebase or untested merge commit was used. Feature ancestry in remote main was verified after push. Forbidden investigation heads `18a2139`, `f6c79ba`, `9be1b81` were explicitly verified not to be ancestors of the integrated feature.

## Verification receipt

**438/438 unit/regression tests**, 0 failed/cancelled/skipped; original 422 preserved +16. Typecheck, lint (294 source files), three E2E suites, six viewport sizes, fresh bounded real-data calculations and independent input-derived physical tests pass within documented scope. Standard and portable builds, offline import/worker smoke and raw committed-blob/rebuild checks pass. `control1/*.json` fixture suite was invoked but remains NOT_RUN/SOURCE_UNAVAILABLE; genuine ZIP-based tests are separately recorded.

Final portable `dist-portable/GridAnalyzer_v7.html`: **1,695,154 bytes**.

SHA-256 `557101f8b6ec3393d76ab2b7b2690b5c19b907e4d9e4e14562caae8140ebfc16`.

The working file equals the committed raw blob and is LF-only. LF/Newton/station/DC numerical sources have no diff against initial main. Actual SN3/SN4/SN7 numerical workflows are bounded and partial: six selected POSTs solved, zero full control-verified real cases; normative IEC and PF parity remain blocked/not comparable. SN7 S2 is a new controlled test, not the historical original. SN3/SN4 diagnostic N-1/SC **do not establish IEC/PF parity**.

## Branches, tag and recording commit

No remote branches or tags were deleted in this task. Verified remote branches immediately after the fast-forward:

| Branch | SHA |
|---|---|
| main | `e4eee80f62e835105927744c9de69e57e05852cb` at integration |
| feat/engineering-n1-iec60909-validation | `e4eee80f62e835105927744c9de69e57e05852cb` |
| codex/analysis-v7-evidence-hardening | `a3cf86268f94cd846c2f48cf0cd67857f11ae2a6` |
| feat/analysis-ui-native-n1-iec60909-2016 | `ae82a5f3de8f3dc1ffd277a37d08290dbba148dd` |

Preserved annotated tag `pf-parity-v2-validated`: object `0f2b18243a31a840895775e187e368ef1da9d42e`, peeled commit `c8c940360cd851604996b54cab17cdcce9a61aa3`. The user's untracked IEC ZIP is untouched; private source/results remain ignored.

This receipt and report 14 are recorded in a subsequent **documentation-only main commit**; the fast-forward head above identifies the tested implementation, not a self-referential document hash. That recording commit is pushed and its own main CI must pass before delivery. Its actual SHA/run are reported in the final handoff and ignored final receipt. [Main CI history](https://github.com/murathany90/Grid_Analyzer_v7/actions?query=branch%3Amain) and Git history retain the full chain.
