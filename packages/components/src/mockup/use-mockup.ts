import { useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore, type KeyboardEvent, type PointerEvent, type RefObject } from 'react';
import { ComponentContext, useStoreValue, useSent, useFlash, usePrism, useTheme, useStrings, useEmit, type PrismContextValue } from '@prism-ui/react';
import { createFeedback, createFrameController, previousAsResolved, sanitizeSvg, toMessage, wireframeDocument, feedbackMessageStrings, type FeedbackPayload, type FeedbackState, type FeedbackPoint, type FrameController, type HitRect } from './engine';
import { regionDimensions } from './outline';
import { placeComposer } from './placement';
import { composerViewport } from './viewport';
import { useTouchFeedback } from './touch';

export type MockupDevice = 'desktop' | 'tablet' | 'mobile';
export type MockupTool = 'pin' | 'region' | 'draw';
export interface LiveGesture { points: FeedbackPoint[]; pressure: number[]; realPressure: boolean; hover: FeedbackPoint | null; tool: MockupTool }
export const mockupLabels = { targetShape: 'Shape', targetImage: 'Image', targetButton: 'Button', targetLink: 'Link', targetField: 'Field', targetHeading: 'Heading', targetGraphic: 'Graphic', targetPoint: '{x}%, {y}%', cancelComment: 'Close comment', saveHint: '↵ Save', sendHintMac: '⌘↵ Send', sendHintControl: 'Ctrl↵ Send', escapeHint: 'Esc', shortcuts: 'P / R / D tools', openComment: 'Open comment {n}', sendOne: 'Send {n} comment', sendOther: 'Send {n} comments', receiptOne: 'Sent · {n} comment', receiptOther: 'Sent · {n} comments', ...feedbackMessageStrings, pin: 'Pin', region: 'Region', toolGroup: 'Feedback tools', toolShortcut: '{tool} ({key})', toolChanged: '{tool} tool selected', regionAdded: 'Region selected: {size} pixels', devices: 'Device', colorOption: 'Pen colour {n}', resolvedComment: 'Resolved {n}: {text}', editComment: 'Edit {n}', deleteComment: 'Delete {n}', preferred: 'Preferred: {variant}', variants: 'Variants', compare: 'Compare', prefer: 'Prefer this', streaming: 'Streaming', title: 'Mockup', desktop: 'Desktop', tablet: 'Tablet', mobile: 'Mobile', zoomOut: 'Zoom out', zoomIn: 'Zoom in', fit: 'Fit', fullscreen: 'Fullscreen', source: 'View source', copy: 'Copy', draw: 'Draw', color: 'Pen colour', canvas: 'Design canvas. Press Enter to add a comment', hint: 'Click to comment · drag to select', empty: 'Click anywhere on the design to leave a comment.', overall: 'Overall feedback', save: 'Save', delete: 'Delete', edit: 'Edit', placeholder: 'Add a comment…', undo: 'Undo', redo: 'Redo', submit: 'Submit feedback', sent: 'Feedback sent · {n} comments', editFeedback: 'Edit feedback', countOne: '{n} comment', countOther: '{n} comments', sentOne: 'Feedback sent · {n} comment', sentOther: 'Feedback sent · {n} comments', count: '{n} comments', comment: 'Comment {n}: {text}', added: 'Comment {n} added', removed: 'Comment removed', loading: 'Loading design', imageError: 'Image unavailable', resolved: 'Resolved' };
export type MockupLabels = Partial<typeof mockupLabels>;
export interface MockupProps { id?: string; kind?: 'html' | 'svg' | 'wire' | 'image'; source?: string; src?: string; title?: string; device?: MockupDevice; variant?: string; group?: string; height?: number; previous?: FeedbackPayload; labels?: MockupLabels }
export interface MockupControls { device: MockupDevice; setDevice(device: MockupDevice): void; zoom: number; setZoom(zoom: number): void; pen: boolean; setPen(pen: boolean): void; tool?: MockupTool; setTool?(tool: MockupTool): void; color: string; setColor(color: string): void }
export interface MockupOptions { createController?: () => FrameController; enabled?: boolean; controls?: MockupControls; inline?: boolean; onSubmit?(): void; surface?: { root: RefObject<HTMLDivElement | null>; viewport: RefObject<HTMLDivElement | null> } }
const widths = { desktop: 1280, tablet: 834, mobile: 390 };
const clamp = (n: number) => Math.max(0, Math.min(100, n));

export function useMockupStrings(props: MockupProps): typeof mockupLabels {
  const defaults = useStrings('mockup', mockupLabels, {}), theme = useTheme().theme.components.mockup?.strings;
  return { ...defaults, ...props.labels, title: props.title ?? props.labels?.title ?? defaults.title, ...theme } as typeof mockupLabels;
}
export function useMockup(props: MockupProps, ctx: PrismContextValue, options: MockupOptions = {}) {
  const component = useContext(ComponentContext), receipt = useSent(), emit = useEmit(), flash = useFlash('feedback');
  const enabled = options.enabled !== false;
  const complete = component?.node.complete !== false, kind = props.kind ?? 'html', framed = kind === 'html' || kind === 'wire';
  const labels = useMockupStrings(props), title = labels.title, source = props.source ?? '';
  const path = `${component!.id}.feedback`;
  const draft = useStoreValue<(FeedbackState & { submitted?: boolean }) | undefined>(path);
  const savedSubmitted = useStoreValue<boolean | undefined>(options.inline ? `${path}.submitted` : `${component!.id}.submitted`);
  const [localDevice, writeDevice] = useState<MockupDevice>(props.device ?? 'desktop'), [localZoom, writeZoom] = useState(1), [editSubmitted, setEditSubmitted] = useState(false);
  const submitted = !!(draft?.submitted ?? savedSubmitted) && !editSubmitted, setSubmitted = (value: boolean) => setEditSubmitted(!value);
  const device = options.controls?.device ?? localDevice, setDevice = options.controls?.setDevice ?? writeDevice, zoom = options.controls?.zoom ?? localZoom, setZoom = options.controls?.setZoom ?? writeZoom;
  const [feedback] = useState(() => createFeedback({ ...draft, mockup: title, variant: props.variant, device }));
  const state = useSyncExternalStore(feedback.subscribe, feedback.getState, feedback.getState);
  const localRoot = useRef<HTMLDivElement>(null), localViewport = useRef<HTMLDivElement>(null), canvas = useRef<HTMLDivElement>(null), iframe = useRef<HTMLIFrameElement>(null), graphic = useRef<HTMLDivElement>(null), controller = useRef<FrameController | null>(null);
  const root = options.surface?.root ?? localRoot, viewport = options.surface?.viewport ?? localViewport;
  const [visible, setVisible] = useState(typeof IntersectionObserver === 'undefined'), [containerWidth, setContainerWidth] = useState(1280), [contentHeight, setContentHeight] = useState(400), [naturalWidth, setNaturalWidth] = useState(800);
  const [expanded, setExpanded] = useState(false), [showSource, setShowSource] = useState(false), [localTool, writeTool] = useState<MockupTool>('pin'), [color, setColor] = useState('var(--prism-mockup-accent, var(--prism-accent-text))'), [active, setActive] = useState<string | null>(null), [editing, setEditing] = useState<{ id: string; fresh: boolean; text: string } | null>(null), [comment, setComment] = useState(''), [announcement, announce] = useState(''), [reticle, setReticle] = useState<FeedbackPoint>([50, 50]), [focused, setFocused] = useState(false), [imageError, setImageError] = useState(false);
  const tool = options.controls?.tool ?? (options.controls?.pen ? 'draw' : options.controls && localTool === 'draw' ? 'pin' : localTool), colorValue = options.controls?.color ?? color;
  const setColorValue = options.controls?.setColor ?? setColor;
  const live = useRef<LiveGesture>({ points: [], pressure: [], realPressure: false, hover: null, tool: 'pin' }), livePaint = useRef<(() => void) | null>(null);
  const gesture = useRef<{ clientX: number; clientY: number; box: DOMRect; element: HTMLElement; pointerId: number; pointerType: string; moved: boolean } | null>(null);
  function cancelGesture() { const g = gesture.current; gesture.current = null; live.current.points = []; live.current.pressure = []; if (g?.element.hasPointerCapture?.(g.pointerId)) g.element.releasePointerCapture(g.pointerId); livePaint.current?.(); }
  function setTool(next: MockupTool) { cancelGesture(); if (options.controls?.setTool) options.controls.setTool(next); else { writeTool(next); options.controls?.setPen(next === 'draw'); } announce(labels.toolChanged.replace('{tool}', labels[next])); }
  const setPenValue = (value: boolean) => setTool(value ? 'draw' : 'pin');
  useEffect(() => () => { const g = gesture.current; if (g?.element.hasPointerCapture?.(g.pointerId)) g.element.releasePointerCapture(g.pointerId); }, []);
  const pending = useRef<{ id: string } | null>(null), created = useRef(new Set<string>()), listRef = useRef<HTMLSpanElement>(null), focusReturn = useRef<HTMLElement | null>(null);
  function highlight(id: string | null, fromCanvas = false) {
    setActive(id);
    const list = listRef.current; if (!id || !fromCanvas || !list || list.scrollHeight <= list.clientHeight) return;
    const row = Array.from(list.querySelectorAll<HTMLElement>('[data-feedback-row]')).find(row => row.dataset.feedbackRow === id); if (!row) return;
    const bounds = list.getBoundingClientRect(), rect = row.getBoundingClientRect();
    if (rect.top < bounds.top) list.scrollTop -= bounds.top - rect.top; else if (rect.bottom > bounds.bottom) list.scrollTop += rect.bottom - bounds.bottom;
  }
  const previousDraft = useRef({ path, draft });
  const completeRef = useRef(complete); completeRef.current = complete;
  const grow = (height: number) => setContentHeight(old => completeRef.current ? Math.max(1, height) : Math.max(old, height, 400));
  useLayoutEffect(() => {
    const current = feedback.getState(), fresh = pending.current && current.items.find(item => item.id === pending.current!.id);
    const items = [...(draft?.items ?? [])];
    if (fresh && !items.some(item => item.id === fresh.id)) items.push(fresh);
    const before = previousDraft.current.draft?.overall ?? '', saved = draft?.overall ?? '';
    const overall = (previousDraft.current.path !== path || before === saved) && current.overall !== before ? current.overall : saved;
    previousDraft.current = { path, draft };
    feedback.load(createFeedback({ ...draft, mockup: title, variant: props.variant, device, items, overall }).toJSON());
    if (editing && !editing.fresh) { const item = items.find(item => item.id === editing.id); if (!item) { setEditing(null); setComment(''); } else if (item.comment !== editing.text) { setEditing({ ...editing, text: item.comment }); setComment(item.comment); } }
    setEditSubmitted(false);
  }, [draft, path, savedSubmitted, feedback]);
  useEffect(() => { feedback.setContext({ mockup: title, variant: props.variant, device }); }, [feedback, title, props.variant, device]);
  useEffect(() => { if (visible || !root.current || typeof IntersectionObserver === 'undefined') return; const observer = new IntersectionObserver(entries => { if (entries.some(e => e.isIntersecting)) { setVisible(true); observer.disconnect(); } }, { rootMargin: '200px' }); observer.observe(root.current); return () => observer.disconnect(); }, [visible]);
  useEffect(() => { if (!viewport.current || typeof ResizeObserver === 'undefined') return; const observer = new ResizeObserver(entries => setContainerWidth(entries[0].contentRect.width || 1280)); observer.observe(viewport.current); return () => observer.disconnect(); }, []);
  useEffect(() => {
    if (!enabled || !visible || !framed || !iframe.current) return;
    const frame = (options.createController ?? createFrameController)(); controller.current = frame; frame.attach(iframe.current);
    const offSize = frame.on('size', message => grow(message.height));
    const offLayout = frame.on('layout', message => feedback.reanchor(Object.fromEntries(message.anchors.map(a => [a.key, a.box]))));
    return () => { offSize(); offLayout(); frame.destroy(); controller.current = null; };
  }, [visible, enabled, framed, options.createController, feedback]);
  const documentSource = useMemo(() => kind === 'wire' ? wireframeDocument(source) : source, [source, kind]);
  useEffect(() => { controller.current?.render(documentSource, complete); }, [documentSource, complete, kind, visible, enabled, options.createController]);
  useEffect(() => { controller.current?.setAnchors(feedback.anchorRequests()); }, [state, visible, enabled, feedback]);
  const svg = useMemo(() => kind === 'svg' ? sanitizeSvg(source) : '', [source, kind]);
  useEffect(() => { setImageError(false); }, [props.src, source]);
  useEffect(() => { const element = graphic.current?.querySelector('svg'); if (!element) return; const box = element.getAttribute('viewBox')?.split(/[\s,]+/).map(Number); setNaturalWidth(box?.[2] || Number(element.getAttribute('width')) || 800); grow(box?.[3] || Number(element.getAttribute('height')) || 400); }, [svg, visible, enabled]);
  const width = options.inline ? containerWidth : framed ? widths[device] : naturalWidth, scale = (options.inline ? 1 : framed ? Math.min(1, containerWidth / width) : containerWidth / width) * zoom;
  const resolved = props.previous ? previousAsResolved(props.previous) : [];
  function open(id: string, fresh = false) { focusReturn.current = (!fresh && Array.from(root.current?.querySelectorAll<HTMLElement>('[data-feedback-id]') ?? []).find(node => node.dataset.feedbackId === id)) || canvas.current; const item = feedback.getState().items.find(item => item.id === id); if (!item) return; if (pending.current && pending.current.id !== id) { feedback.remove(pending.current.id); pending.current = null; } setEditing({ id, fresh, text: item.comment }); setComment(item.comment); setActive(id); }
  function commit(change: (value: FeedbackState) => FeedbackState, sent = false) {
    let result!: FeedbackState;
    ctx.store.update(path, (saved: (FeedbackState & { submitted?: boolean }) | undefined) => {
      result = createFeedback(change(createFeedback({ ...saved, mockup: title, variant: props.variant, device }).toJSON())).toJSON();
      const next = { ...result, submitted: sent };
      return JSON.stringify(saved) === JSON.stringify(next) ? saved : next;
    });
    return result;
  }
  function withItem(value: FeedbackState, id: string, text: string) {
    const item = feedback.getState().items.find(item => item.id === id);
    if (!item) return value;
    return { ...value, items: value.items.some(item => item.id === id) ? value.items.map(old => old.id === id ? { ...item, comment: text } : old) : [...value.items, { ...item, comment: text }] };
  }
  function submission() {
    const working = feedback.getState(), saved = ctx.store.get(path) as FeedbackState | undefined;
    const value = createFeedback({ ...saved, mockup: title, variant: props.variant, device, overall: working.overall, items: (saved?.items ?? []).map(item => working.items.find(current => current.id === item.id) ?? item) }).toJSON();
    return createFeedback(editing ? withItem(value, editing.id, comment) : value);
  }
  function remove(id: string) { const fresh = pending.current?.id === id, saved = ctx.store.get(path)?.items.some((item: { id: string }) => item.id === id); feedback.remove(id); close(true); if (!fresh && saved) commit(value => ({ ...value, items: value.items.filter(item => item.id !== id) })); announce(labels.removed); }
  const restoreTarget = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => { if (!editing && restoreTarget.current) { const node = restoreTarget.current; restoreTarget.current = null; (node.isConnected ? node : canvas.current)?.focus({ preventScroll: true }); } }, [editing]);
  function close(restoreFocus = false) { pending.current = null; if (restoreFocus) restoreTarget.current = focusReturn.current ?? canvas.current; setEditing(null); }
  function popoverPosition(x: number, y: number, height = 210, visible = composerViewport()) {
    const bounds = root.current?.getBoundingClientRect(), artboard = canvas.current?.getBoundingClientRect();
    const surface = bounds?.width ? bounds : { left: 0, top: 0, width: containerWidth, height: contentHeight };
    const anchor = { x: (artboard?.left ?? surface.left) + x / 100 * (artboard?.width || width * scale), y: (artboard?.top ?? surface.top) + y / 100 * (artboard?.height || contentHeight * scale) };
    const placement = placeComposer(surface, anchor, visible, height, root.current?.querySelector('[data-feedback-submit]')?.getBoundingClientRect());
    return { left: placement.left - surface.left, top: placement.top - surface.top, width: placement.width, transformOrigin: placement.transformOrigin, '--prism-mockup-caret-x': placement.caretX + 'px', '--prism-mockup-caret-y': placement.caretY + 'px', '--prism-mockup-caret-side': placement.side };
  }
  function save(restoreFocus = false) { const edit = editing; close(restoreFocus); if (edit) { feedback.edit(edit.id, { comment }); commit(value => withItem(value, edit.id, comment)); } }
  function saveOverall(event?: { relatedTarget: EventTarget | null }) { if (event?.relatedTarget instanceof Element && root.current?.contains(event.relatedTarget) && event.relatedTarget.closest('[data-feedback-submit]')) return; const overall = feedback.getState().overall; if (overall !== (ctx.store.get(path)?.overall ?? '')) commit(value => ({ ...value, overall })); }
  const subscribeHistory = (fn: () => void) => ctx.store.subscribe('*', fn);
  const canUndo = useSyncExternalStore(subscribeHistory, () => ctx.store.canUndo(path), () => false), canRedo = useSyncExternalStore(subscribeHistory, () => ctx.store.canRedo(path), () => false);
  function undo() { cancel(false); ctx.store.undo(path); }
  function redo() { cancel(false); ctx.store.redo(path); }
  function move(id: string, x: number, y: number) { if (!feedback.getState().items.some(item => item.id === id)) return; feedback.edit(id, { x: clamp(x), y: clamp(y) }); if (pending.current?.id !== id) commit(value => withItem(value, id, feedback.getState().items.find(item => item.id === id)?.comment ?? '')); }
  useEffect(() => {
    if (!editing) return;
    const outside = (event: globalThis.PointerEvent) => {
      if (event.target instanceof Element && event.target.closest('[data-prism="mockup"][data-part="popover"]')) return;
      if (editing.fresh && !comment.trim() && feedback.getState().items.find(item => item.id === editing.id)?.kind !== 'drawing') cancel(false);
    };
    document.addEventListener('pointerdown', outside, true);
    return () => document.removeEventListener('pointerdown', outside, true);
  }, [editing, comment, feedback]);
  function cancel(restoreFocus = true) { if (pending.current) feedback.remove(pending.current.id); close(restoreFocus && !!editing); }
  async function target(id: string, rect: HitRect, client?: FeedbackPoint) {
    if (framed) { const hit = await controller.current?.hit(rect); if (hit?.target && feedback.getState().items.some(item => item.id === id)) feedback.edit(id, { target: hit.target, targetBox: hit.target.box }); }
    else if (kind === 'svg' && client) {
      const svgRoot = graphic.current?.querySelector('svg');
      const element = document.elementsFromPoint?.(...client).find(el => svgRoot?.contains(el));
      if (!element || !svgRoot) return;
      const path: string[] = []; let node: Element | null = element;
      while (node && node !== svgRoot) { const current: Element = node; const siblings: Element[] = Array.from(current.parentElement?.children ?? []).filter(el => el.tagName === current.tagName); path.unshift(`${current.tagName.toLowerCase()}:nth-of-type(${siblings.indexOf(current) + 1})`); node = current.parentElement; }
      feedback.edit(id, { target: { selector: path.join(' > ') || 'svg', text: (element.getAttribute('aria-label') || element.textContent || '').trim().slice(0, 80), html: element.outerHTML.slice(0, 300) } });
    }
  }
  function add(rect: HitRect, points?: FeedbackPoint[], client?: FeedbackPoint, pressure?: number[]) {
    if (pending.current) feedback.remove(pending.current.id);
    const item = points ? feedback.addDrawing({ points, pressure: pressure ? [pressure] : undefined, color: colorValue }) : rect.w !== undefined ? feedback.addRegion({ ...rect, w: rect.w, h: rect.h ?? 0 }) : feedback.addPin(rect);
    created.current.add(item.id);
    pending.current = { id: item.id };
    open(item.id, true); announce(labels.added.replace('{n}', String(item.n)));
    if (points) {
      const center = { x: item.x + (item.w ?? 0) / 2, y: item.y + (item.h ?? 0) / 2 }, bounds = canvas.current?.getBoundingClientRect();
      void target(item.id, center, bounds ? [bounds.left + center.x / 100 * bounds.width, bounds.top + center.y / 100 * bounds.height] : undefined);
    } else void target(item.id, rect, client);
  }
  function point(event: { clientX: number; clientY: number }, box: DOMRect): FeedbackPoint { return [Number(clamp((event.clientX - box.left) / (box.width || 1) * 100).toFixed(2)), Number(clamp((event.clientY - box.top) / (box.height || 1) * 100).toFixed(2))]; }
  function collect(event: PointerEvent<HTMLDivElement>) {
    const g = gesture.current; if (!g || event.pointerId !== g.pointerId) return;
    const samples = event.nativeEvent.getCoalescedEvents?.();
    for (const sample of samples?.length ? [...samples, event.nativeEvent] : [event.nativeEvent]) {
      const p = point(sample, g.box), previous = live.current.points.at(-1);
      if (previous?.[0] === p[0] && previous[1] === p[1]) continue;
      live.current.points.push(p); live.current.pressure.push(live.current.realPressure ? Math.max(0, Math.min(1, sample.pressure || 0)) : .5);
    }
  }
  const pointer = useTouchFeedback({ canvas, viewport, zoom, setZoom, enabled, inline: !!options.inline, cancel: cancelGesture, pointer: {
    onPointerDown(event: PointerEvent<HTMLDivElement>) { if (event.button !== 0 || submitted || gesture.current) return; if (event.pointerType !== 'touch' || tool !== 'pin') { event.preventDefault(); event.currentTarget.focus({ preventScroll: true }); } event.currentTarget.setPointerCapture?.(event.pointerId); const box = event.currentTarget.getBoundingClientRect(), p = point(event, box); gesture.current = { clientX: event.clientX, clientY: event.clientY, box, element: event.currentTarget, pointerId: event.pointerId, pointerType: event.pointerType, moved: false }; live.current = { points: [p], pressure: [event.pointerType === 'pen' ? event.pressure : .5], realPressure: event.pointerType === 'pen', hover: null, tool }; livePaint.current?.(); },
    onPointerMove(event: PointerEvent<HTMLDivElement>) { if (submitted) return; const g = gesture.current; if (g?.pointerType === 'touch' && live.current.tool === 'pin') { g.moved ||= Math.hypot(event.clientX - g.clientX, event.clientY - g.clientY) >= 5; return; } if (g) collect(event); else live.current.hover = point(event, event.currentTarget.getBoundingClientRect()); livePaint.current?.(); },
    onPointerUp(event: PointerEvent<HTMLDivElement>) {
      const g = gesture.current; if (!g || event.pointerId !== g.pointerId) return; collect(event);
      const { points, pressure, realPressure, tool: selected } = live.current, p = points.at(-1)!, first = points[0]; cancelGesture();
      if (g.pointerType === 'touch' && selected === 'pin' && (g.moved || Math.hypot(event.clientX - g.clientX, event.clientY - g.clientY) >= 5)) return;
      if (selected === 'draw') add({ x: first[0], y: first[1] }, points, undefined, realPressure ? pressure : undefined);
      else if (selected === 'pin' && Math.hypot(event.clientX - g.clientX, event.clientY - g.clientY) < 5) add({ x: p[0], y: p[1] }, undefined, [event.clientX, event.clientY]);
      else { add({ x: Math.min(first[0], p[0]), y: Math.min(first[1], p[1]), w: Math.abs(first[0] - p[0]), h: Math.abs(first[1] - p[1]) }, undefined, [event.clientX, event.clientY]); announce(labels.regionAdded.replace('{size}', regionDimensions(first, p, g.box.width, g.box.height, scale))); }
    },
    onPointerCancel(event: PointerEvent<HTMLDivElement>) { if (gesture.current?.pointerId === event.pointerId) cancelGesture(); }, onLostPointerCapture(event: PointerEvent<HTMLDivElement>) { if (gesture.current?.pointerId === event.pointerId) cancelGesture(); }, onPointerLeave() { live.current.hover = null; livePaint.current?.(); },
  } });
  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.defaultPrevented || event.nativeEvent.isComposing) return;
    const field = event.target instanceof Element && event.target.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"])');
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') { event.preventDefault(); event.stopPropagation(); options.onSubmit ? options.onSubmit() : submit(); return; }
    if (event.key === 'Escape') { if (gesture.current) cancelGesture(); else if (editing) cancel(); else if (tool !== 'pin') setTool('pin'); else if (expanded) setExpanded(false); else return; event.preventDefault(); event.stopPropagation(); return; }
    if (!submitted && !field && !event.ctrlKey && !event.metaKey && !event.altKey) { const next = ({ p: 'pin', r: 'region', d: 'draw' } as const)[event.key.toLowerCase() as 'p' | 'r' | 'd']; if (next) { event.preventDefault(); setTool(next); return; } }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.stopPropagation(); if (field || state.overall !== (draft?.overall ?? '') || editing && comment !== editing.text) return; event.preventDefault(); event.shiftKey ? redo() : undo(); }
  }
  function canvasKey(event: KeyboardEvent<HTMLDivElement>) { if (event.target !== event.currentTarget || submitted || event.ctrlKey || event.metaKey) return; const step = event.shiftKey ? 10 : 2; if (event.key.startsWith('Arrow')) { event.preventDefault(); setReticle(([x, y]) => [clamp(x + (event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0)), clamp(y + (event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0))]); } if (event.key === 'Enter') { event.preventDefault(); add({ x: reticle[0], y: reticle[1] }); } }
  function submit() { const candidate = submission(); if (submitted || !candidate.canSubmit) return;
    const pill = root.current?.querySelector('[data-feedback-submit]')?.getBoundingClientRect();
    if (pill) for (const node of Array.from(root.current?.querySelectorAll<HTMLElement>('[data-part="marker"],[data-part="stroke"]') ?? [])) { const bounds = node.getBoundingClientRect(); node.style.setProperty('--prism-mockup-exit-x', `${(pill.left + pill.width / 2 - bounds.left - bounds.width / 2) / scale}px`); node.style.setProperty('--prism-mockup-exit-y', `${(pill.top + pill.height / 2 - bounds.top - bounds.height / 2) / scale}px`); }
    cancelGesture(); close(); const saved = commit(() => candidate.toJSON(), true); const payload = createFeedback(saved).toPayload(), message = toMessage(payload, { strings: labels }); if (options.inline) emit('feedback', { ...payload, target: { name: component!.name, id: component!.id }, coordinates: 'percent' }, message); else receipt.send('feedback', payload, message); setEditing(null); }
  return { flash, created, listRef, highlight, props, kind, framed, complete, labels, title, source, svg, root, viewport, canvas, iframe, graphic, visible: visible && enabled, width, scale, contentHeight, device, setDevice, zoom, setZoom, expanded, showSource, setShowSource, tool, setTool, pen: tool === 'draw', setPen: setPenValue, color: colorValue, setColor: setColorValue, active, setActive, editing, comment, setComment, announcement, reticle, focused, setFocused, live, livePaint, get hover() { return live.current.hover; }, get rubber() { return live.current.points; }, pointer, onKeyDown, canvasKey, feedback: { ...feedback, canUndo, canRedo, undo, redo }, state, resolved, submitted, setSubmitted, open, remove, save, saveOverall, move, cancel, close, popoverPosition, locale: ctx.format.locale, canSubmit: submission().canSubmit, imageError, setImageError,
    imageSrc: /^(https:|data:image\/)/i.test((props.src ?? source).trim()) ? (props.src ?? source).trim() : undefined,
    imageLoaded(width: number, height: number) { setNaturalWidth(width || 800); grow(height || 400); },
    async fullscreen() { try { if (document.fullscreenElement) await document.exitFullscreen(); else if (root.current?.requestFullscreen) await root.current.requestFullscreen(); else setExpanded(old => !old); } catch { setExpanded(old => !old); } },
    async copy() { try { await navigator.clipboard?.writeText(source); } catch {} },
    submit,
  };
}
export type MockupModel = ReturnType<typeof useMockup>;
