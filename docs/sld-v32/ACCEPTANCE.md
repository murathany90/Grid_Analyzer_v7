# SLD V3.2 — native series and contact correction

Baseline: `e30c634361d825a143ebec90fe679cdd9d018672`, continuing `fix/sld-v3-compact-v0-v4-visual-acceptance`.

The drawing graph now resolves real switch paths before assigning coordinates. Proven series devices share an axis; real forks receive separate axes. A glyph packer cannot move a series breaker sideways and introduce an external U-shaped path. Equipment placement reserves native switch bodies first. Fixed contact IN/OUT metadata and conductor geometry remain consistent under rotation. Cubicle self-loops without source sequence evidence retain `SOURCE_ORDER_UNAVAILABLE` and are not joined into an invented chain.

Electrical source endpoints, physical FIDs and the canonical calculation model are unchanged. Real transfer bypasses and source-only terminal branches remain present. Reference images are comparison material; they do not create switches, motors, earth blades, CT/VT or transformers. The closed KE-01 internal bridge stays within its outlined body; it is not an external bypass.

Both station and bay usage classification share one DGS mapping. The local DIgSILENT DGS Documentation B.1.5, PDF page 60, defines `cbk`, `dct`, `sdc`, `swt`. `sdc` is consistently `load-break-disconnector`, with common contact geometry and no inferred motor or earth mechanism. Unknown device/position evidence remains explicit. Primary document SHA-256: `3d099845f11a2cd450cd4cfbe7fe563d58b78e291d4cf11051dd4d6076140468`.

Secondary routes choose the nearer external side, with separate channels and staggered turns. Unused left rail span is trimmed to provide routing space without widening the station. The longest displayed connection in the two dense private projections decreased from 3524 to 1840 and from 3054 to 1462 drawing units. Winding identities are unchanged and unrelated-rail intersections remain zero. The prior right-only corridor assertion now accepts either external side; its zero-intersection, exact winding and immutable source assertions are retained.

## Acceptance

- 541/541 unit/regression tests passed, zero skipped: all 525 existing cases retained plus 16 new cases. Typecheck, architecture lint, standard build and portable build passed.
- All four E2E scripts passed. Existing 630 source-type/scope/mode renderer checks and UI/scenario/result identity checks remain active.
- Thirteen independently authored circuits in two orientations test native order, actual SVG contacts, closed continuity, open gaps, real bypasses, double/transfer bars, couplers, unknown cubicle sequence, HV/LV routing and branched series paths. A deliberately shifted breaker with correctly attached U-shaped conductors is rejected by the independent geometry check.
- Five cached real station projections: 153 feeder records, 546 switches, 63 other equipment records. Fifty views cover desktop/mobile and seven modes. An independent degree-two source incidence walk verifies 131 real series chains against SVG geometry. Four priority feeders additionally use a manual source-FID/order golden and 4× before/after closeups. Native identity/contact CSV and per-site source ledgers remain private.
- Native source inventory, device kind, fixed contacts, open-gap safety, zero glyph overlaps and zero foreign-wire/glyph crossings passed. Unconnected wire/rail crossings do not acquire junction dots.
- A single genuine scenario breaker maneuver produced `CONVERGED_FULL_NR`, invalidated old results as `STALE`, matched the selected scenario hash, kept the canonical source model unchanged and restored B0. No new N-1/SC numerical parity or normative IEC completion is claimed.
- Portable is LF-only and byte-identical to the committed artifact. SHA-256: `fd25cac758ccad4d9c683f6df6453a5bad950bb6d5bb24607eaa258f01a06657`.

## Delivery gate

Private source data, the feeder contact ledger, original reference images and SVG/PNG comparisons are under ignored `local-benchmark-results/sld-v32/`. Before/after exports use the same 4× SVG contact scale; the supplied bitmap reference is approximately normalized for visual comparison and has no physical engineering scale.

Technical P0 acceptance passes. User visual approval remains pending. **Do not merge into main until the user approves the breaker/disconnector drawings.** Existing partial symbol/source-order and IEC/PF evidence limitations remain in force.
