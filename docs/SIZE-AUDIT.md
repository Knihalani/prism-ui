# Component size audit

## PR #47 CI merge-build checkpoint

GitHub Actions checked out merge commit `20c7a3f`, combining branch `31de9eb`
with main `953ae94`, rather than building the standalone branch measured below.
Local reproduction of that exact merge with Bun 1.4.4 matches CI. This is a
source-integration difference, not a Bun-version or nondeterministic size issue.

| Own JS gzip, bytes | Standalone branch | Main | PR merge build |
|---|---:|---:|---:|
| React | 22301 | 23297 | 23367 |
| Chart | 9604 | 9671 | 9667 |
| DataTable | 8502 | 8554 | 8536 |
| Shared | 24923 | 25011 | 25011 |

Only React exceeds its inherited 23,331B cap: main has 34B of headroom and the
PR's retained-snapshot work adds 70B to the merged runtime. The React source
diff against main is confined to `skeleton.tsx`. Rebase only that JS cap to
**24,536B = ceil(23,367 × 1.05)**. CSS and every other cap remain unchanged.
This budget-only CI fix does not alter runtime behavior or test timeouts.
The original CI run passed TypeScript and all tests (**1,342 pass, 2 skip,
0 fail**) before failing `react js: 23367 > 23331B` in the size step.

## Synchronous Chart/DataTable follow-up

Fresh comparison: `origin/main` **953ae94**, versus this follow-up after
**bbfe7e8**. Bun **1.4.4**, minified browser ESM, gzip-9, identical external
boundaries. These are the current tables; older checkpoints below are historical.
All values are bytes. Full component cost is own plus the **entire** shared
entry, not a recompressed standalone bundle. Runtime entries do not add shared.

**The 4KiB goal remains unmet, and the retained savings are marginal.**
No Chart/DataTable code is deferred: initial = total, deferred = 0.
The size script still charges every lazy chunk, including Artifact's 36,123B.

| Entry | Own JS main → branch | Full JS main → branch | Own CSS main → branch | Full CSS main → branch | Branch initial / deferred JS |
|---|---:|---:|---:|---:|---:|
| callout | 1210 → 1201 | 26221 → 26124 | 1092 → 1092 | 11719 → 11257 | 1201 / 0 |
| card | 2191 → 2166 | 27202 → 27089 | 1487 → 1487 | 12114 → 11652 | 2166 / 0 |
| grid | 917 → 917 | 25928 → 25840 | 1080 → 1080 | 11707 → 11245 | 917 / 0 |
| badge | 755 → 755 | 25766 → 25678 | 830 → 830 | 11457 → 10995 | 755 / 0 |
| tabs | 2929 → 2929 | 27940 → 27852 | 1577 → 1577 | 12204 → 11742 | 2929 / 0 |
| table | 4327 → 4321 | 29338 → 29244 | 1844 → 1844 | 12471 → 12009 | 4321 / 0 |
| summary | 3755 → 3755 | 28766 → 28678 | 2727 → 2700 | 13354 → 12865 | 3755 / 0 |
| num | 4510 → 4376 | 29521 → 29299 | 1482 → 1482 | 12109 → 11647 | 4376 / 0 |
| estimate | 3556 → 3543 | 28567 → 28466 | 1432 → 1432 | 12059 → 11597 | 3543 / 0 |
| pick | 5180 → 5174 | 30191 → 30097 | 2399 → 2399 | 13026 → 12564 | 5174 / 0 |
| runbook | 3713 → 3697 | 28724 → 28620 | 2300 → 2300 | 12927 → 12465 | 3697 / 0 |
| troubleshoot | 4296 → 4295 | 29307 → 29218 | 2208 → 2208 | 12835 → 12373 | 4295 / 0 |
| ask | 6414 → 6425 | 31425 → 31348 | 2486 → 2486 | 13113 → 12651 | 6425 / 0 |
| codeblock | 3673 → 3675 | 28684 → 28598 | 2572 → 2572 | 13199 → 12737 | 3675 / 0 |
| datatable | 8554 → 8502 | 33565 → 33425 | 3309 → 3309 | 13936 → 13474 | 8502 / 0 |
| chart | 9671 → 9604 | 34682 → 34527 | 2328 → 2328 | 12955 → 12493 | 9604 / 0 |
| artifact | 50530 → 49950 | 75541 → 74873 | 6762 → 6762 | 17389 → 16927 | 13827 / 36123 |
| mockup | 42043 → 41503 | 67054 → 66426 | 4874 → 4874 | 15501 → 15039 | 41503 / 0 |
| view | 18311 → 18102 | 43322 → 43025 | 5249 → 5231 | 15876 → 15396 | 18102 / 0 |
| shared | 25011 → 24923 | 25011 → 24923 | 10627 → 10165 | 10627 → 10165 | 24923 / 0 |
| react | 23297 → 22301 | 23297 → 22301 | 2827 → 2827 | 2827 → 2827 | 22301 / 0 |
| core | 11694 → 11694 | 11694 → 11694 | 0 → 0 | 0 → 0 | 11694 / 0 |
| state | 3440 → 3440 | 3440 → 3440 | 0 → 0 | 0 → 0 | 3440 / 0 |
| schema | 1825 → 1825 | 1825 → 1825 | 0 → 0 | 0 → 0 | 1825 / 0 |

### Retained eager changes, measured against the starting branch

Each row is a measured candidate/change set, not estimated source bytes.

| Change | Own JS before → after | Full JS before → after |
|---|---:|---:|
| Chart hook cleanup: normalize rows once, reuse computed bar endpoints, compact palette construction | 9609 → 9604 | 34532 → 34527 |
| DataTable compact part-name literals, preserving the exact readonly tuple and public union type | 8518 → 8502 | 33441 → 33425 |
| Shared, unchanged | 24923 → 24923 | 24923 → 24923 |

Shared + Chart + DataTable: **43,050 → 43,029B (−21B)**. Nothing was moved
into shared. Row-focus/selection hoisting (+11B), a column-attribute helper
(+5B), and shared DataTable enum arrays (+9B) were measured and dropped.
Chart context indirection and its negligible own-byte saving were not retained:
adding React subscriptions solely to move a few bytes was not justified.

### Why the synchronous implementations remain above 4KiB

- **Chart:** SVG geometry and the accessible data table are first-paint content.
  Annotations can select an initial point; persisted pivot/hidden-series state
  changes the initial plot. Hover/tooltip, keyboard selection, legend and pivot
  responses must work immediately, including on a cold network. There is no
  existing asynchronous step after which those features can safely be loaded.
- **DataTable:** column inference/formatting, persisted sort/filter/page/selection
  state, controls and accessibility structure affect first paint. Sorting,
  filtering, row navigation, selection and pagination must respond synchronously.
  This implementation has no editing, CSV/export or column-resize engine to defer.

Those requirements rule out the proposed lazy splits. This pass did not find
eager reductions sufficient to bridge the remaining 5.5KiB/4.3KiB gaps; this is
not a proof that no larger behavior-preserving redesign could compress further.
Mount/hover/focus preloading does not guarantee a loaded chunk at first input.
Budgets are honest measured total JS plus 5%, rounded up: **Chart 10,085B**,
**DataTable 8,928B**. With zero deferred bytes these also cap initial JS.
CSS budgets remain 4,096B each.

### Own-entry contributors before this change

Metafile `bytesInOutput` (minified, uncompressed), not additive gzip attribution:

| Chart source | Bytes | DataTable source | Bytes |
|---|---:|---|---:|
| `chart/index.tsx` | 13683 | `datatable/use-datatable.ts` | 14415 |
| `chart/use-chart.ts` | 11817 | `datatable/index.tsx` | 10764 |
| `chart/stream-props.ts` | 1247 | | |
| `chart/use-domain.ts` | 981 | | |

### Browser and scaling proof

The same host-themed playground fixture was rendered before/after, with reduced
motion and fixed viewport. Chart: static, partial stream, hover tooltip, then
keyboard-selected/pivoted/legend-toggled. DataTable: static, partial stream,
hover, then keyboard-sorted/navigated/selected. All eight final RGBA comparisons
are **0 changed pixels**. The first Chart static capture differed by four pixels
(0.00131%) on line edges; two consecutive same-code recaptures both match the
original baseline exactly, without any source change. The matching repeat is
the final static proof, not a modified baseline.

Screenshots: `~/shots/perf/sizes-{chart,datatable}-{state}-{before,after,diff}.png`.
Final Chart static: `sizes-chart-static-repeat-after.png` and
`sizes-chart-static-repeat2-after.png`; all other pairs use `*-after.png`.
Keyboard checks: Chart select/pivot/legend and DataTable sort/row navigation/
selection all true; no page errors. Chart selection/pivot payloads match.

Core scaling retains all five corpora, four-character pushes with a root read
after every push, the 5,000/10,000 sizes, **2.6x limit** and 30s test timeout.
After three warmup pairs it takes five windows of seven samples of each size,
alternating small/large order, and asserts the median of the five min-time
ratios. Minima still suppress GC/scheduling outliers, as the original test did;
the median prevents one unusually fast/slow endpoint window deciding CI.
Mean-time batching was rejected after GC-sensitive false positives.

Isolated normal ratios: **2.12, 2.06, 2.06, 2.01, 2.04x** (pass).
A temporary copy ran the same parser plus nested work proportional to
`text.length²`, on the first corpus with the exact same guard/statistics:
**13.19 → 48.23ms; 3.64x > 2.6**, expected failure (exit 1).
The injection is not committed. Default full-suite scaling also passes:
**2.06, 2.01, 2.00, 2.00, 2.14x**.

Checks: targeted component/domain/presentation tests **60 pass, 0 fail**;
TypeScript exit 0; size exit 0, all budgets passed. Default-timeout full
`bun test`: **1,303 pass, 2 skip, 2 fail** (170.61s). The failures are the
known Mockup conditional fixtures (**7,049.71ms**) and Chart malformed-prefix
replay (**5,091.62ms**) exceeding 5s. No timeouts or test coverage were relaxed.
See the performance audit for comparison/limitations.

Same-machine isolated main → branch: Mockup **6,033.92 → 5,993.07ms** (both
timeout), Chart malformed replay **4,460.47 → 4,747.55ms** (both pass).
This single pair does not establish a branch-specific slowdown. Main CI's
available log failed scaling only. No full-suite green result is claimed.

Raw measurements, metafiles, proof harness, pixel counts, quadratic simulation
and check logs: `~/conformance/perf-audit/size-followup/`.

## Upstream integration checkpoint

The original table below records audit checkpoint `5f60b2e`, before merging
`origin/main` at `a9ad258` (reply motion, feedback polish, visual QA and mobile
support). It is historical evidence, not the current merged tree's sizes.
The merged tree retains lazy feedback and zero fixture bytes in both root and
subpath consumers. The size script now avoids counting a companion stylesheet
again when it is already included by the JS graph; a regression test covers
both imported and separately supplied CSS.

Six original caps were exceeded after integration. The same caps were exceeded
by unmodified `a9ad258`, measured with the same script and Bun version:

| Entry / metric, gzip bytes | Original cap | Upstream main | Merged tree | Updated cap |
|---|---:|---:|---:|---:|
| Artifact JS, all chunks | 42413 | 54439 | 49950 | 52448 |
| Artifact CSS | 5130 | 6696 | 6762 | 7101 |
| Mockup JS | 33950 | 41465 | 41503 | 43579 |
| Mockup CSS | 4096 | 4874 | 4874 | 5118 |
| Shared CSS | 9400 | 10165 | 10165 | 10674 |
| React JS | 20050 | 21621 | 22220 | 23331 |

After review, only those six caps are rebased to the measured merged-tree size
plus 5% (rounded up). All other caps and the 4KiB defaults remain unchanged.
CI runs type checking and tests before size; test/size steps still execute if an
earlier check fails, unless the workflow is cancelled.
Artifact is 13,827B initial plus
36,123B deferred, with no duplicate JS modules in the chunk metafile. Its merged
full JS is 74,873B versus upstream's 79,431B. The additional React snapshot
logic remains charged to the runtime. Measurements, source-isolated upstream
comparison and test logs are in `~/conformance/perf-audit/ci-{main,merge}-*`.

CodeBlock's token-colour stylesheet is attributed to CodeBlock's own CSS, not
discarded at the shared boundary: its own CSS grows from 2,345B to the honest
2,572B, still below the unchanged 4,096B CSS cap. The shared JS entry still owns the eager
highlighter/grammar code. A regression test compares CodeBlock's reported CSS
with the complete compiled stylesheet (including `.prism-tok-keyword`) and
verifies that a one-byte CSS budget overrun fails.

## Original audit checkpoint

Baseline: `ba8a0ae` (before Step B); after: Step D on the perf-audit branch.
Bun 1.4.4, minified browser ESM, gzip level 9. See [accounting](../scripts/README.md).
All numbers are bytes. Full component JS is **own + the entire shared entry**,
not a standalone consumer bundle. Runtime rows do not add shared.

**Remaining limitations:** Chart/DataTable net trimming is only 68B, not a
meaningful reduction of their own code. Public fixture compatibility is preserved;
root and subpath component consumers now retain zero fixture bytes.

| Entry | Own JS before → after | Full JS before → after | Own CSS before → after |
|---|---:|---:|---:|
| callout | 1201 → 1201 | 26160 → 26092 | 1092 → 1092 |
| card | 2166 → 2166 | 27125 → 27057 | 1487 → 1487 |
| grid | 917 → 917 | 25876 → 25808 | 1080 → 1080 |
| badge | 755 → 755 | 25714 → 25646 | 830 → 830 |
| tabs | 2929 → 2929 | 27888 → 27820 | 1577 → 1577 |
| table | 4321 → 4321 | 29280 → 29212 | 1844 → 1844 |
| summary | 3755 → 3755 | 28714 → 28646 | 2700 → 2700 |
| num | 4172 → 4172 | 29131 → 29063 | 1416 → 1416 |
| estimate | 3504 → 3504 | 28463 → 28395 | 1432 → 1432 |
| pick | 5138 → 5138 | 30097 → 30029 | 2399 → 2399 |
| runbook | 3697 → 3697 | 28656 → 28588 | 2300 → 2300 |
| troubleshoot | 4295 → 4295 | 29254 → 29186 | 2208 → 2208 |
| ask | 6425 → 6425 | 31384 → 31316 | 2486 → 2486 |
| codeblock | 3675 → 3675 | 28634 → 28566 | 2345 → 2345 |
| datatable | 8518 → 8518 | 33477 → 33409 | 3309 → 3309 |
| chart | 9609 → 9609 | 34568 → 34500 | 2307 → 2307 |
| artifact | 45049 → 40393 | 70008 → 65284 | 4882 → 4882 |
| mockup | 32287 → 32574 | 57246 → 57465 | 3324 → 3324 |
| view | 18126 → 18102 | 43085 → 42993 | 5231 → 5231 |
| shared | 24959 → 24891 | 24959 → 24891 | 8923 → 8923 |
| react | 19071 → 19684 | 19071 → 19684 | 2608 → 2608 |
| core | 11595 → 11595 | 11595 → 11595 | 0 → 0 |
| state | 3422 → 3422 | 3422 → 3422 | 0 → 0 |
| schema | 1825 → 1825 | 1825 → 1825 | 0 → 0 |

## Chart and DataTable: ownership extraction reverted

The geometry, column/row normalization and cell formatter extraction increased
consumer cost, so it is reverted. Small shared formatter-cache, date-tick and
pivot-write deduplications remain. Their output is covered by the existing tests.

- Shared + Chart + DataTable: **43,086 → 43,018B (−68B, −0.16%)**.
- Previous Step B result: 43,395B; rework removes 377B from that result.
- Full Chart: **34,568 → 34,500B**; full DataTable: **33,477 → 33,409B**.
- Own Chart/DataTable are unchanged from the pre-B baseline: 9,609 / 8,518B.
  The 4KiB goal and substantial named-component trims remain unmet.
- Higher caps retain approximately 5% headroom, with explicit feature reasons.
  No validation, schema documentation, slots, chart types or interactions were removed.

A shared JS/TS keyword-factory trial increased the all-grammar entry by 8B,
so it was reverted. Grammars remain eager and unchanged.

## Public View fixture compatibility

Before Step B, `src/view/index.ts` exported `viewGallery` and `viewFixtures`;
`src/index.ts` re-exported `./view`, and package.json exposed `./view`.
Both aliases were therefore public. They are restored in their original places,
and a test verifies identity with the explicit fixture exports.

The explicit `@prism-ui/components/view/fixtures` subpath remains available.
The gallery initializer is pure so a consumer importing only `View` from
`./view` includes **0 fixture module bytes** in Bun's metafile.

The root now re-exports fixture aliases directly from the fixture module and
lists the existing shared exports explicitly. Under the size script's external
shared boundary, the shared wildcard required a runtime namespace merge that
retained otherwise-unused root bindings. Explicit exports preserve the same API
without that merge. The root `View` consumer retains **0 fixture module bytes**
and no fixture payload, down from the rework's 8,593B (8,640B during the direct
fixture-export trial). Its gzip is **116,294B with or without fixture exports**;
the `./view` consumer is 15,215 / 15,213B, with zero fixture bytes in both cases.
`scripts/size.test.ts` enforces both paths. There is no forced API migration.

Step D's ancestor snapshot cache and inherited-property handling add **613B**
to the React runtime. Other own/full component and shared sizes are unchanged
from the B rework. See the performance audit for the complete ghost-style proof.

## Artifact: chunk accounting and unused graph removal

The previous full increase **70,008 → 74,253B (+4,245B)** comprised:

- **+2,150B shared**, mostly the ownership extraction, not Artifact code.
- **+2,095B own**, from the lazy bridge, chunk framing/layout and independent gzip.

Archived-input rebuilds give 47,145B own (1B above the published result because
chunk-name hashes affect gzip), versus 45,049B static. Independent gzip costs
about **1,140B** more than gzipping the same emitted chunk text concatenated.
The remaining approximately **956B** difference includes bridge/import/export
framing and changed minification/compression layout; it is not all loader code.
Raw emitted JS grows 130,639 → 131,820B in that comparison.

Metafiles show **zero modules emitted into multiple JS chunks**, both before and
after rework. There was no cross-chunk module duplication to remove. Instead,
feedback's import from `mockup/mockup.tsx` retained unrelated renderer UI.
Annotations/comments now live in `mockup/annotations.tsx`, with public re-exports
preserved. Feedback imports that narrow module. The loader is feedback-specific,
not charged to every shared-runtime consumer.

Module evidence in the deferred graph (minified bytes, not gzip):

| Module | Previous → rework |
|---|---:|
| mockup/mockup.tsx | 15948 → 0 |
| mockup/group.tsx | 8391 → 0 |
| mockup/chrome.tsx | 4970 → 2443 |
| mockup/annotations.tsx | 0 → 5738 |
| mockup/engine/wireframe.ts | 20899 → 18714 |

Part of chrome/footer remains needed by the feedback toolbar; it was not entirely removed.
The complete deferred chunk falls **76,897 → 53,488 raw bytes**.
Final own chunks are **13,680 + 7,581 + 19,132 = 40,393B gzip**:
initial **13,680B**, deferred **26,713B**, full **65,284B**.
All chunks remain budgeted. Final independent-gzip fragmentation is 1,204B;
the concatenated-text compression diagnostic is 39,189B. It is not runnable JS.

Feedback preload, pending-first-activation, failure/retry, keyboard, Escape,
reopen and draft retention tests remain in place. The extraction changes no
annotation behavior; cold loading still uses the prior Step B pending bridge.

## Eager highlighter grammars

No grammar loading or highlighting behavior changed. Independent bundles
include imported helpers and are **not additive**. The all-grammar entry is
**7,696B** and is charged once to shared, not hidden from budgets.

| Grammar/module | JS gzip |
|---|---:|
| all | 7696 |
| bash | 1382 |
| c-like | 2355 |
| css | 1143 |
| diff | 220 |
| go | 2633 |
| html | 3724 |
| js | 2696 |
| json | 1011 |
| jsx | 2565 |
| python | 1745 |
| rust | 2580 |
| shared | 799 |
| sql | 1790 |
| ts | 2806 |
| tsx | 2687 |
| yaml | 1199 |


## Verification and evidence

- `bun run size --json --fixtures --chunks`: exit 0, no violations.
- `bunx tsc --noEmit`: exit 0.
- `bun test`: **1,101 pass, 1 skip, 0 fail**, 1,102 tests / 123 files, 69.17s.
  The skip is the absent real live-model recording. The first final run flaked
  `packages/core/test/scaling.test.ts` (`four-character streaming scales linearly
  for long open blocks`, ratio 3.242386206513411 > 2.6); the retry passed without
  source or test changes. An earlier B rework run also observed ratio 2.889.
- Playground production build: **built in 3.36s**, exit 0. Existing >500kB
  chunk warning remains. Dedicated production replay build also passed.
- Captured and inspected DataTable, Chart, Artifact and Artifact feedback;
  exact RGBA differences against the original screenshots are **0% for all four**.
  Escape/reopen retains the feedback draft; 0 page errors.
- Mid-exit old/new ghost screenshots have **0%** pixel difference; see
  `~/shots/perf/skeleton-mid-{old,new,diff}.png` and PERFORMANCE-AUDIT.md.
- No remote CI or live-provider calls were made during these local checks.

Screenshots: `~/shots/perf/{datatable,chart,artifact,artifact-feedback}-{before,after}.png`.
Raw sizes/metafiles, logs and helpers: `~/conformance/perf-audit/step-c/`.
Final Step D sizes, proof and check logs: `~/conformance/perf-audit/step-d/`.
See [production performance evidence](PERFORMANCE-AUDIT.md) for the benchmark
and Chrome results, including the unresolved long-task target.
