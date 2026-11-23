import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { PrismPart, usePart, usePrism, useSlot } from '@prism-ui/react';
import type { FeedbackItem } from './engine';
import type { MockupModel } from './use-mockup';
import type { MockupSlotProps } from './mockup';
import { MockupIcon as Icon } from './icon';

function Popover({ model: vm, ...attributes }: MockupSlotProps) {
  const part = usePart('mockup', 'popover'), input = usePart('mockup', 'input'), primary = usePart('mockup', 'primary'), button = usePart('mockup', 'button');
  const item = vm.state.items.find(item => item.id === vm.editing?.id); if (!item) return null;
  return <span {...part} {...attributes} role="dialog" aria-label={vm.labels.comment.replace('{n}', String(item.n)).replace('{text}', item.comment)} style={{ ...part.style, ...vm.popoverPosition(item.x, item.y), ...attributes.style }}>
    <PrismPart slotProps={{ model: vm }} as="textarea" {...input} autoFocus aria-label={vm.labels.placeholder} placeholder={vm.labels.placeholder} value={vm.comment} onChange={event => vm.setComment(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); vm.save(true); } if (event.key === 'Escape') { event.stopPropagation(); vm.cancel(); } }} />
    <PrismPart slotProps={{ model: vm }} as="button" {...primary} onClick={() => vm.save()}>{vm.labels.save}</PrismPart><PrismPart slotProps={{ model: vm }} as="button" {...button} onClick={() => vm.remove(item.id)}>{vm.labels.delete}</PrismPart>
  </span>;
}
export function MockupComment({ vm, style, open = true }: { vm: MockupModel; style?: CSSProperties; open?: boolean }) {
  const part = usePart('mockup', 'popover'), Comment = useSlot('mockup', 'popover', Popover);
  const active = open && !!vm.editing && !vm.submitted, enabled = usePrism().animate;
  const cached = useRef(vm), ref = useRef<HTMLDivElement>(null), [present, setPresent] = useState(active);
  if (active) cached.current = vm;
  useLayoutEffect(() => {
    if (active) { setPresent(true); return; }
    if (!present) return;
    const computed = ref.current ? getComputedStyle(ref.current) : null;
    const time = (token: string, fallback: number) => {
      const value = computed?.getPropertyValue(token).trim() ?? '', number = Number.parseFloat(value);
      return Number.isFinite(number) ? Math.max(0, number * (value.endsWith('ms') ? 1 : 1000)) : fallback;
    };
    const duration = enabled ? time('--prism-motion-fast', 160) + (vm.submitted ? time('--prism-motion-slow', 420) : 0) : 0;
    if (!duration) { setPresent(false); return; }
    const timer = setTimeout(() => setPresent(false), duration);
    return () => clearTimeout(timer);
  }, [active, present, enabled, vm.submitted]);
  return active || present ? <Comment {...part} ref={ref} model={active ? vm : cached.current} role="dialog" aria-hidden={!active || undefined} inert={!active || undefined} data-closing={!active ? '' : undefined} data-submitted={vm.submitted ? '' : undefined} style={{ ...part.style, ...style }} /> : null;
}
function Marker({ item, vm }: { item: FeedbackItem; vm: MockupModel }) {
  const marker = usePart('mockup', 'marker'), stroke = usePart('mockup', 'stroke');
  const label = item.resolved ? vm.labels.resolvedComment.replace('{n}', String(item.n)).replace('{text}', item.comment) : vm.labels.comment.replace('{n}', String(item.n)).replace('{text}', item.comment || vm.labels.placeholder);
  return <>
    {item.kind === 'drawing' && <PrismPart slotProps={{ model: vm }} as="svg" {...stroke} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d={item.path} fill="none" stroke={item.color ?? 'var(--prism-mockup-accent, var(--prism-accent-text))'} strokeWidth="2" vectorEffect="non-scaling-stroke" style={{ pointerEvents: 'stroke', cursor: 'pointer' }} onClick={() => { if (!item.resolved && !vm.submitted) vm.open(item.id); }} /></PrismPart>}
    <PrismPart slotProps={{ model: vm }} as="button" {...marker} type="button" data-kind={item.kind} data-resolved={item.resolved || undefined} data-active={vm.active === item.id || undefined} style={{ ...marker.style, left: `${item.x}%`, top: `${item.y}%`, ...(item.kind === 'region' ? { width: `${item.w}%`, height: `${item.h}%` } : {}) }} aria-label={label} aria-disabled={item.resolved || undefined} onMouseEnter={() => vm.setActive(item.id)} onMouseLeave={() => vm.setActive(null)} onFocus={() => vm.setActive(item.id)} onBlur={() => vm.setActive(null)} onClick={() => { if (!item.resolved && !vm.submitted) vm.open(item.id); }} onKeyDown={event => { if (item.resolved || vm.submitted) return; if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); vm.remove(item.id); } if (event.key.startsWith('Arrow')) { event.preventDefault(); vm.move(item.id, item.x + (event.key === 'ArrowRight' ? 2 : event.key === 'ArrowLeft' ? -2 : 0), item.y + (event.key === 'ArrowDown' ? 2 : event.key === 'ArrowUp' ? -2 : 0)); } }}>
      {item.kind === 'region' && <svg className="prism-mockup__region-outline" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><rect x="0" y="0" width="100" height="100" pathLength="1" vectorEffect="non-scaling-stroke" /></svg>}
      <span>{item.resolved ? <Icon name="check" /> : item.n}</span>
    </PrismPart>
  </>;
}
export function MockupAnnotations({ vm, popover = true }: { vm: MockupModel; popover?: boolean }) {
  const canvas = usePart('mockup', 'canvas'), reticle = usePart('mockup', 'reticle'), hint = usePart('mockup', 'hint'), stroke = usePart('mockup', 'stroke');
  return <>
    <PrismPart slotProps={{ model: vm }} as="span" {...canvas} {...vm.pointer} ref={vm.canvas} tabIndex={0} role="application" aria-label={vm.labels.canvas} onKeyDown={vm.canvasKey} onFocus={() => vm.setFocused(true)} onBlur={() => vm.setFocused(false)} data-disabled={vm.submitted || undefined}>
      {vm.focused && <PrismPart slotProps={{ model: vm }} as="span" {...reticle} style={{ ...reticle.style, left: `${vm.reticle[0]}%`, top: `${vm.reticle[1]}%` }}><Icon name="plus" /></PrismPart>}
      {vm.hover && !vm.state.items.length && !vm.submitted && <PrismPart slotProps={{ model: vm }} as="span" {...hint} style={{ ...hint.style, left: `${Math.min(65, vm.hover[0])}%`, top: `${vm.hover[1]}%` }}>{vm.labels.hint}</PrismPart>}
      {vm.rubber.length > 0 && <PrismPart slotProps={{ model: vm }} as="svg" {...stroke} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">{vm.pen ? <polyline points={vm.rubber.map(p => p.join(',')).join(' ')} fill="none" stroke={vm.color} strokeWidth="2" vectorEffect="non-scaling-stroke" /> : <rect x={Math.min(vm.rubber[0][0], vm.rubber.at(-1)![0])} y={Math.min(vm.rubber[0][1], vm.rubber.at(-1)![1])} width={Math.abs(vm.rubber[0][0] - vm.rubber.at(-1)![0])} height={Math.abs(vm.rubber[0][1] - vm.rubber.at(-1)![1])} fill="color-mix(in srgb, var(--prism-mockup-accent, var(--prism-accent-text)) 8%, transparent)" stroke="var(--prism-mockup-accent, var(--prism-accent-text))" vectorEffect="non-scaling-stroke" />}</PrismPart>}
    </PrismPart>
    {[...vm.resolved, ...vm.state.items].map(item => <Marker key={item.id} item={item as FeedbackItem} vm={vm} />)}{popover && <MockupComment vm={vm} />}
  </>;
}
