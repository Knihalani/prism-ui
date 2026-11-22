import { expect, test, mock } from 'bun:test';
import { Window } from 'happy-dom';
import { createFlip } from './flip';
import { spring } from '@prism-ui/react';

function setup() {
  const window = new Window();
  const node = window.document.createElement('div');
  window.document.body.appendChild(node);
  let top = 0;
  node.getBoundingClientRect = () => new window.DOMRect(top, top, 10, 10);
  const element = node as unknown as HTMLElement;
  const animation = { cancel: mock(() => {}), onfinish: null as (() => void) | null, oncancel: null as (() => void) | null };
  element.animate = mock(() => animation as unknown as Animation);
  return { window, element, animation, move: (value: number) => { top = value; } };
}
test('SSR safe empty lifecycle', () => {
  const flip = createFlip();
  flip.play(); flip.measure([]); flip.play(); flip.cancel();
});
test('optional configurable entry animation respects reduced motion', () => {
  for (const reducedMotion of [false, true]) {
    const { element } = setup();
    const flip = createFlip({ enter: { scale: 0.9, translateY: 4 }, reducedMotion });
    flip.measure([]); flip.play([element]);
    if (reducedMotion) expect(element.animate).not.toHaveBeenCalled();
    else expect(element.animate).toHaveBeenCalledWith([{ transform: 'translate(0px, 4px) scale(0.9)', opacity: 0 }, { transform: 'none', opacity: '1' }], { duration: 500, easing: spring({ response: .35, damping: .85 }).easing });
    flip.cancel();
  }
});
test('WAAPI inversion and cleanup with custom timing', () => {
  const { element, move, animation } = setup();
  const flip = createFlip({ duration: 400, easing: 'linear', reducedMotion: false });
  flip.measure([element]); move(20); flip.play();
  expect(element.animate).toHaveBeenCalledWith([{ transform: 'translate(-20px, -20px)' }, { transform: 'none' }], { duration: 400, easing: 'linear' });
  animation.onfinish?.();
  expect(animation.cancel).toHaveBeenCalledTimes(1);
});
test('keyed maps, entering, leaving and stationary elements', () => {
  const a = setup(); const b = setup(); const c = setup();
  const map = new Map([['a', a.element], ['b', b.element]]);
  const flip = createFlip({ reducedMotion: false });
  flip.measure(map); map.delete('b'); map.set('c', c.element); a.move(10); flip.play();
  expect(a.element.animate).toHaveBeenCalledTimes(1);
  expect(b.element.animate).not.toHaveBeenCalled();
  expect(c.element.animate).not.toHaveBeenCalled();
  flip.measure(map); flip.play();
  expect(a.element.animate).toHaveBeenCalledTimes(1);
  expect(a.animation.cancel).toHaveBeenCalledTimes(1);
});
test('reduced motion explicit and automatic, disconnected and zero duration skip', () => {
  for (const mode of ['explicit', 'auto', 'disconnected', 'zero'] as const) {
    const { element, window, move } = setup();
    window.matchMedia = (() => ({ matches: true })) as unknown as typeof window.matchMedia;
    const flip = createFlip({ reducedMotion: mode === 'explicit' ? true : mode === 'auto' ? 'auto' : false, duration: mode === 'zero' ? 0 : 200 });
    flip.measure([element]); move(10);
    if (mode === 'disconnected') element.remove();
    flip.play();
    expect(element.animate).not.toHaveBeenCalled();
  }
});
test('cancel and remeasure cancel in-flight animations', () => {
  const { element, animation, move } = setup();
  const flip = createFlip({ reducedMotion: false });
  flip.measure([element]); move(10); flip.play(); flip.cancel();
  expect(animation.cancel).toHaveBeenCalledTimes(1);
  flip.measure([element]); move(20); flip.play(); flip.measure([element]);
  expect(animation.cancel).toHaveBeenCalledTimes(2);
});
test('CSS fallback restores original styles on completion and cancellation', async () => {
  const { element, move } = setup();
  Object.defineProperty(element, 'animate', { value: undefined });
  element.style.transform = 'scale(2)'; element.style.transition = 'opacity 1s';
  const flip = createFlip({ duration: 5, reducedMotion: false });
  flip.measure([element]); move(10); flip.play();
  expect(element.style.transition).toBe(`transform 5ms ${spring({ response: .35, damping: .85 }).easing}`);
  expect(element.style.transform).toBe('scale(2)');
  await new Promise(resolve => setTimeout(resolve, 15));
  expect(element.style.transition).toBe('opacity 1s');
  flip.measure([element]); move(20); flip.play(); flip.cancel();
  expect(element.style.transition).toBe('opacity 1s');
});
