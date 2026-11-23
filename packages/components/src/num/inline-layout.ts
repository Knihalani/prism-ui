import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';

export function useInlineReadout(visible: boolean, value: string) {
  const root = useRef<HTMLSpanElement>(null), readout = useRef<HTMLSpanElement>(null);
  const [position, setPosition] = useState({ x: 0, width: 280, below: false });
  useLayoutEffect(() => {
    const anchor = root.current, overlay = readout.current;
    if (!visible || !anchor || !overlay) return;
    let container = anchor.parentElement;
    while (container?.parentElement && (getComputedStyle(container).display.startsWith('inline') || container.classList.contains('prism-inline-feedback__target'))) container = container.parentElement;
    if (!container) return;
    const boundary = container;
    const update = () => {
      const box = anchor.getBoundingClientRect(), bounds = boundary.getBoundingClientRect(), style = getComputedStyle(boundary);
      const left = bounds.left + (parseFloat(style.paddingLeft) || 0) + boundary.clientLeft;
      const right = bounds.right - (parseFloat(style.paddingRight) || 0) - boundary.clientLeft;
      const width = Math.max(0, right - left), size = Math.min(overlay.getBoundingClientRect().width, width);
      const start = Math.max(left, Math.min(right - size, box.left + (box.width - size) / 2));
      const x = getComputedStyle(anchor).direction === 'rtl' ? box.right - start - size : start - box.left;
      let top = window.visualViewport?.offsetTop ?? 0;
      for (let parent = anchor.parentElement; parent; parent = parent.parentElement) {
        if (/^(auto|scroll|hidden|clip)$/.test(getComputedStyle(parent).overflowY)) top = Math.max(top, parent.getBoundingClientRect().top + parent.clientTop);
      }
      const overlayBox = overlay.getBoundingClientRect();
      const gap = Math.max(0, position.below ? overlayBox.top - box.bottom : box.top - overlayBox.bottom);
      const below = box.top - overlayBox.height - gap < top;
      setPosition(old => old.x === x && old.width === width && old.below === below ? old : { x, width, below });
    };
    update();
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(update);
    observer?.observe(boundary); observer?.observe(overlay);
    window.addEventListener('resize', update); window.addEventListener('scroll', update, true);
    return () => { observer?.disconnect(); window.removeEventListener('resize', update); window.removeEventListener('scroll', update, true); };
  }, [visible, value, position.below]);
  return { root, readout, below: position.below, style: { '--prism-num-readout-x': `${position.x}px`, '--prism-num-readout-width': `${position.width}px` } as CSSProperties };
}
