# SC final execution plan — independent Astra audit

2026-10-24 · Astra 6 / High · baseline `48cb5d80bb5a671e767d18fb75e6638d4be165b1` · branch `feature/sc-pf-parity-ui` · main `e04a9e99a0a2bf23cbe88f9e34ba1bb5a6bd043f`.

This is the single bounded audit and handoff to Codex, then Sol 6.1 / Very High. No source, HTML, test, or configuration file was edited by Astra. Only this plan was written. The audit inspected approximately 25 relevant source/test/tool files, ran four tiny imported-model numerical probes and one resume probe, and did not run the full suite, parse SN4, browse, or test mobile layouts. Existing user files and private data remain untouched.

## Current evidence matrix

| Area | Status | Evidence and limit |
|---|---|---|
| 3F network approximation | DONE_VERIFIED, bounded subset | Root independently ran the three targeted suites: 53/53 pass. `tests/unit/short-circuit.test.ts:15–47,63–135` contains numerical radial, ratio/base and imported HV/LV tap assertions. This does not establish IEC/PF parity. |
| 1F sequence calculations | BUG_REPRODUCED | Three source-data cases incorrectly calculate; transformer impedance decomposition is wrong for nonzero zero-sequence resistance. See A1–A3. Existing analytical tests still pass. |
| MAX/MIN | PARTIAL | Separate source hashes and four result slots exist (`src/analysis/ytm-study/index.ts:24–27,99–101,113–136`); full browser coverage of both fault types remains missing. |
| Identity / stale / restored results | PARTIAL | Pair guards added in 48cb5d8 are real. Study restore trusts nested saved results; current result getters do not establish current source-context equivalence or engine revision. B2 closes this narrower remaining gap. |
| Partial results / resume | BUG_REPRODUCED | Pending counts detect a missing FID, but resume's length predicate skips its calculation. Existing pending-count fix is retained. |
| IndexedDB application reload | NOT_VERIFIED for complete 3F/1F chain | `tools/workspace-unification-browser.mjs:35` reloads a real application, but asserts only study 3F MAX/MIN and hybrid existence. Unit cache/predicate tests do not prove controller reload compatibility. |
| Analizler / lightning / map | PARTIAL | Compact rows, site-ID dedup, voltage filtering, PF-only MAX map, and SC status filtering have current passing tests. Imported-engine integration remains to be demonstrated. |
| CSV / XLSX / JSON | PARTIAL | Compact view exports 3F/1F columns (`src/features/analysis/compact-study-view.ts:95–136`); current browser downloads are not parsed and compared to engine/UI values. |
| Real engine versus fixture | PARTIAL | Imported mini-DGS numerical unit tests are genuine engine evidence. `tools/analysis-ux-browser.mjs:1,17` is explicitly presentation/fixture evidence. Neither substitutes for the full application chain. |
| Desktop / portable / final CI | NOT_VERIFIED this run | Root verified baseline HTML: 2,053,743 bytes; SHA256 `6118b68a2a0ec1713fe778ac970bffe13524d7f89f425766ae76368f5fab4d81`. Existing E2E command includes mobile loops that must be excluded from this task. |
| PF 3F reference | NOT_VERIFIED numerically this run | Matching-name SN4 package and explicit 3PH/MAX manifest exist; identity must be checked before one selected run. |
| PF 1F reference / authoritative normative documentation | BLOCKED_EXTERNAL_DATA | Available paired SC manifest is 3PH/MAX only; no PF 1F or primary UserManual/TechRef was found in the bounded inventory. |

Closed fixes are not reopened: source-map hashing, pure-R earthing solver support, physical pending detection, site-ID matching, voltage-filter-before-TM-maximum, PF-only MAX map, SC status selector, standalone 3F/1F pair comparison. Root's 53/53 result validates the present assertions, not the historic separate `25/25 + 5/5 + 36/36` counts.

## Package A — numerical safety, first (three tasks)

### A1 — P0: require justified sequence source coverage

**Evidence / root cause:** `src/analysis/short-circuit/sequence-network.ts:103–144` silently uses Z2=Z1 when source R2/X2 is absent; `:396–409` builds Z0 only from available entries. `src/analysis/short-circuit/index.ts:139–159` accepts any grounded Z0 network without checking whether an active source's zero-sequence contribution is known. Missing data is therefore indistinguishable from an explicitly isolated source.

**Reproduced mini-DGS:** one 110 kV bus, ElmVac R1=0, X1=10 Ω, R0=0, X0=10 Ω, no R2/X2, c=1.1, bolted fault gives `CALCULATED_NETWORK_APPROXIMATION`, Z2=j10, Ik1=6.985938257 kA. Removing source R0/X0, supplying R2=0/X2=10 and adding a separate ElmNec R0=20/X0=0 gives a calculated 7.409706472 kA. Both lack sufficient source data; the second must not be accepted merely because another ground path exists.

**Minimal change:** preserve missing/explicitly blocked/available sequence status per active source; reject affected 1F calculations with a precise `NOT_COMPUTABLE` reason and null current. Allow a justified equality assumption only when explicit and provenance-bearing, never silently for every machine/source. Apply existing effective-network/source service and blocked-equipment decisions consistently to sequence sources. A current-injection source with no supported 1F sequence model must be explicitly blocked or omitted with an honest supported policy, not silently treated as a complete model.

**Assertions / close:** both probes BLOCKED + null; explicit R2/X2=0/10 and R0/X0=0/10 still yield 6.985938257 kA (relative tolerance 1e-6). A disconnected/inactive second source cannot alter Z2/Z0. Keep positive-sequence behavior unchanged. **Dependency:** none.

### A2 — P0: preserve invalid/sentinel/unknown grounding data

**Evidence / root cause:** `src/importers/powerfactory-benchmark/short-circuit-source.ts:7,19,92–100,105–143` inconsistently rejects 99999 versus 999999, converts invalid/missing neutral and ElmNec parts into zero, and defaults unknown `cneutcon` to 0. `sequence-network.ts:262–306,323–334` consequently treats some unknowns as grounded or finite impedance.

**Reproduced:** same one-bus source with R0=999999 Ω, X0=10, R2=0, X2=10 produces Z0=999999+j10 and calculated Ik1=0.000209578357 kA, rather than an unsupported result.

**Minimal change:** one finite, nonnegative, sentinel-aware validation policy for physical sequence/source fields; retain missing and invalid markers instead of numerical zero. Explicit zero remains valid where physics permits it. Unknown neutral mode, unknown vector group and unverified separate neutral connections block the affected result; support only mappings with evidence. Do not infer a new PF enum interpretation or a neutral connection.

**Assertions / close:** 99999/999999, NaN, negative, absent and valid explicit-zero inputs across source/line/transformer/ElmNec; sentinel source probe BLOCKED/null; invalid ElmNec X0 combined with valid R0 cannot silently become pure R; genuinely explicit pure-R grounding still works. **Dependency:** A1's completeness status.

### A3 — P0: correct transformer Z0 R/X decomposition and base use

**Evidence / root cause:** `sequence-network.ts:308–320` sets X0 equal to uk0 impedance magnitude, then adds R0; missing/zero ur0 silently inherits positive-sequence `tr.rPu`. `x0tor0` is imported but not used. Consequently even a complete finite input can yield the wrong current.

**Reproduced mini-DGS:** 110/10 kV, 100 MVA D/YN transformer, uk=10%, uk0=10%, ur0=6%, pcutr=0, neutral resistance=0, nominal tap, source at HV R1=R2=0/X1=X2=10 Ω. At LV engine gives Z0=0.06+j0.10 Ω and Ik1=40.611508371 kA; uk0/ur0 require Z0=0.06+j0.08 Ω. Expected current is independently `sqrt(3)*1.1*10 / hypot(0.06, 2*(10*(10/110)^2+0.1)+0.08)`.

**Minimal change:** derive X0 from magnitude and explicit R0 on one documented base; reject impossible R0>|Z0| and unsupported missing decomposition. Preserve zero resistance as a real input. Use x0tor0 only if its interpretation is locally evidenced; otherwise block, never guess. Apply neutral impedance on its own winding base and maintain neutral-tap normalization. Do not introduce blanket KT/KG/KS corrections.

**Assertions / close:** the above Z0 and independent current within relative 1e-6; ur0=0 with nonzero positive R must not inherit positive R; HV/LV tap and nonmatching nominal/type ratios tested analytically; keep existing YN/D, YNyn, pure-R and open-line/transformer cases with explicit sufficient data. **Dependency:** A2.

## Package B — results lifecycle (two tasks)

### B1 — P1: resume by missing electrical targets, not row length

**Evidence / root cause:** `src/analysis/ytm-study/index.ts:115,118,127,131` tests row length/CANCELLED and then reruns all targets. It does not share the correct identity coverage logic used at `:38–45,52–59,157–160`.

**Reproduced:** imported `syntheticBenchmarkPair(true,true)` → FAST SC MAX study, targets SYN-B0/SYN-B1. Replace both stored 3F entries with copies of first entry, then call `runYtmStudy(...,{resume:first})`. Result remains BUDGET_EXHAUSTED, SC_MAX pending=1, IDs B0/B0, and **zero** SC_FAULT progress events. The pending-count fix works; Devam never fills the missing row.

**Minimal change:** derive validated completed electrical-target coverage once; submit only missing/cancelled targets, merge by stable target identity, project aliases once. Reject incompatible old mode/source/profile records. Count quality/pending consistently without duplicate FID inflation.

**Assertions / close:** duplicate-hole case completes; cancelled one of two targets causes exactly one electrical target to be solved, preserving completed rows; aliases count once per electrical calculation; all four MAX/MIN/3F/1F slots complete independently. **Dependency:** A fixes for new numerical results.

### B2 — P0: reject incompatible and obsolete stored numerical results

**Evidence / root cause:** `src/app/controller.ts:185–186` restores the study branch's nested selected SC/context wholesale after parent model/scenario/settings checks. The fixed standalone path `:187–194` compares the pair, but neither path proves that the saved context hashes to the numerical result or that the result used the current engine revision. `src/domain/results/sc-selection.ts:6–25` checks model/scenario/scope and pair consistency, not that an arbitrary stored pair matches its source context. This is a remaining validation gap, not a reversal of 48cb5d8.

**Minimal change:** shared result admissibility for study and standalone restore, selected modes, and presentation: model/scenario, correct fault type/method/mode, sourceHash versus compatible source context, and study identity per-mode hashes. Persist a numerical engine revision and invalidate pre-fix results so today's incorrect 1F values cannot survive reload as current. Re-adapt current native inputs with recorded options when necessary; do not compare MIN results against an unrelated MAX context.

**Assertions / close:** controller-path valid reload restores all four results; mismatched nested study pair, method, context, source hash, scenario, model and legacy engine revision cannot produce current numerical UI rows. A save failure is visible. Existing standalone matching-pair behavior stays valid. **Dependency:** A1–A3, B1; verified with C1 rather than a copied local predicate.

## Package C — one application-level proof (two tasks)

### C1 — P1: imported mini-DGS engine → screens → exports → reload

**Evidence:** genuine imported analytical unit tests exist at `tests/unit/short-circuit-1lg.test.ts:28–94,150–224,298–328`; UI fixture tests at `tests/unit/analysis-compact-rows.test.ts:58–204,335–375,562` do not exercise the full application. `tools/workspace-unification-browser.mjs:34–35` downloads without comparing contents and reloads without asserting 1F; `tools/analysis-ux-browser.mjs:17` injects prepared results.

**Minimal change:** extend/reuse a small native DGS fixture with explicit source sequence data, one grounded transformer, two or three buses, stable sites and Turkish names. Import through the actual app, calculate through its worker/controller workflow, never assign final `scResult`/study numbers. Reuse independently derived expectations from A tasks. Await actual application persistence; use real `page.reload()` and reimport the same model. Add a deterministic limited-budget/cancel/resume case and stale rejection cases.

**Assertions / close:** numerical 3F/1F MAX/MIN match analytical tolerance; identical FID/electrical ID/site/mode/unit/current across Analizler, lightning, map and parsed CSV/XLSX/JSON downloads; missing values remain null/status, not 0. CSV Turkish text and decimals survive. Reload returns same compatible values/identities and rejects poisoned/obsolete stored records. Evidence class **B**; separately label fixture presentation class **C**. **Dependency:** A+B.

### C2 — P1: finish cross-surface desktop contract acceptance

**Evidence:** `compact-rows.ts:53–159`, `compact-study-view.ts:95–136,210–230`, `src/map/lightning-sc-panel.ts:224–243`, and `src/domain/benchmark/map-layer.ts:102–153` implement most contract pieces; they require combined browser assertions, not a redesign. Note `compact-rows.ts:146–153` currently combines 1F Z1/Z2/Z0 with 3F Zkk in detail/export fields.

**Minimal change / assertions:** C1 checks exact seven primary headers, LF U/angle only for current converged LF, A/kA Turkish formatting, search/sort/SC status selector, unique site IDs despite equal names, 33/34.5/66/154/400 kV filters, table-local scrolling, modal/menu access. Label separate 3F driving-point and 1F loop impedances so the displayed Zkk cannot be mistaken for Z1+Z2+Z0+3Zf. PF-only 3F MAX works without GA; PF 1F/MIN is blocked. TM maximum uses deduplicated electrical buses at selected kV; legend describes bus aggregation. Make only fixes exposed by these assertions. **Close:** parsed downloads and browser assertions agree; no fixture is claimed as computation. **Dependency:** C1.

## Package D — bounded reference and delivery gates (three tasks)

### D1 — P1: one honest selected SN4/PF 3F comparison

**Available inventory, supplied by Codex:** Downloads `20261008_1000_SN4_TR0_dosyaları.zip` contains model `20261008_1000_SN4_TR0.zip`, workbook `PowerFactory_ShortCircuit_20261008_1000_SN4_TR0_20261009_153244.xlsx`, matching `.Reference_Package.json` and diagnostic. Workbook manifest SHA256 `d9bd6a635d25c458042606d1c7c91f99c22a8b6450af9d63ecd271566f6962cd`. PF modelHash `sha256:8a15c098137d2882207ff44fdd14b06f5eb8361f4b2b6f4978016084245798f2`; scenarioHash `sha256:cf1da96213ef034b4d79e9df394fb9785c43aacf54eeb747f8c26cd872b3c21a`. Manifest explicitly 3PH/MAX, IEC60909 requested/effective, Rf=Xf=0, 4686 physical/3768 electrical buses; per-fault device contributions NOT_RECORDED.

**Change/test:** use current comparison helpers `src/analysis/ytm-study/export.ts:27–41`, validate actual model/workbook identity and settings, calculate one selected 10–20-bus sample (include available listed regression/outlier FIDs), retain private outputs only locally. Report matched n, MAE, P95, max and individual deltas, dedup electrical buses; distinguish incompatible diagnostic rows from parity-valid rows. Fixed-five 400 kV historical MAE 0.1472 main /0.2736 branch is historical only unless reproduced under equivalent conditions. No second broad search or repeated country benchmark.

**Close:** real class-A result or precise mismatch/blocked evidence, never inferred identity from filenames alone. Keep B3337=245.707314686 and B4351=252.407951296 kA visible as UNRESOLVED_CAUSE; no device-current summation explanation without per-fault records. PF 1F remains REFERENCE_MISSING. **Dependency:** A; C can proceed without this reference.

### D2 — P2: run only authorized desktop final E2E

**Evidence:** `package.json:12` invokes scripts with mobile checks; `tools/workspace-unification-browser.mjs:33` loops 640/420/390; `tools/analysis-ux-browser.mjs:25` includes 768/390. Codex also identified mobile paths in PF/map/SLD scripts and imported helpers.

**Minimal change:** one desktop-only test option/environment switch covering all invoked scripts/helpers; retain existing desktop LF/N-1/SLD assertions, skip mobile/touch paths. Required new viewport cases are 1366×768 and 1920×1080, plus 125% scaled desktop. CSS zoom/deviceScaleFactor is **emulation**, not observation of native Windows scaling; record the exact method, do not alter user OS settings.

**Close:** controls, internal table scroll, lightning, map, modal and menus remain accessible in both resolutions and scaled case; no horizontal page-control loss. Run typecheck and appropriate targeted tests together; final full unit/regression + desktop-only E2E once after changes. Only proven failures permit focused reruns. **Dependency:** C.

### D3 — P2: final portable and auditable delivery

**Evidence:** baseline artifact hash matches the user's claim, but it precedes these necessary fixes; build command is `package.json:15`. **Change:** generate `dist-portable/GridAnalyzer_v7.html` from final sources using `npm run build:portable`; load the actual portable in a browser and run a small import/calculation interaction. Record bytes and SHA256, then verify byte identity with the final HEAD blob.

**Close:** logical commits and push only to the existing branch, no private datasets/results committed; Codex independently reviews diff, decisive assertions, evidence classes, HTML identity and remote HEAD. Final `docs/SC_CODEX_FINAL_ACCEPTANCE.md` lists all A1–D3 dispositions and separate functional/PF decisions. Preserve user untracked paths. No PR, merge, reset, rebase or branch deletion. **Dependency:** all feasible work; external-data limitation must be explicit, not fabricated into PASS.

## Physical validity and exact finish order

The supported core is an **uncertified network approximation**: positive-sequence sparse solution and explicit per-unit/ohmic conversions; 1F sequence relation is implemented, but A1–A3 currently prevent a safety acceptance. `src/analysis/short-circuit/method-evidence.ts:7–12,30–39` correctly keeps normative status BLOCKED and KT/KG/KKW unimplemented. Preserve this gate. No primary reference is available to justify silently changing correction factors or claiming neutral-tap behavior is normatively proven. Analytical agreement establishes mathematical implementation of the stated model, not full IEC or PF validity.

Sol execution order is **A1 → A2 → A3 → B1 → B2 → C1 → C2 → D1 → D2 → D3** (D1 may run after A when convenient). These are four finite engineering packages, not new phases. One implementation turn and at most one grouped failure correction turn. Do not undertake an additional general audit.

Functional acceptance requires all reproduced P0s closed, true class-B 3F/1F chain including application reload, correct pending/resume, cross-surface/export identity, desktop coverage and valid portable. PF 3F can only be evaluated against matched actual inputs/settings; PF 1F cannot be numerically validated with the available package. Missing external parity evidence alone does not erase completed functional work. Any remaining feasible functional gate failure or misleading solved/verified status requires **FAIL — BRANCH DELETE RECOMMENDED**, with no deletion. Astra hands off this plan now and stops.
