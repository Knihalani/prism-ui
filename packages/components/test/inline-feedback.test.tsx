import '../../react/test/setup';
import { afterEach, expect, test } from 'bun:test';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { Prism, defineRenderer, type Action } from '@prism-ui/react';
import { createStore } from '@prism-ui/state';
import '../src/feedback';
import '../src/num';

afterEach(cleanup);
const source = '```ui:feedback-test\n{"id":"target"}\n```';
const View = () => <button>Actual input</button>;
function change(element: HTMLElement, value: string) { act(() => element.focus()); fireEvent.change(element, { target: { value } }); fireEvent.keyUp(element, { key: 'Unidentified' }); }

test('opening and closing inline feedback preserve unrelated undo and redo', () => {
  const store = createStore();
  store.set('budget', 1); store.set('budget', 2); store.undo();
  const view = render(<Prism store={store} renderers={{ 'feedback-test': View }} feedback source={source} />);
  fireEvent.click(view.getByRole('button', { name: 'Give feedback' }));
  expect(store.canUndo('target')).toBe(false);
  expect(store.canRedo()).toBe(true);
  fireEvent.click(view.getByRole('button', { name: 'Close feedback' }));
  expect(store.canUndo('target')).toBe(false);
  expect(store.canRedo()).toBe(true);
  act(() => store.redo());
  expect(store.get('budget')).toBe(2);
});

test('user feedback saves clear stale store redo so it cannot erase the draft or submission', () => {
  const store = createStore();
  store.set('budget', 1); store.set('budget', 2); store.undo();
  const view = render(<Prism store={store} renderers={{ 'feedback-test': View }} feedback source={source} />);
  fireEvent.click(view.getByRole('button', { name: 'Give feedback' }));
  expect(store.canRedo()).toBe(true);
  fireEvent.keyDown(view.getByRole('application'), { key: 'Enter' });
  change(view.getByPlaceholderText('Add a comment…'), 'A saved annotation');
  fireEvent.click(view.getByRole('button', { name: 'Save' }));
  change(view.getByRole('textbox', { name: 'Overall feedback' }), 'A saved overall comment');
  fireEvent.click(view.getByRole('button', { name: 'Submit feedback' }));
  expect(store.canRedo()).toBe(false);
  expect(store.canUndo('target')).toBe(true);
  const saved = store.get('target.inlineFeedback');
  act(() => store.redo());
  expect(store.get('budget')).toBe(1);
  expect(store.get('target.inlineFeedback')).toEqual(saved);
  expect(store.get('target.inlineFeedback')).toMatchObject({ submitted: true, feedback: { overall: 'A saved overall comment', items: [{ comment: 'A saved annotation' }] } });
});

for (const replacement of ['id', 'store'] as const) for (const saved of [false, true]) {
  test(`feedback reloads ${saved ? 'saved' : 'empty'} drafts when its ${replacement} changes`, () => {
    const store = createStore(), nextStore = replacement === 'store' ? createStore() : store;
    const nextId = replacement === 'id' ? 'replacement' : 'target';
    if (saved) nextStore.set(`${nextId}.inlineFeedback.feedback`, { items: [], overall: 'Saved for replacement' }, { history: false });
    const ui = (text: string, activeStore = store) => <Prism store={activeStore} renderers={{ 'feedback-test': View }} feedback source={text} />;
    const view = render(ui(source));
    fireEvent.click(view.getByRole('button', { name: 'Give feedback' }));
    fireEvent.keyDown(view.getByRole('application'), { key: 'Enter' });
    change(view.getByPlaceholderText('Add a comment…'), 'Original pin');
    fireEvent.click(view.getByRole('button', { name: 'Save' }));
    change(view.getByRole('textbox', { name: 'Overall feedback' }), 'Original draft');
    view.rerender(ui(source.replace('target', nextId), nextStore));
    expect((view.getByRole('textbox', { name: 'Overall feedback' }) as HTMLTextAreaElement).value).toBe(saved ? 'Saved for replacement' : '');
    expect(nextStore.get(`${nextId}.inlineFeedback.feedback`)).toMatchObject({ items: [], overall: saved ? 'Saved for replacement' : '' });
    expect(store.get('target.inlineFeedback.feedback')).toMatchObject({ overall: 'Original draft', items: [{ comment: 'Original pin' }] });
  });
}

test('feedback reloads migrated drafts on streaming finalization without remounting the renderer', () => {
  const store = createStore();
  const ui = (done: boolean) => <Prism store={store} renderers={{ 'feedback-test': View }} feedback done={done} source={done ? source : source.slice(0, -3)} />;
  const view = render(ui(false)), input = view.getByText('Actual input');
  fireEvent.click(view.getByRole('button', { name: 'Give feedback' }));
  change(view.getByRole('textbox', { name: 'Overall feedback' }), 'Keep this draft');
  view.rerender(ui(true));
  expect((view.getByRole('textbox', { name: 'Overall feedback' }) as HTMLTextAreaElement).value).toBe('Keep this draft');
  expect(store.get('target.inlineFeedback.feedback')).toMatchObject({ overall: 'Keep this draft' });
  expect(view.getByText('Actual input')).toBe(input);
});

test('an unsaved annotation comment survives ID finalization and saves under the final target', () => {
  const store = createStore(), actions: Action[] = [];
  const ui = (done: boolean) => <Prism store={store} renderers={{ 'feedback-test': View }} feedback done={done} source={done ? source : source.slice(0, -3)} onAction={action => actions.push(action)} />;
  const view = render(ui(false)), input = view.getByText('Actual input');
  fireEvent.click(view.getByRole('button', { name: 'Give feedback' }));
  fireEvent.keyDown(view.getByRole('application'), { key: 'Enter' });
  const comment = view.getByPlaceholderText('Add a comment…');
  change(comment, 'Unsaved while streaming');
  view.rerender(ui(true));
  expect(view.getByPlaceholderText('Add a comment…')).toBe(comment);
  expect((comment as HTMLTextAreaElement).value).toBe('Unsaved while streaming');
  expect(view.getByText('Actual input')).toBe(input);
  fireEvent.click(view.getByRole('button', { name: 'Save' }));
  fireEvent.click(view.getByRole('button', { name: 'Submit feedback' }));
  expect(store.get('target.inlineFeedback.feedback')).toMatchObject({ items: [{ comment: 'Unsaved while streaming' }] });
  expect(actions).toHaveLength(1);
  expect(actions[0].payload).toMatchObject({ target: { name: 'feedback-test', id: 'target' }, items: [{ comment: 'Unsaved while streaming' }] });
});

test('feedback preserves valid phrasing content for inline built-ins, including the open editor', () => {
  const view = render(<Prism feedback source="Budget :num[3]{id=quantity} per seat." />);
  const paragraph = view.container.querySelector('p')!;
  expect(paragraph.querySelector('.prism-inline-feedback')?.tagName).toBe('SPAN');
  expect(paragraph.querySelector('[data-inline]')).not.toBeNull();
  fireEvent.click(view.getByRole('button', { name: 'Give feedback' }));
  fireEvent.keyDown(view.getByRole('application'), { key: 'Enter' });
  expect(paragraph.querySelector('div')).toBeNull();
  expect(paragraph.textContent).toContain('per seat.');
});

test('inline feedback reuses keyboard pin/comment UI and submits one targeted percent-space payload', () => {
  const actions: Action[] = [];
  const view = render(<Prism renderers={{ 'feedback-test': View }} feedback source={source} onAction={action => actions.push(action)} />);
  const input = view.getByText('Actual input');
  expect(view.queryByRole('application')).toBeNull();
  fireEvent.click(view.getByRole('button', { name: 'Give feedback' }));
  expect(view.getByRole('button', { name: 'Submit feedback' }).hasAttribute('disabled')).toBe(true);
  fireEvent.keyDown(view.getByRole('application'), { key: 'Enter' });
  change(view.getByPlaceholderText('Add a comment…'), 'Make this easier to see');
  fireEvent.click(view.getByRole('button', { name: 'Save' }));
  change(view.getByRole('textbox', { name: 'Overall feedback' }), 'A good first direction');
  fireEvent.click(view.getByRole('button', { name: 'Submit feedback' }));
  expect(actions).toHaveLength(1);
  expect(actions[0]).toMatchObject({ type: 'feedback', component: 'feedback-test', id: 'target', payload: { target: { name: 'feedback-test', id: 'target' }, coordinates: 'percent', overall: 'A good first direction', items: [{ n: 1, kind: 'pin', x: 50, y: 50, comment: 'Make this easier to see' }] } });
  expect(view.queryByRole('button', { name: 'Submit feedback' })).toBeNull();
  expect(view.getByText('Actual input')).toBe(input);
  fireEvent.keyDown(view.getByText('Edit feedback'), { key: 'Escape' });
  expect(view.queryByRole('textbox', { name: 'Overall feedback' })).toBeNull();
  expect(document.activeElement).toBe(view.getByRole('button', { name: 'Give feedback' }));
});

test('definitions can opt in or out; empty and canceled feedback sends nothing', () => {
  const enabled = defineRenderer('feedback-enabled-test', View, { feedback: true });
  const disabled = defineRenderer('feedback-disabled-test', View, { feedback: false });
  const actions: Action[] = [];
  const view = render(<Prism renderers={{ 'feedback-test': enabled }} source={source} onAction={a => actions.push(a)} />);
  fireEvent.click(view.getByRole('button', { name: 'Give feedback' }));
  fireEvent.keyDown(view.getByRole('application'), { key: 'Enter' });
  fireEvent.keyDown(view.getByPlaceholderText('Add a comment…'), { key: 'Escape' });
  expect(view.getByRole('button', { name: 'Submit feedback' }).hasAttribute('disabled')).toBe(true);
  expect(actions).toEqual([]);
  view.rerender(<Prism renderers={{ 'feedback-test': disabled }} feedback source={source} />);
  expect(view.queryByRole('button', { name: 'Give feedback' })).toBeNull();
});
