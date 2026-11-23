import '../../react/test/setup';
import { afterEach, expect, test } from 'bun:test';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import type { ReactNode } from 'react';
import { Prism } from '@prism-ui/react';
import '@prism-ui/components/estimate';
import '@prism-ui/components/pick';
import { instrument, objects, print } from './index';

afterEach(cleanup);
const pause = () => act(() => new Promise<void>(resolve => setTimeout(resolve, 750)));
const fence = (name: string, props: object) => '```ui:' + name + '\n' + JSON.stringify(props) + '\n```';
const Plain = ({ children }: { children?: ReactNode }) => <article>{children}</article>;

for (const theme of [instrument, objects, print]) {
  test(`${theme.name} totals expose final values but are not live while streaming`, () => {
    const source = fence('estimate', { id: 'quote', items: [{ id: 'seat', label: 'Seat', price: 10 }] });
    const view = render(<Prism source={source.slice(0, -4)} done={false} theme={theme} />);
    const total = view.container.querySelector('.prism-estimate__live')!;
    expect(total.getAttribute('aria-live')).toBe('off');
    expect(total.textContent).toContain('10');
    view.rerender(<Prism source={source} theme={theme} />);
    expect(view.container.querySelector('.prism-estimate__live')!.getAttribute('aria-live')).toBe('polite');
  });

  test(`${theme.name} custom pick receipts announce once and remount silently`, async () => {
    const source = fence('pick', { id: 'choice', criteria: [{ id: 'fit', label: 'Fit' }], options: [{ id: 'plan', title: 'Plan', scores: { fit: 1 } }] });
    const props = { source, theme, onAction: () => {} };
    const view = render(<Prism {...props} />), output = view.container.querySelector('[data-prism-announcer]')!;
    const messages: string[] = [], observer = new MutationObserver(() => messages.push(output.textContent!));
    observer.observe(output, { childList: true, subtree: true, characterData: true });
    expect(output.textContent).toBe('');
    fireEvent.click(view.getByRole('button', { name: 'Choose Plan ↗' }));
    await pause(); expect(messages).toEqual(['Chosen']);
    expect(view.container.querySelectorAll('[role="status"]')).toHaveLength(1);
    view.rerender(<Prism {...props} slots={{ pick: { item: Plain } }} />);
    view.rerender(<Prism {...props} />);
    await pause(); expect(messages).toEqual(['Chosen']);
    observer.disconnect();
  });
}
