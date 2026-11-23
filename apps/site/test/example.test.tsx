import '../../../packages/react/test/setup';
import { afterEach, expect, test } from 'bun:test';
import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { createRegistry } from '@prism-ui/react';
import { pick } from '@prism-ui/components/pick';
import { Example } from '../src/islands/example';

afterEach(cleanup);

test('live examples acknowledge actions so native sent receipts appear and replay resets', async () => {
  const data = { name: 'pick', sources: pick.examples! };
  const view = render(<Example data={data} bundle={{ registry: createRegistry([pick]) }} />);
  fireEvent.click(view.getByRole('button', { name: 'Choose' }));
  expect(view.getByRole('button', { name: 'Sent' }).hasAttribute('disabled')).toBe(true);
  fireEvent.click(view.getByRole('button', { name: 'Replay stream' }));
  await waitFor(() => expect(view.getByRole('button', { name: 'Choose' }).hasAttribute('disabled')).toBe(false));
});
