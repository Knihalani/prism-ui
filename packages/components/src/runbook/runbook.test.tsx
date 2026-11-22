import '../../../react/test/setup';
import { afterEach, expect, test } from 'bun:test';
import { Prism, createRegistry, useComponentState } from '@prism-ui/react';
import { createStore } from '@prism-ui/state';
import { runbookDefinition, stepDefinition } from './runbook';

const { act, cleanup, fireEvent, render } = await import('@testing-library/react');
afterEach(cleanup);
const registry = createRegistry([runbookDefinition, stepDefinition]);
const source = '::::runbook\n:::step{title="Configure"}\nInstructions.\n:::\n::::\n';

test('presentational skeleton leaves restored progress untouched', async () => {
  const previous = createStore(), first = render(<Prism source={source} scope="restore" registry={registry} store={previous} />);
  fireEvent.click(first.getByRole('checkbox'));
  const snapshot = previous.snapshot(); first.unmount();
  let hydrate!: (value: object) => void;
  const store = createStore({ persist: { load: () => new Promise<object>(resolve => { hydrate = resolve; }), save() {} } });
  const view = render(<Prism source={source} scope="restore" registry={registry} store={store} />);
  expect(view.container.querySelector('[data-prism-skeleton]')?.getAttribute('aria-hidden')).toBe('true');
  expect(view.queryByRole('checkbox')).toBeNull(); expect(store.snapshot()).toEqual({});
  await act(async () => { hydrate(snapshot); await store.ready; });
  expect(store.snapshot()).toEqual(snapshot);
  expect(view.getByRole('checkbox').getAttribute('aria-checked')).toBe('true');
});

test('failed hydration and empty streams do not initialize state before readiness', async () => {
  let reject!: (error: Error) => void;
  const store = createStore({ persist: { load: () => new Promise<object>((_, fail) => { reject = fail; }), save() {} } });
  const view = render(<Prism source={source} registry={registry} store={store} />);
  expect(store.snapshot()).toEqual({});
  await act(async () => { reject(new Error('Unavailable')); await store.ready; });
  expect(view.getByRole('checkbox')).toBeDefined();
  view.rerender(<Prism source={'::::runbook\n'} done={false} registry={registry} store={store} />);
  expect(view.queryByRole('button')).toBeNull();
});

test('nested children mount only on the normal scoped path and retain edits', () => {
  function Probe() {
    const [value, setValue] = useComponentState('value', 'Initial');
    return <input aria-label="Nested value" value={value} onChange={event => setValue(event.target.value)} onKeyUp={event => setValue(event.currentTarget.value)} />;
  }
  const store = createStore(), nested = createRegistry([runbookDefinition, stepDefinition, { name: 'probe', component: Probe }]);
  const partial = '::::runbook\n:::step{title="Configure"}\n```ui:probe\n{}\n```\n:::\n';
  const view = render(<Prism source={partial} scope="nested" done={false} registry={nested} store={store} />);
  expect(view.queryByRole('textbox')).toBeNull(); expect(store.snapshot()).toEqual({});
  view.rerender(<Prism source={partial + '::::\n'} scope="nested" registry={nested} store={store} />);
  const input = view.getByRole('textbox');
  fireEvent.focus(input); fireEvent.change(input, { target: { value: 'Edited' } }); fireEvent.keyUp(input);
  view.rerender(<Prism source={partial + '::::\n\nFollowing prose.'} scope="nested" registry={nested} store={store} />);
  expect((view.getByRole('textbox') as HTMLInputElement).value).toBe('Edited');
  expect(Object.keys(store.snapshot()).every(key => key.startsWith('nested:'))).toBe(true);
});
