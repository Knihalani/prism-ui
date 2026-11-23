import '../../react/test/setup';
import { afterEach, expect, test } from 'bun:test';
import { createElement, forwardRef, useRef, type CSSProperties } from 'react';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { Prism, defineTheme, type Action } from '@prism-ui/react';
import { createStore } from '@prism-ui/state';
import { num, calc, type NumSlotProps, type CalcSlotProps } from '../src/num';
import { useNumberTween } from '../src/num/use-tween';

afterEach(cleanup);
const source = ':num[12]{id=n} and :calc[n*2]';
test('successive moves during one held drag update the value, readout and dependent calc before release', async () => {
  const store = createStore(), actions: Action[] = [];
  const view = render(<Prism source={':num[1200]{id=rent step=50 format=currency label="Monthly rent"} :calc[rent*12]{format=currency}'} store={store} locale="en-US" animate={false} onAction={action => actions.push(action)} />);
  const slider = view.getByRole('slider');
  expect(slider.getAttribute('aria-valuenow')).toBe('1200');
  fireEvent.pointerDown(slider, { button: 0, pointerId: 7, clientX: 100 });
  for (const [clientX, value, annual] of [[120, 1450, '$17,400.00'], [144, 1750, '$21,000.00']] as const) {
    fireEvent.pointerMove(slider, { pointerId: 7, clientX });
    await waitFor(() => expect(store.get('rent')).toBe(value));
    expect(slider.getAttribute('data-status')).toBe('scrubbing'); expect(slider.getAttribute('aria-valuenow')).toBe(String(value));
    expect(view.container.querySelector('[data-part="readout-value"]')?.textContent).toContain(value.toLocaleString('en-US', { style: 'currency', currency: 'USD' }));
    expect(view.container.querySelector('[data-readout-amount]')?.textContent).toBe(value.toLocaleString('en-US', { style: 'currency', currency: 'USD' }));
    expect(view.container.querySelector('[data-readout-label]')?.textContent).toBe('Monthly rent: ');
    expect(view.container.querySelector('[data-prism="calc"][data-part="value"]')?.textContent).toBe(annual);
    expect(actions).toHaveLength(0);
  }
  fireEvent.pointerUp(slider, { pointerId: 7, clientX: 144 });
  expect(actions).toHaveLength(1); expect(actions[0].payload).toEqual({ id: 'rent', value: 1750, previous: 1200 });
});
test('all declared Num/Calc parts accept slots in ready, edit, scrub, empty and error states', () => {
  const covered = { num: new Set<string>(), calc: new Set<string>() };
  for (const fixture of ['ready', 'hover', 'edit', 'scrub', 'empty', 'error']) {
    const content = fixture === 'empty' ? ':num[]{id=n} :calc[]{expr="n+"}' : fixture === 'error' ? ':num[12]{id=n} :calc[0/0]' : source;
    function mount(slots = {}) {
      const view = render(<Prism source={content} done={fixture !== 'empty'} animate={false} slots={slots} />);
      if (fixture === 'edit') fireEvent.click(view.getByRole('slider'));
      if (fixture === 'hover') fireEvent.pointerEnter(view.getByRole('slider'));
      if (fixture === 'scrub') { const slider = view.getByRole('slider'); fireEvent.pointerDown(slider, { button: 0, pointerId: 1, clientX: 10 }); fireEvent.pointerMove(slider, { pointerId: 1, clientX: 22 }); }
      return view;
    }
    const base = mount();
    const parts = Array.from(base.container.querySelectorAll('[data-prism="num"][data-part], [data-prism="calc"][data-part]')).map(node => ({ component: node.getAttribute('data-prism') as 'num' | 'calc', part: node.getAttribute('data-part')!, tag: node.tagName.toLowerCase() }));
    cleanup();
    for (const { component, part, tag } of parts) {
      expect((component === 'num' ? num : calc).parts).toContain(part);
      const Marker = forwardRef<any, any>(function Marker({ as, num: model, calc: formula, ...props }, ref) { expect(model ?? formula).toBeDefined(); return createElement(as ?? tag, { ...props, ref, 'data-replaced': `${component}.${part}` }); });
      const view = mount({ [component]: { [part]: Marker } });
      expect(view.container.querySelector(`[data-replaced="${component}.${part}"]`)).not.toBeNull();
      covered[component].add(part); cleanup();
    }
  }
  expect([...covered.num].sort()).toEqual([...num.parts!].sort());
  expect([...covered.calc].sort()).toEqual([...calc.parts!].sort());
});

test('translated strings, icons and typed model slots preserve editing, scrubbing, actions and formula updates', () => {
  let number: NumSlotProps['root'] | undefined, formula: CalcSlotProps['value'] | undefined;
  const Root = forwardRef<any, any>(function Root({ as, num: model, ...props }, ref) { number = { num: model }; return <span {...props} ref={ref} />; });
  function Value({ as, calc: model, ...props }: any) { formula = { calc: model }; return <span {...props} />; }
  const actions: Action[] = [], store = createStore();
  const theme = defineTheme({ name: 'num-translated', icons: { 'chevron-left': props => <svg {...props} data-custom-icon="" /> }, components: { num: { slots: { root: Root }, strings: { label: 'Nombre {id}', instructions: 'Pas {step}', valueLabel: '{value} unités', readoutLabel: '{value} — {label}', dragHint: 'Glisser doucement', changeMessage: '{label} devient {value}' } }, calc: { slots: { value: Value }, strings: { errorLabel: 'Indisponible', numberLabel: 'Résultat {value}', errorDescription: 'Expression {expression}' } } } });
  const view = render(<Prism source={source} theme={theme} store={store} animate={false} onAction={action => actions.push(action)} />);
  const slider = view.getByRole('slider', { name: 'Nombre n' });
  expect(slider.getAttribute('aria-description')).toBe('Pas 1'); expect(slider.getAttribute('aria-valuetext')).toBe('12 unités');
  expect(number?.num.value).toBe(12); expect(formula?.calc.result).toBe(24);
  fireEvent.keyDown(slider, { key: 'ArrowUp', shiftKey: true });
  expect(store.get('n')).toBe(22); expect(actions.at(-1)?.message).toBe('Nombre n devient 22'); expect(formula?.calc.result).toBe(44);
  expect(slider.hasAttribute('data-prism-flash')).toBe(false); expect(view.getByRole('math').hasAttribute('data-prism-flash')).toBe(true);
  fireEvent.click(slider); const input = view.getByRole('spinbutton', { name: 'Nombre n' });
  expect(input.parentElement?.hasAttribute('aria-valuenow')).toBe(false);
  fireEvent.change(input, { target: { value: '-500' } }); fireEvent.keyDown(input, { key: 'Enter' }); expect(store.get('n')).toBe(-500);
  expect(document.activeElement).toBe(view.getByRole('slider'));
  expect(view.getByText('Glisser doucement')).toBeDefined();
  const next = view.getByRole('slider'); fireEvent.pointerDown(next, { button: 0, pointerId: 3, clientX: 0 }); fireEvent.pointerMove(next, { pointerId: 3, clientX: 16 });
  expect(view.queryByText('Glisser doucement')).toBeNull(); expect(view.container.querySelector('[data-part="readout-value"]')?.textContent).toBe('-500 — Nombre n'); expect(view.container.querySelector('[data-custom-icon]')).not.toBeNull();
  fireEvent.pointerCancel(next, { pointerId: 3 }); expect(store.get('n')).toBe(-500);
  view.rerender(<Prism source=':calc[0/0]' theme={theme} animate={false} />); expect(view.getByText('Indisponible').getAttribute('title')).toBe('Expression 0/0');
});

test('flash follows every formula dependency, ignores unrelated values and expires', async () => {
  const store = createStore({ initial: { a: 2, b: 3, other: 0 } }); const view = render(<Prism source=':num[2]{id=a} :calc[a*b]' store={store} animate={false} />), output = view.getByRole('math');
  act(() => store.set('other', 1)); expect(output.hasAttribute('data-prism-flash')).toBe(false);
  act(() => store.set('b', 4)); expect(output.hasAttribute('data-prism-flash')).toBe(true); expect(output.textContent).toBe('8');
  await waitFor(() => expect(output.hasAttribute('data-prism-flash')).toBe(false), { timeout: 1200 });
  act(() => store.set('a', 5)); expect(output.hasAttribute('data-prism-flash')).toBe(true); expect(output.textContent).toBe('20'); expect(view.getByRole('slider').hasAttribute('data-prism-flash')).toBe(true);
});

test('calc uses the shared spring, CSS response and disabled and reduced motion guards', () => {
  const raf = globalThis.requestAnimationFrame, cancel = globalThis.cancelAnimationFrame, media = globalThis.matchMedia;
  let tick: FrameRequestCallback | undefined, cancelled = 0, reduced = false;
  globalThis.requestAnimationFrame = callback => { tick = callback; return 1; }; globalThis.cancelAnimationFrame = () => { cancelled++; };
  globalThis.matchMedia = query => ({ matches: reduced, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; } });
  function Fixture({ value, enabled = true }: { value: number; enabled?: boolean }) { const root = useRef<HTMLSpanElement>(null), shown = useNumberTween(value, enabled, root); return <span ref={root} style={{ '--prism-calc-motion-base': '100ms', '--prism-calc-motion-spring': 'linear' } as CSSProperties}>{shown}</span>; }
  try {
    const view = render(<Fixture value={0} />), before = performance.now(); view.rerender(<Fixture value={100} />);
    act(() => tick?.(before)); act(() => tick?.(before + 50)); expect(Number(view.container.textContent)).toBeGreaterThan(0); expect(Number(view.container.textContent)).toBeLessThan(101);
    for (let time = 66; time < 1000; time += 16) act(() => tick?.(before + time));
    expect(view.container.textContent).toBe('100');
    view.rerender(<Fixture value={200} enabled={false} />); expect(view.container.textContent).toBe('200'); expect(cancelled).toBeGreaterThan(0);
    reduced = true; view.unmount(); const reducedView = render(<Fixture value={300} />); reducedView.rerender(<Fixture value={400} />); expect(reducedView.container.textContent).toBe('400');
  } finally { globalThis.requestAnimationFrame = raf; globalThis.cancelAnimationFrame = cancel; if (media) globalThis.matchMedia = media; else Reflect.deleteProperty(globalThis, 'matchMedia'); }
});
