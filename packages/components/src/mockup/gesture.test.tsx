import '../../../react/test/setup';
import { afterEach, beforeEach, expect, test } from 'bun:test';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { Prism, createRegistry, usePrism, type Action, type PrismComponentProps } from '@prism-ui/react';
import { createStore } from '@prism-ui/state';
import { MockupView, mockupDefinition } from './mockup';
import { useMockup, type MockupModel, type MockupProps } from './use-mockup';
import { createFeedback, pathStrokes } from './engine/feedback';
import { drawingOutline, regionDimensions, strokeOutline } from './outline';
import { mockupPlugin } from './plugin';
import { placeComposer } from './placement';
import '../feedback';

const observer = globalThis.IntersectionObserver;
beforeEach(() => { globalThis.IntersectionObserver = undefined as any; });
afterEach(() => { cleanup(); globalThis.IntersectionObserver = observer; });
function change(element: HTMLElement, value: string) { act(() => element.focus()); fireEvent.change(element, { target: { value } }); fireEvent.keyUp(element, { key: 'Unidentified' }); }
function setup() {
  let model!: MockupModel, renders = 0;
  const store = createStore(), actions: Action[] = [];
  function Test({ props }: PrismComponentProps<MockupProps>) { renders++; model = useMockup(props, usePrism()); return <MockupView vm={model} />; }
  const registry = createRegistry([{ ...mockupDefinition, component: Test }]);
  const source = '```ui:mockup\n' + JSON.stringify({ id: 'review', kind: 'svg', source: '<svg viewBox="0 0 1000 500"><rect width="1000" height="500"/></svg>' }) + '\n```';
  const view = render(<Prism registry={registry} store={store} animate={false} source={source} onAction={action => actions.push(action)} />);
  const canvas = view.getByRole('application');
  canvas.getBoundingClientRect = () => new DOMRect(0, 0, 1000, 500);
  const pointer = (type: string, x: number, y: number, pressure = .5, pointerType = 'mouse', coalesced?: PointerEvent[]) => {
    const event = new window.PointerEvent(type, { bubbles: true, button: 0, pointerId: 1, clientX: x, clientY: y, pressure, pointerType });
    if (coalesced) Object.defineProperty(event, 'getCoalescedEvents', { value: () => coalesced });
    fireEvent(canvas, event);
  };
  const flush = () => act(async () => { await new Promise<void>(resolve => requestAnimationFrame(() => resolve())); });
  return { view, canvas, store, actions, pointer, flush, get model() { return model; }, get renders() { return renders; } };
}

test('P/R/D select explicit tools, announce them and leave text fields and modifiers alone', () => {
  const x = setup();
  for (const [key, tool] of [['r', 'region'], ['D', 'draw'], ['p', 'pin']] as const) {
    fireEvent.keyDown(x.canvas, { key }); expect(x.model.tool).toBe(tool); expect(x.model.announcement).toContain(x.model.labels[tool]);
  }
  const overall = x.view.getByRole('textbox', { name: 'Overall feedback' });
  act(() => overall.focus());
  for (const key of ['p','r','d']) fireEvent.keyDown(overall, { key });
  expect(x.model.tool).toBe('pin');
  fireEvent.keyDown(x.canvas, { key: 'd', ctrlKey: true }); expect(x.model.tool).toBe('pin');
  fireEvent.keyDown(x.canvas, { key: 'd', altKey: true }); expect(x.model.tool).toBe('pin');
  act(() => x.model.setPen(true)); expect(x.model.tool).toBe('draw'); expect(x.model.pen).toBe(true);
  act(() => x.model.setTool('region')); expect(x.model.pen).toBe(false);
  fireEvent.keyDown(x.canvas, { key: 'Enter' });
  const composer = x.view.getByRole('textbox', { name: 'Add a comment…' });
  fireEvent.keyDown(composer, { key: 'd' }); expect(x.model.tool).toBe('region');
  expect(x.view.container.querySelector('[data-part="toolGroup"]')?.getAttribute('aria-label')).toBe('Feedback tools');
  expect(x.view.container.querySelector('[data-part="tool"][title="Draw (D)"]')).toBeTruthy();
});

test('Escape cancels the gesture, then composer, then returns to pin without writing a draft', () => {
  const x = setup(); act(() => x.model.setTool('draw'));
  fireEvent.keyDown(x.canvas, { key: 'Enter' });
  change(x.view.getByRole('textbox', { name: 'Add a comment…' }), 'Pending');
  x.pointer('pointerdown', 100, 50); x.pointer('pointermove', 400, 200);
  fireEvent.keyDown(x.canvas, { key: 'Escape' }); expect(x.model.rubber).toHaveLength(0); expect(x.model.editing).not.toBeNull(); expect(x.model.tool).toBe('draw');
  x.pointer('pointerup', 400, 200); expect(x.model.state.items).toHaveLength(1);
  fireEvent.keyDown(x.canvas, { key: 'Escape' }); expect(x.model.editing).toBeNull(); expect(x.model.tool).toBe('draw');
  fireEvent.keyDown(x.canvas, { key: 'Escape' }); expect(x.model.tool).toBe('pin'); expect(x.store.get('review.feedback')).toBeUndefined();
});

for (const modifier of ['ctrlKey', 'metaKey']) test(`${modifier}+Enter submits a pending composer, including its unsaved text`, () => {
  const x = setup(); fireEvent.keyDown(x.canvas, { key: 'Enter' });
  const input = x.view.getByRole('textbox', { name: 'Add a comment…' });
  change(input, 'Make this clearer');
  fireEvent.keyDown(input, { key: 'Enter', [modifier]: true });
  expect(x.actions).toHaveLength(1); expect(x.actions[0].payload).toMatchObject({ items: [{ comment: 'Make this clearer' }] });
  expect(x.model.submitted).toBe(true);
});

test('plain Enter saves only, Shift+Enter remains multiline and empty submit is inert', () => {
  const x = setup(); fireEvent.keyDown(x.canvas, { key: 'Enter', ctrlKey: true }); expect(x.actions).toHaveLength(0);
  fireEvent.keyDown(x.canvas, { key: 'Enter' });
  const input = x.view.getByRole('textbox', { name: 'Add a comment…' });
  change(input, 'Saved'); fireEvent.keyDown(input, { key: 'Enter', shiftKey: true }); expect(x.model.editing).not.toBeNull();
  fireEvent.keyDown(input, { key: 'Enter' }); expect(x.model.editing).toBeNull(); expect(x.actions).toHaveLength(0);
  fireEvent.keyDown(x.canvas, { key: 'Enter', ctrlKey: true }); expect(x.actions).toHaveLength(1);
});

test('region tool always rubber-bands; readout is content pixels and release announces final size', async () => {
  const x = setup(); act(() => x.model.setTool('region'));
  x.pointer('pointerdown', 100, 50); x.pointer('pointermove', 420, 230); await x.flush();
  const readout = x.canvas.querySelector('[data-part="dimension"]') as HTMLElement;
  expect(readout.hidden).toBe(false); expect(readout.textContent).toBe(regionDimensions([10,10], [42,46],1000,500,x.model.scale));
  expect(readout.closest('[aria-hidden="true"]')).not.toBeNull();
  expect(x.model.state.items).toHaveLength(0);
  x.pointer('pointerup', 420, 230); expect(x.model.state.items[0]).toMatchObject({ kind: 'region', x: 10, y: 10, w: 32, h: 36 });
  expect(x.model.announcement).toContain(readout.textContent!);
  fireEvent.keyDown(x.view.getByRole('textbox', { name: 'Add a comment…' }), { key: 'Escape' });
  x.pointer('pointerdown', 300, 200); x.pointer('pointerup', 300, 200); expect(x.model.state.items[0].kind).toBe('region');
  expect(regionDimensions([10,10], [42,46],500,250,.5)).toBe('320 × 180');
});

test('pen pressure and coalesced points survive persistence and use exactly the live pixel outline', async () => {
  const x = setup(); act(() => x.model.setTool('draw'));
  x.pointer('pointerdown', 100, 50, .2, 'pen');
  const samples = [new window.PointerEvent('pointermove', { clientX: 200, clientY: 100, pressure: .5 }), new window.PointerEvent('pointermove', { clientX: 250, clientY: 125, pressure: .7 })];
  x.pointer('pointermove', 300, 150, .9, 'pen', samples); await x.flush();
  const live = x.canvas.querySelector('[data-part="strokePath"]')!.getAttribute('d'); expect(live).toStartWith('M');
  x.pointer('pointerup', 300, 150, 0, 'pen');
  expect(x.model.state.items[0].pressure).toEqual([[.2,.5,.7,.9]]);
  expect(pathStrokes(x.model.state.items[0].path!)[0]).toHaveLength(4);
  expect(x.view.container.querySelector('[data-part="canvas"] ~ [data-part="stroke"] [data-part="strokePath"]')!.getAttribute('d')).toBe(live);
  expect(x.view.container.querySelector('[data-part="canvas"] ~ [data-part="stroke"]')!.getAttribute('viewBox')).toBe('0 0 1000 500');
  fireEvent.keyDown(x.view.getByRole('textbox', { name: 'Add a comment…' }), { key: 'Enter', ctrlKey: true });
  expect((x.actions[0].payload as any).items[0].pressure).toEqual([[.2,.5,.7,.9]]);
});

test('pointer moves and hover never rerender the owning Mockup; cancel commits nothing', async () => {
  const x = setup(); act(() => x.model.setTool('draw')); x.pointer('pointerdown', 100, 50);
  const renders = x.renders;
  for (let i = 0; i < 40; i++) x.pointer('pointermove', 100 + i * 10, 100 + i);
  await x.flush(); expect(x.renders).toBe(renders); expect(x.model.state.items).toHaveLength(0);
  x.pointer('pointercancel', 500, 140); await x.flush();
  expect(x.model.state.items).toHaveLength(0); expect(x.canvas.querySelector('[data-part="strokePath"]')!.getAttribute('d')).toBe('');
  x.pointer('pointermove', 200, 100); x.pointer('pointerleave', 200, 100); await x.flush(); expect(x.renders).toBe(renders);
});

test('pixel-space outline handles aspect ratios, empty/malformed paths and mouse payload compatibility', () => {
  const path = strokeOutline([[50,50], [70,50]],1000,100);
  const coordinates = path.match(/-?\d+(?:\.\d+)?/g)!.map(Number);
  const xs = coordinates.filter((_,i)=>i%2===0), ys = coordinates.filter((_,i)=>i%2===1);
  expect(Math.min(...xs)).toBeGreaterThan(490); expect(Math.max(...xs)).toBeGreaterThan(690);
  expect(Math.max(...ys)-Math.min(...ys)).toBeLessThan(8);
  expect(strokeOutline([],1000,100)).toBe(''); expect(strokeOutline([[10,10]],0,100)).toBe(''); expect(drawingOutline('invalid',100,100)).toBe('');
  const feedback = createFeedback(); const item = feedback.addDrawing({ points: [[10,10],[20,20],[30,30]] });
  expect(item.path).toBe('M10 10L30 30'); expect(item.pressure).toBeUndefined(); expect(feedback.toPayload().items[0]).not.toHaveProperty('pressure');
  expect(drawingOutline(item.path!,1000,100)).toBe(strokeOutline([[10,10],[20,20],[30,30]],1000,100));
  expect(() => feedback.addDrawing({ points: [[0,0],[10,10]], pressure: [[.5]] })).toThrow('Drawing pressure must match its points');
  expect(() => feedback.addDrawing({ points: [] })).toThrow();
  const pen = feedback.addDrawing({ points: [[0,0],[20,20]], pressure: [[.1,.9]] }); feedback.edit(pen.id, { x: 20 });
  expect(feedback.getState().items[1].pressure).toEqual([[.1,.9]]); feedback.undo(); feedback.redo(); expect(feedback.toPayload().items[1].pressure).toEqual([[.1,.9]]);
});

test('inline render feedback preserves Escape ordering and submits a portaled composer with Cmd+Enter', () => {
  const actions: Action[] = [];
  const view = render(<Prism feedback animate={false} source={'```ui:graphic-target\n{"id":"art"}\n```'} renderers={{ 'graphic-target': () => <svg width="300" height="180"><rect width="300" height="180" /></svg> }} onAction={action => actions.push(action)} />);
  fireEvent.click(view.getByRole('button', { name: 'Give feedback' }));
  const canvas = view.getByRole('application');
  fireEvent.keyDown(canvas, { key: 'd' }); fireEvent.keyDown(canvas, { key: 'Enter' });
  fireEvent.keyDown(view.getByRole('textbox', { name: 'Add a comment…' }), { key: 'Escape' });
  expect(view.queryByRole('dialog')).toBeNull(); expect(view.getByRole('button', { name: 'Draw' }).getAttribute('aria-pressed')).toBe('true');
  fireEvent.keyDown(canvas, { key: 'Escape' }); expect(view.getByRole('button', { name: /^Pin$/ }).getAttribute('aria-pressed')).toBe('true');
  expect(view.getByRole('button', { name: 'Close feedback' }).getAttribute('aria-expanded')).toBe('true');
  fireEvent.keyDown(canvas, { key: 'Enter' }); const composer = view.getByRole('textbox', { name: 'Add a comment…' });
  change(composer, 'Fix the graphic'); fireEvent.keyDown(composer, { key: 'Enter', metaKey: true });
  expect(actions).toHaveLength(1); expect(actions[0].payload).toMatchObject({ target: { name: 'graphic-target', id: 'art' }, coordinates: 'percent', items: [{ comment: 'Fix the graphic' }] });
});

test('group keyboard submission keeps variants and the overall group comment', () => {
  const actions: Action[] = [], source = ['A','B'].map(variant => '```mockup:svg {id=design-' + variant + ' group=pair variant=' + variant + '}\n<svg viewBox="0 0 300 180"><rect width="300" height="180"/></svg>\n```').join('\n\n');
  const view = render(<Prism registry={createRegistry([mockupDefinition])} plugins={[mockupPlugin]} animate={false} source={source} onAction={action => actions.push(action)} />);
  fireEvent.keyDown(view.getByRole('application'), { key: 'Enter' });
  change(view.getByRole('textbox', { name: 'Add a comment…' }), 'Variant A note');
  fireEvent.keyDown(view.getByRole('textbox', { name: 'Add a comment…' }), { key: 'Enter', ctrlKey: true });
  expect(actions).toHaveLength(1); expect(actions[0].payload).toMatchObject({ variants: [{ variant: 'A', items: [{ comment: 'Variant A note' }] }] });
  fireEvent.click(view.getByRole('button', { name: 'Edit feedback' }));
  const overall = view.getByRole('textbox', { name: 'Overall feedback' });
  change(overall, 'Both work'); fireEvent.keyDown(overall, { key: 'Enter', metaKey: true });
  expect(actions).toHaveLength(2); expect(actions[1].payload).toMatchObject({ overall: 'Both work' });
});

test('creation-only pin motion is consumed before undo/redo, while rows and markers share active state', () => {
  const x = setup(); x.pointer('pointerdown', 200, 100); x.pointer('pointerup', 200, 100);
  expect(x.view.container.querySelector('[data-part="marker"]')?.getAttribute('data-created')).toBe('true');
  expect(x.view.container.querySelector('[data-part="ripple"]')).not.toBeNull();
  const composer = x.view.getByRole('textbox', { name: 'Add a comment…' }); change(composer, 'A useful note'); fireEvent.keyDown(composer, { key: 'Enter' });
  const row = x.view.getByRole('listitem'); fireEvent.mouseEnter(row); expect(x.view.container.querySelector('[data-part="marker"]')?.getAttribute('data-active')).toBe('true');
  fireEvent.mouseLeave(row); fireEvent.mouseEnter(x.view.getByRole('button', { name: 'Comment 1: A useful note' })); expect(row.getAttribute('data-active')).toBe('true');
  act(() => x.model.feedback.undo()); act(() => x.model.feedback.redo());
  expect(x.view.container.querySelector('[data-part="marker"]')?.hasAttribute('data-created')).toBe(false);
  expect(x.view.container.querySelector('[data-part="ripple"]')).toBeNull();
});

test('composer traps tab, exposes kind/number and platform hints, and restores marker focus', () => {
  const x = setup(); fireEvent.keyDown(x.canvas, { key: 'Enter' });
  const composer = x.view.getByRole('textbox', { name: 'Add a comment…' }); change(composer, 'Ready'); fireEvent.keyDown(composer, { key: 'Enter' });
  const marker = x.view.getByRole('button', { name: 'Comment 1: Ready' }); act(() => marker.focus()); fireEvent.click(marker);
  const input = x.view.getByRole('textbox', { name: 'Add a comment…' }); act(() => input.focus());
  const first = x.view.getByRole('button', { name: 'Close comment' }); act(() => first.focus());
  fireEvent.keyDown(first, { key: 'Tab', shiftKey: true }); expect(document.activeElement === x.view.getByRole('button', { name: /^Delete$/ })).toBe(true);
  fireEvent.keyDown(document.activeElement!, { key: 'Tab' }); expect(document.activeElement === first).toBe(true);
  expect(x.view.container.querySelector('[data-part="composerHeader"]')?.textContent).toContain('1');
  expect(x.view.container.querySelector('[data-part="keyboardHints"]')?.textContent).toContain('↵ Save');
  fireEvent.keyDown(document.activeElement!, { key: 'Escape' }); expect(document.activeElement === marker).toBe(true);
});

test('composer placement flips off edges and avoids the annotation and submit pill', () => {
  const surface = { left: 20, top: 50, width: 280, height: 600 }, viewport = { width: 330, height: 750 };
  for (const anchor of [{x:25,y:55},{x:295,y:55},{x:25,y:640},{x:295,y:640}]) {
    const result = placeComposer(surface, anchor, viewport, 200, {left:20,top:500,width:280,height:40});
    expect(result.left).toBeGreaterThanOrEqual(20); expect(result.left + result.width).toBeLessThanOrEqual(300);
    expect(result.top).toBeGreaterThanOrEqual(12); expect(result.top + 200).toBeLessThanOrEqual(738);
    expect(anchor.y < result.top || anchor.y > result.top + 200 || anchor.x < result.left || anchor.x > result.left + result.width).toBe(true);
  }
  expect(placeComposer(surface,{x:150,y:640},viewport,200).side).toBe('bottom');
});

test('canvas synchronization scrolls only a scrollable annotation list, not the page', () => {
  const x = setup(); expect(x.view.getByText(/P \/ R \/ D tools/)).not.toBeNull();
  x.pointer('pointerdown', 100, 100); x.pointer('pointerup', 100, 100); const input = x.view.getByRole('textbox', { name: 'Add a comment…' }); change(input, 'Visible note'); fireEvent.keyDown(input, { key: 'Enter' });
  const list = x.model.listRef.current!, row = x.view.getByRole('listitem'), id = x.model.state.items[0].id;
  list.getBoundingClientRect = () => new DOMRect(0,0,280,100); row.getBoundingClientRect = () => new DOMRect(0,200,280,30);
  Object.defineProperties(list, { scrollHeight: { configurable:true,value:100 }, clientHeight: { configurable:true,value:100 } });
  const scrollY = window.scrollY; act(() => x.model.highlight(id, true)); expect(list.scrollTop).toBe(0);
  Object.defineProperty(list, 'scrollHeight', { configurable:true,value:300 }); act(() => x.model.highlight(id, true)); expect(list.scrollTop).toBe(130); expect(window.scrollY).toBe(scrollY);
  act(() => x.model.highlight('missing', true)); expect(list.scrollTop).toBe(130);
});
