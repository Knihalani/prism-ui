# Prism site

```sh
bun install
bun run --cwd apps/site dev
bun run --cwd apps/site build
bun run --cwd apps/site preview
```

Set `SITE_BASE=/prism-ui/` for a GitHub Pages project deployment. The default is `/`.
The build writes a real HTML document per route into `dist`, including `404.html`.
No SPA fallback or server runtime is required. Deploy the playground separately at
`<base>playground/` to enable the theme-editor link.

`src/routes.ts` imports the actual component registry on the server. Top-level
`docs/*.md` files become documentation routes; Markdown and syntax highlighting run
only in `scripts/render.tsx`, never in the browser. Relative source-repository
links become GitHub links and links between the six docs become site links.

The page shell is static React-rendered HTML. `src/client.ts` progressively adds
mode and copy controls; it dynamically imports only the islands found in the
document. The landing island is independently server-rendered and hydrated with
the same identifier prefix, source, registry and initial store. Its CSS is linked
in the prerendered head, so the complete final reply is styled with JavaScript off.
Without JavaScript, the chart exposes its native semantic data table instead of
an unmeasured SVG. The values stay readable at narrow widths without hydration.
Only Num, Calc, Chart and Ask are included in the landing island's registry. Other
routes do not download the landing island or its component styles.

The landing streams once on hydration and can be replayed. It reserves the final
reply's measured height to avoid moving content below it. Reduced motion keeps
the final state, including when the preference changes during a replay. There
are no critical-path web fonts, network model calls, analytics or third-party scripts.

The gallery index uses inert, server-rendered previews and hydrates no examples.
Each component has a separate island entry, importing its definition and CSS by
package subpath. Its shared example runtime provides example selection, streaming
replay, and example-only theme/mode controls. Each theme is dynamically imported;
its fonts are requested once, only after selection. The host site uses system
fonts, so loading example fonts does not change the page shell.
Mockup's browser-visibility gate does not produce a hydration-stable first render.
Its island therefore hydrates the server HTML as a snapshot before mounting the
live content in an effect; its complete prerendered preview stays readable with
JavaScript off. Other component islands hydrate their Prism tree directly.
The index uses script-disabled sandbox frames for static HTML/SVG media previews,
derived through the real fence plugins; neither media preview runs JavaScript.

Component references derive props, nested types, parts, strings and examples from
the registry. Source highlighting runs at build time. The five-theme comparison
page remains a scaffold for the next stage.

`bun test` automatically discovers `test/*.test.*`. Route and server-rendering
coverage always runs. The built-HTML link check additionally runs when `dist`
exists; build first to include that check. It verifies CSS/scripts and local
navigation, except the separately deployed playground editor URL.
