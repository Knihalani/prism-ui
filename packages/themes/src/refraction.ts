import { defineTheme } from '@prism-ui/react';

const highlight = 'linear-gradient(90deg, #7dd3fc 0%, #818cf8 30%, #c084fc 55%, #f472b6 80%, #fdba74 100%)';
export const refraction = defineTheme({
  name: 'refraction',
  tokens: {
    bg: '#fbfaf7', surface: '#f3f1ec', surfaceRaised: '#fbfaf7', text: '#1a1916', textMuted: '#5e5b54', textSubtle: '#706d65',
    border: 'color-mix(in srgb, #1a1916 9%, transparent)', borderStrong: 'color-mix(in srgb, #1a1916 20%, transparent)',
    accent: '#5141f2', accentText: '#5141f2', onAccent: '#fff', positive: '#0b7551', warning: '#9b5e08', danger: '#b83a30', info: '#387394', focus: '#5747ff',
    fontBody: 'Inter, ui-sans-serif, system-ui, sans-serif', fontDisplay: '"Instrument Serif", Georgia, serif',
    fontMono: '"JetBrains Mono", ui-monospace, monospace', fontNumeric: 'Inter, ui-sans-serif, system-ui, sans-serif',
    textXs: '11px', textSm: '13px', textBase: '15.5px', textLg: '18px', textXl: '22px', text2xl: '32px', text3xl: '44px',
    radiusSm: '6px', radiusMd: '10px', radiusLg: '14px', radiusPill: '999px',
    elevation1: '0 1px 2px #25221a0a', elevation2: '0 4px 12px #25221a0f', elevation3: '0 12px 32px #25221a15',
    motionFast: '200ms', motionBase: '300ms', motionSlow: '420ms',
  },
  dark: {
    bg: '#0f0f11', surface: '#151517', surfaceRaised: '#1d1d20', text: '#edebe6', textMuted: '#a6a39c', textSubtle: '#6e6b65',
    border: 'color-mix(in srgb, #edebe6 9%, transparent)', borderStrong: 'color-mix(in srgb, #edebe6 20%, transparent)',
    accent: '#8b80ff', accentText: '#8b80ff', onAccent: '#0f0f11', positive: '#0f9d6b', warning: '#c2780a', danger: '#df554a', info: '#7dd3fc', focus: '#8b80ff',
    elevation1: '0 1px 3px #00000026', elevation2: '0 4px 12px #00000033', elevation3: '0 12px 32px #00000040',
  },
  components: {
    ...Object.fromEntries(['prose', 'stream', 'shared', 'pick', 'tabs', 'codeblock', 'datatable', 'callout', 'runbook'].map(name => [name, { tokens: { highlight, 'highlight-shadow': '0 0 0 transparent' } }])),
    prose: { tokens: { highlight, 'font-features': '"cv11", "ss01", "ss03"', 'letter-spacing': '-.006em' } },
    codeblock: { tokens: { highlight, 'token-string': 'light-dark(#9e654b, #db9c7e)', 'token-number': 'light-dark(#337f73, #72baaa)' } },
    estimate: { tokens: { 'surface': 'var(--prism-bg)', 'radius-lg': '14px' } },
  },
  css: `
    :scope .prism-estimate__root { background:var(--prism-bg); box-shadow:none; }
    :scope .prism-estimate__total { align-items:baseline; }
    :scope .prism-estimate__total-label { font:var(--prism-weight-medium) var(--prism-text-sm)/1.5 var(--prism-font-body); color:var(--prism-text-muted); }
    :scope .prism-estimate__total-value { font:var(--prism-weight-regular) 52px/1 var(--prism-font-display); letter-spacing:-.035em; }
    :scope .prism-estimate__submit { border-radius:var(--prism-radius-pill); padding:10px 18px; }
    :scope .prism-estimate__summary::before { content:""; display:block; height:3px; margin-block:16px; background:${highlight}; }
  `,
});
