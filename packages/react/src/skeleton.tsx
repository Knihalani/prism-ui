import { createElement, forwardRef, useImperativeHandle, useLayoutEffect, useRef, type ElementType } from 'react';
import { motionDuration } from './motion';

type StyledElement = HTMLElement | SVGElement;
type Frame = { source: StyledElement; ghost: StyledElement; rect: DOMRect };
const pending = new Map<Element, { frames: Frame[]; scope: Element; duration: number; easing: string }>();
const ancestors = new Map<Element, Frame>();
const inherited = new Set(('color color-scheme cursor direction font-family font-feature-settings font-kerning font-language-override font-optical-sizing font-palette font-size font-size-adjust font-stretch font-style font-synthesis font-synthesis-position font-synthesis-small-caps font-synthesis-style font-synthesis-weight font-variant font-variant-alternates font-variant-caps font-variant-east-asian font-variant-emoji font-variant-ligatures font-variant-numeric font-variant-position font-variation-settings font-weight line-height letter-spacing word-spacing text-align text-align-last text-combine-upright text-emphasis-color text-emphasis-position text-emphasis-style text-indent text-justify text-orientation text-rendering text-shadow text-transform text-underline-position white-space white-space-collapse visibility quotes list-style-image list-style-position list-style-type caption-side border-collapse border-spacing empty-cells tab-size hyphens overflow-wrap word-break writing-mode paint-order fill fill-opacity fill-rule stroke stroke-dasharray stroke-dashoffset stroke-linecap stroke-linejoin stroke-miterlimit stroke-opacity stroke-width clip-rule color-interpolation color-interpolation-filters dominant-baseline marker-end marker-mid marker-start shape-rendering').split(' '));
const omitted = new WeakMap<StyledElement, [string, string][]>();
const declarations = new WeakMap<StyledElement, [string, string][]>();

function copy(source: StyledElement, deep: boolean) {
  const ghost = source.cloneNode(deep) as StyledElement;
  const originals = [source, ...(deep ? Array.from(source.querySelectorAll<StyledElement>('*')) : [])];
  const clones = [ghost, ...(deep ? Array.from(ghost.querySelectorAll<StyledElement>('*')) : [])];
  originals.forEach((original, index) => {
    const clone = clones[index], style = getComputedStyle(original), parent = original.parentElement;
    const parentStyle = parent ? getComputedStyle(parent) : null, values: [string, string][] = [], copied: [string, string][] = [];
    for (let property = 0; property < style.length; property++) {
      const name = style.item(property);
      const value = style.getPropertyValue(name);
      if (inherited.has(name) && !original.style.getPropertyValue(name) && value === parentStyle?.getPropertyValue(name)) {
        if (!index) values.push([name, value]);
        continue;
      }
      copied.push([name, value]);
    }
    clone.removeAttribute('id'); clone.removeAttribute('autofocus');
    declarations.set(clone, copied);
    if (!index) omitted.set(clone, values);
  });
  return ghost;
}

function restore(ghost: StyledElement) {
  for (const element of [ghost, ...Array.from(ghost.querySelectorAll<StyledElement>('*'))]) {
    for (const [name, value] of declarations.get(element) ?? []) element.style.setProperty(name, value);
    declarations.delete(element);
  }
}

function freeze(frame: Frame, width: number, height: number) {
  Object.assign(frame.ghost.style, {
    position: 'absolute', boxSizing: 'border-box', width: `${width}px`, height: `${height}px`,
    minWidth: '0', minHeight: '0', maxWidth: 'none', maxHeight: 'none', margin: '0', transform: 'none', translate: 'none', scale: 'none', rotate: 'none',
  });
}

function flush() {
  const exits = new Map<Element, Map<Element, StyledElement>>();
  for (const [element, { frames, scope, duration, easing }] of pending) {
    if (element.isConnected || !scope.isConnected || frames.slice(1).some(frame => pending.has(frame.source))) continue;
    const svg = element.namespaceURI === 'http://www.w3.org/2000/svg';
    const index = frames.findIndex(frame => frame.source.isConnected && (!svg || frame.source.namespaceURI !== element.namespaceURI));
    const last = index < 0 ? frames.length - 1 : index - 1;
    const parent = index < 0 ? scope : frames[index].source, root = frames[last], ghost = root.ghost;
    restore(ghost);
    for (let child = 0; child < last; child++) {
      const frame = frames[child], ancestor = frames[child + 1];
      if (frame.source.namespaceURI === 'http://www.w3.org/2000/svg') continue;
      const sx = ancestor.source instanceof HTMLElement && ancestor.source.offsetWidth ? ancestor.rect.width / ancestor.source.offsetWidth : 1;
      const sy = ancestor.source instanceof HTMLElement && ancestor.source.offsetHeight ? ancestor.rect.height / ancestor.source.offsetHeight : 1;
      freeze(frame, frame.rect.width / sx, frame.rect.height / sy);
      frame.ghost.style.left = `${(frame.rect.left - ancestor.rect.left) / sx - ancestor.source.clientLeft + ancestor.source.scrollLeft}px`;
      frame.ghost.style.top = `${(frame.rect.top - ancestor.rect.top) / sy - ancestor.source.clientTop + ancestor.source.scrollTop}px`;
    }
    const existing = exits.get(root.source);
    if (existing) {
      for (let child = last - 1; child >= 0; child--) {
        if (existing.has(frames[child].source)) continue;
        existing.get(frames[child + 1].source)!.append(frames[child].ghost);
        for (let inner = child; inner >= 0; inner--) existing.set(frames[inner].source, frames[inner].ghost);
        break;
      }
      continue;
    }
    exits.set(root.source, new Map(frames.slice(0, last + 1).map(frame => [frame.source, frame.ghost])));
    for (const [name, value] of omitted.get(ghost) ?? []) ghost.style.setProperty(name, value);
    ghost.setAttribute('aria-hidden', 'true'); ghost.setAttribute('inert', '');
    if (ghost instanceof HTMLElement) ghost.inert = true;
    ghost.setAttribute('data-prism-skeleton-exit', '');
    ghost.style.setProperty('--prism-motion-fast', `${duration}ms`);
    if (easing) ghost.style.setProperty('--prism-motion-ease-exit', easing);
    ghost.style.pointerEvents = 'none';
    freeze(root, root.rect.width, root.rect.height);
    Object.assign(ghost.style, { left: '0', top: '0', right: 'auto', bottom: 'auto' });
    parent.append(ghost);
    const origin = ghost.getBoundingClientRect();
    const sx = origin.width / root.rect.width || 1, sy = origin.height / root.rect.height || 1;
    freeze(root, root.rect.width / sx, root.rect.height / sy);
    ghost.style.left = `${(root.rect.left - origin.left) / sx}px`;
    ghost.style.top = `${(root.rect.top - origin.top) / sy}px`;
    ghost.getBoundingClientRect(); ghost.style.opacity = '0';
    setTimeout(() => ghost.remove(), duration);
  }
  pending.clear();
  ancestors.clear();
}

function capture(element: StyledElement | null) {
  const scope = element?.closest('.prism-root[data-prism-presentation]');
  if (!element || !scope || element.closest('[data-animate="false"]')) return;
  for (let ancestor = element.parentElement; ancestor && ancestor !== scope; ancestor = ancestor.parentElement) {
    if (pending.has(ancestor)) return;
  }
  const style = getComputedStyle(element), duration = motionDuration(style.getPropertyValue('--prism-motion-fast'), 160);
  const rect = element.getBoundingClientRect();
  if (!duration || !rect.width || !rect.height) return;
  const frames: Frame[] = [{ source: element, ghost: copy(element, true), rect }];
  for (let ancestor = element.parentElement; ancestor && ancestor !== scope; ancestor = ancestor.parentElement) {
    let snapshot = ancestors.get(ancestor);
    if (!snapshot) {
      snapshot = { source: ancestor, ghost: copy(ancestor, false), rect: ancestor.getBoundingClientRect() };
      ancestors.set(ancestor, snapshot);
    }
    const ghost = snapshot.ghost.cloneNode(false) as StyledElement;
    declarations.set(ghost, declarations.get(snapshot.ghost) ?? []);
    omitted.set(ghost, omitted.get(snapshot.ghost) ?? []);
    ghost.append(frames.at(-1)!.ghost);
    frames.push({ source: ancestor, ghost, rect: snapshot.rect });
  }
  if (!pending.size) queueMicrotask(flush);
  pending.set(element, { frames, scope, duration, easing: style.getPropertyValue('--prism-motion-ease-exit') });
}

export const SkeletonPart = forwardRef<StyledElement, { element: ElementType; elementProps: Record<string, unknown> }>(function SkeletonPart({ element, elementProps }, forwardedRef) {
  const ref = useRef<StyledElement>(null);
  useImperativeHandle(forwardedRef, () => ref.current!);
  useLayoutEffect(() => () => { capture(ref.current); }, []);
  return createElement(element, { ...elementProps, ref });
});
