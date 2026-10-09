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
   Populate `N1_PostBranchResults_Raw` and `N1_PostVoltageResults_Raw` with
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
available, LF method parity can remain EXPLORATORY_ONLY, N1 differences are null,
and GA IEC computation remains NOT_COMPUTABLE. SC catalog edition information
alone is insufficient to implement an IEC engine.
