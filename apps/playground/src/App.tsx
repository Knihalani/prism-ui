import { Component, useCallback, useEffect, useRef, useState, type ErrorInfo, type ReactNode } from 'react';
import { Prism, ThemeScope, type Action } from '@prism-ui/react';
import { makeStore } from './store';
import { demos, groups, kitchen, replyFor, demoSource, fallback, type Demo } from './catalogue';
import { createReplay } from './replay';
import { playgroundPlugins } from './plugins';

type Message = { id: string; role: 'user' | 'assistant'; text: string; stream?: AsyncIterable<string>; pending?: boolean; action?: Action };
type Reply = { id: string; text: string };
class MessageBoundary extends Component<{ children: ReactNode }, { error: boolean }> {
  state = { error: false };
  static getDerivedStateFromError() { return { error: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('Prism demo render failed', error, info); }
  render() { return this.state.error ? <p role="alert">This example couldn’t render. Start a new chat to try again.</p> : this.props.children; }
}
export function App({ pace = { chars: 8, delay: 20 } }: { pace?: { chars: number; delay: number } }) {
  const [store, setStore] = useState(() => makeStore());
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState('');
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [menu, setMenu] = useState(false);
  const [active, setActive] = useState<string>();
  const sequence = useRef(0), session = useRef(Date.now().toString(36));
  const running = useRef<ReturnType<typeof createReplay> | undefined>(undefined);
  const queued = useRef<Reply[]>([]);
  const thread = useRef<HTMLDivElement>(null), composer = useRef<HTMLTextAreaElement>(null), menuButton = useRef<HTMLButtonElement>(null);
  const follow = useRef(true);
  const nextId = () => 'm' + session.current + 'x' + ++sequence.current;
  const stop = useCallback(() => { queued.current = []; running.current?.stop(); running.current = undefined; setActive(undefined); }, []);
  useEffect(() => () => { queued.current = []; running.current?.stop(); running.current = undefined; }, []);
  useEffect(() => {
    const element = thread.current;
    if (!element) return;
    const observer = new MutationObserver(() => { if (follow.current) element.scrollTop = element.scrollHeight; });
    observer.observe(element, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!menu) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') { setMenu(false); menuButton.current?.focus(); } };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [menu]);
  function startReply({ id, text }: Reply) {
    const replay = createReplay(text, () => pace, () => {
      setMessages(current => current.map(message => message.id === id ? { ...message, pending: false } : message));
      if (running.current === replay) {
        running.current = undefined;
        const next = queued.current.shift();
        if (next) startReply(next); else setActive(undefined);
      }
    });
    running.current = replay; follow.current = true;
    setMessages(current => [...current, { id, role: 'assistant', text, stream: replay.stream, pending: true }]);
    setActive(id); setMenu(false);
  }
  function respond(prompt: string, item?: Demo, action?: Action, reply?: string) {
    if (!action) stop();
    const id = nextId(), text = reply ?? (item ? demoSource(item, id) : fallback);
    const user: Message = { id: nextId(), role: 'user', text: prompt, action };
    setMessages(current => [...current, user]);
    if (running.current) queued.current.push({ id, text }); else startReply({ id, text });
  }
  function onAction(action: Action) {
    if (action.type === 'copy') return;
    let reply = `Got it — I’ve noted “${action.message || 'your choice'}”. Your changes stay in this conversation. You can keep exploring above, or ask me for the next part of the plan.`;
    if (action.component === 'estimate' && action.type === 'use') {
      const path = action.id + '.items.seats.qty', current = store.get(path);
      if (typeof current === 'number') {
        const seats = Math.min(25, current + 1);
        store.apply({ set: { [path]: seats } });
        reply = 'Got it. For the next planning pass, I’ve updated this estimate to **' + seats + ' seats** with an agent state patch. The estimate above has recalculated automatically. You can still adjust it before moving forward.';
      }
    } else if (action.component === 'ask') reply = 'Thanks — I have your kickoff details. I’d start with a **30-minute session**: ten minutes on the goal, ten on the first workflow, and ten for questions. Keep the pilot small and choose one thing to learn this week.';
    respond(action.message || 'Use this choice', undefined, action, reply);
  }
  function newChat() { stop(); setMessages([]); setDraft(''); setStore(makeStore(true)); setMenu(false); follow.current = true; composer.current?.focus(); }
  function send() { const text = draft.trim(); if (text) { respond(text, replyFor(text)); setDraft(''); } }
  function choose(item: Demo) { respond(item.prompt, item); }
  return <ThemeScope theme={theme} className="chat-app">
    {menu && <button className="sidebar-backdrop" aria-label="Close component menu" onClick={() => setMenu(false)} />}
    <aside className={'sidebar' + (menu ? ' is-open' : '')} aria-label="Component examples">
      <div className="sidebar-brand"><span className="prism-mark" aria-hidden="true">◈</span><strong>Prism</strong><span>demo</span><button className="mobile-close" aria-label="Close sidebar" onClick={() => setMenu(false)}>×</button></div>
      <button className="new-chat" onClick={newChat}><span aria-hidden="true">+</span> New chat</button>
      <nav aria-label="Demo components">
        <button className="kitchen-item" onClick={() => choose(kitchen)}><span aria-hidden="true">✳</span> Kitchen sink</button>
        {groups.map(group => <section key={group} aria-label={group}><h2>{group}</h2>{demos.filter(item => item.group === group).map(item => <button key={item.id} data-demo={item.id} onClick={() => choose(item)}>{item.label}</button>)}</section>)}
      </nav>
      <div className="sidebar-foot"><span>A little more than text.</span><a href="https://github.com/Knihalani/prism-ui" target="_blank" rel="noreferrer">About Prism ↗</a></div>
    </aside>
    <main className="chat-main">
      <header className="chat-header"><button ref={menuButton} className="menu-toggle" aria-label="Open component menu" aria-expanded={menu} onClick={() => setMenu(!menu)}>☰</button><span>Prism <span className="header-muted">/ chat</span></span><button className="theme-toggle" onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')} aria-label={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}>{theme === 'light' ? '☾' : '☀'}<span>{theme === 'light' ? 'Dark' : 'Light'}</span></button></header>
      <div className="thread-scroll" ref={thread} onScroll={event => { const el = event.currentTarget; follow.current = el.scrollHeight - el.scrollTop - el.clientHeight < 100; }}>
        <div className="thread">
          {!messages.length && <div className="welcome"><span className="welcome-mark" aria-hidden="true">◈</span><h1>What would you like to explore?</h1><p>A conversation with working UI built in.<br />Choose an example, or ask for something below.</p><div className="suggestions">{['estimate', 'runbook', 'mockup-html', 'artifact-react'].map(id => { const item = demos.find(item => item.id === id)!; return <button key={id} onClick={() => choose(item)}>{item.prompt}<span aria-hidden="true">↗</span></button>; })}</div></div>}
          {messages.map(message => <article className={'message ' + message.role} key={message.id} data-message={message.role} aria-label={message.role === 'user' ? 'Your message' : 'Prism reply'}>
            {message.role === 'user' ? <><div className="user-bubble">{message.text}</div>{message.action && <details className="payload"><summary>payload</summary><pre>{JSON.stringify(message.action, null, 2)}</pre></details>}</> : <><div className="assistant-label"><span aria-hidden="true">◈</span> Prism</div><MessageBoundary><Prism stream={message.stream} source={message.stream ? undefined : message.text} store={store} theme={theme} plugins={playgroundPlugins} onAction={onAction} /></MessageBoundary>{message.pending && active === message.id && <span className="typing" role="status">Writing<span aria-hidden="true">…</span></span>}</>}
          </article>)}
        </div>
      </div>
      <div className="composer-area"><form className="composer" onSubmit={event => { event.preventDefault(); send(); }}><textarea ref={composer} aria-label="Message Prism" placeholder="Ask for a component, or describe an idea…" rows={2} value={draft} onChange={event => setDraft(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); send(); } }} />{active ? <button type="button" className="send-button" aria-label="Stop response" onClick={stop}>■</button> : <button type="submit" className="send-button" aria-label="Send message" disabled={!draft.trim()}>↑</button>}</form><p className="composer-note">A local demo. Scripted replies, real components. <span>Enter to send · Shift + Enter for a new line</span></p></div>
    </main>
  </ThemeScope>;
}
