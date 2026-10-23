# IEC 60909 implementation and evidence

Implementation `544a853` adds structured correction/sequence/equipment blockers and a verified-quantity equipment API. It does not enable the normative method. **IEC 60909-0:2016 remains BLOCKED.** Exact software acceptance/CI is recorded in report 15.

## Sources and applicability

The supplied IEC package was inspected: README, SHA manifest, development notes, source index and screenshots; no licensed full 2016 standard or independently solved normative vectors. The [IEC edition catalog](https://webstore.iec.ch/en/publication/24100) identifies the requested edition but does not provide accepted implementation equations. Owned PF 2024 transformer, external-grid, voltage-source and machine references remain private. The transformer manual's MAX/edition/unit distinctions must be resolved before applying KT/KG/KKW to actual native assets.

The [Thurner/Braun primary paper](https://arxiv.org/html/1802.01502v1) explains external/current-source and sparse short-circuit models; it does not independently accept this application's complete normative method. The [pandapower developer peak-current documentation](https://pandapower.readthedocs.io/en/v2.6.0/shortcircuit/ip.html) also distinguishes radial and meshed kappa. These sources are research evidence, not a replacement for accepted source applicability and independent normative examples. No isolated formula or automatic unity correction is published as IEC2016.

`method-evidence.ts::scMethodPreflight` records for each KT/KG/KKW: equationSource, applicability, required inputs/units, calculatedFactor, assumptions, verificationStatus and appliedToNetwork. Unknown equations/factors are null/BLOCKED, appliedToNetwork=false. It explicitly records negative/zero-sequence and grounding networks NOT_IMPLEMENTED; LL/1LG/2LG are BLOCKED. Canonical generator/external-grid coverage does not claim a complete native machine/motor/converter inventory.

## Quantities and ratings

3PH MAX/MIN positive-sequence network mathematics remain unchanged. Valid explicit source R/X or current contributions may yield diagnostic Ikss/Skss; missing native source data blocks faults. Requested 2016 returns null quantities and zero factors/RHS. Ip/Ib/Ith stay null: source decay, near/far classification, meshed kappa, AC/DC thermal factors and separate time semantics are not independently accepted. No positive-sequence result is repurposed as an unbalanced fault or breaking current.

`equipment-limits.ts::scEquipmentDuty` layers engineering verdicts over the existing raw comparisons. It requires each actual Ib/Ip/Ith, quantity verification, method provenance, sourced nameplate, physical connection identity, valid voltage and identical thermal durations. Statuses are PASS, FAIL, INSUFFICIENT_RATING_DATA, UNVERIFIED_METHOD and NOT_APPLICABLE. Exact capacity boundaries and real zero are accepted; missing/invalid inputs, diagnostic methods, mismatched connection/time and Ikss alone cannot PASS. Automatic native rating adaptation and application-level equipment certification remain NOT_IMPLEMENTED. The older `scEquipmentCheck` is only a raw numerical comparison, not normative equipment acceptance.

## Tests and real evidence

`engineering-equipment-duty.test.ts` covers independently specified 20 kA breaking / 50 kA peak / 15 kA at 1 s ratings, boundaries, exceeded voltage/current, missing methods/ratings, physical mismatch and time mismatch. `engineering-sc-evidence.test.ts` proves null correction factors and blocked unbalanced faults without any factorization. Existing analytical source, transformer, radial/parallel, alias, cancellation and leased sparse tests remain enabled; these are mathematical tests, not solved IEC reference examples.

New SN3/SN4/SN7 calculations each test native source gaps, an explicitly authorized diagnostic source profile and a rejected 2016 request. Native selected faults are BLOCKED; diagnostic selected faults calculate; normative requests are BLOCKED/null with zero numerical work. Native and assumed inputs remain separately counted. No PF-certified kA result or parity percentage is claimed. See report 12 for aggregate run evidence.
