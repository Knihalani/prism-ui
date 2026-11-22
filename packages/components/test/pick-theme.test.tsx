import '../../react/test/setup';
import { afterEach, expect, test } from 'bun:test';
import { createElement, forwardRef, type CSSProperties, type HTMLAttributes } from 'react';
import { act, cleanup, fireEvent, render, within } from '@testing-library/react';
import { Prism, defineTheme, type Action } from '@prism-ui/react';
import { createStore } from '@prism-ui/state';
import { pick, type PickSlotProps } from '../src/pick';
import { interpolate } from '../src/interpolate';
import { useFlip } from '../src/pick/flip';

afterEach(cleanup);

const options = [{ id: 'basic', title: 'Basic', subtitle: 'Small teams', tag: 'Value', scores: { price: .9 }, pros: ['Low cost'], cons: ['Fewer features'] }, { id: 'plus', title: 'Plus', scores: { price: .5 } }];
const source = (props: object = {}) => '```ui:pick\n' + JSON.stringify({ id: 'plans', criteria: [{ id: 'price', label: 'Price' }], options, ...props }) + '\n```';

test('every declared Pick part is replaceable in populated, sent, empty and streaming states', () => {
  const covered = new Set<string>();
  const fixtures = [source(), source({ options: [], criteria: [] }), source({ options: [{ id: 'pending', title: 'Pending' }] }).slice(0, -4)];
  fixtures.forEach((content, index) => {
    function mount(slots = {}) {
      const view = render(<Prism source={content} done={index !== 2} animate={false} slots={{ pick: slots }} />);
      if (index === 0) fireEvent.click(view.getAllByRole('button', { name: 'Choose' })[0]);
      return view;
    }
    const base = mount();
    const tags = new Map(Array.from(base.container.querySelectorAll('[data-prism="pick"][data-part]')).map(node => [node.getAttribute('data-part')!, node.tagName.toLowerCase()]));
    for (const part of tags.keys()) expect(pick.parts).toContain(part);
    for (const element of Array.from(base.container.querySelectorAll('[data-prism="pick"][data-part="root"] *'))) {
      if (!['path'].includes(element.tagName.toLowerCase())) expect(element.getAttribute('data-prism')).toBe('pick');
    }
    cleanup();
    for (const [part, tag] of tags) {
      const Marker = forwardRef<any, any>(function Marker({ as, pick: model, option, row, weight, criterion, level, on, children, ...props }, ref) {
        expect(model.rows).toBeDefined();
        return createElement(as ?? tag, { ...props, ref, 'data-replaced': part }, children);
      });
      const view = mount({ [part]: Marker });
      expect(view.container.querySelector(`[data-replaced="${part}"]`), part).not.toBeNull();
      covered.add(part); cleanup();
    }
  });
  expect([...covered].sort()).toEqual([...pick.parts!].sort());
});

test('theme strings cover computed labels, announcements, fallback, messages and receipts; slots retain actions', () => {
  const actions: Action[] = [], store = createStore();
  let received: PickSlotProps['item'] | undefined;
  const Item = forwardRef<HTMLElement, PickSlotProps['item'] & HTMLAttributes<HTMLElement> & { as?: unknown }>(function Item({ as, pick: model, option, row, ...props }, ref) {
    received = { pick: model, option, row };
    return <article {...props} ref={ref} data-custom-item="" />;
  });
  const theme = defineTheme({ name: 'pick-localized', icons: { check: props => <svg {...props} data-check="custom" />, minus: props => <svg {...props} data-minus="custom" /> }, components: { pick: { slots: { item: Item }, strings: {
    question: 'Choisissez', choose: 'Confirmer', bestLabel: 'Fort en', reason: '{criteria} — {best}', topLabel: 'Premier',
    weightDescription: '{criterion} : {weight}/{max}', announcement: '{title} gagne ({label})', rank: 'Rang {rank}',
    match: '{label} : {match}', matchLabel: 'Compatibilité', chosenLabel: 'Choisi', sentLabel: 'Envoyé',
    askLabel: 'Question', askMessage: 'Parlons des options.', undoLabel: 'Annuler', chooseMessage: '{title} confirmé',
    emptyLabel: 'Aucune option', loadingLabel: 'En cours',
  } } } });
  const view = render(<Prism source={source({ question: 'Prop question', choose: 'Prop choose' })} store={store} theme={theme} animate={false} locale="en-US" onAction={action => actions.push(action)} />);
  expect(view.getByRole('group', { name: 'Choisissez' })).toBeDefined();
  expect(view.getByText('Price — Fort en')).toBeDefined();
  expect(view.getByText('Rang 1')).toBeDefined();
  expect(view.getByText('Compatibilité : 90%')).toBeDefined();
  expect(view.container.querySelector('[data-part="live"]')?.textContent).toBe('Basic gagne (Premier)');
  expect(received?.option.id).toBe('plus');
  expect(received?.pick.rows[0].id).toBe('basic');
  expect(view.container.querySelector('[data-minus="custom"]')).not.toBeNull();
  fireEvent.click(view.getByRole('button', { name: 'Question' }));
  expect(actions.at(-1)?.message).toBe('Parlons des options.');
  const basic = view.container.querySelector('[data-option="basic"]') as HTMLElement;
  fireEvent.click(within(basic).getByRole('button', { name: 'Confirmer' }));
  expect(actions.at(-1)?.message).toBe('Basic confirmé');
  expect(actions.at(-1)?.payload).toEqual({ option: 'basic', weights: { price: 1 } });
  expect(view.container.querySelector('[data-part="root"]')?.getAttribute('data-state')).toBe('sent');
  expect(view.getByRole('button', { name: 'Envoyé' }).hasAttribute('disabled')).toBe(true);
  expect(view.getByRole('button', { name: 'Envoyé' }).querySelector('[data-check="custom"]')).not.toBeNull();
  fireEvent.click(view.getByRole('button', { name: 'Price : 1/3' }));
  expect(view.container.querySelector('[data-part="root"]')?.getAttribute('data-state')).toBe('ready');
  expect(within(basic).getByRole('button', { name: 'Confirmer' }).hasAttribute('disabled')).toBe(false);
  fireEvent.click(within(basic).getByRole('button', { name: 'Confirmer' }));
  act(() => store.set('plans.weights.price', 3));
  expect(view.container.querySelector('[data-part="root"]')?.getAttribute('data-state')).toBe('ready');
  expect(basic.hasAttribute('data-flash')).toBe(true);
  view.rerender(<Prism source={source({ options: [], criteria: [] })} theme={theme} animate={false} />);
  expect(view.getByText('Aucune option')).toBeDefined();
  view.rerender(<Prism source={source({ options: [{ id: 'pending', title: 'Pending' }] }).slice(0, -4)} done={false} theme={theme} animate={false} />);
  expect(view.getAllByText('En cours').length).toBeGreaterThan(0);
  expect(view.container.querySelector('[data-part="root"]')?.getAttribute('data-state')).toBe('streaming');
});

test('slot models document criteria and weights, explicit slots beat theme slots, and props beat defaults', () => {
  let criterion: PickSlotProps['bar'] | undefined, weight: PickSlotProps['chip'] | undefined;
  const Bar = ({ as, pick: model, option, row, criterion: value, ...props }: any) => { criterion = { pick: model, option, row, criterion: value }; return <meter {...props} />; };
  const Chip = forwardRef<HTMLButtonElement, any>(function Chip({ as, pick: model, weight: value, children, ...props }, ref) { weight = { pick: model, weight: value }; return <button {...props} ref={ref}>{children}</button>; });
  const theme = defineTheme({ name: 'pick-slot-priority', components: { pick: { slots: { empty: () => <div data-theme-empty="" /> } } } });
  const view = render(<Prism source={source({ question: 'Prop question', choose: 'Use plan' })} theme={theme} animate={false} slots={{ pick: { chip: Chip, bar: Bar } }} />);
  expect(view.getByRole('group', { name: 'Prop question' })).toBeDefined();
  expect(view.getAllByRole('button', { name: 'Use plan' })).toHaveLength(2);
  expect(criterion?.criterion.id).toBe('price'); expect(criterion?.option.id).toBe('plus');
  expect(weight?.weight.weight).toBe(1);
  fireEvent.keyDown(view.getByRole('button', { name: 'Price, weight 1 of 3' }), { key: 'ArrowUp' });
  expect(weight?.weight.weight).toBe(2);
  view.rerender(<Prism source={source({ options: [] })} theme={theme} animate={false} slots={{ pick: { empty: ({ as, pick: model, ...props }: any) => <div {...props} data-explicit-empty="" /> } }} />);
  expect(view.container.querySelector('[data-explicit-empty]')).not.toBeNull();
  expect(view.container.querySelector('[data-theme-empty]')).toBeNull();
});

test('invalid scores stay disabled, local edits do not flash, and interpolation preserves empty/unknown placeholders', () => {
  expect(interpolate('{a}/{b}/{missing}/{toString}', { a: '', b: 0 })).toBe('/0/{missing}/{toString}');
  const view = render(<Prism source={source({ options: [{ id: 'bad', title: 'Bad', scores: 'invalid' }] })} animate={false} />);
  expect(view.getByRole('button', { name: 'Choose' }).hasAttribute('disabled')).toBe(true);
  fireEvent.click(view.getByRole('button', { name: 'Price, weight 1 of 3' }));
  expect(view.container.querySelector('[data-flash]')).toBeNull();
});

test('generic frame slots remain fallbacks and component slots take priority', () => {
  function FrameRoot({ as, ...props }: any) { return <section {...props} data-frame-root="" />; }
  function PickRoot({ as, pick: model, ...props }: any) { expect(model.rows).toHaveLength(2); return <section {...props} data-pick-root="" />; }
  const view = render(<Prism source={source()} animate={false} slots={{ frame: { root: FrameRoot } }} />);
  expect(view.container.querySelector('[data-frame-root]')).not.toBeNull();
  view.rerender(<Prism source={source()} animate={false} slots={{ frame: { root: FrameRoot }, pick: { root: PickRoot } }} />);
  expect(view.container.querySelector('[data-frame-root]')).toBeNull();
  expect(view.container.querySelector('[data-pick-root]')).not.toBeNull();
});

test('compact option disclosures retain actions, keyboard focus and streaming/empty states', () => {
  const actions: Action[] = [];
  const compact = defineTheme({ name: 'pick-compact', components: { pick: { styles: { list: { '--prism-pick-compact': '1' } as CSSProperties } } } });
  const view = render(<Prism source={source()} theme={compact} animate={false} onAction={action => actions.push(action)} />);
  const winner = view.container.querySelector('[data-option="basic"]')!, other = view.container.querySelector('[data-option="plus"]')!;
  expect(within(other as HTMLElement).getByRole('heading', { name: 'Plus', level: 4 })).toBeDefined();
  const details = other.querySelector('[data-part="details"]')!, summary = other.querySelector('[data-part="summary"]')!;
  expect(winner.querySelector('[data-part="details"]')?.hasAttribute('hidden')).toBe(false);
  expect(summary.getAttribute('aria-expanded')).toBe('false');
  expect(summary.getAttribute('aria-controls')).toBe(details.id);
  expect(details.hasAttribute('hidden')).toBe(true);
  fireEvent.click(summary);
  expect(summary.getAttribute('aria-expanded')).toBe('true');
  expect(details.hasAttribute('hidden')).toBe(false);
  fireEvent.click(summary);
  expect(summary.getAttribute('aria-expanded')).toBe('false');
  const choose = within(other as HTMLElement).getByRole('button', { name: 'Choose' });
  fireEvent.focus(choose);
  expect(summary.getAttribute('aria-expanded')).toBe('true');
  fireEvent.click(choose);
  expect(actions.at(-1)?.payload).toEqual({ option: 'plus', weights: { price: 1 } });
  expect(within(other as HTMLElement).getByRole('button', { name: 'Sent' }).hasAttribute('data-sent')).toBe(true);
  expect(view.container.querySelector('[data-part="root"]')?.getAttribute('data-state')).toBe('sent');
  fireEvent.click(view.getByRole('button', { name: 'Price, weight 1 of 3' }));
  expect(view.container.querySelector('[data-part="root"]')?.getAttribute('data-state')).toBe('ready');
  view.rerender(<Prism source={source({ options: [{ id: 'bad', title: 'Bad', scores: 'invalid' }] })} theme={compact} animate={false} />);
  expect(view.getByRole('button', { name: 'Choose' }).hasAttribute('disabled')).toBe(true);
  fireEvent.click(view.container.querySelector('[data-part="summary"]')!);
  expect(view.container.querySelector('[data-part="details"]')?.hasAttribute('hidden')).toBe(false);
  view.rerender(<Prism source={source({ options: [] })} theme={compact} animate={false} />);
  expect(view.getByText('Options will appear here')).toBeDefined();
});

test('Pick reorder reads motion tokens, cancels animations and respects disabled/reduced motion', () => {
  const originalRect = HTMLElement.prototype.getBoundingClientRect, originalAnimate = HTMLElement.prototype.animate, originalMedia = globalThis.matchMedia;
  const calls: KeyframeAnimationOptions[] = [];
  let cancelled = 0;
  HTMLElement.prototype.getBoundingClientRect = function () { return this.dataset.option ? new DOMRect(0, Array.from(this.parentElement!.children).indexOf(this) * 40, 100, 40) : originalRect.call(this); };
  HTMLElement.prototype.animate = function (_frames, options) { calls.push(options as KeyframeAnimationOptions); return { cancel() { cancelled++; } } as Animation; };
  function Fixture({ reversed, enabled = true }: { reversed: boolean; enabled?: boolean }) {
    const ref = useFlip(enabled);
    return <div ref={ref} style={{ '--prism-motion-base': '.1s', '--prism-motion-spring': 'linear' } as CSSProperties}>{(reversed ? ['b', 'a'] : ['a', 'b']).map(id => <div key={id} data-option={id} />)}</div>;
  }
  try {
    let reduced = false;
    globalThis.matchMedia = query => ({ matches: reduced, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return true; } });
    const view = render(<Fixture reversed={false} />);
    view.rerender(<Fixture reversed />);
    expect(calls).toHaveLength(2); expect(calls[0]).toEqual({ duration: 100, easing: 'linear' });
    view.rerender(<Fixture reversed={false} enabled={false} />);
    expect(cancelled).toBe(2); expect(calls).toHaveLength(2);
    reduced = true;
    view.rerender(<Fixture reversed />);
    expect(calls).toHaveLength(2);
    view.unmount();
  } finally {
    HTMLElement.prototype.getBoundingClientRect = originalRect; HTMLElement.prototype.animate = originalAnimate;
    if (originalMedia) globalThis.matchMedia = originalMedia; else Reflect.deleteProperty(globalThis, 'matchMedia');
  }
});
