import '../../react/test/setup';
import { afterEach, expect, test } from 'bun:test';
import { act, cleanup, fireEvent, render, within } from '@testing-library/react';
import { Prism, createRegistry, type Action, type Middleware, type PrismComponentProps } from '@prism-ui/react';
import { createStore } from '@prism-ui/state';
import { pick, usePick, type PickProps } from '../src/pick';

afterEach(cleanup);
const criteria = [{ id: 'price', label: 'Price' }, { id: 'quality', label: 'Quality' }];
const options = [{ id: 'budget', title: 'Budget', subtitle: 'Save more', scores: { price: 1, quality: 0 }, pros: ['Low cost'], cons: ['Basic features'], tag: 'Value' }, { id: 'premium', title: 'Premium', scores: { price: 0, quality: 0.9 } }];
function source(props: object = {}) { return '```ui:pick\n' + JSON.stringify({ id: 'plans', question: 'Which plan?', criteria, options, ...props }) + '\n```'; }
function setup(props: object = {}) {
  const store = createStore(), actions: Action[] = [];
  return { store, actions, ...render(<Prism source={source(props)} animate={false} store={store} locale="en-US" onAction={a => actions.push(a)} />) };
}
const order = (container: HTMLElement) => Array.from(container.querySelectorAll('[data-option]')).map(element => element.getAttribute('data-option'));
const root = (container: HTMLElement) => container.querySelector('[data-prism="pick"][data-part="root"]')!;
const dot = (view: ReturnType<typeof setup>, label: string, level: number) => view.getByRole('radio', { name: `${label} weight ${level}` });

test('numeric and dotted criterion ids preserve named weights through updates and undo', () => {
  const view = setup({ criteria: [{ id: '0', label: 'Cost' }, { id: 'quality', label: 'Quality' }, { id: 'speed.0.value', label: 'Speed' }], weights: { '0': 1, quality: 2, 'speed.0.value': 3 }, options: [{ id: 'basic', title: 'Basic', scores: { '0': 1, quality: 1, 'speed.0.value': 1 } }] });
  const initial = { '0': 1, quality: 2, speed: { '0': { value: 3 } } };
  expect(view.store.get('plans.weights')).toEqual(initial);
  expect(Array.isArray(view.store.get('plans.weights'))).toBe(false);
  expect(Array.isArray(view.store.get('plans.weights.speed'))).toBe(false);
  fireEvent.click(dot(view, 'Quality', 3)); fireEvent.click(dot(view, 'Cost', 2));
  expect(view.store.get('plans.weights')).toEqual({ ...initial, '0': 2, quality: 3 });
  act(() => view.store.undo()); act(() => view.store.undo());
  expect(view.store.snapshot().plans.weights).toEqual(initial);
  act(() => view.store.set('plans.weights.speed.0.value', 2));
  expect(dot(view, 'Speed', 2).getAttribute('aria-checked')).toBe('true');
  fireEvent.click(view.getByRole('button', { name: 'Choose' }));
  expect(view.actions.at(-1)?.payload).toEqual({ option: 'basic', weights: { '0': 1, quality: 2, 'speed.0.value': 2 } });
});

test('dotted criterion ids use nested store paths and literal action keys', () => {
  const view = setup({ criteria: [{ id: 'cost.monthly', label: 'Cost' }, { id: 'quality', label: 'Quality' }], weights: { 'cost.monthly': 1, quality: 2 }, options: [{ id: 'budget', title: 'Budget', scores: { 'cost.monthly': 1, quality: 0 } }, { id: 'premium', title: 'Premium', scores: { 'cost.monthly': 0, quality: 0.9 } }] });
  expect(view.store.get('plans.weights.cost.monthly')).toBe(1); expect(order(view.container)).toEqual(['premium', 'budget']);
  fireEvent.click(dot(view, 'Cost', 2)); expect(order(view.container)).toEqual(['budget', 'premium']);
  act(() => view.store.undo()); expect(dot(view, 'Cost', 1).getAttribute('aria-checked')).toBe('true'); expect(order(view.container)).toEqual(['premium', 'budget']);
  act(() => view.store.set('plans.weights.cost.monthly', 3));
  fireEvent.click(within(view.container.querySelector('[data-option="budget"]') as HTMLElement).getByRole('button', { name: 'Choose' }));
  expect(view.actions.at(-1)?.payload).toEqual({ option: 'budget', weights: { 'cost.monthly': 3, quality: 2 } });
});

test('streamed criteria do not persist defaults ahead of explicit weights', () => {
  const store = createStore(), prefix = '```ui:pick\n{"id":"plans","criteria":[{"id":"price","label":"Price"},{"id":"quality","label":"Quality"}]';
  const view = render(<Prism source={prefix} done={false} store={store} animate={false} />);
  expect(view.getByRole('radio', { name: 'Price weight 1' }).getAttribute('aria-checked')).toBe('true'); expect(store.get('plans.weights')).toBeUndefined();
  view.rerender(<Prism source={prefix + ',"weights":{"price":3,"quality":0}'} done={false} store={store} animate={false} />);
  expect(view.getByRole('radio', { name: 'Price weight 3' }).getAttribute('aria-checked')).toBe('true');
  expect(view.getByRole('radio', { name: 'Quality weight 0' }).getAttribute('aria-checked')).toBe('true'); expect(store.get('plans.weights')).toBeUndefined();
  view.rerender(<Prism source={prefix + ',"weights":{"price":3,"quality":0}}\n```'} store={store} animate={false} />);
  expect(store.get('plans.weights')).toEqual({ price: 3, quality: 0 });
  fireEvent.click(view.getByRole('radio', { name: 'Price weight 0' })); expect(store.get('plans.weights.price')).toBe(0);
  act(() => store.undo()); expect(view.getByRole('radio', { name: 'Price weight 3' }).getAttribute('aria-checked')).toBe('true');
});

test('verdict, ranked columns, thin meters and all original metadata remain accessible', () => {
  const view = setup();
  expect(order(view.container)).toEqual(['budget', 'premium']);
  expect(view.getByRole('heading', { name: 'Budget wins.' })).toBeDefined();
  expect(view.getByText("Best for you because it's strong on Price and Quality")).toBeDefined();
  expect(view.getByText('#1')).toBeDefined(); expect(view.getByText('#2')).toBeDefined();
  expect(view.getByLabelText('50% match')).toBeDefined(); expect(view.getByLabelText('45% match')).toBeDefined();
  expect(view.getByText('Top pick')).toBeDefined(); expect(view.getByText('Value')).toBeDefined();
  expect(view.getByText('Low cost')).toBeDefined(); expect(view.getByText('Basic features')).toBeDefined();
  expect(view.getAllByRole('meter').length).toBe(4);
  expect(view.container.querySelector('[data-part="value"]')?.textContent).toBe('100%');
  expect(view.container.querySelector('[data-part="live"]')?.textContent).toBe('Top pick: Budget');
  expect(view.getByRole('group', { name: 'Which plan?' })).toBeDefined();
  const docs = createRegistry([pick]).docs(); expect(docs).toContain('```ui:pick'); expect(docs).toContain('"scores"'); expect(docs).toContain('radio dots');
});

test('four direct radio dots select 0–3 and undo restores weights and rank', () => {
  const view = setup(); expect(view.getAllByRole('radio').length).toBe(8);
  fireEvent.click(dot(view, 'Price', 3)); expect(view.store.get('plans.weights.price')).toBe(3);
  fireEvent.click(dot(view, 'Price', 0)); expect(view.store.get('plans.weights')).toEqual({ price: 0, quality: 1 });
  expect(order(view.container)).toEqual(['premium', 'budget']);
  act(() => view.store.undo()); expect(dot(view, 'Price', 3).getAttribute('aria-checked')).toBe('true'); expect(order(view.container)).toEqual(['budget', 'premium']);
});

test('each radio group has one tab stop and arrow/Home/End keys select and focus levels', () => {
  const view = setup(), group = within(view.getByRole('radiogroup', { name: 'Price weight' }));
  expect(group.getAllByRole('radio').map(r => r.tabIndex)).toEqual([-1, 0, -1, -1]);
  act(() => dot(view, 'Price', 1).focus()); fireEvent.keyDown(dot(view, 'Price', 1), { key: 'ArrowRight' });
  expect(document.activeElement).toBe(dot(view, 'Price', 2)); expect(view.store.get('plans.weights.price')).toBe(2);
  fireEvent.keyDown(dot(view, 'Price', 2), { key: 'End' }); expect(document.activeElement).toBe(dot(view, 'Price', 3));
  fireEvent.keyDown(dot(view, 'Price', 3), { key: 'ArrowUp' }); expect(document.activeElement).toBe(dot(view, 'Price', 0));
  fireEvent.keyDown(dot(view, 'Price', 0), { key: 'ArrowLeft' }); expect(document.activeElement).toBe(dot(view, 'Price', 3));
  fireEvent.keyDown(dot(view, 'Price', 3), { key: 'Home' }); expect(document.activeElement).toBe(dot(view, 'Price', 0));
  fireEvent.keyDown(dot(view, 'Price', 0), { key: ' ' }); expect(view.store.get('plans.weights.price')).toBe(0);
});

test('headless chip consumers retain cycling and criterion focus navigation', () => {
  function Headless(ctx: PrismComponentProps<PickProps>) { const vm = usePick(ctx.props, ctx); return <>{vm.chips.map(chip => <button key={chip.id} {...chip.props}>{chip.label}</button>)}</>; }
  const store = createStore(), view = render(<Prism source={source()} store={store} components={{ pick: Headless }} animate={false} />);
  const price = view.getByRole('button', { name: 'Price, weight 1 of 3' });
  for (const level of [2, 3, 0, 1]) { fireEvent.click(price); expect(store.get('plans.weights.price')).toBe(level); }
  act(() => price.focus()); fireEvent.keyDown(price, { key: 'ArrowUp' }); expect(store.get('plans.weights.price')).toBe(2);
  fireEvent.keyDown(price, { key: 'ArrowDown' }); expect(store.get('plans.weights.price')).toBe(1);
  fireEvent.keyDown(price, { key: 'ArrowRight' }); expect(document.activeElement).toBe(view.getByRole('button', { name: 'Quality, weight 1 of 3' }));
});

test('winner primary and subordinate actions preserve payloads and editable sent receipts', () => {
  const view = setup({ weights: { price: 2, quality: 3 } });
  const card = view.container.querySelector('[data-option="premium"]')!;
  fireEvent.click(within(card as HTMLElement).getByRole('button', { name: 'Choose' }));
  expect(view.actions.map(({ type, payload }) => ({ type, payload }))).toEqual([{ type: 'choose', payload: { option: 'premium', weights: { price: 2, quality: 3 } } }]);
  expect(view.store.get('plans.chosen')).toBe('premium'); expect(card.getAttribute('data-state')).toBe('chosen'); expect(root(view.container).getAttribute('data-state')).toBe('sent');
  const primary = view.getByRole('button', { name: 'Set · Premium' }); expect((primary as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(dot(view, 'Price', 3)); expect(root(view.container).getAttribute('data-state')).toBe('ready');
  expect(view.container.querySelector('[data-part="primary"]')).toBe(primary);
  fireEvent.click(view.getByRole('button', { name: 'Go with Budget' })); expect(view.actions.at(-1)?.payload).toEqual({ option: 'budget', weights: { price: 3, quality: 3 } });
});

test('receipt uses the delivered middleware option and blocked actions never become sent', () => {
  const delivered: Action[] = [], middleware: Middleware[] = [(action, next) => next({ ...action, payload: { ...(action.payload as object), option: 'premium' } })];
  const view = render(<Prism source={source()} middleware={middleware} onAction={action => delivered.push(action)} animate={false} />);
  fireEvent.click(view.getByRole('button', { name: 'Go with Budget' }));
  expect(view.getByRole('button', { name: 'Set · Premium' })).toBeDefined(); expect((delivered[0].payload as { option: string }).option).toBe('premium');
  view.rerender(<Prism source={source()} middleware={[() => {}]} onAction={action => delivered.push(action)} animate={false} />);
  fireEvent.click(view.getByRole('radio', { name: 'Price weight 2' })); fireEvent.click(view.getByRole('button', { name: 'Go with Budget' }));
  expect(root(view.container).getAttribute('data-state')).toBe('ready'); expect(delivered.length).toBe(1);
});

test('streaming keeps known column nodes and resolves skeletons in place', () => {
  const prefix = '```ui:pick\n{"id":"plans","criteria":[{"id":"price","label":"Price"}],"options":[{"id":"budget","title":"Budget"';
  const store = createStore(), view = render(<Prism source={prefix} done={false} store={store} animate={false} />), item = view.container.querySelector('[data-option="budget"]');
  expect(root(view.container).getAttribute('data-state')).toBe('streaming'); expect(item?.getAttribute('data-state')).toBe('loading');
  expect(view.container.querySelector('[data-prism-skeleton-line]')).not.toBeNull(); expect((view.getByRole('button', { name: 'Choose' }) as HTMLButtonElement).disabled).toBe(true);
  view.rerender(<Prism source={prefix + ',"scores":{"price":0.9}}]}\n```'} store={store} animate={false} />);
  expect(view.container.querySelector('[data-option="budget"]')).toBe(item); expect(root(view.container).getAttribute('data-state')).toBe('ready');
  expect(item?.getAttribute('data-state')).toBe('top'); expect((view.getByRole('button', { name: 'Choose' }) as HTMLButtonElement).disabled).toBe(false);
});

test('empty, invalid scores and all-zero ties remain safe', () => {
  const view = setup({ weights: { price: 0, quality: 0 } });
  expect(order(view.container)).toEqual(['budget', 'premium']); expect(view.getAllByLabelText('0% match').length).toBe(2);
  expect(view.container.querySelector('[data-top]')).toBeNull(); expect((view.getByRole('button', { name: 'Choose what matters' }) as HTMLButtonElement).disabled).toBe(true);
  act(() => view.store.set('plans.weights.quality', 3)); expect(order(view.container)).toEqual(['premium', 'budget']);
  view.rerender(<Prism source={source({ options: [{ id: 'bad', title: 'Bad', scores: 'invalid' }] })} animate={false} />);
  expect(view.container.querySelector('[data-option="bad"]')?.getAttribute('data-state')).toBe('loading');
  view.rerender(<Prism source={source({ options: [], criteria: [] })} animate={false} />);
  expect(view.getByText('Options will appear here', { selector: '[data-part="empty"]' })).toBeDefined();
});

test('external weights and bound scores flash, local edits do not, and unstyled/slots survive', () => {
  const store = createStore({ initial: { scores: { price: 1, quality: 0 } } });
  const props = { options: [{ ...options[0], scores: { $ref: 'scores' } }] };
  const view = render(<Prism source={source(props)} store={store} onAction={() => {}} />);
  fireEvent.click(view.getByRole('radio', { name: 'Price weight 2' }));
  expect(view.container.querySelector('[data-prism-flash]')).toBeNull();
  act(() => store.set('plans.weights.price', 3)); expect(view.container.querySelector('[data-part="score-line"][data-prism-flash]')).not.toBeNull();
  act(() => store.set('scores.price', 0.5)); expect(view.container.querySelector('[data-part="signal"][data-prism-flash]')).not.toBeNull();
  view.rerender(<Prism source={source()} unstyled animate={false} slots={{ pick: { actions: ({ children, ...props }) => <aside {...props} data-custom="actions">{children}</aside> } }} />);
  expect(view.container.querySelector('[data-part][class*="prism-"]')).toBeNull(); expect(view.container.querySelectorAll('[data-custom="actions"]').length).toBe(2);
  expect(root(view.container).hasAttribute('data-entering')).toBe(false);
});
