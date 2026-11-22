import '../../../packages/react/test/setup';
import { afterEach, expect, test } from 'bun:test';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { App } from '../src/App';
import { fast, type Pace } from '../src/agent/pace';
import type { Agent } from '../src/agent/types';
import { makeStore } from '../src/store';
import { plainProse } from '../src/ui/Turn';

afterEach(() => { cleanup(); localStorage.clear(); });
const users = (container: HTMLElement) => container.querySelectorAll('[data-message="user"]');
const replies = (container: HTMLElement) => container.querySelectorAll('[data-message="assistant"]');
async function done(view: ReturnType<typeof render>) {
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
  await waitFor(() => expect(view.container.querySelector('button[aria-label="Stop response"]')).toBeNull());
}
function type(view: ReturnType<typeof render>, text: string) {
  const input = view.getByRole('textbox', { name: 'Message Prism' });
  fireEvent.change(input, { target: { value: text } });
  return input;
}
function send(view: ReturnType<typeof render>, text: string) { const input = type(view, text); fireEvent.keyDown(input, { key: 'Enter' }); }

test('landing has six natural suggestions and clicking one renders a streamed conversation', async () => {
  const view = render(<App pace={fast} />);
  expect(view.getByRole('heading', { name: 'What are we working on?' })).toBeDefined();
  expect(view.getByLabelText('Suggestions').querySelectorAll('button')).toHaveLength(6);
  fireEvent.click(view.getByRole('button', { name: /Pick a laptop Find/ }));
  await done(view);
  expect(users(view.container)).toHaveLength(1); expect(replies(view.container)).toHaveLength(1);
  expect(view.getByText('Help me pick a laptop')).toBeDefined();
  expect(view.container.querySelector('[data-prism="pick"]')).not.toBeNull();
  expect(view.getAllByRole('button', { name: 'Your next laptop' })).toHaveLength(1);
  expect(view.getByRole('log').getAttribute('aria-busy')).toBe('false');
});

test('pick action adds only an assistant continuation and no payload or syntax', async () => {
  const view = render(<App pace={fast} />); send(view, 'which laptop should I buy'); await done(view);
  expect(view.getAllByRole('button', { name: 'Your next laptop' })).toHaveLength(1);
  fireEvent.click(view.getAllByRole('button', { name: /Choose/ })[0]); await done(view);
  expect(users(view.container)).toHaveLength(1); expect(replies(view.container)).toHaveLength(2);
  expect(view.getByRole('table')).toBeDefined();
  expect(view.container.querySelector('.payload')).toBeNull();
  expect(view.container.textContent).not.toContain('```ui:');
  expect(replies(view.container)[0].querySelector('.turn-actions')).toBeNull();
  expect(replies(view.container)[1].querySelector('.turn-actions')).not.toBeNull();
});

test('estimate action confirms in place, appends assistant and patches earlier estimate', async () => {
  const view = render(<App pace={fast} />); send(view, 'Budget a 6-person team offsite'); await done(view);
  const checkbox = view.getByRole('checkbox', { name: 'Contingency' }) as HTMLInputElement;
  expect(checkbox.checked).toBe(false);
  fireEvent.click(view.getByRole('button', { name: 'Use this estimate' })); await done(view);
  expect(users(view.container)).toHaveLength(1); expect(replies(view.container)).toHaveLength(2);
  expect(checkbox.checked).toBe(true);
  expect((view.getByRole('button', { name: 'Estimate saved' }) as HTMLButtonElement).disabled).toBe(true);
  const id = view.getByRole('main').getAttribute('data-conversation')!;
  const store = makeStore(false, id), budget = Object.keys(store.snapshot()).find(key => key.endsWith('-budget'))!;
  expect(store.get(budget + '.items.buffer.enabled')).toBe(true);
  expect(store.get(budget + '.total')).toBe(1520);
});

test('typed natural language routes, empty ignored, shift-enter and IME do not send', async () => {
  const view = render(<App pace={fast} />), input = view.getByRole('textbox', { name: 'Message Prism' });
  fireEvent.keyDown(input, { key: 'Enter' }); expect(users(view.container)).toHaveLength(0);
  type(view, 'my deploy is broken');
  fireEvent.keyDown(input, { key: 'Enter', shiftKey: true }); expect(users(view.container)).toHaveLength(0);
  fireEvent.keyDown(input, { key: 'Enter', isComposing: true }); expect(users(view.container)).toHaveLength(0);
  fireEvent.keyDown(input, { key: 'Enter' }); await done(view);
  expect(view.container.querySelector('[data-prism="troubleshoot"]')).not.toBeNull();
  expect((view.getByRole('textbox', { name: 'Message Prism' }) as HTMLTextAreaElement).value).toBe('');
});

test('Stop aborts thinking and regenerate replaces the last reply, not the user turn', async () => {
  const pace: Pace = { ...fast, thinking: () => 10000 };
  const view = render(<App pace={pace} />); send(view, 'help me pick a laptop');
  expect(view.getByLabelText('Thinking')).toBeDefined();
  fireEvent.click(view.getByRole('button', { name: 'Stop response' })); await done(view);
  expect(replies(view.container)).toHaveLength(1); expect(view.queryByLabelText('Thinking')).toBeNull();
  pace.thinking = () => 0;
  fireEvent.click(view.getByRole('button', { name: 'Regenerate reply' })); await done(view);
  expect(users(view.container)).toHaveLength(1); expect(replies(view.container)).toHaveLength(1);
  expect(view.container.querySelector('[data-prism="pick"]')).not.toBeNull();
});

test('component action queues after streaming without creating a user turn or clearing a draft', async () => {
  const pace: Pace = { ...fast }, view = render(<App pace={pace} />);
  send(view, 'pick a laptop'); await done(view);
  pace.thinking = () => 60;
  send(view, 'show me a callout');
  type(view, 'A draft to keep');
  fireEvent.click(view.getAllByRole('button', { name: /Choose/ })[0]);
  expect(replies(view.container)).toHaveLength(2); expect(users(view.container)).toHaveLength(2);
  pace.thinking = () => 0;
  await done(view);
  expect(replies(view.container)).toHaveLength(3);
  expect((view.getByRole('textbox', { name: 'Message Prism' }) as HTMLTextAreaElement).value).toBe('A draft to keep');
});

test('new chat is empty and conversation switching preserves component state and drafts', async () => {
  const view = render(<App pace={fast} />); send(view, 'Help me pick a laptop'); await done(view);
  fireEvent.click(view.getAllByRole('button', { name: /Choose/ })[0]); await done(view);
  type(view, 'Keep this draft');
  const original = view.getByRole('main').getAttribute('data-conversation');
  fireEvent.click(view.getByRole('button', { name: 'New chat' }));
  expect(users(view.container)).toHaveLength(0); expect(replies(view.container)).toHaveLength(0);
  expect(view.getByRole('main').getAttribute('data-conversation')).not.toBe(original);
  fireEvent.click(view.getAllByRole('button', { name: 'Your next laptop' })[0]);
  expect(users(view.container)).toHaveLength(1); expect(replies(view.container)).toHaveLength(2);
  expect(view.getByRole('main').getAttribute('data-conversation')).toBe(original);
  expect(view.getAllByRole('button', { name: 'Your next laptop' })).toHaveLength(1);
  expect((view.getByRole('textbox', { name: 'Message Prism' }) as HTMLTextAreaElement).value).toBe('Keep this draft');
  fireEvent.click(view.getByRole('button', { name: 'Four days in Kyoto' })); await done(view);
  fireEvent.click(view.getAllByRole('button', { name: 'Your next laptop' })[0]);
  expect(replies(view.container)).toHaveLength(2);
});

test('command palette filters demos, keyboard Enter sends natural prompt, and Escape restores focus', async () => {
  const view = render(<App pace={fast} />), trigger = view.getByRole('button', { name: /Components/ });
  act(() => trigger.focus()); fireEvent.keyDown(document, { key: 'k', ctrlKey: true });
  const search = view.getByRole('combobox', { name: 'Search scenarios and components' });
  expect(document.activeElement).toBe(search);
  fireEvent.change(search, { target: { value: 'callout' } });
  fireEvent.keyDown(search, { key: 'Enter' }); await done(view);
  expect(view.queryByRole('dialog')).toBeNull(); expect(view.getByText('Make the pilot feel personal')).toBeDefined();
  expect(view.getByText('What should we keep in mind before launch?')).toBeDefined();
  fireEvent.keyDown(document, { key: 'k', metaKey: true });
  fireEvent.keyDown(view.getByRole('combobox'), { key: 'Escape' });
  expect(view.queryByRole('dialog')).toBeNull(); expect(document.activeElement).toBe(trigger);
});

test('settings apply injected live agent to next turn; gallery still uses scripted agent', async () => {
  const calls: string[] = [];
  const live: Agent = { id: 'mock', label: 'Mock model', async *respond(input) { calls.push(input.kind); yield { type: 'text', delta: 'A connected model replied.' }; } };
  const view = render(<App pace={fast} agentFactory={() => live} />);
  fireEvent.click(view.getByRole('button', { name: 'Settings' }));
  fireEvent.change(view.getByLabelText('Assistant'), { target: { value: 'openai' } });
  fireEvent.change(view.getByLabelText('API key'), { target: { value: 'test-only' } });
  fireEvent.change(view.getByLabelText('Model'), { target: { value: 'mock-model' } });
  fireEvent.click(view.getByRole('button', { name: 'Save changes' }));
  send(view, 'Hello from a real person'); await done(view);
  expect(view.getByText('A connected model replied.')).toBeDefined(); expect(calls).toEqual(['message']);
  expect(JSON.parse(localStorage.getItem('prism-agent')!).model).toBe('mock-model');
  fireEvent.click(view.getByRole('button', { name: /Components/ }));
  const search = view.getByRole('combobox'); fireEvent.change(search, { target: { value: 'callout' } }); fireEvent.keyDown(search, { key: 'Enter' }); await done(view);
  expect(view.getByText('Make the pilot feel personal')).toBeDefined(); expect(calls).toEqual(['message']);
});

test('copy component action stays local; reply copy strips component syntax', async () => {
  const clipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard'), copied: string[] = [];
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (text: string) => { copied.push(text); } } });
  try {
    const view = render(<App pace={fast} />); send(view, 'show me a code example'); await done(view);
    await act(async () => { fireEvent.click(view.getByRole('button', { name: 'Copy code' })); });
    expect(users(view.container)).toHaveLength(1); expect(replies(view.container)).toHaveLength(1);
    await act(async () => { fireEvent.click(view.getByRole('button', { name: 'Copy reply' })); });
    expect(copied.at(-1)).not.toContain('```'); expect(copied.at(-1)).not.toContain('export async');
    expect(plainProse('Hello\n:::callout{title="x"}\nUseful **note**\n:::\n```ui:pick\n{}\n```')).toBe('Hello\n\nUseful note');
  } finally { if (clipboard) Object.defineProperty(navigator, 'clipboard', clipboard); else Reflect.deleteProperty(navigator, 'clipboard'); }
});

test('palette traps focus, exposes empty results and can be closed', () => {
  const view = render(<App pace={fast} />); fireEvent.click(view.getByRole('button', { name: /Components/ }));
  const search = view.getByRole('combobox'); fireEvent.change(search, { target: { value: 'zzzznothing' } });
  expect(view.getByText('No matches. Try a component name.')).toBeDefined();
  const close = view.getByRole('button', { name: 'Close' }); act(() => close.focus());
  fireEvent.keyDown(close, { key: 'Tab', shiftKey: true }); expect(document.activeElement).toBe(search);
  fireEvent.click(close); expect(view.queryByRole('dialog')).toBeNull();
});
