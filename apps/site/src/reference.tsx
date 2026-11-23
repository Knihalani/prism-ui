import { defaultRegistry } from '@prism-ui/react';
import { category, components, description, examples, groups, properties, slotSnippet } from './gallery-data';
import { sitePath } from './paths';

function Type({ value }: { value: string }) {
  return value.length > 80 ? <details className="schema-type"><summary>{value.endsWith('[]') ? 'Array of objects' : value.startsWith('{') ? 'Object' : 'Union / structured value'}</summary><code>{value.replaceAll(', ', ',\n')}</code></details> : <code>{value}</code>;
}

export function Gallery({ base, previews }: { base: string; previews: Record<string, string> }) {
  return <>
    <p className="lede">Choose the right interaction for the reply. Every preview below comes from the component’s registered example.</p>
    <nav className="category-nav" aria-label="Component categories">{groups.map((group, i) => <a key={group} href={`#category-${i}`}>{group}</a>)}</nav>
    {groups.map((group, i) => <section className="gallery-group" key={group} aria-labelledby={`category-${i}`}>
      <h2 id={`category-${i}`}>{group}</h2>
      <div className="gallery-grid">{components().filter(def => category(def.name) === group).map(def => <article className="gallery-card" key={def.name}>
        <div className="gallery-preview static-preview" aria-hidden="true" inert dangerouslySetInnerHTML={{ __html: previews[def.name] ?? '' }} />
        <a href={sitePath(base, `components/${def.name}/`)} className="gallery-link"><h3>{def.name}<span aria-hidden="true">↗</span></h3><p>{description(def)}</p><span className="sr-only">Open {def.name} reference</span></a>
      </article>)}</div>
    </section>)}
  </>;
}

export function ComponentReference({ name, base, exampleHtml, highlighted, highlight }: { name: string; base: string; exampleHtml: string; highlighted: string[]; highlight: (code: string) => string }) {
  const def = defaultRegistry.get(name)!;
  const all = components(), index = all.findIndex(item => item.name === name), props = properties(def.schema);
  const hasDescriptions = props.some(prop => !!prop.description);
  return <div data-component-page="">
    <p className="component-description">{description(def)}</p>
    <nav className="reference-nav" aria-label="On this page">{['example', 'source', 'props', 'parts', 'strings'].map(section => <a href={`#${section}`} key={section}>{section}</a>)}</nav>
    <section className="example-section" aria-labelledby="example"><h2 id="example">Try it in a reply</h2>
      <div data-island="example" data-component={name}>
        <script type="application/json" data-example-data="" dangerouslySetInnerHTML={{ __html: JSON.stringify({ name, sources: examples(def) }).replaceAll('<', '\\u003c') }} />
        <div data-example-root="" dangerouslySetInnerHTML={{ __html: exampleHtml }} />
      </div>
      <noscript><p>Finished example. Enable JavaScript to interact, switch examples and themes, or replay the stream.</p></noscript>
    </section>
    {def.docs !== description(def) && <details className="component-notes"><summary>Behavior & authoring notes</summary><p>{def.docs}</p></details>}
    <section className="reference-section" aria-labelledby="source"><h2 id="source">Authoring source</h2><p>Send this text in your assistant’s reply. Prism turns the directive into a component as it streams.</p>
      {examples(def).map((source, i) => <div key={i} data-source-index={i} hidden={i > 0} className="source-panel"><div className="code-heading"><span>Example {i + 1} · Prism markup</span><button className="text-button" type="button" data-copy={`source-${i}`} hidden>Copy</button></div><pre><code id={`source-${i}`} dangerouslySetInnerHTML={{ __html: highlighted[i] ?? source }} /></pre></div>)}
    </section>
    <section className="reference-section" aria-labelledby="props"><h2 id="props">Props</h2><p>Generated from the registered schema. Dotted names describe nested objects; array types include their item structure.</p>
      <div className="reference-table-scroll" tabIndex={0} role="region" aria-label="Component props"><table className="reference-table" data-props-table=""><caption className="sr-only">{name} props</caption><thead><tr>{['Name', 'Type', 'Default', 'Required', ...(hasDescriptions ? ['Description'] : [])].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{props.length ? props.map(prop => <tr key={prop.name}><th scope="row"><code>{prop.name}</code></th><td><Type value={prop.type} /></td><td><Type value={prop.defaultValue} /></td><td>{prop.required ? 'Yes' : 'No'}</td>{hasDescriptions && <td>{prop.description || '—'}</td>}</tr>) : <tr><td colSpan={hasDescriptions ? 5 : 4}>No declared props. This component uses its Markdown body.</td></tr>}</tbody></table></div>
    </section>
    <section className="reference-section" aria-labelledby="parts"><h2 id="parts">Parts & slots</h2><p>Replace a named part without taking over the component’s state. Forward its DOM props, children and ref.</p>
      <ul className="part-list" data-parts-list="">{def.parts?.length ? def.parts.map(part => <li key={part}><code>{part}</code></li>) : <li>No replaceable parts declared.</li>}</ul>
      <details className="slot-example"><summary>Typed slot override</summary><div className="source-panel"><div className="code-heading"><span>React · TypeScript</span><button className="text-button" type="button" data-copy="slot-source" hidden>Copy</button></div><pre><code id="slot-source" dangerouslySetInnerHTML={{ __html: highlight(slotSnippet(def)) }} /></pre></div></details>
    </section>
    <section className="reference-section" aria-labelledby="strings"><h2 id="strings">Strings</h2><p>Registered defaults for labels, messages and actions. Theme strings can override these defaults.</p>
      <div className="reference-table-scroll" tabIndex={0} role="region" aria-label="Component strings"><table className="reference-table strings-table"><caption className="sr-only">{name} strings</caption><thead><tr><th scope="col">Key</th><th scope="col">Default</th></tr></thead><tbody>{Object.entries(def.strings ?? {}).length ? Object.entries(def.strings ?? {}).map(([key, value]) => <tr key={key}><th scope="row"><code>{key}</code></th><td>{value}</td></tr>) : <tr><td colSpan={2}>No registered string defaults.</td></tr>}</tbody></table></div>
    </section>
    <nav className="component-pagination" aria-label="Component pagination">{index > 0 ? <a rel="prev" href={sitePath(base, `components/${all[index - 1].name}/`)}>← {all[index - 1].name}</a> : <span />}{index < all.length - 1 && <a rel="next" href={sitePath(base, `components/${all[index + 1].name}/`)}>{all[index + 1].name} →</a>}</nav>
  </div>;
}
