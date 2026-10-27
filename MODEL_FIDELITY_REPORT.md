# PSS/E model and calculation fidelity

**Updated:** 2026-10-27
**Purpose:** State what the native source reader preserves, which electrical cases were compared with PSS/E 36.5, and where calculations remain incomplete.

## Source model preservation

The native SAV electrical decoding and original binary arrays remain source-faithful. The bus/branch network is a separate typed projection with source equipment IDs, source field maps, units, conversion equations, and a source hash. SAV `Bypass` is additively mapped to the matching branch row with its binary-array provenance; RAW/RAWX `BP` stays on its source row. Source values, GA calculated values, and imported `PSSE_REFERENCE` snapshots use distinct provenance labels.

The original SAV source was compared field-by-field with the installed PSS/E 36.5 `caspy.Savecase` oracle: **277,131 comparisons, zero mismatches**. The comparison covers bus identity and operating state; generator limits, controls, impedances and taps; all six load ZIP coefficients; fixed shunts; line electrical data and all twelve ratings; transformer electrical data and ratings; substations, nodes, switches, and terminal references. The documented oracle label exceptions and comparison tolerance are recorded in `evidence/psse-ac-dc/native-oracle.json`.

Paired SAV/RAW models have the same equipment counts and identities for the compared classes, with no missing identities across **239,048 comparisons**. Seven source values differ: four bus IDE values, one generator PG, and two QG values. They remain as separate SAV and RAW source state; the reader does not overwrite either variant to force agreement. The paired comparison is documented in `evidence/psse-ac-dc/source-parity.json`.

| Source class | SAV | RAW |
|---|---:|---:|
| Buses | 6,851 | 6,851 |
| Lines | 2,403 | 2,403 |
| Transformers | 3,703 | 3,703 |
| Generators | 2,920 | 2,920 |
| Loads | 2,520 | 2,520 |

Unknown physical voltage bases stay `null`; per-unit studies do not invent a kV base. Ampere and current-based thermal values are unavailable where the physical base is absent. A three-winding internal star is an electrical calculation node with no physical kV or current rating.

In the inspected SAV, all 2,403 decoded physical line rows have a corresponding zero `Bypass` value; the full 8,669-record SAV `Bypass` array is retained and indexed by original branch record. A nonzero active bypass flag is not treated as ordinary finite R/X. Since bypass topology is not implemented by the validated contraction profile, it blocks the affected study; missing SAV bypass state also fails closed.

The preserved RAW `SYSTEM_WIDE` `GENERAL` tokens are read downstream for named `THRSHZ` and `PQBRAK` scalars, including explicit zero and original source provenance. `THRSHZ=0` disables ideal-link contraction rather than silently falling back to the default. The verified SAV scalar locations are `Headre[12]` for THRSHZ and `Headre[2]` for PQBRAK; SAV comparisons retain F32 precision. AC blocks a nondefault PQBRAK until that load curve is implemented. PSS/E-source ZIP load checks gate constant-P loads below PQBRAK and constant-I loads below 0.5 pu. The lossless-DC `SOURCE_SAVED` profile applies the same fail-closed breakpoint gate only to active P/I terms, and blocks explicit nonblank `LOADTYPE` records whose curves are unknown. The source-load probe is `evidence/psse-ac-dc/dc-load-curve-source-gate.json`: on the inspected real SAV, 1,986 active loads had zero constant-P or constant-I breakpoint violations, no missing saved voltage or nonblank LOADTYPE, and minimum active-load saved voltage 0.88915 pu.

## Calculation comparisons

Comparisons use original small synthetic RAWX/SAV cases without licensed network data. They cover flat-start NR and FDNS, Q limits, load ZIP terms, fixed shunts, switched-shunt initial fixed controls, taps, phase shifts, three-winding transformers, transformer magnetizing conversions, winding bases, nominal-voltage conversions, and branch-end shunts.

| Method and case group | Result |
|---|---|
| NR_POLAR, eight core RAWX cases | 8/8 matched |
| FDNS_XB, eight core RAWX cases | 8/8 matched |
| LOSSLESS_DC, eight core RAWX cases | 8/8 matched |
| NR_POLAR / FDNS_XB / LOSSLESS_DC, seven SAV cases | 7/7 matched for each method |
| NR_POLAR, four extended transformer/base cases | 4/4 matched |
| FDNS_XB, four extended transformer/base cases | 4/4 matched |
| LOSSLESS_DC, three extended transformer/base cases | 3/3 matched |
| LOSSLESS_DC, focused branch-end-shunt case | 1/1 matched in the refreshed run |
| NR_POLAR, four switched-shunt fixed-control cases | 4/4 matched |
| NR_POLAR, active Q-limit case | 1/1 matched |

The FDNS active-Q-limit oracle did not converge, so it is retained as a reference limitation rather than counted as a parity pass. The current aggregate records 87 distinct comparisons: 74 PASS, 10 BLOCKED, two strict DC DIFFERENCES, and one REFERENCE_NOT_CONVERGED. The generated aggregate is `PSSE_AC_DC_PARITY_REPORT.md`; case evidence stays in `evidence/psse-ac-dc/parity-*.json`.

The 1,648-bus `bench.sav` per-unit profile converges with NR and FDNS and matches current references. Physical kV and current metrics are unavailable, so each result remains partial in physics coverage. Its lossless DC result converges but remains strict DIFFERENCES: maximum terminal MW delta is 0.0533194 MW, slightly over the 0.051 MW report-rounding threshold; it is below the separate 0.5 MW engineering target.

The 6,851-bus real SAV lossless-DC calculation contracts 928 validated equal-angle ideal links before solving and recovers their tree/cyclic flows from original-bus balances. It converges in one iteration and has no missing compared rows. Against PSS/E 36.5 DCLF, maximum angle difference is **0.0062844°** and maximum terminal MW difference is **0.2466915 MW**. The strict report-rounding check remains **DIFFERENCES**: 98 rows exceed the 0.051 MW report half-step. The differences remain below a separate 0.5 MW engineering target, which does not change the strict status. The result is partial coverage and must not be presented as exact parity. See `evidence/psse-ac-dc/parity-lossless_dc-real.json` and the detailed contraction report.

## Readiness limits

AC readiness fails closed for source controls and ideal links whose behavior is not implemented by the AC solver. The real SAV contains **227 active voltage-droop controls** and **473 active remote-regulating generators**; this is why the full 6,851-bus model is not advertised as an AC-converged PSS/E-equivalent case. If an active nontransformer link meets the source THRSHZ ideal-link criterion, AC is also blocked until the same bus contraction is available there. The verified `WMOD=0`, `QT=QB` fixed-Q rule is applied only to active source type-2 plants: all-fixed plants operate as PQ; mixed plants remain PV and the fixed units' Q is removed before reporting the single remaining regulator. No rule is inferred for reference buses, other WMOD modes, or other remote/droop controls.

Lossless DC intentionally omits reactive/voltage controls, line series resistance losses, and voltage magnitude solving. Known voltage-droop controls are an informational omission for DC; unknown active equipment, bypass flags that require unimplemented topology, zero/unknown series reactance, and unresolved topology still block. Validated positive-X ideal-link cycles use weighted cut-space flow recovery. Signed or zero-X cycles remain gated. The source threshold and scalar precision are included in diagnostics. The PSS/E 36.5 compatibility tap policy and a separate tap-aware approximation are both available and identified in result options.

These are method-specific coverage statements. Source fidelity does not imply that every source model is electrically ready for every solver.

Numerical status and publication status are distinct. A numerical `CONVERGED` result with `PARTIAL` physics coverage is labeled `LIMITED_PROFILE` in the analysis card, shared app status, and map/SLD result layer. JSON and CSV exports include `numericalStatus`, `publicationStatus`, `physicsCoverage`, and a profile note; unqualified `CONVERGED` is reserved for the `SUPPORTED` profile.

`LOSSLESS_DC` does not solve bus voltage magnitude. DC result rows and map/SLD calculated-voltage layers therefore carry unavailable `Vm` (`null`), and the Analysis page skips voltage and thermal violations for that method while stating the scope. The 1 pu value used in the DC model remains a diagnostic assumption for load/shunt calculations, never a calculated bus result.
