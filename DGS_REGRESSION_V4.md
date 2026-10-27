# DGS regression — V4 (2026-10-28)

Branch `fix/psse-v1-real-model-parity`, session range `acd6d8660b406794e43f4734b9a57adf537a3ff1..ace166996ba66d1643d2da07af44c15673c854a4`.

- **DGS reference source untouched**: `git diff acd6d86..ace1669 --stat -- src/map src/features/sld` is empty; the DGS electrical/model/map/SLD paths were not opened for editing this session.
- **PSS/E UI files untouched**: `git diff --stat -- src/features/psse` is empty for the same range; all session changes are confined to `src/analysis/psse/{newton,ac-reduction}`, `src/domain/psse/network.ts`, new tests/tools, evidence aggregates and the portable artifact.
- **Default solver behavior preserved**: `remoteRegulation` and `automaticAdjustments` default to `false`; every pre-existing profile (NR warm/saved, FDNS, DC, DGS flows) keeps its previous identity and results. Regression proof: full suite on the committed state — **873/873 pass, 0 failed, 0 skipped** (`.tmp/v4-final-tests.log`; baseline before the session was 870, +3 from the new auto-adjust fixture tests). `npm run typecheck` passes.
- **Portable artifact**: rebuilt with `npm run build:portable` and committed; `tests/unit/portable-byte-provenance.test.ts` verifies the committed blob equals the built artifact by raw byte hash (4/4 in that file after commit).
- **Solver result isolation**: the new adjustment/remote loops run inside `solvePsseNewton`'s effective-network clone; the input network is asserted unmutated by the fixture tests, so DGS and DC consumers cannot observe modified tap/primitive state.

No DGS behavior change is claimed or shipped in this session.
