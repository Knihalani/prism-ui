import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react';
import { ThemeScope, type Action } from '@prism-ui/react';
import { makeStore } from './store';
import { createAgent, loadAgentConfig, saveAgentConfig, type AgentConfig } from './agent/config';
import { createScriptedAgent, routeMessage } from './agent/scripted';
import { realistic, type Pace } from './agent/pace';
import { scenarios } from './agent/scenarios';
import type { Agent, AgentInput, Turn } from './agent/types';
import { Icon, type IconName } from './ui/Icon';
import { AssistantTurn } from './ui/Turn';
import { Palette } from './ui/Palette';
import { Settings } from './ui/Settings';

type Request = { text: string; demoId?: string } | { action: Action };
type Message = { id: string; role: 'user' | 'assistant'; text: string; streaming?: boolean; error?: string; input?: AgentInput; gallery?: boolean };
type Conversation = { id: string; title: string; scenario?: string; originScenario?: string; messages: Message[]; store: ReturnType<typeof makeStore>; scripted: Agent; agent?: Agent; revision: number; queue: Request[]; controller?: AbortController; draft: string; scroll: number; following: boolean };
type AppProps = { pace?: Pace; agentFactory?: (config: AgentConfig) => Agent };
const descriptions = ['Find the right balance of power and portability.', 'Four days, with room to get a little lost.', 'Get from a red build to a safe recovery.', 'Explore two directions, then make it yours.', 'A thoughtful day together, with a clear budget.', 'Turn interview notes into a useful next step.'];
const scenarioIcons: IconName[] = ['laptop', 'trip', 'deploy', 'design', 'budget', 'research'];
const scenarioTitles = ['Pick a laptop', 'Four days in Kyoto', 'Debug a deploy', 'Mock up a landing page', 'Plan a team offsite', 'Make sense of research'];
let sequence = 0;
const nextId = () => 'chat-' + Date.now().toString(36) + '-' + ++sequence;
function useMedia(query: string) {
  const [matches, setMatches] = useState(() => typeof matchMedia === 'function' && matchMedia(query).matches);
  useEffect(() => { if (typeof matchMedia !== 'function') return; const media = matchMedia(query), update = () => setMatches(media.matches); update(); media.addEventListener('change', update); return () => media.removeEventListener('change', update); }, [query]);
  return matches;
}
export function App({ pace = realistic, agentFactory }: AppProps) {
  const [, redraw] = useReducer(value => value + 1, 0);
  const config = useRef(loadAgentConfig()), revision = useRef(0);
  const conversations = useRef(new Map<string, Conversation>());
  const makeConversation = (scenario?: string): Conversation => {
    const id = nextId();
    const conversation: Conversation = { id, scenario, title: scenarios.find(item => item.id === scenario)?.title ?? 'New chat', messages: [], store: makeStore(true, id), scripted: createScriptedAgent({ pace }), revision: -1, queue: [], draft: '', scroll: 0, following: true };
    conversations.current.set(id, conversation); return conversation;
  };
  const [currentId, setCurrentId] = useState(() => makeConversation().id);
  const current = conversations.current.get(currentId)!;
  const currentRef = useRef(current); currentRef.current = current;
  const [sidebar, setSidebar] = useState(true), [drawer, setDrawer] = useState(false);
  const [overlay, setOverlay] = useState<'palette' | 'settings'>();
  const [themeChoice, setThemeChoice] = useState<'light' | 'dark' | 'system'>(() => { try { const saved = localStorage.getItem('prism-theme'); return saved === 'light' || saved === 'dark' ? saved : 'system'; } catch { return 'system'; } });
  const darkSystem = useMedia('(prefers-color-scheme: dark)'), mobile = useMedia('(max-width: 760px)'), reduced = useMedia('(prefers-reduced-motion: reduce)');
  const theme = themeChoice === 'system' ? darkSystem ? 'dark' : 'light' : themeChoice;
  const scroll = useRef<HTMLDivElement>(null), textarea = useRef<HTMLTextAreaElement>(null), sidebarRef = useRef<HTMLElement>(null), sidebarToggle = useRef<HTMLButtonElement>(null);
  const frame = useRef<number | undefined>(undefined), mounted = useRef(true);
  const notify = useCallback(() => { if (mounted.current) redraw(); }, []);
  const closeOverlay = useCallback(() => setOverlay(undefined), []);
  const openOverlay = (value: 'palette' | 'settings') => { setDrawer(false); setOverlay(value); };
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; for (const c of conversations.current.values()) { c.queue = []; c.controller?.abort(); } if (frame.current !== undefined) cancelAnimationFrame(frame.current); }; }, []);
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setDrawer(false); setOverlay(value => value === 'palette' ? undefined : 'palette'); }
    };
    document.addEventListener('keydown', listener); return () => document.removeEventListener('keydown', listener);
  }, []);
  useEffect(() => {
    if (!drawer || !mobile) return;
    const previous = document.activeElement as HTMLElement | null, root = sidebarRef.current!;
    root.querySelector<HTMLButtonElement>('button')?.focus();
    const listener = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setDrawer(false); }
      if (event.key === 'Tab') {
        const items = Array.from(root.querySelectorAll<HTMLButtonElement>('button')), first = items[0], last = items.at(-1);
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
        if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
    };
    root.addEventListener('keydown', listener); return () => { root.removeEventListener('keydown', listener); (previous?.isConnected ? previous : sidebarToggle.current)?.focus(); };
  }, [drawer, mobile]);
  useLayoutEffect(() => {
    const element = textarea.current; if (!element) return;
    element.style.height = 'auto'; element.style.height = Math.min(element.scrollHeight || 24, 192) + 'px';
  }, [current.draft, currentId, current.messages.length]);
  useLayoutEffect(() => {
    const element = scroll.current; if (!element) return;
    element.scrollTop = current.following ? element.scrollHeight : current.scroll;
  }, [currentId]);
  useLayoutEffect(() => {
    if (!current.following || !scroll.current) return;
    if (frame.current !== undefined) cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => { const element = scroll.current; if (element && currentRef.current.following) element.scrollTop = element.scrollHeight; });
  });
  function stop(conversation = current) {
    conversation.queue = []; conversation.controller?.abort();
    for (const message of conversation.messages) message.streaming = false;
    notify();
  }
  async function run(conversation: Conversation, request: Request, replacement?: Message) {
    if (conversation.controller) { conversation.queue.push(request); return; }
    const history: Turn[] = conversation.messages.filter(message => message !== replacement && !message.error).map(({ role, text }) => ({ role, text }));
    const input: AgentInput = replacement?.input ?? ('action' in request ? { kind: 'action', action: request.action, history } : { kind: 'message', text: request.demoId ? 'gallery:' + request.demoId : request.text, history });
    const gallery = replacement?.gallery ?? ('demoId' in request && !!request.demoId);
    if (!replacement && 'text' in request) {
      conversation.messages.push({ id: nextId(), role: 'user', text: request.text });
      if (conversation.title === 'New chat') conversation.title = request.text.slice(0, 40);
    }
    const message: Message = replacement ?? { id: nextId(), role: 'assistant', text: '' };
    if (replacement) message.id = nextId();
    if (!replacement) conversation.messages.push(message);
    message.text = ''; message.error = undefined; message.streaming = true; message.input = input; message.gallery = gallery;
    const controller = new AbortController(); conversation.controller = controller;
    const options = config.current;
    if (!conversation.agent || conversation.revision !== revision.current) {
      conversation.agent = agentFactory ? agentFactory(options) : options.provider !== 'scripted' && options.apiKey?.trim() ? createAgent(options) : conversation.scripted;
      conversation.revision = revision.current;
    }
    const agent = gallery ? conversation.scripted : conversation.agent;
    notify();
    try {
      for await (const event of agent.respond(input, controller.signal)) {
        if (controller.signal.aborted) break;
        if (event.type === 'text') message.text += event.delta;
        else if (event.type === 'patch') conversation.store.apply(event.patch);
        else if (event.type === 'title') conversation.title = event.title;
        notify();
      }
    } catch { if (!controller.signal.aborted) message.error = 'The response was interrupted. Check your connection or model settings, then try again.'; }
    finally {
      message.streaming = false;
      if (conversation.controller === controller) conversation.controller = undefined;
      notify();
      const queued = conversation.queue.shift(); if (queued && mounted.current) void run(conversation, queued);
    }
  }
  function send(text: string, demoId?: string) {
    if (!text.trim()) return;
    if (!current.messages.length && !demoId) {
      const route = routeMessage(text);
      if (route.kind === 'scenario') current.originScenario = route.scenario.id;
    }
    current.draft = ''; current.following = true;
    void run(current, { text: text.trim(), demoId }); notify();
  }
  function onAction(action: Action) {
    if (action.type === 'copy') return;
    if (['use', 'send', 'submit', 'feedback', 'choose', 'troubleshoot'].includes(action.type)) current.store.set(action.id + '.sent', true, { history: false });
    void run(current, { action });
  }
  function switchTo(conversation: Conversation) {
    setCurrentId(conversation.id); setDrawer(false);
  }
  function newChat() { switchTo(makeConversation()); }
  function openScenario(id: string) {
    const existing = [...conversations.current.values()].find(c => c.scenario === id || c.originScenario === id);
    if (existing) { switchTo(existing); return; }
    const conversation = makeConversation(id); switchTo(conversation);
    void run(conversation, { text: scenarios.find(item => item.id === id)!.prompt });
  }
  function regenerate(message: Message) {
    if (current.controller || !message.input) return;
    void run(current, { text: '' }, message);
  }
  const busy = !!current.controller, empty = !current.messages.length;
  const lastAssistant = [...current.messages].reverse().find(message => message.role === 'assistant');
  const ownChats = [...conversations.current.values()].filter(c => c.messages.length).reverse();
  const earlierScenarios = scenarios.filter(item => !ownChats.some(c => c.scenario === item.id || c.originScenario === item.id));
  const live = config.current.provider !== 'scripted' && !!config.current.apiKey?.trim();
  const providerName = config.current.provider === 'anthropic' ? 'Anthropic' : 'OpenAI';
  const composer = <div className="composer-area"><form className="composer" onSubmit={event => { event.preventDefault(); if (!busy) send(current.draft); }}>
    <textarea ref={textarea} rows={1} aria-label="Message Prism" placeholder="Message Prism" value={current.draft} onChange={event => { current.draft = event.target.value; notify(); }} onKeyDown={event => {
      if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229) { event.preventDefault(); if (!busy) send(current.draft); }
    }} />
    <button type={busy ? 'button' : 'submit'} className="send-btn" title={busy ? 'Stop response' : 'Send message'} aria-label={busy ? 'Stop response' : 'Send message'} disabled={!busy && !current.draft.trim()} onClick={busy ? () => stop() : undefined}><Icon name={busy ? 'stop' : 'send'} /></button>
  </form><button className="model-status" onClick={() => openOverlay('settings')}>{live ? `${providerName} · ${config.current.model || (config.current.provider === 'anthropic' ? 'claude-sonnet-4-20250514' : 'gpt-4o-mini')}` : 'Scripted demo · Connect a model'}</button></div>;
  return <ThemeScope theme={theme} animate={!reduced} className="chat-app">
    {drawer && mobile && <div className="sidebar-backdrop" onClick={() => setDrawer(false)} aria-hidden="true" />}
    <aside ref={sidebarRef} inert={overlay ? true : undefined} className={'sidebar' + (sidebar ? '' : ' collapsed') + (drawer ? ' drawer-open' : '')} aria-label="Conversations" role={drawer && mobile ? 'dialog' : undefined} aria-modal={drawer && mobile ? true : undefined}>
      <div className="sidebar-top"><button className="new-chat" onClick={newChat}><Icon name="plus" />New chat</button><button className="icon-btn" aria-label="Close sidebar" title="Close sidebar" onClick={() => { if (mobile) setDrawer(false); else setSidebar(false); }}><Icon name="sidebar" /></button></div>
      <nav className="chat-list" aria-label="Chat history">{ownChats.length > 0 && <div className="list-heading">Today</div>}{ownChats.map(c => <button key={c.id} className={'history-item' + (current.id === c.id ? ' selected' : '')} aria-current={current.id === c.id ? 'page' : undefined} onClick={() => switchTo(c)}>{c.title}</button>)}
        {earlierScenarios.length > 0 && <div className="list-heading earlier">Earlier</div>}{earlierScenarios.map(item => <button key={item.id} className="history-item" onClick={() => openScenario(item.id)}>{item.title}</button>)}
      </nav>
      <div className="sidebar-bottom"><button className="sidebar-link" onClick={() => openOverlay('palette')}><Icon name="grid" /><span>Components</span><kbd>Ctrl K</kbd></button><div className="sidebar-tools"><button className="sidebar-link" aria-label={'Theme: ' + themeChoice} title={'Theme: ' + themeChoice} onClick={() => { const next = themeChoice === 'system' ? 'light' : themeChoice === 'light' ? 'dark' : 'system'; setThemeChoice(next); try { localStorage.setItem('prism-theme', next); } catch {} }}><Icon name={themeChoice === 'system' ? 'monitor' : themeChoice === 'light' ? 'sun' : 'moon'} /><span>{themeChoice[0].toUpperCase() + themeChoice.slice(1)}</span></button><button className="icon-btn" aria-label="Settings" title="Settings" onClick={() => openOverlay('settings')}><Icon name="settings" /></button></div></div>
    </aside>
    <main className="chat-main" data-conversation={current.id} inert={overlay || (drawer && mobile) ? true : undefined}>
      <header className="chat-header"><button ref={sidebarToggle} className={'icon-btn sidebar-toggle' + (sidebar ? ' desktop-hidden' : '')} title="Open sidebar" aria-label="Open sidebar" onClick={() => { if (mobile) setDrawer(true); else setSidebar(true); }}><Icon name="sidebar" /></button><span>{empty ? 'Prism' : current.title}</span></header>
      {empty ? <div className="landing"><div className="landing-inner"><h1>What are we working on?</h1>{composer}<div className="suggestions" aria-label="Suggestions">{scenarios.map((scenario, index) => <button key={scenario.id} className="suggestion" onClick={() => send(scenario.prompt)}><Icon name={scenarioIcons[index]} /><strong>{scenarioTitles[index]}</strong><span>{descriptions[index]}</span></button>)}</div></div></div> : <>
        <div ref={scroll} className="thread-scroll" onScroll={() => { const element = scroll.current!; current.scroll = element.scrollTop; const following = element.scrollHeight - element.scrollTop - element.clientHeight < 72; if (following !== current.following) { current.following = following; notify(); } }}>
          <div className="thread" role="log" aria-label="Conversation" aria-live="polite" aria-relevant="additions text" aria-busy={busy}>
            {current.messages.map((message, index) => message.role === 'user' ? <div key={message.id} className="user-turn" data-message="user"><div>{message.text}</div></div> : <AssistantTurn key={message.id} text={message.text} streaming={!!message.streaming} error={message.error} store={current.store} theme={theme} animate={!reduced} onAction={onAction} continued={current.messages[index + 1]?.role === 'assistant'} last={message === lastAssistant} regenerate={message === lastAssistant && !busy ? () => regenerate(message) : undefined} />)}
          </div>
        </div>
        <footer className="composer-footer">{!current.following && <button className="jump-latest icon-btn" title="Jump to latest" aria-label="Jump to latest" onClick={() => { current.following = true; const element = scroll.current!; element.scrollTo?.({ top: element.scrollHeight, behavior: reduced ? 'instant' : 'smooth' }); notify(); }}><Icon name="down" /></button>}{composer}</footer>
      </>}
    </main>
    {overlay === 'palette' && <Palette onClose={closeOverlay} onChoose={(prompt, demoId) => { closeOverlay(); send(prompt, demoId); }} />}
    {overlay === 'settings' && <Settings config={config.current} onClose={closeOverlay} onSave={value => { try { saveAgentConfig(value); } catch { return; } config.current = value; revision.current++; closeOverlay(); notify(); }} />}
  </ThemeScope>;
}
