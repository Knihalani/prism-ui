import '../../react/test/setup';
import { afterEach, expect, mock, test } from 'bun:test';
import { act, cleanup, render } from '@testing-library/react';
import { Prism, ThemeScope, createRegistry, useStoreValue } from '@prism-ui/react';
import { createStore } from '@prism-ui/state';
import { Odometer, Pill } from '../src/shared/controls';
import { useFlip } from '../src/lib/use-flip';

afterEach(cleanup);

test('estimate native checkboxes participate in token-driven shared press feedback', async () => {
  const css = await Bun.file(new URL('../src/styles/motion.css', import.meta.url)).text();
  const press = css.match(/[^{}]+:active:not\(:disabled\)\s*\{[^}]+\}/)?.[0];
  expect(press).toContain('.prism-estimate__checkbox:where(:not([role="switch"]))');
  expect(press).toContain('scale: var(--prism-motion-scale)');
  expect(press).toContain('transition-duration: var(--prism-motion-instant)');
  expect(css).toContain('border-color var(--prism-motion-fast) var(--prism-motion-ease), scale var(--prism-motion-spring-duration) var(--prism-motion-spring)');
});

test('summary and view checkboxes share fast fill, delayed draw and fade-only uncheck timing', async () => {
  const css = await Bun.file(new URL('../src/shared/controls.css', import.meta.url)).text();
  expect(css).toContain(':is(input.prism-check, .prism-summary__checkbox, .prism-listItem__root > input[type="checkbox"])::after');
  expect(css).toContain('transition: opacity var(--prism-motion-fast) var(--prism-motion-ease-exit)');
  expect(css).toContain('animation: prism-check-stroke var(--prism-motion-slow) var(--prism-motion-ease) var(--prism-motion-instant) both');
  expect(css).toContain('.prism-view__checkBox svg { opacity: 0; transition: opacity var(--prism-motion-fast) var(--prism-motion-ease-exit); }');
  expect(css).toContain('.prism-view__checkbox[data-checked] .prism-view__checkBox path { animation: prism-draw-check var(--prism-motion-slow) var(--prism-motion-ease) var(--prism-motion-instant) both; }');
  expect(css).toContain('transition: background-color var(--prism-motion-fast) var(--prism-motion-ease), border-color var(--prism-motion-fast) var(--prism-motion-ease)');
  expect(css).not.toContain('animation-direction: reverse');
});

test('odometer retargets the same decimal reels, including localized digits and signs', () => {
  const view = render(<Odometer value={12} />);
  const reels = Array.from(view.container.querySelectorAll<HTMLElement>('.prism-odometer__reel'));
  expect(reels).toHaveLength(2);
  expect(reels[1].style.transform).toBe('translateY(-20%)');
  view.rerender(<Odometer value={19} />);
  expect(view.container.querySelectorAll('.prism-odometer__reel')[1]).toBe(reels[1]);
  expect(reels[1].style.transform).toBe('translateY(-90%)');
  view.rerender(<Odometer value={-19.5} format={value => new Intl.NumberFormat('ar-EG').format(value)} />);
  expect(view.container.querySelector('.prism-odometer__label')?.textContent).toBe(new Intl.NumberFormat('ar-EG').format(-19.5));
  expect(view.container.querySelectorAll('.prism-odometer__reel')).toHaveLength(3);
});

test('empty, nonnumeric and disabled odometers have no rolling artifacts', () => {
  const view = render(<Odometer value={0} format={() => ''} />);
  expect(view.container.querySelectorAll('.prism-odometer__reel')).toHaveLength(0);
  view.rerender(<Odometer value={NaN} />);
  expect(view.container.querySelector('.prism-odometer__label')?.textContent).toBe('NaN');
  view.rerender(<ThemeScope animate={false}><Odometer value={42} /></ThemeScope>);
  expect(view.container.querySelectorAll('.prism-odometer__reel')).toHaveLength(0);
  expect(view.getByText('42')).toBeDefined();
});

test('receipt keeps both labels in one reserved slot while toggling accessible content', () => {
  const view = render(<Pill receipt="Sent">Send</Pill>);
  const button = view.getByRole('button'), ready = view.getByText('Send'), past = view.getByText('Sent');
  expect(ready.getAttribute('aria-hidden')).toBe('false');
  expect(past.getAttribute('aria-hidden')).toBe('true');
  view.rerender(<Pill receipt="Sent" sent>Send</Pill>);
  expect(view.getByText('Send')).toBe(ready); expect(view.getByText('Sent')).toBe(past);
  expect(button.hasAttribute('disabled')).toBe(true);
  expect(ready.getAttribute('aria-hidden')).toBe('true');
  expect(past.getAttribute('aria-hidden')).toBe('false');
});

test('store-driven FLIP waits for the React commit and snapshots visual items before cancelling an interrupted reorder', async () => {
  const store = createStore(); store.set('order', ['a', 'b']);
  function List() {
    const ref = useFlip(true), order = useStoreValue<string[]>('order') ?? [];
    return <div ref={ref}>{order.map(id => <div key={id} data-option={id}>{id}</div>)}</div>;
  }
  const registry = createRegistry([{ name: 'list', component: List }]);
  const view = render(<Prism registry={registry} store={store} source="::list" />);
  const items = Array.from(view.container.querySelectorAll<HTMLElement>('[data-option]'));
  expect(items).toHaveLength(2);
  const calls: string[] = [];
  let inFlight = false;
  for (const item of items) {
    item.getBoundingClientRect = () => {
      calls.push('measure');
      return { left: 0, top: Array.from(item.parentElement!.children).indexOf(item) * 100 + (inFlight ? 30 : 0) } as DOMRect;
    };
    item.animate = mock(() => ({ cancel() { calls.push('cancel'); inFlight = false; }, onfinish: null, oncancel: null }) as unknown as Animation);
  }
  await act(async () => {
    store.set('order', ['b', 'a']);
    await Promise.resolve();
  });
  expect(items[0].animate).toHaveBeenCalled();
  inFlight = true; calls.length = 0;
  act(() => store.set('order', ['a', 'b']));
  expect(calls.slice(0, 3)).toEqual(['measure', 'measure', 'cancel']);
});

test('component CSS timings use tokens and entry/rolling keyframes are absent', async () => {
  for await (const path of new Bun.Glob('**/*.css').scan(new URL('../src', import.meta.url).pathname)) {
    const css = await Bun.file(new URL(`../src/${path}`, import.meta.url)).text();
    expect(css).not.toMatch(/(?<![\w-])\d*\.?\d+m?s\b/);
    expect(css).not.toContain('cubic-bezier(');
    expect(css).not.toMatch(/@keyframes\s+prism-[\w-]*(?:-enter|-in|digit-out)\b/);
  }
});

test('disabled FLIP still guards existing items against CSS re-entry without animating', async () => {
  const store = createStore(); store.set('order', ['a', 'b']);
  function List() {
    const ref = useFlip(false), order = useStoreValue<string[]>('order') ?? [];
    return <div ref={ref}>{order.map(id => <div key={id} data-option={id}>{id}</div>)}</div>;
  }
  const registry = createRegistry([{ name: 'list', component: List }]);
  const view = render(<Prism registry={registry} store={store} source="::list" />);
  const items = Array.from(view.container.querySelectorAll<HTMLElement>('[data-option]'));
  for (const item of items) item.animate = mock();
  await act(async () => { store.set('order', ['b', 'a']); await Promise.resolve(); });
  for (const item of items) {
    expect(item.hasAttribute('data-prism-entered')).toBe(true);
    expect(item.animate).not.toHaveBeenCalled();
  }
});
