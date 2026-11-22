import '../../react/test/setup';
import { afterEach, expect, test } from 'bun:test';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { Prism, createRegistry, type Action } from '@prism-ui/react';
import { createStore } from '@prism-ui/state';
import { estimate } from '../src/estimate';
import '../src/num';

afterEach(cleanup);
const items = [{ id: 'seats', label: 'Seats', description: 'Team access', price: 20, qty: 3, min: 1, max: 20, unit: 'seat' }, { id: 'support', label: 'Support', price: 10, optional: true }];
function source(props: object = {}) { return '```ui:estimate\n' + JSON.stringify({ id: 'quote', title: 'Team plan', items, ...props }) + '\n```\n\n'; }
function setup(props: object = {}, suffix = '') {
  const store = createStore(), actions: Action[] = [];
  return { store, actions, ...render(<Prism source={source(props) + suffix} store={store} animate={false} locale="en-US" onAction={a => actions.push(a)} />) };
}

test('renders frame, itemized prices, localized totals, docs and exact use payload', () => {
  const view = setup({ discount: 0.1, taxRate: 0.1 });
  expect(view.getByRole('group', { name: 'Team plan' })).toBeDefined();
  expect(view.getByText('$20.00 / seat')).toBeDefined();
  expect(view.getByText('Team access')).toBeDefined();
  expect(view.store.get('quote.subtotal')).toBe(70); expect(view.store.get('quote.total')).toBeCloseTo(69.3);
  expect(view.container.querySelector('[data-part="live"]')?.textContent).toBe('$69.30');
  fireEvent.click(view.getByRole('button', { name: 'Use this estimate' }));
  expect(view.actions.map(({ type, payload }) => ({ type, payload }))).toEqual([{ type: 'use', payload: { items: [{ id: 'seats', label: 'Seats', qty: 3, price: 20, amount: 60 }, { id: 'support', label: 'Support', qty: 1, price: 10, amount: 10 }], total: 69.3 } }]);
  expect(view.actions[0].message).toBe('Use this estimate: 2 items, total $69.30');
  expect(createRegistry([estimate]).docs()).toContain('```ui:estimate');
});

test('one click and undo restore both quantity and total, with live calc updates', () => {
  const view = setup({}, ':calc[quote.total * 12]{format=currency}');
  expect(view.getByText('$840.00')).toBeDefined();
  fireEvent.click(view.getByRole('button', { name: 'Increase Seats' }));
  expect(view.store.get('quote.items.seats.qty')).toBe(4); expect(view.store.get('quote.total')).toBe(90); expect(view.getByText('$1,080.00')).toBeDefined();
  act(() => view.store.undo());
  expect(view.store.get('quote.items.seats.qty')).toBe(3); expect(view.store.get('quote.total')).toBe(70); expect(view.getByText('$840.00')).toBeDefined();
  act(() => view.store.redo()); expect(view.store.get('quote.total')).toBe(90);
});

test('optional checkbox updates atomically and excludes disabled items from use', () => {
  const view = setup();
  fireEvent.click(view.getByRole('checkbox', { name: 'Support' }));
  expect(view.store.get('quote.total')).toBe(60);
  expect(view.getByRole('spinbutton', { name: 'Support' }).hasAttribute('disabled')).toBe(true);
  fireEvent.click(view.getByRole('button', { name: 'Use this estimate' }));
  expect(view.actions.map(({ type, payload }) => ({ type, payload }))).toEqual([{ type: 'use', payload: { items: [{ id: 'seats', label: 'Seats', qty: 3, price: 20, amount: 60 }], total: 60 } }]);
  act(() => view.store.undo()); expect(view.store.get('quote.items.support.enabled')).toBe(true); expect(view.store.get('quote.total')).toBe(70);
});

test('keyboard and typed quantities snap, clamp and reject invalid input', () => {
  const view = setup({ items: [{ id: 'seats', label: 'Seats', price: 20, qty: 3, min: 1, max: 9, step: 2 }] }), input = view.getByRole('spinbutton');
  act(() => input.focus());
  fireEvent.keyDown(input, { key: 'ArrowUp' }); expect(view.store.get('quote.items.seats.qty')).toBe(5);
  fireEvent.keyDown(input, { key: 'PageUp' }); expect(view.store.get('quote.items.seats.qty')).toBe(9);
  expect(view.getByRole('button', { name: 'Increase Seats' }).hasAttribute('disabled')).toBe(true);
  fireEvent.keyDown(input, { key: 'PageDown' }); expect(view.store.get('quote.items.seats.qty')).toBe(1);
  fireEvent.input(input, { target: { value: '6' } }); expect(view.store.get('quote.items.seats.qty')).toBe(7); expect(view.store.get('quote.total')).toBe(140);
  fireEvent.input(input, { target: { value: '' } }); expect(view.store.get('quote.items.seats.qty')).toBe(7);
});

test('num writes drive the estimate row and external stale totals reconcile', () => {
  const view = setup({}, ':num[3]{id=quote.items.seats.qty}');
  fireEvent.keyDown(view.getByRole('slider'), { key: 'ArrowUp' });
  expect((view.getByRole('spinbutton', { name: 'Seats' }) as HTMLInputElement).value).toBe('4'); expect(view.store.get('quote.total')).toBe(90);
  act(() => view.store.batch(() => { view.store.set('quote.items.seats.qty', 6); view.store.set('quote.total', -1); }));
  expect(view.store.get('quote.subtotal')).toBe(130); expect(view.store.get('quote.total')).toBe(130);
});

test('streaming partial price uses a skeleton with totals throughout; empty is safe', () => {
  const store = createStore();
  const prefix = '```ui:estimate\n{"id":"quote","items":[{"id":"seats","label":"Seats"';
  const view = render(<Prism source={prefix} done={false} store={store} animate={false} />);
  expect(view.container.querySelector('[data-part="item"]')?.getAttribute('data-state')).toBe('loading');
  expect(view.getByText('Total')).toBeDefined(); expect(store.get('quote.total')).toBe(0);
  expect(view.getByRole('button', { name: 'Use this estimate' }).hasAttribute('disabled')).toBe(true);
  view.rerender(<Prism source={prefix + ',"price":20'} done={false} store={store} animate={false} />);
  expect(store.get('quote.items.seats.qty')).toBeUndefined();
  view.rerender(<Prism source={prefix + ',"price":20,"qty":3}]}\n```'} done={false} store={store} animate={false} />);
  expect(view.container.querySelector('[data-part="item"]')?.getAttribute('data-state')).toBe('ready'); expect(store.get('quote.total')).toBe(60);
  view.rerender(<Prism source={source({ items: [] })} store={store} animate={false} />);
  expect(view.getByText('Items will appear here')).toBeDefined(); expect(store.get('quote.total')).toBe(0);
});
