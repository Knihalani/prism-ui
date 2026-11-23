import { Children, createElement, forwardRef, useContext, type InputHTMLAttributes, type ReactElement } from 'react';
import { ComponentContext, PrismPart, defineTheme, spring, useFormat, usePart, useSent, useSentAnnouncement, useStrings } from '@prism-ui/react';
import type { EstimateModel } from '@prism-ui/components/estimate';
import type { FrameSlotProps } from '@prism-ui/components/frame';
import type { usePick } from '@prism-ui/components/pick';
import { receiptMotion } from './motion';

type SlotProps = FrameSlotProps<unknown>;
type PickRow = ReturnType<typeof usePick>['rows'][number];
const supported = new Set(['estimate', 'pick', 'mockup', 'view', 'frame', 'runbook', 'troubleshoot', 'summary']);
const paper = spring({ response: .28, damping: 1 });

const Header = forwardRef<HTMLElement, SlotProps>(function Header({ as = 'header', model, frame, overflow, children, ...props }, ref) {
  const component = (props as Record<string, unknown>)['data-prism'] as string, strings = useStrings(component);
  return createElement(as, { ...props, ref, 'data-objects-header': supported.has(component) ? '' : undefined }, children,
    supported.has(component) && <span className="objects-index">{strings.sectionIndex}</span>);
});
const Tool = forwardRef<HTMLElement, SlotProps>(function Tool({ as = 'button', model, frame, overflow, children, ...props }, ref) {
  const component = (props as Record<string, unknown>)['data-prism'] as string;
  return createElement(as, { ...props, ref, 'data-objects-tool': supported.has(component) ? '' : undefined }, supported.has(component) ? props['aria-label'] : children);
});
const Receipt = forwardRef<HTMLElement, SlotProps>(function Receipt({ as = 'section', model, frame, overflow, children, ...props }, ref) {
  const { sent } = useSent(), strings = useStrings('estimate');
  return createElement(as, { ...props, ref, 'data-objects-printer': '' },
    <div className="objects-printer-slot" aria-hidden="true" />,
    <div className="objects-receipt" data-objects-receipt="" data-state={sent ? 'sent' : 'ready'}>
      <div className="objects-receipt-brand"><strong>{strings.shopName}</strong><span>{strings.shopLine}</span><span>{strings.shopMotto}</span></div>
      {children}
      <div className="objects-receipt-end" aria-hidden="true"><div className="objects-barcode" />{strings.thankYou}<br />{strings.keepReceipt}</div>
      <p className="objects-delivered" aria-hidden={!sent}>{strings.delivered}</p>
    </div>);
});
const ReceiptItem = forwardRef<HTMLDivElement, SlotProps & { row: EstimateModel['rows'][number] }>(function ReceiptItem({ as, model, frame, overflow, row, children, ...props }, ref) {
  const parts = Children.toArray(children);
  return <div {...props} ref={ref} data-optional={row.optional || undefined}>{row.optional ? <>{parts[1]}{parts[0]}</> : children}</div>;
});
const Switch = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { as?: unknown }>(function Switch({ as, ...props }, ref) {
  return <input {...props} ref={ref} role="switch" />;
});
const Total = forwardRef<HTMLDivElement, SlotProps & { estimate: EstimateModel }>(function Total({ as, model, frame, overflow, estimate, children, ...props }, ref) {
  const context = useContext(ComponentContext)!;
  const label = usePart('estimate', 'total-label'), value = usePart('estimate', 'total-value'), live = usePart('estimate', 'live');
  return <div {...props} ref={ref}><PrismPart as="span" {...label}>{estimate.totalLabel}</PrismPart><PrismPart as="span" {...value} aria-hidden="true">{estimate.totalText}</PrismPart><PrismPart as="span" {...live} aria-live={context.node.complete === false ? 'off' : 'polite'}>{estimate.finalTotalText}</PrismPart></div>;
});
const StickyNotes = forwardRef<HTMLDivElement, SlotProps & { pick: ReturnType<typeof usePick> }>(function StickyNotes({ as, model, frame, overflow, pick, children, ...props }, ref) {
  const strings = useStrings('pick');
  return <div {...props} ref={ref} data-objects-sticky-notes="">{pick.chips.map(criterion => {
    const weight = criterion.weight;
    return <label className="objects-sticky" key={criterion.id} data-objects-sticky=""><span>{criterion.label}<output>{weight}</output></span><input type="range" min={0} max={3} step={1} value={weight} aria-label={`${criterion.label} ${strings.weightLabel}`} onInput={event => pick.setWeight(criterion.id, Number(event.currentTarget.value))} /></label>;
  })}</div>;
});
const IndexCard = forwardRef<HTMLElement, SlotProps & { row: PickRow }>(function IndexCard({ as = 'article', model, frame, overflow, row, children, ...props }, ref) {
  const strings = useStrings('pick'), format = useFormat();
  useSentAnnouncement(row.sent, row.chosenLabel);
  const part = usePart('pick', 'item', !row.ready ? 'loading' : row.chosen ? 'chosen' : row.top ? 'top' : 'ready');
  const title = usePart('pick', 'title'), subtitle = usePart('pick', 'subtitle'), bars = usePart('pick', 'bars'), choose = usePart('pick', 'choose');
  return createElement(as, { ...part, ...props, ref, 'data-objects-card': '', 'data-option': row.id, 'data-top': row.top || undefined, 'aria-busy': !row.ready },
    <>
      <p className="objects-card-index">{strings.optionIndex.replace('{n}', format.number(row.index + 1, { minimumIntegerDigits: 2 }))}</p>
      {row.top && <span className="objects-stamp" data-objects-stamp="" aria-hidden="true">{strings.stamp}</span>}
      <PrismPart as="h4" {...title}>{row.title}</PrismPart>{row.subtitle && <PrismPart as="p" {...subtitle}>{row.subtitle}</PrismPart>}
      <div className="objects-score" role="img" aria-label={row.ready ? `${row.matchText} ${row.matchLabel}` : strings.emptyLabel}>{row.ready ? format.number(Math.round(row.match * 100)) : '—'}<small>{strings.scoreSuffix}</small></div>
      <PrismPart as="div" {...bars}>{row.bars.map(bar => <div className="objects-rating" key={bar.id}><span>{bar.label}</span><span>{format.number(Math.round(bar.score * 10))}{strings.ratingSuffix}</span></div>)}</PrismPart>
      {!!row.pros.length && <ul className="objects-card-notes">{row.pros.map((pro, index) => <li key={index}>{pro}</li>)}</ul>}
      {!!row.cons.length && <ul className="objects-card-notes">{row.cons.map((con, index) => <li key={index}>{con}</li>)}</ul>}
      {row.tag && <span className="objects-card-tag">{row.tag}</span>}
      {row.chosen && <span className="objects-card-tag">{row.chosenLabel}</span>}
      {!row.top && <PrismPart as="button" {...choose} className={`${choose.className ?? ''} objects-alternative`} type="button" disabled={!row.ready} onClick={row.onChoose}>{strings.chooseTemplate.replace('{title}', row.title)}</PrismPart>}
    </>);
});
const Cards = forwardRef<HTMLDivElement, SlotProps>(function Cards({ as, model, frame, overflow, children, ...props }, ref) {
  const strings = useStrings('pick');
  const items = Children.toArray(children) as ReactElement<{ row?: PickRow }>[];
  const leader = items.find(item => item.props.row?.top)?.props.row;
  return <div {...props} ref={ref} data-objects-cards="">{children}{leader && <div className="objects-pick-footer"><p>{leader.title} {strings.leads} {leader.reason}</p><button type="button" className="objects-paper-tag" disabled={!leader.ready} onClick={leader.onChoose}>{leader.chosen ? leader.chosenLabel : strings.chooseTemplate.replace('{title}', leader.title)}</button></div>}</div>;
});

export const objects = defineTheme({
  name: 'objects',
  tokens: {
    bg: '#baad97', surface: '#e6e2cd', surfaceRaised: '#f5f2df', text: '#373d34', textMuted: '#3d4338', textSubtle: '#3d4338',
    border: '#aaa792', borderStrong: '#747968', accent: '#315642', accentText: '#274a36', onAccent: '#fff', focus: '#315642',
    fontBody: '"DM Sans", system-ui, sans-serif', fontDisplay: '"Caveat", cursive', fontMono: '"IBM Plex Mono", ui-monospace, monospace', fontNumeric: '"IBM Plex Mono", ui-monospace, monospace',
    radiusSm: '2px', radiusMd: '2px', radiusLg: '2px', radiusPill: '999px', textBase: '14px', textSm: '12px', textXs: '10px',
    elevation1: '0 2px 3px #675c4240, 2px 8px 14px #6a5b3c30', elevation2: '0 4px 3px #665a3b44, 0 15px 20px #665a3b3b',
    motionInstant: '80ms', motionFast: '150ms', motionBase: '240ms', motionSlow: '420ms',
    motionEase: 'cubic-bezier(.22,.7,.25,1)', motionEaseInOut: 'cubic-bezier(.45,0,.25,1)', motionEaseExit: 'cubic-bezier(.4,0,1,1)',
    motionSpring: paper.easing, motionSpringDuration: `${paper.duration}ms`, motionSpringBouncy: paper.easing, motionSpringBouncyDuration: '300ms',
    motionStagger: '24ms', motionDistance: '6px', motionScale: '.985', motionBlur: '1px',
  },
  dark: {
    bg: '#24221e', surface: '#30372f', surfaceRaised: '#34332d', text: '#f1ecda', textMuted: '#c2bda9', textSubtle: '#c2bda9',
    border: '#716e60', borderStrong: '#a49e88', accent: '#86b69a', accentText: '#b3d7bc', onAccent: '#152c20', focus: '#b3d7bc',
    elevation1: '0 2px 3px #0005, 2px 8px 14px #0004', elevation2: '0 4px 3px #0005, 0 15px 20px #0006',
  },
  components: {
    frame: {
      slots: { header: Header, undo: Tool, ask: Tool, overflowTrigger: Tool }, strings: { undoLabel: 'Undo', askLabel: 'Ask', moreLabel: 'Tools' },
      tokens: { 'note-yellow': '#ddd69c', 'note-pink': '#d4b5a5', 'note-sage': '#bbc5b5', 'card-two': '#e4e6d8', 'card-three': '#e8debb', tape: '#d6c8a3', stamp: '#9c493b', slot: '#373d34' },
    },
    estimate: {
      slots: { root: Receipt, item: ReceiptItem, checkbox: Switch, total: Total }, tokens: { 'motion-slow': '620ms' },
      strings: { title: 'Week-one estimate', sectionIndex: '01 / EST', shopName: 'FIELDNOTES', shopLine: 'RESEARCH SUPPLY CO.', shopMotto: 'SMALL PILOTS, GOOD QUESTIONS.', submit: 'Print & send estimate ↗', sentLabel: 'Sent · estimate ✓', delivered: 'DELIVERED / READY FOR REVIEW', thankYou: '001 — THANK YOU FOR STARTING SMALL', keepReceipt: 'KEEP THIS FOR THE CONVERSATION.' },
    },
    pick: { slots: { criteria: StickyNotes, item: IndexCard, list: Cards }, strings: { question: 'What matters to you?', sectionIndex: '02 / PICK', optionIndex: '{n} / APPROACH', stamp: 'PICK', scoreSuffix: '/100', ratingSuffix: '/10', chooseTemplate: 'Choose {title} ↗', leads: 'leads.' } },
    runbook: { strings: { sectionIndex: '05 / GUIDE' } },
    summary: { strings: { sectionIndex: '06 / NOTES' } },
    troubleshoot: { strings: { sectionIndex: '07 / CHECK' } },
    mockup: { strings: { sectionIndex: '03 / DESIGN' } }, view: { strings: { sectionIndex: '04 / SETUP' } },
  },
  css: `
    ${receiptMotion}
    :scope [data-objects-printer] { --prism-motion-slow:var(--prism-estimate-motion-slow); }
    :scope .objects-receipt { translate:0 0; transition:translate var(--prism-motion-slow) var(--prism-motion-ease); }
    :scope .objects-receipt[data-state="ready"] { translate:0 calc(-2 * var(--prism-motion-distance)); }
    :scope .objects-delivered { opacity:1; transition:opacity var(--prism-motion-slow) var(--prism-motion-ease); }
    :scope .objects-delivered[aria-hidden="true"] { opacity:0; }
    :scope [data-objects-card][data-option] { transition:rotate var(--prism-motion-spring-duration) var(--prism-motion-spring), translate var(--prism-motion-spring-duration) var(--prism-motion-spring), opacity var(--prism-motion-slow) var(--prism-motion-ease), filter var(--prism-motion-slow) var(--prism-motion-ease); }
    :scope [data-objects-cards] > [data-objects-card][data-option] { opacity:1; filter:none; }
    :scope .objects-sticky { transition:translate var(--prism-motion-fast) var(--prism-motion-ease), rotate var(--prism-motion-spring-duration) var(--prism-motion-spring); }
    :scope .objects-sticky:is(:focus-within,:active) { translate:0 calc(-1 * var(--prism-motion-distance)); rotate:0deg; }
    @media (hover:hover) { :scope .objects-sticky:hover { translate:0 calc(-1 * var(--prism-motion-distance)); } }
    :scope .objects-stamp { scale:1; opacity:1; transition:scale var(--prism-motion-base) var(--prism-motion-spring), opacity var(--prism-motion-fast) var(--prism-motion-ease); }
    @starting-style { :scope .objects-stamp { scale:1.12; opacity:0; } }
    @media (prefers-reduced-motion:reduce) { :scope :is(.objects-receipt,.objects-sticky,.objects-stamp) { translate:none !important; scale:1 !important; transition-property:opacity !important; } }
    :scope[data-animate="false"] :is(.objects-receipt,.objects-sticky,.objects-stamp), :scope [data-animate="false"] :is(.objects-receipt,.objects-sticky,.objects-stamp) { translate:none !important; scale:1 !important; transition:none !important; }
    :scope { container-type:inline-size; padding:24px; display:grid; grid-template-columns:minmax(0,1fr); background-color:var(--prism-bg); color:var(--prism-text); --objects-grain:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='130' height='130'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.82' numOctaves='3' stitchTiles='stitch'/%3E%3CfeColorMatrix type='saturate' values='0'/%3E%3C/filter%3E%3Cpath d='M0 0h130v130H0z' filter='url(%23n)' opacity='.075'/%3E%3C/svg%3E"); background-image:var(--objects-grain); }
    :scope > *, :scope > [data-prism-flow] > * { min-width:0; width:100%; box-sizing:border-box; }
    :scope > [data-prism-flow] { display:grid; grid-template-columns:minmax(0,1fr); }
    :scope[data-prism-theme="dark"] { --prism-frame-note-yellow:#4b4630; --prism-frame-note-pink:#503e39; --prism-frame-note-sage:#344b40; --prism-frame-card-two:#323e34; --prism-frame-card-three:#46422f; --prism-frame-tape:#786f50; --prism-frame-stamp:#efb2a2; --prism-frame-slot:#171611; }
    @media (prefers-color-scheme:dark) { :scope[data-prism-theme="auto"] { --prism-frame-note-yellow:#4b4630; --prism-frame-note-pink:#503e39; --prism-frame-note-sage:#344b40; --prism-frame-card-two:#323e34; --prism-frame-card-three:#46422f; --prism-frame-tape:#786f50; --prism-frame-stamp:#efb2a2; --prism-frame-slot:#171611; } }
    :scope .prism-heading__root { font-family:var(--prism-font-display); font-weight:600; letter-spacing:-1px; line-height:1; }
    :scope h1.prism-heading__root { font-size:clamp(49px,8cqw,64px); margin-block:0 12px; }
    :scope h2.prism-heading__root { font-size:38px; }
    :scope .prism-paragraph__root { font-size:14px; line-height:1.6; }
    :scope .prism-table__root { border-collapse:collapse; background:var(--prism-surface); background-image:var(--objects-grain); box-shadow:var(--prism-elevation-1); margin-block:18px; font-variant-numeric:tabular-nums; }
    :scope .prism-table__root :is(th,td) { padding:9px 14px; border:0; border-bottom:1px solid var(--prism-border); background:none; text-align:left; }
    :scope .prism-table__root th { font:10px var(--prism-font-mono); text-transform:uppercase; }
    :scope .prism-codeblock__root { border:1px solid var(--prism-border); border-radius:2px; background:var(--prism-surface-raised); background-image:var(--objects-grain); box-shadow:var(--prism-elevation-1); margin-block:18px 24px; }
    :scope .prism-codeblock__header { font:10px var(--prism-font-mono); text-transform:uppercase; }
    :scope .prism-codeblock__body { background:none; }
    :scope .prism-codeblock__root [class*="prism-tok-"] { color:var(--prism-text); }
    :scope .prism-codeblock__root .prism-tok-comment { color:var(--prism-text-muted); }
    :scope .prism-codeblock__root :is(.prism-tok-keyword,.prism-tok-builtin) { color:var(--prism-accent-text); }
    :scope :is(.prism-pick__root,.prism-view__root) { margin-block:24px; padding:0; border:0; border-radius:0; background:none; box-shadow:none; }
    :scope [data-objects-header] { position:relative; display:flex; align-items:center; flex-wrap:wrap; gap:8px; padding:0 0 18px; margin:0; }
    :scope [data-objects-header] > [data-part="title"] { font:600 29px/1.1 var(--prism-font-display); white-space:normal; overflow:visible; letter-spacing:-.4px; min-width:0; }
    :scope .objects-index { flex:none; margin-left:auto; font:9px var(--prism-font-mono); color:var(--prism-text-muted); }
    :scope [data-objects-header] > [data-part="toolbar"] { position:absolute; right:0; bottom:100%; margin:0; }
    :scope [data-objects-tool] { width:auto; height:auto; min-height:26px; padding:1px 7px; border:0; border-radius:2px; background:var(--prism-surface-raised); box-shadow:var(--prism-elevation-1); color:var(--prism-text); font:500 17px/1.2 var(--prism-font-display); }
    :scope .prism-estimate__root { position:relative; width:100%; max-width:340px; padding:0; margin:26px auto 38px; border:0; border-radius:0; box-shadow:none; background:none; overflow:visible; justify-self:center; }
    :scope .objects-printer-slot { height:9px; margin:0 5px -4px; border-radius:5px; background:var(--prism-frame-slot); box-shadow:inset 0 2px 3px var(--prism-border-strong); }
    :scope .objects-receipt { position:relative; margin-inline:14px; padding:24px 22px 25px; background:var(--prism-surface-raised); background-image:var(--objects-grain); box-shadow:var(--prism-elevation-1); rotate:-1.3deg; font-family:var(--prism-font-mono); }
    :scope .objects-receipt::after { content:""; position:absolute; inset:auto 0 -9px; height:10px; background:var(--prism-surface-raised); clip-path:polygon(0 0,100% 0,100% 100%,98% 25%,96% 100%,94% 25%,92% 100%,90% 25%,88% 100%,86% 25%,84% 100%,82% 25%,80% 100%,78% 25%,76% 100%,74% 25%,72% 100%,70% 25%,68% 100%,66% 25%,64% 100%,62% 25%,60% 100%,58% 25%,56% 100%,54% 25%,52% 100%,50% 25%,48% 100%,46% 25%,44% 100%,42% 25%,40% 100%,38% 25%,36% 100%,34% 25%,32% 100%,30% 25%,28% 100%,26% 25%,24% 100%,22% 25%,20% 100%,18% 25%,16% 100%,14% 25%,12% 100%,10% 25%,8% 100%,6% 25%,4% 100%,2% 25%,0 100%); }
    :scope .objects-receipt-brand { text-align:center; margin-bottom:20px; font:10px/1.8 var(--prism-font-mono); letter-spacing:.6px; }
    :scope .objects-receipt-brand > * { display:block; }
    :scope .objects-receipt-brand strong { font-size:18px; font-weight:600; letter-spacing:-1px; }
    :scope .prism-estimate__header { padding:0 0 13px; border-bottom:1px dashed var(--prism-border); }
    :scope .prism-estimate__header > .prism-estimate__title { font:11px/1.5 var(--prism-font-mono); text-transform:uppercase; letter-spacing:.3px; }
    :scope .prism-estimate__body { padding:0; }
    :scope .prism-estimate__item { display:flex; align-items:center; gap:8px; padding:16px 0; border-bottom:1px dashed var(--prism-border); }
    :scope .prism-estimate__details { flex:1; min-width:0; }
    :scope .prism-estimate__label { font:500 11px/1.5 var(--prism-font-mono); }
    :scope .prism-estimate__description, :scope .prism-estimate__price { color:var(--prism-text-muted); font:9px/1.6 var(--prism-font-mono); }
    :scope .prism-estimate__amount { display:none; }
    :scope .prism-estimate__stepper { border:0; border-radius:0; box-shadow:none; gap:3px; }
    :scope :is(.prism-estimate__increase,.prism-estimate__decrease) { width:24px; min-height:26px; padding:0; border:1px solid var(--prism-border-strong); border-radius:2px; background:none; box-shadow:0 1px 0 var(--prism-border); color:var(--prism-text); }
    :scope .prism-estimate__input { width:3ch; padding:0; border:0; background:none; font:12px var(--prism-font-mono); }
    :scope .prism-estimate__checkbox { appearance:none; position:relative; flex:none; width:34px; height:21px; border:1px solid var(--prism-border-strong); border-radius:2px; background:var(--prism-border-strong); cursor:pointer; }
    :scope .prism-estimate__checkbox::after { content:""; position:absolute; top:3px; left:3px; width:13px; height:13px; background:var(--prism-surface-raised); transition:translate var(--prism-motion-fast); }
    :scope .prism-estimate__checkbox:checked { background:var(--prism-accent); border-color:var(--prism-accent); }
    :scope .prism-estimate__checkbox:checked::after { translate:13px 0; }
    :scope .prism-estimate__summary { max-width:none; margin:0; padding-top:18px; }
    :scope .prism-estimate__summary-row { font:10px/1.6 var(--prism-font-mono); }
    :scope .prism-estimate__summary:not(:has(> .prism-estimate__summary-row + .prism-estimate__summary-row)) > .prism-estimate__summary-row { display:none; }
    :scope .prism-estimate__total { display:block; margin:0; border:0; padding:0; }
    :scope .prism-estimate__total-label { display:block; font:10px/1.6 var(--prism-font-mono); letter-spacing:1px; text-transform:uppercase; margin-bottom:9px; }
    :scope .prism-estimate__total-value { display:block; font:500 clamp(28px,14cqw,50px)/1 var(--prism-font-mono); letter-spacing:-3px; font-variant-numeric:tabular-nums; overflow-wrap:anywhere; }
    :scope .prism-estimate__footer { display:block; margin-top:18px; padding:0; border:0; }
    :scope .prism-estimate__actions { display:block; }
    :scope :is(.prism-estimate__submit,.prism-view__button[data-variant="primary"]) { border:0; border-radius:2px; box-shadow:none; background:var(--prism-accent); color:var(--prism-on-accent); font:500 11px/1.5 var(--prism-font-mono); }
    :scope .prism-estimate__submit { display:block; width:100%; min-height:40px; padding:10px 8px; }
    :scope .prism-estimate__submit svg { display:none; }
    :scope .prism-estimate__submit[data-sent] { opacity:1; }
    :scope .objects-receipt-end { border-top:1px dashed var(--prism-border); margin-top:20px; padding-top:12px; text-align:center; font:8px/1.8 var(--prism-font-mono); letter-spacing:.2px; }
    :scope .objects-barcode { width:126px; height:21px; margin:8px auto 10px; background:repeating-linear-gradient(90deg,var(--prism-text) 0 2px,transparent 2px 4px,var(--prism-text) 4px 5px,transparent 5px 9px,var(--prism-text) 9px 12px,transparent 12px 15px); }
    :scope .objects-delivered { padding:5px; margin:16px 0 0; border:2px solid var(--prism-accent-text); color:var(--prism-accent-text); font:10px/1.6 var(--prism-font-mono); text-align:center; rotate:-3deg; }
    :scope .prism-pick__body { padding:0; }
    :scope [data-objects-sticky-notes] { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,120px),1fr)); gap:16px; margin:8px 9px 34px; padding:0; }
    :scope .objects-sticky { display:block; min-width:0; padding:10px 12px 12px; color:var(--prism-text); background:var(--prism-frame-note-yellow); background-image:var(--objects-grain); box-shadow:var(--prism-elevation-1); rotate:-2deg; font:500 22px/1.2 var(--prism-font-display); }
    :scope .objects-sticky:nth-child(3n + 2) { background-color:var(--prism-frame-note-pink); rotate:1.5deg; }
    :scope .objects-sticky:nth-child(3n) { background-color:var(--prism-frame-note-sage); rotate:-1deg; }
    :scope .objects-sticky > span { display:flex; justify-content:space-between; gap:8px; }
    :scope .objects-sticky input { appearance:none; display:block; width:100%; height:24px; margin:5px 0 0; border:0; border-radius:0; background:linear-gradient(var(--prism-border-strong),var(--prism-border-strong)) center/100% 2px no-repeat; cursor:pointer; }
    :scope .objects-sticky input::-webkit-slider-thumb { appearance:none; width:12px; height:12px; border-radius:50%; background:var(--prism-text); border:1px solid var(--prism-text); }
    :scope .objects-sticky input::-moz-range-thumb { width:12px; height:12px; border-radius:50%; background:var(--prism-text); border:1px solid var(--prism-text); }
    :scope [data-objects-cards] { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); grid-auto-rows:auto; gap:0; padding:14px; }
    :scope [data-objects-card] { position:relative; min-height:0; min-width:0; display:block; padding:20px 16px 17px; margin-right:-5px; border:1px solid var(--prism-border); border-radius:0; background:var(--prism-surface); background-image:var(--objects-grain),repeating-linear-gradient(transparent 0 25px,color-mix(in srgb,var(--prism-border-strong) 35%,transparent) 25px 26px); background-position:0 0,0 46px; box-shadow:var(--prism-elevation-1); rotate:-2deg; }
    :scope [data-objects-card]:nth-child(3n + 2) { background-color:var(--prism-frame-card-two); rotate:1.5deg; translate:0 10px; }
    :scope [data-objects-card]:nth-child(3n) { background-color:var(--prism-frame-card-three); rotate:2deg; margin-right:0; }
    :scope [data-objects-card][data-top] { z-index:1; translate:0 -6px; box-shadow:var(--prism-elevation-2); }
    :scope [data-objects-card]:focus-within { z-index:2; }
    :scope .objects-card-index { padding:0 35px 9px 0; margin:0 0 16px; border-bottom:1px solid var(--prism-border); font:9px/1.5 var(--prism-font-mono); }
    :scope [data-objects-card] .prism-pick__title { margin:0; font:600 28px/1 var(--prism-font-display); letter-spacing:-.4px; }
    :scope .prism-pick__subtitle { min-height:44px; margin:11px 0 18px; color:var(--prism-text-muted); font-size:12px; line-height:1.6; }
    :scope .objects-score { font:600 52px/1 var(--prism-font-display); white-space:nowrap; letter-spacing:-1.4px; }
    :scope .objects-score small { margin-left:3px; font:9px var(--prism-font-mono); letter-spacing:0; }
    :scope .objects-stamp { position:absolute; top:14px; right:10px; padding:1px 3px; border:2px solid var(--prism-frame-stamp); color:var(--prism-frame-stamp); box-shadow:inset 0 0 0 1px var(--prism-frame-stamp); font:700 12px/1.5 var(--prism-font-mono); letter-spacing:1px; rotate:12deg; mask-image:repeating-linear-gradient(173deg,var(--prism-text) 0 8px,color-mix(in srgb,var(--prism-text) 55%,transparent) 8px 9px); }
    :scope .prism-pick__bars { display:block; margin-top:14px; }
    :scope .objects-rating { display:flex; justify-content:space-between; gap:8px; border-bottom:1px solid var(--prism-border); padding:4px 0; font:9px/1.5 var(--prism-font-mono); }
    :scope .objects-card-notes { padding-left:14px; font-size:11px; }
    :scope .objects-card-tag { display:block; font:10px var(--prism-font-mono); }
    :scope .objects-pick-footer { grid-column:1/-1; margin-top:32px; }
    :scope .objects-pick-footer p { margin:0 0 14px; font:500 23px/1.2 var(--prism-font-display); }
    :scope .objects-paper-tag, :scope .objects-alternative { width:auto; padding:10px 16px; border:0; border-radius:0; background:var(--prism-surface-raised); color:var(--prism-text); box-shadow:var(--prism-elevation-1); font:11px/1.5 var(--prism-font-mono); }
    :scope .objects-alternative { opacity:0; padding:4px 0; margin-top:12px; box-shadow:none; background:none; font-size:10px; }
    :scope [data-objects-card]:is(:hover,:focus-within) .objects-alternative { opacity:1; }
    :scope .prism-mockup__root { position:relative; padding:16px; margin-block:30px; border:0; border-radius:1px; background:var(--prism-surface-raised); background-image:var(--objects-grain); box-shadow:var(--prism-elevation-2); }
    :scope .prism-mockup__root::before, :scope .prism-mockup__root::after { content:""; position:absolute; top:-10px; left:20px; width:64px; height:24px; background:var(--prism-frame-tape); opacity:.8; rotate:-8deg; pointer-events:none; z-index:2; }
    :scope .prism-mockup__root::after { left:auto; right:20px; rotate:7deg; }
    :scope .prism-mockup__header { flex-direction:row; }
    :scope .prism-mockup__viewport { border-radius:0; background-color:var(--prism-bg); background-image:var(--objects-grain); }
    :scope .prism-mockup__stage { border-radius:1px; outline:0; box-shadow:0 8px 18px color-mix(in srgb,var(--prism-frame-slot) 65%,transparent); }
    :scope .prism-view__body { padding:0; }
    :scope .prism-view__root[data-variant="card"] { padding:0; background:none; border:0; box-shadow:none; }
    :scope .prism-view__content { padding:20px; background:var(--prism-surface-raised); background-image:var(--objects-grain); box-shadow:var(--prism-elevation-1); }
    :scope .prism-view__label { font:19px/1.4 var(--prism-font-display); }
    :scope .prism-view__controlWrap { border:0; border-bottom:1px solid var(--prism-border-strong); border-radius:0; box-shadow:none; background:none; }
    :scope .prism-view__control { font:12px/1.5 var(--prism-font-mono); background:none; padding:6px 0; }
    :scope .prism-view__segmented { gap:4px; padding:0; border:0; border-radius:0; background:none; }
    :scope .prism-view__segment { border:1px solid var(--prism-border-strong); border-bottom:0; border-radius:2px 2px 0 0; box-shadow:none; background:var(--prism-surface); font:11px var(--prism-font-mono); padding:10px; }
    :scope .prism-view__segment[aria-checked="true"] { color:var(--prism-on-accent); background:var(--prism-accent); box-shadow:none; }
    :scope .prism-view__switch { width:34px; height:21px; padding:4px; border-radius:2px; background:var(--prism-border-strong); }
    :scope .prism-view__switch[data-state="on"] { background:var(--prism-accent); }
    :scope .prism-view__thumb { width:13px; height:13px; border-radius:1px; background:var(--prism-surface-raised); }
    :scope .prism-view__switch[data-state="on"] .prism-view__thumb { transform:translateX(13px); }
    :scope .prism-view__footer { display:block; border:0; padding:0; margin-top:16px; }
    :scope .prism-view__actions { display:flex; width:100%; }
    :scope .prism-view__actions > .prism-view__button[data-variant="primary"] { flex:1; min-height:40px; }
    :scope .prism-view__actions > * { flex:1; }
    :scope .prism-view__actions .prism-view__button[data-variant="primary"] { width:100%; min-height:40px; }
    @container (max-width:500px) {
      :scope [data-objects-sticky-notes] { grid-template-columns:minmax(0,1fr); gap:12px; margin-inline:0; }
      :scope .objects-sticky { rotate:0deg; }
      :scope .objects-sticky:nth-child(n) { rotate:0deg; }
      :scope [data-objects-cards] { display:flex; flex-direction:column; gap:18px; padding:0; }
      :scope [data-objects-card]:nth-child(n) { margin:0; rotate:0deg; translate:none; padding:18px; display:grid; grid-template-columns:minmax(0,1fr) 74px; gap:6px 12px; }
      :scope .objects-card-index, :scope .prism-pick__bars, :scope .objects-card-notes, :scope .objects-card-tag, :scope .objects-alternative { grid-column:1/-1; }
      :scope [data-objects-card] .prism-pick__title { grid-column:1; }
      :scope .prism-pick__subtitle { grid-column:1; min-height:0; margin:0; }
      :scope .objects-score { grid-column:2; grid-row:2/span 2; align-self:start; }
      :scope .objects-pick-footer { margin-top:8px; }
      :scope .prism-mockup__root { padding:10px; }
      :scope .prism-view__content { padding:14px; }
    }
    @container (max-width:280px) { :scope .objects-receipt { margin-inline:8px; padding-inline:18px; rotate:0deg; } }
    @media (hover:none) { :scope .objects-alternative { opacity:1; } }
    @container (max-width:360px) { :scope .prism-mockup__header > .prism-mockup__toolbar { flex-wrap:wrap; justify-content:flex-end; } }
    @media (hover:hover) {
      :scope .prism-estimate__root:not(:hover,:focus-within) .prism-estimate__header .prism-icon-btn { opacity:0; }
    }
    @media (prefers-reduced-motion:reduce) {
      :scope [data-objects-card]:nth-child(n), :scope .objects-sticky:nth-child(n) { rotate:0deg; translate:none; }
      :scope .prism-estimate__checkbox::after { transition:none; }
    }
    :scope[data-animate="false"] .prism-estimate__checkbox::after, :scope [data-animate="false"] .prism-estimate__checkbox::after { transition:none; }
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

    :scope :is(.prism-runbook__root,.prism-summary__root,.prism-troubleshoot__root,.prism-card__root) { padding:20px; border:1px solid var(--prism-border); border-radius:1px; background:var(--prism-surface); background-image:var(--objects-grain); box-shadow:var(--prism-elevation-1); }
    :scope .prism-runbook__stepBody { background:repeating-linear-gradient(transparent 0 25px,var(--prism-border) 25px 26px); line-height:26px; padding-bottom:6px; }
    :scope .prism-runbook__check { border:1px solid var(--prism-border-strong); border-radius:2px; background:var(--prism-surface-raised); color:var(--prism-text); }
    :scope .prism-runbook__check[data-state="done"] { background:var(--prism-accent); border-color:var(--prism-accent); color:var(--prism-on-accent); }
    :scope :is(.prism-runbook__stepTitle,.prism-card__title,.prism-callout__title,.prism-grid__title,.prism-tabs__title) { font:600 28px/1.15 var(--prism-font-display); }
    :scope .prism-callout__root { padding:22px; border:0; border-radius:0; background:var(--prism-frame-note-yellow); background-image:var(--objects-grain); box-shadow:var(--prism-elevation-1); rotate:-.6deg; }
    :scope .prism-callout__icon { color:var(--prism-text); }
    :scope .prism-tabs__list { gap:6px; padding-top:14px; border-bottom:1px solid var(--prism-border-strong); }
    :scope .prism-tabs__tab { border:1px solid var(--prism-border); border-bottom:0; border-radius:4px 4px 0 0; background:var(--prism-surface); box-shadow:inset 0 -3px 3px color-mix(in srgb,var(--prism-text) 5%,transparent); }
    :scope .prism-tabs__tab[aria-selected="true"] { background:var(--prism-surface-raised); color:var(--prism-text); box-shadow:none; border-top:3px solid var(--prism-accent); padding-top:10px; }
    :scope .prism-tab__body { padding:20px; background:var(--prism-surface-raised); background-image:var(--objects-grain); border-bottom:1px solid var(--prism-border); }
    :scope .prism-badge__root { background:var(--prism-surface-raised); border:1px dashed var(--prism-border-strong); border-radius:1px; padding:3px 8px; box-shadow:none; }
    :scope .prism-summary__action { background:repeating-linear-gradient(transparent 0 27px,var(--prism-border) 27px 28px); }
    :scope .prism-summary__quote { background:var(--prism-frame-note-sage); border-left:2px solid var(--prism-accent); }
    :scope .prism-troubleshoot__position { color:var(--prism-text); background:none; font:600 28px var(--prism-font-display); }
    :scope :is(.prism-summary__send,.prism-troubleshoot__primary) { border-radius:2px; box-shadow:var(--prism-elevation-1); }
    @container (max-width:420px) { :scope .prism-callout__root { rotate:0deg; } :scope :is(.prism-runbook__root,.prism-summary__root,.prism-troubleshoot__root,.prism-card__root) { padding:16px; } }
    @media (prefers-reduced-motion:reduce) { :scope .prism-callout__root { rotate:0deg; } }

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

    :scope .prism-runbook__stepBody .prism-paragraph__root { line-height:26px; }
    :scope .prism-summary__action { background:none; border-bottom:1px solid var(--prism-border); }

    :scope .prism-runbook__check[data-state="current"] { box-shadow:none; background:var(--prism-surface); }

  `,
});
