import '../../../react/test/setup';
import { afterEach, beforeEach, expect, test } from 'bun:test';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { Prism, createRegistry, usePrism, type PrismComponentProps } from '@prism-ui/react';
import { mockupDefinition, MockupView } from './mockup';
import { useMockup, type MockupModel, type MockupProps } from './use-mockup';
import { composerViewport } from './viewport';
import { placeComposer } from './placement';

const observer = globalThis.IntersectionObserver, visual = Object.getOwnPropertyDescriptor(window, 'visualViewport');
beforeEach(() => { globalThis.IntersectionObserver = undefined as any; });
afterEach(() => { cleanup(); globalThis.IntersectionObserver = observer; if (visual) Object.defineProperty(window, 'visualViewport', visual); else delete (window as any).visualViewport; });
function setup() {
  let model!: MockupModel;
  function Test({ props }: PrismComponentProps<MockupProps>) { model = useMockup(props, usePrism()); return <MockupView vm={model} />; }
  const view = render(<Prism animate={false} registry={createRegistry([{ ...mockupDefinition, component: Test }])} source={'```ui:mockup\n{"id":"touch","kind":"svg","source":"<svg viewBox=\"0 0 375 300\"/>"}\n```'} />);
  const canvas = view.getByRole('application'), viewport = model.viewport.current!;
  model.root.current!.getBoundingClientRect = () => new DOMRect(0, 0, 375, 812);
  canvas.getBoundingClientRect = () => new DOMRect(-viewport.scrollLeft, 100 - viewport.scrollTop, 375 * model.zoom, 300 * model.zoom);
  Object.defineProperties(viewport, { clientHeight: { configurable: true, get: () => 200 }, scrollHeight: { configurable: true, get: () => 300 * model.zoom } });
  const pointer = (type: string, id: number, x: number, y = 180, pointerType = 'touch', pressure = .5) => fireEvent(canvas, new window.PointerEvent(type, { bubbles: true, button: 0, pointerId: id, pointerType, clientX: x, clientY: y, pressure }));
  return { view, canvas, viewport, pointer, get model() { return model; } };
}
for (const tool of ['pin', 'region', 'draw'] as const) test(`${tool}: second touch clears the gesture, pinches continuously and drains both pointers without feedback`, () => {
  const x = setup(); act(() => x.model.setTool(tool));
  x.pointer('pointerdown', 1, 80); x.pointer('pointermove', 1, 90);
  x.pointer('pointerdown', 2, 190);
  expect(x.model.live.current.points).toHaveLength(0); expect(x.model.editing).toBeNull();
  x.pointer('pointerdown', 3, 350); x.pointer('pointermove', 3, 500); expect(x.model.zoom).toBe(1);
  x.pointer('pointermove', 2, 225); expect(x.model.zoom).toBeCloseTo(1.35); expect(x.viewport.scrollLeft).toBeGreaterThan(0);
  x.pointer('pointermove', 2, 600); expect(x.model.zoom).toBe(2);
  x.pointer('pointerup', 3, 500); x.pointer('pointerup', 1, 90); x.pointer('pointermove', 2, 250); x.pointer('pointerup', 2, 250);
  expect(x.model.state.items).toHaveLength(0); expect(x.model.editing).toBeNull();
  act(() => x.model.setTool('pin')); x.pointer('pointerdown', 4, 150); x.pointer('pointerup', 4, 150); expect(x.model.state.items).toHaveLength(1);
});
test('two-finger translation pans even when the final distance and zoom do not change', () => {
  const x = setup(); x.pointer('pointerdown', 1, 100); x.pointer('pointerdown', 2, 200); x.pointer('pointermove', 2, 300);
  const scroll = x.viewport.scrollLeft;
  x.pointer('pointermove', 1, 80); x.pointer('pointermove', 2, 280);
  expect(x.model.zoom).toBe(2); expect(x.viewport.scrollLeft).toBeGreaterThan(scroll);
  x.pointer('pointercancel', 1, 80); x.pointer('pointerup', 2, 280); expect(x.model.state.items).toHaveLength(0);
});
test('touch/palm events do not cancel or contaminate an active pressure-aware pen stroke', () => {
  const x = setup(); act(() => x.model.setTool('draw'));
  x.pointer('pointerdown', 10, 80, 180, 'pen', .2);
  x.pointer('pointerdown', 1, 100); x.pointer('pointerdown', 2, 200); x.pointer('pointermove', 2, 300); x.pointer('pointercancel', 1, 100); x.pointer('pointerup', 2, 300);
  x.pointer('pointermove', 10, 150, 220, 'pen', .8); x.pointer('pointerup', 10, 150, 220, 'pen', .8);
  expect(x.model.zoom).toBe(1); expect(x.model.state.items).toHaveLength(1);
  expect(x.model.state.items[0].kind).toBe('drawing'); expect(x.model.state.items[0].pressure?.[0]).toEqual([.2, .8]);
});
test('Pin touch swipe creates neither a region nor a composer, while mouse drag still creates a region', () => {
  const x = setup(); x.pointer('pointerdown', 1, 100); x.pointer('pointermove', 1, 200); x.pointer('pointerup', 1, 200);
  expect(x.model.state.items).toHaveLength(0); expect(x.model.editing).toBeNull();
  x.pointer('pointerdown', 2, 100, 180, 'mouse'); x.pointer('pointermove', 2, 200, 200, 'mouse'); x.pointer('pointerup', 2, 200, 200, 'mouse');
  expect(x.model.state.items[0].kind).toBe('region');
});
test('lost pen capture clears pen priority so subsequent touch gestures still work', () => {
  const x = setup(); act(() => x.model.setTool('draw'));
  x.pointer('pointerdown', 10, 80, 180, 'pen', .2); x.pointer('lostpointercapture', 10, 80, 180, 'pen');
  expect(x.model.live.current.points).toHaveLength(0);
  x.pointer('pointerdown', 1, 100); x.pointer('pointermove', 1, 150, 220); x.pointer('pointerup', 1, 150, 220);
  expect(x.model.state.items).toHaveLength(1); expect(x.model.state.items[0].kind).toBe('drawing');
});
test('a hidden grouped viewport is not frozen to a zero-height scrollport when shared zoom changes', () => {
  const x = setup(), before = x.viewport.style.maxHeight;
  Object.defineProperty(x.viewport, 'clientHeight', { configurable: true, get: () => 0 });
  act(() => x.model.setZoom(1.5)); expect(x.viewport.style.maxHeight).toBe(before);
});
test('composer follows visualViewport resize/scroll and uses its offset bounds and height cap', () => {
  const vv = Object.assign(new window.EventTarget(), { width: 320, height: 320, offsetLeft: 20, offsetTop: 80 });
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: vv });
  expect(composerViewport()).toEqual({ left: 20, top: 80, width: 320, height: 320 });
  const x = setup(); x.pointer('pointerdown', 1, 300, 290); x.pointer('pointerup', 1, 300, 290);
  const dialog = x.view.getByRole('dialog') as HTMLElement;
  expect(parseFloat(dialog.style.left)).toBeGreaterThanOrEqual(32); expect(parseFloat(dialog.style.top)).toBeGreaterThanOrEqual(92); expect(dialog.style.maxHeight).toBe('296px');
  act(() => { vv.height = 160; vv.offsetTop = 0; vv.dispatchEvent(new window.Event('resize')); });
  expect(dialog.style.maxHeight).toBe('136px'); expect(parseFloat(dialog.style.top) + 136).toBeLessThanOrEqual(148);
  act(() => { vv.offsetTop = 60; vv.dispatchEvent(new window.Event('scroll')); });
  expect(parseFloat(dialog.style.top)).toBeGreaterThanOrEqual(72);
});
test('placement flips above a keyboard-obscured anchor and caps an oversized editor', () => {
  const bounds = { left: 30, top: 50, width: 320, height: 320 };
  const result = placeComposer({ left: 0, top: 0, width: 375, height: 812 }, { x: 250, y: 600 }, bounds, 500);
  expect(result.left).toBeGreaterThanOrEqual(42); expect(result.left + result.width).toBeLessThanOrEqual(338);
  expect(result.top).toBe(62); expect(result.top + 296).toBe(358); expect(result.side).toBe('bottom');
  Object.defineProperty(window, 'visualViewport', { configurable: true, value: undefined }); expect(composerViewport().top).toBe(0); expect(composerViewport().height).toBe(window.innerHeight);
});
