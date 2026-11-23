export interface FreshSegment { start: number; time: number; key: number }
export interface FreshTextState { value: string; settled: number; tail: number; segments: FreshSegment[] }

export function settleText(state: FreshTextState, value: string, now: number, lifetime: number) {
  const previous = state.value;
  if (!value.startsWith(previous)) {
    state.segments = []; state.settled = value.length;
  } else if (value.length > previous.length) {
    const suffix = value.slice(previous.length), last = state.segments.at(-1);
    const boundary = /\s$/.test(previous) || !previous ? suffix.search(/\S/) : suffix.search(/(?<=\s)\S/);
    const start = boundary < 0 ? -1 : previous.length + boundary;
    if (!last) {
      const from = /\s$/.test(previous) ? previous.length : state.tail;
      state.settled = from;
      state.segments.push({ start: from, time: now, key: from });
    } else if (start >= 0 && Math.floor(last.time / 16) !== Math.floor(now / 16) && state.segments.length < 8) {
      state.segments.push({ start, time: now, key: start });
    }
  }
  const suffix = value.slice(previous.length);
  if (!value.startsWith(previous)) {
    const tail = value.search(/\S+$/);
    state.tail = tail < 0 ? value.length : tail;
  }
  else {
    const trailing = suffix.match(/\s(\S*)$/);
    if (trailing) state.tail = value.length - trailing[1].length;
  }
  state.tail = Math.max(0, state.tail);
  state.value = value;
  while (state.segments.length && now - state.segments[0].time >= lifetime) {
    if (state.segments.length === 1 && /\S$/.test(value)) {
      state.segments[0].start = state.tail;
      state.settled = state.tail;
      break;
    }
    state.segments.shift();
    state.settled = state.segments[0]?.start ?? value.length;
  }
  return state;
}
