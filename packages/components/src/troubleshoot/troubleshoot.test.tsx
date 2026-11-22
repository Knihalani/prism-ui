import '../../../react/test/setup';
import { afterEach, expect, test } from 'bun:test';
import { Prism, createRegistry } from '@prism-ui/react';
import { createStore } from '@prism-ui/state';
import { troubleshootDefinition } from './troubleshoot';

const { act, cleanup, fireEvent, render } = await import('@testing-library/react');
afterEach(cleanup);
const registry = createRegistry([troubleshootDefinition]);
const fence = (steps: unknown, extra = {}) => '```ui:troubleshoot\n' + JSON.stringify({ start: 'first', steps, ...extra }) + '\n```';

test.each(['Did this fix it?', 'Try again. Did that fix the issue?  ', 'Did it fix the connection?'])('suppresses only a repeated default fix prompt: %s', text => {
  const view = render(<Prism source={fence({ first: { text } })} registry={registry} />);
  expect(view.container.querySelector('[data-part="question"]')).toBeNull();
  expect(view.getByRole('button', { name: 'Yes' })).toBeDefined();
  expect(view.getByRole('button', { name: 'No' })).toBeDefined();
});

test('per-step question overrides the prompt, including an intentionally empty prompt', () => {
  const view = render(<Prism source={fence({ first: { text: 'Did this fix it?', question: 'Can you connect now?' } })} registry={registry} />);
  expect(view.getByText('Can you connect now?')).toBeDefined();
  view.rerender(<Prism source={fence({ first: { text: 'Restart.', question: '' } })} registry={registry} />);
  expect(view.container.querySelector('[data-part="question"]')).toBeNull();
  view.rerender(<Prism source={fence({ first: { text: 'Did this fix it?' } }, { labels: { question: 'A custom global prompt?' } })} registry={registry} />);
  expect(view.getByText('A custom global prompt?')).toBeDefined();
  expect(registry.docs()).toContain('question?: string');
});

test.each(['', '   '])('blank title %j still renders the instructions', title => {
  const view = render(<Prism source={fence({ first: { title, text: 'Restart the adapter.' } })} registry={registry} />);
  expect(view.getByRole('heading', { level: 4, name: /Restart the adapter/ })).toBeDefined();
});

test.each([
  { text: 'Restart the adapter. Wait until it settles.', label: 'Restart the adapter.' },
  { text: 'This instruction has more than six words before its ending!', label: 'This instruction has more than six…' },
  { text: 'One two three four five six seven', label: 'One two three four five six…' },
])('untitled answer uses the first sentence or six words: $label', ({ text, label }) => {
  const view = render(<Prism source={fence({ first: { text, no: 'next' }, next: { text: 'Try another path.' } })} registry={registry} />);
  fireEvent.click(view.getByRole('button', { name: 'No' }));
  const answer = view.getByRole('button', { name: text + ' No' });
  expect(answer.textContent).toContain(label);
  expect(view.getByRole('img', { name: /Troubleshooting path/ }).querySelectorAll('[data-station="taken"]').length).toBe(1);
  fireEvent.click(answer);
  expect(view.getByRole('button', { name: 'Rewind' }).hasAttribute('disabled')).toBe(true);
});

test('skeleton never overwrites restored answers or failed-storage defaults', async () => {
  const source = fence({ first: { text: 'Restart.' } });
  const previous = createStore(), first = render(<Prism source={source} scope="restore" registry={registry} store={previous} />);
  fireEvent.click(first.getByRole('button', { name: 'Yes' }));
  const snapshot = previous.snapshot(); first.unmount();
  let hydrate!: (value: object) => void;
  const store = createStore({ persist: { load: () => new Promise<object>(resolve => { hydrate = resolve; }), save() {} } });
  const view = render(<Prism source={source} scope="restore" registry={registry} store={store} />);
  expect(view.container.querySelector('[data-prism-skeleton]')?.getAttribute('aria-hidden')).toBe('true');
  expect(view.queryByRole('button')).toBeNull(); expect(store.snapshot()).toEqual({});
  await act(async () => { hydrate(snapshot); await store.ready; });
  expect(store.snapshot()).toEqual(snapshot); expect(view.getByText('Fixed.')).toBeDefined();
  view.unmount();
  let reject!: (error: Error) => void;
  const failed = createStore({ persist: { load: () => new Promise<object>((_, fail) => { reject = fail; }), save() {} } });
  const next = render(<Prism source={source} registry={registry} store={failed} />);
  expect(failed.snapshot()).toEqual({});
  await act(async () => { reject(new Error('Unavailable')); await failed.ready; });
  expect(next.getByRole('button', { name: 'Yes' })).toBeDefined();
});

test('partial and empty inputs are decorative and never write state', () => {
  const store = createStore();
  const view = render(<Prism source={'```ui:troubleshoot\n{"start":"first","steps":{'} done={false} registry={registry} store={store} />);
  expect(view.queryByRole('button')).toBeNull(); expect(store.snapshot()).toEqual({});
  expect(view.container.querySelector('[data-prism-skeleton]')).not.toBeNull();
  view.rerender(<Prism source={fence({})} registry={registry} store={store} />);
  expect(view.getByText('Let’s hand this to a human.')).toBeDefined();
});
