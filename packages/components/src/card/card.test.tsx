import '../../../react/test/setup';
import { afterEach, expect, test } from 'bun:test';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { Prism, defaultRegistry, type Action } from '@prism-ui/react';
import { cardDef } from './index';

afterEach(cleanup);

test('card only links safe URL protocols and relative references', () => {
  const view = render(<Prism source="" />);
  for (const href of ['https://example.com', 'http://example.com', 'mailto:a@example.com', '/plan', '../plan', '#plan', '//example.com', 'javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'java\tscript:alert(1)', 'data:text/html,hello', 'vbscript:hello', 'file:///etc/passwd', '', 'http://[']) {
    view.rerender(<Prism source={':::card{title="Plan" href=' + JSON.stringify(href) + '}\nBody\n:::'} />);
    const allowed = ['https://example.com', 'http://example.com', 'mailto:a@example.com', '/plan', '../plan', '#plan', '//example.com'].includes(href);
    expect(view.queryByRole('link', { name: 'Plan' })?.getAttribute('href') ?? null).toBe(allowed ? href : null);
    expect(root(view.container).hasAttribute('data-linked')).toBe(allowed);
    expect(view.getByRole('heading', { name: 'Plan' })).toBeDefined();
  }
});

const source = ":::card{id=demo title=\"Plan\" subtitle=\"Details\" href=\"/plan\" action=\"Choose\"}\nBody text\n:::";
function root(container: HTMLElement) { return container.querySelector('[data-prism="card"][data-part="root"]') as HTMLElement; }

test('card renders semantic parts and documented defaults', () => {
  const view = render(<Prism source={source} />);
  const element = root(view.container);
  expect(element.classList.contains('prism-card__root')).toBe(true);
  expect(element.dataset.state).toBe('done');
  expect(element.hasAttribute('data-prism-enter')).toBe(true);
  element.querySelectorAll('[data-prism="card"]').forEach(part => expect(part.classList.contains('prism-card__' + part.getAttribute('data-part'))).toBe(true));
  expect(defaultRegistry.docs()).toContain('### card');
  expect(cardDef.syntax).toBe('container');
  expect(view.getByRole('group', { name: 'Plan' })).toBe(element);
  expect(view.getByRole('link', { name: 'Plan' }).getAttribute('href')).toBe('/plan');
  expect(view.getByText('Details')).toBeDefined(); expect(element.dataset.size).toBe('md');
});

test('card tolerates partial attributes, streams open content, then finishes', () => {
  const view = render(<Prism source={":::card{title=\"Par}\n"} done={false} />);
  expect(root(view.container)?.dataset.state).toBe('streaming');
  view.rerender(<Prism source={":::card{id=demo title=\"Plan\" subtitle=\"Details\" href=\"/plan\" action=\"Choose\"}\n"} done={false} />);
  expect(root(view.container)?.dataset.state).toBe('streaming');
  expect(view.getByText('Plan')).toBeDefined();
  view.rerender(<Prism source={":::card{id=demo title=\"Plan\" subtitle=\"Details\" href=\"/plan\" action=\"Choose\"}\nBody text\n:::"} done />);
  expect(root(view.container).dataset.state).toBe('done');
});

test('card supports empty content, invalid attributes, slots and unstyled mode', () => {
  const empty = ":::card{tone=invalid cols=bad size=invalid}\n:::";
  const view = render(<Prism source={empty} />);
  expect(root(view.container)).not.toBeNull();
  expect(view.container.querySelector('[data-part="skeleton"]')).not.toBeNull();
  function Body({ children, ...props }: React.HTMLAttributes<HTMLElement>) { return <em {...props}>{children} replaced</em>; }
  view.rerender(<Prism source={source} unstyled animate={false} slots={{ card: { body: Body } }} styles={{ card: { root: { color: 'red' } } }} />);
  const element = root(view.container);
  expect(element.className).toBe('');
  expect(element.style.color).toBe('red');
  expect(element.hasAttribute('data-prism-enter')).toBe(false);
  expect(element.querySelector('em')?.textContent).toContain('replaced');
  element.querySelectorAll('[class]').forEach(part => expect(part.className).not.toContain('prism-'));
});

test('card ask emits an exact action and native buttons remain keyboard focusable', () => {
  const actions: Action[] = [], view = render(<Prism source={source} onAction={action => actions.push(action)} />);
  const ask = view.getByRole('button', { name: 'Ask about this' }) as HTMLButtonElement;
  expect(ask.tagName).toBe('BUTTON'); expect(ask.tabIndex).toBe(0); expect(ask.disabled).toBe(false);
  act(() => ask.focus()); expect(document.activeElement).toBe(ask);
  fireEvent.click(ask);
  expect(actions).toEqual([{ type: 'ask', component: 'card', id: 'demo', payload: undefined, context: { component: 'card', props: {"id":"demo","title":"Plan","subtitle":"Details","href":"/plan","action":"Choose","variant":"outline","size":"md"}, state: undefined }, message: 'Tell me more about this card…' }]);
  const action = view.getByRole('button', { name: 'Choose' }) as HTMLButtonElement;
  expect(action.tabIndex).toBe(0); act(() => action.focus()); expect(document.activeElement).toBe(action);
  fireEvent.click(action);
  expect(actions[1]).toEqual({ type: 'select', component: 'card', id: 'demo', payload: { title: 'Plan', href: '/plan' }, context: { component: 'card', props: {"id":"demo","title":"Plan","subtitle":"Details","href":"/plan","action":"Choose","variant":"outline","size":"md"}, state: undefined }, message: 'User select in card: {"title":"Plan","href":"/plan"}' });
});

test('card reserves image media and selects with explicitly undefined optional keys', () => {
  const actions: Action[] = [];
  const view = render(<Prism source={':::card{id=empty image="/cover.png" action="Choose"}\n:::'} onAction={action => actions.push(action)} />);
  expect(view.container.querySelector('img')?.getAttribute('src')).toBe('/cover.png');
  fireEvent.click(view.getByRole('button', { name: 'Choose' }));
  expect(actions).toEqual([{ type: 'select', component: 'card', id: 'empty', payload: { title: undefined, href: undefined }, context: { component: 'card', props: { id: 'empty', image: '/cover.png', action: 'Choose', variant: 'outline', size: 'md' }, state: undefined }, message: 'User select in card: {}' }]);
});
