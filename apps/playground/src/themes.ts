import { host, type PrismTheme } from '@prism-ui/react';
import * as themes from '@prism-ui/themes';
export function enumerateThemes(exports: Record<string, unknown>): PrismTheme[] {
  const result = [host], names = new Set([host.name]);
  for (const value of Object.values(exports)) {
    if (value && typeof value === 'object' && 'name' in value && typeof value.name === 'string' && !names.has(value.name)) {
      const theme = value as PrismTheme; result.push(theme); names.add(theme.name);
    }
  }
  return result;
}
export const availableThemes = enumerateThemes(themes);
