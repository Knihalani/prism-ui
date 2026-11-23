import '../../react/test/setup';
import { afterEach, expect, test } from 'bun:test';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { Prism, defineRenderer, type Action } from '@prism-ui/react';
import { createStore } from '@prism-ui/state';
import { createFeedback } from '../src/mockup/engine';
import '../src/feedback';
import '../src/num';
import '../src/mockup';

afterEach(cleanup);

test('Mockup keeps its own feedback controls without a duplicate global editor', () => {
  for (const src of ['', 'data:image/png;base64,iVBORw0KGgo=']) {
    const view = render(<Prism feedback animate={false} source={'```ui:mockup\n' + JSON.stringify({ id: 'native-review', kind: 'image', src }) + '\n```'} />);
    expect(view.queryByRole('button', { name: 'Give feedback' })).toBeNull();
    expect(view.getAllByRole('textbox', { name: 'Overall feedback' })).toHaveLength(1);
    expect(view.getAllByRole('button', { name: 'Submit feedback' })).toHaveLength(1);
    view.unmount();
  }
});

test('saving numeric inline feedback preserves the scalar value and dependent formula', () => {
  const store = createStore();
  const view = render(<Prism store={store} feedback animate={false} source={':num[1200]{id=rent} Annual cost: :calc[rent*12]'} onAction={() => {}} />);
  expect(store.get('rent')).toBe(1200);
  fireEvent.click(view.getAllByRole('button', { name: 'Give feedback' })[0]);
  const overall = view.getByRole('textbox', { name: 'Overall feedback' });
  change(overall, 'Keep this budget'); fireEvent.blur(overall);
  expect(store.get('rent')).toBe(1200);
  fireEvent.click(view.getByRole('button', { name: 'Submit feedback' }));
  expect(store.get('rent')).toBe(1200);
  expect(view.getByRole('math').textContent).toBe('14,400');
});

for (const name of ['num', 'calc']) test(`saved ${name} feedback survives streamed explicit-id finalization and reload`, () => {
  const store = createStore(), actions: Action[] = [];
  const ui = (done: boolean) => <Prism scope="feedback-stream" store={store} feedback animate={false} source={`:${name}[1200]{id="amount"}`} done={done} onAction={action => actions.push(action)} />;
  const view = render(ui(false));
  fireEvent.click(view.getByRole('button', { name: 'Give feedback' }));
  fireEvent.keyDown(view.getByRole('application'), { key: 'Enter' });
  change(view.getByPlaceholderText('Add a comment…'), 'Saved during streaming');
  fireEvent.click(view.getByRole('button', { name: 'Save' }));
  expect(view.getByRole('button', { name: 'Comment 1: Saved during streaming' })).toBeTruthy();
  view.rerender(ui(true));
  expect(view.getByRole('button', { name: 'Comment 1: Saved during streaming' })).toBeTruthy();
  expect(store.get('__prism.feedback.amount.items')).toHaveLength(1);
  if (name === 'num') expect(store.get('amount')).toBe(1200);
  fireEvent.click(view.getByRole('button', { name: 'Submit feedback' }));
  expect(actions.at(-1)?.payload).toMatchObject({ target: { id: 'amount' }, items: [{ comment: 'Saved during streaming' }] });
  view.unmount();
  const restored = render(ui(true));
  fireEvent.click(restored.getByRole('button', { name: 'Give feedback' }));
  expect(restored.getByText('Edit feedback')).toBeTruthy();
  expect(store.get('__prism.feedback.amount.submitted')).toBe(true);
});

for (const name of ['num', 'calc']) for (const operation of ['submit', 'submit-overall', 'delete']) test(`legacy ${name} annotations ${operation} consistently`, () => {
  const saved = createFeedback({ overall: operation === 'submit-overall' ? 'Legacy overall' : '' }); saved.addPin({ x: 20, y: 30, comment: 'Legacy annotation' });
  const store = createStore({ initial: { amount: { feedback: saved.toJSON() } } }), actions: Action[] = [];
  const ui = () => <Prism store={store} feedback animate={false} source={`:${name}[1200]{id="amount"}`} onAction={action => actions.push(action)} />;
  const view = render(ui());
  fireEvent.click(view.getByRole('button', { name: 'Give feedback' }));
  const marker = view.getByRole('button', { name: 'Comment 1: Legacy annotation' });
  if (name === 'num') expect(view.getByRole('slider').getAttribute('aria-valuenow')).toBe('1200');
  if (operation !== 'delete') {
    expect((view.getByRole('button', { name: 'Submit feedback' }) as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(view.getByRole('button', { name: 'Submit feedback' }));
    expect(actions.at(-1)?.payload).toMatchObject({ items: [{ comment: 'Legacy annotation' }] });
    expect(store.get('__prism.feedback.amount.items')).toHaveLength(1);
  } else {
    fireEvent.click(marker); fireEvent.click(view.getByRole('button', { name: 'Delete' }));
    expect(store.get('__prism.feedback.amount.items')).toEqual([]);
    act(() => store.undo('__prism.feedback.amount'));
    expect(view.getByRole('button', { name: 'Comment 1: Legacy annotation' })).toBeTruthy();
    act(() => store.redo('__prism.feedback.amount'));
    view.unmount();
    const restored = render(ui());
    fireEvent.click(restored.getByRole('button', { name: 'Give feedback' }));
    expect(restored.queryByRole('button', { name: 'Comment 1: Legacy annotation' })).toBeNull();
  }
});
test('inline numeric feedback is a sibling control in a reserved end gutter', async () => {
  const view = render(<Prism feedback source={':num[1200]{id=budget}'} animate={false} />);
  const slider = view.getByRole('slider'), bubble = view.getByRole('button', { name: 'Give feedback' });
  expect(slider.contains(bubble)).toBe(false);
  expect(bubble.parentElement?.hasAttribute('data-inline')).toBe(true);
  fireEvent.click(slider);
  expect(view.getByRole('spinbutton')).toBeTruthy();
  const css = await Bun.file(new URL('../src/feedback.css', import.meta.url)).text();
  expect(css).toContain('[data-inline]:has([data-prism="num"]) { padding-inline-end: 26px; pointer-events: none; }');
  expect(css).toContain('width: 22px; height: 22px;');
});
const source = '```ui:feedback-test\n{"id":"target"}\n```';
const View = () => <button>Actual input</button>;
function change(element: HTMLElement, value: string) { act(() => element.focus()); fireEvent.focus(element); fireEvent.change(element, { target: { value } }); fireEvent.keyUp(element, { key: 'Unidentified' }); }

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
  fireEvent.click(view.getByRole('button', { name: 'Submit feedback' }));
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
  expect(view.getByRole('button', { name: 'Submit feedback' }).hasAttribute('disabled')).toBe(true);
  expect(actions).toEqual([]);
  expect(store.snapshot()).toEqual({});
  view.rerender(<Prism store={store} renderers={{ 'feedback-test': disabled }} feedback source={source} />);
  expect(view.queryByRole('button', { name: 'Give feedback' })).toBeNull();
});
