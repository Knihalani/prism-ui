import { usePart, useSlot } from '@prism-ui/react';
import { useEffect, useId, useLayoutEffect, useRef, useState, type HTMLAttributes } from 'react';
import { Chip, IconButton, Pill } from '../shared';
import { MockupIcon as Icon } from './icon';
import type { MockupModel } from './use-mockup';

function Box(props: HTMLAttributes<HTMLDivElement>) { return <div {...props} />; }
export function MockupOverall({ label, value, submitted, onChange }: { label: string; value: string; submitted: boolean; onChange(value: string): void }) {
  const overall = usePart('mockup', 'overall'), input = usePart('mockup', 'input'), ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;
    const grow = () => { element.style.height = 'auto'; element.style.height = element.scrollHeight + 'px'; };
    grow();
    if (typeof ResizeObserver === 'undefined') return;
    let width = element.clientWidth;
    const observer = new ResizeObserver(() => { if (element.clientWidth !== width) { width = element.clientWidth; grow(); } });
    observer.observe(element);
    return () => observer.disconnect();
  }, [value]);
  return <label {...overall}><span className="prism-mockup__sr">{label}</span><textarea {...input} ref={ref} rows={1} placeholder="Add overall feedback…" readOnly={submitted} value={value} onChange={event => onChange(event.target.value)} /></label>;
}
export function MockupToolbar({ vm, submitted = false }: { vm: Pick<MockupModel, 'labels' | 'framed' | 'device' | 'setDevice' | 'zoom' | 'setZoom' | 'fullscreen' | 'showSource' | 'setShowSource' | 'pen' | 'setPen' | 'color' | 'setColor'>; submitted?: boolean }) {
  const toolbar = usePart('mockup', 'tools'), button = usePart('mockup', 'button'), Actions = useSlot('mockup', 'headerActions', Box);
  const [open, setOpen] = useState(false), id = useId(), overflow = useRef<HTMLDivElement>(null), trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    overflow.current?.querySelector<HTMLButtonElement>('[role="dialog"] button')?.focus();
    const close = (event: PointerEvent) => { if (!overflow.current?.contains(event.target as Node)) setOpen(false); };
    document.addEventListener('pointerdown', close);
    return () => document.removeEventListener('pointerdown', close);
  }, [open]);
  return <Actions {...toolbar}>
    {vm.framed && <div role="group" aria-label={vm.labels.desktop}>{(['desktop', 'mobile'] as const).map(device => <Chip key={device} {...button} title={vm.labels[device]} pressed={vm.device === device} onClick={() => vm.setDevice(device)}>{vm.labels[device]}</Chip>)}</div>}
    <span className="prism-mockup__zoom"><IconButton {...button} aria-label={vm.labels.zoomOut} title={vm.labels.zoomOut} disabled={vm.zoom <= .5} onClick={() => vm.setZoom(Math.max(.5, vm.zoom - .25))}><Icon name="minus" /></IconButton><button {...button} title={vm.labels.fit} onClick={() => vm.setZoom(1)}>{Math.round(vm.zoom * 100)}%</button><IconButton {...button} aria-label={vm.labels.zoomIn} title={vm.labels.zoomIn} disabled={vm.zoom >= 2} onClick={() => vm.setZoom(Math.min(2, vm.zoom + .25))}><Icon name="plus" /></IconButton></span>
    {!submitted && <Chip {...button} pressed={!vm.pen} onClick={() => vm.setPen(false)}>Comment</Chip>}
    <div className="prism-mockup__overflow" ref={overflow} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false); }} onKeyDown={event => { if (event.key === 'Escape' && open) { event.preventDefault(); event.stopPropagation(); setOpen(false); trigger.current?.focus(); } }}>
      <IconButton {...button} ref={trigger} aria-label="More mockup tools" aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => setOpen(value => !value)}>…</IconButton>
      {open && <div id={id} role="dialog" aria-label="More mockup tools" className="prism-mockup__overflowMenu">
        {vm.framed && <Chip {...button} pressed={vm.device === 'tablet'} onClick={() => vm.setDevice('tablet')}>{vm.labels.tablet}</Chip>}
        {!submitted && <MockupPenTools vm={vm} />}
        <IconButton {...button} title={vm.labels.fullscreen} aria-label={vm.labels.fullscreen} onClick={vm.fullscreen}><Icon name="fullscreen" /></IconButton><IconButton {...button} title={vm.labels.source} aria-label={vm.labels.source} aria-pressed={vm.showSource} onClick={() => vm.setShowSource(!vm.showSource)}><Icon name="source" /></IconButton>
      </div>}
    </div>
  </Actions>;
}
export function MockupPenTools({ vm }: { vm: Pick<MockupModel, 'labels' | 'pen' | 'setPen' | 'color' | 'setColor'> }) {
  const toolbar = usePart('mockup', 'tools'), button = usePart('mockup', 'button');
  return <div {...toolbar} data-pen-tools=""><IconButton {...button} title={vm.labels.draw} aria-label={vm.labels.draw} aria-pressed={vm.pen} onClick={() => vm.setPen(!vm.pen)}><Icon name="pen" /></IconButton>{vm.pen && ['var(--prism-accent)', 'var(--prism-danger)', 'var(--prism-success)', 'var(--prism-warning)'].map((color, i) => <IconButton key={color} {...button} title={vm.labels.color + ' ' + (i + 1)} aria-label={vm.labels.color + ' ' + (i + 1)} aria-pressed={vm.color === color} onClick={() => vm.setColor(color)} style={{ ...button.style, color }}><svg width="12" height="12" aria-hidden="true"><circle cx="6" cy="6" r="5" fill="currentColor" /></svg></IconButton>)}</div>;
}
export function MockupSource({ vm }: { vm: Pick<MockupModel, 'labels' | 'source' | 'copy'> }) {
  const source = usePart('mockup', 'source'), button = usePart('mockup', 'button');
  return <div {...source}><Pill {...button} variant="ghost" onClick={vm.copy}>{vm.labels.copy}</Pill><pre>{vm.source}</pre></div>;
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
  return <div {...footer}>
    <div className="prism-mockup__historyActions"><IconButton {...button} title={labels.undo} aria-label={labels.undo} disabled={submitted || !canUndo} onClick={undo}><Icon name="undo" /></IconButton><IconButton {...button} title={labels.redo} aria-label={labels.redo} disabled={submitted || !canRedo} onClick={redo}><Icon name="redo" /></IconButton></div>
    <Pill {...primary} aria-label={submitted ? commentCount(labels, locale, count, true) : labels.submit} sent={submitted} receipt={commentCount(labels, locale, count, true)} disabled={!submitted && !canSubmit} onClick={submit}><span>{commentCount(labels, locale, count)}</span> · <span>{labels.submit}</span> <span aria-hidden="true">→</span></Pill>
    {submitted && <Pill {...button} variant="ghost" onClick={edit}>{labels.editFeedback}</Pill>}
  </div>;
}
