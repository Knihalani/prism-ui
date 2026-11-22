# Highlight

The default entry includes all built-in languages:

```ts
import { highlight, tokenize, createIncremental } from './highlight';

highlight('const answer = 42;', 'typescript');
// <span class="prism-tok-keyword">const</span> ...
const stream = createIncremental('ts');
stream.update('const answer');
stream.update('const answer = 42;');
stream.tokens();
stream.reset();
```

For only chosen languages, import the language-free core:

```ts
import { createHighlighter } from './highlight/core';
import { javascript } from './highlight/languages/js';

const highlighter = createHighlighter({ languages: [javascript], cacheSize: 32 });
```

`defineLanguage(name, initialState, scan, aliases?)` creates a language definition.
`scan(line, state, emit)` receives one line including its newline, if present.
Emit `(type, text)` in source order, including whitespace, without dropping text.
Return a new state when changing it: incremental checkpoints retain prior states.
Register using `registerLanguage(name, definition, additionalAliases?)`.

Tokens are lossless and adjacent equal types merge, including across line breaks.
HTML is escaped and uses line-scoped spans so completed lines can reuse their HTML.
Unknown languages remain escaped plain text. The scanners are lexical heuristics,
not validating parsers; JS regex/division and JSX/generic disambiguation are heuristic.

Incremental updates rescan only the unfinished line and new text after unchanged
newline checkpoints. Edits invalidate checkpoints from the first changed line.
Prefix verification still compares the input strings; returning or consuming a flat
full HTML string necessarily costs its length. Built-in updates retain string ropes
and cached per-line HTML rather than rebuilding the entire output.

`setHighlighter(backend)` swaps HTML rendering (and tokenization when supplied)
for supported languages. Unsupported languages use the built-ins. Call without an
argument to restore the built-ins. Backends receive canonical language names (e.g. `js`).
External backends supply trusted HTML and use
full highlighting during incremental updates, since their interface has no line state.

Import `highlight.css` for light/dark token colors; override `--prism-tok-*` variables.
Run `bun run packages/components/src/lib/bench.ts` from the repository root to compare
uncached rendering and streaming. `--oneshot` skips the slower naive streaming run.
