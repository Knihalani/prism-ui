# Integrating Prism

Prism renders model-authored Markdown and interactive components inside your app.
You own the model, transport, authentication and conversation history.

## Shared basics

```sh
bun add react react-dom @prism-ui/react @prism-ui/components @prism-ui/state
```

Import `@prism-ui/components` to register built-ins and its shared CSS once.
Keep `[artifactPlugin]` stable. Use one store per conversation, shared by every
reply, with `scope={message.id}`. Generate the prompt with the same registry and
capabilities you render. See [PROMPTING](PROMPTING.md) for the authoring contract.

Each named snippet below is a complete file; save it under the name shown.
Server snippets require the named provider's environment API key. Never import
server SDK instances or secrets into browser bundles. Add authentication, request
limits, persistence and provider-error reporting at your application's boundary.
Examples target the exact SDK versions in [docs-tests](../apps/docs-tests/package.json).

### State and patch boundary — patches.ts

Completed `ui:state` fences apply automatically. They need no tool handler.
Use a tool only when you want an explicit, validated patch channel. The example
tool is limited to the public `planning` namespace. Authorize against the signed-in
conversation on the server too; client validation alone is not authorization.
Only put user-visible conversation state in a Prism store: automatic `ui:state`
patches are not constrained by this tool's schema or artifact state grants.

<!-- snippet: patches -->
```ts
import { z } from 'zod';
import type { Store } from '@prism-ui/state';

const path = z.string().max(256).refine(value =>
  (value === 'planning' || value.startsWith('planning.')) &&
  value.split('.').every(segment => segment.length > 0 &&
    !['__proto__', 'constructor', 'prototype', '*'].includes(segment)),
  'Only public planning state is writable',
);
export const patchSchema = z.object({
  set: z.record(path, z.unknown()).optional(),
  merge: z.record(path, z.unknown()).optional(),
  delete: z.array(path).optional(),
}).strict();
export function applyAgentPatch(store: Store, value: unknown): void {
  store.apply(patchSchema.parse(value));
}
```

Patch values are JSON data. This is a dotted-path set/merge/delete format, not
RFC 6902. Deduplicate tool-call IDs before applying; do not apply both a tool
result and a `ui:state` fence for the same edit.

## 1. Vercel AI SDK v5

```sh
bun add ai@5.0.60 @ai-sdk/react@2.0.60 @ai-sdk/openai@2.0.41 zod@3.25.76
```

### Route — ai-route.ts

Mount POST at `/api/chat`. The optional tool returns a validated patch, not a
server-side store mutation. Its result reaches the client as a typed tool part.
Remove the tool and its client effect if using only automatic `ui:state` fences.
Incoming history is reduced to text parts before conversion, so remote file URLs cannot trigger server-side SDK downloads.

<!-- snippet: ai-route -->
```ts
import '@prism-ui/components';
import { createSystemPrompt } from '@prism-ui/react';
import { openai } from '@ai-sdk/openai';
import { convertToModelMessages, streamText, tool, validateUIMessages,
  type InferUITools, type UIMessage } from 'ai';
import { patchSchema } from './patches';

export const tools = {
  applyState: tool({
    description: 'Update public planning state. Use this OR ui:state, not both.',
    inputSchema: patchSchema,
    execute: async patch => patchSchema.parse(patch),
  }),
};
export type ChatMessage = UIMessage<unknown, never, InferUITools<typeof tools>>;
export async function textOnlyMessages(input: unknown) {
  const messages = await validateUIMessages<ChatMessage>({ messages: input, tools });
  return messages.filter(message => message.role !== 'system').map(message => ({
    id: message.id, role: message.role,
    parts: message.parts.filter(part => part.type === 'text').map(part => ({ type: 'text' as const, text: part.text })),
  })).filter(message => message.parts.length > 0);
}
export async function POST(request: Request): Promise<Response> {
  const body = await request.json() as { messages: unknown };
  const messages = await textOnlyMessages(body.messages);
  return streamText({
    model: openai('gpt-4o-mini'),
    system: createSystemPrompt({ artifacts: { statePaths: ['planning'] } }),
    messages: convertToModelMessages(messages),
    tools,
    abortSignal: request.signal,
  }).toUIMessageStreamResponse();
}
```

### Client, actions and patches — ai-chat.tsx

Mount `<AIChat key={conversationId} conversationId={conversationId} />` so both
the SDK history and store change together. Persist both if restoring a session.
In v5, read `message.parts`, not a legacy `message.content` string. Actions use
`sendMessage({ text })`. The effect processes only completed applyState results
once per tool-call ID; text-authored patches remain automatic.

<!-- snippet: ai-chat -->
```tsx
'use client';
import { useEffect, useRef, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { Prism, actionToMessage, type Action } from '@prism-ui/react';
import { createStore } from '@prism-ui/state';
import { ArtifactProvider, artifactPlugin } from '@prism-ui/components';
import '@prism-ui/components/styles.css';
import type { ChatMessage } from './ai-route';
import { applyAgentPatch } from './patches';

const plugins = [artifactPlugin];
const transport = new DefaultChatTransport<ChatMessage>({ api: '/api/chat' });
export function AIChat({ conversationId }: { conversationId: string }) {
  const [store] = useState(() => createStore());
  const applied = useRef(new Set<string>()), queued = useRef<string[]>([]);
  const [patchError, setPatchError] = useState('');
  const { messages, sendMessage, status, error } = useChat<ChatMessage>({ id: conversationId, transport });
  const busy = status === 'submitted' || status === 'streaming';
  useEffect(() => {
    if (!busy && queued.current.length) void sendMessage({ text: queued.current.shift()! });
  }, [busy, sendMessage]);
  useEffect(() => {
    for (const message of messages) for (const part of message.parts) {
      if (part.type !== 'tool-applyState' || part.state !== 'output-available') continue;
      const key = message.id + ':' + part.toolCallId;
      if (applied.current.has(key)) continue;
      try { applyAgentPatch(store, part.output); applied.current.add(key); }
      catch { setPatchError('The agent returned an invalid state update.'); }
    }
  }, [messages, store]);
  function onAction(action: Action) {
    if (action.type === 'copy') return;
    const text = actionToMessage(action);
    if (busy) queued.current.push(text); else void sendMessage({ text });
  }
  return <ArtifactProvider options={{ statePaths: ['planning'] }}>
    {messages.map((message, index) => {
      const text = message.parts.filter(part => part.type === 'text').map(part => part.text).join('');
      return message.role === 'assistant'
        ? <Prism key={message.id} scope={message.id} source={text}
            done={!busy || index !== messages.length - 1} store={store}
            plugins={plugins} onAction={onAction} />
        : <p key={message.id}>{text}</p>;
    })}
    {(error || patchError) && <p role="alert">{patchError || error?.message}</p>}
    <form onSubmit={event => {
      event.preventDefault();
      const form = event.currentTarget, text = String(new FormData(form).get('message') ?? '');
      if (text.trim()) { void sendMessage({ text }); form.reset(); }
    }}><label>Message <input name="message" required /></label><button disabled={busy}>Send</button></form>
  </ArtifactProvider>;
}
```

## 2. OpenAI SDK streaming

```sh
bun add openai@5.23.2 zod@3.25.76
```

### Server and text adapter — openai-server.ts

Keep OPENAI_API_KEY on the server. This route emits plain UTF-8 text, not SSE
envelopes. Retain the assistant's complete source in history. An action is the
next user message, serialized with actionToMessage by the client below.

<!-- snippet: openai-server -->
```ts
import '@prism-ui/components';
import OpenAI from 'openai';
import { z } from 'zod';
import { createSystemPrompt } from '@prism-ui/react';

export async function* openAIText(events: AsyncIterable<OpenAI.Chat.Completions.ChatCompletionChunk>) {
  for await (const event of events) {
    const text = event.choices[0]?.delta.content;
    if (text) yield text;
  }
}
const bodySchema = z.object({ history: z.array(z.object({
  role: z.enum(['user', 'assistant']), content: z.string(),
})), text: z.string() });
export async function POST(request: Request): Promise<Response> {
  const { history, text } = bodySchema.parse(await request.json());
  const events = await new OpenAI().chat.completions.create({
    model: 'gpt-4o-mini', stream: true,
    messages: [{ role: 'system', content: createSystemPrompt() }, ...history, { role: 'user', content: text }],
  }, { signal: request.signal });
  const iterator = openAIText(events), encoder = new TextEncoder();
  return new Response(new ReadableStream<Uint8Array>({
    async pull(controller) {
      try { const next = await iterator.next(); if (next.done) controller.close(); else controller.enqueue(encoder.encode(next.value)); }
      catch (error) { controller.error(error); }
    },
    async cancel() { events.controller.abort(); await iterator.return(undefined); },
  }), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
```

### Client actions and patches

Use the conversation component in section 4 with endpoint=`/api/openai`. It feeds
the response body directly to `Prism stream`, appends actions as user messages,
and retains assistant source for subsequent turns. Automatic ui:state fences
apply while rendering. If you add SDK function calls, validate the parsed tool
arguments with applyAgentPatch and deduplicate their IDs; do not feed tool JSON
into the text adapter.

## 3. Anthropic SDK streaming

```sh
bun add @anthropic-ai/sdk@0.65.0 zod@3.25.76
```

### Server and text adapter — anthropic-server.ts

Mount at `/api/anthropic`; keep ANTHROPIC_API_KEY on the server. SDK stream events
include non-text deltas, which must not enter the Markdown stream.
Empty assistant entries from failed or text-free replies are omitted from history;
the conversation client below displays transport errors and empty-reply errors.

<!-- snippet: anthropic-server -->
```ts
import '@prism-ui/components';
import Anthropic from '@anthropic-ai/sdk';
import { z } from 'zod';
import { createSystemPrompt } from '@prism-ui/react';

export async function* anthropicText(events: AsyncIterable<Anthropic.RawMessageStreamEvent>) {
  for await (const event of events)
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') yield event.delta.text;
}
export const anthropicBodySchema = z.object({ history: z.array(z.object({
  role: z.enum(['user', 'assistant']), content: z.string(),
})).transform(history => history.filter(message => message.role !== 'assistant' || message.content.trim().length > 0)), text: z.string() });
export async function POST(request: Request): Promise<Response> {
  const { history, text } = anthropicBodySchema.parse(await request.json());
  const events = new Anthropic().messages.stream({
    model: 'claude-sonnet-4-20250514', max_tokens: 4096,
    system: createSystemPrompt(), messages: [...history, { role: 'user', content: text }],
  }, { signal: request.signal });
  const iterator = anthropicText(events), encoder = new TextEncoder();
  return new Response(new ReadableStream<Uint8Array>({
    async pull(controller) {
      try { const next = await iterator.next(); if (next.done) controller.close(); else controller.enqueue(encoder.encode(next.value)); }
      catch (error) { controller.error(error); }
    },
    async cancel() { events.controller.abort(); await iterator.return(undefined); },
  }), { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
}
```

### Client actions and patches

Use section 4 with endpoint=`/api/anthropic`. The same actionToMessage user turns
work with Anthropic. Text-authored ui:state fences apply automatically. If you
handle tool_use blocks separately, validate their input with applyAgentPatch;
never interpret input_json_delta as display text.

## 4. ChatGPT-style conversations — conversations.tsx

This small controller keeps stores/history outside the selected view, queues
actions behind the active reply and retains the original assistant Markdown.
Each conversation has its own promise chain, so switching cannot redirect an
in-flight action into another chat. Errors are visible; abort/cancel behavior
and persistence can be added at the transport boundary.

<!-- snippet: conversations -->
```tsx
import { useReducer, useState } from 'react';
import { Prism, actionToMessage, type Action, type PrismStream } from '@prism-ui/react';
import { createStore } from '@prism-ui/state';
import { artifactPlugin } from '@prism-ui/components';
import '@prism-ui/components/styles.css';
import { applyAgentPatch } from './patches';

type Message = { id: string; role: 'user' | 'assistant'; text: string; stream?: PrismStream; done: boolean };
function conversation(id: string) {
  return { id, store: createStore(), messages: [] as Message[], queue: Promise.resolve(), error: '' };
}
export type Conversation = ReturnType<typeof conversation>;
const plugins = [artifactPlugin];
export function toolPatch(chat: Conversation, value: unknown) { applyAgentPatch(chat.store, value); }
export function Conversations({ endpoint = '/api/openai' }: { endpoint?: string }) {
  const [chats] = useState(() => [conversation('Design'), conversation('Research')]);
  const [selected, select] = useState(chats[0].id), [, redraw] = useReducer(n => n + 1, 0);
  const current = chats.find(chat => chat.id === selected)!;
  function send(chat: Conversation, text: string) {
    chat.queue = chat.queue.then(async () => {
      const history = chat.messages.filter(message => message.role !== 'assistant' || message.text.trim().length > 0)
        .map(message => ({ role: message.role, content: message.text }));
      chat.messages.push({ id: crypto.randomUUID(), role: 'user', text, done: true });
      const reply: Message = { id: crypto.randomUUID(), role: 'assistant', text: '', done: false };
      chat.messages.push(reply); chat.error = ''; redraw();
      try {
        const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ history, text }) });
        if (!response.ok || !response.body) throw Error('The model request failed.');
        const reader = response.body.getReader(), decoder = new TextDecoder();
        let complete!: () => void;
        const finished = new Promise<void>(resolve => { complete = resolve; });
        reply.stream = (async function* () {
          try {
            while (true) {
              const chunk = await reader.read();
              if (chunk.done) {
                const tail = decoder.decode(); reply.text += tail; if (tail) yield tail;
                if (!reply.text.trim()) throw Error('The model returned an empty reply.');
                break;
              }
              const delta = decoder.decode(chunk.value, { stream: true }); reply.text += delta; yield delta;
            }
          } catch (error) { chat.error = String(error); throw error; }
          finally { reply.done = true; await reader.cancel().catch(() => {}); reader.releaseLock(); complete(); redraw(); }
        })();
        redraw();
        await finished;
      } catch (error) { reply.done = true; chat.error = String(error); redraw(); }
    }).catch(error => { chat.error = String(error); redraw(); });
  }
  function onAction(chat: Conversation, action: Action) {
    if (action.type !== 'copy') send(chat, actionToMessage(action));
  }
  return <main><nav aria-label="Conversations">{chats.map(chat =>
    <button key={chat.id} aria-pressed={chat === current} onClick={() => select(chat.id)}>{chat.id}</button>)}</nav>
    {chats.map(chat => <section key={chat.id} hidden={chat !== current}>
      {chat.messages.map(message => message.role === 'assistant'
        ? <Prism key={message.id} scope={message.id} stream={message.stream}
            source={message.text} done={message.done} store={chat.store} plugins={plugins}
            onAction={action => onAction(chat, action)} />
        : <p key={message.id}>{message.text}</p>)}
      {chat.error && <p role="alert">{chat.error}</p>}
    </section>)}
    <button onClick={() => send(current, 'Help me plan the next release.')}>Plan a release</button>
  </main>;
}
```

### Actions and patches

All rendered replies share their conversation's store. Hidden conversations stay
mounted so switching does not cancel a Prism-owned stream. onAction captures the
originating chat and queues actionToMessage; copy stays local. ui:state is automatic.
The exported toolPatch adapter validates explicit tool events; deduplicate event
IDs in your transport before calling it.

## 5. Cursor-style narrow panel — panel.tsx

Generate the model prompt with surface:'panel'. Give the panel its own container,
not viewport breakpoints; this example stacks the composer at 320px. Escape is
handled only inside the panel, after children have had a chance to handle it.
The host supplies sendToModel as its queued conversation transport.

<!-- snippet: panel -->
```tsx
import '@prism-ui/components';
import { Prism, actionToMessage, createSystemPrompt, host, type Action } from '@prism-ui/react';
import { createStore, type Store } from '@prism-ui/state';
import { artifactPlugin } from '@prism-ui/components';
import '@prism-ui/components/styles.css';
import { applyAgentPatch } from './patches';

export const panelPrompt = createSystemPrompt({ surface: 'panel' });
const plugins = [artifactPlugin];
export function AssistantPanel({ message, sendToModel, close, store }: {
  message: { id: string; text: string; done: boolean };
  sendToModel(text: string): void; close(): void; store: Store;
}) {
  function onAction(action: Action) { if (action.type !== 'copy') sendToModel(actionToMessage(action)); }
  return <aside aria-label="Assistant" style={{ containerType: 'inline-size', minWidth: 0 }}
    onKeyDown={event => {
      if (event.key === 'Escape' && !event.defaultPrevented) { event.stopPropagation(); close(); }
    }}>
    <style>{'.panel-compose{display:flex;gap:8px}.panel-compose input{min-width:0}@container(max-width:320px){.panel-compose{flex-direction:column}}'}</style>
    <Prism scope={message.id} source={message.text} done={message.done} store={store}
      plugins={plugins} density="compact" theme={host} onAction={onAction} />
    <form className="panel-compose" onSubmit={event => {
      event.preventDefault(); const form = event.currentTarget;
      sendToModel(String(new FormData(form).get('message') ?? '')); form.reset();
    }}><label>Ask <input name="message" /></label><button>Send</button></form>
  </aside>;
}
export function applyPanelToolPatch(store: ReturnType<typeof createStore>, value: unknown) {
  applyAgentPatch(store, value);
}
```

### Actions and patches

Keep this component mounted per conversation (key it by conversation ID when
switching). sendToModel receives actionToMessage strings and must append them as
user messages. ui:state patches are automatic. Your tool-event adapter can call
applyPanelToolPatch with the same store supplied by its host conversation controller.

## 6. shadcn and Tailwind hosts — themed-chat.tsx

The shadcn adapter reads complete CSS colours, as used by shadcn/Tailwind v4.
For legacy v3 HSL channels wrap mappings in hsl(var(--primary)), etc.
With Tailwind v4, define semantic --color-* variables in your @theme stylesheet;
fromCssVars maps them without taking a Tailwind runtime dependency.

```css
@import "tailwindcss";
@theme {
  --color-canvas: oklch(0.98 0.01 260);
  --color-ink: oklch(0.22 0.02 260);
  --color-brand: oklch(0.55 0.18 260);
}
.dark {
  --color-canvas: oklch(0.18 0.02 260);
  --color-ink: oklch(0.94 0.01 260);
  --color-brand: oklch(0.72 0.13 260);
}
```

<!-- snippet: themed-chat -->
```tsx
import '@prism-ui/components';
import { useState } from 'react';
import { Prism, actionToMessage, createTheme, fromCssVars, shadcn } from '@prism-ui/react';
import { createStore, type Store } from '@prism-ui/state';
import { artifactPlugin } from '@prism-ui/components';
import '@prism-ui/components/styles.css';
import { applyAgentPatch } from './patches';

const tailwind = createTheme(fromCssVars({
  bg: '--color-canvas', text: '--color-ink', accent: '--color-brand',
}));
const plugins = [artifactPlugin];
export function ThemedChat({ sendToModel, message, store }: {
  sendToModel(text: string): void; store: Store;
  message: { id: string; text: string; done: boolean };
}) {
  const [dark, setDark] = useState(false);
  return <section className={dark ? 'dark' : ''}>
    <button onClick={() => setDark(value => !value)}>Toggle dark</button>
    <Prism source={message.text} done={message.done} scope={message.id} store={store} plugins={plugins}
      theme={shadcn} mode={dark ? 'dark' : 'light'}
      onAction={action => { if (action.type !== 'copy') sendToModel(actionToMessage(action)); }} />
  </section>;
}
export const tailwindTheme = tailwind;
export function applyThemeToolPatch(store: ReturnType<typeof createStore>, value: unknown) {
  applyAgentPatch(store, value);
}
```

Use theme={tailwindTheme} instead of theme={shadcn} for the @theme mapping above.
The .dark class selects the host variables; Prism's matching mode propagates to
frames. Keep one store per conversation, not per token or theme change.

### Actions and patches

The theme does not change the action/state protocol: sendToModel appends the
serialized interaction as user data; ui:state applies automatically.
applyThemeToolPatch handles explicit validated patches with the same store
supplied by your conversation controller.

## Verification

Root `bun test` discovers the private docs workspace's snippet test. It extracts
every TS/TSX fence from README, this guide and PROMPTING into ignored modules and
type-checks them against real pinned SDKs. Run it directly:

```sh
bun run --cwd apps/docs-tests check
```
