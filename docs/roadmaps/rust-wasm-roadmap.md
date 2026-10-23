# Rust and WebAssembly engine roadmap

The Rust/WASM engine is a future implementation of the existing analysis
boundary. It must not change the platform-independent network, scenario,
identity or result contracts.

## Stable application boundary

The application continues to own `CanonicalNetwork`, temporary scenario
overlays, calculation identities and `CalculationResult`. The current
`BrowserJsPowerFlowEngine` is the reference browser implementation. A future
`BrowserWasmEngine` should implement the same `AnalysisEngine` interface and
return the same result shape. The caller chooses an engine through dependency
injection; UI features do not call Rust exports directly.

`ResultStore` remains outside the engine. It stores base and scenario results
per analysis type and accepts only the current full identity: model hash,
scenario signature, analysis type, engine name/version and options hash.

The first Rust scope should be only the numerical kernel. DGS import, topology
policy, result storage and UI remain outside it. Keep the JavaScript engine
available until deterministic unit cases and full-model comparisons establish
acceptable parity.

## Version 1 typed-array ABI

Do not serialize a full network as one large JSON string for the solver ABI.
Define a versioned structure-of-arrays boundary with an explicit header,
counts, units and typed buffers. Version 1 should carry the bus, branch and
generator arrays needed by the chosen engine, such as:

- bus nominal voltage, specified P/Q, voltage setpoint, type and sequence index;
- branch endpoint indices, service state, resistance, reactance, charging,
  tap, phase and equipment type;
- generator bus index, dispatch, voltage-control flag, setpoint and Q limits.

The exact fields must be settled against the supported calculations before the
ABI is frozen. Keep entity IDs and source references in an adapter-side table;
return numeric indices and result arrays from Rust, then map them back to
canonical IDs in TypeScript.

The ABI header should contain an integer `abiVersion`, record counts, and
declared units. Version 1 must define byte order explicitly and must not rely on
the host's native typed-array endianness. A `DataView` or an explicitly
specified little-endian encoding can be used at the boundary.

## Memory ownership and lifetime

Document ownership for every buffer before adding a zero-copy path:

- JavaScript owns canonical and scenario input arrays. The initial ABI should
  copy them into WebAssembly memory so mutation during a solve cannot change the
  running request.
- Rust may use pointers only for the duration of the call unless an explicit
  allocation handle owns the memory. It must not retain JavaScript-owned views.
- WebAssembly memory growth can replace the memory buffer and detach or stale
  existing JavaScript views. Reacquire views after any operation that may grow
  memory; never retain a typed-array view across that boundary.
- Rust-owned outputs need an explicit length, type and release operation, or a
  copy into JavaScript-owned arrays before the result is published.
- Cancellation, worker termination and failed calls must release all owned
  buffers and must not leave a partial result in `ResultStore`.

The UI should receive ordinary domain results, not pointers or memory handles.
Progress and cancellation continue through the worker protocol.

## Delivery stages

1. Freeze the kernel input/output contract and implement version-1 packing in
   TypeScript with small deterministic networks.
2. Implement a Rust kernel with no DOM, DGS or UI dependencies. Keep imports,
   exports and memory ownership narrow.
3. Add `BrowserWasmEngine` behind the shared `AnalysisEngine` interface and run
   the same deterministic cases against both browser engines.
4. Compare output fields, convergence states and edge cases. Record browser
   time and memory separately from Node full-model measurements.
5. Consider replacing the default only after regression criteria are agreed
   and the JavaScript fallback remains available.

## Scope and status

No Rust crate, WASM dependency or build step is part of the current application.
The current browser engine is JavaScript. PowerFactory reference results are
not available in the baseline, and station-controller outer-loop behavior has
not been migrated, so neither implementation can claim PowerFactory
equivalence.
