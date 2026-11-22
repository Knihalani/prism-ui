# Motion in Prism

Prism components appear inside someone else's product, so motion must feel native, quick and
quiet: it explains change, never decorates it. Every component uses the same primitives and the
same tokens, so a theme can retune all motion in one place.

## Sources and what they agree on

| Source | Pattern | Parameters |
| --- | --- | --- |
| Apple, *Animate with springs* (WWDC23); UIKit/SwiftUI springs | Springs keep position **and velocity** continuous, so they are the only curve that retargets without a hitch. Configure by response + bounce, not mass/stiffness. | `.smooth` response 0.5 s, damping 1; `.snappy` 0.5 s, damping 0.85; `.bouncy` 0.5 s, damping 0.7; `.interactiveSpring` 0.15 s, 0.86. stiffness = (2π/response)², damping = 4π·ζ/response. |
| Emil Kowalski, *Great animations*, *7 practical tips*, Sonner, Vaul | UI motion is ease-out and under 300 ms; press = `scale(.97)`; never enter from `scale(0)` (start ≥ .9); transitions (not keyframes) when a value can change mid-flight; a 2 px blur bridges a crossfade; don't animate keyboard-driven repeats. | ease-out `cubic-bezier(.23,1,.32,1)`; dropdown ≈ 180 ms; Sonner 400 ms `ease`; Vaul/iOS sheet 500 ms `cubic-bezier(.32,.72,0,1)`, floating sheet 200 ms. |
| motion.dev (Framer Motion) | Spring by `visualDuration` + `bounce`; physical values default to spring, others to 0.3 s tween; layout (shared element) uses FLIP. | `bounce` −1…1; `visualDuration` = when it *looks* done. |
| Josh Comeau / Jake Archibald, CSS `linear()` | Real spring curves in plain CSS by sampling the spring; duration = settle time. | ~40 samples are indistinguishable from the solver. |
| Rauno Freiberg, *Invisible details* | Interactions must be interruptible like a page of a book; motion follows the real-world metaphor; exits are lighter than entries. | — |
| Benji Taylor, *Family values* | Fluidity: elements transform into the next state (pill → receipt) rather than being replaced; directional motion explains where you went; delight in a few chosen moments. | — |
| Linear, Vercel Geist, Things 3, Raycast | Near-invisible motion for frequent actions (Raycast has none); 150–200 ms state changes; Things' satisfying check is the one place that "pops". | — |

## Tokens

All are CSS variables (`--prism-motion-*`) on the theme scope, set from `Tokens` keys, and
overridable per theme or per component (`--prism-<component>-motion-*`). Reduced motion and
`animate={false}` set durations to `0ms` and distances to `0`.

| Token | Default | Use |
| --- | --- | --- |
| `motionInstant` | 90 ms | hover colour, press-in |
| `motionFast` | 160 ms | hover-reveal, chip/segment state, popover, exits |
| `motionBase` | 240 ms | state changes, collapse, highlight decay start |
| `motionSlow` | 420 ms | entering content, sent receipt, check draw, chart draw |
| `motionEase` | `cubic-bezier(.23,1,.32,1)` | default ease-out |
| `motionEaseInOut` | `cubic-bezier(.65,0,.35,1)` | something already on screen moving to a new place |
| `motionEaseExit` | `cubic-bezier(.4,0,1,1)` | exits (shorter and accelerating: they leave, they don't arrive) |
| `motionSpring` | `linear(…)` snappy: response .35 s, damping .85 | thumbs, indicators, FLIP, press release |
| `motionSpringDuration` | 500 ms | settle time for `motionSpring` |
| `motionSpringBouncy` | `linear(…)` response .4 s, damping .7 | the sent check only |
| `motionSpringBouncyDuration` | 600 ms | |
| `motionStagger` | 28 ms | per-item delay, capped at 8 items |
| `motionDistance` | 6px | enter offset |
| `motionScale` | .97 | press scale and enter start scale |
| `motionBlur` | 2px | crossfade bridge |

`spring({ response, damping })` (exported from `@prism-ui/react`) produces a `{ easing, duration }`
pair so themes can derive their own spring tokens.

## Primitives and where Prism uses them

1. **Enter while streaming (skeleton morph + stagger).** Content fades in from `opacity 0,
   translateY(motionDistance), blur(motionBlur)` over `motionSlow` with `motionEase`; skeletons
   fade out over `motionFast`. Children with `--prism-motion-index` stagger by `motionStagger`
   (cap 8). Uses `@starting-style` transitions so a re-render mid-enter retargets rather than
   restarts. Used by: frame roots, pick cards, estimate rows, runbook steps, summary points, table
   rows, ask fields, chart plot, view nodes, tabs panels, callout/card/grid.
2. **Value change.** Numbers roll per digit (odometer) on `motionSlow` with `motionEase`; plain
   numbers tween with an rAF spring (`useSpringValue`) that keeps velocity when retargeted.
   Cross-component writes flash a soft accent wash for 600 ms (`useFlash`). Used by: estimate total,
   `:num`/`:calc`, view stats, datatable/summary counts, pick scores.
3. **List reorder (FLIP).** `createFlip` measures *visual* rects (including any in-flight
   transform) before cancelling, so a second reorder mid-flight continues from where the item is.
   `motionSpring`/`motionSpringDuration`. Used by: pick re-ranking, datatable sort.
4. **Expand/collapse (height auto).** `useCollapse` animates height from the current visual height
   to the measured target with WAAPI and fades content; interrupting reverses from the current
   height. `motionBase` + `motionEase`. Used by: summary sources, codeblock collapse, troubleshoot
   path, runbook step bodies, frame overflow.
5. **Hover-reveal controls.** Secondary controls (copy, ask, undo) sit at `opacity 0` and
   `translateY(2px)` on hover-capable pointers, appearing over `motionFast` when the component is
   hovered or anything inside is focused; always visible on touch.
6. **Press feedback.** `:active` scales to `motionScale` over `motionInstant`; release springs back
   with `motionSpring`. Used by pill, chip, icon button, stepper keys, segmented, switch, checkbox.
7. **Sent state.** The primary pill morphs in place: ready label exits up with blur over
   `motionFast`, the past-tense label enters from below over `motionSlow`, the check draws with
   `motionSpringBouncy`, the fill eases from accent to a neutral receipt. Width is reserved, so
   nothing around it shifts.
8. **Drawn checkmarks.** Stroke-dash draw over `motionSlow` with `motionEase`, the box fills first
   (`motionFast`) then the tick draws (delay `motionInstant`). Used by checkboxes, runbook and summary
   checks, sent receipts.
9. **Charts draw in.** Lines draw by `pathLength` dash over `motionSlow × 2`, areas fade up,
   bars grow from the baseline staggered by `motionStagger`; new points while streaming transition
   their coordinates instead of re-drawing.

## Rules

- Animate `transform`, `opacity` and `filter` only, except collapse height (one property, one
  element, short). No layout thrash per frame.
- Anything that can change while moving uses transitions, WAAPI or springs — not keyframes.
- Exits are faster than entries (`motionFast` vs `motionSlow`).
- Keyboard-driven repeats (arrow keys on a stepper or `:num`) update immediately; only the value
  roll animates.
- Streaming never restarts an animation for an element that already entered.
- `prefers-reduced-motion: reduce` keeps opacity crossfades at `motionFast` and removes all
  movement, scale and blur; `animate={false}` removes everything.
