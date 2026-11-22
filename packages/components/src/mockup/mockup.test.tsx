import '../../../react/test/setup';
import { afterEach, beforeEach, expect, test } from 'bun:test';
import { Prism, createRegistry, usePrism, type Action, type PrismComponentProps } from '@prism-ui/react';
import { createStore } from '@prism-ui/state';
import { MockupView, mockupDefinition, mockupPlugin, parseMockupMeta, useMockup, toMessage, type FrameController, type MockupProps } from './index';

const { render, cleanup, fireEvent, act } = await import('@testing-library/react');
const observer = globalThis.IntersectionObserver;
beforeEach(() => { Object.assign(globalThis, { IntersectionObserver: undefined }); });
afterEach(() => { cleanup(); Object.assign(globalThis, { IntersectionObserver: observer }); });
const source = (props: MockupProps) => '```ui:mockup\n' + JSON.stringify({ id: 'review', ...props }) + '\n```';
function setup(props: MockupProps = {}, done = true, store = createStore()) {
  const renders: [string, boolean | undefined][] = [], actions: Action[] = [];
  const target = { selector: 'h1', text: 'Hello', html: '<h1>Hello</h1>', box: { x: 0, y: 0, w: 100, h: 40 } };
  const factory = (): FrameController => ({ id: 'stub', srcdoc: '', attach() {}, render(html, complete) { renders.push([html, complete]); }, hit: async rect => ({ target, box: { ...rect, w: rect.w ?? 0, h: rect.h ?? 0 } }), setAnchors() {}, configure() {}, on() { return () => {}; }, destroy() {} });
  function Test({ props }: PrismComponentProps<MockupProps>) { return <MockupView vm={useMockup(props, usePrism(), { createController: factory })} />; }
  const registry = createRegistry([{ ...mockupDefinition, component: Test }]);
  const view = render(<Prism source={source(props)} done={done} registry={registry} store={store} onAction={a => actions.push(a)} />);
  const canvas = () => { const element = view.getByRole('application'); element.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, right: 1000, bottom: 500, width: 1000, height: 500, toJSON() {} }); return element; };
  const pointer = (type: string, x: number, y: number) => fireEvent(canvas(), new window.PointerEvent(type, { bubbles: true, button: 0, clientX: x, clientY: y, pointerId: 1 }));
  function change(element: HTMLElement, value: string) { act(() => element.focus()); fireEvent.change(element, { target: { value } }); fireEvent.keyUp(element, { key: 'Unidentified' }); }
  return { view, actions, store, renders, target, canvas, pointer, change, rerender(props: MockupProps, done = true) { view.rerender(<Prism source={source(props)} done={done} registry={registry} store={store} onAction={a => actions.push(a)} />); } };
}
test('plugin preserves identity, completion and parses safe attributes without registering code', () => {
  const node = { type: 'code', key: 'x', lang: 'mockup:html', meta: '{title="Pricing plans" device=mobile variant="A" group=g1 id=p flag}', value: '<h1>Pricing</h1>', complete: false };
  expect(mockupPlugin.transform!(node)).toEqual({ type: 'component', key: 'x', name: 'mockup', props: { title: 'Pricing plans', device: 'mobile', variant: 'A', group: 'g1', id: 'p', flag: true, kind: 'html', source: node.value }, children: [], complete: false });
  expect(mockupPlugin.transform!({ ...node, lang: 'html' })).toEqual({ ...node, lang: 'html' });
  expect(parseMockupMeta()).toEqual({}); expect(Object.keys(parseMockupMeta('__proto__=bad constructor=no title=ok'))).toEqual(['title']);
});
test('popover stays within the content box near its lower right edge', () => {
  const x = setup({ source: '<h1>Hello</h1>' });
  x.pointer('pointerdown', 980, 490); x.pointer('pointerup', 980, 490);
  const popover = x.view.getByRole('dialog');
  expect(popover.style.width).toBe('320px');
  expect(parseFloat(popover.style.left) + parseFloat(popover.style.width)).toBeLessThanOrEqual(1280);
  expect(parseFloat(popover.style.top) + 180).toBeLessThanOrEqual(400);
});
test('all four source kinds render, SVG is sanitised, unsafe image URLs are refused', () => {
  const a = setup({ kind: 'html', source: '<h1>Hello</h1>' }); expect(a.renders.at(-1)).toEqual(['<h1>Hello</h1>', true]); a.view.unmount();
  const b = setup({ kind: 'wire', source: 'hero: # Hello / Welcome / [Start]' }); expect(b.renders.at(-1)![0]).toContain('Hello'); b.view.unmount();
  const c = setup({ kind: 'svg', source: '<svg viewBox="0 0 100 50"><script>alert(1)</script><circle r="4"/></svg>' }); expect(c.view.container.querySelector('circle')).not.toBeNull(); expect(c.view.container.querySelector('script')).toBeNull(); expect(c.view.container.querySelector('iframe')).toBeNull(); c.view.unmount();
  const d = setup({ kind: 'image', src: 'https://example.com/a.png' }); expect(d.view.getByRole('img').getAttribute('decoding')).toBe('async'); d.rerender({ kind: 'image', src: 'javascript:alert(1)' }); expect(d.view.queryByRole('img')).toBeNull();
});
test('streaming grows source without replacing controller; empty and partial SVG do not crash', () => {
  const a = setup({ source: '<h1>He' }, false); expect(a.renders.at(-1)).toEqual(['<h1>He', false]); a.rerender({ source: '<h1>Hello</h1>' }, false); expect(a.renders.at(-1)).toEqual(['<h1>Hello</h1>', false]); a.rerender({ source: '<h1>Hello</h1>' }); expect(a.renders.at(-1)).toEqual(['<h1>Hello</h1>', true]); a.view.unmount();
  const b = setup({ kind: 'svg', source: '' }, false); b.rerender({ kind: 'svg', source: '<svg><circle r="4"/><path d="' }, false); expect(b.view.container.querySelector('circle')).not.toBeNull();
});
test('pin target, comment and overall submit an exact payload and message; edit resubmits', async () => {
  const a = setup({ title: 'Pricing', variant: 'A' }); expect((a.view.getByText('Submit feedback') as HTMLButtonElement).disabled).toBe(true);
  await act(async () => { a.pointer('pointerdown', 250, 100); a.pointer('pointerup', 250, 100); });
  a.change(a.view.getByRole('textbox', { name: 'Add a comment…' }), 'Make it bigger'); fireEvent.click(a.view.getByText('Save'));
  a.change(a.view.getByRole('textbox', { name: 'Overall feedback' }), 'Looks good'); fireEvent.click(a.view.getByText('Submit feedback'));
  const payload = { mockup: 'Pricing', variant: 'A', device: 'desktop', overall: 'Looks good', items: [{ n: 1, kind: 'pin', x: 25, y: 20, comment: 'Make it bigger', target: { selector: 'h1', text: 'Hello', html: '<h1>Hello</h1>' } }] };
  expect(a.actions.map(({ type, payload, message }) => ({ type, payload, message }))).toEqual([{ type: 'feedback', payload, message: toMessage(payload as Parameters<typeof toMessage>[0]) }]); expect(a.store.get('review.submitted')).toBe(true); fireEvent.click(a.view.getByText('Edit feedback')); expect(a.view.getByRole('textbox', { name: 'Overall feedback' })).toBeDefined();
});
test('region, drawing, undo/redo and escape cancellation use percentage space', async () => {
  const a = setup({ kind: 'image', src: 'https://example.com/a.png' });
  a.pointer('pointerdown', 100, 50); a.pointer('pointermove', 400, 200); a.pointer('pointerup', 400, 200);
  expect((a.store.get('review.feedback') as any).items[0]).toMatchObject({ kind: 'region', x: 10, y: 10, w: 30, h: 30 });
  fireEvent.keyDown(a.view.getByRole('textbox', { name: 'Add a comment…' }), { key: 'Escape' }); expect((a.store.get('review.feedback') as any).items).toHaveLength(0);
  fireEvent.click(a.view.getByText('Draw', { exact: false })); a.pointer('pointerdown', 100, 50); a.pointer('pointermove', 200, 100); a.pointer('pointerup', 300, 150); fireEvent.click(a.view.getByText('Save'));
  expect((a.store.get('review.feedback') as any).items[0]).toMatchObject({ kind: 'drawing', x: 10, y: 10, path: 'M10 10L30 30' });
  fireEvent.click(a.view.getByText('Undo')); expect((a.store.get('review.feedback') as any).items).toHaveLength(0); fireEvent.click(a.view.getByText('Redo')); expect((a.store.get('review.feedback') as any).items).toHaveLength(1);
});
test('keyboard reticle, previous resolved items and persisted drafts exclude resolved payload', () => {
  const a = setup({ previous: { overall: '', items: [{ n: 1, kind: 'pin', x: 10, y: 10, comment: 'Old' }] } });
  fireEvent.keyDown(a.canvas(), { key: 'ArrowRight' }); fireEvent.keyDown(a.canvas(), { key: 'ArrowDown', shiftKey: true }); fireEvent.keyDown(a.canvas(), { key: 'Enter' });
  expect((a.store.get('review.feedback') as any).items[0]).toMatchObject({ x: 52, y: 60 }); a.change(a.view.getByRole('textbox', { name: 'Add a comment…' }), 'New'); fireEvent.click(a.view.getByText('Save')); fireEvent.click(a.view.getByText('Submit feedback')); expect((a.actions[0].payload as any).items).toHaveLength(1); expect(a.view.getByRole('button', { name: 'Resolved 1: Old' }).getAttribute('aria-disabled')).toBe('true');
  fireEvent.click(a.view.getByText('Edit feedback')); a.rerender({ title: 'Updated' }); expect(a.view.getByText('New')).toBeDefined();
});
test('direct image directive and plugin fences resolve through the registry', () => {
  const registry = createRegistry([mockupDefinition]); const view = render(<Prism registry={registry} plugins={[mockupPlugin]} source={'::mockup{kind=image src="https://example.com/a.png" title="Poster"}\n\n```mockup:svg {title="Logo"}\n<svg><rect width="10"/></svg>\n```'} />); expect(view.getByRole('img', { name: 'Poster' })).toBeDefined(); expect(view.container.querySelector('rect')).not.toBeNull();
});
test('draft and viewport state survive a genuine unmount', () => {
  const a = setup(); a.change(a.view.getByRole('textbox', { name: 'Overall feedback' }), 'Keep this draft');
  fireEvent.click(a.view.getByRole('button', { name: /^Mobile$/ })); fireEvent.click(a.view.getByRole('button', { name: 'Zoom in' }));
  const draft = a.store.get('review.feedback'); a.view.unmount();
  const b = setup({}, true, a.store); expect(b.store.get('review.feedback')).toEqual(draft); expect((b.view.getByRole('textbox', { name: 'Overall feedback' }) as HTMLTextAreaElement).value).toBe('Keep this draft'); expect(b.view.getByRole('button', { name: /^Mobile$/ }).getAttribute('aria-pressed')).toBe('true'); expect(b.view.getByText('125%')).toBeDefined();
});
test('image errors show a calm fallback and a changed URL can load again', () => {
  const a = setup({ kind: 'image', src: 'https://example.com/missing.png' }); fireEvent.error(a.view.getByRole('img')); expect(a.view.getByText('Image unavailable')).toBeDefined(); a.rerender({ kind: 'image', src: 'https://example.com/ok.png' }); expect(a.view.getByRole('img')).toBeDefined();
});
