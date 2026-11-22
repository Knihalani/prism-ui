import { useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type HTMLAttributes, type KeyboardEvent } from 'react';
import type { Node } from '@prism-ui/core';
import { s } from '@prism-ui/schema';
import { ComponentContext, StreamSkeleton, defaultRenderers, defineComponent, registerComponent, useComponentState, useFormat, usePart, usePrism, useSent, useSlot, type PrismComponentProps, type PrismContextValue } from '@prism-ui/react';
import { ComponentFrame, FrameIcon } from '../frame';
import { CheckMark, Chip, IconButton, KbdHint, Pill } from '../shared';

export interface TroubleshootStep { title?: string; text: string; question?: string; command?: string; yes?: string; no?: string; hint?: string }
export interface TroubleshootAnswer { step: string; answer: 'yes' | 'no' }
const defaults = { title: 'Troubleshoot', step: 'Step', question: 'Did this fix it?', yes: 'Yes', no: 'No', fixed: 'Fixed after {count} steps', fixedOne: 'Fixed after {count} step', fixedOther: 'Fixed after {count} steps', notFixed: 'Not fixed yet', report: 'Send report', restart: 'Start over', sent: 'Report sent', copy: 'Copy', copied: 'Copied', copyError: 'Could not copy', loading: 'Loading step', history: 'Previous steps' };
export type TroubleshootLabels = Partial<typeof defaults>;
export interface TroubleshootProps { id?: string; title?: string; start?: string; steps?: unknown; labels?: TroubleshootLabels }
function validateSteps(raw: unknown): Record<string, TroubleshootStep> {
  const result: Record<string, TroubleshootStep> = Object.create(null);
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return result;
  for (const [key, value] of Object.entries(raw)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
    const step = value as Record<string, unknown>;
    if (typeof step.text !== 'string') continue;
    result[key] = { text: step.text };
    for (const field of ['title', 'question', 'command', 'yes', 'no', 'hint'] as const) if (typeof step[field] === 'string') result[key][field] = step[field];
  }
  return result;
}
function target(step: TroubleshootStep, answer: 'yes' | 'no') { return answer === 'yes' ? step.yes ?? '$fixed' : step.no; }
function reportMessage(title: unknown, resolved: boolean, path: TroubleshootAnswer[], count: string) { return `Troubleshooting "${title ?? 'Troubleshoot'}": ${resolved ? 'fixed at step' : 'not fixed after'} ${count}${resolved ? '' : ' steps'} (${path.map(entry => entry.answer === 'yes' ? 'Yes' : 'No').join(' → ')}).`; }
export function useTroubleshoot(props: TroubleshootProps, ctx: PrismContextValue) {
  const component = useContext(ComponentContext), format = useFormat(), receipt = useSent();
  const [storedPath, setPath] = useComponentState<TroubleshootAnswer[]>('path', []), [sent, setSent] = useComponentState('sent', false);
  const steps = useMemo(() => validateSteps(props.steps), [props.steps]);
  const labels = useMemo(() => ({ ...defaults, ...props.labels }), [props.labels]);
  const derived = useMemo(() => {
    let current = props.start;
    const path: TroubleshootAnswer[] = [];
    for (const entry of storedPath) { const step = current ? steps[current] : undefined; if (!step || entry.step !== current) break; path.push(entry); current = target(step, entry.answer); }
    const resolved = current === '$fixed';
    const step = current && !current.startsWith('$') ? steps[current] : undefined;
    const ended = resolved || (path.length > 0 && !step) || (component?.node.complete !== false && !step);
    return { current, step, resolved, ended, path };
  }, [props.start, storedPath, steps, component?.node.complete]);
  const { path } = derived;
  const repeatsQuestion = derived.step?.text.trim().endsWith('?') && /did (this|that|it) fix/i.test(derived.step.text);
  const question = derived.step?.question ?? (repeatsQuestion && labels.question === defaults.question ? undefined : labels.question);
  useEffect(() => { if (!sent) receipt.reset(); }, [sent, receipt.reset]);
  const pluralRules = useMemo(() => new Intl.PluralRules(format.locale), [format.locale]);
  const resultLabel = pluralRules.select(path.length) === 'one' ? props.labels?.fixedOne ?? props.labels?.fixed ?? labels.fixedOne : props.labels?.fixedOther ?? props.labels?.fixed ?? labels.fixedOther;
  const streamedKeys = props.steps && typeof props.steps === 'object' && !Array.isArray(props.steps) ? Object.keys(props.steps) : [];
  const currentReady = component?.node.complete !== false || !!(derived.current && streamedKeys.indexOf(derived.current) >= 0 && streamedKeys.indexOf(derived.current) < streamedKeys.length - 1);
  const readyTarget = (value: string | undefined) => value === '$fixed' || value === '$escalate' || !!(value && steps[value]?.text.trim() && streamedKeys.indexOf(value) < streamedKeys.length - 1);
  const ready = currentReady && !!derived.step?.text.trim() && (component?.node.complete !== false || (readyTarget(target(derived.step, 'yes')) && readyTarget(target(derived.step, 'no'))));
  const commandNode = useMemo<Node | undefined>(() => derived.step?.command ? Object.freeze({ type: 'code', key: `${component?.id}.cmd.${derived.current}`, lang: 'bash', value: derived.step.command, complete: true }) : undefined, [component?.id, derived.current, derived.step?.command]);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => { setCopyState('idle'); clearTimeout(timer.current); return () => clearTimeout(timer.current); }, [commandNode]);
  function edit(next: TroubleshootAnswer[]) { receipt.reset(); ctx.store.batch(() => { setPath(next); setSent(false); }); }
  function answer(value: 'yes' | 'no') { if (ready && !derived.ended && derived.current) edit([...path, { step: derived.current, answer: value }]); }
  function back(index = Math.max(0, path.length - 1)) { edit(path.slice(0, index)); }
  return { ...derived, path, sent, ready, labels, steps, question, commandNode, copyState, title: props.title ?? labels.title,
    loading: !derived.step?.text.trim() || (component?.node.complete === false && !ready),
    state: sent ? 'sent' : derived.ended ? derived.resolved ? 'resolved' : 'dead-end' : 'active',
    position: `${labels.step} ${format.number(path.length + 1)}`,
    result: derived.resolved ? resultLabel.replace('{count}', format.number(path.length)) : labels.notFixed,
    answer, back, restart() { edit([]); },
    report() { if (!derived.ended || sent) return; ctx.store.batch(() => { if (path.length !== storedPath.length) setPath(path); receipt.send('troubleshoot', { resolved: derived.resolved, path }, reportMessage(props.title, derived.resolved, path, format.number(path.length))); setSent(true); }); },
    onKeyDown(event: KeyboardEvent<HTMLElement>) {
      const element = event.target as HTMLElement;
      if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey || element.closest('input, textarea, select, [contenteditable="true"]')) return;
      const key = event.key.toLowerCase();
      if (key === 'y' || key === 'n') { event.preventDefault(); answer(key === 'y' ? 'yes' : 'no'); }
      if ((key === 'backspace' || key === 'arrowleft') && path.length) { event.preventDefault(); back(); }
    },
    async copy() { clearTimeout(timer.current); try { await navigator.clipboard.writeText((commandNode?.value ?? '').replace(/^\$ /gm, '')); setCopyState('copied'); } catch { setCopyState('error'); } timer.current = setTimeout(() => setCopyState('idle'), 1500); },
  };
}
function Box(props: HTMLAttributes<HTMLDivElement>) { return <div {...props} />; }
function Empty(props: HTMLAttributes<HTMLDivElement>) { return <div {...usePart('troubleshoot', 'skeleton')} {...props} role="status" />; }
function Command({ node }: { node: Node }) {
  const ctx = usePrism(), definition = ctx.registry.get('code');
  const View = ctx.components.code ?? definition?.component ?? defaultRenderers.code;
  const props = useMemo(() => definition?.schema?.coerce(node.props ?? {}).value ?? {}, [definition, node]);
  const value = useMemo(() => ({ name: 'code', id: node.key, node, props, def: definition }), [node, props, definition]);
  return <ComponentContext.Provider value={value}><View node={node} props={props} id={node.key} complete partial={false} issues={[]}>{node.value}</View></ComponentContext.Provider>;
}
function breadcrumb(step: TroubleshootStep | undefined, fallback: string) {
  if (step?.title?.trim()) return step.title.trim();
  const sentence = step?.text.trim().match(/^[^.!?]*[.!?]?/)?.[0] || fallback;
  const words = sentence.split(/\s+/);
  return words.length > 6 ? words.slice(0, 6).join(' ') + '…' : sentence;
}
function PathMap({ vm }: { vm: ReturnType<typeof useTroubleshoot> }) {
  const part = usePart('troubleshoot', 'map'), ref = useRef<SVGSVGElement>(null), gradient = useId();
  const [width, setWidth] = useState(520);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const update = () => setWidth(Math.min(520, element.getBoundingClientRect().width || 520));
    update();
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(update); observer.observe(element);
    return () => observer.disconnect();
  }, []);
  const nodes = [...vm.path.map(entry => entry.step), vm.current ?? '$escalate'];
  const labels = nodes.map(node => node === '$fixed' ? 'Resolved' : node.startsWith('$') ? 'Support' : breadcrumb(vm.steps[node], node));
  const mapLabels = nodes.map((node, index) => vm.steps[node]?.title?.trim().endsWith('?') ? node.replace(/[-_]/g, ' ').replace(/^./, char => char.toUpperCase()) : labels[index].split(/\s+/).slice(0, 2).join(' '));
  const step = Math.min(110, (width - 82) / Math.max(3, nodes.length)), x = 24 + (nodes.length - 1) * step;
  return <svg {...part} ref={ref} viewBox={`0 0 ${width} 68`} role="img" aria-label={'Troubleshooting path: ' + labels.join(' → ')}>
    <defs><linearGradient id={gradient}><stop stopColor="#7dd3fc" /><stop offset=".5" stopColor="#c084fc" /><stop offset="1" stopColor="#fdba74" /></linearGradient></defs>
    {nodes.length > 1 && <path data-route="visited" d={`M24 26H${x}`} />}
    {!vm.ended && <g><path data-route="future" d={`M${x} 26H${x + 14}L${x + 32} 12H${x + step}M${x} 26H${x + 14}L${x + 32} 40H${x + step}`} /><circle data-station="unexplored" cx={x + step} cy="12" r="3" /><circle data-station="unexplored" cx={x + step} cy="40" r="3" /><text data-branch="" x={x + step + 10} y="16">{vm.labels.yes}</text><text data-branch="" x={x + step + 10} y="44">{vm.labels.no}</text></g>}
    {nodes.map((node, index) => <g key={index + node}><circle cx={24 + index * step} cy="26" r="5" data-station={index === nodes.length - 1 ? 'current' : 'taken'} style={index === nodes.length - 1 ? { stroke: `url(#${gradient})` } : undefined} /><text x={24 + index * step} y="64" textAnchor={index ? 'middle' : 'start'}>{mapLabels[index]}</text></g>)}
  </svg>;
}
export function TroubleshootSkeleton({ props }: PrismComponentProps<TroubleshootProps>) {
  const root = usePart('troubleshoot', 'root'), header = usePart('troubleshoot', 'header'), title = usePart('troubleshoot', 'title'), line = usePart('troubleshoot', 'skeleton'), map = usePart('troubleshoot', 'map'), actions = usePart('troubleshoot', 'actions');
  return <StreamSkeleton {...root}><header {...header}><h3 {...title}>{props.title}</h3></header><svg {...map} viewBox="0 0 520 68"><path d="M24 26H134" /><circle cx="24" cy="26" r="5" /></svg>{[80, 65].map((width, index) => <span {...line} key={index} data-prism-skeleton-line="" style={{ ...line.style, '--prism-skeleton-width': width + '%', '--prism-skeleton-height': index ? '24px' : '38px' } as CSSProperties} />)}<div {...actions}>{[0, 1].map(index => <span {...line} key={index} data-prism-skeleton-line="" style={{ ...line.style, '--prism-skeleton-width': '114px', '--prism-skeleton-height': '42px' } as CSSProperties} />)}</div></StreamSkeleton>;
}
export function Troubleshooter({ props }: PrismComponentProps<TroubleshootProps>) {
  const prism = usePrism(), vm = useTroubleshoot(props, prism);
  const body = usePart('troubleshoot', 'conversation'), history = usePart('troubleshoot', 'history'), item = usePart('troubleshoot', 'historyItem'), chip = usePart('troubleshoot', 'chip'), card = usePart('troubleshoot', 'step', vm.state), position = usePart('troubleshoot', 'position'), title = usePart('troubleshoot', 'stepTitle'), text = usePart('troubleshoot', 'text'), hint = usePart('troubleshoot', 'hint'), question = usePart('troubleshoot', 'question'), actions = usePart('troubleshoot', 'actions'), primary = usePart('troubleshoot', 'primary'), ghost = usePart('troubleshoot', 'ghost'), result = usePart('troubleshoot', 'result', vm.state), command = usePart('troubleshoot', 'command'), rewind = usePart('troubleshoot', 'rewind'), resolution = usePart('troubleshoot', 'resolution'), copy = usePart('troubleshoot', 'copy');
  const Item = useSlot('troubleshoot', 'historyItem', Box), Card = useSlot('troubleshoot', 'step', Box), EmptyState = useSlot('troubleshoot', 'empty', Empty), Actions = useSlot('troubleshoot', 'actions', Box);
  const Button = prism.unstyled ? 'button' : Pill, History = prism.unstyled ? 'button' : Chip, Copy = prism.unstyled ? 'button' : IconButton;
  const report = props.labels?.report ?? (vm.resolved ? 'Send resolution' : 'Send what we tried');
  return <div {...body} onKeyDown={vm.onKeyDown}><ComponentFrame component="troubleshoot" title={vm.title} state={vm.state} ask undo toolbar={<button {...rewind} type="button" disabled={!vm.path.length} onClick={() => vm.back()}><FrameIcon name="undo" />Rewind</button>}>
    <PathMap vm={vm} />
    {vm.path.length > 0 && <div {...history} aria-label={vm.labels.history}>{vm.path.map((entry, index) => <Item {...item} key={`${index}.${entry.step}`}><History {...ghost} type="button" aria-label={`${vm.steps[entry.step]?.text ?? entry.step} ${vm.labels[entry.answer]}`} onClick={() => vm.back(index)}><span aria-hidden="true" data-answer={entry.answer}>{entry.answer === 'yes' ? '✓' : '✕'}</span><span>{breadcrumb(vm.steps[entry.step], entry.step)}</span><span aria-hidden="true">·</span><strong {...chip} data-state={entry.answer}>{vm.labels[entry.answer]}</strong></History></Item>)}</div>}
    {vm.ended ? <div {...result} role="status">{vm.resolved && <div {...resolution}><CheckMark draw={prism.animate} /></div>}<h4 {...title}>{vm.resolved ? 'Fixed.' : 'Let’s hand this to a human.'}</h4><p {...text}>{vm.result}</p><Actions {...actions}><Button {...primary} type="button" onClick={vm.report} disabled={vm.sent} {...(!prism.unstyled ? { sent: vm.sent, receipt: vm.labels.sent } : {})}>{vm.sent && prism.unstyled ? vm.labels.sent : <>{report}<span aria-hidden="true">↗</span></>}</Button><button {...ghost} type="button" onClick={vm.restart}>{vm.labels.restart}</button></Actions></div> : <Card {...card}>
      <h4 {...title}><span {...position} aria-live="polite">{vm.position}</span>{vm.step?.title?.trim() || vm.step?.text}</h4>
      {!vm.step || vm.loading ? <EmptyState aria-label={vm.labels.loading} /> : <>
        {vm.step.title?.trim() && <p {...text}>{vm.step.text}</p>}
        {vm.commandNode && <div {...command}>{!vm.commandNode.value?.startsWith('$ ') && <span aria-hidden="true">$</span>}<Command node={vm.commandNode} /><Copy {...copy} type="button" onClick={vm.copy} aria-label={vm.copyState === 'copied' ? vm.labels.copied : vm.copyState === 'error' ? vm.labels.copyError : vm.labels.copy} title={vm.copyState === 'copied' ? vm.labels.copied : vm.labels.copy} aria-live="polite">{vm.copyState === 'copied' ? <CheckMark draw={prism.animate} /> : <svg aria-hidden="true" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor"><rect x="5" y="5" width="8" height="9" rx="1.5" /><path d="M10 5V2H2v9h3" /></svg>}</Copy></div>}
        {vm.step.hint && <p {...hint}>{vm.step.hint}</p>}
      </>}
      {vm.question && <p {...question}>{vm.question}</p>}<Actions {...actions} data-options=""><Button {...primary} type="button" disabled={!vm.ready} onClick={() => vm.answer('yes')} aria-label={vm.labels.yes} aria-keyshortcuts="Y">{vm.labels.yes}<KbdHint aria-hidden="true">Y</KbdHint></Button><Button {...ghost} type="button" disabled={!vm.ready} onClick={() => vm.answer('no')} aria-label={vm.labels.no} aria-keyshortcuts="N" {...(!prism.unstyled ? { variant: 'secondary' as const } : {})}>{vm.labels.no}<KbdHint aria-hidden="true">N</KbdHint></Button></Actions>
    </Card>}
  </ComponentFrame></div>;
}
const labelsSchema = s.object(Object.fromEntries(Object.entries(defaults).map(([key, value]) => [key, s.string().optional().describe(`Override the ${key} label${key.startsWith('fixed') ? '; {count} is the formatted step count' : ''}`).example(value)]))).optional().describe('Translated interface labels').example(defaults);
export const troubleshootDefinition = defineComponent({ name: 'troubleshoot', schema: s.object({
  id: s.string().optional().describe('Persistent component state identifier').example('wifi'),
  title: s.string().optional().describe('Troubleshooting title').example('Wi-Fi drops'),
  start: s.string().describe('First step id').example('restart'),
  steps: s.any().describe('Record of step id to {title?: string, text: string, question?: string, command?: string, yes?: string, no?: string, hint?: string}. Targets are step ids, $fixed, or $escalate. Missing yes defaults to $fixed; missing or unknown no ends unresolved.').example({ restart: { text: 'Restart the Wi-Fi adapter.', command: 'nmcli radio wifi off && nmcli radio wifi on', yes: '$fixed', no: '$escalate' } }),
  labels: labelsSchema,
}), component: Troubleshooter, skeleton: TroubleshootSkeleton, syntax: 'fence', docs: 'A guided troubleshooting checklist with branching answers, editable history and a final report. Use Y/N to answer and Backspace or ArrowLeft to go back.', examples: ['```ui:troubleshoot\n{"id":"wifi","title":"Wi-Fi drops","start":"restart","steps":{"restart":{"text":"Restart the Wi-Fi adapter.","command":"nmcli radio wifi off && nmcli radio wifi on","yes":"$fixed","no":"$escalate"}}}\n```'],
  message(action) { if (action.type !== 'troubleshoot') return 'Tell me more about this troubleshooter…'; const payload = action.payload as { resolved: boolean; path: TroubleshootAnswer[] }; return reportMessage(action.context.props.title, payload.resolved, payload.path, String(payload.path.length)); },
});
registerComponent(troubleshootDefinition);
