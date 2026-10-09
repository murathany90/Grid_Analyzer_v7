# YTM N-1 / SC parity fix acceptance — 2026-10-10

Baseline `36336c77701601bccea995b4db0e2fe236394548`; branch
`fix/ytm-n1-constraints-sc-pf-parity-20261010`. Source commits `fd42dd7` and
`02b9ff9`; HEAD additionally contains this acceptance report, with no later
solver changes. The [CI branch run list](https://github.com/murathany90/Grid_Analyzer_v7/actions?query=branch%3Afix%2Fytm-n1-constraints-sc-pf-parity-20261010)
records the exact final HEAD, result and test/portable-byte evidence after push.
Its live status is shown below; local validation does not imply remote success.

![Final branch CI](https://github.com/murathany90/Grid_Analyzer_v7/actions/workflows/ci.yml/badge.svg?branch=fix%2Fytm-n1-constraints-sc-pf-parity-20261010)
Real model data, FIDs, XLSX files, case details, screenshots and machine results
remain in ignored local storage. No PF results are injected into either solver.

## Profiles and physical constraints

The GUI and CLI now pass the same canonical settings to both base and outage
calculations. Current default droop/distributed-load balancing retains its
controller-support safety gate. The user can explicitly select
`GA_APPROX_STATION_OFF`; this changes station control only, retains global LF
settings and distributed balancing, and displays
`CONTROL_FIDELITY_PARTIAL / NOT_PF_PARITY`. Hash mismatches reject base/case
results and resume. Empty solved buses leave extrema null and never count as
`AC_CALCULATED`.

Both endpoints inside the selected native YTM set means internal; exactly one
inside means boundary. Same-YTM internal and unknown endpoint scopes are
separate. ALL includes all resolved endpoints; ambiguous/missing endpoints
remain UNKNOWN_SCOPE. Filtering chooses outages/faults without removing the
outside electrical network. Parallel equipment keeps its own native identity.

Constraints join full electrical bus terminal sets and nominal kV, or native
branch class/FID with identical side and rating denominator/season. NEW requires
a nonviolating base; WORSENED requires greater violation severity. PERSISTENT,
RELIEVED, UNKNOWN_RATING, UNSOLVED_ISLAND and IDENTITY_UNVERIFIED are explicit.
Unknown capacity is null. The actual outaged branch is excluded from an
unsolved-island classification. Partial results preserve supplied components;
unsupplied load remains a separate MW quantity.

BASE / POST / CHANGE / NEW_CONSTRAINTS maps use the selected case and current
snapshot. CHANGE is signed POST minus BASE, using exact partitions and rating
bases. New-constraint layers leave other elements gray. PF diagnostic and
certified-difference gates remain separate.

## Real bounded pilots

SN3 uses the exact uploaded model ZIP and the unchanged nine-file `zip/`-prefixed
`zip.zip` result archive. SN4 uses existing local private fixtures. Workbook
hashes/manifest identity are checked by the importer. Cached input-byte hashes
allow reuse without repeated CLI ingestion.

| Acceptance measurement | SN3_REAL_UPLOADED | SN4_REAL_LOCAL |
|---|---:|---:|
| LF reference rows | 56,381 | 55,984 |
| Native national N-1 catalog | 5,131 | 5,132 |
| Orta Anadolu internal / boundary / total | 619 / 41 / 660 | 624 / 40 / 664 |
| PF intersection / only PF / only GA in this scope | 660 / 0 / 0 | 664 / 0 / 0 |
| Default GUI-profile N-1 | explained BLOCKED | explained BLOCKED |
| Explicit off-profile selected / AC calculated | 5 / 5 | 5 / 5 |
| AC violation / partial island cases | 4 / 1 | 4 / 1 |
| Base violation records | 55 | 97 |
| NEW / WORSENED / PERSISTENT / RELIEVED | 20 / 198 / 76 / 1 | 69 / 365 / 120 / 0 |
| Post violation case × element records | 294 | 554 |
| Unique violated elements | 75 | 166 |
| UNKNOWN_RATING / UNSOLVED_ISLAND records | 45 / 1 | 45 / 1 |
| Base/outage settings hash equality | PASS | PASS |
| Retained full case details / persisted case details | 2 / 5 | 2 / 5 |
| Resume repeated solved cases | 0 | 0 |
| Native MAX faults BLOCKED / factor / RHS | 10 / 0 / 0 | 10 / 0 / 0 |
| Explicit assumption MAX / MIN computed faults | 3 / 3 | 3 / 3 |
| Assumed MAX sparse factor / RHS | 1 / 3 | 1 / 3 |
| Native / assumed active source inputs in approximation | 257 / 1,717 | 269 / 1,684 |
| Missing native machine xdss inputs | 393 | 391 |
| PF SC partition identity matched / selected | 0 / 3 | 0 / 3 |
| PF SC Ikss/Skss diagnostic cells; MIN-to-PF-MAX cells | 0; 0 | 0; 0 |
| PF full N-1 post-case coverage | 0 / NOT_MEASURED | 0 / NOT_MEASURED |
| LF legacy buses / Newton iterations | 4,077 / 12 | 4,088 / 11 |
| LF legacy digest unchanged | PASS | PASS |
| LF diagnostic cells / certified cells | 65,015 / 0 | 65,011 / 0 |
| IEC_method_verified | false | false |

Pilots use 400/154/33-band equipment, including a two-winding transformer and a
bridge. Two initial AC cases followed by resume finish the five selected cases;
re-resuming runs no solved case. Unknown ratings and excluded national cases
keep the overall result PARTIAL. No selected real DC-clear case was available;
the existing analytical DC-clear voltage-risk test remains the evidence for
that path. These counts are bounded-pilot observations, not full-network safety.

The previous 858 / 834 / 24 pilot used a different YTM, not Orta Anadolu.
Rechecking that same native YTM gives the same 858 / 834 / 24. An additional
two-YTM audit gives 1,265 total, 1,238 internal, 27 boundary; 11 between-area
branches are correctly internal to the selected set.

## SC source and partition audit

Both SC_BusResults_Raw and SC_CalculationBus_Raw were checked for each of three
real faults. PF/GA physical member counts are 2/28, 1/16 and 1/16 in both models.
Each has a native electrical-table record and matching nominal/mode evidence,
but lacks 26, 15 and 15 GA members. In SN3 all missing members are native
ElmTerm iUsage=2. This is source membership incompleteness, not evidence that
auxiliary terminals may be discarded from electrical identity.

All three fail MISSING_MEMBERS. SOURCE_PARTITION_MISMATCH,
DUPLICATE_PF_MEMBERS, NOMINAL_BASE_MISMATCH, RESULT_CONFLICT and METHOD_MISMATCH
are independently checked; none occur in these three MAX source audits.
MIN versus the supplied PF MAX table is always METHOD_MISMATCH. Only exact
membership/profile proof can unlock exploratory Ikss/Skss differences.
The minimum exporter request is in MISSING_PF_SOURCE_REQUEST.md.

For all 393/391 missing native machine reactances, xdss/xds/xd are empty,
xdsss/xstr are 99999 sentinels, xdsat is 1, isat is 0 and model_inp is cls.
Recorded rstr=0 does not supply the missing reactance. No native replacement
was proved. Explicit .01/.2 pu assumptions remain visibly assumed, as do
converter terminal basis/phase and external-grid c_source. Native and assumed
source counts are exported separately; unsupported active sources never become
zero contributions. MAX/MIN factor presets (1.1 / 1.0) are explicit approximation
settings, independently preserve user edits, and invalidate old results/maps.
Ip/Ib/Ith and unbalanced faults remain uncomputed.

Five worst LF identities per model were audited against native parameter fields,
LF options and station membership. No additional physically proven conversion
bug was found. Missing control/rating/post-case proof prevents certified parity;
the protected Full AC, DC and DGS importer code was not changed.

## Performance and validation

Measured CLI seconds (SN3 / SN4): legacy base 2.37 / 2.40; default-profile N-1
6.65 / 7.34; explicit initial batch 15.78 / 12.69; resume 11.77 / 10.15;
native SC10 1.48 / 1.46; approximate MAX3 1.01 / .89; approximate MIN3 1.18 / .98.
End-of-process RSS, including retained private import/audit data, is
1.42 / 1.57 GiB; this is not peak solver RAM.

One checkpoint microbenchmark on the same five real post-case payloads:
previous full structuredClone 115.50 ms and 33,855,000 bytes heap allocation;
bounded shallow snapshot .446 ms and 7,048 bytes heap allocation. Serialized
snapshot size falls from 19,013,962 to 9,500,857 bytes. This measures checkpoint
work only, not total application throughput. Full details are limited to two
cases in memory and loaded from IndexedDB on demand; checkpoint stages avoid
repeated deep copies of full maps. Default batch budget remains 10.

Eight short regression tests were added. Typecheck (one tool optional-field fix),
architecture lint, standard build and browser e2e passed. The full 329-test run
had one map-tooltip provenance regression; source provenance was restored and
the four related map tests passed. Ten related SC/critical regression tests also
passed after the duplicate-member guard extension. The existing map test also
checks BASE and signed CHANGE values. Typecheck and standard/portable builds
passed after native map lookup indexing. Final remote CI is read from the linked
branch run, including all 329 tests and the committed portable-byte gate.

Final portable SHA-256:
`4fa58fab6e323f9e03499780656a755a9e685c11cbc0a253162a9b9753f4ad41`.
The user's named older HTML was not located; the tracked starting artifact had
the specified older SHA `ebaddc5dca5a4e1d3bcbfcecd0af4c4bad2c8daa2607e54081673ec8b17a9a28`.
The committed HTML above is the new generated build, not an uploaded input copy.

Actual final portable Chrome 154.0.8037.99 acceptance passed with the exact SN3
ZIP pair in one model session and zero page errors. Measured seconds: two-ZIP
import 27.90, Full AC 16.73, catalog .55, default N-1 explained BLOCKED 4.49,
explicit station-off real non-bridge AC1 6.45, native SC10 4.60, approximate
400 kV SC1 3.43. Native SC10 reports BLOCKED with zero factor/RHS; approximate
SC1 reports CALCULATED_NETWORK_APPROXIMATION. BASE/POST/CHANGE/NEW_CONSTRAINTS
map controls and the current-case identity gate were exercised. MAX→MIN shows
1.0, clears stale results; returning to MAX restores the user's edited 1.07.
The secure localhost context supplies crypto.subtle; no claim is made about
unsupported file:// security contexts. Main-renderer heap snapshots are local
evidence and do not represent all worker/process RAM. The earlier headless
disabled-option selection timeout was a test selection-order error, excluded
from computation/performance measurements. The final artifact was retested
after map indexing; real screenshots and detailed statuses remain ignored.

## Remaining blockers (five)

1. Default droop control support is incomplete; explicit off is diagnostic and
   cannot establish PowerFactory control parity.
2. Native machine/converter/source corrections and IEC edition/KG/KT/KKW lack
   complete independently verified inputs.
3. PF electrical fault partitions omit auxiliary terminal membership; exact
   Ikss/Skss diagnostic coverage remains zero.
4. PF full per-case post bus/branch matrices, solved/AC-promoted states and
   rating/settings provenance are missing; full N-1 deltas are NOT_MEASURED.
5. LF worst-case control/Q/rating differences have no newly proven physical
   conversion fix; certified LF coverage remains zero.
