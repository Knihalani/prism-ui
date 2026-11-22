import './setup';
import { afterEach, expect, test } from 'bun:test';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { createStore, memoryAdapter } from '@prism-ui/state';
import { s } from '@prism-ui/schema';
import type { Node, Plugin } from '@prism-ui/core';
import { Prism, createRegistry, defineComponent, registerComponent, defaultRegistry, toPromptDocs, usePart, useSlot, useEmit, useStore, useStoreValue, useComponentState, useFormula, useFormat, usePrism, usePrismStream, createTheme, ThemeScope, defaultRenderers, message, cx, type Action, type MarkdownProps, type PrismComponentProps, type PrismStream, type PrismProps, type Middleware } from '../src';

afterEach(cleanup);

test('source deltas preserve frozen node references and render counts, including inline nodes', () => {
  const nodes: Node[] = []; let frozen = 0, inline = 0;
  const components = {
    paragraph({ node, children }: MarkdownProps) { nodes.push(node); if (node.key === '0') frozen++; return <p>{children}</p>; },
    strong({ children }: MarkdownProps) { inline++; return <b>{children}</b>; },
  };
  let source = 'Frozen **bold**\n\nTail';
  const view = render(<Prism source={source} done={false} components={components} />);
  const first = nodes[0]; expect(Object.isFrozen(first)).toBe(true);
  for (const text of [' grows', ' and', ' grows']) { source += text; view.rerender(<Prism source={source} done={false} components={components} />); }
  expect(frozen).toBe(1); expect(inline).toBe(1); expect(nodes.filter(n => n.key === '0')).toEqual([first]);
  expect(view.container.textContent).toBe('Frozen boldTail grows and grows');
  view.rerender(<Prism source={source} components={components} />); expect(frozen).toBe(1);
  view.rerender(<Prism source="Replacement" components={components} />); expect(view.container.textContent).toBe('Replacement'); expect(frozen).toBe(2);
});

test('fresh equal inline configuration preserves frozen renders and changed contents propagate', () => {
  let frozen = 0, inline = 0;
  const contexts: ReturnType<typeof usePrism>[] = [], calls: string[] = [], actions: Action[] = [];
  function Paragraph({ node, children }: MarkdownProps) { const context = usePrism(), part = usePart('paragraph', 'root'); if (node.key === '0') { frozen++; contexts.push(context); } return <p {...part}>{children}</p>; }
  function Strong({ children }: MarkdownProps) { inline++; return <b {...usePart('strong', 'root')}>{children}</b>; }
  function Button() { const emit = useEmit(); return <button onClick={() => emit('ask')}>Ask</button>; }
  function Slot() { return null; }
  function OtherSlot() { return null; }
  function Replacement(props: MarkdownProps) { return <Paragraph {...props} />; }
  const first: Middleware = (action, next) => { calls.push('first'); next(action); };
  const second: Middleware = (action, next) => { calls.push('second'); next(action); };
  function Parent({ source, changed = {} }: { source: string; changed?: Partial<PrismProps> }) {
    return <Prism source={source} done={false} components={{ paragraph: Paragraph, strong: Strong, button: Button }} slots={{ paragraph: { root: Slot } }} classNames={{ paragraph: { root: 'reading' } }} styles={{ paragraph: { root: { color: 'red' } } }} theme={{ '--prism-accent': 'blue' }} middleware={[first]} onAction={action => actions.push(action)} {...changed} />;
  }
  let source = 'Frozen **bold**\n\n::button\n\nTail';
  const view = render(<Parent source={source} />), initial = contexts[0];
  for (const chunk of [' grows', ' and', ' grows']) { source += chunk; view.rerender(<Parent source={source} />); }
  expect(frozen).toBe(1); expect(inline).toBe(1); expect(contexts).toEqual([initial]);
  expect(view.container.textContent).toBe('Frozen boldAskTail grows and grows');
  const changes: Partial<PrismProps>[] = [
    { components: { paragraph: Replacement, strong: Strong, button: Button } },
    { slots: { paragraph: { root: OtherSlot } } }, { slots: {} },
    { classNames: { paragraph: { root: 'changed' } } }, { classNames: {} },
    { styles: { paragraph: { root: { color: 'green' } } } }, { styles: {} },
    { theme: { '--prism-accent': 'purple' } }, { theme: {} }, { theme: 'dark' },
  ];
  for (const changed of changes) {
    view.rerender(<Parent source={source} />); const before = frozen;
    view.rerender(<Parent source={source} changed={changed} />); expect(frozen).toBe(before + 1); expect(contexts.at(-1)).not.toBe(initial);
  }
  view.rerender(<Parent source={source} />); const before = frozen;
  fireEvent.click(view.getByRole('button')); expect(calls).toEqual(['first']);
  view.rerender(<Parent source={source} changed={{ middleware: [second] }} />);
  expect(frozen).toBe(before); fireEvent.click(view.getByRole('button')); expect(calls).toEqual(['first', 'second']);
  view.rerender(<Parent source={source} changed={{ middleware: [] }} />);
  fireEvent.click(view.getByRole('button')); expect(calls).toEqual(['first', 'second']); expect(actions).toHaveLength(3);
});

test('default markdown renderers provide semantic elements, safety and part attributes', () => {
  const source = '# Title\n\nText **strong** *em* ~~gone~~ `code`  \nnext [ext](https://example.com) ![Alt](https://example.com/a.png)\n\n- [x] Done\n\n> Quote\n\n```js\nx < y\n```\n\n| A | B |\n| :--- | ---: |\n| 1 | 2 |\n\n---\n';
  const { container } = render(<Prism source={source} />);
  for (const tag of ['h1', 'p', 'strong', 'em', 'del', 'code', 'br', 'ul', 'li', 'blockquote', 'pre', 'table', 'thead', 'tbody', 'hr']) expect(container.querySelector(tag)).not.toBeNull();
  expect(container.querySelector('input')?.checked).toBe(true); expect(container.querySelector('input')?.readOnly).toBe(true);
  expect(container.querySelector('a')?.getAttribute('rel')).toBe('noopener noreferrer'); expect(container.querySelector('a')?.target).toBe('_blank');
  expect(container.querySelector('img')?.getAttribute('loading')).toBe('lazy');
  expect(container.querySelector('pre code')?.className).toBe('language-js');
  expect(container.querySelectorAll('th')[1].style.textAlign).toBe('right');
  expect(container.querySelector('h1')?.getAttribute('data-part')).toBe('root');
});

test('registry, explicit overrides, unknown directives and generated docs', () => {
  const registry = createRegistry([
    { name: 'heading', component: ({ children }) => <header>Registered {children}</header> },
    { name: 'card', schema: s.object({ title: s.string() }), component: ({ props }) => <aside>{props.title}</aside>, docs: 'A card.' },
  ]);
  expect(registry.list().map(d => d.name)).toEqual(['heading', 'card']); expect(registry.get('missing')).toBeUndefined();
  expect(registry.docs()).toContain('### card'); expect(toPromptDocs(registry)).toBe(registry.docs()); expect(toPromptDocs(registry.list())).toBe(registry.docs());
  const view = render(<Prism registry={registry} source={'# Hi\n\n::card{title="Hi"}\n\n:::mystery\nUnknown child\n:::\n'} />);
  expect(view.container.querySelector('header')?.textContent).toBe('Registered Hi'); expect(view.container.querySelector('aside')?.textContent).toBe('Hi');
  expect(view.container.querySelector('[data-name="mystery"]')?.textContent).toBe('Unknown child');
  const components = { heading: ({ children }: MarkdownProps) => <h2>Override {children}</h2>, card: ({ props }: PrismComponentProps<any>) => <section>{props.title} override</section> };
  view.rerender(<Prism registry={registry} source={'# Hi\n\n::card{title="Hi"}\n'} components={components} />);
  expect(view.container.querySelector('h2')?.textContent).toBe('Override Hi'); expect(view.container.querySelector('section')?.textContent).toBe('Hi override');
  registerComponent({ name: 'global-test', component: () => <i>Global</i> }); expect(defaultRegistry.get('global-test')).toBeDefined();
});

test('coercion and incomplete fallback switch to the registered component on completion', () => {
  const registry = createRegistry(); let seen: PrismComponentProps<any> | undefined;
  registry.register(defineComponent({ name: 'card', schema: s.object({ title: s.string(), count: s.number() }), fallback: ({ issues }) => <p>Loading {issues[0]?.path}</p>, component: props => { seen = props; return <p>{props.props.title}:{props.props.count}</p>; } }));
  const prefix = '```ui:card\n{"count":"3"';
  const view = render(<Prism source={prefix} done={false} registry={registry} />);
  expect(view.container.textContent).toBe('Loading title');
  view.rerender(<Prism source={prefix + ',"title":"Ready"}\n```\n'} registry={registry} />);
  expect(view.container.textContent).toBe('Ready:3'); expect(seen?.props.count).toBe(3); expect(seen?.complete).toBe(true); expect(seen?.partial).toBe(false);
});

test('$ref bindings resolve recursively and only their directive rerenders', () => {
  const store = createStore({ initial: { price: 3, other: 8 } }); let bound = 0, unrelated = 0;
  const registry = createRegistry([
    { name: 'bound', schema: s.object({ nested: s.array(s.object({ price: s.number() })) }), component: ({ props }) => { bound++; return <p>{props.nested[0].price}</p>; } },
    { name: 'other', component: () => { unrelated++; return <i>Other</i>; } },
  ]);
  const view = render(<Prism store={store} registry={registry} source={'```ui:bound\n{"nested":[{"price":{"$ref":"price"}}]}\n```\n\n::other\n'} />);
  expect(view.container.textContent).toBe('3Other'); act(() => store.set('other', 9)); expect(bound).toBe(1);
  act(() => store.set('price', 4)); expect(view.container.textContent).toBe('4Other'); expect(bound).toBe(2); expect(unrelated).toBe(1);
});

test('store hooks subscribe precisely, component state persists and formulas track deps', () => {
  const store = createStore({ initial: { x: 2, y: 3 } }); let x = 0, y = 0;
  function X() { x++; return <p>X:{useStoreValue<number>('x')}</p>; }
  function Y() { y++; return <p>Y:{useStoreValue<number>('y')}</p>; }
  function Counter() { const [n, set] = useComponentState('count', 0); const sum = useFormula('x+y'); expect(useStore()).toBe(store); return <button onClick={() => set(n => n + 1)}>{n}:{sum}</button>; }
  const registry = createRegistry([{ name: 'x', component: X }, { name: 'y', component: Y }, { name: 'counter', component: Counter }]);
  const view = render(<Prism source={'::x\n::y\n::counter{id=mine}\n'} store={store} registry={registry} />);
  expect(store.get('mine.count')).toBe(0); act(() => store.set('x', 4)); expect(x).toBe(2); expect(y).toBe(1);
  expect(view.container.querySelector('button')?.textContent).toBe('0:7'); fireEvent.click(view.container.querySelector('button')!);
  expect(store.get('mine.count')).toBe(1); expect(x).toBe(2); expect(y).toBe(1);
});

test('actions include component context and messages; middleware transforms or swallows in order', () => {
  const actions: Action[] = [], order: string[] = [], store = createStore({ initial: { mine: { selected: true } } });
  function Buttons() { const emit = useEmit(); return <><button onClick={() => emit('choose', { n: 1 })}>Choose</button><button onClick={() => emit('ask', undefined, 'Explicit')}>Ask</button><button onClick={() => emit('drop')}>Drop</button></>; }
  const registry = createRegistry([{ name: 'card', component: Buttons, message: a => `Custom ${a.type}` }]);
  const view = render(<Prism source={'::card{id=mine}\n'} store={store} registry={registry} onAction={a => actions.push(a)} middleware={[
    (a, next) => { order.push('first'); if (a.type !== 'drop') next({ ...a, payload: { changed: true } }); },
    (a, next) => { order.push('second'); next(a); },
  ]} />);
  fireEvent.click(view.getByText('Choose')); expect(actions[0]).toMatchObject({ type: 'choose', component: 'card', id: 'mine', payload: { changed: true }, message: 'Custom choose', context: { component: 'card', props: { id: 'mine' }, state: { selected: true } } });
  fireEvent.click(view.getByText('Ask')); expect(actions[1].message).toBe('Explicit');
  fireEvent.click(view.getByText('Drop')); expect(actions.length).toBe(2); expect(order).toEqual(['first', 'second', 'first', 'second', 'first']);
  expect(message({ type: 'ask', component: 'card', payload: {} })).toBe('Tell me more about this card…');
  expect(message({ type: 'choose', component: 'card', payload: { a: 1 } })).toBe('User choose in card: {"a":1}');
});

test('ui:state applies only completed patches, once despite reparsing and strict effects', () => {
  const store = createStore(); let commits = 0; store.subscribe('*', () => commits++);
  const prefix = '```ui:state\n{"set":{"x":1}}';
  const view = render(<StrictMode><Prism store={store} source={prefix} done={false} /></StrictMode>);
  expect(store.get('x')).toBeUndefined();
  const source = prefix + '\n```\n'; view.rerender(<StrictMode><Prism store={store} source={source} /></StrictMode>);
  expect(store.get('x')).toBe(1); expect(commits).toBe(1); expect(view.container.textContent).toBe('');
  act(() => store.set('x', 2)); view.rerender(<StrictMode><Prism store={store} source={source + '\nTail'} /></StrictMode>);
  expect(store.get('x')).toBe(2); expect(commits).toBe(2);
});

test('parts, slots, class overrides, theme variables and unstyled data attributes', () => {
  function View() { const part = usePart('card', 'root', 'done'), Slot = useSlot('card', 'title', () => <b>Default</b>); return <section {...part}><Slot /></section>; }
  const components = { card: View }, theme = createTheme({ accentSoft: '#abc', radiusMd: '8px' }, { bg: 'white' });
  expect(theme).toEqual({ '--prism-accent-soft': '#abc', '--prism-radius-md': '8px', '--prism-bg': 'white' });
  expect(createTheme({ accent: 'red' }, theme)['--prism-bg']).toBe('white'); expect(cx('a', false, undefined, 'b')).toBe('a b');
  const props = { source: '::card\n', components, theme, animate: false, density: 'compact' as const, classNames: { card: { root: 'custom' } }, styles: { card: { root: { color: 'red' } } }, slots: { card: { title: () => <i>Override</i> } } };
  const view = render(<Prism {...props} />), section = () => view.container.querySelector('section')!;
  expect(section().className).toBe('prism-card__root custom'); expect(section().style.color).toBe('red'); expect(section().dataset.state).toBe('done'); expect(section().textContent).toBe('Override');
  const root = view.container.firstElementChild as HTMLElement; expect(root.dataset.prismTheme).toBe('auto'); expect(root.dataset.density).toBe('compact'); expect(root.dataset.animate).toBe('false'); expect(root.style.getPropertyValue('--prism-radius-md')).toBe('8px');
  view.rerender(<Prism {...props} unstyled />); expect(section().className).toBe('custom'); expect(section().dataset.prism).toBe('card'); expect(root.classList.contains('prism-root')).toBe(true);
  const standalone = render(<ThemeScope theme="dark" as="article">Scoped</ThemeScope>); expect(standalone.container.querySelector('article')?.dataset.prismTheme).toBe('dark');
});

test('formatting follows locale and currency, and plugin changes reset source parsing', () => {
  function View() { const f = useFormat(); expect(f.locale).toBe('en-US'); expect(f.currencyCode).toBe('USD'); return <p>{[f.number(1234), f.currency(2), f.currency(2, 'EUR'), f.percent(0.25), f.date('2020-01-02', { timeZone: 'UTC', year: 'numeric' }), f.compact(1200)].join('|')}</p>; }
  const view = render(<Prism source={'::format\n'} components={{ format: View }} locale="en-US" currency="USD" />);
  expect(view.container.textContent).toBe('1,234|$2.00|€2.00|25%|2020|1.2K');
  const plugin: Plugin = { name: 'replace', transform: n => n.type === 'heading' ? { ...n, depth: 2 } : n };
  view.rerender(<Prism source="# Heading\n" plugins={[plugin]} />); expect(view.container.querySelector('h2')).not.toBeNull();
  view.rerender(<Prism source="# Heading\n" />); expect(view.container.querySelector('h1')).not.toBeNull();
});

test('formatting defaults to the runtime locale and USD and accepts explicit overrides', () => {
  let format!: ReturnType<typeof useFormat>;
  function View() { format = useFormat(); return <p>{format.currency(1234.5)}</p>; }
  const components = { format: View }, view = render(<Prism source={'::format\n'} components={components} />);
  expect(format.locale).toBeUndefined(); expect(format.currencyCode).toBe('USD');
  expect(view.container.textContent).toBe(new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(1234.5));
  expect(format.number(1234.5)).toBe(new Intl.NumberFormat().format(1234.5));
  expect(format.date('2020-01-02', { timeZone: 'UTC' })).toBe(new Intl.DateTimeFormat(undefined, { timeZone: 'UTC' }).format(new Date('2020-01-02')));
  view.rerender(<Prism source={'::format\n'} components={components} locale="en-GB" currency="GBP" />);
  expect(format.locale).toBe('en-GB'); expect(format.currencyCode).toBe('GBP'); expect(view.container.textContent).toBe('£1,234.50');
});

test('owned stores load persisted data once', () => {
  const adapter = memoryAdapter(); adapter.save('ns', { x: 7 }); let loads = 0;
  const persist = { ...adapter, load(ns: string) { loads++; return adapter.load(ns); } };
  function View() { return <p>{useStoreValue<number>('x')}</p>; }
  const components = { value: View }, view = render(<Prism source={'::value\n'} persist={persist} namespace="ns" components={components} />);
  expect(view.container.textContent).toBe('7');
  view.rerender(<Prism source={'::value\n\nTail'} persist={persist} namespace="ns" components={components} />);
  expect(loads).toBe(1); expect(view.container.textContent).toBe('7Tail');
});

test('usePrismStream consumes async iterables, publishes previews, reports errors and cancels', async () => {
  let advance!: () => void, cancelled = false;
  async function* chunks() { try { yield '# Start\n\n'; await new Promise<void>(resolve => { advance = resolve; }); yield 'Tail'; } finally { cancelled = true; } }
  function View({ stream }: { stream: PrismStream }) { const state = usePrismStream(stream, { throttle: 0 }); return <div data-done={String(state.done)}>{state.error ? 'Error' : state.root.children.map(n => n.children?.map(c => c.value).join('')).join('|')}</div>; }
  const stream = chunks(), view = render(<View stream={stream} />);
  await waitFor(() => expect(view.container.textContent).toBe('Start'));
  await act(async () => { advance(); }); await waitFor(() => expect(view.container.firstElementChild?.getAttribute('data-done')).toBe('true'));
  expect(view.container.textContent).toBe('Start|Tail'); expect(cancelled).toBe(true);
  async function* broken() { yield 'partial'; throw Error('failure'); }
  view.rerender(<View stream={broken()} />); await waitFor(() => expect(view.container.textContent).toBe('Error'));
  let returned = 0;
  const waiting: AsyncIterable<string> = { [Symbol.asyncIterator]() { return { next: () => new Promise(() => {}), return: async () => { returned++; return { done: true, value: undefined }; } }; } };
  view.rerender(<View stream={waiting} />); view.unmount(); expect(returned).toBe(1);
});

test('Prism stream decodes split UTF-8 bytes and default registry renders directives', async () => {
  const bytes = new TextEncoder().encode('Hello 🌍');
  const stream = new ReadableStream<Uint8Array>({ start(c) { c.enqueue(bytes.slice(0, 8)); c.enqueue(bytes.slice(8)); c.close(); } });
  const view = render(<Prism stream={stream} />); await waitFor(() => expect(view.container.textContent).toBe('Hello 🌍'));
  view.rerender(<Prism source={'::global-test\n'} />); expect(view.container.textContent).toBe('Global');
  expect(defaultRenderers.heading).toBeDefined();
});

test('empty content, invalid formulas and reduced motion remain safe', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'matchMedia');
  Object.defineProperty(globalThis, 'matchMedia', { configurable: true, value: () => ({ matches: true, addEventListener() {}, removeEventListener() {} }) });
  try {
    const empty = render(<Prism source="" />); expect(empty.container.textContent).toBe(''); expect(empty.container.firstElementChild?.getAttribute('data-animate')).toBe('false');
    function View() { const invalid = useFormula('bad('); const valid = useFormula('missing + 2'); expect(usePrism().animate).toBe(false); return <p>{String(invalid)}:{valid}</p>; }
    const view = render(<Prism source={'::formula\n'} components={{ formula: View }} />); expect(view.container.textContent).toBe('NaN:2');
  } finally { if (original) Object.defineProperty(globalThis, 'matchMedia', original); else Reflect.deleteProperty(globalThis, 'matchMedia'); }
});
