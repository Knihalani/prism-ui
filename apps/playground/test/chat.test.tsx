import '../../../packages/react/test/setup';
import { afterEach, expect, test } from 'bun:test';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { App } from '../src/App';
import { demos, demoSource, groups, kitchen, registeredNames, replyFor } from '../src/catalogue';
import { makeStore } from '../src/store';

afterEach(() => { cleanup(); makeStore(true); });
const fast = { chars: 100000, delay: 0 };

test('sidebar lists every group and covers every registered component', () => {
  const x = render(<App pace={fast} />);
  for (const group of groups) expect(x.getByRole('region', { name: group })).toBeDefined();
  const covered = new Set(demos.flatMap(item => item.components));
  for (const name of registeredNames()) expect(covered.has(name)).toBe(true);
  expect(x.container.querySelectorAll('[data-demo]')).toHaveLength(demos.length);
});

test('triggering an example appends user and streamed assistant messages', async () => {
  const x = render(<App pace={fast} />);
  fireEvent.click(x.getByRole('button', { name: 'Callout' }));
  await waitFor(() => expect(x.getByText('Make the pilot feel personal')).toBeDefined());
  expect(x.container.querySelectorAll('[data-message=user]')).toHaveLength(1);
  expect(x.container.querySelectorAll('[data-message=assistant]')).toHaveLength(1);
  expect(x.getByText('What should we keep in mind before launch?')).toBeDefined();
});

test('an action appends its human message, payload chip and assistant follow-up', async () => {
  const x = render(<App pace={fast} />);
  fireEvent.click(x.getByRole('button', { name: 'Cards & badges' }));
  await waitFor(() => expect(x.getByRole('button', { name: 'Choose concierge' })).toBeDefined());
  fireEvent.click(x.getByRole('button', { name: 'Choose concierge' }));
  await waitFor(() => expect(x.container.querySelectorAll('[data-message=user]')).toHaveLength(2));
  expect(x.getByText('payload')).toBeDefined();
  expect(x.container.querySelectorAll('[data-message=assistant]')).toHaveLength(2);
  expect(x.container.querySelector('.payload pre')?.textContent).toContain('"component": "card"');
});

test('composer ignores empty input, routes typed requests and new chat clears state', async () => {
  const x = render(<App pace={fast} />), input = x.getByRole('textbox', { name: 'Message Prism' });
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(x.container.querySelectorAll('[data-message]')).toHaveLength(0);
  act(() => input.focus());
  fireEvent.change(input, { target: { value: 'Show me a callout' } });
  fireEvent.keyUp(input, { key: 'Unidentified' });
  fireEvent.keyDown(input, { key: 'Enter', shiftKey: true });
  expect(x.container.querySelectorAll('[data-message]')).toHaveLength(0);
  fireEvent.keyDown(input, { key: 'Enter' });
  await waitFor(() => expect(x.getByText('Make the pilot feel personal')).toBeDefined());
  expect((input as HTMLTextAreaElement).value).toBe('');
  makeStore().set('oldDraft', 'Clear this');
  fireEvent.click(x.getByRole('button', { name: 'New chat' }));
  expect(x.container.querySelectorAll('[data-message]')).toHaveLength(0);
  expect(makeStore().get('oldDraft')).toBeUndefined();
});

test.each(['sidebar', 'action'])('%s preserves an unsent composer draft', async trigger => {
  const x = render(<App pace={fast} />);
  fireEvent.click(x.getByRole('button', { name: 'Cards & badges' }));
  await waitFor(() => expect(x.getByRole('button', { name: 'Choose concierge' })).toBeDefined());
  const input = x.getByRole('textbox', { name: 'Message Prism' }) as HTMLTextAreaElement;
  act(() => input.focus());
  fireEvent.change(input, { target: { value: 'A draft\nnot sent yet' } });
  fireEvent.keyUp(input, { key: 'Unidentified' });
  fireEvent.click(x.getByRole('button', { name: trigger === 'sidebar' ? 'Callout' : 'Choose concierge' }));
  expect(input.value).toBe('A draft\nnot sent yet');
});

test('estimate actions demonstrate an agent state patch in the same shared store', async () => {
  const x = render(<App pace={fast} />);
  fireEvent.click(x.getByRole('button', { name: 'Estimate' }));
  await waitFor(() => expect(x.getByRole('button', { name: 'Use this estimate' })).toBeDefined());
  fireEvent.click(x.getByRole('button', { name: 'Use this estimate' }));
  await waitFor(() => expect(x.getByText(/For the next planning pass/)).toBeDefined());
  const snapshot = makeStore().snapshot();
  const id = Object.keys(snapshot).find(key => key.endsWith('-budget'))!;
  expect(makeStore().get(id + '.items.seats.qty')).toBe(6);
});

test('inline ask supplies editable required fields and submits into the conversation', async () => {
  const x = render(<App pace={fast} />);
  fireEvent.click(x.getByRole('button', { name: 'Inline ask' }));
  await waitFor(() => expect(x.getByRole('textbox', { name: /Team name/ })).toBeDefined());
  const input = x.getByRole('textbox', { name: /Team name/ });
  act(() => input.focus());
  fireEvent.change(input, { target: { value: 'Fieldnotes' } });
  fireEvent.keyUp(input, { key: 'Unidentified' });
  fireEvent.click(x.getByRole('button', { name: 'Plan the kickoff' }));
  await waitFor(() => expect(x.container.querySelectorAll('[data-message=user]')).toHaveLength(2));
  expect(x.getByText('payload')).toBeDefined();
});

test('stop and new chat cancel an unfinished response without resurrecting messages', async () => {
  const x = render(<App pace={{ chars: 1, delay: 20 }} />);
  fireEvent.click(x.getByRole('button', { name: 'Code' }));
  fireEvent.click(x.getByRole('button', { name: 'Stop response' }));
  await waitFor(() => expect(x.queryByRole('button', { name: 'Stop response' })).toBeNull());
  fireEvent.click(x.getByRole('button', { name: 'New chat' }));
  expect(x.container.querySelectorAll('[data-message]')).toHaveLength(0);
});

test('actions queue their replies in order without truncating the active stream', async () => {
  const pace = { ...fast }, x = render(<App pace={pace} />);
  fireEvent.click(x.getByRole('button', { name: 'Cards & badges' }));
  await waitFor(() => expect(x.queryByRole('button', { name: 'Stop response' }) === null).toBe(true));
  pace.chars = 1; pace.delay = 5;
  fireEvent.click(x.getByRole('button', { name: 'Markdown' }));
  fireEvent.click(x.getByRole('button', { name: 'Choose concierge' }));
  fireEvent.click(x.getByRole('button', { name: 'Choose self-serve' }));
  expect(x.container.querySelectorAll('[data-message=user]')).toHaveLength(4);
  expect(x.container.querySelectorAll('[data-message=assistant]')).toHaveLength(2);
  expect(x.queryByText(/Got it — I’ve noted/)).toBeNull();
  pace.chars = fast.chars; pace.delay = 0;
  await waitFor(() => expect(x.container.querySelectorAll('[data-message=assistant]')).toHaveLength(4));
  await waitFor(() => expect(x.queryByRole('button', { name: 'Stop response' }) === null).toBe(true));
  const replies = x.container.querySelectorAll('[data-message=assistant]');
  expect(replies[1].textContent).toContain('The goal isn’t perfection');
  expect(replies[2].textContent).toContain('Got it — I’ve noted');
  expect(replies[3].textContent).toContain('Got it — I’ve noted');
});

test.each(['Stop response', 'New chat'])('%s discards queued action replies', async control => {
  const pace = { ...fast }, x = render(<App pace={pace} />);
  fireEvent.click(x.getByRole('button', { name: 'Cards & badges' }));
  await waitFor(() => expect(x.queryByRole('button', { name: 'Stop response' }) === null).toBe(true));
  pace.chars = 1; pace.delay = 5;
  fireEvent.click(x.getByRole('button', { name: 'Markdown' }));
  fireEvent.click(x.getByRole('button', { name: 'Choose concierge' }));
  fireEvent.click(x.getByRole('button', { name: control }));
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 30)); });
  expect(x.queryByRole('button', { name: 'Stop response' }) === null).toBe(true);
  expect(x.queryByText(/Got it — I’ve noted/)).toBeNull();
  expect(x.container.querySelectorAll('[data-message=assistant]')).toHaveLength(control === 'New chat' ? 0 : 2);
});

test('copy stays local and leaves a streaming response running', async () => {
  const clipboard = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => {} } });
  try {
    const pace = { ...fast }, x = render(<App pace={pace} />);
    fireEvent.click(x.getByRole('button', { name: 'Code' }));
    await waitFor(() => expect(x.queryByRole('button', { name: 'Stop response' }) === null).toBe(true));
    pace.chars = 1; pace.delay = 5;
    fireEvent.click(x.getByRole('button', { name: 'Markdown' }));
    await act(async () => { fireEvent.click(x.getByRole('button', { name: 'Copy code' })); });
    expect(x.container.querySelectorAll('[data-message=user]')).toHaveLength(2);
    expect(x.container.querySelectorAll('[data-message=assistant]')).toHaveLength(2);
    pace.chars = fast.chars; pace.delay = 0;
    await waitFor(() => expect(x.getByText(/The goal isn’t perfection/)).toBeDefined());
    await waitFor(() => expect(x.queryByRole('button', { name: 'Stop response' }) === null).toBe(true));
  } finally {
    if (clipboard) Object.defineProperty(navigator, 'clipboard', clipboard);
    else Reflect.deleteProperty(navigator, 'clipboard');
  }
});

test('router handles specific artifact and mockup requests, fallback and distinct message namespaces', () => {
  expect(replyFor('build a react artifact')?.id).toBe('artifact-react');
  expect(replyFor('a/b variants')?.id).toBe('mockup-ab');
  expect(replyFor('compare two mockups')?.id).toBe('mockup-ab');
  expect(replyFor('show me a mockup')?.id).toBe('mockup-html');
  expect(replyFor('make a React app')?.id).toBe('artifact-react');
  expect(replyFor('unrelated request')).toBeUndefined();
  expect(replyFor('')).toBeUndefined();
  const item = demos.find(item => item.id === 'numbers')!;
  expect(demoSource(item, 'first')).toContain('first.rent');
  expect(demoSource(item, 'second')).not.toContain('first.rent');
  expect(demoSource(kitchen, 'all')).not.toContain('__SCOPE__');
  const html = demoSource(demos.find(item => item.id === 'artifact-html')!, 'html');
  expect(html).toContain('addEventListener');
  expect(html).not.toContain('onclick=');
});
