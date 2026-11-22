import '../../react/test/setup';
import { afterEach, expect, test } from 'bun:test';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { Prism, type Action } from '@prism-ui/react';
import { createStore } from '@prism-ui/state';
import { createFeedback } from '../src/mockup/engine';
import '../src/feedback';

afterEach(cleanup);
const source = '```ui:feedback-review\n{"id":"target"}\n```';
const View = () => <button>Target</button>;
function change(element: HTMLElement, value: string) { act(() => element.focus()); fireEvent.focus(element); fireEvent.change(element, { target: { value } }); fireEvent.keyUp(element, { key: 'Unidentified' }); }
function setup(saved = createFeedback({ overall: 'Saved' }).toJSON()) {
  const store = createStore({ initial: { target: { feedback: saved } } }), actions: Action[] = [];
  store.set('target.feedback.overall', 'Newer saved');
  const view = render(<Prism store={store} renderers={{ 'feedback-review': View }} feedback source={source} onAction={a => actions.push(a)} />);
  fireEvent.click(view.getByRole('button', { name: 'Give feedback' }));
  return { view, store, actions };
}

test('native text undo wins over feedback history for focused fields and dirty drafts', () => {
  const { view, store } = setup(), overall = view.getByRole('textbox', { name: 'Overall feedback' });
  for (const modifier of ['ctrlKey', 'metaKey']) {
    expect(fireEvent.keyDown(overall, { key: 'z', [modifier]: true })).toBe(true);
    change(overall, 'Unsaved text');
    expect(fireEvent.keyDown(overall, { key: 'z', [modifier]: true })).toBe(true);
    expect(fireEvent.keyDown(view.getByRole('application'), { key: 'z', [modifier]: true })).toBe(true);
    expect(store.get('target.feedback.overall')).toBe('Newer saved');
  }
  change(overall, 'Newer saved');
  expect(fireEvent.keyDown(view.getByRole('application'), { key: 'z', ctrlKey: true })).toBe(false);
  expect(store.get('target.feedback.overall')).toBe('Saved');
});

test('tabbing through Submit commits an overall comment without submitting it', () => {
  const { view, store, actions } = setup(), overall = view.getByRole('textbox', { name: 'Overall feedback' }), submit = view.getByRole('button', { name: 'Submit feedback' });
  change(overall, 'Saved when leaving the field');
  fireEvent.blur(overall, { relatedTarget: submit });
  act(() => submit.focus());
  act(() => view.getByRole('button', { name: 'Target' }).focus());
  expect(store.get('target.feedback.overall')).toBe('Saved when leaving the field');
  expect(actions).toEqual([]);
  act(() => store.undo('target'));
  expect(store.get('target.feedback.overall')).toBe('Newer saved');
});

for (const kind of ['pin', 'region'] as const) test(`clearing the only ${kind} comment cannot submit empty feedback`, () => {
  const saved = createFeedback();
  if (kind === 'pin') saved.addPin({ x: 30, y: 40, comment: 'Only comment' });
  else saved.addRegion({ x: 30, y: 40, w: 20, h: 20, comment: 'Only comment' });
  const { view, store, actions } = setup(saved.toJSON());
  act(() => store.set('target.feedback.overall', ''));
  fireEvent.click(view.getByRole('button', { name: 'Comment 1: Only comment' }));
  change(view.getByPlaceholderText('Add a comment…'), '   ');
  const before = store.snapshot(), submit = view.getByRole('button', { name: 'Submit feedback' });
  expect(submit.hasAttribute('disabled')).toBe(true);
  fireEvent.click(submit);
  expect(actions).toEqual([]);
  expect(store.snapshot()).toEqual(before);
  change(view.getByRole('textbox', { name: 'Overall feedback' }), 'A meaningful overall comment');
  expect(view.getByRole('button', { name: 'Submit feedback' }).hasAttribute('disabled')).toBe(false);
  fireEvent.click(view.getByRole('button', { name: 'Submit feedback' }));
  expect(actions).toHaveLength(1);
  expect(actions[0].payload).toMatchObject({ mockup: 'feedback-review', overall: 'A meaningful overall comment', items: [] });
});

test('comment portals follow the target into fullscreen and return without losing text', () => {
  const descriptor = Object.getOwnPropertyDescriptor(document, 'fullscreenElement');
  const { view } = setup(), target = view.container.querySelector<HTMLElement>('.prism-inline-feedback__target')!;
  const fullscreen = (element: Element | null) => act(() => { Object.defineProperty(document, 'fullscreenElement', { configurable: true, value: element }); document.dispatchEvent(new Event('fullscreenchange')); });
  try {
    fullscreen(target);
    fireEvent.keyDown(view.getByRole('application'), { key: 'Enter' });
    change(view.getByPlaceholderText('Add a comment…'), 'Fullscreen draft');
    expect(view.getByRole('dialog').closest('.prism-inline-feedback__popover-layer')?.parentElement).toBe(target);
    fullscreen(view.getByRole('button', { name: 'Target' }));
    expect(view.getByRole('dialog').closest('.prism-inline-feedback__popover-layer')?.parentElement).toBe(document.body);
    fullscreen(target);
    expect(target.contains(view.getByRole('dialog'))).toBe(true);
    fullscreen(null);
    expect((view.getByPlaceholderText('Add a comment…') as HTMLTextAreaElement).value).toBe('Fullscreen draft');
    expect(view.getByRole('dialog').closest('.prism-inline-feedback__popover-layer')?.parentElement).toBe(document.body);
  } finally { if (descriptor) Object.defineProperty(document, 'fullscreenElement', descriptor); else delete (document as any).fullscreenElement; }
});
