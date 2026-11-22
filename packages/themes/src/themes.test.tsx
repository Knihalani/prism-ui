import '../../react/test/setup';
import { expect, test } from 'bun:test';
import { createRef, type ElementType, type ReactNode } from 'react';
import { act, fireEvent, render, within } from '@testing-library/react';
import { Prism, ThemeScope, host } from '@prism-ui/react';
import { createStore } from '../../state/src';
import '@prism-ui/components/estimate';
import '@prism-ui/components/pick';
import '@prism-ui/components/mockup';
import '@prism-ui/components/runbook';
import '@prism-ui/components/troubleshoot';
import '@prism-ui/components/summary';
import '@prism-ui/components/tabs';
import '@prism-ui/components/callout';
import '@prism-ui/components/card';
import '@prism-ui/components/grid';
import '@prism-ui/components/badge';
import { instrument, objects, print, refraction } from './index';
import { print as printSubpath } from '@prism-ui/themes/print';
import { objects as objectsSubpath } from '@prism-ui/themes/objects';

test('Print and Objects expose named themes and dark tokens', () => {
  expect(printSubpath).toBe(print);
  expect(objectsSubpath).toBe(objects);
  for (const theme of [print, objects]) {
    expect(theme.name).toBeTruthy();
    expect(theme.dark?.bg).toBeTruthy();
    expect(theme.dark?.text).toBeTruthy();
  }
  expect('components' in objects).toBe(true);
});

test('Objects receipt preserves increase, Undo, switch and sent state without feeding when animation is disabled', () => {
  const actions: { type: string }[] = [];
  const view = render(<Prism source={source} theme={objects} animate={false} onAction={action => actions.push(action)} />);
  const ui = within(view.container);
  expect(view.container.querySelector('[data-objects-receipt]')).not.toBeNull();
  expect(ui.getByText('RESEARCH SUPPLY CO.')).toBeTruthy();
  expect(view.container.querySelector('[data-printing]')).toBeNull();
  fireEvent.click(ui.getByRole('button', { name: 'Increase Seats' }));
  expect(ui.getByRole('spinbutton', { name: 'Seats' }).getAttribute('aria-valuenow')).toBe('7');
  fireEvent.click(ui.getByRole('button', { name: 'Undo' }));
  expect(ui.getByRole('spinbutton', { name: 'Seats' }).getAttribute('aria-valuenow')).toBe('6');
  fireEvent.click(ui.getByRole('switch', { name: 'Notes' }));
  fireEvent.click(ui.getByRole('button', { name: 'Print & send estimate ↗' }));
  expect(actions.at(-1)?.type).toBe('use');
  expect(view.container.querySelector('[data-objects-receipt]')?.getAttribute('data-state')).toBe('sent');
  expect(ui.getByRole('button', { name: 'Sent · estimate ✓' }).hasAttribute('disabled')).toBe(true);
  expect(view.container.querySelector('[data-printing]')).toBeNull();
  expect(ui.getByRole('status').textContent).toBe('DELIVERED / READY FOR REVIEW');
});

test('Objects sticky sliders update the stamped leader and choose action', () => {
  const actions: { type: string; payload: unknown }[] = [];
  const pick = '```ui:pick\n' + JSON.stringify({ id: 'stationery', criteria: [{ id: 'learning', label: 'Learning' }, { id: 'cost', label: 'Cost' }], options: [{ id: 'concierge', title: 'Concierge', scores: { learning: .9, cost: .5 } }, { id: 'self', title: 'Self-serve', scores: { learning: .6, cost: .9 } }] }) + '\n```';
  const view = render(<Prism source={pick} theme={objects} animate={false} onAction={action => actions.push(action)} />);
  const ui = within(view.container);
  expect(view.container.querySelectorAll('[data-objects-sticky]')).toHaveLength(2);
  expect(view.container.querySelector('[data-objects-stamp]')?.getAttribute('aria-hidden')).toBe('true');
  expect(view.container.querySelector('[data-objects-card]')?.textContent).toContain('Self-serve');
  fireEvent.input(ui.getByRole('slider', { name: 'Learning weight' }), { target: { value: '3' } });
  fireEvent.input(ui.getByRole('slider', { name: 'Cost weight' }), { target: { value: '0' } });
  expect(view.container.querySelector('[data-objects-card]')?.textContent).toContain('Concierge');
  fireEvent.click(ui.getByRole('button', { name: 'Choose Concierge ↗' }));
  expect(actions.at(-1)).toMatchObject({ type: 'choose', payload: { option: 'concierge' } });
});

test('Objects feed is triggered only by sending, and finishes without replaying on a sent receipt mount', () => {
  const view = render(<Prism source={source} theme={objects} onAction={() => {}} />);
  expect(view.container.querySelector('[data-printing]')).toBeNull();
  fireEvent.click(within(view.container).getByRole('button', { name: 'Print & send estimate ↗' }));
  const receipt = view.container.querySelector('[data-objects-receipt]')!;
  expect(receipt.hasAttribute('data-printing')).toBe(true);
  fireEvent.animationEnd(receipt);
  expect(receipt.hasAttribute('data-printing')).toBe(false);
  const Plain = ({ children }: { children?: ReactNode }) => <section>{children}</section>;
  view.rerender(<Prism source={source} theme={objects} slots={{ estimate: { root: Plain } }} onAction={() => {}} />);
  view.rerender(<Prism source={source} theme={objects} onAction={() => {}} />);
  expect(view.container.querySelector('[data-objects-receipt]')?.getAttribute('data-state')).toBe('sent');
  expect(view.container.querySelector('[data-printing]')).toBeNull();
});

test('Objects handles empty and unready receipt and cards', () => {
  const view = render(<Prism source={'```ui:estimate\n{"id":"empty-object","items":[]}\n```\n\n```ui:pick\n{"id":"waiting-object","criteria":[],"options":[{"id":"one","title":"Waiting"}]}\n```'} theme={objects} animate={false} onAction={() => {}} />);
  const ui = within(view.container);
  expect(ui.getByText('Items will appear here')).toBeTruthy();
  expect(ui.getByRole('button', { name: 'Print & send estimate ↗' }).hasAttribute('disabled')).toBe(true);
  expect(ui.getByRole('button', { name: 'Choose Waiting ↗' }).hasAttribute('disabled')).toBe(true);
  expect(view.container.querySelector('[data-objects-stamp]')).toBeNull();
});

test('Print leaves native feedback intact while preserving edits and submit action', () => {
  const actions: { type: string }[] = [];
  const source = '```ui:mockup\n' + JSON.stringify({ id: 'figure', kind: 'svg', source: '<svg viewBox="0 0 100 100"><rect width="100" height="100"/></svg>' }) + '\n```';
  const view = render(<Prism source={source} theme={print} animate={false} onAction={action => actions.push(action)} />);
  const field = within(view.container).getByRole('textbox', { name: 'Overall feedback' }) as HTMLTextAreaElement;
  const submit = within(view.container).getByRole('button', { name: 'Submit feedback' });
  expect(field.getAttribute('rows')).toBeNull();
  expect(field.hasAttribute('model')).toBe(false);
  expect(submit.hasAttribute('disabled')).toBe(true);
  act(() => field.focus());
  fireEvent.change(field, { target: { value: 'Keep the invitation short.\nUse more space around the title.' } });
  fireEvent.keyUp(field, { key: 'Unidentified' });
  expect(field.value).toContain('Use more space');
  expect(submit.hasAttribute('disabled')).toBe(false);
  fireEvent.click(submit);
  expect(actions).toHaveLength(1);
  expect(within(view.container).getByRole('button', { name: 'Edit feedback' })).toBeTruthy();
});

test('Print restructures Estimate without losing quantity, switch, Undo or submit behavior', () => {
  const actions: { type: string; payload: unknown }[] = [];
  const view = render(<Prism source={source} theme={print} animate={false} onAction={action => actions.push(action)} />);
  expect(view.container.querySelector('[data-print-total]')).not.toBeNull();
  expect(view.container.querySelector('.print-account [data-part="submit"]')).not.toBeNull();
  expect(within(view.container).getByRole('spinbutton', { name: 'Seats' }).getAttribute('aria-valuenow')).toBe('6');
  fireEvent.click(view.container.querySelector('[data-part="increase"]')!);
  expect(view.container.querySelector('[data-part="live"]')?.textContent).toBe('$288.00');
  fireEvent.click(within(view.container).getByRole('button', { name: 'Undo' }));
  expect(view.container.querySelector('[data-part="live"]')?.textContent).toBe('$252.00');
  const toggle = within(view.container).getByRole('switch', { name: 'Notes' }) as HTMLInputElement;
  fireEvent.click(toggle);
  expect(toggle.checked).toBe(false);
  expect(view.container.querySelector('[data-part="live"]')?.getAttribute('aria-live')).toBe('polite');
  expect(within(view.container).getByRole('button', { name: 'Ask' }).getAttribute('title')).toBe('Ask');
  fireEvent.click(within(view.container).getByRole('button', { name: 'Send estimate ↗' }));
  expect(actions.at(-1)?.type).toBe('use');
  expect(within(view.container).getByRole('button', { name: 'Estimate sent ✓' }).hasAttribute('disabled')).toBe(true);
});

test('Print criteria sliders change the winner and choose emits the selected option and weights', () => {
  const actions: { type: string; payload: any }[] = [];
  const pick = '```ui:pick\n' + JSON.stringify({ id: 'approach', criteria: [{ id: 'learning', label: 'Learning' }, { id: 'cost', label: 'Cost' }], options: [{ id: 'concierge', title: 'Concierge', scores: { learning: .9, cost: .5 } }, { id: 'self', title: 'Self-serve', scores: { learning: .6, cost: .9 } }] }) + '\n```';
  const view = render(<Prism source={pick} theme={print} animate={false} onAction={action => actions.push(action)} />);
  expect(view.container.querySelector('[data-print-winner]')?.textContent).toContain('Self-serve');
  fireEvent.input(within(view.container).getByRole('slider', { name: 'Learning weight' }), { target: { value: '3' } });
  fireEvent.input(within(view.container).getByRole('slider', { name: 'Cost weight' }), { target: { value: '0' } });
  expect(view.container.querySelector('[data-print-winner]')?.textContent).toContain('Concierge');
  fireEvent.click(within(view.container).getByRole('button', { name: 'Choose Concierge ↗' }));
  expect(actions.at(-1)).toMatchObject({ type: 'choose', payload: { option: 'concierge', weights: { learning: 3, cost: 0 } } });
  expect(view.container.querySelector('[data-print-winner] [role="status"]')?.textContent).toBe('Chosen');
});

test('Print keeps empty Estimate and Pick states accessible without inventing actions', () => {
  const view = render(<Prism source={'```ui:estimate\n{"id":"empty","items":[]}\n```\n\n```ui:pick\n{"id":"none","criteria":[],"options":[]}\n```'} theme={print} animate={false} onAction={() => {}} />);
  expect(within(view.container).getByText('Items will appear here')).toBeTruthy();
  expect(within(view.container).getByText('Options will appear here')).toBeTruthy();
  expect(within(view.container).getByRole('button', { name: 'Send estimate ↗' }).hasAttribute('disabled')).toBe(true);
  expect(view.container.querySelector('[data-print-winner]')).toBeNull();
});

test('Print retains loading/error guards and uses the estimate currency and actual footnotes', () => {
  const pending = '```ui:estimate\n{"id":"pending","currency":"EUR","items":[{"id":"one","label":"Travel","description":"Train tickets"}]}\n```\n\n```ui:pick\n{"id":"pending-pick","criteria":[{"id":"cost","label":"Cost"}],"options":[{"id":"unscored","title":"Awaiting scores"}]}\n```';
  const view = render(<Prism source={pending} theme={print} animate={false} onAction={() => {}} />);
  expect(view.container.querySelector('[data-print-total] [data-part="total-label"]')?.textContent).toBe('Total / EUR');
  expect(view.container.querySelector('.print-footnote')?.textContent).toBe('¹ Train tickets · EUR');
  expect(within(view.container).getByRole('button', { name: 'Send estimate ↗' }).hasAttribute('disabled')).toBe(true);
  expect(within(view.container).getByRole('button', { name: 'Choose Awaiting scores ↗' }).hasAttribute('disabled')).toBe(true);
  expect(view.container.querySelector('[data-print-option]')?.getAttribute('aria-busy')).toBe('true');
  expect(view.container.querySelector('[data-print-winner]')).toBeNull();
});

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

test('Instrument shares its segmented geometry between Estimate and module scores and preserves fader/choose behavior', () => {
  const actions: { type: string; payload: unknown }[] = [];
  const pick = '```ui:pick\n' + JSON.stringify({ id: 'modules', criteria: [{ id: 'learning', label: 'Learning' }, { id: 'cost', label: 'Cost' }], options: [{ id: 'concierge', title: 'Concierge', scores: { learning: .9, cost: .5 } }, { id: 'self', title: 'Self-serve', scores: { learning: .6, cost: .9 } }] }) + '\n```';
  const view = render(<Prism source={source + '\n\n' + pick} theme={instrument} animate={false} onAction={action => actions.push(action)} />);
  const ui = within(view.container);
  expect(view.container.querySelectorAll('[data-instrument-chassis]')).toHaveLength(2);
  expect(view.container.querySelectorAll('.instrument-screw')).toHaveLength(8);
  expect(view.container.querySelectorAll('[data-instrument-led]')).toHaveLength(2);
  expect(view.container.querySelectorAll('[data-segmented]')).toHaveLength(3);
  const geometry = Array.from(view.container.querySelectorAll('[data-segmented]')).map(svg => Array.from(svg.querySelectorAll('g:first-child polygon')).map(p => p.getAttribute('points')));
  expect(geometry[0]).toEqual(geometry[1]);
  expect(geometry[0]).toEqual(geometry[2]);
  expect(view.container.querySelector('[data-instrument-module][data-top]')?.textContent).toContain('Self-serve');
  fireEvent.input(ui.getByRole('slider', { name: 'Learning weight' }), { target: { value: '3' } });
  fireEvent.input(ui.getByRole('slider', { name: 'Cost weight' }), { target: { value: '0' } });
  expect(view.container.querySelector('[data-instrument-module][data-top]')?.textContent).toContain('Concierge');
  fireEvent.click(ui.getByRole('button', { name: 'Choose Concierge ↗' }));
  expect(actions.at(-1)).toMatchObject({ type: 'choose', payload: { option: 'concierge', weights: { learning: 3, cost: 0 } } });
  expect(view.container.querySelector('[data-instrument-module][data-top] [role="status"]')?.textContent).toBe('Chosen');
});

test('Instrument keeps Estimate Undo, switch, submit and sent behavior in dark mode', () => {
  const actions: { type: string }[] = [];
  const view = render(<Prism source={source} theme={instrument} mode="dark" animate={false} onAction={action => actions.push(action)} />);
  const ui = within(view.container);
  fireEvent.click(ui.getByRole('button', { name: 'Increase Seats' }));
  fireEvent.click(ui.getByRole('button', { name: 'Undo' }));
  expect(ui.getByRole('spinbutton', { name: 'Seats' }).getAttribute('aria-valuenow')).toBe('6');
  fireEvent.click(ui.getByRole('switch', { name: 'Notes' }));
  fireEvent.click(ui.getByRole('button', { name: 'Send estimate' }));
  expect(actions.at(-1)?.type).toBe('use');
  expect(ui.getByRole('button', { name: 'Sent' }).hasAttribute('disabled')).toBe(true);
  expect(instrument.dark?.surface).toBe('#2a2b27');
});

test('Instrument preserves empty and unready Estimate and Pick guards', () => {
  const view = render(<Prism source={'```ui:estimate\n{"id":"empty-instrument","items":[]}\n```\n\n```ui:pick\n{"id":"empty-modules","criteria":[],"options":[]}\n```\n\n```ui:pick\n{"id":"pending-module","criteria":[{"id":"cost","label":"Cost"}],"options":[{"id":"pending","title":"Awaiting scores"}]}\n```'} theme={instrument} animate={false} onAction={() => {}} />);
  const ui = within(view.container);
  expect(ui.getByText('Items will appear here')).toBeTruthy();
  expect(ui.getByText('Options will appear here')).toBeTruthy();
  expect(ui.getByRole('button', { name: 'Send estimate' }).hasAttribute('disabled')).toBe(true);
  expect(ui.getByRole('button', { name: 'Choose Awaiting scores ↗' }).hasAttribute('disabled')).toBe(true);
  expect(view.container.querySelector('[data-instrument-module]')?.getAttribute('aria-busy')).toBe('true');
  expect(view.container.querySelector('[data-instrument-module][data-top]')).toBeNull();
});

test('Instrument chassis and toggle slots forward DOM props, events and refs', () => {
  const Root = instrument.components!.frame!.slots!.root! as ElementType;
  const Toggle = instrument.components!.estimate!.slots!.checkbox! as ElementType;
  const root = createRef<HTMLElement>(), input = createRef<HTMLInputElement>();
  let keys = 0, changes = 0;
  const view = render(<Root as="article" data-prism="pick" aria-label="Panel" ref={root} onKeyDown={() => keys++}><Toggle type="checkbox" aria-label="Enabled" ref={input} onChange={() => changes++} /></Root>);
  expect(root.current?.tagName).toBe('ARTICLE');
  expect(root.current?.getAttribute('aria-label')).toBe('Panel');
  expect(input.current === within(view.container).getByRole('switch', { name: 'Enabled' })).toBe(true);
  fireEvent.keyDown(input.current!, { key: 'ArrowRight' });
  fireEvent.click(input.current!);
  expect(keys).toBe(1);
  expect(changes).toBe(1);
});

test('Instrument faders use the Pick model fallback for malformed saved weights', () => {
  const store = createStore(), actions: { type: string; payload: unknown }[] = [];
  store.set('guards.weights', { learning: 'invalid', cost: 5 });
  const pick = '```ui:pick\n' + JSON.stringify({ id: 'guards', weights: { learning: 2, cost: 3 }, criteria: [{ id: 'learning', label: 'Learning' }, { id: 'cost', label: 'Cost' }], options: [{ id: 'alpha', title: 'Alpha', scores: { learning: .9, cost: .2 } }, { id: 'beta', title: 'Beta', scores: { learning: .4, cost: .8 } }] }) + '\n```';
  const view = render(<Prism source={pick} theme={instrument} store={store} animate={false} onAction={action => actions.push(action)} />);
  const ui = within(view.container);
  expect((ui.getByRole('slider', { name: 'Learning weight' }) as HTMLInputElement).value).toBe('2');
  expect((ui.getByRole('slider', { name: 'Cost weight' }) as HTMLInputElement).value).toBe('3');
  fireEvent.click(ui.getByRole('button', { name: 'Choose Beta ↗' }));
  expect(actions.at(-1)).toMatchObject({ type: 'choose', payload: { option: 'beta', weights: { learning: 2, cost: 3 } } });
});

for (const theme of [print, objects, instrument]) {
  test(`${theme.name} dotted criterion sliders update nested weights, ranking, Undo and submission`, () => {
    const store = createStore(), actions: { type: string; payload: unknown }[] = [];
    store.set('dotted.weights', { cost: { total: 1, monthly: 2 }, learning: 2 });
    const source = '```ui:pick\n' + JSON.stringify({ id: 'dotted', criteria: [{ id: 'cost.total', label: 'Cost' }, { id: 'learning', label: 'Learning' }], options: [{ id: 'alpha', title: 'Alpha', scores: { 'cost.total': 0, learning: 1 } }, { id: 'beta', title: 'Beta', scores: { 'cost.total': 1, learning: 0 } }] }) + '\n```';
    const view = render(<Prism source={source} theme={theme} store={store} animate={false} onAction={action => actions.push(action)} />), ui = within(view.container);
    const slider = ui.getByRole('slider', { name: 'Cost weight' }) as HTMLInputElement;
    const announcement = view.container.querySelector('[data-prism="pick"][data-part="live"]')!;
    expect(announcement.textContent).toContain('Alpha');
    fireEvent.input(slider, { target: { value: '3' } });
    expect(store.get('dotted.weights.cost.total')).toBe(3);
    expect((store.get('dotted.weights') as Record<string, unknown>)['cost.total']).toBeUndefined();
    expect(store.get('dotted.weights.cost.monthly')).toBe(2);
    expect(slider.value).toBe('3');
    expect(announcement.textContent).toContain('Beta');
    fireEvent.click(ui.getByRole('button', { name: 'Undo' }));
    expect(slider.value).toBe('1');
    expect(announcement.textContent).toContain('Alpha');
    fireEvent.input(slider, { target: { value: '3' } });
    fireEvent.click(ui.getAllByRole('button', { name: 'Choose Beta ↗' })[0]);
    expect(actions.at(-1)).toMatchObject({ type: 'choose', payload: { option: 'beta', weights: { 'cost.total': 3, learning: 2 } } });
  });
}

for (const theme of [print, objects, instrument]) {
  for (const [currency, price, digits] of [['KWD', 1.234, '1.234'], ['USD', 1.234, '1.23'], ['JPY', 1.6, '2']] as const) {
    test(`${theme.name} Estimate total respects ${currency} currency precision`, () => {
      const source = '```ui:estimate\n' + JSON.stringify({ currency, items: [{ id: 'one', label: 'One', price }] }) + '\n```';
      const view = render(<Prism source={source} theme={theme} locale="en-US" animate={false} onAction={() => {}} />);
      const value = view.container.querySelector('[data-prism="estimate"][data-part="total-value"]')!;
      const money = new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(price);
      expect(view.container.querySelector('[data-prism="estimate"][data-part="live"]')?.textContent).toBe(money);
      if (theme === instrument) {
        const groups = value.querySelectorAll('svg > g');
        expect(groups).toHaveLength(digits.length);
        for (let i = 0; i < digits.length; i++) {
          if (digits[i] === '.') expect(groups[i].querySelector('circle')).not.toBeNull();
          else expect(groups[i].querySelectorAll('polygon[opacity="0.96"]')).toHaveLength(({ '1': 2, '2': 5, '3': 5, '4': 4 } as Record<string, number>)[digits[i]]);
        }
      } else if (theme === objects) expect(value.textContent).toBe(money);
      else expect(value.textContent).toContain(digits);
    });
  }
}

const workflowSource = [
  ':badge[Pilot]{tone="accent"}',
  ':::callout{title="Keep it small"}\nOne useful conversation.\n:::',
  '::::runbook{title="Launch" id="launch"}\n:::step{title="Invite teams" id="invite"}\nSend a short invitation.\n:::\n::::',
  '::::tabs{id="notes"}\n:::tab{label="Plan"}\nFirst panel.\n:::\n:::tab{label="Signals"}\nSecond panel.\n:::\n::::',
  '::::grid{cols=2}\n:::card{title="Learning"}\nA useful surprise.\n:::\n:::card{title="Cost"}\nKeep it small.\n:::\n::::',
  '```ui:summary\n{"id":"notes","title":"Decisions","points":[{"text":"Start small.","source":{"quote":"Six teams.","title":"Brief"}}],"actions":[{"text":"Send invitations"}]}\n```',
  '```ui:troubleshoot\n{"id":"check","start":"test","steps":{"test":{"text":"Send a test.","yes":"$fixed","no":"$escalate"}}}\n```',
].join('\n\n');

for (const theme of [print, objects, instrument]) {
  test(`${theme.name} preserves workflow roles, keyboard tabs, steps, citations and actions`, () => {
    const actions: { type: string; payload: unknown }[] = [];
    const view = render(<Prism source={workflowSource} theme={theme} animate={false} onAction={action => actions.push(action)} />);
    for (const component of ['runbook', 'troubleshoot', 'summary', 'tabs', 'callout', 'card', 'grid', 'badge']) expect(view.container.querySelector(`[data-prism="${component}"][data-part="root"]`)).not.toBeNull();
    const runbook = view.container.querySelector('[data-prism="runbook"][data-part="root"]') as HTMLElement;
    const step = within(runbook).getByRole('checkbox', { name: 'Invite teams' });
    fireEvent.click(step);
    expect(step.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(within(runbook).getByRole('button', { name: 'Undo' }));
    expect(step.getAttribute('aria-checked')).toBe('false');
    const ui = within(view.container), plan = ui.getByRole('tab', { name: 'Plan' }), signals = ui.getByRole('tab', { name: 'Signals' });
    act(() => plan.focus());
    fireEvent.keyDown(plan, { key: 'ArrowRight' });
    expect(signals.getAttribute('aria-selected')).toBe('true');
    expect(signals === document.activeElement).toBe(true);
    expect(ui.getByRole('tabpanel').textContent).toContain('Second panel.');
    expect(ui.getByRole('tabpanel').id).toBe(signals.getAttribute('aria-controls')!);
    const summary = view.container.querySelector('[data-prism="summary"][data-part="root"]') as HTMLElement;
    const point = summary.querySelector('[data-part="pointButton"]')!;
    fireEvent.click(point);
    expect(point.getAttribute('aria-expanded')).toBe('true');
    expect(within(summary).getByText('Six teams.')).toBeTruthy();
    fireEvent.click(within(summary).getByRole('checkbox'));
    expect((within(summary).getByRole('checkbox') as HTMLInputElement).checked).toBe(true);
    fireEvent.click(summary.querySelector('[data-part="send"]')!);
    expect(actions.at(-1)?.type).toBe('send');
    const troubleshoot = view.container.querySelector('[data-prism="troubleshoot"][data-part="root"]') as HTMLElement;
    fireEvent.click(within(troubleshoot).getByRole('button', { name: /^Yes$/ }));
    fireEvent.click(within(troubleshoot).getByRole('button', { name: 'Send report' }));
    expect(actions.at(-1)).toMatchObject({ type: 'troubleshoot', payload: { resolved: true } });
  });

  test(`${theme.name} keeps empty and malformed workflows guarded and feedback theme-neutral`, () => {
    const actions: { type: string; payload: unknown }[] = [];
    const view = render(<Prism source={':::runbook{title="Empty"}\n:::\n\n:::tabs\n:::\n\n```ui:summary\n{"points":[],"actions":[]}\n```\n\n```ui:troubleshoot\n{"start":"missing","steps":{}}\n```'} theme={theme} animate={false} onAction={action => actions.push(action)} />);
    expect(within(view.container).queryAllByRole('tab')).toHaveLength(0);
    const summary = view.container.querySelector('[data-prism="summary"][data-part="send"]')!;
    expect(summary.hasAttribute('disabled')).toBe(true);
    const primary = view.container.querySelector('[data-prism="troubleshoot"][data-part="primary"]')!;
    expect(primary.textContent).toContain('Send report');
    fireEvent.click(primary);
    expect(actions.at(-1)).toMatchObject({ type: 'troubleshoot', payload: { resolved: false } });
    const components: Record<string, { slots?: unknown; strings?: Record<string, string> }> = theme.components;
    expect(components.artifact).toBeUndefined();
    expect(components.feedback).toBeUndefined();
    expect(components.mockup?.slots).toBeUndefined();
    expect(theme.css).not.toMatch(/prism-(artifact__|inline-feedback|mockup__(input|overall|count|feedbackFooter|marker|popover|primary))/);
  });
}
