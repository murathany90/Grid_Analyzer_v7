# V2 root-cause report: PSS/E SAV/RAW analysis

**Branch:** `fix/psse-v1-real-model-parity`
**Review base:** `e3fdc50d23c4ddea47c8e746853db25c19478458`
**Scope:** V2 model-route errors, method eligibility, ZIP companions, and Analysis runtime. The native SAV decoder remains unchanged.

## Reproduction and outcome categories

The reported behavior was a mixture of valid capability rejections and false method gates; those are different from a browser or worker exception. The 2026-10-26 SAV contains 6,875 buses, 2,414 lines, 3,715 transformers, 2,932 generators, 2,516 loads, 137 shunts, 2,571 system switches, and 1,625 substations. Private model bytes, source rows, identifiers, and screenshots are excluded; sanitized hashes and aggregate counts are retained for provenance.

Before the V2 gates were corrected, the local `file://` reproduction loaded the SAV without a JavaScript or worker exception, but all three requested methods returned structured `BLOCKED` results. The DC finding was a false `PV_WITHOUT_ACTIVE_GENERATOR` rejection for a saved PV bus that had no active generator. In the normal GA route after the V2 fixes, the same source loads without console/page/HTTP errors: AC NR and FDNS remain `BLOCKED` on unsupported AC controls; DC returns numerical `CONVERGED` with public `LIMITED_PROFILE` and `PARTIAL` coverage. The sanitized route summary is [ga-dev-route-smoke.json](evidence/psse-v2/ga-dev-route-smoke.json).

## Root causes and fixes

### DC was blocked by a control that DC does not solve

The capability audit applied the AC PV-without-generator rule to DC. PSS/E 36.5 DCLF_2 references for original TYPE=2 PV-without-generator, PV-with-inactive-generator, and PQ fixture cases show identical six directed flows and angles; the source PV fixtures remain TYPE=2. The gate is now AC-only. AC remains fail-closed. Only four standalone PV rows in the large RAW source are reader-retyped, and their island/reference behavior remains gated. The original fixture proof is [dc-pv-eligibility-proof.json](evidence/psse-v2/dc-pv-eligibility-proof.json).

### Known RAW voltage-droop records were classified as unknown active equipment

SAV records use a decoded `subtype=voltage-droop`, while RAW records identify the same known Q(V) family with `sourceTable=VOLTAGE_DROOP_CONTROL`. The capability audit previously recognized only the SAV representation and treated RAW records as generic active equipment. It now recognizes both source encodings as informational omissions for fixed-P lossless DC, and keeps AC blocked. A generic partial-source gate is ignored only when every unsupported-source finding is the verified voltage-droop table; unknown active records, other unsupported tables, islands, and missing references still block.

### LOADTYPE was mistaken for an electrical load curve

PSS/E describes `LOADTYPE` as an alphanumeric load descriptor used for naming/grouping and subsystem selection. It does not add static P/I/Z equations. An original RAWX differential changing only blank `LOADTYPE` to `SYNTH_CLASS` returned the same six directed DC flows and bus angles with `ierr=0`. The false `DC_LOAD_TYPE_UNSUPPORTED` gate was removed; static load coefficients and low-voltage `PQBRAK`/constant-I gates remain. See [loadtype-descriptor-proof.json](evidence/psse-v2/loadtype-descriptor-proof.json).

### Empty source PV islands remain uncertain and blocked

The large RAW has four source PV records with no active incident branch, generator, load, shunt, or other attached equipment. PSS/E `read(0)` normalizes them to type 4 before DCLF, but a separate original empty-island fixture returns `ierr=12`. That evidence does not prove a general preprocessing rule. The implementation retains the strict island/reference gates; it does not silently convert the four source rows or publish a guessed DC result. This behavior is separate from the verified three-bus PV eligibility fix.

### Solver and UI failures were not to be represented as `BLOCKED`

Worker calculation errors, result serialization errors, main-thread failures, and response deserialization failures now carry a method, phase, and available stack. They are rendered separately from numerical `BLOCKED`, `NON_CONVERGED`, and `CONVERGED` results. On supported source profiles, numerical convergence with partial physics is published as `LIMITED_PROFILE`. A single shared `GA_PSSE_ENGINE_2` identity prevents a V1 result ID from being reused after the eligibility and output semantics changed.

### ZIP metadata and companions were not classified safely

An inventory JSON is not automatically a DGS model or RAWX. Candidate JSON members are now accepted only when they contain native DGS class tables. IEC/GCP/MON/CON members and rejected non-DGS JSON inventories are preserved as opaque, separately downloadable attachments, with their archive path, source-file name, size, SHA-256, and associated source-model SHA-256. Inventory JSON is explicitly labelled `INVENTORY_JSON`; no IEC or contingency result is fabricated. The importer remains bounded and validates ZIP names, sizes, compression ratios, and CRC.

### Repeated source-ID scans made readiness unnecessarily expensive

Capability and DC switch-contraction checks now build a preserved-first equipment index and active-generator bus set for the current audit. This removes repeated full-array searches without changing source identity, first-match behavior, branch classification, or electrical equations.

## Validation and remaining limits

- Final lint/typecheck/build pass. The full local unit/regression suite passes **860/860, zero skips**; the shared identity/solver focused suite passes **32/32**. Old-engine/wrong-topology/signed method and option negatives are included.
- Chrome and Edge `file://` smoke tests pass on the same offline HTML SHA-256 `e50035bf2b11826b7af34617be6d988a73a01adc9c350ff3ca981d7d72aaa32d`. Both engines exercised DGS JSON/ZIP, a DGS+PSS/E mixed ZIP with inventory JSON retained only as an opaque attachment, all five opaque attachments (IEC/GCP/MON/CON plus inventory JSON), NR, FDNS_XB, DC, Analysis search/sort/page size, CSV, and the shared settings/help/navigation. Both made zero external requests and recorded zero console errors. Reports: [Chrome](evidence/psse-v2/offline-browser/chrome.json), [Edge](evidence/psse-v2/offline-browser/msedge.json).
- A separate actual-model reference comparison remains `DIFFERENCES` at the strict 0.051 MW terminal-report threshold. The current V2 SAV DC comparison reports maximum terminal ΔP 0.2446769 MW and maximum angle ΔVa 0.00689369°; these are not rewritten as `PASS`. See [the retained parity evidence](evidence/psse-ac-dc/parity-lossless_dc-v2-new.json).
- The 6,875-bus AC paths remain blocked by unimplemented ideal-link contraction and voltage-droop/remote-regulation physics. Unknown active HVDC, FACTS, induction, bypass, control tables, and source-topology inconsistencies remain blocked. Lossless DC has no calculated Vm, Q, current, or AC losses.

No private SAV/RAW/RAWX files, source coordinate table, raw model dump, licensed reference output, PSS/E DLL/PYD, or proprietary manual is included in Git or the offline package.

## Final identity and browser closure

The final shared identity guard checks current engine, source/model/revision, effective scenario topology, scenario, method/algorithm and recomputed result ID. Worker admission also checks exact requested options; Analysis checks its selected method/options before table/reference/export publication. Signed old-engine and wrong-topology/method/options negatives pass. Complete unit/regression: 860/860, zero skips; dedicated solver/identity suite: 32/32.

Final HTML SHA-256 `e50035bf2b11826b7af34617be6d988a73a01adc9c350ff3ca981d7d72aaa32d` passes extracted-ZIP file-mode Chrome/Edge checks and actual 6,875-bus SAV/mixed-ZIP/GA-route checks. Real NR/FDNS return structured BLOCKED; DC returns LIMITED_PROFILE. Method/options edits hide stale results, source change cancels a pending run, all five attachments remain byte-faithful, worker phase/stack is visible, and foreign reference hashes are rejected. Evidence: `evidence/psse-v2/browser-acceptance.json` and `native-browser/`.

Two failures were in the new developer harness: a blanket DNS-deny flag also blocked its intended localhost route, and a stack assertion examined a closed details panel. The harness permits only its explicit local route, still aborts external HTTP, and opens the diagnostic before checking its contents. Chrome resumes matching-artifact file-phase evidence; Edge runs every phase including the original source ZIP. These are not application solver crashes. No licensed oracle experiment was rerun for these browser checks.
