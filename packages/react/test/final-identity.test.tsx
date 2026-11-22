import './setup';
import { afterEach, expect, test } from 'bun:test';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { useContext, useEffect, useState } from 'react';
import { createStore } from '@prism-ui/state';
import { mockupPlugin } from '../../components/src/mockup/plugin';
import { ComponentContext, Prism, createRegistry, usePrism } from '../src';

afterEach(cleanup);

function Editor() {
  const component = useContext(ComponentContext)!, { store } = usePrism();
  const [value, setValue] = useState(() => String(store.get(`${component.id}.value`) ?? ''));
  useEffect(() => { store.set(`${component.id}.value`, value, { history: false }); }, [store, component.id, value]);
  return <input aria-label="Editor" value={value} onChange={event => setValue(event.target.value)} />;
}
const registry = createRegistry([{ name: 'editor', component: Editor, requiresFinalId: true }]);
function edit(input: HTMLElement, value: string) {
  act(() => input.focus());
  fireEvent.change(input, { target: { value } });
  fireEvent.keyUp(input, { key: 'Unidentified' });
}

test('private models wait for a late id to close, then remain mounted throughout the body stream', () => {
  const store = createStore({ initial: { review: { value: 'saved' } } });
  const start = '```ui:editor\n{"content":"ready","nested":{"id":"nested"},"id":"rev';
  const view = render(<Prism registry={registry} store={store} source={start} done={false} />);
  expect(view.queryByRole('textbox')).toBeNull();
  expect(store.snapshot()).toEqual({ review: { value: 'saved' } });
  const known = start + 'iew","rest":[';
  view.rerender(<Prism registry={registry} store={store} source={known} done={false} />);
  const input = view.getByRole('textbox') as HTMLInputElement;
  expect(input.value).toBe('saved');
  edit(input, 'stream edit');
  view.rerender(<Prism registry={registry} store={store} source={known + ']}\n```'} />);
  expect(view.getByRole('textbox') === input).toBe(true);
  expect(input.value).toBe('stream edit');
  expect(store.snapshot()).toEqual({ review: { value: 'stream edit' } });
});

test('an anonymous private model can mount once its JSON object closes without waiting for the fence', () => {
  const store = createStore(), source = '```ui:editor\n{"content":"ready"}';
  const view = render(<Prism registry={registry} store={store} source={source} done={false} />);
  const input = view.getByRole('textbox') as HTMLInputElement;
  edit(input, 'anonymous edit');
  view.rerender(<Prism registry={registry} store={store} source={source + '\n```'} />);
  expect(view.getByRole('textbox') === input).toBe(true);
  expect(input.value).toBe('anonymous edit');
});

test('private models wait for hydration and provisional migration before reading their initial draft', async () => {
  let resolve!: (data: object) => void;
  const store = createStore({ persist: { load: () => new Promise<object>(done => { resolve = done; }), save() {} } });
  const view = render(<Prism scope="restore" registry={registry} store={store} source={'```ui:editor\n{"id":"review"}'} done={false} />);
  expect(view.queryByRole('textbox')).toBeNull();
  await act(async () => { resolve({ 'restore:editor:0': { value: 'legacy', extra: true }, review: { value: 'saved' } }); await store.ready; });
  expect((view.getByRole('textbox') as HTMLInputElement).value).toBe('saved');
  expect(store.snapshot()).toEqual({ review: { value: 'saved', extra: true } });
});

test('unsafe final ids fall back to a visible, stable scoped model', () => {
  const store = createStore();
  const view = render(<Prism registry={registry} store={store} source={'```ui:editor\n{"id":"__proto__.bad"}'} done={false} />);
  edit(view.getByRole('textbox'), 'safe edit');
  expect(Object.keys(store.snapshot())).toHaveLength(1);
  expect(store.get('__proto__.bad')).toBeUndefined();
  expect(Object.values(store.snapshot())).toEqual([{ value: 'safe edit' }]);
});

test('an unfinished custom fence header cannot initialize a model under a truncated id', () => {
  const store = createStore(), registry = createRegistry([{ name: 'mockup', component: Editor, requiresFinalId: true }]);
  const plugins = [mockupPlugin, { name: 'inline', inline: [{ trigger: '!', parse: () => null }] }];
  const start = '```mockup:html {id="rev';
  const view = render(<Prism registry={registry} store={store} plugins={plugins} source={start} done={false} />);
  expect(view.queryByRole('textbox')).toBeNull();
  expect(store.snapshot()).toEqual({});
  view.rerender(<Prism registry={registry} store={store} plugins={plugins} source={start + 'iew"}\n<h1>Body'} done={false} />);
  expect(view.getByRole('textbox')).toBeDefined();
  expect(store.snapshot()).toEqual({ review: { value: '' } });
});
