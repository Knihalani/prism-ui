import { useEffect, useState } from 'react';
import { createParser, type Plugin, type Root } from '@prism-ui/core';

export type PrismStream = AsyncIterable<string | Uint8Array> | ReadableStream<string | Uint8Array>;
export interface StreamOptions { plugins?: Plugin[]; throttle?: 'raf' | number }
export const emptyRoot: Root = { type: 'root', key: '', children: [] };
export function usePrismStream(stream?: PrismStream, { plugins, throttle = 'raf' }: StreamOptions = {}) {
  const [result, setResult] = useState<{ root: Root; done: boolean; error: unknown }>({ root: emptyRoot, done: !stream, error: null });
  useEffect(() => {
    let cancelled = false, scheduled = false, frame = false, handle: ReturnType<typeof setTimeout> | number;
    let reader: ReadableStreamDefaultReader<string | Uint8Array> | undefined;
    let iterator: AsyncIterator<string | Uint8Array> | undefined;
    const parser = createParser({ plugins }), decoder = new TextDecoder();
    setResult({ root: emptyRoot, done: !stream, error: null });
    const clear = () => { if (scheduled) { if (frame) cancelAnimationFrame(handle as number); else clearTimeout(handle); scheduled = false; } };
    const publish = () => { scheduled = false; if (!cancelled) setResult({ root: parser.root, done: false, error: null }); };
    const schedule = () => {
      if (scheduled || cancelled) return; scheduled = true;
      frame = throttle === 'raf' && typeof requestAnimationFrame === 'function';
      handle = frame ? requestAnimationFrame(publish) : setTimeout(publish, typeof throttle === 'number' ? throttle : 16);
    };
    if (stream) void (async () => {
      try {
        if ('getReader' in stream) reader = stream.getReader(); else iterator = stream[Symbol.asyncIterator]();
        while (!cancelled) {
          const next = await (reader ? reader.read() : iterator!.next());
          if (cancelled || next.done) break;
          const text = typeof next.value === 'string' ? decoder.decode() + next.value : decoder.decode(next.value, { stream: true });
          parser.push(text); schedule();
        }
        if (!cancelled) { clear(); parser.push(decoder.decode()); setResult({ root: parser.end().root, done: true, error: null }); }
      } catch (error) { if (!cancelled) { clear(); setResult({ root: parser.root, done: true, error }); } }
      finally { reader?.releaseLock(); }
    })();
    return () => {
      cancelled = true; clear();
      if (reader) void reader.cancel().catch(() => {});
      else if (iterator?.return) void Promise.resolve(iterator.return()).catch(() => {});
    };
  }, [stream, plugins, throttle]);
  return result;
}
