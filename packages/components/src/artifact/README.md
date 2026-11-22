# Inline artifacts

```tsx
import { Prism } from '@prism-ui/react';
import { ArtifactProvider, artifactPlugin } from '@prism-ui/components/artifact';
import '@prism-ui/components/styles.css';
import '@prism-ui/components/artifact.css';

const plugins = [artifactPlugin];
const options = { statePaths: ['monthlyBudget'] };
<ArtifactProvider options={options}>
  <Prism source={reply} plugins={plugins} onAction={sendToAgent} />
</ArtifactProvider>;
```

````md
```artifact:react {title="Counter" id=counter height=240}
import { useState } from 'react';

export default function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => {
    setCount(count + 1);
    window.prism.send('increment', { count: count + 1 });
  }}>{count}</button>;
}
```
````

Use `artifact:html`, `artifact:svg`, `artifact:js`, or `artifact:markdown` for the other source types. HTML and SVG patch in place as tokens arrive; HTML scripts, JS, and React run only when the fence closes. JS is an ES module with an empty `#app` mount point. React accepts JSX or TSX with a default component export. SVG is sanitized before entering the frame. Artifacts are chromeless inline by default; hover or keyboard focus reveals controls. `height=auto` reserves space while streaming and then fits the measured content without an internal scrollbar (with a 1,000,000px safety limit). Set a pixel height to reserve an exact canvas size; use `variant=panel` to restore framed chrome. Build fluid layouts with semantic CSS tokens and container queries, not fixed-width page shells. The host font, theme, colour scheme and reduced-motion preference update live. See [the renderer guide](../../../../docs/RENDERERS.md) for adaptive examples and graphic feedback.

## Host policy and bridge

- Set `enabled: false` to allow source inspection without compiling or running artifacts.
- `imports` replaces the pinned default ESM map (React, React DOM, Lucide, d3-scale and date-fns). Serve vendored modules with CORS headers (the sandbox has an opaque origin), and list their leaf URLs in the map if they transitively import additional files. To provide the Prism component set, map `@prism-ui/components` to your bundled ESM build, keeping `react` and `react/jsx-runtime` external so both resolve to the same React as the frame. Include the CSS in your artifact or your vendored module. Set `compilerUrl` to a vendored ESM build exporting Sucrase's `transform` for offline deployments. The host CSP must allow `worker-src blob:` and the compiler module location.
- Grant only paths the generated code may read **and** write. A granted path includes its descendants; by default no path is granted. The sandbox isolates the host DOM and storage; it is not a way to give untrusted code secrets.
- `window.prism.state.get(path)` reads the latest mirrored value. `set(path, value)` writes a JSON value through the shared store, including undo and the host's persistence adapter. `subscribe(path, fn)` calls `fn(value)` for updates and returns an unsubscribe function. React can use `useSyncExternalStore` with these methods.
- `window.prism.send(type, payload)` emits a structured action through Prism's middleware. **Fix this** emits `fix` with `{ error, source, kind, version }`. `window.prism.theme` exposes the CSS variable names also applied to the frame root. `window.prism.resize()` requests a measurement; automatic height also follows content changes.
- Markdown task lists use native checkboxes. Toggling saves the choice in the artifact's shared store state with undo and emits `toggle` with `{ task, checked }`. Give the artifact an explicit ID to keep its choices across replies.
- Reusing an `id` with the same Prism store publishes a version; history lives in memory for that store. While a new version streams, the previous preview stays visible and the toolbar says **Updating…**. React versions replace the component inside the existing frame; use store-backed state for values that must outlive a module replacement. Reload resets frame-local state.
- **Download** in preview saves runnable HTML with the active Prism theme, compiled React, and the configured import map. External modules must still be available to the browser. The standalone bridge uses local state and has no host action handler. **Download source** in Code or Changes saves the original source.

## Customizing

`useArtifact(props, usePrism(), complete)` exposes the frame container ref, preview state, height, version history, and actions for custom views. ComponentFrame slots handle the header, title, toolbar, and body; the artifact provides `controls`, `empty`, `error`, and `source` slots with the headless model. Override parts with Prism's `classNames`, `styles`, or `unstyled` options. All chrome styling is in `artifact.css` and uses CSS tokens.

## Local gallery

`bun build packages/components/src/artifact/harness.tsx --outdir <site> --target browser --splitting`, then copy `harness.html` there and serve that directory on localhost. **Stream** starts a new artifact with a skeleton; **Stream update** starts a new version of the gallery's loan calculator. **Finish** completes either stream. `?theme=dark` opens dark mode; `?bench` starts with an unfinished React fence. `?vendor` expects the pinned dependencies at their matching local URL paths.
