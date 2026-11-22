import '../../react/test/setup';
import { expect, test } from 'bun:test';
import { fireEvent, render, within } from '@testing-library/react';
import { Prism } from '@prism-ui/react';
import '@prism-ui/components/estimate';
import { instrument, objects, print } from './index';

const source = '```ui:estimate\n{"id":"quote","items":[{"id":"one","label":"One","price":12}]}\n```';

for (const theme of [print, objects, instrument]) {
  test(`${theme.name} defines shared motion tokens and reserves both receipt labels`, () => {
    for (const key of ['motionInstant', 'motionFast', 'motionBase', 'motionSlow', 'motionEase', 'motionSpring', 'motionSpringDuration', 'motionSpringBouncy', 'motionSpringBouncyDuration', 'motionDistance', 'motionScale', 'motionBlur'] as const) expect(theme.tokens?.[key]).toBeDefined();
    const view = render(<Prism source={source} theme={theme} animate={false} onAction={() => {}} />);
    const submit = view.container.querySelector('[data-part="submit"]')!;
    const ready = submit.querySelector('span:first-child')!, receipt = submit.querySelector('span:last-child')!;
    expect(ready.getAttribute('aria-hidden')).toBe('false');
    expect(receipt.getAttribute('aria-hidden')).toBe('true');
    expect(view.container.querySelector('.prism-root')?.getAttribute('data-animate')).toBe('false');
    fireEvent.click(submit);
    expect(ready.getAttribute('aria-hidden')).toBe('true');
    expect(receipt.getAttribute('aria-hidden')).toBe('false');
    expect(submit.querySelector('span:first-child')).toBe(ready);
    expect(submit.querySelector('span:last-child')).toBe(receipt);
    const Plain = () => null;
    view.rerender(<Prism source={source} theme={theme} slots={{ estimate: { submit: Plain } }} onAction={() => {}} />);
    view.rerender(<Prism source={source} theme={theme} onAction={() => {}} />);
    const sent = within(view.container).getByRole('button', { name: theme.components!.estimate!.strings!.sentLabel });
    expect(sent.hasAttribute('data-sent')).toBe(true);
    expect(view.container.querySelector('[data-instrument-change]')).toBeNull();
    expect(view.container.querySelector('[data-printing]')).toBeNull();
    expect(theme.css).toContain('prefers-reduced-motion:reduce');
    expect(theme.css).toContain('[data-animate="false"]');
    expect(theme.css).toContain('animation:none; stroke-dasharray:20;');
  });
}

test('theme motion uses shared primitives without replaying receipt keyframes', () => {
  expect(print.tokens?.motionSpringDuration).toBe('0ms');
  expect(print.tokens?.motionSpring).toBe('linear');
  expect(objects.tokens?.motionSpring).toStartWith('linear(');
  expect(objects.components?.estimate?.tokens?.['motion-slow']).toBe('620ms');
  expect(objects.css).not.toContain('objects-print-feed');
  expect(objects.css).toContain('.objects-receipt[data-state="ready"]');
  expect(instrument.tokens?.motionEase).toStartWith('steps(');
  expect(instrument.css).toContain('instrument-contact var(--prism-motion-base)');
  expect(instrument.css).not.toContain('[data-state="sent"] .prism-estimate__title::before');
});
