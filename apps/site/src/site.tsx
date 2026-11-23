import { defaultRegistry } from '@prism-ui/react';
import type { SiteRoute } from './routes';
import { sitePath } from './paths';

export const installCommand = 'bun add @prism-ui/react @prism-ui/components';

export function Site({ route, base, heroHtml = '', docHtml = '' }: { route: SiteRoute; base: string; heroHtml?: string; docHtml?: string }) {
  const href = (path = '') => sitePath(base, path), home = route.kind === 'home';
  return <>
    <a className="skip-link" href="#main">Skip to content</a>
    <header className="site-header wrap">
      <a className="wordmark" href={href()} aria-label="Prism home"><svg width="24" height="26" viewBox="0 0 24 26" fill="none" aria-hidden="true"><path d="M12 2 23 23H1L12 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><path d="m12 2 3 21M1 23l14-8 8 8" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg>Prism</a>
      <nav aria-label="Main navigation"><a href={href('components/')} aria-current={route.kind === 'gallery' || route.kind === 'component' ? 'page' : undefined}>Components</a><a href={href('themes/')} aria-current={route.kind === 'themes' ? 'page' : undefined}>Themes</a><a href={href('docs/integration/')} aria-current={route.kind === 'doc' ? 'page' : undefined}>Docs</a><a href="https://github.com/Knihalani/prism-ui">GitHub <span aria-hidden="true">↗</span></a></nav>
      <button className="mode-toggle" type="button" data-mode-toggle="" aria-label="Toggle light and dark mode" hidden><svg className="mode-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></svg></button>
    </header>
    <main id="main" tabIndex={-1} className={`wrap ${home ? 'home' : 'reference'}`}>
      {home ? <>
        <div className="hero-grid">
          <div className="hero-intro"><p className="eyebrow"><span className="status-dot" /> Open source. Host native.</p><h1>Less interface.<br />More possibility.</h1><p className="lede">Give your AI replies something to work with. Real components, woven into the conversation.</p><div className="hero-links"><a className="primary-link" href={href('components/')}>Explore the components <span aria-hidden="true">↗</span></a><a className="quiet-link" href={href('docs/integration/')}>Start building <span aria-hidden="true">→</span></a></div><p className="fine-print">React · Streaming-first · Yours to shape</p></div>
          <section className="hero-demo" aria-label="A conversation with Prism"><div className="demo-heading"><span>THE CONVERSATION IS THE INTERFACE</span><span className="live-label"><span className="status-dot" /> Live example</span></div><div data-island="hero" dangerouslySetInnerHTML={{ __html: heroHtml }} /><noscript><p className="reply-note">This is the finished reply. Enable JavaScript to adjust the number or replay the stream.</p></noscript></section>
        </div>
        <section className="principles" aria-labelledby="principles-heading"><div className="section-heading"><p className="eyebrow">A SMALLER DISTANCE FROM ANSWER TO ACTION</p><h2 id="principles-heading">Not a dashboard.<br />A better conversation.</h2></div><div className="principle-grid"><article><span className="index-label">01 / IN THE FLOW</span><h3>Belongs in the reply.</h3><p>Numbers you can change. Choices you can weigh. Useful things, right where the words are.</p></article><article><span className="index-label">02 / AS IT ARRIVES</span><h3>Made for the stream.</h3><p>From the first token to the final state, the conversation stays readable and ready to use.</p></article><article><span className="index-label">03 / ON YOUR TERMS</span><h3>Your product, not ours.</h3><p>Keep your model, your transport, your design language. Prism fits the world you already built.</p></article></div></section>
        <section className="get-started" aria-labelledby="start-heading"><div><p className="eyebrow">A FEW LINES TO SOMETHING REAL</p><h2 id="start-heading">Make room for interaction.</h2><p>Install the components. Keep the conversation yours.</p><a className="quiet-link" href={href('docs/integration/')}>Read the integration guide <span aria-hidden="true">→</span></a></div><div className="install"><div className="install-heading"><span>YOUR TERMINAL</span><button type="button" className="text-button" data-copy="install-command" hidden>Copy</button></div><pre><code id="install-command">{installCommand}</code></pre><p>Bring your own React app. No hosted service required.</p></div></section>
      </> : <>
        <p className="eyebrow">PRISM / {route.kind === '404' ? '404' : route.kind === 'doc' ? 'DOCUMENTATION' : 'REFERENCE'}</p>
        {route.kind === 'doc' ? <><nav className="doc-nav" aria-label="Documentation">{['integration', 'design', 'motion', 'prompting', 'renderers', 'theming'].map(slug => <a key={slug} href={href(`docs/${slug}/`)} aria-current={route.name === slug || route.title === slug ? 'page' : undefined}>{slug}</a>)}</nav><article className="prose" dangerouslySetInnerHTML={{ __html: docHtml }} /></> : <>
          <h1>{route.title}</h1>
          {route.kind === 'gallery' && <><p className="lede">A vocabulary for useful replies. Built from the same registry you ship.</p><div className="component-index">{defaultRegistry.list().map(def => <a key={def.name} href={href(`components/${def.name}/`)}><h2>{def.name} <span aria-hidden="true">↗</span></h2><p>{def.docs}</p></a>)}</div></>}
          {route.kind === 'component' && <><p className="lede">{defaultRegistry.get(route.name!)?.docs}</p><h2>From the registry</h2><p>This component’s authoring example, directly from its definition.</p><pre><code>{defaultRegistry.get(route.name!)?.examples?.[0] ?? 'No authoring example registered.'}</code></pre><a className="quiet-link" href={href('docs/renderers/')}>Learn about renderers and customization →</a></>}
          {route.kind === 'themes' && <><p className="lede">One conversation. Five different points of view.</p><p>Start with host-native rendering, or make it Refraction, Instrument, Print or Objects.</p><a className="primary-link" href={href('playground/themes.html?editor=1')}>Open the theme editor <span aria-hidden="true">↗</span></a><p><a href={href('docs/theming/')}>Read the theming guide →</a></p></>}
          {route.kind === '404' && <><p className="lede">That page isn’t part of this conversation.</p><a className="primary-link" href={href()}>Back to Prism →</a></>}
        </>}
      </>}
    </main>
    <footer className="site-footer wrap"><span>Prism <span className="footer-note">/ Interfaces in the flow.</span></span><nav aria-label="Footer navigation"><a href={href('themes/')}>Find your theme ↗</a><a href="https://github.com/Knihalani/prism-ui">Built in the open ↗</a></nav></footer>
  </>;
}
