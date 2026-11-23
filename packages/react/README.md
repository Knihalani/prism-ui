# @prism-ui/react

React 18+ bindings for Prism's streaming AST, shared store and component schemas. No runtime styling dependency; import the component package's plain CSS when using its views.

## Quick start

```tsx
import { Prism } from '@prism-ui/react';

<Prism source={'# Hello\n\nA **streaming** answer.'} onAction={console.log} />;
// Keep the parser open while appending tokens. Finish once the reply ends:
<Prism source={growingText} done={false} />;
// Or pass an AsyncIterable or ReadableStream (string / Uint8Array chunks):
<Prism stream={replyStream} />;
```

Growing `source` pushes only its appended suffix while `done={false}`. Completed blocks and inline nodes retain references and are memoized. `done` defaults to true; changing an already-ended source starts a new parser. Replacing a non-prefix source or changing `plugins` also resets parsing. Keep plugin arrays and customization maps stable between streaming renders.

`usePrismStream(stream, { plugins, throttle: 'raf' })` returns `{ root, done, error }`. It coalesces renders per animation frame (16 ms timeout fallback); a numeric throttle uses milliseconds. Changing streams or unmounting cancels consumption and pending updates. Byte chunks are decoded incrementally as UTF-8. Errors are exposed by the hook, not thrown during rendering.

## Prism props

| Prop | Purpose / default |
| --- | --- |
| `source`, `done` | Markdown string; `done=true` finalizes it |
| `stream` | AsyncIterable or ReadableStream; takes precedence over source |
| `plugins` | Core parser plugins; keep array identity stable |
| `components` | Overrides keyed by markdown type or directive name |
| `registry` | Component definitions; defaults to `defaultRegistry` |
| `store` | External store; otherwise a store is created once |
| `persist`, `namespace` | Persistence adapter and namespace for the owned store |
| `onAction`, `middleware` | Final action handler and ordered middleware |
| `theme` | `light`, `dark`, `auto` (default), or `createTheme()` CSS variables |
| `density` | `compact`, `comfortable` (default), `spacious` |
| `animate`, `unstyled` | Motion enabled by default; unstyled defaults to false |
| `locale`, `currency` | Runtime Intl locale when omitted; currency defaults to `USD` |
| `slots`, `classNames`, `styles` | Nested maps keyed by component and part |
| `className`, `style` | Added to the root ThemeScope |

## Registry and renderers

Private editor models can set `requiresFinalId: true` on their definition. The renderer waits for a final identity, hydration, and any migration before mounting that component. Closed top-level JSON ids and directive/fence headers can establish identity before the body finishes; anonymous JSON models wait until the object closes. Their mounted model therefore keeps its undo history, pending operations, and subscriptions throughout the remaining stream. Mockup opts into this policy. Other components continue rendering under provisional ids as before. Parser plugins can set `node.idComplete = true` when their identity-bearing header is sealed.

`createRegistry(defs?)` gives `register(def)`, `get(name)`, `list()` and `docs()`. `registerComponent(def)` adds to the module-level `defaultRegistry`; use isolated registries for separate catalogs. `defineComponent(def)` preserves schema inference. Definitions include `name`, optional `schema`, `component`, `fallback`, `docs`, `examples`, `inline`, `syntax` and `message`.

Resolution is `components[name or type]` → registry definition → built-in markdown → unknown directive (a div with `data-prism="unknown" data-name="…"` and its children). Registry schemas still coerce props for directive overrides. Fallbacks render only when both incomplete and partial. Components receive `{ node, props, children, id, complete, partial, issues }`; `id` is `props.id ?? node.key`.

`toPromptDocs(registryOrDefs)` / `registry.docs()` produce compact prompt-ready markdown with syntax, schema metadata and examples. Exported markdown renderers include `Heading`, `Paragraph`, `Text`, `List`, `ListItem`, `Blockquote`, `Code`, `InlineCode`, `Table`, `TableRow`, `TableCell`, `TableHeader`, `Link`, `Image`, `ThematicBreak`, `Strong`, `Emphasis`, `Delete`, `Break` and the `defaultRenderers` map. Their props are `MarkdownProps = { node, children }`.

## Theming, parts and slots

```tsx
import { createTheme, ThemeScope } from '@prism-ui/react';
const theme = createTheme({ accent: '#2563eb', onAccent: '#ffffff', radiusMd: '12px' });
<ThemeScope theme={theme} density="compact" animate={false} as="section">…</ThemeScope>;
<Prism source={text} theme={theme} classNames={{ card: { root: 'my-card' } }}
  styles={{ card: { root: { borderWidth: 2 } } }} slots={{ card: { title: MyTitle } }} />;
```

`createTheme(partialTokens, base?)` merges a token base or an existing CSS-variable style object. Camel-case tokens become `--prism-kebab-case` variables. `Tokens` includes colours such as `textMuted`, `accent`, `onAccent`, `positive`; `fontBody/Display/Mono/Numeric`; type sizes and weights; radius and spacing; `elevation1/2/3`; and `motionFast/Base/Slow`, easing and spring roles. Values are CSS strings. See [THEMING](../../docs/THEMING.md) for the full contract. Prism imports a small presentation stylesheet. The consuming theme and component library supply the rest of the visual styles.

ThemeScope emits `data-prism-theme`, `data-density`, and `data-animate="false"` when disabled. Reduced-motion preference also disables motion. Prism's wrapper always has `prism-root`, including in unstyled mode.

`usePart(component, part, state?)` supplies `className`, `style`, `data-prism`, `data-part`, and optional `data-state`. Classes are `prism-${component}__${part}` plus the classNames override. `unstyled` removes generated part classes, not custom classes or data attributes. `useSlot(component, part, Default)` selects a replacement view. `cx()` joins conditional classes. `usePrism()` exposes the stable configuration context.

## Actions

`useEmit()` returns `emit(type, payload?, message?)` inside a directive. Actions contain `{ type, component, id, payload, context: { component, props, state }, message }`; state is the current value under the component id. Message selection is explicit message → definition's `message(action)` → exported `message(action)` builder. Ask defaults to “Tell me more about this …”; other actions include compact, truncated payload JSON.

```tsx
<Prism source={text} middleware={[
  (action, next) => { console.log(action); next(action); },
  (action, next) => { if (action.type !== 'ignored') next({ ...action, message: 'Customized' }); },
]} onAction={action => sendToAgent(action.message, action)} />;
```

Middleware runs in order. Not calling next swallows the action; passing a replacement transforms it. The final next calls onAction.

## Streaming and presentation

Prism marks the reply root with `data-state="streaming"` while input is open and `data-state="ready"` at completion. The default Markdown caret is decorative and follows the last rendered prose block without changing its measure. Empty open code fences wait for content or completion before rendering. A code renderer override, registered skeleton, or registered fallback can show a placeholder. With a custom Markdown renderer, use `<StreamCaret />` at the text tail when that view is streaming.

- `useSettled()` becomes true when the directive is final and its store identity is ready. A directive can be settled while the rest of the reply is streaming.
- `usePresentation()` gives the existing component root `data-state="streaming|ready|sent"` and a CSS entrance marker `data-entering`. Spread it onto the root or let a shared frame forward it. Where a root already uses `data-state` for other semantics, expose the presentation state on an adjacent element or use a separate attribute in that view.
- Set `--prism-enter-delay` on items with their own `data-entering` to stagger a batch. Use a bounded delay from the item's insertion index and keep React keys stable as new items arrive. A view that owns its removal can pass `{ exiting: true }` to emit `data-exiting` while it is still mounted. The renderer removes blocks as soon as they leave the parsed document.
- Define `skeleton` to reserve a directive's layout while its props or state identity settle. It receives the same view props with empty children. Give it the same width, responsive row slots, gaps and intrinsic height as the real view. `StreamSkeleton` marks decorative markup as hidden from assistive technology. Use `data-prism-skeleton-line` on each placeholder with `--prism-skeleton-width` and `--prism-skeleton-height` to size it. Keep controls and state initialization in the real component. The existing `fallback` option is still available for schema-partial previews.
- `useSent()` exposes `{ sent, send, reset }`. Call `send(type, payload, message?)` for the primary action. The component and its frame share a receipt after the final `onAction` handler runs. The receipt contains the action delivered through middleware. Use its payload for a stable past-tense label such as “Sent · 6 seats, $324”, then call `reset()` on edit. Keep the primary pill and inputs mounted so focus and layout are preserved. `sent` records dispatch to the application handler, independent of any asynchronous delivery confirmation the app owns. Ordinary `useEmit()` actions (such as Ask) can continue independently.
- `useFlash(path)` accepts a store path or a readonly array of dependency paths and is true for about 600ms after another component or the host changes a subscribed value. Set `data-prism-flash={flash ? '' : undefined}` on the value. Pair this with the component's animated value and honor `usePrism().animate` for tweening. `useComponentState` marks its own writes automatically. For custom synchronous store writes, call `useLocalWrite()` during render and wrap the outer write or batch with the function it returns.

Use the surrounding prose's typography and flow spacing. Keep skeletons and nested components flush to that same edge. Use the shared component primitives for pills, chips, switches, steppers, checkboxes and icon buttons. With reduced motion or `animate={false}`, the caret, skeleton and highlight render as static cues.

## Store, formulas and agent patches

- `useStore()` returns the shared store.
- `useStoreValue<T>(path)` subscribes only to that path via useSyncExternalStore.
- `useComponentState(key, initial)` returns `[value, set]` at `${id}.${key}`; setters accept values or updater functions.
- `useFormula(expr)` subscribes to compiled dependencies and returns a number (NaN for invalid formulas).
- Nested `{"$ref":"rent"}` values in directive props resolve before schema coercion and subscribe only their directive to the referenced paths.

Create or persist stores with `@prism-ui/state` (`createStore`, `memoryAdapter`, `localStorageAdapter`). Supply `store` to share across Prism instances. For an owned store, supply `persist` and `namespace`.

Component state IDs (including the `props.id` passed to a component) use an opaque, flat provisional key containing message scope, component name, node key and ownership generation. Scope strings are escaped and node-path dots become colons, so nested components own independent store namespaces. Reopening a completed component or changing its final ID starts fresh ownership: a named component never migrates an earlier anonymous component's state. Ordinary same-ID prop updates retain existing edits. Each Prism instance generates its own scope with `useId`; supply a stable, unique `scope` prop when restoring anonymous state across remounts. Completed, frozen parser nodes use the explicit ID when present; anonymous components keep their scoped key. The parser does not expose individual ID-field closure, and inline/leaf completion flags can precede attribute finalization, so freezing is also required.

Components wait for `store.ready` before initializing any state, even if their stream is already complete. Once hydrated, controls stay mounted on their owned provisional ID until preparation completes. Migration runs after child state effects in one batch with `{ history: false }`, then switches to the final ID without remounting the controls. Preparation completes once, regardless of whether a provisional parent path remains present. Unsafe prototype-path IDs keep the safe scoped key instead. Existing persisted final-ID fields win conflicts; missing fields are filled from provisional state. Explicit IDs intentionally share state across Prism instances.

Completed `ui:state` fences render nothing and apply a single patch in a layout effect:

````md
```ui:state
{"set":{"rent":1500},"merge":{"estimate":{"tax":0.2}},"delete":["old"]}
```
````

Only finalized, frozen patches apply. Patches are deduplicated by node reference and a per-Prism signature of block key plus serialized props, including strict-effect replays. Different patches at the same key still apply; use a new Prism `key` to intentionally replay an identical patch in a new reply.

## Formatting

`useFormat()` exposes `locale`, `currencyCode`, `number(value, options?)`, `currency(value, code?)`, `percent(value)`, `date(value, options?)` and `compact(value)`. Omitted `locale` stays `undefined` and uses the runtime's Intl default; omitted `currency` uses `USD`. Intl formatters are cached by locale and options. Percent uses fractional values (0.25 → 25%). Dates accept Date, timestamp or a date string; pass a timezone option for timezone-independent output.

## Plugins

Pass core `Plugin[]` through `plugins`. Inline extensions, block extensions and transforms run in the core parser in both source and stream modes. See `@prism-ui/core` for hook contracts. Built-in markdown can also be overridden without parser plugins through `components` or the registry.

## Writing a component

Keep logic in a headless hook and appearance in replaceable views:

```tsx
import { s } from '@prism-ui/schema';
import { defineComponent, registerComponent, useComponentState, useEmit,
  usePart, useSlot, usePrism, type PrismComponentProps, type PrismContextValue } from '@prism-ui/react';

const schema = s.object({ id: s.string().optional(), title: s.string() });
type Props = { id: string | undefined; title: string };

export function useCounter(props: Props, ctx: PrismContextValue) {
  const [count, setCount] = useComponentState('count', 0);
  const emit = useEmit();
  return { title: props.title, count, animate: ctx.animate,
    increment() { setCount(n => n + 1); },
    submit() { emit('choose', { count }); } };
}
const Title = ({ children }: { children: React.ReactNode }) => <h3>{children}</h3>;
export function Counter({ props }: PrismComponentProps<Props>) {
  const vm = useCounter(props, usePrism());
  const part = usePart('counter', 'root');
  const Heading = useSlot('counter', 'title', Title);
  return <section {...part}><Heading>{vm.title}</Heading>
    <button onClick={vm.increment}>{vm.count}</button>
    <button onClick={vm.submit}>Choose</button></section>;
}
registerComponent(defineComponent({ name: 'counter', schema, component: Counter,
  docs: 'An editable counter.', examples: ['::counter{title="Seats"}'], syntax: 'leaf' }));

// Same headless logic, entirely different presentation:
function MyCounter({ props }: PrismComponentProps<Props>) {
  const vm = useCounter(props, usePrism());
  return <button onClick={vm.increment}>{vm.title}: {vm.count}</button>;
}
<Prism source={'::counter{title="Seats"}'} components={{ counter: MyCounter }} />;
```

The headless hook owns subscriptions, state and action logic. The default view uses parts, slots and the emit API; overrides can reuse the same hook or replace individual slots without copying logic. Provide a `fallback` definition when partially streamed props need a special placeholder.

## Development

From the workspace root: `bun install`, `bun test`, `bunx tsc --noEmit`. React test files import `./setup` before React DOM/testing imports; no global Bun preload is installed.
