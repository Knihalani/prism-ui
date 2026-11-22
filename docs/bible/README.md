# Prism design bible

`index.html` is the interactive reference for every component (open it directly in a browser). `IDENTITY.md` defines the Refraction tokens, type, motion and per-component specs. Components in `packages/components` should match the bible pixel for pixel.

To compare the foundation components with the reference, run `bun install` and start Vite from the repository root.

```sh
bun apps/playground/node_modules/vite/bin/vite.js
```

Open `/docs/bible/index.html` and `/packages/components/examples/refraction/` on the Vite server. The comparison renders the actual Prism packages and includes the callout tone picker and plan receipt, tab checklist receipt, and code explanation as example compositions.
