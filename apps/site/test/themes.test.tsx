import '../../../packages/react/test/setup';
import { expect, test } from 'bun:test';
import { fireEvent, render, within } from '@testing-library/react';
import { Themes } from '../src/islands/themes';

test('comparison budget table and prose follow the same editable seats without changing other themes', () => {
  const view = render(<Themes />);
  const columns = Array.from(view.container.querySelectorAll<HTMLElement>('.theme-column'));
  const host = within(columns[0]);
  expect(host.getByRole('table', { name: 'Table' }).textContent).toContain('$216');
  fireEvent.click(host.getByRole('slider', { name: /Team size/ }));
  const input = host.getByRole('spinbutton');
  fireEvent.change(input, { target: { value: '20' } });
  fireEvent.keyDown(input, { key: 'Enter' });
  expect(host.getByRole('slider', { name: /Team size/ }).getAttribute('aria-valuenow')).toBe('20');
  const rows = within(host.getByRole('table', { name: 'Table' })).getAllByRole('row');
  expect(rows.find(row => row.textContent?.includes('Seats'))?.textContent).toContain('20');
  expect(rows.find(row => row.textContent?.includes('Monthly'))?.textContent).toContain('$360');
  expect(host.getByRole('slider', { name: /Team size/ }).closest('p')?.textContent).toContain('$360');
  expect(within(columns[1]).getByRole('table', { name: 'Table' }).textContent).toContain('$216');
});
