import { snappy } from './spring';

export interface FlipOptions {
  duration?: number; easing?: string; reducedMotion?: boolean | 'auto';
  enter?: boolean | { scale?: number; translateY?: number };
}
export type FlipElements = Iterable<Element> | ReadonlyMap<unknown, Element>;
interface Snapshot { element: Element; rect: DOMRect }
export function createFlip({ duration, easing, reducedMotion = 'auto', enter = false }: FlipOptions = {}) {
  let first = new Map<unknown, Snapshot>();
  let source: FlipElements | undefined;
  const running = new Map<Element, () => void>();
  function cancel() { for (const cleanup of [...running.values()]) cleanup(); running.clear(); }
  function entries(elements: FlipElements): [unknown, Element][] {
    return Array.from(elements as Iterable<Element | [unknown, Element]>, entry => Array.isArray(entry) ? entry : [entry, entry]);
  }
  function measure(elements: FlipElements) {
    source = elements;
    first = new Map(entries(elements).map(([key, element]) => [key, { element, rect: element.getBoundingClientRect() }]));
    // Moving an existing DOM node can restart its CSS @starting-style entry.
    for (const { element } of first.values()) {
      if (!element.isConnected) continue;
      element.setAttribute('data-prism-entered', '');
      for (const child of Array.from(element.querySelectorAll('*'))) child.setAttribute('data-prism-entered', '');
    }
    cancel();
  }
  function play(elements: FlipElements | undefined = source) {
    cancel();
    if (!elements) return;
    for (const [key, element] of entries(elements)) {
      const before = first.get(key);
      if (!element.isConnected || (!before && !enter)) continue;
      const view = element.ownerDocument.defaultView;
      if (reducedMotion === true || (reducedMotion === 'auto' && view?.matchMedia?.('(prefers-reduced-motion: reduce)').matches)) continue;
      if (element.closest('[data-animate="false"]')) continue;
      const style = view?.getComputedStyle(element);
      const timing = style?.getPropertyValue('--prism-motion-spring-duration').trim();
      const resolvedDuration = duration ?? (timing ? parseFloat(timing) * (timing.endsWith('ms') ? 1 : 1000) : 500);
      const resolvedEasing = easing ?? (style?.getPropertyValue('--prism-motion-spring').trim() || snappy.easing);
      const after = element.getBoundingClientRect();
      const x = before ? before.rect.left - after.left : 0;
      const y = before ? before.rect.top - after.top : typeof enter === 'object' ? enter.translateY ?? 8 : 8;
      if ((before && !x && !y) || resolvedDuration <= 0) continue;
      const inverse = `translate(${x}px, ${y}px)${before ? '' : ` scale(${typeof enter === 'object' ? enter.scale ?? 0.96 : 0.96})`}`;
      const transform = view?.getComputedStyle(element).transform || 'none';
      const opacity = view?.getComputedStyle(element).opacity || '1';
      if (typeof element.animate === 'function') {
        const start: Keyframe = { transform: `${inverse}${transform === 'none' ? '' : ` ${transform}`}` };
        const end: Keyframe = { transform };
        if (!before) { start.opacity = 0; end.opacity = opacity; }
        const animation = element.animate([start, end], { duration: resolvedDuration, easing: resolvedEasing });
        const cleanup = () => { animation.onfinish = null; animation.oncancel = null; animation.cancel(); running.delete(element); };
        running.set(element, cleanup);
        animation.onfinish = cleanup;
        animation.oncancel = cleanup;
      } else if ('style' in element) {
        const style = (element as HTMLElement).style;
        const transform = style.transform;
        const transition = style.transition;
        const originalOpacity = style.opacity;
        const cleanup = () => { clearTimeout(timer); style.transform = transform; style.transition = transition; style.opacity = originalOpacity; running.delete(element); };
        style.transition = 'none';
        style.transform = `${inverse} ${transform}`.trim();
        if (!before) style.opacity = '0';
        element.getBoundingClientRect();
        style.transition = `transform ${resolvedDuration}ms ${resolvedEasing}${before ? '' : `, opacity ${resolvedDuration}ms ${resolvedEasing}`}`;
        style.transform = transform;
        if (!before) style.opacity = opacity;
        const timer = setTimeout(cleanup, resolvedDuration);
        running.set(element, cleanup);
      }
    }
    first.clear();
  }
  return { measure, play, cancel };
}
