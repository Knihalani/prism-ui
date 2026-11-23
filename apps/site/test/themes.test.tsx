import '../../../packages/react/test/setup';
import { expect, test } from 'bun:test';
import { fireEvent, render, within } from '@testing-library/react';
import { Themes } from '../src/islands/themes';

test('comparison budget list and prose follow the same editable seats without sortable formula cells', () => {
  const view = render(<Themes />);
  const columns = Array.from(view.container.querySelectorAll<HTMLElement>('.theme-column'));
  const host = within(columns[0]);
  const budget = (column: HTMLElement, label: string) => within(column).getAllByRole('listitem').find(row => row.textContent?.startsWith(label))?.textContent;
  for (const column of columns) {
    const reply = within(column);
    expect(budget(column, 'Seats:')).toContain('12');
    expect(budget(column, 'Monthly:')).toContain('$216');
    expect(reply.queryByRole('table', { name: 'Table' })).toBeNull();
    expect(reply.queryByRole('button', { name: 'Amount' })).toBeNull();
  }
  fireEvent.click(host.getByRole('slider', { name: /Team size/ }));
  const input = host.getByRole('spinbutton');
  fireEvent.change(input, { target: { value: '20' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(host.getByRole('slider', { name: /Team size/ }).getAttribute('aria-valuenow')).toBe('20');
  expect(budget(columns[0], 'Seats:')).toContain('20');
  expect(budget(columns[0], 'Per seat:')).toContain('$18');
  expect(budget(columns[0], 'Monthly:')).toContain('$360');
  expect(host.getByRole('slider', { name: /Team size/ }).closest('p')?.textContent).toContain('$360');
  for (const column of columns.slice(1)) {
    expect(budget(column, 'Seats:')).toContain('12');
    expect(budget(column, 'Monthly:')).toContain('$216');
  }
});
