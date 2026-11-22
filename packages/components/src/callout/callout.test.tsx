import '../../../react/test/setup';
import { afterEach, expect, test } from 'bun:test';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { Prism, defaultRegistry, type Action } from '@prism-ui/react';
import { calloutDef } from './index';

afterEach(cleanup);

const source = ":::callout{id=demo title=\"Notice\" tone=warning}\nBody text\n:::";
function root(container: HTMLElement) { return container.querySelector('[data-prism="callout"][data-part="root"]') as HTMLElement; }

test('callout renders semantic parts and documented defaults', () => {
  const view = render(<Prism source={source} />);
  const element = root(view.container);
  expect(element.classList.contains('prism-callout__root')).toBe(true);
  expect(element.dataset.state).toBe('done');
  expect(element.hasAttribute('data-prism-enter')).toBe(true);
  element.querySelectorAll('[data-prism="callout"]').forEach(part => expect(part.classList.contains('prism-callout__' + part.getAttribute('data-part'))).toBe(true));
  expect(defaultRegistry.docs()).toContain('### callout');
  expect(calloutDef.syntax).toBe('container');
  expect(view.getByRole('note', { name: 'Notice' })).toBe(element);
  expect(element.dataset.tone).toBe('warning'); expect(element.dataset.variant).toBe('soft');
  expect(element.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
});

test('callout tolerates partial attributes, streams open content, then finishes', () => {
  const view = render(<Prism source={":::callout{title=\"Par}\n"} done={false} />);
  expect(root(view.container)?.dataset.state).toBe('streaming');
  view.rerender(<Prism source={":::callout{id=demo title=\"Notice\" tone=warning}\n"} done={false} />);
  expect(root(view.container)?.dataset.state).toBe('streaming');
  expect(view.getByText('Notice')).toBeDefined(); expect(view.container.querySelector('[data-part="skeleton"]')).not.toBeNull();
  view.rerender(<Prism source={":::callout{id=demo title=\"Notice\" tone=warning}\nBody text\n:::"} done />);
  expect(root(view.container).dataset.state).toBe('done');
});

test('callout supports empty content, invalid attributes, slots and unstyled mode', () => {
  const empty = ":::callout{tone=invalid cols=bad size=invalid}\n:::";
  const view = render(<Prism source={empty} />);
  expect(root(view.container)).not.toBeNull();
  expect(view.container.querySelector('[data-part="skeleton"]')).not.toBeNull();
  function Body({ children, ...props }: React.HTMLAttributes<HTMLElement>) { return <em {...props}>{children} replaced</em>; }
  view.rerender(<Prism source={source} unstyled animate={false} slots={{ callout: { body: Body } }} styles={{ callout: { root: { color: 'red' } } }} />);
  const element = root(view.container);
  expect(element.className).toBe('');
  expect(element.style.color).toBe('red');
  expect(element.hasAttribute('data-prism-enter')).toBe(false);
  expect(element.querySelector('em')?.textContent).toContain('replaced');
  element.querySelectorAll('[class]').forEach(part => expect(part.className).not.toContain('prism-'));
});

test('callout ask emits an exact action and native buttons remain keyboard focusable', () => {
  const actions: Action[] = [], view = render(<Prism source={source} onAction={action => actions.push(action)} />);
  const ask = view.getByRole('button', { name: 'Ask about this' }) as HTMLButtonElement;
  expect(ask.tagName).toBe('BUTTON'); expect(ask.tabIndex).toBe(0); expect(ask.disabled).toBe(false);
  act(() => ask.focus()); expect(document.activeElement).toBe(ask);
  fireEvent.click(ask);
  expect(actions).toEqual([{ type: 'ask', component: 'callout', id: 'demo', payload: undefined, context: { component: 'callout', props: {"id":"demo","tone":"warning","title":"Notice","variant":"soft","icon":true}, state: undefined }, message: 'Tell me more about this callout…' }]);
});
