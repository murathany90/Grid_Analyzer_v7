# UI and performance acceptance

UI changes: `22b55a1`, `5ddd97a`; final electrical/UI portable build `872bf86`. Acceptance helper provenance/large-input transport fix: `d3f2add`. Exact final software CI/merge is recorded in report 15.

## Behavior and reproduction

The model-free SC panel now displays exactly “Kısa devre analizi için önce bir şebeke modeli yükleyin.” Advanced controls and exports are hidden until a model exists. 3PH is explicit; LL/1LG/2LG and IEC2016 remain disabled for missing engine/evidence. Existing fault-specific source rejection remains effective. Missing Ip/Ib/Ith stay null/—.

Fresh SN3 portable rendering exposed a batch provenance defect: no selected physical fault caused `selectedScPresentation` to show NOT_RUN despite genuine calculated batch rows. The fix distinguishes SC_BATCH_NETWORK_APPROXIMATION, SC_BATCH_BLOCKED and SC_BATCH_PARTIAL. It never invents a selected fault, changes null/zero semantics, clears a stale gate, or implies normative certification. The shared header uses Türkçe labels while attributes/export retain technical codes.

`study-sc-presentation.test.ts` covers numeric zero, aggregate state, explicitly uncomputed selection, all blocked, cancelled and stale cases. `tools/analysis-evidence-acceptance.mjs` covers actual tiny native results, blur/click-loss, limit conflict, empty SC, disabled IEC/sequence/time controls and six widths. Existing keyboard, map/SLD, signed pixels, cancellation/recovery and export suites remain enabled.

## Actual data and geometry

New SN3 portable/worker results are rendered at 390, 768, 1366, 1440, 1600 and 1920 px: no document overflow, at most 50 table rows; private screenshots are visually inspected. The final batch fix is separately verified by `tools/engineering-real-ui.mjs` using the **freshly computed SN4** snapshots: LF/N-1/SC at all six widths (18 checks), no page errors or calculation requests. This does not repeat a model import or a calculation to measure rendering. Full actual 6,368-terminal data and original long/Türkçe identifiers remain intact.

The helper's initial 169 MB CDP response failed. Same-origin Vite HTTP transport fixed that acceptance-tool problem without reducing the dataset. It also found that the Node caller's LF options identity lacked official Application settings/source hashes. The caller was corrected and LF re-solved, not relabeled; the full numerical hash stayed identical. Neither workaround relaxes production identity checks.

Final actual screenshot review also reproduced an empty SC metric selector after N-1→SC: the prior family's metric persisted across tabs. Analysis tabs now retain each family's own metric and initialize a supported default. A same-family click preserves the existing form/selection; unrelated map selection is cleared on an explicit family switch. The E2E helper asserts that SC remains `ikssKa` across all six tab-switch sequences. No solver or numerical result is changed.

## Measured performance and limits

Same fresh SN4 snapshot, Chromium, 1440×900, identical 25 alternating search operations (5 warmup + 20 samples), immutable result/data and ≤50 visible rows:

| Local warm-filter sample | Hardening `a3cf862` | Final UI |
|---|---:|---:|
| Median ms | 11.60 | 13.10 |
| P95 ms | 18.70 | 15.50 |
| Maximum ms | 22.50 | 18.00 |
| Catalog terminals | 6368 | 6368 |

The two snapshots' numeric fields are deep-equal. These short local timings vary with ambient load; **no new numerical/performance optimization is claimed**. Existing immutable source-row cache and sparse factor/RHS reuse are retained. Earlier 125.25→21.9 ms SN3 hardening figures remain historical, not a speedup attributed to this task.

Fresh SN3 LF engine time 3,379.5 ms; UI/worker end-to-end 20,247.4 ms includes transfer and presentation. Native two-case end-to-end 53,829.7 ms is not interpreted as Newton-only cost. SN4 Node LF 5,296 ms and SN7 3,344 ms are different environments and are not directly compared to browser timings. Sparse reuse, bounded case retention, worker timeout/cancel and scenario/source invalidation stay covered by existing tests. No tolerance/fidelity is traded for speed.

Current limitations: historical results may lack a calculation timestamp; full normative progress/quantities/equipment adaptation remain blocked. Identity/settings/result-time evidence available from each recorded owner is retained; an absent timestamp is not fabricated.
