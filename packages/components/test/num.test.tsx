import '../../react/test/setup';
import { afterEach, expect, test } from 'bun:test';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { Prism, createRegistry, type Action } from '@prism-ui/react';
import { createStore } from '@prism-ui/state';
import { num, calc } from '../src/num';

afterEach(cleanup);

test('num and calc tolerate streaming and invalid currency overrides', () => {
  const store = createStore({ initial: { n: 12 } }), view = render(<Prism source="" done={false} store={store} animate={false} locale="en-US" currency="GBP" />);
  for (const [currency, code] of [['', 'GBP'], ['U', 'GBP'], ['US', 'GBP'], ['U1D', 'GBP'], ['USDD', 'GBP'], ['USD', 'USD'], ['EUR', 'EUR'], ['eur', 'EUR'], [' eUr ', 'EUR'], ['  ', 'GBP'], [' u ', 'GBP']]) {
    const source = `:num[12]{id=n format=currency currency="${currency}"} :calc[n*2]{format=currency currency="${currency}"}`;
    view.rerender(<Prism source={source} done={false} store={store} animate={false} locale="en-US" currency="GBP" />);
    const format = new Intl.NumberFormat('en-US', { style: 'currency', currency: code });
    expect(view.getByRole('slider').textContent).toBe(format.format(12));
    expect(view.container.querySelector('[data-prism="calc"]')?.textContent).toBe(format.format(24));
  }
});

function setup(source = ':num[1200]{id=rent min=0 max=5000 step=50 format=currency} :calc[rent * 12]{format=currency}', store = createStore()) {
  const actions: Action[] = [];
  return { store, actions, ...render(<Prism source={source} store={store} animate={false} locale="en-US" onAction={a => actions.push(a)} />) };
}
const changes = (actions: Action[]) => actions.map(({ type, payload }) => ({ type, payload }));

test('inline number docs include usable directive examples', () => {
  const docs = createRegistry([num, calc]).docs();
  expect(docs).toContain(':num['); expect(docs).toContain(':calc[');
});

test('static inline pills have accessible parts and format live shared values', () => {
  const view = setup();
  const slider = view.getByRole('slider', { name: 'rent' });
  expect(slider.textContent).toBe('$1,200.00');
  expect(slider.getAttribute('aria-valuenow')).toBe('1200');
  expect(slider.getAttribute('aria-valuetext')).toBe('$1,200.00');
  expect(slider.className).toBe('prism-num__root');
  expect(view.getByText('$14,400.00').getAttribute('aria-live')).toBeNull();
  expect(view.getByText('$14,400.00').getAttribute('aria-label')).toBe('$14,400.00');
  fireEvent.keyDown(slider, { key: 'ArrowUp' });
  expect(view.store.get('rent')).toBe(1250); expect(view.getByText('$15,000.00')).toBeDefined();
  expect(changes(view.actions)).toEqual([{ type: 'change', payload: { id: 'rent', value: 1250, previous: 1200 } }]);
  act(() => view.store.undo()); expect(slider.textContent).toBe('$1,200.00');
});

test('streaming truncated input stays stable and initializes once available', () => {
  const store = createStore();
  const view = render(<Prism scope="test" source=":num[" done={false} store={store} animate={false} />);
  expect(store.snapshot()).toEqual({});
  view.rerender(<Prism scope="test" source=":num[]{id=rent}" done={false} store={store} animate={false} />);
  expect(view.getByRole('slider').getAttribute('data-state')).toBe('loading'); expect(store.get('rent')).toBeUndefined();
  view.rerender(<Prism scope="test" source=":num[12]{id=rent} :calc[rent*" done={false} store={store} animate={false} />);
  expect(view.getByRole('slider').textContent).toBe('12'); expect(store.get('test:0.0')).toBe(12); expect(store.get('rent')).toBeUndefined();
  view.rerender(<Prism scope="test" source=":num[12]{id=rent} :calc[rent*12] " done={false} store={store} animate={false} />);
  expect(store.get('rent')).toBeUndefined();
  view.rerender(<Prism scope="test" source=":num[12]{id=rent} :calc[rent*12] " store={store} animate={false} />);
  expect(view.getByText('144')).toBeDefined(); expect(store.snapshot()).toEqual({ rent: 12 });
});

test('keyboard clamps and snaps with shift, pages and bounds', () => {
  const view = setup(':num[2]{id=n min=0 max=30 step=2}'), slider = view.getByRole('slider');
  for (const event of [{ key: 'ArrowUp', shiftKey: true }, { key: 'PageDown' }, { key: 'End' }, { key: 'Home' }, { key: 'ArrowLeft' }]) fireEvent.keyDown(slider, event);
  expect(changes(view.actions)).toEqual([
    { type: 'change', payload: { id: 'n', value: 22, previous: 2 } },
    { type: 'change', payload: { id: 'n', value: 2, previous: 22 } },
    { type: 'change', payload: { id: 'n', value: 30, previous: 2 } },
    { type: 'change', payload: { id: 'n', value: 0, previous: 30 } },
    { type: 'change', payload: { id: 'n', value: 0, previous: 0 } },
  ]);
});

test('click and keyboard editing commit once, cancel, reject empty and invalid drafts', () => {
  const view = setup(':num[10]{id=n min=0 max=20 step=2}');
  fireEvent.click(view.getByRole('slider')); let input = view.getByRole('spinbutton');
  fireEvent.change(input, { target: { value: '15' } }); fireEvent.keyDown(input, { key: 'Enter' });
  fireEvent.keyDown(view.getByRole('slider'), { key: 'F2' }); input = view.getByRole('spinbutton');
  fireEvent.change(input, { target: { value: '4' } }); fireEvent.keyDown(input, { key: 'Escape' });
  fireEvent.keyDown(view.getByRole('slider'), { key: 'Enter' }); input = view.getByRole('spinbutton');
  fireEvent.change(input, { target: { value: '' } }); fireEvent.blur(input);
  fireEvent.click(view.getByRole('slider')); input = view.getByRole('spinbutton');
  fireEvent.change(input, { target: { value: '100' } }); fireEvent.blur(input);
  expect(changes(view.actions)).toEqual([{ type: 'change', payload: { id: 'n', value: 16, previous: 10 } }, { type: 'change', payload: { id: 'n', value: 20, previous: 16 } }]);
});

test('drag commits exact values, suppresses click editing, and cancellation restores', async () => {
  const view = setup(':num[10]{id=n step=2}'), slider = view.getByRole('slider');
  fireEvent.pointerDown(slider, { button: 0, pointerId: 1, clientX: 20 });
  fireEvent.pointerMove(slider, { pointerId: 1, clientX: 32 });
  fireEvent.pointerUp(slider, { pointerId: 1, clientX: 32 }); fireEvent.click(slider);
  expect(view.queryByRole('spinbutton')).toBeNull();
  expect(changes(view.actions)).toEqual([{ type: 'change', payload: { id: 'n', value: 16, previous: 10 } }]);
  act(() => view.store.undo()); expect(view.store.get('n')).toBe(10);
  fireEvent.pointerDown(slider, { button: 0, pointerId: 2, clientX: 0 }); fireEvent.pointerMove(slider, { pointerId: 2, clientX: 8 });
  await act(async () => { await new Promise(resolve => requestAnimationFrame(resolve)); });
  expect(view.store.get('n')).toBe(14); fireEvent.pointerCancel(slider, { pointerId: 2 }); expect(view.store.get('n')).toBe(10);
  expect(view.actions.length).toBe(1);
});

test('calc rebuilds emphasis formulas, handles NaN, and never writes to store', () => {
  const store = createStore({ initial: { a: 2, b: 3, c: 4 } }); let writes = 0;
  store.subscribe('*', () => writes++);
  const view = setup(':calc[a*b*c] :calc[0/0] :calc[]{expr="a+" errorLabel="Unavailable"}', store);
  expect(view.getByText('24')).toBeDefined(); expect(view.getByText('—').getAttribute('data-state')).toBe('error');
  expect(view.getByText('—').getAttribute('title')).toBe('0/0'); expect(view.getByText('Unavailable')).toBeDefined(); expect(writes).toBe(0);
  act(() => store.set('b', 5)); expect(view.getByText('40')).toBeDefined(); expect(writes).toBe(1);
});

test('existing nested state wins and percent uses fractional units with locale formatting', () => {
  const view = setup(':num[3]{id=quote.items.seats.qty} :calc[quote.items.seats.qty*2] :num[0.25]{id=p format=percent step=0.01 decimals=1}', createStore({ initial: { quote: { items: { seats: { qty: 7 } } } } }));
  expect(view.getByRole('slider', { name: 'quote.items.seats.qty' }).textContent).toBe('7'); expect(view.getByText('14')).toBeDefined();
  expect(view.getByRole('slider', { name: 'p' }).textContent).toBe('25.0%');
});
