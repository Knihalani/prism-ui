# prism-ui design (v1)

A streaming parser that turns LLM output (markdown + directives) into functional, good-looking UI.
Principles: every component is a familiar object first, reads fully as static content (interaction is a bonus), has one primary action, sends structured data back via `onAction`, shares one reactive store, animates in as it streams, and is customisable at every layer.

## Packages (all tree-shakable, `sideEffects` limited to CSS)

| Package | Deps | Role |
|---|---|---|
| `@prism-ui/core` | none | Streaming parser, AST, string/DOM renderers, parser plugins |
| `@prism-ui/state` | none | Reactive store, formulas, undo, persistence adapters, agent patches |
| `@prism-ui/schema` | none | Tiny prop-schema DSL: validate, coerce, defaults, streaming fallback, prompt docs |
| `@prism-ui/react` | react ≥18 | `<Prism>`, registry, theming, actions + middleware, headless hook utilities |
| `@prism-ui/components` | react, the above | Base + genUI components, one subpath export per component, plain CSS |

## Core additions

- `createParser({ plugins })` / `parse(text, { plugins })`.
- `Plugin = { name, inline?: InlineExt[], block?: BlockExt[], transform?(node: Node): Node }`.
  - `InlineExt = { trigger: string /*1 char*/, parse(src, pos): { node, end } | null }`.
  - `BlockExt = { test(line): boolean, continue(line, state): boolean, finish(lines): Node }` (line-based; open blocks re-run `finish` for previews).
  - `transform` runs once when a block freezes, and on each provisional tail preview.
- Built-in plugins must not cost anything when unused.

## State (`@prism-ui/state`)

```ts
const store = createStore({ persist?: Adapter, namespace?: string, initial?: Record<string, unknown> })
store.get(path) / store.set(path, value) / store.update(path, fn)
store.subscribe(path | '*', fn) -> unsubscribe        // path = dotted, e.g. "estimate1.items.seats.qty"
store.batch(fn)                                       // one notification
store.undo() / store.redo() / store.canUndo
store.apply(patch: { set?: Record<string, unknown>, merge?: ..., delete?: string[] })  // agent patches
store.snapshot() -> plain JSON
Adapter = { load(ns): object | Promise<object>, save(ns, data): void }  // memoryAdapter(), localStorageAdapter(key), custom
compile(expr: string) -> (scope) => number             // formula engine: + - * / % ^, (), comparisons, ?:, min max round floor ceil abs sum avg if pct; identifiers = store paths. No eval/Function.
```
- Agent patches state in a later reply with a data block: ```` ```ui:state {"set": {"rent": 1500}} ``` ```` (applied once, when the block completes; renders nothing).
- Component instance id = `props.id ?? node.key`; component-owned state lives under that id. Any prop can bind to global state with `bind` / `$ref` (`{"$ref": "rent"}`).

## Schema (`@prism-ui/schema`)

`s.string() s.number({min,max,step}) s.boolean() s.enum([...]) s.array(item) s.object(shape) s.union() .optional() .default(v) .describe(text) .example(v)`.
`schema.coerce(raw)` accepts directive attribute strings ("3" -> 3, "true" -> true, JSON strings), fills defaults, drops invalid fields with warnings (never throws during streaming), and returns `{ value, issues, partial }`.
`toPromptDocs(defs)` produces markdown documenting every registered directive: syntax, props with types/defaults, one example each. Designed to paste into a system prompt.

## React (`@prism-ui/react`)

```tsx
<Prism
  source={text} | stream={AsyncIterable<string> | ReadableStream<string>}
  components={{ chart: MyChart, heading: MyH }}   // override/extend any directive or markdown node type
  plugins={[...]}  store={store}  onAction={fn}  middleware={[mw]}
  theme={theme | 'light' | 'dark' | 'auto'}  density="compact|comfortable|spacious"
  animate={true}  announce={true}  unstyled={false}  locale="en-GB"  currency="GBP"
  slots={{ runbook: { step: MyStep } }}  classNames={{ runbook: { root, step } }}
/>
usePrismStream(stream, opts) -> { root, done }
registerComponent(def) / createRegistry(defs)
def = { name, schema, component, fallback?, docs?, examples?, inline?: boolean, announcement?(props, node, { store, format }): string }
```
- Rendering: each block is a `memo` component keyed by `node.key`, compared by node reference, so frozen blocks never re-render during streaming.
- Accessibility: each root has a hidden polite, atomic announcer. It announces each settled top-level block once, coalescing updates for 700ms and flushing at stream completion. Initially complete/history replies are silent. Components can supply `announcement(props, node)` for a concise accessible summary; otherwise their label/title, value and item count are used, never their rendered DOM. `announce={false}` disables Prism's block and receipt announcements for hosts providing their own live region. Keep the visual streaming container outside live regions. Custom receipt renderers can use `useSentAnnouncement(sent, pastTenseLabel)`; mounting an already-sent receipt is silent.
- `Action = { type, component, id, payload, context, message }`. `context` = component name + props + current state; `message` = a short human-readable sentence ready to send to the LLM. `middleware: (action, next) => void` can log, transform or swallow.
- Shared affordances come from `ComponentFrame`: "Ask about this" (emits `{type:'ask'}` with context), undo (store), focus ring and keyboard handling, `aria-*` labelling, enter animation.
- Headless: every genUI component exports `useX(props, ctx)` holding all logic (state, derived values, actions); the default component only renders it. Users can build their own look on the same hook.

## Theming and styling

- Design tokens as CSS variables, all `--prism-*`: colours (bg, surface, border, text, muted, accent, success, warning, danger, info + `-soft` variants), radius (sm/md/lg), spacing scale, font families/sizes, shadows, motion (durations, easing).
- `light` / `dark` / `auto` (prefers-color-scheme). `createTheme(partialTokens, base?)` -> style object; `theme` on `<Prism>` or `<ThemeScope>` applies it to a subtree.
- Every part: `class="prism-<component>__<part>"`, `data-prism="<component>" data-part="<part>"`, plus state attrs (`data-state="done"`). `classNames` / `styles` per slot. `unstyled` drops the stylesheet classes (keeps data attrs) for a headless render.
- Plain CSS only: `@prism-ui/components/styles.css` (tokens + base) and `@prism-ui/components/<name>.css` per component; no runtime CSS-in-JS.
- `animate=false` or `prefers-reduced-motion` disables all motion.
- `locale`/`currency` drive `Intl` number, date and currency formatting everywhere.

## Directive catalogue (v1)

Markdown nodes are all overridable: `heading paragraph list listItem blockquote code inlineCode table link image hr strong emphasis delete`.

Base:
- Code: fenced code -> `CodeBlock` with built-in lightweight highlighter (js/ts/jsx/tsx/py/bash/sh/json/css/html/go/rust/sql/yaml/diff) + copy button; highlighter is pluggable.
- Markdown tables -> styled sortable table. ```` ```ui:table {"columns":[{"key","label","type":"number|text|date|currency"}],"rows":[...],"pageSize":10} ``` ```` -> `DataTable` (sort, filter, paginate, sticky header).
- ```` ```ui:chart {"type":"line|bar|area|pie","title","x":"month","series":[{"key":"rev","label":"Revenue"}],"data":[...],"insight","annotations":[{"x","label"}],"pivots":[{"label","type?","series?","x?"}]} ``` ```` -> live SVG chart (grows while streaming). With `insight`/`annotations`/`pivots` it is the **Answer chart**: opens on the insight with an annotation, one-tap pivots.
- `::::tabs` + `:::tab{label="…"}`; `:::callout{tone=info|success|warning|danger title="…"}`; `:::card{title subtitle}`; `:::grid{cols=3}`; inline `:badge[New]{tone=success}`.

genUI v1:
1. **Pick-for-me** ```` ```ui:pick {"question","criteria":[{"id","label"}],"weights":{"price":2},"options":[{"id","title","subtitle","scores":{"price":0.8},"pros":[],"cons":[],"tag"}]} ```` — chip row toggles/weights criteria, cards re-rank live (FLIP animation), top card shows "Best for you because …" from its top-weighted scores. Primary action: Choose -> `{type:'choose', payload:{option, weights}}`.
2. **Runbook** `:::runbook{title}` with `:::step{title}` children (markdown body; code blocks get copy). Numbered, tick done, progress bar, "Stuck here?" -> `{type:'stuck', payload:{step, index, title, text, done}}`.
3. **Troubleshooter** ```` ```ui:troubleshoot {"title","start":"a","steps":{"a":{"text","command?","yes":"$fixed","no":"b"}}} ```` — Did this fix it? Yes/No branches; on fixed or dead end, report -> `{type:'troubleshoot', payload:{resolved, path:[{step, answer}]}}`.
4. **Estimate** ```` ```ui:estimate {"title","currency?","items":[{"id","label","price","qty","min","max","step","unit","optional","enabled"}],"taxRate?","discount?"} ```` — steppers, toggles, animated running total. Primary action: Use this estimate -> `{items,total}`.
5. **Answer chart** — see Chart above.
6. **Summary with sources** ```` ```ui:summary {"title","points":[{"text","source":{"quote","title","url"}}],"actions":[{"text","owner","due"}]} ```` — bullets expand to source quote; actions are a checklist with owner avatars. Primary action: Send action items.
7. **Inline ask** ```` ```ui:ask {"title","submit","sentence?","fields":[{"id","label","type":"text|number|select|date|toggle|textarea","options?","value?","required?","hint?"}]} ```` — optional `sentence` uses `{fieldId}` blanks (for example `Book for {party} on {date}.`); unreferenced/long fields appear below. Missing or invalid templates use the fallback form. Use field `unit` for attached suffixes. Prefilled guesses stay muted until edited or confirmed. Submit -> `{type:'submit', payload:{values}}`; the editable receipt reflects middleware-delivered values, including explicit nulls.
8. **Live numbers** inline: `:num[1200]{id=rent min=0 max=5000 step=50 format=currency}` (drag horizontally / arrow keys / click to type) and `:calc[rent * 12]{format=currency}` (formula over store paths, recalculates live).
9. **Mockup + feedback** for web pages, wireframes and graphic designs.
   - Sources: ```` ```mockup:html {meta attrs: title, device=desktop|tablet|mobile, variant="A"} ```` (HTML+CSS), ```` ```mockup:svg ```` (graphic design), ```` ```mockup:wire ```` (wireframe shorthand, below). Consecutive mockup blocks sharing a `group` attr become A/B variants with a switcher and side-by-side compare.
   - Rendering: sandboxed `<iframe sandbox="allow-scripts">` (opaque origin, no same-origin, CSP blocks network except data:/https images) with a tiny injected runtime. While streaming, new HTML is sent via `postMessage` and the runtime morphs `<body>` in place (keyed DOM diff, rAF-throttled), so there is no reload or flash; the frame auto-sizes to content. SVG renders inline after sanitising (no scripts/handlers/foreignObject).
   - Wireframe shorthand: indentation-based lines like `nav: Logo | Home | Pricing | [Sign up]`, `hero: # Title / subtitle / [CTA]`, `grid 3: card*3`, `img 16:9`, `input: Email`, `text*3`; rendered as a clean greyscale low-fi layout (optional hand-drawn style) so agents can sketch quickly and cheaply.
   - Chrome: device toggle (desktop 1280, tablet 834, mobile 390, with scale-to-fit), zoom, fullscreen, view source, variant switcher.
   - Feedback (the primary action) must be free-form and need no instructions. There are no modes to learn and no required tags. Hovering shows a crosshair and "Click to comment". The user can:
     - click any point -> a numbered pin with an inline comment box opens (Enter saves, Esc cancels);
     - drag -> a box around a region with a comment;
     - draw freehand (pen toggle, colour) -> strokes saved as SVG paths in % coords, with an optional comment;
     - write in a general "Overall feedback" box below the mockup.
     Any number of items can be added, edited or deleted (list beside or below, linked to their pins on hover), and undo works. One **Submit feedback** button (disabled until something is entered) sends `{type:'feedback', payload:{mockup, variant, device, overall, items:[{n, kind:'pin'|'region'|'drawing', x, y, w?, h?, path?, comment, target?:{selector, text, html (trimmed)}}]}}` plus a `message` summarising it for the LLM. It works identically on HTML, SVG, wireframe and image mockups (`target` is filled for HTML/SVG elements; for images and raster it is coordinates only). Pins anchor to elements where possible (CSS path + % box) so they survive resizes and re-streams. Drafts persist in the store; the agent's revised mockup can show the previous items as resolved.
   - Performance: one iframe per mockup, lazily mounted when visible (IntersectionObserver); pins are an overlay layer outside the iframe (positions mapped through a single postMessage per layout change); no screenshotting.
10. **Inline artifacts**: full, interactive mini-apps inline in the reply, created extremely easily by the agent.
   - Syntax: ```` ```artifact:html {title="…" height=auto|<px> id=…} ````, `artifact:react` (one JSX/TSX module whose default export is the component; `import` from an allowlisted set: react, react-dom, and the prism component set, with lucide-style icons, d3-scale, date-fns and so on resolved through a pinned import map, vendored/CDN configurable), `artifact:svg`, `artifact:js` (canvas/vanilla), `artifact:markdown`. The same `id` in a later reply = a new version of the same artifact (version switcher + diff of the source).
   - Runtime: reuses the mockup engine's sandboxed iframe (opaque origin, CSP, `sandbox="allow-scripts"`), with in-place morph while streaming HTML/SVG. React artifacts compile in a shared Web Worker with a tiny TS/JSX transform (e.g. sucrase, lazily loaded once and cached; esbuild-wasm optional). They render a skeleton while the code streams and render once the block is syntactically complete. Later edits hot-swap the module and preserve state where possible. Compile and runtime errors show inline with a "Fix this" action that sends the error and source to the agent.
   - Bridge (inside the artifact, `window.prism`): `prism.state.get/set/subscribe(path)` (the shared store, via postMessage, scoped to an allowlist), `prism.send(type, payload)` (onAction), `prism.theme` (tokens as CSS vars injected into the frame so artifacts match the host theme), `prism.resize()` (auto by default).
   - Chrome: title, view code (highlighted), copy, download (.html standalone / .tsx), open fullscreen, reload, version switcher. Host can disable artifacts or restrict the import map.
   - Performance: lazy mount when visible, one compiler worker shared across artifacts, compiled output cached by source hash, frames recycled from a pool, no main-thread compile.
11. **Freeform UI** (`ui:view`): lets the agent compose any interface without code execution.
   - A JSON tree (relaxed JSON, streams node by node) of safe primitives: `stack` (row/column, gap, align), `grid`, `box/card`, `text` (markdown inline), `heading`, `stat`, `badge`, `image`, `icon`, `divider`, `button`, `input`, `select`, `toggle`, `slider`, `checkbox`, `list` (with `each` over a store array), `table`, `progress`, `avatar`, `tabs`, plus any registered directive by name (`{"type":"chart", ...}`).
   - Bindings: `"value": {"$bind": "path"}` (two-way to the store), `{"$ref": "path"}`, `{"$calc": "expr"}` (formula engine), `"when": "expr"` for conditional display, `"onClick": {"action": "type", "payload": {...}}` or `{"set": {"path": value}}`.
   - Styling only through tokens (`tone`, `size`, `variant`, `gap: 1–8`, `pad`, `width`), never raw CSS, so it always looks on-brand. `className` is allowed only when the host opts in.
   - Rendering is a single recursive renderer, memoised per subtree by reference.

## Performance rules

- No component re-renders unless its node reference or its subscribed store paths change (`useSyncExternalStore` per path).
- Charts compute scales in a memo, render with plain SVG paths; no chart library.
- Highlighter is a single-pass scanner; tokenisation is cached per (lang, code) and incremental for open code blocks.
- Bundle budget (min+gzip-9): each component's own JS defaults to 4 KiB; shared internals and CSS are charged separately. Runtime caps and documented heavy-component exceptions live in `size-budgets.json`, enforced by `bun run size` in CI. See `scripts/README.md` for accounting and Markdown output.
