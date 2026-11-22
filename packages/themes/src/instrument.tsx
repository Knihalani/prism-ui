import { Children, type HTMLAttributes, type InputHTMLAttributes } from 'react';
import { PrismPart, defineTheme, usePart, useStrings } from '@prism-ui/react';
import type { EstimateModel } from '@prism-ui/components/estimate';

function Chassis({ as, children, ...props }: HTMLAttributes<HTMLElement> & { as?: unknown }) {
  return <section {...props}>{[0, 1, 2, 3].map(index => <i key={index} className="instrument-screw" data-corner={index} aria-hidden="true" />)}{children}</section>;
}
function Item({ as, row, children, ...props }: HTMLAttributes<HTMLDivElement> & { as?: unknown; row: EstimateModel['rows'][number] }) {
  const pieces = Children.toArray(children);
  return <div {...props} data-optional={row.optional ? '' : undefined}>{row.optional ? <>{pieces[1]}{pieces[0]}{pieces[3]}</> : children}</div>;
}
function Toggle({ as, ...props }: InputHTMLAttributes<HTMLInputElement> & { as?: unknown }) {
  return <input {...props} role="switch" />;
}
const segments = {
  a: '8,2 36,2 41,7 35,12 9,12 3,7', b: '37,14 42,9 42,35 37,40 32,35 32,19',
  c: '37,42 42,47 42,73 37,78 32,73 32,47', d: '9,70 35,70 41,75 36,80 8,80 3,75',
  e: '2,47 7,42 12,47 12,73 7,78 2,73', f: '2,9 7,14 12,19 12,35 7,40 2,35',
  g: '9,36 35,36 40,41 35,46 9,46 4,41',
};
const digits: Record<string, string> = { '0': 'abcdef', '1': 'bc', '2': 'abdeg', '3': 'abcdg', '4': 'bcfg', '5': 'acdfg', '6': 'acdefg', '7': 'abc', '8': 'abcdefg', '9': 'abcdfg', '-': 'g' };
export function SegmentedTotal({ as, estimate, children, ...props }: HTMLAttributes<HTMLDivElement> & { as?: unknown; estimate: EstimateModel }) {
  const strings = useStrings('estimate');
  const text = String(Number(estimate.displayedTotal.toFixed(2))), chars = [...text];
  const label = usePart('estimate', 'total-label'), value = usePart('estimate', 'total-value'), live = usePart('estimate', 'live');
  return <div {...props}>
    <div className="instrument-readout-label"><PrismPart as="span" {...label}>{estimate.totalLabel}</PrismPart><span>{strings.displayLabel}</span></div>
    <PrismPart as="span" {...value} aria-hidden="true"><small>{estimate.totalText.replace(/[\d.,\s-]/g, '')}</small><svg viewBox={`0 0 ${chars.length * 48} 84`} aria-hidden="true" data-segmented="">{chars.map((char, index) => <g key={index} transform={`translate(${index * 48} 0)`}>{char === '.' ? <circle cx="8" cy="75" r="5" fill="currentColor" /> : Object.entries(segments).map(([key, points]) => <polygon key={key} points={points} fill="currentColor" opacity={(digits[char] ?? '').includes(key) ? .96 : .055} />)}</g>)}</svg></PrismPart>
    <PrismPart as="span" {...live} aria-live="polite">{estimate.finalTotalText}</PrismPart>
  </div>;
}
export const instrument = defineTheme({
  name: 'instrument',
  tokens: {
    bg: '#d4d3ce', surface: '#e2e1db', surfaceRaised: '#f1f0ea', text: '#292a25', textMuted: '#64655c', textSubtle: '#797a71',
    border: '#b6b6ad', borderStrong: '#919289', accent: '#e55b25', accentText: '#a83e16', onAccent: '#fff', focus: '#e55b25',
    fontBody: '"IBM Plex Sans", system-ui, sans-serif', fontDisplay: '"IBM Plex Sans", system-ui, sans-serif',
    fontMono: '"IBM Plex Mono", ui-monospace, monospace', fontNumeric: '"IBM Plex Mono", ui-monospace, monospace',
    radiusSm: '3px', radiusMd: '5px', radiusLg: '7px', textXs: '10px', textSm: '12px', textBase: '14px',
    elevation1: '0 2px 0 #b0b0a6', elevation2: '0 3px 0 #a7a89c, 0 8px 14px #292a2512',
  },
  components: {
    estimate: {
      slots: { root: Chassis, item: Item, checkbox: Toggle, total: SegmentedTotal },
      strings: { title: 'Estimate / 01', submit: 'Send estimate', sentLabel: 'Sent', totalLabel: 'Total', displayLabel: 'LIVE' },
      tokens: { display: '#252620', signal: '#e55b25', 'display-border': '#171812', 'key-shadow': '#a7a89c' },
    },
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
    @media (max-width:480px) { :scope .prism-estimate__item { grid-template-columns:minmax(0,1fr) auto 7ch; } :scope .prism-estimate__details { flex-basis:auto; } :scope .prism-estimate__amount { margin:0; } }
  `,
});
