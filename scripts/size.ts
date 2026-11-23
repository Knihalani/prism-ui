import { gzipSync } from 'node:zlib';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import type { BunPlugin } from 'bun';

const root = resolve(import.meta.dir, '..');
const components = resolve(root, 'packages/components/src');
const external = ['react', 'react/*', 'react-dom', 'react-dom/*', '@prism-ui/*'];
export interface SizeRow { name: string; kind: 'component' | 'shared' | 'runtime'; js: number; css: number; initial: number; deferred: number; fullJs: number; fullCss: number }
export interface Limits { js: number; css: number; reason?: string }
export interface Budgets { defaults: Limits; entries: Record<string, Limits> }

export function sharedPath(path: string) {
  return /^(?:frame|shared|lib|icons|styles)(?:\/|$)/.test(path) || /^(?:strings|interpolate)(?:\.|$)/.test(path);
}
export function violations(rows: SizeRow[], budgets: Budgets) {
  return rows.flatMap(row => {
    const limits = budgets.entries[row.name] ?? (row.kind === 'component' ? budgets.defaults : undefined);
    if (!limits) throw new Error(`Missing budget for ${row.name}`);
    if (![limits.js, limits.css].every(n => Number.isInteger(n) && n >= 0)) throw new Error(`Invalid budget for ${row.name}`);
    if ((limits.js > budgets.defaults.js || limits.css > budgets.defaults.css) && !limits.reason?.trim()) throw new Error(`Missing budget reason for ${row.name}`);
    return (['js', 'css'] as const).flatMap(type => row[type] > limits[type] ? [`${row.name} ${type}: ${row[type]} > ${limits[type]}B`] : []);
  });
}
export function table(rows: SizeRow[], budgets: Budgets) {
  return ['| Entry | Own JS gzip | Own CSS gzip | Full JS¹ | Full CSS¹ | JS / CSS budget | Status |', '|---|---:|---:|---:|---:|---:|---|', ...rows.map(row => {
    const limits = budgets.entries[row.name] ?? budgets.defaults;
    const pass = row.js <= limits.js && row.css <= limits.css;
    return `| ${row.name} | ${row.js} | ${row.css} | ${row.fullJs} | ${row.fullCss} | ${limits.js} / ${limits.css} | ${pass ? 'PASS' : '**FAIL**'} |`;
  }), '', '¹ Component full = own + the entire shared entry (arithmetic sum, not a standalone recompressed bundle). JS includes all deferred chunks; React/react-dom and Prism runtime packages are external.'].join('\n');
}
function internals(): BunPlugin {
  return { name: 'shared-cost-boundary', setup(build) {
    build.onResolve({ filter: /.*/ }, args => {
      if (!args.importer || (!args.path.startsWith('.') && !isAbsolute(args.path))) return;
      const absolute = resolve(dirname(args.importer), args.path), path = relative(components, absolute).replaceAll('\\', '/');
      if (!sharedPath(path)) return;
      if (path.endsWith('.css')) return { path: absolute, namespace: 'common-css' };
      return { path: '@prism-ui/components/internal/' + path.replace(/\.(tsx?|jsx?)$/, ''), external: true };
    });
    build.onLoad({ filter: /.*/, namespace: 'common-css' }, () => ({ contents: '', loader: 'css' }));
  } };
}
async function bundle(entry: string, own = false, contents?: string) {
  const virtual: BunPlugin[] = contents === undefined ? [] : [{ name: 'shared-entry', setup(build) {
    build.onResolve({ filter: /__size_shared__\.ts$/ }, () => ({ path: '__size_shared__.ts', namespace: 'size-entry' }));
    build.onLoad({ filter: /.*/, namespace: 'size-entry' }, () => ({ contents, loader: 'ts', resolveDir: root }));
  } }];
  const result = await Bun.build({ entrypoints: [entry], target: 'browser', format: 'esm', minify: true, splitting: true, external, plugins: [...virtual, ...(own ? [internals()] : [])] });
  if (!result.success) throw new AggregateError(result.logs, `Could not bundle ${entry}`);
  return result.outputs;
}
const gzip = (value: string | ArrayBuffer) => gzipSync(typeof value === 'string' ? value : new Uint8Array(value), { level: 9 }).length;
async function measured(name: string, entry: string, kind: SizeRow['kind'], cssEntries: string[] = [], contents?: string): Promise<SizeRow> {
  const outputs = await bundle(entry, kind === 'component', contents);
  const js = outputs.filter(output => output.path.endsWith('.js'));
  const sizes = await Promise.all(js.map(async output => ({ entry: output.kind === 'entry-point', bytes: gzip(await output.arrayBuffer()) })));
  const initial = sizes.filter(x => x.entry).reduce((sum, x) => sum + x.bytes, 0), deferred = sizes.filter(x => !x.entry).reduce((sum, x) => sum + x.bytes, 0);
  const css = await Promise.all(outputs.filter(output => output.path.endsWith('.css')).map(output => output.text()));
  for (const entry of cssEntries) css.push(...await Promise.all((await bundle(entry, kind === 'component')).filter(output => output.path.endsWith('.css')).map(output => output.text())));
  const cssBytes = css.length ? gzip([...new Set(css)].join('\n')) : 0;
  return { name, kind, js: initial + deferred, css: cssBytes, initial, deferred, fullJs: initial + deferred, fullCss: cssBytes };
}
export async function measure() {
  const pkg = await Bun.file(resolve(root, 'packages/components/package.json')).json();
  const entries = Object.entries(pkg.exports as Record<string, string>).filter(([name, path]) => !['.', './shared', './frame'].includes(name) && /^\.\/src\/[^/]+\/index\.tsx?$/.test(path));
  const common = [...new Bun.Glob('**/*.{ts,tsx}').scanSync({ cwd: components, absolute: false })].filter(path => sharedPath(path) && !/(?:^|\/)(?:.*\.)?(?:test|bench)\.tsx?$/.test(path)).sort();
  const source = common.map((path, index) => `export * as m${index} from ${JSON.stringify(resolve(components, path))};`).join('\n') + `\nimport ${JSON.stringify(resolve(components, 'styles/styles.css'))};`;
  const shared = await measured('shared', resolve(root, '__size_shared__.ts'), 'shared', [], source);
  const rows: SizeRow[] = [];
  for (const [name, path] of entries) {
    const css = pkg.exports[name + '.css'];
    const row = await measured(name.slice(2), resolve(root, 'packages/components', path), 'component', css ? [resolve(root, 'packages/components', css)] : []);
    rows.push({ ...row, fullJs: row.js + shared.js, fullCss: row.css + shared.css });
  }
  rows.push(shared);
  for (const name of ['react', 'core', 'state', 'schema']) rows.push(await measured(name, resolve(root, `packages/${name}/src/index.ts`), 'runtime', name === 'react' ? [resolve(root, 'packages/react/src/theme.css')] : []));
  return rows;
}
export async function grammars() {
  const paths = [...new Bun.Glob('languages/*.ts').scanSync({ cwd: resolve(components, 'lib/highlight') })].sort();
  return Promise.all(paths.map(async path => ({ name: path, gzip: (await measured(path, resolve(components, 'lib/highlight', path), 'runtime')).js })));
}
if (import.meta.main) {
  const budgets: Budgets = await Bun.file(resolve(root, 'size-budgets.json')).json();
  const rows = await measure(), failed = violations(rows, budgets);
  if (Bun.argv.includes('--json')) console.log(JSON.stringify({ rows, violations: failed }, null, 2));
  else {
    console.log(table(rows, budgets));
    const lazy = rows.filter(row => row.deferred);
    if (lazy.length) console.log('\nInitial / deferred JS gzip:\n' + lazy.map(row => `${row.name}: ${row.initial} / ${row.deferred}B`).join('\n'));
    if (Bun.argv.includes('--grammars')) console.log('\nGrammar gzip (eager, independent bundles):\n' + (await grammars()).map(row => `${row.name}: ${row.gzip}B`).join('\n'));
    if (failed.length) console.error('\nSize budgets exceeded:\n' + failed.join('\n'));
    else console.log('\nAll size budgets passed.');
  }
  if (failed.length) process.exitCode = 1;
}
