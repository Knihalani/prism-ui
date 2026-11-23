export function createReplay(text: string, delay = 4) {
  let stopped = false, timer: ReturnType<typeof setTimeout> | undefined, release: (() => void) | undefined;
  return {
    stop() { stopped = true; clearTimeout(timer); release?.(); },
    stream: {
      async *[Symbol.asyncIterator]() {
        let result = '';
        try {
          for (const char of text) {
            if (stopped) return;
            await new Promise<void>(resolve => { release = resolve; timer = setTimeout(resolve, delay); });
            if (stopped) return;
            result += char;
            yield result;
          }
        } finally { clearTimeout(timer); release = undefined; }
      },
    },
  };
}
