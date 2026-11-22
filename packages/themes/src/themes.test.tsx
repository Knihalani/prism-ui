import '../../react/test/setup';
import { expect, test } from 'bun:test';
import { fireEvent, render } from '@testing-library/react';
import { Prism, ThemeScope, host } from '@prism-ui/react';
import '@prism-ui/components/estimate';
import { instrument, refraction } from './index';

const source = '```ui:estimate\n' + JSON.stringify({ id: 'quote', items: [{ id: 'seats', label: 'Seats', price: 36, qty: 6 }, { id: 'notes', label: 'Notes', price: 36, optional: true }] }) + '\n```';
test('the same Estimate uses independent themes and real structural slots', () => {
  const view = render(<><Prism source={source} theme={host} animate={false} /><Prism source={source} theme={refraction} animate={false} /><Prism source={source} theme={instrument} animate={false} onAction={() => {}} /></>);
  const roots = view.container.querySelectorAll('.prism-root');
  expect(roots.length).toBe(3); expect(roots[0].querySelector('[data-segmented]')).toBeNull(); expect(roots[1].querySelector('[data-segmented]')).toBeNull();
  expect(roots[2].querySelector('[data-segmented]')).not.toBeNull(); expect(roots[2].querySelectorAll('.instrument-screw').length).toBe(4);
  expect(roots[2].querySelectorAll('[role="spinbutton"]').length).toBe(1); expect(roots[2].querySelector('[role="switch"]')).not.toBeNull();
  fireEvent.click(roots[2].querySelector('[data-part="increase"]')!);
  expect(roots[2].querySelector('[data-part="live"]')?.textContent).toBe('$288.00');
  expect(roots[0].querySelector('[data-part="live"]')?.textContent).toBe('$252.00');
  fireEvent.click(roots[2].querySelector('[data-part="submit"]')!);
  expect(roots[2].querySelector('[data-part="submit"]')?.textContent).toBe('Sent');
});

test('an outer Instrument scope does not replace parts in a nested host Prism', () => {
  const view = render(<ThemeScope theme={instrument}><Prism source={source} animate={false} /><ThemeScope theme={host}><Prism source={source} animate={false} /></ThemeScope></ThemeScope>);
  expect(view.container.querySelectorAll('[data-segmented]').length).toBe(1);
  expect(view.container.querySelectorAll('.prism-root')[1].getAttribute('data-prism-theme-name')).toBe('host');
});
