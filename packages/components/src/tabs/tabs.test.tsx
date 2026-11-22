import '../../../react/test/setup';
import { afterEach, expect, test } from 'bun:test';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { Prism, defaultRegistry, type Action } from '@prism-ui/react';
import { createStore } from '@prism-ui/state';
import './index';

afterEach(cleanup);
const start = '::::tabs{id=workspace label="Project"}\n:::tab{label="Overview" badge="3"}\nFirst panel\n:::\n';
const two = start + ':::tab{label="Details"}\nSecond panel\n:::\n';
const source = two + '::::';
function buttons(view: ReturnType<typeof render>) { return view.getAllByRole('tab') as HTMLButtonElement[]; }

test('tabs wires roles, labels, roving focus and mounted hidden panels', () => {
  const view = render(<Prism source={source} />);
  expect(view.getByRole('tablist', { name: 'Project' })).toBeDefined();
  const tabs = buttons(view), panels = view.getAllByRole('tabpanel', { hidden: true });
  expect(tabs.length).toBe(2); expect(tabs[0].textContent).toBe('Overview3');
  tabs.forEach((tab, index) => {
    expect(tab.getAttribute('aria-controls')).toBe(panels[index].id);
    expect(panels[index].getAttribute('aria-labelledby')).toBe(tab.id);
    expect(tab.tabIndex).toBe(index === 0 ? 0 : -1);
    expect(tab.getAttribute('aria-selected')).toBe(String(index === 0));
    expect((panels[index] as HTMLElement).hidden).toBe(index !== 0);
  });
  expect(view.getByText('Second panel')).toBeDefined();
  const root = view.container.querySelector('[data-prism="tabs"][data-part="root"]')!;
  expect(root.getAttribute('data-state')).toBe('done'); expect(root.getAttribute('data-variant')).toBe('underline');
  expect(root.className).toBe('prism-tabs__root');
  root.querySelectorAll('[data-prism]').forEach(part => expect(part.classList.contains('prism-' + part.getAttribute('data-prism') + '__' + part.getAttribute('data-part'))).toBe(true));
  expect(defaultRegistry.docs()).toContain('### tabs'); expect(defaultRegistry.docs()).toContain('### tab');
  expect(view.queryByRole('button', { name: 'Ask about this' })).toBeNull();
});

test('tabs keyboard automatically activates, wraps and updates persistent state without emitting', () => {
  const store = createStore(), actions: Action[] = [];
  const view = render(<Prism source={source} store={store} onAction={action => actions.push(action)} />);
  const tabs = buttons(view);
  act(() => tabs[0].focus());
  for (const [key, index] of [['ArrowLeft', 1], ['ArrowRight', 0], ['End', 1], ['Home', 0], ['ArrowRight', 1]] as const) {
    fireEvent.keyDown(document.activeElement!, { key });
    expect(document.activeElement).toBe(tabs[index]);
    expect(tabs[index].getAttribute('aria-selected')).toBe('true');
    expect(tabs[index].tabIndex).toBe(0); expect(tabs[1 - index].tabIndex).toBe(-1);
    expect(store.get('workspace.active')).toBe(index);
  }
  fireEvent.click(tabs[0]); expect(store.get('workspace.active')).toBe(0);
  expect(actions).toEqual([]);
});

test('agent store patches switch panels, retain DOM state and clamp invalid indices', () => {
  const store = createStore(), view = render(<Prism source={source} store={store} />);
  const panels = view.getAllByRole('tabpanel', { hidden: true }) as HTMLElement[];
  panels[0].dataset.preserved = 'yes';
  act(() => store.apply({ set: { 'workspace.active': 1 } }));
  expect(buttons(view)[1].getAttribute('aria-selected')).toBe('true'); expect(panels[0].hidden).toBe(true);
  act(() => store.apply({ set: { 'workspace.active': 0 } }));
  expect(view.getAllByRole('tabpanel', { hidden: true })[0]).toBe(panels[0]);
  expect(panels[0].dataset.preserved).toBe('yes'); expect(panels[1].hidden).toBe(true);
  act(() => store.set('workspace.active', 99)); expect(store.get('workspace.active')).toBe(1);
  act(() => store.set('workspace.active', -5)); expect(store.get('workspace.active')).toBe(0);
});

test('streaming partial labels and arriving tabs keep selection stable', () => {
  const store = createStore();
  const view = render(<Prism source={start + ':::tab{label="Det}\n'} done={false} store={store} />);
  expect(buttons(view).length).toBe(2); expect(buttons(view)[1].textContent).toBe('Det');
  expect(buttons(view)[0].getAttribute('aria-selected')).toBe('true');
  expect(view.container.querySelector('[data-prism="tabs"]')?.getAttribute('data-state')).toBe('streaming');
  view.rerender(<Prism source={two} done={false} store={store} />);
  fireEvent.click(buttons(view)[1]);
  const third = two + ':::tab\n';
  view.rerender(<Prism source={third} done={false} store={store} />);
  expect(buttons(view).length).toBe(3); expect(buttons(view)[1].getAttribute('aria-selected')).toBe('true');
  expect(view.getByLabelText('Loading tab')).toBeDefined();
  view.rerender(<Prism source={two + ':::tab{label="History"}\nThird panel\n:::\n::::'} store={store} />);
  expect(buttons(view)[1].getAttribute('aria-selected')).toBe('true');
  expect(view.container.querySelector('[data-prism="tabs"]')?.getAttribute('data-state')).toBe('done');
});

test('standalone tab is titled, foreign children are ignored, empty tabs are safe', () => {
  const view = render(<Prism source={':::tab{label="Standalone"}\nBody\n:::'} />);
  expect(view.getByRole('heading', { name: 'Standalone' })).toBeDefined();
  expect(view.queryByRole('tabpanel')).toBeNull();
  view.rerender(<Prism source={'::::tabs\nIgnored markdown\n\n:::tab{label="Only"}\nVisible\n:::\n::::'} />);
  expect(buttons(view).length).toBe(1); expect(view.queryByText('Ignored markdown')).toBeNull();
  view.rerender(<Prism source={'::::tabs{size=wrong variant=wrong}\n::::'} />);
  expect(view.queryAllByRole('tab')).toEqual([]); expect(view.getByRole('tablist')).toBeDefined();
});

test('tabs and panels support unstyled mode and body/label slots', () => {
  function Body({ children, ...props }: React.HTMLAttributes<HTMLElement>) { return <main {...props}>{children}</main>; }
  function Label({ children, ...props }: React.HTMLAttributes<HTMLElement>) { return <b {...props}>{children}</b>; }
  const view = render(<Prism source={source} unstyled animate={false} slots={{ tabs: { label: Label }, tab: { body: Body } }} styles={{ tabs: { root: { color: 'red' } } }} />);
  expect(view.container.querySelector('b')?.textContent).toBe('Overview');
  expect(view.container.querySelector('main')?.textContent).toBe('First panel');
  expect((view.container.querySelector('[data-prism="tabs"]') as HTMLElement).style.color).toBe('red');
  view.container.querySelectorAll('[data-prism]').forEach(part => { expect(part.className).toBe(''); expect(part.hasAttribute('data-prism-enter')).toBe(false); });
});

test('underline indicator measures active buttons and remeasures after resize', () => {
  const view = render(<Prism source={source} />);
  const tabs = buttons(view);
  Object.defineProperties(tabs[1], { offsetLeft: { value: 90, configurable: true }, offsetWidth: { value: 100, configurable: true } });
  fireEvent.click(tabs[1]);
  const indicator = view.container.querySelector('[data-part="indicator"]') as HTMLElement;
  expect(indicator.style.getPropertyValue('--prism-tabs-indicator-left')).toBe('90px');
  expect(indicator.style.getPropertyValue('--prism-tabs-indicator-width')).toBe('100px');
  expect(view.getByRole('tablist').hasAttribute('data-measured')).toBe(true);
  Object.defineProperty(tabs[1], 'offsetWidth', { value: 120 });
  fireEvent(window, new Event('resize'));
  expect(indicator.style.getPropertyValue('--prism-tabs-indicator-width')).toBe('120px');
});
