# Future Rust/WASM work

This directory is a placeholder for future Rust/WASM work; it contains no
crate, source code or build dependency today.

Read the [Rust/WASM engine roadmap](../../docs/rust-wasm-roadmap.md) before
adding implementation. Keep `CanonicalNetwork`, scenario overlays, result
identity and `AnalysisEngine` platform-independent. The planned browser adapter
is `BrowserWasmEngine`; the first boundary is a versioned, typed-array ABI with
explicit ownership, lifetime and endianness rules. Do not send the full network
as one large JSON string across the solver boundary.
