import '../../../react/test/setup';
import { afterEach, expect, test } from 'bun:test';
import { Prism, defaultRegistry, type Action } from '@prism-ui/react';
import { createStore } from '@prism-ui/state';
import '../index';
const { act, cleanup, fireEvent, render } = await import('@testing-library/react');
import { ViewConfigContext, type PrimitiveProps } from './index';
import { gallery, views } from './fixtures';

afterEach(cleanup);
// keyUp lets React's input polyfill notice the change when react-dom loaded before happy-dom in a full run.
function type(el: HTMLElement, value: string) { act(() => el.focus()); fireEvent.change(el, { target: { value } }); fireEvent.keyUp(el); }
const fence = (value: unknown) => '```ui:view\n' + JSON.stringify(value) + '\n```';

test('every gallery view renders statically with parts, docs and no skeletons', () => {
  for (const [name, source] of Object.entries(gallery)) {
    const view = render(<Prism source={source} locale="en-US" />);
    const root = view.container.querySelector('.prism-view__root')!;
    expect(root).not.toBeNull();
    expect(root.getAttribute('aria-label')).toBe(views[name as keyof typeof views].title);
    expect(view.container.querySelector('[data-prism-skeleton]')).toBeNull();
    view.container.querySelectorAll('[data-prism="view"][data-part]').forEach(el => { const part = el.getAttribute('data-part')!; if (part !== 'root') expect(el.classList.contains('prism-view__' + part)).toBe(true); });
    view.unmount();
  }
  const docs = defaultRegistry.docs();
  for (const word of ['### view', '$bind', '$calc', 'each', 'onClick', 'EMBED', 'when']) expect(docs).toContain(word);
});

test('dashboard formats stats, deltas and embeds the registered chart with store data', () => {
  const view = render(<Prism source={gallery.dashboard} locale="en-US" />);
  expect(view.getAllByText('$44,700.00').length).toBeGreaterThan(0);
  const deltas = Array.from(view.container.querySelectorAll('[data-part="statDelta"]'));
  expect(deltas[0].textContent!.startsWith('+')).toBe(true); expect(deltas[0].getAttribute('data-good')).toBe('true');
  expect(deltas[2].textContent!.startsWith('-')).toBe(true); expect(deltas[2].getAttribute('data-good')).toBe('true');
  expect(view.container.querySelector('[data-part="embed"][data-name="chart"]')).not.toBeNull();
  expect(view.container.querySelectorAll('.prism-view__table tbody tr').length).toBe(3);
});

test('pricing: selectable cards, $calc totals, templates and the exact action payload', () => {
  const actions: Action[] = [];
  const view = render(<Prism source={gallery.pricing} locale="en-US" onAction={a => { actions.push(a); }} />);
  expect(view.getByText('$80.00')).toBeDefined();
  const enterprise = view.getByRole('button', { name: /Enterprise/ });
  expect(enterprise.getAttribute('aria-pressed')).toBe('false');
  fireEvent.click(enterprise);
  expect(enterprise.getAttribute('aria-pressed')).toBe('true');
  expect(view.getByText('$200.00')).toBeDefined();
  fireEvent.click(view.getByRole('radio', { name: 'Monthly' }));
  expect(view.getByText('$250.00')).toBeDefined();
  expect(view.getByText('$50.00')).toBeDefined();
  fireEvent.click(view.getByRole('button', { name: 'Continue with ENTERPRISE' }));
  expect(actions.length).toBe(1);
  expect(actions[0].type).toBe('choose_plan');
  expect(actions[0].payload).toEqual({ plan: 'enterprise', annual: false, seats: 5 });
  expect(actions[0].context.component).toBe('view');
});

test('todos: each, $item bindings, push on Enter, remove, filter and progress', () => {
  const store = createStore();
  const view = render(<Prism source={gallery.todos} store={store} />);
  expect(view.getByText('1 of 3 done')).toBeDefined();
  const input = view.getByPlaceholderText('Add a task and press Enter') as HTMLInputElement;
  expect((view.getByRole('button', { name: 'Add' }) as HTMLButtonElement).disabled).toBe(true);
  type(input, 'Tweet the launch');
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(input.value).toBe('');
  expect(view.getByText('Tweet the launch')).toBeDefined();
  expect(view.getByText('1 of 4 done')).toBeDefined();
  const items = store.get('launch.items') as { id: string; text: string }[];
  expect(items.length).toBe(4); expect(typeof items[3].id).toBe('string');
  fireEvent.click(view.getByLabelText('Run the smoke suite on staging'));
  expect(view.getByText('2 of 4 done')).toBeDefined();
  expect(store.get('launch.items.1.done')).toBe(true);
  fireEvent.click(view.getAllByRole('button', { name: 'Remove' })[0]);
  expect(view.queryByText('Freeze the release branch')).toBeNull();
  expect(view.getByText('1 of 3 done')).toBeDefined();
  fireEvent.click(view.getByRole('tab', { name: /Open/ }));
  expect(view.getAllByRole('checkbox').length).toBe(2);
  expect(store.get('launch.show')).toBe('open');
  act(() => { store.undo('launch'); });
  expect(store.get('launch.show')).toBe('all');
});

test('settings: when toggles fields, inputs write through $bind, save sends values', () => {
  const actions: Action[] = [];
  const view = render(<Prism source={gallery.settings} onAction={a => { actions.push(a); }} />);
  expect(view.getByLabelText('Digest')).toBeDefined();
  expect(view.queryByLabelText('Starting at')).toBeNull();
  fireEvent.click(view.getByRole('switch', { name: 'Email notifications' }));
  expect(view.queryByLabelText('Digest')).toBeNull();
  fireEvent.click(view.getByRole('switch', { name: 'Quiet hours' }));
  expect(view.getByLabelText('Starting at')).toBeDefined();
  type(view.getByLabelText('Display name'), 'Grace');
  type(view.getByLabelText('Sound volume'), '80');
  fireEvent.click(view.getByRole('button', { name: 'Save preferences' }));
  expect(actions[0].payload).toEqual({ name: 'Grace', email: false, digest: 'weekly', quiet: true, quietFrom: '22:00', volume: 80 });
});

test('keyboard: segmented arrows, tabs arrows and Enter on selectable cards', () => {
  const store = createStore();
  const view = render(<Prism source={gallery.booking} store={store} />);
  const friday = view.getByRole('radio', { name: 'Fri 14' });
  expect(friday.tabIndex).toBe(0);
  fireEvent.keyDown(friday, { key: 'ArrowRight' });
  expect(store.get('booking.day')).toBe('Sat 15');
  expect(document.activeElement?.textContent).toBe('Sat 15');
  fireEvent.keyDown(document.activeElement!, { key: 'ArrowLeft' });
  expect(store.get('booking.day')).toBe('Fri 14');
  cleanup();
  const todo = render(<Prism source={gallery.todos} store={createStore()} />);
  const all = todo.getByRole('tab', { name: /All/ });
  fireEvent.keyDown(all, { key: 'ArrowRight' });
  expect(todo.getByRole('tab', { name: /Open/ }).getAttribute('aria-selected')).toBe('true');
  cleanup();
  const store2 = createStore();
  const cmp = render(<Prism source={gallery.comparison} store={store2} />);
  const pixel = cmp.getByRole('button', { name: /Pixel 9 Pro/ });
  fireEvent.keyDown(pixel, { key: 'Enter' });
  expect(store2.get('phones.pick')).toBe('pixel');
  expect(cmp.container.textContent).toContain('You picked Pixel 9 Pro');
});

test('streaming: every prefix renders without throwing, open nodes get skeletons, final matches', () => {
  for (const name of ['dashboard', 'todos', 'pricing'] as const) {
    const source = gallery[name];
    const view = render(<Prism source="" done={false} />);
    let skeletons = 0;
    for (let i = 1; i <= source.length; i += 7) {
      view.rerender(<Prism source={source.slice(0, i)} done={false} />);
      if (view.container.querySelector('.prism-view__skeleton')) skeletons++;
    }
    view.rerender(<Prism source={source} done />);
    expect(skeletons).toBeGreaterThan(0);
    expect(view.container.querySelector('[data-prism-skeleton]')).toBeNull();
    expect(view.container.querySelector('.prism-view__root')).not.toBeNull();
    view.unmount();
  }
});

test('closed subtrees are memoised: streaming new siblings does not re-render finished nodes', () => {
  const renders: Record<string, number> = {};
  const Probe = ({ props }: PrimitiveProps) => { renders[props.text] = (renders[props.text] ?? 0) + 1; return <p>{props.text}</p>; };
  const config = { primitives: { probe: Probe } };
  const nodes = Array.from({ length: 6 }, (_, i) => ({ type: 'probe', text: 'p' + i }));
  const source = fence({ id: 'm', children: nodes });
  const view = render(<ViewConfigContext.Provider value={config}><Prism source="" done={false} /></ViewConfigContext.Provider>);
  for (let i = 1; i <= source.length; i++) view.rerender(<ViewConfigContext.Provider value={config}><Prism source={source.slice(0, i)} done={false} /></ViewConfigContext.Provider>);
  expect(view.getByText('p5')).toBeDefined();
  expect(source.length).toBeGreaterThan(100);
  expect(renders.p0).toBeLessThanOrEqual(6);
  expect(renders.p2).toBeLessThanOrEqual(6);
});

test('shared store: undeclared paths read and drive other components', () => {
  const store = createStore({ initial: { rent: 1200 } });
  const view = render(<Prism store={store} locale="en-US" source={fence({ id: 'v', children: [
    { type: 'stat', label: 'Yearly', value: { $calc: 'rent * 12' }, format: 'currency' },
    { type: 'button', label: 'Bump', onClick: { set: { rent: { $calc: 'rent + 100' } } } },
  ] })} />);
  expect(view.getByText('$14,400.00')).toBeDefined();
  act(() => { store.set('rent', 1000); });
  expect(view.getByText('$12,000.00')).toBeDefined();
  fireEvent.click(view.getByRole('button', { name: 'Bump' }));
  expect(store.get('rent')).toBe(1100);
});

test('safety: no scripts, unsafe URLs, prototype paths, unknown types or classNames get through', () => {
  const store = createStore();
  const view = render(<Prism store={store} source={fence({ id: 's', state: { ok: 1 }, children: [
    { type: 'image', src: 'javascript:alert(1)', alt: 'x' },
    { type: 'script', text: 'alert(1)' },
    { type: 'text', text: '<b onclick="x">hi</b>', className: 'evil' },
    { type: 'button', label: 'Go', onClick: { set: { '__proto__.polluted': 1, 'constructor.x': 2 } } },
    { type: 'text', text: '{{ constructor }}' },
  ] })} />);
  expect(view.container.querySelector('img')).toBeNull();
  expect(view.container.querySelector('script')).toBeNull();
  expect(view.container.querySelector('b')).toBeNull();
  expect(view.container.querySelector('.evil')).toBeNull();
  fireEvent.click(view.getByRole('button', { name: 'Go' }));
  expect(({} as any).polluted).toBeUndefined();
});

test('frame:none and single-node root render bare artifacts', () => {
  const view = render(<Prism source={fence({ type: 'card', title: 'Solo', children: [{ type: 'badge', text: 'New', tone: 'success' }], frame: 'none' })} />);
  expect(view.container.querySelector('.prism-view--bare')).not.toBeNull();
  expect(view.getByText('New').getAttribute('data-tone')).toBe('success');
  expect(view.container.querySelector('.prism-view__card')).not.toBeNull();
});

test('streaming: a button whose handler is still streaming is disabled and sends nothing', () => {
  const actions: Action[] = [];
  const full = gallery.pricing, cut = full.lastIndexOf('"$ref": "plan"') + 10;
  const view = render(<Prism source={full.slice(0, cut)} done={false} onAction={a => { actions.push(a); }} />);
  const button = view.getByRole('button', { name: /Continue with/ }) as HTMLButtonElement;
  expect(button.disabled).toBe(true);
  fireEvent.click(button);
  expect(actions).toEqual([]);
  view.rerender(<Prism source={full} onAction={a => { actions.push(a); }} />);
  fireEvent.click(view.getByRole('button', { name: /Continue with/ }));
  expect(actions.at(-1)?.payload).toEqual({ plan: 'pro', annual: true, seats: 5 });
});

test('streaming: a button is disabled while its node is open and onClick has not arrived', () => {
  const full = gallery.pricing, cut = full.lastIndexOf('"onClick"');
  const view = render(<Prism source={full.slice(0, cut)} done={false} />);
  expect((view.getByRole('button', { name: /Continue with/ }) as HTMLButtonElement).disabled).toBe(true);
});

test('templates keep ||, payloads resolve every key, $ref lists subscribe', async () => {
  const { template, run, collect } = await import('./tree');
  const scope = { view: 'v', locals: new Set(['annual', 'items', 'pick']) };
  const data: Record<string, unknown> = { 'v.annual': false, 'v.pick': 'b', 'v.items': [1, 2] };
  const read = (p: string) => data[p];
  expect(template('{{ annual || 1 }}', scope, read, v => String(v))).toBe('1');
  expect(template('{{ pick | upper }}', scope, read, (v, k) => k === 'upper' ? String(v).toUpperCase() : String(v))).toBe('B');
  const action = run({ action: 'pick', payload: { item: { $ref: 'pick' }, children: [{ $ref: 'annual' }], tabs: { $calc: '1 + 1' } } }, scope, { get: read, set() {}, remove() {} } as any, v => String(v));
  expect(action?.payload).toEqual({ item: 'b', children: [false], tabs: 2 });
  expect([...collect({ type: 'list', each: { $ref: 'items' } } as any, scope, new Set())]).toContain('v.items');
});

test('embeds: kind reaches schemas that declare it, list items get distinct ids', async () => {
  const { s } = await import('@prism-ui/schema');
  const { defineComponent, registerComponent } = await import('@prism-ui/react');
  registerComponent(defineComponent({ name: 'kindprobe', schema: s.object({ id: s.string().optional(), kind: s.string().optional() }), component: ({ props, id }: any) => <i data-probe={id}>{String(props.kind)}</i> }));
  const view = render(<Prism source={fence({ id: 'k', state: { rows: [1, 2] }, children: [{ type: 'kindprobe', kind: 'svg' }, { type: 'list', each: 'rows', item: { type: 'kindprobe' } }] })} />);
  const probes = Array.from(view.container.querySelectorAll('[data-probe]'));
  expect(probes[0].textContent).toBe('svg');
  expect(new Set(probes.map(p => p.getAttribute('data-probe'))).size).toBe(3);
});
