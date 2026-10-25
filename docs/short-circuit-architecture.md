# Short-circuit analysis architecture

The positive-sequence three-phase network approximation is implemented. It uses
native DGS parameters, component-local source coverage checks and sparse KLU
factorization shared across electrical fault buses. Physical terminal aliases
reuse a driving-point solution. PowerFactory result sheets are comparison data,
never source impedances, source currents or solver voltage inputs.

## Fixed calculation basis

The project basis is **IEC 60909-0:2016**. The user confirms that the supplied
PowerFactory references use this edition. This provenance does not establish
fault type, voltage factor, MAX/MIN source policy, corrections, scenario or
model/topology equivalence. No automatic edition migration is supported.
`ScResult.calculationStandard` records the project basis. A null profile edition
means a network approximation; requesting edition 2016 invokes the blocked
normative preflight. Neither path can grant IEC_VERIFIED or REFERENCE_VALIDATED.
Licensed equations, applicability review and independent worked examples are
still required for normative acceptance.

## Profiles and physical boundary

FAST uses valid native impedances and explicitly recorded zero converter
contributions. Missing source models are listed per connected component under
ENGINEERING_PARTIAL; at least one valid impedance source is required. BALANCED
adds explicit missing-only machine xdss=0.20 pu and rstr=0.01 pu assumptions on
native machine kV/MVA/parallel-unit bases, and positive native Ikss3PF converter
currents with an assumed -90 degree phase and explicit terminal-current basis.
Available native parameters are retained. Invalid supplied parameters cannot be
replaced by missing-data defaults. Invalid branch/base/tap data still prevents a
numerical result in the affected component.

MAX uses the visible engineering voltage preset 1.1; MIN uses 1.0 and excludes
converter contribution by explicit policy. These are scenario sensitivities,
not certified IEC extrema or safe upper/lower bounds. Missing synchronous
reactance, converter phase/availability, unmodelled contributions and omitted
KT/KG/KKW corrections can bias either direction. A recorded zero remains zero;
an absent parameter remains unknown. Source FIDs, source references, units,
assumptions and omissions are retained with results.

Loads, charging and shunts are omitted from this series positive-sequence
approximation. Only Zkk (ohm), Ikss (kA) and Skss (MVA) are calculated. ip, Ib,
Ith, machine decay and meshed kappa are NOT_IMPLEMENTED. The exposed fault
calculation is three-phase MAX/MIN only. Invalid quantities remain null. Equipment duty
certification is unavailable.

## Comparison and identity

The strict full partition and method gates remain unchanged. A separate
FID_KV_PARTITION_SUBSET_DIAGNOSTIC compares overlapping result-bearing terminals
when their observed electrical membership is compatible; missing internal
terminals do not certify a full partition. Split/merged groups, conflicting
results, voltage or fault/mode/impedance mismatches reject the diagnostic.
Statistics weight each electrical bus once; physical aliases stay in the table.
Model/scenario/source/profile identities invalidate old calculations. Matching
an IEC edition or obtaining a lower aggregate error is not independent proof
of numerical parity. No PF result is copied into the native source model.

## Related N-1 approximation

AC_APPROX currently means the existing Newton–Raphson fallback with station
control disabled and declared partial fidelity. It is not a new fast AC solver.
BALANCED spends the remaining common time budget on prioritized full NR cases,
with residual/Q/control gates and preservation of preceding DC/SC results.
