# DGS regression report

**Updated:** 2026-10-27

The DGS model, solver, and import path remain in use for DGS mode. PSS/E uses an independent typed model, solver and result path behind the shared **Şebeke Modeli / Harita / Tek Hat Şeması / Analizler** navigation, one shared model file picker, and a visible **DGS MODU** or **PSS/E MODU** header card.

## Verification

- `npm run typecheck` passes.
- Focused PSS/E solver and reference comparison tests pass: **35/35**.
- `npm run test:e2e` passes end to end, including DGS model/map/SLD, N-1 and short-circuit, workspace unification, analysis UX, and network-model browser checks. The existing network-model browser harness now selects the active DGS workspace under the common mode router.
- `evidence/psse-ac-dc/dgs-regression/aggregate.json` records all nine `npm run test:e2e` suite completions and hashes for the retained public proof JSONs and screenshots. It contains only public synthetic fixtures. The current extracted ZIP HTML (`8d06b8f7e2ddf1ae83e0c1e139388328fc237638d52398c5e4719f5637abb235`) loaded DGS JSON/ZIP, PSS/E RAWX and a mixed ZIP member, retained common navigation, and completed NR, FDNS_XB and DC plus CSV, settings/help, map and SLD checks in Chrome and Edge. Both runs made zero external requests and recorded zero blocked requests and console errors. Sanitized reports and screenshots are retained in `evidence/psse-ac-dc/offline-browser/`, with hashes in `aggregate.json`.
- Full native-source browser acceptance also passed in Chrome and Edge: exact SAV, RAW, and one-member SAV ZIP identities/counts, real DC `LIMITED_PROFILE` with no fabricated Vm, switching away during a second DC run, and synthetic JSON/CSV plus reference-import checks. Both runs remained offline with zero console errors. Sanitized reports and their proof hashes are in `evidence/psse-ac-dc/native-browser/aggregate.json`; private real-model screenshots remain ignored.

The post-implementation-commit `npm test` run passes **850/850 tests with zero skips**. Its log is `evidence/psse-ac-dc/final-tests.log`; the initial run and BP golden failure are retained separately as `final-tests-before-bp-golden.log`.

The first remote CI run exposed the previous README-only root-document convention once the seven requested delivery reports were tracked. The focused repository-documentation regression now passes with an exact authorized report list; Markdown link resolution and private-file exclusions remain checked. Remote CI intentionally skips 22 installed/licensed model fixture checks that ran locally; their inputs are excluded from Git. The final head's actual CI result/log is retained in the delivery metadata.

The offline browser checks use local `file://` pages with external network access disabled. They verify the DGS path in the same artifact that contains the PSS/E features; they do not substitute the PSS/E import path for DGS.
