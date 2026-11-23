import { PrismPart, usePart, useSlot } from '@prism-ui/react';
import type { ElementType, HTMLAttributes } from 'react';
import { FrameOverflow } from '../frame';
import { Pill, type PillProps } from '../shared/controls';
import { MockupIcon as Icon } from './icon';
import type { MockupGroupModel } from './group';
import type { MockupModel } from './use-mockup';

function Box({ model, ...props }: HTMLAttributes<HTMLDivElement> & { model?: unknown }) { return <div {...props} />; }
function FeedbackPill({ model, as, ...props }: PillProps & { model?: unknown; as?: ElementType }) { return <Pill {...props} />; }
export function MockupToolbar({ vm, model }: { model: MockupModel | MockupGroupModel; vm: Pick<MockupModel, 'labels' | 'framed' | 'device' | 'setDevice' | 'zoom' | 'setZoom' | 'fullscreen' | 'showSource' | 'setShowSource' | 'pen' | 'setPen' | 'color' | 'setColor'> }) {
  const devices = usePart('mockup', 'devices'), actions = usePart('mockup', 'headerActions');
  const toolbar = usePart('mockup', 'tools'), button = usePart('mockup', 'button'), Actions = useSlot('mockup', 'headerActions', Box);
  return <Actions {...actions} model={model} data-prism-reveal="" className={[toolbar.className, actions.className].filter(Boolean).join(' ')}>
    {vm.framed && <PrismPart slotProps={{ model }} as="div" {...devices} role="group" aria-label={vm.labels.devices}>{(['desktop', 'mobile'] as const).map(device => <PrismPart slotProps={{ model }} as="button" key={device} {...button} aria-label={vm.labels[device]} title={vm.labels[device]} aria-pressed={vm.device === device} onClick={() => vm.setDevice(device)}><Icon name={device} /></PrismPart>)}</PrismPart>}
    <PrismPart slotProps={{ model }} as="button" {...button} aria-label={vm.labels.zoomOut} title={vm.labels.zoomOut} disabled={vm.zoom <= .5} onClick={() => vm.setZoom(Math.max(.5, vm.zoom - .25))}><Icon name="minus" /></PrismPart><PrismPart slotProps={{ model }} as="button" {...button} title={vm.labels.fit} onClick={() => vm.setZoom(1)}>{vm.zoom === 1 ? vm.labels.fit : `${Math.round(vm.zoom * 100)}%`}</PrismPart><PrismPart slotProps={{ model }} as="button" {...button} aria-label={vm.labels.zoomIn} title={vm.labels.zoomIn} disabled={vm.zoom >= 2} onClick={() => vm.setZoom(Math.min(2, vm.zoom + .25))}><Icon name="plus" /></PrismPart>
    <FrameOverflow component="mockup" model={model}>{vm.framed && <PrismPart slotProps={{ model }} as="button" {...button} aria-label={vm.labels.tablet} title={vm.labels.tablet} aria-pressed={vm.device === 'tablet'} onClick={() => vm.setDevice('tablet')}><Icon name="tablet" /></PrismPart>}<MockupPenTools vm={vm} model={model} /><PrismPart slotProps={{ model }} as="button" {...button} title={vm.labels.fullscreen} aria-label={vm.labels.fullscreen} onClick={vm.fullscreen}><Icon name="fullscreen" /></PrismPart><PrismPart slotProps={{ model }} as="button" {...button} title={vm.labels.source} aria-label={vm.labels.source} aria-pressed={vm.showSource} onClick={() => vm.setShowSource(!vm.showSource)}><Icon name="source" /></PrismPart></FrameOverflow>
  </Actions>;
}
export function MockupPenTools({ vm, model }: { model: MockupModel | MockupGroupModel; vm: Pick<MockupModel, 'labels' | 'pen' | 'setPen' | 'color' | 'setColor'> }) {
  const toolbar = usePart('mockup', 'tools'), button = usePart('mockup', 'button');
  return <PrismPart slotProps={{ model }} as="span" {...toolbar}><PrismPart slotProps={{ model }} as="button" {...button} aria-pressed={vm.pen} onClick={() => vm.setPen(!vm.pen)}><Icon name="pen" />{vm.labels.draw}</PrismPart>{vm.pen && ['var(--prism-mockup-accent, var(--prism-accent))', 'var(--prism-danger)', 'var(--prism-positive)', 'var(--prism-warning)'].map((color, i) => <PrismPart slotProps={{ model }} as="button" key={color} {...button} title={vm.labels.colorOption.replace('{n}', String(i + 1))} aria-label={vm.labels.colorOption.replace('{n}', String(i + 1))} aria-pressed={vm.color === color} onClick={() => vm.setColor(color)} style={{ ...button.style, color }}><Icon name="circle" /></PrismPart>)}</PrismPart>;
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
  return <PrismPart slotProps={{ model }} as="span" {...footer} role={submitted ? 'status' : undefined}>
    <PrismPart slotProps={{ model }} as="button" {...button} hidden={submitted} data-secondary="" data-prism-reveal="" disabled={!canUndo} onClick={undo}><Icon name="undo" />{labels.undo}</PrismPart>
    <PrismPart slotProps={{ model }} as="button" {...button} hidden={submitted} data-secondary="" data-prism-reveal="" disabled={!canRedo} onClick={redo}><Icon name="redo" />{labels.redo}</PrismPart>
    <PrismPart slotProps={{ model }} as="span" {...countPart} hidden={submitted}>{commentCount(labels, locale, count)}</PrismPart>
    <Primary model={model} as="button" {...primary} data-feedback-submit="" data-sent={submitted ? '' : undefined} sent={submitted} receipt={commentCount(labels, locale, count, true)} disabled={submitted || !canSubmit} aria-disabled={submitted || !canSubmit} onBlur={() => vm.commitOverall?.()} onClick={submit}>{labels.submit}</Primary>
    {submitted && <PrismPart slotProps={{ model }} as="button" {...button} onClick={edit}>{labels.editFeedback}</PrismPart>}
  </PrismPart>;
}
