import '../../../packages/react/test/setup';
import '@prism-ui/components';
import { afterEach, expect, test } from 'bun:test';
import { createElement } from 'react';
import { cleanup, render } from '@testing-library/react';
import { Prism, type Action } from '@prism-ui/react';
import { createStore } from '@prism-ui/state';
import { scenarios } from '../src/agent/scenarios';
import { createScriptedAgent, routeMessage } from '../src/agent/scripted';
import { chunks, fast, streamText } from '../src/agent/pace';
import { createLlmAgent } from '../src/agent/llm';
import { createAgent, loadAgentConfig } from '../src/agent/config';
import { playgroundPlugins } from '../src/plugins';
import type { AgentEvent } from '../src/agent/types';

afterEach(() => { cleanup(); localStorage.removeItem('prism-agent'); });
const signal = () => new AbortController().signal;
async function collect<T>(stream: AsyncIterable<T>) { const all: T[] = []; for await (const item of stream) all.push(item); return all; }
const textOf = (events: AgentEvent[]) => events.map(event => event.type === 'text' ? event.delta : '').join('');
function action(component: string, type: string, payload: unknown, id = 'test-' + component): Action {
  return { component, type, payload, id, message: 'User interaction', context: { component, props: {}, state: {} } };
}
const ctx = { scope: 'next', ownerScope: 'test', history: [] };

test.each(scenarios)('$id opening streams and renders its components', async scenario => {
  const agent = createScriptedAgent({ pace: fast });
  const events = await collect(agent.respond({ kind: 'message', text: scenario.prompt, history: [] }, signal()));
  const text = textOf(events);
  expect(events[0].type).toBe('thinking');
  expect(events.some(event => event.type === 'title')).toBe(true);
  expect(text).not.toContain('__SCOPE__');
  const view = render(createElement(Prism, { source: text, store: createStore(), plugins: playgroundPlugins, animate: false }));
  for (const name of scenario.components) expect(view.container.querySelector(`[data-prism="${name === 'code' ? 'codeblock' : name}"]`)).not.toBeNull();
  expect(view.container.textContent).not.toContain('Invalid props');
});

test.each([
  ['which laptop should I buy', 'laptop'], ['my deploy is broken', 'deploy'], ['four days in Kyoto please', 'kyoto'],
  ['can you mock up a landing page', 'landing'], ['a team retreat offsite budget', 'offsite'], ['summarize customer interviews', 'research'],
])('routes %s', (text, id) => {
  const route = routeMessage(text); expect(route.kind).toBe('scenario');
  if (route.kind === 'scenario') expect(route.scenario.id).toBe(id);
});
test('empty and unknown messages fall back, catalogue remains accessible', async () => {
  expect(routeMessage('').kind).toBe('fallback');
  expect(routeMessage('quantum aardvarks').kind).toBe('fallback');
  expect(routeMessage('gallery:pick').kind).toBe('gallery');
  expect(routeMessage('gallery:mockup-ab').kind).toBe('gallery');
  expect(routeMessage('show me a callout').kind).toBe('gallery');
  const agent = createScriptedAgent({ pace: fast });
  expect(textOf(await collect(agent.respond({ kind: 'message', text: 'unknown xyz', history: [] }, signal())))).toContain('Kyoto');
});

test('each main action reacts to payload, and offsite patches its existing estimate', () => {
  const [laptop, kyoto, deploy, landing, offsite, research] = scenarios;
  expect(laptop.onAction(action('pick', 'choose', { option: 'thinkpad', weights: { power: 3 } }), ctx)?.text).toContain('ThinkPad T14');
  expect(kyoto.onAction(action('ask', 'submit', { values: { dates: '2027-04-12', pace: 'Active', budget: 220 } }), ctx)?.text).toContain('$880');
  expect(deploy.onAction(action('troubleshoot', 'troubleshoot', { resolved: false, path: [] }), ctx)?.text).toContain('runbook');
  const revised = landing.onAction(action('mockup', 'feedback', { variant: 'B', overall: 'More contrast' }), ctx)?.text;
  expect(revised).toContain('artifact:html'); expect(revised).toContain('More contrast'); expect(revised).toContain('direction B');
  const reply = offsite.onAction(action('estimate', 'use', { total: 1760, items: [{ id: 'seats', qty: 8 }] }, 'old-budget'), ctx)!;
  expect(reply.text).toContain('8 people'); expect(reply.patch).toEqual({ set: { 'old-budget.items.buffer.enabled': true } });
  const store = createStore(); store.apply(reply.patch!); expect(store.get('old-budget.items.buffer.enabled')).toBe(true);
  expect(research.onAction(action('summary', 'send', { actions: [{ text: 'Validate' }] }), ctx)?.text).toContain('1 action');
  for (const scenario of scenarios) {
    expect(scenario.onAction(action('card', 'select', {}), ctx)?.text.length).toBeGreaterThan(0);
    expect(scenario.onAction(action('code', 'copy', {}), ctx)).toBeUndefined();
    expect(scenario.onAction(action('frame', 'ask', null), ctx)?.text.length).toBeGreaterThan(0);
  }
});

test('actions route to old owning scenario, follow-up ids remain owned, mid-turn text continues', async () => {
  const agent = createScriptedAgent({ pace: fast }), history = [{ role: 'assistant' as const, text: 'Previous turn' }];
  const opening = textOf(await collect(agent.respond({ kind: 'message', text: 'pick a laptop', history: [] }, signal())));
  const id = JSON.parse(opening.split('```ui:pick\n')[1].split('\n```')[0]).id;
  await collect(agent.respond({ kind: 'message', text: 'debug my deploy', history }, signal()));
  const followup = textOf(await collect(agent.respond({ kind: 'action', action: action('pick', 'choose', { option: 'air' }, id), history }, signal())));
  expect(followup).toContain('MacBook Air');
  const deploy = createScriptedAgent({ pace: fast });
  await collect(deploy.respond({ kind: 'message', text: 'deploy broken', history: [] }, signal()));
  expect(textOf(await collect(deploy.respond({ kind: 'message', text: 'done', history }, signal())))).toContain('Good recovery');
  expect(await collect(agent.respond({ kind: 'action', action: action('code', 'copy', {}), history }, signal()))).toEqual([]);
});

test('pace preserves all source bytes and surrogate pairs; abort interrupts thinking', async () => {
  const source = 'Hello 😀 world.\n\n```ui:pick\n{"id":"x"}\n```\n:::callout{title="Note"}\nStay curious!\n:::\n';
  const parts = [...chunks(source, fast)]; expect(parts.join('')).toBe(source);
  for (const part of parts) expect(/[\uD800-\uDBFF]$/.test(part)).toBe(false);
  const controller = new AbortController();
  const result = collect(streamText(source, controller.signal, { ...fast, thinking: () => 10000 }));
  controller.abort(); expect(await result).toEqual([]);
  expect(await collect(createScriptedAgent({ pace: fast }).respond({ kind: 'message', text: 'laptop', history: [] }, controller.signal))).toEqual([]);
});

test.each(['openai', 'anthropic'] as const)('%s parses fragmented SSE and sends provider request', async provider => {
  let request: RequestInit | undefined, url = '';
  const deltas = ['Hello ', 'world 😀'];
  const body = deltas.map(delta => 'data: ' + JSON.stringify(provider === 'openai' ? { choices: [{ delta: { content: delta } }] } : { type: 'content_block_delta', delta: { type: 'text_delta', text: delta } }) + '\r\n\r\n').join('') + 'data: [DONE]\n\n';
  const bytes = new TextEncoder().encode(body);
  const fetch = (async (input: any, init: any) => {
    url = String(input); request = init;
    return new Response(new ReadableStream({ start(c) { for (let i = 0; i < bytes.length; i += 7) c.enqueue(bytes.slice(i, i + 7)); c.close(); } }));
  }) as typeof globalThis.fetch;
  const agent = createLlmAgent({ provider, apiKey: 'test-only', fetch });
  const events = await collect(agent.respond({ kind: 'action', action: action('pick', 'choose', { option: 'air' }), history: [{ role: 'assistant', text: 'Choose one' }] }, signal()));
  expect(events.filter(e => e.type === 'text').map(e => e.delta)).toEqual(deltas);
  const payload = JSON.parse(request!.body as string), headers = request!.headers as Record<string, string>;
  expect(payload.stream).toBe(true); expect(payload.messages.at(-1).content).toContain('[UI interaction]');
  expect(payload.messages.at(-1).content).toContain('air');
  expect(request!.signal).toBeDefined();
  if (provider === 'openai') { expect(headers.Authorization).toBe('Bearer test-only'); expect(url).toContain('/chat/completions'); expect(payload.messages[0].role).toBe('system'); }
  else { expect(headers['x-api-key']).toBe('test-only'); expect(headers['anthropic-version']).toBe('2023-06-01'); expect(headers['anthropic-dangerous-direct-browser-access']).toBe('true'); expect(payload.system).toContain('pick'); expect(url).toContain('/messages'); }
});

test('LLM empty response, provider failure and malformed SSE surface errors', async () => {
  for (const response of [new Response(null), new Response('', { status: 429 }), new Response('data: invalid\n\n'), new Response('data: {"type":"error"}\n\n')]) {
    const agent = createLlmAgent({ provider: 'anthropic', apiKey: 'test-only', fetch: (async () => response) as unknown as typeof fetch });
    await expect(collect(agent.respond({ kind: 'message', text: 'hello', history: [] }, signal()))).rejects.toThrow();
  }
});
test('LLM abort cancels a pending read promptly', async () => {
  let cancelled = false;
  const agent = createLlmAgent({ provider: 'openai', apiKey: 'test-only', fetch: (async () => new Response(new ReadableStream({ cancel() { cancelled = true; } }))) as unknown as typeof fetch });
  const controller = new AbortController(), iterator = agent.respond({ kind: 'message', text: 'hi', history: [] }, controller.signal)[Symbol.asyncIterator]();
  await iterator.next(); const pending = iterator.next();
  await new Promise(resolve => setTimeout(resolve, 0)); controller.abort();
  expect((await pending).done).toBe(true); expect(cancelled).toBe(true);
});
test('config safely loads local settings, ignores malformed JSON, chooses agent by key', () => {
  expect(createAgent({}).id).toBe('scripted'); expect(createAgent({ apiKey: '  ' }).id).toBe('scripted');
  expect(createAgent({ provider: 'openai', apiKey: 'test-only' }).id).toBe('openai');
  localStorage.setItem('prism-agent', '{bad'); expect(() => loadAgentConfig()).not.toThrow();
  localStorage.setItem('prism-agent', JSON.stringify({ provider: 'anthropic', apiKey: 'test-only', model: 'custom' }));
  expect(loadAgentConfig()).toEqual({ provider: 'anthropic', apiKey: 'test-only', model: 'custom' });
});
