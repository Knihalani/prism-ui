import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { tokenVariable, type Tokens } from '@prism-ui/react';
import { availableThemes } from '../themes';
import { Icon } from '../ui/Icon';
import { baseValue, clearToken, radiusScale, setToken, spaceScale, springTokens, toTheme, tokenCatalogue, typeScale, type EditTarget, type SpringProfile, type ThemeDraft, type TokenDefinition } from './model';
import { exportTheme, slugName } from './export-theme';
import { importCssVariables, type CssImport } from './import-css';

type Props = {
  draft: ThemeDraft; mode: EditTarget; onMode(mode: EditTarget): void; onChange(draft: ThemeDraft): void;
  onClose(): void; undo(): void; redo(): void; canUndo: boolean; canRedo: boolean; inert?: boolean;
};
const fonts = [
  ['Inherit from host', 'inherit'], ['System sans', 'system-ui, sans-serif'], ['System serif', 'Georgia, serif'], ['System mono', 'ui-monospace, monospace'],
  ['Manrope', '"Shell Manrope", sans-serif'], ['Inter', '"Shell Inter", sans-serif'], ['JetBrains Mono', '"Shell Mono", monospace'],
  ['DM Sans', '"DM Sans", sans-serif'], ['Caveat', '"Caveat", cursive'], ['Inter Tight', '"Inter Tight", sans-serif'], ['IBM Plex Mono', '"IBM Plex Mono", monospace'],
];
const px = (value: string | undefined, fallback: number) => value && /^\d*\.?\d+(px|rem)$/.test(value) ? parseFloat(value) * (value.endsWith('rem') ? 16 : 1) : fallback;
const ms = (value: string | undefined) => value ? parseFloat(value) * (value.endsWith('ms') ? 1 : 1000) : 0;

function ColourWell({ value, token, revision, onChange }: { value?: string; token: keyof Tokens; revision: ThemeDraft; onChange(value: string): void }) {
  const [colour, setColour] = useState('#808080'), [hex, setHex] = useState('#808080');
  useLayoutEffect(() => {
    const root = document.querySelector('.reply-content > .prism-root') ?? document.querySelector('.shell');
    if (!root) return;
    const probe = document.createElement('span');
    probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none';
    probe.style.color = value || `var(${tokenVariable(token)}, currentColor)`;
    root.append(probe);
    const computed = getComputedStyle(probe).color;
    probe.remove(); setColour(computed || 'transparent');
    const rgb = computed.match(/^rgba?\((\d+)[, ]+(\d+)[, ]+(\d+)/);
    if (rgb) setHex('#' + rgb.slice(1, 4).map(n => Number(n).toString(16).padStart(2, '0')).join(''));
    else if (/^#[\da-f]{6}$/i.test(computed)) setHex(computed);
    else if (typeof window.CanvasRenderingContext2D !== 'undefined') {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
      const context = canvas.getContext('2d');
      if (context) {
        context.fillStyle = computed; context.fillRect(0, 0, 1, 1);
        setHex('#' + [...context.getImageData(0, 0, 1, 1).data].slice(0, 3).map(n => n.toString(16).padStart(2, '0')).join(''));
      }
    }
  }, [value, token, revision]);
  return <span className="te-swatch" style={{ backgroundColor: colour }}><input type="color" aria-label={token + ' colour picker'} value={hex} onChange={event => onChange(event.target.value)} /></span>;
}

function Slider({ label, value, min, max, step = 1, unit = '', onChange }: { label: string; value: number; min: number; max: number; step?: number; unit?: string; onChange(value: number): void }) {
  const id = useId();
  return <div className="te-slider"><label htmlFor={id}>{label}<output htmlFor={id} aria-hidden="true">{Number(value.toFixed(3))}{unit}</output></label><input id={id} type="range" min={min} max={max} step={step} aria-valuetext={Number(value.toFixed(3)) + unit} value={Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : min} onChange={event => onChange(Number(event.target.value))} /></div>;
}
function Group({ title, caption, count, open, children }: { title: string; caption: string; count?: number; open?: boolean; children: ReactNode }) {
  return <details className="te-group" open={open}><summary><span className="te-chevron">›</span><strong>{title}</strong><span className="te-caption">{caption}</span>{!!count && <span className="te-count">{count}</span>}</summary><div className="te-group-body">{children}</div></details>;
}
function Highlight({ code }: { code: string }) {
  const pieces: ReactNode[] = []; let from = 0;
  for (const match of code.matchAll(/"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\b(?:import|from|export|const|defineTheme)\b/g)) {
    pieces.push(code.slice(from, match.index), <span key={match.index} className={/^["']/.test(match[0]) ? 'te-code-string' : 'te-code-keyword'}>{match[0]}</span>);
    from = match.index! + match[0].length;
  }
  return <>{pieces}{code.slice(from)}</>;
}
function SpringControl({ bouncy = false, easing, duration, profile, onChange }: { bouncy?: boolean; easing?: string; duration?: string; profile?: SpringProfile; onChange(profile: SpringProfile): void }) {
  const [replay, setReplay] = useState(0);
  const { response, damping } = profile ?? { response: bouncy ? .4 : .35, damping: bouncy ? .7 : .85 };
  const update = (response: number, damping: number) => onChange({ response, damping });
  const name = bouncy ? 'Bouncy' : 'Spring', generated = springTokens(response, damping, bouncy ? 'bouncy' : 'spring');
  const curve = easing ?? (bouncy ? generated.motionSpringBouncy : generated.motionSpring)!;
  const values = curve.startsWith('linear(') ? curve.slice(7, -1).split(',').map(Number) : [];
  const path = values.length > 1 && values.every(Number.isFinite) ? values.map((value, i) => `${i ? 'L' : 'M'}${i / (values.length - 1) * 120},${40 - value * 40}`).join(' ') : 'M0,40 C20,10 20,0 120,0';
  return <div className="te-spring">
    <div className="te-spring-heading"><strong>{name}</strong><button type="button" onClick={() => setReplay(value => value + 1)} aria-label={'Replay ' + name.toLowerCase()}>Replay <span aria-hidden="true">↗</span></button></div>
    <div className="te-curve"><svg viewBox="-2 -8 124 52" aria-label={name + ' easing curve'} role="img"><path className="te-curve-guide" d="M0 0H120M0 40H120" /><path d={path} /></svg><div className="te-track"><i key={replay} style={{ animationTimingFunction: curve, animationDuration: duration ?? (bouncy ? generated.motionSpringBouncyDuration : generated.motionSpringDuration) }} /></div></div>
    <Slider label={name + ' response'} value={response} min={.1} max={1} step={.01} unit="s" onChange={value => update(value, damping)} />
    <Slider label={name + ' damping'} value={damping} min={.3} max={1.5} step={.01} onChange={value => update(response, value)} />
  </div>;
}

export function ThemeEditor({ draft, mode, onMode, onChange, onClose, undo, redo, canUndo, canRedo, inert }: Props) {
  const nameRef = useRef<HTMLInputElement>(null);
  const [pendingBase, setPendingBase] = useState<string>(), [paste, setPaste] = useState(''), [report, setReport] = useState<CssImport>(), [copied, setCopied] = useState(false), [error, setError] = useState('');
  const theme = toTheme(draft, availableThemes), code = exportTheme(draft);
  const nameId = useId(), baseId = useId(), pasteId = useId();
  useEffect(() => { nameRef.current?.focus(); }, []);
  useEffect(() => { setCopied(false); }, [code]);
  const value = (key: keyof Tokens, target: EditTarget = 'light') => baseValue(theme, key, target);
  const merge = (tokens: Partial<Tokens>, target: EditTarget = 'light') => onChange({ ...draft, [target === 'dark' ? 'dark' : 'tokens']: { ...draft[target === 'dark' ? 'dark' : 'tokens'], ...tokens } });
  const mergeSpring = (variant: 'spring' | 'bouncy', profile: SpringProfile) => onChange({ ...draft, tokens: { ...draft.tokens, ...springTokens(profile.response, profile.damping, variant) }, springProfiles: { ...draft.springProfiles, [variant]: profile } });
  const rows = (group: string) => tokenCatalogue.filter(token => token.group === group).map(token => row(token));
  const count = (group: string) => tokenCatalogue.filter(token => token.group === group && (draft.tokens[token.key] !== undefined || draft.dark[token.key] !== undefined)).length;
  const total = new Set([...Object.keys(draft.tokens), ...Object.keys(draft.dark)]).size;
  function row(token: TokenDefinition) {
    const target = token.supportsDark ? mode : 'light', field = target === 'dark' ? draft.dark : draft.tokens;
    const current = value(token.key, target), overridden = field[token.key] !== undefined, id = 'te-' + token.key;
    return <div className={'te-token' + (overridden ? ' is-overridden' : '')} key={token.key}>
      <label htmlFor={id} title={token.key}><span className="te-override" aria-hidden="true" />{token.label}</label>
      {token.control === 'colour' && <ColourWell value={current} token={token.key} revision={draft} onChange={next => onChange(setToken(draft, token.key, next, target))} />}
      <div className="te-token-value">
        {token.control === 'font' && <select aria-label={token.label + ' family'} value={fonts.some(([, family]) => family === current) ? current : ''} onChange={event => onChange(setToken(draft, token.key, event.target.value, target))}><option value="" disabled>Custom stack</option>{fonts.map(([label, family]) => <option value={family} key={label}>{label}</option>)}</select>}
        <input id={id} type="text" spellCheck={false} title={current} aria-description={overridden ? 'Overrides base theme' : 'Inherited from base theme'} value={current ?? ''} placeholder="Inherited" onChange={event => onChange(setToken(draft, token.key, event.target.value, target))} />
      </div>
      <button className="te-clear" aria-label={'Clear ' + token.label + ' override'} title="Use inherited value" disabled={!overridden} onClick={() => onChange(clearToken(draft, token.key, target))}>×</button>
    </div>;
  }
  const basePx = px(value('textBase'), 16), ratio = px(value('textLg'), 18) / basePx;
  const shared = <p className="te-note">Shared across light and dark.</p>;
  return <aside id="theme-editor" className="theme-editor" inert={inert || undefined} aria-label="Theme editor" style={{ '--te-motion-base': value('motionBase'), '--te-motion-fast': value('motionFast'), '--te-motion-ease': value('motionEase') } as CSSProperties} onKeyDown={event => {
    if (event.defaultPrevented || event.nativeEvent.isComposing) return;
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); onClose(); }
    else if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? redo() : undo(); }
  }}>
    <header className="te-header"><div className="te-eyebrow"><span><i />THEME STUDIO</span><button className="te-icon" aria-label="Close theme editor" onClick={onClose}><Icon name="close" /></button></div>
      <label className="te-sr-only" htmlFor={nameId}>Theme name</label><input className="te-name" id={nameId} ref={nameRef} value={draft.name} placeholder="Untitled theme" onChange={event => onChange({ ...draft, name: event.target.value })} />
      <div className="te-base"><label htmlFor={baseId}>Start from</label><select id={baseId} value={pendingBase ?? draft.base} onChange={event => setPendingBase(event.target.value)}>{availableThemes.map(base => <option value={base.name} key={base.name}>{base.name[0].toUpperCase() + base.name.slice(1)}</option>)}</select><span className="te-saved"><i />Saved locally</span></div>
      {pendingBase && <div className="te-base-choice"><span>Use {pendingBase}?</span><button onClick={() => { onChange({ ...draft, base: pendingBase }); setPendingBase(undefined); }}>Keep edits</button><button onClick={() => { onChange({ ...draft, base: pendingBase, tokens: {}, dark: {}, springProfiles: undefined }); setPendingBase(undefined); }}>Start fresh</button></div>}
      <div className="te-toolbar"><span>{total} override{total === 1 ? '' : 's'}</span><div><button className="te-icon" aria-label="Undo theme edit" disabled={!canUndo} onClick={undo}>↶</button><button className="te-icon" aria-label="Redo theme edit" disabled={!canRedo} onClick={redo}>↷</button><button onClick={() => onChange({ ...draft, tokens: {}, dark: {}, springProfiles: undefined })} disabled={!total && !draft.springProfiles}>Reset all</button></div></div>
      <div className="te-target" role="group" aria-label="Editing colour mode">{(['light', 'dark'] as const).map(target => <button key={target} aria-pressed={mode === target} onClick={() => onMode(target)}><Icon name={target === 'light' ? 'sun' : 'moon'} />{target === 'light' ? 'Light' : 'Dark'}</button>)}<span>Live preview <i /></span></div>
    </header>
    <div className="te-scroll">
      <Group title="Colours" caption="Surfaces & ink" count={count('colour')} open>{rows('colour')}</Group>
      <Group title="Fonts" caption="Voice & character" count={count('font')}>{shared}{rows('font')}</Group>
      <Group title="Type" caption="Scale & weight" count={count('type') + count('weight')}>{shared}
        <Slider label="Base size" value={basePx} min={10} max={24} step={.5} unit="px" onChange={next => merge(typeScale(next, ratio))} />
        <Slider label="Type ratio" value={ratio} min={1} max={1.6} step={.025} onChange={next => merge(typeScale(basePx, next))} />
        <details className="te-nested"><summary>Individual sizes</summary>{rows('type')}</details>{rows('weight')}
      </Group>
      <Group title="Radius" caption="Corners" count={count('radius')}>{shared}<Slider label="Radius scale" value={px(value('radiusMd'), 8)} min={0} max={32} unit="px" onChange={next => merge(radiusScale(next))} />{rows('radius')}</Group>
      <Group title="Spacing" caption="Rhythm" count={count('space')}>{shared}<Slider label="Spacing unit" value={px(value('space1'), 4)} min={0} max={12} step={.5} unit="px" onChange={next => merge(spaceScale(next))} />{rows('space')}</Group>
      <Group title="Elevation" caption="Depth" count={count('elevation')}>
        <div className="te-presets">{['None', 'Soft', 'Default', 'Strong'].map((label, i) => <button key={label} onClick={() => {
          const strength = [.0, .6, 1, 1.7][i], tokens = Object.fromEntries([1, 2, 3].map((n) => ['elevation' + n, i === 0 ? 'none' : `0 ${n * 2}px ${n * 8}px rgb(0 0 0 / ${(mode === 'dark' ? .2 : .07) * strength * n})`]));
          merge(tokens, mode);
        }}>{label}</button>)}</div>{rows('elevation')}
      </Group>
      <Group title="Motion" caption="Timing & feel" count={count('motion')}>{shared}
        {(['motionInstant', 'motionFast', 'motionBase', 'motionSlow'] as const).map((key, i) => <Slider key={key} label={['Instant', 'Fast', 'Base', 'Slow'][i] + ' duration'} value={ms(value(key))} min={0} max={1000} step={10} unit="ms" onChange={next => merge({ [key]: next + 'ms' })} />)}
        {tokenCatalogue.filter(token => ['motionEase', 'motionEaseInOut', 'motionEaseExit'].includes(token.key)).map(row)}
        <SpringControl profile={draft.springProfiles?.spring} easing={value('motionSpring')} duration={value('motionSpringDuration')} onChange={profile => mergeSpring('spring', profile)} /><SpringControl bouncy profile={draft.springProfiles?.bouncy} easing={value('motionSpringBouncy')} duration={value('motionSpringBouncyDuration')} onChange={profile => mergeSpring('bouncy', profile)} />
        <details className="te-nested"><summary>Spring CSS & durations</summary>{tokenCatalogue.filter(token => token.key.startsWith('motionSpring')).map(row)}</details>
        {tokenCatalogue.filter(token => ['motionStagger', 'motionDistance', 'motionScale', 'motionBlur'].includes(token.key)).map(row)}
      </Group>
      <Group title="Import" caption="Bring your system">
        <label className="te-textarea-label" htmlFor={pasteId}>Paste shadcn / Tailwind CSS variables</label><textarea id={pasteId} className="te-paste" value={paste} spellCheck={false} placeholder={':root {\n  --primary: oklch(.6 .16 150);\n  --radius: .5rem;\n}'} onChange={event => setPaste(event.target.value)} />
        <div className="te-action-row"><span role="status">{report ? `Mapped ${report.mapped.length}, ignored ${report.unmapped.length}` : 'v3 HSL · v4 OKLCH · @theme'}</span><button className="te-primary" disabled={!paste.trim()} onClick={() => { const result = importCssVariables(paste); setReport(result); onChange({ ...draft, tokens: { ...draft.tokens, ...result.tokens }, dark: { ...draft.dark, ...result.dark } }); }}>Apply</button></div>
        {!!report?.unmapped.length && <details className="te-nested"><summary>Ignored variables</summary><p className="te-ignored">{report.unmapped.join(', ')}</p></details>}
      </Group>
      <Group title="Export" caption="Make it yours">
        <p className="te-note">The same theme you see, ready for your app.</p><pre className="te-code" tabIndex={0} aria-label="Theme TypeScript"><code><Highlight code={code} /></code></pre>
        <div className="te-action-row"><button onClick={() => {
          const url = URL.createObjectURL(new Blob([code], { type: 'text/typescript;charset=utf-8' })), link = document.createElement('a');
          link.href = url; link.download = slugName(draft.name) + '.ts'; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
        }}>Download .ts <span aria-hidden="true">↓</span></button><button className="te-primary" onClick={async () => { try { await navigator.clipboard.writeText(code); setCopied(true); setError(''); } catch { setError('Clipboard unavailable. Select the code to copy.'); } }}>{copied ? 'Copied' : 'Copy code'}<Icon name={copied ? 'check' : 'copy'} /></button></div><span className="te-sr-only" role="status">{copied ? 'Theme copied' : ''}</span>{error && <p role="alert">{error}</p>}
      </Group>
      <footer className="te-footer"><span>PRISM</span><span>Your product. Your language.</span></footer>
    </div>
  </aside>;
}
