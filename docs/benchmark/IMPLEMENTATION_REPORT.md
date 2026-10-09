# PowerFactory benchmark implementation

Base: `f13567add3a0d4b16d4dc164b6a9cd645d5fa2b5`.
Branch: `feat/pf-sn3-sn4-benchmark-20261009`.

## Boundaries

Full AC solver and DC N-1 screening remain unchanged. PowerFactory references
never become numerical solver inputs. Real models, workbooks, logs, hashes tied
to private files, and acceptance exports remain in ignored local directories.

## Baseline

Local `npm ci`, typecheck, lint, unit/regression, browser smoke, standard build
and portable build passed before implementation. `test:full` exited zero with
`SKIPPED / SOURCE_UNAVAILABLE`; this is not evidence of real-model execution.
Detailed logs and source inventory are in `local-benchmark-results/`.

## XML dependency

The importer uses [saxes](https://github.com/lddubeau/saxes) 6.0.0 (ISC) and
its xmlchars dependency (MIT) for strict streaming XML in workers. The parser
rejects DTDs and external relationships. Existing fflate ZIP attribution stays
in place. Dependencies are pinned by the lockfile.

## Delivery and phase status

| Phase | Status | Evidence / boundary |
| --- | --- | --- |
| GIT-0 / BASE-1 | DONE | Clean branch from the recorded main SHA; source audit, six workbook hashes and initial test logs retained locally |
| IMP-2 | PARTIAL | Streaming bounded ZIP/OOXML reader, nine-file atomic import, DGS alias/array checks; existing DGS JSON parsing still materializes the model |
| CMP-3 | DONE | Identity/topology/method gates; nullable deltas, source cells and per-metric exclusions; actual LF packages remain EXPLORATORY_ONLY |
| UI-4 | DONE | Two ZIP inputs, three tabs, Raw tables, search/filters/sort/pagination, source tooltips and CSV/XLSX/JSON |
| MAP-5 | PARTIAL | PF/GA/delta gates, case selection, cached geometry, gray missing values and no-geometry counts; station values aggregate by maximum absolute magnitude |
| N1-6 | PARTIAL | Opt-in existing AC engine, immutable outage overlay, island/budget/cancel/stale guards; synthetic convergence verified, sampled actual cases were unsupplied |
| SC-A | DONE | Separate PF physical/electrical/device tables and explicit empty contribution matrices |
| SC-B | DONE | Conservative source-field/sentinel/sequence/method audit with local CSV/JSON; readiness does not establish calculability |
| SC-C | BLOCKED | No verified IEC edition, corrected impedances or machine/converter factors; no independent SC numbers or IEC subset claim |

The implementation is in `src/importers/powerfactory-benchmark`,
`src/domain/benchmark`, `src/features/comparison`, map adapters, worker/controller
integration and `src/analysis/contingency-ac`. The original seven protected AC
engine files and `src/domain/n1/index.ts` have no diff from the base commit.

Phase commits: `dd7ebb8` setup, `5c560e6` importer, `f96284b` gates,
`24f59b0` selected N-1 AC, `79a11dd` UI/reference/readiness integration,
`dcbd5b3` map/offline flows, `0023dd3` exclusions/portable provenance,
`47c3209` exporter-version checks. The final documentation commit is identified
by `git rev-parse HEAD`; no merge, branch deletion or force push is authorized.

## Actual local source acceptance

Both source directories were copied without changing originals. Workbook SHA
verification passed **6/6**. Each model had **40 DGS classes**. Data rows exclude
LF metadata rows (144/21 in SN3 GA-reference/control tables).

| Count | SN3 | SN4 |
| --- | ---: | ---: |
| GA_Reference_Raw | 56,381 | 55,984 |
| ControlContext_Raw | 45,831 | 44,963 |
| N1 cases / recorded extrema | 660 / 17 | 664 / 20 |
| Verified N1 case status / post-branch / post-voltage | 0 / 0 / 0 | 0 / 0 / 0 |
| SC physical / electrical buses | 4,689 / 3,769 | 4,686 / 3,768 |
| Each of four SC fault/contribution/run matrices | 0 | 0 |

Exporter structural hashes are not GA file-byte hashes. The adapter issues GA
comparison identities only after the existing preflight independently verifies
the complete terminal partition and every active branch endpoint. Exporter hashes
stay in source provenance. Actual LF settings have raw enum values without
verified semantic mappings: both packages are **EXPLORATORY_ONLY**, with null
differences and error statistics. N1 is PF_RECORDED_EXTREMA, SC is PF_REFERENCE_ONLY.

## Full AC regression and N1 scope

An untouched copy of the recorded main `src` and package metadata was extracted
under an ignored local directory. Base and final engines solved identical models,
source ControlContext and empty scenarios. The stable digest covers bus V/angle,
branch P/Q, generator Q, iterations, rounds and numerical/controller diagnostics;
wall-clock timing fields are removed recursively. The initial fingerprint's
nested timing fields made it unsuitable for parity; it is retained as historical
measurement and is not used as a parity assertion.

| Model | Final result | Buses / branches / generators | Iterations | Base/final stable SHA-256 |
| --- | --- | --- | ---: | --- |
| SN3 | CONVERGED_FULL_NR | 4,077 / 5,140 / 1,965 | 12 | `5cb3104ca05b1c0b0f027d00ec29fdfdc5aa3f344422b25f282e8915c740b40e` |
| SN4 | CONVERGED_FULL_NR | 4,088 / 5,141 / 1,944 | 11 | `b8c43c3951399fdc3729324089dc6f4dec9cbbf55d5c199cb0ab9c3f7ad2754e` |

Synthetic 3- and 5-bus outage V/P/Q/S agree with an independent lossless radial
equation. Unknown rating stays null. The first in-service actual PF case sampled
in each model returns ISLAND_UNSUPPLIED, without a fake slack or post-case result.
There is no claim that all 660/664 cases converge or match PF. At most three cases
are accepted by the worker; the UI selects one. A 120-second worker termination
budget provides interactive cancellation; a direct synchronous service call can
only check its time/signal before and after the engine call. The bus-count budget
is conservative and is not an exact byte-memory budget.

## Tests, performance and portable

Final typecheck and lint passed. **287/287** unit/regression tests passed after
committing the rebuilt portable bytes; the initial final-suite failure was the
expected mismatch between a modified artifact and its old committed blob.
The final version-manifest check also passed its six focused importer tests.
Legacy Chromium smoke and the new two-ZIP smoke passed. Standard and portable
builds passed. `test:full` again reports SKIPPED / SOURCE_UNAVAILABLE; actual
SN3/SN4 evidence comes from the separate ignored acceptance runner.

Portable smoke blocks external network traffic and checks ZIP import, PF-only,
independent LF, N1 island state, SC null/zero, exports, map gates and mobile layout.
Real portable tests passed SN3/SN4 PF-only tabs, cancellation and an intentionally
wrong SN3-model/SN4-benchmark pair (blocked atomically). Actual browser import and
tab/map traversal took about **30.9 / 32.2 seconds**. Final CLI import + LF +
comparison took **22.2 / 21.8 seconds**, with observed heap maxima about
**776 / 720 MiB**; another base run observed 1,593 MiB. Sampling and GC affect
these values, so they are not a guaranteed peak or a low-RAM claim.

ZIP entry/directory/ratio/CRC/path limits and chunked hashes/XML bound extraction.
JSON/DGS materialization and returning the full reference package still cost
substantial memory. Tables draw 50 rows at a time; source parsing does not repeat
on pagination. Three new license notices are embedded in portable HTML.
The committed artifact is LF-only and matches rebuilt raw bytes. CI remains the
final cross-platform byte-provenance check on the pushed delivery SHA.

## SC evidence boundary and source request

Targeted local PF 2024 DGS and voltage-source/short-circuit manual sections were
read. They do not identify the dataset's IEC edition or all applicable correction
factors. One narrow Luna IEC review returned BLOCK for a computed subset label.
The IEC catalog identifies [IEC 60909-0:2026, edition 3](https://webstore.iec.ch/en/publication/68454)
and shows [2016 replaced in July 2026](https://webstore.iec.ch/en/publication/24100).
Catalog metadata is not the normative algorithm, and does not prove which
edition PowerFactory 24.0.7 used. No 2-/5-bus IEC numerical acceptance is claimed.
See [the missing-source request](MISSING_PF_SOURCE_REQUEST.md).

## Privacy and CI delivery

Real ZIP/XLSX/JSON/LOG, FID-bearing readiness/results/screenshots and base extracts
remain under ignored `.local-fixtures/` or `local-benchmark-results/`. Public tests
construct small synthetic objects. Benchmark import does not persist the model,
reference or scenario to IndexedDB. Exports occur only through user actions.
No private source paths/data are staged in this branch. Source-free aggregate
counts and numerical digest proofs above are deliberately public.

The existing [CI workflow](https://github.com/murathany90/Grid_Analyzer_v7/actions/workflows/ci.yml)
runs synthetic checks and raw portable SHA equality; it does not receive real
source data. The delivery response records the actual pushed HEAD and CI run URL
after checking that run's head SHA. Main remains untouched.
