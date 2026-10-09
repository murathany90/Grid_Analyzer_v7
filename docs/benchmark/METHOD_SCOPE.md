# Method scope and evidence

This development starts at `b85ca2fe35b154cf9f8c5204716ddf2219bf7cb2` on
`feat/ga-n1-hybrid-iec60909-20261009`. No PF solved number is a solver input.
Private model, workbook, field audit and fault/case records remain ignored.

| Evidence | Meaning in this implementation |
|---|---|
| SOURCE-VERIFIED | Exported native identity/attribute, worksheet cell provenance, or independently audited electrical connectivity. Does not establish method parity. |
| ENGINE-CALCULATED | Independent NR post-outage or sparse positive-sequence network calculation with actual numerical residual. |
| METHOD-VERIFIED | Reserved for a demonstrated method/edition/option equivalence; no new IEC certification is enabled. |
| EXPLORATORY | Opt-in diagnostic GA−PF after identity, side and unit gates. Certified delta and certified statistics remain null. |
| BLOCKED | Missing/invalid source, unsupported connected contribution, ambiguous identity, unsupported control, missing sequence or normative evidence. |

## N1

The full electrical multigraph includes active lines, two-winding transformers,
series compensation, cubicle disconnection and collapsed closed couplers.
Iterative bridge detection distinguishes parallel edges. The original reduced
≥66 kV P-only DC algorithm is unchanged.

The hybrid checks base Full AC, builds a scoped catalog, runs DC, records promotion
reasons, then runs sequential budgeted Full AC. Defaults: promotion 90% is a user
policy; operational loading 100% and Vpu 0.90–1.10 are separate limits. The UI
records when the operational profile is read from the PF N1 manifest. Voltage
limits apply only to AC. AC line loading uses the selected seasonal current limit;
absent capacity stays UNKNOWN. No incomplete coverage can imply an all-clear.

Snapshots bind model, scenario, effective settings, scope, season, candidate and
native case identity. Settings/options tokens use the existing deterministic
stable-JSON serializer. PF `N1:class:FID` is checked against the outage. Only
explicitly requested observations and compact case summaries survive a queue run.
Case detail can be recomputed separately. Resume continues pending AC cases with
the identical snapshot and a new invocation budget; cancellation before a queue
exists restarts preflight/DC. A changed model, scenario, settings or policy cannot
reuse the old queue. Browser and CLI hard limits terminate actual workers,
including synchronous calculation. Direct library calls can check abort/budgets
between operations; use the provided worker integration for hard interruption.

Referenced components can retain a numerical partial solution while unreferenced
components have no result. No artificial slack is introduced. Multi-reference
components remain unsupported. Station control explicitly off means local PV
Full NR with PARTIAL control fidelity; numerical convergence does not establish
PF station-control parity. A requested active station-control profile with
unsupported controllers is blocked.

PF supplies only recorded extrema and a verified method family. Diagnostic
crosschecks require the same case, outage, affected class/FID, metric and endpoint.
Missing complete PF post-case matrices and execution status keep full parity shut.

## Independent SC

The new engine stamps its own complex positive-sequence series admittance, using
per-unit bases `Zbase = Un(kV)^2 / Sbase(MVA)`. A sparse two-real-block KLU solve
of unit current gives driving-point Zkk; no dense inverse is constructed. One
factorization is reused for selected faults in a component/profile. KLU is shared
as a linear algebra backend; the AC LF equations and solved LF Vm are not reused.

The supported DGS physical source is an active, energizing ElmVac with explicit
finite nonnegative `r1` and positive `x1` in ohms. Native TypLne R/X per km and length are checked;
line sections currently require additional adapter support and are rejected.
Transformer source bases, impedance and resolved ratio are checked. Connected
external grids, machines or converters lacking supported source equivalents block
their fault component. Unknown/unresolved active source locations cannot vanish.
The normalized API also accepts independently supplied finite source equivalents,
as used by analytical tests; it never constructs an ideal/default source.

`Ikss(kA) = c Un(kV) / (sqrt(3) |Zkk(ohm)+Zf(ohm)|)` and
`Skss(MVA) = sqrt(3) Un(kV) Ikss(kA)`. c must be explicitly supplied with provenance.
The implemented result is **CALCULATED_NETWORK_APPROXIMATION**: passive loads,
line charging and shunts are excluded; transformer correction and source
corrections are not normative. Transformer phase uses the canonical model, whose
DGS phase placeholder is explicitly an approximation. Ip/Ib/Ith stay null.
1LG/LL/2LG require sequences/grounding and are blocked.

PF 2024 AC Voltage Source Technical Reference, section 2 (printed page 2), describes
the source impedance base as terminal nominal voltage squared over 1 MVA; this
supports the adapter's ohm interpretation. DGS attribute definitions establish
field units, not IEC correction rules. The field audit's READY_VERIFIED_SUBSET
means an individual field is usable, never that a whole fault is IEC verified.

The official [pre-fault voltage FAQ](https://www.digsilent.de/en/faq-reader-powerfactory/how-are-the-pre-fault-voltages-for-the-different-short-circuit-analysis-methods-determinated/category/short-circuit.html)
distinguishes the IEC c factor and corrections from a complete-method LF
initialization. The [power-station detection FAQ](https://www.digsilent.de/en/faq-reader-powerfactory/why-are-the-results-for-short-circuit-calculation-different-depending-on-power-station-unit-detection-option.html)
distinguishes generator correction from generator-transformer unit correction.
Neither supplies the full normative method/options needed by this dataset.

The IEC catalog identifies [2016 edition 2](https://webstore.iec.ch/en/publication/24100)
and [2026 edition 3](https://webstore.iec.ch/en/publication/68454), published
2026-07-23. Catalog availability does not establish which edition PF 24.0.7 used.
The dataset lacks that evidence and independently verified required factors;
**CALCULATED_IEC_SUBSET and IEC parity are not enabled**. No authoritative worked
normative subset example was available to certify, so analytical network examples
are reported as mathematical validation only.

SC matching checks physical terminal membership, independently matched electrical
partition, nominal kV and native 3PH/MAX/zero-Zf conditions. Approximation
differences are diagnostic only. Device rows without fault attribution cannot
be treated as generator/fault contributions. Statistics keep physical, electrical
and device tables separate; certified MAE/RMSE/quantiles require certified deltas.

## Map and export

Site Vpu retains min, max, maximum |V−1| and representative FID for each nominal
voltage level. Its displayed color follows the largest deviation from 1 pu.
SC GA colors use computed faults only; uncertified SC difference colors remain
disabled. Unknown values remain gray. CSV/XLSX/JSON preserve null, numeric zero,
source identity, method/scope/edition and diagnostic-vs-certified fields. Existing
spreadsheet formula-injection protection is retained.
