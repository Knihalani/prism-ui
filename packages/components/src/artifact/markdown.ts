import { parse, renderToString, type Node } from '@prism-ui/core';

const styles = `<style>
main[data-artifact-markdown]{padding:var(--prism-space-6,24px);font-size:var(--prism-text-base,15px);line-height:1.55}
[data-artifact-markdown] :where(h1,h2,h3,h4,h5,h6,p,ul,ol,blockquote,pre){margin:0}
[data-artifact-markdown] :where(h1,h2,h3,h4,h5,h6){line-height:1.2;letter-spacing:-.025em}
[data-artifact-markdown] h1{font-size:var(--prism-text-xl,22px)}
[data-artifact-markdown] h2{font-size:var(--prism-text-lg,18px)}
[data-artifact-markdown] > * + *{margin-block-start:var(--prism-space-3,12px)}
[data-artifact-markdown] :where(ul,ol){padding-inline-start:var(--prism-space-5,20px)}
[data-artifact-markdown] li + li,[data-artifact-markdown] li > * + *{margin-block-start:var(--prism-space-1,4px)}
[data-artifact-markdown] [data-task]{list-style:none}
[data-artifact-markdown] [data-task] > label{display:flex;align-items:baseline;gap:var(--prism-space-2,8px)}
[data-artifact-markdown] [data-task] input{position:relative;top:.12em;flex:none;margin:0;accent-color:var(--prism-accent, #525252)}
[data-artifact-markdown] [data-task] input:focus-visible{outline:2px solid var(--prism-accent, #525252);outline-offset:2px}
[data-artifact-markdown] blockquote{padding-inline-start:var(--prism-space-3,12px);border-inline-start:2px solid var(--prism-border);color:var(--prism-text-muted)}
</style>`;

const text = (node: Node): string => node.value ?? node.children?.map(text).join('') ?? '';

function tasks(node: Node, defaults: Record<string, boolean>, counts: Map<string, number>): Node {
  if (node.type !== 'listItem' || node.checked === undefined) {
    return node.children ? { ...node, children: node.children.map(child => tasks(child, defaults, counts)) } : node;
  }
  const first = node.children?.[0];
  const label = first?.type === 'paragraph' ? text(first) : '';
  let hash = 2166136261;
  for (let i = 0; i < label.length; i++) hash = Math.imul(hash ^ label.charCodeAt(i), 16777619);
  const base = (hash >>> 0).toString(36);
  const index = (counts.get(base) ?? 0) + 1;
  counts.set(base, index);
  const key = `task-${base}-${index}`;
  defaults[key] = node.checked;
  return {
    ...node, type: 'component', name: 'markdown-task', key,
    children: [
      { key, type: 'component', name: 'markdown-task-label', checked: node.checked, children: first?.type === 'paragraph' ? first.children : [] },
      ...(node.children?.slice(first?.type === 'paragraph' ? 1 : 0).map(child => tasks(child, defaults, counts)) ?? []),
    ],
  };
}

export function renderArtifactMarkdown(source: string) {
  const defaults: Record<string, boolean> = {};
  const html = styles + '<main data-artifact-markdown>' + renderToString(tasks(parse(source), defaults, new Map()), {
    components: {
      'markdown-task': (node, children) => '<li data-task data-key="' + node.key + '">' + children + '</li>',
      'markdown-task-label': (node, children) => '<label><input type="checkbox" data-task-key="' + node.key + '"' +
        (node.checked ? ' checked' : '') + '><span>' + children + '</span></label>',
    },
  }) + '</main>';
  return { html, defaults };
}

export function markdownTaskPath(id: string) {
  const key = id.replace(/%/g, '%25').replace(/\./g, '%2E');
  return `${!key || ['__proto__', 'prototype', 'constructor', '*'].includes(key) ? '%' + key : key}.markdownTasks`;
}
