import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

test('production bundlers retain every directive registration module', () => {
  const root = fileURLToPath(new URL('..', import.meta.url));
  const { sideEffects } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as { sideEffects: string[] };
  const patterns = sideEffects.map(pattern => new Bun.Glob(pattern));
  const registrations = [...new Bun.Glob('src/**/*.{ts,tsx}').scanSync({ cwd: root })].filter(path => !path.includes('.test.') && readFileSync(root + '/' + path, 'utf8').includes('registerComponent('));
  expect(registrations.length).toBeGreaterThan(0);
  for (const path of registrations) expect({ path, retained: patterns.some(pattern => pattern.match(path)) }).toEqual({ path, retained: true });
});
