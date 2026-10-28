# V4 UIFIX3 real-model browser E2E

**Status: in progress.** This is a private local validation record for the offline UI build. It contains no real-model names, identifiers, coordinates, numeric results, or screenshots.

## Scope

- Load the user-owned PSS/E ZIP through the browser file picker in Edge and Chrome using the standalone `file://` build.
- Run a full AC Newton–Raphson case from `SOURCE_SAVED`, then exercise map flow values, branch detail, a one-branch outage and recalculation, Baz/Senaryo/Fark comparison, and undo.
- Measure basemap canvas and SVG registration, pointer-anchored wheel zoom, child-element drag pan, viewport resize, DPR 1/1.25/2, and map fullscreen.
- Compare the local DGS model ZIP at 1600×1000 and 1366×768. All real-grid captures remain under the ignored `local-benchmark-results/psse-offline-browser/uifix3-private/` directory.

## Interim Edge evidence

The first run against the current standalone offline build imported the private PSS/E ZIP and completed full AC NR in 17.7 seconds. The result was classified `LIMITED_PROFILE` / `SOLVED_APPROXIMATE` and its source card and worker request identified `GA_PSSE_CALCULATED` and `SOURCE_SAVED` respectively. The map exposed calculated P flows.

At 1600×1000 and DPR 1, the first geometry sample measured a 125.4 CSS-pixel toolbar, a 1566×755 CSS-pixel map stage, and co-located canvas/SVG bounds of 1564×753 pixels. Canvas backing-store scale error and canvas/SVG overlay error were both 0 pixels. Pointer-anchored zoom drift was 0.093 CSS pixels.

That run stopped at the fit-button locator after the UI changed its accessible name. The branch scenario, comparison, undo, fullscreen, DGS comparison, and Chrome pass remain outstanding. A new run is in progress against the updated locator and canvas-transform measurement hooks; this report will be replaced with the completed aggregate when those checks finish.

## Privacy and evidence

The harness writes screenshots only to the ignored private output directory. The tracked aggregate records browser/build metadata, workflow classifications, and geometry error measurements only. It omits source paths, source/model hashes, equipment names, identifiers, coordinates, calculated values, and screenshots.
