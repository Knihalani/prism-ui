import '../../react/test/setup';
import { expect, test } from 'bun:test';
import { createElement } from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { Prism, defineTheme, type Action } from '@prism-ui/react';
import { estimate } from '../src/estimate';

const items = [{ id: 'seats', label: 'Seats', description: 'Team access', price: 36, qty: 6 }, { id: 'notes', label: 'Notes', price: 36, optional: true }];
const source = (rows = items) => '```ui:estimate\n' + JSON.stringify({ id: 'quote', items: rows, discount: .1, taxRate: .1 }) + '\n```';
test('every declared Estimate part, including empty, can be replaced without replacing the component', () => {
  const covered = new Set<string>();
  for (const content of [source(), source([])]) {
    const base = render(<Prism source={content} animate={false} />);
    const tags = new Map(Array.from(base.container.querySelectorAll('[data-prism="estimate"][data-part]')).map(node => [node.getAttribute('data-part')!, node.tagName.toLowerCase()]));
    cleanup();
    for (const [part, tag] of tags) {
      function Marker({ as, row, estimate, children, ...props }: any) { return createElement(as ?? tag, { ...props, 'data-replaced': part }, children); }
      const view = render(<Prism source={content} animate={false} slots={{ estimate: { [part]: Marker } }} />);
      expect(view.container.querySelector(`[data-replaced="${part}"]`), part).not.toBeNull();
      covered.add(part); cleanup();
    }
  }
  expect([...covered].sort()).toEqual([...estimate.parts!].sort());
});

test('theme strings cover labels and emitted messages, theme icons replace controls, and sent estimates remain editable', () => {
  const actions: Action[] = [];
  const theme = defineTheme({ name: 'estimate-localized', icons: { plus: props => <svg {...props} data-plus="custom" /> }, components: { estimate: { strings: { title: 'Budget', increaseLabel: 'Add', submit: 'Confirm', sentLabel: 'Recorded', totalLabel: 'Amount', itemCountLabel: 'lines', emptyLabel: 'No lines' } } } });
  const view = render(<Prism source={source()} theme={theme} animate={false} locale="en-US" onAction={action => actions.push(action)} />);
  expect(view.getByRole('group', { name: 'Budget' })).toBeDefined();
  const add = view.getByRole('button', { name: 'Add Seats' }); expect(add.querySelector('[data-plus="custom"]')).not.toBeNull();
  fireEvent.click(view.getByRole('button', { name: 'Confirm' }));
  expect(actions[0].message).toContain('Confirm: 2 lines, amount');
  expect(view.getByRole('button', { name: 'Recorded' }).hasAttribute('disabled')).toBe(true);
  fireEvent.click(add); expect(view.getByRole('button', { name: 'Confirm' }).hasAttribute('disabled')).toBe(false);
  view.rerender(<Prism source={source([])} theme={theme} animate={false} />);
  expect(view.getByText('No lines')).toBeDefined(); expect(view.getByRole('button', { name: 'Confirm' }).hasAttribute('disabled')).toBe(true);
});
