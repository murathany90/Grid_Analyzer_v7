# V3 known limitations

1. **No production-ready GA import claim.** Current GA LOAD_MODEL uses DgsModel.
   This SDK supplies an explicit Bridge + gated Canonical handoff; the application
   worker/UI importer still needs a separate integration change.
2. **Node-breaker is BLOCKED.** Source nodes, switches and terminals are retained.
   Their electrical bus equivalence is not proven. Physical nodes are excluded
   from solver buses. A zero-node Canonical graph is not evidence of successful
   physical connectivity; the explicit NODE_BREAKER_UNPROVEN gate is mandatory.
3. **DC/FACTS/induction and unimplemented controls are BLOCKED.** Source residue
   is retained. It is not an executable electrical model. Unknown native/source
   tables fail closed. Reporting area/zone/owner/interface/multisection metadata
   are distinguished from physics; source activity is not guessed when unknown.
4. **ZIP/remote/wind control.** GA's current Load only represents constant PQ.
   Active ZIP and unsupported generator remote/wind control block the projection.
   Automatic tap/phase and switched-shunt controls are PARTIAL. All source inputs
   remain in Bridge, including MBASE and all P/Q limits.
5. **Transformer scope.** System-MVA conversion is done once; CW1/2/3 and CZ1/2/3
   are tested. Differing nominal winding/bus voltage bases remain BLOCKED rather
   than applying an unverified voltage-base conversion. Partial 3W service status
   is retained leg by leg, but the source case remains blocked pending full parity.
   All 12 rating sets are preserved. GA's single selected rating cannot replace
   a documented N-1/seasonal policy. Explicit source zero means unlimited, not
   an invented positive rating.
6. **No IEC 60909 certification.** Short circuit is BLOCKED. Positive/negative/zero
   sequence and source impedances are separate requirements, not inferred from a
   boolean sequence flag. Source MBASE and ZSOURCE are retained but not sufficient.
7. **UNKNOWN source solution.** Saved VM/VA and FDNS method are not convergence
   certificates. No real-model GA/PSS/E solver or complete Ybus parity was established.
   Synthetic two-port Ybus and 3W star identities were tested separately.
8. **SAV runtime and license.** Native SAV extraction needs the user's installed
   Siemens caspy and matching Python; tested here with Python 3.14 / PSS/E 36.5.
   The installed psspy API opens the small savnw case but rejects sample with
   ierr=2 and a 50-bus Xplore limit. Native caspy reading is distinct from running
   a licensed large-case power-flow solve. No license checks were bypassed.
   On this installation, `-X utf8` breaks native caspy character decoding; use
   native Windows locale (`PYTHONUTF8=0`). The UI worker does this explicitly.
9. **Direct native writers disabled.** The previous caspy RAW/RAWX writers omitted
   entire source tables. They now reject export; use the official API when licensed.
   `--format all` still creates Bridge/Canonical inspection artifacts and reports
   the writer restriction. `.sav` input is genuinely decoded in the local HTML.
10. **RAW layouts.** Only guarded v35/v36 layouts are accepted; tested source
    examples are v36. Earlier revisions are explicitly rejected. Some optional
    format-defined values retain parser conventions; source residue and coverage
    matrix expose what is not compared. No complete electrical coverage is claimed.
11. **Portable/native tests.** Portable tests use original synthetic inputs and
    never skip. Native/paired tests require local Siemens examples, which are
    excluded from both Git and ZIP. Full-model reference equality must not be
    inferred merely from matching normalized fields.
