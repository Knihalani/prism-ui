import '../../react/test/setup';
import { afterEach, expect, test } from 'bun:test';
import { act, cleanup, fireEvent, render, within } from '@testing-library/react';
import { Prism, createRegistry, type Action } from '@prism-ui/react';
import { createStore } from '@prism-ui/state';
import { pick } from '../src/pick';

afterEach(cleanup);

test('dotted criterion ids use consistent nested store paths and literal action keys', () => {
  const view = setup({ criteria: [{ id: 'cost.monthly', label: 'Cost' }, { id: 'quality', label: 'Quality' }], weights: { 'cost.monthly': 1, quality: 2 }, options: [{ id: 'budget', title: 'Budget', scores: { 'cost.monthly': 1, quality: 0 } }, { id: 'premium', title: 'Premium', scores: { 'cost.monthly': 0, quality: 0.9 } }] });
  const chip = view.getByRole('button', { name: 'Cost, weight 1 of 3' });
  expect(view.store.get('plans.weights.cost.monthly')).toBe(1); expect(order(view.container)).toEqual(['premium', 'budget']);
  fireEvent.click(chip);
  expect(view.store.get('plans.weights.cost.monthly')).toBe(2); expect(chip.getAttribute('aria-label')).toBe('Cost, weight 2 of 3');
  expect(order(view.container)).toEqual(['budget', 'premium']);
  act(() => view.store.undo()); expect(chip.getAttribute('aria-label')).toBe('Cost, weight 1 of 3'); expect(order(view.container)).toEqual(['premium', 'budget']);
  act(() => view.store.set('plans.weights.cost.monthly', 3));
  expect(chip.getAttribute('aria-label')).toBe('Cost, weight 3 of 3');
  fireEvent.click(within(view.container.querySelector('[data-option="budget"]') as HTMLElement).getByRole('button', { name: 'Choose' }));
  expect(view.actions.at(-1)?.payload).toEqual({ option: 'budget', weights: { 'cost.monthly': 3, quality: 2 } });
});

test('streamed criteria do not persist defaults ahead of explicit weights', () => {
  const store = createStore();
  const prefix = '```ui:pick\n{"id":"plans","criteria":[{"id":"price","label":"Price"},{"id":"quality","label":"Quality"}]';
  const view = render(<Prism source={prefix} done={false} store={store} animate={false} />);
  expect(view.getByRole('button', { name: 'Price, weight 1 of 3' })).toBeDefined();
  expect(store.get('plans.weights')).toBeUndefined();
  view.rerender(<Prism source={prefix + ',"weights":{"price":3,"quality":0}'} done={false} store={store} animate={false} />);
  expect(view.getByRole('button', { name: 'Price, weight 3 of 3' })).toBeDefined();
  expect(view.getByRole('button', { name: 'Quality, weight 0 of 3' }).getAttribute('aria-pressed')).toBe('false');
  expect(store.get('plans.weights')).toBeUndefined();
  view.rerender(<Prism source={prefix + ',"weights":{"price":3,"quality":0}}\n```'} done={true} store={store} animate={false} />);
  expect(store.get('plans.weights')).toEqual({ price: 3, quality: 0 });
  fireEvent.click(view.getByRole('button', { name: 'Price, weight 3 of 3' }));
  expect(store.get('plans.weights.price')).toBe(0);
  act(() => store.undo());
  expect(view.getByRole('button', { name: 'Price, weight 3 of 3' })).toBeDefined();
});
const criteria = [{ id: 'price', label: 'Price' }, { id: 'quality', label: 'Quality' }];
const options = [{ id: 'budget', title: 'Budget', subtitle: 'Save more', scores: { price: 1, quality: 0 }, pros: ['Low cost'], cons: ['Basic features'], tag: 'Value' }, { id: 'premium', title: 'Premium', scores: { price: 0, quality: 0.9 } }];
function source(props: object = {}) { return '```ui:pick\n' + JSON.stringify({ id: 'plans', question: 'Which plan?', criteria, options, ...props }) + '\n```'; }
function setup(props: object = {}) {
  const store = createStore(), actions: Action[] = [];
  return { store, actions, ...render(<Prism source={source(props)} animate={false} store={store} locale="en-US" onAction={a => actions.push(a)} />) };
}
const order = (container: HTMLElement) => Array.from(container.querySelectorAll('[data-option]')).map(element => element.getAttribute('data-option'));

test('static cards rank in order, explain the top pick and expose docs', () => {
  const view = setup();
  expect(order(view.container)).toEqual(['budget', 'premium']);
  expect(view.getByText("Best for you because it's strong on Price and Quality")).toBeDefined();
  expect(view.getByText('#1')).toBeDefined(); expect(view.getByText('#2')).toBeDefined();
  expect(view.getByText('50% match')).toBeDefined(); expect(view.getByText('45% match')).toBeDefined();
  expect(view.getByText('Top pick')).toBeDefined();
  expect(view.container.querySelector('[data-part="value"]')?.textContent).toBe('100%');
  expect(view.container.querySelectorAll('[data-part="pip"][data-state="on"]').length).toBe(2);
  expect(view.getByText('✓ Low cost')).toBeDefined(); expect(view.getByText('– Basic features')).toBeDefined(); expect(view.getByText('Value')).toBeDefined();
  expect(view.container.querySelector('[data-part="live"]')?.textContent).toBe('Top pick: Budget');
  expect(view.getByRole('group', { name: 'Which plan?' })).toBeDefined();
  const docs = createRegistry([pick]).docs(); expect(docs).toContain('```ui:pick'); expect(docs).toContain('"scores"');
});

test('weight clicks cycle 1→2→3→0→1, change DOM rank order and undo restores weights', () => {
  const view = setup(), chip = view.getByRole('button', { name: 'Price, weight 1 of 3' });
  fireEvent.click(chip); expect(chip.getAttribute('aria-label')).toBe('Price, weight 2 of 3');
  expect(order(view.container)).toEqual(['budget', 'premium']);
  fireEvent.click(chip); expect(chip.getAttribute('aria-label')).toBe('Price, weight 3 of 3');
  fireEvent.click(chip); expect(chip.getAttribute('aria-pressed')).toBe('false'); expect(view.store.get('plans.weights')).toEqual({ price: 0, quality: 1 });
  expect(order(view.container)).toEqual(['premium', 'budget']);
  expect(view.container.querySelector('[data-part="live"]')?.textContent).toBe('Top pick: Premium');
  act(() => view.store.undo()); expect(view.store.get('plans.weights.price')).toBe(3); expect(order(view.container)).toEqual(['budget', 'premium']);
  fireEvent.click(chip); fireEvent.click(chip); expect(view.store.get('plans.weights.price')).toBe(1);
});

test('chip keyboard cycles and adjusts weights with roving focus and wraparound', () => {
  const view = setup(), price = view.getByRole('button', { name: 'Price, weight 1 of 3' }), quality = view.getByRole('button', { name: 'Quality, weight 1 of 3' });
  expect(price.tabIndex).toBe(0); expect(quality.tabIndex).toBe(-1);
  act(() => price.focus()); fireEvent.keyDown(price, { key: 'Enter' }); expect(view.store.get('plans.weights.price')).toBe(2);
  fireEvent.keyDown(price, { key: 'ArrowUp' }); expect(view.store.get('plans.weights.price')).toBe(3);
  fireEvent.keyDown(price, { key: 'ArrowDown' }); expect(view.store.get('plans.weights.price')).toBe(2);
  fireEvent.keyDown(price, { key: 'ArrowRight' }); expect(document.activeElement).toBe(quality); expect(quality.tabIndex).toBe(0); expect(price.tabIndex).toBe(-1);
  fireEvent.keyDown(quality, { key: ' ' }); expect(view.store.get('plans.weights.quality')).toBe(2);
  fireEvent.keyDown(quality, { key: 'ArrowRight' }); expect(document.activeElement).toBe(price);
  fireEvent.keyDown(price, { key: 'ArrowLeft' }); expect(document.activeElement).toBe(quality);
});

test('Choose emits exact option and current weights and marks chosen card', () => {
  const view = setup({ weights: { price: 2, quality: 3 } });
  const card = view.container.querySelector('[data-option="premium"]')!;
  fireEvent.click(within(card as HTMLElement).getByRole('button', { name: 'Choose' }));
  expect(view.actions.map(({ type, payload }) => ({ type, payload }))).toEqual([{ type: 'choose', payload: { option: 'premium', weights: { price: 2, quality: 3 } } }]);
  expect(view.store.get('plans.chosen')).toBe('premium'); expect(card.getAttribute('data-state')).toBe('chosen'); expect(view.getByText('✓ Chosen')).toBeDefined();
});

test('streaming option without scores renders a skeleton then becomes ranked', () => {
  const prefix = '```ui:pick\n{"id":"plans","criteria":[{"id":"price","label":"Price"}],"options":[{"id":"budget","title":"Budget"';
  const store = createStore(), view = render(<Prism source={prefix} done={false} store={store} animate={false} />);
  expect(view.container.querySelector('[data-option="budget"]')?.getAttribute('data-state')).toBe('loading');
  expect(view.getByRole('button', { name: 'Choose' }).hasAttribute('disabled')).toBe(true);
  view.rerender(<Prism source={prefix + ',"scores":{"price":0.9}}]}\n```'} done={false} store={store} animate={false} />);
  expect(view.container.querySelector('[data-option="budget"]')?.getAttribute('data-state')).toBe('top');
  expect(view.getByRole('button', { name: 'Choose' }).hasAttribute('disabled')).toBe(false);
});

test('empty, invalid scores and all-zero ties are safe and external weights re-rank', () => {
  const view = setup({ weights: { price: 0, quality: 0 } });
  expect(order(view.container)).toEqual(['budget', 'premium']); expect(view.getAllByText('0% match').length).toBe(2);
  act(() => view.store.set('plans.weights.quality', 3)); expect(order(view.container)).toEqual(['premium', 'budget']);
  view.rerender(<Prism source={source({ options: [{ id: 'bad', title: 'Bad', scores: 'invalid' }] })} animate={false} />);
  expect(view.container.querySelector('[data-option="bad"]')?.getAttribute('data-state')).toBe('loading');
  view.rerender(<Prism source={source({ options: [], criteria: [] })} animate={false} />);
  expect(view.getByText('Options will appear here')).toBeDefined();
});
