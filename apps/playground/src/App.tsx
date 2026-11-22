import { useEffect, useState, type HTMLAttributes } from 'react';
import { ThemeScope } from '@prism-ui/react';
import { usePlaygroundController, readModePreference, type AppProps } from './usePlayground';
import { parseLocation, serialiseLocation } from './url-state';
import { availableThemes } from './themes';
import { themeFontCss } from './theme-fonts';
import { ChatShell, EditorShell, WorkspaceShell, ShellSwitcher } from './shells';
import { Palette } from './ui/Palette';
import { Settings } from './ui/Settings';
import './shells.css';

function ShellFrame({ 'data-prism-theme-name': theme, ...props }: HTMLAttributes<HTMLDivElement> & { 'data-prism-theme-name'?: string }) {
  return <div {...props} data-theme={theme}><style>{themeFontCss}</style>{props.children}</div>;
}

export function App(props: AppProps) {
  const [selection, setSelection] = useState(() => parseLocation(window.location.search, availableThemes.map(theme => theme.name)));
  const c = usePlaygroundController(props, selection.mode, selection.shell);
  const selected = availableThemes.find(theme => theme.name === selection.theme) ?? availableThemes[0];
  useEffect(() => { history.replaceState(null, '', location.pathname + '?' + serialiseLocation({ ...selection, mode: c.themeChoice === 'system' ? undefined : c.themeChoice }, location.search) + location.hash); }, [selection.shell, selection.theme, c.themeChoice]);
  useEffect(() => {
    const restore = () => { const next = parseLocation(location.search, availableThemes.map(theme => theme.name)); setSelection(next); c.setThemeChoice(next.mode ?? readModePreference()); c.setDrawer(false); };
    window.addEventListener('popstate', restore); return () => window.removeEventListener('popstate', restore);
  }, []);
  return <ThemeScope as={ShellFrame} theme={selected} mode={c.mode} density={selection.shell === 'chat' ? 'comfortable' : 'compact'} animate={!c.reduced} className={'chat-app shell shell-' + selection.shell} data-shell={selection.shell} data-mode={c.mode}>
    <div className="shell-stage" key={selection.shell} inert={!!c.overlay || undefined}>
      {selection.shell === 'chat' ? <ChatShell c={c} /> : selection.shell === 'editor' ? <EditorShell c={c} /> : <WorkspaceShell c={c} />}
    </div>
    <ShellSwitcher shell={selection.shell} theme={selected.name} mode={c.mode} inert={!!c.overlay} onShell={shell => { c.setDrawer(false); setSelection(value => ({ ...value, shell })); }} onTheme={theme => setSelection(value => ({ ...value, theme }))} onMode={() => c.chooseMode(c.mode === 'dark' ? 'light' : 'dark')} />
    {c.overlay === 'palette' && <Palette onClose={c.closeOverlay} onChoose={(prompt, demoId) => { c.closeOverlay(); c.send(prompt, demoId); }} />}
    {c.overlay === 'settings' && <Settings config={c.config} onClose={c.closeOverlay} onSave={c.saveSettings} />}
  </ThemeScope>;
}
