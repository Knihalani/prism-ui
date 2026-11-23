import '../../react/test/setup';
import { afterEach, expect, test } from 'bun:test';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
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

test('feedback popover exits inertly, can reopen mid-exit, and keeps the submit pill for its receipt', async () => {
  const { view, actions } = setup();
  fireEvent.keyDown(view.getByRole('application'), { key: 'Enter' });
  const dialog = view.getByRole('dialog');
  change(view.getByPlaceholderText('Add a comment…'), 'Keep this overview');
  fireEvent.click(view.getByRole('button', { name: 'Save' }));
  expect(view.queryByRole('dialog')).toBeNull();
  expect(dialog.getAttribute('data-closing')).toBe(''); expect(dialog.hasAttribute('inert')).toBe(true);
  expect(dialog.getAttribute('aria-hidden')).toBe('true');
  fireEvent.click(view.getByRole('button', { name: 'Comment 1: Keep this overview' }));
  expect(view.getByRole('dialog')).toBe(dialog); expect(dialog.hasAttribute('inert')).toBe(false);
  const submit = view.getByRole('button', { name: /^Send \d+ comments?$/ });
  fireEvent.click(submit);
  expect(actions).toHaveLength(1); expect(submit.hasAttribute('data-sent')).toBe(true);
  expect(submit.querySelector('.prism-check-mark path')).not.toBeNull();
  expect(view.getByRole('button', { name: /^Sent ·/ })).toBe(submit);
  expect(dialog.hasAttribute('data-submitted')).toBe(true);
  expect(dialog.getAttribute('aria-hidden')).toBe('true'); expect(dialog.hasAttribute('inert')).toBe(true);
  expect(view.queryByRole('dialog')).toBeNull();
  await waitFor(() => expect(dialog.isConnected).toBe(false), { timeout: 1500 });
});

test('animate=false removes canceled feedback immediately and never sends an empty draft', () => {
  const actions: Action[] = [];
  const view = render(<Prism animate={false} feedback renderers={{ 'feedback-review': View }} source={source} onAction={action => actions.push(action)} />);
  fireEvent.click(view.getByRole('button', { name: 'Give feedback' }));
  fireEvent.keyDown(view.getByRole('application'), { key: 'Enter' });
  const dialog = view.getByRole('dialog');
  expect(view.getByRole('button', { name: /^Send \d+ comments?$/ }).hasAttribute('disabled')).toBe(true);
  fireEvent.keyDown(view.getByPlaceholderText('Add a comment…'), { key: 'Escape' });
  expect(dialog.isConnected).toBe(false); expect(actions).toHaveLength(0);
});

test('feedback motion uses transitions and leaves region geometry out of transition lists', async () => {
  const css = await Bun.file(new URL('../src/mockup/mockup.css', import.meta.url)).text();
  const shared = await Bun.file(new URL('../src/styles/motion.css', import.meta.url)).text();
  expect(shared.split('@media (prefers-reduced-motion: reduce)')[0]).not.toContain('prism-mockup__marker');
  expect(css).toContain('[data-animate="false"]');
  expect(css).toContain('scale var(--prism-motion-spring-bouncy-duration) var(--prism-motion-spring-bouncy)');
  expect(css).toContain('transition-timing-function: var(--prism-motion-ease-exit)');
  expect(css).toContain('transition-delay: var(--prism-motion-slow)');
  expect(css).toContain('transition: stroke-dashoffset var(--prism-motion-fast)');
  expect(css).not.toMatch(/transition:\s*(?:all|width|height|left|top)\b/);
  expect(css.match(/\.prism-mockup__(?:popover|marker)[^{]*\{[^}]*\}/g)?.filter(rule => !rule.includes('[data-created]') && !rule.includes('animation: none')).every(rule => !rule.includes('animation:'))).toBe(true);
});

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

test('inline feedback ignores the rendered component submitted flag', () => {
  const { view, store } = setup();
  act(() => store.set('target.submitted', true));
  expect(view.getByRole('textbox', { name: 'Overall feedback' })).toBeDefined();
  expect(view.queryByText('Edit feedback')).toBeNull();
  fireEvent.click(view.getByRole('button', { name: /^Send \d+ comments?$/ }));
  expect(store.get('target.feedback.submitted')).toBe(true);
  act(() => store.set('target.submitted', false));
  expect(view.getByText('Edit feedback')).toBeDefined();
  expect(store.get('target.feedback.submitted')).toBe(true);
});

test('tabbing through Submit commits an overall comment without submitting it', () => {
  const { view, store, actions } = setup(), overall = view.getByRole('textbox', { name: 'Overall feedback' }), submit = view.getByRole('button', { name: /^Send \d+ comments?$/ });
  change(overall, 'Saved when leaving the field');
  fireEvent.blur(overall, { relatedTarget: submit });
  act(() => submit.focus());
  act(() => view.getByRole('button', { name: 'Target' }).focus());
  expect(store.get('target.feedback.overall')).toBe('Saved when leaving the field');
  expect(actions).toEqual([]);
  act(() => store.undo('target'));
  expect(store.get('target.feedback.overall')).toBe('Newer saved');
});

test('overall blur into Submit merges the live text and receipt into one history entry', () => {
  const { view, store, actions } = setup(), before = store.get('target.feedback');
  const overall = view.getByRole('textbox', { name: 'Overall feedback' }), submit = view.getByRole('button', { name: /^Send \d+ comments?$/ });
  change(overall, 'Atomic submission');
  fireEvent.blur(overall, { relatedTarget: submit });
  expect(store.get('target.feedback')).toEqual(before);
  fireEvent.click(submit);
  expect(store.get('target.feedback')).toMatchObject({ overall: 'Atomic submission', submitted: true });
  expect(actions).toHaveLength(1);
  act(() => store.undo('target'));
  expect(store.get('target.feedback')).toEqual(before);
});

test('moving focus to another feedback editor Submit still commits the first comment', () => {
  const { view, store } = setup(), overall = view.getByRole('textbox', { name: 'Overall feedback' });
  change(overall, 'Belongs to this target');
  const otherSubmit = document.createElement('button'); otherSubmit.dataset.feedbackSubmit = '';
  document.body.appendChild(otherSubmit);
  try { fireEvent.blur(overall, { relatedTarget: otherSubmit }); expect(store.get('target.feedback.overall')).toBe('Belongs to this target'); }
  finally { otherSubmit.remove(); }
});

for (const kind of ['pin', 'region'] as const) test(`clearing the only ${kind} comment cannot submit empty feedback`, () => {
  const saved = createFeedback();
  if (kind === 'pin') saved.addPin({ x: 30, y: 40, comment: 'Only comment' });
  else saved.addRegion({ x: 30, y: 40, w: 20, h: 20, comment: 'Only comment' });
  const { view, store, actions } = setup(saved.toJSON());
  act(() => store.set('target.feedback.overall', ''));
  fireEvent.click(view.getByRole('button', { name: 'Comment 1: Only comment' }));
  change(view.getByPlaceholderText('Add a comment…'), '   ');
  const before = store.snapshot(), submit = view.getByRole('button', { name: /^Send \d+ comments?$/ });
  expect(submit.hasAttribute('disabled')).toBe(true);
  fireEvent.click(submit);
  expect(actions).toEqual([]);
  expect(store.snapshot()).toEqual(before);
  change(view.getByRole('textbox', { name: 'Overall feedback' }), 'A meaningful overall comment');
  expect(view.getByRole('button', { name: /^Send \d+ comments?$/ }).hasAttribute('disabled')).toBe(false);
  fireEvent.click(view.getByRole('button', { name: /^Send \d+ comments?$/ }));
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
