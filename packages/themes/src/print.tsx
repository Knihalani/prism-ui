import { Children, createContext, createElement, forwardRef, useContext, type ElementType, type InputHTMLAttributes, type ReactElement, type ReactNode } from 'react';
import { ComponentContext, PrismPart, defineTheme, useFormat, usePart, useStrings } from '@prism-ui/react';
import type { EstimateModel } from '@prism-ui/components/estimate';
import type { usePick } from '@prism-ui/components/pick';
import type { FrameSlotProps } from '@prism-ui/components/frame';

type SlotProps = FrameSlotProps<unknown>;
type EstimateRow = EstimateModel['rows'][number];
type PickRow = ReturnType<typeof usePick>['rows'][number];
const AccountActions = createContext<ReactNode>(null);
const ItemIndex = createContext(-1);
const supported = new Set(['estimate', 'pick', 'mockup', 'view', 'frame', 'runbook', 'troubleshoot', 'summary']);
function currencyCode(value: unknown, fallback: string) {
  return typeof value === 'string' && /^[a-z]{3}$/i.test(value.trim()) ? value.trim().toUpperCase() : fallback;
}

const Header = forwardRef<HTMLElement, SlotProps>(function Header({ as = 'header', model, frame, overflow, children, ...props }, ref) {
  const component = (props as Record<string, unknown>)['data-prism'] as string;
  const strings = useStrings(component);
  return createElement(as, { ...props, ref, 'data-print-header': supported.has(component) ? '' : undefined }, children,
    supported.has(component) && <span className="print-index">{strings.sectionIndex}</span>);
});
const Tool = forwardRef<HTMLElement, SlotProps>(function Tool({ as = 'button', model, frame, overflow, children, ...props }, ref) {
  const component = (props as Record<string, unknown>)['data-prism'] as string;
  return createElement(as, { ...props, ref, 'data-print-tool': supported.has(component) ? '' : undefined }, supported.has(component) ? props['aria-label'] : children);
});
const EstimateRoot = forwardRef<HTMLElement, SlotProps>(function EstimateRoot({ as = 'section', model, frame, overflow, children, ...props }, ref) {
  const [header, body, footer] = Children.toArray(children);
  return createElement(as, { ...props, ref, 'data-print-estimate': '' }, <AccountActions.Provider value={footer}>{header}{body}</AccountActions.Provider>);
});
const EstimateBody = forwardRef<HTMLDivElement, SlotProps>(function EstimateBody({ as, model, frame, overflow, children, ...props }, ref) {
  const [items, summary] = Children.toArray(children), actions = useContext(AccountActions), strings = useStrings('estimate');
  const context = useContext(ComponentContext)!, format = useFormat();
  const notes = (context.props.items as EstimateRow[]).slice(0, 2).map((item, index) => `${index === 0 ? '¹' : '²'} ${item.description ?? item.label}`).join('  ');
  return <div {...props} ref={ref} data-print-estimate-grid=""><div className="print-estimate-items">{items}<p className="print-footnote">{strings.footnote.replace('{notes}', notes).replace('{currency}', currencyCode(context.props.currency, format.currencyCode))}</p></div><div className="print-account">{summary}{actions}</div></div>;
});
const EstimateItem = forwardRef<HTMLDivElement, SlotProps & { row: EstimateRow }>(function EstimateItem({ as, model, frame, overflow, row, children, ...props }, ref) {
  const context = useContext(ComponentContext)!;
  const index = (context.props.items as EstimateRow[]).findIndex(item => item.id === row.id);
  const pieces = Children.toArray(children);
  return <ItemIndex.Provider value={index}><div {...props} ref={ref} data-optional={row.optional ? '' : undefined}>{row.optional ? <>{pieces[1]}{pieces[0]}</> : children}</div></ItemIndex.Provider>;
});
const EstimateLabel = forwardRef<HTMLDivElement, SlotProps>(function EstimateLabel({ as, model, frame, overflow, children, ...props }, ref) {
  const index = useContext(ItemIndex), format = useFormat();
  return <div {...props} ref={ref}>{children}{index >= 0 && index < 2 && <sup aria-hidden="true">{format.number(index + 1)}</sup>}</div>;
});
const Switch = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { as?: ElementType }>(function Switch({ as, ...props }, ref) {
  return <input {...props} ref={ref} role="switch" />;
});
const Total = forwardRef<HTMLDivElement, SlotProps & { estimate: EstimateModel }>(function Total({ as, model, frame, overflow, estimate, children, ...props }, ref) {
  const format = useFormat(), context = useContext(ComponentContext)!;
  const label = usePart('estimate', 'total-label'), value = usePart('estimate', 'total-value'), live = usePart('estimate', 'live');
  const currency = estimate.totalText.replace(/[\p{N}\p{P}\p{Z}\p{Cf}]/gu, '');
  return <div {...props} ref={ref} data-print-total=""><PrismPart as="span" {...label}>{estimate.totalLabel} / {currencyCode(context.props.currency, format.currencyCode)}</PrismPart><PrismPart as="span" {...value} aria-hidden="true"><sup>{currency}</sup><span>{format.number(estimate.displayedTotal, { maximumFractionDigits: estimate.fractionDigits })}</span></PrismPart><PrismPart as="span" {...live} aria-live="polite">{estimate.finalTotalText}</PrismPart></div>;
});

const Criteria = forwardRef<HTMLDivElement, SlotProps & { pick: ReturnType<typeof usePick> }>(function Criteria({ as, model, frame, overflow, pick, children, ...props }, ref) {
  const strings = useStrings('pick');
  return <div {...props} ref={ref}>{pick.chips.map(criterion => {
    const weight = criterion.weight;
    return <label className="print-weight" key={criterion.id}><span>{criterion.label}<output>{weight}</output></span><input type="range" min={0} max={3} step={1} value={weight} aria-label={`${criterion.label} ${strings.weightLabel}`} onInput={event => pick.setWeight(criterion.id, Number(event.currentTarget.value))} /></label>;
  })}</div>;
});
function Option({ row }: { row: PickRow }) {
  const strings = useStrings('pick'), format = useFormat();
  const root = usePart('pick', 'item', !row.ready ? 'loading' : row.chosen ? 'chosen' : row.top ? 'top' : 'ready');
  const title = usePart('pick', 'title'), subtitle = usePart('pick', 'subtitle'), bars = usePart('pick', 'bars'), choose = usePart('pick', 'choose');
  return <article {...root} data-print-option="" data-print-winner={row.top ? '' : undefined} data-option={row.id} aria-busy={!row.ready}>
    <p className="print-option-index">{strings.optionIndex.replace('{n}', format.number(row.index + 1, { minimumIntegerDigits: 2 }))}</p>
    <PrismPart as="h4" {...title}>{row.title}</PrismPart>{row.subtitle && <PrismPart as="p" {...subtitle}>{row.subtitle}</PrismPart>}
    <div className="print-score" role="img" aria-label={row.ready ? `${row.matchText} ${row.matchLabel}` : strings.emptyLabel}>{row.ready ? format.number(Math.round(row.match * 100)) : '—'}<small>{strings.scoreSuffix}</small></div>
    <PrismPart as="div" {...bars}>{row.bars.map(bar => <div className="print-rating" key={bar.id}><span>{bar.label}</span><span>{format.number(Math.round(bar.score * 10))}{strings.ratingSuffix}</span></div>)}</PrismPart>
    {!!row.pros.length && <ul className="print-option-notes">{row.pros.map((pro, index) => <li key={index}>{pro}</li>)}</ul>}
    {!!row.cons.length && <ul className="print-option-notes">{row.cons.map((con, index) => <li key={index}>{con}</li>)}</ul>}
    {row.tag && <span className="print-chosen">{row.tag}</span>}
    {row.chosen && <span className="print-chosen" role="status">{row.chosenLabel}</span>}
    {!row.top && <PrismPart as="button" {...choose} className={`${choose.className ?? ''} print-option-select`} type="button" disabled={!row.ready} onClick={row.onChoose}>{strings.chooseTemplate.replace('{title}', row.title)}</PrismPart>}
  </article>;
}
const Options = forwardRef<HTMLDivElement, SlotProps>(function Options({ as, model, frame, overflow, children, ...props }, ref) {
  const strings = useStrings('pick');
  const items = Children.toArray(children) as ReactElement<{ row?: PickRow }>[];
  const leader = items.find(item => item.props.row?.top)?.props.row;
  const ordered = [...items].sort((a, b) => (a.props.row?.index ?? 0) - (b.props.row?.index ?? 0));
  return <div {...props} ref={ref} data-print-options=""><div className="print-option-columns">{ordered}</div>{leader && <div className="print-pick-footer"><p>{leader.reason}</p><button type="button" disabled={!leader.ready} onClick={leader.onChoose}>{leader.chosen ? leader.chosenLabel : strings.chooseTemplate.replace('{title}', leader.title)}</button></div>}</div>;
});

export const print = defineTheme({
  name: 'print',
  tokens: {
    bg: '#fff', surface: 'transparent', surfaceRaised: '#fff', text: '#151515', textMuted: '#555', textSubtle: '#666',
    border: '#aaa', borderStrong: '#151515', accent: '#d92e24', accentText: '#d92e24', onAccent: '#fff', focus: '#d92e24',
    fontBody: '"Inter Tight", "Arial Narrow", Arial, sans-serif', fontDisplay: '"Inter Tight", "Arial Narrow", Arial, sans-serif',
    fontMono: '"IBM Plex Mono", ui-monospace, monospace', fontNumeric: '"Inter Tight", Arial, sans-serif',
    radiusSm: '0px', radiusMd: '0px', radiusLg: '0px', radiusPill: '0px', elevation1: 'none', elevation2: 'none', elevation3: 'none',
    textBase: '14px', textSm: '12px', textXs: '10px', text3xl: '67px', weightBold: '900', motionFast: '100ms', motionBase: '150ms', motionSlow: '200ms',
  },
  dark: { bg: '#151515', surface: 'transparent', surfaceRaised: '#202020', text: '#f5f3ef', textMuted: '#c2beb7', textSubtle: '#aaa69f', border: '#6d6a65', borderStrong: '#f5f3ef', accent: '#ef4438', accentText: '#ef4438', onAccent: '#151515', focus: '#ef4438' },
  components: {
    frame: { slots: { header: Header, undo: Tool, ask: Tool, overflowTrigger: Tool }, strings: { undoLabel: 'Undo', askLabel: 'Ask', moreLabel: 'Tools' } },
    estimate: { slots: { root: EstimateRoot, body: EstimateBody, item: EstimateItem, label: EstimateLabel, checkbox: Switch, total: Total }, strings: { title: 'Week-one estimate', sectionIndex: '01 / EST', submit: 'Send estimate ↗', sentLabel: 'Estimate sent ✓', totalLabel: 'Total', footnote: '{notes} · {currency}' } },
    pick: { slots: { criteria: Criteria, item: Option, list: Options }, strings: { question: 'What matters to you?', sectionIndex: '02 / PICK', optionIndex: '{n} / APPROACH', scoreSuffix: '/100', ratingSuffix: '/10', chooseTemplate: 'Choose {title} ↗' } },
    runbook: { strings: { sectionIndex: '05 / GUIDE' } },
    summary: { strings: { sectionIndex: '06 / NOTES' } },
    troubleshoot: { strings: { sectionIndex: '07 / CHECK' } },
    mockup: { strings: { sectionIndex: '03 / DESIGN' } },
    view: { strings: { sectionIndex: '04 / SETUP' } },
  },
  css: `
    :scope { container-type:inline-size; --prism-prose-measure:760px; }
    :scope .prism-heading__root { font-family:var(--prism-font-display); font-weight:900; line-height:.95; letter-spacing:-.045em; }
    :scope h1.prism-heading__root { font-size:clamp(55px,8.8cqw,67px); }
    :scope .prism-paragraph__root { line-height:1.4; }
    :scope .prism-table__root { border-collapse:collapse; font-variant-numeric:tabular-nums; }
    :scope .prism-table__root :is(th,td) { background:none; border:0; border-bottom:1px solid var(--prism-border); padding:8px 0; text-align:left; }
    :scope .prism-table__root thead { border-top:4px solid var(--prism-text); }
    :scope .prism-table__root th { font:500 10px var(--prism-font-mono); text-transform:uppercase; }
    :scope .prism-codeblock__root { border:0; border-left:3px solid var(--prism-accent); border-radius:0; background:color-mix(in srgb,var(--prism-text) 4%,var(--prism-bg)); box-shadow:none; margin-block:22px; }
    :scope .prism-codeblock__header { min-height:28px; padding:8px 12px 0; background:transparent; }
    :scope .prism-codeblock__header { font:10px var(--prism-font-mono); text-transform:uppercase; }
    :scope .prism-codeblock__body { padding:6px 0 2px; background:transparent; }
    :scope .prism-codeblock__line { padding-inline:12px; }
    :scope .prism-codeblock__root [class*="prism-tok-"] { color:var(--prism-text); }
    :scope .prism-codeblock__root .prism-tok-comment { color:var(--prism-text-muted); }
    :scope .prism-codeblock__root :is(.prism-tok-keyword,.prism-tok-builtin) { color:var(--prism-accent-text); }
    :scope :is(.prism-estimate__root,.prism-pick__root,.prism-view__root) { border:0; border-radius:0; box-shadow:none; background:none; margin-block:28px; }
    :scope [data-print-header] { position:relative; display:flex; align-items:center; flex-wrap:wrap; gap:8px; border-top:5px solid var(--prism-text); border-bottom:1px solid var(--prism-text); padding:9px 0; margin:0; }
    :scope [data-print-header] > [data-part="title"] { font:800 20px/1.2 var(--prism-font-display); letter-spacing:-.3px; white-space:normal; overflow:visible; min-width:0; }
    :scope .print-index { flex:none; margin-left:auto; color:var(--prism-accent-text); font:500 11px var(--prism-font-mono); }
    :scope [data-print-header] > [data-part="toolbar"] { position:absolute; bottom:calc(100% + 5px); right:0; margin:0; }
    :scope [data-print-tool] { width:auto; height:auto; min-height:24px; padding:2px 4px; border:0; border-radius:0; box-shadow:none; background:none; color:var(--prism-text-muted); font:10px/1.2 var(--prism-font-mono); text-transform:uppercase; }
    :scope [data-print-tool]:hover { color:var(--prism-accent-text); }
    :scope [data-print-estimate-grid] { display:grid; grid-template-columns:minmax(0,2fr) minmax(0,1fr); gap:20px; padding:0; }
    :scope .print-estimate-items { min-width:0; }
    :scope .prism-estimate__list { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:0 24px; }
    :scope .prism-estimate__item { display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:center; gap:8px; min-height:0; padding:18px 0; border-bottom:1px solid var(--prism-border); animation:none; }
    :scope .prism-estimate__details { flex-basis:100%; min-width:0; }
    :scope .prism-estimate__label { font-size:14px; font-weight:700; }
    :scope .prism-estimate__label sup { font:8px var(--prism-font-mono); color:var(--prism-accent-text); margin-left:3px; }
    :scope .prism-estimate__description { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip-path:inset(50%); white-space:nowrap; }
    :scope .prism-estimate__price { margin-top:3px; font:9px/1.5 var(--prism-font-mono); }
    :scope .prism-estimate__amount { display:none; }
    :scope .prism-estimate__stepper { border:1px solid var(--prism-text); border-radius:0; min-width:0; }
    :scope .prism-estimate__input { width:3ch; border:0; padding:0; font:14px var(--prism-font-mono); background:none; }
    :scope :is(.prism-estimate__increase,.prism-estimate__decrease) { width:24px; min-height:26px; color:var(--prism-text); }
    :scope .prism-estimate__item[data-optional] { grid-column:1/-1; flex-wrap:nowrap; }
    :scope .prism-estimate__item[data-optional] .prism-estimate__details { flex:1; }
    :scope .prism-estimate__checkbox { appearance:none; flex:none; position:relative; width:38px; height:20px; border:1px solid var(--prism-text); border-radius:0; background:var(--prism-text); cursor:pointer; }
    :scope .prism-estimate__checkbox::after { content:""; position:absolute; width:14px; height:14px; left:2px; top:2px; background:var(--prism-bg); transition:translate var(--prism-motion-fast); }
    :scope .prism-estimate__checkbox:checked { background:var(--prism-accent); border-color:var(--prism-accent); }
    :scope .prism-estimate__checkbox:checked::after { translate:18px 0; }
    :scope .print-account { min-width:0; border-left:1px solid var(--prism-text); padding:14px 0 0 20px; }
    :scope .prism-estimate__summary { margin:0; max-width:none; }
    :scope .prism-estimate__summary-row { font:10px/1.5 var(--prism-font-mono); }
    :scope .prism-estimate__summary:not(:has(> .prism-estimate__summary-row + .prism-estimate__summary-row)) > .prism-estimate__summary-row { display:none; }
    :scope [data-print-total] { display:block; border:0; padding:0; margin:0 0 12px; }
    :scope .prism-estimate__total-label { display:block; font:9px/1.5 var(--prism-font-mono); text-transform:uppercase; letter-spacing:.3px; }
    :scope .prism-estimate__total-value { display:flex; align-items:flex-start; font:900 clamp(42px,12cqw,93px)/.95 var(--prism-font-display); letter-spacing:-.06em; font-variant-numeric:tabular-nums; overflow-wrap:anywhere; }
    :scope .prism-estimate__total-value sup { font-size:26px; line-height:1.2; letter-spacing:0; padding-top:2px; }
    :scope .prism-estimate__footer { margin:0; padding:0; border:0; display:block; }
    :scope .prism-estimate__actions { display:block; }
    :scope .prism-estimate__submit { display:block; width:100%; min-height:36px; padding:10px; border:0; border-radius:0; box-shadow:none; background:var(--prism-accent); color:var(--prism-on-accent); font:700 12px/1.4 var(--prism-font-body); }
    :scope .prism-estimate__submit svg { display:none; }
    :scope .print-footnote { font:9px/1.7 var(--prism-font-mono); color:var(--prism-text-muted); margin:10px 0 0; }
    :scope .prism-pick__body { display:grid; grid-template-columns:minmax(110px,1fr) minmax(0,3fr); gap:20px; padding:0; }
    :scope .prism-pick__criteria { display:block; margin:0; padding:18px 15px 0 0; border-right:1px solid var(--prism-text); }
    :scope .print-weight { display:block; margin-bottom:10px; font:10px/1.5 var(--prism-font-mono); }
    :scope .print-weight > span { display:flex; justify-content:space-between; gap:8px; }
    :scope .print-weight input { appearance:none; display:block; width:100%; height:24px; border:0; border-radius:0; background:linear-gradient(var(--prism-border),var(--prism-border)) center/100% 3px no-repeat; margin:2px 0 0; cursor:pointer; }
    :scope .print-weight input::-webkit-slider-thumb { appearance:none; width:9px; height:15px; background:var(--prism-accent); border:0; border-radius:0; }
    :scope .print-weight input::-moz-range-thumb { width:9px; height:15px; background:var(--prism-accent); border:0; border-radius:0; }
    :scope [data-print-options] { display:contents; }
    :scope .print-option-columns { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:0; }
    :scope [data-print-option] { display:block; min-height:0; border:0; border-right:1px solid var(--prism-border); border-radius:0; box-shadow:none; background:none; padding:16px 12px 0; animation:none; }
    :scope [data-print-option]:last-child { border-right:0; padding-right:0; }
    :scope [data-print-option][data-print-winner] { border-top:5px solid var(--prism-accent); padding-top:11px; box-shadow:none; }
    :scope .print-option-index { margin:0 0 12px; color:var(--prism-text-muted); font:9px/1.5 var(--prism-font-mono); }
    :scope [data-print-option] .prism-pick__title { margin:0; font:400 24px/1.15 var(--prism-font-display); letter-spacing:-.6px; }
    :scope [data-print-winner] .prism-pick__title, :scope [data-print-winner] .print-score { font-weight:900; }
    :scope .prism-pick__subtitle { margin:8px 0 12px; min-height:37px; font-size:12px; line-height:1.5; }
    :scope .print-score { white-space:nowrap; font:400 clamp(38px,7.9cqw,60px)/1.2 var(--prism-font-display); letter-spacing:-2.5px; }
    :scope .print-score small { font:9px var(--prism-font-mono); letter-spacing:0; margin-left:4px; }
    :scope .prism-pick__bars { display:block; margin:12px 0 0; }
    :scope .print-rating { display:flex; justify-content:space-between; gap:8px; border-top:1px solid var(--prism-border); padding:5px 0; font:9px/1.5 var(--prism-font-mono); }
    :scope .print-pick-footer { grid-column:1/-1; display:flex; justify-content:space-between; gap:20px; border-top:1px solid var(--prism-text); padding-top:11px; }
    :scope .print-pick-footer p { font-size:13px; line-height:1.4; margin:0; }
    :scope .print-pick-footer button, :scope .print-option-select { flex:none; padding:0; background:none; border:0; box-shadow:none; color:var(--prism-accent-text); font:800 13px/1.4 var(--prism-font-body); text-align:right; }
    :scope .print-option-select { opacity:0; margin-top:8px; font-size:11px; }
    :scope [data-print-option]:is(:hover,:focus-within) .print-option-select { opacity:1; }
    :scope .print-chosen { font:10px var(--prism-font-mono); color:var(--prism-accent-text); }
    :scope .print-option-notes { padding-left:14px; font-size:11px; }
    :scope .prism-mockup__viewport { border-top:4px solid var(--prism-text); border-radius:0; }
    :scope .prism-mockup__member .prism-mockup__header { flex-direction:row; align-items:center; }
    :scope .prism-mockup__member .prism-mockup__header > .prism-mockup__title { flex:1; text-align:left; }
    :scope .prism-mockup__header .prism-mockup__tools .prism-mockup__button { font:10px var(--prism-font-mono); text-transform:uppercase; }
    :scope .prism-view__body { padding:18px 0 0; }
    :scope .prism-view__root[data-variant="card"] { padding:0; border:0; border-radius:0; background:none; box-shadow:none; }
    :scope .prism-view__content:has(> .prism-view__field) { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:20px 24px; align-items:start; }
    :scope .prism-view__content > :not(.prism-view__field:has(.prism-view__control)) { grid-column:1/-1; }
    :scope .prism-view__footer { display:block; padding:0; margin-top:20px; }
    :scope .prism-view__actions { display:flex; gap:12px; min-width:0; }
    :scope .prism-view__actions > .prism-view__button[data-variant="primary"] { flex:1; min-width:0; min-height:38px; }
    :scope .prism-view__control { border:0; border-bottom:1px solid var(--prism-text); border-radius:0; background:none; padding:8px 0; box-shadow:none; }
    :scope .prism-view__controlWrap { border:0; border-bottom:1px solid var(--prism-text); border-radius:0; background:none; box-shadow:none; transition:border-color var(--prism-motion-fast) var(--prism-motion-ease); }
    :scope .prism-view__controlWrap .prism-view__control { border:0; }
    :scope .prism-view__controlWrap:focus-within { border-color:var(--prism-accent); box-shadow:none; }
    :scope .prism-view__label { font:10px/1.5 var(--prism-font-mono); text-transform:uppercase; }
    :scope .prism-view__segmented { padding:0; gap:0; background:none; border:1px solid var(--prism-text); border-radius:0; }
    :scope .prism-view__segment { border:0; border-right:1px solid var(--prism-text); border-radius:0; font:10px var(--prism-font-mono); padding:9px 12px; }
    :scope .prism-view__segment:last-child { border-right:0; }
    :scope .prism-view__segment[aria-checked="true"] { background:var(--prism-text); color:var(--prism-bg); box-shadow:none; }
    :scope .prism-view__switch { width:38px; height:20px; padding:3px; border-radius:0; background:var(--prism-text); }
    :scope .prism-view__switch[data-state="on"] { background:var(--prism-accent); }
    :scope .prism-view__thumb { width:14px; height:14px; border-radius:0; background:var(--prism-bg); }
    :scope .prism-view__switch[data-state="on"] .prism-view__thumb { transform:translateX(18px); }
    :scope .prism-view__button[data-variant="primary"] { border:0; border-radius:0; background:var(--prism-accent); box-shadow:none; color:var(--prism-on-accent); font-weight:700; }
    @container (max-width:600px) {
      :scope .prism-pick__body { display:block; }
      :scope .prism-pick__criteria { display:block; padding:18px 0 0; border:0; }
      :scope .print-option-columns { display:block; }
      :scope [data-print-option], :scope [data-print-option]:last-child { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:4px 12px; padding:18px 0; border-right:0; border-top:1px solid var(--prism-border); }
      :scope [data-print-option][data-print-winner] { border-top:5px solid var(--prism-accent); padding-top:14px; }
      :scope .print-option-index, :scope .prism-pick__bars, :scope .print-option-notes, :scope .print-chosen, :scope .print-option-select { grid-column:1/-1; }
      :scope [data-print-option] .prism-pick__title { grid-column:1; }
      :scope .prism-pick__subtitle { grid-column:1; min-height:0; margin:4px 0 0; }
      :scope .print-score { grid-column:2; grid-row:2/span 2; align-self:start; font-size:60px; line-height:1; }
      :scope .print-pick-footer { flex-direction:column; gap:10px; }
    }
    @container (max-width:420px) {
      :scope [data-print-estimate-grid] { grid-template-columns:minmax(0,1fr); gap:0; }
      :scope .prism-estimate__list { display:block; }
      :scope .prism-estimate__details { flex-basis:65%; }
      :scope .print-account { border:0; padding:20px 0 0; }
      :scope .prism-estimate__total-value { font-size:88px; }
    }
    @container (max-width:420px) {
      :scope .prism-view__content:has(> .prism-view__field) { grid-template-columns:minmax(0,1fr); }
    }
    @media (hover:none) { :scope .print-option-select { opacity:1; } }
    @media (prefers-reduced-motion:reduce) { :scope .prism-estimate__checkbox::after, :scope .prism-view__controlWrap { transition:none; } }
    :scope[data-animate="false"] .prism-estimate__checkbox::after { transition:none; }
    :scope[data-animate="false"] .prism-view__controlWrap, :scope [data-animate="false"] .prism-view__controlWrap { transition:none; }
    :scope :is(.prism-runbook__root,.prism-summary__root,.prism-troubleshoot__root,.prism-tabs__root,.prism-callout__root,.prism-card__root,.prism-grid__root) { min-width:0; max-width:100%; box-sizing:border-box; margin-block:28px; }
    :scope :is(.prism-runbook__body,.prism-summary__body,.prism-troubleshoot__body) { padding:16px 0 0; }
    :scope .prism-runbook__step[data-numbered="true"] { position:relative; margin:0; padding:16px 0 16px 44px; border:0; border-bottom:1px solid var(--prism-border); border-radius:0; background:none; box-shadow:none; }
    :scope .prism-runbook__step[data-numbered="true"] .prism-runbook__check { left:-44px; top:0; width:28px; height:28px; font:11px var(--prism-font-mono); }
    :scope .prism-runbook__step[data-numbered="true"]::before { display:none; }
    :scope .prism-runbook__stepHeader { flex-wrap:wrap; }
    :scope .prism-runbook__stepTitle { font-size:14px; }
    :scope .prism-runbook__stepBody .prism-paragraph__root { font-size:13px; }
    :scope :is(.prism-runbook__progress,.prism-summary__actionsTitle,.prism-summary__progress,.prism-troubleshoot__position,.prism-grid__meta) { font:10px/1.6 var(--prism-font-mono); text-transform:uppercase; color:var(--prism-text-muted); }
    :scope .prism-runbook__actions { min-width:0; }
    :scope .prism-runbook__stuck { font:10px var(--prism-font-mono); }
    :scope .prism-tabs__list { gap:0; min-height:40px; overflow:visible; flex-wrap:wrap; }
    :scope .prism-tabs__tab { min-width:0; white-space:normal; flex:1; padding:12px 14px; color:var(--prism-text-muted); font:11px/1.5 var(--prism-font-mono); }
    :scope .prism-tabs__indicator { display:none; }
    :scope .prism-tab__body { padding:18px 0; }
    :scope .prism-badge__root { font:10px/1.6 var(--prism-font-mono); text-transform:uppercase; color:var(--prism-text); }
    :scope .prism-badge__root[data-variant="solid"] { background:var(--prism-accent); color:var(--prism-on-accent); }
    :scope .prism-grid__body { gap:20px; }
    :scope .prism-grid__body > .prism-card__root { margin:0; }
    :scope .prism-grid__body > .prism-card__root::before { display:none; }
    :scope :is(.prism-card__title,.prism-callout__title) { margin:0; }
    :scope :is(.prism-card__body,.prism-callout__body) > .prism-paragraph__root { font-size:13px; line-height:1.65; }
    :scope .prism-troubleshoot__step { padding:0; border:0; background:none; box-shadow:none; }
    :scope .prism-troubleshoot__position { white-space:nowrap; flex:none; }
    :scope .prism-troubleshoot__stepTitle { display:flex; align-items:center; gap:12px; }
    :scope .prism-troubleshoot__text { font-size:13px; line-height:1.65; }
    :scope :is(.prism-summary__send,.prism-troubleshoot__primary) { background:var(--prism-accent); color:var(--prism-on-accent); border:0; font:11px/1.5 var(--prism-font-mono); text-transform:uppercase; padding:10px 16px; }
    :scope .prism-summary__points { padding:0; }
    :scope .prism-summary__point { padding-block:12px; border-bottom:1px solid var(--prism-border); }
    :scope .prism-summary__avatar { color:var(--prism-text); background:var(--prism-surface-raised); }
    @container (max-width:420px) { :scope .prism-grid__body { grid-template-columns:1fr; } :scope .prism-runbook__actions { flex-basis:100%; justify-content:flex-start; margin:0; } }

    :scope :is(.prism-runbook__root,.prism-summary__root,.prism-troubleshoot__root) { padding:0; border:0; background:none; box-shadow:none; border-radius:0; }
    :scope :is(.prism-card__root,.prism-callout__root) { padding:18px 0; border:0; border-top:4px solid var(--prism-text); border-bottom:1px solid var(--prism-text); background:none; border-radius:0; box-shadow:none; }
    :scope .prism-callout__root { border-top-width:1px; border-left:4px solid var(--prism-accent); padding:16px 20px; }
    :scope .prism-callout__icon { color:var(--prism-accent-text); }
    :scope :is(.prism-card__title,.prism-callout__title,.prism-tabs__title,.prism-grid__title) { font:800 19px/1.25 var(--prism-font-display); letter-spacing:-.025em; }
    :scope .prism-tabs__list { border-block:1px solid var(--prism-text); margin-top:12px; }
    :scope .prism-tabs__tab { border:0; border-right:1px solid var(--prism-text); border-radius:0; }
    :scope .prism-tabs__tab[aria-selected="true"] { background:var(--prism-text); color:var(--prism-bg); }
    :scope .prism-runbook__check { border:1px solid var(--prism-accent); border-radius:0; background:none; color:var(--prism-accent-text); }
    :scope .prism-runbook__check[data-state="done"] { background:var(--prism-accent); color:var(--prism-on-accent); border-color:var(--prism-accent); }
    :scope .prism-runbook__fill { background:var(--prism-accent); }
    :scope .prism-badge__root { border:1px solid var(--prism-text); border-radius:0; background:none; box-shadow:none; padding:3px 7px; letter-spacing:.06em; }
    :scope .prism-summary__point { border-bottom-color:var(--prism-text); }
    :scope .prism-summary__citation { color:var(--prism-accent-text); border-radius:0; background:none; }
    :scope .prism-summary__quote { background:none; border-left:3px solid var(--prism-accent); }
    :scope .prism-troubleshoot__position { background:none; color:var(--prism-accent-text); }
    :scope :is(.prism-summary__send,.prism-troubleshoot__primary) { border-radius:0; box-shadow:none; }

    :scope .prism-codeblock__root :is(.prism-codeblock__copy,.prism-codeblock__wrap,.prism-codeblock__collapse,.prism-codeblock__ask) { min-height:26px; padding:3px 5px; font:10px/1.4 var(--prism-font-mono); text-transform:uppercase; }
    :scope .prism-codeblock__actions { gap:6px; }
    :scope [data-prism="runbook"][data-part="header"] { display:grid; grid-template-columns:minmax(0,1fr) auto; align-items:center; }
    :scope [data-prism="runbook"][data-part="header"] > [data-part="title"] { grid-area:1/1; }
    :scope [data-prism="runbook"][data-part="header"] > [class$="-index"] { grid-area:1/2; }
    :scope [data-prism="runbook"][data-part="header"] > [data-part="toolbar"] { grid-area:2/1/3/-1; position:static; opacity:1; pointer-events:auto; justify-content:flex-start; width:100%; margin-top:8px; }
    :scope .prism-runbook__progress { flex:1; min-width:0; }
    :scope .prism-runbook__track { max-width:220px; }
    :scope .prism-runbook__stepTitle { padding-inline-end:0; }
    :scope .prism-runbook__actions { position:absolute; inset-block-start:auto; inset-block-end:calc(100% + 4px); right:0; flex-basis:auto; justify-content:flex-end; margin:0; }
    :scope :is(.prism-summary__header,.prism-troubleshoot__header) > [data-part="toolbar"] { position:absolute; bottom:calc(100% + 6px); right:0; }
    :scope .prism-summary__root { overflow:visible; }
    :scope .prism-summary__point { padding-block:0; }
    :scope .prism-summary__pointRow { min-height:0; padding-block:12px; }
    :scope .prism-summary__footer { padding:16px 0 0; margin-top:16px; border-top:1px solid var(--prism-border); background:none; gap:12px; flex-wrap:wrap; }
    :scope .prism-tabs__body { padding:0; }
    @container (max-width:420px) { :scope .prism-summary__footer { align-items:stretch; flex-direction:column; } :scope .prism-summary__send { width:100%; justify-content:center; } }

    :scope .prism-summary__points { counter-reset:print-point; }
    :scope .prism-summary__point { counter-increment:print-point; padding-left:28px; }
    :scope .prism-summary__point::before { content:counter(print-point,decimal-leading-zero); top:16px; left:0; width:auto; height:auto; background:none; color:var(--prism-accent-text); font:10px var(--prism-font-mono); }

    :scope .prism-runbook__check[data-state="current"] { box-shadow:none; background:var(--prism-surface); }

  `,
});
