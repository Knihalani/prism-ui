import './setup';
import { afterEach, expect, test } from 'bun:test';
import { act, cleanup, fireEvent, render, waitFor, within } from '@testing-library/react';
import type { CSSProperties, ReactNode } from 'react';
import { createStore } from '@prism-ui/state';
import {
  createRegistry, Prism, StreamCaret, StreamSkeleton, ThemeScope, useComponentState, useEmit, useFlash,
  useLocalWrite, usePresentation, useSent, useSettled, type Action, type Middleware, type PrismComponentProps,
} from '../src';

afterEach(cleanup);

test('skeleton exits preserve a measured inert image without duplicate ids or layout', async () => {
  const skeleton = <StreamSkeleton id="loading" style={{ '--prism-motion-fast': '20ms' } as CSSProperties}><span id="line">Loading</span></StreamSkeleton>;
  const host = (children: ReactNode) => <div className="prism-root" data-prism-presentation="">{children}</div>;
  const view = render(host(skeleton));
  view.container.querySelector<HTMLElement>('#loading')!.getBoundingClientRect = () => ({ width: 100, height: 20, left: 10, top: 30 } as DOMRect);
  await act(async () => { view.rerender(host(<p>Content</p>)); });
  const ghost = view.container.querySelector<HTMLElement>('[data-prism-skeleton-exit]')!;
  expect(ghost).not.toBeNull(); expect(ghost.inert).toBe(true);
  expect(ghost.getAttribute('aria-hidden')).toBe('true');
  expect(ghost.querySelector('[id]')).toBeNull(); expect(ghost.hasAttribute('id')).toBe(false);
  expect(ghost.style.position).toBe('absolute'); expect(ghost.style.width).toBe('100px'); expect(ghost.style.opacity).toBe('0');
  await waitFor(() => expect(view.container.querySelector('[data-prism-skeleton-exit]')).toBeNull());
});

test('empty and animate=false skeletons leave no exit artifacts', async () => {
  const host = (visible: boolean, animate = true) => <ThemeScope animate={animate}><div className="prism-root" data-prism-presentation="">{visible && <StreamSkeleton />}</div></ThemeScope>;
  const view = render(host(true));
  await act(async () => { view.rerender(host(false)); });
  expect(view.container.querySelector('[data-prism-skeleton-exit]')).toBeNull();
  view.rerender(host(true, false));
  view.container.querySelector<HTMLElement>('[data-prism-skeleton]')!.getBoundingClientRect = () => ({ width: 100, height: 20, left: 0, top: 0 } as DOMRect);
  await act(async () => { view.rerender(host(false, false)); });
  expect(view.container.querySelector('[data-prism-skeleton-exit]')).toBeNull();
});

const fence = '```ui:preview\n';
const closeFence = '\n```';

test('the reply root follows the input stream without remounting completed prose', async () => {
  let controller!: ReadableStreamDefaultController<string>;
  const stream = new ReadableStream<string>({ start(value) { controller = value; } });
  const view = render(<Prism stream={stream} done />);
  const root = view.container.firstElementChild!;
  expect(root.getAttribute('data-state')).toBe('streaming');
  await act(async () => { controller.enqueue('Lead **with context**.\n\n'); });
  const prose = await view.findByText('with context');
  await act(async () => { controller.enqueue('Follow-up text'); controller.close(); });
  expect(root.getAttribute('data-state')).toBe('ready');
  expect(view.getByText('with context')).toBe(prose);
  expect(view.getByText('Follow-up text')).toBeDefined();
  view.rerender(<Prism unstyled source="More" done={false} />);
  expect(root.getAttribute('data-state')).toBe('streaming');
  expect(root.hasAttribute('data-prism-presentation')).toBe(false);
});

test('an open fence header leaves the existing prose in place until a directive is recognized', () => {
  const registry = createRegistry([
    { name: 'code', component: () => <pre>Code view</pre> },
    { name: 'preview', component: () => <p>Component view</p> },
  ]);
  const lead = 'Lead with context.\n\n';
  const view = render(<Prism registry={registry} source={lead} done={false} />);
  const prose = view.getByText('Lead with context.');
  for (let length = 1; length < fence.length; length++) {
    view.rerender(<Prism registry={registry} source={lead + fence.slice(0, length)} done={false} />);
    expect(view.getByText('Lead with context.')).toBe(prose);
    expect(view.container.firstElementChild?.children).toHaveLength(1);
  }
  view.rerender(<Prism registry={registry} source={lead + fence} done={false} />);
  expect(view.getByText('Component view')).toBeDefined();
});

test('custom code previews and complete blank code blocks remain renderable', () => {
  const opener = fence.slice(0, 3);
  const components = { code: () => <pre>Custom code preview</pre> };
  const view = render(<Prism source={opener} done={false} components={components} />);
  expect(view.getByText('Custom code preview')).toBeDefined();
  view.rerender(<Prism source={opener + closeFence} />);
  expect(view.container.querySelector('pre > code')).not.toBeNull();
});

test('an opt-in skeleton survives appended input and waits for final identity and hydration', async () => {
  let hydrate!: (value: object) => void;
  const store = createStore({ persist: { load: () => new Promise(resolve => { hydrate = resolve; }), save() {} } });
  let mounts = 0;
  const registry = createRegistry([{
    name: 'preview', requiresFinalId: true,
    skeleton: () => <StreamSkeleton data-testid="skeleton"><span data-prism-skeleton-line="" /></StreamSkeleton>,
    component({ id }: PrismComponentProps) {
      const presentation = usePresentation();
      const [value] = useComponentState('value', () => ++mounts);
      return <div {...presentation} data-testid="view">{id} / {value}</div>;
    },
  }]);
  const source = fence + '{"id":"result"}';
  const view = render(<Prism registry={registry} store={store} source={fence + '{"id":'} done={false} />);
  const skeleton = view.getByTestId('skeleton');
  expect(skeleton.getAttribute('aria-hidden')).toBe('true');
  view.rerender(<Prism registry={registry} store={store} source={source} done={false} />);
  expect(view.getByTestId('skeleton')).toBe(skeleton);
  view.rerender(<Prism registry={registry} store={store} source={source + closeFence} animate={false} />);
  expect(view.getByTestId('skeleton')).toBe(skeleton);
  expect(mounts).toBe(0);
  await act(async () => { hydrate({ result: { value: 5 } }); await store.ready; });
  expect(view.queryByTestId('skeleton')).toBeNull();
  expect(view.getByTestId('view').textContent).toBe('result / 5');
  expect(view.getByTestId('view').getAttribute('data-state')).toBe('ready');
  expect(view.getByTestId('view').hasAttribute('data-entering')).toBe(false);
});

test('a custom caret is decorative and unfinished directives expose their streaming state', () => {
  const registry = createRegistry([{
    name: 'preview',
    component() {
      const settled = useSettled(), presentation = usePresentation();
      return <span {...presentation} data-testid="view">Tail{!settled && <StreamCaret />}</span>;
    },
  }]);
  const view = render(<Prism registry={registry} source={fence + '{}'} done={false} />);
  const component = view.getByTestId('view');
  expect(component.getAttribute('data-state')).toBe('streaming');
  expect(component.hasAttribute('data-entering')).toBe(true);
  expect(component.querySelector('.prism-stream-caret')?.getAttribute('aria-hidden')).toBe('true');
  view.rerender(<Prism registry={registry} source={fence + '{}' + closeFence} />);
  expect(view.getByTestId('view')).toBe(component);
  expect(component.getAttribute('data-state')).toBe('ready');
  expect(component.querySelector('.prism-stream-caret')).toBeNull();
});

test('ending input with an unclosed directive releases its loading skeleton', () => {
  const registry = createRegistry([{
    name: 'preview',
    skeleton: () => <StreamSkeleton data-testid="skeleton" />,
    component: ({ complete }: PrismComponentProps) => <p {...usePresentation()}>{complete ? 'Complete' : 'Partial'}</p>,
  }]);
  const source = fence + '{}';
  const view = render(<Prism registry={registry} source={source} done={false} />);
  expect(view.getByTestId('skeleton')).toBeDefined();
  view.rerender(<Prism registry={registry} source={source} />);
  expect(view.queryByTestId('skeleton')).toBeNull();
  expect(view.getByText('Partial').getAttribute('data-state')).toBe('ready');
});

function ReceiptFrame({ children }: Pick<PrismComponentProps, 'children'>) {
  return <section {...usePresentation()}>{children}</section>;
}
function Controls() {
  const { sent, send, reset } = useSent();
  const emit = useEmit();
  return <ReceiptFrame>
    <button onClick={() => send('submit', 6, 'Six seats')}>{sent?.message ?? 'Submit'}</button>
    <button onClick={() => emit('ask')}>Ask</button>
    <button onClick={reset}>Edit</button>
  </ReceiptFrame>;
}

test('the primary control shares the final dispatched action with the frame and can be edited', () => {
  const registry = createRegistry([{ name: 'preview', component: Controls }]);
  let accept = false;
  const middleware: Middleware[] = [(action, next) => {
    if (action.type === 'submit' && accept) next({ ...action, message: 'Sent · 6 seats' });
  }];
  const onAction = (action: Action) => deliveries.push(action);
  const deliveries: Action[] = [];
  const source = '::preview{id="shared"}';
  const view = render(<><Prism registry={registry} source={source} middleware={middleware} onAction={onAction} />
    <Prism registry={registry} source={source} onAction={onAction} /></>);
  const [first, second] = Array.from(view.container.querySelectorAll('section'));
  fireEvent.click(within(first).getByText('Ask'));
  expect(first.getAttribute('data-state')).toBe('ready');
  const control = within(first).getByText('Submit');
  fireEvent.click(control);
  expect(first.getAttribute('data-state')).toBe('ready');
  expect(deliveries).toEqual([]);
  accept = true;
  fireEvent.click(control);
  expect(deliveries.map(action => action.message)).toEqual(['Sent · 6 seats']);
  expect(control.textContent).toBe('Sent · 6 seats');
  expect(first.getAttribute('data-state')).toBe('sent');
  expect(second.getAttribute('data-state')).toBe('ready');
  fireEvent.click(within(first).getByText('Edit'));
  expect(control.textContent).toBe('Submit');
  expect(first.getAttribute('data-state')).toBe('ready');
});

test('an older middleware delivery after editing or resending cannot replace the receipt', () => {
  const registry = createRegistry([{ name: 'preview', component: Controls }]);
  const pending: Array<() => void> = [];
  const middleware: Middleware[] = [(action, next) => {
    const message = `Sent ${pending.length + 1}`;
    pending.push(() => next({ ...action, message }));
  }];
  const deliveries: Action[] = [];
  const view = render(<Prism registry={registry} source="::preview" onAction={action => deliveries.push(action)} middleware={middleware} />);
  fireEvent.click(view.getByText('Submit'));
  fireEvent.click(view.getByText('Edit'));
  act(pending[0]!);
  expect(view.getByText('Submit')).toBeDefined();
  fireEvent.click(view.getByText('Submit'));
  fireEvent.click(view.getByText('Submit'));
  act(pending[2]!);
  act(pending[1]!);
  expect(view.getByText('Sent 3')).toBeDefined();
  expect(deliveries.map(action => action.message)).toEqual(['Sent 1', 'Sent 3', 'Sent 2']);
});

test('flash tracks a changed value, distinguishes write origin and clears after the highlight', async () => {
  function Value({ id }: PrismComponentProps) {
    const [value, set] = useComponentState('value', 1);
    const flash = useFlash(id + '.value');
    return <button data-flash={flash} onClick={() => set(value + 1)}>Value {value}</button>;
  }
  const store = createStore();
  function Driver() {
    const local = useLocalWrite();
    return <button onClick={() => local(() => store.set('summary.value', 3))}>Change elsewhere</button>;
  }
  const registry = createRegistry([{ name: 'value', component: Value }, { name: 'driver', component: Driver }]);
  const view = render(<Prism registry={registry} store={store} source={'::value{id="summary"}\n\n::driver'} />);
  const button = view.getByText('Value 1');
  expect(button.getAttribute('data-flash')).toBe('false');
  fireEvent.click(button);
  expect(button.getAttribute('data-flash')).toBe('false');
  fireEvent.click(view.getByText('Change elsewhere'));
  expect(button.getAttribute('data-flash')).toBe('true');
  expect(button.textContent).toBe('Value 3');
  await waitFor(() => expect(button.getAttribute('data-flash')).toBe('false'), { timeout: 1200 });
  act(() => store.apply({ merge: { summary: { value: 3, other: 1 } } }));
  expect(button.getAttribute('data-flash')).toBe('false');
  act(() => store.apply({ set: { 'summary.value': 8 } }));
  expect(button.getAttribute('data-flash')).toBe('true');
  expect(button.textContent).toBe('Value 8');
});
