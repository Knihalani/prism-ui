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
Only Num, Calc and Chart are included in the landing island's registry. Other
routes do not download the landing island or its component styles.

The landing streams once on hydration and can be replayed. It reserves the final
reply's measured height to avoid moving content below it. Reduced motion keeps
the final state, including when the preference changes during a replay. There
are no remote fonts, network model calls, analytics or third-party scripts.

Stage 1 includes the landing and route scaffolds for gallery, component and theme
pages. Live gallery examples, schema/parts/strings references and the five-theme
comparison are subsequent stages, not duplicated here as hand-written data.

`bun test` automatically discovers `test/*.test.*`. Route and server-rendering
coverage always runs. The built-HTML link check additionally runs when `dist`
exists; build first to include that check. It verifies CSS/scripts and local
navigation, except the separately deployed playground editor URL.
