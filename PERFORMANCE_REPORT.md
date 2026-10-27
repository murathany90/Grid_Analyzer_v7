# Offline performance report

**Measured:** 2026-10-27
**Artifact:** current standalone `dist-psse/index.html`, packaged as the `index.html` ZIP member
**SHA-256:** `8d06b8f7e2ddf1ae83e0c1e139388328fc237638d52398c5e4719f5637abb235`

The standalone HTML is **2,470,180 bytes** (about 2.36 MiB). It includes the application IIFE, styles, worker code, and required runtime data. The page runs from `file://`, uses Blob workers, and sets `connect-src 'none'`; no web service, CDN, or online runtime is used. This hash matches the `index.html` member extracted from the preliminary ZIP in Downloads; the post-commit delivery archive will be repacked after CI.

## Extracted-file browser results

Both runs used the `index.html` extracted from the preliminary ZIP. They loaded DGS and PSS/E through the shared model picker, checked common navigation, calculated the three-bus synthetic case using NR, FDNS_XB, and lossless DC, verified that AC tolerance/iteration settings reach the worker, checked publication fields in CSV/JSON, confirmed DC Vm stays unavailable, visited PSS/E settings/help, and opened the PSS/E map and SLD. Both recorded zero external requests, zero blocked network requests, and zero page or console errors.

| Browser | Initial page load | Shared file-picker reload | NR | FDNS_XB | Lossless DC | Full browser run |
|---|---:|---:|---:|---:|---:|---:|
| Chrome 156.0.8078.48 | 194 ms | 1,934 ms | 83 ms | 58 ms | 56 ms | 2,850 ms |
| Edge 156.0.4314.42 | 242 ms | 1,998 ms | 82 ms | 60 ms | 67 ms | 3,017 ms |

Sanitized screenshots and reports are retained in `evidence/psse-ac-dc/offline-browser/chrome/` and `.../msedge/`; `aggregate.json` records their hashes. Both reports show the same extracted HTML hash printed above. The new profile export fields distinguish numerical `CONVERGED` from publication `LIMITED_PROFILE`; DC bus rows carry `vmPu:null`, and the fixed 1 pu model assumption is diagnostic-only.

## Full-source browser acceptance

The native file-mode helper passed in both installed browsers on the same extracted HTML hash above. Each imported the actual SAV, RAW, and one-member SAV ZIP and verified matching SHA-256 identities and counts of 6,851 buses, 2,403 lines, 3,703 transformers, 2,920 generators, and 2,520 loads. It also completed the real DC calculation, checked `LIMITED_PROFILE`/`PARTIAL`, missing DC Vm/Q/current, cancelled a second DC run by switching to DGS, then checked synthetic AC JSON/CSV and `PSSE_REFERENCE` match followed by foreign-source rejection. Each run made zero external/blocked network requests and recorded zero console errors.

| Browser | SAV load | RAW load | SAV ZIP load | Real DC | Synthetic NR | DGS visible after switch |
|---|---:|---:|---:|---:|---:|---:|
| Chrome 156.0.8078.48 | 8.642 s | 6.731 s | 337 ms | 8.558 s | 93 ms | 678 ms |
| Edge 156.0.4314.42 | 8.771 s | 9.781 s | 318 ms | 7.277 s | 81 ms | 735 ms |

The memory figures are point-in-time main-frame snapshots, not peak usage. `performance.memory` after SAV load reported 304 MB in Chrome and 386 MB in Edge. After the real DC solve, CDP reported Chrome 387.4 MB used / 439.6 MB total and Edge 384.6 MB / 435.8 MB. The harness found two worker targets but could not retrieve worker heap snapshots in either browser; worker memory is unavailable.

Sanitized native-browser reports are `evidence/psse-ac-dc/native-browser/chrome.json` and `.../msedge.json`, summarized with proof hashes in `.../aggregate.json`. Private real-model screenshots and browser outputs remain in ignored local results.

## Larger network measurements

The PSS/E 36.5 `bench.sav` per-unit-only case has 1,648 buses and 2,602 branches. Its AC references matched; local calculation times were approximately **368 ms NR** and **446 ms FDNS_XB**. The one-iteration DC calculation took **288 ms** but still has a terminal-flow parity difference, so that timing does not imply reference agreement. Missing physical kV keeps this profile marked partial.

The 6,851-bus, 8,669-branch source case completed one lossless-DC iteration in **4.096 s** in the retained numerical parity run (`gaElapsedMs=4096.0849`) with a true active-power residual of `3.97e-12 pu`. It contracted 928 validated ideal links and used weighted positive-X cut-space recovery for 17 cycles. The strict PSS/E DCLF comparison remains DIFFERENCES (maximum angle difference **0.0062844°**, maximum terminal-flow difference **0.2466915 MW**; 98 report rows exceed the 0.051 MW rounding half-step). It remains partial coverage; no large-network AC performance or exact DC parity claim is made.

Browser timings are headless measurements on this Windows machine and will vary with hardware and browser state. The larger-network timings come from the numerical parity harness, not the packaged browser run.
