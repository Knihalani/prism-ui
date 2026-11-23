import '../../react/test/setup';
import { afterEach, expect, test } from 'bun:test';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { Prism, defineRenderer, type Action } from '@prism-ui/react';
import { createStore } from '@prism-ui/state';
import { createFeedback } from '../src/mockup/engine';
import '../src/feedback';
import '../src/num';
import { useFeedbackTarget } from '../src/feedback';

afterEach(cleanup);
test('portal composer clamps to visualViewport bounds and updates when the keyboard opens', () => {
  const previous = Object.getOwnPropertyDescriptor(window, 'visualViewport');
  const vv = Object.assign(new window.EventTarget(), { width: 320, height: 600, offsetLeft: 20, offsetTop: 40 });
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: vv });
  try {
    function Target() { const ref = useFeedbackTarget(); return <div ref={ref}>Preview</div>; }
    const view = render(<Prism feedback animate={false} source={'```ui:feedback-test\n{"id":"keyboard"}\n```'} renderers={{ 'feedback-test': Target }} />);
    const root = view.container.querySelector('.prism-inline-feedback') as HTMLElement;
    root.getBoundingClientRect = () => new DOMRect(0, 0, 375, 812);
    fireEvent.click(view.getByRole('button', { name: 'Give feedback' }));
    fireEvent.keyDown(view.getByRole('application'), { key: 'Enter' });
    act(() => { vv.height = 320; vv.dispatchEvent(new window.Event('resize')); });
    const layer = document.querySelector('.prism-inline-feedback__popover-layer') as HTMLElement;
    expect(parseFloat(layer.style.left)).toBeGreaterThanOrEqual(32);
    expect(parseFloat(layer.style.top)).toBeGreaterThanOrEqual(52);
    expect(parseFloat(layer.style.top) + 210).toBeLessThanOrEqual(348);
    expect((view.getByRole('dialog') as HTMLElement).style.maxHeight).toBe('296px');
  } finally { cleanup(); if (previous) Object.defineProperty(window, 'visualViewport', previous); else delete (window as any).visualViewport; }
});
const source = '```ui:feedback-test\n{"id":"target"}\n```';
const View = () => <button>Actual input</button>;
for (const rootWidth of [500, 0]) test(`opening a list comment with a hidden preview uses visible feedback bounds (${rootWidth})`, () => {
  function Target() { const ref = useFeedbackTarget(); return <div ref={ref} data-test-preview="">Preview</div>; }
  const view = render(<Prism feedback animate={false} source={source} renderers={{ 'feedback-test': Target }} />);
  const preview = view.container.querySelector('[data-test-preview]') as HTMLElement;
  preview.getBoundingClientRect = () => preview.hidden ? new DOMRect() : new DOMRect(20, 20, 500, 300);
  const root = view.container.querySelector('.prism-inline-feedback') as HTMLElement;
  root.getBoundingClientRect = () => new DOMRect(20, 20, rootWidth, 600);
  fireEvent.click(view.getByRole('button', { name: 'Give feedback' }));
  fireEvent.keyDown(view.getByRole('application'), { key: 'Enter' });
  change(view.getByPlaceholderText('Add a comment…'), 'Keep this editable');
  fireEvent.click(view.getByRole('button', { name: 'Save' }));
  preview.hidden = true;
  fireEvent.click(view.getByRole('button', { name: 'Open comment 1' }));
  const layer = document.querySelector('.prism-inline-feedback__popover-layer') as HTMLElement;
  expect(parseFloat(layer.style.width)).toBeGreaterThanOrEqual(200);
  expect(view.getByPlaceholderText('Add a comment…').getAttribute('aria-label')).toBe('Add a comment…');
});
test('the feedback trigger retains its hit region while reveal chrome is transparent', async () => {
  const css = await Bun.file(new URL('../src/feedback.css', import.meta.url)).text();
  expect(css).toContain('.prism-inline-feedback > .prism-inline-feedback__trigger { pointer-events: auto !important; }');
  const view = render(<Prism feedback source={source} renderers={{ 'feedback-test': View }} />);
  const trigger = view.getByRole('button', { name: 'Give feedback' });
  fireEvent.mouseMove(trigger);
  fireEvent.click(trigger);
  expect(trigger.getAttribute('aria-expanded')).toBe('true');
  expect(view.getByRole('application')).toBeDefined();
});
function change(element: HTMLElement, value: string) { act(() => element.focus()); fireEvent.focus(element); fireEvent.change(element, { target: { value } }); fireEvent.keyUp(element, { key: 'Unidentified' }); }

test('sent inline feedback ignores repeated submit shortcuts and can be explicitly edited', () => {
  const actions: Action[] = [];
  const view = render(<Prism feedback source={source} renderers={{ 'feedback-test': View }} onAction={action => actions.push(action)} />);
  fireEvent.click(view.getByRole('button', { name: 'Give feedback' }));
  const canvas = view.getByRole('application');
  fireEvent.keyDown(canvas, { key: 'Enter', ctrlKey: true });
  expect(actions).toHaveLength(0);
  fireEvent.keyDown(canvas, { key: 'Enter' });
  change(view.getByPlaceholderText('Add a comment…'), 'Send once');
  fireEvent.keyDown(view.getByPlaceholderText('Add a comment…'), { key: 'Enter', ctrlKey: true });
  expect(actions).toHaveLength(1);
  for (const modifier of ['ctrlKey', 'metaKey']) fireEvent.keyDown(canvas, { key: 'Enter', [modifier]: true });
  expect(actions).toHaveLength(1);
  fireEvent.click(view.getByRole('button', { name: 'Edit feedback' }));
  fireEvent.keyDown(canvas, { key: 'Enter', metaKey: true });
  expect(actions).toHaveLength(2);
});

test('saved feedback is store-owned through revisions, local cancellation, finalization, history and explicit commits', () => {
  const original = createFeedback({ overall: 'Saved overall' });
  original.addPin({ x: 20, y: 30, comment: 'Saved annotation' });
  const saved = original.toJSON(), store = createStore({ initial: { target: { feedback: saved } } }), actions: Action[] = [];
  store.set('budget', 1); store.set('budget', 2); store.undo();
  const ui = (done: boolean) => <Prism store={store} renderers={{ 'feedback-test': View }} feedback source={done ? source : source.slice(0, -3)} done={done} onAction={a => actions.push(a)} />;
  const view = render(ui(false)), input = view.getByText('Actual input');
  fireEvent.click(view.getByRole('button', { name: 'Give feedback' }));
  expect(store.get('target.feedback')).toEqual(saved);
  const beforePin = store.snapshot();
  fireEvent.keyDown(view.getByRole('application'), { key: 'Enter' });
  change(view.getByPlaceholderText('Add a comment…'), 'Cancel this');
  expect(store.canRedo()).toBe(true);
  fireEvent.keyDown(view.getByPlaceholderText('Add a comment…'), { key: 'Escape' });
  expect(store.snapshot()).toEqual(beforePin);
  expect(store.canRedo()).toBe(true);
  fireEvent.keyDown(view.getByRole('application'), { key: 'Enter' });
  const comment = view.getByPlaceholderText('Add a comment…');
  change(comment, 'Unsaved across finalization');
  change(view.getByRole('textbox', { name: 'Overall feedback' }), 'Unsaved overall');
  view.rerender(ui(true));
  expect(view.getByPlaceholderText('Add a comment…')).toBe(comment);
  expect((comment as HTMLTextAreaElement).value).toBe('Unsaved across finalization');
  expect(view.getByText('Actual input')).toBe(input);
  expect(store.get('target.feedback')).toEqual(saved);
  expect((view.getByRole('textbox', { name: 'Overall feedback' }) as HTMLTextAreaElement).value).toBe('Unsaved overall');
  change(view.getByRole('textbox', { name: 'Overall feedback' }), 'Saved overall');
  fireEvent.blur(view.getByRole('textbox', { name: 'Overall feedback' }));
  expect(store.canRedo()).toBe(true);
  fireEvent.click(view.getByRole('button', { name: 'Save' }));
  expect(store.get('target.feedback.items')).toHaveLength(2);
  expect(store.canRedo()).toBe(false);
  act(() => store.undo('target'));
  expect(view.queryByRole('button', { name: 'Comment 2: Unsaved across finalization' })).toBeNull();
  act(() => store.redo('target'));
  expect(view.getByRole('button', { name: 'Comment 2: Unsaved across finalization' })).toBeDefined();
  const overall = view.getByRole('textbox', { name: 'Overall feedback' });
  change(overall, 'Committed on blur');
  expect(store.get('target.feedback.overall')).toBe('Saved overall');
  fireEvent.blur(overall);
  expect(store.get('target.feedback.overall')).toBe('Committed on blur');
  act(() => store.undo('target'));
  expect((overall as HTMLTextAreaElement).value).toBe('Saved overall');
  act(() => store.redo('target'));
  expect((overall as HTMLTextAreaElement).value).toBe('Committed on blur');
  const marker = view.getByRole('button', { name: 'Comment 1: Saved annotation' });
  fireEvent.click(marker);
  change(view.getByPlaceholderText('Add a comment…'), 'Still typing this annotation');
  change(overall, 'General comment while editing a pin');
  fireEvent.blur(overall);
  expect((view.getByPlaceholderText('Add a comment…') as HTMLTextAreaElement).value).toBe('Still typing this annotation');
  fireEvent.keyDown(view.getByPlaceholderText('Add a comment…'), { key: 'Escape' });
  change(overall, 'Committed on blur'); fireEvent.blur(overall);
  fireEvent.keyDown(marker, { key: 'ArrowRight' });
  expect(store.get('target.feedback.items.0.x')).toBe(22);
  act(() => store.undo('target'));
  expect(view.getByRole('button', { name: 'Comment 1: Saved annotation' }).style.left).toBe('20%');
  fireEvent.click(marker);
  expect(view.getByRole('dialog').closest('.prism-inline-feedback__target')).toBeNull();
  fireEvent.click(view.getByRole('button', { name: 'Delete' }));
  expect(store.get('target.feedback.items')).toHaveLength(1);
  act(() => store.undo('target'));
  expect(view.getByRole('button', { name: 'Comment 1: Saved annotation' })).toBeDefined();
  fireEvent.keyDown(view.getByRole('application'), { key: 'Enter' });
  change(view.getByPlaceholderText('Add a comment…'), 'Committed with submit');
  change(overall, 'Submitted overall');
  expect(store.get('target.feedback.overall')).toBe('Committed on blur');
  fireEvent.click(view.getByRole('button', { name: /^Send \d+ comments?$/ }));
  const submission = store.get('target.feedback');
  expect(submission).toMatchObject({ submitted: true, overall: 'Submitted overall' });
  expect(submission.items).toHaveLength(3);
  expect(actions).toHaveLength(1);
  expect(actions[0].payload).toMatchObject({ target: { name: 'feedback-test', id: 'target' }, coordinates: 'percent' });
  expect(store.canRedo()).toBe(false);
  act(() => store.redo());
  expect(store.get('target.feedback')).toEqual(submission);
  act(() => store.undo('target'));
  expect(store.get('target.feedback.items')).toHaveLength(2);
  expect(store.get('target.feedback.submitted')).toBe(false);
  expect(store.get('target.feedback.overall')).toBe('Committed on blur');
  expect(view.getByRole('textbox', { name: 'Overall feedback' })).toBeDefined();
  act(() => store.redo('target'));
  expect(store.get('target.feedback')).toEqual(submission);
  expect(view.getByText('Edit feedback')).toBeDefined();
});

for (const replacement of ['id', 'store'] as const) for (const saved of [false, true]) {
  test(`target/${replacement} replacement reads ${saved ? 'saved' : 'absent'} feedback without initializing a draft`, () => {
    const store = createStore(), nextStore = replacement === 'store' ? createStore() : store;
    const nextId = replacement === 'id' ? 'replacement' : 'target';
    if (saved) nextStore.set(`${nextId}.feedback`, { items: [], overall: 'Saved replacement' }, { history: false });
    const ui = (text: string, activeStore = store) => <Prism store={activeStore} renderers={{ 'feedback-test': View }} feedback source={text} />;
    const view = render(ui(source));
    fireEvent.click(view.getByRole('button', { name: 'Give feedback' }));
    change(view.getByRole('textbox', { name: 'Overall feedback' }), 'Original draft');
    fireEvent.blur(view.getByRole('textbox', { name: 'Overall feedback' }));
    view.rerender(ui(source.replace('target', nextId), nextStore));
    expect((view.getByRole('textbox', { name: 'Overall feedback' }) as HTMLTextAreaElement).value).toBe(saved ? 'Saved replacement' : '');
    expect(nextStore.get(`${nextId}.feedback`)).toEqual(saved ? { items: [], overall: 'Saved replacement' } : undefined);
    if (replacement === 'id') expect(store.get('target.feedback.overall')).toBe('Original draft');
  });
}

test('inline built-ins keep phrasing content and portal their comment editor outside the paragraph', () => {
  const view = render(<Prism feedback source="Budget :num[3]{id=quantity} per seat." />);
  const paragraph = view.container.querySelector('p')!;
  fireEvent.click(view.getByRole('button', { name: 'Give feedback' }));
  fireEvent.keyDown(view.getByRole('application'), { key: 'Enter' });
  expect(paragraph.querySelector('div')).toBeNull();
  expect(paragraph.querySelector('[role=dialog]')).toBeNull();
  expect(view.getByRole('dialog')).toBeDefined();
  expect(paragraph.textContent).toContain('per seat.');
});

test('definitions opt in/out; empty and canceled feedback never create saved state or actions', () => {
  const enabled = defineRenderer('feedback-enabled-test', View, { feedback: true }), disabled = defineRenderer('feedback-disabled-test', View, { feedback: false });
  const actions: Action[] = [], store = createStore();
  const view = render(<Prism store={store} renderers={{ 'feedback-test': enabled }} source={source} onAction={a => actions.push(a)} />);
  fireEvent.click(view.getByRole('button', { name: 'Give feedback' }));
  fireEvent.keyDown(view.getByRole('application'), { key: 'Enter' });
  fireEvent.keyDown(view.getByPlaceholderText('Add a comment…'), { key: 'Escape' });
  expect(view.getByRole('button', { name: /^Send \d+ comments?$/ }).hasAttribute('disabled')).toBe(true);
  expect(actions).toEqual([]);
  expect(store.snapshot()).toEqual({});
  view.rerender(<Prism store={store} renderers={{ 'feedback-test': disabled }} feedback source={source} />);
  expect(view.queryByRole('button', { name: 'Give feedback' })).toBeNull();
});
