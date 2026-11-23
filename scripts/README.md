# Size budgets

Use the Bun version pinned in `.bun-version`:

```sh
bun run size
bun run size --markdown
bun run size --markdown --grammars
bun run size --json
bun run size --json --fixtures --chunks
```

The command always enforces `size-budgets.json` and exits nonzero on an
over-budget entry. The default table is also Markdown, suitable for a PR.
JSON output includes rows and violations. Values are bytes, gzip level 9.

Each public component index is a minified browser ESM bundle. `react`,
`react-dom`, their subpaths and `@prism-ui/*` packages are external. Frame,
shared controls, all production `lib` modules, common icons, strings,
interpolation and common styles are externalized for **own** component cost.
Synthetic internal module names are used only for measurement; these bundles
are not distributable artifacts. Tests and benchmarks are never bundled.

The **shared** entry exports those internal modules once and includes common
styles. Namespaced exports retain all utilities, not just the subset a single
component would use. **Full** is the arithmetic sum of own + the entire shared
entry, not a tree-shaken standalone consumer bundle; do not compare it with
older standalone-bundle measurements. Moving reusable logic to shared can
reduce own size while increasing this conservative full number for other
components. React/core/state/schema are measured separately, never added to
full. Frame is counted in shared, not as a second component.

JS includes the entry and **all** dynamic/shared chunks, each independently
gzipped. Initial/deferred numbers are printed for split entries; deferring
code cannot hide it from a budget. CSS includes emitted styles and the
component's exported companion stylesheet, deduplicated and gzipped together.
Common styles belong to shared. Neither React itself nor React DOM is bundled.

The default component budget is 4096B for JS and CSS. Every higher cap has a
one-line reason; initial exceptions have approximately 5% headroom. Prefer
reducing size to raising a cap. There is no lazy highlighter: `--grammars`
reports independent eager grammar bundles (including their helper imports),
so those grammar numbers are not additive. All grammars are charged once to
shared. No safe grammar duplication was found to remove.

View demo/test data has an explicit entry:

```ts
import { views as viewFixtures, gallery as viewGallery } from '@prism-ui/components/view/fixtures';
```

The old `viewFixtures` and `viewGallery` aliases remain public through both
the root and `./view` entries. The gallery's pure initializer lets Bun remove
the fixture module when importing `View` from `./view`. `--fixtures` checks
the actual consumer graph, not just gzip equality (chunk hashes can differ).
The root consumer currently still retains 8,593 minified fixture bytes;
root-level fixture tree-shaking is an unresolved limitation, not a claimed
win. Prefer subpath imports for lean consumers. The view definition retains
its compact built-in example; the playground imports fixtures explicitly.

`--chunks` reports Artifact's emitted chunks, metafile ownership, duplicated
modules and the compression difference between independent chunk gzip and
concatenated chunk text. Concatenation is a compression diagnostic, not a
distributable JS bundle. All actual chunks remain charged to the budget.
