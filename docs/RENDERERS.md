# Inline artifacts and custom renderers

## Let the agent build the whole thing

Artifacts are the main custom-UI path. The model writes the entire HTML, React,
SVG, JavaScript or Markdown view: data displays, dashboards and completely custom
inputs. Prism supplies an isolated, inline surface, not a predetermined layout.

```tsx
import { Prism } from '@prism-ui/react';
import { ArtifactProvider, artifactPlugin } from '@prism-ui/components';
import '@prism-ui/components/styles.css';
import '@prism-ui/components/artifact.css';

const plugins = [artifactPlugin];
const options = { statePaths: ['planning'] }; // explicit capabilities, not global access

<ArtifactProvider options={options}>
  <Prism source={reply} done={!streaming} plugins={plugins} store={store}
    onAction={handleAction} />
</ArtifactProvider>
```

The model can produce:

````md
```artifact:html {id=decision title="Your priorities" height=auto}
<style>
  main { display:grid; gap:var(--prism-space-3); color:var(--prism-text) }
  button { font:inherit; color:inherit; background:var(--prism-surface);
    border:1px solid var(--prism-border); border-radius:var(--prism-radius-sm) }
  @container (min-width:520px) { main { grid-template-columns:1fr 1fr } }
</style>
<main><button>Ship the small version</button><output></output></main>
<script>
  const output = document.querySelector('output');
  const update = value => output.textContent = value ?? 'No choice yet';
  update(prism.state.get('planning.choice'));
  prism.state.subscribe('planning.choice', update);
  document.querySelector('button').onclick = () => {
    prism.state.set('planning.choice', 'small');
    prism.emit('select', { choice: 'small' });
  };
</script>
```
````

### Native and adaptive

- Default `variant=inline` has no frame, title bar, background or border. Code,
  versions, copy, download, reload and fullscreen appear on hover/focus. Touch
  devices retain discoverable controls. `variant=panel` restores framed chrome.
- `height=auto` measures content, including late images and interactive changes.
  Streaming reserves space and does not collapse between partial renders. Content
  can grow while streaming and settles to its measured height when complete.
  A numeric height explicitly opts into a fixed-height viewport.
- The frame is the actual container width, not a scaled desktop artboard. Build
  fluid layouts for **280px–760px and beyond**. Use flexible tracks, `min-width:0`,
  wrapping labels and container queries. The document already establishes an
  inline-size query container. Avoid viewport-sized shells and fixed widths.
- Every inherited `--prism-*` variable is forwarded; host `currentColor` and
  inherited fonts are captured before crossing the iframe boundary. The computed
  font family/size, color scheme and reduced motion update on theme/mode changes.
  `--prism-reduced-motion` is `1` when motion is disabled. Default frame CSS
  suppresses animation/transition durations in that case.
- Use semantic tokens from [THEMING.md](THEMING.md), including
  `--prism-on-accent` for solid fills. Do not hard-code a separate app palette.

### Tiny in-frame runtime

`window.prism` is available to HTML scripts and React/JS modules:

| API | Behavior |
| --- | --- |
| `prism.theme` | Live record of CSS variable values, keyed by `--prism-*`. |
| `prism.state.get(path)` | Latest host-granted state; initially supplied before execution. |
| `prism.state.set(path, value)` | Validated host-store write; agent patches use the same paths. |
| `prism.state.subscribe(path, listener)` | Live updates; returns an unsubscribe function. |
| `prism.emit(type, payload)` | Structured `onAction` event with the owning component/id. |
| `prism.send(type, payload)` | Backward-compatible alias for `emit`. |
| `prism.resize()` | Request content measurement after a custom drawing/layout change. |

`document` receives `prism:theme` events with `{ tokens, dark }` in `event.detail`;
use these to redraw canvases. CSS reacts without a listener. HTML scripts execute
when the fence completes; partial HTML/SVG/Markdown can display as it streams.
React/JS wait for complete source. A partial new version preserves the last ready
version. Existing sandbox, CSP, import allowlist, message-origin checks and state
capabilities still apply. An artifact never gets ambient access to the host DOM
or the entire store.

## Graphic feedback

Artifacts opt in by default. Set `<Prism feedback>` to enable the same surface for
all other registered built-in/custom directive renders. A definition can opt in
or out with `feedback: true/false`. Importing `@prism-ui/components` or its artifact
entry installs the feedback surface; core React alone deliberately has no dependency
on the built-in UI package. Custom-only applications can use
`import '@prism-ui/components/feedback'` once to install that shared UI.

Hover or focus reveals a small feedback button. In feedback mode click to pin,
drag to box, or enable Draw for freehand; the same mockup annotation canvas,
popover, pen tools, undo/redo and submit footer are reused. Keyboard users can
focus the canvas, move the reticle with arrows, and press Enter to pin. Escape
closes the surface and restores trigger focus. Closing retains saved drafts.
The overlay intercepts input only while annotating; it does not duplicate or
remount the underlying renderer/iframe.

One Submit produces one `feedback` action, with its normal `component` and `id`
envelope and payload:

```ts
{
  target: { name: 'artifact', id: 'decision' },
  coordinates: 'percent',
  mockup: 'artifact', // retained shared mockup feedback-model context
  device: 'desktop',
  overall: 'Prefer the smaller version',
  items: [{ n: 1, kind: 'region', x: 10, y: 20, w: 35, h: 25, comment: 'Tighten this' }]
}
```

Coordinates are **0–100 percent relative to the rendered element**, not the page
or viewport. Drawing `path` coordinates use that same space. Feedback targets the
render as a whole, not internal cross-origin DOM selectors. Submitted feedback is
locked until explicitly edited; empty feedback cannot be submitted.

Saved feedback lives at `<target id>.feedback` in the shared store. The editor
reacts to store patches, undo/redo and streaming ID finalization. Opening an
editor never initializes a blank draft. Pins in progress, typed annotation text,
tools and zoom remain local; cancelling them writes nothing. Save, Delete,
keyboard annotation moves, the overall comment's blur and Submit are explicit
commits, each recorded as one normal history entry. Submit stores the draft and
its submitted state together. Comment dialogs use a viewport-bounded portal so
short or clipped artifact previews cannot hide their actions.

## Bring an existing React component

The small developer escape hatch builds on the existing directive/component
pipeline; it does not introduce a second parser or state store:

```tsx
import { Prism, defineRenderer, type RendererProps } from '@prism-ui/react';
import { s } from '@prism-ui/schema';

function Heatmap({ data, complete, emit, useState, tokens }: RendererProps<{ values: number[] }>) {
  const [selected, setSelected] = useState<number | null>(null);
  return <div style={{ color: tokens.text }} aria-busy={!complete}>
    {(data.values ?? []).map((value, i) => <button key={i} onClick={() => {
      setSelected(i);
      emit({ type: 'select', payload: { index: i, value } });
    }} aria-pressed={selected === i}>{value}</button>)}
  </div>;
}

<Prism renderers={{ heatmap: Heatmap }} source={reply} />

// Optional definition also registers default-registry validation and prompt docs.
const heatmap = defineRenderer('heatmap', Heatmap, {
  schema: s.object({ values: s.array(s.number()) }),
  prompt: 'Show a compact activity heatmap from numeric values.',
  feedback: true,
});
<Prism renderers={{ heatmap }} source={reply} />
```

Use a `ui:heatmap` JSON fence. `data` is typed recursively partial, including
array elements, until streaming completes. Always tolerate missing fields.
`useState(initial)` is a hook: call it unconditionally once, at the top of the
renderer, just like React state. It owns `<component id>.state` in the shared
store; functional updates, subscriptions, Undo and agent patches all use that
slice. Add a stable JSON `id` to address it across turns. `tokens` contains scoped
CSS variable references, so CSS updates live in nested themes. `complete` tells
the renderer when the fence is finalized. Renderer exceptions are isolated from
adjacent prose/artifacts by a local error boundary; streaming updates do not
change the renderer type/key or remount its local hooks. An errored renderer stays
in its fallback until that artifact is replaced.

Live examples: playground **`/adaptive.html`** (agent dashboard, agent input,
developer heatmap and developer input; width/theme controls and stream replay).
