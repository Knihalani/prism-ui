# Prism playground

A quiet, conversational demo of generative UI. Start with one of six scenarios, type a natural-language request, or open **Components** with Ctrl/Cmd+K to explore the complete catalogue. Component choices stay in place: the assistant continues underneath, without exposing payloads or syntax.

Run `bun install` at the repository root, then `bun run --cwd apps/playground dev` (port 5173). Build with `bun run --cwd apps/playground build`; test with `bun test --cwd apps/playground test`.

The default scripted agent streams realistic responses with interactive laptop, Kyoto, deploy, landing-page, offsite and research scenarios. The offsite estimate demonstrates an agent patch updating an earlier component. Copy actions stay local; other interactions queue behind an active reply. Stop cancels the stream and its queued continuations. Regenerate replaces the last assistant reply.

Settings can connect OpenAI or Anthropic directly from the browser. Provider, model and API key are saved locally as `prism-agent`; keys are sent only to the selected provider. Use a private browser on a trusted device. Environment defaults: `VITE_PRISM_PROVIDER`, `VITE_OPENAI_API_KEY`, `VITE_ANTHROPIC_API_KEY`, and optional `VITE_PRISM_MODEL`. Component gallery examples always use the scripted agent, even with a live model connected.

Conversations and drafts remain in memory for the current session, each with its own agent and namespaced state store. New chat starts with fresh state; switching conversations preserves the previous thread. Light, dark and system themes, reduced motion, keyboard navigation and a mobile conversation drawer are supported.

`src/agent/` contains the pluggable agent interface, scripted scenarios, routing and SSE adapters. `src/catalogue.ts` and `src/fixtures.ts` provide catalogue examples. The UI consumes `thinking`, `text`, `title` and `patch` events; patches apply to the same store that renders the conversation. Tests inject a zero-delay pace and mock live agents without making external requests.
