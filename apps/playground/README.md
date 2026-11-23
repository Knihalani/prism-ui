# Prism playground

A quiet, conversational demo of generative UI. Start with one of six scenarios, type a natural-language request, or open **Components** with Ctrl/Cmd+K to explore the complete catalogue. Component choices stay in place: the assistant continues underneath, without exposing payloads or syntax.

Run `bun install` at the repository root, then `bun run --cwd apps/playground dev` (port 5173). Build with `bun run --cwd apps/playground build`; test with `bun test --cwd apps/playground test`.

The default scripted agent streams realistic responses with interactive laptop, Kyoto, deploy, landing-page, offsite and research scenarios. The offsite estimate demonstrates an agent patch updating an earlier component. Copy actions stay local; other interactions queue behind an active reply. Stop cancels the stream and its queued continuations. Regenerate replaces the last assistant reply.

The footer’s **Connect a model** popover connects OpenAI, Anthropic or OpenRouter directly from the browser. Choose a preset or custom model and save your key. Keys are stored per provider in localStorage (`prism-agent`); legacy single-key settings migrate automatically. **Forget key** removes the selected provider’s key. Without a key, replies stay scripted. No keys are read from Vite environment variables or sent to a Prism server. Browser extensions and same-origin scripts can access localStorage: use only a trusted, private device. Component gallery examples always use the scripted agent, even with a live model connected.

Live replies share the renderer’s `planning` artifact-state grant. UI actions return to the model with a public store snapshot of at most 2KB; completed `ui:state` fences apply automatically. Empty, failed and stopped assistant turns are omitted from later history.

## Live evals

`src/agent/evals.ts` defines ten prompts and acceptable registry names. To record fresh outputs, run `bun scripts/record-evals.ts` from this directory with `EVAL_PROVIDER` (`openai`, `anthropic` or `openrouter`), `EVAL_MODEL`, the corresponding `OPENAI_API_KEY`, `ANTHROPIC_API_KEY` or `OPENROUTER_API_KEY`, and optionally `EVAL_BASE_URL` (an OpenAI-compatible base such as `https://openrouter.ai/api/v1`). These are recorder-only environment variables, never browser build inputs. The script makes one request per prompt, with no follow-up turns, and writes raw outputs plus provenance to `test/fixtures/live-evals.json`. Never commit keys, request headers or credential-bearing URLs.

The recorder stops after the first failed, empty or timed-out request, preserving its partial recording and printing only the HTTP status (if available) and a sanitized message. It never retries a failing key.

`test/live-evals.test.tsx` replays the recording through Prism at streaming prefixes and checks expected nodes and artifact capabilities. Missing recordings are skipped; malformed or incomplete recordings fail. The harness also tests a temporary, explicitly hand-made fixture; it is not represented as recorded model output. DOM replay does not execute sandboxed iframe JavaScript or replace browser visual checks.

Conversations and drafts remain in memory for the current session, each with its own agent and namespaced state store. New chat starts with fresh state; switching conversations preserves the previous thread. Light, dark and system themes, reduced motion, keyboard navigation and a mobile conversation drawer are supported.

`src/agent/` contains the pluggable agent interface, scripted scenarios, routing and SSE adapters. `src/catalogue.ts` and `src/fixtures.ts` provide catalogue examples. The UI consumes `thinking`, `text`, `title` and `patch` events; patches apply to the same store that renders the conversation. Tests inject a zero-delay pace and mock live agents without making external requests.
