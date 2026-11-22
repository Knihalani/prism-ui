import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react';
import { useFlash, usePrism } from '@prism-ui/react';

export function motionAllowed(node: HTMLElement | null, animate: boolean) {
  return animate && !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches && !node?.closest('.prism-root[data-animate="false"]');
}
export function referencePaths(value: unknown): string[] {
  if (!value || typeof value !== 'object') return [];
  if ('$ref' in value && typeof value.$ref === 'string') return [value.$ref];
  return [...new Set(Object.values(value).flatMap(referencePaths))];
}
function LinkedPath({ path, children, active }: { path: string; children: ReactNode; active: boolean }) {
  const flash = useFlash(path);
  return <span data-prism-flash={active && flash ? '' : undefined}>{children}</span>;
}
export function LinkedValue({ paths, children, active = true }: { paths: string[]; children: ReactNode; active?: boolean }) {
  return paths.reduceRight<ReactNode>((value, path) => <LinkedPath key={path} path={path} active={active}>{value}</LinkedPath>, children);
}
export function useValueTween(value: number, animate: boolean, element?: RefObject<HTMLElement | null>) {
  const [display, setDisplay] = useState(value), shown = useRef(value);
  useEffect(() => {
    if (!motionAllowed(element?.current ?? null, animate) || !Number.isFinite(value) || !Number.isFinite(shown.current)) { shown.current = value; setDisplay(value); return; }
    const from = shown.current;
    if (Object.is(from, value)) return;
    const start = performance.now(); let frame: number;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / 250);
      shown.current = progress === 1 ? value : from + (value - from) * (1 - (1 - progress) ** 3);
      setDisplay(shown.current);
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, animate, element]);
  return animate && Number.isFinite(display) ? display : value;
}
export function MicroActions() {
  const { unstyled } = usePrism(), marker = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    marker.current?.closest('[data-part="root"]')?.querySelectorAll('[data-part="ask"], [data-part="undo"]').forEach(button => button.classList.toggle('prism-icon-btn', !unstyled));
  }, [unstyled]);
  return <span ref={marker} hidden />;
}
export function ActionCheck() {
  const { unstyled } = usePrism();
  return <svg className={unstyled ? undefined : 'prism-check'} width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><path d="m3 8 3 3 7-7" pathLength="1" /></svg>;
}
