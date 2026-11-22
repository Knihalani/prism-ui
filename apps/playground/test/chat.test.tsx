import '../../../packages/react/test/setup';
import { afterEach, expect, test } from 'bun:test';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { App } from '../src/App';
import { fast, type Pace } from '../src/agent/pace';
import type { Agent, AgentInput } from '../src/agent/types';
import { makeStore } from '../src/store';
import { plainProse } from '../src/ui/Turn';

afterEach(() => { cleanup(); localStorage.clear(); });
const users = (container: HTMLElement) => container.querySelectorAll('[data-message="user"]');
const replies = (container: HTMLElement) => container.querySelectorAll('[data-message="assistant"]');
async function done(view: ReturnType<typeof render>) {
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 0)); });
  await waitFor(() => expect(view.container.querySelector('button[aria-label="Stop response"]') === null).toBe(true));
}
function change(input: HTMLElement, text: string) {
  act(() => input.focus());
  fireEvent.change(input, { target: { value: text } });
  fireEvent.keyUp(input, { key: 'Unidentified' });
}
function type(view: ReturnType<typeof render>, text: string) {
  const input = view.getByRole('textbox', { name: 'Message Prism' });
  change(input, text);
  return input;
}
function send(view: ReturnType<typeof render>, text: string) { const input = type(view, text); fireEvent.keyDown(input, { key: 'Enter' }); }

test('sidebar utilities share the appearance row and system appearance remains reachable', () => {
  const view = render(<App pace={fast} />);
  const row = view.container.querySelector('.theme-row')!;
  for (const label of ['Components', 'Settings', 'Use system appearance']) {
    expect(row.contains(view.getByRole('button', { name: label }))).toBe(true);
  }
  fireEvent.click(view.getByRole('switch', { name: 'Dark appearance' }));
  expect(localStorage.getItem('prism-theme')).not.toBeNull();
  fireEvent.click(view.getByRole('button', { name: 'Use system appearance' }));
  expect(localStorage.getItem('prism-theme')).toBeNull();
  expect(view.queryByText('Scripted demo · Connect a model')).toBeNull();
});

test('the ink send control stays disabled for empty input', () => {
  const view = render(<App pace={fast} />);
  expect(view.getByRole('button', { name: 'Send message' }).hasAttribute('disabled')).toBe(true);
  type(view, 'Hello');
  expect(view.getByRole('button', { name: 'Send message' }).hasAttribute('disabled')).toBe(false);
  type(view, '   ');
  expect(view.getByRole('button', { name: 'Send message' }).hasAttribute('disabled')).toBe(true);
});

test.each(['Settings', 'Components'])('opening %s from the mobile drawer closes the drawer', label => {
  const previous = window.matchMedia;
  window.matchMedia = (query: string) => ({ matches: query.includes('max-width'), media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; } });
  try {
    const view = render(<App pace={fast} />);
    fireEvent.click(view.getByRole('button', { name: 'Open sidebar' }));
    expect(view.container.querySelector('.sidebar.drawer-open')).not.toBeNull();
    fireEvent.click(view.getByRole('button', { name: label === 'Settings' ? 'Settings' : /Components/ }));
    expect(view.container.querySelector('.sidebar.drawer-open') === null).toBe(true);
    expect(view.getByRole('dialog')).toBeDefined();
  } finally { window.matchMedia = previous; }
});

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

test('live history keeps component submissions in order without adding visible user turns', async () => {
  const inputs: AgentInput[] = [];
  const agent: Agent = { id: 'history', label: 'History probe', async *respond(input) {
    inputs.push(input);
    yield { type: 'text', delta: inputs.length === 1 ? '```ui:pick\n{"id":"history-pick","question":"Choose a model","options":[{"id":"chosen-model","title":"A laptop","scores":{}}]}\n```' : 'Noted.' };
  } };
  const view = render(<App pace={fast} agentFactory={() => agent} />);
  send(view, 'Recommend a laptop'); await done(view);
  fireEvent.click(view.getByRole('button', { name: 'Choose' })); await done(view);
  expect(users(view.container)).toHaveLength(1);
  send(view, 'Why that configuration?'); await done(view);
  expect(inputs.map(input => input.kind)).toEqual(['message', 'action', 'message']);
  const history = inputs[2].history;
  expect(history.map(turn => turn.role)).toEqual(['user', 'assistant', 'user', 'assistant']);
  expect(history[2].text).toContain('[UI interaction]');
  expect(history[2].text).toContain('chosen-model');
  expect(history[3].text).toBe('Noted.');
  expect(users(view.container)).toHaveLength(2);
  expect(view.container.textContent).not.toContain('[UI interaction]');
});

test.each(['Enter', 'Send message', 'suggestion'])('first message via %s moves focus to the footer composer', async method => {
  const view = render(<App pace={{ ...fast, thinking: () => 10000 }} />);
  const original = view.getByRole('textbox', { name: 'Message Prism' });
  act(() => original.focus());
  await act(async () => {
    if (method === 'suggestion') fireEvent.click(view.getByRole('button', { name: /Pick a laptop Find/ }));
    else {
      type(view, 'Help me pick a laptop');
      if (method === 'Enter') fireEvent.keyDown(original, { key: 'Enter' });
      else fireEvent.click(view.getByRole('button', { name: 'Send message' }));
    }
  });
  const composer = view.getByRole('textbox', { name: 'Message Prism' });
  expect(composer === original).toBe(false);
  expect(document.activeElement === composer).toBe(true);
  fireEvent.click(view.getByRole('button', { name: 'Settings' }));
  expect(document.activeElement === view.getByLabelText('Assistant')).toBe(true);
  await act(async () => { fireEvent.click(view.getByRole('button', { name: 'Close' })); fireEvent.click(view.getByRole('button', { name: 'Stop response' })); });
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
  let turn = 0;
  const view = render(<App pace={{ ...fast, thinking: () => turn++ ? 100 : 0 }} />); send(view, 'Budget a 6-person team offsite'); await done(view);
  const checkbox = view.getByRole('checkbox', { name: 'Contingency' }) as HTMLInputElement;
  expect(checkbox.checked).toBe(false);
  fireEvent.click(view.getByRole('button', { name: 'Use this estimate' }));
  expect(checkbox.checked).toBe(false);
  expect(replies(view.container)).toHaveLength(2);
  expect((view.getByRole('button', { name: 'Estimate saved' }) as HTMLButtonElement).disabled).toBe(true);
  await done(view);
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
  fireEvent.click(view.getByRole('button', { name: 'Replay reply' })); await done(view);
  expect(users(view.container)).toHaveLength(1); expect(replies(view.container)).toHaveLength(1);
  expect(view.container.querySelector('[data-prism="pick"]')).not.toBeNull();
});

test('header replay streams the recorded reply without another model call or additional turns', async () => {
  let calls = 0;
  const agent: Agent = { id: 'replay', label: 'Replay probe', async *respond() {
    calls++; yield { type: 'text', delta: 'A reply worth thinking about.' };
  } };
  const pace: Pace = { ...fast }, view = render(<App pace={pace} agentFactory={() => agent} />);
  expect((view.getByRole('button', { name: 'Replay stream' }) as HTMLButtonElement).disabled).toBe(true);
  send(view, 'Hello'); await done(view);
  pace.thinking = () => 10000;
  fireEvent.click(view.getByRole('button', { name: 'Replay stream' }));
  expect(view.getByLabelText('Thinking')).toBeDefined();
  expect((view.getByRole('button', { name: 'Replay stream' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(view.getByRole('button', { name: 'Stop response' })); await done(view);
  expect(view.getByText('A reply worth thinking about.')).toBeDefined();
  pace.thinking = () => 0;
  fireEvent.click(view.getByRole('button', { name: 'Replay stream' })); await done(view);
  expect(view.getByText('A reply worth thinking about.')).toBeDefined();
  expect(calls).toBe(1); expect(users(view.container)).toHaveLength(1); expect(replies(view.container)).toHaveLength(1);
});

test('component navigation groups live numbers, scrolls and focuses the real root, and clears on new chat', async () => {
  const view = render(<App pace={fast} />);
  expect(view.queryByRole('navigation', { name: 'In this conversation' })).toBeNull();
  send(view, 'Budget a 6-person team offsite'); await done(view);
  const navigation = view.getByRole('navigation', { name: 'In this conversation' });
  expect(navigation.querySelectorAll('button')).toHaveLength(2);
  const target = view.container.querySelector<HTMLElement>('[data-prism="estimate"][data-part="root"]')!;
  const scrolls: unknown[] = [];
  target.scrollIntoView = options => { scrolls.push(options); };
  fireEvent.click(view.getByRole('button', { name: /Estimate\s*02/ }));
  expect(scrolls).toHaveLength(1); expect(document.activeElement === target).toBe(true);
  fireEvent.click(view.getByRole('checkbox', { name: 'Contingency' }));
  fireEvent.click(view.getByRole('button', { name: 'Replay stream' })); await done(view);
  expect((view.getByRole('checkbox', { name: 'Contingency' }) as HTMLInputElement).checked).toBe(true);
  fireEvent.click(view.getByRole('button', { name: /New conversation/ }));
  expect(view.queryByRole('navigation', { name: 'In this conversation' })).toBeNull();
});

test('failed empty replies keep the header replay disabled and expose retry', async () => {
  const agent: Agent = { id: 'failure', label: 'Failure probe', async *respond() { throw new Error('Unavailable'); } };
  const view = render(<App pace={fast} agentFactory={() => agent} />);
  send(view, 'Hello'); await done(view);
  expect(view.getByRole('alert').textContent).toContain('The response was interrupted.');
  expect((view.getByRole('button', { name: 'Replay stream' }) as HTMLButtonElement).disabled).toBe(true);
  expect(view.getByRole('button', { name: 'Replay reply' })).toBeDefined();
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
  fireEvent.click(view.getByRole('button', { name: /New conversation/ }));
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
  change(search, 'callout');
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
  change(view.getByLabelText('API key'), 'test-only');
  change(view.getByLabelText('Model'), 'mock-model');
  fireEvent.click(view.getByRole('button', { name: 'Save changes' }));
  send(view, 'Hello from a real person'); await done(view);
  expect(view.getByText('A connected model replied.')).toBeDefined(); expect(calls).toEqual(['message']);
  expect(JSON.parse(localStorage.getItem('prism-agent')!).model).toBe('mock-model');
  fireEvent.click(view.getByRole('button', { name: /Components/ }));
  const search = view.getByRole('combobox'); change(search, 'callout'); fireEvent.keyDown(search, { key: 'Enter' }); await done(view);
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
  const search = view.getByRole('combobox'); change(search, 'zzzznothing');
  expect(view.getByText('No matches. Try a component name.')).toBeDefined();
  const close = view.getByRole('button', { name: 'Close' }); act(() => close.focus());
  fireEvent.keyDown(close, { key: 'Tab', shiftKey: true }); expect(document.activeElement).toBe(search);
  fireEvent.click(close); expect(view.queryByRole('dialog')).toBeNull();
});
