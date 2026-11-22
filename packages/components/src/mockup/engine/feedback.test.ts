import { describe, expect, test } from 'bun:test';
import { createFeedback, previousAsResolved, toMessage } from './feedback';
import type { FeedbackPoint } from './feedback';

function fixture() {
  let time = 1000, id = 0;
  const model = createFeedback({ now: () => time, id: () => `f${++id}` });
  return { model, tick: (ms: number) => { time += ms; } };
}

describe('feedback state and history', () => {
  test('loading a saved snapshot replaces its projection without replaying local history', () => {
    const { model } = fixture();
    model.addPin({ x: 20, y: 30, comment: 'Local' });
    model.undo();
    expect(model.canRedo).toBe(true);
    const saved = createFeedback({ overall: 'Restored' }); saved.addPin({ x: 70, y: 80, comment: 'Saved' });
    model.load(saved.toJSON());
    expect(model.toJSON()).toEqual(saved.toJSON());
    expect(model.canRedo).toBe(false);
    expect(model.canUndo).toBe(false);
    model.load(createFeedback().toJSON());
    expect(model.getState()).toMatchObject({ items: [], overall: '' });
  });
  test('streamed context does not enter or rewind through reviewer undo and redo history', () => {
    const { model } = fixture();
    model.setContext({ mockup: 'Part' });
    expect(model.canUndo).toBe(false);
    model.setOverall('Reviewer edit');
    model.setContext({ mockup: 'Complete title', variant: 'B', device: 'mobile' });
    model.undo();
    expect(model.getState()).toMatchObject({ mockup: 'Complete title', variant: 'B', device: 'mobile', overall: '' });
    model.setContext({ mockup: 'New title', variant: undefined });
    expect(model.canRedo).toBe(true);
    model.redo();
    expect(model.getState().mockup).toBe('New title');
    expect(model.getState().variant).toBeUndefined();
    expect(model.getState().overall).toBe('Reviewer edit');
    const cancel = model.checkpoint();
    model.addPin({ x: 5, y: 5 });
    model.setContext({ mockup: 'Latest title' });
    cancel();
    expect(model.getState().mockup).toBe('Latest title');
    expect(model.getState().items).toEqual([]);
  });
  test('rolling back creation and async target metadata restores an empty undo/redo history', () => {
    for (const kind of ['pin', 'region'] as const) {
      const { model } = fixture(), initial = model.toJSON(), rollback = model.checkpoint();
      const item = kind === 'pin' ? model.addPin({ x: 10, y: 20 }) : model.addRegion({ x: 10, y: 20, w: 30, h: 40 });
      model.edit(item.id, { target: { selector: '#cta' }, targetBox: { x: 0, y: 0, w: 50, h: 50 } });
      rollback(); expect(model.toJSON()).toEqual(initial); expect(model.canUndo).toBe(false); expect(model.canRedo).toBe(false);
      model.undo(); model.redo(); expect(model.toJSON()).toEqual(initial);
      model.setOverall('Later'); rollback(); expect(model.getState().overall).toBe('Later');
    }
  });
  test('rollback preserves the entire preexisting undo/redo chain and typing coalescing', () => {
    const { model, tick } = fixture(); model.setOverall('Kept'); tick(1000); model.setOverall('Redo me'); model.undo();
    const rollback = model.checkpoint(), initial = model.toJSON();
    const item = model.addPin({ x: 5, y: 5 }); model.edit(item.id, { target: { selector: 'button' } }); rollback();
    expect(model.toJSON()).toEqual(initial); expect(model.canUndo).toBe(true); expect(model.canRedo).toBe(true);
    model.undo(); expect(model.getState().overall).toBe(''); model.redo(); expect(model.getState().overall).toBe('Kept'); model.redo(); expect(model.getState().overall).toBe('Redo me'); expect(model.getState().items).toEqual([]);
    const next = fixture(); next.model.setOverall('a'); const cancel = next.model.checkpoint(); next.model.addRegion({ x: 1, y: 1, w: 1, h: 1 }); cancel(); next.tick(200); next.model.setOverall('ab'); next.model.undo(); expect(next.model.getState().overall).toBe('');
  });
  test('empty state, immutable snapshots, subscriptions and no-op identity', () => {
    const { model } = fixture();
    const initial = model.getState();
    expect(initial).toEqual({ overall: '', items: [] });
    expect(model.canSubmit).toBe(false);
    expect(model.canUndo).toBe(false);
    expect(model.canRedo).toBe(false);
    expect(model.toPayload()).toEqual({ overall: '', items: [] });
    let emits = 0;
    const unsub = model.subscribe(() => emits++);
    model.setOverall(''); model.remove('missing'); model.edit('missing', { comment: 'x' });
    model.clear(); model.undo(); model.redo(); model.markResolved('all'); model.reanchor({});
    expect(model.getState()).toBe(initial);
    expect(emits).toBe(0);
    const target = { selector: '#cta', text: 'Sign up' };
    const pin = model.addPin({ x: 42, y: 18, target });
    target.text = 'changed outside';
    expect(pin).toMatchObject({ id: 'f1', n: 1, kind: 'pin', x: 42, y: 18, comment: '', createdAt: 1000 });
    expect(pin.target!.text).toBe('Sign up');
    expect(Object.isFrozen(pin.target)).toBe(true);
    expect(Reflect.set(pin, 'x', 99)).toBe(false);
    expect(initial.items).toEqual([]);
    expect(emits).toBe(1);
    const current = model.getState();
    model.edit(pin.id, { target: { text: 'Sign up', selector: '#cta' }, comment: undefined });
    expect(model.getState()).toBe(current);
    unsub(); model.setOverall('Hi');
    expect(emits).toBe(1);
  });

  test('add/edit/remove/overall undo and redo; rapid typing coalesces and pauses split history', () => {
    const { model, tick } = fixture();
    const pin = model.addPin({ x: 1, y: 2 });
    model.edit(pin.id, { comment: 'Bigger' });
    model.setOverall('a'); tick(200); model.setOverall('ab'); tick(200); model.setOverall('abc');
    model.undo(); expect(model.getState().overall).toBe('');
    model.undo(); expect(model.getState().items[0].comment).toBe('');
    model.undo(); expect(model.getState().items).toHaveLength(0);
    model.redo(); model.redo(); model.redo();
    expect(model.getState().overall).toBe('abc');
    tick(1000); model.setOverall('abcd');
    model.undo(); expect(model.getState().overall).toBe('abc');
    model.remove(pin.id); expect(model.canRedo).toBe(false);
    model.undo(); expect(model.getState().items[0].comment).toBe('Bigger');
    model.clear(); expect(model.canSubmit).toBe(false);
    model.undo(); expect(model.canSubmit).toBe(true);
    model.setContext({ mockup: 'Pricing', device: 'mobile' });
    model.undo(); expect(model.getState().mockup).toBe('Pricing'); expect(model.getState().device).toBe('mobile');
    model.redo(); expect(model.getState().device).toBe('mobile');
    model.setContext({ device: undefined }); expect(model.getState().device).toBeUndefined();
  });

  test('clamps points, normalizes negative and off-page drags, renumbers deletions', () => {
    const { model } = fixture();
    const a = model.addPin({ x: -8, y: 105 });
    const b = model.addRegion({ x: 80, y: 60, w: -50, h: -20, comment: 'cramped' });
    const c = model.addRegion({ x: -10, y: 90, w: 30, h: 40 });
    expect(a).toMatchObject({ x: 0, y: 100 });
    expect(b).toMatchObject({ x: 30, y: 40, w: 50, h: 20 });
    expect(c).toMatchObject({ x: 0, y: 90, w: 20, h: 10 });
    model.edit(b.id, { x: 120, w: -40, y: -5, h: 30 });
    expect(model.getState().items[1]).toMatchObject({ x: 80, y: 0, w: 20, h: 25 });
    model.remove(a.id);
    expect(model.getState().items.map(i => i.n)).toEqual([1, 2]);
    expect(model.toPayload().items[0].n).toBe(model.getState().items[0].n);
    model.undo(); expect(model.getState().items.map(i => i.n)).toEqual([1, 2, 3]);
    model.addPin({ x: NaN, y: Infinity });
    expect(model.getState().items[3]).toMatchObject({ x: 0, y: 0 });
  });
});

describe('feedback anchors', () => {
  test('drawing paths translate and scale with targets across layouts, history and missing targets', () => {
    const model = createFeedback(), item = model.addDrawing({ path: 'M12 22L18 28M14 24L16 26' });
    model.edit(item.id, { target: { selector: '#cta' }, targetBox: { x: 10, y: 20, w: 10, h: 10 } });
    const original = model.getState().items[0].path;
    model.edit(item.id, { comment: 'Stroke' });
    model.reanchor({ [item.id]: { x: 30, y: 40, w: 20, h: 5 } });
    expect(model.getState().items[0]).toMatchObject({ x: 34, y: 41, w: 12, h: 3, path: 'M34 41L46 44M38 42L42 43' });
    model.undo(); expect(model.getState().items[0].path).toBe('M34 41L46 44M38 42L42 43');
    model.redo(); expect(model.toPayload().items[0].path).toBe('M34 41L46 44M38 42L42 43');
    model.reanchor({ [item.id]: null }); expect(model.getState().items[0].path).toBe('M34 41L46 44M38 42L42 43');
    model.reanchor({ [item.id]: { x: 10, y: 20, w: 10, h: 10 } }); expect(model.getState().items[0].path).toBe(original);
    const point = model.addDrawing({ points: [[10, 20]] });
    model.edit(point.id, { target: { selector: '#cta' }, targetBox: { x: 10, y: 20, w: 10, h: 10 } });
    model.reanchor({ [point.id]: { x: 30, y: 40, w: 20, h: 5 } }); expect(model.getState().items[1].path).toBe('M30 40');
  });
  test('editing a comment with an unchanged target preserves its anchor and follows later layouts', () => {
    for (const target of [{ selector: '#cta', text: 'Sign up' }, { selector: '#cta' }]) {
      const { model } = fixture();
      const pin = model.addPin({ x: 25, y: 30, target, targetBox: { x: 20, y: 20, w: 20, h: 20 } });
      model.edit(pin.id, { comment: 'Make this bigger', target: { ...target, html: '<button class="new">Sign up</button>' } });
      expect(model.getState().items[0].anchor).toEqual(pin.anchor);
      expect(model.anchorRequests()).toEqual([{ key: pin.id, ...target }]);
      model.reanchor({ [pin.id]: { x: 40, y: 40, w: 40, h: 40 } });
      expect(model.getState().items[0]).toMatchObject({ x: 50, y: 60, comment: 'Make this bigger' });
      model.undo();
      expect(model.getState().items[0]).toMatchObject({ x: 50, y: 60, comment: '' });
      expect(model.getState().items[0].anchor).toEqual(pin.anchor);
    }
  });

  test('changing target selector or text, or removing the target, still clears its anchor', () => {
    for (const target of [{ selector: '#other', text: 'Sign up' }, { selector: '#cta', text: 'Changed' }, { selector: '#cta' }, undefined]) {
      const { model } = fixture();
      const pin = model.addPin({ x: 25, y: 30, target: { selector: '#cta', text: 'Sign up' }, targetBox: { x: 20, y: 20, w: 20, h: 20 } });
      model.edit(pin.id, { target });
      expect(model.getState().items[0].anchor).toBeUndefined();
      expect(model.anchorRequests()).toEqual([]);
    }
  });

  test('registers anchors and moves pins and regions without creating history or emitting unchanged layouts', () => {
    const { model } = fixture();
    const target = { selector: '#cta', text: 'Sign up', html: '<button>Sign up</button>' };
    const pin = model.addPin({ x: 25, y: 30, comment: 'Bigger', target, targetBox: { x: 20, y: 20, w: 20, h: 20 } });
    const region = model.addRegion({ x: 15, y: 15, w: 40, h: 30, target, targetBox: { x: 20, y: 20, w: 20, h: 20 } });
    expect(model.anchorRequests()).toEqual([
      { key: pin.id, selector: '#cta', text: 'Sign up' }, { key: region.id, selector: '#cta', text: 'Sign up' }
    ]);
    expect(pin.anchor).toMatchObject({ fx: .25, fy: .5 });
    let emits = 0; model.subscribe(() => emits++);
    const newBox = { x: 40, y: 30, w: 40, h: 40 };
    model.reanchor({ [pin.id]: newBox, [region.id]: newBox });
    expect(model.getState().items[0]).toMatchObject({ x: 50, y: 50 });
    expect(model.getState().items[1]).toMatchObject({ x: 30, y: 20, w: 70, h: 60 });
    expect(emits).toBe(1);
    const snapshot = model.getState();
    model.reanchor({ [pin.id]: newBox, [region.id]: newBox });
    expect(model.getState()).toBe(snapshot);
    model.reanchor({ [pin.id]: null, [region.id]: { x: 0, y: 0, w: 0, h: 0 } });
    expect(emits).toBe(1);
    model.undo(); expect(model.getState().items).toHaveLength(1);
    expect(model.getState().items[0].x).toBe(50);
    model.redo(); expect(model.getState().items).toHaveLength(2);
    model.edit(pin.id, { x: 60, targetBox: newBox });
    model.reanchor({ [pin.id]: { ...newBox, x: 30 } });
    expect(model.getState().items[0].x).toBe(50);
    model.edit(pin.id, { target: undefined });
    expect(model.anchorRequests()).toHaveLength(1);
  });

  test('zero-size targets are not anchored, selectors and text are optional request metadata', () => {
    const { model } = fixture();
    model.addPin({ x: 5, y: 5, target: { selector: 'svg' }, targetBox: { x: 0, y: 0, w: 0, h: 10 } });
    expect(model.anchorRequests()).toEqual([]);
    const region = model.addRegion({ x: 0, y: 0, w: 20, h: 20, target: { selector: 'svg' }, targetBox: { x: 0, y: 0, w: 20, h: 20 } });
    expect(model.anchorRequests()).toEqual([{ key: region.id, selector: 'svg' }]);
  });
});

describe('drawings', () => {
  test('RDP compacts points, rounds to two decimals, clamps bounds and keeps multiple strokes together', () => {
    const { model } = fixture();
    const points: FeedbackPoint[] = Array.from({ length: 1000 }, (_, i) => [i / 10, i / 10]);
    const line = model.addDrawing({ points, color: '#f00' });
    expect(line.path).toBe('M0 0L99.9 99.9');
    expect(line).toMatchObject({ x: 0, y: 0, w: 99.9, h: 99.9, color: '#f00' });
    const drawing = model.addDrawing({ strokes: [[[10.123456, 20.98765], [30, 40]], [[-1, 150], [55.55555, 66.66666]]] });
    expect(drawing.path).toBe('M10.12 20.99L30 40M0 100L55.56 66.67');
    expect(drawing).toMatchObject({ x: 0, y: 20.99, w: 55.56, h: 79.01 });
    expect(model.getState().items).toHaveLength(2);
    expect(model.canSubmit).toBe(true);
    expect(model.toPayload().items).toHaveLength(2);
    const corner = model.addDrawing({ points: [[0, 0], [20, 40], [40, 0]] });
    expect(corner.path).toBe('M0 0L20 40L40 0');
    const dot = model.addDrawing({ points: [[50, 50]] });
    expect(dot).toMatchObject({ path: 'M50 50', w: 0, h: 0 });
  });

  test('accepts SVG paths, relative commands, curves, arcs and edits while keeping path and bbox consistent', () => {
    const { model } = fixture();
    const item = model.addDrawing({ path: 'M10,20 h20 v20 l-20 0 z M60 60L70 70', comment: 'Remove' });
    expect(item.path).toBe('M10 20L30 20L30 40L10 40L10 20M60 60L70 70');
    expect(item).toMatchObject({ x: 10, y: 20, w: 60, h: 50 });
    const curve = model.addDrawing({ path: 'M0 0 Q50 100 100 0' });
    expect(curve.h).toBe(50);
    const cubic = model.addDrawing({ path: 'M0 0C0 100 100 100 100 0' });
    expect(cubic.h).toBe(75);
    const arc = model.addDrawing({ path: 'M10 50A40 40 0 0 1 90 50' });
    expect(arc).toMatchObject({ x: 10, y: 10, w: 80, h: 40 });
    model.edit(item.id, { path: 'M10 10L20 20' });
    model.edit(item.id, { x: 20, y: 30, w: 20, h: 10 });
    expect(model.getState().items[0]).toMatchObject({ path: 'M20 30L40 40', x: 20, y: 30, w: 20, h: 10 });
  });

  test('invalid and empty drawings throw without changing state or history', () => {
    const { model } = fixture();
    const initial = model.getState();
    for (const input of [{}, { points: [] }, { strokes: [[], []] }, { path: '' }, { path: '<script>' }, { path: 'M2' }, { path: 'L1 2' }, { path: 'M0 0L1e999 2' }]) {
      expect(() => model.addDrawing(input)).toThrow();
      expect(model.getState()).toBe(initial);
    }
    expect(model.canUndo).toBe(false);
  });

  test('duplicate supplied ids are rejected atomically', () => {
    const model = createFeedback({ id: () => 'same' });
    model.addPin({ x: 1, y: 2 });
    const state = model.getState();
    expect(() => model.addPin({ x: 3, y: 4 })).toThrow('unique');
    expect(model.getState()).toBe(state);
    model.undo(); expect(model.getState().items).toEqual([]);
  });
});

describe('submission and drafts', () => {
  test('payload has exactly spec fields, omits undefined and blank comments, rounds geometry and preserves display numbers', () => {
    const { model } = fixture();
    model.setContext({ mockup: 'Pricing page', variant: 'B', device: 'mobile' });
    model.addPin({ x: 1, y: 2, comment: '  ' });
    model.addRegion({ x: 10, y: 20, w: 30, h: 40 });
    expect(model.canSubmit).toBe(false);
    const pin = model.addPin({ x: 42.123, y: 18.678, comment: 'Bigger', target: { selector: '#cta', text: 'Sign up', html: '<button>Sign up</button>' } });
    model.markResolved([pin.id]);
    model.setOverall('Reduce clutter');
    expect(model.toPayload()).toEqual({ mockup: 'Pricing page', variant: 'B', device: 'mobile', overall: 'Reduce clutter', items: [
      { n: 3, kind: 'pin', x: 42.1, y: 18.7, comment: 'Bigger', target: { selector: '#cta', text: 'Sign up', html: '<button>Sign up</button>' } }
    ] });
    const drawing = model.addDrawing({ points: [[10.123, 30.987], [20, 40]], color: 'red' });
    const payload = model.toPayload();
    expect(payload.items[1]).toEqual({ n: drawing.n, kind: 'drawing', x: 10.1, y: 31, w: 9.9, h: 9, path: 'M10.12 30.99L20 40', comment: '' });
    expect(JSON.stringify(payload)).not.toContain('undefined');
    model.edit(pin.id, { target: { selector: 'button', html: 'x'.repeat(500) } });
    expect(model.toPayload().items[0].target!.html!.length).toBe(300);
    model.clear(); model.setOverall('  '); expect(model.canSubmit).toBe(false);
    model.setOverall('Only overall'); expect(model.canSubmit).toBe(true);
  });

  test('draft JSON round-trip preserves anchors, metadata and resolved state; payload can seed resolved revisions', () => {
    const { model } = fixture();
    model.setContext({ mockup: 'Graphic', variant: 'A', device: 'desktop' });
    model.setOverall('Less clutter');
    model.addPin({ x: 10, y: 20, comment: 'Move', target: { selector: 'svg' }, targetBox: { x: 0, y: 0, w: 50, h: 50 } });
    model.addDrawing({ points: [[1, 2], [3, 4]], color: 'blue' });
    model.markResolved('all');
    const restored = createFeedback({ ...JSON.parse(JSON.stringify(model)) });
    expect(restored.getState()).toEqual(model.getState());
    expect(restored.toPayload()).toEqual(model.toPayload());
    expect(restored.canUndo).toBe(false);
    const draft = restored.toJSON(); draft.items[0].comment = 'external';
    expect(restored.getState().items[0].comment).toBe('Move');
    const requests = restored.anchorRequests();
    restored.reanchor({ [requests[0].key]: { x: 10, y: 10, w: 50, h: 50 } });
    expect(restored.getState().items[0]).toMatchObject({ x: 20, y: 30 });
    const previous = previousAsResolved(model.toPayload());
    expect(previous.every(item => item.resolved)).toBe(true);
    expect(previous[0]).toMatchObject({ id: 'previous-1', n: 1, createdAt: 0, comment: 'Move' });
    expect(createFeedback({ items: previous }).getState().items).toEqual(previous);
    expect(previousAsResolved({ overall: '', items: [] })).toEqual([]);
  });

  test('concise HTML and image summaries omit HTML, include geometry and coarse locations, and cap items', () => {
    const { model } = fixture();
    model.setContext({ mockup: 'Pricing page', variant: 'B', device: 'mobile' });
    model.setOverall('  Less\n clutter  ');
    model.addPin({ x: 42, y: 18, comment: 'make this bigger', target: { selector: '#cta', text: 'Sign up', html: '<button>SECRET HTML</button>' } });
    model.addRegion({ x: 10, y: 30, w: 50, h: 15, comment: 'too cramped', target: { selector: '#plans' } });
    model.addDrawing({ points: [[20, 50], [35, 62]], comment: 'remove this' });
    const message = toMessage(model.toPayload());
    expect(message).toContain('Feedback on mockup "Pricing page" (variant B, mobile):\nOverall: Less clutter');
    expect(message).toContain('1. Pin at 42%,18% on "Sign up" (#cta): make this bigger');
    expect(message).toContain('2. Region 10–60% x, 30–45% y on #plans: too cramped');
    expect(message).toContain('3. Drawing (area 20–35% x, 50–62% y) (left): remove this');
    expect(message).not.toContain('SECRET HTML');
    const capped = toMessage(model.toPayload(), { maxItems: 1 });
    expect(capped).toContain('… 2 more item(s)'); expect(capped).not.toContain('2. Region');
    model.clear(); model.addPin({ x: 5, y: 5, comment: 'Crop' });
    model.addPin({ x: 50, y: 50, comment: 'Align' });
    model.addPin({ x: 90, y: 90, comment: 'Remove' });
    expect(toMessage(model.toPayload())).toContain('Pin at 5%,5% (top-left): Crop');
    expect(toMessage(model.toPayload())).toContain('Pin at 50%,50% (centre): Align');
    expect(toMessage(model.toPayload())).toContain('Pin at 90%,90% (bottom-right): Remove');
    expect(toMessage({ overall: '', items: [] })).toBe('Feedback on mockup:');
  });
});
