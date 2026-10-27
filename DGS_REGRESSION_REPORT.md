# DGS regression report

**Updated:** 2026-10-27

## V2 correction verification

The complete `npm run test:e2e` chain passes again on the V2 checkout: all nine browser suites, including model/map/SLD, N-1, short-circuit, workspace unification, Analysis UX and network-model state/export checks. Actual terminal log: `evidence/psse-v2/final-dgs-e2e.log`; its SHA-256 and scope are in `evidence/psse-v2/dgs-regression.json`.

At 1600×1000, DGS Analysis, map and SLD before/after screenshot hashes match exactly. Protected DGS electrical/model/map/SLD modules have no source diff from the feature baseline; shared picker/controller changes add safe JSON classification, PSS/E attachments and mode/error isolation. No DGS solver or screen was adapted to PSS/E.

The final complete unit/regression run passes **860/860, zero skips**, including the installed licensed fixtures. Log: `evidence/psse-v2/final-tests.log`. The first V2 full run caught a JSON-only ZIP reader regression (857 pass, one fail); the generic JSON-only contract was restored, its focused 14 tests pass and the complete suite was rerun successfully. Both the failed run and targeted repair log remain in the same evidence directory. This preserves the baseline reader test rather than weakening it. Final lint, typecheck, standard build and portable build pass; the portable artifact matches its committed raw-byte hash and a consecutive rebuild. V1 results below are historical.

The DGS model, solver, and import path remain in use for DGS mode. PSS/E uses an independent typed model, solver and result path behind the shared **Şebeke Modeli / Harita / Tek Hat Şeması / Analizler** navigation, one shared model file picker, and a visible **DGS MODU** or **PSS/E MODU** header card.

## Historical V1 verification

- `npm run typecheck` passes.
- Focused PSS/E solver and reference comparison tests pass: **35/35**.
- `npm run test:e2e` passes end to end, including DGS model/map/SLD, N-1 and short-circuit, workspace unification, analysis UX, and network-model browser checks. The existing network-model browser harness now selects the active DGS workspace under the common mode router.
- `evidence/psse-ac-dc/dgs-regression/aggregate.json` records all nine `npm run test:e2e` suite completions and hashes for the retained public proof JSONs and screenshots. It contains only public synthetic fixtures. The current extracted ZIP HTML (`8d06b8f7e2ddf1ae83e0c1e139388328fc237638d52398c5e4719f5637abb235`) loaded DGS JSON/ZIP, PSS/E RAWX and a mixed ZIP member, retained common navigation, and completed NR, FDNS_XB and DC plus CSV, settings/help, map and SLD checks in Chrome and Edge. Both runs made zero external requests and recorded zero blocked requests and console errors. Sanitized reports and screenshots are retained in `evidence/psse-ac-dc/offline-browser/`, with hashes in `aggregate.json`.
- Full native-source browser acceptance also passed in Chrome and Edge: exact SAV, RAW, and one-member SAV ZIP identities/counts, real DC `LIMITED_PROFILE` with no fabricated Vm, switching away during a second DC run, and synthetic JSON/CSV plus reference-import checks. Both runs remained offline with zero console errors. Sanitized reports and their proof hashes are in `evidence/psse-ac-dc/native-browser/aggregate.json`; private real-model screenshots remain ignored.

The post-implementation-commit `npm test` run passes **850/850 tests with zero skips**. Its log is `evidence/psse-ac-dc/final-tests.log`; the initial run and BP golden failure are retained separately as `final-tests-before-bp-golden.log`.

The first remote CI run exposed the previous README-only root-document convention once the seven requested delivery reports were tracked. The focused repository-documentation regression now passes with an exact authorized report list; Markdown link resolution and private-file exclusions remain checked. Remote CI intentionally skips 22 installed/licensed model fixture checks that ran locally; their inputs are excluded from Git. The final head's actual CI result/log is retained in the delivery metadata.

The offline browser checks use local `file://` pages with external network access disabled. They verify the DGS path in the same artifact that contains the PSS/E features; they do not substitute the PSS/E import path for DGS.

## Final V2 offline and identity closure

The complete local suite finishes 860/860 with zero skips. Final current-result identity negatives pass 32/32 with the solver group. Both installed browsers pass the extracted FIXED artifact (`e50035bf2b11826b7af34617be6d988a73a01adc9c350ff3ca981d7d72aaa32d`), including DGS JSON/ZIP and mixed ZIP choice, PSS/E RAWX, all three supported synthetic algorithms and separate actual-source LIMITED_PROFILE/BLOCKED behavior. DGS mode is restored during an active PSS/E calculation with no stale PSS/E result visible. See `evidence/psse-v2/browser-acceptance.json`. The final remote-head CI result belongs to delivery metadata; no earlier CI run is reused as the final head's result.
