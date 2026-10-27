# PSS/E solver research

## V2 oracle evidence (2026-10-27)

The new `20261026_1600_SN1_TR0` SAV is opened in installed licensed PSS/E 36.5.0 before each uncached run; source SHA-256 and exact method/options hash key the retained developer cache. `tools/psse-export-raw.py` uses official `writerawversion('36',0,path)` without solving; SAV hash `8cc8ccfeca14001c392d2bebf578caafe61589c431f071f64db235a81dbbe60b`, RAW hash `40086c10e93819d16861b5c35d4afdd3ee641dfe14474c76dd3594ee88aa64ea`. No vendor implementation is copied.

FNSL warm/Q-enabled fixed flags `[0,0,0,0,0,0,0,1]`: ierr=0, solved=0, 9 iterations, system mismatch 0.0121785 MVA. FDNS same flags: ierr=0, solved=3, 1 iteration, mismatch 0.0504561 MVA; not converged. DCLF_2 `[0,0,1,1,0,1]`: ierr=0, one iteration, actual directed MW report retained separately from AC-valued branch APIs. Large reference runs were not repeated for UI or output-version changes.

Official DataFormats LOADTYPE field and §1.30 define a descriptor/classification used for subsystem selection, not a static load-law equation. An original tag-only DCLF experiment gives identical angles and terminal flows; the false gate is removed. Original PV/PQ/offline-generator DC experiments prove PV-without-generator is not itself a DC blocker. Active AC droop/remote control remains unsupported. Four RAW isolated PV buses are reader-preprocessed to TYPE=4 by PSS/E; an original RAWX empty-island test returns ierr=12. Native GA does not infer a universal deenergization rule.

The conditioning witness in `evidence/psse-v2/dc-tiny-conditioning-proof.json` supports sensitivity beyond report rounding, not a claim about proprietary arithmetic. No tolerance relaxation or production rounding hack was accepted. See architecture §18 and the current parity report for maximum/mean/P95 and unresolved strict real-case differences. Official APIs/documents were sufficient for V2; no additional REA disassembly or license manipulation was needed.

Development reference: installed licensed PSS/E **36.5.0**, Python 3.14, initialized successfully on 2026-10-27 (Europe/Istanbul). The web runtime does not call this installation. No vendor implementation is copied.

## Official API observations

Primary sources are the locally installed Siemens Sphinx pages under `DOCS/Sphinx/psspy/_as_gen/` and their runtime `psspy` docstrings. `API.pdf` is a four-page documentation entry point, not the complete API manual. Relevant pages are `psspy.fnsl.html`, `psspy.fdns.html`, `psspy.nsol.html`, `psspy.solv.html`, `psspy.dclf_2.html`, `psspy.solved.html`, `psspy.iterat.html`, `psspy.maxmsm.html`, `psspy.sysmsm.html`, and `psspy.solution_parameters_5.html`.

| API | Documented algorithm | Reference options used |
|---|---|---|
| FNSL | Full Newton–Raphson | `[0,0,0,0,0,flat,qLimit,1]` |
| FDNS | Fixed slope decoupled Newton–Raphson | Same eight entries; distinct implementation and behavior |
| NSOL | Decoupled Newton–Raphson | First seven entries above |
| SOLV | Gauss–Seidel | `[0,0,flat,0,0,ignoreQLimits]` |
| DCLF_2 | DC analogy network solution | `[0,0,1,1,0,1]`, all buses, unchanged branch list |

For FNSL/FDNS, the entries control taps, area interchange, phase shift, DC taps, switched shunts, starting voltages, Q limits, and nondivergence. A zero control entry freezes that control; it does not disable the electrical device. Q-limit `-1` ignores limits, `0` applies them immediately, and a positive integer delays their application. SOLV uses a different array, including a different Q-limit flag. The browser exposes only implemented methods/profiles; documenting NSOL/SOLV is not an implementation claim.

DCLF_2's first entry `0` excludes losses estimated from the saved voltage vector. Its fourth entry `1` saves base-case DC angles. The obsolete DCLF has only four status entries and must not be confused with DCLF_2. DC output does not establish an AC voltage magnitude, reactive flow, or AC loss solution.

`solved()` describes the most recent solution attempt. Codes include 0 (tolerance reached), 1 (iteration limit), 2 (divergence), 3 (nondivergent termination), 4 (interrupt), 5 (singularity/zero voltage), and 9 (no attempt). An API `ierr=0` is not a convergence certificate. Neither a saved voltage vector nor a freshly loaded SAV proves convergence.

`iterat()` reports iterations; `maxmsm()` returns the largest bus complex mismatch; `sysmsm()` returns total system MVA mismatch. Their quantities differ from an infinity norm of the selected NR equations. In particular these AC mismatch queries are not a DC residual check after DCLF_2.

The reproducible development harness is `tools/psse-reference.py`. It reloads the source for every uncached run, fixes solution iteration/tolerance settings, records exact API/options, and exports buses, machine P/Q/limits, both branch ends, 3W star values/losses and winding flows/taps. Cache keys contain the complete source SHA-256, method and options hash, including harness version. Detailed model values and Siemens logs remain in ignored `private-re/solver-reference/`.

## Transformer and source semantics

Siemens `DataFormats.pdf` printed pages 38–39 (PDF pages 50–51) defines CW/CZ/CM, including nominal winding voltage bases. `PAGV1.pdf` §§4.1.1–4.1.3, printed pages 77–79 (PDF pages 99–101), provides the two-winding equivalent. The architecture document records the independently implemented equations and normalization boundaries. A secondary tap affects equivalent impedance as well as the overall ratio. Magnetizing admittance is attached at the winding-1 bus. SAV pre-normalized admittance must not be scaled a second time.

SAV retains packed shunt/control flags and internal 3W star buses. Unknown flags cannot be assigned plausible statuses just to permit a solve. Source inventory completeness and solver physics eligibility are separate contracts.

The first parity experiment exposed the source YQ convention: Siemens DataFormats load section (printed page 14) defines positive YQ as capacitive. Source reactive consumption is `QL + IQ*v - YQ*v²`; its magnitude derivative is `IQ - 2*YQ*v`. The normalizer stores consumption-signed coefficients with explicit provenance. The original architecture equation used the wrong source sign and was corrected at Gate C.

`abusreal('ANGLE')` returns radians; `ANGLED` returns degrees. The oracle records both with explicit units. After DCLF_2 saves its angles, `abrnreal('P')` evaluates the AC circuit at those voltages; it is not the DCLF MW report. DC parity therefore uses the actual DCLF report (0.1 MW display resolution), including three-winding terminal records, and API angle values. This distinction was checked against the original three-bus synthetic network.

Controlled SAV fixture differences identify status bit 6 and adjustment bit 8 of the tested switched-shunt packed word: on/off values 522305/522241, adjustment-mode variant 522561, continuous-mode variant 522306. These observations apply to the tested profile; unresolved packed meanings remain gated. Synthetic SAV generation uses `tools/psse-generate-sav.py`, not a second decoder.

Independent mathematical reference: [MATPOWER branch model](https://matpower.app/manual/matpower/Branches.html), [AC power flow](https://matpower.app/manual/matpower/ACPowerFlow.html), and [modeling](https://matpower.app/manual/matpower/Modeling.html). These support the generic sparse nodal formulation; they do not establish Siemens control equivalence.

## REA evidence boundary

REA `inspect_native_exports`, summary view `ev_2495e1e1fb5be4e26b0ea1327df29644b7713eba4691f04f7e0b9fc823aa280f`, parent `ev_d8b687e73a7b065912d7a41da88ca259a841da506a13c415b85b6340d263e398`, inspected the installed `PSSPY314/psscommon.pyd`: amd64 PE, 23,600 bytes, SHA-256 `a32690efbc63c28f5bf94891e7416a3ab88ad4ac1c5afb9c82c64ce4c14f1d37`, one export, complete export-table coverage. This establishes artifact identity and binding architecture only. It proves neither solver equations nor runtime behavior. Complete evidence is retained locally as `private-re/psscommon-exports-evidence.json`.

The REA process-capture workflow is documented for Linux/macOS, so the Windows reference runs use normal subprocess execution and official public APIs. No disassembly, license bypass, DLL redistribution or copied solver code was needed.

## Initial measured outcomes

The native decoder freshly read the real SAV/RAW: 6,851 buses, 2,403 lines, 3,703 transformers, 2,920 generators and 2,520 loads in each. Aggregate evidence: `evidence/psse-ac-dc/native-counts.json`.

The installed benchmark has 1,648 buses with unspecified physical kV bases. Its per-unit network can be solved without inventing kV when every conversion input is already known; physical ampere/current-rating quantities remain unavailable. That is a constrained per-unit profile, not a complete physical-units claim.

The first benchmark comparison exposed a conventional-machine control rule: `QT=QB` means fixed reactive output at that common bound, even when the saved QG differs and FNSL's new limit monitoring is disabled. All-fixed ordinary Type-2 plants operate as PQ; a plant with a regulating unit remains PV, with fixed-unit Q subtracted before allocating the regulating remainder. Four tiny official-API experiments established this rule (`fixed-q-plant-reference.json`). A separate saved-Q-limit experiment disproved a blanket interpretation of negative saved Jcode as a permanently frozen Q state. No such blanket rule is used.

PAGV1 §7.5.3 describes working-case voltages in DC shunt consumption. The DCLF-compatible profile accounts for real conductance at bus and branch terminals as fixed input consumption at the selected initial voltage. Terminal P includes its local conductance consumption; series R losses remain excluded. Both report ends must be compared. Unrated DCLF rows terminate immediately after MW rather than printing rating columns; the parser retains these shorter rows. The benchmark report contains all 5,204 directed terminal records after that parsing correction, without rerunning PSS/E.

On savnw SAV, flat start and frozen controls with Q limits ignored: FNSL reached `solved=0`; FDNS with an overly tight 1e-5 MVA tolerance stopped with `solved=3` and is retained as a failed experiment. At 1e-3 MVA reference tolerance, FNSL and FDNS both reached `solved=0` (13 and 9 iterations). Total system mismatch was approximately 0.00109 and 0.000936 MVA respectively. The tolerance is a per-solution API setting, not a limit on total system mismatch. Final parity and unsupported physics are evaluated separately in `PSSE_AC_DC_PARITY_REPORT.md`.

## Zero-impedance topology and final DC boundary

DataFormats §1.13.1 describes active, zero-resistance non-transformer links at or below THRSHZ and bypassed branches as ideal links, subject to compatible terminal voltage levels. A controlled threshold-only synthetic SAV save located THRSHZ at `Headre[12]` (JavaScript index 11). The real source stores Float32 `9.999999747e-5`; using the rounded decimal 0.0001 at a strict boundary would change classification. Evidence: `threshold-metadata-reference.json`.

The production DC engine contracts validated ideal components and reconstructs individual flows. Trees have unique flow recovery; tested positive-reactance cycles use a weighted Laplacian. Unverified signed/zero cyclic weight cases and unverified bypass effects fail closed. The real case has 928 ideal links, 861 connected ideal components and cycle rank 17. Projection of cached reference switch flows into the independently calculated cycle rule changes them by at most 0.033333 MW, within the report's 0.1 MW rounding. Evidence: `dc-contraction-experiment.json`. This structural validation does not eliminate the full-network strict DC difference.

The final large DC run converges mathematically with PARTIAL source coverage, maximum angle difference 0.00628441 degrees and maximum terminal flow difference 0.246692 MW. It meets the initial 0.05 degree/0.5 MW engineering bounds for those compared quantities but retains strict DIFFERENCES at the 0.051 MW report-rounding limit. The benchmark DC maximum is 0.0533194 MW. No cause is claimed as proven for either remaining full-network discrepancy. A development experiment with official `power_output(0)` did not improve tested DCLF display precision and did not justify widening the strict limit.

## Final source-parameter and publication review

The final gate caught two additional source/units boundaries. An API reference containing only `ANGLE` must be converted from radians; `ANGLED` is already degrees. Both equivalent nonzero representations and a meaningful angle disagreement are now covered by the reference-comparator regression.

Ordinary RAW retains named GENERAL rows in `sourceTables.SYSTEM_WIDE.sourceTokens`; reading only RAWX-style GENERAL would silently miss an explicit THRSHZ=0. Source settings must take precedence over a documented default. A separate tiny original-fixture metadata-only save changed `solution_parameters_5 REALAR(10)` from PQBRAK approximately 0.7 to 0.82, without a power-flow solve. `Headre[2]` (JavaScript index 1) changed correspondingly at Float32 precision. Evidence: `pqbrak-metadata-reference.json`. Custom source load breakpoints require the verified low-voltage curve or an explicit calculation block.

Numerical convergence and publication readiness are separate. A converged calculation with incomplete physical outputs or a deliberately limited method profile must be labelled `LIMITED_PROFILE` publicly; material unimplemented equations remain `BLOCKED`. An internal residual-convergence flag or a same-profile reference match is never a full-model readiness or PSS/E-equivalence certificate.
