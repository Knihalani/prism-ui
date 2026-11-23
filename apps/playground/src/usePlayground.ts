import { useCallback, useEffect, useLayoutEffect, useReducer, useRef, useState } from 'react';
import { useFollowScroll, type Action } from '@prism-ui/react';
import { makeStore } from './store';
import { createAgent, forgetAgentKey, loadAgentConfig, saveAgentConfig, type AgentConfig } from './agent/config';
import { createScriptedAgent, routeMessage } from './agent/scripted';
import { realistic, type Pace } from './agent/pace';
import { scenarios } from './agent/scenarios';
import type { Agent, AgentInput, Turn } from './agent/types';
import { describeActionTurn } from './agent/interaction';
import { boundedSnapshot, type Provider } from './agent/policy';

type Request = { text: string; demoId?: string } | { action: Action };
type Message = { id: string; role: 'user' | 'assistant'; text: string; streaming?: boolean; error?: string; aborted?: boolean; input?: AgentInput; gallery?: boolean };
type Conversation = { id: string; title: string; scenario?: string; originScenario?: string; messages: Message[]; store: ReturnType<typeof makeStore>; scripted: Agent; agent?: Agent; revision: number; queue: Request[]; controller?: AbortController; draft: string; scroll: number; following: boolean };
export type AppProps = { pace?: Pace; agentFactory?: (config: AgentConfig) => Agent };
let sequence = 0;
const nextId = () => 'chat-' + Date.now().toString(36) + '-' + ++sequence;
export function useMedia(query: string) {
  const [matches, setMatches] = useState(() => typeof matchMedia === 'function' && matchMedia(query).matches);
  useEffect(() => { if (typeof matchMedia !== 'function') return; const media = matchMedia(query), update = () => setMatches(media.matches); update(); media.addEventListener('change', update); return () => media.removeEventListener('change', update); }, [query]);
  return matches;
}
export function usePlaygroundController({ pace = realistic, agentFactory }: AppProps, initialMode?: 'light' | 'dark', surfaceKey = 'chat') {
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
  const [themeChoice, setThemeChoice] = useState<'light' | 'dark' | 'system'>(() => initialMode ?? readModePreference());
  const darkSystem = useMedia('(prefers-color-scheme: dark)'), mobile = useMedia('(max-width: 760px)'), reduced = useMedia('(prefers-reduced-motion: reduce)');
  const theme = themeChoice === 'system' ? darkSystem ? 'dark' : 'light' : themeChoice;
  const scroll = useRef<HTMLDivElement>(null), textarea = useRef<HTMLTextAreaElement>(null), sidebarRef = useRef<HTMLElement>(null), sidebarToggle = useRef<HTMLButtonElement>(null);
  const { following, jumpToLatest, setFollowing } = useFollowScroll(scroll);
  const mounted = useRef(true);
  const focusComposer = useRef(false);
  const notify = useCallback(() => { if (mounted.current) redraw(); }, []);
  const closeOverlay = useCallback(() => setOverlay(undefined), []);
  const openOverlay = (value: 'palette' | 'settings') => { setDrawer(false); setOverlay(value); };
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; for (const c of conversations.current.values()) { c.queue = []; c.controller?.abort(); } }; }, []);
  useEffect(() => { current.following = following; }, [following]);
  useEffect(() => {
    const listener = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') { event.preventDefault(); setDrawer(false); setOverlay(value => value === 'palette' ? undefined : 'palette'); }
    };
    document.addEventListener('keydown', listener); return () => document.removeEventListener('keydown', listener);
  }, []);
  useEffect(() => {
    if (!drawer || !mobile) return;
    const previous = document.activeElement as HTMLElement | null, root = sidebarRef.current;
    if (!root) return;
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
    if (focusComposer.current) { focusComposer.current = false; element.focus(); }
  }, [current.draft, currentId, current.messages.length, surfaceKey]);
  useLayoutEffect(() => {
    const element = scroll.current; if (!element) return;
    setFollowing(current.following);
    element.scrollTop = current.following ? element.scrollHeight : current.scroll;
    if (!current.following) setFollowing(false);
  }, [currentId, surfaceKey, current.messages.length === 0, setFollowing]);
  function stop(conversation = current) {
    for (const message of conversation.messages) if (message.streaming) message.aborted = true;
    conversation.queue = []; conversation.controller?.abort();
    for (const message of conversation.messages) message.streaming = false;
    notify();
  }
  async function run(conversation: Conversation, request: Request, replacement?: Message) {
    if (conversation.controller) { conversation.queue.push(request); return; }
    const history: Turn[] = conversation.messages.filter(message => message !== replacement).flatMap(message => [
      ...(message.input?.kind === 'action' ? [{ role: 'user' as const, text: describeActionTurn(message.input) }] : []),
      ...(!message.error && !message.aborted && (message.role !== 'assistant' || message.text.trim()) ? [{ role: message.role, text: message.text }] : []),
    ]);
    const input: AgentInput = replacement?.input ?? ('action' in request ? { kind: 'action', action: request.action, history, snapshot: boundedSnapshot(conversation.store.snapshot()) } : { kind: 'message', text: request.demoId ? 'gallery:' + request.demoId : request.text, history });
    const gallery = replacement?.gallery ?? ('demoId' in request && !!request.demoId);
    if (!replacement && 'text' in request) {
      conversation.messages.push({ id: nextId(), role: 'user', text: request.text });
      if (conversation.title === 'New chat') conversation.title = request.text.slice(0, 40);
    }
    const message: Message = replacement ?? { id: nextId(), role: 'assistant', text: '' };
    if (replacement) message.id = nextId();
    if (!replacement) conversation.messages.push(message);
    message.text = ''; message.error = undefined; message.aborted = false; message.streaming = true; message.input = input; message.gallery = gallery;
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
    if (!current.messages.length) focusComposer.current = true;
    if (!current.messages.length && !demoId) {
      const route = routeMessage(text);
      if (route.kind === 'scenario') current.originScenario = route.scenario.id;
    }
    current.draft = ''; current.following = true; jumpToLatest();
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
  const providerName = config.current.provider === 'anthropic' ? 'Anthropic' : config.current.provider === 'openrouter' ? 'OpenRouter' : 'OpenAI';
  function chooseMode(value: 'light' | 'dark' | 'system') { setThemeChoice(value); try { localStorage.setItem('prism-theme', value); } catch {} }
  function saveSettings(value: AgentConfig, baseline: AgentConfig) { if (!saveAgentConfig(value, baseline)) return false; config.current = loadAgentConfig(); revision.current++; closeOverlay(); notify(); return true; }
  function forgetKey(provider: Provider) { if (!forgetAgentKey(provider)) return false; config.current = loadAgentConfig(); revision.current++; notify(); return true; }
  return { current, currentId, ownChats, earlierScenarios, busy, empty, lastAssistant, live, providerName, scroll, following, jumpToLatest, textarea, sidebarRef, sidebarToggle, sidebar, setSidebar, drawer, setDrawer, overlay, openOverlay, closeOverlay, themeChoice, setThemeChoice, chooseMode, mode: theme, reduced, mobile, notify, send, stop, onAction, switchTo, newChat, openScenario, regenerate, config: config.current, saveSettings, forgetKey };
}
export type PlaygroundController = ReturnType<typeof usePlaygroundController>;
export function readModePreference(): 'light' | 'dark' | 'system' { try { const saved = localStorage.getItem('prism-theme'); return saved === 'light' || saved === 'dark' ? saved : 'system'; } catch { return 'system'; } }
