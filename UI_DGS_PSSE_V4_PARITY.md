# DGS ↔ PSS/E UI parity — V4 status (2026-10-28)

Branch `fix/psse-v1-real-model-parity`, commits `71c206e` (UI milestone) on top of `ace1669`+`2a7470e`. PSS/E stays a separate module and result store; DGS reference code untouched (`git diff acd6d86..71c206e -- src/map src/features/sld` is empty).

## Implemented this session (verified by typecheck, unit tests and the Chrome `file://` smoke harness)

1. **Map area fills the viewport** (spec gaps 1–3): `.ga-psse-geo-stage` height `clamp(320px, 100dvh − 260px, 1100px)`, fullscreen `100vw/100vh`, the stale `height:auto` override removed; canvas backing store = element `rect × devicePixelRatio`; ResizeObserver→rAF repaint; wheel zoom anchored at the cursor (DGS behavior). Measured live: stage 740 px at 1600×1000, canvas 1566×740.
2. **Single shared coordinate transform** (gap 1): one uniform world→pixel factor `k=min(w/1200,h/690)` drives both the basemap canvas (`translate+scale(k·zoom)`) and the SVG `viewBox` (letterboxed around the world center) — the Turkey outline is now aspect-true at any window size, `Türkiye'ye sığdır` and `Şebekeye sığdır` remain separate actions, PNG export stretches both layers identically.
3. **MW flow arrows** on the calculated layer (gap 4/5, static, reduced-motion safe): 1–3 arrowheads per branch from solved `pFromMw` sign (direction) and magnitude/loading (count, size), DGS arrow fill `#ffe2a2`, tooltips with MW direction and loading; nothing drawn on the SOURCE_SAVED layer (no saved branch flows — honest).
4. **⚡ Lightning panel ported** (gap 9): new isolated `src/features/psse/lightning-panel.ts` using the DGS visual shell (⚡ toggle bottom-right, '⚡ Elektriksel Sonuçlar' header, minimize/close, tab row). **Only 'Yük Akışı' and 'Senaryolar' are enabled**; 'Kısıt (N-1)' and 'Kısa Devre' render disabled with explicit reasons (no PSS/E N-1/SC engine in this package; `.iec` is not a short-circuit result). The LF tab shows model/SHA context, classification, iterations, residual and per-bus Vm/Va from the GA result; the Scenarios tab shows the scenario hash, operation list and the source-file safety note. Read-only over the PSS/E result store.
5. Filters: the pre-existing single inclusive `≤36 kV` checkbox satisfies the single-control rule; YTM/BM/TM/service/layer filters unchanged.

## Remaining gaps (documented, not implemented)

- DGS 5-band voltage multi-select (current exact-kV group select remains; no duplicate ≤36 kV control exists), delta (Baz/Senaryo/Fark) result-role selector, branch-width scaling by 95th-percentile MW, DGS loading/delta palettes in `psse/diagram-utils.ts`, zoom-based label simplification beyond the existing density rule, animated flow (static arrows shipped).
- SLD: DGS horizontal rail bands with orthogonal routing/crossing hops/label reservation (PSS/E SLD keeps its voltage-descending layout).
- Basemap province-border detail levels and legend chips still use the pre-existing PSS/E scales.

## Verification

`npm run typecheck`; focused PSSE unit tests 54/54; `node tools/psse-offline-browser.mjs chrome dist-portable/GridAnalyzer_v7.html` → `status:"PASS"`, 0 external requests, 0 console errors, synthetic DGS+RAWX imports and NR/FDNS/DC solves all green on the rebuilt artifact; screenshot `local-benchmark-results/psse-offline-browser/v4-map-check.png` (private location, synthetic data only). No real-model screenshots are committed.
