import { expect, test } from 'bun:test';
import { fixtureCompatibility, sharedPath, table, violations, type Budgets, type SizeRow } from './size';

const budgets: Budgets = { defaults: { js: 4096, css: 4096 }, entries: {} };
const row: SizeRow = { name: 'widget', kind: 'component', js: 4096, css: 4096, initial: 4096, deferred: 0, fullJs: 9000, fullCss: 9000 };
test('public view fixture aliases tree-shake from subpath runtime imports', async () => {
  const rows = await fixtureCompatibility();
  expect(rows.map(row => row.entry)).toEqual(['view/index.ts', 'index.ts']);
  const subpath = rows.find(row => row.entry === 'view/index.ts')!;
  expect(subpath.withFixtureExports).toBeGreaterThan(0);
  expect(subpath.fixtureBytes).toBe(0);
  expect(subpath.fixturePayload).toBe(false);
});
test('budgets enforce own cost, including CSS, not informational full cost', () => {
  expect(violations([row], budgets)).toEqual([]);
  expect(violations([{ ...row, js: 4097, css: 4097 }], budgets)).toEqual(['widget js: 4097 > 4096B', 'widget css: 4097 > 4096B']);
  expect(table([row], budgets)).toContain('| PASS |');
  expect(table([{ ...row, js: 4097 }], budgets)).toContain('**FAIL**');
});
test('empty measurements and invalid or unexplained budgets', () => {
  expect(violations([], budgets)).toEqual([]);
  expect(() => violations([{ ...row, kind: 'runtime' }], budgets)).toThrow('Missing budget');
  expect(() => violations([row], { ...budgets, entries: { widget: { js: -1, css: 0 } } })).toThrow('Invalid budget');
  expect(() => violations([row], { ...budgets, entries: { widget: { js: 5000, css: 4096 } } })).toThrow('Missing budget reason');
  expect(violations([row], { ...budgets, entries: { widget: { js: 5000, css: 4096, reason: 'A genuinely heavy widget.' } } })).toEqual([]);
});
test('shared cost boundary excludes component implementations', () => {
  for (const path of ['frame/index.ts', 'shared/controls.tsx', 'lib/chart/path.ts', 'strings.ts', 'interpolate.ts', 'styles/base.css']) expect(sharedPath(path)).toBe(true);
  for (const path of ['chart/index.tsx', 'datatable/use-datatable.ts', 'artifact/runtime.ts', '../react/src/strings.ts']) expect(sharedPath(path)).toBe(false);
});
