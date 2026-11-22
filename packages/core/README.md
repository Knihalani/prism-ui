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

- ATX headings, paragraphs, blockquotes, nested ordered/unordered lists, task checkboxes, thematic breaks.
- Backtick/tilde fenced code: language and remaining metadata are preserved.
- GFM pipe tables, alignment, strikethrough; emphasis, strong, code spans, links, images, URL/email autolinks, escapes and hard breaks.
- HTML is always literal text, not executable markup. Unsafe link/image schemes are stripped; raster base64 image data URLs are allowed.
- `:::card{title="Hello" count=3 flag}` followed by markdown and a closing `:::` creates a component. Use more colons for outer nesting: `::::tabs` around `:::tab`.
- `::divider{tone=muted}` creates a leaf component.
- `:badge[New]{tone=success}` creates an inline component.
- A code fence with language `ui:chart` creates a component from its JSON object body. Unquoted keys, single quotes and trailing commas are accepted. Incomplete strings/arrays/objects produce best-effort live props. No eval, comments or executable expressions.
- Attributes accept strings, numbers, booleans, flags, arrays and objects: `{items=[1,2] config={tone:'info'}}`.

This is CommonMark-ish, not a CommonMark conformance implementation: reference links, setext headings, indented code, complex delimiter flanking and lazy blockquote continuations are not implemented.

## AST and updates

`parse(text): Root` is equivalent to pushing all text and ending. `createParser()` exposes `push(chunk): Update`, `end(): Update` and `root`. Updates expose the current root lazily; read it immediately for a snapshot. Pushing after end throws; repeated end is safe. CRLF and CR normalize to LF across chunk boundaries.

Nodes are plain `{type, key, ...}` objects; keys are dot-separated block/child index paths. Components carry `{type:'component', name, props, children, key, complete}`. Finished blocks, descendants and props are deeply frozen and reused by reference. Open tails are provisional, including bold text, fences and JSON. Closing a stream does not claim an unclosed fence/container is syntactically complete.

Completed input is scanned once. Only the uncommitted tail is reparsed when a root is read. **Complexity is output-sensitive:** a single indefinitely growing paragraph, list, container or data block can incur quadratic preview work if every token requests a full AST; completed blocks are never reparsed. Roots also copy the top-level child reference array. Batch root reads for very large live blocks. There is no unconditional linear-time guarantee for adversarial open tails.

`renderToString(root, {components: {card: (node, childrenHtml) => string}})` escapes all built-in output. Custom renderers return trusted HTML and own their escaping. Unknown components fall back to `<div data-prism-component="card">…</div>`.

`mount(element, {components: {card: (node, document) => DOMNode}})` returns `{update(root)}`. The mount owns the element's child list; identical top-level block references are never mutated or moved. Changed blocks replace their subtree; custom components can return functional DOM nodes with event listeners. No browser globals are needed until mounting.

## Development

From the monorepo root: `bun install`, `bun test`, `bun run typecheck`, `bun run bench`.
The benchmark consumes approximately 200KB in four-character chunks and reads every prism update. Baselines build ASTs by fully reparsing every prefix with marked and markdown-it (dev dependencies only). One-shot values average ten warmed runs; stream throughput counts input bytes once, not the baseline's repeated bytes. Run on an idle machine; this is a synthetic mixed document, not a conformance or worst-case complexity benchmark.
