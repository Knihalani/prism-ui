export interface ReplayOptions { chars: number; delay: number }
export function createReplay(text: string, options: () => ReplayOptions, finish: () => void) {
  let paused = false, stopped = false;
  let wake: (() => void) | undefined;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const release = () => { clearTimeout(timer); wake?.(); wake = undefined; };
  const wait = (ms?: number) => new Promise<void>(resolve => { wake = resolve; if (ms !== undefined) timer = setTimeout(() => { wake = undefined; resolve(); }, ms); });
  const stream: AsyncIterable<string> = {
    async *[Symbol.asyncIterator]() {
      try {
        let cursor = 0;
        while (cursor < text.length && !stopped) {
          while (paused && !stopped) await wait();
          if (stopped) break;
          const { chars, delay } = options();
          await wait(Math.max(0, delay));
          if (stopped) break;
          if (paused) continue;
          let end = Math.min(text.length, cursor + Math.max(1, Math.floor(chars)));
          if (end < text.length && /[\uD800-\uDBFF]/.test(text[end - 1])) end++;
          yield text.slice(cursor, end); cursor = end;
        }
      } finally { release(); finish(); }
    },
  };
  return { stream, pause(value: boolean) { paused = value; release(); }, stop() { stopped = true; release(); } };
}
