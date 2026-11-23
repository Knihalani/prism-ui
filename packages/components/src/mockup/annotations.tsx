import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { PrismPart, usePart, usePrism, useSlot, usePresentation } from '@prism-ui/react';
import type { FeedbackItem } from './engine';
import type { MockupModel } from './use-mockup';
import type { MockupSlotProps } from './mockup';
import { MockupIcon as Icon } from './icon';
import { GestureOverlay, useCanvasSize } from './gesture';
import { drawingOutline } from './outline';
import { revealComposerInput, useComposerViewport } from './viewport';

function motionTime(value: string, fallback: number) {
  const number = Number.parseFloat(value);
  return Number.isFinite(number) ? Math.max(0, number * (value.trim().endsWith('ms') ? 1 : 1000)) : fallback;
}
function Popover({ model: vm, ...attributes }: MockupSlotProps<'span'>) {
  const part = usePart('mockup', 'popover'), input = usePart('mockup', 'input'), primary = usePart('mockup', 'primary'), button = usePart('mockup', 'button');
  const header = usePart('mockup', 'composerHeader'), footer = usePart('mockup', 'composerFooter'), badge = usePart('mockup', 'badge'), kind = usePart('mockup', 'kindIcon'), hints = usePart('mockup', 'keyboardHints'), key = usePart('mockup', 'hintKey');
  const element = useRef<HTMLSpanElement>(null), [height, setHeight] = useState(210), enter = usePresentation();
  const viewport = useComposerViewport();
  useLayoutEffect(() => { revealComposerInput(element.current); }, [viewport]);
  const [, reposition] = useState(0);
  useLayoutEffect(() => { const update = () => reposition(n => n + 1); window.addEventListener('resize', update); window.addEventListener('scroll', update, true); return () => { window.removeEventListener('resize', update); window.removeEventListener('scroll', update, true); }; }, []);
  useLayoutEffect(() => { const node = element.current; if (!node) return; const measure = () => setHeight(node.getBoundingClientRect().height || 210); measure(); const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure); observer?.observe(node); return () => observer?.disconnect(); }, []);
  const item = vm.state.items.find(item => item.id === vm.editing?.id); if (!item) return null;
  const position = { ...vm.popoverPosition(item.x, item.y, height, viewport), ...attributes.style, maxHeight: Math.max(0, viewport.height - 24), overflowY: 'auto' as const, boxSizing: 'border-box' as const }, mac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
  return <span {...part} {...attributes} ref={node => { element.current = node; const ref = attributes.ref; if (typeof ref === 'function') ref(node); else if (ref) ref.current = node; }} role="dialog" aria-label={vm.labels.comment.replace('{n}', String(item.n)).replace('{text}', item.comment)} data-side={position['--prism-mockup-caret-side']} data-prism-enter={enter['data-prism-enter']} style={{ ...part.style, ...position }} onKeyDown={event => {
    if (event.key !== 'Tab') return;
    const fields = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('textarea,button:not(:disabled),[tabindex="0"]'));
    const first = fields[0], last = fields.at(-1); if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }}>
    <PrismPart as="span" {...header} slotProps={{ model: vm }}><PrismPart as="span" {...badge} slotProps={{ model: vm }}>{item.n}</PrismPart><PrismPart as="span" {...kind} slotProps={{ model: vm }} aria-hidden="true"><Icon name={item.kind === 'pin' ? 'pin' : item.kind === 'region' ? 'region' : 'pen'} /></PrismPart>{vm.labels[item.kind === 'drawing' ? 'draw' : item.kind]}<PrismPart as="button" {...button} slotProps={{ model: vm }} type="button" aria-label={vm.labels.cancelComment} onClick={() => vm.cancel()}><Icon name="close" /></PrismPart></PrismPart>
    <PrismPart slotProps={{ model: vm }} as="textarea" {...input} rows={2} autoFocus aria-label={vm.labels.placeholder} placeholder={vm.labels.placeholder} value={vm.comment} onChange={event => vm.setComment(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.ctrlKey && !event.metaKey && !event.nativeEvent.isComposing) { event.preventDefault(); vm.save(true); } }} />
    <PrismPart as="span" {...footer} slotProps={{ model: vm }}><PrismPart slotProps={{ model: vm }} as="button" {...primary} type="button" onClick={() => vm.save(true)}>{vm.labels.save}</PrismPart><PrismPart slotProps={{ model: vm }} as="button" {...button} type="button" onClick={() => vm.remove(item.id)}>{vm.labels.delete}</PrismPart></PrismPart>
    <PrismPart as="span" {...hints} slotProps={{ model: vm }}>{[vm.labels.saveHint, mac ? vm.labels.sendHintMac : vm.labels.sendHintControl, vm.labels.escapeHint].map(label => <PrismPart as="kbd" key={label} {...key} slotProps={{ model: vm }}>{label}</PrismPart>)}</PrismPart>
  </span>;
}
export function MockupComment({ vm, style, open = true }: { vm: MockupModel; style?: CSSProperties; open?: boolean }) {
  const part = usePart('mockup', 'popover'), Comment = useSlot('mockup', 'popover', Popover);
  const { animate, unstyled } = usePrism();
  const active = open && !!vm.editing && !vm.submitted, enabled = animate && !unstyled;
  const cached = useRef(vm), ref = useRef<HTMLSpanElement>(null), [present, setPresent] = useState(active);
  if (active) cached.current = vm;
  useLayoutEffect(() => {
    if (active) { setPresent(true); return; }
    if (!present) return;
    const computed = ref.current ? getComputedStyle(ref.current) : null;
    const time = (token: string, fallback: number) => motionTime(computed?.getPropertyValue(token) ?? '', fallback);
    const duration = enabled ? time('--prism-motion-instant', 90) + (vm.submitted ? time('--prism-motion-slow', 420) : 0) : 0;
    if (!duration) { setPresent(false); return; }
    const timer = setTimeout(() => setPresent(false), duration);
    return () => clearTimeout(timer);
  }, [active, present, enabled, vm.submitted]);
  return active || present ? <Comment {...part} ref={ref} model={active ? vm : cached.current} role="dialog" aria-hidden={!active || undefined} inert={!active || undefined} data-closing={!active ? '' : undefined} data-submitted={vm.submitted ? '' : undefined} style={{ ...part.style, ...style }} /> : null;
}
function Marker({ item, vm, size }: { item: FeedbackItem; vm: MockupModel; size: { width: number; height: number } }) {
  const marker = { ...usePart('mockup', 'marker'), ...vm.markerPointer }, stroke = usePart('mockup', 'stroke'), path = usePart('mockup', 'strokePath'), ripple = usePart('mockup', 'ripple');
  const submitted = vm.submitted && !item.resolved;
  const [created, setCreated] = useState(() => vm.created.current.has(item.id));
  useLayoutEffect(() => { vm.created.current.delete(item.id); }, [item.id]);
  const label = item.resolved ? vm.labels.resolvedComment.replace('{n}', String(item.n)).replace('{text}', item.comment) : vm.labels.comment.replace('{n}', String(item.n)).replace('{text}', item.comment || vm.labels.placeholder);
  return <>
    {item.kind === 'drawing' && <PrismPart slotProps={{ model: vm }} as="svg" {...stroke} data-active={vm.active === item.id || vm.editing?.id === item.id || undefined} data-submitted={submitted || undefined} onMouseEnter={() => vm.highlight(item.id, true)} onMouseLeave={() => vm.highlight(null)} viewBox={`0 0 ${size.width} ${size.height}`} aria-hidden="true"><PrismPart slotProps={{ model: vm }} as="path" {...path} d={drawingOutline(item.path ?? '', size.width, size.height, item.pressure)} fill={item.color ?? 'var(--prism-mockup-accent, var(--prism-accent-text))'} style={{ ...path.style, pointerEvents: submitted ? 'none' : 'fill', cursor: 'pointer' }} onClick={() => { if (!item.resolved && !vm.submitted) vm.open(item.id); }} /></PrismPart>}
    <PrismPart slotProps={{ model: vm }} as="button" {...marker} type="button" data-feedback-id={item.id} aria-hidden={submitted || undefined} tabIndex={submitted ? -1 : undefined} data-created={created || undefined} data-submitted={submitted || undefined} onAnimationEnd={event => { if (event.target === event.currentTarget) setCreated(false); }} data-kind={item.kind} data-resolved={item.resolved || undefined} data-active={vm.active === item.id || vm.editing?.id === item.id || undefined} style={{ ...marker.style, left: `${item.x}%`, top: `${item.y}%`, ...(item.kind === 'region' ? { width: `${item.w}%`, height: `${item.h}%` } : {}) }} aria-label={label} aria-disabled={item.resolved || undefined} onMouseEnter={() => vm.highlight(item.id, true)} onMouseLeave={() => vm.highlight(null)} onFocus={() => vm.highlight(item.id, true)} onBlur={() => vm.highlight(null)} onClick={() => { if (!item.resolved && !vm.submitted) vm.open(item.id); }} onKeyDown={event => { if (item.resolved || vm.submitted) return; if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); vm.remove(item.id); } if (event.key.startsWith('Arrow')) { event.preventDefault(); if (event.shiftKey && item.kind === 'region') vm.resize(item.id, (item.w ?? 20) + (event.key === 'ArrowRight' ? 2 : event.key === 'ArrowLeft' ? -2 : 0), (item.h ?? 20) + (event.key === 'ArrowDown' ? 2 : event.key === 'ArrowUp' ? -2 : 0)); else vm.move(item.id, item.x + (event.key === 'ArrowRight' ? 2 : event.key === 'ArrowLeft' ? -2 : 0), item.y + (event.key === 'ArrowDown' ? 2 : event.key === 'ArrowUp' ? -2 : 0)); } }}>
      {created && item.kind === 'pin' && <PrismPart as="span" {...ripple} slotProps={{ model: vm }} aria-hidden="true" />}
      {item.kind === 'region' && <svg className="prism-mockup__region-outline" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><rect x="0" y="0" width="100" height="100" pathLength="1" vectorEffect="non-scaling-stroke" /></svg>}
      <span>{item.resolved ? <Icon name="check" /> : item.n}</span>
    </PrismPart>
  </>;
}
export function MockupAnnotations({ vm, popover = true }: { vm: MockupModel; popover?: boolean }) {
  const canvas = usePart('mockup', 'canvas'), reticle = usePart('mockup', 'reticle'), size = useCanvasSize(vm);
  return <>
    <PrismPart slotProps={{ model: vm }} as="span" {...canvas} {...vm.pointer} ref={vm.canvas} tabIndex={0} role="application" aria-label={vm.labels.canvas} onKeyDown={vm.canvasKey} onFocus={() => vm.setFocused(true)} onBlur={() => vm.setFocused(false)} data-tool={vm.tool} data-disabled={vm.submitted || undefined}>
      {vm.focused && <PrismPart slotProps={{ model: vm }} as="span" {...reticle} style={{ ...reticle.style, left: `${vm.reticle[0]}%`, top: `${vm.reticle[1]}%` }}><Icon name="plus" /></PrismPart>}
      <GestureOverlay vm={vm} size={size} />
    </PrismPart>
    {[...vm.resolved, ...vm.state.items].map(item => <Marker key={item.id} item={item as FeedbackItem} vm={vm} size={size} />)}{popover && <MockupComment vm={vm} />}
  </>;
}
