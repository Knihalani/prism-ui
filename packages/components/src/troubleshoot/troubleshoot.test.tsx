import '../../../react/test/setup';
import { afterEach, expect, test } from 'bun:test';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { Prism, createRegistry } from '@prism-ui/react';
import { troubleshootDefinition } from './troubleshoot';

afterEach(cleanup);
test('history uses short authored titles and retains the full accessible answer', () => {
  const props = { start: 'mail', steps: { mail: { title: 'Mail delivery', text: 'Check the mail server and try again.', no: 'retry' }, retry: { text: 'Request a new invitation.' } } };
  const view = render(<Prism registry={createRegistry([troubleshootDefinition])} source={'```ui:troubleshoot\n' + JSON.stringify(props) + '\n```'} />);
  fireEvent.click(view.getByRole('button', { name: 'No' }));
  const history = view.getByRole('button', { name: 'Check the mail server and try again. No' });
  expect(history.textContent).toBe('Mail deliveryNo');
  fireEvent.click(history);
  expect(view.getByRole('heading', { name: /Mail delivery/ })).toBeDefined();
});
