import '../../react/test/setup';
import { afterEach, expect, test } from 'bun:test';
import { Prism, createRegistry, type Action } from '@prism-ui/react';
import { createStore } from '@prism-ui/state';
import { runbookDefinition, stepDefinition } from '../src/runbook';

const { act, cleanup, fireEvent, render } = await import('@testing-library/react');

afterEach(cleanup);
const registry = createRegistry([runbookDefinition, stepDefinition]);
const source = '::::runbook{title="Deploy to Fly" id=deploy}\n:::step{title="Install the CLI" id=install}\nRun:\n```bash\n$ fly install\n```\n:::\n:::step{title="Log in"}\nLog in now.\n:::\n::::\n';

test('static runbook renders numbered steps, normal code renderer, progress and complete state', () => {
  const view = render(<Prism source={source} registry={registry} />);
  const checks = view.getAllByRole('checkbox');
  expect(checks.map(check => check.textContent)).toEqual(['1', '2']);
  expect(view.getByText('$ fly install').tagName).toBe('CODE');
  expect(view.getByRole('progressbar').getAttribute('aria-valuemax')).toBe('2');
  fireEvent.click(checks[0]); fireEvent.click(checks[1]);
  expect(view.getByRole('group').dataset.state).toBe('complete');
  expect(view.getByText('2 of 2')).toBeDefined();
  expect(view.getByText('Log in now.')).toBeDefined();
});

test('header actions remain available alongside a richer code renderer copy action', () => {
  const view = render(<Prism source={source} registry={registry} components={{ code: ({ node }) => <pre>{node.value}<button type="button">Copy code</button></pre> }} />);
  const copy = view.getByRole('button', { name: /^Copy$/ });
  expect(copy.closest('[data-part="stepHeader"]')).not.toBeNull();
  expect(view.getAllByRole('button', { name: 'Stuck here?' })[0].closest('[data-part="stepHeader"]')).not.toBeNull();
  expect(view.getByRole('button', { name: 'Copy code' }).closest('[data-part="stepBody"]')).not.toBeNull();
});

test('stuck sends the entire exact runbook action and reflects done state', () => {
  const actions: Action[] = [];
  const view = render(<Prism source={source} registry={registry} onAction={action => actions.push(action)} />);
  fireEvent.click(view.getAllByRole('checkbox')[0]);
  fireEvent.click(view.getAllByRole('button', { name: 'Stuck here?' })[0]);
  const key = 'install';
  expect(actions).toEqual([{ type: 'stuck', component: 'runbook', id: 'deploy', payload: { step: 'install', index: 0, title: 'Install the CLI', text: 'Run:\n$ fly install', done: true }, context: { component: 'runbook', props: { id: 'deploy', title: 'Deploy to Fly' }, state: { done: { [key]: true } } }, message: 'I\'m stuck on step 1 of "Deploy to Fly": Install the CLI.' }]);
});

test('keyboard toggles, arrow focus and frame undo work; unrelated state does not change progress', () => {
  const store = createStore(), view = render(<Prism source={source} registry={registry} store={store} />);
  const [first, second] = view.getAllByRole('checkbox');
  fireEvent.keyDown(first, { key: ' ' }); expect(first.getAttribute('aria-checked')).toBe('true');
  fireEvent.keyDown(first, { key: 'ArrowDown' }); expect(document.activeElement).toBe(second);
  fireEvent.keyDown(second, { key: 'ArrowUp' }); expect(document.activeElement).toBe(first);
  fireEvent.keyDown(first, { key: 'z', ctrlKey: true }); expect(first.getAttribute('aria-checked')).toBe('false');
  fireEvent.keyDown(second, { key: 'Enter' }); expect(second.getAttribute('aria-checked')).toBe('true');
  act(() => store.set('unrelated', 7)); expect(view.getByText('1 of 2')).toBeDefined();
});

test('streaming grows from empty skeleton through missing title and partial body', () => {
  const initial = '::::runbook{title="Deploy"}\n';
  const view = render(<Prism source={initial} done={false} registry={registry} />);
  expect(view.container.querySelectorAll('[data-part="skeleton"]').length).toBe(1);
  view.rerender(<Prism source={initial + ':::step{title="Installing'} done={false} registry={registry} />);
  expect(view.queryByText(':::step{title="Installing')).toBeNull();
  view.rerender(<Prism source={initial + ':::step\nHel'} done={false} registry={registry} />);
  expect(view.container.querySelector('[data-part="stepTitle"]')?.getAttribute('data-state')).toBe('loading');
  view.rerender(<Prism source={initial + ':::step\nHello world\n:::\n::::\n'} registry={registry} />);
  expect(view.getByText('Hello world')).toBeDefined();
  expect(view.getByRole('progressbar').getAttribute('aria-valuemax')).toBe('1');
});

test('streaming step actions stay disabled until the step closes, while frame ask remains enabled', () => {
  const actions: Action[] = [], store = createStore();
  const partial = '::::runbook{id=gate title="Deploy"}\n:::step{id=install title="Install"}\nInstalling\n';
  const view = render(<Prism scope="test" source={partial} done={false} registry={registry} store={store} onAction={action => actions.push(action)} />);
  const check = view.getByRole('checkbox') as HTMLButtonElement, stuck = view.getByRole('button', { name: 'Stuck here?' }) as HTMLButtonElement;
  expect(check.disabled).toBe(true); expect(check.getAttribute('aria-disabled')).toBe('true');
  expect(stuck.disabled).toBe(true); expect(stuck.getAttribute('aria-disabled')).toBe('true');
  fireEvent.click(check); fireEvent.keyDown(check, { key: ' ' }); fireEvent.keyDown(check, { key: 'Enter' }); fireEvent.click(stuck);
  expect(check.getAttribute('aria-checked')).toBe('false'); expect(store.get('test:runbook:0.done')).toEqual({}); expect(store.get('gate')).toBeUndefined(); expect(actions).toEqual([]);
  const ask = view.getByRole('button', { name: 'Ask about this' }) as HTMLButtonElement;
  expect(ask.disabled).toBe(false); fireEvent.click(ask); expect(actions.map(action => action.type)).toEqual(['ask']);
  view.rerender(<Prism scope="test" source={partial + ':::\n'} done={false} registry={registry} store={store} onAction={action => actions.push(action)} />);
  expect((view.getByRole('checkbox') as HTMLButtonElement).disabled).toBe(false);
  expect((view.getByRole('button', { name: 'Stuck here?' }) as HTMLButtonElement).disabled).toBe(false);
  fireEvent.keyDown(view.getByRole('checkbox'), { key: 'Enter' }); fireEvent.click(view.getByRole('button', { name: 'Stuck here?' }));
  expect(store.get('test:runbook:0.done')).toEqual({ install: true }); expect(actions.map(action => action.type)).toEqual(['ask', 'stuck']);
  view.rerender(<Prism scope="test" source={partial + ':::\n::::\n'} registry={registry} store={store} onAction={action => actions.push(action)} />);
  expect(store.get('gate.done')).toEqual({ install: true }); expect(store.get('test:runbook:0')).toBeUndefined();
});

test('unstyled parts, slots, labels and standalone or three-colon steps degrade gracefully', () => {
  const view = render(<Prism source={source} registry={registry} unstyled slots={{ runbook: { step: props => <article {...props} data-custom="yes" />, title: ({ children }) => <h2>{children}</h2>, actions: props => <footer {...props} /> } }} />);
  expect(view.container.querySelector('[class*="prism-runbook"]')).toBeNull();
  expect(view.container.querySelectorAll('[data-custom]').length).toBe(2);
  expect(view.getByRole('heading', { level: 2 }).textContent).toBe('Deploy to Fly');
  view.rerender(<Prism source={':::step{title="Alone"}\nBody\n:::\n'} registry={registry} />);
  expect(view.queryByRole('checkbox')).toBeNull(); expect(view.getByText('Body')).toBeDefined();
  view.rerender(<Prism source={source.replace('::::runbook', ':::runbook')} registry={registry} />);
  expect(view.getByText('Install the CLI')).toBeDefined();
  view.rerender(<Prism source={'::::runbook{labels=\'{"title":"Guide","of":"sur"}\'}\n::::\n'} registry={registry} />);
  expect(view.getByText('Guide')).toBeDefined(); expect(view.getByText('0 sur 0')).toBeDefined();
});

test('copy strips shell prompts and reports clipboard errors without throwing', async () => {
  const writes: string[] = [], original = Object.getOwnPropertyDescriptor(navigator, 'clipboard');
  Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async (value: string) => { writes.push(value); } } });
  try {
    const view = render(<Prism source={source} registry={registry} />);
    await act(async () => { fireEvent.click(view.getByRole('button', { name: 'Copy' })); });
    expect(writes).toEqual(['fly install']); expect(view.getByRole('button', { name: 'Copied' })).toBeDefined();
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async () => { throw Error('denied'); } } });
    await act(async () => { fireEvent.click(view.getByRole('button', { name: 'Copied' })); });
    expect(view.getByRole('button', { name: 'Could not copy' })).toBeDefined();
  } finally { if (original) Object.defineProperty(navigator, 'clipboard', original); else Reflect.deleteProperty(navigator, 'clipboard'); }
});

test('registry prompt docs include both syntax and executable four-colon example', () => {
  const docs = registry.docs();
  expect(docs).toContain('::::runbook{title="Deploy to Fly" id=deploy}');
  expect(docs).toContain(':::step{title="Log in"');
  expect(docs).toContain('Persistent state identifier');
});

test('completion follows an explicit step id when node keys change on a new response', () => {
  const store = createStore(), view = render(<Prism source={source} registry={registry} store={store} />);
  fireEvent.click(view.getAllByRole('checkbox')[0]);
  expect(store.get('deploy.done')).toEqual({ install: true });
  view.rerender(<Prism source={'A new response.\n\n' + source} registry={registry} store={store} />);
  expect(view.getAllByRole('checkbox')[0].getAttribute('aria-checked')).toBe('true');
  expect(view.getAllByRole('checkbox')[0].querySelector('svg')).not.toBeNull();
  expect(view.getByText('1 of 2')).toBeDefined();
});
