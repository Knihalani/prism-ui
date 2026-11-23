import './setup';
import { afterEach, expect, test } from 'bun:test';
import { act, cleanup, fireEvent, render, waitFor, within } from '@testing-library/react';
import { createRef, type CSSProperties, type ReactNode } from 'react';
import { createStore } from '@prism-ui/state';
import {
  createRegistry, Prism, PrismPart, StreamCaret, StreamSkeleton, ThemeScope, useComponentState, useEmit, useFlash,
  useLocalWrite, usePresentation, useSent, useSettled, type Action, type Middleware, type PrismComponentProps,
} from '../src';

afterEach(cleanup);

const skeletonHost = (children: ReactNode) => <div className="prism-root" data-prism-presentation="">{children}</div>;
const measured = (element: Element, width = 100, height = 20, left = 10, top = 30) => {
  element.getBoundingClientRect = () => ({ width, height, left, top } as DOMRect);
};

test.each(['skeleton', 'skeleton-line', 'stepPlaceholder'])('raw %s parts fade without changing their DOM or ref contract', async part => {
  const ref = createRef<HTMLElement>();
  const skeleton = <PrismPart as="i" ref={ref} data-part={part} id="raw" style={{ '--prism-motion-fast': '20ms' } as CSSProperties} />;
  const view = render(skeletonHost(skeleton)), element = view.container.querySelector('i')!;
  expect(ref.current).toBe(element); expect(element.parentElement?.children.length).toBe(1);
  measured(element);
  await act(async () => { view.rerender(skeletonHost(skeleton)); });
  expect(view.container.querySelector('i')).toBe(element);
  expect(view.container.querySelector('[data-prism-skeleton-exit]')).toBeNull();
  await act(async () => { view.rerender(skeletonHost(<p>Ready</p>)); });
  expect(ref.current).toBeNull();
  const ghost = view.container.querySelector<HTMLElement>('[data-prism-skeleton-exit]')!;
  expect(ghost.tagName).toBe('I'); expect(ghost.style.opacity).toBe('0'); expect(ghost.inert).toBe(true);
  expect(ghost.hasAttribute('id')).toBe(false);
  expect(ghost.style.getPropertyValue('--prism-motion-fast')).toBe('20ms');
  await waitFor(() => expect(ghost.isConnected).toBe(false));
});

test('removed parents preserve styled sibling skeletons in one inert snapshot', async () => {
  const view = render(skeletonHost(<section id="loading-panel" style={{ color: 'rebeccapurple' }}>
    {[0, 1].map(index => <PrismPart as="span" data-part="skeleton" key={index} id={`line-${index}`} style={{ '--prism-motion-fast': '20ms' } as CSSProperties} />)}
  </section>));
  measured(view.container.querySelector('section')!, 120, 60, 4, 20);
  view.container.querySelectorAll('span').forEach((span, index) => measured(span, 100, 20, 10, 30 + index * 20));
  const color = getComputedStyle(view.container.querySelector('span')!).color;
  await act(async () => { view.rerender(skeletonHost(<p>Ready</p>)); });
  const ghosts = view.container.querySelectorAll<HTMLElement>('[data-prism-skeleton-exit]');
  expect(ghosts.length).toBe(1);
  const ghost = ghosts[0];
  expect(ghost.tagName).toBe('SECTION'); expect(ghost.querySelectorAll('span').length).toBe(2);
  expect(ghost.style.width).toBe('120px'); expect(ghost.style.height).toBe('60px');
  expect(getComputedStyle(ghost.querySelector('span')!).color).toBe(color);
  expect(ghost.querySelector('[id]')).toBeNull(); expect(ghost.hasAttribute('id')).toBe(false);
  expect(ghost.style.getPropertyValue('--prism-motion-fast')).toBe('20ms');
  expect(ghost.inert).toBe(true); expect(ghost.style.opacity).toBe('0');
  await waitFor(() => expect(ghost.isConnected).toBe(false));
});

test('skeleton snapshots preserve computed declarations with quotes, semicolons and custom properties', async () => {
  const view = render(skeletonHost(<StreamSkeleton style={{ '--prism-motion-fast': '20ms' } as CSSProperties}>
    <span style={{ color: 'rebeccapurple', padding: '2px 4px', backgroundImage: 'url("data:image/svg+xml;a,b")', '--caption': '"one; two: three"', '--empty': '' } as CSSProperties}>Loading</span>
    <svg><rect style={{ fill: 'red', strokeWidth: '2px' }} /></svg>
  </StreamSkeleton>));
  measured(view.container.querySelector('[data-prism-skeleton]')!);
  const label = view.container.querySelector('span')!;
  label.style.setProperty('font', 'italic 14px serif', 'important');
  label.style.setProperty('padding', '2px 4px', 'important');
  const expected = ['span', 'rect'].map(selector => {
    const style = getComputedStyle(view.container.querySelector(selector)!);
    return Array.from({ length: style.length }, (_, index) => {
      const name = style.item(index); return [name, style.getPropertyValue(name)] as const;
    });
  });
  await act(async () => { view.rerender(skeletonHost(<p>Ready</p>)); });
  const ghost = view.container.querySelector('[data-prism-skeleton-exit]')!;
  ['span', 'rect'].forEach((selector, index) => {
    const style = getComputedStyle(ghost.querySelector(selector)!);
    for (const [name, value] of expected[index]) expect(style.getPropertyValue(name)).toBe(value);
  });
});

test('nested raw skeletons do not duplicate a StreamSkeleton exit', async () => {
  const view = render(skeletonHost(<StreamSkeleton><PrismPart as="i" data-part="skeleton-line" /></StreamSkeleton>));
  measured(view.container.querySelector('[data-prism-skeleton]')!);
  measured(view.container.querySelector('i')!);
  await act(async () => { view.rerender(skeletonHost(<p>Ready</p>)); });
  expect(view.container.querySelectorAll('[data-prism-skeleton-exit]').length).toBe(1);
});

test('cached ancestor templates keep siblings separate and expire after each flush', async () => {
  const children = (loading: boolean, value: string) => skeletonHost(<section style={{ '--snapshot': value } as CSSProperties}>
    {loading ? [0, 1].map(index => <PrismPart key={index} data-part="skeleton" data-test={index} />) : <p>Ready</p>}
  </section>);
  const view = render(children(true, 'first'));
  measured(view.container.querySelector('section')!, 120, 60);
  view.container.querySelectorAll('[data-part="skeleton"]').forEach(element => measured(element));
  await act(async () => { view.rerender(children(false, 'first')); });
  const first = Array.from(view.container.querySelectorAll<HTMLElement>('[data-prism-skeleton-exit]'));
  expect(first).toHaveLength(2); expect(first[0]).not.toBe(first[1]);
  first.forEach(ghost => ghost.remove());
  view.rerender(children(true, 'second'));
  measured(view.container.querySelector('section')!, 140, 60);
  view.container.querySelectorAll('[data-part="skeleton"]').forEach(element => measured(element));
  await act(async () => { view.rerender(skeletonHost(<p>Ready</p>)); });
  const ghost = view.container.querySelector<HTMLElement>('[data-prism-skeleton-exit]')!;
  expect(ghost.tagName).toBe('SECTION'); expect(ghost.style.width).toBe('140px');
  expect(ghost.style.getPropertyValue('--snapshot')).toBe('second');
  expect(ghost.querySelectorAll('[data-part="skeleton"]')).toHaveLength(2);
});

test('connected ancestor snapshots are read without styling discarded clones', async () => {
  const children = (loading: boolean, color: string) => skeletonHost(<section style={{ color, backgroundColor: 'skyblue' }}>
    {loading ? <PrismPart data-part="skeleton"><span>Loading</span></PrismPart> : <p>Ready</p>}
  </section>);
  const view = render(children(true, 'purple'));
  const section = view.container.querySelector('section')!, source = view.container.querySelector('[data-part="skeleton"]')!;
  measured(section, 200, 60); measured(source);
  const color = getComputedStyle(source).color, clone = section.cloneNode.bind(section);
  let writes = 0;
  section.cloneNode = (deep?: boolean) => {
    const snapshot = clone(deep) as HTMLElement, set = snapshot.style.setProperty.bind(snapshot.style);
    snapshot.style.setProperty = (...args) => { writes++; return set(...args); };
    return snapshot;
  };
  await act(async () => { view.rerender(children(false, 'green')); });
  const ghost = view.container.querySelector<HTMLElement>('[data-prism-skeleton-exit]')!;
  expect(writes).toBe(0);
  expect(ghost.parentElement).toBe(section);
  expect(getComputedStyle(ghost).color).toBe(color);
  expect(ghost.textContent).toBe('Loading');
});

test('a default-valued source declaration stays frozen when the ghost changes selector context', async () => {
  const sheet = document.createElement('style');
  sheet.textContent = '.exit-context > * { background-color: transparent } .exit-context > :last-child { background-color: red }';
  document.head.append(sheet);
  try {
    const content = (loading: boolean) => skeletonHost(<section className="exit-context">
      {loading && <StreamSkeleton>Loading</StreamSkeleton>}<p>Ready</p>
    </section>);
    const view = render(content(true)), source = view.container.querySelector('[data-prism-skeleton]')!;
    measured(source);
    const color = getComputedStyle(source).backgroundColor;
    await act(async () => { view.rerender(content(false)); });
    const ghost = view.container.querySelector('[data-prism-skeleton-exit]')!;
    expect(ghost).toBe(ghost.parentElement!.lastElementChild!);
    expect(getComputedStyle(ghost).backgroundColor).toBe(color);
  } finally { sheet.remove(); }
});

test('an exit keeps native form state independent of later mutations to the removed source', async () => {
  const view = render(skeletonHost(<StreamSkeleton><input defaultValue="initial" /></StreamSkeleton>));
  const source = view.container.querySelector('[data-prism-skeleton]')!, input = source.querySelector('input')!;
  measured(source); input.value = 'edited';
  await act(async () => { view.rerender(skeletonHost(<p>Ready</p>)); });
  const ghost = view.container.querySelector('[data-prism-skeleton-exit]')!;
  expect(ghost).not.toBe(source);
  expect(ghost.querySelector('input')!.value).toBe('edited');
  input.value = 'changed after removal'; source.replaceChildren(document.createTextNode('Later cleanup'));
  expect(ghost.querySelector('input')!.value).toBe('edited');
  expect(ghost.textContent).not.toContain('Later cleanup');
});

test('merged siblings restore only the branch that is attached to the existing exit', async () => {
  const view = render(skeletonHost(<section style={{ color: 'purple', backgroundColor: 'skyblue' }}>
    <PrismPart data-part="skeleton">A</PrismPart><PrismPart data-part="skeleton">B</PrismPart>
  </section>));
  const section = view.container.querySelector('section')!, clone = section.cloneNode.bind(section), writes: number[] = [];
  measured(section, 100, 60);
  section.querySelectorAll('[data-part="skeleton"]').forEach(element => measured(element));
  section.cloneNode = (deep?: boolean) => {
    const snapshot = clone(deep) as HTMLElement, shallow = snapshot.cloneNode.bind(snapshot);
    snapshot.cloneNode = (deep?: boolean) => {
      const ghost = shallow(deep) as HTMLElement, set = ghost.style.setProperty.bind(ghost.style), index = writes.push(0) - 1;
      ghost.style.setProperty = (...args) => { writes[index]++; return set(...args); };
      return ghost;
    };
    return snapshot;
  };
  await act(async () => { view.rerender(skeletonHost(<p>Ready</p>)); });
  expect(writes).toHaveLength(2);
  expect(writes[0]).toBeGreaterThan(0);
  expect(writes[1]).toBe(0);
  const ghosts = view.container.querySelectorAll('[data-prism-skeleton-exit]');
  expect(ghosts).toHaveLength(1);
  expect(ghosts[0].textContent).toBe('AB');
});

test('inherited values remain frozen at an exit root and explicit child styles survive', async () => {
  const view = render(skeletonHost(<div style={{ color: 'purple', fontSize: '18px', '--custom': 'one' } as CSSProperties}>
    <StreamSkeleton><span style={{ color: 'red', fontWeight: 700 }}>Loading</span><svg><rect style={{ fill: 'blue' }} /></svg></StreamSkeleton>
  </div>));
  measured(view.container.querySelector('[data-prism-skeleton]')!);
  const expected = ['span', 'rect'].map(selector => {
    const style = getComputedStyle(view.container.querySelector(selector)!);
    return { color: style.color, fontSize: style.fontSize, fill: style.fill, custom: style.getPropertyValue('--custom') };
  });
  await act(async () => { view.rerender(skeletonHost(<div style={{ color: 'green', fontSize: '24px', '--custom': 'two' } as CSSProperties}><p>Ready</p></div>)); });
  const ghost = view.container.querySelector('[data-prism-skeleton-exit]')!;
  ['span', 'rect'].forEach((selector, index) => {
    const style = getComputedStyle(ghost.querySelector(selector)!);
    expect({ color: style.color, fontSize: style.fontSize, fill: style.fill, custom: style.getPropertyValue('--custom') }).toEqual(expected[index]);
  });
});

test('SVG skeletons retain their viewport, namespace and ancestor transforms on exit', async () => {
  const view = render(skeletonHost(<svg viewBox="0 0 200 80"><g transform="translate(4 5)">
    <PrismPart as="rect" data-part="skeleton" id="chart-loading" x={10} y={20} width={100} height={20} />
  </g></svg>));
  measured(view.container.querySelector('svg')!, 200, 80);
  measured(view.container.querySelector('g')!);
  measured(view.container.querySelector('rect')!);
  await act(async () => { view.rerender(skeletonHost(<p>Ready</p>)); });
  const ghost = view.container.querySelector('[data-prism-skeleton-exit]')!;
  expect(ghost.tagName.toLowerCase()).toBe('svg'); expect(ghost.getAttribute('viewBox')).toBe('0 0 200 80');
  expect(ghost.querySelector('g')!.getAttribute('transform')).toBe('translate(4 5)');
  expect(ghost.querySelector('rect')!.namespaceURI).toBe('http://www.w3.org/2000/svg');
  expect(ghost.querySelector('rect')!.getAttribute('width')).toBe('100');
  expect(ghost.querySelector('[id]')).toBeNull(); expect(ghost.getAttribute('aria-hidden')).toBe('true');
});

test('zero-duration, detached-root and out-of-scope skeletons do not leave ghosts', async () => {
  const zero = <PrismPart as="div" data-part="skeleton" style={{ '--prism-motion-fast': '0ms' } as CSSProperties} />;
  const view = render(skeletonHost(zero));
  measured(view.container.querySelector('[data-part]')!);
  await act(async () => { view.rerender(skeletonHost(null)); });
  expect(view.container.querySelector('[data-prism-skeleton-exit]')).toBeNull();
  view.rerender(skeletonHost(<PrismPart data-part="skeleton" />));
  measured(view.container.querySelector('[data-part]')!);
  await act(async () => { view.unmount(); });
  expect(document.querySelector('[data-prism-skeleton-exit]')).toBeNull();
  const outside = render(<PrismPart data-part="skeleton" />);
  measured(outside.container.firstElementChild!);
  await act(async () => { outside.unmount(); });
  expect(document.querySelector('[data-prism-skeleton-exit]')).toBeNull();
});

test('SVG exits align to positioned, scaled hosts without relying on offsetParent', async () => {
  const view = render(skeletonHost(<svg><PrismPart as="rect" data-part="skeleton" width={100} height={20} /></svg>));
  const svg = view.container.querySelector('svg')!;
  measured(svg, 200, 80); measured(view.container.querySelector('rect')!);
  const prototype = Object.getPrototypeOf(svg), original = prototype.getBoundingClientRect;
  prototype.getBoundingClientRect = function(this: SVGSVGElement) {
    return { left: 40, top: 60, width: Number.parseFloat(this.style.width) / 2, height: Number.parseFloat(this.style.height) / 2 } as DOMRect;
  };
  try {
    await act(async () => { view.rerender(skeletonHost(<p>Ready</p>)); });
    const ghost = view.container.querySelector<SVGSVGElement>('[data-prism-skeleton-exit]')!;
    expect(ghost.style.left).toBe('-60px'); expect(ghost.style.top).toBe('-60px');
    expect(ghost.style.width).toBe('400px'); expect(ghost.style.height).toBe('160px');
  } finally { prototype.getBoundingClientRect = original; }
});

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
    expect(view.container.querySelector('[data-prism-flow]')?.children).toHaveLength(1);
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
