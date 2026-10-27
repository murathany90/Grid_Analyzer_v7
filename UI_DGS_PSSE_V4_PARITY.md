# DGS ↔ PSS/E UI parity — V4 status (2026-10-28)

Branch `fix/psse-v1-real-model-parity`, commit `ace166996ba66d1643d2da07af44c15673c854a4`.

## What exists (verified this session)

- Separate PSS/E modules kept isolated from DGS data/results: `src/features/psse/{map-view,sld-view,analysis-view,geography,diagram-utils,view-model,psse-diagrams.css}`. `git diff acd6d86..ace1669 -- src/map src/features/sld` is **empty**: DGS reference code untouched.
- PSS/E map: toolbar filters (YTM/AREA, Trafo Merkezi, BM/bus OWNER, exact-kV group, service status, SOURCE_SAVED/GA_PSSE_CALCULATED layer, single inclusive ≤36 kV checkbox), basemap + network SVG stage, fullscreen toggle, Chrome/Edge `file://` smoke-tested in V3 with zero network requests.
- TM-based horizontal SLD skeleton (voltage-descending busbars, feeder readouts, transformer symbol), analysis view with result tables and CSV export.

## Gap analysis completed this session (spec, not code)

A dedicated read-only exploration compared DGS (`src/map/*`, `src/features/sld/*`) against the PSS/E implementation and produced a concrete, file:line-referenced gap list (session subagent report). Top findings, quantified:

1. PSS/E map is a fixed 1200×690 stage with `preserveAspectRatio:'none'`, a stale `−370px` CSS offset and non-DPR-correct canvas backing store — the Turkey outline distortion root cause. DGS uses element-measured canvases (`rect*dpr`, `setTransform`), `height=innerHeight−top−38`, `scale=min(w/21,h/10)`, cursor-anchored wheel zoom, ResizeObserver→rAF.
2. Voltage colors come from ad-hoc arrays in `psse/diagram-utils.ts` instead of the DGS settings palette (`#e6534e/#8d80d8/#449bda/#51b6bc/#8fb0a0`, loading ramp, delta colors).
3. Exact-kV filter select instead of the DGS 5-band multi-select with a single `≤36 kV` band.
4. No flow arrows/animation overlay, no MW-scaled branch widths (95th-percentile scaling), no delta (Baz/Senaryo/Fark) selector.
5. ⚡ lightning panel not ported yet; required shape: DGS shell with **only 'Yük Akışı' and 'Senaryolar' tabs enabled**, N-1/Kısa Devre disabled (no fabricated results).

## Session outcome

The 150-minute window went to the P0 AC/FDNS mandate; **none of the ten UI parity items above were implemented in this session** — no PSS/E UI file was modified (`git diff acd6d86..ace1669 -- src/features/psse` is empty). The gap list is the deliverable: it is concrete enough to implement directly next session. Visual acceptance screenshots (1600×1000 Map/SLD/Analysis/Attachments/Lightning comparisons) were therefore **not retaken**; the V3 screenshots remain valid for the unchanged UI.

**Honest status: spec ready, implementation WIP.**
