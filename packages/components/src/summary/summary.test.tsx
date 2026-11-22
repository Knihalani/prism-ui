import '../../../react/test/setup';
import { afterEach, expect, test } from 'bun:test';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { Prism, defaultRegistry, type Action } from '@prism-ui/react';
import { createStore } from '@prism-ui/state';
import './index';
import type { SummarySlotProps } from './summary';

afterEach(cleanup);
const props = {
  id: 'review', title: 'Launch review',
  points: [{ text: 'Ready to launch', source: { quote: 'All checks passed.', title: 'Readiness report', url: 'https://example.com/report' } }, { text: 'Roll out gradually', source: { quote: 'Three waves.', title: 'Rollout plan', url: 'https://docs.example.com/plan' } }, { text: 'Keep current pricing' }],
  actions: [{ text: 'Publish guide', owner: 'Maya Chen', due: '2020-01-15' }, { text: 'Schedule rollout', owner: 'Jon Bell', due: 'Next week' }],
};
const source = '```ui:summary\n' + JSON.stringify(props) + '\n```';
function pointButtons(view: ReturnType<typeof render>) { return Array.from(view.container.querySelectorAll<HTMLButtonElement>('[data-part="pointButton"]')); }

test('Undo after sending resets the receipt and allows sending the restored checklist', async () => {
  const actions: Action[] = [];
  const view = render(<Prism source={source} onAction={action => actions.push(action)} />);
  fireEvent.click(view.getAllByRole('checkbox')[0]);
  await act(async () => { fireEvent.click(view.getByRole('button', { name: 'Send action items' })); });
  expect((view.getByRole('button', { name: /Sent/ }) as HTMLButtonElement).disabled).toBe(true);
  fireEvent.click(view.getByRole('button', { name: 'Undo' }));
  expect((view.getAllByRole('checkbox')[0] as HTMLInputElement).checked).toBe(false);
  const send = view.getByRole('button', { name: 'Send action items' }) as HTMLButtonElement;
  expect(send.disabled).toBe(false);
  await act(async () => { fireEvent.click(send); });
  expect((actions.at(-1)!.payload as { actions: { done: boolean }[] }).actions[0].done).toBe(false);
});

test('summary renders frame, numbered citations, checklist owners and formatted due dates', () => {
  const view = render(<Prism source={source} locale="en-US" />);
  expect(view.getByRole('group', { name: 'Launch review' }).className).toBe('prism-frame__root prism-summary__root');
  expect(view.getByRole('group').getAttribute('data-state')).toBe('done');
  expect(view.getByRole('group').hasAttribute('data-prism-enter')).toBe(true);
  expect(view.getByRole('heading', { name: 'Action items' })).toBeDefined();
  expect(pointButtons(view).length).toBe(2); expect(pointButtons(view)[0].textContent).toBe('Ready to launch1');
  expect(view.getByText('Keep current pricing').tagName).toBe('P');
  expect(view.getAllByRole('checkbox').length).toBe(2); expect(view.getByText('MC').getAttribute('aria-hidden')).toBe('true');
  expect(view.getByText('Jan 15, 2020').getAttribute('data-tone')).toBe('warning'); expect(view.getByText('Next week')).toBeDefined();
  expect(view.getByRole('button', { name: 'Undo' })).toBeDefined();
  expect((view.getByRole('button', { name: 'Send action items' }) as HTMLButtonElement).disabled).toBe(false);
  view.container.querySelectorAll('[data-prism="summary"]').forEach(part => expect(part.classList.contains('prism-summary__' + part.getAttribute('data-part'))).toBe(true));
  expect(defaultRegistry.docs()).toContain('### summary'); expect(defaultRegistry.docs()).toContain('Summary bullets with optional inline citations');
});

test('point and citation expand/collapse an accessible source with a safe hostname link', () => {
  const view = render(<Prism source={source} />), button = pointButtons(view)[0];
  const panel = document.getElementById(button.getAttribute('aria-controls')!)!;
  expect(button.getAttribute('aria-expanded')).toBe('false'); expect(panel.getAttribute('aria-hidden')).toBe('true');
  fireEvent.click(button.querySelector('[data-part="citation"]')!);
  expect(button.getAttribute('aria-expanded')).toBe('true'); expect(panel.getAttribute('data-expanded')).toBe(''); expect(panel.getAttribute('aria-hidden')).toBe('false');
  expect(panel.querySelector('blockquote')?.textContent).toBe('All checks passed.');
  const link = view.getByRole('link', { name: 'example.com' });
  expect(link.getAttribute('href')).toBe('https://example.com/report'); expect(link.getAttribute('target')).toBe('_blank'); expect(link.getAttribute('rel')).toBe('noopener noreferrer');
  fireEvent.click(button); expect(button.getAttribute('aria-expanded')).toBe('false');
});

test('per-point ask and send emit full exact actions and human messages', () => {
  const actions: Action[] = [], view = render(<Prism source={source} onAction={action => actions.push(action)} />);
  fireEvent.click(view.getByRole('button', { name: 'Ask about point 1' }));
  expect(actions[0]).toEqual({ type: 'ask', component: 'summary', id: 'review', payload: { point: 0, text: props.points[0].text, source: props.points[0].source }, context: { component: 'summary', props, state: { done: {} } }, message: 'Tell me more about this point: Ready to launch' });
  fireEvent.click(view.getByRole('button', { name: 'Ask about point 3' }));
  expect(actions[1].payload).toEqual({ point: 2, text: 'Keep current pricing', source: undefined });
  fireEvent.click(view.getByRole('checkbox', { name: 'Publish guide' }));
  fireEvent.click(view.getByRole('button', { name: 'Send action items' }));
  expect(actions[2]).toEqual({ type: 'send', component: 'summary', id: 'review', payload: { title: 'Launch review', actions: [{ ...props.actions[0], done: true }, { ...props.actions[1], done: false }] }, context: { component: 'summary', props, state: { done: { 0: true } } }, message: 'Please send these 2 action items: Publish guide; Schedule rollout.' });
  fireEvent.click(view.getByRole('button', { name: 'Ask about this' }));
  expect(actions[3].payload).toBeUndefined(); expect(actions[3].message).toBe('Tell me more about this summary…');
});

test('checkbox state responds to undo, keyboard undo and agent patches', () => {
  const store = createStore(), view = render(<Prism source={source} store={store} />);
  const checkbox = view.getByRole('checkbox', { name: 'Publish guide' }) as HTMLInputElement;
  fireEvent.click(checkbox); expect(checkbox.checked).toBe(true); expect(store.get('review.done.0')).toBe(true);
  fireEvent.click(view.getByRole('button', { name: 'Undo' })); expect(checkbox.checked).toBe(false);
  fireEvent.click(checkbox); fireEvent.keyDown(checkbox, { key: 'z', ctrlKey: true }); expect(checkbox.checked).toBe(false);
  act(() => store.apply({ set: { 'review.done.0': true, 'review.done.1': true } }));
  expect(checkbox.checked).toBe(true); expect(view.getByText('2 of 2 complete')).toBeDefined();
  view.rerender(<Prism source={source} store={store} theme="dark" />);
  expect((view.getByRole('checkbox', { name: 'Publish guide' }) as HTMLInputElement).checked).toBe(true);
});

test('arrow keys cycle all points in both directions without toggling sources', () => {
  const view = render(<Prism source={source} />), buttons = pointButtons(view);
  const plain = view.getByText('Keep current pricing');
  expect(plain.tabIndex).toBe(0);
  expect(plain.hasAttribute('aria-expanded')).toBe(false);
  act(() => buttons[0].focus());
  for (const target of [buttons[1], plain, buttons[0]]) {
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowDown' });
    expect(document.activeElement).toBe(target);
  }
  for (const target of [plain, buttons[1], buttons[0]]) {
    fireEvent.keyDown(document.activeElement!, { key: 'ArrowUp' });
    expect(document.activeElement).toBe(target);
  }
  expect(buttons.every(button => button.getAttribute('aria-expanded') === 'false')).toBe(true);
  view.rerender(<Prism source={'```ui:summary\n{"points":[{"text":"Only plain point"}]}\n```'} />);
  const only = view.getByText('Only plain point');
  act(() => only.focus());
  fireEvent.keyDown(only, { key: 'ArrowDown' }); expect(document.activeElement).toBe(only);
  fireEvent.keyDown(only, { key: 'ArrowUp' }); expect(document.activeElement).toBe(only);
  view.rerender(<Prism source={'```ui:summary\n{"points":[]}\n```'} />);
  expect(view.getByText('No summary points yet.')).toBeDefined();
});

test('streaming skeletons are presentational and preserve restored checklist progress', () => {
  const store = createStore();
  const view = render(<Prism source={'\`\`\`ui:summary\n{'} done={false} store={store} />);
  expect(view.container.querySelector('[data-prism-skeleton]')).not.toBeNull();
  expect(view.queryByRole('checkbox')).toBeNull();
  expect(store.get('summary:0')).toBeUndefined();
  act(() => store.set('review.done', { 0: true }));
  view.rerender(<Prism source={source} store={store} />);
  expect((view.getByRole('checkbox', { name: 'Publish guide' }) as HTMLInputElement).checked).toBe(true);
  expect((view.getByRole('button', { name: 'Send action items' }) as HTMLButtonElement).disabled).toBe(false);
});

test('empty and invalid data are safe, unsafe source URLs are not links, optional send keys are retained', () => {
  const actions: Action[] = [], view = render(<Prism source={'```ui:summary\n{"points":"bad","actions":"bad"}\n```'} />);
  expect(view.getByText('No summary points yet.')).toBeDefined(); expect(view.getByText('No action items.')).toBeDefined();
  expect((view.getByRole('button', { name: 'Send action items' }) as HTMLButtonElement).disabled).toBe(true);
  view.rerender(<Prism source={'```ui:summary\n{"id":"safe","points":[{"text":"Evidence","source":{"url":"javascript:alert(1)"}}],"actions":[{"text":"Follow up"}]}\n```'} onAction={action => actions.push(action)} />);
  fireEvent.click(pointButtons(view)[0]); expect(view.queryByRole('link')).toBeNull();
  fireEvent.click(view.getByRole('button', { name: 'Send action items' }));
  expect(actions[0].payload).toEqual({ title: undefined, actions: [{ text: 'Follow up', owner: undefined, due: undefined, done: false }] });
});

test('summary respects unstyled mode and header, point, source, action, empty and footer slots', () => {
  function Item({ children, summary, point, action, ...props }: React.HTMLAttributes<HTMLLIElement> & Partial<SummarySlotProps>) { return <li {...props} data-slot="item">{children}</li>; }
  function Panel({ children, summary, point, action, ...props }: React.HTMLAttributes<HTMLDivElement> & Partial<SummarySlotProps>) { return <div {...props} data-slot="source">{children}</div>; }
  function Header({ children }: { children?: React.ReactNode }) { return <header data-slot="header">{children}</header>; }
  function Footer({ children }: { children?: React.ReactNode }) { return <footer data-slot="footer">{children}</footer>; }
  function Empty({ children }: { children?: React.ReactNode }) { return <p data-slot="empty">{children}</p>; }
  const slots = { summary: { header: Header, footer: Footer, point: Item, action: Item, source: Panel, empty: Empty } };
  const view = render(<Prism source={source} unstyled animate={false} slots={slots} styles={{ summary: { root: { color: 'red' } } }} />);
  expect(view.getByRole('group').style.color).toBe('red');
  expect(view.container.querySelectorAll('[data-slot="item"]').length).toBe(5); expect(view.container.querySelector('[data-slot="source"]')).not.toBeNull();
  expect(view.container.querySelector('[data-slot="header"]')).not.toBeNull(); expect(view.container.querySelector('[data-slot="footer"]')).not.toBeNull();
  view.container.querySelectorAll('[data-prism="summary"]').forEach(part => { expect(part.className).toBe(''); expect(part.hasAttribute('data-prism-enter')).toBe(false); });
  view.rerender(<Prism source={'```ui:summary\n{}\n```'} slots={slots} />);
  expect(view.container.querySelectorAll('[data-slot="empty"]').length).toBe(2);
});
