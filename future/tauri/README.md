# Future Tauri desktop work

This directory documents a possible desktop host only. No Tauri crate,
dependency or desktop build is configured in the current project.

Read the [Tauri roadmap](../../docs/tauri-roadmap.md) before starting work. Keep
the shell thin: reuse the browser UI, canonical network, scenario and result
contracts, and add file, persistence and native-engine adapters at the host
boundary. A future `TauriNativeEngine` must implement the shared
`AnalysisEngine` interface; it must not duplicate application domain rules.
