import { readFile } from 'node:fs/promises';
import { createElement } from 'react';
import { render } from '@testing-library/react';
import { parse, type Node } from '@prism-ui/core';
import { Prism } from '@prism-ui/react';
import { createStore } from '@prism-ui/state';
import { ArtifactProvider, artifactSchema } from '@prism-ui/components/artifact';
import { allowedPath, importMap } from '../../../packages/components/src/artifact/policy';
import { evals, type EvalRecording } from '../src/agent/evals';
import { artifactStatePaths } from '../src/agent/policy';
import { playgroundPlugins } from '../src/plugins';

function components(nodes: Node[]): Node[] {
  return nodes.flatMap(node => [...(node.type === 'component' ? [node] : []), ...components(node.children ?? [])]);
}
export async function replayFixture(path: string, expected: readonly { id: string; anyOf: readonly string[] }[] = evals) {
  const fixture = JSON.parse(await readFile(path, 'utf8')) as EvalRecording;
  if (fixture.version !== 1 || !fixture.provider || !fixture.model || !fixture.date || !Array.isArray(fixture.records)) throw Error('Invalid recording provenance.');
  for (const evaluation of expected) {
    const record = fixture.records.find(record => record.id === evaluation.id);
    if (!record || record.error || !record.prompt || !record.output?.trim()) throw Error(evaluation.id + ': missing or incomplete recording.');
    const nodes = components(parse(record.output, { plugins: playgroundPlugins }).children);
    if (!nodes.some(node => evaluation.anyOf.includes(node.name!))) throw Error(evaluation.id + ': expected ' + evaluation.anyOf.join(' or '));
    for (const node of nodes.filter(node => node.name === 'artifact')) {
      const result = artifactSchema.coerce(node.props);
      if (result.issues.length) throw Error(evaluation.id + ': invalid artifact schema.');
      const source = result.value.source;
      if (/\b(?:fetch|eval|XMLHttpRequest|WebSocket)\s*\(|\b(?:localStorage|sessionStorage|document\.cookie)\b/.test(source)) throw Error(evaluation.id + ': disallowed artifact capability.');
      if (result.value.kind === 'html' && (!source.includes('--prism-') || !source.includes('@container') || /position:\s*fixed|\d+(?:vw|vh)\b/.test(source))) throw Error(evaluation.id + ': artifact does not follow adaptive host styling.');
      for (const match of source.matchAll(/prism\.state\.(?:get|set|subscribe)\(\s*['"]([^'"]+)['"]/g)) {
        if (!allowedPath(match[1], artifactStatePaths)) throw Error(evaluation.id + ': ungranted artifact state path.');
      }
      importMap({}, 'https://prism.example');
    }
    const store = createStore();
    const reply = (source: string, done: boolean) => createElement(ArtifactProvider, { options: { statePaths: artifactStatePaths }, children: createElement(Prism, { source, done, plugins: playgroundPlugins, store, animate: false, scope: evaluation.id }) });
    const view = render(reply('', false));
    try {
      for (let end = 113; end < record.output.length; end += 113) view.rerender(reply(record.output.slice(0, end), false));
      view.rerender(reply(record.output, true));
      if (!view.container.children.length || view.container.querySelector('[data-prism-error]')) throw Error(evaluation.id + ': reply did not render.');
    } finally { view.unmount(); }
  }
  return fixture.records.length;
}
