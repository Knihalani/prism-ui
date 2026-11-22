import '../../react/test/setup';
import { afterEach, expect, test } from 'bun:test';
import { ComponentContext, Prism, createRegistry, useEmit, type Action } from '@prism-ui/react';
import { createStore } from '@prism-ui/state';
import { useContext } from 'react';
import { troubleshootDefinition } from '../src/troubleshoot';

const { act, cleanup, fireEvent, render } = await import('@testing-library/react');

afterEach(cleanup);
const registry = createRegistry([troubleshootDefinition]);
const props = { id: 'wifi', title: 'Wi-Fi drops', start: 'a', steps: { a: { title: 'Restart', text: 'Restart the adapter.', command: '$ nmcli radio wifi on', no: 'b' }, b: { text: 'Restart the router.', yes: '$fixed', no: '$escalate', hint: 'Wait for the lights.' } } };
const fence = (value: unknown) => '```ui:troubleshoot\n' + JSON.stringify(value) + '\n```\n';

test('static render has a step card, command, position, question and keyboard-accessible buttons', () => {
  const view = render(<Prism source={fence(props)} registry={registry} />);
  expect(view.getByText('Step 1')).toBeDefined(); expect(view.getByText('Restart the adapter.')).toBeDefined();
  expect(view.getByText('Step 1').parentElement).toBe(view.getByText('Restart'));
  expect(view.getByRole('button', { name: 'Copy' }).parentElement?.dataset.part).toBe('command');
  expect(view.getByText('$ nmcli radio wifi on').tagName).toBe('CODE');
  expect(view.getByText('Did this fix it?')).toBeDefined();
  expect((view.getByRole('button', { name: 'Yes' }) as HTMLButtonElement).disabled).toBe(false);
});

test('resolved report emits exact action and persists sent state; restart and undo work', () => {
  const actions: Action[] = [], store = createStore();
  const view = render(<Prism source={fence(props)} registry={registry} store={store} onAction={action => actions.push(action)} />);
  fireEvent.click(view.getByRole('button', { name: 'No' }));
  fireEvent.click(view.getByRole('button', { name: 'Yes' }));
  expect(view.getByText('Fixed after 2 steps')).toBeDefined();
  fireEvent.click(view.getByRole('button', { name: 'Send report' }));
  expect(actions).toEqual([{ type: 'troubleshoot', component: 'troubleshoot', id: 'wifi', payload: { resolved: true, path: [{ step: 'a', answer: 'no' }, { step: 'b', answer: 'yes' }] }, context: { component: 'troubleshoot', props, state: { path: [{ step: 'a', answer: 'no' }, { step: 'b', answer: 'yes' }], sent: false } }, message: 'Troubleshooting "Wi-Fi drops": fixed at step 2 (No → Yes).' }]);
  expect(view.getByRole('group').dataset.state).toBe('sent'); expect(store.get('wifi.sent')).toBe(true);
  fireEvent.click(view.getByRole('button', { name: 'Start over' })); expect(view.getByText('Step 1')).toBeDefined();
  fireEvent.keyDown(view.getByRole('group'), { key: 'z', ctrlKey: true });
  expect(view.getByRole('button', { name: 'Report sent' })).toBeDefined();
});

test('sending a report is one undo step without rewriting a valid path', () => {
  const store = createStore();
  const view = render(<Prism source={fence(props)} registry={registry} store={store} />);
  fireEvent.click(view.getByRole('button', { name: 'Yes' }));
  const path = store.get('wifi.path');
  fireEvent.click(view.getByRole('button', { name: 'Send report' }));
  expect(store.get('wifi.path')).toBe(path);
  expect(store.get('wifi.sent')).toBe(true);
  fireEvent.click(view.getByRole('button', { name: 'Undo' }));
  expect(store.get('wifi.sent')).toBe(false);
  expect(store.get('wifi.path')).toEqual([{ step: 'a', answer: 'yes' }]);
  expect(view.queryByRole('button', { name: 'Report sent' })).toBeNull();
  fireEvent.click(view.getByRole('button', { name: 'Undo' }));
  expect(store.get('wifi.path')).toEqual([]);
  expect(view.getByText('Step 1')).toBeDefined();
});

test('report path normalization and sent state are undone together', () => {
  const path = [{ step: 'a', answer: 'no' }, { step: 'b', answer: 'yes' }];
  const store = createStore({ initial: { wifi: { path, sent: false } } });
  const updated = { ...props, steps: { ...props.steps, a: { ...props.steps.a, no: '$fixed' } } };
  const view = render(<Prism source={fence(updated)} registry={registry} store={store} />);
  fireEvent.click(view.getByRole('button', { name: 'Send report' }));
  expect(store.get('wifi')).toEqual({ path: [{ step: 'a', answer: 'no' }], sent: true });
  fireEvent.click(view.getByRole('button', { name: 'Undo' }));
  expect(store.get('wifi')).toEqual({ path, sent: false });
  expect(store.canUndo()).toBe(false);
});

test('changed branch targets truncate stale answers before advancing and reporting', () => {
  const actions: Action[] = [], store = createStore();
  const initial = { ...props, steps: { ...props.steps, b: { ...props.steps.b, no: 'c' }, c: { text: 'Old branch.' }, d: { text: 'New branch.', no: 'e' }, e: { text: 'Final check.' } } };
  const view = render(<Prism source={fence(initial)} registry={registry} store={store} onAction={action => actions.push(action)} />);
  fireEvent.click(view.getByRole('button', { name: 'No' }));
  fireEvent.click(view.getByRole('button', { name: 'No' }));
  expect(view.getByText('Old branch.')).toBeDefined();
  const updated = { ...initial, steps: { ...initial.steps, a: { ...initial.steps.a, no: 'd' } } };
  view.rerender(<Prism source={fence(updated)} registry={registry} store={store} onAction={action => actions.push(action)} />);
  expect(view.getByText('New branch.')).toBeDefined();
  expect(view.getByText('Step 2')).toBeDefined();
  expect(view.queryByText('Restart the router.')).toBeNull();
  fireEvent.click(view.getByRole('button', { name: 'No' }));
  expect(view.getByText('Final check.')).toBeDefined();
  fireEvent.click(view.getByRole('button', { name: 'Yes' }));
  fireEvent.click(view.getByRole('button', { name: 'Send report' }));
  const path = [{ step: 'a', answer: 'no' }, { step: 'd', answer: 'no' }, { step: 'e', answer: 'yes' }];
  expect(store.get('wifi.path')).toEqual(path);
  expect(actions).toEqual([{ type: 'troubleshoot', component: 'troubleshoot', id: 'wifi', payload: { resolved: true, path }, context: { component: 'troubleshoot', props: updated, state: { path, sent: false } }, message: 'Troubleshooting "Wi-Fi drops": fixed at step 3 (No → No → Yes).' }]);
});

test('backtracking and reporting use only the replayed prefix after a target changes', () => {
  const store = createStore({ initial: { wifi: { path: [{ step: 'a', answer: 'no' }, { step: 'b', answer: 'no' }] } } });
  const updated = { ...props, steps: { ...props.steps, a: { ...props.steps.a, no: 'c' }, c: { text: 'New branch.' } } };
  const view = render(<Prism source={fence(updated)} registry={registry} store={store} />);
  fireEvent.keyDown(view.getByRole('button', { name: 'Yes' }), { key: 'Backspace' });
  expect(store.get('wifi.path')).toEqual([]);
  expect(view.getByText('Step 1')).toBeDefined();
  act(() => store.set('wifi.path', [{ step: 'a', answer: 'no' }, { step: 'b', answer: 'no' }]));
  const terminal = { ...updated, steps: { ...updated.steps, a: { ...updated.steps.a, no: '$fixed' } } };
  const actions: Action[] = [];
  view.rerender(<Prism source={fence(terminal)} registry={registry} store={store} onAction={action => actions.push(action)} />);
  expect(view.getByText('Fixed after 1 step')).toBeDefined();
  fireEvent.click(view.getByRole('button', { name: 'Send report' }));
  expect(store.get('wifi.path')).toEqual([{ step: 'a', answer: 'no' }]);
  expect(actions[0].payload).toEqual({ resolved: true, path: [{ step: 'a', answer: 'no' }] });
});

test.each([
  { locale: 'en-US', count: 1, label: 'One {count}', expected: 'One 1' },
  { locale: 'en-US', count: 2, label: 'Other {count}', expected: 'Other 2' },
  { locale: 'fr-FR', count: 0, label: 'One {count}', expected: 'One 0' },
  { locale: 'en-US', count: 0, label: 'Other {count}', expected: 'Other 0' },
])('resolved labels use locale plural rules: $locale / $count', ({ locale, count, expected }) => {
  const path = count === 0 ? [] : count === 1 ? [{ step: 'a', answer: 'yes' }] : [{ step: 'a', answer: 'no' }, { step: 'b', answer: 'yes' }];
  const store = createStore({ initial: { wifi: { path } } });
  const view = render(<Prism source={fence({ ...props, start: count ? 'a' : '$fixed', labels: { fixedOne: 'One {count}', fixedOther: 'Other {count}' } })} locale={locale} store={store} registry={registry} />);
  expect(view.getByText(expected)).toBeDefined();
  view.rerender(<Prism source={fence({ ...props, start: count ? 'a' : '$fixed', labels: { fixed: 'Legacy {count}' } })} locale={locale} store={store} registry={registry} />);
  expect(view.getByText(`Legacy ${count}`)).toBeDefined();
});

test('unknown and missing targets end unresolved; yes defaults to fixed', () => {
  const actions: Action[] = [], input = { id: 'dead', start: 'a', steps: { a: { text: 'Try again.', no: 'unknown' } } };
  const view = render(<Prism source={fence(input)} registry={registry} onAction={action => actions.push(action)} />);
  fireEvent.click(view.getByRole('button', { name: 'No' }));
  expect(view.getByText('Not fixed yet')).toBeDefined(); fireEvent.click(view.getByRole('button', { name: 'Send report' }));
  expect(actions).toEqual([{ type: 'troubleshoot', component: 'troubleshoot', id: 'dead', payload: { resolved: false, path: [{ step: 'a', answer: 'no' }] }, context: { component: 'troubleshoot', props: input, state: { path: [{ step: 'a', answer: 'no' }], sent: false } }, message: 'Troubleshooting "Troubleshoot": not fixed after 1 steps (No).' }]);
  fireEvent.click(view.getByRole('button', { name: 'Start over' })); fireEvent.click(view.getByRole('button', { name: 'Yes' })); expect(view.getByText('Fixed after 1 step')).toBeDefined();
  view.rerender(<Prism source={fence({ start: 'a', steps: { a: { text: 'No target.' } } })} registry={registry} />);
  fireEvent.click(view.getByRole('button', { name: 'No' })); expect(view.getByText('Not fixed yet')).toBeDefined();
});

test('keyboard answers and backtracking, clickable history truncation and undo', () => {
  const view = render(<Prism source={fence(props)} registry={registry} />);
  fireEvent.keyDown(view.getByRole('button', { name: 'No' }), { key: 'n' }); expect(view.getByText('Step 2')).toBeDefined();
  fireEvent.keyDown(view.getByRole('button', { name: 'Yes' }), { key: 'ArrowLeft' }); expect(view.getByText('Step 1')).toBeDefined();
  fireEvent.keyDown(view.getByRole('button', { name: 'No' }), { key: 'N' });
  fireEvent.click(view.getByRole('button', { name: 'Restart the adapter.' })); expect(view.getByText('Step 1')).toBeDefined();
  fireEvent.keyDown(view.getByRole('group'), { key: 'z', ctrlKey: true }); expect(view.getByText('Step 2')).toBeDefined();
  fireEvent.keyDown(view.getByRole('button', { name: 'Yes' }), { key: 'Backspace' }); expect(view.getByText('Step 1')).toBeDefined();
  fireEvent.keyDown(view.getByRole('button', { name: 'Yes' }), { key: 'y' }); expect(view.getByText('Fixed after 1 step')).toBeDefined();
});

test.each([
  { yes: '$fixed', no: '$escalate' },
  { yes: undefined, no: '$escalate' },
  { yes: 'unknown', no: '$escalate' },
  { yes: '$fixed', no: undefined },
])('streaming remains presentational until finalization: $yes / $no', ({ yes, no }) => {
  const store = createStore();
  const source = fence({ id: 'stream', start: 'a', steps: { a: { text: 'Try this.', yes, no } } });
  const view = render(<Prism scope="test" source={source.slice(0, -5)} done={false} registry={registry} store={store} />);
  expect(view.container.querySelector('[data-prism-skeleton]')).not.toBeNull();
  expect(view.queryByRole('button', { name: 'Yes' })).toBeNull();
  expect(store.get('test:troubleshoot:0')).toBeUndefined();
  expect(store.get('stream')).toBeUndefined();
  view.rerender(<Prism scope="test" source={source} registry={registry} store={store} />);
  expect((view.getByRole('button', { name: 'Yes' }) as HTMLButtonElement).disabled).toBe(false);
});

test('restored progress survives a pending skeleton', () => {
  const store = createStore();
  const view = render(<Prism source={fence(props).slice(0, -5)} done={false} registry={registry} store={store} />);
  act(() => store.set('wifi.path', [{ step: 'a', answer: 'no' }]));
  view.rerender(<Prism source={fence(props)} registry={registry} store={store} />);
  expect(view.getByText('Step 2')).toBeDefined();
});

test.each(['', '   '])('blank title %j preserves instructions', title => {
  const view = render(<Prism source={fence({ start: 'a', steps: { a: { title, text: 'Follow the instructions.' } } })} registry={registry} />);
  expect(view.getByText('Follow the instructions.')).toBeDefined();
});

test('duplicate default questions are suppressed and explicit step questions take precedence', () => {
  const data = { start: 'a', steps: { a: { text: 'Try restarting. Did that fix it?  ' } } };
  const view = render(<Prism source={fence(data)} registry={registry} />);
  expect(view.queryByText('Did this fix it?')).toBeNull();
  expect(view.getByRole('button', { name: 'Yes' })).toBeDefined();
  view.rerender(<Prism source={fence({ ...data, steps: { a: { ...data.steps.a, question: 'Is the connection stable?' } } })} registry={registry} />);
  expect(view.getByText('Is the connection stable?')).toBeDefined();
});

test('untitled breadcrumbs use a first sentence or six words while retaining the full accessible name', () => {
  const full = 'First reconnect the adapter and then restart the device. Wait until it connects.';
  const view = render(<Prism source={fence({ start: 'a', steps: { a: { text: full, no: 'b' }, b: { text: 'Continue.' } } })} registry={registry} />);
  fireEvent.click(view.getByRole('button', { name: 'No' }));
  expect(view.getByRole('button', { name: full }).textContent).toBe('First reconnect the adapter and then…No');
});

test('unstyled mode, labels, slots, prompt docs and malformed steps', () => {
  const view = render(<Prism source={fence({ ...props, labels: { yes: 'Oui', step: 'Étape' } })} registry={registry} unstyled slots={{ troubleshoot: { step: input => <article {...input} data-custom="card" />, actions: input => <footer {...input} />, title: ({ children }) => <h2>{children}</h2> } }} />);
  expect(view.container.querySelector('[class*="prism-troubleshoot"]')).toBeNull();
  expect(view.container.querySelector('[data-custom="card"]')).not.toBeNull(); expect(view.getByText('Étape 1')).toBeDefined();
  fireEvent.click(view.getByRole('button', { name: 'Oui' })); expect(view.getByText('Fixed after 1 step')).toBeDefined();
  expect(registry.docs()).toContain('```ui:troubleshoot'); expect(registry.docs()).toContain('"title":"Wi-Fi drops"'); expect(registry.docs()).toContain('Record of step id');
  view.rerender(<Prism source={fence({ start: 'a', steps: { a: null, b: { text: 2 }, c: [] } })} registry={registry} />);
  expect(view.getByText('Not fixed yet')).toBeDefined();
});

test('command override receives stable frozen node and code context; clipboard errors are handled', async () => {
  const nodes: unknown[] = [], original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  const writes: string[] = [];
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (value: string) => { writes.push(value); } } });
  function Code({ node }: { node: { value?: string } }) { nodes.push(node); const context = useContext(ComponentContext), emit = useEmit(); return <button onClick={() => emit('copy')}>{context?.name}:{node.value}</button>; }
  try {
    const view = render(<Prism source={fence(props)} registry={registry} components={{ code: Code }} />);
    expect(Object.isFrozen(nodes[0])).toBe(true); expect(view.getByText('code:$ nmcli radio wifi on')).toBeDefined();
    await act(async () => { fireEvent.click(view.getByRole('button', { name: 'Copy' })); });
    expect(writes).toEqual(['nmcli radio wifi on']); expect(view.getByRole('button', { name: 'Copied' })).toBeDefined();
    expect(nodes.every(node => node === nodes[0])).toBe(true);
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw Error('denied'); } } });
    await act(async () => { fireEvent.click(view.getByRole('button', { name: 'Copied' })); });
    expect(view.getByRole('button', { name: 'Could not copy' })).toBeDefined();
  } finally { if (original) Object.defineProperty(navigator, 'clipboard', original); else Reflect.deleteProperty(navigator, 'clipboard'); }
});

test('keyboard shortcuts also work from the frame toolbar and explicit escalation ends unresolved', () => {
  const view = render(<Prism source={fence(props)} registry={registry} />);
  fireEvent.keyDown(view.getByRole('button', { name: 'Ask about this' }), { key: 'n' });
  expect(view.getByText('Step 2')).toBeDefined();
  fireEvent.keyDown(view.getByRole('group'), { key: 'n' });
  expect(view.getByText('Not fixed yet')).toBeDefined();
  expect(view.getByRole('group').dataset.state).toBe('dead-end');
});
