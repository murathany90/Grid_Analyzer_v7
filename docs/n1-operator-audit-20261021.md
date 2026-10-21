# N-1 operator audit — 2026-10-21

The lightning panel keeps its existing dimensions. The candidate catalog loads on first N-1 entry independently of Full AC. Inventory/catalog filters use OR within a filter and AND between filters. Result groups describe affected equipment; each critical row and its export retain one complete case pair. Mixed line/transformer/terminal selection does not change the metric family of other equipment.

Confirmed violations rank first. Missing ratings, incompatible partitions/endpoints, loading denominators and angle references retain null deltas and explanations. DC provides P-only evidence. Evicted hybrid details remain discoverable through persisted violation keys, with null numbers and a cache-loading action; the UI does not rerun a solver to manufacture details.

Visible-table CSV/XLSX/JSON is a separate presentation projection with case, FID, metric/unit and source fields. Existing raw StudyRow exports retain their schema and are explicitly labelled as the unfiltered selected-case/single-metric snapshot. Existing full hybrid exports remain in scope/settings.

## Full AC investigation

A current-engine replay of the locally cached SN3 network/settings converged with `CONVERGED_FULL_NR`, maximum mismatch approximately `2.04e-8 MW`, while control evidence remained `CONTROL_FIDELITY_PARTIAL`. Six active PV sources lacked valid Q bounds. Station diagnostics counted 30 unsupported controllers, all `NO_REACTIVE_HEADROOM`, and zero unsupported profiles; other states were 186 satisfied, 42 at Qmin and 12 at Qmax. This does not establish that all station mappings or droop equations are valid. The narrow supported droop/source profiles and absent source bounds remain verification limits.

The reported count of 89, `ACTIVE_BALANCE_PARTIAL` and `PARTIAL_NATIVE_SOURCE_PHYSICS` were not reproduced by this cached input: active balance converged and native source physics was exact. No source parameter or control equation was changed on that evidence. A concrete strict-gate bug was fixed: station-off partial control is no longer implicitly accepted. Partial profiles require explicit selection and UI consent and remain labelled **PF PARİTESİ DOĞRULANMADI**. Detailed evidence stays under Teknik Tanı. Private network data and source identifiers are not included here.

## Validation

- 71 targeted existing unit tests passed, including strict/explicit-partial gates, catalog independence, whole-case aggregation, mixed filters, loading pp and export values.
- Focused and general browser smoke passed: 640/420 px, no horizontal table/panel overflow, accessible controls, single popup layer/close/Escape/outside click, case expansion, visible CSV, 40,001 SC fault choices bounded to 50, actual-worker automatic N-1 catalog, LF/scenario undo/reset regression. The general CI smoke exposed an initial popup-layout frame that collapsed the list; popup bodies now leave normal flow before opening, and the existing assertion checks identical list height from the first click. Expanded narrow-screen cases span the full card width, with bounded sublist pagination. Scope settings open in one accessible level, including the explicit partial-profile consent control.
- At the same 640×480 px panel, the result list grew from **222 to 230 px**. At 420 px the table uses row cards. No production panel dimension changed.
- Typecheck, architecture lint and standard/portable builds passed. The committed portable artifact is checked separately against a fresh build by raw bytes/hash.
- The existing PF benchmark smoke also passed after explicitly exercising rejected/unapproved versus approved partial AC. Its worker-timeout check reads the retained technical evidence and still verifies actual worker termination/recovery; the main status stays concise.

Changed source areas: `workspace-results.ts`, `study-operator.ts`, `study-rows-cache.ts`, `study-actions.ts`, the small `study-popups.ts` helper, `calculation-actions.ts`, `lightning-panel.ts`, `benchmark-controls.ts`, `layer-policy.ts`, `post-result-source.ts`, `ui-workspace.css`, the two strict N-1 gates and controller status text. Two existing unit suites and the existing browser smoke were extended; the generated portable HTML was refreshed.

## Explicit diagnostic N-1 follow-up

The existing `NATIVE_PARTIAL_CONTROLS` profile is labelled **Tanısal N-1 / UI Testi**, with the existing explicit consent checkbox. The compact selected-AC action now uses that selection via `ALLOW_PARTIAL`; Strict remains the default. Manual and hybrid paths refuse an invalid numerical base. Catalog/DC preparation runs before the hybrid AC gate, retaining candidate/DC evidence even when Strict blocks AC.

Cases run sequentially. Divergence, unsupported controls, per-case worker timeout and unsupplied islands retain a reason and appear as **Atlandı / Çözülemedi**; later cases continue within the original global/case budgets and cancellation rules. Successful, partial, skipped and pending cases have separate counts. Partial numerical results never count as verified AC. Evicted affected equipment remains discoverable even without a confirmed violation; its numbers stay null until the stored case detail is loaded.

The focused real-worker browser smoke produced three partial numerical solutions and one skipped unsupplied-island case, checked unapproved/approved diagnostic mode and selected-AC Strict behavior, and found no horizontal overflow at 640/420 px. The 640×480 panel retained its **230 px** main list before/after calculation. The expanded row preserves one complete case pair for P/Q/V/loading and export.

A bounded current-engine SN3 replay used the locally cached network/settings: base `CONVERGED_FULL_NR`, mismatch `2.0407307614600523e-8 MW`, control fidelity still `CONTROL_FIDELITY_PARTIAL`. Strict attempted zero POST cases; explicit diagnostic mode solved one selected real outage as `PARTIAL_SOLUTION` (4,077 solved buses, 5,139 post branches, zero verified AC cases). Missing Q bounds, reactive modes and station/source support remain disclosed; this establishes numerical/UI availability, not PF parity. Private input, result identifiers and screenshots remain local.
