import { useLayoutEffect, useRef, useState, type CSSProperties, type ComponentPropsWithRef, type ElementType } from 'react';
import { PrismPart, defineComponent, usePart, usePrism, useSlot, usePresentation, type PrismComponentProps } from '@prism-ui/react';
import { s } from '@prism-ui/schema';
import { ComponentFrame } from '../frame';
import { MockupToolbar, MockupSource, MockupFooter } from './chrome';
import { WIREFRAME_DOCS, type FeedbackItem } from './engine';
import { MockupIcon as Icon } from './icon';
import { GroupedMockup } from './group';
import { mockupLabels, useMockup, type MockupModel, type MockupProps } from './use-mockup';
import { GestureOverlay, useCanvasSize } from './gesture';
import { drawingOutline } from './outline';
import { MockupList } from './annotation-list';
import { revealComposerInput, useComposerViewport } from './viewport';

export type MockupSlotProps<T extends ElementType = 'div'> = ComponentPropsWithRef<T> & { as?: T; model: MockupModel; vm?: MockupModel; item?: FeedbackItem };
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
    <PrismPart slotProps={{ model: vm }} as="button" {...marker} type="button" data-feedback-id={item.id} aria-hidden={submitted || undefined} tabIndex={submitted ? -1 : undefined} data-created={created || undefined} data-submitted={submitted || undefined} onAnimationEnd={event => { if (event.target === event.currentTarget) setCreated(false); }} data-kind={item.kind} data-resolved={item.resolved || undefined} data-active={vm.active === item.id || vm.editing?.id === item.id || undefined} style={{ ...marker.style, left: `${item.x}%`, top: `${item.y}%`, ...(item.kind === 'region' ? { width: `${item.w}%`, height: `${item.h}%` } : {}) }} aria-label={label} aria-disabled={item.resolved || undefined} onMouseEnter={() => vm.highlight(item.id, true)} onMouseLeave={() => vm.highlight(null)} onFocus={() => vm.highlight(item.id, true)} onBlur={() => vm.highlight(null)} onClick={() => { if (!item.resolved && !vm.submitted) vm.open(item.id); }} onKeyDown={event => { if (item.resolved || vm.submitted) return; if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); vm.remove(item.id); } if (event.key.startsWith('Arrow')) { event.preventDefault(); vm.move(item.id, item.x + (event.key === 'ArrowRight' ? 2 : event.key === 'ArrowLeft' ? -2 : 0), item.y + (event.key === 'ArrowDown' ? 2 : event.key === 'ArrowUp' ? -2 : 0)); } }}>
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
export function MockupView({ vm, feedback = true, embedded = false }: { vm: MockupModel; feedback?: boolean; embedded?: boolean }) {
  const { unstyled } = usePrism();
  const root = usePart('mockup', 'member'), layout = usePart('mockup', 'layout'), viewport = usePart('mockup', 'viewport'), spacer = usePart('mockup', 'spacer'), stage = usePart('mockup', 'stage'), media = usePart('mockup', 'media'), skeleton = usePart('mockup', 'skeleton'), input = usePart('mockup', 'input'), live = usePart('mockup', 'live'), overall = usePart('mockup', 'overall');
  const tools = embedded ? undefined : <MockupToolbar model={vm} vm={vm} />;
  return <PrismPart slotProps={{ model: vm }} as="div" {...root} ref={vm.root} data-prism-reveal-host={unstyled ? undefined : ''} data-open={vm.editing ? '' : undefined} style={{ ...root.style, '--prism-mockup-scale': vm.scale, '--prism-mockup-inverse-scale': 1 / vm.scale } as CSSProperties} onKeyDown={vm.onKeyDown} data-device={vm.device} data-kind={vm.kind} data-embedded={embedded || undefined} data-expanded={vm.expanded || undefined} data-state={vm.submitted ? 'sent' : vm.complete ? 'ready' : 'streaming'}>
    <ComponentFrame slotProps={{ model: vm }} component="mockup" onEscape={vm.onKeyDown} title={embedded ? undefined : vm.title} label={vm.title} ask={!embedded} undo={false} state={vm.submitted ? 'sent' : vm.complete ? 'ready' : 'streaming'} toolbar={tools}>
      {!embedded && vm.showSource && <MockupSource model={vm} vm={vm} />}
      <PrismPart slotProps={{ model: vm }} as="div" {...layout}><PrismPart slotProps={{ model: vm }} as="div" {...viewport} ref={vm.viewport} style={{ ...viewport.style, maxHeight: vm.props.height ?? '70vh' }}>
        <PrismPart slotProps={{ model: vm }} as="div" {...spacer} style={{ ...spacer.style, width: vm.width * vm.scale, height: vm.framed ? Math.ceil(vm.contentHeight * vm.scale) : vm.contentHeight * vm.scale }}><PrismPart slotProps={{ model: vm }} as="div" {...stage} style={{ ...stage.style, width: vm.width, height: vm.contentHeight, transform: `scale(${vm.scale})` }}>
          {!vm.visible ? <PrismPart slotProps={{ model: vm }} as="div" {...skeleton} role="status" aria-label={vm.labels.loading} /> : <>
            {vm.framed ? <PrismPart slotProps={{ model: vm }} as="iframe" {...media} ref={vm.iframe} title={vm.title} sandbox="allow-scripts" style={{ ...media.style, width: vm.width, height: vm.contentHeight }} /> : vm.kind === 'svg' ? <PrismPart slotProps={{ model: vm }} as="div" {...media} ref={vm.graphic} dangerouslySetInnerHTML={{ __html: vm.svg }} /> : vm.imageSrc && !vm.imageError ? <PrismPart slotProps={{ model: vm }} as="img" {...media} src={vm.imageSrc} alt={vm.title} loading="lazy" decoding="async" onLoad={event => vm.imageLoaded(event.currentTarget.naturalWidth, event.currentTarget.naturalHeight)} onError={() => vm.setImageError(true)} /> : <PrismPart slotProps={{ model: vm }} as="div" {...skeleton} role="status">{vm.source || vm.props.src ? vm.labels.imageError : vm.labels.loading}</PrismPart>}
            <MockupAnnotations vm={vm} popover={false} />
          </>}
        </PrismPart></PrismPart>
      </PrismPart><MockupList vm={vm} /></PrismPart>
      {feedback && <>
        <PrismPart slotProps={{ model: vm }} as="label" {...overall} data-submitted={vm.submitted || undefined} inert={vm.submitted || undefined} aria-hidden={vm.submitted || undefined}>{vm.labels.overall}<PrismPart slotProps={{ model: vm }} as="textarea" {...input} value={vm.state.overall} onChange={event => vm.feedback.setOverall(event.target.value)} onBlur={vm.saveOverall} /></PrismPart>
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
  pressure: s.array(s.array(s.number())).optional().describe('Pen pressure samples per stroke, aligned with path points').example([[.2, .8]]),
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
export const mockupDefinition = defineComponent({ name: 'mockup', feedback: false, parts: ["secondaryTools","toolLabel","rowContent","rowText","kindIcon","composerHeader","composerFooter","keyboardHints","hintKey","feedbackFields","ripple","gesture","band","dimension","strokePath","toolGroup","tool","overflow","overflowTrigger","overflowContent","devices","sourceCode","count","ask","badge","body","button","canvas","column","columns","empty","feedbackFooter","footer","group","header","headerActions","hint","input","item","layout","list","live","marker","media","member","overall","popover","primary","reticle","root","sharedTools","skeleton","source","spacer","stage","streamDot","stroke","tab","tabs","target","title","toolbar","tools","undo","viewport"], strings: mockupLabels, requiresFinalId: true, schema: mockupSchema, component: Mockup, syntax: 'leaf', docs: `Interactive design review. Use mockupPlugin for mockup:html|svg|wire|image fences; without it they remain ordinary code blocks. Direct ::mockup directives need no plugin. Consecutive blocks sharing group become variants with tabs and Compare. Group feedback includes variants with items and optional preferred variant. Submit emits feedback and a readable summary. HTML/wire run in an opaque sandbox; SVG is sanitised inline. Image URLs allow only https: and data:image/. ${WIREFRAME_DOCS}`, examples: ['```mockup:svg {id=compare-a group=design variant=A}\n<svg viewBox="0 0 100 100"><rect width="100" height="100"/></svg>\n```\n\n```mockup:svg {id=compare-b group=design variant=B}\n<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="30"/></svg>\n```', '```mockup:html {id=pricing title="Pricing" device=mobile}\n<h1>Pricing</h1>\n```', '```mockup:svg {title="Logo"}\n<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40"/></svg>\n```', '```mockup:wire {title="Landing"}\nnav: Logo | Home | [Sign up]\nhero: # Hello / Welcome / [Start]\ngrid 3: card*3\n```', '::mockup{kind=image src="https://example.com/design.png" title="Poster"}'] });
