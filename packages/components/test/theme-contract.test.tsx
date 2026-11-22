import '../../react/test/setup';
import { expect, test } from 'bun:test';
import { createElement } from 'react';
import { cleanup, render } from '@testing-library/react';
import { readFileSync, readdirSync } from 'node:fs';
import ts from 'typescript';
import { Prism, defaultRegistry, type Slots } from '@prism-ui/react';
import { mockupPlugin, artifactPlugin } from '../src';
import '../src';

const names: Record<string, string> = { code: 'codeblock', dataTable: 'datatable', step: 'runbook' };
const plugins = [mockupPlugin, artifactPlugin];
const fixtures = defaultRegistry.list().filter(def => def.examples?.length);
const sources = [...new Set(fixtures.flatMap(def => def.examples ?? []))];

test('registry fixtures declare every rendered part and rendered declared parts accept marker slots', () => {
  let components = 0, occurrences = 0;
  for (const source of sources) {
    const baseline = render(<Prism source={source} plugins={plugins} animate={false} />);
    const observed = new Map<string, Set<string>>();
    const tags = new Map<string, string>();
    for (const element of Array.from(baseline.container.querySelectorAll('[data-prism][data-part]'))) {
      const component = element.getAttribute('data-prism')!, part = element.getAttribute('data-part')!;
      const definition = fixtures.find(def => (names[def.name] ?? def.name) === component);
      if (!definition) continue;
      expect(definition.parts, `${component}.${part} must be declared`).toContain(part);
      if (!observed.has(component)) observed.set(component, new Set());
      observed.get(component)!.add(part); occurrences++;
      tags.set(`${component}.${part}`, element.tagName.toLowerCase());
    }
    cleanup();
    for (const [component, parts] of observed) {
      components++;
      for (const part of parts) {
        const Marker = ({ as, children, ...props }: any) => {
          const { row, model, estimate, frame, overflow, primitive, item, column, runbook, step, troubleshoot, summary, point, action, card, callout, grid, badge, tabs, tab, codeblock, html, ...attributes } = props;
          return createElement(as ?? tags.get(`${component}.${part}`)!, { ...attributes, 'data-slot-marker': `${component}.${part}` }, children);
        };
        const slots: Slots = { [component]: { [part]: Marker } };
        const view = render(<Prism source={source} plugins={plugins} animate={false} slots={slots} />);
        expect(view.container.querySelector(`[data-slot-marker="${component}.${part}"]`), `${component}.${part} must resolve its slot`).not.toBeNull();
        cleanup();
      }
    }
  }
  expect(components).toBeGreaterThan(15); expect(occurrences).toBeGreaterThan(100);
});

test('best-effort string contract: JSX prose and accessibility labels come from strings or props', () => {
  const violations: string[] = [];
  function scan(directory: string) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = directory + '/' + entry.name;
      if (entry.isDirectory() && !['harness', 'lib'].includes(entry.name)) scan(path);
      else if (entry.isFile() && path.endsWith('.tsx') && !path.includes('.test.')) {
        const source = readFileSync(path, 'utf8'), file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
        function visit(node: ts.Node) {
          if (ts.isJsxText(node) && /\p{L}/u.test(node.text)) violations.push(path + ': ' + node.text.trim());
          if (ts.isJsxAttribute(node) && ['aria-label', 'title', 'placeholder', 'alt'].includes(node.name.getText(file)) && node.initializer && ts.isStringLiteral(node.initializer) && /\p{L}/u.test(node.initializer.text)) violations.push(path + ': ' + node.getText(file));
          ts.forEachChild(node, visit);
        }
        visit(file);
      }
    }
  }
  scan(new URL('../src', import.meta.url).pathname);
  expect(violations).toEqual([]);
});
