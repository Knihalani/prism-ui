import './setup';
import { afterEach, expect, spyOn, test } from 'bun:test';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { useEffect, useState as useLocalState } from 'react';
import { s } from '@prism-ui/schema';
import { createStore } from '@prism-ui/state';
import { Prism, createRegistry, defineRenderer, type Action, type RendererProps } from '../src';

afterEach(cleanup);
const fence = (name: string, data: unknown) => '```ui:' + name + '\n' + JSON.stringify(data) + '\n```';

test('one-line renderers share scoped store state, functional updates, patches, tokens and action dispatch', () => {
  const store = createStore(), actions: Action[] = [];
  function Input({ data, id, useState, emit, tokens }: RendererProps<{ label: string }>) {
    const [value, setValue] = useState(1);
    expect(tokens.motionInstant).toBe('var(--prism-motion-instant)');
    expect(tokens.motionEaseExit).toBe('var(--prism-motion-ease-exit)');
    expect(tokens.motionSpringBouncyDuration).toBe('var(--prism-motion-spring-bouncy-duration)');
    return <button style={{ color: tokens.accent }} onClick={() => { setValue(v => v + 1); emit({ type: 'select', payload: value + 1 }); }}>{data.label}:{id}:{value}</button>;
  }
  const view = render(<Prism store={store} renderers={{ input: Input }} source={fence('input', { id: 'one', label: 'First' }) + '\n\n' + fence('input', { id: 'two', label: 'Second' })} onAction={action => actions.push(action)} />);
  fireEvent.click(view.getByText('First:one:1'));
  expect(view.getByText('First:one:2')).toBeDefined();
  expect(view.getByText('Second:two:1')).toBeDefined();
  expect(store.get('one.state')).toBe(2);
  act(() => { store.apply({ set: { 'one.state': 8 } }); });
  expect(view.getByText('First:one:8')).toBeDefined();
  expect(actions).toHaveLength(1);
  expect(actions[0]).toMatchObject({ component: 'input', id: 'one', type: 'select', payload: 2 });
  expect(view.getByText('First:one:8').style.color).toBe('var(--prism-accent)');
});

test('partial JSON streams through one mounted renderer and local state survives finalization', () => {
  let mounts = 0;
  function Live({ data, complete }: RendererProps<{ values: number[] }>) {
    const [local, setLocal] = useLocalState(0);
    useEffect(() => { mounts++; }, []);
    return <button onClick={() => setLocal(local + 1)}>{(data.values ?? []).join(',')}:{String(complete)}:{local}</button>;
  }
  const start = '```ui:live\n{"id":"stream","values":[';
  const view = render(<Prism renderers={{ live: Live }} source={start} done={false} />);
  fireEvent.click(view.getByRole('button'));
  view.rerender(<Prism renderers={{ live: Live }} source={start + '1,2'} done={false} />);
  expect(view.getByRole('button').textContent).toBe('1,2:false:1');
  view.rerender(<Prism renderers={{ live: Live }} source={start + '1,2]}\n```'} />);
  expect(view.getByRole('button').textContent).toBe('1,2:true:1');
  expect(mounts).toBe(1);
});

test('definitions expose schema coercion and prompt docs in an explicit or default registry', () => {
  function Typed({ data }: RendererProps<{ count: number }>) { return <output>{data.count ?? 'empty'}</output>; }
  const def = defineRenderer('typed-test', Typed, { schema: s.object({ count: s.number().default(3) }), prompt: 'A typed custom counter.', feedback: false });
  const registry = createRegistry([def]);
  expect(registry.docs()).toContain('A typed custom counter.');
  expect(registry.docs()).toContain('count');
  const view = render(<Prism registry={registry} source={fence('typed-test', {})} />);
  expect(view.getByRole('status').textContent).toBe('3');
  view.rerender(<Prism renderers={{ custom: def }} source={fence('custom', { count: '7' })} />);
  expect(view.getByRole('status').textContent).toBe('7');
  expect(() => defineRenderer('../bad', Typed)).toThrow('Invalid renderer name');
});

test('empty custom data is usable and renderer failures cannot take down adjacent prose or renders', () => {
  function Empty({ data }: RendererProps) { return <span>{Object.keys(data).length ? 'has data' : 'empty data'}</span>; }
  function Broken(): never { throw Error('bad view'); }
  const errors = spyOn(console, 'error').mockImplementation(() => {});
  try {
    const view = render(<Prism renderers={{ broken: Broken, empty: Empty }} source={'Before\n\n' + fence('broken', {}) + '\n\n' + fence('empty', {}) + '\n\nAfter'} />);
    expect(view.getByRole('alert').textContent).toContain('couldn’t be displayed');
    expect(view.getByText('Before')).toBeDefined(); expect(view.getByText('After')).toBeDefined();
    expect(view.getByText('empty data')).toBeDefined();
  } finally { errors.mockRestore(); }
});

test.each(['name', 'id', 'store'] as const)('a failed renderer recovers when its directive %s changes', kind => {
  function Recover({ data }: RendererProps<{ fail: boolean }>) {
    if (data.fail) throw Error('bad initial data');
    return <output>Recovered content</output>;
  }
  const renderers = { recover: Recover, replacement: Recover }, store = createStore();
  const errors = spyOn(console, 'error').mockImplementation(() => {});
  try {
    const view = render(<Prism store={store} renderers={renderers} source={fence('recover', { id: 'before', fail: true })} />);
    expect(view.getByRole('alert')).toBeDefined();
    view.rerender(<Prism store={kind === 'store' ? createStore() : store} renderers={renderers} source={fence(kind === 'name' ? 'replacement' : 'recover', { id: kind === 'id' ? 'after' : 'before', fail: false })} />);
    expect(view.queryByRole('alert')).toBeNull();
    expect(view.getByRole('status').textContent).toBe('Recovered content');
  } finally { errors.mockRestore(); }
});
