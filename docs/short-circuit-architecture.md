# Short-circuit analysis architecture

Short-circuit analysis is not implemented. `ModelCapabilities` currently
reports the short-circuit capabilities as blocked. This note defines the data
and engine boundary required before a future calculation can be enabled.

## Standard and supported cases

The planned calculation basis is IEC 60909. As of 27 September 2026, the IEC
catalogue lists IEC 60909-0:2026, edition 3.0, published 23 July 2026; the
project must pin the licensed edition it implements and review applicable
national adoptions before release. See the [IEC publication record](https://webstore.iec.ch/en/publication/68454).

Fault selection should be explicit and capability-gated for at least:

- three-phase;
- phase-to-phase;
- phase-to-earth;
- two-phase-to-earth.

Do not expose a result type as ready merely because the positive-sequence
power-flow model is complete. Each fault type requires a completeness check
for the sequence networks and grounding paths it needs.

## Model and request boundary

Keep short-circuit input derived from `CanonicalNetwork` plus an immutable
scenario snapshot. Add explicit, unit-bearing source data for positive,
negative and zero-sequence impedances, machine contributions, transformer
connections/vector groups, neutral and earthing impedances, and source
equivalents. Record each value's unit and `SourceRef`. Do not infer missing
sequence or grounding values from positive-sequence power-flow fields.

A request should identify the model hash, scenario signature, fault type,
faulted bus or terminal, any fault impedance, calculation settings and standard
edition. Persist the request's full identity with the result so scenario or
option changes make an old result stale.

Use a capability query per fault type. Return `BLOCKED` with named missing
fields when required data are absent or units are unknown. `PARTIAL` may be
used only where the UI can clearly select the cases that are actually
supported; it must not silently substitute an assumed grounding path.

## Result and validation contract

The result should include the selected fault case and location, sequence
currents and voltages used by the calculation, reported current quantities,
units, standard edition, assumptions, warnings and source references. Choose
the exact result quantities and factors from the pinned licensed standard;
do not present this roadmap as a calculation procedure.

Before enabling a case, validate it with independent worked examples and
known reference networks for each supported fault type. Test missing sequence
data, floating or ungrounded paths, transformer connections, out-of-service
equipment and scenario changes. Keep failed and unsupported cases visible as
such rather than returning a plausible-looking zero.

## Current validation limits

PowerFactory short-circuit reference results are absent from the current
baseline. The inspected v6.8 source maps station-controller data but does not
implement its outer loop, so that behavior has not been migrated. The existing
power-flow result is not a short-circuit reference. No PowerFactory equivalence
claim is supported. The engine contract's optional short-circuit hook is only
a placeholder, not a working analysis path.
