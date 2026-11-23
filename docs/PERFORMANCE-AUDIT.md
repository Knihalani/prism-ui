# Production streaming audit

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
