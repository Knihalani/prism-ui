import { useLayoutEffect, useState } from 'react';
import type { SurfaceRect } from './placement';

export function composerViewport(): SurfaceRect {
  const viewport = window.visualViewport;
  const probe = document.createElement('span');
  probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)';
  document.documentElement.append(probe);
  const style = getComputedStyle(probe), top = parseFloat(style.paddingTop) || 0, right = parseFloat(style.paddingRight) || 0, bottom = parseFloat(style.paddingBottom) || 0, left = parseFloat(style.paddingLeft) || 0;
  probe.remove();
  return { left: (viewport?.offsetLeft ?? 0) + left, top: (viewport?.offsetTop ?? 0) + top, width: Math.max(0, (viewport?.width ?? (document.documentElement.clientWidth || window.innerWidth)) - left - right), height: Math.max(0, (viewport?.height ?? window.innerHeight) - top - bottom) };
}
export function useComposerViewport() {
  const [bounds, setBounds] = useState(composerViewport);
  useLayoutEffect(() => {
    const update = () => setBounds(composerViewport()), viewport = window.visualViewport;
    window.addEventListener('resize', update); window.addEventListener('scroll', update, true);
    viewport?.addEventListener('resize', update); viewport?.addEventListener('scroll', update);
    return () => { window.removeEventListener('resize', update); window.removeEventListener('scroll', update, true); viewport?.removeEventListener('resize', update); viewport?.removeEventListener('scroll', update); };
  }, []);
  return bounds;
}
export function revealComposerInput(element: HTMLElement | null) {
  const input = element?.querySelector('textarea');
  if (!element || !input || input !== document.activeElement) return;
  const field = input.getBoundingClientRect(), box = element.getBoundingClientRect();
  if (field.bottom > box.bottom) element.scrollTop += field.bottom - box.bottom;
  else if (field.top < box.top) element.scrollTop -= box.top - field.top;
}
