import '../../react/test/setup';
import { afterEach, expect, test } from 'bun:test';
import { cleanup, render } from '@testing-library/react';
import { Prism } from '@prism-ui/react';
import '../src';

afterEach(cleanup);

test.each([
  [':num[1234]{id=amount format=currency decimals=0}', '$1,234'],
  [':num[0.25]{id=amount format=percent step=0.01}', '25%'],
  [':num[1234]{id=amount format=compact}', '1.2K'],
  [':num[]{id=amount}', '\u00a0'],
])('unstyled %s renders one plain formatted value without shared CSS', (source, expected) => {
  const view = render(<Prism source={source} unstyled locale="en-US" />);
  const value = view.container.querySelector('[data-prism="num"][data-part="value"]')!;
  expect(value.textContent).toBe(expected);
  expect(value.querySelector('[aria-hidden]')).toBeNull();
  expect(value.querySelector('[data-digit]')).toBeNull();
});

test.each([
  [1234, 'currency', '$1,234.00'],
  [0.25, 'percent', '25%'],
  [1234, 'number', '1,234'],
])('unstyled View stat %s with %s formatting renders exactly once', (value, format, expected) => {
  const source = '```ui:view\n' + JSON.stringify({ children: [{ type: 'stat', label: 'Amount', value, format }] }) + '\n```';
  const view = render(<Prism source={source} unstyled locale="en-US" />);
  const stat = view.container.querySelector('[data-part="statValue"]')!;
  expect(stat.textContent).toBe(expected);
  expect(stat.querySelector('[aria-hidden]')).toBeNull();
  expect(stat.querySelector('[data-digit]')).toBeNull();
});
