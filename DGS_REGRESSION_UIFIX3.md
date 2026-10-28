# DGS regression for UIFIX3

**Status: PASS.** The existing DGS browser regression suite and a separate private-model DGS comparison both passed.

## DGS suite

`GA_DESKTOP_ONLY=1 npm run test:e2e` exited 0 after all nine browser commands. Coverage included full AC, N-1, short circuit, single-line diagrams, workspace switching, and analysis UI. The run caught hidden-map label collisions and the selectors were scoped to the visible DGS map; the final suite completed without failed assertions.

## Local model comparison

Chrome 156.0.8078.48 and Edge 156.0.4314.50 loaded the user-owned DGS model ZIP in the final offline build. The DGS model and map rendered at 1600×1000 and 1366×768. The PSS/E path was also reloaded first in each browser, and its results stayed in the separate PSS/E workspace.

Both DGS imports completed with zero external or blocked network requests and no browser page or console errors. PSS/E geometry and basemap registration passed DPR 1, 1.25 and 2 checks. The real DGS comparison was captured at the two requested viewport sizes. Screenshots remain local under ignored `local-benchmark-results/psse-offline-browser/uifix3-private/`; no model records, names, hashes, coordinates, values, or images are included here. The sanitized Chrome/Edge result is in [the browser E2E aggregate](evidence/psse-uifix3/browser-e2e-aggregate.json).
