import { useLayoutEffect, useRef, useState, type MouseEvent, type PointerEvent, type RefObject } from 'react';

type Point = { x: number; y: number };
type Handlers = {
  onPointerDown(event: PointerEvent<HTMLElement>): void;
  onPointerMove(event: PointerEvent<HTMLElement>): void;
  onPointerUp(event: PointerEvent<HTMLElement>): void;
  onPointerCancel(event: PointerEvent<HTMLElement>): void;
  onLostPointerCapture(event: PointerEvent<HTMLElement>): void;
  onPointerLeave(): void;
};
export function useTouchFeedback({ canvas, viewport, zoom, setZoom, enabled, inline, cancel, pointer }: {
  canvas: RefObject<HTMLElement | null>; viewport: RefObject<HTMLElement | null>;
  zoom: number; setZoom(value: number): void; enabled: boolean; inline: boolean; cancel(): void; pointer: Handlers;
}) {
  const touches = useRef(new Map<number, Point>()), pen = useRef<number | null>(null);
  const suppressMarkerClick = useRef(false);
  const pinch = useRef<{ distance: number; zoom: number; anchor: Point; center: Point; ended: boolean } | null>(null);
  const [revision, update] = useState(0);
  useLayoutEffect(() => {
    if (enabled) return;
    touches.current.clear(); pinch.current = null; pen.current = null; cancel();
    if (inline) setZoom(1);
  }, [enabled, inline, setZoom]);
  useLayoutEffect(() => {
    if (!enabled) return;
    const element = inline ? viewport.current?.parentElement : viewport.current;
    if (!element) return;
    const previous = element.getAttribute('data-feedback-scroll');
    element.setAttribute('data-feedback-scroll', canvas.current?.dataset.tool ?? 'pin');
    return () => { if (previous === null) element.removeAttribute('data-feedback-scroll'); else element.setAttribute('data-feedback-scroll', previous); };
  });
  useLayoutEffect(() => {
    if (!enabled || inline || zoom <= 1) return;
    const element = viewport.current;
    if (!element?.clientHeight || !element.scrollHeight) return;
    const previous = element.style.maxHeight;
    element.style.maxHeight = `${Math.min(element.clientHeight, element.scrollHeight / zoom)}px`;
    return () => { element.style.maxHeight = previous; };
  }, [enabled, inline, viewport, zoom]);
  useLayoutEffect(() => {
    const element = canvas.current?.parentElement;
    if (!enabled || !element) return;
    const block = (event: TouchEvent) => { if (event.touches.length > 1 || pen.current !== null) event.preventDefault(); };
    element.addEventListener('touchstart', block, { passive: false });
    element.addEventListener('touchmove', block, { passive: false });
    return () => { element.removeEventListener('touchstart', block); element.removeEventListener('touchmove', block); };
  });
  useLayoutEffect(() => {
    if (!enabled || !inline) return;
    const target = viewport.current, parent = target?.parentElement;
    if (!target || !parent || zoom === 1) return;
    const width = target.style.width, previousZoom = target.style.zoom, overflow = parent.style.overflow, maxHeight = parent.style.maxHeight;
    const scale = target.style.getPropertyValue('--prism-mockup-scale'), inverse = target.style.getPropertyValue('--prism-mockup-inverse-scale');
    const height = target.offsetHeight;
    target.style.width = `${target.offsetWidth}px`;
    target.style.zoom = String(zoom);
    target.style.setProperty('--prism-mockup-scale', String(zoom));
    target.style.setProperty('--prism-mockup-inverse-scale', String(1 / zoom));
    parent.style.overflow = 'auto'; parent.style.maxHeight = `${height}px`;
    return () => {
      target.style.width = width; target.style.zoom = previousZoom; parent.style.overflow = overflow; parent.style.maxHeight = maxHeight;
      if (scale) target.style.setProperty('--prism-mockup-scale', scale); else target.style.removeProperty('--prism-mockup-scale');
      if (inverse) target.style.setProperty('--prism-mockup-inverse-scale', inverse); else target.style.removeProperty('--prism-mockup-inverse-scale');
    };
  }, [enabled, inline, viewport, zoom]);
  useLayoutEffect(() => {
    const current = pinch.current, box = canvas.current?.getBoundingClientRect();
    const scroller = inline ? viewport.current?.parentElement : viewport.current;
    if (!current || current.ended || !box || !scroller) return;
    scroller.scrollLeft += box.left + current.anchor.x * box.width - current.center.x;
    scroller.scrollTop += box.top + current.anchor.y * box.height - current.center.y;
  }, [zoom, revision, inline, viewport, canvas]);
  const measure = () => {
    const [a, b] = [...touches.current.values()];
    return { distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 } };
  };
  const handlers: Handlers = {
    ...pointer,
    onPointerDown(event) {
      if (!enabled) return;
      const marker = event.currentTarget !== canvas.current;
      if (!touches.current.size && !pinch.current) suppressMarkerClick.current = false;
      if (marker && event.pointerType !== 'touch') return;
      if (event.pointerType === 'pen') { cancel(); touches.current.clear(); pinch.current = null; pen.current = event.pointerId; }
      if (event.pointerType === 'touch') {
        if (pen.current !== null || touches.current.size >= 2 || pinch.current?.ended) { suppressMarkerClick.current = true; return; }
        touches.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (touches.current.size === 2) {
          const { distance, center } = measure(), capture = canvas.current ?? event.currentTarget, box = capture.getBoundingClientRect();
          pinch.current = { distance, zoom, center, anchor: { x: (center.x - box.left) / (box.width || 1), y: (center.y - box.top) / (box.height || 1) }, ended: false };
          suppressMarkerClick.current = true;
          cancel();
          for (const id of touches.current.keys()) capture.setPointerCapture?.(id);
          return;
        }
      }
      if (marker) return;
      pointer.onPointerDown(event);
    },
    onPointerMove(event) {
      if (event.pointerType === 'touch' && pen.current !== null) return;
      if (pinch.current) {
        if (pinch.current.ended || !touches.current.has(event.pointerId)) return;
        touches.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        const { distance, center } = measure(); pinch.current.center = center;
        setZoom(Math.max(.5, Math.min(2, pinch.current.zoom * distance / pinch.current.distance)));
        update(value => value + 1); return;
      }
      if (touches.current.has(event.pointerId)) touches.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (event.currentTarget === canvas.current) pointer.onPointerMove(event);
    },
    onPointerUp(event) {
      if (event.pointerType === 'touch' && pen.current !== null) return;
      if (event.pointerId === pen.current) pen.current = null;
      if (pinch.current) { if (!touches.current.delete(event.pointerId)) return; pinch.current.ended = true; if (!touches.current.size) pinch.current = null; return; }
      touches.current.delete(event.pointerId); if (event.currentTarget === canvas.current) pointer.onPointerUp(event);
    },
    onPointerCancel(event) {
      if (event.pointerType === 'touch' && pen.current !== null) return;
      if (event.pointerId === pen.current) pen.current = null;
      if (touches.current.has(event.pointerId)) { touches.current.clear(); pinch.current = null; cancel(); }
      if (event.currentTarget === canvas.current) pointer.onPointerCancel(event);
    },
    onLostPointerCapture(event) { if (event.pointerId === pen.current) pen.current = null; if (!pinch.current) { touches.current.delete(event.pointerId); if (event.currentTarget === canvas.current) pointer.onLostPointerCapture(event); } },
  };
  return { pointer: handlers, markerPointer: {
    onPointerDown: handlers.onPointerDown, onPointerMove: handlers.onPointerMove, onPointerUp: handlers.onPointerUp,
    onPointerCancel: handlers.onPointerCancel, onLostPointerCapture: handlers.onLostPointerCapture,
    onClickCapture(event: MouseEvent<HTMLElement>) { if (event.detail && suppressMarkerClick.current) { event.preventDefault(); event.stopPropagation(); } },
  } };
}
