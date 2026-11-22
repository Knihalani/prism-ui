import { Children, createElement, forwardRef, useContext, type InputHTMLAttributes, type ReactElement } from 'react';
import { ComponentContext, PrismPart, defineTheme, useFormat, usePart, usePrism, useStoreValue, useStrings } from '@prism-ui/react';
import type { EstimateModel } from '@prism-ui/components/estimate';
import type { FrameSlotProps } from '@prism-ui/components/frame';
import type { usePick } from '@prism-ui/components/pick';

type SlotProps = FrameSlotProps<unknown>;
type PickRow = ReturnType<typeof usePick>['rows'][number];
const supported = new Set(['estimate', 'pick', 'mockup', 'view', 'frame']);
const Chassis = forwardRef<HTMLElement, SlotProps>(function Chassis({ as = 'section', model, frame, overflow, children, ...props }, ref) {
  const component = (props as Record<string, unknown>)['data-prism'] as string;
  return createElement(as, { ...props, ref, 'data-instrument-chassis': supported.has(component) ? '' : undefined },
    supported.has(component) && [0, 1, 2, 3].map(index => <i key={index} className="instrument-screw" data-corner={index} aria-hidden="true" />), children);
});
const Header = forwardRef<HTMLElement, SlotProps>(function Header({ as = 'header', model, frame, overflow, children, ...props }, ref) {
  const component = (props as Record<string, unknown>)['data-prism'] as string, strings = useStrings(component);
  return createElement(as, { ...props, ref, 'data-instrument-header': supported.has(component) ? '' : undefined }, children,
    supported.has(component) && <span className="instrument-index">{strings.sectionIndex}</span>);
});
const Tool = forwardRef<HTMLElement, SlotProps>(function Tool({ as = 'button', model, frame, overflow, children, ...props }, ref) {
  const component = (props as Record<string, unknown>)['data-prism'] as string;
  return createElement(as, { ...props, ref, 'data-instrument-tool': supported.has(component) ? '' : undefined }, supported.has(component) ? props['aria-label'] : children);
});
const Item = forwardRef<HTMLDivElement, SlotProps & { row: EstimateModel['rows'][number] }>(function Item({ as, model, frame, overflow, row, children, ...props }, ref) {
  const pieces = Children.toArray(children);
  return <div {...props} ref={ref} data-optional={row.optional ? '' : undefined}>{row.optional ? <>{pieces[1]}{pieces[0]}{pieces[3]}</> : children}</div>;
});
const Toggle = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { as?: unknown }>(function Toggle({ as, ...props }, ref) {
  return <input {...props} ref={ref} role="switch" />;
});
const segments = {
  a: '8,2 36,2 41,7 35,12 9,12 3,7', b: '37,14 42,9 42,35 37,40 32,35 32,19',
  c: '37,42 42,47 42,73 37,78 32,73 32,47', d: '9,70 35,70 41,75 36,80 8,80 3,75',
  e: '2,47 7,42 12,47 12,73 7,78 2,73', f: '2,9 7,14 12,19 12,35 7,40 2,35',
  g: '9,36 35,36 40,41 35,46 9,46 4,41',
};
const digits: Record<string, string> = { '0': 'abcdef', '1': 'bc', '2': 'abdeg', '3': 'abcdg', '4': 'bcfg', '5': 'acdfg', '6': 'acdefg', '7': 'abc', '8': 'abcdefg', '9': 'abcdfg', '-': 'g' };
function weightValue(value: unknown, fallback = 1) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.min(3, Math.round(value))) : fallback;
}
function Segments({ value }: { value: string }) {
  const chars = [...value];
  return <svg viewBox={`0 0 ${Math.max(1, chars.length) * 48} 84`} aria-hidden="true" data-segmented="">{chars.map((char, index) => <g key={index} transform={`translate(${index * 48} 0)`}>{char === '.' ? <circle cx="8" cy="75" r="5" fill="currentColor" /> : Object.entries(segments).map(([key, points]) => <polygon key={key} points={points} fill="currentColor" opacity={(digits[char] ?? '').includes(key) ? .96 : .055} />)}</g>)}</svg>;
}
export const SegmentedTotal = forwardRef<HTMLDivElement, SlotProps & { estimate: EstimateModel }>(function SegmentedTotal({ as, model, frame, overflow, estimate, children, ...props }, ref) {
  const strings = useStrings('estimate');
  const text = String(Number(estimate.displayedTotal.toFixed(2)));
  const label = usePart('estimate', 'total-label'), value = usePart('estimate', 'total-value'), live = usePart('estimate', 'live');
  return <div {...props} ref={ref}>
    <div className="instrument-readout-label"><PrismPart as="span" {...label}>{estimate.totalLabel}</PrismPart><span>{strings.displayLabel}</span></div>
    <PrismPart as="span" {...value} aria-hidden="true"><small>{estimate.totalText.replace(/[\d.,\s-]/g, '')}</small><Segments value={text} /></PrismPart>
    <PrismPart as="span" {...live} aria-live="polite">{estimate.finalTotalText}</PrismPart>
  </div>;
});
const Faders = forwardRef<HTMLDivElement, SlotProps>(function Faders({ as, model, frame, overflow, children, ...props }, ref) {
  const context = useContext(ComponentContext)!, { store } = usePrism(), strings = useStrings('pick');
  const id = context.props.id ?? context.id, saved = useStoreValue<Record<string, number>>(`${id}.weights`);
  const initial = context.props.weights as Record<string, number> | undefined;
  const criteria = context.props.criteria as { id: string; label: string }[];
  return <div {...props} ref={ref} data-instrument-faders="">{criteria.filter(criterion => criterion.id).map(criterion => {
    const weight = weightValue(saved?.[criterion.id], weightValue(initial?.[criterion.id]));
    return <label className="instrument-fader" key={criterion.id}><span>{criterion.label}<output>{weight}</output></span><input type="range" min={0} max={3} step={1} value={weight} aria-label={`${criterion.label} ${strings.weightLabel}`} onInput={event => store.set(`${id}.weights`, { ...store.get(`${id}.weights`) as Record<string, number>, [criterion.id]: Number(event.currentTarget.value) })} /><i aria-hidden="true" /></label>;
  })}</div>;
});
const Module = forwardRef<HTMLElement, SlotProps & { row: PickRow }>(function Module({ as = 'article', model, frame, overflow, row, children, ...props }, ref) {
  const strings = useStrings('pick'), format = useFormat();
  const part = usePart('pick', 'item', !row.ready ? 'loading' : row.chosen ? 'chosen' : row.top ? 'top' : 'ready');
  const title = usePart('pick', 'title'), subtitle = usePart('pick', 'subtitle'), bars = usePart('pick', 'bars'), choose = usePart('pick', 'choose');
  return createElement(as, { ...part, ...props, ref, 'data-instrument-module': '', 'data-option': row.id, 'data-top': row.top || undefined, 'aria-busy': !row.ready }, <>
    <div className="instrument-module-index">{strings.optionIndex.replace('{n}', format.number(row.index + 1, { minimumIntegerDigits: 2 }))}<i data-instrument-led="" aria-hidden="true" /></div>
    <PrismPart as="h4" {...title}>{row.title}</PrismPart>{row.subtitle && <PrismPart as="p" {...subtitle}>{row.subtitle}</PrismPart>}
    <div className="instrument-score" data-instrument-score="" role="img" aria-label={row.ready ? `${row.matchText} ${row.matchLabel}` : strings.emptyLabel}><Segments value={row.ready ? String(Math.round(row.match * 100)) : '--'} /></div>
    <PrismPart as="div" {...bars}>{row.bars.map(bar => <div className="instrument-rating" key={bar.id}><span>{bar.label}</span><span>{format.number(Math.round(bar.score * 10))}{strings.ratingSuffix}</span></div>)}</PrismPart>
    {!!row.pros.length && <ul className="instrument-notes">{row.pros.map((pro, index) => <li key={index}>{pro}</li>)}</ul>}
    {!!row.cons.length && <ul className="instrument-notes">{row.cons.map((con, index) => <li key={index}>{con}</li>)}</ul>}
    {row.tag && <span className="instrument-tag">{row.tag}</span>}
    {row.chosen && <span className="instrument-tag" role="status">{row.chosenLabel}</span>}
    <div className="instrument-module-actions">{!row.top && <PrismPart as="button" {...choose} type="button" disabled={!row.ready} onClick={row.onChoose}>{strings.chooseTemplate.replace('{title}', row.title)}</PrismPart>}</div>
  </>);
});
const Modules = forwardRef<HTMLDivElement, SlotProps>(function Modules({ as, model, frame, overflow, children, ...props }, ref) {
  const strings = useStrings('pick');
  const items = Children.toArray(children) as ReactElement<{ row?: PickRow }>[];
  const leader = items.find(item => item.props.row?.top)?.props.row;
  const ordered = [...items].sort((a, b) => (a.props.row?.index ?? 0) - (b.props.row?.index ?? 0));
  return <div {...props} ref={ref} data-instrument-modules=""><div className="instrument-module-grid">{ordered}</div>{leader && <div className="instrument-pick-footer"><p>{leader.title} {strings.leads} {leader.reason}</p><button type="button" disabled={!leader.ready} onClick={leader.onChoose}>{leader.chosen ? leader.chosenLabel : strings.chooseTemplate.replace('{title}', leader.title)}</button></div>}</div>;
});
export const instrument = defineTheme({
  name: 'instrument',
  tokens: {
    bg: '#d4d3cc', surface: '#e1e0dd', surfaceRaised: '#ecebe8', text: '#262522', textMuted: '#575653', textSubtle: '#62615b',
    border: '#b9b8b5', borderStrong: '#a5a4a1', accent: '#e55b25', accentText: '#a83e16', onAccent: '#231b12', focus: '#a83e16',
    fontBody: '"IBM Plex Sans", system-ui, sans-serif', fontDisplay: '"IBM Plex Sans", system-ui, sans-serif',
    fontMono: '"IBM Plex Mono", ui-monospace, monospace', fontNumeric: '"IBM Plex Mono", ui-monospace, monospace',
    radiusSm: '3px', radiusMd: '5px', radiusLg: '7px', textXs: '10px', textSm: '12px', textBase: '14px',
    elevation1: '0 2px 0 #b0b0a6', elevation2: '0 3px 0 #a7a89c, 0 8px 14px #292a2512',
    motionFast: '100ms', motionBase: '160ms', motionSlow: '220ms',
  },
  dark: { bg: '#1d1e1b', surface: '#2a2b27', surfaceRaised: '#383a34', text: '#f0eee4', textMuted: '#c3c2b7', textSubtle: '#b4b4a8', border: '#4e5047', borderStrong: '#74766b', accent: '#e55b25', accentText: '#ff945f', onAccent: '#231b12', focus: '#ff945f', elevation1: '0 2px 0 #141510', elevation2: '0 3px 0 #141510, 0 8px 14px #0003' },
  components: {
    frame: { slots: { root: Chassis, header: Header, undo: Tool, ask: Tool, overflowTrigger: Tool }, strings: { undoLabel: 'Undo', askLabel: 'Ask', moreLabel: 'Tools' }, tokens: { display: '#1b1c18', 'display-ink': '#eeede3', lcd: '#bebdb8', 'lcd-ink': '#34352e', groove: '#a1a09d', 'groove-shadow': '#73726f', 'key-shadow': '#aeadaa', 'chassis-shadow': '#b8b7b4' } },
    estimate: {
      slots: { root: Chassis, item: Item, checkbox: Toggle, total: SegmentedTotal },
      strings: { title: 'Week-one estimate', sectionIndex: '01 / EST', submit: 'Send estimate', sentLabel: 'Sent', totalLabel: 'Total', displayLabel: 'LIVE' },
      tokens: { display: '#1b1c18', signal: '#e55b25', 'display-border': '#171812', 'key-shadow': 'var(--prism-frame-key-shadow)' },
    },
    pick: { slots: { criteria: Faders, item: Module, list: Modules }, strings: { question: 'What matters to you?', sectionIndex: '02 / PICK', optionIndex: '{n} / APPROACH', chooseTemplate: 'Choose {title} ↗', ratingSuffix: '/10', leads: 'leads.' } },
    mockup: { strings: { sectionIndex: '03 / DESIGN' } },
    view: { strings: { sectionIndex: '04 / SETUP' } },
  },
  css: `
    :scope .prism-estimate__root { position:relative; overflow:hidden; border:1px solid var(--prism-border-strong); border-radius:var(--prism-radius-lg); box-shadow:inset 0 1px 0 var(--prism-surface-raised), 0 3px 0 var(--prism-border), 0 10px 24px #292a2512; padding:9px; background:var(--prism-surface); }
    :scope .instrument-screw { position:absolute; z-index:1; width:5px; height:5px; border:1px solid var(--prism-border-strong); border-radius:50%; background:var(--prism-bg); box-shadow:inset 0 1px 1px var(--prism-border); }
    :scope .instrument-screw::after { content:""; position:absolute; left:0; right:0; top:1px; border-top:1px solid var(--prism-border-strong); transform:rotate(-35deg); }
    :scope .instrument-screw[data-corner="0"] { top:7px; left:7px; } :scope .instrument-screw[data-corner="1"] { top:7px; right:7px; }
    :scope .instrument-screw[data-corner="2"] { bottom:7px; left:7px; } :scope .instrument-screw[data-corner="3"] { bottom:7px; right:7px; }
    :scope .prism-estimate__header { padding:12px 15px 17px; border-bottom:1px solid var(--prism-border); }
    :scope .prism-estimate__title { font:500 11px/1.4 var(--prism-font-mono); letter-spacing:.1em; text-transform:uppercase; display:flex; align-items:center; gap:9px; }
    :scope .prism-estimate__title::before { content:""; width:5px; height:5px; border-radius:50%; background:var(--prism-estimate-signal); box-shadow:0 0 0 3px color-mix(in srgb,var(--prism-estimate-signal) 12%,transparent); }
    :scope .prism-estimate__toolbar { gap:4px; }
    :scope .prism-estimate__ask, :scope .prism-estimate__undo { opacity:1; background:var(--prism-bg); border:1px solid var(--prism-border); border-radius:3px; }
    :scope .prism-estimate__body { padding:0 15px 18px; }
    :scope .prism-estimate__item { display:grid; grid-template-columns:minmax(0,1fr) auto 7ch; align-items:center; min-height:108px; gap:12px; padding:18px 0; border-bottom:1px solid var(--prism-border); }
    :scope .prism-estimate__label { font-size:13px; font-weight:500; }
    :scope .prism-estimate__description { font-size:11px; max-width:18ch; margin-top:4px; }
    :scope .prism-estimate__price { font:10px/1.6 var(--prism-font-mono); margin-top:6px; text-transform:uppercase; }
    :scope .prism-estimate__stepper { border:0; border-radius:0; overflow:visible; gap:3px; align-items:center; }
    :scope .prism-estimate__input { border:0; width:3ch; background:transparent; font:500 18px/1 var(--prism-font-numeric); }
    :scope .prism-estimate__increase, :scope .prism-estimate__decrease { display:grid; place-items:center; width:27px; min-height:31px; border:1px solid var(--prism-border); background:var(--prism-surface-raised); border-radius:3px; box-shadow:0 2px 0 var(--prism-estimate-key-shadow); color:var(--prism-text); }
    :scope .prism-estimate__increase:active, :scope .prism-estimate__decrease:active, :scope .prism-estimate__submit:active { transform:translateY(2px); box-shadow:none; }
    :scope .prism-estimate__amount { min-width:0; font-size:12px; font-weight:500; }
    :scope .prism-estimate__item[data-optional] { min-height:89px; }
    :scope .prism-estimate__checkbox { appearance:none; position:relative; width:37px; height:21px; border:1px solid var(--prism-border-strong); border-radius:3px; background:var(--prism-border); cursor:pointer; box-shadow:inset 0 1px 2px var(--prism-border-strong); }
    :scope .prism-estimate__checkbox::after { content:""; position:absolute; top:2px; bottom:2px; left:2px; width:14px; border:1px solid var(--prism-border-strong); background:var(--prism-surface-raised); border-radius:2px; transition:transform var(--prism-motion-fast) var(--prism-motion-ease); }
    :scope .prism-estimate__checkbox:checked { background:var(--prism-estimate-signal); }
    :scope .prism-estimate__checkbox:checked::after { transform:translateX(16px); }
    :scope .prism-estimate__summary { margin:0; max-width:none; }
    :scope .prism-estimate__summary-row { padding:11px 0; font:10px/1.4 var(--prism-font-mono); text-transform:uppercase; letter-spacing:.06em; }
    :scope .prism-estimate__total { display:block; margin:5px 0 0; padding:13px 14px 18px; background:var(--prism-estimate-display); border:2px solid var(--prism-estimate-display-border); border-radius:3px; color:var(--prism-estimate-signal); box-shadow:inset 0 2px 5px #0005; }
    :scope .instrument-readout-label { display:flex; justify-content:space-between; gap:10px; font:9px/1.5 var(--prism-font-mono); letter-spacing:.08em; text-transform:uppercase; }
    :scope .instrument-readout-label > :last-child { opacity:.6; }
    :scope .prism-estimate__total-value { display:flex; gap:10px; align-items:flex-start; margin-top:13px; }
    :scope .prism-estimate__total-value small { font:19px/1 var(--prism-font-mono); padding-top:4px; }
    :scope .prism-estimate__total-value svg { display:block; width:auto; max-width:85%; height:62px; }
    :scope .prism-estimate__footer { padding:0 15px 17px; border:0; margin:0; }
    :scope .prism-estimate__actions { width:100%; }
    :scope .prism-estimate__submit { width:100%; min-height:40px; border:1px solid color-mix(in srgb,var(--prism-accent) 70%,var(--prism-text)); border-radius:3px; background:var(--prism-accent); box-shadow:0 3px 0 color-mix(in srgb,var(--prism-accent) 60%,var(--prism-text)); font:500 11px/1.4 var(--prism-font-mono); text-transform:uppercase; letter-spacing:.08em; }
    :scope .prism-estimate__submit[data-sent] { background:var(--prism-bg); color:var(--prism-text); border-color:var(--prism-border-strong); box-shadow:0 2px 0 var(--prism-border); opacity:1; }
    :scope { container-type:inline-size; box-sizing:border-box; padding:28px; background:var(--prism-bg); --prism-prose-measure:760px; }
    :scope > * { min-width:0; width:100%; box-sizing:border-box; }
    :scope[data-prism-theme="dark"], :scope [data-prism-theme="dark"] { --prism-frame-lcd:#1b1c18; --prism-frame-lcd-ink:#c3c2b7; --prism-frame-groove:#161713; --prism-frame-groove-shadow:#0e0f0c; --prism-frame-key-shadow:#141510; --prism-frame-chassis-shadow:#11120f; }
    :scope [data-instrument-chassis] { box-sizing:border-box; min-width:0; position:relative; padding:24px; border:1px solid var(--prism-border-strong); border-radius:var(--prism-radius-lg); background:var(--prism-surface); box-shadow:0 3px 0 var(--prism-frame-chassis-shadow), inset 0 1px 0 var(--prism-surface-raised); }
    :scope [data-instrument-header] { position:relative; display:flex; align-items:center; flex-wrap:wrap; gap:10px 16px; margin:0 0 22px; padding:0 0 16px; border-bottom:1px solid var(--prism-border); }
    :scope [data-instrument-header] > :is(h2,h3) { margin:0; flex:1; min-width:0; white-space:normal; overflow:visible; text-overflow:clip; font:500 11px/1.5 var(--prism-font-mono); letter-spacing:.06em; text-transform:uppercase; }
    :scope .instrument-index { margin-left:auto; font:9px/1.5 var(--prism-font-mono); color:var(--prism-text-muted); letter-spacing:.04em; white-space:nowrap; }
    :scope [data-instrument-tool] { opacity:1; border:1px solid var(--prism-border-strong); padding:5px 8px; min-width:0; min-height:27px; border-radius:var(--prism-radius-sm); background:var(--prism-surface-raised); color:var(--prism-text); box-shadow:0 2px 0 var(--prism-frame-key-shadow),inset 0 1px 0 var(--prism-surface); font:9px/1.3 var(--prism-font-mono); text-transform:uppercase; }
    :scope [data-instrument-tool] { width:auto; height:auto; }
    :scope :is(.prism-estimate__toolbar,.prism-pick__toolbar,.prism-view__toolbar,.prism-mockup__toolbar) { position:absolute; right:0; bottom:calc(100% + 6px); opacity:0; pointer-events:none; transition:opacity var(--prism-motion-fast) var(--prism-motion-ease); }
    :scope [data-instrument-chassis]:is(:hover,:focus-within) :is(.prism-estimate__toolbar,.prism-pick__toolbar,.prism-view__toolbar,.prism-mockup__toolbar) { opacity:1; pointer-events:auto; }
    :scope .prism-mockup__root > [data-instrument-header] > .prism-mockup__toolbar { position:static; opacity:1; pointer-events:auto; }
    :scope .prism-mockup__root[data-instrument-chassis] .prism-mockup__headerActions { opacity:1; pointer-events:auto; }
    :scope .prism-estimate__root { overflow:visible; }
    :scope .prism-estimate__body, :scope .prism-estimate__footer { padding:0; }
    :scope .prism-estimate__footer { margin-top:16px; }
    :scope .prism-estimate__item { min-height:96px; }
    :scope .instrument-readout-label { color:var(--prism-frame-display-ink); }
    :scope .instrument-readout-label > :last-child { opacity:1; }
    :scope .prism-estimate__submit { color:var(--prism-on-accent); }
    :scope .prism-pick__body { display:block; padding:0; }
    :scope .prism-pick__criteria { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:24px; padding:0; border:0; margin:26px 0 30px; }
    :scope .instrument-fader { min-width:0; display:block; }
    :scope .instrument-fader > span { display:flex; justify-content:space-between; gap:8px; font:10px/1.5 var(--prism-font-mono); text-transform:uppercase; }
    :scope .instrument-fader output { color:var(--prism-text-muted); }
    :scope .instrument-fader input { appearance:none; display:block; box-sizing:border-box; width:100%; height:7px; margin:21px 0 12px; border:1px solid var(--prism-border-strong); border-radius:1px; background:var(--prism-frame-groove); box-shadow:inset 0 2px 0 var(--prism-frame-groove-shadow),0 1px 0 var(--prism-surface-raised); cursor:pointer; }
    :scope .instrument-fader input::-webkit-slider-thumb { appearance:none; box-sizing:border-box; width:18px; height:27px; border:1px solid var(--prism-border-strong); border-radius:2px; background:linear-gradient(to bottom,var(--prism-surface-raised) 45%,var(--prism-text-muted) 45%,var(--prism-text-muted) 50%,var(--prism-surface-raised) 50%); box-shadow:0 2px 1px var(--prism-frame-key-shadow),inset 0 1px 0 var(--prism-surface); }
    :scope .instrument-fader input::-moz-range-thumb { box-sizing:border-box; width:18px; height:27px; border:1px solid var(--prism-border-strong); border-radius:2px; background:linear-gradient(to bottom,var(--prism-surface-raised) 45%,var(--prism-text-muted) 45%,var(--prism-text-muted) 50%,var(--prism-surface-raised) 50%); box-shadow:0 2px 1px var(--prism-frame-key-shadow); }
    :scope .instrument-fader > i { display:block; height:5px; margin-inline:2px; background:repeating-linear-gradient(90deg,var(--prism-border-strong) 0 1px,transparent 1px calc((100% - 1px)/10)); }
    :scope .prism-pick__list { display:block; padding:0; }
    :scope .instrument-module-grid { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:11px; align-items:stretch; }
    :scope [data-instrument-module] { min-width:0; min-height:0; display:flex; flex-direction:column; padding:15px 14px; background:var(--prism-bg); border:1px solid var(--prism-border); border-top:3px solid var(--prism-border); border-radius:var(--prism-radius-sm); box-shadow:inset 0 1px 0 var(--prism-surface-raised); }
    :scope [data-instrument-module][data-top] { border-color:var(--prism-accent); }
    :scope .instrument-module-index { display:flex; justify-content:space-between; align-items:center; gap:8px; margin-bottom:25px; color:var(--prism-text-muted); font:9px/1.5 var(--prism-font-mono); }
    :scope [data-instrument-led] { flex:none; width:5px; height:5px; border-radius:50%; background:var(--prism-text-muted); box-shadow:inset 0 1px 1px var(--prism-frame-key-shadow); }
    :scope [data-top] [data-instrument-led] { background:var(--prism-accent); box-shadow:0 0 0 2px var(--prism-surface),0 0 6px var(--prism-accent); }
    :scope [data-instrument-module] .prism-pick__title { margin:0; font:600 16px/1.25 var(--prism-font-body); }
    :scope [data-instrument-module] .prism-pick__subtitle { flex:1; margin:10px 0 18px; min-height:36px; font:11px/1.6 var(--prism-font-body); color:var(--prism-text-muted); }
    :scope .instrument-score { display:flex; align-items:center; min-width:0; padding:10px 8px; margin-block:16px 12px; min-height:60px; background:var(--prism-frame-lcd); border:1px solid var(--prism-border-strong); border-radius:2px; color:var(--prism-frame-lcd-ink); box-shadow:inset 0 2px 3px color-mix(in srgb,var(--prism-text) 15%,transparent); }
    :scope .instrument-score svg { display:block; max-width:100%; width:auto; height:36px; }
    :scope [data-top] .instrument-score { background:var(--prism-frame-display); color:var(--prism-accent); border-color:var(--prism-estimate-display-border); }
    :scope [data-instrument-module] .prism-pick__bars { display:grid; gap:0; margin:0; }
    :scope .instrument-rating { display:flex; justify-content:space-between; gap:6px; padding-block:5px; border-bottom:1px solid var(--prism-border); color:var(--prism-text-muted); font:9px/1.5 var(--prism-font-mono); }
    :scope .instrument-rating > :first-child { min-width:0; overflow-wrap:anywhere; }
    :scope .instrument-rating > :last-child { white-space:nowrap; }
    :scope .instrument-notes { padding-left:14px; font:11px/1.6 var(--prism-font-body); }
    :scope .instrument-tag { display:block; margin-top:8px; font:10px var(--prism-font-mono); }
    :scope .instrument-module-actions { min-height:26px; margin-top:10px; }
    :scope [data-instrument-module] .prism-pick__choose { margin:0; border:0; padding:4px 0; color:var(--prism-text); background:transparent; box-shadow:none; text-align:left; font:9px/1.5 var(--prism-font-mono); text-transform:uppercase; text-decoration:underline; }
    :scope .instrument-pick-footer { padding-top:21px; }
    :scope .instrument-pick-footer p { min-height:2.8em; margin:0 0 18px; color:var(--prism-text-muted); font:11px/1.7 var(--prism-font-mono); }
    :scope .instrument-pick-footer button { width:100%; min-height:42px; padding:10px 14px; border:1px solid var(--prism-border-strong); border-radius:3px; background:var(--prism-surface-raised); color:var(--prism-text); box-shadow:0 3px 0 var(--prism-frame-key-shadow),inset 0 1px 0 var(--prism-surface); font:11px/1.5 var(--prism-font-mono); text-transform:uppercase; letter-spacing:.05em; cursor:pointer; }
    :scope :is([data-instrument-tool],.instrument-pick-footer button,.prism-mockup__button,.prism-mockup__primary,.prism-view__button,.prism-view__segment) { transition:transform var(--prism-motion-fast) var(--prism-motion-ease),box-shadow var(--prism-motion-fast) var(--prism-motion-ease); }
    :scope :is([data-instrument-tool],.instrument-pick-footer button,.prism-mockup__button,.prism-mockup__primary,.prism-view__button,.prism-view__segment):active:not(:disabled) { transform:translateY(2px); box-shadow:inset 0 1px 2px var(--prism-frame-key-shadow); }
    :scope .prism-mockup__viewport { padding:0; border:0; outline:4px solid var(--prism-border); border-radius:3px; background:var(--prism-frame-display); box-shadow:inset 0 2px 4px var(--prism-frame-display); }
    :scope .prism-mockup__stage { border-radius:0; outline:0; }
    :scope .prism-mockup__button { border:1px solid var(--prism-border-strong); border-radius:3px; background:var(--prism-surface-raised); box-shadow:0 2px 0 var(--prism-frame-key-shadow),inset 0 1px 0 var(--prism-surface); color:var(--prism-text); font:10px var(--prism-font-mono); text-transform:uppercase; }
    :scope .prism-mockup__button[aria-pressed="true"] { color:var(--prism-text); background:var(--prism-bg); box-shadow:inset 0 2px 3px var(--prism-frame-key-shadow); }
    :scope .prism-mockup__marker[data-kind="pin"] { background:var(--prism-accent); color:var(--prism-on-accent); font-family:var(--prism-font-mono); border-radius:50%; }
    :scope .prism-mockup__popover { background:var(--prism-surface); border:1px solid var(--prism-border-strong); border-radius:3px; box-shadow:0 3px 0 var(--prism-frame-key-shadow),0 8px 18px color-mix(in srgb,var(--prism-text) 18%,transparent); }
    :scope :is(.prism-mockup__empty,.prism-mockup__overall,.prism-mockup__count) { font:10px/1.6 var(--prism-font-mono); text-transform:uppercase; color:var(--prism-text-muted); letter-spacing:.03em; }
    :scope :is(.prism-mockup__input,.prism-view__controlWrap,.prism-view__control) { border:1px solid var(--prism-border-strong); border-radius:3px; background:var(--prism-surface-raised); color:var(--prism-text); box-shadow:inset 0 2px 3px color-mix(in srgb,var(--prism-text) 12%,transparent); font:12px/1.7 var(--prism-font-mono); }
    :scope .prism-mockup__input { padding:12px; min-height:64px; text-transform:none; letter-spacing:normal; }
    :scope .prism-mockup__primary, :scope .prism-view__button[data-variant="primary"] { min-height:40px; padding:10px 14px; border:1px solid color-mix(in srgb,var(--prism-accent) 70%,var(--prism-text)); border-radius:3px; background:var(--prism-accent); color:var(--prism-on-accent); box-shadow:0 3px 0 color-mix(in srgb,var(--prism-accent) 60%,var(--prism-text)),inset 0 1px 0 color-mix(in srgb,var(--prism-accent) 70%,var(--prism-surface-raised)); font:500 11px/1.5 var(--prism-font-mono); text-transform:uppercase; }
    :scope .prism-mockup__primary:disabled { opacity:1; color:var(--prism-text-muted); background:var(--prism-bg); border-color:var(--prism-border-strong); box-shadow:0 2px 0 var(--prism-frame-key-shadow); }
    :scope .prism-view__body { padding:0; }
    :scope .prism-view__label { font:10px/1.6 var(--prism-font-mono); letter-spacing:.03em; text-transform:uppercase; }
    :scope .prism-view__controlWrap .prism-view__control { border:0; background:transparent; box-shadow:none; }
    :scope .prism-view__control { padding:10px 12px; }
    :scope .prism-view__segmented { gap:5px; padding:0 0 3px; border:0; background:transparent; box-shadow:none; }
    :scope .prism-view__segment { padding:9px 12px; border:1px solid var(--prism-border-strong); border-radius:3px; background:var(--prism-surface-raised); box-shadow:0 3px 0 var(--prism-frame-key-shadow),inset 0 1px 0 var(--prism-surface); color:var(--prism-text); font:10px/1.4 var(--prism-font-mono); }
    :scope .prism-view__segment[aria-checked="true"] { background:var(--prism-bg); color:var(--prism-text); box-shadow:inset 0 2px 3px var(--prism-frame-key-shadow); transform:translateY(2px); border-color:var(--prism-border-strong); }
    :scope .prism-view__switch { width:37px; height:21px; padding:3px; border:1px solid var(--prism-border-strong); border-radius:3px; background:var(--prism-border); box-shadow:inset 0 1px 2px var(--prism-border-strong); }
    :scope .prism-view__switch[data-state="on"] { background:var(--prism-accent); }
    :scope .prism-view__thumb { width:13px; height:13px; border-radius:2px; background:var(--prism-surface-raised); border:1px solid var(--prism-border-strong); }
    :scope .prism-view__switch[data-state="on"] .prism-view__thumb { transform:translateX(16px); }
    :scope .prism-view__footer { display:block; margin-top:22px; padding:0; border:0; }
    :scope .prism-view__actions { display:flex; min-width:0; }
    :scope .prism-view__actions > .prism-view__button[data-variant="primary"] { flex:1; min-width:0; }
    :scope .prism-heading__root { font-family:var(--prism-font-display); font-weight:600; line-height:1.12; letter-spacing:-.04em; }
    :scope h1.prism-heading__root { font-size:clamp(34px,5cqw,44px); }
    :scope :is(h2,h3).prism-heading__root { display:flex; align-items:center; gap:9px; font:500 12px/1.5 var(--prism-font-mono); text-transform:uppercase; letter-spacing:.06em; }
    :scope :is(h2,h3).prism-heading__root::before { content:""; flex:none; width:8px; height:10px; background:var(--prism-accent); box-shadow:inset 0 1px 0 var(--prism-surface-raised); }
    :scope .prism-paragraph__root { font:14px/1.6 var(--prism-font-body); }
    :scope .prism-table__root { border:1px solid var(--prism-border-strong); border-collapse:collapse; background:var(--prism-surface); border-radius:3px; font-variant-numeric:tabular-nums; }
    :scope .prism-table__root :is(th,td) { padding:10px 14px; border-bottom:1px solid var(--prism-border); background:transparent; }
    :scope .prism-table__root th { font:10px/1.5 var(--prism-font-mono); text-transform:uppercase; letter-spacing:.04em; background:var(--prism-surface-raised); }
    :scope .prism-codeblock__root { border:2px solid var(--prism-border-strong); border-radius:4px; background:var(--prism-frame-display); color:var(--prism-frame-display-ink); box-shadow:inset 0 2px 5px #0005,0 1px 0 var(--prism-surface-raised); }
    :scope .prism-codeblock__header { padding:9px 14px; background:transparent; color:var(--prism-frame-display-ink); border-bottom:1px solid var(--prism-border); font:10px var(--prism-font-mono); text-transform:uppercase; }
    :scope .prism-codeblock__label { color:var(--prism-frame-display-ink); }
    :scope .prism-codeblock__body { padding:8px 0; background:transparent; }
    :scope .prism-codeblock__line { padding-inline:14px; }
    :scope .prism-codeblock__root [class*="prism-tok-"] { color:var(--prism-frame-display-ink); }
    :scope .prism-codeblock__root :is(.prism-tok-keyword,.prism-tok-number,.prism-tok-boolean) { color:var(--prism-accent); }
    :scope .prism-codeblock__actions { gap:6px; }
    :scope .prism-codeblock__actions button { border:1px solid var(--prism-border-strong); padding:4px 7px; border-radius:2px; background:var(--prism-frame-display); color:var(--prism-frame-display-ink); font:9px var(--prism-font-mono); }
    :scope [data-instrument-chassis] :focus-visible { outline:2px solid var(--prism-focus); outline-offset:3px; }
    @container prism-estimate (max-width:480px) { :scope .prism-estimate__item { grid-template-columns:minmax(0,1fr) auto; gap:6px 12px; } :scope .prism-estimate__details { flex-basis:auto; grid-row:span 2; } :scope .prism-estimate__amount { grid-column:2; margin:0; } }
    @container (max-width:540px) {
      :scope .prism-pick__criteria, :scope .instrument-module-grid { grid-template-columns:1fr; }
      :scope .prism-pick__criteria { gap:24px; }
      :scope .instrument-module-index { margin-bottom:15px; }
      :scope .instrument-pick-footer p { min-height:0; }
    }
    @container (max-width:360px) {
      :scope [data-instrument-chassis] { padding:22px 16px; }
      :scope .prism-mockup__header { flex-direction:row; }
      :scope .prism-mockup__toolbar { position:static; order:2; flex-wrap:wrap; justify-content:flex-end; }
      :scope .prism-mockup__tools { flex:1 1 auto; min-width:0; flex-wrap:wrap; justify-content:flex-end; }
      :scope .prism-mockup__tools .prism-mockup__button { padding-inline:4px; font-size:9px; min-width:24px; }
      :scope .prism-mockup__feedbackFooter { flex-wrap:wrap; }
      :scope .prism-mockup__feedbackFooter > .prism-mockup__primary { flex-basis:100%; max-width:none; margin-left:0; }
      :scope .prism-view__segment { padding-inline:8px; font-size:9px; }
    }
    @media (hover:hover) and (pointer:fine) { :scope .prism-codeblock__actions { opacity:0; } :scope .prism-codeblock__root:is(:hover,:focus-within) .prism-codeblock__actions { opacity:1; } }
    @media (hover:none) { :scope :is(.prism-estimate__toolbar,.prism-pick__toolbar,.prism-view__toolbar,.prism-mockup__toolbar) { opacity:1; pointer-events:auto; } }
    @media (prefers-reduced-motion:reduce) { :scope [data-instrument-chassis] *, :scope [data-instrument-chassis] *::after, :scope [data-instrument-chassis] *::before { transition:none; } }
    :scope[data-animate="false"] [data-instrument-chassis] *, :scope[data-animate="false"] [data-instrument-chassis] *::after, :scope[data-animate="false"] [data-instrument-chassis] *::before, :scope [data-animate="false"] [data-instrument-chassis] *, :scope [data-animate="false"] [data-instrument-chassis] *::after, :scope [data-animate="false"] [data-instrument-chassis] *::before { transition:none; }
  `,
});
