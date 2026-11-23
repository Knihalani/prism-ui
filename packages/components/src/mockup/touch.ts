import { useLayoutEffect, useRef, useState, type PointerEvent, type RefObject } from 'react';

type Point = { x: number; y: number };
type Handlers = {
  onPointerDown(event: PointerEvent<HTMLDivElement>): void;
  onPointerMove(event: PointerEvent<HTMLDivElement>): void;
  onPointerUp(event: PointerEvent<HTMLDivElement>): void;
  onPointerCancel(event: PointerEvent<HTMLDivElement>): void;
  onLostPointerCapture(event: PointerEvent<HTMLDivElement>): void;
  onPointerLeave(): void;
};
export function useTouchFeedback({ canvas, viewport, zoom, setZoom, enabled, inline, cancel, pointer }: {
  canvas: RefObject<HTMLElement | null>; viewport: RefObject<HTMLElement | null>;
  zoom: number; setZoom(value: number): void; enabled: boolean; inline: boolean; cancel(): void; pointer: Handlers;
}): Handlers {
  const touches = useRef(new Map<number, Point>()), pen = useRef<number | null>(null);
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
    const element = canvas.current;
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
  return {
    ...pointer,
    onPointerDown(event) {
      if (event.pointerType === 'pen') { cancel(); touches.current.clear(); pinch.current = null; pen.current = event.pointerId; }
      if (event.pointerType === 'touch') {
        if (pen.current !== null || touches.current.size >= 2 || pinch.current?.ended) return;
        touches.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
        if (touches.current.size === 2) {
          const { distance, center } = measure(), box = event.currentTarget.getBoundingClientRect();
          pinch.current = { distance, zoom, center, anchor: { x: (center.x - box.left) / (box.width || 1), y: (center.y - box.top) / (box.height || 1) }, ended: false };
          cancel();
          for (const id of touches.current.keys()) event.currentTarget.setPointerCapture?.(id);
          return;
        }
      }
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
      pointer.onPointerMove(event);
    },
    onPointerUp(event) {
      if (event.pointerType === 'touch' && pen.current !== null) return;
      if (event.pointerId === pen.current) pen.current = null;
      if (pinch.current) { if (!touches.current.delete(event.pointerId)) return; pinch.current.ended = true; if (!touches.current.size) pinch.current = null; return; }
      touches.current.delete(event.pointerId); pointer.onPointerUp(event);
    },
    onPointerCancel(event) {
      if (event.pointerType === 'touch' && pen.current !== null) return;
      if (event.pointerId === pen.current) pen.current = null;
      if (touches.current.has(event.pointerId)) { touches.current.clear(); pinch.current = null; cancel(); }
      pointer.onPointerCancel(event);
    },
    onLostPointerCapture(event) { if (event.pointerId === pen.current) pen.current = null; if (!pinch.current) { touches.current.delete(event.pointerId); pointer.onLostPointerCapture(event); } },
  };
}
