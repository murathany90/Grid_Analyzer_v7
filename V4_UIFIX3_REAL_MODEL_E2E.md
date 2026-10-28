# UIFIX3 real-model offline browser E2E

**Status: PASS** on the final standalone HTML artifact in Chrome and Edge. The evidence records no private model names, source/model hashes, equipment identifiers, coordinates, calculated values, or screenshots.

## Artifact and browsers

| Item | Result |
|---|---|
| Offline HTML | 2,599,124 bytes |
| SHA-256 | `205cee951ffca1003809e71f831824a5c0dc09365f8112cf5d214ac1f6c9c2fe` |
| Chrome | 156.0.8078.48 · PASS |
| Edge | 156.0.4314.50 · PASS |
| Network | 0 external requests; 0 blocked requests; no page or console errors |

Both browsers opened the user-owned PSS/E ZIP through `file://`, ran the local DGS ZIP comparison, and completed the same workflow against the same HTML hash. All screenshots stay in ignored `local-benchmark-results/psse-offline-browser/uifix3-private/`.

## PSS/E workflow

The selected `.sav` member ran full AC NR from `SOURCE_SAVED`. The worker request retained that initial voltage policy. Numerical status was `CONVERGED`; the published status was `LIMITED_PROFILE`, classification `SOLVED_APPROXIMATE`, and source `GA_PSSE_CALCULATED`. The test does not classify the partial profile as `SOLVED_FULL` or present an external PSS/E reference result.

The map showed finite calculated P flow and nonzero directional arrows. The lightning panel showed missing branch flows for the source-record layer, calculated P/Q/current/loading values for the base result, and numeric differences for the compatible scenario comparison. A served branch was opened from the map and recalculated; Baz, Senaryo and Fark were checked; the branch was undone and recalculated with the same NR options. The selected branch had no arrow in the Senaryo layer. The station detail check also confirmed no stale branch action remained attached to a station.

## Viewport and map alignment

| Viewport | Toolbar | Map stage | Canvas and SVG | Maximum alignment error |
|---|---:|---:|---:|---:|
| 1600×1000, DPR 1 | 93 px | 1566×755 px | 1564×753 px | 0.000030 px |
| 1366×768, DPR 1 | 93 px | 1332×523 px | 1330×521 px | 0.000017 px |

The canvas backing store matched the requested DPR within 0.5 CSS px for DPR 1, 1.25 and 2 at both sizes. Canvas/SVG overlay bounds matched exactly. Projected station centers matched the actual basemap Canvas transform within 0.000030 CSS px. Wheel zoom stayed anchored within 0.128 px; the inverse wheel and fit interactions restored zoom and pan exactly. Dragging an SVG child panned the map without opening its station dialog.

Fullscreen passed at DPR 1, 1.25 and 2 in both browsers with the compact toolbar and closed technical details. The measured map stage used at least the available fullscreen height after toolbar, details and layout spacing.

## DGS comparison and privacy

The matching local DGS model ZIP imported successfully in both browsers. Model and map screenshots were captured at 1600×1000 and 1366×768 for private review only. The tracked aggregate contains only workflow classifications and layout/alignment measurements: [browser E2E aggregate](evidence/psse-uifix3/browser-e2e-aggregate.json).
