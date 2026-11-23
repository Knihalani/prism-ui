import '../../../packages/react/test/setup';
import { afterEach, expect, spyOn, test } from 'bun:test';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { renderToString } from 'react-dom/server';
import { createRegistry } from '@prism-ui/react';
import { pick } from '@prism-ui/components/pick';
import { Example } from '../src/islands/example';
import { artifact, artifactPlugin } from '@prism-ui/components/artifact';
import { mount } from '../src/islands/artifact';

afterEach(cleanup);

test('live examples acknowledge actions so native sent receipts appear and replay resets', async () => {
  const data = { name: 'pick', sources: pick.examples! };
  const view = render(<Example data={data} bundle={{ registry: createRegistry([pick]) }} />);
  fireEvent.click(view.getByRole('button', { name: 'Choose' }));
  expect(view.getByRole('button', { name: 'Sent' }).hasAttribute('disabled')).toBe(true);
  fireEvent.click(view.getByRole('button', { name: 'Replay stream' }));
  await waitFor(() => expect(view.getByRole('button', { name: 'Choose' }).hasAttribute('disabled')).toBe(false));
});

test('Artifact enhances its static snapshot without a hydration mismatch', async () => {
  const element = document.createElement('div'), data = { name: 'artifact', sources: artifact.examples! };
  const bundle = { registry: createRegistry([artifact]), plugins: [artifactPlugin] };
  element.innerHTML = '<script type="application/json" data-example-data></script><div data-example-root></div>';
  element.querySelector('script')!.textContent = JSON.stringify(data);
  element.querySelector('[data-example-root]')!.innerHTML = renderToString(<Example data={data} bundle={bundle} snapshot="<p>Static preview</p>" />, { identifierPrefix: 'example-' });
  document.body.append(element);
  const errors = spyOn(console, 'error');
  let root: ReturnType<typeof mount> | undefined;
  try {
    await act(async () => { root = mount(element); });
    await waitFor(() => expect(element.querySelector('[data-artifact-shell]')).not.toBeNull());
    expect(element.textContent).not.toContain('Static preview');
    expect(errors.mock.calls.flat().map(String).join('\n')).not.toContain('Hydration');
  } finally {
    await act(async () => { root?.unmount(); });
    element.remove(); errors.mockRestore();
  }
});
