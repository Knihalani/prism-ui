import { useContext, useEffect, useRef, useState, useSyncExternalStore, type KeyboardEvent, type PointerEvent } from 'react';
import { ComponentContext, useComponentState, useEmit, type PrismContextValue } from '@prism-ui/react';
import { createFeedback, createFrameController, previousAsResolved, sanitizeSvg, toMessage, wireframeDocument, type FeedbackPayload, type FeedbackState, type FeedbackPoint, type FrameController, type HitRect } from './engine';

export type MockupDevice = 'desktop' | 'tablet' | 'mobile';
export const mockupLabels = { title: 'Mockup', desktop: 'Desktop', tablet: 'Tablet', mobile: 'Mobile', zoomOut: 'Zoom out', zoomIn: 'Zoom in', fit: 'Fit', fullscreen: 'Fullscreen', source: 'View source', copy: 'Copy', draw: 'Draw', color: 'Pen colour', canvas: 'Design canvas. Press Enter to add a comment', hint: 'Click to comment · drag to select', empty: 'Click anywhere on the design to leave a comment.', overall: 'Overall feedback', save: 'Save', delete: 'Delete', edit: 'Edit', placeholder: 'Add a comment…', undo: 'Undo', redo: 'Redo', submit: 'Submit feedback', sent: 'Feedback sent · {n} comments', editFeedback: 'Edit feedback', count: '{n} comments', comment: 'Comment {n}: {text}', added: 'Comment {n} added', removed: 'Comment removed', loading: 'Loading design', imageError: 'Image unavailable', resolved: 'Resolved' };
export type MockupLabels = Partial<typeof mockupLabels>;
export interface MockupProps { id?: string; kind?: 'html' | 'svg' | 'wire' | 'image'; source?: string; src?: string; title?: string; device?: MockupDevice; variant?: string; group?: string; height?: number; previous?: FeedbackPayload; labels?: MockupLabels }
export interface MockupOptions { createController?: () => FrameController }
const widths = { desktop: 1280, tablet: 834, mobile: 390 };
const clamp = (n: number) => Math.max(0, Math.min(100, n));

export function useMockup(props: MockupProps, ctx: PrismContextValue, options: MockupOptions = {}) {
  const component = useContext(ComponentContext), emit = useEmit();
  const complete = component?.node.complete !== false, kind = props.kind ?? 'html', framed = kind === 'html' || kind === 'wire';
  const labels = { ...mockupLabels, ...props.labels }, title = props.title ?? labels.title, source = props.source ?? '';
  const [device, setDevice] = useComponentState<MockupDevice>('device', props.device ?? 'desktop'), [zoom, setZoom] = useComponentState('zoom', 1), [draft] = useComponentState<FeedbackState | undefined>('feedback', undefined), [submitted, setSubmitted] = useComponentState('submitted', false);
  const [feedback] = useState(() => createFeedback({ ...draft, mockup: title, variant: props.variant, device }));
  const state = useSyncExternalStore(feedback.subscribe, feedback.getState, feedback.getState);
  const root = useRef<HTMLDivElement>(null), viewport = useRef<HTMLDivElement>(null), iframe = useRef<HTMLIFrameElement>(null), graphic = useRef<HTMLDivElement>(null), controller = useRef<FrameController | null>(null);
  const [visible, setVisible] = useState(typeof IntersectionObserver === 'undefined'), [containerWidth, setContainerWidth] = useState(1280), [contentHeight, setContentHeight] = useState(400), [naturalWidth, setNaturalWidth] = useState(800);
  const [expanded, setExpanded] = useState(false), [showSource, setShowSource] = useState(false), [pen, setPen] = useState(false), [color, setColor] = useState('var(--prism-accent)'), [active, setActive] = useState<string | null>(null), [editing, setEditing] = useState<{ id: string; fresh: boolean; text: string } | null>(null), [comment, setComment] = useState(''), [announcement, announce] = useState(''), [reticle, setReticle] = useState<FeedbackPoint>([50, 50]), [focused, setFocused] = useState(false), [hover, setHover] = useState<FeedbackPoint | null>(null), [rubber, setRubber] = useState<FeedbackPoint[]>([]), [imageError, setImageError] = useState(false);
  const gesture = useRef<{ points: FeedbackPoint[]; clientX: number; clientY: number } | null>(null);
  const completeRef = useRef(complete); completeRef.current = complete;
  const grow = (height: number) => setContentHeight(old => completeRef.current ? Math.max(1, height) : Math.max(old, height, 400));
  useEffect(() => { const persist = () => ctx.store.set(`${component!.id}.feedback`, feedback.toJSON(), { history: false }); persist(); return feedback.subscribe(persist); }, [feedback, ctx.store, component?.id]);
  useEffect(() => { feedback.setContext({ mockup: title, variant: props.variant, device }); }, [feedback, title, props.variant, device]);
  useEffect(() => { if (visible || !root.current || typeof IntersectionObserver === 'undefined') return; const observer = new IntersectionObserver(entries => { if (entries.some(e => e.isIntersecting)) { setVisible(true); observer.disconnect(); } }, { rootMargin: '200px' }); observer.observe(root.current); return () => observer.disconnect(); }, [visible]);
  useEffect(() => { if (!viewport.current || typeof ResizeObserver === 'undefined') return; const observer = new ResizeObserver(entries => setContainerWidth(entries[0].contentRect.width || 1280)); observer.observe(viewport.current); return () => observer.disconnect(); }, []);
  useEffect(() => {
    if (!visible || !framed || !iframe.current) return;
    const frame = (options.createController ?? createFrameController)(); controller.current = frame; frame.attach(iframe.current);
    const offSize = frame.on('size', message => grow(message.height));
    const offLayout = frame.on('layout', message => feedback.reanchor(Object.fromEntries(message.anchors.map(a => [a.key, a.box]))));
    return () => { offSize(); offLayout(); frame.destroy(); controller.current = null; };
  }, [visible, framed, options.createController, feedback]);
  useEffect(() => { controller.current?.render(kind === 'wire' ? wireframeDocument(source) : source, complete); }, [source, complete, kind, visible, options.createController]);
  useEffect(() => { controller.current?.setAnchors(feedback.anchorRequests()); }, [state, visible, feedback]);
  useEffect(() => { const escape = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape') { setExpanded(false); setPen(false); } }; document.addEventListener('keydown', escape); return () => document.removeEventListener('keydown', escape); }, []);
  const svg = kind === 'svg' ? sanitizeSvg(source) : '';
  useEffect(() => { setImageError(false); }, [props.src, source]);
  useEffect(() => { const element = graphic.current?.querySelector('svg'); if (!element) return; const box = element.getAttribute('viewBox')?.split(/[\s,]+/).map(Number); setNaturalWidth(box?.[2] || Number(element.getAttribute('width')) || 800); grow(box?.[3] || Number(element.getAttribute('height')) || 400); }, [svg, visible]);
  const width = framed ? widths[device] : naturalWidth, scale = Math.min(1, containerWidth / width) * zoom;
  const resolved = props.previous ? previousAsResolved(props.previous) : [];
  function open(id: string, fresh = false) { const item = feedback.getState().items.find(item => item.id === id); if (!item) return; setEditing({ id, fresh, text: item.comment }); setComment(item.comment); setActive(id); }
  function remove(id: string) { feedback.remove(id); setEditing(null); announce(labels.removed); }
  function close() { setEditing(null); }
  function save() { if (editing) feedback.edit(editing.id, { comment }); close(); }
  function cancel() { if (editing?.fresh && !editing.text) feedback.remove(editing.id); setEditing(null); }
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
  function add(rect: HitRect, points?: FeedbackPoint[], client?: FeedbackPoint) { const item = points ? feedback.addDrawing({ points, color }) : rect.w !== undefined ? feedback.addRegion({ ...rect, w: rect.w, h: rect.h ?? 0 }) : feedback.addPin(rect); open(item.id, true); announce(labels.added.replace('{n}', String(item.n))); if (!points) void target(item.id, rect, client); }
  function point(event: PointerEvent<HTMLElement>): FeedbackPoint { const box = event.currentTarget.getBoundingClientRect(); return [clamp((event.clientX - box.left) / (box.width || 1) * 100), clamp((event.clientY - box.top) / (box.height || 1) * 100)]; }
  const pointer = {
    onPointerDown(event: PointerEvent<HTMLDivElement>) { if (event.button !== 0 || submitted) return; event.preventDefault(); event.currentTarget.setPointerCapture?.(event.pointerId); const p = point(event); gesture.current = { points: [p], clientX: event.clientX, clientY: event.clientY }; setRubber([p]); },
    onPointerMove(event: PointerEvent<HTMLDivElement>) { const p = point(event); setHover(p); if (gesture.current) { gesture.current.points.push(p); setRubber([...gesture.current.points]); } },
    onPointerUp(event: PointerEvent<HTMLDivElement>) { const g = gesture.current; if (!g) return; gesture.current = null; setRubber([]); event.currentTarget.releasePointerCapture?.(event.pointerId); const p = point(event), first = g.points[0]; if (pen) add({ x: first[0], y: first[1] }, [...g.points, p]); else if (Math.hypot(event.clientX - g.clientX, event.clientY - g.clientY) < 5) add({ x: p[0], y: p[1] }, undefined, [event.clientX, event.clientY]); else add({ x: Math.min(first[0], p[0]), y: Math.min(first[1], p[1]), w: Math.abs(first[0] - p[0]), h: Math.abs(first[1] - p[1]) }, undefined, [event.clientX, event.clientY]); },
    onPointerCancel() { gesture.current = null; setRubber([]); }, onPointerLeave() { setHover(null); },
  };
  function onKeyDown(event: KeyboardEvent<HTMLElement>) { if (event.key === 'Escape') { cancel(); setPen(false); setExpanded(false); } if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); event.stopPropagation(); setEditing(null); event.shiftKey ? feedback.redo() : feedback.undo(); } }
  function canvasKey(event: KeyboardEvent<HTMLDivElement>) { if (event.target !== event.currentTarget || submitted) return; const step = event.shiftKey ? 10 : 2; if (event.key.startsWith('Arrow')) { event.preventDefault(); setReticle(([x, y]) => [clamp(x + (event.key === 'ArrowRight' ? step : event.key === 'ArrowLeft' ? -step : 0)), clamp(y + (event.key === 'ArrowDown' ? step : event.key === 'ArrowUp' ? -step : 0))]); } if (event.key === 'Enter') { event.preventDefault(); add({ x: reticle[0], y: reticle[1] }); } }
  return { props, kind, framed, complete, labels, title, source, svg, root, viewport, iframe, graphic, visible, width, scale, contentHeight, device, setDevice, zoom, setZoom, expanded, showSource, setShowSource, pen, setPen, color, setColor, active, setActive, editing, comment, setComment, announcement, reticle, focused, setFocused, hover, rubber, pointer, onKeyDown, canvasKey, feedback, state, resolved, submitted, setSubmitted, open, remove, save, cancel, close, imageError, setImageError,
    imageSrc: /^(https:|data:image\/)/i.test((props.src ?? source).trim()) ? (props.src ?? source).trim() : undefined,
    imageLoaded(width: number, height: number) { setNaturalWidth(width || 800); grow(height || 400); },
    async fullscreen() { try { if (document.fullscreenElement) await document.exitFullscreen(); else if (root.current?.requestFullscreen) await root.current.requestFullscreen(); else setExpanded(old => !old); } catch { setExpanded(old => !old); } },
    async copy() { try { await navigator.clipboard?.writeText(source); } catch {} },
    submit() { if (!feedback.canSubmit) return; const payload = feedback.toPayload(); emit('feedback', payload, toMessage(payload)); setSubmitted(true); setEditing(null); },
  };
}
export type MockupModel = ReturnType<typeof useMockup>;
