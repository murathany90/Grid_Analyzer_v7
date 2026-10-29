# GA Web PSS/E integration

The separate `psse-studio` package is based on `fix/psse-v1-real-model-parity`. The DGS tree is untouched. Map/UI reference: `main` at `330ac6bb5f7e83e0d3510390317f0e5d7b6d89e1`, particularly `src/map/map-view.ts`, `canvas-renderer.ts`, `result-style.ts`, `lightning-panel.ts`, `equipment-tooltip.ts`, and `src/persistence/settings.ts`.

```js
import {mount} from './psse-module.js';
// Load psse-module.css once in the host.
const psse = mount(container, {
  storage: psseNamespacedStorage,
  onNavigate(route) {},
  onStateChange(snapshot) {},
  onModelLoaded(snapshot) {},
  onError(error) {}
});
await psse.loadFiles([file]);
psse.navigate('map');
await psse.calculate('NR_POLAR', {initialVoltagePolicy: 'SOURCE_SAVED'});
psse.unmount();
```

Public types: `src/modules/psse/contracts.d.ts`; numerical options: `calculations/solver-options.js`. Host adapter accepts only the five callbacks/services above. DGS AppContext, models, identities, scenarios, mutable settings and result stores cannot cross this boundary. Mode routing belongs to the host; mounting does not convert a DGS model to PSS/E.

Dependency direction is host → mount → controller → importers/model/scenarios/calculations. UI/map/SLD receive only the PSS/E controller. Imported legacy routines use per-mount private contexts; short internal symbols are not an integration API. Imports are acyclic. Shared projection, basemap, palette and camera primitives can later become host services; electrical classification, I/J/K/CKT/winding identities and solvers remain PSS/E owned.

Parser and solver run as separate Blob workers bundled offline. Responses require the current source SHA, normalized model, topology, scenario, method and effective options hash. Scenario/options/model changes retire old results. Base input is frozen. Compatible base/scenario results are compared only when identities agree. Saved NR values use source state and are explicitly separate from GA results; native loss/interchange conventions live in `ui/native-tables.js`.

RATE changes presentation only. Missing rating and missing DC Q remain null. The single scoped stylesheet does not change host `html/body`; standalone reset is emitted only into portable HTML. Map navigation retains SVG nodes. RAF updates arrow transforms, not the whole map. Unmount cancels workers/jobs/listeners/timers/RAF and removes retained DOM.

GA map parity: identical two-row control order, nominal palette/widths, loading thresholds, compact tooltip, settings and dense lightning table. PSS/E-specific differences: straight station-to-station geometry, SAV/GA source selector, no DGS-only N-1/SC engines. Green Newton controls are implemented GA policies, not proof of native PSS/E numerical equivalence. Tap and shunt automatic adjustment currently share one outer-loop policy and are labelled accordingly.

Host acceptance must additionally exercise DGS→PSS/E→DGS with independent storage and identical restored DGS model/scenario/result hashes. Local dual-mount/CSS tests and selected existing DGS regressions pass; actual integration into the GA app shell is a later change.
