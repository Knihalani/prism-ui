import '../../../react/test/setup';
import { afterEach, expect, test } from 'bun:test';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { Prism, defaultRegistry, type Action } from '@prism-ui/react';
import { badgeDef } from './index';

afterEach(cleanup);

const source = ":badge[New]{id=demo tone=success dot=true}";
function root(container: HTMLElement) { return container.querySelector('[data-prism="badge"][data-part="root"]') as HTMLElement; }

test('badge renders semantic parts and documented defaults', () => {
  const view = render(<Prism source={source} />);
  const element = root(view.container);
  expect(element.classList.contains('prism-badge__root')).toBe(true);
  expect(element.dataset.state).toBe('done');
  expect(element.hasAttribute('data-prism-enter')).toBe(true);
  element.querySelectorAll('[data-prism="badge"]').forEach(part => expect(part.classList.contains('prism-badge__' + part.getAttribute('data-part'))).toBe(true));
  expect(defaultRegistry.docs()).toContain('### badge');
  expect(badgeDef.syntax).toBe('inline');
  expect(element.tagName).toBe('SPAN'); expect(element.textContent).toBe('New');
  expect(element.dataset.tone).toBe('success'); expect(element.dataset.variant).toBe('soft'); expect(element.dataset.size).toBe('sm');
  expect(element.querySelector('[data-part="dot"]')?.getAttribute('aria-hidden')).toBe('true');
});

test('badge tolerates partial attributes and renders when the inline token becomes available', () => {
  const view = render(<Prism source={":badge[New]{tone=\"s"} done={false} />);
  expect(root(view.container)).toBeNull();
  view.rerender(<Prism source={":badge[New]{tone=success}"} done={false} />);
  view.rerender(<Prism source={":badge[New]{tone=success}\n\n"} done={false} />);
  expect(root(view.container)?.dataset.state).toBe('done');
  view.rerender(<Prism source={":badge[New]{id=demo tone=success dot=true}"} done />);
  expect(root(view.container).dataset.state).toBe('done');
});

test('badge supports empty content, invalid attributes, slots and unstyled mode', () => {
  const empty = ":badge[]{tone=invalid size=invalid}";
  const view = render(<Prism source={empty} />);
  expect(root(view.container)).not.toBeNull();
  function Body({ children, ...props }: React.HTMLAttributes<HTMLElement>) { return <em {...props}>{children} replaced</em>; }
  view.rerender(<Prism source={source} unstyled animate={false} slots={{ badge: { body: Body } }} styles={{ badge: { root: { color: 'red' } } }} />);
  const element = root(view.container);
  expect(element.className).toBe('');
  expect(element.style.color).toBe('red');
  expect(element.hasAttribute('data-prism-enter')).toBe(false);
  expect(element.querySelector('em')?.textContent).toContain('replaced');
  element.querySelectorAll('[class]').forEach(part => expect(part.className).not.toContain('prism-'));
});
