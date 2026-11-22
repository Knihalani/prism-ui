import { useContext, useEffect, useMemo, useRef, useState, type HTMLAttributes, type KeyboardEvent } from 'react';
import type { Node } from '@prism-ui/core';
import { s } from '@prism-ui/schema';
import { ComponentContext, defaultRenderers, defineComponent, registerComponent, useComponentState, useEmit, useFormat, usePart, usePrism, useSlot, type PrismComponentProps, type PrismContextValue } from '@prism-ui/react';
import { ComponentFrame } from '../frame';

export interface TroubleshootStep { title?: string; text: string; command?: string; yes?: string; no?: string; hint?: string }
export interface TroubleshootAnswer { step: string; answer: 'yes' | 'no' }
const defaults = { title: 'Troubleshoot', step: 'Step', question: 'Did this fix it?', yes: 'Yes', no: 'No', fixed: 'Fixed after {count} steps', notFixed: 'Not fixed yet', report: 'Send report', restart: 'Start over', sent: 'Report sent', copy: 'Copy', copied: 'Copied', copyError: 'Could not copy', loading: 'Loading step', history: 'Previous steps' };
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
    for (const field of ['title', 'command', 'yes', 'no', 'hint'] as const) if (typeof step[field] === 'string') result[key][field] = step[field];
  }
  return result;
}
function target(step: TroubleshootStep, answer: 'yes' | 'no') { return answer === 'yes' ? step.yes ?? '$fixed' : step.no; }
function reportMessage(title: unknown, resolved: boolean, path: TroubleshootAnswer[], count: string) { return `Troubleshooting "${title ?? 'Troubleshoot'}": ${resolved ? 'fixed at step' : 'not fixed after'} ${count}${resolved ? '' : ' steps'} (${path.map(entry => entry.answer === 'yes' ? 'Yes' : 'No').join(' → ')}).`; }
export function useTroubleshoot(props: TroubleshootProps, ctx: PrismContextValue) {
  const component = useContext(ComponentContext), format = useFormat(), emit = useEmit();
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
  const streamedKeys = props.steps && typeof props.steps === 'object' && !Array.isArray(props.steps) ? Object.keys(props.steps) : [];
  const readyTarget = (value: string | undefined) => value === '$fixed' || value === '$escalate' || !!(value && steps[value]?.text.trim() && streamedKeys.indexOf(value) < streamedKeys.length - 1);
  const ready = !!derived.step?.text.trim() && (component?.node.complete !== false || (readyTarget(target(derived.step, 'yes')) && readyTarget(target(derived.step, 'no'))));
  const commandNode = useMemo<Node | undefined>(() => derived.step?.command ? Object.freeze({ type: 'code', key: `${component?.id}.cmd.${derived.current}`, lang: 'bash', value: derived.step.command, complete: true }) : undefined, [component?.id, derived.current, derived.step?.command]);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => { setCopyState('idle'); clearTimeout(timer.current); return () => clearTimeout(timer.current); }, [commandNode]);
  function edit(next: TroubleshootAnswer[]) { ctx.store.batch(() => { setPath(next); setSent(false); }); }
  function answer(value: 'yes' | 'no') { if (ready && !derived.ended && derived.current) edit([...path, { step: derived.current, answer: value }]); }
  function back(index = Math.max(0, path.length - 1)) { edit(path.slice(0, index)); }
  return { ...derived, path, sent, ready, labels, steps, commandNode, copyState, title: props.title ?? labels.title,
    loading: !derived.step?.text.trim() || (component?.node.complete === false && !ready),
    state: sent ? 'sent' : derived.ended ? derived.resolved ? 'resolved' : 'dead-end' : 'active',
    position: `${labels.step} ${format.number(path.length + 1)}`,
    result: derived.resolved ? labels.fixed.replace('{count}', format.number(path.length)) : labels.notFixed,
    answer, back, restart() { edit([]); },
    report() { if (!derived.ended || sent) return; edit(path); emit('troubleshoot', { resolved: derived.resolved, path }, reportMessage(props.title, derived.resolved, path, format.number(path.length))); setSent(true); },
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
export function Troubleshooter({ props }: PrismComponentProps<TroubleshootProps>) {
  const vm = useTroubleshoot(props, usePrism());
  const body = usePart('troubleshoot', 'conversation'), history = usePart('troubleshoot', 'history'), item = usePart('troubleshoot', 'historyItem'), chip = usePart('troubleshoot', 'chip'), card = usePart('troubleshoot', 'step', vm.state), position = usePart('troubleshoot', 'position'), title = usePart('troubleshoot', 'stepTitle'), text = usePart('troubleshoot', 'text'), hint = usePart('troubleshoot', 'hint'), question = usePart('troubleshoot', 'question'), actions = usePart('troubleshoot', 'actions'), primary = usePart('troubleshoot', 'primary'), ghost = usePart('troubleshoot', 'ghost'), result = usePart('troubleshoot', 'result', vm.state);
  const command = usePart('troubleshoot', 'command');
  const Item = useSlot('troubleshoot', 'historyItem', Box), Card = useSlot('troubleshoot', 'step', Box), EmptyState = useSlot('troubleshoot', 'empty', Empty), Actions = useSlot('troubleshoot', 'actions', Box);
  return <div {...body} onKeyDown={vm.onKeyDown}><ComponentFrame component="troubleshoot" title={vm.title} state={vm.state} ask undo>
    {vm.path.length > 0 && <div {...history} aria-label={vm.labels.history}>{vm.path.map((entry, index) => <Item {...item} key={`${index}.${entry.step}`}><button {...ghost} type="button" onClick={() => vm.back(index)}><span {...text}>{vm.steps[entry.step]?.text ?? entry.step}</span><span {...chip} data-state={entry.answer}>{vm.labels[entry.answer]}</span></button></Item>)}</div>}
    {vm.ended ? <div {...result} role="status"><h4 {...title}>{vm.result}</h4>{vm.sent && <p {...text}>{vm.labels.sent}</p>}<Actions {...actions}><button {...primary} type="button" onClick={vm.report} disabled={vm.sent}>{vm.labels.report}</button><button {...ghost} type="button" onClick={vm.restart}>{vm.labels.restart}</button></Actions></div> : <Card {...card}>
      <h4 {...title}><span {...position} aria-live="polite">{vm.position}</span>{vm.step?.title}</h4>
      {!vm.step || vm.loading ? <EmptyState aria-label={vm.labels.loading} /> : <>
        <p {...text}>{vm.step.text}</p>
        {vm.commandNode && <div {...command}><Command node={vm.commandNode} /><button {...ghost} type="button" onClick={vm.copy} aria-live="polite">{vm.copyState === 'copied' ? vm.labels.copied : vm.copyState === 'error' ? vm.labels.copyError : vm.labels.copy}</button></div>}
        {vm.step.hint && <p {...hint}>{vm.step.hint}</p>}
      </>}
      <p {...question}>{vm.labels.question}</p><Actions {...actions}><button {...primary} type="button" disabled={!vm.ready} onClick={() => vm.answer('yes')} aria-keyshortcuts="Y">{vm.labels.yes}</button><button {...ghost} type="button" disabled={!vm.ready} onClick={() => vm.answer('no')} aria-keyshortcuts="N">{vm.labels.no}</button></Actions>
    </Card>}
  </ComponentFrame></div>;
}
const labelsSchema = s.object(Object.fromEntries(Object.entries(defaults).map(([key, value]) => [key, s.string().optional().describe(`Override the ${key} label${key === 'fixed' ? '; {count} is the formatted step count' : ''}`).example(value)]))).optional().describe('Translated interface labels').example(defaults);
export const troubleshootDefinition = defineComponent({ name: 'troubleshoot', schema: s.object({
  id: s.string().optional().describe('Persistent component state identifier').example('wifi'),
  title: s.string().optional().describe('Troubleshooting title').example('Wi-Fi drops'),
  start: s.string().describe('First step id').example('restart'),
  steps: s.any().describe('Record of step id to {title?: string, text: string, command?: string, yes?: string, no?: string, hint?: string}. Targets are step ids, $fixed, or $escalate. Missing yes defaults to $fixed; missing or unknown no ends unresolved.').example({ restart: { text: 'Restart the Wi-Fi adapter.', command: 'nmcli radio wifi off && nmcli radio wifi on', yes: '$fixed', no: '$escalate' } }),
  labels: labelsSchema,
}), component: Troubleshooter, syntax: 'fence', docs: 'A guided troubleshooting checklist with branching answers, editable history and a final report. Use Y/N to answer and Backspace or ArrowLeft to go back.', examples: ['```ui:troubleshoot\n{"id":"wifi","title":"Wi-Fi drops","start":"restart","steps":{"restart":{"text":"Restart the Wi-Fi adapter.","command":"nmcli radio wifi off && nmcli radio wifi on","yes":"$fixed","no":"$escalate"}}}\n```'],
  message(action) { if (action.type !== 'troubleshoot') return 'Tell me more about this troubleshooter…'; const payload = action.payload as { resolved: boolean; path: TroubleshootAnswer[] }; return reportMessage(action.context.props.title, payload.resolved, payload.path, String(payload.path.length)); },
});
registerComponent(troubleshootDefinition);
