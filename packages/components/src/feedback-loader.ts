export function createLoader<T>(load: () => Promise<T>) {
  let value: T | undefined, pending: Promise<T> | undefined;
  return {
    get value() { return value; },
    load() { return pending ??= Promise.resolve().then(load).then(result => value = result).catch(error => { pending = undefined; throw error; }); },
  };
}
