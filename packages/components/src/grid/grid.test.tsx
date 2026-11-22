import '../../../react/test/setup';
import { afterEach, expect, test } from 'bun:test';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { Prism, defaultRegistry, type Action } from '@prism-ui/react';
import { gridDef } from './index';

afterEach(cleanup);

const source = ":::grid{id=demo cols=3 min=180 gap=lg}\nBody text\n:::";
function root(container: HTMLElement) { return container.querySelector('[data-prism="grid"][data-part="root"]') as HTMLElement; }

test('grid renders semantic parts and documented defaults', () => {
  const view = render(<Prism source={source} />);
  const element = root(view.container);
  expect(element.classList.contains('prism-grid__root')).toBe(true);
  expect(element.dataset.state).toBe('ready');
  expect(element.hasAttribute('data-entering')).toBe(true);
  element.querySelectorAll('[data-prism="grid"]').forEach(part => expect(part.classList.contains('prism-grid__' + part.getAttribute('data-part'))).toBe(true));
  expect(defaultRegistry.docs()).toContain('### grid');
  expect(gridDef.syntax).toBe('container');
  expect(view.getByRole('group', { name: 'Grid' })).toBe(element);
  expect(element.style.getPropertyValue('--prism-grid-cols')).toBe('3');
  expect(element.style.getPropertyValue('--prism-grid-min')).toBe('180px');
  expect(element.dataset.size).toBe('lg');
});

test('grid tolerates partial attributes, streams open content, then finishes', () => {
  const view = render(<Prism source={":::grid{title=\"Par}\n"} done={false} />);
  expect(root(view.container)?.dataset.state).toBe('streaming');
  view.rerender(<Prism source={":::grid{id=demo cols=3 min=180 gap=lg}\n"} done={false} />);
  expect(root(view.container)?.dataset.state).toBe('streaming');
  view.rerender(<Prism source={":::grid{id=demo cols=3 min=180 gap=lg}\nBody text\n:::"} done />);
  expect(root(view.container).dataset.state).toBe('ready');
});

test('grid supports empty content, invalid attributes, slots and unstyled mode', () => {
  const empty = ":::grid{tone=invalid cols=bad size=invalid}\n:::";
  const view = render(<Prism source={empty} />);
  expect(root(view.container)).not.toBeNull();
  function Body({ children, ...props }: React.HTMLAttributes<HTMLElement>) { return <em {...props}>{children} replaced</em>; }
  view.rerender(<Prism source={source} unstyled animate={false} slots={{ grid: { body: Body } }} styles={{ grid: { root: { color: 'red' } } }} />);
  const element = root(view.container);
  expect(element.className).toBe('');
  expect(element.style.color).toBe('red');
  expect(element.hasAttribute('data-entering')).toBe(false);
  expect(element.querySelector('em')?.textContent).toContain('replaced');
  element.querySelectorAll('[class]').forEach(part => expect(part.className).not.toContain('prism-'));
});
