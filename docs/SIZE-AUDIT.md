# Component size audit

Baseline: `ba8a0ae` (before Step B); after: Step B changes on the perf-audit branch.
Bun 1.4.4, minified browser ESM, gzip level 9. See [accounting](../scripts/README.md).
All numbers are bytes. Full component JS is **own + the entire shared entry**,
not a standalone consumer bundle. Runtime rows do not add shared.

| Entry | Own JS before → after | Full JS before → after | Own CSS before → after |
|---|---:|---:|---:|
| callout | 1201 → 1201 | 26160 → 28310 | 1092 → 1092 |
| card | 2166 → 2166 | 27125 → 29275 | 1487 → 1487 |
| grid | 917 → 917 | 25876 → 28026 | 1080 → 1080 |
| badge | 755 → 755 | 25714 → 27864 | 830 → 830 |
| tabs | 2929 → 2929 | 27888 → 30038 | 1577 → 1577 |
| table | 4321 → 4321 | 29280 → 31430 | 1844 → 1844 |
| summary | 3755 → 3755 | 28714 → 30864 | 2700 → 2700 |
| num | 4172 → 4172 | 29131 → 31281 | 1416 → 1416 |
| estimate | 3504 → 3504 | 28463 → 30613 | 1432 → 1432 |
| pick | 5138 → 5138 | 30097 → 32247 | 2399 → 2399 |
| runbook | 3697 → 3697 | 28656 → 30806 | 2300 → 2300 |
| troubleshoot | 4295 → 4295 | 29254 → 31404 | 2208 → 2208 |
| ask | 6425 → 6425 | 31384 → 33534 | 2486 → 2486 |
| codeblock | 3675 → 3675 | 28634 → 30784 | 2345 → 2345 |
| datatable | 8518 → 7926 | 33477 → 35035 | 3309 → 3309 |
| chart | 9609 → 8360 | 34568 → 35469 | 2307 → 2307 |
| artifact | 45049 → 47144 | 70008 → 74253 | 4882 → 4882 |
| mockup | 32287 → 32287 | 57246 → 59396 | 3324 → 3324 |
| view | 18126 → 15273 | 43085 → 42382 | 5231 → 5231 |
| shared | 24959 → 27109 | 24959 → 27109 | 8923 → 8923 |
| react | 19071 → 19071 | 19071 → 19071 | 2608 → 2608 |
| core | 11595 → 11595 | 11595 → 11595 | 0 → 0 |
| state | 3422 → 3422 | 3422 → 3422 | 0 → 0 |
| schema | 1825 → 1825 | 1825 → 1825 | 0 → 0 |

DataTable own decreases **6.95%**, Chart own **13.00%** by extracting reusable
cell/row normalization and chart geometry into common utilities. Their renderers,
interaction state and schemas still exceed 4 KiB; explicit budgets allow about
5% headroom. This is an ownership reallocation, **not a net byte reduction**:
shared grows 2,150B, so the conservative full figures for these entries increase.

Artifact initial own JS decreases **45,049 → 13,643B (69.71%)**. Graphic feedback
and its mockup engines are deferred (**33,501B**), preloaded when the feedback
surface mounts and on hover/focus. All deferred chunks remain budgeted: total
own grows **45,049 → 47,144B** from splitting and the async bridge. A first
activation arriving before the import finishes is retained and opens when
ready; closing while pending is also retained. Existing feedback state,
fullscreen, undo, save and receipt tests remain intact, with explicit preload
setup for synchronous interaction assertions.

View own decreases **18,126 → 15,273B (15.74%)**. Demo fixtures now require the
explicit `@prism-ui/components/view/fixtures` subpath; the playground imports
them there. The runtime keeps its compact built-in example. Existing consumers
of `viewFixtures` / `viewGallery` from the runtime entry must migrate to that
subpath (aliases shown in the accounting guide).

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

## Verification

- `bun run size --markdown --grammars`: all budgets passed.
- `bunx tsc --noEmit`: exit 0.
- `bun test`: 1,098 pass, 1 skip, 0 fail; 1,099 tests / 124 files, 82.48s.
  The skip is the absent real live-model recording; no timing tests flaked.
- `bun run --cwd apps/playground build`: built in 2.83s; existing >500 kB
  chunk warning remains.
- Playground spot checks used the same host shell, sources, viewport, fonts,
  reduced-motion setting and keyboard feedback activation before/after.
  Exact RGBA pixel differences: DataTable **0%**, Chart **0%**, Artifact **0%**,
  Artifact feedback **0%**. Escape/reopen preserved feedback text; 0 page errors.
  The harness's initial pointer activation was intercepted by the artifact
  iframe already on the baseline; keyboard activation was used instead.

Screenshots: `~/shots/perf/{datatable,chart,artifact,artifact-feedback}-{before,after}.png`;
diff images use `-diff.png`. Raw measurements, logs and capture script:
`~/conformance/perf-audit/step-b/`. No live model calls or full streaming trace
were part of Step B.
