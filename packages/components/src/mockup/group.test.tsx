import '../../../react/test/setup';
import { afterEach, beforeEach, expect, test } from 'bun:test';
import { Prism, createRegistry, type Action, type PrismComponentProps } from '@prism-ui/react';
import { createStore } from '@prism-ui/state';
import { GroupedMockup, createFeedback, mockupDefinition, mockupPlugin, toMessage, type FrameController, type MockupProps } from './index';

const { render, cleanup, fireEvent, act, within } = await import('@testing-library/react');
const observer = globalThis.IntersectionObserver;
beforeEach(() => { Object.assign(globalThis, { IntersectionObserver: undefined }); });
afterEach(() => { cleanup(); Object.assign(globalThis, { IntersectionObserver: observer }); });
const plugins = [mockupPlugin];
const a = '```mockup:html {id=alpha group=plans title=Pricing}\n<h1>A</h1>\n```\n\n';
const b = '```mockup:html {id=beta group=plans title=Pricing}\n<h1>B';
function setup(source = a + b, done = false, store = createStore()) {
  const actions: Action[] = [], frames: { element?: HTMLIFrameElement; renders: string[]; destroyed: boolean }[] = [];
  const createController = (): FrameController => {
    const record: typeof frames[number] = { renders: [], destroyed: false }; frames.push(record);
    return { id: 'test', srcdoc: '', attach(element) { record.element = element; }, render(html) { record.renders.push(html); }, hit: async () => null, on() { return () => {}; }, setAnchors() {}, configure() {}, destroy() { record.destroyed = true; } };
  };
  function Test({ props }: PrismComponentProps<MockupProps>) { return <GroupedMockup props={props} options={{ createController }} />; }
  const registry = createRegistry([{ ...mockupDefinition, component: Test }]);
  const view = render(<Prism source={source} done={done} store={store} plugins={plugins} registry={registry} onAction={action => actions.push(action)} />);
  return { view, actions, frames, store, rerender(source: string, done = false) { view.rerender(<Prism source={source} done={done} store={store} plugins={plugins} registry={registry} onAction={action => actions.push(action)} />); },
    change(element: HTMLElement, value: string) { act(() => element.focus()); fireEvent.change(element, { target: { value } }); fireEvent.keyUp(element, { key: 'Unidentified' }); },
  };
}
function comment(canvas: HTMLElement, text: string, view: ReturnType<typeof render>) {
  fireEvent.keyDown(canvas, { key: 'Enter' });
  const area = view.getByRole('textbox', { name: 'Add a comment…' }); act(() => area.focus()); fireEvent.change(area, { target: { value: text } }); fireEvent.keyUp(area, { key: 'Unidentified' }); fireEvent.click(view.getByRole('button', { name: 'Save' }));
}
test('sent groups ignore duplicate submit shortcuts until explicitly edited', () => {
  const x = setup(a + b + '</h1>\n```', true);
  const tab = x.view.getByRole('tab', { name: 'A' });
  fireEvent.keyDown(tab, { key: 'Enter', ctrlKey: true });
  expect(x.actions).toHaveLength(0);
  comment(x.view.getByRole('application'), 'One reply only', x.view);
  fireEvent.keyDown(tab, { key: 'Enter', ctrlKey: true });
  expect(x.actions).toHaveLength(1);
  for (const modifier of ['ctrlKey', 'metaKey']) fireEvent.keyDown(tab, { key: 'Enter', [modifier]: true });
  expect(x.actions).toHaveLength(1);
  fireEvent.click(x.view.getByRole('button', { name: 'Edit feedback' }));
  fireEvent.keyDown(tab, { key: 'Enter', metaKey: true });
  expect(x.actions).toHaveLength(2);
});
for (const tool of ['Draw', 'Region']) for (const origin of ['tool', 'menu']) test(`group Escape ownership from ${origin} with ${tool} selected`, () => {
  const x = setup(a + b + '</h1>\n```', true);
  const button = x.view.getByRole('button', { name: tool });
  fireEvent.click(button); act(() => button.focus());
  let focused = button;
  if (origin === 'menu') {
    const trigger = x.view.getByRole('button', { name: 'More tools' });
    fireEvent.click(trigger); act(() => x.view.getByRole('button', { name: 'View source' }).focus());
    fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    expect(button.getAttribute('aria-pressed')).toBe('true');
    focused = trigger;
  }
  fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
  expect(x.view.getByRole('button', { name: 'Pin' }).getAttribute('aria-pressed')).toBe('true');
  expect(document.activeElement === focused).toBe(true);
  for (const [key, selected] of [['r', 'Region'], ['d', 'Draw'], ['p', 'Pin']]) {
    fireEvent.keyDown(document.activeElement!, { key });
    expect(x.view.getByRole('button', { name: selected }).getAttribute('aria-pressed')).toBe('true');
  }
  fireEvent.keyDown(document.activeElement!, { key: 'Escape' });
  expect(document.activeElement === focused).toBe(false);
});
test('sent group drawings release their hit region and regain it when edited', () => {
  const x = setup(a + b + '</h1>\n```', true);
  const canvas = x.view.getByRole('application');
  fireEvent.keyDown(canvas, { key: 'd' });
  fireEvent.pointerDown(canvas, { button: 0, pointerId: 1, clientX: 10, clientY: 10 });
  fireEvent.pointerMove(canvas, { pointerId: 1, clientX: 30, clientY: 20 });
  fireEvent.pointerUp(canvas, { pointerId: 1, clientX: 50, clientY: 30 });
  x.change(x.view.getByPlaceholderText('Add a comment…'), 'A drawing');
  fireEvent.click(x.view.getByRole('button', { name: 'Save' }));
  const path = x.view.container.querySelector('[data-part="canvas"] ~ [data-part="stroke"] [data-part="strokePath"]') as SVGElement;
  expect(path.getAttribute('style')?.replace(/\s/g, '')).toContain('pointer-events:fill');
  fireEvent.click(x.view.getByRole('button', { name: 'Send 1 comment' }));
  expect(path.closest('[data-part="stroke"]')?.hasAttribute('data-submitted')).toBe(true);
  expect(path.getAttribute('style')?.replace(/\s/g, '')).toContain('pointer-events:none');
  fireEvent.click(x.view.getByRole('button', { name: 'Edit feedback' }));
  expect(path.getAttribute('style')?.replace(/\s/g, '')).toContain('pointer-events:fill');
});
test('group Redo stays subscribed to the streaming feedback model after completion', () => {
  const x = setup();
  fireEvent.click(x.view.getByRole('tab', { name: 'B' }));
  comment(x.view.getByRole('application'), 'Streaming B edit', x.view);
  x.rerender(a + b + '</h1>\n```', true);
  fireEvent.click(x.view.getByRole('button', { name: 'Undo' }));
  expect((x.view.getByRole('button', { name: 'Redo' }) as HTMLButtonElement).disabled).toBe(false);
  fireEvent.click(x.view.getByRole('button', { name: 'Redo' }));
  expect(x.view.getByRole('button', { name: 'Comment 1: Streaming B edit' })).toBeDefined();
});
test('a grouped variant id change restores its destination draft instead of the old model', () => {
  const previous = createFeedback({ mockup: 'Pricing', variant: 'B', device: 'desktop' });
  previous.addPin({ x: 20, y: 30, comment: 'Saved destination' });
  const saved = previous.toJSON(), store = createStore({ initial: { gamma: { feedback: saved } } });
  const x = setup(a + b + '</h1>\n```', true, store);
  fireEvent.click(x.view.getByRole('tab', { name: 'B' }));
  comment(x.view.getByRole('application'), 'Old variant edit', x.view);
  x.rerender(a + b.replace('id=beta', 'id=gamma') + '</h1>\n```', true);
  expect(store.get('gamma.feedback')).toEqual(saved);
  expect(x.view.getByRole('button', { name: 'Comment 1: Saved destination' })).toBeDefined();
});
test('two streamed blocks form one switcher; tabs switch and compare shows both with one overall and submit', () => {
  const x = setup(); expect(x.view.getAllByRole('tablist')).toHaveLength(1); expect(x.view.getAllByRole('tab').map(el => el.textContent)).toEqual(['A', 'B', 'Compare']); expect(x.view.getByLabelText('Streaming')).toBeDefined(); expect(x.view.getAllByRole('application')).toHaveLength(1); expect(x.view.container.querySelectorAll('iframe')).toHaveLength(1);
  fireEvent.click(x.view.getByRole('tab', { name: 'B' })); expect(x.view.getByRole('tab', { name: 'B' }).getAttribute('aria-selected')).toBe('true'); expect(x.view.container.querySelectorAll('iframe')).toHaveLength(1);
  fireEvent.click(x.view.getByRole('tab', { name: 'Compare' })); expect(x.view.getAllByRole('application')).toHaveLength(2); expect(x.view.container.querySelectorAll('iframe')).toHaveLength(2); expect(x.view.getAllByRole('textbox', { name: 'Overall feedback' })).toHaveLength(1); expect(x.view.getAllByRole('button', { name: /^Send \d+ comments?$/ })).toHaveLength(1);
});
test('compare has one shared toolbar, propagates controls, and saves pending drafts on submit', () => {
  const x = setup(a + b + '</h1>\n```', true);
  fireEvent.click(x.view.getByRole('tab', { name: 'Compare' }));
  fireEvent.click(x.view.getByRole('button', { name: 'More tools' }));
  expect(x.view.getAllByRole('button', { name: 'Draw' })).toHaveLength(1);
  expect(x.view.getAllByRole('button', { name: 'Mobile' })).toHaveLength(1);
  fireEvent.click(x.view.getByRole('button', { name: 'Mobile' }));
  expect(Array.from(x.view.container.querySelectorAll('iframe')).map(frame => frame.style.width)).toEqual(['390px', '390px']);
  fireEvent.click(x.view.getByRole('button', { name: 'Zoom in' }));
  expect(Array.from(x.view.container.querySelectorAll('.prism-mockup__stage')).map(stage => (stage as HTMLElement).style.transform)).toEqual(['scale(1.25)', 'scale(1.25)']);
  if (x.view.getByRole('button', { name: 'More tools' }).getAttribute('aria-expanded') === 'false') fireEvent.click(x.view.getByRole('button', { name: 'More tools' }));
  fireEvent.click(x.view.getByRole('button', { name: 'Draw' }));
  expect(x.view.getByRole('button', { name: 'Draw' }).getAttribute('aria-pressed')).toBe('true');
  fireEvent.click(x.view.getByRole('button', { name: 'Prefer this B' }));
  expect(x.view.getByRole('button', { name: 'Prefer this B' }).querySelector('svg')).not.toBeNull();
  fireEvent.click(x.view.getByRole('button', { name: 'Prefer this B' }));
  fireEvent.keyDown(x.view.getAllByRole('application')[1], { key: 'Enter' });
  x.change(x.view.getByRole('textbox', { name: 'Add a comment…' }), 'Pending B draft');
  expect((x.view.getByRole('button', { name: /^Send \d+ comments?$/ }) as HTMLButtonElement).disabled).toBe(false);
  expect(x.view.getByText('1 comment')).toBeDefined();
  expect(x.view.getByRole('button', { name: 'Undo' }).querySelector('svg')).not.toBeNull();
  fireEvent.click(x.view.getByRole('button', { name: /^Send \d+ comments?$/ }));
  expect((x.actions[0].payload as any).variants).toEqual([{ variant: 'B', items: [{ n: 1, kind: 'region', x: 50, y: 50, w: 20, h: 20, comment: 'Pending B draft' }] }]);
  expect(x.view.getByRole('button', { name: 'Sent · 1 comment' })).toBeDefined();
});
test('group payload includes all commented variants, shared overall and preference exactly', () => {
  const x = setup(a + b + '</h1>\n```', true);
  expect((x.view.getByRole('button', { name: /^Send \d+ comments?$/ }) as HTMLButtonElement).disabled).toBe(true);
  comment(x.view.getByRole('application'), 'Bigger heading', x.view);
  fireEvent.click(x.view.getByRole('tab', { name: 'B' })); comment(x.view.getByRole('application'), 'Better spacing', x.view);
  x.change(x.view.getByRole('textbox', { name: 'Overall feedback' }), 'Both are promising');
  fireEvent.click(x.view.getByRole('tab', { name: 'Compare' })); fireEvent.click(x.view.getByRole('button', { name: 'Prefer this B' })); fireEvent.click(x.view.getByRole('button', { name: /^Send \d+ comments?$/ }));
  const itemsA = [{ n: 1, kind: 'pin' as const, x: 50, y: 50, comment: 'Bigger heading' }], itemsB = [{ n: 1, kind: 'pin' as const, x: 50, y: 50, comment: 'Better spacing' }];
  const payload = { mockup: 'Pricing', variant: 'B', device: 'desktop', overall: 'Both are promising', items: itemsB, variants: [{ variant: 'A', items: itemsA }, { variant: 'B', items: itemsB }], preferred: 'B' };
  expect(x.actions.map(({ type, payload, message }) => ({ type, payload, message }))).toEqual([{ type: 'feedback', payload, message: [toMessage({ mockup: 'Pricing', variant: 'A', device: 'desktop', overall: '', items: itemsA }), toMessage({ mockup: 'Pricing', variant: 'B', device: 'desktop', overall: payload.overall, items: itemsB }), 'Preferred: B'].join('\n\n') }]);
  fireEvent.click(x.view.getByText('Edit feedback')); fireEvent.click(x.view.getByRole('tab', { name: 'B' })); fireEvent.click(x.view.getByRole('button', { name: /^Send \d+ comments?$/ })); expect((x.actions[1].payload as any).variant).toBe('B'); expect((x.actions[1].payload as any).items).toEqual(itemsB);
});
test('roving tabs support arrows, Home and End and persist selection', () => {
  const x = setup(); const first = x.view.getByRole('tab', { name: 'A' }); act(() => first.focus()); fireEvent.keyDown(first, { key: 'ArrowRight' }); const second = x.view.getByRole('tab', { name: 'B' }); expect(document.activeElement).toBe(second); expect(second.tabIndex).toBe(0); expect(first.tabIndex).toBe(-1); expect(x.store.get('alpha.groupTab')).toBe('1');
  fireEvent.keyDown(second, { key: 'End' }); const compare = x.view.getByRole('tab', { name: 'Compare' }); expect(document.activeElement).toBe(compare); fireEvent.keyDown(compare, { key: 'Home' }); expect(document.activeElement).toBe(first);
});
test('B arriving and streaming does not remount A frame, while inactive variants have no iframe', () => {
  const x = setup(a); const element = x.view.container.querySelector('iframe')!, record = x.frames.find(frame => frame.element === element)!; expect(record).toBeDefined();
  x.rerender(a + b); expect(x.view.container.querySelector('iframe')).toBe(element); expect(record.destroyed).toBe(false); expect(x.frames.filter(frame => !frame.destroyed)).toHaveLength(1);
  x.rerender(a + b + '</h1>\n```', true); expect(x.view.container.querySelector('iframe')).toBe(element); expect(record.destroyed).toBe(false);
  fireEvent.click(x.view.getByRole('tab', { name: 'Compare' })); expect(x.view.container.querySelectorAll('iframe')[0]).toBe(element); expect(x.frames.filter(frame => !frame.destroyed)).toHaveLength(2);
});
test('nonconsecutive blocks and separate stores do not combine; empty group payload omits preference', () => {
  const x = setup(a + 'A separating paragraph.\n\n' + b); expect(x.view.getAllByRole('tablist')).toHaveLength(2); x.view.unmount();
  const y = setup(a), z = setup(a); expect(y.view.container.querySelectorAll('[role=tablist]')).toHaveLength(1); expect(z.view.container.querySelectorAll('[role=tablist]')).toHaveLength(1);
  y.change(within(y.view.container).getByRole('textbox', { name: 'Overall feedback' }), 'Only overall'); fireEvent.click(within(y.view.container).getByRole('button', { name: /^Send \d+ comments?$/ })); expect(y.actions[0].payload).toEqual({ mockup: 'Pricing', variant: 'A', device: 'desktop', overall: 'Only overall', items: [], variants: [] });
});
