import { useMemo, useState } from 'react';
import { demos } from '../catalogue';
import { scenarios } from '../agent/scenarios';
import { Dialog } from './Dialog';
import { Icon } from './Icon';

function fuzzy(query: string, value: string) {
  let cursor = 0;
  for (const char of value.toLowerCase()) if (char === query[cursor]) cursor++;
  return cursor === query.length;
}
export function Palette({ onClose, onChoose }: { onClose(): void; onChoose(prompt: string, demoId?: string): void }) {
  const [query, setQuery] = useState(''), [index, setIndex] = useState(0);
  const items = useMemo(() => [
    ...scenarios.map(item => ({ id: item.id, group: 'Scenarios', label: item.prompt, prompt: item.prompt, demoId: undefined as string | undefined })),
    ...demos.map(item => ({ id: item.id, group: 'Components', label: item.label, prompt: item.prompt, demoId: item.id })),
  ].filter(item => fuzzy(query.toLowerCase().replace(/\s/g, ''), (item.label + ' ' + item.id).replace(/\s/g, ''))), [query]);
  return <Dialog title="Search scenarios and components" onClose={onClose} className="palette">
    <div className="palette-search"><Icon name="search" /><input data-autofocus aria-label="Search scenarios and components" placeholder="Search anything…" value={query} role="combobox" aria-expanded="true" aria-controls="palette-results" aria-activedescendant={items[index] ? 'result-' + items[index].id + '-' + items[index].group : undefined} onChange={e => { setQuery(e.target.value); setIndex(0); }} onKeyDown={e => {
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); const next = (index + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % Math.max(1, items.length); setIndex(next); document.getElementById('result-' + items[next]?.id + '-' + items[next]?.group)?.scrollIntoView?.({ block: 'nearest' }); }
      if (e.key === 'Enter' && items[index]) { e.preventDefault(); onChoose(items[index].prompt, items[index].demoId); }
    }} /></div>
    <div className="palette-results" id="palette-results" role="listbox" aria-label="Results">
      {items.map((item, i) => <div key={item.group + item.id}>{items[i - 1]?.group !== item.group && <div className="list-heading">{item.group}</div>}<button id={'result-' + item.id + '-' + item.group} role="option" aria-selected={index === i} className="palette-result" onMouseMove={() => setIndex(i)} onClick={() => onChoose(item.prompt, item.demoId)}><Icon name={item.demoId ? 'grid' : 'chat'} /><span>{item.label}</span></button></div>)}
      {!items.length && <p className="empty-results">No matches. Try a component name.</p>}
    </div>
    <div className="palette-hint">Arrow keys to explore · Enter to open</div>
  </Dialog>;
}
