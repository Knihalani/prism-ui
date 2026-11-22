# Prism playground

An entirely local Vite + React workbench. From the repository root:

```sh
bun install --no-save
bun run dev
```

Open the URL printed by Vite (normally http://localhost:5173). No API key or backend is needed. `--no-save` keeps the shared root lockfile untouched; this app was added under an app-only change constraint.

```sh
bun run --cwd apps/playground build
bun run --cwd apps/playground test
```

## Workflow

- Edit Markdown on the left; the right pane renders `<Prism source>` immediately.
- **Stream** creates a real AsyncIterable passed to `<Prism stream>`. Configure characters/tick and milliseconds/tick before or during playback. Pause/resume preserves the iterator; Stop finalizes the received prefix. Source is read-only during playback. Replay starts a new Prism reply; shared store values persist until Reset or selecting another example.
- The example menu is built from `defaultRegistry.list()` after importing `@prism-ui/components`. Every registered directive gets its declared examples, with a basic syntax fallback if it has none. `tab` is wrapped in `tabs`, and `calc` gets a seed state. Utility exports such as hooks and ComponentFrame are not standalone directives. New exports that register definitions automatically appear after Vite reloads; component CSS is discovered by a Vite glob.
- The kitchen sink is a realistic assistant reply combining Markdown, badges, callout, comparison, live numbers, an estimate, a data table, and a sourced summary.
- **Actions** stores every `onAction` object, including payload, context and message, displaying the newest first. Selecting another fixture or Clear explicitly clears the log.
- **State** shows the subscribed shared store and applies validated JSON patches through `store.apply`, the same set/merge/delete operation used by `ui:state`. Invalid JSON/patch shapes show an error without changing state.
- **Prompt docs** is the actual `toPromptDocs(defaultRegistry)` output, with a clipboard button and a selectable fallback when clipboard access is denied.
- Theme, density, motion, unstyled mode and locale/currency are passed to Prism. The chrome also uses the shipped Prism theme tokens. Unstyled affects the preview, not the workbench chrome.

## Stats methodology

The Vite-only `@prism-ui/core` alias transparently wraps **the actual parser used by Prism**; no duplicate parser or estimated timing is used. Parse milliseconds sum `push`, `end` and `root` API calls. This includes finalization but excludes React rendering and lazy descendant reads outside those API calls. Chunks counts nonempty parser pushes; the final empty decoder flush is excluded. Source mode is one chunk per full source parse, while stream mode counts emitted chunks. Characters are UTF-16 code units (surrogate pairs stay together during replay).

Render commits come from React Profiler around Prism, including interactive component updates. Stats polling is outside that subtree, so it doesn't inflate the counter. Profiler callbacks are development-only in standard React builds; a production build labels this counter “Dev only.”

All app dependencies/configuration live here. Only the root workspace glob and `dev` script are changed outside the app.

See [BUGS.md](BUGS.md) for component limitations encountered during browser verification.
