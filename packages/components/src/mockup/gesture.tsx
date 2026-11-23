import { useLayoutEffect, useRef, useState } from 'react';
import { PrismPart, usePart } from '@prism-ui/react';
import { MockupIcon as Icon } from './icon';
import { regionDimensions, strokeOutline } from './outline';
import type { MockupModel } from './use-mockup';

export function useCanvasSize(vm: MockupModel) {
  const [size, setSize] = useState({ width: vm.width * vm.scale, height: vm.contentHeight * vm.scale });
  useLayoutEffect(() => { const box = vm.canvas.current?.getBoundingClientRect(); if (box?.width && box.height) setSize(old => old.width === box.width && old.height === box.height ? old : { width: box.width, height: box.height }); });
  useLayoutEffect(() => {
    const canvas = vm.canvas.current; if (!canvas) return;
    const measure = () => { const box = canvas.getBoundingClientRect(); if (box.width && box.height) setSize(old => old.width === box.width && old.height === box.height ? old : { width: box.width, height: box.height }); };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(measure);
    observer?.observe(canvas);
    return () => observer?.disconnect();
  }, [vm.canvas, vm.width, vm.scale, vm.contentHeight]);
  return size;
}

export function GestureOverlay({ vm, size }: { vm: MockupModel; size: { width: number; height: number } }) {
  const root = usePart('mockup', 'gesture'), bandPart = usePart('mockup', 'band'), dimensionPart = usePart('mockup', 'dimension'), stroke = usePart('mockup', 'stroke'), pathPart = usePart('mockup', 'strokePath'), hintPart = usePart('mockup', 'hint');
  const band = useRef<HTMLSpanElement>(null), dimension = useRef<HTMLSpanElement>(null), svg = useRef<SVGSVGElement>(null), path = useRef<SVGPathElement>(null), hint = useRef<HTMLSpanElement>(null), frame = useRef<number | undefined>(undefined);
  useLayoutEffect(() => {
    const paint = () => {
      const { points, pressure, realPressure, hover, tool } = vm.live.current, first = points[0], last = points.at(-1);
      const bounds = vm.canvas.current?.getBoundingClientRect(), width = bounds?.width || size.width, height = bounds?.height || size.height;
      const region = !!first && tool !== 'draw', drawing = !!first && tool === 'draw';
      svg.current?.setAttribute('viewBox', `0 0 ${width} ${height}`);
      if (path.current) { path.current.setAttribute('d', drawing ? strokeOutline(points, width, height, realPressure ? pressure : undefined) : ''); path.current.style.fill = vm.color; }
      if (band.current) {
        band.current.hidden = !region;
        if (region && last) Object.assign(band.current.style, { left: `${Math.min(first[0], last[0])}%`, top: `${Math.min(first[1], last[1])}%`, width: `${Math.abs(last[0] - first[0])}%`, height: `${Math.abs(last[1] - first[1])}%` });
      }
      if (dimension.current) {
        dimension.current.hidden = !region;
        if (region && last) {
          dimension.current.textContent = regionDimensions(first, last, width, height, vm.scale);
          const contentWidth = width / vm.scale, contentHeight = height / vm.scale, x = last[0] / 100 * contentWidth, y = last[1] / 100 * contentHeight;
          const w = dimension.current.offsetWidth, h = dimension.current.offsetHeight, gap = 6 / vm.scale;
          Object.assign(dimension.current.style, { left: `${Math.max(0, Math.min(contentWidth - w, x + w + gap > contentWidth ? x - w - gap : x + gap))}px`, top: `${Math.max(0, Math.min(contentHeight - h, y + h + gap > contentHeight ? y - h - gap : y + gap))}px` });
        }
      }
      if (hint.current) { hint.current.hidden = !hover || !!first || !!vm.state.items.length || vm.submitted; if (hover) Object.assign(hint.current.style, { left: `${Math.min(65, hover[0])}%`, top: `${hover[1]}%` }); }
    };
    vm.livePaint.current = () => { if (frame.current === undefined) frame.current = requestAnimationFrame(() => { frame.current = undefined; paint(); }); };
    paint();
    return () => { if (frame.current !== undefined) cancelAnimationFrame(frame.current); frame.current = undefined; vm.livePaint.current = null; };
  }, [vm.live, vm.livePaint, vm.color, vm.scale, vm.state.items.length, vm.submitted, size.width, size.height]);
  return <PrismPart as="span" {...root} slotProps={{ model: vm }} aria-hidden="true">
    <PrismPart as="span" {...bandPart} slotProps={{ model: vm }} ref={band} hidden />
    <PrismPart as="span" {...dimensionPart} slotProps={{ model: vm }} ref={dimension} hidden />
    <PrismPart as="svg" {...stroke} slotProps={{ model: vm }} ref={svg} viewBox={`0 0 ${size.width} ${size.height}`}><PrismPart as="path" {...pathPart} slotProps={{ model: vm }} ref={path} /></PrismPart>
    <PrismPart as="span" {...hintPart} slotProps={{ model: vm }} ref={hint} hidden><Icon name="plus" />{vm.labels.hint}</PrismPart>
  </PrismPart>;
}
