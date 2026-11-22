import '../../react/test/setup';
import { afterEach, expect, test } from 'bun:test';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { Prism, type Action } from '@prism-ui/react';
import '../src';

afterEach(cleanup);
const literal = '$& $$ $` $\' {items} {answers}';
const fence = (name: string, props: object) => '```ui:' + name + '\n' + JSON.stringify(props) + '\n```';

test('Summary point and action messages preserve literal replacement characters', () => {
  const actions: Action[] = [];
  const view = render(<Prism onAction={action => actions.push(action)} source={fence('summary', { points: [{ text: literal }], actions: [{ text: literal }] })} />);
  fireEvent.click(view.getByRole('button', { name: 'Ask about point 1' }));
  expect(actions.at(-1)!.message).toBe('Tell me more about this point: ' + literal);
  fireEvent.click(view.getByRole('button', { name: 'Send action items' }));
  expect(actions.at(-1)!.message).toContain(literal);
});

test('Card selection and Troubleshooter reports preserve literal payload/title text', () => {
  const actions: Action[] = [];
  const view = render(<Prism onAction={action => actions.push(action)} source={fence('card', { title: literal, action: 'Choose' })} />);
  fireEvent.click(view.getByRole('button', { name: /Choose/ }));
  expect(actions.at(-1)!.message).toContain(JSON.stringify({ title: literal }));
  view.rerender(<Prism onAction={action => actions.push(action)} source={fence('troubleshoot', { title: literal, start: 'a', steps: { a: { text: 'Try it.' } } })} />);
  fireEvent.click(view.getByRole('button', { name: 'Yes' }));
  fireEvent.click(view.getByRole('button', { name: /report/i }));
  expect(actions.at(-1)!.message).toContain(literal);
});

test('Runbook help preserves literal title and step text', () => {
  const actions: Action[] = [];
  const source = '::::runbook{title="' + literal + '"}\n:::step{title="' + literal + '"}\nInstructions.\n:::\n::::';
  const view = render(<Prism source={source} onAction={action => actions.push(action)} />);
  fireEvent.click(view.getByRole('button', { name: 'Stuck here?' }));
  expect(actions.at(-1)!.message).toContain('of "' + literal + '": ' + literal + '.');
});
