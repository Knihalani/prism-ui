import '../../react/test/setup';
import { afterEach, expect, test } from 'bun:test';
import { act, cleanup, fireEvent, render, within } from '@testing-library/react';
import { Prism, createRegistry, type Action } from '@prism-ui/react';
import { createStore } from '@prism-ui/state';
import { estimate } from '../src/estimate';
import '../src/num';

afterEach(cleanup);

test('sent receipt describes the final middleware-delivered estimate', () => {
  const view = render(<Prism source={source()} onAction={() => {}} middleware={[(action, next) => next({ ...action, payload: { items: [{ id: 'seats' }], total: 42 } })]} animate={false} />);
  fireEvent.click(view.getByRole('button', { name: 'Use this estimate' }));
  expect(view.getByText('Sent · 1 items, $42.00')).toBeDefined();
  expect(view.getByRole('group', { name: 'Team plan' }).dataset.state).toBe('sent');
});

test('use stays in place as a sent check pill and edits permit resending', () => {
  const view = setup(), button = view.getByRole('button', { name: 'Use this estimate' });
  fireEvent.click(button);
  expect(view.getByRole('group', { name: 'Team plan' }).dataset.state).toBe('sent');
  expect(button.textContent).toBe('Sent · 2 items, $70.00');
  expect(button.classList.contains('prism-pill')).toBe(true);
  expect(view.getByRole('spinbutton', { name: 'Seats' })).toBeDefined();
  fireEvent.click(view.getByRole('button', { name: 'Increase Seats' }));
  expect(view.getByRole('group', { name: 'Team plan' }).dataset.state).toBe('ready');
  expect(button.textContent).toBe('Use this estimate');
  fireEvent.click(button);
  expect(view.actions).toHaveLength(2);
  act(() => view.store.set('quote.items.seats.qty', 5));
  expect(view.getByRole('group', { name: 'Team plan' }).dataset.state).toBe('ready');
});

test('external quantities highlight the total but its own stepper does not', () => {
  const store = createStore(), view = render(<Prism source={source()} store={store} animate={false} />);
  const total = view.container.querySelector('[data-part="total-value"]')!;
  expect(total.hasAttribute('data-prism-flash')).toBe(false);
  fireEvent.click(view.getByRole('button', { name: 'Increase Seats' }));
  expect(total.hasAttribute('data-prism-flash')).toBe(false);
  act(() => store.set('quote.items.seats.qty', 5));
  expect(total.hasAttribute('data-prism-flash')).toBe(true);
  expect(total.textContent).toBe('$110.00');
});

test('frame undo and keyboard redo affect only their estimate in a shared store', () => {
  const store = createStore(), props = { items: [{ id: 'seats', label: 'Seats', price: 20, qty: 5 }] };
  const view = render(<><Prism source={source({ ...props, id: 'first', title: 'First' })} store={store} animate={false} /><Prism source={source({ ...props, id: 'second', title: 'Second' })} store={store} animate={false} /></>);
  const first = within(view.getByRole('group', { name: 'First' })), second = within(view.getByRole('group', { name: 'Second' }));
  fireEvent.click(second.getByRole('button', { name: 'Increase Seats' }));
  expect((first.getByRole('button', { name: 'Undo' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(first.getByRole('button', { name: 'Increase Seats' }));
  fireEvent.click(second.getByRole('button', { name: 'Increase Seats' }));
  fireEvent.click(first.getByRole('button', { name: 'Undo' }));
  expect(store.get('first.items.seats.qty')).toBe(5); expect(store.get('second.items.seats.qty')).toBe(7);
  expect((first.getByRole('button', { name: 'Undo' }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.keyDown(view.getByRole('group', { name: 'First' }), { key: 'z', ctrlKey: true, shiftKey: true });
  expect(store.get('first.items.seats.qty')).toBe(6); expect(store.get('second.items.seats.qty')).toBe(7);
});

test('numeric and dotted item ids preserve named rows through edits and undo', () => {
  const view = setup({ items: [{ id: '0', label: 'Zero', price: 10, qty: 2 }, { id: 'seats', label: 'Seats', price: 20, qty: 3 }, { id: 'support.0.hours', label: 'Support', price: 5, qty: 1, optional: true }] });
  const initial = { '0': { qty: 2, enabled: true }, seats: { qty: 3, enabled: true }, support: { '0': { hours: { qty: 1, enabled: true } } } };
  expect(view.store.get('quote.items')).toEqual(initial);
  expect(Array.isArray(view.store.get('quote.items'))).toBe(false);
  expect(Array.isArray(view.store.get('quote.items.support'))).toBe(false);
  fireEvent.click(view.getByRole('button', { name: 'Increase Seats' }));
  expect(view.store.get('quote.items.0.qty')).toBe(2); expect(view.store.get('quote.total')).toBe(105);
  fireEvent.click(view.getByRole('button', { name: 'Increase Zero' }));
  expect(view.store.get('quote.items.seats.qty')).toBe(4); expect(view.store.get('quote.total')).toBe(115);
  act(() => view.store.undo()); act(() => view.store.undo());
  expect(view.store.snapshot().quote.items).toEqual(initial); expect(view.store.get('quote.total')).toBe(85);
  fireEvent.click(view.getByRole('checkbox', { name: 'Support' }));
  expect(view.store.get('quote.total')).toBe(80);
  act(() => view.store.set('quote.items.support.0.hours.qty', 4));
  expect((view.getByRole('spinbutton', { name: 'Support' }) as HTMLInputElement).value).toBe('4');
  fireEvent.click(view.getByRole('checkbox', { name: 'Support' }));
  expect(view.store.get('quote.total')).toBe(100);
  fireEvent.click(view.getByRole('button', { name: 'Use this estimate' }));
  expect(view.actions.at(-1)?.payload).toEqual({ items: [{ id: '0', label: 'Zero', qty: 2, price: 10, amount: 20 }, { id: 'seats', label: 'Seats', qty: 3, price: 20, amount: 60 }, { id: 'support.0.hours', label: 'Support', qty: 4, price: 5, amount: 20 }], total: 100 });
});

test('dotted item ids share nested quantity and enabled paths with controls and undo', () => {
  const view = setup({ items: [{ id: 'support.hours', label: 'Support hours', price: 10, qty: 2, optional: true }] }, ':num[2]{id=quote.items.support.hours.qty} :calc[quote.total]');
  const input = view.getByRole('spinbutton', { name: 'Support hours' }) as HTMLInputElement;
  expect(view.store.get('quote.items.support.hours.qty')).toBe(2);
  fireEvent.click(view.getByRole('button', { name: 'Increase Support hours' }));
  expect(input.value).toBe('3'); expect(view.store.get('quote.total')).toBe(30);
  act(() => view.store.undo());
  expect(input.value).toBe('2'); expect(view.store.get('quote.total')).toBe(20);
  fireEvent.keyDown(view.getByRole('slider'), { key: 'ArrowUp' });
  expect(input.value).toBe('3'); expect(view.store.get('quote.total')).toBe(30);
  fireEvent.click(view.getByRole('checkbox', { name: 'Support hours' }));
  expect(view.store.get('quote.items.support.hours.enabled')).toBe(false); expect(view.store.get('quote.total')).toBe(0);
  act(() => view.store.undo());
  fireEvent.click(view.getByRole('button', { name: 'Use this estimate' }));
  expect(view.actions.at(-1)?.payload).toEqual({ items: [{ id: 'support.hours', label: 'Support hours', qty: 3, price: 10, amount: 30 }], total: 30 });
});

test('streaming partial and invalid currencies fall back until a complete code arrives', () => {
  const store = createStore();
  const view = render(<Prism source={'```ui:estimate\n{"id":"quote","items":[{"id":"seats","label":"Seats","price":20}],"currency":"'} done={false} store={store} animate={false} locale="en-US" currency="GBP" />);
  for (const [currency, code] of [['', 'GBP'], ['U', 'GBP'], ['US', 'GBP'], ['U1D', 'GBP'], ['USDD', 'GBP'], ['USD', 'USD'], ['EUR', 'EUR'], ['eur', 'EUR'], [' eUr ', 'EUR'], ['  ', 'GBP'], [' u ', 'GBP']]) {
    view.rerender(<Prism source={'```ui:estimate\n{"id":"quote","items":[{"id":"seats","label":"Seats","price":20}],"currency":"' + currency} done={false} store={store} animate={false} locale="en-US" currency="GBP" />);
    expect(view.container.querySelector('[data-part="total-value"]')?.textContent).toBe(new Intl.NumberFormat('en-US', { style: 'currency', currency: code }).format(20));
  }
  view.rerender(<Prism source={source({ currency: 'EUR', items: [{ id: 'seats', label: 'Seats', price: 20 }] })} store={store} animate={false} locale="en-US" currency="GBP" />);
  expect(view.container.querySelector('[data-part="total-value"]')?.textContent).toBe('€20.00');
});
const items = [{ id: 'seats', label: 'Seats', description: 'Team access', price: 20, qty: 3, min: 1, max: 20, unit: 'seat' }, { id: 'support', label: 'Support', price: 10, optional: true }];
function source(props: object = {}) { return '```ui:estimate\n' + JSON.stringify({ id: 'quote', title: 'Team plan', items, ...props }) + '\n```\n\n'; }
function setup(props: object = {}, suffix = '') {
  const store = createStore(), actions: Action[] = [];
  return { store, actions, ...render(<Prism source={source(props) + suffix} store={store} animate={false} locale="en-US" onAction={a => actions.push(a)} />) };
}

test('renders frame, itemized prices, localized totals, docs and exact use payload', () => {
  const view = setup({ discount: 0.1, taxRate: 0.1 });
  expect(view.getByRole('group', { name: 'Team plan' })).toBeDefined();
  expect(view.getByRole('button', { name: 'Undo' })).toBeDefined();
  expect(view.getByRole('button', { name: 'Ask about this' })).toBeDefined();
  expect(view.getByRole('checkbox', { name: 'Support' }).getAttribute('type')).toBe('checkbox');
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
  expect(view.store.canUndo()).toBe(false); expect(view.store.canRedo()).toBe(true);
  act(() => view.store.redo()); expect(view.store.get('quote.items.seats.qty')).toBe(4); expect(view.store.get('quote.subtotal')).toBe(90); expect(view.store.get('quote.total')).toBe(90);
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

test('external num edits and derived estimate values undo and redo together', () => {
  const view = setup({}, ':num[3]{id=quote.items.seats.qty} :calc[quote.total * 12]');
  const slider = view.getByRole('slider');
  const input = view.getByRole('spinbutton', { name: 'Seats' }) as HTMLInputElement;
  expect(view.store.canUndo()).toBe(false);
  expect(view.store.get('quote.total')).toBe(70);
  fireEvent.keyDown(slider, { key: 'ArrowUp' });
  expect(input.value).toBe('4'); expect(view.store.get('quote.subtotal')).toBe(90); expect(view.store.get('quote.total')).toBe(90);
  expect(view.getByText('1,080')).toBeDefined();
  act(() => view.store.undo());
  expect(input.value).toBe('3'); expect(slider.textContent).toBe('3');
  expect(view.store.get('quote.subtotal')).toBe(70); expect(view.store.get('quote.total')).toBe(70);
  expect(view.getByText('840')).toBeDefined(); expect(view.store.canUndo()).toBe(false); expect(view.store.canRedo()).toBe(true);
  act(() => view.store.redo());
  expect(input.value).toBe('4'); expect(slider.textContent).toBe('4');
  expect(view.store.get('quote.subtotal')).toBe(90); expect(view.store.get('quote.total')).toBe(90);
  expect(view.getByText('1,080')).toBeDefined(); expect(view.store.canRedo()).toBe(false);
  act(() => view.store.undo()); act(() => view.store.redo());
  expect(view.store.get('quote.total')).toBe(90);
});

test('estimate reconciliation after history travel preserves redo', () => {
  const store = createStore({ initial: { quote: { items: { seats: { qty: 3 } }, subtotal: 0, total: 0 } } });
  const view = render(<Prism source={source({ items: [items[0]] })} store={store} animate={false} />);
  expect(store.get('quote.total')).toBe(60); expect(store.canUndo()).toBe(false);
  act(() => store.set('quote.items.seats.qty', 4));
  expect(store.get('quote.total')).toBe(80);
  view.rerender(<Prism source={source({ items: [{ ...items[0], price: 30 }] })} store={store} animate={false} />);
  expect(store.get('quote.total')).toBe(120);
  act(() => store.undo());
  expect(store.get('quote.items.seats.qty')).toBe(3); expect(store.get('quote.total')).toBe(90); expect(store.canRedo()).toBe(true);
  act(() => store.redo());
  expect(store.get('quote.items.seats.qty')).toBe(4); expect(store.get('quote.total')).toBe(120);
});

test('streaming partial price uses a skeleton with totals throughout; empty is safe', () => {
  const store = createStore();
  const prefix = '```ui:estimate\n{"id":"quote","items":[{"id":"seats","label":"Seats"';
  const view = render(<Prism scope="test" source={prefix} done={false} store={store} animate={false} />);
  expect(view.container.querySelector('[data-part="item"]')?.getAttribute('data-state')).toBe('loading');
  expect(view.getByText('Total')).toBeDefined(); expect(store.get('test:estimate:0.total')).toBe(0); expect(store.get('quote')).toBeUndefined();
  expect(view.getByRole('button', { name: 'Use this estimate' }).hasAttribute('disabled')).toBe(true);
  view.rerender(<Prism scope="test" source={prefix + ',"price":20'} done={false} store={store} animate={false} />);
  expect(store.get('test:estimate:0.items.seats.qty')).toBeUndefined();
  view.rerender(<Prism scope="test" source={prefix + ',"price":20,"qty":3}]}\n```'} done={false} store={store} animate={false} />);
  expect(view.container.querySelector('[data-part="item"]')?.getAttribute('data-state')).toBe('ready'); expect(store.get('test:estimate:0.total')).toBe(60);
  view.rerender(<Prism scope="test" source={source({ items: [] })} store={store} animate={false} />);
  expect(view.getByText('Items will appear here')).toBeDefined(); expect(store.get('quote.total')).toBe(0); expect(store.get('test:estimate:0')).toBeUndefined();
});
