import { useEffect, useMemo, useRef, useState, type HTMLAttributes } from 'react';
import { ThemeScope } from '@prism-ui/react';
import { usePlaygroundController, readModePreference, type AppProps } from './usePlayground';
import { parseLocation, serialiseLocation } from './url-state';
import { availableThemes } from './themes';
import { themeFontCss } from './theme-fonts';
import { artifactFontStyle } from './artifact-fonts';
import { ChatShell, EditorShell, WorkspaceShell, ShellSwitcher } from './shells';
import { Palette } from './ui/Palette';
import { Settings } from './ui/Settings';
import { newDraft, useThemeEditor } from './theme-editor/state';
import { toTheme } from './theme-editor/model';
import { ThemeEditor } from './theme-editor/ThemeEditor';
import './shells.css';
import './theme-editor/editor.css';

function ShellFrame({ 'data-prism-theme-name': theme, 'data-theme-base': base, ...props }: HTMLAttributes<HTMLDivElement> & { 'data-prism-theme-name'?: string; 'data-theme-base'?: string }) {
  return <div {...props} data-theme={base ?? theme} style={{ ...props.style, ...artifactFontStyle }}><style>{themeFontCss}</style>{props.children}</div>;
}

export function App(props: AppProps) {
  const [selection, setSelection] = useState(() => parseLocation(window.location.search, availableThemes.map(theme => theme.name)));
  const c = usePlaygroundController(props, selection.mode, selection.shell);
  const selected = availableThemes.find(theme => theme.name === selection.theme) ?? availableThemes[0];
  const editor = useThemeEditor(selected.name, selection.editor);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const theme = useMemo(() => editor.draft ? toTheme({ ...editor.draft, name: 'playground-draft' }, availableThemes) : selected, [editor.draft, selected]);
  const closeEditor = () => { editor.setOpen(false); toggleRef.current?.focus(); };
  useEffect(() => { history.replaceState(null, '', location.pathname + '?' + serialiseLocation({ ...selection, editor: editor.open, mode: c.themeChoice === 'system' ? undefined : c.themeChoice }, location.search) + location.hash); }, [selection.shell, selection.theme, c.themeChoice, editor.open]);
  useEffect(() => {
    const restore = () => { const next = parseLocation(location.search, availableThemes.map(theme => theme.name)); setSelection(next); if (next.editor) editor.change(draft => draft ?? newDraft(next.theme)); editor.setOpen(!!next.editor); c.setThemeChoice(next.mode ?? readModePreference()); c.setDrawer(false); };
    window.addEventListener('popstate', restore); return () => window.removeEventListener('popstate', restore);
  }, []);
  return <ThemeScope as={ShellFrame} theme={theme} mode={c.mode} density={selection.shell === 'chat' ? 'comfortable' : 'compact'} animate={!c.reduced} className={'chat-app shell shell-' + selection.shell + (editor.open ? ' theme-editor-open' : '')} data-shell={selection.shell} data-mode={c.mode} data-theme-base={editor.draft?.base ?? selected.name}>
    <div className="shell-viewport">
    <div className="shell-stage" key={selection.shell} inert={!!c.overlay || undefined}>
      {selection.shell === 'chat' ? <ChatShell c={c} /> : selection.shell === 'editor' ? <EditorShell c={c} /> : <WorkspaceShell c={c} />}
    </div>
    <ShellSwitcher shell={selection.shell} theme={editor.draft ? 'custom' : selected.name} customName={editor.draft?.name} editorOpen={editor.open} toggleRef={toggleRef} onEditor={() => { if (!editor.draft) editor.change(newDraft(selected.name)); editor.setOpen(!editor.open); }} mode={c.mode} inert={!!c.overlay} onShell={shell => { c.setDrawer(false); setSelection(value => ({ ...value, shell })); }} onTheme={theme => { if (theme === 'custom') return; editor.change(editor.open ? newDraft(theme) : null); setSelection(value => ({ ...value, theme })); }} onMode={() => c.chooseMode(c.mode === 'dark' ? 'light' : 'dark')} />
    </div>
    {editor.open && editor.draft && <ThemeEditor draft={editor.draft} mode={c.mode} onMode={c.chooseMode} onChange={editor.change} onClose={closeEditor} undo={editor.undo} redo={editor.redo} canUndo={editor.canUndo} canRedo={editor.canRedo} />}
    {c.overlay === 'palette' && <Palette onClose={c.closeOverlay} onChoose={(prompt, demoId) => { c.closeOverlay(); c.send(prompt, demoId); }} />}
    {c.overlay === 'settings' && <Settings config={c.config} onClose={c.closeOverlay} onSave={c.saveSettings} />}
  </ThemeScope>;
}
