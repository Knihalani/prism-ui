# Production streaming audit

## Latest bounded-round trace checkpoint

The size follow-up preserves the final **bbfe7e8** trace table below; it does not
claim a fresh performance measurement for the subsequent micro-trims.
Production host-shell/theme, fixed 16-character chunks through settle, all
artifact renderer main threads included. Counts remain noisy; zero tasks was
not reached.

| Run | Previous tasks >50ms | Previous maximum | Final tasks >50ms | Final maximum |
|---|---:|---:|---:|---:|
| 1 | 4 | 76.331ms | 3 | 64.523ms |
| 2 | 3 | 77.161ms | 1 | 56.256ms |
| 3 | 3 | 76.693ms | 6 | 60.876ms |

Artifact renderer threads have zero long tasks. The detailed per-task capture,
restoration, geometry and render stacks, synchronous-ordering constraints and
zero-difference ghost proof remain in the final bounded-round section below.
The residuals have not been established to be irreducible.

The size follow-up keeps Chart/DataTable first paint, persisted-state rendering
and every first interaction synchronous. No new asynchronous loading boundary
was introduced. Fresh size tables and visual/keyboard/scaling evidence are in
[SIZE-AUDIT.md](SIZE-AUDIT.md#synchronous-chartdatatable-follow-up).
The scaling test now retains the 2.6x guard but uses warmups and a median of five
interleaved min-of-seven windows; injected quadratic work is rejected at 3.64x.

Default-timeout full-suite check: **1,303 pass, 2 skip, 2 fail** (170.61s).
Scaling passes all five corpora. Existing Mockup conditional-fixtures and Chart
malformed-prefix tests exceed 5s (7,049.71/5,091.62ms). Their test files are
unchanged versus main. The earlier baseline failures and their animation-disabled
gates are documented below; source snapshot/restore work is not reached by those
tests. No timeout or test case was removed or increased.

Same-machine isolated comparison (main 953ae94 → branch): Mockup conditional
fixtures **6,033.92 → 5,993.07ms**, both timeout; Chart malformed-prefix replay
**4,460.47 → 4,747.55ms**, both pass. Imports in the main test resolve to the
main worktree's React package. A single pair is not a statistical slowdown
measurement; no branch-specific regression was established. Main CI's available
log failed only scaling, not these two tests. The two local default-suite
timeout failures remain unresolved rather than hidden by a longer timeout.

## Historical integration checkpoint

This records historical audit checkpoint `5f60b2e`, before integration of
`origin/main` at `a9ad258`. Benchmarks, traces and screenshot comparisons have
not been repeated after that integration and do not describe the merged head.
The merge retains the branch's ancestor cache, inherited-value snapshots and
per-property copying rather than the previously rejected cssText trial, while
preserving upstream capture gating and mobile/feedback behavior. Post-merge
size verification and its pending budget decision are in SIZE-AUDIT.md.

Comparison: main `a2ebe6c` versus the perf-audit branch after Step D.
Bun 1.4.4, React 19.3.1; same machine. No live-provider requests.
Sizes and remaining bundle limitations are in [SIZE-AUDIT.md](SIZE-AUDIT.md).
Core and React tables retain the five-round Step C data: Step D changes the
browser snapshot path bypassed by happy-dom's zero-size rectangles, and root
export wiring, not the parser or the benchmark's rendered content. The Chrome
table is the final, uninstrumented main/branch capture pair after Step D.

**The Chrome 50ms target is not met.** Cold happy-dom warmup outliers also
remain unattributed. The steady measured production React updates are below
50ms; that is not a claim that every cold update is below 50ms.

## Core: five interleaved rounds, seven samples each

Four-character chunks, approximately 200KB corpora, three warmups before each
seven-sample run. A/B order alternates each round. Table values are medians of
the five run medians, milliseconds.

| Corpus | Main | Branch |
|---|---:|---:|
| Mixed | 60.315 | 58.705 |
| Paragraph | 3.790 | 4.067 |
| JSON | 18.381 | 16.441 |

These are observed timings, not causal speedup claims. Paragraph/JSON do not
exercise the table-row optimization. The earlier approximately 37ms result
still has no verified revision/environment match; see the Step A investigation.

## React: production, five interleaved fresh-process runs per side

`NODE_ENV=production`; happy-dom, Prism, playground plugins, ArtifactProvider
and fresh stores. Kitchen source: **17,549B**, **69 updates**, 256-character
chunks. Each process performs one warmup replay and one measured replay.
Timings below exclude the warmup. Chunk percentiles pool 345 updates per side;
total p95/max uses only five process samples and is therefore noisy.

| Metric, ms | Main | Branch |
|---|---:|---:|
| Synchronous total, median | 246.274 | 247.383 |
| Synchronous total, p95/max | 269.424 | 288.165 |
| Chunk p50 | 2.752 | 2.915 |
| Chunk p95 | 8.178 | 8.276 |
| Chunk max | 19.812 | 20.419 |
| Async wall total, median | 363.305 | 368.177 |
| Measured synchronous updates >50ms | 0 | 0 |

The median synchronous total differs by 0.45%, not an established regression.
happy-dom has no browser layout/paint or sandbox execution. In particular,
zero-size rectangles bypass browser skeleton-exit snapshots.

### Cold outliers: unresolved

Warmups contain main outliers **68.015ms at 256 characters** (first Markdown
mount) and **53.799ms at 1,024** (first code fence), and a branch outlier
**65.015ms at 6,656** (Runbook/Troubleshooter boundary). These are not hidden
in the measured table. A separate production CPU-profile diagnostic did not
reproduce >50ms: its maximum was **43.057ms**, at the first code fence.
The exact cause of the unprofiled cold outliers is **unverified**; no claim of
GC, JIT or a fixed regression is made. This part needs a reproducing cold trace.

## Chrome: full host-shell stream, including artifact renderers

Production Vite preview; Chat shell, host theme, light mode, 1280×1000,
normal motion. `apps/playground/perf.html` and `scripts/perf-entry.tsx` inject
a deterministic agent: **16 characters per animation frame**, including partial
fences. Capture begins before Send and is analyzed from `perf-send` through
done, visible artifact loading and five seconds of settle (`perf-settle`).

Both runs have nine page frames, five ready artifact shells, no page errors
or failed requests. Browser-wide CDP tracing includes `toplevel`, timeline,
user timing and V8 CPU profile samples. Analysis counts overlapping top-level
`RunTask` events on **every `CrRendererMain` thread**, not just the host PID;
workers are not renderer main threads. Eight renderer main threads were
observed in each capture, including unrelated idle renderers.

Chrome here omits OOPIF children from the page's `Page.getFrameTree` and emits
empty `TracingStartedInBrowser.args`. Filtering only the host frame tree would
miss artifact renderers. The final audit queries frame CDP sessions separately,
and task analysis deliberately includes all renderer main threads.

| Trace metric | Main | Branch |
|---|---:|---:|
| Send-through-settle interval, ms | 34829.442 | 33738.341 |
| Renderer main tasks >50ms | 18 | 11 |
| Largest task, ms | 152.914 | 111.147 |
| Largest non-host renderer task, ms | 20.352 | 12.257 |

All long tasks are in the host renderer. The in-page Long Tasks observer,
filtered to the same marks, reports **17 / 11**. The trace-based task count is
authoritative here and includes a borderline **50.026ms** main task.
One capture per revision is not evidence of an established speedup.

### Verified remaining cause

The sampled stack in the worst task, source-mapped on both revisions, is:

`React commitDeletionEffectsOnFiber → commitHookEffectListUnmount →
SkeletonPart cleanup → capture → copy →
CSSStyleDeclaration.setProperty`.

`PrismPart` installs SkeletonPart for raw skeleton parts. Cleanup captures
the subtree plus ancestors to the presentation root, freezing every computed
CSS declaration onto clones before React removes the originals. The stack
proves that capture's animation, scope, duration and nonzero-rectangle gates
are passed in this scenario. This is not inferred from merely possible code.

In the worst main task, native `setProperty` accounts for **99.041ms** and
`getPropertyValue` **27.160ms** of sampled time. In the worst branch task,
they account for **55.739 / 15.695ms**. These are sampling estimates, not exact
wall-time attribution. The remaining branch task durations, milliseconds, are:
**111.147, 103.776, 95.781, 85.112, 85.068, 78.129, 71.720, 60.978, 59.101,
57.702, 57.198**. All are on the host renderer. Full stacks and task offsets
are retained in the trace summaries and final thread-proof log.

### Shipped snapshot changes and equivalence proof

- Reuse each ancestor's shallow snapshot and rect within a flush; clone its
  template for each chain, retaining the existing exit-merge structure. Clear
  the cache after every flush.
- Omit a static set of inherited declarations only when equal to the parent's
  computed value and not explicitly styled inline. Restore omitted values on
  the actual exit root, so it does not depend on the live parent's later styles.
  Custom properties are still copied conservatively, not omitted. No CSS
  `@property` or `CSS.registerProperty` registrations were found in packages.
- Offscreen/clipping skips were dropped when their independent-run visual
  proof could not be completed quickly. The final implementation captures the
  same ghosts as before. cssText assignment regressed instrumented write time
  and was reverted. Nested-capture elision is also not shipped.

The final temporary browser harness runs the original and optimized capture
against the **same live DOM before each React removal**, avoiding independent
run differences from async component loading, scrolling and focus transitions.
Both flush implementations attach their ghosts; every computed property is
recorded while attached. Stable source paths and stream chunk indices pair
**43 ghosts per implementation, all 107 elements, 59,774 property values**:
**0 unmatched elements, 0 computed-style differences**. The replay completes
all 1,087 chunks with no page errors.

At chunk 88, exit transitions are paused at 80ms. Counterpart ghosts are masked
in turn with a temporary clip-path, leaving the same live body underneath.
Unrelated animations are settled, skeleton shimmer is paused, and the composer
blur transition is finished before both screenshots. Exact pixel diff:
**0 / 1,280,000 pixels (0%)**. An earlier independent-run comparison was nonzero
and was not accepted as proof; its composer-focus/timing mismatch is avoided
by this same-DOM comparison. Instrumentation and masking are not shipped.

Screenshots: `~/shots/perf/skeleton-mid-{old,new,diff,diff-visible}.png`.
Proof: `~/conformance/perf-audit/step-d/{proof-dual,comparison-dual}.json`,
`proof-dual-screenshot.json`, `dual.mjs`, `proof.config.ts`.

The 0-long-task target remains unfinished; further optimization was explicitly
out of scope for this final step. No visual compromise is claimed or required.

### Temporary instrumentation (exploratory, not shipped)

Instrumentation counts captures and clone subtree elements (including shallow
ancestor templates/clones), declarations written, and time in computed-style
acquisition/access versus setProperty. Proxy/counter overhead makes these
timings unsuitable for comparison with the final uninstrumented trace.

Baseline long tasks, in chronological order:

| Task | Duration ms | Captures | Elements cloned | Declarations written | Style reads ms | Style writes ms |
|---|---:|---:|---:|---:|---:|---:|
| 1 | 127.236 | 3 | 21 | 11724 | 22.2 | 69.5 |
| 2 | 116.524 | 3 | 21 | 11724 | 21.5 | 66.1 |
| 3 | 121.871 | 3 | 21 | 11724 | 23.8 | 68.8 |
| 4 | 215.868 | 4 | 31 | 17309 | 39.4 | 118.6 |
| 5 | 188.589 | 4 | 31 | 17309 | 33.9 | 111.2 |
| 6 | 190.275 | 4 | 31 | 17309 | 35.0 | 111.3 |
| 7 | 66.219 | 4 | 10 | 5570 | 10.6 | 30.8 |
| 8 | 61.944 | 4 | 10 | 5570 | 10.3 | 32.7 |
| 9 | 53.052 | 1 | 7 | 3902 | 8.5 | 27.9 |
| 10 | 94.157 | 6 | 16 | 8912 | 15.2 | 49.8 |
| 11 | 81.852 | 1 | 7 | 3914 | 6.7 | 63.4 |
| 12 | 105.357 | 2 | 16 | 8944 | 16.9 | 54.0 |
| 13 | 97.703 | 2 | 16 | 8944 | 18.3 | 50.6 |
| 14 | 98.120 | 1 | 13 | 7257 | 16.9 | 51.9 |
| 15 | 134.130 | 3 | 24 | 13488 | 23.2 | 80.4 |
| 16 | 160.611 | 3 | 24 | 13488 | 32.2 | 91.2 |
| 17 | 151.756 | 3 | 24 | 13488 | 25.4 | 95.1 |
| 18 | 136.381 | 3 | 24 | 13488 | 24.5 | 84.2 |

The original ordered experiments measured:

| Instrumented trial | Long tasks | Max ms | Declarations written | Reads ms | Writes ms |
|---|---:|---:|---:|---:|---:|
| Baseline | 18 | 215.868 | 276132 | 545.8 | 1727.9 |
| Offscreen/clipping skips | 8 | 151.715 | 81151 | 174.9 | 508.9 |
| Plus ancestor cache | 8 | 145.936 | 54301 | 131.5 | 338.5 |
| Plus inherited omissions | 9 | 94.383 | 46856 | 145.9 | 335.4 |
| Plus cssText trial | 9 | 113.799 | 42001 | 136.0 | 467.0 |

These are single exploratory runs, not repeated performance evidence. All
post-baseline trials above included clipping; clipping was subsequently dropped,
so none represents the final shipped configuration. The final configuration's
result is the uninstrumented 18 → 11 table above. Complete per-task counters for
every trial, including capture-call counts, are in
`~/conformance/perf-audit/step-d/summary.json`; capture records are in
`d-*.captures.json`, alongside `instrument.ts` and `summarize.mjs`.


## Evidence and reproduction

Persistent helpers, source snapshots, all seven-sample core data, five-round
React data, CPU profiles, chunk metadata and logs:
`~/conformance/perf-audit/step-c/`.

- `rounds-final.json`: authoritative final React results plus unchanged core
  results from `rounds.json`.
- `react-prod.ts`, `rounds.ts`, `rounds-react-final.ts`: benchmark harnesses.
- `trace.mjs`, `analyze-trace.mjs`, `verify-threads.mjs`: capture, task/profile
  analysis and source-mapped causal stack verification.
- `vite-main.config.ts`, `vite-branch.config.ts`: dedicated production inputs
  for perf.html with source maps; default playground build remains unchanged.
- `react-cold.cpuprofile`, `react-profile.json`: non-reproducing cold diagnostic.

Final traces and per-frame audits:
`~/shots/perf/kitchen-{main,branch}.{trace,audit,summary}.json`.
The rejected cssText experiment is saved separately as
`kitchen-branch-css-text-failed.trace.json`.

Final source checks: size budgets exit 0, root TypeScript exit 0, full tests
**1,101 pass / 1 skip / 0 fail** (69.17s), normal and dedicated production
builds exit 0. The default build retains its existing >500kB chunk warning.
The first final test run flaked the unchanged core scaling test:
**3.242386206513411 > 2.6**. A full-suite retry passed without code changes.
DataTable, Chart, Artifact and Artifact feedback screenshots are all **0%**
different from the original reference pairs; paths are in SIZE-AUDIT.md.
Final sizes, checks and proof logs are in `~/conformance/perf-audit/step-d/`.

## Post-merge capture follow-up

Base: `cfd0bd5` (merged main). Three baseline captures preceded source edits.
The same production host-shell/host-theme replay emits 16 characters per frame
and records send through done plus five seconds of settle, including artifact
renderer processes. The analyzer resolves the audited frame IDs to renderer
processes rather than counting unrelated tabs. No benchmark workload was reduced.

| Run | Baseline tasks >50ms | Baseline max ms | Follow-up tasks >50ms | Follow-up max ms |
|---|---:|---:|---:|---:|
| 1 | 21 | 108.990 | 4 | 76.331 |
| 2 | 21 | 135.625 | 3 | 77.161 |
| 3 | 17 | 155.416 | 3 | 76.693 |

**The zero-long-task goal is not met.** This is a reduction in the repeated
observations, not evidence that the remaining work is intrinsically irreducible.
Every remaining long task is on the host renderer. Artifact-renderer maxima in
the three final runs were 14.409, 12.538 and 16.803ms, with no long tasks.

`SkeletonPart.copy` still snapshots every computed declaration synchronously
while its source is connected. It now records name/value pairs instead of
writing them into every provisional clone. `flush` restores declarations only
for the retained root and its subtree, before geometry freezing and attachment.
Connected/discarded ancestor wrappers are never styled. Cached ancestor clones
share the captured arrays without mutating them. No captures are skipped, no
classes are substituted for frozen styles, and no rendering is deferred to a
later frame.

Source-mapped final stacks:

- React `commitDeletionEffectsOnFiber` → `commitHookEffectListUnmount` →
  `SkeletonPart` cleanup → `capture` → `copy` → `getPropertyValue`/layout reads.
- Queued `flush` → `restore` → `CSSStyleDeclaration.setProperty`; `flush` also
  measures the attached root with `getBoundingClientRect`.
- Run 1's 63.983ms task also samples Mockup `useCanvasSize`'s layout-effect
  `getBoundingClientRect` (`packages/components/src/mockup/gesture.tsx:10`).
  The same task contains skeleton reads/writes; this is not evidence of a
  separate 63.983ms Mockup operation.

All residual durations (ms), largest first:

| Run | Residual tasks |
|---|---|
| 1 | 76.331, 63.983, 53.315, 51.583 |
| 2 | 77.161, 63.035, 60.293 |
| 3 | 76.693, 52.277, 51.464 |

The retained synchronous work preserves connected-source styles and an attached,
fully frozen ghost before the next paint. Splitting restoration across frames
would expose missing or incompletely styled ghosts. Simply dropping ancestor
reads would lose snapshots if React removes those ancestors later in the same
commit. These constrain this implementation; they do **not** prove that a new
snapshot architecture cannot eliminate the remaining tasks. No safe solution
to those residuals is claimed here. Offscreen/clipping skips were not adopted
without an ink/clipping proof. A cssText experiment regressed to 13 long tasks
(122.437ms max) and was dropped. Frozen-template reuse was also dropped after
a native form-state regression; no cross-capture cache ships.

Final old/new comparison, captured against the same live source DOM and compared
while attached: **41 ghosts each, 105 paired elements, 58,700 computed-property
values, zero missing/unmatched elements and zero differences** (including
offscreen ghosts). Mid-exit screenshot: **0 / 1,280,000 pixels different (0%)**.
The regression test verifies that a surviving ancestor can change colour in
the commit without styling its discarded snapshot or recolouring the exit.
The declaration test additionally exercises important shorthand declarations.

Checks: targeted presentation **23 pass, 0 fail**; full `bun test` **1,302 pass,
2 skip, 0 fail** (109.77s); `bunx tsc --noEmit` and `bun run size` exit 0.
Skips: deployment HTML requires a built deployment; no real live-model recording.
No timing retry was needed for the final suite.

Evidence: `~/conformance/perf-audit/followup/` contains baseline source,
production/proof configs, capture/analyzer helpers, per-task source-mapped
`after-{1,2,3}.stacks.json`, `comparison-final.json`, proof data and check logs.
Raw traces/audits/summaries: `~/shots/perf/kitchen-followup-{before,after}-{1,2,3}.*`.
Screenshots: `~/shots/perf/followup-skeleton-mid-{old,new,diff}.png`.

## Final bounded residual round

Starting point: `843dc62`. This round stops with the measurements below; the
zero-long-task goal remains unmet. No size work is included in this round.

### Accepted change: merge before restoring

Sibling captures can share a removed ancestor. Although the previous change
avoided styling connected ancestors, `flush` still restored each sibling's
entire provisional chain *before* discovering which ancestor shells the merge
would discard. It now finds the first missing branch in the existing exit map,
then restores and positions only that branch. The retained tree, frozen values,
source-node ownership and timing of attachment are unchanged.

In the instrumented Pick-item deletion, four captures each removed **one span**;
they additionally snapshotted 7, 3, 1 and 1 uncached ancestors (16 source elements
total, 8,940 source declarations enumerated; parent comparison reads are extra).
This was not a whole-reply or huge-panel deletion. Restoration fell from **19
provisional elements / 9,198 declarations** to **12 retained elements / 5,824
declarations**. Restore time in those two diagnostic observations was
55.9 → 37.7ms; these are instrumented single observations, not an isolated speedup
estimate.

Three uninstrumented production replays, with unchanged fixed chunks and settle:

| Run | Previous tasks >50ms | Previous max ms | This round tasks >50ms | This round max ms |
|---|---:|---:|---:|---:|
| 1 | 4 | 76.331 | 3 | 64.523 |
| 2 | 3 | 77.161 | 1 | 56.256 |
| 3 | 3 | 76.693 | 6 | 60.876 |

Counts remain variable and do not improve monotonically. All residuals are on
the host renderer; artifact-renderer maxima were 19.427, 19.102 and 31.905ms,
with zero tasks >50ms.

### Exact residual work

All final uninstrumented tasks, with source-mapped paths (C = React deletion
cleanup → `capture`/`copy` → computed-style reads; R = microtask `flush` →
`restore` → style writes; G = `capture`/`flush` bounds reads and placement):

| Run | Task ms | Work sampled |
|---|---:|---|
| 1 | 64.523 | C + R + G; bounds/layout dominates |
| 1 | 63.402 | C + R + G; bounds/layout dominates |
| 1 | 55.426 | C + R + G; restoration dominates |
| 2 | 56.256 | C + R + G; restoration dominates |
| 3 | 60.876 | React render → `Prism` children map → `BlockVector` proxy `has`/index conversion |
| 3 | 59.771 | C + R + G; restoration dominates |
| 3 | 56.361 | C + R + G; restoration dominates |
| 3 | 54.738 | C + R + G; restoration dominates |
| 3 | 54.237 | C + R + G plus Artifact `readTheme` (9.670ms sampled) |
| 3 | 50.415 | C + R + G; bounds/layout dominates |

The 60.876ms render outlier has only one sample carrying a 58.616ms delta at
`packages/core/src/vector.ts`'s index helper, reached through proxy `has` from
`Prism`'s array map. The helper has no traversal loop for an ordinary numeric
index. This sparse sample does **not** establish 58ms of expensive index
conversion; the underlying stall is unresolved. React must finish constructing
the children for that render before committing, but this observation is not
evidence that its latency is irreducible. No core change was guessed from it.

The 54.237ms task also samples host-side
`packages/components/src/artifact/use-artifact.tsx:readTheme`: enumeration of
the container's computed `--prism-*` tokens/font/colour-scheme for iframe theme
synchronization. It is not a separate iframe-renderer long task. Current-scope
theme values are required, but the profile does not prove this enumeration
must remain in this particular task; no scheduling/cache equivalence proof was
attempted after the time box. It is not claimed irreducible either.

A separate instrumented final replay had two host long tasks. Instrumentation
adds work and timing variance: its 104.999ms maximum must not replace the
uninstrumented table above. Capture includes copying and capture-time geometry;
G below is the remaining flush geometry/attachment/merge work, excluding restore
and visibility diagnostics. Bounds-read time is a subset, not additive.

| Task ms | Captures; deep elements each; new ancestors each | Restored elements / declaration writes | Capture ms | Restore ms | G ms | Visibility audit ms | Other task ms |
|---|---|---:|---:|---:|---:|---:|---:|
| 104.999 | 4; 1,1,1,1; 7,3,1,1 | 4 / 1,956 | 28.6 | 17.4 | 52.2 | 0.5 | 6.3 |
| 64.275 | 4; 1,1,1,1; 7,3,1,1 | 12 / 5,824 | 16.7 | 37.7 | 6.8 | 0.1 | 3.0 |

The first task removes Pick match/value spans and produces four separate,
opaque exit roots. All four intersect the viewport and their overflow-clipping
ancestors: x=260..1280, y=68..816. Their roots occupy x=473.93..1085,
y=492.71..515.11 and x=1058.84..1093 at y=629.30..650.10,
658.10..678.90 and 686.90..707.70. Bounds reads consume 47.1ms of this
instrumented task (including capture reads).

The second task merges those spans into one Pick item (x=771..1105,
y=366.52..770.07), with a clipping box x=260..1280, y=68..764.06. Its
resolved ghost opacity is zero **after restoration**. That exit is invisible at
the observed point, but most of its cost has already occurred. No early skip
was adopted: captured source opacity alone does not establish the eventual
exit cascade under host selectors/important rules, and no equivalent cheap
pre-restoration guard was proved in this round. No offscreen skip ships.

The source reads must occur while React's source/context are still connected;
restoration must precede first paint to avoid an unstylized or missing ghost;
placement must resolve the actual attached containing block and scale before
paint to prevent a jump. These are ordering requirements, **not** proof that
each current implementation cost is unavoidable. In particular, batching the
remaining layout reads/writes would need another implementation/proof round,
which is intentionally not started here.

### Rejected shortcuts and proof

A Chromium counterexample for default-element diffing gives a transparent
source and default probe, but the inserted ghost becomes `:last-child` under a
host rule. Full copying stays `rgba(0, 0, 0, 0)`; omitting the default-valued
background yields `rgb(255, 0, 0)`. Thus equality to a same-tag, same-scope
baseline is insufficient. It also still requires reading each source property
to identify differences. A native-input counterexample shows later cleanup
changing a reused source's value from `edited` to `later cleanup`, while a
snapshot remains `edited`. Those schemes and depth/element caps were not shipped.
Regression tests preserve both context freezing and independence from later
source/form mutations, as well as zero writes to merged-away ancestor shells.

Same-live-DOM kitchen proof after this change: **50 old/new ghost pairs,
126 paired elements, 70,524 computed-property values, zero missing/unmatched
elements and zero differences**. No ghosts were skipped. Mid-exit pixel diff:
**0 / 1,280,000 (0%)**, at
`~/shots/perf/round2-skeleton-mid-{old,new,diff}.png`.

Evidence: `~/conformance/perf-audit/followup-round2/` holds temporary
instrumentation/build configs, `residuals.json` (before),
`after-instrumented.residuals.json` (after), counterexamples, `comparison.json`,
per-run source-mapped stacks and check logs. Uninstrumented traces are
`~/shots/perf/kitchen-followup-round2-after-{1,2,3}.*`; instrumented traces have
`round2-instrumented` and `round2-after-instrumented` suffixes. Temporary counters
and probes are not included in the runtime or commit.

Final checks: presentation **26 pass / 0 fail** (1.55s), TypeScript exit 0,
size exit 0; React runtime JS gzip **22,284 → 22,301B**, below its unchanged
23,331B cap. Full **`bun test --timeout 15000`**: **1,305 pass / 2 skip / 0
fail**, 1,307 tests across 144 files (150.34s). No source or test timeout was
changed to obtain this result; the extended timeout is a command-line option.

Default-timeout `bun test` is **not reliably green**: the first final run hit
the core scaling ratio **2.6104231843935612 > 2.6** and Chart malformed replay
**5,086.66ms > 5,000ms**; a default retry hit the Mockup conditional-fixtures
test **7,130.57ms > 5,000ms**. The latter also took 6,149.71ms when rerun in its
own file. Chart and Mockup tests explicitly pass `animate={false}`;
`ThemeScope` emits `data-animate="false"`, so `capture` returns before the
modified `flush` path. Core scaling does not execute React. Thus these timing
failures do not reach the changed path; their time limits/implementations were
left unchanged. The two skips remain built-deployment HTML and the absent live
recording.
