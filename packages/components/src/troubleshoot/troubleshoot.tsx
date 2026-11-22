import { formatComponentMessage } from '../strings';
import { useContext, useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { Node } from '@prism-ui/core';
import { s } from '@prism-ui/schema';
import { useCollapse, useStrings, useTheme, Icon, PrismPart, StreamSkeleton, ComponentContext, defaultRenderers, defineComponent, registerComponent, useComponentState, useEmit, useFormat, usePart, usePrism, type PrismComponentProps, type PrismContextValue } from '@prism-ui/react';
import { ComponentFrame } from '../frame';

export interface TroubleshootStep { title?: string; text: string; command?: string; yes?: string; no?: string; hint?: string; question?: string }
export interface TroubleshootAnswer { step: string; answer: 'yes' | 'no' }
const defaults = { title: 'Troubleshoot', step: 'Step', question: 'Did this fix it?', yes: 'Yes', no: 'No', fixed: 'Fixed after {count} steps', fixedOne: 'Fixed after {count} step', fixedOther: 'Fixed after {count} steps', notFixed: 'Not fixed yet', report: 'Send report', restart: 'Start over', sent: 'Report sent', copy: 'Copy', copied: 'Copied', copyError: 'Could not copy', loading: 'Loading step', history: 'Previous steps', reportMessage: 'Troubleshooting "{title}": {result} {count}{steps} ({answers}).', fixedMessage: 'fixed at step', unresolvedMessage: 'not fixed after', stepsMessage: ' steps', answerSeparator: ' → ' };
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
    for (const field of ['title', 'command', 'yes', 'no', 'hint', 'question'] as const) if (typeof step[field] === 'string') result[key][field] = step[field];
  }
  return result;
}
function target(step: TroubleshootStep, answer: 'yes' | 'no') { return answer === 'yes' ? step.yes ?? '$fixed' : step.no; }
function reportMessage(title: unknown, resolved: boolean, path: TroubleshootAnswer[], count: string, strings = defaults) {
  return formatComponentMessage(strings.reportMessage, { title: String(title ?? strings.title), result: resolved ? strings.fixedMessage : strings.unresolvedMessage, count, steps: resolved ? '' : strings.stepsMessage, answers: path.map(entry => strings[entry.answer]).join(strings.answerSeparator) });
}
function breadcrumb(step: TroubleshootStep | undefined, fallback: string) {
  if (step?.title?.trim()) return step.title.trim();
  const sentence = step?.text.trim().split(/(?<=[.!?])\s/)[0] ?? fallback;
  const words = sentence.split(/\s+/);
  return words.length > 6 ? words.slice(0, 6).join(' ') + '…' : sentence;
}
export function useTroubleshoot(props: TroubleshootProps, ctx: PrismContextValue) {
  const component = useContext(ComponentContext), format = useFormat(), emit = useEmit();
  const [storedPath, setPath] = useComponentState<TroubleshootAnswer[]>('path', []), [sent, setSent] = useComponentState('sent', false);
  const steps = useMemo(() => validateSteps(props.steps), [props.steps]);
  const labels = { ...defaults, ...props.labels, ...useStrings('troubleshoot') }, themed = useTheme().theme.components.troubleshoot?.strings;
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
  const pluralRules = useMemo(() => new Intl.PluralRules(format.locale), [format.locale]);
  const plural = pluralRules.select(path.length) === 'one' ? 'fixedOne' : 'fixedOther';
  const resultLabel = themed?.[plural] ?? themed?.fixed ?? props.labels?.[plural] ?? props.labels?.fixed ?? labels[plural];
  const streamedKeys = props.steps && typeof props.steps === 'object' && !Array.isArray(props.steps) ? Object.keys(props.steps) : [];
  const currentReady = component?.node.complete !== false || !!(derived.current && streamedKeys.indexOf(derived.current) >= 0 && streamedKeys.indexOf(derived.current) < streamedKeys.length - 1);
  const readyTarget = (value: string | undefined) => value === '$fixed' || value === '$escalate' || !!(value && steps[value]?.text.trim() && streamedKeys.indexOf(value) < streamedKeys.length - 1);
  const ready = currentReady && !!derived.step?.text.trim() && (component?.node.complete !== false || (readyTarget(target(derived.step, 'yes')) && readyTarget(target(derived.step, 'no'))));
  const commandNode = useMemo<Node | undefined>(() => derived.step?.command ? Object.freeze({ type: 'code', key: `${component?.id}.cmd.${derived.current}`, lang: 'bash', value: derived.step.command, complete: true }) : undefined, [component?.id, derived.current, derived.step?.command]);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => { setCopyState('idle'); clearTimeout(timer.current); return () => clearTimeout(timer.current); }, [commandNode]);
  function edit(next: TroubleshootAnswer[]) { ctx.store.batch(() => { setPath(next); setSent(false); }); }
  function answer(value: 'yes' | 'no') { if (ready && !derived.ended && derived.current) edit([...path, { step: derived.current, answer: value }]); }
  function back(index = Math.max(0, path.length - 1)) { edit(path.slice(0, index)); }
  return { ...derived, path, sent, ready, labels, steps, commandNode, copyState, title: labels.title,
    question: derived.step?.question ?? (derived.step?.text.trim().endsWith('?') && /did (this|that|it) fix/i.test(derived.step.text) ? '' : labels.question),
    history: path.map(entry => ({ ...entry, label: breadcrumb(steps[entry.step], entry.step), fullText: steps[entry.step]?.text ?? entry.step })),
    loading: !derived.step?.text.trim() || (component?.node.complete === false && !ready),
    state: sent ? 'sent' : derived.ended ? derived.resolved ? 'resolved' : 'dead-end' : 'active',
    position: `${labels.step} ${format.number(path.length + 1)}`,
    result: derived.resolved ? formatComponentMessage(resultLabel, { count: format.number(path.length) }) : labels.notFixed,
    answer, back, restart() { edit([]); },
    report() { if (!derived.ended || sent) return; ctx.store.batch(() => { if (path.length !== storedPath.length) setPath(path); emit('troubleshoot', { resolved: derived.resolved, path }, reportMessage(labels.title, derived.resolved, path, format.number(path.length), labels)); setSent(true); }); },
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
export type TroubleshootModel = ReturnType<typeof useTroubleshoot>;
export interface TroubleshootSlotProps { troubleshoot: TroubleshootModel; answer?: TroubleshootModel['history'][number] }
export function TroubleshootSkeleton() {
  const root = usePart('troubleshoot', 'root'), skeleton = usePart('troubleshoot', 'skeleton');
  return <StreamSkeleton {...root}>{[0, 1, 2].map(index => <PrismPart as="div" {...skeleton} key={index} data-prism-skeleton-line="" />)}</StreamSkeleton>;
}
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
  const command = usePart('troubleshoot', 'command'), collapse = useCollapse(vm.path.length > 0);
  const empty = usePart('troubleshoot', 'empty'), skeleton = usePart('troubleshoot', 'skeleton');
  return <PrismPart slotProps={{ troubleshoot: vm } satisfies TroubleshootSlotProps} as="div" {...body} onKeyDown={vm.onKeyDown}><ComponentFrame component="troubleshoot" title={vm.title} state={vm.state} ask undo>
    {<PrismPart slotProps={{ troubleshoot: vm } satisfies TroubleshootSlotProps} as="div" {...history} {...collapse} style={{ ...history.style, ...collapse.style }} aria-label={vm.labels.history}>{vm.history.map((entry, index) => <PrismPart slotProps={{ troubleshoot: vm } satisfies TroubleshootSlotProps} as="div" {...item} key={`${index}.${entry.step}`}><PrismPart slotProps={{ troubleshoot: vm } satisfies TroubleshootSlotProps} as="button" {...ghost} type="button" onClick={() => vm.back(index)} aria-label={entry.fullText}><PrismPart slotProps={{ troubleshoot: vm } satisfies TroubleshootSlotProps} as="span" {...text}>{entry.label}</PrismPart><PrismPart slotProps={{ troubleshoot: vm } satisfies TroubleshootSlotProps} as="span" {...chip} data-state={entry.answer}>{vm.labels[entry.answer]}</PrismPart></PrismPart></PrismPart>)}</PrismPart>}
    {vm.ended ? <PrismPart slotProps={{ troubleshoot: vm } satisfies TroubleshootSlotProps} as="div" {...result} role="status"><PrismPart slotProps={{ troubleshoot: vm } satisfies TroubleshootSlotProps} as="h4" {...title}>{vm.result}</PrismPart>{vm.sent && <PrismPart slotProps={{ troubleshoot: vm } satisfies TroubleshootSlotProps} as="p" {...text}>{vm.labels.sent}</PrismPart>}<PrismPart slotProps={{ troubleshoot: vm } satisfies TroubleshootSlotProps} as="div" {...actions}><PrismPart slotProps={{ troubleshoot: vm } satisfies TroubleshootSlotProps} as="button" {...primary} type="button" onClick={vm.report} disabled={vm.sent}><Icon name={vm.sent ? "check" : "send"} />{vm.labels.report}</PrismPart><PrismPart slotProps={{ troubleshoot: vm } satisfies TroubleshootSlotProps} as="button" {...ghost} type="button" onClick={vm.restart}>{vm.labels.restart}</PrismPart></PrismPart></PrismPart> : <PrismPart slotProps={{ troubleshoot: vm } satisfies TroubleshootSlotProps} as="div" {...card}>
      <PrismPart slotProps={{ troubleshoot: vm } satisfies TroubleshootSlotProps} as="h4" {...title}><PrismPart slotProps={{ troubleshoot: vm } satisfies TroubleshootSlotProps} as="span" {...position} aria-live="polite">{vm.position}</PrismPart>{vm.step?.title}</PrismPart>
      {!vm.step || vm.loading ? <PrismPart slotProps={{ troubleshoot: vm } satisfies TroubleshootSlotProps} as="div" {...empty} aria-label={vm.labels.loading} role="status"><PrismPart slotProps={{ troubleshoot: vm } satisfies TroubleshootSlotProps} as="div" {...skeleton} aria-hidden="true" /></PrismPart> : <>
        <PrismPart slotProps={{ troubleshoot: vm } satisfies TroubleshootSlotProps} as="p" {...text}>{vm.step.text}</PrismPart>
        {vm.commandNode && <PrismPart slotProps={{ troubleshoot: vm } satisfies TroubleshootSlotProps} as="div" {...command} tabIndex={0}><Command node={vm.commandNode} /><PrismPart slotProps={{ troubleshoot: vm } satisfies TroubleshootSlotProps} as="button" {...ghost} type="button" onClick={vm.copy} aria-live="polite">{vm.copyState === 'copied' ? vm.labels.copied : vm.copyState === 'error' ? vm.labels.copyError : vm.labels.copy}</PrismPart></PrismPart>}
        {vm.step.hint && <PrismPart slotProps={{ troubleshoot: vm } satisfies TroubleshootSlotProps} as="p" {...hint}>{vm.step.hint}</PrismPart>}
      </>}
      {vm.question && <PrismPart slotProps={{ troubleshoot: vm } satisfies TroubleshootSlotProps} as="p" {...question}>{vm.question}</PrismPart>}<PrismPart slotProps={{ troubleshoot: vm } satisfies TroubleshootSlotProps} as="div" {...actions}><PrismPart slotProps={{ troubleshoot: vm } satisfies TroubleshootSlotProps} as="button" {...primary} type="button" disabled={!vm.ready} onClick={() => vm.answer('yes')} aria-keyshortcuts="Y">{vm.labels.yes}</PrismPart><PrismPart slotProps={{ troubleshoot: vm } satisfies TroubleshootSlotProps} as="button" {...ghost} type="button" disabled={!vm.ready} onClick={() => vm.answer('no')} aria-keyshortcuts="N">{vm.labels.no}</PrismPart></PrismPart>
    </PrismPart>}
  </ComponentFrame></PrismPart>;
}
const labelsSchema = s.object(Object.fromEntries(Object.entries(defaults).map(([key, value]) => [key, s.string().optional().describe(`Override the ${key} label${key.startsWith('fixed') ? '; {count} is the formatted step count' : ''}`).example(value)]))).optional().describe('Translated interface labels').example(defaults);
export const troubleshootDefinition = defineComponent({ name: 'troubleshoot', parts: ["actions","ask","body","chip","command","conversation","empty","ghost","header","hint","history","historyItem","position","primary","question","result","root","skeleton","step","stepTitle","text","title","toolbar","undo"], strings: defaults, schema: s.object({
  id: s.string().optional().describe('Persistent component state identifier').example('wifi'),
  title: s.string().optional().describe('Troubleshooting title').example('Wi-Fi drops'),
  start: s.string().describe('First step id').example('restart'),
  steps: s.any().describe('Record of step id to {title?: string, text: string, command?: string, yes?: string, no?: string, hint?: string, question?: string}. question overrides the default prompt. Targets are step ids, $fixed, or $escalate. Missing yes defaults to $fixed; missing or unknown no ends unresolved.').example({ restart: { text: 'Restart the Wi-Fi adapter.', command: 'nmcli radio wifi off && nmcli radio wifi on', yes: '$fixed', no: '$escalate' } }),
  labels: labelsSchema,
}), component: Troubleshooter, skeleton: TroubleshootSkeleton, syntax: 'fence', docs: 'A guided troubleshooting checklist with branching answers, editable history and a final report. Use Y/N to answer and Backspace or ArrowLeft to go back.', examples: ['```ui:troubleshoot\n{"id":"wifi","title":"Wi-Fi drops","start":"restart","steps":{"restart":{"text":"Restart the Wi-Fi adapter.","command":"nmcli radio wifi off && nmcli radio wifi on","yes":"$fixed","no":"$escalate"}}}\n```'],
  message(action) { if (action.type !== 'troubleshoot') return 'Tell me more about this troubleshooter…'; const payload = action.payload as { resolved: boolean; path: TroubleshootAnswer[] }; return reportMessage(action.context.props.title, payload.resolved, payload.path, String(payload.path.length)); },
});
registerComponent(troubleshootDefinition);
