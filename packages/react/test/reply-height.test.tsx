import './setup';
import { expect, mock, test } from 'bun:test';
import { act, render } from '@testing-library/react';
import { Prism, useSmoothHeight } from '../src';

test('reply height skips first/small measures, retargets the visual height and cleans up', () => {
  const original = globalThis.ResizeObserver;
  let resize!: () => void, size = 100, visual = 100;
  const disconnect = mock();
  globalThis.ResizeObserver = class { constructor(callback: () => void) { resize = callback; } observe() {} disconnect = disconnect; } as unknown as typeof ResizeObserver;
  function Reply({ enabled = true }) { return <section style={{ '--prism-motion-base': '350ms', '--prism-motion-ease': 'ease-in-out' } as React.CSSProperties}><div ref={useSmoothHeight(enabled)}>Reply</div></section>; }
  try {
    const view = render(<Reply />), root = view.container.firstElementChild as HTMLElement, content = root.firstElementChild!;
    root.getBoundingClientRect = () => ({ height: visual }) as DOMRect;
    content.getBoundingClientRect = () => ({ height: size }) as DOMRect;
    const animations: { cancel: ReturnType<typeof mock>; effect: { setKeyframes: ReturnType<typeof mock> }; onfinish?: () => void }[] = [];
    root.animate = mock(() => { const animation = { cancel: mock(), effect: { setKeyframes: mock() } }; animations.push(animation); return animation as unknown as Animation; });
    act(resize); expect(root.animate).not.toHaveBeenCalled();
    size = visual = 120; act(resize); expect(root.animate).not.toHaveBeenCalled();
    size = 300; act(resize);
    expect(root.animate).toHaveBeenLastCalledWith([{ height: '120px' }, { height: '300px' }], { duration: 350, easing: 'ease-in-out', fill: 'both' });
    expect(root.style.overflowY).toBe('clip'); expect(root.style.overflowX).toBe('visible');
    size = 320; act(resize);
    expect(animations[0].cancel).not.toHaveBeenCalled();
    expect(animations[0].effect.setKeyframes).toHaveBeenLastCalledWith([{ height: '140px' }, { height: '320px' }]);
    visual = 190; size = 400; act(resize);
    expect(animations[0].cancel).toHaveBeenCalled();
    expect(root.animate).toHaveBeenLastCalledWith([{ height: '190px' }, { height: '400px' }], { duration: 350, easing: 'ease-in-out', fill: 'both' });
    animations.at(-1)!.onfinish!();
    expect(root.style.height).toBe(''); expect(root.style.overflowY).toBe('');
    size = 500; act(resize);
    view.rerender(<Reply enabled={false} />);
    expect(animations.at(-1)!.cancel).toHaveBeenCalled();
    expect(disconnect).toHaveBeenCalled(); expect(root.style.overflowX).toBe('');
  } finally { globalThis.ResizeObserver = original; }
});

test('flow is a single stable box, history skips entry, and arrivals stagger per commit', () => {
  const history = render(<Prism source={'First\n\nSecond'} />);
  expect(history.container.querySelector('[data-prism-enter]:not([data-prism-entered])')).toBeNull();
  expect(history.container.querySelectorAll('[data-prism-entered]').length).toBeGreaterThan(0);
  history.unmount();
  const view = render(<Prism source="" done={false} />);
  const flow = view.container.querySelector('[data-prism-flow]')!;
  view.rerender(<Prism source={'First\n\nSecond\n\nThird'} done={false} />);
  expect(view.container.querySelector('[data-prism-flow]')).toBe(flow);
  expect(Array.from(flow.children).map(child => (child as HTMLElement).style.getPropertyValue('--prism-motion-index'))).toEqual(['0', '1', '2']);
  const first = flow.firstElementChild;
  view.rerender(<Prism source={'First\n\nSecond\n\nThird\n\nFourth'} done={false} />);
  expect(flow.firstElementChild).toBe(first);
  expect((flow.lastElementChild as HTMLElement).style.getPropertyValue('--prism-motion-index')).toBe('0');
});

test('height gracefully handles missing ResizeObserver and disabled motion', () => {
  const original = globalThis.ResizeObserver;
  globalThis.ResizeObserver = undefined as unknown as typeof ResizeObserver;
  try {
    const view = render(<Prism source="hello" done={false} />);
    const flow = view.container.querySelector('[data-prism-flow]'), paragraph = flow?.firstElementChild;
    expect(view.container.textContent).toBe('hello');
    view.rerender(<Prism source="hello" done={false} animate={false} />);
    expect(view.container.querySelector('[data-prism-flow]')).not.toBeNull();
    expect(view.container.querySelector('[data-prism-flow]')).toBe(flow);
    expect(flow?.firstElementChild).toBe(paragraph);
  } finally { globalThis.ResizeObserver = original; }
});
