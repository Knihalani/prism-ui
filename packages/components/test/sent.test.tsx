import '../../react/test/setup';
import { afterEach, expect, test } from 'bun:test';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { Prism, type Middleware } from '@prism-ui/react';
import '../src';

afterEach(cleanup);
const fence = (name: string, props: object) => '```ui:' + name + '\n' + JSON.stringify(props) + '\n```';
const quote = fence('estimate', { id: 'quote', items: [{ id: 'seat', label: 'Seat', price: 10 }] });

test.each([
  ['estimate', quote, 'Use this estimate', 'Sent'],
  ['card', fence('card', { title: 'Plan', action: 'Select' }), 'Select', 'Sent'],
  ['summary', fence('summary', { actions: [{ text: 'Ship it' }] }), 'Send action items', 'Sent'],
  ['ask', fence('ask', { fields: [{ id: 'name', label: 'Name', type: 'text', value: 'Ada' }] }), 'Send', 'Sent'],
  ['pick', fence('pick', { criteria: [{ id: 'cost', label: 'Cost' }], options: [{ id: 'one', title: 'One', scores: { cost: 1 } }] }), 'Choose', 'Chosen'],
  ['runbook', '::::runbook\n:::step{title="Start" id="start"}\nStart here.\n:::\n::::', 'Stuck here?', 'Sent'],
  ['troubleshoot', fence('troubleshoot', { start: 'one', steps: { one: { text: 'Try restarting.', yes: '$fixed' } } }), 'Send report', 'Report sent'],
])('%s reserves the same receipt nodes and keeps its submit part mounted', (_name, source, readyLabel, sentLabel) => {
  const actions: unknown[] = [];
  const view = render(<Prism source={source} onAction={action => actions.push(action)} />);
  if (_name === 'troubleshoot') fireEvent.click(view.getByRole('button', { name: 'Yes' }));
  const button = view.getByRole('button', { name: readyLabel }) as HTMLButtonElement;
  const labels = Array.from(button.children), path = button.querySelector('.prism-check-mark path');
  expect(labels).toHaveLength(2); expect(path).not.toBeNull();
  expect(labels[0].getAttribute('aria-hidden')).not.toBe('true');
  expect(labels[1].getAttribute('aria-hidden')).toBe('true');
  fireEvent.click(button);
  expect(view.getByRole('button', { name: sentLabel })).toBe(button);
  expect(Array.from(button.children)).toEqual(labels);
  expect(button.querySelector('.prism-check-mark path')).toBe(path);
  expect(labels[0].getAttribute('aria-hidden')).toBe('true');
  expect(labels[1].getAttribute('aria-hidden')).not.toBe('true');
  expect(button.disabled).toBe(true); expect(actions).toHaveLength(1);
  fireEvent.click(button); expect(actions).toHaveLength(1);
});

test('estimate waits for delivery and a swallowed action never becomes a sent receipt', () => {
  let deliver: (() => void) | undefined;
  const middleware: Middleware[] = [(action, next) => { deliver = () => next(action); }];
  const view = render(<Prism source={quote} onAction={() => {}} middleware={middleware} />);
  const button = view.getByRole('button', { name: 'Use this estimate' });
  fireEvent.click(button);
  expect(button.hasAttribute('data-sent')).toBe(false);
  expect(view.queryByRole('button', { name: 'Sent' })).toBeNull();
  act(() => deliver?.());
  expect(view.getByRole('button', { name: 'Sent' })).toBe(button);
});

test('empty and undeliverable estimates do not show an acknowledged receipt', () => {
  const empty = render(<Prism source={fence('estimate', { items: [] })} onAction={() => {}} />);
  const disabled = empty.getByRole('button', { name: 'Use this estimate' }) as HTMLButtonElement;
  expect(disabled.disabled).toBe(true); fireEvent.click(disabled);
  expect(empty.queryByRole('button', { name: 'Sent' })).toBeNull(); empty.unmount();
  const blocked = render(<Prism source={quote} onAction={() => {}} middleware={[() => {}]} />);
  fireEvent.click(blocked.getByRole('button', { name: 'Use this estimate' }));
  expect(blocked.queryByRole('button', { name: 'Sent' })).toBeNull();
});

test('view acknowledges only the emitting button, leaving local actions reusable', () => {
  let deliver: (() => void) | undefined;
  const middleware: Middleware[] = [(action, next) => { deliver = () => next(action); }];
  const source = fence('view', { id: 'actions', state: { count: 0 }, children: [
    { type: 'button', label: 'Increment', onClick: { set: { count: 1 } } },
    { type: 'button', label: 'Send first', onClick: { action: 'first' } },
    { type: 'button', label: 'Send second', onClick: [{ set: { count: 2 } }, { action: 'second' }] },
  ] });
  const view = render(<Prism source={source} onAction={() => {}} middleware={middleware} />);
  const local = view.getByRole('button', { name: 'Increment' }) as HTMLButtonElement;
  const first = view.getByRole('button', { name: 'Send first' });
  const second = view.getByRole('button', { name: 'Send second' });
  expect(local.hasAttribute('data-feedback')).toBe(false);
  fireEvent.click(local); expect(local.disabled).toBe(false);
  fireEvent.click(first); expect(view.queryByRole('button', { name: 'Sent' })).toBeNull();
  fireEvent.click(second); act(() => deliver?.());
  expect(view.getByRole('button', { name: 'Sent' })).toBe(second);
  expect(view.getByRole('button', { name: 'Send first' })).toBe(first);
  expect(local.disabled).toBe(false);
});

test('ask retains its pill through submit and edit, and validation never creates a receipt', () => {
  const view = render(<Prism source={fence('ask', { fields: [{ id: 'name', label: 'Name', type: 'text', required: true }] })} onAction={() => {}} />);
  const button = view.getByRole('button', { name: 'Send' });
  fireEvent.click(button); expect(view.queryByRole('button', { name: 'Sent' })).toBeNull();
  expect(view.getByRole('alert').textContent).toBe('Required');
});

test('unstyled receipt hides inactive labels without requiring shared CSS', () => {
  const view = render(<Prism source={quote} unstyled onAction={() => {}} />);
  const button = view.getByRole('button', { name: 'Use this estimate' });
  expect(button.classList.contains('prism-pill')).toBe(false);
  expect((button.lastElementChild as HTMLElement).hidden).toBe(true);
  fireEvent.click(button);
  expect(view.getByRole('button', { name: 'Sent' })).toBe(button);
  expect((button.firstElementChild as HTMLElement).hidden).toBe(true);
  expect((button.lastElementChild as HTMLElement).hidden).toBe(false);
});
