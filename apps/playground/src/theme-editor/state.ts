import { useEffect, useState } from 'react';
import { availableThemes } from '../themes';
import { tokenCatalogue, type ThemeDraft } from './model';

export const editorStorageKey = 'prism-theme-editor';
export const newDraft = (base: string): ThemeDraft => ({ name: 'My theme', base, tokens: {}, dark: {} });
function restore() {
  try {
    const value = JSON.parse(localStorage.getItem(editorStorageKey) ?? 'null');
    const draft = value?.draft;
    if (!draft || typeof draft.name !== 'string' || !availableThemes.some(base => base.name === draft.base)) return { draft: null, open: value?.open === true };
    const tokens = (map: unknown) => Object.fromEntries(tokenCatalogue.flatMap(({ key }) => map && typeof map === 'object' && typeof (map as Record<string, unknown>)[key] === 'string' ? [[key, (map as Record<string, string>)[key]]] : []));
    return { draft: { name: draft.name, base: draft.base, tokens: tokens(draft.tokens), dark: tokens(draft.dark) }, open: value.open === true };
  } catch { return { draft: null, open: false }; }
}
export function useThemeEditor(initialBase: string, urlOpen?: boolean) {
  const [initial] = useState(restore);
  const [open, setOpen] = useState(urlOpen ?? initial.open);
  const [history, setHistory] = useState<{ past: (ThemeDraft | null)[]; draft: ThemeDraft | null; future: (ThemeDraft | null)[] }>(() => ({ past: [], draft: initial.draft ?? (urlOpen || initial.open ? newDraft(initialBase) : null), future: [] }));
  const change = (next: ThemeDraft | null | ((draft: ThemeDraft | null) => ThemeDraft | null)) => setHistory(value => {
    const draft = typeof next === 'function' ? next(value.draft) : next;
    if (JSON.stringify(draft) === JSON.stringify(value.draft)) return value;
    return { past: value.draft ? [...value.past.slice(-99), value.draft] : value.past, draft, future: [] };
  });
  const undo = () => setHistory(value => value.past.length ? { past: value.past.slice(0, -1), draft: value.past.at(-1)!, future: [value.draft, ...value.future] } : value);
  const redo = () => setHistory(value => value.future.length ? { past: [...value.past, value.draft], draft: value.future[0], future: value.future.slice(1) } : value);
  useEffect(() => { try { localStorage.setItem(editorStorageKey, JSON.stringify({ draft: history.draft, open })); } catch {} }, [history.draft, open]);
  return { draft: history.draft, open, setOpen, change, undo, redo, canUndo: !!history.past.length, canRedo: !!history.future.length };
}
