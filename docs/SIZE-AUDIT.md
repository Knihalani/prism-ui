# Component size audit

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
