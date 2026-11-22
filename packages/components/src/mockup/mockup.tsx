import type { CSSProperties } from 'react';
import { PrismPart, defineComponent, usePart, usePrism, useSlot, type PrismComponentProps } from '@prism-ui/react';
import { s } from '@prism-ui/schema';
import { ComponentFrame } from '../frame';
import { MockupToolbar, MockupPenTools, MockupSource, MockupFooter } from './chrome';
import { WIREFRAME_DOCS, type FeedbackItem } from './engine';
import { MockupIcon as Icon } from './icon';
import { GroupedMockup } from './group';
import { mockupLabels, useMockup, type MockupModel, type MockupProps } from './use-mockup';

function Empty({ vm }: { vm: MockupModel }) { return <PrismPart as="p" {...usePart('mockup', 'empty')}>{vm.labels.empty}</PrismPart>; }
function Item({ item, vm }: { item: FeedbackItem; vm: MockupModel }) {
  const row = usePart('mockup', 'item'), badge = usePart('mockup', 'badge'), chip = usePart('mockup', 'target'), button = usePart('mockup', 'button');
  return <PrismPart as="div" {...row} data-active={vm.active === item.id || undefined} data-resolved={item.resolved || undefined} onMouseEnter={() => vm.setActive(item.id)} onMouseLeave={() => vm.setActive(null)} onFocus={() => vm.setActive(item.id)} onBlur={() => vm.setActive(null)}>
    <PrismPart as="span" {...badge}>{item.resolved ? <Icon name="check" /> : item.n}</PrismPart><span aria-hidden="true"><Icon name={item.kind === 'pin' ? 'pin' : item.kind === 'region' ? 'region' : 'pen'} /></span><div><span>{item.comment || vm.labels.placeholder}</span>{item.target?.text && <PrismPart as="span" {...chip}>{item.target.text}</PrismPart>}</div>
    {!item.resolved && !vm.submitted && <><PrismPart as="button" {...button} title={vm.labels.edit} aria-label={`${vm.labels.edit} ${item.n}`} onClick={() => vm.open(item.id)}><Icon name="pen" /></PrismPart><PrismPart as="button" {...button} title={vm.labels.delete} aria-label={`${vm.labels.delete} ${item.n}`} onClick={() => vm.remove(item.id)}><Icon name="trash" /></PrismPart></>}
  </PrismPart>;
}
function Popover({ vm }: { vm: MockupModel }) {
  const part = usePart('mockup', 'popover'), input = usePart('mockup', 'input'), primary = usePart('mockup', 'primary'), button = usePart('mockup', 'button');
  const item = vm.state.items.find(item => item.id === vm.editing?.id); if (!item) return null;
  return <PrismPart as="span" {...part} role="dialog" aria-label={vm.labels.comment.replace('{n}', String(item.n)).replace('{text}', item.comment)} style={{ ...part.style, ...vm.popoverPosition(item.x, item.y) }}>
    <PrismPart as="textarea" {...input} autoFocus aria-label={vm.labels.placeholder} placeholder={vm.labels.placeholder} value={vm.comment} onChange={event => vm.setComment(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); vm.save(true); } if (event.key === 'Escape') { event.stopPropagation(); vm.cancel(); } }} />
    <PrismPart as="button" {...primary} onClick={() => vm.save()}>{vm.labels.save}</PrismPart><PrismPart as="button" {...button} onClick={() => vm.remove(item.id)}>{vm.labels.delete}</PrismPart>
  </PrismPart>;
}
function Marker({ item, vm }: { item: FeedbackItem; vm: MockupModel }) {
  const marker = usePart('mockup', 'marker'), stroke = usePart('mockup', 'stroke');
  const label = item.resolved ? `${vm.labels.resolved} ${item.n}: ${item.comment}` : vm.labels.comment.replace('{n}', String(item.n)).replace('{text}', item.comment || vm.labels.placeholder);
  return <>
    {item.kind === 'drawing' && <PrismPart as="svg" {...stroke} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d={item.path} fill="none" stroke={item.color ?? 'var(--prism-accent, #525252)'} strokeWidth="2" vectorEffect="non-scaling-stroke" style={{ pointerEvents: 'stroke', cursor: 'pointer' }} onClick={() => { if (!item.resolved && !vm.submitted) vm.open(item.id); }} /></PrismPart>}
    <PrismPart as="button" {...marker} type="button" data-kind={item.kind} data-resolved={item.resolved || undefined} data-active={vm.active === item.id || undefined} style={{ ...marker.style, left: `${item.x}%`, top: `${item.y}%`, ...(item.kind === 'region' ? { width: `${item.w}%`, height: `${item.h}%` } : {}) }} aria-label={label} aria-disabled={item.resolved || undefined} onMouseEnter={() => vm.setActive(item.id)} onMouseLeave={() => vm.setActive(null)} onFocus={() => vm.setActive(item.id)} onBlur={() => vm.setActive(null)} onClick={() => { if (!item.resolved && !vm.submitted) vm.open(item.id); }} onKeyDown={event => { if (!item.resolved && !vm.submitted && (event.key === 'Delete' || event.key === 'Backspace')) { event.preventDefault(); vm.remove(item.id); } }}><span>{item.resolved ? '✓' : item.n}</span></PrismPart>
  </>;
}
export function MockupAnnotations({ vm }: { vm: MockupModel }) {
  const canvas = usePart('mockup', 'canvas'), reticle = usePart('mockup', 'reticle'), hint = usePart('mockup', 'hint'), stroke = usePart('mockup', 'stroke');
  const Comment = useSlot('mockup', 'popover', Popover);
  return <>
    <PrismPart as="span" {...canvas} {...vm.pointer} ref={vm.canvas} tabIndex={0} role="application" aria-label={vm.labels.canvas} onKeyDown={vm.canvasKey} onFocus={() => vm.setFocused(true)} onBlur={() => vm.setFocused(false)} data-disabled={vm.submitted || undefined}>
      {vm.focused && <PrismPart as="span" {...reticle} style={{ ...reticle.style, left: `${vm.reticle[0]}%`, top: `${vm.reticle[1]}%` }}>+</PrismPart>}
      {vm.hover && !vm.state.items.length && !vm.submitted && <PrismPart as="span" {...hint} style={{ ...hint.style, left: `${Math.min(65, vm.hover[0])}%`, top: `${vm.hover[1]}%` }}>{vm.labels.hint}</PrismPart>}
      {vm.rubber.length > 0 && <PrismPart as="svg" {...stroke} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">{vm.pen ? <polyline points={vm.rubber.map(p => p.join(',')).join(' ')} fill="none" stroke={vm.color} strokeWidth="2" vectorEffect="non-scaling-stroke" /> : <rect x={Math.min(vm.rubber[0][0], vm.rubber.at(-1)![0])} y={Math.min(vm.rubber[0][1], vm.rubber.at(-1)![1])} width={Math.abs(vm.rubber[0][0] - vm.rubber.at(-1)![0])} height={Math.abs(vm.rubber[0][1] - vm.rubber.at(-1)![1])} fill="color-mix(in srgb, var(--prism-accent, #525252) 8%, transparent)" stroke="var(--prism-accent, #525252)" vectorEffect="non-scaling-stroke" />}</PrismPart>}
    </PrismPart>
    {[...vm.resolved, ...vm.state.items].map(item => <Marker key={item.id} item={item as FeedbackItem} vm={vm} />)}{vm.editing && !vm.submitted && <Comment vm={vm} />}
  </>;
}
export function MockupView({ vm, feedback = true, embedded = false }: { vm: MockupModel; feedback?: boolean; embedded?: boolean }) {
  const root = usePart('mockup', 'member'), layout = usePart('mockup', 'layout'), viewport = usePart('mockup', 'viewport'), spacer = usePart('mockup', 'spacer'), stage = usePart('mockup', 'stage'), canvas = usePart('mockup', 'canvas'), media = usePart('mockup', 'media'), skeleton = usePart('mockup', 'skeleton'), list = usePart('mockup', 'list'), input = usePart('mockup', 'input'), hint = usePart('mockup', 'hint'), live = usePart('mockup', 'live'), reticle = usePart('mockup', 'reticle'), stroke = usePart('mockup', 'stroke'), overall = usePart('mockup', 'overall');
  const Row = useSlot('mockup', 'item', Item), EmptyState = useSlot('mockup', 'empty', Empty), Comment = useSlot('mockup', 'popover', Popover);
  const tools = embedded ? undefined : <MockupToolbar vm={vm} />;
  return <PrismPart as="div" {...root} ref={vm.root} style={{ ...root.style, '--prism-mockup-scale': vm.scale, '--prism-mockup-inverse-scale': 1 / vm.scale } as CSSProperties} onKeyDown={vm.onKeyDown} data-device={vm.device} data-kind={vm.kind} data-embedded={embedded || undefined} data-state={vm.expanded ? 'expanded' : vm.submitted ? 'submitted' : vm.complete ? 'done' : 'streaming'}>
    <ComponentFrame component="mockup" title={embedded ? undefined : vm.title} label={vm.title} ask={!embedded} undo={false} state={vm.submitted ? 'submitted' : vm.complete ? 'done' : 'streaming'} toolbar={tools}>
      {!embedded && vm.showSource && <MockupSource vm={vm} />}
      {!embedded && !vm.submitted && <MockupPenTools vm={vm} />}
      <PrismPart as="div" {...layout}><PrismPart as="div" {...viewport} ref={vm.viewport} style={{ ...viewport.style, maxHeight: vm.props.height ?? '70vh' }}>
        <PrismPart as="div" {...spacer} style={{ ...spacer.style, width: vm.width * vm.scale, height: vm.framed ? Math.ceil(vm.contentHeight * vm.scale) : vm.contentHeight * vm.scale }}><PrismPart as="div" {...stage} style={{ ...stage.style, width: vm.width, height: vm.contentHeight, transform: `scale(${vm.scale})` }}>
          {!vm.visible ? <PrismPart as="div" {...skeleton} role="status" aria-label={vm.labels.loading} /> : <>
            {vm.framed ? <PrismPart as="iframe" {...media} ref={vm.iframe} title={vm.title} sandbox="allow-scripts" style={{ ...media.style, width: vm.width, height: vm.contentHeight }} /> : vm.kind === 'svg' ? <PrismPart as="div" {...media} ref={vm.graphic} dangerouslySetInnerHTML={{ __html: vm.svg }} /> : vm.imageSrc && !vm.imageError ? <PrismPart as="img" {...media} src={vm.imageSrc} alt={vm.title} loading="lazy" decoding="async" onLoad={event => vm.imageLoaded(event.currentTarget.naturalWidth, event.currentTarget.naturalHeight)} onError={() => vm.setImageError(true)} /> : <PrismPart as="div" {...skeleton} role="status">{vm.source || vm.props.src ? vm.labels.imageError : vm.labels.loading}</PrismPart>}
            <MockupAnnotations vm={vm} />
          </>}
        </PrismPart></PrismPart>
      </PrismPart><PrismPart as="div" {...list}>{vm.state.items.length || vm.resolved.length ? [...vm.resolved, ...vm.state.items].map(item => <Row key={item.id} item={item as FeedbackItem} vm={vm} />) : <EmptyState vm={vm} />}</PrismPart></PrismPart>
      {feedback && <>
        {!vm.submitted && <PrismPart as="label" {...overall}>{vm.labels.overall}<PrismPart as="textarea" {...input} value={vm.state.overall} onChange={event => vm.feedback.setOverall(event.target.value)} /></PrismPart>}
        <MockupFooter labels={vm.labels} locale={vm.locale} count={vm.submitted ? vm.feedback.toPayload().items.length : vm.state.items.length} submitted={vm.submitted} edit={() => vm.setSubmitted(false)} canUndo={vm.feedback.canUndo} canRedo={vm.feedback.canRedo} undo={() => { vm.close(); vm.feedback.undo(); }} redo={() => { vm.close(); vm.feedback.redo(); }} canSubmit={vm.canSubmit} submit={vm.submit} />
      </>}
      <PrismPart as="span" {...live} aria-live="polite">{vm.announcement}</PrismPart>
    </ComponentFrame>
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
export const mockupDefinition = defineComponent({ name: 'mockup', parts: ["ask","badge","body","button","canvas","column","columns","empty","feedbackFooter","footer","group","header","headerActions","hint","input","item","layout","list","live","marker","media","member","overall","popover","primary","reticle","root","sharedTools","skeleton","source","spacer","stage","streamDot","stroke","tab","tabs","target","title","toolbar","tools","undo","viewport"], strings: mockupLabels, requiresFinalId: true, schema: mockupSchema, component: Mockup, syntax: 'leaf', docs: `Interactive design review. Use mockupPlugin for mockup:html|svg|wire|image fences; without it they remain ordinary code blocks. Direct ::mockup directives need no plugin. Consecutive blocks sharing group become variants with tabs and Compare. Group feedback includes variants with items and optional preferred variant. Submit emits feedback and a readable summary. HTML/wire run in an opaque sandbox; SVG is sanitised inline. Image URLs allow only https: and data:image/. ${WIREFRAME_DOCS}`, examples: ['```mockup:html {id=pricing title="Pricing" device=mobile}\n<h1>Pricing</h1>\n```', '```mockup:svg {title="Logo"}\n<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40"/></svg>\n```', '```mockup:wire {title="Landing"}\nnav: Logo | Home | [Sign up]\nhero: # Hello / Welcome / [Start]\ngrid 3: card*3\n```', '::mockup{kind=image src="https://example.com/design.png" title="Poster"}'] });
