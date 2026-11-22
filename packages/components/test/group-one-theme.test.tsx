import '../../react/test/setup';
import { afterEach, expect, test } from 'bun:test';
import { createElement } from 'react';
import { cleanup, fireEvent, render } from '@testing-library/react';
import { Prism, defineTheme, type Action } from '@prism-ui/react';
import { createStore } from '@prism-ui/state';
import { runbookDefinition, stepDefinition } from '../src/runbook';
import { troubleshootDefinition } from '../src/troubleshoot';
import { summaryDef } from '../src/summary';

afterEach(cleanup);
const fence = (name: string, props: object) => '\x60\x60\x60ui:' + name + '\n' + JSON.stringify(props) + '\n\x60\x60\x60';
const fixtures = [
  { source: runbookDefinition.examples![0] },
  { source: '::::runbook\n::::' },
  { source: ':::step\nBody\n:::' },
  { source: '::::runbook\n', streaming: true },
  { source: fence('troubleshoot', { id: 'trouble', start: 'a', steps: { a: { text: 'Try this.', command: 'echo hello', hint: 'Wait.', no: 'b' }, b: { text: 'Next.', question: 'Working?' } } }) },
  { source: fence('troubleshoot', { id: 'trouble', start: 'a', steps: { a: { text: 'Try this.', no: 'b' }, b: { text: 'Next.' } } }), path: [{ step: 'a', answer: 'no' }] },
  { source: fence('troubleshoot', { id: 'trouble', start: 'a', steps: { a: { text: '' } } }) },
  { source: fence('troubleshoot', { id: 'trouble', start: 'a', steps: { a: { text: 'Try.', no: '$escalate' } } }), path: [{ step: 'a', answer: 'yes' }] },
  { source: fence('troubleshoot', { id: 'trouble', start: 'a', steps: { a: { text: 'Try.', no: '$escalate' } } }), path: [{ step: 'a', answer: 'no' }], sent: true },
  { source: '\x60\x60\x60ui:troubleshoot\n{', streaming: true },
  { source: summaryDef.examples![0] },
  { source: fence('summary', { points: [{ text: 'Plain point' }], actions: [{}] }) },
  { source: fence('summary', {}) },
  { source: '\x60\x60\x60ui:summary\n{', streaming: true },
];
test('every Group 1 part is observed and replaceable, including empty, skeleton, terminal and sent states', () => {
  const covered: Record<string, Set<string>> = { runbook: new Set(), troubleshoot: new Set(), summary: new Set() };
  for (const fixture of fixtures) {
    function show(slots = {}) {
      const store = createStore();
      if (fixture.path) store.set('trouble.path', fixture.path);
      if (fixture.sent) store.set('trouble.sent', true);
      return render(<Prism source={fixture.source} done={!fixture.streaming} store={store} slots={slots} animate={false} />);
    }
    const base = show();
    const tags = new Map(Array.from(base.container.querySelectorAll('[data-prism][data-part]')).filter(el => el.getAttribute('data-prism')! in covered).map(el => [el.getAttribute('data-prism')! + '.' + el.getAttribute('data-part')!, el.tagName.toLowerCase()]));
    cleanup();
    for (const [key, tag] of tags) {
      const [component, part] = key.split('.');
      const Marker = ({ as, children, runbook, step, troubleshoot, summary, point, action, ...props }: any) => createElement(as ?? tag, { ...props, 'data-replaced': key }, children);
      const view = show({ [component]: { [part]: Marker } });
      expect(view.container.querySelector('[data-replaced="' + key + '"]'), key).not.toBeNull();
      covered[component].add(part); cleanup();
    }
  }
  for (const definition of [runbookDefinition, troubleshootDefinition, summaryDef]) {
    expect([...covered[definition.name]].sort(), definition.name).toEqual([...definition.parts!].sort());
  }
  expect(stepDefinition.parts!.every(part => covered.runbook.has(part))).toBe(true);
});

test('theme strings, icons and typed headless slot data customize Group 1 without replacing views', () => {
  let stepModel: any, pointModel: any;
  const actions: Action[] = [];
  const theme = defineTheme({ name: 'group-one', icons: { check: props => <svg {...props} data-custom-check="" /> }, components: {
    runbook: { strings: { title: 'Guide', stuck: 'Help', stuckMessage: '{title}/{step}/{text}' }, slots: { step: ({ as, step, children, ...props }: any) => { stepModel = step; return createElement(as, props, children); } } },
    troubleshoot: { strings: { yes: 'Oui', report: 'Report', reportMessage: 'Result: {answers}', fixedMessage: 'Repaired' } },
    summary: { strings: { title: 'Notes', sendActionItems: 'Confirm', sent: 'Recorded', sendMessage: 'Confirm {count}', askPointMessage: 'Explain {text}' }, slots: { point: ({ as, summary, point, children, ...props }: any) => { pointModel = { summary, point }; return createElement(as, props, children); } } },
  } });
  const view = render(<Prism source={runbookDefinition.examples![0]} theme={theme} onAction={action => actions.push(action)} animate={false} />);
  expect(view.getByRole('group', { name: 'Guide' })).toBeDefined();
  expect(typeof stepModel.toggle).toBe('function');
  fireEvent.click(view.getAllByRole('checkbox')[0]);
  expect(view.container.querySelector('[data-custom-check]')).not.toBeNull();
  fireEvent.click(view.getAllByRole('button', { name: 'Help' })[0]);
  expect(actions.at(-1)!.message).toBe('Guide/1/Install the CLI');
  view.rerender(<Prism source={fence('troubleshoot', { start: 'a', labels: { yes: 'Yes prop' }, steps: { a: { text: 'Try.' } } })} theme={theme} onAction={action => actions.push(action)} />);
  fireEvent.click(view.getByRole('button', { name: 'Oui' }));
  fireEvent.click(view.getByRole('button', { name: 'Report' }));
  expect(actions.at(-1)!.message).toBe('Result: Oui');
  view.rerender(<Prism source={summaryDef.examples![0]} theme={theme} onAction={action => actions.push(action)} />);
  expect(pointModel.point.text).toBe('The launch is ready.');
  expect(typeof pointModel.summary.togglePoint).toBe('function');
  fireEvent.click(view.getByRole('button', { name: 'Confirm' }));
  expect(actions.at(-1)!.message).toBe('Confirm 1');
  expect(view.getByRole('button', { name: 'Recorded' })).toBeDefined();
  fireEvent.click(view.getByRole('checkbox'));
  expect(view.getByRole('button', { name: 'Confirm' }).hasAttribute('disabled')).toBe(false);
});
