# SLD V3.1 — source equipment and drawing workspace

The SLD now uses a compact toolbar, an initially closed options menu, a results/equipment drawer and a fullscreen control. The drawing consumes the available viewport height. Fit, readable scale, bay focus, horizontal bay orientation, filters, exports, navigation, scenario maneuvers and analysis actions remain accessible. Opening options does not reset the SVG viewport; closing the drawer or leaving fullscreen preserves selection.

Physical equipment comes exclusively from the loaded canonical model and its DGS source projection. Reference Excel/PDF/SVG files provide geometry and placement rules. Their feeder templates never add motors, grounding switches, CT/VT, transformers or auxiliary devices. `on_off` supplies position, not device class. `aUsage=cbk` selects the outlined KE-01 breaker; `dct/sdc` use common disconnector contact geometry without a motor or grounding claim. Unknown class or position remains explicit. Unsupported equipment symbol subtypes use a neutral partial marker with the actual source identity.

Switch conductors terminate at the fixed contacts. Open contacts retain a visible gap; closed contacts have the side bridge transcribed from the V0 drawing. Source transformer winding identities and voltage values remain unchanged. Genuine HV/LV transformers sit below their primary feeder; LV cables use an external corridor when other voltage rails intervene. An actual 34.5 kV winding is not relabelled as 33 kV. Unused continuation rows and reserved empty space are removed without changing source connectivity.

## Validation

- Typecheck and architecture lint passed; standard and portable builds succeeded.
- 525 unit/regression tests passed, zero skipped. Seven new independent contact/source-inventory/routing tests include missing subtype and missing equipment cases.
- All four browser scripts passed. The general app smoke opens the results drawer through the same visible control used by a person; its cross-view result identity checks are retained.
- Existing independent renderer acceptance covers 630 source-declared type/scope/mode combinations, plus dense native device coverage and horizontal focus.
- Five cached real-model station projections cover 153 feeder records, 546 switches and 63 non-switch equipment records. Fifty views cover three desktop sizes, mobile and seven modes. Source identity, fixed contacts, zero glyph overlap and zero wire-through-other-glyph crossings were checked. Final visual exports and source checks were refreshed at 1440 px after the last presentation changes.
- A single real-model breaker maneuver produced `CONVERGED_FULL_NR`; opening the switch invalidated previous results as `STALE`, the accepted result matched the selected scenario hash, and the canonical source model remained unchanged. This is an LF scenario check, not a new N-1 or IEC/PF numerical acceptance.
- Physical reference devices absent from the source were excluded from the rendered SVG. Genuine HV/LV winding FIDs were retained and direct HV/LV secondary leads had zero unrelated-rail intersections.
- The committed portable HTML is LF-only and matches the build byte-for-byte. SHA-256: `5a5922464d250616c9d6f37614fa0e69958daeafa29979be123b141993861612`.

## Limits and review gate

The 63-equipment acceptance applies to the five station graph projections, not every raw class in the full network. Source-only subtype information is required before adding motor, earth blade, instrument transformer or other auxiliary geometry. Native cubicle chains lacking documented sequence remain unresolved rather than acquiring an invented order. Generic shunt, external-grid or other unsupported symbol subtypes remain partial. Three-winding electrical calculations and existing N-1/IEC/PF evidence gates are unchanged; this UI task does not certify them.

Large stations cannot have every label readable in a single screen at fit scale. Readable scale and bay/equipment focus provide the separate detailed view. Screenshots validate the actual SLD component with cached real source data; surrounding application navigation is covered by the public app smoke.

Private model data, raw reference drawings and visual evidence remain under ignored `local-benchmark-results/sld-v31/`. The review gallery contains previous/current station sheets, compact UI, fullscreen, the genuine HV/LV corridor and source/application contact comparisons. The feature is pushed for exact-commit CI. **Do not merge into main until the user approves these visuals.**
