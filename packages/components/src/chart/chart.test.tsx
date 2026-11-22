import './setup';
import { afterEach, expect, test } from 'bun:test';
import { act, cleanup, fireEvent, render, within } from '@testing-library/react';
import { Prism, createRegistry, type Action } from '@prism-ui/react';
import { createStore } from '@prism-ui/state';
import { chartDefinition, type ChartProps, type ChartType } from './index';

afterEach(cleanup);
const registry = createRegistry([chartDefinition]);
const source = (props: ChartProps) => '```ui:chart\n' + JSON.stringify(props) + '\n```';
const data = [{ month: 'Jan', region: 'East', revenue: 10, cost: 4 }, { month: 'Feb', region: 'East', revenue: 12, cost: 5 }, { month: 'Mar', region: 'West', revenue: 8, cost: 3 }];
const series = [{ key: 'revenue', label: 'Revenue' }, { key: 'cost', label: 'Cost' }];
const base: ChartProps = { title: 'Monthly revenue', x: 'month', series, data };

for (const type of ['line', 'area', 'bar', 'pie'] as ChartType[]) {
  test(`${type} renders SVG geometry and accessible static data`, () => {
    const view = render(<Prism registry={registry} source={source({ ...base, type })} />);
    const part = type === 'pie' ? 'slice' : type === 'bar' ? 'bar' : type === 'area' ? 'area' : 'line';
    const paths = view.container.querySelectorAll(`path[data-part="${part}"]`);
    expect(paths.length).toBeGreaterThan(0);
    paths.forEach(path => { expect(path.getAttribute('d')).toBeTruthy(); expect(path.getAttribute('d')).not.toContain('NaN'); });
    expect(view.getByRole('table').textContent).toContain('Monthly revenue data');
    expect(view.getByRole('table').textContent).toContain('Jan');
    expect(view.getByRole('img').getAttribute('height')).toBe('300');
    if (type === 'pie') { expect(view.container.querySelector('[data-part="total"]')?.textContent).toBe('30'); expect(view.container.querySelector('[data-part="leader"]')).toBeTruthy(); }
  });
}

test('streaming skeleton keeps height, appended points keep y-domain within hysteresis and reserve x space', () => {
  let text = '```ui:chart\n{"x":"month","series":[{"key":"revenue"}],"data":[';
  const view = render(<Prism registry={registry} source={text} done={false} />);
  const svg = view.getByRole('img');
  expect(view.container.querySelector('[data-part="skeleton"]')).toBeTruthy();
  expect(view.container.querySelector('[data-part="grid"]')).toBeTruthy();
  text += '{"month":"Jan","revenue":10}';
  view.rerender(<Prism registry={registry} source={text} done={false} />);
  const firstDomain = svg.getAttribute('data-y-domain'), firstX = view.container.querySelector('[data-part="point"]')?.getAttribute('cx');
  const path = view.container.querySelector('[data-part="line"]')?.getAttribute('d');
  text += ',{"month":"Feb","revenue":10.1}';
  view.rerender(<Prism registry={registry} source={text} done={false} />);
  expect(view.container.querySelector('[data-part="skeleton"]')).toBeNull();
  expect(svg.getAttribute('data-y-domain')).toBe(firstDomain);
  expect(view.container.querySelector('[data-part="point"]')?.getAttribute('cx')).toBe(firstX);
  expect(view.container.querySelector('[data-part="line"]')?.getAttribute('d')).not.toBe(path);
  expect(svg.getAttribute('height')).toBe('300');
  text += ',{"month":"Mar","revenue":100}';
  view.rerender(<Prism registry={registry} source={text} done={false} />);
  expect(Number(svg.getAttribute('data-y-domain')!.split(',')[1])).toBeGreaterThanOrEqual(100);
});

test('legend toggles persist, Enter works, and the last visible series cannot be hidden', () => {
  const store = createStore();
  const view = render(<Prism registry={registry} store={store} source={source({ ...base, id: 'growth' })} />);
  const revenue = view.getByRole('button', { name: 'Toggle Revenue' }), cost = view.getByRole('button', { name: 'Toggle Cost' });
  fireEvent.click(revenue);
  expect(revenue.getAttribute('aria-pressed')).toBe('false');
  expect(view.container.querySelectorAll('[data-part="line"]').length).toBe(1);
  expect(store.get('growth.hidden')).toEqual(['revenue']);
  fireEvent.click(cost);
  expect(cost.getAttribute('aria-pressed')).toBe('true');
  fireEvent.keyDown(revenue, { key: 'Enter' });
  expect(view.container.querySelectorAll('[data-part="line"]').length).toBe(2);
});

test('keyboard navigation updates tooltip and live text without rerendering memoized paths', () => {
  let renders = 0;
  function Line({ as, ...props }: any) { renders++; return <path {...props} />; }
  const slots = { chart: { line: Line } };
  const view = render(<Prism registry={registry} source={source(base)} slots={slots} />);
  const svg = view.getByRole('img'), before = renders;
  act(() => svg.focus());
  fireEvent.keyDown(svg, { key: 'ArrowRight' });
  expect(view.getByRole('status').textContent).toBe('Feb. Revenue: 12. Cost: 5');
  expect(view.getByRole('tooltip').textContent).toContain('Feb');
  fireEvent.keyDown(svg, { key: 'ArrowDown' });
  expect(view.container.querySelector('[data-part="tooltip-row"][data-state="active"]')?.textContent).toContain('Cost');
  fireEvent.keyDown(svg, { key: 'End' }); expect(view.getByRole('status').textContent).toContain('Mar');
  fireEvent.keyDown(svg, { key: 'Home' }); expect(view.getByRole('status').textContent).toContain('Jan');
  expect(renders).toBe(before);
});

test('point click and keyboard selection emit exact structured payloads', () => {
  const actions: Action[] = [];
  const view = render(<Prism scope="test" registry={registry} source={source(base)} onAction={action => actions.push(action)} />);
  const point = view.container.querySelector('[data-part="point"][data-index="1"][data-series="0"]')!;
  fireEvent.click(point);
  expect(actions[0]).toEqual({ type: 'select', component: 'chart', id: 'test:0', payload: { x: 'Feb', series: 'revenue', value: 12 },
    context: { component: 'chart', props: { ...base }, state: { pivot: -1, hidden: [] } },
    message: 'User select in chart: {"x":"Feb","series":"revenue","value":12}' });
  fireEvent.keyDown(view.getByRole('img'), { key: 'ArrowDown' });
  fireEvent.keyDown(view.getByRole('img'), { key: 'Enter' });
  expect(actions[1].payload).toEqual({ x: 'Feb', series: 'cost', value: 5 });
});

test('pointer hover shows all formatted series, crosshair and selected bar overlay', () => {
  const view = render(<Prism registry={registry} source={source({ ...base, type: 'bar' })} />);
  const bar = view.container.querySelector('[data-part="bar"][data-index="2"][data-series="1"]')!;
  fireEvent.pointerMove(bar);
  expect(view.getByRole('tooltip').textContent).toBe('MarRevenue8Cost3');
  expect(view.container.querySelector('[data-part="crosshair"]')).toBeTruthy();
  expect(view.container.querySelector('[data-part="highlight"]')?.getAttribute('d')).toBe(bar.getAttribute('d'));
  fireEvent.pointerLeave(view.getByRole('img'));
  expect(view.queryByRole('tooltip')).toBeNull();
});

test('Answer chart opens on annotation, pivots aggregate x and change type, emit and undo', () => {
  const actions: Action[] = [], store = createStore();
  const props: ChartProps = { ...base, id: 'answer', insight: 'February was strongest', annotations: [{ x: 'Feb', label: 'Launch' }], pivots: [{ label: 'By region', x: 'region', type: 'bar', series: [{ key: 'revenue', label: 'Revenue' }] }] };
  const view = render(<Prism registry={registry} store={store} source={source(props)} onAction={action => actions.push(action)} />);
  expect(view.getByRole('heading').textContent).toBe('February was strongest');
  expect(view.container.querySelector('[data-mode="answer"]')).toBeTruthy();
  expect(view.getByRole('status').textContent).toContain('Feb');
  expect(view.getByText('Launch')).toBeTruthy();
  expect(view.container.querySelector('[data-part="highlight"]')).toBeTruthy();
  fireEvent.click(view.getByRole('button', { name: 'By region' }));
  expect(actions[0].payload).toEqual({ pivot: 0, label: 'By region' });
  expect(actions[0].type).toBe('pivot');
  expect(store.get('answer.pivot')).toBe(0);
  expect(view.container.querySelectorAll('[data-part="bar"]').length).toBe(2);
  expect(view.getByRole('table').textContent).toContain('East22');
  expect(view.getByRole('button', { name: 'By region' }).getAttribute('aria-pressed')).toBe('true');
  fireEvent.click(view.getByRole('button', { name: 'Undo chart change' }));
  expect(view.container.querySelectorAll('[data-part="line"]').length).toBe(2);
});

test('stacked area/bar, inference, Intl and pie arrow navigation', () => {
  const view = render(<Prism registry={registry} locale="de-DE" currency="EUR" source={source({ ...base, type: 'area', stacked: true, format: 'currency', series: undefined })} />);
  expect(view.getByRole('button', { name: 'Toggle revenue' })).toBeTruthy();
  expect(view.container.querySelectorAll('[data-part="area"]').length).toBe(2);
  fireEvent.keyDown(view.getByRole('img'), { key: 'ArrowRight' });
  expect(view.getByRole('tooltip').textContent).toContain(new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR' }).format(12));
  view.rerender(<Prism registry={registry} source={source({ ...base, type: 'bar', stacked: true })} />);
  expect(view.container.querySelectorAll('[data-part="bar"]').length).toBe(6);
  view.rerender(<Prism registry={registry} source={source({ ...base, type: 'pie' })} />);
  fireEvent.keyDown(view.getByRole('img'), { key: 'Home' });
  fireEvent.keyDown(view.getByRole('img'), { key: 'ArrowDown' });
  expect(view.getByRole('status').textContent).toContain('Feb');
});

test('empty and invalid data are safe; unstyled slots and motion flag remain supported', () => {
  const view = render(<Prism registry={registry} source={source({ data: [] })} unstyled animate={false} slots={{ chart: { empty: ({ as, ...props }: any) => <div {...props}>No points</div> } }} classNames={{ chart: { header: 'custom-header' } }} styles={{ chart: { header: { opacity: .5 } } }} />);
  expect(view.getByText('No points')).toBeTruthy();
  expect(view.container.querySelector('[class*="prism-chart"]')).toBeNull();
  expect(view.container.querySelector('.custom-header')?.getAttribute('style')).toContain('0.5');
  expect(view.getByRole('figure').getAttribute('data-animate')).toBe('false');
  view.rerender(<Prism registry={registry} source={'```ui:chart\n{"series":[{"key":"n"}],"data":[null,3,{"x":"a","n":"invalid"}]}\n```'} />);
  view.container.querySelectorAll('path').forEach(path => expect(path.getAttribute('d')).not.toContain('NaN'));
  expect(registry.docs()).toContain('zero-based');
});

test('one ResizeObserver updates viewBox and disconnects on unmount', () => {
  const previous = globalThis.ResizeObserver;
  let callback: ResizeObserverCallback | undefined, observed = 0, disconnected = 0;
  class Observer {
    constructor(fn: ResizeObserverCallback) { callback = fn; }
    observe() { observed++; } disconnect() { disconnected++; } unobserve() {}
  }
  globalThis.ResizeObserver = Observer as unknown as typeof ResizeObserver;
  try {
    const view = render(<Prism registry={registry} source={source(base)} />);
    expect(observed).toBe(1);
    act(() => callback?.([{ contentRect: { width: 480 } } as ResizeObserverEntry], {} as ResizeObserver));
    expect(view.getByRole('img').getAttribute('viewBox')).toBe('0 0 480 300');
    view.unmount(); expect(disconnected).toBe(1);
  } finally { globalThis.ResizeObserver = previous; }
});

test('tooltip flips away from upcoming points on the right half of the chart', () => {
  const view = render(<Prism registry={registry} source={source(base)} />);
  const svg = view.getByRole('img');
  fireEvent.keyDown(svg, { key: 'Home' });
  expect(view.getByRole('tooltip').style.transform).toBe('translateX(12px)');
  fireEvent.keyDown(svg, { key: 'End' });
  expect(view.getByRole('tooltip').style.transform).toBe('translateX(calc(-100% - 12px))');
});

test('pie center names the total series and labels include formatted values', () => {
  const view = render(<Prism registry={registry} source={source({ ...base, type: 'pie', format: 'currency' })} currency="USD" locale="en-US" />);
  expect(view.container.querySelector('[data-part="total-caption"]')?.textContent).toBe('Revenue');
  expect(Array.from(view.container.querySelectorAll('[data-part="slice-value"]')).map(label => label.textContent).sort()).toEqual([' · $10.00', ' · $12.00', ' · $8.00']);
  view.rerender(<Prism registry={registry} source={source({ type: 'pie', data: [] })} />);
  expect(view.container.querySelector('[data-part="total-caption"]')?.textContent).toBe('Total');
  expect(view.container.querySelectorAll('[data-part="slice-value"]').length).toBe(0);
});

test('x pivots retain category fields named like intermediate pivot keys', () => {
  const props: ChartProps = { x: 'month', series: [{ key: '__region' }], data: [{ month: 'Jan', region: 'East', __region: 2 }, { month: 'Feb', region: 'East', __region: 3 }], pivots: [{ label: 'Group', x: 'region' }] };
  const view = render(<Prism registry={registry} source={source(props)} />);
  fireEvent.click(view.getByRole('button', { name: 'Group' }));
  expect(view.getByRole('table').textContent).toContain('East5');
});

test('streaming domains reserve headroom, stay absent before finite values, and settle tightly once complete', () => {
  let text = '```ui:chart\n{"x":"month","series":[{"key":"revenue"}],"data":[';
  const view = render(<Prism registry={registry} source={text} done={false} animate={false} />);
  const svg = view.getByRole('img');
  expect(svg.getAttribute('data-y-domain')).toBeNull();
  expect(view.container.querySelector('[data-part="tick"]')).toBeNull();
  text += '{"month":"Jan","revenue":"invalid"},';
  view.rerender(<Prism registry={registry} source={text} done={false} animate={false} />);
  expect(svg.getAttribute('data-y-domain')).toBeNull();
  expect(view.container.querySelector('[data-part="skeleton"]')).toBeTruthy();
  const domains: string[] = [];
  for (const [index, value] of [24000, 28000, 42000, 84000].entries()) {
    text += `${index ? ',' : ''}{"month":"${index}","revenue":${value}}`;
    view.rerender(<Prism registry={registry} source={text} done={false} animate={false} />);
    const domain = svg.getAttribute('data-y-domain')!;
    if (domain !== domains.at(-1)) domains.push(domain);
    expect(Number(domain.split(',')[1])).toBeGreaterThanOrEqual(value);
  }
  expect(domains.length).toBeLessThanOrEqual(3);
  const padded = Number(domains.at(-1)!.split(',')[1]);
  expect(padded).toBeGreaterThanOrEqual(84000 * 1.5);
  view.rerender(<Prism registry={registry} source={text + ']}\n```'} animate={false} />);
  expect(Number(svg.getAttribute('data-y-domain')!.split(',')[1])).toBeLessThan(padded);
  expect(svg.getAttribute('data-y-display-domain')).toBe(svg.getAttribute('data-y-domain'));
});
