export const shells = ['chat', 'editor', 'workspace'] as const;
export type Shell = typeof shells[number];
export type LocationState = { shell: Shell; theme: string; mode?: 'light' | 'dark'; editor?: boolean };
export function parseLocation(search: string, themeNames: readonly string[] = ['host']): LocationState {
  const params = new URLSearchParams(search), shell = params.get('shell'), theme = params.get('theme'), mode = params.get('mode');
  return { shell: shells.includes(shell as Shell) ? shell as Shell : 'chat', theme: theme && themeNames.includes(theme) ? theme : 'host', mode: mode === 'light' || mode === 'dark' ? mode : undefined, ...(params.get('editor') === '1' ? { editor: true } : {}) };
}
export function serialiseLocation(state: LocationState, search = ''): string {
  const params = new URLSearchParams(search);
  params.set('shell', state.shell); params.set('theme', state.theme);
  if (state.mode) params.set('mode', state.mode); else params.delete('mode');
  if (state.editor) params.set('editor', '1'); else params.delete('editor');
  return params.toString();
}
