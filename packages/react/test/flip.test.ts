import { expect, test, mock } from 'bun:test';
import { Window } from 'happy-dom';
import { createFlip } from '../src/flip';

test('FLIP samples every in-flight visual rect before any animation is cancelled', () => {
  const window = new Window();
  const order: string[] = [];
  let layout = 0, visual = 0;
  const nodes = ['a', 'b'].map(id => {
    const node = window.document.createElement('div') as unknown as HTMLElement;
    window.document.body.appendChild(node as any);
    node.getBoundingClientRect = () => { order.push(`measure-${id}`); return { left: layout + visual, top: layout + visual } as DOMRect; };
    node.animate = mock(() => ({ cancel() { order.push(`cancel-${id}`); visual = 0; }, onfinish: null, oncancel: null }) as unknown as Animation);
    return node;
  });
  const flip = createFlip({ reducedMotion: false });
  flip.measure(nodes); layout = 100; flip.play();
  visual = -60; order.length = 0;
  flip.measure(nodes);
  expect(order).toEqual(['measure-a', 'measure-b', 'cancel-a', 'cancel-b']);
  layout = 200; flip.play();
  for (const node of nodes) expect(node.animate).toHaveBeenLastCalledWith([{ transform: 'translate(-160px, -160px)' }, { transform: 'none' }], expect.anything());
  flip.cancel();
});
test('FLIP reads theme spring timing and disables explicit animate=false', () => {
  const window = new Window();
  const node = window.document.createElement('div') as unknown as HTMLElement;
  window.document.body.appendChild(node as any);
  let left = 0;
  node.getBoundingClientRect = () => ({ left, top: 0 }) as DOMRect;
  node.style.setProperty('--prism-motion-spring', 'linear');
  node.style.setProperty('--prism-motion-spring-duration', '.6s');
  node.animate = mock(() => ({ cancel() {}, onfinish: null, oncancel: null }) as unknown as Animation);
  const flip = createFlip({ reducedMotion: false });
  flip.measure([node]); left = 20; flip.play();
  expect(node.animate).toHaveBeenLastCalledWith(expect.anything(), { duration: 600, easing: 'linear' });
  flip.cancel(); node.setAttribute('data-animate', 'false');
  flip.measure([node]); left = 40; flip.play();
  expect(node.animate).toHaveBeenCalledTimes(1);
});
