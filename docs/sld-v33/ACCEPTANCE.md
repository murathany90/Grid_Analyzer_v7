# SLD V3.3 — feature acceptance (visual approval pending)

Branch: `fix/sld-v3-compact-v0-v4-visual-acceptance`.
Baseline: `674a966103c336cbe0d924eea970030ca0800a26`.
No main integration is authorized by this task. The private visual gallery and closure report require user review before integration.

## Change and preservation

The V3.2 native endpoint / serial contact renderer remains the foundation. Source FIDs, canonical equipment, switch classification, actual topology, fixed contacts and independent source-chain tests are retained. No devices are inferred from a diagram, feeder name, voltage ratio or desired appearance.

- Continuous conductors in all states; open contacts retain their genuine visible gap. Unknown symbols retain `?` and partial metadata without dashed outlines.
- Junction radius 4.5 versus device contact radius 1.6. Source-connected nodes remain distinct from non-electrical crossings.
- Native outgoing bay endpoints without an ElmLne record receive a presentation arrow, including MV; this adds no equipment object or electrical endpoint.
- Adaptive section spans, two-sided feeder packing, 4 area units at 400/154 kV and 1 at <=36 kV. Symbol and branch clearance imposes a minimum cell width independently of weight.
- Invisible feeder compartments reserve caption, result and identity bands. Captions use a shared row baseline and avoid other captions, device bodies and actual conductor segments. Analysis modes reserve extra space for results rather than reducing font sizes. Bay results use a separate readout column instead of repeating voltage at each internal node.
- Source model connections designated TR load / LSZ retain their original source class and symbol, use a straight spine in a separate cell after physical feeders, and carry a display-only model-feeder tag. The tag does not classify any ElmBay as virtual or alter calculation behavior.
- Non-electrical interior crossings use SVG hop-over curves. Native orthogonal paths and endpoint metadata remain available for independent geometry checks. Same-node joins and shared endpoints receive no hop.
- Double station frame and centered station title. Dedicated YTM filter; station options display TM name only. Technical mode / feeder focus replace duplicate display controls; voltage, result family, arrows, fit, readable scale, zoom, focus, fullscreen, export and individual operations remain.

## Feeder operation

`Fider Aç / Fider Kapat` operates the proven main circuit containing one actual breaker and its series disconnectors. Alternative bus selectors / transfer bypasses are excluded. Ambiguous multiple-breaker paths, unknown positions and a coupler lacking a unique outgoing endpoint do not permit batch operation; individual device operations remain available.

The controller validates all requested canonical switches and service states. A batch creates one scenario snapshot and one undo step, with separate device events. No-op commands do not create redundant snapshots. Explicit ownership is preserved across an earlier line-energization rollback. The canonical network and B0 remain immutable. Changing the scenario invalidates the active result and permits scenario Full AC recalculation.

## Validation

- Original 541 unit / regression tests retained; 10 added (551 total), no skipped tests or weakened thresholds.
- Typecheck, architecture lint, standard build and portable build.
- All four existing E2E packages; SLD includes 630 source-type / scope / mode checks, 26 independent native circuit / orientation checks, and the new continuous geometry, junction, MV exit, frame, YTM / cross-area navigation, batch / individual maneuver, readout overlap and STALE / Full AC checks.
- Five cached real source projections: 153 feeder records, 546 physical switches, 63 other equipment records, 131 independently walked native series chains. Fifty station views across 1366 / 1440 / 1920 / 390 and seven display modes. No model re-import or solver request during render acceptance.
- One real batch operation (three source devices): STALE, `CONVERGED_FULL_NR`, result identity matches selected scenario, canonical source unchanged, B0 restored. Final UI recapture reuses the cached base result and prevents solver calls.
- Before images reuse V3.2 evidence; no baseline calculation or baseline test run repeated. Private data and screenshots remain under ignored `local-benchmark-results/sld-v33/`.

Portable: `dist-portable/GridAnalyzer_v7.html`, LF-only, 1,784,113 bytes.
SHA-256: `a46202434250adb522577633449e834fc5ebd65c985fbb9f5e15ce4dffa7b26b`.
CI must succeed on the exact final feature head, including the raw committed-byte / fresh-build comparison. The resolved run URL and SHA are recorded in the private closure report.

## Visual limits and calculation scope

Fit mode shows every native device; it does not guarantee readable small text for a dense complete station. Readable scale, voltage filtering and feeder focus remain necessary for detail. The gallery shows actual fit UI alongside full exported sheets and detail crops; full-page exports are not presented as proof of single-screen readability.

YTBS sheet dimensions (world units, before -> after; anonymized source sites):

| Site | Before | After |
|---|---:|---:|
| A | 1440 x 1272 | 1298 x 1290 |
| B | 1440 x 1186 | 954 x 1204 |
| C | 1442 x 3410 | 1354 x 3142 |
| D | 1440 x 2607 | 1306 x 2693 |
| E | 1440 x 1158 | 640 x 1176 |

Width improves in all five examples; height is not uniformly reduced. Site D grows by 86 units. Result display reserves additional space. These limitations remain part of visual acceptance rather than being concealed by dropping feeders or shrinking the font.

LF/DC/N-1/SC calculation motors are unchanged. This delivery extends no IEC 60909-0:2016 normative acceptance, PowerFactory parity, source-control fidelity or N-1 coverage claim. Unknown / partial / stale results retain their existing gates.
