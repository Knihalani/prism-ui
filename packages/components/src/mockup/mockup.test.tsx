import '../../../react/test/setup';
import { afterEach, beforeEach, expect, test } from 'bun:test';
import { Prism, createRegistry, defineTheme, usePrism, type Action, type PrismComponentProps } from '@prism-ui/react';
import { createStore } from '@prism-ui/state';
import { replayStart } from './harness/replay';
import { MockupFooter } from './chrome';
import { MockupView, createFeedback, mockupDefinition, mockupPlugin, parseMockupMeta, useMockup, toMessage, type FrameController, type FrameMessage, type HitRect, type MockupProps } from './index';

const { render, cleanup, fireEvent, act } = await import('@testing-library/react');
const observer = globalThis.IntersectionObserver;
beforeEach(() => { Object.assign(globalThis, { IntersectionObserver: undefined }); });
afterEach(() => { cleanup(); Object.assign(globalThis, { IntersectionObserver: observer }); });

test('native primary slots receive disabled and sent state without interpreting Pill props', () => {
  const store = createStore();
  store.set('review.feedback', createFeedback({ overall: 'Looks good' }).toJSON());
  const registry = createRegistry([{ ...mockupDefinition, component({ props }: PrismComponentProps<MockupProps>) {
    const vm = useMockup(props, usePrism());
    return <MockupFooter model={vm} labels={vm.labels} count={0} submitted={vm.submitted} edit={() => vm.setSubmitted(false)} canUndo={false} canRedo={false} undo={() => {}} redo={() => {}} canSubmit={vm.canSubmit} submit={vm.submit} />;
  } }]);
  const view = render(<Prism registry={registry} store={store} source={source({})} onAction={() => {}} slots={{ mockup: { primary: ({ model, as, sent, receipt, ...props }: any) => <button {...props} /> } }} />);
  const button = view.getByRole('button', { name: 'Submit feedback' }) as HTMLButtonElement;
  expect(button.disabled).toBe(false);
  fireEvent.click(button);
  expect(button.disabled).toBe(true);
  expect(button.getAttribute('aria-disabled')).toBe('true');
  expect(button.hasAttribute('data-sent')).toBe(true);
  fireEvent.click(view.getByRole('button', { name: 'Edit feedback' }));
  expect(button.disabled).toBe(false); expect(button.hasAttribute('data-sent')).toBe(false);
});
test('comment rows stagger, collapse inertly on removal, and restore the same row on undo', async () => {
  const a = setup();
  a.pointer('pointerdown', 200, 100); a.pointer('pointerup', 200, 100);
  a.change(a.view.getByRole('textbox', { name: 'Add a comment…' }), 'Keep the title');
  const pin = a.view.container.querySelector('[data-part=marker]')!;
  fireEvent.mouseLeave(pin);
  expect(pin.getAttribute('data-active')).toBe('true');
  fireEvent.click(a.view.getByText('Save'));
  const row = a.view.container.querySelector<HTMLElement>('[data-part=list] [data-part=item]')!;
  expect(row.hasAttribute('data-prism-enter')).toBe(true);
  expect(row.style.getPropertyValue('--prism-motion-index')).toBe('0');
  act(() => a.model.remove(a.model.state.items[0].id));
  expect(row.isConnected).toBe(true); expect(row.inert).toBe(true);
  expect(row.getAttribute('aria-hidden')).toBe('true'); expect(row.style.height).toBe('0px');
  act(() => a.model.feedback.undo());
  expect(a.view.container.querySelector('[data-part=list] [data-part=item]')).toBe(row);
  expect(row.inert).toBe(false); expect(row.hasAttribute('data-closing')).toBe(false);
  act(() => a.model.remove(a.model.state.items[0].id));
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 180)); });
  expect(row.isConnected).toBe(false);
  expect(a.view.container.querySelector('[data-part=list] [data-part=empty]')).not.toBeNull();
});
const source = (props: MockupProps) => '```ui:mockup\n' + JSON.stringify({ id: 'review', ...props }) + '\n```';
test('Draw keyboard creates bounded regions with Enter and Space; arrows move and Shift+arrows resize', () => {
  const a = setup();
  act(() => a.model.setPen(true));
  fireEvent.keyDown(a.canvas(), { key: 'Enter' });
  expect(a.model.state.items[0]).toMatchObject({ kind: 'region', w: 20, h: 20 });
  a.change(a.view.getByRole('textbox', { name: 'Add a comment…' }), 'Keyboard region');
  fireEvent.keyDown(a.view.getByRole('textbox', { name: 'Add a comment…' }), { key: 'Enter' });
  const marker = a.view.getByRole('button', { name: 'Comment 1: Keyboard region' });
  const before = a.model.state.items[0];
  fireEvent.keyDown(marker, { key: 'ArrowRight' });
  fireEvent.keyDown(marker, { key: 'ArrowDown', shiftKey: true });
  expect(a.model.state.items[0]).toMatchObject({ x: before.x + 2, w: 20, h: 22 });
  fireEvent.keyDown(a.canvas(), { key: ' ' });
  expect(a.model.state.items[1].kind).toBe('region');
  fireEvent.keyDown(a.view.getByRole('textbox', { name: 'Add a comment…' }), { key: 'Escape' });
  act(() => a.model.setPen(false));
  fireEvent.keyDown(a.canvas(), { key: 'Enter' });
  expect(a.model.state.items.at(-1)?.kind).toBe('pin');
});

test('Draw keyboard ignores nested editor events and clamps region sizes', () => {
  const a = setup();
  act(() => a.model.setPen(true));
  for (let i = 0; i < 12; i++) fireEvent.keyDown(a.canvas(), { key: 'ArrowRight', shiftKey: true });
  fireEvent.keyDown(a.canvas(), { key: ' ' });
  const item = a.model.state.items[0];
  expect(item.x + item.w!).toBeLessThanOrEqual(100);
  fireEvent.keyDown(a.view.getByRole('textbox', { name: 'Add a comment…' }), { key: ' ', bubbles: true });
  expect(a.model.state.items).toHaveLength(1);
  act(() => a.model.resize(item.id, 1000, -100));
  expect(a.model.state.items[0]).toMatchObject({ w: 20, h: 2 });
  act(() => a.model.move(item.id, 1000, 1000));
  expect(a.model.state.items[0]).toMatchObject({ x: 80, y: 98, w: 20, h: 2 });
});
function setup(props: MockupProps = {}, done = true, store = createStore()) {
  const renders: [string, boolean | undefined][] = [], actions: Action[] = [];
  const listeners = new Set<(message: FrameMessage) => void>(), hits: HitRect[] = [];
  const target = { selector: 'h1', text: 'Hello', html: '<h1>Hello</h1>', box: { x: 0, y: 0, w: 100, h: 40 } };
  const factory = (): FrameController => ({ id: 'stub', srcdoc: '', attach() {}, render(html, complete) { renders.push([html, complete]); }, hit: async rect => { hits.push(rect); return { target, box: { ...rect, w: rect.w ?? 0, h: rect.h ?? 0 } }; }, setAnchors() {}, configure() {}, on(type, fn) { const listener = (message: FrameMessage) => { if (message.type === type) fn(message as never); }; listeners.add(listener); return () => listeners.delete(listener); }, destroy() {} });
  let model!: ReturnType<typeof useMockup>;
  function Test({ props }: PrismComponentProps<MockupProps>) { model = useMockup(props, usePrism(), { createController: factory }); return <MockupView vm={model} />; }
  const registry = createRegistry([{ ...mockupDefinition, component: Test }]);
  const view = render(<Prism source={source(props)} done={done} registry={registry} store={store} onAction={a => actions.push(a)} />);
  const canvas = () => { const element = view.getByRole('application'); element.getBoundingClientRect = () => ({ x: 0, y: 0, left: 0, top: 0, right: 1000, bottom: 500, width: 1000, height: 500, toJSON() {} }); return element; };
  const pointer = (type: string, x: number, y: number) => fireEvent(canvas(), new window.PointerEvent(type, { bubbles: true, button: 0, clientX: x, clientY: y, pointerId: 1 }));
  function change(element: HTMLElement, value: string) { act(() => element.focus()); fireEvent.change(element, { target: { value } }); fireEvent.keyUp(element, { key: 'Unidentified' }); if (element.getAttribute('data-part') === 'input' && element.closest('label')) fireEvent.blur(element); }
  return { view, actions, store, renders, target, hits, canvas, pointer, change, get model() { return model; }, send(message: FrameMessage) { act(() => { listeners.forEach(fn => fn(message)); }); }, rerender(props: MockupProps, done = true, nextStore = store) { view.rerender(<Prism source={source(props)} done={done} registry={registry} store={nextStore} onAction={a => actions.push(a)} />); } };
}
test('headless props replace enclosing labels and titles below theme overrides', () => {
  const cases: MockupProps[] = [
    { title: 'Headless title', labels: { title: 'Label title', submit: 'Headless submit', source: 'Headless source' } },
    { title: undefined, labels: {} },
    { title: undefined, labels: { title: 'Label title' } },
  ];
  for (const themed of [false, true]) for (const overrides of cases) {
    const actions: Action[] = [];
    function Custom({ props }: PrismComponentProps<MockupProps>) {
      const model = useMockup({ ...props, ...overrides }, usePrism(), { enabled: false });
      return <button title={model.title} aria-label={model.labels.source} onClick={() => { model.feedback.setOverall('Review note'); model.submit(); }}>{model.labels.submit}</button>;
    }
    const registry = createRegistry([{ ...mockupDefinition, component: Custom, strings: { ...mockupDefinition.strings, submit: 'Registry submit', source: 'Registry source' } }]);
    const theme = defineTheme({ name: 'headless-labels', components: { mockup: { strings: themed ? { title: 'Theme title', submit: 'Theme submit', source: 'Theme source' } : {} } } });
    const view = render(<Prism source={source({ title: 'Enclosing title', labels: { submit: 'Enclosing submit', source: 'Enclosing source' } })} registry={registry} theme={theme} onAction={action => actions.push(action)} />);
    const title = themed ? 'Theme title' : overrides.title ?? overrides.labels?.title ?? 'Mockup';
    const button = view.getByRole('button', { name: themed ? 'Theme source' : overrides.labels?.source ?? 'Registry source' });
    expect(button.title).toBe(title);
    expect(button.textContent).toBe(themed ? 'Theme submit' : overrides.labels?.submit ?? 'Registry submit');
    fireEvent.click(button);
    expect((actions[0].payload as { mockup: string }).mockup).toBe(title);
    expect(actions[0].message).toContain('"' + title + '"');
    view.unmount();
  }
});

test('recreating the playground store does not resurrect an old feedback draft', () => {
  const props = { source: '<h1>Review</h1>' }, x = setup(props);
  x.change(x.view.getByRole('textbox', { name: 'Overall feedback' }), 'Old draft');
  const fresh = createStore({ initial: { rent: 1200 } });
  x.rerender(props, true, fresh);
  expect((x.view.getByRole('textbox', { name: 'Overall feedback' }) as HTMLTextAreaElement).value).toBe('');
  expect(fresh.get('review.feedback')).toBeUndefined();
});
test('replay begins with a valid mockup and visible content past large styles without replacing its iframe', () => {
  const markdown = '```mockup:html {id=replay}\n<style>' + 'body{margin:0}'.repeat(300) + '</style><h1>First text</h1><p>' + 'More text '.repeat(100) + '</p>\n```';
  const initial = replayStart(markdown), plugins = [mockupPlugin];
  expect(initial).toContain('</style><h1>First text</h1>'); expect(initial.length).toBeLessThan(markdown.length);
  const view = render(<Prism source={markdown} plugins={plugins} done />), iframe = view.container.querySelector('iframe'), member = view.container.querySelector('.prism-mockup__member');
  view.rerender(<Prism source={initial} plugins={plugins} done={false} />);
  expect(view.container.querySelector('iframe')).toBe(iframe); expect(iframe!.isConnected).toBe(true);
  expect(view.container.querySelector('.prism-mockup__member')).toBe(member); expect(member!.getAttribute('data-state')).toBe('streaming');
});
test('an incomplete replay retains the last measured height even through empty content and smaller sizes', () => {
  const x = setup({ source: '<h1>Complete</h1>' });
  const size = (height: number) => x.send({ ns: 'prism-mockup', v: 1, id: 'stub', type: 'size', width: 1280, height });
  const stage = x.view.container.querySelector('.prism-mockup__stage') as HTMLElement, iframe = x.view.container.querySelector('iframe');
  size(900); x.rerender({ source: '' }, false); size(1); expect(stage.style.height).toBe('900px');
  x.rerender({ source: '<h1>Partial' }, false); size(1000); size(100); expect(stage.style.height).toBe('1000px');
  expect(x.view.container.querySelector('iframe')).toBe(iframe);
  x.rerender({ source: '<h1>Done</h1>' }); size(500); expect(stage.style.height).toBe('500px');
});
test('a named replay restores its saved feedback instead of overwriting it with the provisional model', () => {
  const previous = createFeedback({ mockup: 'Mockup', device: 'desktop', overall: 'Keep the saved reviewer notes' });
  const item = previous.addPin({ x: 20, y: 30 }); previous.edit(item.id, { comment: 'Keep the saved pin' });
  const saved = previous.toJSON();
  const store = createStore({ initial: { review: { feedback: saved } } });
  const props = { source: '<h1>Review</h1>' };
  const x = setup(props, false, store);
  expect(store.get('review.feedback')).toEqual(saved);
  x.rerender(props);
  expect((x.view.getByRole('textbox', { name: 'Overall feedback' }) as HTMLTextAreaElement).value).toBe(saved.overall);
  expect(x.view.getByRole('button', { name: 'Comment 1: Keep the saved pin' })).toBeDefined();
  expect(store.get('review.feedback')).toEqual(saved);
});
test('a named replay with no saved draft keeps provisional feedback edits when it completes', () => {
  const store = createStore(), props = { source: '<h1>Review</h1>' };
  const x = setup(props, false, store);
  x.change(x.view.getByRole('textbox', { name: 'Overall feedback' }), 'Keep the in-flight edit');
  expect(Object.keys(store.snapshot())).toEqual(['review']);
  x.rerender(props);
  expect((x.view.getByRole('textbox', { name: 'Overall feedback' }) as HTMLTextAreaElement).value).toBe('Keep the in-flight edit');
  expect(store.get('review.feedback.overall')).toBe('Keep the in-flight edit');
  expect(Object.keys(store.snapshot())).toEqual(['review']);
});
test('stream feedback undo and redo history survives completion', () => {
  const props = { source: '<h1>Review</h1>' }, x = setup(props, false);
  x.change(x.view.getByRole('textbox', { name: 'Overall feedback' }), 'Stream edit');
  fireEvent.click(x.view.getByRole('button', { name: 'Undo' }));
  x.rerender(props);
  expect((x.view.getByRole('button', { name: 'Redo' }) as HTMLButtonElement).disabled).toBe(false);
  fireEvent.click(x.view.getByRole('button', { name: 'Redo' }));
  expect((x.view.getByRole('textbox', { name: 'Overall feedback' }) as HTMLTextAreaElement).value).toBe('Stream edit');
  fireEvent.click(x.view.getByRole('button', { name: 'Undo' }));
  expect((x.view.getByRole('textbox', { name: 'Overall feedback' }) as HTMLTextAreaElement).value).toBe('');
});
test('completion preserves the pending annotation rollback used by Escape', () => {
  const props = { source: '<h1>Review</h1>' }, x = setup(props, false);
  fireEvent.keyDown(x.view.getByRole('application'), { key: 'Enter' });
  x.rerender(props);
  fireEvent.keyDown(x.view.getByRole('textbox', { name: 'Add a comment…' }), { key: 'Escape' });
  expect(x.view.queryByRole('button', { name: /^Comment 1:/ })).toBeNull();
  expect(x.store.get('review.feedback')).toBeUndefined();
});
test('Escape and Enter in a comment return focus to the keyboard canvas', () => {
  const x = setup(); const canvas = x.canvas(); act(() => canvas.focus()); fireEvent.keyDown(canvas, { key: 'Enter' });
  fireEvent.keyDown(x.view.getByRole('textbox', { name: 'Add a comment…' }), { key: 'Escape' });
  expect(document.activeElement).toBe(canvas); expect(x.view.queryByRole('dialog')).toBeNull();
  fireEvent.keyDown(canvas, { key: 'Enter' }); const textarea = x.view.getByRole('textbox', { name: 'Add a comment…' }); x.change(textarea, 'Saved from keyboard'); fireEvent.keyDown(textarea, { key: 'Enter' });
  expect(document.activeElement).toBe(canvas); expect(x.view.queryByRole('dialog')).toBeNull();
  expect(x.view.getByRole('button', { name: 'Comment 1: Saved from keyboard' })).toBeDefined();
});
test('Escape and empty outside-cancel restore history, including a prior redo, after real target resolution', async () => {
  for (const kind of ['pin', 'region'] as const) for (const outside of [false, true]) {
    const x = setup();
    x.change(x.view.getByRole('textbox', { name: 'Overall feedback' }), 'Keep me');
    fireEvent.click(x.view.getByRole('button', { name: 'Undo' }));
    const undo = x.view.getByRole('button', { name: 'Undo' }) as HTMLButtonElement, redo = x.view.getByRole('button', { name: 'Redo' }) as HTMLButtonElement;
    expect(undo.disabled).toBe(true); expect(redo.disabled).toBe(false);
    await act(async () => { x.pointer('pointerdown', 200, 100); x.pointer('pointerup', kind === 'pin' ? 200 : 500, kind === 'pin' ? 100 : 300); });
    expect(x.model.state.items[0].target).toBeDefined();
    if (outside) fireEvent.pointerDown(x.view.getByRole('textbox', { name: 'Overall feedback' }));
    else fireEvent.keyDown(x.view.getByRole('textbox', { name: 'Add a comment…' }), { key: 'Escape' });
    expect(x.view.queryByRole('dialog')).toBeNull(); expect(x.store.get('review.feedback')).toBeUndefined();
    expect(undo.disabled).toBe(true); expect(redo.disabled).toBe(false);
    fireEvent.click(redo); expect((x.view.getByRole('textbox', { name: 'Overall feedback' }) as HTMLTextAreaElement).value).toBe('Keep me'); expect((x.store.get('review.feedback') as any).items).toEqual([]);
    x.view.unmount();
  }
});
test('drawings hit test their bounding-box centre, follow layout and still submit their path', async () => {
  const x = setup(); fireEvent.click(x.view.getByRole('button', { name: 'More tools' })); fireEvent.click(x.view.getByRole('button', { name: 'Draw' }));
  await act(async () => { x.pointer('pointerdown', 400, 50); x.pointer('pointerup', 600, 100); });
  expect(x.hits).toEqual([{ x: 50, y: 15 }]);
  const draft = x.model.state;
  x.send({ ns: 'prism-mockup', v: 1, id: 'stub', type: 'layout', anchors: [{ key: draft.items[0].id, box: { x: 10, y: 40, w: 50, h: 20 } }] });
  fireEvent.click(x.view.getByText('Submit feedback'));
  expect((x.actions[0].payload as any).items[0]).toMatchObject({ kind: 'drawing', x: 30, y: 45, w: 10, h: 5, path: 'M30 45L40 50', target: { selector: 'h1' } });
});
test('plugin preserves identity, completion and parses safe attributes without registering code', () => {
  const node = { type: 'code', key: 'x', lang: 'mockup:html', meta: '{title="Pricing plans" device=mobile variant="A" group=g1 id=p flag}', value: '<h1>Pricing</h1>', complete: false };
  expect(mockupPlugin.transform!(node)).toEqual({ type: 'component', key: 'x', name: 'mockup', props: { title: 'Pricing plans', device: 'mobile', variant: 'A', group: 'g1', id: 'p', flag: true, kind: 'html', source: node.value }, children: [], complete: false, idComplete: true });
  expect(mockupPlugin.transform!({ ...node, lang: 'html' })).toEqual({ ...node, lang: 'html' });
  expect(parseMockupMeta()).toEqual({}); expect(Object.keys(parseMockupMeta('__proto__=bad constructor=no title=ok'))).toEqual(['title']);
});
test('narrow editors escape the clipped canvas, clamp to the root and restore keyboard focus', () => {
  for (const width of [280, 320]) for (const device of ['desktop', 'mobile'] as const) {
    const x = setup({ source: '<h1>Hello</h1>', device });
    const root = x.view.container.querySelector('[data-part="member"]') as HTMLElement;
    root.getBoundingClientRect = () => ({ x: 100, y: 20, left: 100, top: 20, right: 100 + width, bottom: 420, width, height: 400, toJSON() {} });
    if (device === 'mobile') fireEvent.click(x.view.getByRole('button', { name: 'Zoom in' }));
    x.pointer('pointerdown', 980, 490); x.pointer('pointerup', 980, 490);
    const popover = x.view.getByRole('dialog');
    expect(popover.parentElement).toBe(root);
    expect(root.querySelector('[data-part="viewport"]')!.contains(popover)).toBe(false);
    expect(parseFloat(popover.style.left)).toBeGreaterThanOrEqual(12);
    expect(parseFloat(popover.style.left) + parseFloat(popover.style.width)).toBeLessThanOrEqual(width - 12);
    expect(parseFloat(popover.style.top) + 180).toBeLessThanOrEqual(400);
    const editor = x.view.getByRole('textbox', { name: 'Add a comment…' });
    expect(document.activeElement).toBe(editor);
    fireEvent.keyDown(editor, { key: 'Escape' });
    expect(x.view.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(x.canvas());
    x.view.unmount();
  }
});

test('popover stays within the content box near its lower right edge', () => {
  const x = setup({ source: '<h1>Hello</h1>' });
  x.pointer('pointerdown', 980, 490); x.pointer('pointerup', 980, 490);
  const popover = x.view.getByRole('dialog');
  expect(popover.style.width).toBe('320px');
  expect(parseFloat(popover.style.left) + parseFloat(popover.style.width)).toBeLessThanOrEqual(1280);
  expect(parseFloat(popover.style.top) + 180).toBeLessThanOrEqual(400);
});
test('open typed drafts enable submit, save before payload creation and pluralize one comment', () => {
  const x = setup(); x.pointer('pointerdown', 300, 200); x.pointer('pointerup', 300, 200);
  const area = x.view.getByRole('textbox', { name: 'Add a comment…' }), submit = x.view.getByRole('button', { name: 'Submit feedback' }) as HTMLButtonElement;
  expect(submit.disabled).toBe(true); x.change(area, '   '); expect(submit.disabled).toBe(true);
  x.change(area, 'Keep this draft'); expect(submit.disabled).toBe(false);
  expect(x.view.getByText('1 comment')).toBeDefined(); fireEvent.click(submit);
  expect((x.actions[0].payload as any).items[0].comment).toBe('Keep this draft');
  expect(x.view.getByText('Feedback sent · 1 comment')).toBeDefined();
});
test('clicking another canvas point discards its unsaved predecessor; Escape writes nothing', () => {
  const x = setup(); x.pointer('pointerdown', 200, 100); x.pointer('pointerup', 200, 100);
  x.change(x.view.getByRole('textbox', { name: 'Add a comment…' }), 'Saved outside');
  x.pointer('pointerdown', 700, 300); x.pointer('pointerup', 700, 300);
  expect(x.store.get('review.feedback')).toBeUndefined();
  x.change(x.view.getByRole('textbox', { name: 'Add a comment…' }), 'Cancel me');
  fireEvent.keyDown(x.view.getByRole('textbox', { name: 'Add a comment…' }), { key: 'Escape' });
  expect(x.store.get('review.feedback')).toBeUndefined();
});
test('plural rules use the Prism locale and translated forms, including zero', () => {
  const view = render(<Prism source={source({ kind: 'image', labels: { countOne: '{n} remarque', countOther: '{n} remarques' } })} locale="fr" done />);
  expect(view.getByText('0 remarque')).toBeDefined();
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
  const a = setup({ title: 'Pricing', variant: 'A' }); expect((a.view.getByRole('button', { name: 'Submit feedback' }) as HTMLButtonElement).disabled).toBe(true);
  await act(async () => { a.pointer('pointerdown', 250, 100); a.pointer('pointerup', 250, 100); });
  a.change(a.view.getByRole('textbox', { name: 'Add a comment…' }), 'Make it bigger'); fireEvent.click(a.view.getByText('Save'));
  a.change(a.view.getByRole('textbox', { name: 'Overall feedback' }), 'Looks good'); fireEvent.click(a.view.getByText('Submit feedback'));
  const payload = { mockup: 'Pricing', variant: 'A', device: 'desktop', overall: 'Looks good', items: [{ n: 1, kind: 'pin', x: 25, y: 20, comment: 'Make it bigger', target: { selector: 'h1', text: 'Hello', html: '<h1>Hello</h1>' } }] };
  expect(a.actions.map(({ type, payload, message }) => ({ type, payload, message }))).toEqual([{ type: 'feedback', payload, message: toMessage(payload as Parameters<typeof toMessage>[0]) }]); expect(a.store.get('review.feedback.submitted')).toBe(true); fireEvent.click(a.view.getByText('Edit feedback')); expect(a.view.getByRole('textbox', { name: 'Overall feedback' })).toBeDefined();
});
test('region, drawing, undo/redo and escape cancellation use percentage space', async () => {
  const a = setup({ kind: 'image', src: 'https://example.com/a.png' });
  a.pointer('pointerdown', 100, 50); a.pointer('pointermove', 400, 200); a.pointer('pointerup', 400, 200);
  expect(a.model.state.items[0]).toMatchObject({ kind: 'region', x: 10, y: 10, w: 30, h: 30 });
  expect(a.store.get('review.feedback')).toBeUndefined();
  fireEvent.keyDown(a.view.getByRole('textbox', { name: 'Add a comment…' }), { key: 'Escape' }); expect(a.store.get('review.feedback')).toBeUndefined();
  fireEvent.click(a.view.getByText('Draw', { exact: false })); a.pointer('pointerdown', 100, 50); a.pointer('pointermove', 200, 100); a.pointer('pointerup', 300, 150); fireEvent.click(a.view.getByText('Save'));
  expect((a.store.get('review.feedback') as any).items[0]).toMatchObject({ kind: 'drawing', x: 10, y: 10, path: 'M10 10L30 30' });
  fireEvent.click(a.view.getByText('Undo')); expect(a.store.get('review.feedback')).toBeUndefined(); fireEvent.click(a.view.getByText('Redo')); expect((a.store.get('review.feedback') as any).items).toHaveLength(1);
});
test('keyboard reticle, previous resolved items and persisted drafts exclude resolved payload', () => {
  const a = setup({ previous: { overall: '', items: [{ n: 1, kind: 'pin', x: 10, y: 10, comment: 'Old' }] } });
  fireEvent.keyDown(a.canvas(), { key: 'ArrowRight' }); fireEvent.keyDown(a.canvas(), { key: 'ArrowDown', shiftKey: true }); fireEvent.keyDown(a.canvas(), { key: 'Enter' });
  expect(a.model.state.items[0]).toMatchObject({ x: 52, y: 60 }); a.change(a.view.getByRole('textbox', { name: 'Add a comment…' }), 'New'); fireEvent.click(a.view.getByText('Save')); fireEvent.click(a.view.getByText('Submit feedback')); expect((a.actions[0].payload as any).items).toHaveLength(1); expect(a.view.getByRole('button', { name: 'Resolved 1: Old' }).getAttribute('aria-disabled')).toBe('true');
  fireEvent.click(a.view.getByText('Edit feedback')); a.rerender({ title: 'Updated' }); expect(a.view.getByText('New', { selector: '[data-part="list"] [data-part="item"] span' })).toBeDefined();
});
test('direct image directive and plugin fences resolve through the registry', () => {
  const registry = createRegistry([mockupDefinition]); const view = render(<Prism registry={registry} plugins={[mockupPlugin]} source={'::mockup{kind=image src="https://example.com/a.png" title="Poster"}\n\n```mockup:svg {title="Logo"}\n<svg><rect width="10"/></svg>\n```'} />); expect(view.getByRole('img', { name: 'Poster' })).toBeDefined(); expect(view.container.querySelector('rect')).not.toBeNull();
});
test('saved feedback survives unmount while unsaved device and zoom choices stay local', () => {
  const a = setup(); a.change(a.view.getByRole('textbox', { name: 'Overall feedback' }), 'Keep this draft');
  fireEvent.click(a.view.getByRole('button', { name: /^Mobile$/ })); fireEvent.click(a.view.getByRole('button', { name: 'Zoom in' }));
  const draft = a.store.get('review.feedback'); a.view.unmount();
  const b = setup({}, true, a.store); expect(b.store.get('review.feedback')).toEqual(draft); expect((b.view.getByRole('textbox', { name: 'Overall feedback' }) as HTMLTextAreaElement).value).toBe('Keep this draft'); expect(b.view.getByRole('button', { name: /^Desktop$/ }).getAttribute('aria-pressed')).toBe('true'); expect(b.view.getByRole('button', { name: 'Fit' })).toBeDefined();
});
test('saved mockup submitted state is reactive and explicit new feedback takes precedence', () => {
  const store = createStore({ initial: { review: { submitted: true, feedback: createFeedback({ overall: 'Previously submitted' }).toJSON() } } });
  const x = setup({}, true, store);
  expect(x.model.submitted).toBe(true);
  expect(x.view.queryByRole('textbox', { name: 'Overall feedback' })).toBeNull();
  fireEvent.click(x.view.getByText('Edit feedback'));
  expect(x.model.submitted).toBe(false);
  x.change(x.view.getByRole('textbox', { name: 'Overall feedback' }), 'Edited legacy receipt');
  expect(x.model.submitted).toBe(false);
  expect(store.get('review.feedback.submitted')).toBe(false);
  act(() => store.undo('review'));
  expect(x.model.submitted).toBe(true);
  act(() => store.set('review.submitted', false));
  expect(x.model.submitted).toBe(false);
  expect(x.actions).toEqual([]);
});
test('image errors show a calm fallback and a changed URL can load again', () => {
  const a = setup({ kind: 'image', src: 'https://example.com/missing.png' }); fireEvent.error(a.view.getByRole('img')); expect(a.view.getByText('Image unavailable')).toBeDefined(); a.rerender({ kind: 'image', src: 'https://example.com/ok.png' }); expect(a.view.getByRole('img')).toBeDefined();
});
