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
  expect(view.getByText('Report sent')).toBeDefined();
});

test('unknown and missing targets end unresolved; yes defaults to fixed', () => {
  const actions: Action[] = [], input = { id: 'dead', start: 'a', steps: { a: { text: 'Try again.', no: 'unknown' } } };
  const view = render(<Prism source={fence(input)} registry={registry} onAction={action => actions.push(action)} />);
  fireEvent.click(view.getByRole('button', { name: 'No' }));
  expect(view.getByText('Not fixed yet')).toBeDefined(); fireEvent.click(view.getByRole('button', { name: 'Send report' }));
  expect(actions).toEqual([{ type: 'troubleshoot', component: 'troubleshoot', id: 'dead', payload: { resolved: false, path: [{ step: 'a', answer: 'no' }] }, context: { component: 'troubleshoot', props: input, state: { path: [{ step: 'a', answer: 'no' }], sent: false } }, message: 'Troubleshooting "Troubleshoot": not fixed after 1 steps (No).' }]);
  fireEvent.click(view.getByRole('button', { name: 'Start over' })); fireEvent.click(view.getByRole('button', { name: 'Yes' })); expect(view.getByText('Fixed after 1 steps')).toBeDefined();
  view.rerender(<Prism source={fence({ start: 'a', steps: { a: { text: 'No target.' } } })} registry={registry} />);
  fireEvent.click(view.getByRole('button', { name: 'No' })); expect(view.getByText('Not fixed yet')).toBeDefined();
});

test('keyboard answers and backtracking, clickable history truncation and undo', () => {
  const view = render(<Prism source={fence(props)} registry={registry} />);
  fireEvent.keyDown(view.getByRole('button', { name: 'No' }), { key: 'n' }); expect(view.getByText('Step 2')).toBeDefined();
  fireEvent.keyDown(view.getByRole('button', { name: 'Yes' }), { key: 'ArrowLeft' }); expect(view.getByText('Step 1')).toBeDefined();
  fireEvent.keyDown(view.getByRole('button', { name: 'No' }), { key: 'N' });
  fireEvent.click(view.getByRole('button', { name: 'Restart the adapter. No' })); expect(view.getByText('Step 1')).toBeDefined();
  fireEvent.keyDown(view.getByRole('group'), { key: 'z', ctrlKey: true }); expect(view.getByText('Step 2')).toBeDefined();
  fireEvent.keyDown(view.getByRole('button', { name: 'Yes' }), { key: 'Backspace' }); expect(view.getByText('Step 1')).toBeDefined();
  fireEvent.keyDown(view.getByRole('button', { name: 'Yes' }), { key: 'y' }); expect(view.getByText('Fixed after 1 steps')).toBeDefined();
});

test('streaming skeleton stays safe until text and branch targets arrive', () => {
  const initial = '```ui:troubleshoot\n{"id":"stream","start":"a","steps":{';
  const view = render(<Prism source={initial} done={false} registry={registry} />);
  expect(view.getByRole('status', { name: 'Loading step' })).toBeDefined();
  expect((view.getByRole('button', { name: 'Yes' }) as HTMLButtonElement).disabled).toBe(true);
  const partial = initial + '"a":{"text":"Restart';
  view.rerender(<Prism source={partial} done={false} registry={registry} />);
  expect(view.getByRole('status', { name: 'Loading step' })).toBeDefined();
  expect((view.getByRole('button', { name: 'Yes' }) as HTMLButtonElement).disabled).toBe(true);
  view.rerender(<Prism source={partial + ' the adapter.","no":"b"},"b":{"text":"Next"}}}'} done={false} registry={registry} />);
  expect(view.getByText('Restart the adapter.')).toBeDefined();
  expect((view.getByRole('button', { name: 'No' }) as HTMLButtonElement).disabled).toBe(false);
});

test('unstyled mode, labels, slots, prompt docs and malformed steps', () => {
  const view = render(<Prism source={fence({ ...props, labels: { yes: 'Oui', step: 'Étape' } })} registry={registry} unstyled slots={{ troubleshoot: { step: input => <article {...input} data-custom="card" />, actions: input => <footer {...input} />, title: ({ children }) => <h2>{children}</h2> } }} />);
  expect(view.container.querySelector('[class*="prism-troubleshoot"]')).toBeNull();
  expect(view.container.querySelector('[data-custom="card"]')).not.toBeNull(); expect(view.getByText('Étape 1')).toBeDefined();
  fireEvent.click(view.getByRole('button', { name: 'Oui' })); expect(view.getByText('Fixed after 1 steps')).toBeDefined();
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
