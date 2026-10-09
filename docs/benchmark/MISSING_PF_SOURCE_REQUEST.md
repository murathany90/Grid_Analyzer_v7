# Missing PowerFactory source evidence

This is an exporter development request, not a change to the external exporter
in this implementation. Keep the two study cases separate and bind every new
workbook to its model/scenario/topology identity, method, run ID and SHA manifest.

1. **LF settings semantics:** export versioned, documented meanings for ComLdf
   raw enums and effective settings: Q limits, station control, active balancing,
   eligible load scaling, taps/shunts and termination. Include algorithm/version
   provenance. Method-family equality alone must not enable numeric deltas.
2. **N1 case status and complete post-case results:** fill case execution status,
   convergence, solver/method, island supply/reference status and exclusions.
   Populate the supplied schema's `N1_CaseBranchResults_Raw` and
   `N1_CaseVoltageResults_Raw` (or declare an explicit versioned mapping) with
   class+FID, endpoints, signed P/Q/S, currents, loading denominator, V/angle,
   physical/electrical mapping, units and result availability. Preserve extrema
   by run/case/affected-FID/metric/side; do not collapse multiple extrema rows.
3. **SC fault-point matrices:** populate `SC_DeviceFaultContribution_Raw`,
   `SC_FaultDeviceBranchCurrent_Raw`, `SC_FaultRunStatus_Raw` and
   `SC_FaultSourceContribution_Raw`. Bind each device to an actual faultBusFid,
   terminal/side/direction and fault run. Empty faultBusFid device results must
   remain standalone device records.
4. **IEC method provenance:** identify the edition actually used, 3PH MAX fault
   type, Rf/Xf, frequency, c factor, element correction factors and corrected
   positive-sequence impedances. Supply validated machine, external-grid and
   converter contribution modes, units, manufacturer parameters and referenced
   normative rules. Include zero/negative sequence, transformer vector/neutrals
   and grounding before any unbalanced fault support.
5. **Rating and geometry:** export the endpoint current bases behind c:loading,
   transformer side, physical/electrical terminal relationships and source
   coordinate confidence. Missing coordinates remain NO_GEOMETRY.

The current files have no verified N1 case-by-case status or detailed post-case
rows, and each SC contribution/run matrix has zero rows. PF 2024 technical
manuals do not establish all IEC factors for this dataset. Until the above is
available, LF method parity remains EXPLORATORY_ONLY, full N1 certified differences
are null, and GA IEC certification is blocked. The independent network
approximation engine now computes Ikss/Skss when physical inputs are supported;
opt-in diagnostic differences never establish parity. See METHOD_SCOPE.md.

## Minimum additional evidence for this engine

- Versioned model attributes for each active external-grid source: nominal kV,
  positive-sequence Thevenin R/X, units, MAX/MIN/c basis, native source field
  references and independent correction provenance. PF solved Ikss is not an
  acceptable substitute for these inputs.
- For synchronous machines and attached generator transformers: rated MVA/kV,
  resistance/subtransient reactance and bases, cos phi, KG/KT or KKW applicability,
  unit detection option and independently checked normative clause/edition.
- For converters: native model/mode, current limits and contribution specification;
  omission is not zero contribution. Supply source service/cubicle identity too.
- Explicit DGS internal/displayed unit convention, line-section lengths/types,
  transformer winding bases/tap and actual phase/vector relationship. Source
  attribute availability alone cannot bypass an unsupported adapter.
- PF N1 promotion eligibility/reason/threshold (if automatic promotion is to be
  compared), base and per-case solve status, executed AC cases, exact effective AC
  algorithm/options, time/case exclusions, YTM TOUCHING endpoints and seasonal
  capacity denominator. The exported 100% operating limit does not prove a 90%
  DC promotion threshold.
- Per electrical SC calculation bus: complete physical-terminal membership,
  actual IEC edition, effective c and element correction provenance, fault/Zf
  identity and numerical result/conflict status. Keep unattributed device rows
  separate until fault×device/run/source matrices are populated.

Real field/fault blockers and identities are recorded only in the ignored local
acceptance reports. The present implementation does not change the external PF
exporter and does not claim that supplying coefficients without normative
validation will automatically enable IEC certification.

## Correction-specific minimum fields

- LF and N1 loading: explicit CURRENT_A versus APPARENT_MVA basis, season,
  ratedCurrentFromA, ratedCurrentToA or ratingMva, and endpoint/side applicability.
  The native LF preflight must prove a metric-specific denominator; a shared
  percent unit or coincident value cannot establish it. N1 currently lacks that
  proof and its matched loading extrema have null diagnostic differences.
- ElmXnet: native MAX/MIN input selection and mode, ikss/ikssmin (kA) or
  snss/snssmin (MVA), rntxn/rntxnmin (dimensionless), nominal kV, and independently
  documented c_source with model/option provenance. Export the native input
  fields distinctly from solved SC_BusResults Ikss. Fault c is a separate field.
- ElmSym/TypSym: xdss, resistance, rated sgn/ugn, bases, operating state and
  generator-transformer group plus independently justified KG/KT/KKW rules.
  ElmGenStat needs its actual contribution mode and current-limit parameters.
- ElmLnesec needs section type/length and unit convention; TypTr2 needs winding
  bases, actual tap position/side/ratio and vector/phase provenance. Field
  presence is insufficient while the adapter/correction remains unsupported.

Real source locations resolve in both study cases. All selected physical faults
are in the same connected component, so a connected unsupported contribution
cannot be isolated without evidence. There is no source-location global blocker
that can legitimately be removed to create real computed faults. The current
minimum source/element gaps keep computed real Ikss/Skss at zero coverage;
values stay null, and no normative edition is inferred.

## Native-source extension follow-up

For replacing explicit NETWORK_APPROXIMATION assumptions, supply missing
TypSym saturated subtransient reactance/resistance and machine unit-transformer
configuration, converter current phase/basis and parallel-unit semantics,
verified correction factors/edition and native MAX/MIN command settings.
Complete physical-to-electrical fault partitions and full N-1 post-case
matrices/rating bases remain necessary for PF differences.

## Exact partition and post-case export request (2026-10-10)

Export the **complete** physical-terminal member list for each native
calculationBusKey/electricalBusKey, including auxiliary/junction terminals,
terminal role/iUsage, native nominal kV and closed coupler/switch identities.
The physical bus-result rows and a representative terminal plus count do not
prove membership of all terminals in the GA electrical bus. Include an explicit
conflict flag, per-member result status, fault type, MAX/MIN, Rf/Xf and command
settings. The three real SN3 faults presently have PF/GA member counts 2/28,
1/16 and 1/16. Do not substitute nearest terminal or a name match.

For N-1 export caseId, outageFid/class, solved/status, AC_promoted, native scope
YTM IDs/boundary policy and canonical LF settings; post-case bus V/angle with
calculation/electrical bus IDs and complete terminal members; both branch ends
P/Q/S/I, loading definition, native limits, season and denominator provenance.
Recorded worst-case extrema alone do not establish full post-case coverage.
For missing machine inputs provide saturated subtransient xdss on its documented
machine base with rstr, sgn/ugn/ngnum; a 99999 sentinel or xdsat saturation factor
does not replace this impedance.
