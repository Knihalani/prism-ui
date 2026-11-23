import { useCallback, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { motionDuration, useReducedMotion } from './motion';

export function useSmoothHeight(enabled = true, threshold = 24) {
  const flow = useRef<HTMLDivElement>(null), reduced = useReducedMotion();
  useLayoutEffect(() => {
    const content = flow.current, root = content?.parentElement;
    if (!enabled || reduced || !content || !root || typeof ResizeObserver === 'undefined') return;
    let previous: number | undefined, animation: Animation | undefined, start = 0;
    const overflow = { x: root.style.overflowX, y: root.style.overflowY };
    const clear = () => {
      animation?.cancel(); animation = undefined;
      root.style.overflowX = overflow.x; root.style.overflowY = overflow.y;
    };
    const observer = new ResizeObserver(() => {
      const style = getComputedStyle(root);
      const padding = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
      const border = parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
      const inset = (padding || 0) + (border || 0);
      const next = content.getBoundingClientRect().height + inset;
      const from = animation ? root.getBoundingClientRect().height : previous;
      const change = previous === undefined ? 0 : next - previous, delta = Math.abs(change);
      previous = next;
      if (from === undefined || delta < .5) return;
      if ((animation || delta > threshold) && content.getAnimations?.({ subtree: true }).some(item => 'transitionProperty' in item && item.transitionProperty === 'height')) { clear(); return; }
      const duration = motionDuration(style.getPropertyValue('--prism-motion-base'), 240);
      const line = parseFloat(style.lineHeight) || 0;
      const offset = style.boxSizing === 'border-box' ? 0 : inset;
      if (animation && delta <= Math.max(threshold, line * 1.1)) {
        start += change;
        (animation.effect as KeyframeEffect | null)?.setKeyframes([{ height: `${start}px` }, { height: `${next - offset}px` }]);
        return;
      }
      clear();
      if (delta <= Math.max(threshold, line * 1.1) || !duration || typeof root.animate !== 'function') return;
      start = from - offset;
      root.style.overflowY = 'clip'; root.style.overflowX = 'visible';
      animation = root.animate([{ height: `${start}px` }, { height: `${next - offset}px` }], {
        duration, easing: style.getPropertyValue('--prism-motion-ease').trim() || 'cubic-bezier(.23,1,.32,1)', fill: 'both',
      });
      const running = animation;
      animation.onfinish = () => { if (animation === running) clear(); };
    });
    observer.observe(content);
    return () => { observer.disconnect(); clear(); };
  }, [enabled, reduced, threshold]);
  return flow;
}

export function useFollowScroll(scrollRef: RefObject<HTMLElement | null>, { threshold = 72 } = {}) {
  const [following, setFollowing] = useState(true);
  const state = useRef({ following: true, node: null as HTMLElement | null, schedule: () => {}, cleanup: () => {} });
  const change = useCallback((next: boolean) => {
    state.current.following = next;
    setFollowing(next);
  }, []);
  const follow = useCallback((next: boolean) => { change(next); state.current.schedule(); }, [change]);
  const jumpToLatest = useCallback(() => follow(true), [follow]);
  useLayoutEffect(() => {
    const node = scrollRef.current;
    if (node === state.current.node) return;
    state.current.cleanup(); state.current.schedule = () => {}; state.current.node = node;
    if (!node) return;
    let active = true, frame: number | undefined, dragging = false, touchY = 0, quiet = 0, height: number | undefined, lastTop = node.scrollTop;
    const anchor = node.style.overflowAnchor, gutter = node.style.scrollbarGutter;
    const computedGutter = getComputedStyle(node).scrollbarGutter;
    if (!computedGutter || computedGutter === 'auto') node.style.scrollbarGutter = 'stable';
    const updateAnchor = () => {
      const value = state.current.following ? 'none' : anchor;
      if (node.style.overflowAnchor !== value) node.style.overflowAnchor = value;
    };
    const cancel = () => { if (frame !== undefined) cancelAnimationFrame(frame); frame = undefined; };
    const settle = () => {
      frame = undefined;
      if (!active || !state.current.following) return;
      const next = node.scrollHeight;
      quiet = next === height ? quiet + 1 : 0; height = next;
      const top = Math.max(0, next - node.clientHeight);
      if (Math.abs(node.scrollTop - top) > .5) node.scrollTop = top;
      lastTop = node.scrollTop;
      if (quiet < 24) frame = requestAnimationFrame(settle);
    };
    const schedule = () => {
      updateAnchor();
      if (!active) return;
      if (!state.current.following) { lastTop = node.scrollTop; cancel(); return; }
      quiet = 0;
      if (frame === undefined) frame = requestAnimationFrame(settle);
    };
    const stop = () => { lastTop = node.scrollTop; change(false); cancel(); updateAnchor(); };
    const scroll = () => {
      const distance = node.scrollHeight - node.clientHeight - node.scrollTop;
      if (dragging && distance > threshold) stop();
      else if (distance <= 2 || (node.scrollTop > lastTop && distance <= threshold)) { change(true); schedule(); }
      lastTop = node.scrollTop;
    };
    const pointerDown = (event: PointerEvent) => { dragging = event.target === node; };
    const pointerUp = () => { dragging = false; };
    const wheel = (event: WheelEvent) => { if (event.deltaY < 0) stop(); };
    const touchStart = (event: TouchEvent) => { touchY = event.touches[0]?.clientY ?? 0; };
    const touchMove = (event: TouchEvent) => {
      const y = event.touches[0]?.clientY ?? touchY;
      if (y > touchY) stop(); touchY = y;
    };
    const key = (event: KeyboardEvent) => {
      if ((event.target as Element)?.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"])')) return;
      if (['ArrowUp', 'PageUp', 'Home'].includes(event.key) || (event.key === ' ' && event.shiftKey)) stop();
    };
    const observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(schedule);
    const mutations = new MutationObserver(schedule);
    mutations.observe(node, { childList: true, characterData: true, attributes: true, subtree: true });
    observer?.observe(node); schedule();
    node.addEventListener('scroll', scroll); node.addEventListener('wheel', wheel, { passive: true });
    node.addEventListener('touchstart', touchStart, { passive: true }); node.addEventListener('touchmove', touchMove, { passive: true });
    node.addEventListener('keydown', key);
    node.addEventListener('load', schedule, true); node.addEventListener('error', schedule, true);
    node.addEventListener('pointerdown', pointerDown);
    node.ownerDocument.addEventListener('pointerup', pointerUp); node.ownerDocument.addEventListener('pointercancel', pointerUp);
    state.current.schedule = schedule;
    state.current.cleanup = () => {
      active = false;
      cancel();
      observer?.disconnect(); mutations.disconnect(); node.style.overflowAnchor = anchor; node.style.scrollbarGutter = gutter;
      node.removeEventListener('scroll', scroll); node.removeEventListener('wheel', wheel);
      node.removeEventListener('touchstart', touchStart); node.removeEventListener('touchmove', touchMove); node.removeEventListener('keydown', key);
      node.removeEventListener('load', schedule, true); node.removeEventListener('error', schedule, true);
      node.removeEventListener('pointerdown', pointerDown);
      node.ownerDocument.removeEventListener('pointerup', pointerUp); node.ownerDocument.removeEventListener('pointercancel', pointerUp);
    };
  });
  useLayoutEffect(() => () => { state.current.cleanup(); state.current.node = null; }, []);
  return { following, jumpToLatest, setFollowing: follow };
}
