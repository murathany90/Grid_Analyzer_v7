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

## V4 session outcome (implemented)

The panel was extended in this session (commit series ending `ace1669`→`249fc93`→ this commit) without removing the V3 capture layer:

- `attachments.ts`: catalog-only parser `parsePsseInventoryCatalog` for the YTBS inventory JSON — per-table `{recordCount, malformedCount}` for `bus/acline/transformer/generator/load/fixshunt/sysswd/contingency`, BOM-tolerant, opaque-on-invalid (returns `null`), rows kept unmodified; identity label index keyed `(table, ibus, ckt|machid|id) → ad`, most-specific key first, **no name-only merging**; `contingencyCount` documented as future N-1 input candidate, never a result. `.sav` classification (`VERIFIED_INPUT`) added additively.
- `attachment-view.ts`: 'Kaynak Ekleri / YTBS Dosyaları' heading; per-row status badge with exactly `ARCHIVED` / `CATALOG_ONLY` / `VERIFIED_INPUT`; full `SHA-256 <64hex>` kept text-visible; expandable catalog: 8 table counts + malformed counts, ≤50 preview rows per table with `ad` as primary text and `ibus/ckt/machid/id` as secondary technical keys; contingency labeled 'gelecek N-1 girdisi adayı (sonuç değil)'; download byte-exact; per-model isolation preserved and tested.
- Tests: `tests/unit/psse-attachment-inventory.test.ts` (6) + the pre-existing roundtrip/integration tests — 13/13; full suite 880/880 on the committed head; Chrome `file://` smoke (which asserts the 5 opaque sidecars, visible SHA provenance and byte-exact `.iec` download) PASS with zero external requests.
- Still WIP: wiring the catalog's identity labels into the map/SLD primary naming (TM/line display names from the YTBS `ad` fields) — the catalog and lookup API exist; the network-view naming integration is next-session work. `.seq`/`.dyr` types remain recognized-but-absent. Security gates (zip-slip, bomb, size, model isolation) unchanged from V3.
