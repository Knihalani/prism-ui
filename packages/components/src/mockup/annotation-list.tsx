import { PrismPart, usePart, usePrism, useSlot } from '@prism-ui/react';
import { useFlip } from '../lib/use-flip';
import type { FeedbackItem } from './engine';
import type { MockupSlotProps } from './mockup';
import type { MockupModel } from './use-mockup';
import { MockupIcon as Icon } from './icon';

function Empty({ model: vm, ...props }: MockupSlotProps<'span'>) { return <span {...props}>{vm.labels.empty} {vm.labels.shortcuts}</span>; }
function Item({ item, model: vm, ...props }: MockupSlotProps & { item: FeedbackItem }) {
  const badge = usePart('mockup', 'badge'), kind = usePart('mockup', 'kindIcon'), chip = usePart('mockup', 'target'), button = usePart('mockup', 'button'), content = usePart('mockup', 'rowContent'), text = usePart('mockup', 'rowText');
  return <span {...props} role="listitem" data-feedback-row={item.id} data-active={vm.active === item.id || undefined} data-resolved={item.resolved || undefined} data-submitted={vm.submitted || undefined} onMouseEnter={() => vm.highlight(item.id)} onMouseLeave={() => vm.highlight(null)} onFocus={() => vm.highlight(item.id)} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node)) vm.highlight(null); }}>
    <PrismPart as="button" {...content} slotProps={{ model: vm, item }} type="button" disabled={item.resolved || vm.submitted} aria-label={vm.labels.openComment.replace('{n}', String(item.n))} onClick={() => vm.open(item.id)}>
      <PrismPart as="span" {...badge} slotProps={{ model: vm }}>{item.resolved ? <Icon name="check" /> : item.n}</PrismPart>
      <PrismPart as="span" {...kind} slotProps={{ model: vm }} aria-hidden="true"><Icon name={item.kind === 'pin' ? 'pin' : item.kind === 'region' ? 'region' : 'pen'} /></PrismPart>
      <PrismPart as="span" {...text} slotProps={{ model: vm }} data-placeholder={!item.comment || undefined}>{item.comment || vm.labels.placeholder}<PrismPart as="span" {...chip} slotProps={{ model: vm }}>{item.target?.text || item.target?.selector || vm.labels.targetPoint.replace('{x}', String(Math.round(item.x))).replace('{y}', String(Math.round(item.y)))}</PrismPart></PrismPart>
    </PrismPart>
    {!item.resolved && <><PrismPart as="button" {...button} slotProps={{ model: vm }} type="button" disabled={vm.submitted} title={vm.labels.edit} aria-label={vm.labels.editComment.replace('{n}', String(item.n))} onClick={() => vm.open(item.id)}><Icon name="pen" /></PrismPart><PrismPart as="button" {...button} slotProps={{ model: vm }} type="button" disabled={vm.submitted} title={vm.labels.delete} aria-label={vm.labels.deleteComment.replace('{n}', String(item.n))} onClick={() => vm.remove(item.id)}><Icon name="trash" /></PrismPart></>}
  </span>;
}
export function MockupList({ vm }: { vm: MockupModel }) {
  const { animate, unstyled } = usePrism(), flip = useFlip<HTMLSpanElement>(animate && !unstyled, '[data-feedback-row]');
  const list = usePart('mockup', 'list'), row = usePart('mockup', 'item'), empty = usePart('mockup', 'empty');
  const Row = useSlot('mockup', 'item', Item), EmptyState = useSlot('mockup', 'empty', Empty);
  return <PrismPart as="span" {...list} slotProps={{ model: vm }} ref={node => { flip.current = node; vm.listRef.current = node; }} role={vm.resolved.length || vm.state.items.length ? 'list' : undefined} data-prism-flash={vm.flash ? '' : undefined}>
    {vm.resolved.length || vm.state.items.length ? [...vm.resolved,...vm.state.items].map(item => <Row key={item.id} {...row} model={vm} item={item as FeedbackItem} />) : <EmptyState {...empty} model={vm} />}
  </PrismPart>;
}
