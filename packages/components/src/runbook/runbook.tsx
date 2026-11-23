import { componentStrings, formatComponentMessage } from '../strings';
import { Children, createContext, isValidElement, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ComponentType } from 'react';
import type { Node } from '@prism-ui/core';
import { s } from '@prism-ui/schema';
import { useStrings, useCollapse, Icon, PrismPart, StreamSkeleton, ComponentContext, PrismContext, cx, defaultRenderers, defineComponent, registerComponent, useComponentState, useSent, useFormat, usePart, usePrism, type PrismComponentProps, type PrismContextValue } from '@prism-ui/react';
import { ComponentFrame } from '../frame';
import { SentContent } from '../shared/controls';

export interface RunbookLabels { title?: string; of?: string; progress?: string; stuck?: string; sent?: string; copy?: string; copied?: string; copyError?: string; loading?: string; stuckMessage?: string }
export interface RunbookProps { id?: string; title?: string; labels?: RunbookLabels }
export interface StepProps { id?: string; title?: string }
const defaults = { title: 'Runbook', of: 'of', progress: 'Progress', stuck: 'Stuck here?', sent: 'Sent', copy: 'Copy', copied: 'Copied', copyError: 'Could not copy', loading: 'Loading steps', stuckMessage: `I'm stuck on step {step} of "{title}": {text}.` };
function text(node: Node): string { return node.value ?? (node.children ?? []).map(text).join(node.type === 'paragraph' ? '' : '\n'); }
function codes(node: Node): Node[] { return node.type === 'code' ? [node] : (node.children ?? []).flatMap(codes); }
function stepKey(node: Node): string { return String(node.props?.id ?? node.key); }

export function useRunbook(props: RunbookProps, ctx: PrismContextValue) {
  const node = useContext(ComponentContext)?.node;
  const steps = useMemo(() => node?.children?.filter(child => child.type === 'component' && child.name === 'step') ?? [], [node]);
  const [done, setDone] = useComponentState<Record<string, boolean>>('done', {});
  const { sent, send, reset } = useSent(), format = useFormat();
  const previous = useRef(done);
  useLayoutEffect(() => {
    if (previous.current !== done) { previous.current = done; reset(); }
  }, [done, reset]);
  const labels = { ...defaults, ...props.labels, ...useStrings('runbook') };
  const count = useMemo(() => steps.filter(step => done[stepKey(step)]).length, [steps, done]);
  const current = useMemo(() => steps.findIndex(step => !done[stepKey(step)]), [steps, done]);
  return useMemo(() => ({ steps, done, current, count, labels, sent, title: labels.title, animate: ctx.animate,
    complete: steps.length > 0 && count === steps.length,
    progress: `${format.number(count)} ${labels.of} ${format.number(steps.length)}`,
    toggle(key: string) { if (steps.some(step => stepKey(step) === key && step.complete === false)) return; setDone(old => ({ ...old, [key]: !old[key] })); },
    stuck(step: Node, index: number, title: string) { if (step.complete === false) return; send('stuck', { step: stepKey(step), index, title, text: text(step), done: !!done[stepKey(step)] }, formatComponentMessage(labels.stuckMessage, { step: format.number(index + 1), title: labels.title, text: title })); },
  }), [steps, done, current, count, labels, sent, props.title, ctx.animate, format, setDone, send]);
}
const RunbookContext = createContext<ReturnType<typeof useRunbook> | null>(null);
export type RunbookModel = ReturnType<typeof useRunbook>;
export type StepModel = ReturnType<typeof useStep>;
export interface RunbookSlotProps { runbook: RunbookModel }
export interface StepSlotProps { step: StepModel }
export function RunbookSkeleton() {
  const root = usePart('runbook', 'root'), skeleton = usePart('runbook', 'skeleton');
  return <StreamSkeleton {...root}>{[0, 1, 2].map(index => <PrismPart as="div" {...skeleton} key={index} data-prism-skeleton-line="" />)}</StreamSkeleton>;
}
export function Runbook(input: PrismComponentProps<RunbookProps>) {
  return <RunbookView {...input} />;
}
function RunbookView({ props, children }: PrismComponentProps<RunbookProps>) {
  const vm = useRunbook(props, usePrism());
  const streaming = useContext(ComponentContext)?.node.complete === false;
  const content = streaming ? Children.toArray(children).filter(child => isValidElement<{ node: Node }>(child) && child.props.node?.type === 'component' && child.props.node.name === 'step') : children;
  const progress = usePart('runbook', 'progress'), track = usePart('runbook', 'track'), fill = usePart('runbook', 'fill'), status = usePart('runbook', 'status');
  const empty = usePart('runbook', 'empty'), skeleton = usePart('runbook', 'skeleton');
  return <RunbookContext.Provider value={vm}><ComponentFrame component="runbook" title={vm.title} state={vm.complete ? 'complete' : 'active'} ask undo toolbar={<PrismPart slotProps={{ runbook: vm } satisfies RunbookSlotProps} as="div" {...progress}>
    <PrismPart slotProps={{ runbook: vm } satisfies RunbookSlotProps} as="span" {...status} aria-live="polite">{vm.progress}</PrismPart><PrismPart slotProps={{ runbook: vm } satisfies RunbookSlotProps} as="div" {...track} role="progressbar" aria-label={vm.labels.progress} aria-valuemin={0} aria-valuenow={vm.count} aria-valuemax={vm.steps.length}><PrismPart slotProps={{ runbook: vm } satisfies RunbookSlotProps} as="div" {...fill} style={{ ...fill.style, width: '100%', transform: `scaleX(${vm.steps.length ? vm.count / vm.steps.length : 0})` }} /></PrismPart>
  </PrismPart>}>{vm.steps.length === 0 && <PrismPart slotProps={{ runbook: vm } satisfies RunbookSlotProps} as="div" {...empty} role="status" aria-label={vm.labels.loading}><PrismPart slotProps={{ runbook: vm } satisfies RunbookSlotProps} as="div" {...skeleton} aria-hidden="true" /></PrismPart>}{content}</ComponentFrame></RunbookContext.Provider>;
}
export function useStep(props: StepProps, ctx: PrismContextValue, node: Node) {
  const book = useContext(RunbookContext), format = useFormat();
  const index = book?.steps.findIndex(step => step.key === node.key) ?? -1;
  const done = !!book?.done[stepKey(node)], labels = book?.labels ?? defaults;
  const commandNodes = useMemo(() => codes(node), [node]);
  const commands = useMemo(() => commandNodes.map(node => node.value ?? '').join('\n').replace(/^\$ /gm, ''), [commandNodes]);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'error'>('idle');
  const sent = book?.sent?.type === 'stuck' && (book.sent.payload as { step?: string } | undefined)?.step === stepKey(node);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  return { index, done, labels, title: props.title, animate: ctx.animate, commands, commandNodes, copyState, sent, disabled: node.complete === false,
    number: index < 0 ? '' : format.number(index + 1), state: done ? 'done' : index >= 0 && book?.current === index ? 'current' : 'todo',
    toggle() { if (node.complete !== false) book?.toggle(stepKey(node)); }, stuck() { if (node.complete !== false) book?.stuck(node, index, props.title ?? ''); },
    onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
      if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); if (node.complete !== false) book?.toggle(stepKey(node)); }
      if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
        event.preventDefault(); const buttons = event.currentTarget.closest('[data-prism="runbook"][data-part="root"]')?.querySelectorAll<HTMLButtonElement>('[data-part="check"]');
        buttons?.[Math.max(0, Math.min(buttons.length - 1, index + (event.key === 'ArrowDown' ? 1 : -1)))]?.focus();
      }
    },
    async copy(command = commands) {
      clearTimeout(timer.current);
      try { await navigator.clipboard.writeText(command.replace(/^\$ /gm, '')); setCopyState('copied'); } catch { setCopyState('error'); }
      timer.current = setTimeout(() => setCopyState('idle'), 1500);
    },
  };
}
const StepCommandContext = createContext<{ step: StepModel; View: ComponentType<any> } | null>(null);
function StepCommand(input: PrismComponentProps) {
  const { step: vm, View } = useContext(StepCommandContext)!;
  const command = usePart('runbook', 'command'), copy = usePart('runbook', 'copy');
  if (!vm.commandNodes.some(node => node.key === input.node.key)) return <View {...input} />;
  return <PrismPart as="div" {...command} slotProps={{ step: vm } satisfies StepSlotProps} tabIndex={0}><View {...input} /><PrismPart slotProps={{ step: vm } satisfies StepSlotProps} as="button" {...copy} type="button" onClick={() => vm.copy(input.node.value ?? '')} aria-live="polite">{vm.copyState === 'copied' ? vm.labels.copied : vm.copyState === 'error' ? vm.labels.copyError : vm.labels.copy}</PrismPart></PrismPart>;
}
export function Step({ props, node, children, complete }: PrismComponentProps<StepProps>) {
  const themeStrings = useStrings('runbook', componentStrings.runbook);
  const context = usePrism(), inherited = useContext(StepCommandContext);
  const vm = useStep(props, context, node);
  const definition = context.registry.get('code'), renderer = context.components.code ?? definition?.component ?? defaultRenderers.code;
  const View = renderer === StepCommand ? inherited!.View : renderer;
  const scoped = useMemo(() => context.components.code || !definition?.component
    ? { ...context, components: { ...context.components, code: StepCommand } }
    : { ...context, registry: { ...context.registry, get(name: string) { const def = context.registry.get(name); return name === 'code' && def ? { ...def, component: StepCommand } : def; } } }, [context, definition]);
  const root = usePart('runbook', 'step', vm.state), header = usePart('runbook', 'stepHeader'), badge = usePart('runbook', 'check', vm.state), title = usePart('runbook', 'stepTitle', props.title ? undefined : 'loading'), body = usePart('runbook', 'stepBody', vm.state), actions = usePart('runbook', 'actions'), stuck = usePart('runbook', 'stuck');
  const placeholder = usePart('runbook', 'stepPlaceholder'), collapse = useCollapse(!vm.done);
  return <PrismPart slotProps={{ step: vm } satisfies StepSlotProps} as="div" {...root} data-complete={complete} data-numbered={vm.index >= 0}><PrismPart slotProps={{ step: vm } satisfies StepSlotProps} as="div" {...header}>
    {vm.index >= 0 && <PrismPart slotProps={{ step: vm } satisfies StepSlotProps} as="button" {...badge} type="button" role="checkbox" aria-checked={vm.done} aria-disabled={vm.disabled} disabled={vm.disabled} aria-label={props.title ?? vm.number} onClick={vm.toggle} onKeyDown={vm.onKeyDown} data-streaming={!complete}>{vm.done ? <Icon name="check" /> : vm.number}</PrismPart>}
    <PrismPart slotProps={{ step: vm } satisfies StepSlotProps} as="h4" {...title}>{vm.title ?? <PrismPart slotProps={{ step: vm } satisfies StepSlotProps} as="span" {...placeholder} aria-hidden="true">{themeStrings.nbsp}</PrismPart>}</PrismPart>
  <PrismPart slotProps={{ step: vm } satisfies StepSlotProps} as="div" {...actions}>
    {vm.index >= 0 && <PrismPart slotProps={{ step: vm } satisfies StepSlotProps} as="button" {...stuck} className={cx(stuck.className, !context.unstyled && 'prism-pill')} data-variant="secondary" data-feedback="" data-sent={vm.sent ? '' : undefined} type="button" disabled={vm.disabled || vm.sent} aria-disabled={vm.disabled || vm.sent} onClick={vm.stuck}><SentContent sent={vm.sent} receipt={vm.labels.sent}>{vm.labels.stuck}</SentContent></PrismPart>}
  </PrismPart></PrismPart><PrismPart slotProps={{ step: vm } satisfies StepSlotProps} as="div" {...body} {...collapse} style={{ ...body.style, ...collapse.style }}><StepCommandContext.Provider value={{ step: vm, View }}><PrismContext.Provider value={scoped}>{children}</PrismContext.Provider></StepCommandContext.Provider></PrismPart></PrismPart>;
}
const labelsSchema = s.object({
  title: s.string().optional().describe('Default runbook title').example('Runbook'),
  of: s.string().optional().describe('Progress separator').example('of'),
  progress: s.string().optional().describe('Progress accessible label').example('Progress'),
  stuck: s.string().optional().describe('Help action label').example('Stuck here?'),
  sent: s.string().optional().describe('Help receipt label').example('Sent'),
  copy: s.string().optional().describe('Copy commands label').example('Copy'),
  copied: s.string().optional().describe('Copy success label').example('Copied'),
  copyError: s.string().optional().describe('Copy failure label').example('Could not copy'),
  loading: s.string().optional().describe('Empty streaming label').example('Loading steps'),
  stuckMessage: s.string().optional().describe('Help message with {step}, {title} and {text} placeholders'),
}).optional().describe('Translated interface labels').example(defaults);
export const runbookDefinition = defineComponent({ name: 'runbook', parts: ["command","actions","ask","body","check","copy","empty","fill","header","progress","root","skeleton","status","step","stepBody","stepHeader","stepTitle","stepPlaceholder","stuck","title","toolbar","track","undo"], strings: { ...defaults, ...componentStrings.runbook }, schema: s.object({ id: s.string().optional().describe('Persistent state identifier').example('deploy'), title: s.string().optional().describe('Runbook title').example('Deploy to Fly'), labels: labelsSchema }), component: Runbook, skeleton: RunbookSkeleton,
  docs: 'A checklist of steps with progress, command copying and contextual help. Use a four-colon outer fence around three-colon steps.', syntax: 'container', examples: ['::::runbook{title="Deploy to Fly" id=deploy}\n:::step{title="Install the CLI"}\nRun:\n```bash\ncurl -L https://fly.io/install.sh | sh\n```\n:::\n:::step{title="Log in"}\nRun fly auth login.\n:::\n::::'],
  message(action) { if (action.type !== 'stuck') return `Tell me more about this runbook…`; const payload = action.payload as { index: number; title: string }; return `I'm stuck on step ${new Intl.NumberFormat().format(payload.index + 1)} of "${action.context.props.title ?? 'Runbook'}": ${payload.title}.`; },
});
export const stepDefinition = defineComponent({ name: 'step', parts: ["command","actions","check","copy","step","stepBody","stepHeader","stepTitle","stepPlaceholder","stuck"], strings: componentStrings.runbook, schema: s.object({ title: s.string().describe('Step title').example('Log in'), id: s.string().optional().describe('Stable step identifier').example('login') }), component: Step, docs: 'A runbook step with a normal Markdown body. Also works outside a runbook.', syntax: 'container', examples: [':::step{title="Log in" id=login}\nRun fly auth login.\n:::'] });
registerComponent(runbookDefinition);
registerComponent(stepDefinition);
