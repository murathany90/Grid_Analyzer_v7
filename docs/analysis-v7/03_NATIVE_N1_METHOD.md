# Native N-1 method and control scope

`runHybridN1` reuses the unchanged ≥66 kV DC screen and Full AC engine. Catalog scope selects outages; the full connected graph remains in BASE and POST solves. A copied scenario overlay opens exactly the selected native line/2W-transformer FID. Low-voltage candidates take direct AC. No artificial island reference is introduced.

## Implemented control evidence

`contingency-ac/control-evidence.ts::n1ControlEvidence` reads existing LF diagnostics without changing the operating point. BASE and POST use the same verdict: numerical residual/convergence, station support, station fallback/pending convergence, missing source Q bounds, and requested distributed active balance.

* `CURRENT_SETTINGS` remains the strict default. Unsupported or unverified controls block validation.
* `NATIVE_PARTIAL_CONTROLS` is explicit. It keeps **identical** LF settings, retains converged native numerical results and reports `PARTIAL_SOLUTION`, `CONTROL_FIDELITY_PARTIAL`, `NOT_PF_PARITY`. It is not a controller repair or a station-off profile.
* `GA_APPROX_STATION_OFF` remains an explicit diagnostic option. It alone changes station mode to off in a copied study settings object; global LF settings remain intact.

Coverage counters distinguish catalog, actual `DC_SCREENED`, `AC_ATTEMPTED`, `AC_NUMERICALLY_SOLVED`, retained `AC_CALCULATED`, `AC_VERIFIED`, and catalog `AC_UNVERIFIED`. A partial island or controller result never counts as fully verified. Unknown ratings, excluded catalog cases and DC-only clear cases prevent COMPLETE. Resume identity includes profile, regional policies, targets, scenario and settings; solved cases are not repeated.

## BASE/POST policy and details

`limits.ts` resolves user-defined YTM / nominal voltage profiles with explicit provenance. More specific profiles take precedence; conflicting equal-specificity profiles produce an error. Default thermal 100%, promotion 90%, voltage 0.9–1.1 pu are user policies, not universal TEİAŞ/PF thresholds. The UI can save or clear limits for the selected YTM/voltage.

The POST assembler retains from/to identity, both endpoint P/Q/S/I, angle difference, transformer tap, losses, voltage and native YTM metadata. Constraint comparison requires identical endpoints, capacity basis, season and denominators; reversed endpoints or missing identity produce IDENTITY_UNVERIFIED and null delta. BASE and POST apply the same regional policy. Existing NEW/WORSENED/PERSISTENT/RELIEVED/UNKNOWN_RATING/UNSOLVED_ISLAND states are retained.

## Targeted acceptance

29 targeted tests pass across `n1-control-evidence`, `n1-operational-limits`, `n1-ac-validation`, `n1-hybrid`, `parity-fix`; typecheck/lint pass. Actual 3/5-bus radial Full AC matches an independent closed-form V, angle, P/Q, S and active/reactive loss solution. Existing parallel, transformer FID, multiple-reference, island, direct 33 kV AC, DC-clear false-negative, budget/cancel/resume/storage tests remain enabled. New actual solver fixtures verify a supported station, unsupported remote control, missing source Q bounds, unresolved active balance and explicit native partial retention. These are mathematical/control regression evidence, not PF parity.

## Separate LF core proposal (not applied)

Baseline real SN3 has 30 unsupported station controllers and missing source limits; convergence alone cannot repair their source semantics. A future LF-core task must independently classify each rejected controller and prove its equations, participation, bounds and active-balance eligibility before changing the solver. This feature does not modify `src/analysis/power-flow/`, `src/analysis/api/browser-js-engine.ts` or the DC screen. Full native N-1 control completion remains PARTIAL until those requirements and independent real acceptance pass.
