import { parse, renderToString, type Node } from '@prism-ui/core';

const styles = `<style>
main[data-artifact-markdown]{padding:var(--prism-space6,24px);font-size:var(--prism-text-base,15px);line-height:1.55}
[data-artifact-markdown] :where(h1,h2,h3,h4,h5,h6,p,ul,ol,blockquote,pre){margin:0}
[data-artifact-markdown] :where(h1,h2,h3,h4,h5,h6){line-height:1.2;letter-spacing:-.025em}
[data-artifact-markdown] h1{font-size:var(--prism-text-xl,22px)}
[data-artifact-markdown] h2{font-size:var(--prism-text-lg,18px)}
[data-artifact-markdown] > * + *{margin-block-start:var(--prism-space3,12px)}
[data-artifact-markdown] :where(ul,ol){padding-inline-start:var(--prism-space5,20px)}
[data-artifact-markdown] li + li,[data-artifact-markdown] li > * + *{margin-block-start:var(--prism-space1,4px)}
[data-artifact-markdown] [data-task]{list-style:none}
[data-artifact-markdown] [data-task] > label{display:flex;align-items:baseline;gap:var(--prism-space2,8px)}
[data-artifact-markdown] [data-task] input{position:relative;top:.12em;flex:none;margin:0;accent-color:var(--prism-accent)}
[data-artifact-markdown] blockquote{padding-inline-start:var(--prism-space3,12px);border-inline-start:2px solid var(--prism-border);color:var(--prism-muted)}
</style>`;

function tasks(node: Node): Node {
  const children = node.children?.map(tasks);
  if (node.type !== 'listItem' || node.checked === undefined) return children ? { ...node, children } : node;
  const first = children?.[0];
  return {
    ...node, type: 'component', name: 'markdown-task',
    children: [
      { key: node.key, type: 'component', name: 'markdown-task-label', checked: node.checked, children: first?.type === 'paragraph' ? first.children : [] },
      ...(first?.type === 'paragraph' ? children!.slice(1) : children ?? []),
    ],
  };
}

export function renderArtifactMarkdown(source: string) {
  return styles + '<main data-artifact-markdown>' + renderToString(tasks(parse(source)), {
    components: {
      'markdown-task': (_, children) => '<li data-task>' + children + '</li>',
      'markdown-task-label': (node, children) => '<label><input type="checkbox" disabled' +
        (node.checked ? ' checked' : '') + '><span>' + children + '</span></label>',
    },
  }) + '</main>';
}
