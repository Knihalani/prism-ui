import '../../../packages/react/test/setup';
import { afterEach, expect, test } from 'bun:test';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { App } from '../src/App';
import { createAgent, loadAgentConfig, saveAgentConfig } from '../src/agent/config';
import { createLlmAgent, systemPrompt } from '../src/agent/llm';
import { artifactStatePaths, boundedSnapshot } from '../src/agent/policy';
import { adaptiveArtifactOptions } from '../src/adaptive-source';
import { serialiseLocation } from '../src/url-state';
import type { Agent, AgentEvent, AgentInput } from '../src/agent/types';

afterEach(() => { cleanup(); localStorage.clear(); });
const signal = () => new AbortController().signal;
function blockStorage(message: string) {
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage')!;
  const unavailable = () => { throw Error(message); };
  Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: unavailable, setItem: unavailable } });
  return () => Object.defineProperty(globalThis, 'localStorage', descriptor);
}
async function collect(events: AsyncIterable<AgentEvent>) { const output = []; for await (const event of events) output.push(event); return output; }
const action = { type: 'choose', component: 'pick', id: 'choice', payload: { option: 'north' }, context: { component: 'pick', props: {}, state: {} }, message: 'Choose north' };
function sse(text: string) { return new Response('data: ' + JSON.stringify({ choices: [{ delta: { content: text } }] }) + '\n\ndata: [DONE]\n\n'); }
function send(view: ReturnType<typeof render>, text: string) {
  const input = view.getByRole('textbox', { name: 'Message Prism' });
  act(() => input.focus());
  fireEvent.change(input, { target: { value: text } });
  fireEvent.keyUp(input, { key: 'Unidentified' });
  fireEvent.keyDown(input, { key: 'Enter' });
}

test('legacy credentials migrate to one provider and never follow provider changes', () => {
  localStorage.setItem('prism-agent', JSON.stringify({ provider: 'openai', apiKey: 'private-openai', model: 'old-model' }));
  const config = loadAgentConfig();
  expect(config.keys).toEqual({ openai: 'private-openai' });
  expect(JSON.parse(localStorage.getItem('prism-agent')!)).not.toHaveProperty('apiKey');
  expect(createAgent({ ...config, provider: 'anthropic' }).id).toBe('scripted');
  expect(createAgent({ ...config, provider: 'openrouter' }).id).toBe('scripted');
  expect(saveAgentConfig({ provider: 'openrouter', keys: { ...config.keys, openrouter: 'private-router' } })).toBe(true);
  expect(loadAgentConfig().apiKey).toBe('private-router');
  expect(loadAgentConfig().keys?.openai).toBe('private-openai');
});

test('storage errors stay quiet and never put a key in errors or URL state', async () => {
  const key = 'private-credential-canary';
  const restore = blockStorage(key);
  try { expect(saveAgentConfig({ provider: 'openai', keys: { openai: key } })).toBe(false); expect(loadAgentConfig().keys).toEqual({}); expect(createAgent().id).toBe('scripted'); }
  finally { restore(); }
  const agent = createLlmAgent({ provider: 'openrouter', apiKey: key, fetch: (async () => { throw Error(key); }) as unknown as typeof fetch });
  try { await collect(agent.respond({ kind: 'message', text: 'Hi', history: [] }, signal())); throw Error('Expected provider failure'); }
  catch (error) { expect(String(error)).toContain('Provider connection failed'); expect(String(error)).not.toContain(key); }
  const denied = createLlmAgent({ provider: 'openrouter', apiKey: key, fetch: (async () => new Response(key, { status: 401 })) as unknown as typeof fetch });
  await expect(collect(denied.respond({ kind: 'message', text: 'Hi', history: [] }, signal()))).rejects.toThrow('Provider request failed (401)');
  expect(serialiseLocation({ shell: 'editor', theme: 'host' })).not.toContain(key);
  expect(window.location.href).not.toContain(key);
});

test('OpenRouter uses its endpoint, optional attribution and selected key', async () => {
  let request: RequestInit | undefined, url = '';
  const agent = createLlmAgent({ provider: 'openrouter', apiKey: 'router-only', referer: 'https://prism.example', title: 'Prism test', fetch: (async (input, init) => { url = String(input); request = init; return sse('Done.'); }) as typeof fetch });
  await collect(agent.respond({ kind: 'action', action, snapshot: { planning: { room: 'north' } }, history: [{ role: 'assistant', text: ' ' }] }, signal()));
  expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
  expect(request!.headers).toMatchObject({ Authorization: 'Bearer router-only', 'HTTP-Referer': 'https://prism.example', 'X-Title': 'Prism test' });
  const messages = JSON.parse(request!.body as string).messages;
  expect(JSON.parse(request!.body as string).max_tokens).toBe(8192);
  expect(messages).toHaveLength(2);
  expect(messages[1].content).toContain('[UI interaction]');
  expect(messages[1].content).toContain('"room":"north"');
  expect(messages[1].content).not.toContain('router-only');
});

test('custom compatible bases work, and prompt grants match runtime grants', async () => {
  let url = '';
  const agent = createLlmAgent({ provider: 'openai', apiKey: 'test-only', baseUrl: 'https://compatible.example/v1/', fetch: (async input => { url = String(input); return sse('OK'); }) as typeof fetch });
  await collect(agent.respond({ kind: 'message', text: 'Hello', history: [] }, signal()));
  expect(url).toBe('https://compatible.example/v1/chat/completions');
  expect(adaptiveArtifactOptions.statePaths).toBe(artifactStatePaths);
  expect(systemPrompt()).toContain('Granted read/write paths (including descendants): "planning"');
  const snapshot = boundedSnapshot({ planning: { room: 'north' }, oversized: 'x'.repeat(5000), small: 'é'.repeat(500) });
  expect(snapshot.planning).toEqual({ room: 'north' });
  expect(snapshot).not.toHaveProperty('oversized');
  expect(new TextEncoder().encode(JSON.stringify(snapshot)).length).toBeLessThanOrEqual(2048);
  expect(boundedSnapshot(null)).toEqual({});
  const cycle: any = {}; cycle.self = cycle;
  expect(boundedSnapshot(cycle)).toEqual({});
});

test('popover switches isolated keys, supports show/hide, Escape, outside click and forgetting', () => {
  saveAgentConfig({ provider: 'openrouter', keys: { openrouter: 'private-b' } });
  saveAgentConfig({ provider: 'openai', keys: { openai: 'private-a', openrouter: 'private-b' } });
  const view = render(<App />);
  const chip = view.getByRole('button', { name: /Live ·/ });
  chip.focus(); fireEvent.click(chip);
  expect(view.getByLabelText('API key').getAttribute('type')).toBe('password');
  const close = view.getByRole('button', { name: /^Close$/ });
  close.focus(); fireEvent.keyDown(close, { key: 'Tab', shiftKey: true });
  expect(document.activeElement).toBe(view.getByRole('button', { name: 'Save changes' }));
  fireEvent.keyDown(document.activeElement!, { key: 'Tab' }); expect(document.activeElement).toBe(close);
  fireEvent.click(view.getByRole('button', { name: 'Show key' }));
  expect(view.getByLabelText('API key').getAttribute('type')).toBe('text');
  fireEvent.click(view.getByRole('button', { name: 'OpenRouter' }));
  expect((view.getByLabelText('API key') as HTMLInputElement).value).toBe('private-b');
  expect(view.getByLabelText('API key').getAttribute('type')).toBe('password');
  fireEvent.change(view.getByLabelText('Model preset'), { target: { value: 'custom' } });
  fireEvent.change(view.getByLabelText('Model'), { target: { value: 'anthropic/claude-sonnet-4.5' } });
  expect((view.getByLabelText('Model') as HTMLInputElement).value).toBe('anthropic/claude-sonnet-4.5');
  fireEvent.keyDown(view.getByLabelText('API key'), { key: 'Escape' });
  expect(view.queryByRole('dialog')).toBeNull(); expect(document.activeElement).toBe(chip);
  fireEvent.click(chip); fireEvent.pointerDown(document.body);
  expect(view.queryByRole('dialog')).toBeNull();
  fireEvent.click(chip); fireEvent.click(view.getByRole('button', { name: 'Forget key' }));
  expect(loadAgentConfig().keys).toEqual({ openrouter: 'private-b' });
  expect(view.getByRole('button', { name: /Scripted demo/ })).toBeDefined();
});

test('popover storage failure shows only safe feedback without enabling live mode', () => {
  const view = render(<App />);
  fireEvent.click(view.getByRole('button', { name: /Connect a model/ }));
  fireEvent.change(view.getByLabelText('API key'), { target: { value: 'private-canary' } });
  const restore = blockStorage('private-canary');
  try {
    fireEvent.click(view.getByRole('button', { name: 'Save changes' }));
    expect(view.getByRole('status').textContent).toContain('Browser storage is unavailable');
    expect(view.container.textContent).not.toContain('private-canary');
    expect(window.location.href).not.toContain('private-canary');
  } finally { restore(); }
});

test('Forget removes only the selected key without saving or discarding unrelated drafts', () => {
  saveAgentConfig({ provider: 'openrouter', keys: { openrouter: 'router-key' } });
  saveAgentConfig({ provider: 'openai', model: 'saved-model', keys: { openai: 'active-key' } });
  const view = render(<App />);
  fireEvent.click(view.getByRole('button', { name: /Live · saved-model/ }));
  fireEvent.change(view.getByLabelText('API key'), { target: { value: 'unsaved-a' } });
  fireEvent.click(view.getByRole('button', { name: 'OpenRouter' }));
  fireEvent.change(view.getByLabelText('API key'), { target: { value: 'unsaved-router' } });
  fireEvent.change(view.getByLabelText('Model preset'), { target: { value: 'custom' } });
  fireEvent.change(view.getByLabelText('Model'), { target: { value: 'unsaved-model' } });
  fireEvent.click(view.getByRole('button', { name: 'Forget key' }));
  expect(loadAgentConfig()).toEqual({ provider: 'openai', model: 'saved-model', apiKey: 'active-key', keys: { openai: 'active-key' } });
  expect(view.getByRole('dialog')).toBeDefined();
  expect((view.getByLabelText('Model') as HTMLInputElement).value).toBe('unsaved-model');
  expect((view.getByLabelText('API key') as HTMLInputElement).value).toBe('');
  fireEvent.click(view.getByRole('button', { name: 'OpenAI' }));
  expect((view.getByLabelText('API key') as HTMLInputElement).value).toBe('unsaved-a');
});

test('failed Forget leaves the key and drafts unchanged and reports only safe feedback', () => {
  saveAgentConfig({ provider: 'openai', keys: { openai: 'stored-key' } });
  const view = render(<App />);
  fireEvent.click(view.getByRole('button', { name: /Live ·/ }));
  const restore = blockStorage('private-storage-error');
  try {
    fireEvent.click(view.getByRole('button', { name: 'Forget key' }));
    expect(view.getByRole('status').textContent).toContain('Browser storage is unavailable');
    expect((view.getByLabelText('API key') as HTMLInputElement).value).toBe('stored-key');
    expect(view.container.textContent).not.toContain('private-storage-error');
  } finally { restore(); }
  expect(loadAgentConfig().apiKey).toBe('stored-key');
});

test('a live action reaches the next request and a ui:state reply updates the shared store', async () => {
  let requests = 0, actionBody = '';
  const patchReply = '```ui:state\n{"set":{"planning.room":"north"}}\n```';
  const pickReply = '```ui:pick\n{"id":"choice","question":"Choose","options":[{"id":"north","title":"North","scores":{}}]}\n```\n```ui:state\n{"set":{"planning.seed":42}}\n```';
  const live = createLlmAgent({ provider: 'openai', apiKey: 'test-only', fetch: (async (_url, init) => { requests++; if (requests === 2) actionBody = String(init?.body); return sse(requests === 1 ? pickReply : patchReply); }) as typeof fetch });
  const inputs: AgentInput[] = [];
  const view = render(<App agentFactory={() => ({ ...live, async *respond(input, signal) { inputs.push(input); yield* live.respond(input, signal); } })} />);
  fireEvent.click(view.getByRole('button', { name: /Pick a laptop/ }));
  await waitFor(() => expect(view.getByRole('button', { name: 'Choose' })).toBeDefined());
  await waitFor(() => expect(view.queryByRole('button', { name: 'Stop response' })).toBeNull());
  fireEvent.click(view.getByRole('button', { name: 'Choose' }));
  await waitFor(() => expect(actionBody).toContain('[UI interaction]'));
  await waitFor(() => expect(view.queryByRole('button', { name: 'Stop response' })).toBeNull());
  expect(inputs[1].kind).toBe('action');
  if (inputs[1].kind === 'action') expect(inputs[1].snapshot?.planning).toMatchObject({ seed: 42 });
  send(view, 'What changed?');
  await waitFor(() => expect(inputs).toHaveLength(3));
  expect(inputs[2].history.at(-1)?.text).toBe(patchReply);
  const namespace = view.container.querySelector('[data-conversation]')!.getAttribute('data-conversation');
  await waitFor(() => expect(JSON.parse(localStorage.getItem('prism-ui:' + namespace) ?? '{}').planning?.room).toBe('north'));
});

test('stopping a live turn removes even partial assistant text from future history', async () => {
  const inputs: AgentInput[] = [];
  const agent: Agent = { id: 'stop', label: 'Stop', async *respond(input, signal) { inputs.push(input); if (inputs.length === 1) { yield { type: 'text', delta: 'Partial interrupted response' }; await new Promise<void>(resolve => signal.addEventListener('abort', () => resolve(), { once: true })); } else yield { type: 'text', delta: 'Done' }; } };
  const view = render(<App agentFactory={() => agent} />);
  fireEvent.click(view.getByRole('button', { name: /Pick a laptop/ }));
  await waitFor(() => expect(view.getByText('Partial interrupted response')).toBeDefined());
  fireEvent.click(view.getByRole('button', { name: 'Stop response' }));
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
  send(view, 'Continue');
  await waitFor(() => expect(inputs).toHaveLength(2));
  expect(inputs[1].history.some(turn => turn.role === 'assistant')).toBe(false);
});
