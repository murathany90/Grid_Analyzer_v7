# SC final acceptance — independently accepted by Codex

2026-10-24 · approved plan: `SC_CODEX_FINAL_EXECUTION_PLAN.md` · branch `feature/sc-pf-parity-ui`.

**İŞLEVSEL KABUL: PASS. NİHAİ KARAR: PASS.** Codex root independently accepted the delivered engineering work. PF 3F parity is **NOT_VERIFIED**; PF 1F is **REFERENCE_MISSING**. This is an uncertified network approximation, never a normative IEC/PF parity claim. No reproduced P0 or unresolved functional test failure remains in the evaluated scope; the numerical reference limitations below remain open.

Actual routing: the single read-only audit used `gpt-6-astra` / `high`; implementation used `gpt-6.1-sol` / `xhigh`, resumed in the same agent after its quota interruption. Codex root performed the separate acceptance. No Luna or replacement audit was used.

## Delivered changes and task dispositions

| Plan task | Disposition and decisive evidence |
|---|---|
| A1 | DONE: effective active voltage sources require explicit Z2 and Z0. Missing sequence input blocks with null current before fault factorization. Unsupported current injections/omitted sources cannot silently become complete 1F models. |
| A2 | DONE: nonfinite/negative/99999/999999 sequence values remain invalid; unknown neutral modes, unsupported vector groups, missing neutral data and unverified separate connections block. Explicit zero resistance and pure resistive earthing remain supported. |
| A3 | DONE: transformer X0 is derived from impedance magnitude and explicit R0; impossible decompositions block. Type/LV/HV neutral bases and neutral tap are tested analytically, including different type/terminal ratios. No KT/KG/KS blanket correction was introduced. |
| B1 | DONE: resume calculates only missing/cancelled electrical targets, merges electrical identities, preserves completed rows and deduplicates aliases. Duplicate-hole and cancelled-1F-MIN tests each assert exactly one resumed target. |
| B2 | DONE: numerical engine revision, method/fault/mode/model/scenario/source/profile validity and native per-mode re-adaptation protect restore. Nine real-reload poison cases reject obsolete or mismatched records. Save failure is visibly reported. |
| C1 | DONE, class B: native mini-DGS -> actual Application/source+calculation workers -> analytical 3F/1F MAX/MIN -> table/Lightning/map/parsed CSV-XLSX-JSON -> IndexedDB -> actual page.reload/reimport. No final numerical results are injected. |
| C2 | DONE: seven primary headers, exact nominal SC voltage filters, distinct site IDs despite equal TM names, blocked/stale/null states, search, exports and separate 3F driving-point/1F-loop impedance labels. Existing Lightning-to-analysis action is visible in the dedicated SC toolbar. |
| D1 | DONE as bounded diagnostic evidence; see numerical limits below. One native SN4 parse/run only; no country-wide calculation. |
| D2 | DONE: final desktop-only E2E **9/9 scripts PASS**, process exit 0; `local-benchmark-results/sc-resumed-final-desktop-e2e.log`, final summary `failed:[]`. |
| D3 | DONE: built/committed portable HTML, exact HEAD byte identity and actual file:// native import/calculation/reload acceptance PASS. Root independently verified the raw bytes, final desktop log, tracked tree and local/remote implementation HEAD. |

## Numerical and lifecycle tests

`tests/unit/sc-final-safety.test.ts` independently checks transformer Z0=0.06+j0.08 ohm and current `sqrt(3)*1.1*10/hypot(0.06,2*(10*(10/110)^2+0.1)+0.08)`, MAX/MIN, HV/LV taps and nonmatching winding/type voltages; invalid source/line/transformer/neutral/ElmNec inputs, explicit pure-R grounding and one-target resume. Existing YN/D, YNyn and opened-equipment assertions remain active with explicit sufficient fixture data.

- Targeted resumed numerical/presentation/lifecycle batch: **78/78**, `local-benchmark-results/sc-resumed-targeted.log`.
- Typecheck PASS: `sc-resumed-typecheck.log`; architecture lint PASS for 469 source files: `sc-resumed-lint.log`.
- Original final full run: **750/756**, `sc-final-all-tests.log`; its reproduced guard/fixture issues were corrected.
- User-authorized resumed full unit/regression run: **755/756**, `sc-resumed-final-all-tests.log`. The sole failure compared the new HTML to the old HEAD because artifact staging required `git add -f` and PowerShell continued after that stage failed. Artifact commit `4ffb4db` closes this sequencing failure.
- Focused committed-artifact provenance rerun: **5/5**, `sc-resumed-portable-provenance.log`, including raw HEAD byte identity. No extra full unit run was used to hide the earlier failure.

The earlier targeted map audit's LF convergence assertion failed once while the implementation was still changing, then passed on the stable tree without any LF solver/settings/fixture/convergence-assertion change. No numerical root cause was established for that transient; the later map audit verifies real LF, scenario history, source-worker/controller and IndexedDB behavior. This is separate from the reproducible hidden-SC-panel test mismatch, which was fixed by testing the current visible component.

Root independently reran the final critical numerical suite: **4/4**, `local-benchmark-results/sc-root-independent-critical.log` (3340.9996 ms). Root directly inspected the decisive code/assertions, unit/provenance logs, class-B proof, portable screenshot/proof and raw HEAD artifact bytes. Final desktop completion and Git checks also passed. The full unit run is accurately recorded as 755/756 followed by the successful targeted closure; it is not represented as a fresh 756/756 full run. No hosted CI run is claimed; these are the recorded local Windows checks.

## Evidence classes and browser proof

**B — genuine mini-DGS computation:** `tools/sc-engine-browser.mjs`, fixture `tests/fixtures/sc-mini-dgs.json`, proof `local-benchmark-results/sc-engine/proof.json`. Both buses, MAX/MIN and 3F/1F match independent formulas within relative 1e-6. CSV/XLSX/JSON are parsed and compared for FID, electrical identity, site IDs, mode and current; Turkish names/decimal CSV survive. Visible Lightning rows compare exact formatted currents for MAX/MIN × A/kA. Map 3F, 1F and Skss use the same computed rows and selected voltage/site. Real checkpoint cancellation/resume and exact all-four-result reload pass. Poisoned revision, missing profile, missing identity, source hash, profile hash, method, mode, model and scenario are rejected. Simulated workspace write failure produces a visible warning. Browser errors: zero.

**C — presentation fixtures:** analysis UX, PF-only MAX gating, shared result/identity/status counts and map audit fixtures remain presentation evidence. They are never treated as computed numerical parity. Retired hidden shared-SC controls were replaced in browser assertions with the visible `.ga-lightning-sc-panel`; N1/LF assertions remain active.

Desktop proof: Chromium 153.0.8010.12; 1366×768 and 1920×1080; CSS zoom=1.25 at 1366×768, DPR=1, effective CSS width=1092.8. This is explicit automated scaling emulation, not observation/change of the user's Windows display setting. No mobile/tablet/touch test executes under `GA_DESKTOP_ONLY=1`. The SLD trailing legacy log text still says “six viewports”; its actual desktop-only enumeration is the two sizes above, not six. Development-server HMR WebSocket/console warnings (`ERR_BLOCKED_BY_LOCAL_NETWORK_ACCESS_CHECKS`) are distinct from the asserted application page-error arrays; the standalone file:// proof has no external requests. Screenshots available for independent review:

- `local-benchmark-results/sc-engine/desktop-1366-1.png`
- `local-benchmark-results/sc-engine/desktop-1920-1.png`
- `local-benchmark-results/sc-engine/desktop-1366-1.25.png`
- `local-benchmark-results/sc-engine/map-lightning-1366.png`
- `local-benchmark-results/sc-portable/portable-1366.png`

The earlier desktop full run failed four stale SC-surface assertions (`sc-final-desktop-e2e.log`). Their focused corrections passed, and the newly authorized **single final full desktop run passed all 9 scripts**, `sc-resumed-final-desktop-e2e.log` (exit 0; `DESKTOP_E2E_SUMMARY {"scripts":9,"failed":[]}`). The artifact-browser test initially encountered a helper-opened tools dialog/hidden N1 control; its test-only navigation was corrected and the actual file:// acceptance passes. No product numerical assertion was relaxed.

## Actual SN4/PF reference — bounded class-A input, diagnostic comparison

One run: 15 physical selected targets, **12 distinct electrical matches**; model parsed once. Private inputs/results/logs remain ignored. Full electrical partitions differ, while the selected FID/kV/partition-subset pairs match. The numbers below are diagnostic, **referenceValidated=NO**:

- MAE: **42.107621926743185 kA**.
- P95 and maximum absolute error: **239.5726196769776 kA**, B3337.
- PF settings verified in the diagnostic: 3PH, MAX, effective IEC 60909, Rf=Xf=0; settings hash `sha256:619d1398076790523037eda11c39bddde53655f050c32a2575e24c6899ca14ef`.

| FID already specified in the master prompt | Fresh GA kA | PF kA | Signed GA−PF kA |
|---|---:|---:|---:|
| B9027 | 17.003753839 | 16.909529347 | +0.094224491 |
| B9445 | 10.119332818 | 9.959449614 | +0.159883204 |
| B6005 | 26.794680915 | 25.963718104 | +0.830962811 |
| B9410 | 17.113854599 | 17.003971665 | +0.109882934 |
| B4206 | 38.178157156 | 15.117503283 | +23.060653874 |
| B4351 | 15.419736271 | 252.407951296 | −236.988215026 |
| B3337 | 6.134695009 | 245.707314686 | −239.572619677 |

B3337/B4351 remain **UNRESOLVED_CAUSE**. Per-fault device contributions are NOT_RECORDED, so no device-current summation explanation is asserted. Historical main/branch fixed-five 400-kV MAE 0.1472/0.2736 kA was **not rerun** and is not a whole-model statistic. No new baseline before/after improvement is claimed for this unchanged 3F path. PF 1F/MIN parity is unavailable. Primary normative UserManual/TechRef was unavailable; no page references or additional correction assumptions were invented.

Observed identity provenance:

- Native model JSON / GA model SHA256: `c738a80b957a540d98e940b0cc910acf195c79495a3f33d252c17dc0461b119f`.
- PF model hash: `sha256:8a15c098137d2882207ff44fdd14b06f5eb8361f4b2b6f4978016084245798f2`.
- PF scenario hash: `sha256:cf1da96213ef034b4d79e9df394fb9785c43aacf54eeb747f8c26cd872b3c21a`.
- GA scenario: empty overlay (all status/dispatch/adjustment/restored-terminal maps empty); serialized signature is in the private proof.
- Observed source-context hash: `a908ab659fd160128df53bd3a76ff4d3f73ad4d107efca73f2e8edc6c89c5efb`.
- SC workbook SHA256, verified against manifest and workbook identity: `d9bd6a635d25c458042606d1c7c91f99c22a8b6450af9d63ecd271566f6962cd`.

GA and PF model/scenario identity constructions differ; native source/correction assumptions remain unverified. Matching names/FIDs do not establish scenario or normative equivalence. Private evidence: `local-benchmark-results/sc-final-sn4-private.json` and `sc-final-sn4.log`; not committed.

## Portable and Git delivery

Initial HEAD: `48cb5d80bb5a671e767d18fb75e6638d4be165b1`. Independently verified implementation/evidence HEAD: `6cf630afbf98f1566cbbccd532081085618f6500`; `git ls-remote origin refs/heads/feature/sc-pf-parity-ui` returned that exact SHA. Main remains `e04a9e99a0a2bf23cbe88f9e34ba1bb5a6bd043f`.

Delivery commits:

- `0def3ddd7cf7066130f0cfbe33e5f15a8a926840`: numerical guards, lifecycle/UI corrections, tests and approved plan.
- `4ffb4db15a8ee6a4ab59657af317b26e49276000`: rebuilt portable HTML.
- `6cf630afbf98f1566cbbccd532081085618f6500`: actual portable-browser acceptance and evidence report.
- The commit containing this independent decision only finalizes this report; its final delivery SHA is supplied in the user-facing handoff. It changes neither tested source nor HTML.

Changed-file scope: 44 files from the initial HEAD: 13 SC/ytm/controller/results/analysis/map source files, 10 synthetic fixture/helper/unit-test files, 17 browser/diagnostic test tools, `package.json`, two short documents and the portable HTML. The exact inventory is reproducible with `git diff --name-only 48cb5d80bb5a671e767d18fb75e6638d4be165b1..6cf630afbf98f1566cbbccd532081085618f6500`. Root reviewed the decisive source diff and assertions and `git diff --check` passed.

`dist-portable/GridAnalyzer_v7.html`: **2,059,224 bytes**, SHA256 **`db56b112e65474b96c2af12935b385d74f155ff3ee61272c38807635d4613ae6`**, exact raw-byte equality with the HEAD blob. `npm run build:portable` passed. `tools/sc-portable-browser.mjs` opened the actual artifact through **file://**, with HTTP(S) blocked: analytical native 3F/1F MAX/MIN computation and reload/reimport retained identical exported values/identities; errors=[]; external requests=[]. Proof: `local-benchmark-results/sc-portable/proof.json`.

Only explicit source/tests, the approved plan, this short report and final HTML are committed. The tracked working tree was clean at the inspected implementation HEAD. The whole directory is deliberately not described as clean: the five preexisting untracked entries remain untouched and uncommitted (`docs/Grid_Analyzer_SC_3F_1F_PF_UI_TAM_AGENT_PROMPT_20261023.md`, `docs/PF_GA_IEC60909_2016_Agent_Paketi (1).zip`, `docs/sld-v36/`, `docs/tek_hat_ornekleri/`, `scratch/`). Private inputs and benchmark evidence remain ignored. No branch creation/reset/rebase/force push/PR/merge/deletion occurred.

Root independently recomputed the SN4 aggregate from the saved per-row diagnostic evidence: n=12, MAE=42.107621926743185 kA, P95/max=239.5726196769776 kA. This confirms the reported statistic, not physical or PF equivalence. Final decision: **functional PASS; PF 3F NOT_VERIFIED; PF 1F REFERENCE_MISSING**.
