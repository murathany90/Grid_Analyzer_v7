# Tauri desktop roadmap

Tauri is a possible thin desktop host for the browser application. The web
application remains the primary implementation and the source of shared
domain behavior. This roadmap adds no Tauri dependency, build configuration or
desktop capability today.

## Host boundary

Keep the web UI and domain modules reusable. A desktop host may provide:

- an operating-system file picker that passes the chosen DGS file bytes to the
  existing importer;
- an app-data persistence adapter for model metadata, diagrams, scenario
  snapshots and explicitly saved results;
- a `TauriNativeEngine` adapter that implements the same `AnalysisEngine`
  interface as `BrowserJsPowerFlowEngine`;
- packaging, signing and update integration.

The host should not duplicate DGS parsing, scenario rules, result identity or
electrical topology. Native analysis should use the same canonical network,
scenario snapshot and versioned typed-array ABI designed in the Rust/WASM
roadmap. The UI receives normal `CalculationResult` data either way.
`ResultStore` continues to separate base and scenario results by analysis type
and validates the full model/scenario/engine/options identity before showing a
result.

## Data and persistence

The browser version currently persists small metadata and scenario values in
IndexedDB. A desktop adapter should keep user data in the operating system's
app-data location, version the stored format, write updates atomically and
offer a deliberate export/import path. DGS source files should remain at their
chosen location unless the user explicitly copies them into app storage.

Persisted scenarios are tied to a model hash. Loading a different model must
not apply an old overlay by name alone. Persisted calculation results must keep
their full model, scenario, analysis type, engine and options identity so stale
results cannot appear current.

## Security and release

Grant the webview only the capabilities required for file selection and
app-data access. Validate all command inputs and file operations at the host
boundary. Do not expose general shell execution, arbitrary filesystem access or
remote code to the UI. Keep the web content security policy and update/signing
requirements explicit before distribution.

## Delivery stages

1. Stabilize browser APIs and typed host messages without importing Tauri into
   domain modules.
2. Add a minimal file and persistence adapter behind interfaces already used
   by the application.
3. Add an optional native engine adapter after its ABI and parity checks are
   accepted.
4. Package and sign the desktop app, test upgrades and data migration, then
   keep browser and desktop release artifacts independently verifiable.

There is no Tauri project or desktop implementation in the current repository.
