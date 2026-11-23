import '../../../react/test/setup';
import { afterEach, expect, test } from 'bun:test';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { Prism, createRegistry } from '@prism-ui/react';
import { mockupDefinition } from './mockup';
import { mockupLabels } from './use-mockup';
import { targetLabel } from './target-label';
import { placeReadout } from './placement';
import '../feedback';

afterEach(cleanup);
test('target chips use excerpts or translated friendly elements, never geometry or selector fallbacks', () => {
  expect(targetLabel({ selector: 'rect:nth-of-type(2)', html: '<rect width="30"/>' }, mockupLabels)).toBe('Shape');
  expect(targetLabel({ selector: '#cta', text: '  Continue  now ' }, mockupLabels)).toBe('Continue now');
  expect(targetLabel({ selector: 'img', html: '<img src="x">' }, { ...mockupLabels, targetImage: 'Photo' })).toBe('Photo');
  for (const target of [undefined, { selector: '#missing' }, { selector: 'div', html: '<div></div>', text: '' }]) expect(targetLabel(target, mockupLabels)).toBe('');
});
test('readouts flip and clamp in canvas-local pixels, including empty surfaces', () => {
  expect(placeReadout(300, 200, 100, 60, 80, 24)).toEqual({ left: 106, top: 66 });
  expect(placeReadout(300, 200, 299, 199, 80, 24)).toEqual({ left: 213, top: 169 });
  expect(placeReadout(0, 0, 0, 0, 80, 24)).toEqual({ left: 0, top: 0 });
  expect(placeReadout(30, 20, -4, -5, 80, 24)).toEqual({ left: 0, top: 0 });
});
test('mockups own their feedback surface and expose named icon tools and overflow controls', () => {
  const view = render(<Prism feedback registry={createRegistry([mockupDefinition])} source={'```ui:mockup\n{"id":"review","kind":"svg","source":"<svg viewBox=\"0 0 100 100\"><rect width=\"100\" height=\"100\"/></svg>"}\n```'} />);
  expect(view.queryByRole('button', { name: 'Give feedback' })).toBeNull();
  for (const name of ['Pin', 'Region', 'Draw']) expect(view.getByRole('button', { name }).getAttribute('title')).toContain(name);
  fireEvent.click(view.getByRole('button', { name: 'More tools' }));
  const overflow = view.container.querySelector('[data-part="overflowContent"]')!;
  expect(view.getAllByRole('button', { name: 'Zoom in' })).toHaveLength(1);
  expect(overflow.querySelector('[aria-label="View source"]')).not.toBeNull();
});
