import { expect, test } from 'bun:test';
import * as engine from './index';
import type { Box, FeedbackItem, FrameController, MorphOptions, WireNode } from './index';

test('barrel exposes public APIs without requiring a browser', () => {
  const types: [Box?, FeedbackItem?, FrameController?, MorphOptions?, WireNode?] = [];
  expect(types).toEqual([]);
  for (const name of ['morph', 'trimPartialTag', 'morphDocument', 'syncHeadStyles', 'createStreamMorpher',
    'sanitizeSvg', 'installRuntime', 'buildRuntime', 'buildSrcdoc', 'createFrameController',
    'parseWireframe', 'renderWireframe', 'wireframeCss', 'wireframeDocument', 'createFeedback',
    'previousAsResolved', 'toMessage'] as const) expect(typeof engine[name]).toBe('function');
  expect(engine.SANDBOX).toBe('allow-scripts');
  expect(typeof engine.MORPH_SOURCE).toBe('string');
  expect(typeof engine.WIREFRAME_DOCS).toBe('string');
});

test('barrel tree-shakes unrelated runtime and wireframe code', async () => {
  const result = await Bun.build({
    entrypoints: ['barrel-probe'], target: 'browser', minify: true,
    plugins: [{ name: 'barrel-probe', setup(build) {
      build.onResolve({ filter: /^barrel-probe$/ }, () => ({ path: 'probe', namespace: 'probe' }));
      build.onLoad({ filter: /.*/, namespace: 'probe' }, () => ({
        contents: `import { sanitizeSvg } from ${JSON.stringify(import.meta.dir + '/index.ts')}; console.log(sanitizeSvg('<svg/>'));`, loader: 'ts', resolveDir: import.meta.dir,
      }));
    } }],
  });
  expect(result.success).toBe(true);
  const source = await result.outputs[0].text();
  expect(source).not.toContain('onBeforeUpdate');
  expect(source).not.toContain('prism-mockup');
  expect(source).not.toContain('pwf-root');
  expect(source.length).toBeLessThan(10000);
});
