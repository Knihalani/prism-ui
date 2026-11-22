import '../../react/test/setup';
import { expect, test } from 'bun:test';
import { cleanup, render } from '@testing-library/react';
import type { CSSProperties } from 'react';
import { useFlip } from '../src/pick/flip';

test('shared Pick FLIP measures visual positions before cancelling and handles disabled and empty lists', () => {
  let motion: ReturnType<typeof useFlip>, top = 0, cancelled = 0;
  const frames: Keyframe[][] = [];
  function Fixture({ enabled = true, empty = false }: { enabled?: boolean; empty?: boolean }) {
    motion = useFlip(enabled);
    return <div ref={motion.ref} style={{ '--prism-pick-motion-base': '100ms' } as CSSProperties}>{!empty && <div data-option="a" />}</div>;
  }
  const view = render(<Fixture />), element = view.container.querySelector<HTMLElement>('[data-option]')!;
  element.getBoundingClientRect = () => new DOMRect(0, top, 20, 20);
  element.animate = ((keyframes: Keyframe[]) => {
    frames.push(keyframes);
    return { cancel() { cancelled++; top = 40; }, onfinish: null, oncancel: null } as unknown as Animation;
  }) as typeof element.animate;
  try {
    motion!.measure(); top = 40; view.rerender(<Fixture />);
    expect(frames[0][0].transform).toBe('translate(0px, -40px)');
    top = 20; motion!.measure(); top = 80; view.rerender(<Fixture />);
    expect(frames[1][0].transform).toBe('translate(0px, -60px)');
    expect(cancelled).toBeGreaterThan(0);
    view.rerender(<Fixture enabled={false} />); motion!.measure(); top = 120; view.rerender(<Fixture enabled={false} />);
    expect(frames).toHaveLength(2);
    view.rerender(<Fixture empty />); motion!.measure(); view.rerender(<Fixture empty />);
    expect(frames).toHaveLength(2);
  } finally { cleanup(); }
});
