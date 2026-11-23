import { PrismPart, usePart, useSlot } from '@prism-ui/react';
import { forwardRef, useLayoutEffect, useRef, useState, type ElementType, type HTMLAttributes } from 'react';
import { FrameOverflow } from '../frame';
import { Pill, type PillProps } from '../shared/controls';
import { MockupIcon as Icon } from './icon';
import type { MockupGroupModel } from './group';
import type { MockupModel } from './use-mockup';
import { mockupLabels } from './use-mockup';

const Box = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement> & { model?: unknown }>(function Box({ model, ...props }, ref) { return <div {...props} ref={ref} />; });
function FeedbackPill({ model, as, ...props }: PillProps & { model?: unknown; as?: ElementType }) { return <Pill {...props} />; }
export function MockupToolbar({ vm, model }: { model: MockupModel | MockupGroupModel; vm: Pick<MockupModel, 'labels' | 'framed' | 'device' | 'setDevice' | 'zoom' | 'setZoom' | 'fullscreen' | 'showSource' | 'setShowSource' | 'tool' | 'setTool' | 'color' | 'setColor'> }) {
  const actions = usePart('mockup', 'headerActions'), toolbar = usePart('mockup', 'tools'), button = usePart('mockup', 'button'), Actions = useSlot('mockup', 'headerActions', Box);
  const root = useRef<HTMLDivElement>(null), [narrow, setNarrow] = useState(false);
  useLayoutEffect(() => {
    const container = root.current?.closest('.prism-mockup__root, .prism-mockup__group');
    if (!container) return;
    const width = container.getBoundingClientRect().width;
    if (width) setNarrow(width <= 360);
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(entries => { const width = entries[0]?.contentRect.width; if (width) setNarrow(width <= 360); });
    observer.observe(container);
    return () => observer.disconnect();
  }, []);
  return <Actions {...actions} ref={root} model={model} className={[toolbar.className, actions.className].filter(Boolean).join(' ')}>
    <MockupPenTools vm={vm} model={model} colors={false} />
    {!narrow && <SecondaryTools vm={vm} model={model} location="toolbar" />}
    <FrameOverflow component="mockup" model={model}>{narrow && <SecondaryTools vm={vm} model={model} location="overflow" />}{vm.framed && <PrismPart slotProps={{ model }} as="button" {...button} aria-label={vm.labels.tablet} title={vm.labels.tablet} aria-pressed={vm.device === 'tablet'} onClick={() => vm.setDevice('tablet')}><Icon name="tablet" /></PrismPart>}<PrismPart slotProps={{ model }} as="button" {...button} title={vm.labels.fullscreen} aria-label={vm.labels.fullscreen} onClick={vm.fullscreen}><Icon name="fullscreen" /></PrismPart><PrismPart slotProps={{ model }} as="button" {...button} title={vm.labels.source} aria-label={vm.labels.source} aria-pressed={vm.showSource} onClick={() => vm.setShowSource(!vm.showSource)}><Icon name="source" /></PrismPart></FrameOverflow>
  </Actions>;
}
function SecondaryTools({ vm, model, location }: Parameters<typeof MockupToolbar>[0] & { location: 'toolbar' | 'overflow' }) {
  const part = usePart('mockup', 'secondaryTools'), devices = usePart('mockup', 'devices'), button = usePart('mockup', 'button');
  return <PrismPart as="span" {...part} slotProps={{ model }} data-location={location}>
    {vm.tool === 'draw' && ['var(--prism-mockup-accent, var(--prism-accent))', 'var(--prism-danger)', 'var(--prism-positive)', 'var(--prism-warning)'].map((color, i) => <PrismPart slotProps={{ model }} as="button" key={color} {...button} title={vm.labels.colorOption.replace('{n}', String(i + 1))} aria-label={vm.labels.colorOption.replace('{n}', String(i + 1))} aria-pressed={vm.color === color} onClick={() => vm.setColor(color)} style={{ ...button.style, color }}><Icon name="circle" /></PrismPart>)}
    {vm.framed && <PrismPart slotProps={{ model }} as="span" {...devices} role="group" aria-label={vm.labels.devices}>{(['desktop', 'mobile'] as const).map(device => <PrismPart slotProps={{ model }} as="button" key={device} {...button} aria-label={vm.labels[device]} title={vm.labels[device]} aria-pressed={vm.device === device} onClick={() => vm.setDevice(device)}><Icon name={device} /></PrismPart>)}</PrismPart>}
    <PrismPart slotProps={{ model }} as="button" {...button} aria-label={vm.labels.zoomOut} title={vm.labels.zoomOut} disabled={vm.zoom <= .5} onClick={() => vm.setZoom(Math.max(.5, vm.zoom - .25))}><Icon name="minus" /></PrismPart><PrismPart slotProps={{ model }} as="button" {...button} title={vm.labels.fit} onClick={() => vm.setZoom(1)}>{vm.zoom === 1 ? vm.labels.fit : `${Math.round(vm.zoom * 100)}%`}</PrismPart><PrismPart slotProps={{ model }} as="button" {...button} aria-label={vm.labels.zoomIn} title={vm.labels.zoomIn} disabled={vm.zoom >= 2} onClick={() => vm.setZoom(Math.min(2, vm.zoom + .25))}><Icon name="plus" /></PrismPart>
  </PrismPart>;
}
export function MockupPenTools({ vm, model, colors = true }: { model: MockupModel | MockupGroupModel; colors?: boolean; vm: Pick<MockupModel, 'labels' | 'tool' | 'setTool' | 'color' | 'setColor'> }) {
  const label = usePart('mockup', 'toolLabel'), toolbar = usePart('mockup', 'tools'), button = usePart('mockup', 'button'), group = usePart('mockup', 'toolGroup'), tool = usePart('mockup', 'tool');
  return <PrismPart slotProps={{ model }} as="span" {...toolbar}>
    <PrismPart slotProps={{ model }} as="span" {...group} role="group" aria-label={vm.labels.toolGroup}>{(['pin', 'region', 'draw'] as const).map((value, i) => <PrismPart slotProps={{ model }} as="button" key={value} {...tool} type="button" data-prism-press="" aria-label={vm.labels[value]} aria-pressed={vm.tool === value} aria-keyshortcuts={['P', 'R', 'D'][i]} title={vm.labels.toolShortcut.replace('{tool}', vm.labels[value]).replace('{key}', ['P', 'R', 'D'][i])} onClick={() => vm.setTool(value)}><Icon name={value === 'draw' ? 'pen' : value} /><PrismPart as="span" {...label} slotProps={{ model }} aria-hidden="true">{vm.labels[value]}</PrismPart></PrismPart>)}</PrismPart>
    {colors && vm.tool === 'draw' && ['var(--prism-mockup-accent, var(--prism-accent))', 'var(--prism-danger)', 'var(--prism-positive)', 'var(--prism-warning)'].map((color, i) => <PrismPart slotProps={{ model }} as="button" key={color} {...button} title={vm.labels.colorOption.replace('{n}', String(i + 1))} aria-label={vm.labels.colorOption.replace('{n}', String(i + 1))} aria-pressed={vm.color === color} onClick={() => vm.setColor(color)} style={{ ...button.style, color }}><Icon name="circle" /></PrismPart>)}
  </PrismPart>;
}
export function MockupSource({ vm, model }: { model: MockupModel | MockupGroupModel; vm: Pick<MockupModel, 'labels' | 'source' | 'copy'> }) {
  const source = usePart('mockup', 'source'), button = usePart('mockup', 'button');
  return <PrismPart slotProps={{ model }} as="div" {...source}><PrismPart slotProps={{ model }} as="button" {...button} onClick={vm.copy}>{vm.labels.copy}</PrismPart><PrismPart slotProps={{ model }} as="pre" {...usePart('mockup', 'sourceCode')}>{vm.source}</PrismPart></PrismPart>;
}
export function commentCount(labels: MockupModel['labels'], locale: string | undefined, n: number, sent = false) {
  const one = new Intl.PluralRules(locale).select(n) === 'one';
  return labels[sent ? one ? 'sentOne' : 'sentOther' : one ? 'countOne' : 'countOther'].replace('{n}', String(n));
}
export interface MockupFooterModel {
  model?: MockupModel | MockupGroupModel;
  labels: MockupModel['labels']; locale?: string; count: number; submitted: boolean; edit(): void;
  canUndo: boolean; canRedo: boolean; undo(): void; redo(): void; canSubmit: boolean; submit(): void;
  commitOverall?(): void;
}
export function MockupFooter(vm: MockupFooterModel) {
  const model = vm.model ?? vm;
  const { labels, locale, count, submitted, edit, canUndo, canRedo, undo, redo, canSubmit, submit } = vm;
  const countPart = usePart('mockup', 'count');
  const footer = usePart('mockup', 'feedbackFooter'), button = usePart('mockup', 'button'), primary = usePart('mockup', 'primary');
  const Primary = useSlot('mockup', 'primary', FeedbackPill);
  const one = new Intl.PluralRules(locale).select(count) === 'one';
  const sendKey = one ? 'sendOne' : 'sendOther';
  const ready = (labels[sendKey] !== mockupLabels[sendKey] ? labels[sendKey] : labels.submit !== mockupLabels.submit ? labels.submit : labels[sendKey]).replace('{n}', String(count));
  const oldReceipt = labels[one ? 'sentOne' : 'sentOther'];
  const receipt = oldReceipt !== mockupLabels[one ? 'sentOne' : 'sentOther'] ? oldReceipt.replace('{n}', String(count)) : labels[one ? 'receiptOne' : 'receiptOther'].replace('{n}', String(count));
  return <PrismPart slotProps={{ model }} as="span" {...footer} role={submitted ? 'status' : undefined}>
    <PrismPart slotProps={{ model }} as="button" {...button} hidden={submitted} data-secondary="" disabled={!canUndo} onClick={undo}><Icon name="undo" />{labels.undo}</PrismPart>
    <PrismPart slotProps={{ model }} as="button" {...button} hidden={submitted} data-secondary="" disabled={!canRedo} onClick={redo}><Icon name="redo" />{labels.redo}</PrismPart>
    <PrismPart slotProps={{ model }} as="span" {...countPart} hidden aria-hidden="true">{commentCount(labels, locale, count)}</PrismPart>
    <Primary model={model} as="button" {...primary} data-feedback-submit="" data-sent={submitted ? '' : undefined} sent={submitted} receipt={receipt} aria-label={submitted ? receipt : ready} disabled={submitted || !canSubmit} aria-disabled={submitted || !canSubmit} onBlur={() => vm.commitOverall?.()} onClick={submit}>{ready}</Primary>
    {submitted && <PrismPart slotProps={{ model }} as="button" {...button} onClick={edit}>{labels.editFeedback}</PrismPart>}
  </PrismPart>;
}
