# DGS/PSS/E workspace and Analysis parity

## Shared shell and mode-specific workspaces

DGS and PSS/E retain one file picker, the same primary navigation labels (**Şebeke Modeli**, **Harita**, **Tek Hat Şeması**, **Analizler**, **Yardım**, **Ayarlar**), and an explicit mode badge. The active mode selects separate model, map, SLD, Analysis, settings, and help features. PSS/E views use their own search state and do not inherit DGS filters or analysis settings. The DGS importer, model, solver, map, SLD, settings, and help implementations were not replaced with PSS/E code.

PSS/E ZIP upload preserves IEC/GCP/MON/CON and non-DGS inventory JSON as opaque attachments attached to the selected model's source SHA-256. They show their archive name, byte count, format, and file SHA-256 and can be downloaded unchanged. Inventory JSON is explicitly labelled `INVENTORY_JSON`, never treated as DGS/RAWX electrical input or parsed IEC/N-1 results. A ZIP with a DGS model and a PSS/E model prompts for an explicit member.

## Analysis workspace

PSS/E Analysis keeps the method selector and primary calculate/cancel/recalculate action visible. Advanced solver settings start collapsed. Before a calculation, one compact prompt replaces empty summary, violation, identity, and export sections. After calculation, the searchable/sortable, paged result table is the first result view and CSV/JSON exports sit in its toolbar. The selected method's readiness and top blocking codes are visible; unsupported AC and DC options are disabled with an explanation. The user can set positive AC tolerance and maximum iterations. During a run, progress/status is visible. A worker exception shows its method, phase, source/model/scenario identities, and available stack separately from a structured numerical `BLOCKED` result.

The result table keeps `GA_PSSE_CALCULATED`, `SOURCE_SAVED`, and `PSSE_REFERENCE` distinct. A partial numerical success is labeled `LIMITED_PROFILE`. Lossless DC reports Vm as unavailable (`—`); the fixed 1 pu value remains a diagnostic input assumption only. The Analysis view lists voltage and thermal violations only for solved AC values and available source limits or explicitly labeled study thresholds. Calculation identity hashes are available under **Hesap kimliği** without dominating the first screen.

## Same-viewport visual checks

The public synthetic DGS fixture and public synthetic RAWX were captured in Chrome at 1600×1000 before and after the shared-shell work:

| View | Before | After |
|---|---|---|
| DGS Analysis | [before](evidence/psse-ui-parity/before/dgs-analysis.png) | [after](evidence/psse-ui-parity/after/dgs-analysis.png) |
| DGS map | [before](evidence/psse-ui-parity/before/dgs-map.png) | [after](evidence/psse-ui-parity/after/dgs-map.png) |
| DGS SLD | [before](evidence/psse-ui-parity/before/dgs-sld.png) | [after](evidence/psse-ui-parity/after/dgs-sld.png) |
| PSS/E Analysis | [before](evidence/psse-ui-parity/before/psse-analysis.png) | [after](evidence/psse-ui-parity/after/psse-analysis.png) |
| PSS/E map | [before](evidence/psse-ui-parity/before/psse-map.png) | [after](evidence/psse-ui-parity/after/psse-map.png) |
| PSS/E SLD | [before](evidence/psse-ui-parity/before/psse-sld.png) | [after](evidence/psse-ui-parity/after/psse-sld.png) |

The DGS before/after screenshot SHA-256 values match exactly:

- Analysis: `15dd13f3566158365095082e465e23abd9c671d969fb4731d7d7ed3a6977b16b`
- Map: `efd75498c3a1f6487278462a8a1b8a1f342419c48d8d194e3c2bd01a0b1a62ff`
- SLD: `a5c585d3d2de035a3a5ff3f718883b753366bcbbee50ba446ed9542d2c4f004a8`

The updated Analysis workspace has separate 1600×1000 initial and calculated screenshots from both real installed browsers: [Chrome initial](evidence/psse-v2/offline-browser/chrome-initial.png), [Chrome calculated](evidence/psse-v2/offline-browser/chrome-calculated.png), [Edge initial](evidence/psse-v2/offline-browser/msedge-initial.png), and [Edge calculated](evidence/psse-v2/offline-browser/msedge-calculated.png). The initial capture shows the always-visible method/action, one concise first-run panel, and no empty export rows. The calculated capture shows the result table, search/sort/pagination, and nearby CSV/JSON exports.

The Chrome visual and diagram proof is [after/chrome.json](evidence/psse-ui-parity/after/chrome.json). It records no browser errors or external requests and checks the Turkey basemap, voltage filters, searchable topology, pan/zoom, fullscreen, PNG export, orthogonal SLD, shared device symbols, three-winding legs, and no displayed internal star busbar. Public coordinate association and the empty user mapping template are retained as [GEO_PROVENANCE.csv](evidence/psse-v2/GEO_PROVENANCE.csv) and [TM_KOORDINAT_ESLEME_SABLONU.csv](evidence/psse-v2/TM_KOORDINAT_ESLEME_SABLONU.csv); no source coordinates or source row identifiers are published.

## Control matrix

| Function | DGS reference | PSS/E behavior and placement | Proof / remaining gap |
|---|---|---|---|
| Primary navigation and upload | Existing DGS feature factories and common model picker | Same navigation labels and same single picker; mode selects independent PSS/E model/map/SLD/Analysis/settings/help views | Before/after screenshots and offline upload smoke. DGS factories and filters remain in place. |
| Search and scope filters | DGS site/voltage and workspace filters | PSS/E map/SLD controls search all bus numbers, connection keys, and names; filter by area, zone, base-kV, and service state; low-voltage ≤36 kV is explicit and includes 36 kV; unknown kV has its own option | Diagram Chrome proof includes search to high bus numbers and unknown-kV labeling. Geographic association uses explicit `isub` or one exact unique source-name match; ambiguous/unmatched buses are not guessed onto stations. |
| Palette and result layers | Existing DGS voltage, loading, and analysis palettes/settings | PSS/E has `SOURCE_SAVED` and fresh `GA_PSSE_CALCULATED` layers. Bus fill uses saved/calculated Vm, and connected equipment/branch colors use voltage base or calculated loading; DC Vm remains unavailable/gray. Results from an old engine or another source/model/topology/scenario cannot color the current view; Analysis also invalidates changed method/options. | Public synthetic screenshots and actual-model sanitized route/browser evidence. Some source rows remain BLOCKED; a layer never implies missing calculations. |
| Tooltip and selection detail | Existing DGS model/analysis detail panels | PSS/E map/SLD tooltips show source IDs, circuit/endpoints, status, saved or calculated provenance, available P/Q/S/current/loading, and open a source/normalized detail dialog | Diagram browser proof checks searchable selection and source-faithful details. PSS/E SLD is bus-branch; it does not infer physical node-breaker terminals. |
| Export | Existing DGS map and model export paths | PSS/E map/topology exports PNG; its SLD exports self-contained SVG with source/scenario/calculation metadata, bundled styles, symbols, and legend. Analysis exports JSON and bus/branch/generator CSV | Synthetic browser verifies downloads; final HTML is tested offline. Coordinates that cannot be safely associated remain unplaced rather than invented. |
| Basemap | Existing DGS map renderer and settings | PSS/E geographic map uses the local vector Turkey basemap and shared theme; source station TM coordinates supply only verified points. Lines between stations are straight schematic links. | Same-basemap/pan/zoom/fullscreen/PNG tests pass. No online tile/CDN request is required; geographic paths are not routing geometry. |
| Voltage presentation | DGS existing voltage bands/palettes | PSS/E offers explicit base-kV filters, selectable unknown-base group, voltage-level palette, and ≤36 kV group (36 included); map and SLD labels separate physical base-kV from per-unit Vm | Synthetic and private real-source diagram proof and unknown-kV option/label assertions. Missing physical kV is never replaced by a guessed voltage base; associated current-A values stay unavailable. |

## Offline browser acceptance

The final `file://` build uses the same production TypeScript feature modules and inline Blob workers. Its Chrome and Edge smoke reports share the current HTML SHA-256 recorded in [Chrome](evidence/psse-v2/offline-browser/chrome.json) and [Edge](evidence/psse-v2/offline-browser/msedge.json). Both report all three synthetic methods converged, DGS JSON/ZIP and PSS/E RAWX uploads, a mixed DGS+PSS/E ZIP member choice, all five opaque attachments (four sidecars plus inventory JSON), Analysis search/sort/page-size, CSV, settings/help, map, and SLD. Both include separate initial and calculated Analysis captures at 1600×1000. Neither browser made an external request or logged a console error.

These UI checks prove rendering and interaction on public synthetic models. They do not change the numerical parity limits in [the model-fidelity report](MODEL_FIDELITY_REPORT.md) and [the AC/DC parity report](PSSE_AC_DC_PARITY_REPORT.md), and they do not make unsupported source physics READY.

## Final artifact and identity evidence

The extracted FIXED ZIP `index.html` is `e50035bf2b11826b7af34617be6d988a73a01adc9c350ff3ca981d7d72aaa32d` (2,510,822 bytes). Chrome and Edge both pass on these exact bytes. The current public initial/calculated screenshots and small-model reports are copied from those extracted-file runs. Actual-source file and GA-route reports are [Chrome](evidence/psse-v2/native-browser/chrome.json) and [Edge](evidence/psse-v2/native-browser/msedge.json). They verify real blocked AC dispatch, DC, mixed-member selection, attachments, cancellation, error stacks, foreign reference rejection and selected-method/options staleness. [Aggregate proof](evidence/psse-v2/browser-acceptance.json) records the reuse boundary. Private model screenshots are excluded.
