import '../../../react/test/setup';
import { afterEach, expect, test } from 'bun:test';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { Prism } from '@prism-ui/react';
import './index';

const bounds = HTMLElement.prototype.getBoundingClientRect;
const intersection = globalThis.IntersectionObserver;
afterEach(() => { cleanup(); HTMLElement.prototype.getBoundingClientRect = bounds; globalThis.IntersectionObserver = intersection; });

for (const width of [300, 760]) test(`toolbar measures its forwarded DOM ref at ${width}px`, () => {
  globalThis.IntersectionObserver = undefined as any;
  HTMLElement.prototype.getBoundingClientRect = () => new DOMRect(0, 0, width, 200);
  const source = '```ui:mockup\n' + JSON.stringify({ id: 'toolbar', kind: 'html', source: '<button>Continue</button>' }) + '\n```';
  const view = render(<Prism source={source} animate={false} />);
  fireEvent.click(view.getByRole('button', { name: 'More tools' }));
  const controls = view.container.querySelectorAll('[data-part="secondaryTools"]');
  expect(controls).toHaveLength(1);
  expect((controls[0] as HTMLElement).dataset.location).toBe(width <= 360 ? 'overflow' : 'toolbar');
  expect(view.getByRole('button', { name: 'Mobile' })).toBeDefined();
  expect(view.getByRole('button', { name: 'Zoom in' })).toBeDefined();
  fireEvent.click(view.getByRole('button', { name: 'Draw' }));
  expect(view.getByRole('button', { name: 'Pen colour 1' })).toBeDefined();
});
