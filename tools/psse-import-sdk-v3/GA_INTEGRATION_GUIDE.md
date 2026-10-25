# V3 integration entrypoint

The authoritative, compiled integration boundary is documented in
`GA_IMPORT_HANDOFF.md`; the guard is `integration/canonical-guard.ts`.
Use Bridge, Canonical and manifest together. Do not pass PSS/E JSON through
DgsModel or bypass a PARTIAL/BLOCKED capability. The current GA application
was inspected but not modified.

See README.md for the local SAV/RAW/RAWX test HTML and VALIDATION_V3.md for
reproduction commands and direct evidence. Previous V2 integration examples
were replaced because they emitted invalid scalar SourceRefs and overstated
existing drag/drop support.
