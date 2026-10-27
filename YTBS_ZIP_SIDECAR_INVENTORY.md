# YTBS ZIP sidecar inventory — V4 status (2026-10-28)

Branch `fix/psse-v1-real-model-parity`, commit `ace166996ba66d1643d2da07af44c15673c854a4`.

## Implemented foundation (from V3, verified present and regression-protected)

- `src/importers/psse/attachments.ts`: byte-preserved sidecar capture with SHA-256 for `IEC`, `GCP`, `MON`, `CON`, inventory `JSON` beside the main `.sav`; hash/byte roundtrip is covered by committed tests.
- `src/features/psse/attachment-view.ts`: downloadable `details` panel listing captured attachments (name, type, size, SHA, download).
- Real example package used in evidence: `20261026_1600_SN1_TR0.zip` (sav 4.544.028 B; iec 248.970 B; gcp 37.468 B; mon 272 B; con 192.332 B; json 4.467.218 B) — kept only in private locations.

## Semantic classification (documented, not fabricated)

| Extension | Status in this build |
|---|---|
| `.sav` | main electrical model, native importer |
| `.json` | YTBS inventory JSON — **not RAWX, not a DGS file**; tables `bus/acline/transformer/generator/load/fixshunt/sysswd/contingency` preserved as opaque sidecar data with record counts; identity-based label merging (ibus/ckt/machid/terminal keys) is the documented target but the UI merge is **WIP, not in this commit** |
| `.iec` | archived sidecar; NOT an automatic short-circuit result |
| `.con` | archived sidecar; NOT an applied contingency set; records are future N-1 input candidates only |
| `.mon`, `.gcp` | archived sidecars; no verified semantic loader |
| `.seq`, `.dyr` | recognized types per the YTBS guide; absent from the example ZIP and therefore not shown |

`ARCHIVED`/`CATALOG_ONLY` statuses are surfaced without pretending any of these feed the solver.

## V4 session outcome

The 150-minute window was spent on the P0 AC/FDNS mandate (see `AC_FDNS_ROOT_CAUSE_V4.md`); the planned inventory-UI extension ( Şebeke Modeli → Envanter → 'Kaynak Ekleri / YTBS Dosyaları' sub-tab with per-attachment provenance, record counts, model-hash isolation and identity-based readable naming) is **not implemented in this session**. No existing attachment code was removed or regressed: the full unit/regression suite (873/873, `.tmp/v4-final-tests.log`) passes on commit `ace1669`, including the attachment roundtrip tests. Security gates from the mandate (zip-slip, compression-bomb, size limits, model-change isolation) remain as in V3 and were not modified.

**Honest status: WIP.** The foundation is intact and tested; the readable-name/label-merge UI layer remains open work for the next session.
