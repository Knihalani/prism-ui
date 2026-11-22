# @prism-ui/core

Dependency-free streaming markdown-to-UI AST, with safe HTML and keyed vanilla DOM renderers. Bun + strict TypeScript.

```ts
import { createParser, parse, renderToString, mount } from '@prism-ui/core';
const parser = createParser();
const view = mount(document.querySelector('#app')!);
view.update(parser.push('# Hello\n\n**live').root);
view.update(parser.push(' text**').root);
view.update(parser.end().root);
const html = renderToString(parse('Hello **world**'));
```

## Syntax

- ATX and setext headings (`Title` followed by `===` or `---`), paragraphs, blockquotes, nested ordered/unordered lists, task checkboxes, thematic breaks.
- Backtick/tilde fenced code: language and remaining metadata are preserved.
- GFM pipe tables, alignment, strikethrough; emphasis, strong, code spans, links, images, URL/email autolinks, escapes and hard breaks.
- Full `[label][id]`, collapsed `[id][]`, shortcut `[id]` and image references. Definitions such as `[id]: /url "title"` may follow their uses; labels ignore case and collapse whitespace. First definition wins; missing definitions remain literal.
- Closed code spans (matching backtick-run lengths), links and autolinks take precedence over surrounding emphasis. Unclosed backticks are literal at finalization: ``*a `b*c` `` has no emphasis, while ``*a `b*c`` becomes emphasis around ``a `b``, followed by `c`.
- HTML is always literal text, not executable markup. Unsafe link/image schemes are stripped; raster base64 image data URLs are allowed.
- `:::card{title="Hello" count=3 flag}` followed by markdown and a closing `:::` creates a component. Use more colons for outer nesting: `::::tabs` around `:::tab`.
- `::divider{tone=muted}` creates a leaf component.
- `:badge[New]{tone=success}` creates an inline component.
- A code fence with language `ui:chart` creates a component from its JSON object body. Unquoted keys, single quotes and trailing commas are accepted. Incomplete strings/arrays/objects produce best-effort live props. No eval, comments or executable expressions.
- Attributes accept strings, numbers, booleans, flags, arrays and objects: `{items=[1,2] config={tone:'info'}}`.

This is CommonMark-ish, not a CommonMark conformance implementation: indented code, complex delimiter flanking and lazy blockquote continuations are not implemented. Unclosed strong/strike markup remains styled for generative-output previews, including at end of input.

## AST and updates

`parse(text): Root` is equivalent to pushing all text and ending. `createParser()` exposes `push(chunk): Update`, `end(): Update` and `root`. Updates expose the current root lazily; read it immediately for a snapshot. Pushing after end throws; repeated end is safe. CRLF and CR normalize to LF across chunk boundaries.

Nodes are plain `{type, key, ...}` objects; keys are dot-separated block/child index paths. Components carry `{type:'component', name, props, children, key, complete}`. Finished blocks, descendants and props are deeply frozen and reused by reference. A block containing unresolved forward references stays provisional until those definitions arrive or `end()` makes missing references literal. Open tails are provisional, including bold text, fences and JSON. Closing a stream does not claim an unclosed fence/container is syntactically complete.

Streaming retains block, fence, inline and JSON scanner state. Paragraph previews tokenize only bytes added since the previous preview, with open delimiter/token state retained. Publication is lazy: reading an open child publishes a new block wrapper; reading just `root` does not materialize that child's inline preview. At finalization, ambiguous inline syntax is resolved once by the same precedence-aware parser as one-shot parsing. Fences append; containers delegate to nested parsers; JSON scalars update their current slot without copying ancestor arrays/objects. Freezing happens at block finalization, not per push.

Root children provide a read-only, array-compatible Proxy over a persistent 32-way vector and an open-tail overlay. Adding/replacing a completed block copies O(log₃₂ b) vector slots, not all b block references. Reading `root` is O(1) between block-boundary/reference changes. Retained open views are live/provisional, not immutable snapshots; copy or serialize them if a historical preview is needed. Frozen completed node references remain stable.

For the measured paragraph, fence, container and JSON cases, total streaming parsing work and retained state are approximately O(n) in input bytes, plus persistent-vector updates and final AST freezing. Nested parsing scales with nesting depth. This is not a worst-case linear bound for every malformed Markdown delimiter pattern. Rendering or serializing the entire growing tree on every token remains output-sensitive and can be O(n²); throttle rendering independently. The scaling test doubles long open blocks using four-character pushes and requires a minimum-of-seven timing ratio ≤2.6.

`renderToString(root, {components: {card: (node, childrenHtml) => string}})` escapes all built-in output. Custom renderers return trusted HTML and own their escaping. Unknown components fall back to `<div data-prism-component="card">…</div>`.

`mount(element, {components: {card: (node, document) => DOMNode}})` returns `{update(root)}`. The mount owns the element's child list; identical top-level block references are never mutated or moved. Changed blocks replace their subtree; custom components can return functional DOM nodes with event listeners. No browser globals are needed until mounting.

## Development

From the monorepo root: `bun install`, `bun test`, `bun run typecheck`, `bun run bench`.
The benchmark covers a mixed document, a single paragraph and a single `ui:table` JSON block, each approximately 200KB in four-character chunks. It reads every prism root, but does not traverse/render every preview; open child publication is lazy. Baselines build ASTs by fully reparsing every prefix with marked and markdown-it (dev dependencies only); they treat directives as ordinary Markdown rather than functional components. One-shot values average ten warmed runs; stream throughput counts input bytes once, not the baseline's repeated bytes. Run `bun run bench prism-ui` to omit the expensive full-prefix baselines, or `bun run bench prism-ui mixed` to select one case. Run on an idle machine; these are synthetic workloads, not conformance or worst-case complexity benchmarks.
