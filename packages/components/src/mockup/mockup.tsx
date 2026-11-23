import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ComponentPropsWithRef, type ElementType } from 'react';
import { PrismPart, defineComponent, useCollapse, usePart, usePrism, useSlot, type PrismComponentProps } from '@prism-ui/react';
import { s } from '@prism-ui/schema';
import { ComponentFrame } from '../frame';
import { MockupToolbar, MockupSource, MockupFooter } from './chrome';
import { WIREFRAME_DOCS, type FeedbackItem } from './engine';
import { MockupIcon as Icon } from './icon';
import { GroupedMockup } from './group';
import { mockupLabels, useMockup, type MockupModel, type MockupProps } from './use-mockup';

export type MockupSlotProps<T extends ElementType = 'div'> = ComponentPropsWithRef<T> & { as?: T; model: MockupModel; vm?: MockupModel; item?: FeedbackItem };
function motionTime(value: string, fallback: number) {
  const number = Number.parseFloat(value);
  return Number.isFinite(number) ? Math.max(0, number * (value.trim().endsWith('ms') ? 1 : 1000)) : fallback;
}
function Empty({ model: vm, ...part }: MockupSlotProps<'p'>) { return <p {...part}>{vm.labels.empty}</p>; }
function Item({ item, model: vm, ...attributes }: MockupSlotProps & { item: FeedbackItem }) {
  const row = usePart('mockup', 'item'), badge = usePart('mockup', 'badge'), chip = usePart('mockup', 'target'), button = usePart('mockup', 'button');
  return <div {...row} {...attributes} data-active={vm.active === item.id || undefined} data-resolved={item.resolved || undefined} onMouseEnter={() => vm.setActive(item.id)} onMouseLeave={() => vm.setActive(null)} onFocus={() => vm.setActive(item.id)} onBlur={() => vm.setActive(null)}>
    <PrismPart slotProps={{ model: vm }} as="span" {...badge}>{item.resolved ? <Icon name="check" /> : item.n}</PrismPart><span aria-hidden="true"><Icon name={item.kind === 'pin' ? 'pin' : item.kind === 'region' ? 'region' : 'pen'} /></span><div><span>{item.comment || vm.labels.placeholder}</span>{item.target?.text && <PrismPart slotProps={{ model: vm }} as="span" {...chip}>{item.target.text}</PrismPart>}</div>
    {!item.resolved && !vm.submitted && <><PrismPart slotProps={{ model: vm }} as="button" {...button} data-prism-reveal="" title={vm.labels.edit} aria-label={vm.labels.editComment.replace('{n}', String(item.n))} onClick={() => vm.open(item.id)}><Icon name="pen" /></PrismPart><PrismPart slotProps={{ model: vm }} as="button" {...button} data-prism-reveal="" title={vm.labels.delete} aria-label={vm.labels.deleteComment.replace('{n}', String(item.n))} onClick={() => vm.remove(item.id)}><Icon name="trash" /></PrismPart></>}
  </div>;
}
function CommentRow({ vm, item, exiting, index, remove }: { vm: MockupModel; item: FeedbackItem; exiting: boolean; index: number; remove(): void }) {
  const part = usePart('mockup', 'item'), Row = useSlot('mockup', 'item', Item), { animate, unstyled } = usePrism();
  const element = useRef<HTMLDivElement | null>(null), removeRef = useRef(remove);
  const spacing = useRef<{ padding: string; border: string } | undefined>(undefined);
  removeRef.current = remove;
  useLayoutEffect(() => {
    if (!exiting && element.current && spacing.current) { element.current.style.paddingBlock = spacing.current.padding; element.current.style.borderBlockWidth = spacing.current.border; spacing.current = undefined; }
  }, [exiting]);
  const collapse = useCollapse(!exiting);
  useLayoutEffect(() => {
    element.current = collapse.ref.current;
    if (exiting && element.current) {
      spacing.current ??= { padding: element.current.style.paddingBlock, border: element.current.style.borderBlockWidth };
      element.current.style.paddingBlock = '0'; element.current.style.borderBlockWidth = '0';
    }
  }, [exiting]);
  useEffect(() => {
    if (!exiting) return;
    const duration = motionTime(element.current ? getComputedStyle(element.current).getPropertyValue('--prism-motion-fast') : '', 160);
    const timer = setTimeout(() => removeRef.current(), duration);
    return () => clearTimeout(timer);
  }, [exiting]);
  return <Row {...part} {...collapse} item={item} model={vm} inert={exiting || undefined} data-closing={exiting ? '' : undefined} data-prism-enter={animate && !unstyled && !exiting ? '' : undefined} style={{ ...part.style, ...collapse.style, '--prism-motion-index': Math.min(index, 8) } as CSSProperties} onMouseEnter={() => vm.setActive(item.id)} onMouseLeave={() => vm.setActive(null)} onFocus={() => vm.setActive(item.id)} onBlur={() => vm.setActive(null)} />;
}
function CommentList({ vm }: { vm: MockupModel }) {
  const { animate, unstyled } = usePrism(), empty = usePart('mockup', 'empty'), EmptyState = useSlot('mockup', 'empty', Empty);
  const retained = useRef(new Map<string, FeedbackItem>()), order = useRef<string[]>([]), [, redraw] = useState(0);
  const items = [...vm.resolved, ...vm.state.items], ids = new Set(items.map(item => item.id));
  for (const item of items) retained.current.set(item.id, item);
  if (!animate || unstyled) for (const id of retained.current.keys()) if (!ids.has(id)) retained.current.delete(id);
  const rows = [...items];
  order.current.forEach((id, index) => { const item = retained.current.get(id); if (item && !ids.has(id)) rows.splice(index, 0, item); });
  order.current = rows.map(item => item.id);
  return rows.length ? rows.map((item, index) => <CommentRow key={item.id} vm={vm} item={item} index={index} exiting={!ids.has(item.id)} remove={() => { retained.current.delete(item.id); redraw(value => value + 1); }} />) : <EmptyState {...empty} model={vm} />;
}
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
  const { animate, unstyled } = usePrism();
  const active = open && !!vm.editing && !vm.submitted, enabled = animate && !unstyled;
  const cached = useRef(vm), ref = useRef<HTMLDivElement>(null), [present, setPresent] = useState(active);
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
function Marker({ item, vm }: { item: FeedbackItem; vm: MockupModel }) {
  const marker = usePart('mockup', 'marker'), stroke = usePart('mockup', 'stroke');
  const label = item.resolved ? vm.labels.resolvedComment.replace('{n}', String(item.n)).replace('{text}', item.comment) : vm.labels.comment.replace('{n}', String(item.n)).replace('{text}', item.comment || vm.labels.placeholder);
  return <>
    {item.kind === 'drawing' && <PrismPart slotProps={{ model: vm }} as="svg" {...stroke} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d={item.path} fill="none" stroke={item.color ?? 'var(--prism-mockup-accent, var(--prism-accent-text))'} strokeWidth="2" vectorEffect="non-scaling-stroke" style={{ pointerEvents: 'stroke', cursor: 'pointer' }} onClick={() => { if (!item.resolved && !vm.submitted) vm.open(item.id); }} /></PrismPart>}
    <PrismPart slotProps={{ model: vm }} as="button" {...marker} type="button" data-kind={item.kind} data-resolved={item.resolved || undefined} data-active={vm.active === item.id || vm.editing?.id === item.id || undefined} style={{ ...marker.style, left: `${item.x}%`, top: `${item.y}%`, ...(item.kind === 'region' ? { width: `${item.w}%`, height: `${item.h}%` } : {}) }} aria-label={label} aria-disabled={item.resolved || undefined} onMouseEnter={() => vm.setActive(item.id)} onMouseLeave={() => vm.setActive(null)} onFocus={() => vm.setActive(item.id)} onBlur={() => vm.setActive(null)} onClick={() => { if (!item.resolved && !vm.submitted) vm.open(item.id); }} onKeyDown={event => { if (item.resolved || vm.submitted) return; if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); vm.remove(item.id); } if (event.key.startsWith('Arrow')) { event.preventDefault(); vm.move(item.id, item.x + (event.key === 'ArrowRight' ? 2 : event.key === 'ArrowLeft' ? -2 : 0), item.y + (event.key === 'ArrowDown' ? 2 : event.key === 'ArrowUp' ? -2 : 0)); } }}>
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
export function MockupView({ vm, feedback = true, embedded = false }: { vm: MockupModel; feedback?: boolean; embedded?: boolean }) {
  const { unstyled } = usePrism();
  const root = usePart('mockup', 'member'), layout = usePart('mockup', 'layout'), viewport = usePart('mockup', 'viewport'), spacer = usePart('mockup', 'spacer'), stage = usePart('mockup', 'stage'), media = usePart('mockup', 'media'), skeleton = usePart('mockup', 'skeleton'), list = usePart('mockup', 'list'), input = usePart('mockup', 'input'), live = usePart('mockup', 'live'), overall = usePart('mockup', 'overall');
  const tools = embedded ? undefined : <MockupToolbar model={vm} vm={vm} />;
  return <PrismPart slotProps={{ model: vm }} as="div" {...root} ref={vm.root} data-prism-reveal-host={unstyled ? undefined : ''} data-open={vm.editing ? '' : undefined} style={{ ...root.style, '--prism-mockup-scale': vm.scale, '--prism-mockup-inverse-scale': 1 / vm.scale } as CSSProperties} onKeyDown={vm.onKeyDown} data-device={vm.device} data-kind={vm.kind} data-embedded={embedded || undefined} data-expanded={vm.expanded || undefined} data-state={vm.submitted ? 'sent' : vm.complete ? 'ready' : 'streaming'}>
    <ComponentFrame slotProps={{ model: vm }} component="mockup" title={embedded ? undefined : vm.title} label={vm.title} ask={!embedded} undo={false} state={vm.submitted ? 'sent' : vm.complete ? 'ready' : 'streaming'} toolbar={tools}>
      {!embedded && vm.showSource && <MockupSource model={vm} vm={vm} />}
      <PrismPart slotProps={{ model: vm }} as="div" {...layout}><PrismPart slotProps={{ model: vm }} as="div" {...viewport} ref={vm.viewport} style={{ ...viewport.style, maxHeight: vm.props.height ?? '70vh' }}>
        <PrismPart slotProps={{ model: vm }} as="div" {...spacer} style={{ ...spacer.style, width: vm.width * vm.scale, height: vm.framed ? Math.ceil(vm.contentHeight * vm.scale) : vm.contentHeight * vm.scale }}><PrismPart slotProps={{ model: vm }} as="div" {...stage} style={{ ...stage.style, width: vm.width, height: vm.contentHeight, transform: `scale(${vm.scale})` }}>
          {!vm.visible ? <PrismPart slotProps={{ model: vm }} as="div" {...skeleton} role="status" aria-label={vm.labels.loading} /> : <>
            {vm.framed ? <PrismPart slotProps={{ model: vm }} as="iframe" {...media} ref={vm.iframe} title={vm.title} sandbox="allow-scripts" style={{ ...media.style, width: vm.width, height: vm.contentHeight }} /> : vm.kind === 'svg' ? <PrismPart slotProps={{ model: vm }} as="div" {...media} ref={vm.graphic} dangerouslySetInnerHTML={{ __html: vm.svg }} /> : vm.imageSrc && !vm.imageError ? <PrismPart slotProps={{ model: vm }} as="img" {...media} src={vm.imageSrc} alt={vm.title} loading="lazy" decoding="async" onLoad={event => vm.imageLoaded(event.currentTarget.naturalWidth, event.currentTarget.naturalHeight)} onError={() => vm.setImageError(true)} /> : <PrismPart slotProps={{ model: vm }} as="div" {...skeleton} role="status">{vm.source || vm.props.src ? vm.labels.imageError : vm.labels.loading}</PrismPart>}
            <MockupAnnotations vm={vm} popover={false} />
          </>}
        </PrismPart></PrismPart>
      </PrismPart><PrismPart slotProps={{ model: vm }} as="div" {...list} data-prism-flash={vm.flash ? "" : undefined}><CommentList vm={vm} /></PrismPart></PrismPart>
      {feedback && <>
        {!vm.submitted && <PrismPart slotProps={{ model: vm }} as="label" {...overall}>{vm.labels.overall}<PrismPart slotProps={{ model: vm }} as="textarea" {...input} value={vm.state.overall} onChange={event => vm.feedback.setOverall(event.target.value)} onBlur={vm.saveOverall} /></PrismPart>}
        <MockupFooter model={vm} labels={vm.labels} locale={vm.locale} count={vm.submitted ? vm.feedback.toPayload().items.length : vm.state.items.length} submitted={vm.submitted} edit={() => vm.setSubmitted(false)} canUndo={vm.feedback.canUndo} canRedo={vm.feedback.canRedo} undo={() => { vm.close(); vm.feedback.undo(); }} redo={() => { vm.close(); vm.feedback.redo(); }} canSubmit={vm.canSubmit} submit={vm.submit} commitOverall={vm.saveOverall} />
      </>}
      <PrismPart slotProps={{ model: vm }} as="span" {...live} aria-live="polite">{vm.announcement}</PrismPart>
    </ComponentFrame>
    <MockupComment vm={vm} open={vm.visible} />
  </PrismPart>;
}
function SingleMockup({ props }: { props: MockupProps }) { return <MockupView vm={useMockup(props, usePrism())} />; }
export function Mockup({ props }: PrismComponentProps<MockupProps>) { return props.group ? <GroupedMockup props={props} /> : <SingleMockup props={props} />; }

const previousItemSchema = s.object({
  n: s.number().describe('Original comment number').example(1),
  kind: s.enum(['pin', 'region', 'drawing']).describe('Feedback geometry').example('pin'),
  x: s.number().describe('Horizontal position in percent').example(50),
  y: s.number().describe('Vertical position in percent').example(20),
  w: s.number().optional().describe('Region width in percent').example(20),
  h: s.number().optional().describe('Region height in percent').example(10),
  path: s.string().optional().describe('Drawing SVG path in percent coordinates').example('M10 10L20 20'),
  comment: s.string().describe('Earlier comment text').example('Larger title'),
  target: s.object({ selector: s.string().describe('Selector relative to the design document').example('h1'), text: s.string().optional().describe('Target text excerpt').example('Pricing'), html: s.string().optional().describe('Target markup excerpt').example('<h1>Pricing</h1>') }).optional().describe('Earlier target element').example({ selector: 'h1', text: 'Pricing', html: '<h1>Pricing</h1>' }),
});
export const mockupSchema = s.object({
  id: s.string().optional().describe('Persistent mockup identifier').example('pricing'),
  kind: s.enum(['html', 'svg', 'wire', 'image']).default('html').describe('Design source format').example('html'),
  source: s.string().optional().describe('HTML, SVG, wireframe shorthand or an image URL; fence body').example('<h1>Pricing</h1>'),
  src: s.string().optional().describe('Image URL, only https: or data:image/').example('https://example.com/design.png'),
  title: s.string().optional().describe('Design title used in feedback').example('Pricing'),
  device: s.enum(['desktop', 'tablet', 'mobile']).default('desktop').describe('Initial viewport; 1280, 834 or 390 pixels').example('mobile'),
  variant: s.string().optional().describe('Variant name included in feedback').example('A'),
  group: s.string().optional().describe('Consecutive mockups sharing this identifier become switchable variants with side-by-side compare').example('pricing-options'),
  height: s.number().optional().describe('Maximum visible viewport height in pixels; content scrolls outside the frame').example(600),
  previous: s.object({
    mockup: s.string().optional().describe('Earlier design title').example('Pricing'),
    variant: s.string().optional().describe('Earlier variant').example('A'),
    device: s.string().optional().describe('Earlier viewport').example('desktop'),
    overall: s.string().describe('Earlier overall feedback').example('Simplify the layout'),
    items: s.array(previousItemSchema).describe('Earlier items to show resolved, excluded from new submissions').example([]),
  }).optional().describe('Earlier feedback payload object').example({ mockup: 'Pricing', variant: 'A', device: 'desktop', overall: '', items: [] }),
  labels: s.object(Object.fromEntries(Object.entries(mockupLabels).map(([key, value]) => [key, s.string().optional().describe(`Translated ${key} label; retain placeholders`).example(value)]))).optional().describe('Interface label overrides').example(mockupLabels),
});
export const mockupDefinition = defineComponent({ name: 'mockup', parts: ["overflow","overflowTrigger","overflowContent","devices","sourceCode","count","ask","badge","body","button","canvas","column","columns","empty","feedbackFooter","footer","group","header","headerActions","hint","input","item","layout","list","live","marker","media","member","overall","popover","primary","reticle","root","sharedTools","skeleton","source","spacer","stage","streamDot","stroke","tab","tabs","target","title","toolbar","tools","undo","viewport"], strings: mockupLabels, requiresFinalId: true, schema: mockupSchema, component: Mockup, syntax: 'leaf', docs: `Interactive design review. Use mockupPlugin for mockup:html|svg|wire|image fences; without it they remain ordinary code blocks. Direct ::mockup directives need no plugin. Consecutive blocks sharing group become variants with tabs and Compare. Group feedback includes variants with items and optional preferred variant. Submit emits feedback and a readable summary. HTML/wire run in an opaque sandbox; SVG is sanitised inline. Image URLs allow only https: and data:image/. ${WIREFRAME_DOCS}`, examples: ['```mockup:svg {id=compare-a group=design variant=A}\n<svg viewBox="0 0 100 100"><rect width="100" height="100"/></svg>\n```\n\n```mockup:svg {id=compare-b group=design variant=B}\n<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="30"/></svg>\n```', '```mockup:html {id=pricing title="Pricing" device=mobile}\n<h1>Pricing</h1>\n```', '```mockup:svg {title="Logo"}\n<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40"/></svg>\n```', '```mockup:wire {title="Landing"}\nnav: Logo | Home | [Sign up]\nhero: # Hello / Welcome / [Start]\ngrid 3: card*3\n```', '::mockup{kind=image src="https://example.com/design.png" title="Poster"}'] });
