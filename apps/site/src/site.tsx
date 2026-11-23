import { defaultRegistry } from '@prism-ui/react';
import type { SiteRoute } from './routes';
import { sitePath } from './paths';
import { Gallery, ComponentReference } from './reference';
import { Documentation, type Heading } from './docs';

export const installCommand = 'bun add @prism-ui/react @prism-ui/components';

export function Site({ route, base, heroHtml = '', docHtml = '', docToc = [], themesHtml = '', previews = {}, exampleHtml = '', highlighted = [], highlight = (code: string) => code }: { route: SiteRoute; base: string; heroHtml?: string; docHtml?: string; docToc?: Heading[]; themesHtml?: string; previews?: Record<string, string>; exampleHtml?: string; highlighted?: string[]; highlight?: (code: string) => string }) {
  const href = (path = '') => sitePath(base, path), home = route.kind === 'home';
  return <>
    <a className="skip-link" href="#main">Skip to content</a>
    <header className="site-header wrap">
      <a className="wordmark" href={href()} aria-label="Prism home"><svg width="24" height="26" viewBox="0 0 24 26" fill="none" aria-hidden="true"><path d="M12 2 23 23H1L12 2Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/><path d="m12 2 3 21M1 23l14-8 8 8" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/></svg>Prism</a>
      <nav aria-label="Main navigation"><a href={href('components/')} aria-current={route.kind === 'gallery' || route.kind === 'component' ? 'page' : undefined}>Components</a><a href={href('themes/')} aria-current={route.kind === 'themes' ? 'page' : undefined}>Themes</a><a href={href('docs/integration/')} aria-current={route.kind === 'doc' ? 'page' : undefined}>Docs</a><a href="https://github.com/Knihalani/prism-ui">GitHub <span aria-hidden="true">↗</span></a></nav>
      <button className="mode-toggle" type="button" data-mode-toggle="" aria-label="Toggle light and dark mode" hidden><svg className="mode-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5"/></svg></button>
    </header>
    <main id="main" tabIndex={-1} className={`wrap ${home ? 'home' : 'reference'} ${route.kind === 'themes' ? 'themes-page' : ''}`}>
      {home ? <>
        <div className="hero-grid">
          <div className="hero-intro"><p className="eyebrow"><span className="status-dot" /> Open-source React components</p><h1>Generative UI.<br />In your replies.</h1><p className="lede">Streaming components that render inline in your AI product’s replies. Fully themeable, from a number to a decision.</p><div className="hero-links"><a className="primary-link" href={href('components/')}>Explore the components <span aria-hidden="true">↗</span></a><a className="quiet-link" href={href('docs/integration/')}>Start building <span aria-hidden="true">→</span></a></div><p className="fine-print">React · Streams as text · Your design system</p></div>
          <section className="hero-demo" aria-label="Live assistant reply"><div data-island="hero" dangerouslySetInnerHTML={{ __html: heroHtml }} /><noscript><p className="reply-note">This is the finished reply. Enable JavaScript to adjust the number, choose billing, or replay the stream.</p></noscript></section>
        </div>
        <section className="principles" aria-labelledby="principles-heading"><div className="section-heading"><p className="eyebrow">A SMALLER DISTANCE FROM ANSWER TO ACTION</p><h2 id="principles-heading">Not a dashboard.<br />A better conversation.</h2></div><div className="principle-grid"><article><span className="index-label">01 / IN THE FLOW</span><h3>Belongs in the reply.</h3><p>Numbers you can change. Choices you can weigh. Useful things, right where the words are.</p></article><article><span className="index-label">02 / AS IT ARRIVES</span><h3>Made for the stream.</h3><p>From the first token to the final state, the conversation stays readable and ready to use.</p></article><article><span className="index-label">03 / ON YOUR TERMS</span><h3>Your product, not ours.</h3><p>Keep your model, your transport, your design language. Prism fits the world you already built.</p></article></div></section>
        <section className="get-started" aria-labelledby="start-heading"><div><p className="eyebrow">A FEW LINES TO SOMETHING REAL</p><h2 id="start-heading">Make room for interaction.</h2><p>Install the components. Keep the conversation yours.</p><a className="quiet-link" href={href('docs/integration/')}>Read the integration guide <span aria-hidden="true">→</span></a></div><div className="install"><div className="install-heading"><span>YOUR TERMINAL</span><button type="button" className="text-button" data-copy="install-command" hidden>Copy</button></div><pre><code id="install-command">{installCommand.split(' ').map((word, index) => <span key={index}>{index > 0 ? ' ' : ''}<span className="command-token">{word}</span></span>)}</code></pre><p>Bring your own React app. No hosted service required.</p></div></section>
      </> : <>
        <p className="eyebrow">PRISM / {route.kind === '404' ? '404' : route.kind === 'doc' ? 'DOCUMENTATION' : 'REFERENCE'}</p>
        {route.kind === 'doc' ? <Documentation html={docHtml} toc={docToc} slug={route.title} base={base} /> : <>
          <h1>{route.title}</h1>
          {route.kind === 'gallery' && <Gallery base={base} previews={previews} />}
          {route.kind === 'component' && <ComponentReference name={route.name!} base={base} exampleHtml={exampleHtml} highlighted={highlighted} highlight={highlight} />}
          {route.kind === 'themes' && <><p className="lede">One reply, five design languages. Change a number, compare a decision, and find the voice that belongs in your product.</p><div className="theme-links"><a className="primary-link" href={href('playground/themes.html?editor=1')}>Open the theme editor <span aria-hidden="true">↗</span></a><a href={href('docs/theming/')}>The theming guide →</a></div><div data-island="themes" dangerouslySetInnerHTML={{ __html: themesHtml }} /><noscript><p>Finished replies. Enable JavaScript to adjust the examples and switch their color mode.</p></noscript></>}
          {route.kind === '404' && <><p className="lede">That page isn’t part of this conversation.</p><a className="primary-link" href={href()}>Back to Prism →</a></>}
        </>}
      </>}
    </main>
    <footer className="site-footer wrap"><span>Prism <span className="footer-note">/ Interfaces in the flow.</span></span><nav aria-label="Footer navigation"><a href={href('themes/')}>Find your theme ↗</a><a href="https://github.com/Knihalani/prism-ui">Built in the open ↗</a></nav></footer>
  </>;
}
