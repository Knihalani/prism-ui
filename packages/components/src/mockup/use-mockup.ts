import { useContext, useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent, type PointerEvent, type RefObject } from 'react';
import { ComponentContext, useComponentState, useSent, useFlash, usePrism, useTheme, useEmit, type PrismContextValue } from '@prism-ui/react';
import { createFeedback, createFrameController, previousAsResolved, sanitizeSvg, toMessage, wireframeDocument, feedbackMessageStrings, type FeedbackPayload, type FeedbackState, type FeedbackPoint, type FrameController, type HitRect } from './engine';

export type MockupDevice = 'desktop' | 'tablet' | 'mobile';
export const mockupLabels = { ...feedbackMessageStrings, devices: 'Device', colorOption: 'Pen colour {n}', resolvedComment: 'Resolved {n}: {text}', editComment: 'Edit {n}', deleteComment: 'Delete {n}', preferred: 'Preferred: {variant}', variants: 'Variants', compare: 'Compare', prefer: 'Prefer this', streaming: 'Streaming', title: 'Mockup', desktop: 'Desktop', tablet: 'Tablet', mobile: 'Mobile', zoomOut: 'Zoom out', zoomIn: 'Zoom in', fit: 'Fit', fullscreen: 'Fullscreen', source: 'View source', copy: 'Copy', draw: 'Draw', color: 'Pen colour', canvas: 'Design canvas. Press Enter to add a comment', hint: 'Click to comment · drag to select', empty: 'Click anywhere on the design to leave a comment.', overall: 'Overall feedback', save: 'Save', delete: 'Delete', edit: 'Edit', placeholder: 'Add a comment…', undo: 'Undo', redo: 'Redo', submit: 'Submit feedback', sent: 'Feedback sent · {n} comments', editFeedback: 'Edit feedback', countOne: '{n} comment', countOther: '{n} comments', sentOne: 'Feedback sent · {n} comment', sentOther: 'Feedback sent · {n} comments', count: '{n} comments', comment: 'Comment {n}: {text}', added: 'Comment {n} added', removed: 'Comment removed', loading: 'Loading design', imageError: 'Image unavailable', resolved: 'Resolved' };
export type MockupLabels = Partial<typeof mockupLabels>;
export interface MockupProps { id?: string; kind?: 'html' | 'svg' | 'wire' | 'image'; source?: string; src?: string; title?: string; device?: MockupDevice; variant?: string; group?: string; height?: number; previous?: FeedbackPayload; labels?: MockupLabels }
export interface MockupControls { device: MockupDevice; setDevice(device: MockupDevice): void; zoom: number; setZoom(zoom: number): void; pen: boolean; setPen(pen: boolean): void; color: string; setColor(color: string): void }
export interface MockupOptions { createController?: () => FrameController; enabled?: boolean; controls?: MockupControls; inline?: boolean; surface?: { root: RefObject<HTMLDivElement | null>; viewport: RefObject<HTMLDivElement | null> } }
const widths = { desktop: 1280, tablet: 834, mobile: 390 };
const clamp = (n: number) => Math.max(0, Math.min(100, n));

export function useMockupStrings(props: MockupProps): typeof mockupLabels {
  const defaults = { ...mockupLabels, ...usePrism().registry.get('mockup')?.strings }, theme = useTheme().theme.components.mockup?.strings;
  return { ...defaults, ...props.labels, title: props.title ?? props.labels?.title ?? defaults.title, ...theme } as typeof mockupLabels;
}
export function useMockup(props: MockupProps, ctx: PrismContextValue, options: MockupOptions = {}) {
  const component = useContext(ComponentContext), receipt = useSent(), emit = useEmit(), flash = useFlash('feedback');
  const enabled = options.enabled !== false;
  const complete = component?.node.complete !== false, kind = props.kind ?? 'html', framed = kind === 'html' || kind === 'wire';
  const labels = useMockupStrings(props), title = labels.title, source = props.source ?? '';
  const prefix = options.inline ? 'inlineFeedback.' : '';
  const storage = options.inline ? { initialHistory: false } : undefined;
  const [localDevice, writeDevice] = useComponentState<MockupDevice>(prefix + 'device', props.device ?? 'desktop', storage), [localZoom, writeZoom] = useComponentState(prefix + 'zoom', 1, storage), [draft] = useComponentState<FeedbackState | undefined>(prefix + 'feedback', undefined, storage), [submitted, setSubmitted] = useComponentState(prefix + 'submitted', false, storage);
  const device = options.controls?.device ?? localDevice, setDevice = options.controls?.setDevice ?? writeDevice, zoom = options.controls?.zoom ?? localZoom, setZoom = options.controls?.setZoom ?? writeZoom;
  const [feedback] = useState(() => createFeedback({ ...draft, mockup: title, variant: props.variant, device }));
  const state = useSyncExternalStore(feedback.subscribe, feedback.getState, feedback.getState);
  const localRoot = useRef<HTMLDivElement>(null), localViewport = useRef<HTMLDivElement>(null), canvas = useRef<HTMLDivElement>(null), iframe = useRef<HTMLIFrameElement>(null), graphic = useRef<HTMLDivElement>(null), controller = useRef<FrameController | null>(null);
  const root = options.surface?.root ?? localRoot, viewport = options.surface?.viewport ?? localViewport;
  const [visible, setVisible] = useState(typeof IntersectionObserver === 'undefined'), [containerWidth, setContainerWidth] = useState(1280), [contentHeight, setContentHeight] = useState(400), [naturalWidth, setNaturalWidth] = useState(800);
  const [expanded, setExpanded] = useState(false), [showSource, setShowSource] = useState(false), [pen, setPen] = useState(false), [color, setColor] = useState('var(--prism-mockup-accent, var(--prism-accent-text))'), [active, setActive] = useState<string | null>(null), [editing, setEditing] = useState<{ id: string; fresh: boolean; text: string } | null>(null), [comment, setComment] = useState(''), [announcement, announce] = useState(''), [reticle, setReticle] = useState<FeedbackPoint>([50, 50]), [focused, setFocused] = useState(false), [hover, setHover] = useState<FeedbackPoint | null>(null), [rubber, setRubber] = useState<FeedbackPoint[]>([]), [imageError, setImageError] = useState(false);
  const penValue = options.controls?.pen ?? pen, colorValue = options.controls?.color ?? color;
  const setPenValue = options.controls?.setPen ?? setPen, setColorValue = options.controls?.setColor ?? setColor;
  const gesture = useRef<{ points: FeedbackPoint[]; clientX: number; clientY: number } | null>(null);
  const pending = useRef<{ id: string; rollback(): void } | null>(null);
  const completeRef = useRef(complete); completeRef.current = complete;
  const grow = (height: number) => setContentHeight(old => completeRef.current ? Math.max(1, height) : Math.max(old, height, 400));
  useEffect(() => { const persist = (history = false) => ctx.store.set(`${component!.id}.${prefix}feedback`, feedback.toJSON(), { history }); persist(); return feedback.subscribe(() => persist(options.inline === true)); }, [feedback, ctx.store, component?.id, prefix, options.inline]);
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
  useEffect(() => { controller.current?.render(kind === 'wire' ? wireframeDocument(source) : source, complete); }, [source, complete, kind, visible, enabled, options.createController]);
  useEffect(() => { controller.current?.setAnchors(feedback.anchorRequests()); }, [state, visible, enabled, feedback]);
  useEffect(() => { const escape = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape') { setExpanded(false); setPenValue(false); } }; document.addEventListener('keydown', escape); return () => document.removeEventListener('keydown', escape); }, []);
  const svg = kind === 'svg' ? sanitizeSvg(source) : '';
  useEffect(() => { setImageError(false); }, [props.src, source]);
  useEffect(() => { const element = graphic.current?.querySelector('svg'); if (!element) return; const box = element.getAttribute('viewBox')?.split(/[\s,]+/).map(Number); setNaturalWidth(box?.[2] || Number(element.getAttribute('width')) || 800); grow(box?.[3] || Number(element.getAttribute('height')) || 400); }, [svg, visible, enabled]);
  const width = options.inline ? containerWidth : framed ? widths[device] : naturalWidth, scale = options.inline ? 1 : (framed ? Math.min(1, containerWidth / width) : containerWidth / width) * zoom;
  const resolved = props.previous ? previousAsResolved(props.previous) : [];
  function open(id: string, fresh = false) { const item = feedback.getState().items.find(item => item.id === id); if (!item) return; setEditing({ id, fresh, text: item.comment }); setComment(item.comment); setActive(id); }
  function remove(id: string) { feedback.remove(id); setEditing(null); announce(labels.removed); }
  function close(restoreFocus = false) { pending.current = null; setEditing(null); if (restoreFocus) canvas.current?.focus({ preventScroll: true }); }
  function popoverPosition(x: number, y: number) {
    if (options.inline) {
      const bounds = viewport.current?.getBoundingClientRect();
      const availableWidth = bounds?.width || containerWidth, availableHeight = bounds?.height || contentHeight;
      const popupWidth = Math.min(320, Math.max(0, availableWidth - 24)), popupHeight = 180;
      const left = Math.max(12, Math.min(availableWidth - popupWidth - 12, x / 100 * availableWidth));
      const top = Math.max(12, Math.min(availableHeight - popupHeight - 12, y / 100 * availableHeight + 20));
      return { left, top, width: popupWidth };
    }
    const bounds = root.current?.getBoundingClientRect(), artboard = canvas.current?.getBoundingClientRect();
    const availableWidth = bounds?.width || containerWidth, availableHeight = bounds?.height || contentHeight * scale;
    const popupWidth = Math.min(320, Math.max(0, availableWidth - 24)), popupHeight = 180;
    const anchorX = (artboard?.left ?? 0) - (bounds?.left ?? 0) + x / 100 * (artboard?.width || width * scale);
    const anchorY = (artboard?.top ?? 0) - (bounds?.top ?? 0) + y / 100 * (artboard?.height || contentHeight * scale);
    const left = Math.max(12, Math.min(availableWidth - popupWidth - 12, anchorX));
    const top = Math.max(12, Math.min(availableHeight - popupHeight - 12, anchorY + 20));
    return { left, top, width: popupWidth };
  }
  function save(restoreFocus = false) { if (editing) feedback.edit(editing.id, { comment }); close(restoreFocus); }
  useEffect(() => {
    if (!editing) return;
    const outside = (event: globalThis.PointerEvent) => {
      if (event.target instanceof Element && event.target.closest('[data-prism="mockup"][data-part="popover"]')) return;
      if (editing.fresh && !comment.trim() && feedback.getState().items.find(item => item.id === editing.id)?.kind !== 'drawing') cancel(false);
      else save();
    };
    document.addEventListener('pointerdown', outside, true);
    return () => document.removeEventListener('pointerdown', outside, true);
  }, [editing, comment]);
  function cancel(restoreFocus = true) { if (editing?.fresh && !editing.text && pending.current?.id === editing.id) pending.current.rollback(); close(restoreFocus && !!editing); }
  async function target(id: string, rect: HitRect, client?: FeedbackPoint) {
    if (framed) { const hit = await controller.current?.hit(rect); if (hit?.target && feedback.getState().items.some(item => item.id === id)) feedback.edit(id, { target: hit.target, targetBox: hit.target.box }); }
    else if (kind === 'svg' && client) {
      const svgRoot = graphic.current?.querySelector('svg');
      const element = document.elementsFromPoint?.(...client).find(el => svgRoot?.contains(el));
      if (!element || !svgRoot) return;
      const path: string[] = []; let node: Element | null = element;
      while (node && node !== svgRoot) { const current: Element = node; const siblings: Element[] = Array.from(current.parentElement?.children ?? []).filter(el => el.tagName === current.tagName); path.unshift(`${current.tagName.toLowerCase()}:nth-of-type(${siblings.indexOf(current) + 1})`); node = current.parentElement; }
      feedback.edit(id, { target: { selector: path.join(' > ') || 'svg', text: (element.textContent ?? '').trim().slice(0, 80), html: element.outerHTML.slice(0, 300) } });
    }
  }
  function add(rect: HitRect, points?: FeedbackPoint[], client?: FeedbackPoint) {
    const rollback = feedback.checkpoint();
    const item = points ? feedback.addDrawing({ points, color: colorValue }) : rect.w !== undefined ? feedback.addRegion({ ...rect, w: rect.w, h: rect.h ?? 0 }) : feedback.addPin(rect);
    pending.current = { id: item.id, rollback };
    open(item.id, true); announce(labels.added.replace('{n}', String(item.n)));
    if (points) {
      const center = { x: item.x + (item.w ?? 0) / 2, y: item.y + (item.h ?? 0) / 2 }, bounds = canvas.current?.getBoundingClientRect();
      void target(item.id, center, bounds ? [bounds.left + center.x / 100 * bounds.width, bounds.top + center.y / 100 * bounds.height] : undefined);
    } else void target(item.id, rect, client);
  }
  function point(event: PointerEvent<HTMLElement>): FeedbackPoint { const box = event.currentTarget.getBoundingClientRect(); return [clamp((event.clientX - box.left) / (box.width || 1) * 100), clamp((event.clientY - box.top) / (box.height || 1) * 100)]; }
  const pointer = {
    onPointerDown(event: PointerEvent<HTMLDivElement>) { if (event.button !== 0 || submitted) return; event.preventDefault(); event.currentTarget.setPointerCapture?.(event.pointerId); const p = point(event); gesture.current = { points: [p], clientX: event.clientX, clientY: event.clientY }; setRubber([p]); },
    onPointerMove(event: PointerEvent<HTMLDivElement>) { const p = point(event); setHover(p); if (gesture.current) { gesture.current.points.push(p); setRubber([...gesture.current.points]); } },
    onPointerUp(event: PointerEvent<HTMLDivElement>) { const g = gesture.current; if (!g) return; gesture.current = null; setRubber([]); event.currentTarget.releasePointerCapture?.(event.pointerId); const p = point(event), first = g.points[0]; if (penValue) add({ x: first[0], y: first[1] }, [...g.points, p]); else if (Math.hypot(event.clientX - g.clientX, event.clientY - g.clientY) < 5) add({ x: p[0], y: p[1] }, undefined, [event.clientX, event.clientY]); else add({ x: Math.min(first[0], p[0]), y: Math.min(first[1], p[1]), w: Math.abs(first[0] - p[0]), h: Math.abs(first[1] - p[1]) }, undefined, [event.clientX, event.clientY]); },
    onPointerCancel() { gesture.current = null; setRubber([]); }, onPointerLeave() { setHover(null); },
  };
  function onKeyDown(event: KeyboardEvent<HTMLElement>) { if (event.key === 'Escape') { cancel(); setPenValue(false); setExpanded(false); } if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); event.stopPropagation(); setEditing(null); event.shiftKey ? feedback.redo() : feedback.undo(); } }
  function canvasKey(event: KeyboardEvent<HTMLDivElement>) { if (event.target !== event.currentTarget || submitted) return; const step = event.shiftKey ? 10 : 2; if (event.key.startsWith('Arrow')) { event.preventDefault(); setReticle(([x, y]) => [clamp(x + (event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0)), clamp(y + (event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0))]); } if (event.key === 'Enter') { event.preventDefault(); add({ x: reticle[0], y: reticle[1] }); } }
  return { flash, props, kind, framed, complete, labels, title, source, svg, root, viewport, canvas, iframe, graphic, visible: visible && enabled, width, scale, contentHeight, device, setDevice, zoom, setZoom, expanded, showSource, setShowSource, pen: penValue, setPen: setPenValue, color: colorValue, setColor: setColorValue, active, setActive, editing, comment, setComment, announcement, reticle, focused, setFocused, hover, rubber, pointer, onKeyDown, canvasKey, feedback, state, resolved, submitted, setSubmitted, open, remove, save, cancel, close, popoverPosition, locale: ctx.format.locale, canSubmit: feedback.canSubmit || !!(editing && comment.trim()), imageError, setImageError,
    imageSrc: /^(https:|data:image\/)/i.test((props.src ?? source).trim()) ? (props.src ?? source).trim() : undefined,
    imageLoaded(width: number, height: number) { setNaturalWidth(width || 800); grow(height || 400); },
    async fullscreen() { try { if (document.fullscreenElement) await document.exitFullscreen(); else if (root.current?.requestFullscreen) await root.current.requestFullscreen(); else setExpanded(old => !old); } catch { setExpanded(old => !old); } },
    async copy() { try { await navigator.clipboard?.writeText(source); } catch {} },
    submit() { save(); if (!feedback.canSubmit || submitted) return; const payload = feedback.toPayload(), message = toMessage(payload, { strings: labels }); if (options.inline) emit('feedback', { ...payload, target: { name: component!.name, id: component!.id }, coordinates: 'percent' }, message); else receipt.send('feedback', payload, message); setSubmitted(true); setEditing(null); },
  };
}
export type MockupModel = ReturnType<typeof useMockup>;
