import { PrismPart, usePart, useSlot } from '@prism-ui/react';
import type { HTMLAttributes } from 'react';
import { MockupIcon as Icon } from './icon';
import type { MockupModel } from './use-mockup';

function Box(props: HTMLAttributes<HTMLDivElement>) { return <PrismPart as="div" {...props} />; }
export function MockupToolbar({ vm }: { vm: Pick<MockupModel, 'labels' | 'framed' | 'device' | 'setDevice' | 'zoom' | 'setZoom' | 'fullscreen' | 'showSource' | 'setShowSource'> }) {
  const toolbar = usePart('mockup', 'tools'), button = usePart('mockup', 'button'), Actions = useSlot('mockup', 'headerActions', Box);
  return <Actions {...toolbar}>
    {vm.framed && <div role="group" aria-label={vm.labels.desktop}>{(['desktop', 'tablet', 'mobile'] as const).map(device => <PrismPart as="button" key={device} {...button} aria-label={vm.labels[device]} title={vm.labels[device]} aria-pressed={vm.device === device} onClick={() => vm.setDevice(device)}><Icon name={device} /></PrismPart>)}</div>}
    <PrismPart as="button" {...button} aria-label={vm.labels.zoomOut} title={vm.labels.zoomOut} disabled={vm.zoom <= .5} onClick={() => vm.setZoom(Math.max(.5, vm.zoom - .25))}><Icon name="minus" /></PrismPart><PrismPart as="button" {...button} title={vm.labels.fit} onClick={() => vm.setZoom(1)}>{vm.zoom === 1 ? vm.labels.fit : `${Math.round(vm.zoom * 100)}%`}</PrismPart><PrismPart as="button" {...button} aria-label={vm.labels.zoomIn} title={vm.labels.zoomIn} disabled={vm.zoom >= 2} onClick={() => vm.setZoom(Math.min(2, vm.zoom + .25))}><Icon name="plus" /></PrismPart>
    <PrismPart as="button" {...button} title={vm.labels.fullscreen} aria-label={vm.labels.fullscreen} onClick={vm.fullscreen}><Icon name="fullscreen" /></PrismPart><PrismPart as="button" {...button} title={vm.labels.source} aria-label={vm.labels.source} aria-pressed={vm.showSource} onClick={() => vm.setShowSource(!vm.showSource)}><Icon name="source" /></PrismPart>
  </Actions>;
}
export function MockupPenTools({ vm }: { vm: Pick<MockupModel, 'labels' | 'pen' | 'setPen' | 'color' | 'setColor'> }) {
  const toolbar = usePart('mockup', 'tools'), button = usePart('mockup', 'button');
  return <PrismPart as="div" {...toolbar}><PrismPart as="button" {...button} aria-pressed={vm.pen} onClick={() => vm.setPen(!vm.pen)}><Icon name="pen" />{vm.labels.draw}</PrismPart>{['var(--prism-accent, #525252)', 'var(--prism-danger)', 'var(--prism-positive)', 'var(--prism-warning)'].map((color, i) => <PrismPart as="button" key={color} {...button} title={`${vm.labels.color} ${i + 1}`} aria-label={`${vm.labels.color} ${i + 1}`} aria-pressed={vm.color === color} onClick={() => vm.setColor(color)} style={{ ...button.style, color }}><svg width="12" height="12" aria-hidden="true"><circle cx="6" cy="6" r="5" fill="currentColor" /></svg></PrismPart>)}</PrismPart>;
}
export function MockupSource({ vm }: { vm: Pick<MockupModel, 'labels' | 'source' | 'copy'> }) {
  const source = usePart('mockup', 'source'), button = usePart('mockup', 'button');
  return <PrismPart as="div" {...source}><PrismPart as="button" {...button} onClick={vm.copy}>{vm.labels.copy}</PrismPart><pre>{vm.source}</pre></PrismPart>;
}
export function commentCount(labels: MockupModel['labels'], locale: string | undefined, n: number, sent = false) {
  const one = new Intl.PluralRules(locale).select(n) === 'one';
  return labels[sent ? one ? 'sentOne' : 'sentOther' : one ? 'countOne' : 'countOther'].replace('{n}', String(n));
}
export function MockupFooter({ labels, locale, count, submitted, edit, canUndo, canRedo, undo, redo, canSubmit, submit }: {
  labels: MockupModel['labels']; locale?: string; count: number; submitted: boolean; edit(): void;
  canUndo: boolean; canRedo: boolean; undo(): void; redo(): void; canSubmit: boolean; submit(): void;
}) {
  const footer = usePart('mockup', 'feedbackFooter'), button = usePart('mockup', 'button'), primary = usePart('mockup', 'primary');
  return submitted ? <PrismPart as="div" {...footer} role="status">{commentCount(labels, locale, count, true)}<PrismPart as="button" {...button} onClick={edit}>{labels.editFeedback}</PrismPart></PrismPart> :
    <PrismPart as="div" {...footer}><PrismPart as="button" {...button} disabled={!canUndo} onClick={undo}><Icon name="undo" />{labels.undo}</PrismPart><PrismPart as="button" {...button} disabled={!canRedo} onClick={redo}><Icon name="redo" />{labels.redo}</PrismPart><span>{commentCount(labels, locale, count)}</span><PrismPart as="button" {...primary} disabled={!canSubmit} onClick={submit}>{labels.submit}</PrismPart></PrismPart>;
}
