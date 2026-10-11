# Map loading / lightning N1–SC acceptance — 2026-10-11

The requested UI fixes preserve the accepted LF engine and the complete `37eb511 → 5f336d4 → ac3ba119` application chain. Publication requires successful feature CI, fast-forward integration and a separate successful main CI. Exact publication SHA/run URLs are recorded in the closing response after those remote checks finish.

## Baseline and scope

| Item | Evidence |
| --- | --- |
| Starting main | `3e20615131f4c419dda80ee1df1a02c2bfcb313f` |
| Accepted starting feature | `ac3ba1195054cea92c259e3361e8f77ba4ea8749` |
| New feature | `fix/map-loading-lightning-n1-sc-main-20261011` |
| Runtime commits | `72abd1a6285240ae0e6efa7dec2dafc42b32cf74`, `4cbda1b5d39691eea8a8b328dda4742022d94d0f` |
| Baseline ancestry | main is an ancestor; starting feature is 9 ahead / 0 behind |
| Protected source guard | No new changes under `src/analysis`, `src/domain`, `src/workers`, `src/importers`, package/lock files or canonical export schemas |
| Rejected investigation commits | `18a2139`, `f6c79ba`, `9be1b81` are not ancestors of the new feature |

The latest user policy authorizes deletion of this new remote feature only after main ancestry and successful main CI are verified. Older application branches remain untouched. No private model, reference archive, FID results, cache, raw export or real-data screenshot is committed.

## Resulting behavior

- LF loading projects only `ElmLne`; transformer glyphs and their hit targets are absent in loading. Transformer P/Q glyphs, TM markers, routes, voltage filters and flow are retained.
- Compact and full LF tables have a separate **Yük %** column before **Durum**, accessible as **Yüklenme (%) sırala**. Loading uses the same `mapLoadingValues` snapshot/capacity revision/season basis as the map. Status contains service/scenario state only.
- Line loading uses validated current limits and maximum trustworthy endpoint loading. Transformer loading uses maximum endpoint apparent power divided by validated rated MVA. Canonical `branch.loading`, signs and exports remain unchanged. Unknown/nonfinite values render `—`; zero remains zero.
- Sorting precedes pagination on the filtered rows. The first click is descending, the second ascending, missing values remain last in both directions, ties use name/id, and line/transformer switching retains loading sort.
- Both loading color paths share the effective green/custom palette, including threshold boundaries and the greater-than-100 band. Scenario service colors retain priority.
- N1/SC catalogs are independent of numerical projections. Known resultless cases/faults remain visible with status and null cells. Selected catalog count, total catalog (hover title), numeric result count and filtered row count are distinct.
- N1 shows genuine PRE/POST/CHANGE when recorded and gated. DC supplies P/estimated loading only; it does not acquire Q/U/current/AC thermal claims. PF extrema do not become a full post matrix. No case/base borrowing or worker request occurs during UI selection.
- Native SC BLOCKED values stay null even if a malformed blocked record contains numbers. PF cells require the native physical terminal/nominal and 3PH reference gate; GA is never substituted. NETWORK_APPROXIMATION remains distinct from IEC parity; Ip/Ib/Ith remain unsupported/null.
- Panel warnings use one brief closed **Gerekçeyi göster** disclosure. The table has its own scroll region, sticky header and reachable pager. The panel remains at most 640 px. Tabs, scenarios, minimize, close/ESC/outside, shared identity and existing actions remain available.
- A/B prefixes occur exactly once. Long noncritical endpoint names are ellipsized with full `title`/`aria-label`; numeric columns and footer remain visible in the 340×205 tooltip budget.

## Local checks

| Gate | Final result |
| --- | --- |
| Targeted unit/regression | 28 pass / 0 fail / 0 skip |
| Full unit/regression | **380 pass / 0 fail / 0 skip**, including 8 new tests (baseline 372) |
| Typecheck / architecture lint | PASS / PASS (261 source files) |
| Standard and portable builds | PASS |
| Existing application Chromium smoke | PASS, extended loading sort, panel geometry, long tooltip and desktop checks |
| Existing PF benchmark source smoke | PASS |
| PF benchmark portable smoke | PASS; offline external requests blocked by the existing harness |
| Raw portable/HEAD blob and LF-normalized rebuild | PASS; CRLF count 0 |
| `git diff --check` | PASS |

An initial full browser invocation timed out after a Vite page reload while the portable checker created its temporary source tree. The failed browser check was rerun sequentially and passed; no assertion, threshold or timeout was relaxed. Two earlier targeted test failures were corrected: immutable fixture replacement for reverse flow, and duplicate equipment/TM rows in the N1 P table. Typecheck findings were fixed without weakening types. The selected-vs-total catalog counter was then corrected and relevant checks repeated.

### Anonymous desktop evidence

| Viewport | Map height | N1/SC table viewport | Screenshot |
| --- | ---: | ---: | --- |
| 1920×1080 | 835.77 px | 449.44 px | [LF](screenshots/map-loading-20261011/1920.png) |
| 1600×900 | 655.77 px | 269.44 px | [LF](screenshots/map-loading-20261011/1600.png) |
| 1440×900 | 655.77 px | 269.44 px | [LF](screenshots/map-loading-20261011/1440.png) |
| 1366×768 | 523.77 px | **137.44 px** | [LF](screenshots/map-loading-20261011/1366.png), [N1](screenshots/map-loading-20261011/N1-1366.png), [SC](screenshots/map-loading-20261011/SC-1366.png) |

Two toolbar rows remain 34 px; panel header/tabs remain 34/36 px. The smallest table leaves room for its header and three ordinary rows. Opening reasons retains a scrollable table and reachable pager. No document overflow. The public SC screenshot deliberately shows NOT_RUN because that fixture has no native SC snapshot; real BLOCKED acceptance is recorded separately below. Long endpoint labels of 80/40 characters preserve ten numeric cells, the second row and footer, with full names accessible.

## Genuine cached SN3/SN4 acceptance

Both models use the current accepted B0 LF and correctly paired PF/ControlContext caches. Each replay validates model/scenario identity; no model is reimported and no LF/N1/SC solve is requested. Private cache and screenshot evidence remains ignored locally.

| Check | SN3 | SN4 |
| --- | --- | --- |
| New imports / LF / N1 / SC solves | **0 / 0 / 0 / 0** | **0 / 0 / 0 / 0** |
| LF vector digest | `e9cf552fdd356c0fb29464897c193d647537774155c2d094ccdece917b4e6f60` | `6328d6ae3a92cfbada116afca1ff9f3396ab4ca1789c45a717679d9313fd59e9` |
| Vector regression | None; digest unchanged | None; digest unchanged |
| Fresh U / angle switch | 169.5 / 40.8 ms | 174.5 / 51.5 ms |
| Warm U / angle switch | 39.4 / 36.3 ms | 63.2 / 38.6 ms |
| Known / unknown loading records | 5131 / 9 | 5132 / 9 |
| Recorded N1 metadata | ISLAND_UNSUPPLIED, AC POST: NOT_RUN; one visible row, zero numeric results | Same |
| Recorded native SC | BLOCKED; one selected fault row, zero numeric results | Same |
| Four desktop table/scroll checks | PASS | PASS |
| All eight LF modes / loading transformer marks | PASS / 0 | PASS / 0 |
| Loading table vs validated max | Exact numeric equality for visible line and transformer rows | Same |
| Unrequested worker calculations / maximum RAF | 0 / 1 | 0 / 1 |
| Browser page/console errors | 0 | 0 |

These are measurements from this task, not the previous 138/51 ms evidence. Fresh/warm entries are individual observations, not percentile estimates.

The real N1 cache's native status is **ISLAND_UNSUPPLIED**, not renamed to ISLANDING. Its own recorded settings differ from the accepted B0 LF settings: the N1 metadata replay uses its exact original settings, and restores LF settings before LF checks. It has no numerical POST snapshot, so base LF numbers are never borrowed. The DC ISLANDING contract is additionally covered by the new public unit test. Stale manual/hybrid metadata is excluded under mismatched settings.

SN3 PF diagnostic acceptance: **56 LF scorecard rows deep-equal** the prior accepted evidence; the 42 populated rows also match the immediately preceding replay. Reference status remains EXPLORATORY_ONLY and method parity remains unverified. SN4 uses its own paired references and is not assigned SN3 scores. No new similarity percentage is produced.

## Portable and publication gates

Final runtime portable: `dist-portable/GridAnalyzer_v7.html`, **1,613,941 bytes**, raw SHA-256 **`a204cfec07eb8bebd4eedf684b4041de70661c83a14fb25f55c1b287cc821dc4`**. Fresh build, committed raw blob and LF-normalized-source rebuild match byte-for-byte.

After this acceptance report is committed: push the feature, require completed/success CI for that exact HEAD, refetch main and verify the accepted ancestry. Use only `pull --ff-only`, `merge --ff-only` and normal push. Require a separate successful main CI at the identical full SHA, recheck portable bytes and remote main, then delete only the new remote feature and verify the remaining remote branches. No force, reset, squash, rebase, cherry-pick or investigation integration.

Known limits remain visible: unsupported/resultless N1 AC cases and native SC BLOCKED/IEC assumptions. No new unresolved P2 is identified in this UI scope; engine/method parity is not claimed.
