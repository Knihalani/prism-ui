import './setup';
import { afterEach, expect, test } from 'bun:test';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { StrictMode } from 'react';
import { createStore, memoryAdapter, type Adapter } from '@prism-ui/state';
import { Prism, createRegistry, useComponentState, type PrismComponentProps } from '../src';
import { migrateComponentState } from '../src/identity';
import { estimate } from '../../components/src/estimate';
import { pick } from '../../components/src/pick';

afterEach(cleanup);

function OwnedCounter({ props, id }: PrismComponentProps) {
  const [count, set] = useComponentState('count', Number(props.initial));
  return <button aria-label={id} onClick={() => set(value => value + 1)}>{count}</button>;
}

test('separate Prism messages cannot move or delete each other provisional state', () => {
  const store = createStore(), registry = createRegistry([{ name: 'counter', component: OwnedCounter }]);
  const a = '```ui:counter\n{"initial":1,"id":"alpha', b = '```ui:counter\n{"initial":2,"id":"beta';
  const view = render(<><Prism store={store} registry={registry} source={a} done={false}/><Prism store={store} registry={registry} source={b} done={false}/></>);
  const buttons = view.getAllByRole('button');
  expect(buttons.map(button => button.textContent)).toEqual(['1', '2']);
  fireEvent.click(buttons[1]);
  view.rerender(<><Prism store={store} registry={registry} source={a} done={false}/><Prism store={store} registry={registry} source={b + '"}\n```'}/></>);
  expect(view.getAllByRole('button').map(button => button.textContent)).toEqual(['1', '3']);
  view.rerender(<><Prism store={store} registry={registry} source={a + '"}\n```'}/><Prism store={store} registry={registry} source={b + '"}\n```'}/></>);
  expect(store.snapshot()).toEqual({ alpha: { count: 1 }, beta: { count: 3 } });
});

test('anonymous components in separate messages have independent identities', () => {
  const store = createStore(), registry = createRegistry([{ name: 'counter', component: OwnedCounter }]);
  const view = render(<><Prism store={store} registry={registry} source={'```ui:counter\n{"initial":1}\n```'}/><Prism store={store} registry={registry} source={'```ui:counter\n{"initial":2}\n```'}/></>);
  expect(view.getAllByRole('button').map(button => button.textContent)).toEqual(['1', '2']);
  expect(new Set(view.getAllByRole('button').map(button => button.getAttribute('aria-label'))).size).toBe(2);
});

test('replacing a completed estimate never writes new totals under the previous id', () => {
  const store = createStore(), registry = createRegistry([estimate]);
  const source = (id: string, price: number) => '```ui:estimate\n' + JSON.stringify({ id, items: [{ id: 'seat', price, qty: 1 }] }) + '\n```';
  const view = render(<Prism store={store} registry={registry} source={source('first', 20)}/>);
  view.rerender(<Prism store={store} registry={registry} source={source('second', 90)}/>);
  expect(store.get('first.total')).toBe(20);
  expect(store.get('second.total')).toBe(90);
});

test('character-by-character estimate/pick streams persist only provisional keys or final ids', async () => {
  const registry = createRegistry([estimate, pick]), saved: object[] = [], memory = memoryAdapter();
  const adapter: Adapter = { load: memory.load, save(ns, data) { saved.push(data); memory.save(ns, data); } };
  const store = createStore({ persist: adapter, namespace: 'identity' });
  let frame: FrameRequestCallback | undefined;
  const raf = globalThis.requestAnimationFrame, cancel = globalThis.cancelAnimationFrame;
  globalThis.requestAnimationFrame = callback => { frame = callback; return 1; };
  globalThis.cancelAnimationFrame = () => { frame = undefined; };
  try {
    let controller!: ReadableStreamDefaultController<string>;
    const stream = new ReadableStream<string>({ start(value) { controller = value; } });
    render(<StrictMode><Prism scope="test" registry={registry} store={store} stream={stream} animate={false}/></StrictMode>);
    const source = '```ui:estimate\n' + JSON.stringify({ id: 'estimate-final', items: [{ id: 'seat', label: 'Seat', price: 10, qty: 2 }] }) + '\n```\n\n```ui:pick\n' + JSON.stringify({ id: 'pick-final', criteria: [{ id: 'cost', label: 'Cost' }], weights: { cost: 2 }, options: [{ id: 'pilot', title: 'Pilot', scores: { cost: 1 } }] }) + '\n```';
    for (const char of source) {
      await act(async () => { controller.enqueue(char); await Promise.resolve(); const publish = frame; frame = undefined; publish?.(0); });
      expect(Object.keys(store.snapshot()).every(key => ['test:0', 'test:1', 'estimate-final', 'pick-final'].includes(key))).toBe(true);
    }
    await act(async () => { controller.close(); });
    expect(Object.keys(store.snapshot()).sort()).toEqual(['estimate-final', 'pick-final']);
    expect(store.get('estimate-final.total')).toBe(20);
    expect(store.get('pick-final.weights.cost')).toBe(2);
    for (const snapshot of saved) expect(Object.keys(snapshot).every(key => ['test:0', 'test:1', 'estimate-final', 'pick-final'].includes(key))).toBe(true);
    expect(memory.load('identity')).toEqual(store.snapshot());
  } finally { globalThis.requestAnimationFrame = raf; globalThis.cancelAnimationFrame = cancel; }
});

test('finalization preserves provisional edits and migrates once without history or intermediate saves', () => {
  const saved: object[] = [], store = createStore({ persist: { load: () => ({}), save: (_, data) => saved.push(data) } });
  store.set('test:0', { count: 4 }, { history: false });
  function Counter({ id, props }: PrismComponentProps) {
    const [count, set] = useComponentState('count', 0);
    expect(props.id).toBe(id);
    return <button aria-label={id} onClick={() => set(value => value + 1)}>{count}</button>;
  }
  const registry = createRegistry([{ name: 'counter', component: Counter }]);
  const view = render(<StrictMode><Prism scope="test" registry={registry} store={store} source={'```ui:counter\n{"id":"fi'} done={false}/></StrictMode>);
  expect(view.getByRole('button', { name: 'test:0' }).textContent).toBe('4');
  const before = saved.length;
  view.rerender(<StrictMode><Prism scope="test" registry={registry} store={store} source={'```ui:counter\n{"id":"final"}\n```'}/></StrictMode>);
  expect(store.snapshot()).toEqual({ final: { count: 4 } });
  expect(saved.slice(before)).toEqual([{ final: { count: 4 } }]);
  expect(store.canUndo).toBe(false);
  fireEvent.click(view.getByRole('button', { name: 'final' }));
  expect(store.get('final.count')).toBe(5);
});

test('migration fills missing fields but preserves hydrated final state and removes empty key ancestors', () => {
  const store = createStore({ initial: { '0': { '1': { count: 1, nested: { fresh: true, saved: false } } }, final: { count: 9, nested: { saved: true } } } });
  const seen: object[] = []; store.subscribe('*', () => seen.push(store.snapshot()));
  migrateComponentState(store, '0.1', 'final');
  expect(store.snapshot()).toEqual({ final: { count: 9, nested: { fresh: true, saved: true } } });
  expect(seen).toEqual([store.snapshot()]); expect(store.canUndo).toBe(false);
  migrateComponentState(store, 'missing', 'final'); migrateComponentState(store, 'final', 'final');
  expect(seen).toHaveLength(1);
  migrateComponentState(store, 'final', '__proto__.polluted');
  expect(seen).toHaveLength(1); expect(store.get('final.count')).toBe(9);
});

test('components without an explicit id keep key state when complete', () => {
  function Counter() { const [count] = useComponentState('count', 3); return <span>{count}</span>; }
  const store = createStore(), registry = createRegistry([{ name: 'counter', component: Counter }]);
  const view = render(<Prism scope="test" store={store} registry={registry} source={'```ui:counter\n{}'} done={false}/>);
  view.rerender(<Prism scope="test" store={store} registry={registry} source={'```ui:counter\n{}\n```'}/>);
  expect(store.snapshot()).toEqual({ 'test:0': { count: 3 } });
});

test('inline and leaf attributes never persist a truncated id while their block is open', () => {
  function Counter() { const [count] = useComponentState('count', 3); return <span>{count}</span>; }
  const registry = createRegistry([{ name: 'counter', component: Counter }]);
  for (const source of [':counter[Count]{id="final-id"}', '::counter{id="final-id"}']) {
    const saved: object[] = [], store = createStore({ persist: { load: () => ({}), save: (_, data) => saved.push(data) } });
    const view = render(<Prism scope="test" store={store} registry={registry} source="" done={false}/>);
    for (let end = 1; end <= source.length; end++) view.rerender(<Prism scope="test" store={store} registry={registry} source={source.slice(0, end)} done={false}/>);
    view.rerender(<Prism scope="test" store={store} registry={registry} source={source}/>);
    expect(store.snapshot()).toEqual({ 'final-id': { count: 3 } });
    for (const snapshot of saved) expect(Object.keys(snapshot).every(key => key === 'test:0' || key === 'final-id')).toBe(true);
    view.unmount();
  }
});
