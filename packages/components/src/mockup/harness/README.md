# Mockup browser harness

From the repository root:

```sh
bun packages/components/src/mockup/harness/serve.ts
```

Open http://127.0.0.1:3417/. Use `?only=1` through `?only=5` for HTML,
wireframe, SVG, image, and grouped HTML respectively. Add `&theme=dark` for dark mode.
Stream replays the actual Markdown through Prism; submitted actions appear in the action log.
The server builds once using the Bun CLI; restart after editing. Generated bundles are ignored.
Keep screenshots outside the repository (for example `~/mockup-shots/`).
