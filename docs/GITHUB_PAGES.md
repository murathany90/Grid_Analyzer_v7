# GitHub Pages

Web URL: https://murathany90.github.io/Grid_Analyzer_v7/

Pages uses the existing browser application, file importer, Web Workers and
IndexedDB. No backend, new calculation feature or Tauri host is introduced.

| Command | Vite base | Output |
|---|---|---|
| `npm run build` | `./` | `dist/` |
| `npm run build:pages` | `/Grid_Analyzer_v7/` | `dist/` |
| `npm run build:portable` | `./` | `dist-portable/GridAnalyzer_v7.html` |

Only Pages mode changes the base URL. The portable pipeline and the relative
asset behavior available to a future desktop host remain unchanged. The Tauri
roadmap is still a roadmap; no Tauri build is claimed or added.

Adding `build:pages` changes two embedded package metadata entries in the
portable HTML (80 bytes total). Removing exactly those metadata entries yields
the previous artifact byte-for-byte. The rebuilt committed portable artifact
is 2,058,588 bytes, SHA-256
`42c89ba4077a5657fe26115cc69cd34cf2b7c4aabb06b7222709aa11011f891a`;
the existing CI raw-byte integrity gate still applies.

## Deployment

`.github/workflows/pages.yml` runs on main pushes and manual dispatch. It builds
the web application, configures Pages, uploads **only `dist/`**, and deploys in a
separate job that requires the build job to succeed. It uses the `github-pages`
environment with contents read, pages write and OIDC token permissions. Existing
`CI / validate` and committed portable byte checks remain in `ci.yml`.

Repository Settings → Pages → Build and deployment → Source must be **GitHub
Actions**. An administrator can select this source if deployment reports that
Pages is not configured. Pages deployment success must be checked in Actions
and by opening the live HTTPS URL; a successful build alone is not a live-site
acceptance.

## Desktop web acceptance

Build first, then test the actual built application with no development-server
module injection:

```powershell
npm run build:pages
node --import tsx tools/pages-browser-smoke.mjs --local
node --import tsx tools/pages-browser-smoke.mjs https://murathany90.github.io/Grid_Analyzer_v7/
```

The Windows local test creates a short-lived loopback TLS certificate using
Git for Windows OpenSSL. The live test uses normal HTTPS certificate validation.
Both cover 1366×768, 1920×1080 and 1366×768 at CSS zoom 125%; there are no mobile
or tablet cases. Inputs start with the public `small-dgs.json`, then a public
paired native model and LF/N-1/SC reference fixture. Actual file inputs, worker
calculations, six MAX/MIN exports, map/popup, SLD, refresh and IndexedDB restore
are exercised. After refresh the same local model must be selected again;
the model file itself is not automatically restored from IndexedDB.

One optional targeted real-model test is available when the local SN4 ZIP and
combined reference ZIP exist in `.local-fixtures/sc-final/`:

```powershell
node --import tsx tools/pages-browser-smoke.mjs https://murathany90.github.io/Grid_Analyzer_v7/ --private-only
```

This imports the native 1,619-TM model, loads the combined PF reference and tests
BOZOK MAX/MIN, exports, map/popup and SLD. It does not run a whole-country study.
If inputs are absent it reports `PRIVATE_MODEL_NOT_AVAILABLE` explicitly.

## Local files and network audit

Models and reference ZIPs are supplied through the browser file picker, parsed
locally and passed to inline Web Workers. The acceptance tool records HTTP
method/body sizes and rejects unexpected external requests. Normal read-only
OpenStreetMap/geoBoundaries map-provider requests are recorded separately if
present. Test output and private file contents stay under ignored
`local-benchmark-results/`; private models/reference files are never build or
Pages artifacts. Users select their own files from their computer.

PF 3F numerical/method parity remains **NOT_VERIFIED**. The GA network
approximation is not a certified IEC 60909 solver. Pages deployment does not
change those limits or restore the removed 1F feature.
