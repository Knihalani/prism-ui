# Prism chat demo

Run `bun run dev` from the repository root. Build with `bun run --cwd apps/playground build`; preview with `bunx vite preview --host 0.0.0.0` in this directory.

A minimal chat interface, with a registry-backed sidebar of working examples. Messages stream eight characters every 20ms through `<Prism>`. Enter sends; Shift+Enter inserts a newline; Stop cancels the current response. Picking another example interrupts the previous response. This is a local, keyword-routed demo, not an AI connection.

All assistant messages share one localStorage-backed store. Each reply gets its own explicit component IDs, so repeated demos do not collide. New chat clears the thread and resets the playground persistence namespace. Thread text itself is not persisted. The store/persistence module and reusable parser fixtures are retained.

Component actions become user messages with expandable JSON payloads; their scripted replies queue behind any active response. Copy stays local without adding chat messages. Stop, New chat, or another prompt/example cancels queued replies. Only sending a typed prompt or starting New chat clears the composer draft. Submitting an estimate demonstrates an agent state patch by increasing its seat count by one (up to 25).

`src/catalogue.ts` defines grouped, realistic examples and routing keywords; newly registered components are also discovered from the registry. Both artifact and mockup plugins are enabled. Mockup images use a local SVG; React artifacts use the artifact package’s pinned CDN compiler/import map.

Tests: `bun test apps/playground/test`. The production build typechecks the app as well as bundling it.
