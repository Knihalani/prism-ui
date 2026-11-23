import { PrismPart, useCollapse, usePart, usePrism, useSlot } from '@prism-ui/react';
import { forwardRef, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { useFlip } from '../lib/use-flip';
import type { FeedbackItem } from './engine';
import type { MockupSlotProps } from './mockup';
import type { MockupModel } from './use-mockup';
import { MockupIcon as Icon } from './icon';
import { targetLabel } from './target-label';

function Empty({ model: vm, ...props }: MockupSlotProps<'span'>) { return <span {...props}>{vm.labels.empty} {vm.labels.shortcuts}</span>; }
const Item = forwardRef<HTMLSpanElement, MockupSlotProps<'span'> & { item: FeedbackItem }>(function Item({ item, model: vm, inert, ...props }, ref) {
  const target = targetLabel(item.target, vm.labels);
  const badge = usePart('mockup', 'badge'), kind = usePart('mockup', 'kindIcon'), chip = usePart('mockup', 'target'), button = usePart('mockup', 'button'), content = usePart('mockup', 'rowContent'), text = usePart('mockup', 'rowText');
  return <span {...props} ref={ref} role="listitem" data-feedback-row={item.id} data-active={vm.active === item.id || undefined} data-resolved={item.resolved || undefined} data-submitted={vm.submitted || undefined} onMouseEnter={() => vm.highlight(item.id)} onMouseLeave={() => vm.highlight(null)} onFocus={() => vm.highlight(item.id)} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) vm.highlight(null); }}>
    <PrismPart as="button" {...content} slotProps={{ model: vm, item }} type="button" disabled={item.resolved || vm.submitted} aria-description={vm.labels.openComment.replace('{n}', String(item.n))} onClick={() => vm.open(item.id)}>
      <PrismPart as="span" {...badge} slotProps={{ model: vm }}>{item.resolved ? <Icon name="check" /> : item.n}</PrismPart>
      <PrismPart as="span" {...kind} slotProps={{ model: vm }} aria-hidden="true"><Icon name={item.kind === 'pin' ? 'pin' : item.kind === 'region' ? 'region' : 'pen'} /></PrismPart>
      <PrismPart as="span" {...text} slotProps={{ model: vm }} data-placeholder={!item.comment || undefined}>{item.comment || vm.labels.placeholder}{target && <PrismPart as="span" {...chip} slotProps={{ model: vm }}>{target}</PrismPart>}</PrismPart>
    </PrismPart>
    {!item.resolved && <><PrismPart as="button" {...button} slotProps={{ model: vm }} type="button" data-prism-reveal="" disabled={vm.submitted} title={vm.labels.edit} aria-label={vm.labels.editComment.replace('{n}', String(item.n))} onClick={() => vm.open(item.id)}><Icon name="pen" /></PrismPart><PrismPart as="button" {...button} slotProps={{ model: vm }} type="button" data-prism-reveal="" disabled={vm.submitted} title={vm.labels.delete} aria-label={vm.labels.deleteComment.replace('{n}', String(item.n))} onClick={() => vm.remove(item.id)}><Icon name="trash" /></PrismPart></>}
  </span>;
});
function CommentRow({ vm, item, exiting, index, remove }: { vm: MockupModel; item: FeedbackItem; exiting: boolean; index: number; remove(): void }) {
  const part = usePart('mockup', 'item'), Row = useSlot('mockup', 'item', Item), { animate, unstyled } = usePrism();
  const collapse = useCollapse<HTMLSpanElement>(!exiting), removeRef = useRef(remove);
  const spacing = useRef<{ padding: string; border: string } | undefined>(undefined);
  removeRef.current = remove;
  useLayoutEffect(() => {
    const element = collapse.ref.current; if (!element) return;
    element.inert = exiting;
    if (exiting) {
      spacing.current ??= { padding: element.style.paddingBlock, border: element.style.borderBlockWidth };
      element.style.paddingBlock = '0'; element.style.borderBlockWidth = '0';
    } else if (spacing.current) {
      element.style.paddingBlock = spacing.current.padding; element.style.borderBlockWidth = spacing.current.border; spacing.current = undefined;
    }
  }, [exiting]);
  useEffect(() => {
    if (!exiting) return;
    const value = collapse.ref.current ? getComputedStyle(collapse.ref.current).getPropertyValue('--prism-motion-fast') : '';
    const number = Number.parseFloat(value), duration = Number.isFinite(number) ? Math.max(0, number * (value.trim().endsWith('ms') ? 1 : 1000)) : 160;
    const timer = setTimeout(() => removeRef.current(), duration);
    return () => clearTimeout(timer);
  }, [exiting]);
  return <Row {...part} {...collapse} item={item} model={vm} inert={exiting || undefined} data-closing={exiting ? '' : undefined} data-prism-enter={animate && !unstyled && !exiting ? '' : undefined} style={{ ...part.style, ...collapse.style, '--prism-motion-index': Math.min(index, 8) } as CSSProperties} />;
}
export function MockupList({ vm }: { vm: MockupModel }) {
  const { animate, unstyled } = usePrism(), flip = useFlip<HTMLSpanElement>(animate && !unstyled, '[data-feedback-row]');
  const list = usePart('mockup', 'list'), empty = usePart('mockup', 'empty');
  const EmptyState = useSlot('mockup', 'empty', Empty);
  const retained = useRef(new Map<string, FeedbackItem>()), order = useRef<string[]>([]), [, redraw] = useState(0);
  const items = [...vm.resolved, ...vm.state.items], ids = new Set(items.map(item => item.id));
  for (const item of items) retained.current.set(item.id, item);
  if (!animate || unstyled) for (const id of retained.current.keys()) if (!ids.has(id)) retained.current.delete(id);
  const rows = [...items];
  order.current.forEach((id, index) => { const item = retained.current.get(id); if (item && !ids.has(id)) rows.splice(index, 0, item); });
  order.current = rows.map(item => item.id);
  return <PrismPart as="span" {...list} slotProps={{ model: vm }} ref={node => { flip.current = node; vm.listRef.current = node; }} role={vm.resolved.length || vm.state.items.length ? 'list' : undefined} data-prism-flash={vm.flash ? '' : undefined}>
    {rows.length ? rows.map((item, index) => <CommentRow key={item.id} vm={vm} item={item} index={index} exiting={!ids.has(item.id)} remove={() => { retained.current.delete(item.id); redraw(value => value + 1); }} />) : <EmptyState {...empty} model={vm} />}
  </PrismPart>;
}
