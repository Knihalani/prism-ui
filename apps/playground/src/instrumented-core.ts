export * from '../../../packages/core/src/index';
import { createParser as original, type ParserOptions, type Update } from '../../../packages/core/src/index';
import { measure, metrics } from './metrics';

export function createParser(options?: ParserOptions) {
  const parser = original(options);
  const update = (value: Update): Update => ({ get root() { return measure(() => value.root); } });
  const push = (chunk: string) => {
    if (chunk) { metrics.chunks++; metrics.bytes += chunk.length; }
    return update(measure(() => parser.push(chunk)));
  };
  const end = (...args: Parameters<typeof parser.end>) => update(measure(() => parser.end(...args)));
  return new Proxy(parser, {
    get(target, key, receiver) {
      if (key === 'push') return push;
      if (key === 'end') return end;
      if (key === 'root') return measure(() => target.root);
      return Reflect.get(target, key, receiver);
    },
  });
}
