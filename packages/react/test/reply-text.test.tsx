import './setup';
import { expect, spyOn, test } from 'bun:test';
import { render } from '@testing-library/react';
import { Prism } from '../src';
import { settleText, type FreshTextState } from '../src/fresh';

const empty = (): FreshTextState => ({ value: '', settled: 0, tail: 0, segments: [] });
const pieces = (state: FreshTextState) => [state.value.slice(0, state.settled), ...state.segments.map((segment, index) => state.value.slice(segment.start, state.segments[index + 1]?.start))];

test('fresh text coalesces frames, preserves words, expires settled segments and resets replacements', () => {
  const state = empty();
  settleText(state, 'hel', 0, 400);
  settleText(state, 'hello ', 8, 400);
  expect(pieces(state)).toEqual(['', 'hello ']);
  settleText(state, 'hello wor', 32, 400);
  settleText(state, 'hello world', 64, 400);
  expect(pieces(state)).toEqual(['', 'hello ', 'world']);
  settleText(state, 'hello world again', 450, 400);
  expect(pieces(state)).toEqual(['hello world ', 'again']);
  settleText(state, 'hello world again ', 900, 400);
  expect(pieces(state)).toEqual(['hello world again ']);
  settleText(state, 'replacement', 950, 400);
  expect(pieces(state)).toEqual(['replacement']);
  settleText(state, 'replacements next', 1000, 400);
  expect(pieces(state).join('')).toBe(state.value);
  expect(state.segments[0].start).toBe(0);
  settleText(state, '', 1050, 400);
  expect(pieces(state)).toEqual(['']);
});

test('fresh text never exceeds eight segments and obeys token-derived lifetime', () => {
  const state = empty();
  for (let index = 0; index < 100; index++) {
    settleText(state, state.value + 'word ', index * 17, 2000);
    expect(state.segments.length).toBeLessThanOrEqual(8);
    expect(pieces(state).join('')).toBe(state.value);
  }
  settleText(state, state.value, 4000, 2000);
  expect(state.segments).toHaveLength(0);
});

test('expired text settles up to the partial trailing word without remounting its span', () => {
  const state = empty();
  settleText(state, 'hello partial', 0, 400);
  const key = state.segments[0].key;
  settleText(state, state.value, 500, 400);
  expect(pieces(state)).toEqual(['hello ', 'partial']);
  expect(state.segments[0].key).toBe(key);
  settleText(state, 'hello partial ', 501, 400);
  expect(pieces(state)).toEqual(['hello partial ']);
  settleText(state, 'replacement ', 600, 400);
  settleText(state, 'replacement tail', 601, 400);
  settleText(state, state.value, 1100, 400);
  expect(pieces(state)).toEqual(['replacement ', 'tail']);
});

test('streaming Text preserves textContent, merges same-frame chunks and becomes plain when frozen or replaced', () => {
  let clock = 0;
  const now = spyOn(performance, 'now').mockImplementation(() => clock);
  try {
    const view = render(<Prism source="hel" done={false} />);
    view.rerender(<Prism source="hello " done={false} />);
    expect(view.container.querySelectorAll('[data-prism-fresh]')).toHaveLength(1);
    clock = 32; view.rerender(<Prism source="hello world" done={false} />);
    expect(view.container.querySelectorAll('[data-prism-fresh]')).toHaveLength(2);
    expect(view.container.textContent).toBe('hello world');
    view.rerender(<Prism source="replacement" done={false} />);
    expect(view.container.querySelector('[data-prism-fresh]')).toBeNull();
    expect(view.container.textContent).toBe('replacement');
    view.rerender(<Prism source="replacement complete" done />);
    expect(view.container.querySelector('[data-prism-fresh]')).toBeNull();
    expect(view.container.textContent).toBe('replacement complete');
  } finally { now.mockRestore(); }
});

test.each([{ animate: false }, { unstyled: true }])('disabled and unstyled text is plain: %j', props => {
  const view = render(<Prism source="hello" done={false} {...props} />);
  view.rerender(<Prism source="hello world" done={false} {...props} />);
  expect(view.container.querySelector('[data-prism-fresh]')).toBeNull();
  expect(!!view.container.querySelector('[data-prism-flow]')).toBe(!('unstyled' in props));
  expect(view.container.textContent).toBe('hello world');
});

test('reduced motion renders plain text', () => {
  const original = globalThis.matchMedia;
  globalThis.matchMedia = (() => ({ matches: true, addEventListener() {}, removeEventListener() {} })) as unknown as typeof matchMedia;
  try {
    const view = render(<Prism source="hello" done={false} />);
    expect(view.container.querySelector('[data-prism-fresh]')).toBeNull();
    expect(view.container.textContent).toBe('hello');
  } finally { globalThis.matchMedia = original; }
});

test('200KB paragraph in four-character source pushes keeps a bounded DOM', () => {
  const text = 'word '.repeat(40960), start = performance.now();
  const view = render(<Prism source="" done={false} />);
  let maximum = 0;
  for (let end = 4; end <= text.length; end += 4) {
    view.rerender(<Prism source={text.slice(0, end)} done={false} />);
    maximum = Math.max(maximum, view.container.querySelectorAll('span').length);
  }
  console.log(`reply text: ${text.length} bytes, 4-character source pushes, ${(performance.now() - start).toFixed(0)}ms, ${maximum} spans maximum`);
  expect(maximum).toBeLessThanOrEqual(10);
  expect(view.container.textContent).toBe(text);
}, 120000);
