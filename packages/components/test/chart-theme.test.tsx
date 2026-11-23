import '../../react/test/setup';
import { afterEach, expect, test } from 'bun:test';
import { createElement, forwardRef } from 'react';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { Prism, createRegistry, defineTheme, usePrism, type Action, type PrismComponentProps } from '@prism-ui/react';
import { chartDefinition, useChart, type ChartModel, type ChartProps, type ChartSlotProps } from '../src/chart';
import { pointY } from '../src/lib/chart';

afterEach(cleanup);
const registry = createRegistry([chartDefinition]);
const data = [{ month: 'Jan', revenue: 10, cost: 4 }, { month: 'Feb', revenue: 18, cost: 6 }, { month: 'Mar', revenue: 13, cost: 5 }];
const series = [{ key: 'revenue', label: 'Revenue' }, { key: 'cost', label: 'Cost' }];
const base: ChartProps = { id: 'answer', title: 'Revenue', subtitle: 'Monthly', insight: 'February was strongest', x: 'month', data, series, annotations: [{ x: 'Jan', label: 'Launch' }], pivots: [{ label: 'Bars', type: 'bar' }] };
const source = (props: ChartProps) => '\x60\x60\x60ui:chart\n' + JSON.stringify(props) + '\n\x60\x60\x60';

test('compact headers keep utility actions beside the heading instead of reserving a blank row', async () => {
  const css = await Bun.file(new URL('../src/chart/chart.css', import.meta.url)).text();
  expect(css).toContain('@container prism-chart (max-width: 320px)');
  expect(css).toContain('.prism-root .prism-chart__header { flex-wrap: nowrap;');
  expect(css).toContain('.prism-chart__heading { flex: 1; }');
});

test('compact headless geometry thins ticks and line charts ignore bar/area stacking', () => {
  let model!: ChartModel;
  function Headless({ props }: PrismComponentProps<ChartProps>) { model = useChart(props, usePrism(), 280, 0); return <button onClick={() => model.activate({ index: 1, series: 0 })}>Explore</button>; }
  const custom = createRegistry([{ ...chartDefinition, component: Headless }]);
  const view = render(<Prism registry={custom} source={source({ ...base, type: 'line' })} animate={false} />);
  const paths = model.geometry.layers.map(layer => layer.line), domain = model.geometry.domain;
  view.rerender(<Prism registry={custom} source={source({ ...base, type: 'line', stacked: true })} animate={false} />);
  expect(model.geometry.labels.length).toBeLessThanOrEqual(3); expect(model.geometry.ticks.length).toBeLessThanOrEqual(4);
  expect(model.geometry.layers.map(layer => layer.line)).toEqual(paths); expect(model.geometry.domain).toEqual(domain);
  fireEvent.click(view.getByRole('button', { name: 'Explore' })); expect(model.tooltipY).toBeGreaterThan(model.geometry.top); expect(model.tooltipY).toBeCloseTo((pointY(model.geometry.layers[0].points[1]!) ?? 0) + 12);
});

test('all declared Chart parts accept model-aware slots across every mode and ready/empty/error/streaming states', () => {
  const covered = new Set<string>();
  for (const fixture of ['line', 'bar', 'area', 'pie', 'empty', 'error', 'stream'] as const) {
    function mount(slots = {}) {
      const props: ChartProps = fixture === 'empty' ? { data: [] } : fixture === 'error' ? { ...base, data: [{ month: 'Jan', revenue: 'invalid' }] } : { ...base, type: fixture === 'stream' ? 'line' : fixture, stacked: fixture === 'area' || fixture === 'bar' };
      const view = render(<Prism registry={registry} source={fixture === 'stream' ? '\x60\x60\x60ui:chart\n{"data":[' : source(props)} done={fixture !== 'stream'} animate={false} slots={slots} />);
      if (!['empty', 'error', 'stream'].includes(fixture)) fireEvent.keyDown(view.getByRole('img'), { key: 'Home' });
      return view;
    }
    const baseView = mount(), parts = Array.from(baseView.container.querySelectorAll('[data-prism="chart"][data-part]')).map(node => ({ part: node.getAttribute('data-part')!, tag: node.localName })); cleanup();
    for (const { part, tag } of parts) {
      expect(chartDefinition.parts).toContain(part);
      if (covered.has(part)) continue;
      const Marker = forwardRef<any, any>(function Marker({ as, chart, series, point, ...props }, ref) { expect(chart.geometry).toBeDefined(); expect(chart.data).toBeDefined(); return createElement(as ?? tag, { ...props, ref, 'data-marker': part }); });
      const view = mount({ chart: { [part]: Marker } }); expect(view.container.querySelector('[data-marker="' + part + '"]')).not.toBeNull(); covered.add(part); cleanup();
    }
  }
  expect([...covered].sort()).toEqual([...chartDefinition.parts!].sort());
});

test('theme strings, icon overrides and typed series/point slots preserve keyboard, actions, pivots and undo', () => {
  const actions: Action[] = [], models: ChartModel[] = [];
  function Point({ chart, series, point, ...props }: ChartSlotProps['point'] & Record<string, any>) { const { as, ...dom } = props; expect(series.key).toBeTruthy(); expect(point.row).toBe(chart.data[point.index]); models.push(chart); return <circle {...dom} data-model="point" />; }
  const theme = defineTheme({ name: 'chart-test', components: { chart: { slots: { point: Point }, strings: { title: 'Carte', instructions: 'Explorez {title}', toggleSeries: 'Afficher {series}', chartViews: 'Vues', askAboutThisChart: 'Question', undoChartChange: 'Annuler', tooltipLabel: 'Valeurs {category}', announcement: '{category} / {values}', seriesValue: '{series} = {value}', valueSeparator: ' ; ', askMessage: 'Question traduite', selectMessage: 'Choix {payload}', pivotMessage: 'Vue {payload}', dataCaption: 'Données {title}' } } }, icons: { ask: props => <svg {...props} data-icon="custom" /> } });
  const view = render(<Prism registry={registry} source={source(base)} theme={theme} animate={false} onAction={action => actions.push(action)} />);
  expect(models.length).toBeGreaterThan(0); expect(view.getByRole('img').getAttribute('aria-label')).toBe('Explorez Carte'); expect(view.getByRole('table').textContent).toContain('Données Carte'); expect(view.container.querySelector('[data-icon="custom"]')).not.toBeNull();
  expect(view.getByRole('group', { name: 'Vues' })).toBeTruthy(); expect(view.getByRole('group', { name: 'Series' })).toBeTruthy(); expect(view.queryByRole('tooltip')).toBeNull();
  fireEvent.keyDown(view.getByRole('img'), { key: 'Home' }); expect(view.getByRole('tooltip').getAttribute('aria-label')).toBe('Valeurs Jan'); expect(view.getByRole('status').textContent).toBe('Jan / Revenue = 10 ; Cost = 4');
  fireEvent.keyDown(view.getByRole('img'), { key: 'Enter' }); expect(actions.at(-1)?.payload).toEqual({ x: 'Jan', series: 'revenue', value: 10 }); expect(actions.at(-1)?.message).toStartWith('Choix ');
  fireEvent.click(view.getByRole('button', { name: 'Afficher Cost' })); expect(view.getByRole('button', { name: 'Afficher Cost' }).getAttribute('aria-pressed')).toBe('false');
  fireEvent.click(view.getByRole('button', { name: 'Annuler' })); expect(view.getByRole('button', { name: 'Afficher Cost' }).getAttribute('aria-pressed')).toBe('true');
  fireEvent.click(view.getByRole('button', { name: 'Bars' })); expect(actions.at(-1)?.message).toStartWith('Vue '); expect(view.container.querySelector('[data-part="bar"]')).not.toBeNull();
  fireEvent.click(view.getByRole('button', { name: 'Question' })); expect(actions.at(-1)?.message).toBe('Question traduite');
});

test('hovering the props-emphasized point opens its tooltip and crosshair, leaving restores emphasis only', () => {
  const view = render(<Prism registry={registry} source={source(base)} animate={false} />);
  expect(view.container.querySelector('[data-part="highlight"]')).not.toBeNull(); expect(view.container.querySelector('[data-part="crosshair"]')).toBeNull(); expect(view.queryByRole('tooltip')).toBeNull();
  fireEvent.pointerMove(view.container.querySelector('[data-part="point"][data-index="0"][data-series="0"]')!, { clientX: 100, clientY: 80 });
  expect(view.getByRole('tooltip').textContent).toContain('Jan'); expect(view.container.querySelector('[data-part="crosshair"]')).not.toBeNull();
  fireEvent.pointerLeave(view.getByRole('img')); expect(view.queryByRole('tooltip')).toBeNull(); expect(view.container.querySelector('[data-part="crosshair"]')).toBeNull(); expect(view.container.querySelector('[data-part="highlight"]')).not.toBeNull();
});

test('fallback, empty, error, streaming and pie labels are translated', () => {
  const theme = defineTheme({ name: 'chart-empty', components: { chart: { strings: { title: 'Graphique', description: 'Description traduite', noChartData: 'Vide', loadingChart: 'Chargement', invalidData: 'Nombres invalides', total: 'Somme', sliceValue: ' valeur {value}', pointLabel: '{category} vaut {value}', emptyValue: 'Absent' } } } });
  const view = render(<Prism registry={registry} source={source({ data: [] })} theme={theme} animate={false} />);
  expect(view.getByRole('heading').textContent).toBe('Graphique'); expect(view.getByText('Vide')).toBeTruthy(); expect(view.container.querySelector('desc')?.textContent).toBe('Description traduite');
  view.rerender(<Prism registry={registry} source={'\x60\x60\x60ui:chart\n{"data":['} done={false} theme={theme} animate={false} />); expect(view.getByText('Chargement')).toBeTruthy(); expect(view.getByRole('figure').dataset.state).toBe('streaming'); expect(view.container.querySelector('[data-prism-skeleton]')).not.toBeNull();
  view.rerender(<Prism registry={registry} source={source({ x: 'month', series, data: [{ month: 'Jan', revenue: 'bad' }] })} theme={theme} animate={false} />); expect(view.getByRole('alert').textContent).toBe('Nombres invalides'); expect(view.getByRole('table').textContent).toContain('Absent');
  view.rerender(<Prism registry={registry} source={source({ ...base, type: 'pie' })} theme={theme} animate={false} />); expect(view.container.querySelector('[data-part="point-title"]')?.textContent).toBe('Jan vaut 10'); expect(view.container.querySelector('[data-part="slice-value"]')?.textContent).toContain('valeur');
  view.rerender(<Prism registry={registry} source={source({ type: 'pie', data: [] })} theme={theme} animate={false} />); expect(view.container.querySelector('[data-part="total-caption"]')?.textContent).toBe('Somme');
});

test('moving axes stay canvas-clipped and grids plot-clipped without dangling empty/error masks', () => {
  const view = render(<Prism registry={registry} source={source(base)} animate={false} />);
  view.container.querySelectorAll('[data-part="axis-row"]').forEach(row => expect(row.getAttribute('clip-path')).toContain('-axis-clip)'));
  view.container.querySelectorAll('[data-part="grid"]').forEach(grid => expect(grid.getAttribute('clip-path')).toContain('-clip)'));
  expect(view.container.querySelectorAll('[data-part="clip"]')).toHaveLength(2);
  for (const data of [[], [{ month: 'Jan', revenue: 'bad' }]]) {
    view.rerender(<Prism registry={registry} source={source({ ...base, data })} animate={false} />);
    expect(view.container.querySelectorAll('[clip-path]')).toHaveLength(0);
  }
});

test('custom plot point and layer slots receive current active selection on keyboard and hover', () => {
  const Point = forwardRef<any, any>(function Point({ as, chart, series, point, ...props }, ref) { return <circle {...props} ref={ref} data-active-point={chart.active?.index ?? 'none'} />; });
  const Layer = forwardRef<any, any>(function Layer({ as, chart, series, point, ...props }, ref) { return <g {...props} ref={ref} data-active-layer={chart.active?.index ?? 'none'} />; });
  const view = render(<Prism registry={registry} source={source({ ...base, annotations: [], insight: undefined })} animate={false} slots={{ chart: { point: Point, layer: Layer } }} />);
  const active = () => view.container.querySelector('[data-active-point]')?.getAttribute('data-active-point');
  expect(active()).toBe('none');
  fireEvent.keyDown(view.getByRole('img'), { key: 'End' });
  expect(active()).toBe('2');
  expect(view.container.querySelector('[data-active-layer]')?.getAttribute('data-active-layer')).toBe('2');
  fireEvent.pointerLeave(view.getByRole('img'));
  expect(active()).toBe('none');
  fireEvent.pointerMove(view.container.querySelector('[data-index="0"][data-series="0"]')!);
  expect(active()).toBe('0');
});
