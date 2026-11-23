# Production streaming audit

Comparison: main `a2ebe6c` versus the perf-audit branch after B rework.
Bun 1.4.4, React 19.3.1; same machine. No live-provider requests.
Sizes and remaining bundle limitations are in [SIZE-AUDIT.md](SIZE-AUDIT.md).

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
| Send-through-settle interval, ms | 34791.317 | 34999.891 |
| Renderer main tasks >50ms | 14 | 16 |
| Largest task, ms | 194.803 | 148.076 |
| Largest non-host renderer task, ms | 17.186 | 15.569 |

All long tasks are in the host renderer. The in-page Long Tasks observer,
filtered to the same marks, independently reports **14 / 16**. Its unfiltered
branch lifetime count is 17 because it includes initial page loading.
One capture per revision is not evidence that the lower maximum is a speedup.

### Verified remaining cause

The sampled stack in the worst task, source-mapped on both revisions, is:

`React commitDeletionEffectsOnFiber → commitHookEffectListUnmount →
SkeletonPart cleanup (skeleton.tsx:96) → capture (:78) → copy (:8/:12) →
CSSStyleDeclaration.setProperty`.

`PrismPart` installs SkeletonPart for raw skeleton parts. Cleanup captures
the subtree plus ancestors to the presentation root, freezing every computed
CSS declaration onto clones before React removes the originals. The stack
proves that capture's animation, scope, duration and nonzero-rectangle gates
are passed in this scenario. This is not inferred from merely possible code.

In the worst main task, native `setProperty` accounts for **145.310ms** and
`getPropertyValue` **21.236ms** of sampled time. In the worst branch task,
they account for **91.478 / 23.927ms**, with **12.619ms** in the copying loop.
`packages/react/src/skeleton.tsx` is unchanged from main. This is a preexisting
browser exit-snapshot cost, not a confirmed effect of the size changes.

Two attempted optimizations were rejected and reverted: bulk cssText copying
still produced a 225.871ms task, and skipping captures nested beneath a pending
ancestor did not eliminate the large tasks. Native style freezing remains the
dominant path. Removing it, copying fewer declarations or deferring capture
until after removal risks inherited/theme styles, SVG placement and the exit
snapshot. No visual compromise or unsupported performance fix is shipped.
The 0-long-task target requires a deeper snapshot-pipeline redesign and remains
unfinished. A richer computed-style snapshot regression test was retained.

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
**1,099 pass / 1 skip / 0 fail** (63.93s), normal and dedicated production
builds exit 0. The default build retains its existing >500kB chunk warning.
DataTable, Chart, Artifact and Artifact feedback screenshots are all **0%**
different from the original reference pairs; paths are in SIZE-AUDIT.md.
