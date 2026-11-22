import { createContext, useContext, useEffect, useMemo, useRef, useState, type HTMLAttributes, type KeyboardEvent } from 'react';
import type { Node } from '@prism-ui/core';
import { s } from '@prism-ui/schema';
import { ComponentContext, defineComponent, registerComponent, useComponentState, useEmit, useFormat, usePart, usePrism, useSlot, type PrismComponentProps, type PrismContextValue } from '@prism-ui/react';
import { ComponentFrame } from '../frame';

export interface RunbookLabels { title?: string; of?: string; progress?: string; stuck?: string; copy?: string; copied?: string; copyError?: string; loading?: string }
export interface RunbookProps { id?: string; title?: string; labels?: RunbookLabels }
export interface StepProps { id?: string; title?: string }
const defaults = { title: 'Runbook', of: 'of', progress: 'Progress', stuck: 'Stuck here?', copy: 'Copy', copied: 'Copied', copyError: 'Could not copy', loading: 'Loading steps' };
function text(node: Node): string { return node.value ?? (node.children ?? []).map(text).join(node.type === 'paragraph' ? '' : '\n'); }
function codes(node: Node): string[] { return node.type === 'code' ? [node.value ?? ''] : (node.children ?? []).flatMap(codes); }
function stepKey(node: Node): string { return String(node.props?.id ?? node.key); }

export function useRunbook(props: RunbookProps, ctx: PrismContextValue) {
  const node = useContext(ComponentContext)?.node;
  const steps = useMemo(() => node?.children?.filter(child => child.type === 'component' && child.name === 'step') ?? [], [node]);
  const [done, setDone] = useComponentState<Record<string, boolean>>('done', {});
  const emit = useEmit(), format = useFormat();
  const labels = useMemo(() => ({ ...defaults, ...props.labels }), [props.labels]);
  const count = useMemo(() => steps.filter(step => done[stepKey(step)]).length, [steps, done]);
  const current = useMemo(() => steps.findIndex(step => !done[stepKey(step)]), [steps, done]);
  return useMemo(() => ({ steps, done, current, count, labels, title: props.title ?? labels.title, animate: ctx.animate,
    complete: steps.length > 0 && count === steps.length,
    progress: `${format.number(count)} ${labels.of} ${format.number(steps.length)}`,
    toggle(key: string) { setDone(old => ({ ...old, [key]: !old[key] })); },
    stuck(step: Node, index: number, title: string) { emit('stuck', { step: stepKey(step), index, title, text: text(step), done: !!done[stepKey(step)] }); },
  }), [steps, done, current, count, labels, props.title, ctx.animate, format, setDone, emit]);
}
const RunbookContext = createContext<ReturnType<typeof useRunbook> | null>(null);
function Box(props: HTMLAttributes<HTMLDivElement>) { return <div {...props} />; }
function Empty(props: HTMLAttributes<HTMLDivElement>) { const root = usePart('runbook', 'empty'), part = usePart('runbook', 'skeleton'); return <div {...root} {...props} role="status">{[0, 1, 2].map(key => <div key={key} {...part} aria-hidden="true" />)}</div>; }
export function Runbook(input: PrismComponentProps<RunbookProps>) {
  return <RunbookView {...input} />;
}
function RunbookView({ props, children }: PrismComponentProps<RunbookProps>) {
  const vm = useRunbook(props, usePrism());
  const progress = usePart('runbook', 'progress'), track = usePart('runbook', 'track'), fill = usePart('runbook', 'fill'), status = usePart('runbook', 'status');
  const EmptyState = useSlot('runbook', 'empty', Empty);
  return <RunbookContext.Provider value={vm}><ComponentFrame component="runbook" title={vm.title} state={vm.complete ? 'complete' : 'active'} ask undo toolbar={<div {...progress}>
    <span {...status} aria-live="polite">{vm.progress}</span><div {...track} role="progressbar" aria-label={vm.labels.progress} aria-valuemin={0} aria-valuenow={vm.count} aria-valuemax={vm.steps.length}><div {...fill} style={{ ...fill.style, width: `${vm.steps.length ? vm.count / vm.steps.length * 100 : 0}%` }} /></div>
  </div>}>{vm.steps.length === 0 && <EmptyState aria-label={vm.labels.loading} />}{children}</ComponentFrame></RunbookContext.Provider>;
}
export function useStep(props: StepProps, ctx: PrismContextValue, node: Node) {
  const book = useContext(RunbookContext), format = useFormat();
  const index = book?.steps.findIndex(step => step.key === node.key) ?? -1;
  const done = !!book?.done[stepKey(node)], labels = book?.labels ?? defaults;
  const commands = useMemo(() => codes(node).join('\n').replace(/^\$ /gm, ''), [node]);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return { index, done, labels, title: props.title, animate: ctx.animate, commands, copyState,
    number: index < 0 ? '' : format.number(index + 1), state: done ? 'done' : index >= 0 && book?.current === index ? 'current' : 'todo',
    toggle() { book?.toggle(stepKey(node)); }, stuck() { book?.stuck(node, index, props.title ?? ''); },
    onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
      if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); book?.toggle(stepKey(node)); }
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        event.preventDefault(); const buttons = event.currentTarget.closest('[data-prism="runbook"][data-part="root"]')?.querySelectorAll<HTMLButtonElement>('[data-part="check"]');
        buttons?.[Math.max(0, Math.min(buttons.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)))]?.focus();
      }
    },
    async copy() {
      clearTimeout(timer.current);
      try { await navigator.clipboard.writeText(commands); setCopyState('copied'); } catch { setCopyState('error'); }
      timer.current = setTimeout(() => setCopyState('idle'), 1500);
    },
  };
}
export function Step({ props, node, children, complete }: PrismComponentProps<StepProps>) {
  const vm = useStep(props, usePrism(), node);
  const root = usePart('runbook', 'step', vm.state), header = usePart('runbook', 'stepHeader'), badge = usePart('runbook', 'check', vm.state), title = usePart('runbook', 'stepTitle', props.title ? undefined : 'loading'), body = usePart('runbook', 'stepBody', vm.state), actions = usePart('runbook', 'actions'), copy = usePart('runbook', 'copy'), stuck = usePart('runbook', 'stuck');
  const Item = useSlot('runbook', 'step', Box), Actions = useSlot('runbook', 'actions', Box);
  return <Item {...root} data-complete={complete} data-numbered={vm.index >= 0}><div {...header}>
    {vm.index >= 0 && <button {...badge} type="button" role="checkbox" aria-checked={vm.done} aria-label={props.title ?? vm.number} onClick={vm.toggle} onKeyDown={vm.onKeyDown} data-streaming={!complete}>{vm.done ? <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="m3 8 3 3 7-7" /></svg> : vm.number}</button>}
    <h4 {...title}>{vm.title ?? <span aria-hidden="true">&nbsp;</span>}</h4>
  </div><div {...body}>{children}</div><Actions {...actions}>
    {vm.commands && <button {...copy} type="button" onClick={vm.copy} aria-live="polite">{vm.copyState === 'copied' ? vm.labels.copied : vm.copyState === 'error' ? vm.labels.copyError : vm.labels.copy}</button>}
    {vm.index >= 0 && <button {...stuck} type="button" onClick={vm.stuck}>{vm.labels.stuck}</button>}
  </Actions></Item>;
}
const labelsSchema = s.object({
  title: s.string().optional().describe('Default runbook title').example('Runbook'),
  of: s.string().optional().describe('Progress separator').example('of'),
  progress: s.string().optional().describe('Progress accessible label').example('Progress'),
  stuck: s.string().optional().describe('Help action label').example('Stuck here?'),
  copy: s.string().optional().describe('Copy commands label').example('Copy'),
  copied: s.string().optional().describe('Copy success label').example('Copied'),
  copyError: s.string().optional().describe('Copy failure label').example('Could not copy'),
  loading: s.string().optional().describe('Empty streaming label').example('Loading steps'),
}).optional().describe('Translated interface labels').example(defaults);
export const runbookDefinition = defineComponent({ name: 'runbook', schema: s.object({ id: s.string().optional().describe('Persistent state identifier').example('deploy'), title: s.string().optional().describe('Runbook title').example('Deploy to Fly'), labels: labelsSchema }), component: Runbook,
  docs: 'A checklist of steps with progress, command copying and contextual help. Use a four-colon outer fence around three-colon steps.', syntax: 'container', examples: ['::::runbook{title="Deploy to Fly" id=deploy}\n:::step{title="Install the CLI"}\nRun:\n```bash\ncurl -L https://fly.io/install.sh | sh\n```\n:::\n:::step{title="Log in"}\nRun fly auth login.\n:::\n::::'],
  message(action) { if (action.type !== 'stuck') return `Tell me more about this runbook…`; const payload = action.payload as { index: number; title: string }; return `I'm stuck on step ${new Intl.NumberFormat().format(payload.index + 1)} of "${action.context.props.title ?? 'Runbook'}": ${payload.title}.`; },
});
export const stepDefinition = defineComponent({ name: 'step', schema: s.object({ title: s.string().describe('Step title').example('Log in'), id: s.string().optional().describe('Stable step identifier').example('login') }), component: Step, docs: 'A runbook step with a normal Markdown body. Also works outside a runbook.', syntax: 'container', examples: [':::step{title="Log in" id=login}\nRun fly auth login.\n:::'] });
registerComponent(runbookDefinition);
registerComponent(stepDefinition);
