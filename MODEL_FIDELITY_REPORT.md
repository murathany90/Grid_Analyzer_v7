# PSS/E model and calculation fidelity

**Updated:** 2026-10-27
**Purpose:** State what the native source reader preserves, which electrical cases were compared with PSS/E 36.5, and where calculations remain incomplete.

## Source model preservation

### V2 requested source and corrected method gates

The requested `20261026_1600_SN1_TR0.sav` is independent of the historical 20261014 case below. Native binary decoding gives **6,875 buses, 2,414 lines, 3,715 transformers, 2,932 generators, 2,516 loads, 2,571 switches, 137 fixed shunts and 1,625 substations**. SHA-256 is `8cc8ccfeca14001c392d2bebf578caafe61589c431f071f64db235a81dbbe60b`. Licensed RAW export SHA-256 is `40086c10e93819d16861b5c35d4afdd3ee641dfe14474c76dd3594ee88aa64ea`. Across 239,858 explicit SAV/RAW field comparisons there are no missing equipment IDs and four IDE source-state differences (`evidence/psse-v2/source-new-sav-raw.json`).

Those four RAW IDE=2 buses are isolated and have no online source; PSS/E's RAW reader changes them to TYPE=4 before solving, while SAV already stores IDE=4. GA RAW remains BLOCKED until that preprocessing is validated: a separate original RAWX isolated-PV experiment gives DCLF ierr=12, so deleting every empty island is unjustified.

PV-without-online-generator now gates only AC voltage control. Three original official DC fixtures prove equal flows/angles for equivalent PV, PQ and offline-generator variants. DC retains reference-source/island and unsupported-active-physics gates. LOADTYPE was incorrectly treated as an unknown load law; DataFormats §1.30 and a tag-only DCLF experiment show it is descriptor metadata. Load-breakpoint physics checks remain. RAW droop records now have the same method-specific scope as SAV: pure-Q omission in DC, blocked active AC control.

New-source AC blockers include 926 ideal-link AC reductions, 161 active droop records, 1,263 wind/droop machines, 454 remote regulators and one PV plant without an active generator. FNSL reference converges with warm/Q-enabled fixed controls in 9 iterations; GA NR/FDNS remain BLOCKED. Reference FDNS solved=3 is not convergence. New SAV DC numerically converges, publishes LIMITED_PROFILE and retains strict DIFFERENCES: max/mean/P95 terminal MW **0.244676928 / 0.023982011 / 0.047972192**; angle degrees **0.006893686 / 0.004930320 / 0.005755332**. All 5,072 active bus and 12,330 directed terminal identities match.

Calculated inactive-bus Vm/Va/P/Q are null in all three methods; SOURCE_SAVED values remain unchanged. Identity advances to `GA_PSSE_ENGINE_2`, preventing V1 result reuse. DC Vm/Q/current/AC losses remain unavailable. Local CSV/XLSX preserve the three provenance categories; blocked GA AC fields stay blank.

All 1,625 source substations have finite, nonzero Turkey coordinates. No direct Bussts/isub relation is populated in this SAV. Only exact unique normalized source-name aliases are accepted: 6,581/6,875 buses, zero ambiguous matches, 294 unmatched, 1,560 referenced stations, 65 coordinate-bearing stations without matched buses. This is explicitly `EXACT_UNIQUE_SOURCE_NAME_ALIAS`, not a direct terminal relationship. Unmatched equipment remains in reports/topology; no coordinates are invented. Public provenance contains source hash and counts; detailed licensed coordinates stay local. IEC/GCP/MON/CON and inventory JSON are retained attachments with no assumed electrical semantics.

### Historical V1 source evidence

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

The preserved RAW `SYSTEM_WIDE` `GENERAL` tokens provide named `THRSHZ` and `PQBRAK` scalars, including explicit zero and provenance. `THRSHZ=0` disables ideal-link contraction. Verified SAV locations are `Headre[12]` for THRSHZ and `Headre[2]` for PQBRAK, retaining F32 precision. AC blocks nondefault PQBRAK until its load curve is implemented. ZIP checks gate constant-P loads below PQBRAK and constant-I below 0.5 pu. The lossless-DC SOURCE_SAVED profile applies breakpoint checks to active P/I terms. LOADTYPE descriptor text is not an electrical gate (corrected and proved in V2). The historical old-source probe `evidence/psse-ac-dc/dc-load-curve-source-gate.json` reports 1,986 active loads, zero breakpoint violations, no missing saved voltage or nonblank LOADTYPE, minimum saved voltage 0.88915 pu.

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

The FDNS active-Q-limit oracle did not converge, so it is retained as a reference limitation rather than a parity pass. Historical V1 had 87 comparisons: 74 PASS, 10 BLOCKED, two strict DC DIFFERENCES and one REFERENCE_NOT_CONVERGED. The current generated `PSSE_AC_DC_PARITY_REPORT.md` separates Engine1 history from Engine2 measurements; evidence stays in `evidence/psse-ac-dc/parity-*.json`.

The 1,648-bus `bench.sav` per-unit profile converges with NR and FDNS and matches current references. Physical kV and current metrics are unavailable, so each result remains partial in physics coverage. Its lossless DC result converges but remains strict DIFFERENCES: maximum terminal MW delta is 0.0533194 MW, slightly over the 0.051 MW report-rounding threshold; it is below the separate 0.5 MW engineering target.

The 6,851-bus real SAV lossless-DC calculation contracts 928 validated equal-angle ideal links before solving and recovers their tree/cyclic flows from original-bus balances. It converges in one iteration and has no missing compared rows. Against PSS/E 36.5 DCLF, maximum angle difference is **0.0062844°** and maximum terminal MW difference is **0.2466915 MW**. The strict report-rounding check remains **DIFFERENCES**: 98 rows exceed the 0.051 MW report half-step. The differences remain below a separate 0.5 MW engineering target, which does not change the strict status. The result is partial coverage and must not be presented as exact parity. See `evidence/psse-ac-dc/parity-lossless_dc-real.json` and the detailed contraction report.

## Readiness limits

AC readiness fails closed for source controls and ideal links whose behavior is not implemented by the AC solver. The real SAV contains **227 active voltage-droop controls** and **473 active remote-regulating generators**; this is why the full 6,851-bus model is not advertised as an AC-converged PSS/E-equivalent case. If an active nontransformer link meets the source THRSHZ ideal-link criterion, AC is also blocked until the same bus contraction is available there. The verified `WMOD=0`, `QT=QB` fixed-Q rule is applied only to active source type-2 plants: all-fixed plants operate as PQ; mixed plants remain PV and the fixed units' Q is removed before reporting the single remaining regulator. No rule is inferred for reference buses, other WMOD modes, or other remote/droop controls.

Lossless DC intentionally omits reactive/voltage controls, line series resistance losses, and voltage magnitude solving. Known voltage-droop controls are an informational omission for DC; unknown active equipment, bypass flags that require unimplemented topology, zero/unknown series reactance, and unresolved topology still block. Validated positive-X ideal-link cycles use weighted cut-space flow recovery. Signed or zero-X cycles remain gated. The source threshold and scalar precision are included in diagnostics. The PSS/E 36.5 compatibility tap policy and a separate tap-aware approximation are both available and identified in result options.

These are method-specific coverage statements. Source fidelity does not imply that every source model is electrically ready for every solver.

Numerical status and publication status are distinct. A numerical `CONVERGED` result with `PARTIAL` physics coverage is labeled `LIMITED_PROFILE` in the analysis card, shared app status, and map/SLD result layer. JSON and CSV exports include `numericalStatus`, `publicationStatus`, `physicsCoverage`, and a profile note; unqualified `CONVERGED` is reserved for the `SUPPORTED` profile.

`LOSSLESS_DC` does not solve bus voltage magnitude. DC result rows and map/SLD calculated-voltage layers therefore carry unavailable `Vm` (`null`), and the Analysis page skips voltage and thermal violations for that method while stating the scope. The 1 pu value used in the DC model remains a diagnostic assumption for load/shunt calculations, never a calculated bus result.
